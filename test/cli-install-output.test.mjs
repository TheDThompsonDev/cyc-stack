import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installProject } from '../scripts/install.mjs';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(source, 'bin/cyc.mjs');
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'cyc-terminal-'));
  const project = join(base, 'project with spaces'); mkdirSync(project);
  const preload = join(base, 'tty.cjs');
  writeFileSync(preload, "Object.defineProperty(process.stdout, 'isTTY', { value: true });");
  t.after(() => { assert.equal(dirname(base), resolve(tmpdir())); assert(base.startsWith(join(resolve(tmpdir()), 'cyc-terminal-'))); rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  return { base, project, preload };
}
function run(f, args, { tty = true, cli = entry } = {}) {
  return spawnSync(process.execPath, [...(tty ? ['--require', f.preload] : []), cli, ...args, '--project', f.project], { cwd: f.project, encoding: 'utf8', windowsHide: true });
}

test('interactive init shows installation outcome and next step instead of the engine file dump', t => {
  const f = fixture(t), result = run(f, ['init', '--hosts', 'codex']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CYC Stack .* installed/);
  assert(result.stdout.includes(f.project)); assert.match(result.stdout, /Hosts: Codex/);
  assert.match(result.stdout, /Files: \d+ created/);
  assert.match(result.stdout, /\/cyc Set up CYC for this project/);
  assert.match(result.stdout, /not verified/);
  assert.match(result.stdout, /No verification commands are configured/);
  assert.doesNotMatch(result.stdout, /"changes"|\.cyc\/engine\/scripts\//);
  assert(result.stdout.split('\n').length < 35, result.stdout);
});

test('noninteractive init and explicit JSON or legacy verbose keep the complete result', t => {
  for (const [label, flags, tty] of [['pipe', [], false], ['json', ['--json'], true], ['verbose', ['--verbose'], true]]) {
    const f = fixture(t), result = run(f, ['init', '--hosts', 'codex', '--dry-run', ...flags], { tty });
    assert.equal(result.status, 0, `${label}: ${result.stderr}`);
    const data = JSON.parse(result.stdout);
    assert.equal(data.ok, true); assert.equal(data.dryRun, true);
    assert(data.changes.some(c => c.path === '.cyc/engine/scripts/runtime.mjs'));
    assert.equal(data.warnings.length, 2);
    assert.equal(existsSync(join(f.project, '.cyc')), false);
  }
});

test('interactive dry run labels all file counts as plans and leaves the project untouched', t => {
  const f = fixture(t), result = run(f, ['install', '--hosts', 'codex', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /installation preview/);
  assert.match(result.stdout, /No files changed/);
  assert.match(result.stdout, /Would create \d+ files/);
  assert.doesNotMatch(result.stdout, /CYC Stack .* installed|Files: \d+ created/);
  assert.equal(existsSync(join(f.project, '.cyc')), false);
});

test('an unchanged installation reports up to date while preserving activation limits', t => {
  const f = fixture(t); assert.equal(installProject(f.project, { hosts: ['codex'] }).ok, true);
  const result = run(f, ['init', '--hosts', 'codex']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /up to date/);
  assert.match(result.stdout, /No file changes/);
  assert.match(result.stdout, /not verified/);
});

test('interactive conflicts name the customized file and never claim planned writes were applied', t => {
  const f = fixture(t); assert.equal(installProject(f.project, { hosts: ['codex'] }).ok, true);
  const file = '.cyc/engine/docs/principles.md';
  writeFileSync(join(f.project, file), 'User customization that must survive.');
  const result = run(f, ['init', '--hosts', 'codex']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Installation stopped/); assert(result.stdout.includes(file));
  assert.match(result.stdout, /modified|customized/i);
  assert.doesNotMatch(result.stdout, /CYC Stack .* installed|Files: \d+ created/);
  assert.equal(readFileSync(join(f.project, file), 'utf8'), 'User customization that must survive.');
});

test('interactive installer and argument errors retain failure status and JSON stays parseable', t => {
  const f = fixture(t); mkdirSync(join(f.project, '.cyc')); writeFileSync(join(f.project, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, verification: { commands: [] }, limits: { maxAttempts: 3, maxNoProgress: 2 } }));
  const blocked = run(f, ['init', '--hosts', 'codex']);
  assert.equal(blocked.status, 1); assert.match(blocked.stdout, /Installation stopped/);
  assert.match(blocked.stdout, /Unowned \.cyc\/config\.json/);
  const arg = run(f, ['init', '--unknown-option']);
  assert.equal(arg.status, 1); assert.match(arg.stderr, /Installation stopped/); assert.match(arg.stderr, /Unknown option/);
  const machine = run(f, ['init', '--unknown-option', '--json']);
  assert.equal(machine.status, 1); assert.equal(JSON.parse(machine.stderr).ok, false);
});

test('installed CLI carries the formatter and other interactive commands retain JSON', t => {
  const f = fixture(t); assert.equal(installProject(f.project, { hosts: ['codex'] }).ok, true);
  const cli = join(f.project, '.cyc/engine/bin/cyc.mjs');
  const result = run(f, ['init', '--hosts', 'codex'], { cli });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /up to date/);
  const json = run(f, ['init', '--hosts', 'codex', '--json'], { cli });
  assert.equal(json.status, 0, json.stderr); assert.equal(JSON.parse(json.stdout).ok, true);
  const other = run(f, ['playbooks'], { cli });
  assert.equal(other.status, 0, other.stderr); assert.equal(typeof JSON.parse(other.stdout), 'object');
});

test('preview and blocked migration notes are qualified as unapplied installer plans', t => {
  for (const blocked of [false, true]) {
    const f = fixture(t); assert.equal(installProject(f.project, { hosts: ['codex'] }).ok, true);
    const path = join(f.project, '.cyc/config.json'), config = JSON.parse(readFileSync(path, 'utf8'));
    config.limits.maxDurationMs = 900000; writeFileSync(path, JSON.stringify(config));
    if (blocked) writeFileSync(join(f.project, '.cyc/engine/docs/principles.md'), 'User customization.');
    const result = run(f, ['init', '--hosts', 'codex', ...(blocked ? [] : ['--dry-run'])]);
    assert.equal(result.status, blocked ? 1 : 0, result.stderr);
    assert.match(result.stdout, blocked ? /changes described.*not confirmed/ : /changes described.*planned only/);
    assert.match(result.stdout, /Removed the legacy 15-minute run limit/);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).limits.maxDurationMs, 900000);
  }
});
