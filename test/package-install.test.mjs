import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fixtureAssessment } from '../test-support/assessments.mjs';

test('packed archive installs offline through npm without GitFetcher, including dry-run', { timeout: 120000 }, t => {
  const temporary = mkdtempSync(join(tmpdir(), 'cyc archive test '));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = fileURLToPath(new URL('..', import.meta.url));
  const target = join(temporary, 'project'); mkdirSync(target);
  const npm = (args, cwd, expectedStatus = 0) => {
    // All arguments originate here, not from repository or user input.
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(command, process.platform === 'win32' ? args.map(arg => `"${arg}"`) : args, {
      cwd, shell: process.platform === 'win32', encoding: 'utf8', timeout: 90000,
      env: { ...process.env, npm_config_cache: join(temporary, 'cache'), npm_config_update_notifier: 'false' }
    });
    assert.equal(result.status, expectedStatus, result.stderr || result.error?.message || result.stdout);
    return expectedStatus === 0 ? result.stdout : result.stderr;
  };
  const packed = JSON.parse(npm(['run', '--silent', 'pack:release', '--', '--output', temporary], source));
  const sum = createHash('sha256').update(readFileSync(join(temporary, packed.filename))).digest('hex');
  assert.equal(readFileSync(join(temporary, 'SHA256SUMS'), 'utf8'), `${sum}  ${packed.filename}\n`);
  for (const path of ['plugin.json', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json', 'skills/cyc/SKILL.md', 'hooks/codex.json', 'hooks/claude.json', 'hooks/cursor.json']) {
    assert.ok(packed.files.some(file => file.path === path), `missing plugin resource: ${path}`);
  }
  assert.ok(packed.unpackedSize < 1024 * 1024, 'release archive must stay below 1 MiB unpacked');
  for (const file of packed.files) {
    assert.equal(/^(?:evals\/|test\/|docs\/context\/)|^scripts\/bump-version\.mjs$|^docs\/assets\/(?:.*\.png|.*\.html|build-workflow-diagram\.mjs)$/.test(file.path), false, `development-only file packed: ${file.path}`);
  }
  assert.ok(packed.files.some(file => file.path === 'scripts/claude-project-hook.mjs'));
  assert.ok(packed.files.some(file => file.path === 'scripts/work-review.mjs'));
  assert.ok(packed.files.some(file => file.path === 'scripts/onboarding.mjs'));
  assert.ok(packed.files.some(file => file.path === 'scripts/host-activation.mjs'));
  assert.ok(packed.files.some(file => file.path === 'scripts/recovery.mjs'));
  assert.ok(packed.files.some(file => file.path === 'docs/work-assessments.md'));
  assert.ok(packed.files.some(file => file.path.startsWith('methods/')));
  const archive = join(temporary, packed.filename);
  const args = ['exec', '--offline', '--yes', '--package', archive, '--', 'cyc', 'init', '--project', target];
  assert.equal(JSON.parse(npm([...args, '--dry-run'], target)).ok, true);
  assert.deepEqual(readdirSync(target), []);
  assert.equal(JSON.parse(npm(args, target)).ok, true);
  assert.ok(readFileSync(join(target, '.cyc/engine/docs/installation.md'), 'utf8').includes('## Agent-guided installation'), 'agent procedure is available without the source checkout');
  assert.ok(readFileSync(join(target, '.cyc/engine/methods/cyc-setup/SKILL.md'), 'utf8').length, 'agent setup instructions ship with the guide');
  const doctor = spawnSync(process.execPath, [join(target, '.cyc/engine/bin/cyc.mjs'), 'doctor'], { cwd: target, encoding: 'utf8' });
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.equal(JSON.parse(doctor.stdout).ok, true);
  const manifest = JSON.parse(readFileSync(join(target, '.cyc/install-manifest.json')));
  assert.equal(manifest.version, JSON.parse(readFileSync(join(source, 'package.json'))).version);

  // Preflight metadata alone cannot detect a missing runtime file. Check the actual pack.
  const damaged = join(temporary, 'damaged source'); mkdirSync(damaged);
  const pkg = JSON.parse(readFileSync(join(source, 'package.json')));
  for (const path of [...pkg.files, 'package.json', 'package-lock.json', 'LICENSE', 'CHANGELOG.md', 'scripts/check-distribution.mjs', 'scripts/pack-release.mjs']) {
    const destination = join(damaged, path); mkdirSync(join(destination, '..'), { recursive: true });
    cpSync(join(source, path), destination, { recursive: true });
  }
  unlinkSync(join(damaged, 'scripts/response-hook.mjs'));
  const rejectedOutput = join(temporary, 'rejected');
  mkdirSync(rejectedOutput);
  writeFileSync(join(rejectedOutput, 'SHA256SUMS'), 'stale release checksum');
  assert.match(npm(['run', '--silent', 'pack:release', '--', '--output', rejectedOutput], damaged, 1), /Archive is missing scripts\/response-hook\.mjs/);
  assert.equal(existsSync(join(rejectedOutput, 'SHA256SUMS')), false, 'a rejected archive must not retain an old release checksum');

  // Exercise the distributed CLI, not imports from this development checkout.
  const configPath = join(target, '.cyc/config.json');
  const config = JSON.parse(readFileSync(configPath));
  config.verification = { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('behavior.txt','utf8')==='working'?0:1)"] }] };
  writeFileSync(configPath, JSON.stringify(config));
  writeFileSync(join(target, 'behavior.txt'), 'working');
  const cli = (...args) => spawnSync(process.execPath, [join(target, '.cyc/engine/bin/cyc.mjs'), ...args], { cwd: target, encoding: 'utf8', windowsHide: true });
  const setup = cli('onboard', '--verify');
  assert.equal(setup.status, 1, 'local checks without live hooks are not successful setup');
  const readiness = JSON.parse(setup.stdout);
  assert.equal(readiness.steps.find(step => step.id === 'checks').status, 'passed');
  assert.ok(['missing', 'unverified'].includes(readiness.steps.find(step => step.id === 'host').status));
  assert.equal(readiness.ready, false);
  const doc = 'docs/context/installed-fixture.md';
  const startFile = join(target, '.cyc/runtime/installed-start.json');
  mkdirSync(join(target, '.cyc/runtime'), { recursive: true });
  writeFileSync(startFile, JSON.stringify({ goal: 'Preserve installed fixture behavior', playbook: 'feature', executionMode: 'standalone', criteria: [{ id: 'behavior', description: 'Behavior is working' }], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'installed-fixture', doc, paths: ['behavior.txt', 'built.txt'] }] } }));
  const started = cli('run', 'start', '--file', startFile);
  assert.equal(started.status, 0, started.stderr);
  const id = JSON.parse(started.stdout).runId;
  const recovery = cli('run', 'recover', '--run', id);
  assert.equal(recovery.status, 0, recovery.stderr);
  assert.equal(JSON.parse(recovery.stdout).nextAction.kind, 'continue');
  assert.equal(cli('run', 'record', '--run', id, '--summary', 'Missing required assessment').status, 1);
  for (const stage of ['scout', 'build', 'verify', 'deliver']) {
    if (stage === 'verify') {
      const contextFile = join(target, '.cyc/runs', id, 'context.json');
      writeFileSync(contextFile, JSON.stringify({ records: [{ id: 'installed-fixture', currentView: 'This installed fixture reads behavior.txt through the configured behavior command and builds built.txt as a local note. It has no remote storage, identity policy or production integration. Keep controller diagnostics outside covered source. Run the configured behavior check and context lint to reproduce the local contract; passing these synthetic checks is not native activation, user acceptance or a model effectiveness claim. Detailed receipts remain local to the disposable target.' }] }));
      const prepared = cli('context', 'prepare', '--run', id, '--file', contextFile);
      assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
      assert.equal(JSON.parse(prepared.stdout).ok, true);
      const verified = cli('run', 'verify', '--run', id);
      assert.equal(verified.status, 0, verified.stdout + verified.stderr);
    }
    const state = JSON.parse(readFileSync(join(target, '.cyc/runs', id, 'state.json')));
    assert.equal(state.stages[state.stageIndex], stage);
    const assessment = fixtureAssessment(state);
    if (stage === 'deliver') assessment.learning = { status: 'recorded', reason: 'Retain the installed fixture capability and its isolated verification limits.', artifacts: [doc] };
    // A passed Build records what was built; this fixture builds one note file.
    if (stage === 'build') writeFileSync(join(target, 'built.txt'), 'built by the installed fixture');
    const path = join(target, '.cyc/runs', id, `${stage}.json`);
    if (assessment) writeFileSync(path, JSON.stringify(assessment));
    const recorded = cli('run', 'record', '--run', id, '--summary', 'Installed fixture reviewed', '--criteria-passed', 'Behavior command and fixture review', ...(assessment ? ['--assessment', path] : []));
    assert.equal(recorded.status, 0, recorded.stderr);
  }
  assert.equal(cli('run', 'complete', '--run', id).status, 0);
  assert.match(readFileSync(join(target, '.cyc/runs', id, 'review.md'), 'utf8'), /Status: complete/);
  assert.equal(cli('context', 'lint').status, 0);
  const completed = JSON.parse(readFileSync(join(target, '.cyc/runs', id, 'state.json')));
  assert.deepEqual(completed.handoffs.at(-1).contextDocs, [doc]);
});
