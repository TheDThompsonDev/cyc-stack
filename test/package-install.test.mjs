import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { fixtureAssessment } from '../test-support/assessments.mjs';

test('packed archive installs offline through npm without GitFetcher, including dry-run', { timeout: 120000 }, t => {
  const temporary = mkdtempSync(join(tmpdir(), 'cyc archive test '));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = fileURLToPath(new URL('..', import.meta.url));
  const target = join(temporary, 'project'); mkdirSync(target);
  const npm = (args, cwd) => {
    // All arguments originate here, not from repository or user input.
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(command, process.platform === 'win32' ? args.map(arg => `"${arg}"`) : args, {
      cwd, shell: process.platform === 'win32', encoding: 'utf8', timeout: 90000,
      env: { ...process.env, npm_config_cache: join(temporary, 'cache'), npm_config_update_notifier: 'false' }
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
    return result.stdout;
  };
  const packed = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], source))[0];
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
  const started = cli('run', 'start', '--goal', 'Preserve installed fixture behavior', '--playbook', 'feature', '--criterion', 'Behavior is working');
  assert.equal(started.status, 0, started.stderr);
  const id = JSON.parse(started.stdout).runId;
  const recovery = cli('run', 'recover', '--run', id);
  assert.equal(recovery.status, 0, recovery.stderr);
  assert.equal(JSON.parse(recovery.stdout).nextAction.kind, 'continue');
  assert.equal(cli('run', 'record', '--run', id, '--summary', 'Missing required assessment').status, 1);
  for (const stage of ['scout', 'build', 'verify', 'deliver']) {
    if (stage === 'verify') assert.equal(cli('run', 'verify', '--run', id).status, 0);
    const state = JSON.parse(readFileSync(join(target, '.cyc/runs', id, 'state.json')));
    assert.equal(state.stages[state.stageIndex], stage);
    const assessment = fixtureAssessment(state);
    // A passed Build records what was built; this fixture builds one note file.
    if (stage === 'build') writeFileSync(join(target, 'built.txt'), 'built by the installed fixture');
    const path = join(target, '.cyc/runs', id, `${stage}.json`);
    if (assessment) writeFileSync(path, JSON.stringify(assessment));
    const recorded = cli('run', 'record', '--run', id, '--summary', 'Installed fixture reviewed', '--criteria-passed', 'Behavior command and fixture review', ...(assessment ? ['--assessment', path] : []));
    assert.equal(recorded.status, 0, recorded.stderr);
  }
  assert.equal(cli('run', 'complete', '--run', id).status, 0);
  assert.match(readFileSync(join(target, '.cyc/runs', id, 'review.md'), 'utf8'), /Status: complete/);
});
