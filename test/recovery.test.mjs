import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { startRun, recoverRun, readRun, quickHandoff, verifyRun, controlRun, completeRun } from '../scripts/runtime.mjs';
// These tests are not about run-start measurement; a background worker would outlive their temp folders.
process.env.CYC_BASELINE_MODE = 'off';

function fixture(t, script = 'process.exit(0)', limits = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-recovery-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  mkdirSync(join(root, '.cyc'));
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2, ...limits }, verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', script] }] } }));
  writeFileSync(join(root, 'feature.txt'), 'original');
  const id = startRun(root, { goal: 'Verify the example behavior', playbook: 'verify', criteria: [{ id: 'behavior', description: 'Example behavior holds' }] }).runId;
  quickHandoff(root, id, { summary: 'Located the example behavior and its configured check.' });
  return { root, id };
}

test('recovery retrieves failed receipt without restoring verification or changing files and budgets', t => {
  const { root, id } = fixture(t, "console.error('Expected the original feature value');process.exit(1)");
  verifyRun(root, id);
  const before = readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8');
  const review = readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8');
  const result = recoverRun(root, id);
  assert.equal(result.nextAction.kind, 'inspect-check');
  assert.equal(result.verification.status, 'unverified');
  assert.equal(result.lastCheck.failedChecks[0].id, 'behavior');
  assert.match(result.lastCheck.failedChecks[0].outputTail, /Expected the original/);
  assert.equal(result.remainingAttempts, 2);
  assert.equal(readRun(root, id).verification, null);
  assert.equal(readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8'), before);
  assert.equal(readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8'), review);
  assert.equal(readFileSync(join(root, 'feature.txt'), 'utf8'), 'original');
  assert.throws(() => completeRun(root, id), /Unfinished/);
});

test('pause, resume and source edits never reuse historical passing checks as current proof', t => {
  const { root, id } = fixture(t);
  verifyRun(root, id);
  assert.equal(recoverRun(root, id).verification.status, 'passed');
  controlRun(root, id, 'pause');
  assert.equal(recoverRun(root, id).nextAction.kind, 'resume');
  assert.equal(recoverRun(root, id).verification.status, 'unverified');
  controlRun(root, id, 'resume');
  const resumed = recoverRun(root, id);
  assert.equal(resumed.verification.status, 'unverified');
  assert.equal(resumed.nextAction.kind, 'verify');
  verifyRun(root, id);
  writeFileSync(join(root, 'feature.txt'), 'user edit');
  assert.equal(recoverRun(root, id).verification.status, 'stale');
  assert.equal(recoverRun(root, id).nextAction.kind, 'verify');
  assert.equal(readFileSync(join(root, 'feature.txt'), 'utf8'), 'user edit');
});

test('blocked recovery names the recorded prerequisite instead of automatically resuming', t => {
  const { root, id } = fixture(t);
  quickHandoff(root, id, { status: 'blocked', summary: 'Database unavailable.', nextAction: 'Start the documented local database.' });
  const result = recoverRun(root, id);
  assert.equal(result.nextAction.kind, 'resolve-blocker');
  assert.match(result.nextAction.instruction, /Start the documented local database/);
  assert.equal(readRun(root, id).status, 'blocked');
});

test('exhausted CLI verification recommends review, not another retry', t => {
  const { root, id } = fixture(t, 'process.exit(1)', { maxAttempts: 1 });
  const cli = spawnSync(process.execPath, ['bin/cyc.mjs', 'run', 'verify', '--run', id, '--project', root], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  const result = JSON.parse(cli.stdout);
  assert.equal(result.recovery.nextAction.kind, 'review-terminal');
  assert.doesNotMatch(result.hint, /then run verify again/i);
  assert.equal(recoverRun(root, id).remainingAttempts, 0);
  assert.throws(() => controlRun(root, id, 'resume'), /terminal/);
});

test('protected changes and an expired budget take priority over a resume suggestion', t => {
  const { root, id } = fixture(t);
  controlRun(root, id, 'pause');
  const path = join(root, '.cyc/config.json');
  writeFileSync(path, readFileSync(path, 'utf8') + '\n');
  assert.equal(recoverRun(root, id).nextAction.kind, 'review-guard');
  assert.equal(readRun(root, id).status, 'paused', 'inspection must not apply the guard transition');
  const expired = fixture(t);
  // Construct an expired stored run without depending on machine timing.
  const statePath = join(expired.root, `.cyc/runs/${expired.id}/state.json`);
  const state = readRun(expired.root, expired.id); state.limits.maxDurationMs = 1; state.startedAt = '2000-01-01T00:00:00Z';
  writeFileSync(statePath, JSON.stringify(state));
  assert.equal(recoverRun(expired.root, expired.id).nextAction.kind, 'review-terminal');
});

test('missing receipts remain disclosed and never become passing evidence', t => {
  const { root, id } = fixture(t, 'process.exit(1)');
  const failed = verifyRun(root, id);
  rmSync(join(root, failed.receiptPath));
  const result = recoverRun(root, id);
  assert.equal(result.verification.status, 'unverified');
  assert.equal(result.lastCheck.status, 'unavailable');
  assert.equal(result.nextAction.kind, 'inspect-check');
});

test('source-writing checks explain unstable evidence instead of reporting a product test failure', t => {
  const { root, id } = fixture(t, "require('node:fs').writeFileSync('feature.txt','generated')");
  verifyRun(root, id);
  const report = recoverRun(root, id);
  assert.equal(report.nextAction.kind, 'inspect-source-change');
  assert.deepEqual(report.lastCheck.changedPaths, ['feature.txt']);
  assert.equal(report.lastCheck.failedChecks.length, 0);
  assert.equal(report.verification.status, 'unverified');
});

test('missing executables are distinguished from ordinary nonzero command exits', t => {
  const { root } = fixture(t);
  const path = join(root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(path));
  config.verification.commands[0].command = join(root, 'missing-executable');
  writeFileSync(path, JSON.stringify(config));
  const id = startRun(root, { goal: 'Check prerequisites', playbook: 'verify' }).runId;
  quickHandoff(root, id, { summary: 'Inspect configured check.' });
  verifyRun(root, id);
  const report = recoverRun(root, id);
  assert.equal(report.lastCheck.failedChecks[0].errorCode, 'ENOENT');
  assert.match(report.nextAction.instruction, /could not be started/);
});

test('completed runs disclose later edits, while stopped runs cannot recommend resuming', t => {
  const { root, id } = fixture(t);
  verifyRun(root, id);
  for (let i = 0; i < 2; i++) quickHandoff(root, id, { summary: 'Checked example behavior.', passedEvidence: 'Configured example command passed on current source.' });
  completeRun(root, id);
  assert.equal(recoverRun(root, id).nextAction.kind, 'review-complete');
  writeFileSync(join(root, 'feature.txt'), 'later edit');
  assert.equal(recoverRun(root, id).verification.status, 'stale');
  const stopped = fixture(t);
  controlRun(stopped.root, stopped.id, 'stop');
  assert.equal(recoverRun(stopped.root, stopped.id).nextAction.kind, 'review-terminal');
});

test('engine drift and protected links are inspected without mutating the run', t => {
  const { root, id } = fixture(t);
  const statePath = join(root, `.cyc/runs/${id}/state.json`);
  const state = readRun(root, id); state.engineVersion = 'older-test-engine';
  writeFileSync(statePath, JSON.stringify(state));
  assert.equal(recoverRun(root, id).nextAction.kind, 'reload-engine');
  assert.equal(readRun(root, id).engineVersion, 'older-test-engine');

  const linked = fixture(t);
  mkdirSync(join(linked.root, 'target'));
  symlinkSync(join(linked.root, 'target'), join(linked.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const path = join(linked.root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(path)); config.protectedPaths = ['linked'];
  writeFileSync(path, JSON.stringify(config));
  const linkedId = startRun(linked.root, { goal: 'Inspect protected link', playbook: 'investigation' }).runId;
  const report = recoverRun(linked.root, linkedId);
  assert.equal(report.nextAction.kind, 'inspect-workspace');
  assert.match(report.inspectionError, /Linked source/);
});

test('fresh executable checks do not conceal stale review handoffs', t => {
  const { root, id } = fixture(t);
  verifyRun(root, id);
  quickHandoff(root, id, { summary: 'Reviewed original source.', passedEvidence: 'Example command passed and source reviewed.' });
  writeFileSync(join(root, 'feature.txt'), 'new source');
  verifyRun(root, id);
  const report = recoverRun(root, id);
  assert.equal(report.verification.status, 'passed');
  assert.deepEqual(report.staleHandoffs, ['verify']);
  assert.equal(report.nextAction.kind, 'refresh-review');
});

test('runs with no configured checks receive setup guidance rather than a verification loop', t => {
  const { root } = fixture(t);
  const path = join(root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(path)); config.verification.commands = [];
  writeFileSync(path, JSON.stringify(config));
  assert.throws(() => startRun(root, { goal: 'Unconfigured task', playbook: 'verify' }), /needs project checks.*Setup method/, 'new code runs refuse to start without checks');
  // A legacy run recorded without checks is still guided to setup rather than a verification loop.
  config.verification.commands = [{ id: 'unit', command: process.execPath, args: ['-e', ''] }];
  writeFileSync(path, JSON.stringify(config));
  const id = startRun(root, { goal: 'Unconfigured task', playbook: 'verify' }).runId;
  const statePath = join(root, `.cyc/runs/${id}/state.json`);
  const state = JSON.parse(readFileSync(statePath, 'utf8')); state.commands = []; writeFileSync(statePath, JSON.stringify(state));
  assert.equal(recoverRun(root, id).nextAction.kind, 'configure-checks');
  assert.equal(readRun(root, id).status, 'running');
});
