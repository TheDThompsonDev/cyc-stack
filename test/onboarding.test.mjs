import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { onboardProject } from '../scripts/onboarding.mjs';
import { installProject } from '../scripts/install.mjs';

function fixture(t, script = "process.exit(0)") {
  const root = mkdtempSync(join(tmpdir(), 'cyc-onboarding-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  mkdirSync(join(root, '.cyc'));
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', script] }] } }));
  writeFileSync(join(root, 'feature.txt'), 'original');
  return root;
}
const step = (report, id) => report.steps.find(item => item.id === id);

test('onboarding inspection never runs commands and recognizes config-only projects', t => {
  const root = fixture(t, "require('node:fs').writeFileSync('executed.txt','yes')");
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const result = onboardProject(root);
  assert.equal(result.ok, false, 'missing live hooks must not report successful setup');
  assert.equal(result.installation, 'config-only');
  assert.equal(step(result, 'checks').status, 'unverified');
  assert.ok(['missing', 'unverified'].includes(step(result, 'host').status));
  assert.ok(result.evidenceSources.includes('package.json'));
  assert.equal(existsSync(join(root, 'executed.txt')), false);
  assert.equal(existsSync(join(root, '.cyc/runtime/onboarding-checks.json')), false);
});

test('setup receipt requires real checks and becomes stale after source or config edits', t => {
  const root = fixture(t, "process.exit(require('node:fs').readFileSync('feature.txt','utf8')==='original'?0:1)");
  let result = onboardProject(root, { verify: true });
  assert.equal(step(result, 'checks').status, 'passed');
  assert.ok(['missing', 'unverified'].includes(step(result, 'host').status));
  assert.equal(result.nextAction.step, 'host');
  writeFileSync(join(root, 'feature.txt'), 'edited');
  assert.equal(step(onboardProject(root), 'checks').status, 'stale');
  writeFileSync(join(root, 'feature.txt'), 'original');
  const path = join(root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(path)); config.limits.maxAttempts = 4;
  writeFileSync(path, JSON.stringify(config));
  assert.equal(step(onboardProject(root), 'checks').status, 'stale');
});

test('failed checks, source-writing checks and invalid receipts never establish setup readiness', t => {
  for (const script of ['process.exit(1)', "require('node:fs').writeFileSync('feature.txt','mutated')"]) {
    const root = fixture(t, script);
    const result = onboardProject(root, { verify: true });
    assert.equal(step(result, 'checks').status, 'failed');
    assert.equal(result.ok, false);
    assert.equal(step(onboardProject(root), 'checks').status, 'failed');
  }
  const root = fixture(t);
  onboardProject(root, { verify: true });
  writeFileSync(join(root, '.cyc/runtime/onboarding-checks.json'), '{bad json');
  assert.equal(step(onboardProject(root), 'checks').status, 'unverified');
});

test('missing, empty and invalid check configurations are actionable and never executed', t => {
  const root = fixture(t);
  for (const commands of [[], [{ id: 'bad', command: 'node', args: 'not-an-array' }]]) {
    const path = join(root, '.cyc/config.json');
    const config = JSON.parse(readFileSync(path)); config.verification.commands = commands;
    writeFileSync(path, JSON.stringify(config));
    const result = onboardProject(root, { verify: true });
    assert.equal(result.ok, false);
    assert.equal(result.nextAction.step, 'configuration');
    assert.equal(existsSync(join(root, '.cyc/runtime/onboarding-checks.json')), false);
  }
  rmSync(join(root, '.cyc/config.json'));
  const result = onboardProject(root);
  assert.equal(result.nextAction.step, 'installation');
});

test('installed CLI includes onboarding and does not certify live hooks', t => {
  const root = fixture(t);
  rmSync(join(root, '.cyc/config.json'));
  assert.equal(installProject(root, { hosts: ['codex'] }).ok, true);
  const cli = join(root, '.cyc/engine/bin/cyc.mjs');
  const result = spawnSync(process.execPath, [cli, 'onboard', '--project', root], { encoding: 'utf8' });
  const report = JSON.parse(result.stdout);
  assert.equal(report.installation, 'project');
  assert.equal(step(report, 'installation').status, 'passed');
  assert.ok(['missing', 'unverified'].includes(step(report, 'host').status));
  assert.equal(result.status, 1, 'empty verification commands need setup');
  const configPath = join(root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(configPath));
  config.verification.commands = [{ id: 'real-file', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('feature.txt','utf8')==='original'?0:1)"] }];
  writeFileSync(configPath, JSON.stringify(config));
  const checked = spawnSync(process.execPath, [cli, 'onboard', '--verify', '--project', root], { encoding: 'utf8' });
  assert.equal(checked.status, 1, 'passing local checks do not replace missing live hooks');
  assert.equal(step(JSON.parse(checked.stdout), 'checks').status, 'passed');
  assert.ok(['missing', 'unverified'].includes(step(JSON.parse(checked.stdout), 'host').status));
});

test('dry-run cannot accidentally execute onboarding commands', t => {
  const root = fixture(t, "require('node:fs').writeFileSync('executed.txt','yes')");
  const result = spawnSync(process.execPath, ['bin/cyc.mjs', 'onboard', '--verify', '--dry-run', '--project', root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(existsSync(join(root, 'executed.txt')), false);
});

test('configuration-changing checks and runtime paths leaving the project cannot produce passing receipts', t => {
  const root = fixture(t, "require('node:fs').appendFileSync('.cyc/config.json','\\n')");
  assert.notEqual(step(onboardProject(root, { verify: true }), 'checks').status, 'passed');
  const outside = fixture(t);
  const linked = fixture(t, "require('node:fs').writeFileSync('executed.txt','yes')");
  symlinkSync(outside, join(linked, '.cyc/runtime'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = onboardProject(linked, { verify: true });
  assert.equal(result.ok, false);
  assert.equal(existsSync(join(linked, 'executed.txt')), false);
  assert.equal(existsSync(join(outside, 'onboarding-checks.json')), false);
});
