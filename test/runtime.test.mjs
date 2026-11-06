import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acceptFailure, completeRun, controlRun, measureBaseline, nextRun, proveRun, quickHandoff as recordQuick, readRun, recordHandoff, recoverRun, retryRun, reviewRun, startRun, verifyRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
import { digest } from '../scripts/response-gate.mjs';

// Measure baselines inline so tests are deterministic; one test covers the background worker.
process.env.CYC_BASELINE_MODE = 'sync';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-runtime-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert.ok(root.includes('cyc-runtime-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  mkdirSync(join(root, '.cyc'));
  const config = {
    schemaVersion: 1, limits: { maxAttempts: 3, maxDurationMs: 900000, maxNoProgress: 2 },
    verification: { baseline: true, commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "const fs=require('node:fs');process.exit(fs.readFileSync('feature.txt','utf8')==='working'?0:1)"], timeoutMs: 3000 }] },
    ...overrides
  };
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
  writeFileSync(join(root, 'feature.txt'), 'broken');
  mkdirSync(join(root, 'docs/context'), { recursive: true });
  writeFileSync(join(root, 'docs/context/error-ledger.md'), 'Synthetic fixture ledger: failing behavior command is repaired by writing working to feature.txt.');
  return root;
}
function start(root, playbook = 'feature', extras = {}) {
  return startRun(root, { goal: 'Persist completed homework and update dependent counts.', playbook,
    criteria: [{ id: 'saved', description: 'Completion persists and consumers agree.' }], ...extras }).runId;
}
function packet(root, id, overrides = {}) {
  const next = nextRun(root, id);
  return { runId: id, stage: next.stage, attempt: next.attempt, status: 'passed', summary: 'Stage completed with recorded evidence.',
    evidence: [{ kind: 'observation', detail: 'Fixture stage review, not a real model assessment.' }], artifacts: next.stage === 'build' ? [{ path: 'feature.txt', sha256: digest(readFileSync(join(root, 'feature.txt'))) }] : [], assessment: fixtureAssessment(readRun(root, id)),
    criteria: next.criteria.map(item => ({ id: item.id, result: ['verify', 'deliver'].includes(next.stage) ? 'passed' : 'unverified', evidence: 'Fixture behavior result is checked separately by the controller.' })), ...overrides };
}
function quickHandoff(root, id, options) {
  const build = nextRun(root, id).stage === 'build' && options.status !== 'blocked';
  return recordQuick(root, id, { assessment: fixtureAssessment(readRun(root, id)), ...(build ? { artifacts: ['feature.txt'] } : {}), ...options });
}
function advance(root, id, stop) {
  while (nextRun(root, id).stage !== stop) recordHandoff(root, packet(root, id));
}

test('feature chain fails a real command, repairs, re-verifies, and completes', t => {
  const root = fixture(t); const id = start(root);
  advance(root, id, 'verify');
  const failed = verifyRun(root, id);
  assert.equal(failed.passed, false);
  assert.equal(failed.results[0].exitCode, 1);
  assert.throws(() => recordHandoff(root, packet(root, id)), /verification successfully/);
  retryRun(root, id, { stage: 'build', reason: 'The stored completion state is still missing.' });
  writeFileSync(join(root, 'feature.txt'), 'working');
  recordHandoff(root, packet(root, id));
  assert.equal(verifyRun(root, id).passed, true);
  recordHandoff(root, packet(root, id));
  const final = packet(root, id);
  final.artifacts = [{ path: 'feature.txt', sha256: digest('working') }];
  recordHandoff(root, final);
  assert.equal(completeRun(root, id).status, 'complete');
  assert.equal(readRun(root, id).failures, 1);
  assert.ok(readRun(root, id).history.some(item => item.type === 'verification' && !item.passed));
});
test('stage order, attempt, and every original criterion are enforced', t => {
  const root = fixture(t); const id = start(root);
  for (const change of [{ stage: 'build' }, { attempt: 9 }, { criteria: [] }, { criteria: [{ id: 'other', result: 'passed', evidence: 'incorrect criterion' }] }, { evidence: [] }]) {
    assert.throws(() => recordHandoff(root, packet(root, id, change)));
  }
  assert.equal(nextRun(root, id).stage, 'scout');
});
test('stale artifact evidence rejects a handoff without advancing', t => {
  const root = fixture(t); const id = start(root);
  const handoff = packet(root, id, { artifacts: [{ path: 'feature.txt', sha256: digest('working') }] });
  assert.throws(() => recordHandoff(root, handoff), /changed after review/);
  assert.equal(nextRun(root, id).stage, 'scout');
});
test('a successful command receipt becomes stale after source changes', t => {
  const root = fixture(t); writeFileSync(join(root, 'feature.txt'), 'working'); const id = start(root);
  advance(root, id, 'verify'); verifyRun(root, id);
  writeFileSync(join(root, 'new-source.js'), 'export const changed = true;');
  assert.throws(() => recordHandoff(root, packet(root, id)), /Source changed/);
});
test('passing commands that mutate source do not certify that source', t => {
  const root = fixture(t, { verification: { baseline: false, commands: [{ id: 'mutating', command: process.execPath, args: ['-e', "require('node:fs').writeFileSync('feature.txt','working')"] }] } });
  const id = start(root); advance(root, id, 'verify');
  const result = verifyRun(root, id);
  assert.equal(result.results[0].passed, true);
  assert.equal(result.sourceStable, false);
  assert.equal(result.passed, false);
});
test('protected changes halt without deleting candidate work', t => {
  const root = fixture(t, { protectedPaths: ['feature.txt'] }); const id = start(root);
  writeFileSync(join(root, 'feature.txt'), 'changed');
  assert.equal(recordHandoff(root, packet(root, id)).status, 'halted');
  assert.equal(readFileSync(join(root, 'feature.txt'), 'utf8'), 'changed');
});
test('config changes after start halt the run', t => {
  const root = fixture(t); const id = start(root);
  writeFileSync(join(root, '.cyc/config.json'), '{}');
  assert.equal(recordHandoff(root, packet(root, id)).status, 'halted');
});
test('scope violations halt before accepting a handoff', t => {
  const root = fixture(t); const id = start(root, 'feature', { allowedPaths: ['feature.txt'] });
  writeFileSync(join(root, 'unrelated.txt'), 'not authorized');
  assert.equal(recordHandoff(root, packet(root, id)).status, 'halted');
});
test('repeated unchanged failure exhausts the shared budget', t => {
  const root = fixture(t); const id = start(root); advance(root, id, 'verify');
  assert.equal(verifyRun(root, id).status, 'running');
  assert.equal(verifyRun(root, id).status, 'exhausted');
  assert.throws(() => controlRun(root, id, 'resume'), /terminal/);
});
test('unrequested rewinds consume the same failure budget', t => {
  const root = fixture(t); const id = start(root, 'plan'); advance(root, id, 'design');
  retryRun(root, id, { stage: 'understand', reason: 'Investigate a new connection.' });
  assert.equal(readRun(root, id).failures, 1);
  assert.equal(nextRun(root, id).stage, 'understand');
  assert.throws(() => retryRun(root, id, { stage: 'deliver', reason: 'Skip ahead.' }), /earlier or current/);
});
test('blocked handoff can resume but cannot be reported complete', t => {
  const root = fixture(t); const id = start(root, 'teach');
  const blocked = recordHandoff(root, packet(root, id, { status: 'blocked', summary: 'Waiting for learner to choose their example.' }));
  assert.equal(blocked.status, 'blocked');
  assert.throws(() => completeRun(root, id), /cannot advance/);
  const resumed = controlRun(root, id, 'resume');
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.attempt, 2);
});
test('pause preserves state and resumes without resetting failure budget', t => {
  const root = fixture(t); const id = start(root);
  recordHandoff(root, packet(root, id, { status: 'failed', summary: 'Need a better criterion.' }));
  controlRun(root, id, 'pause');
  assert.throws(() => recordHandoff(root, packet(root, id)), /cannot advance/);
  controlRun(root, id, 'resume');
  assert.equal(readRun(root, id).failures, 1);
});
test('wall-clock budget is enforced and pause does not extend it', t => {
  const root = fixture(t, { limits: { maxAttempts: 3, maxDurationMs: 1, maxNoProgress: 2 } });
  const id = start(root);
  const until = Date.now() + 3; while (Date.now() < until) { /* bounded clock advancement */ }
  assert.equal(recordHandoff(root, packet(root, id)).status, 'exhausted');
});
test('non-code investigation finishes with labelled reviewed evidence and no invented checks', t => {
  const root = fixture(t, { verification: { baseline: true, commands: [] } }); const id = start(root, 'investigation');
  advance(root, id, null);
  const done = completeRun(root, id);
  assert.equal(done.status, 'complete');
  assert.equal(done.history.at(-1).verification, 'agent-reviewed-evidence');
});
test('changed output after delivery invalidates completion', t => {
  const root = fixture(t); const id = start(root, 'investigation');
  advance(root, id, null);
  writeFileSync(join(root, 'feature.txt'), 'changed afterward');
  assert.throws(() => completeRun(root, id), /changed after.*review/);
});
test('no configured checks cannot become executable success', t => {
  // A run that started without checks could only verify by editing the protected config mid-run,
  // which halts it. So code playbooks refuse to start, and no run record is left behind.
  const root = fixture(t, { verification: { baseline: true, commands: [] } });
  for (const playbook of ['feature', 'bug-fix', 'refactor', 'performance', 'verify', 'experience']) {
    assert.throws(() => start(root, playbook), new RegExp(`${playbook} playbook needs project checks.*before starting`));
  }
  assert.ok(!existsSync(join(root, '.cyc/runs')) || readdirSync(join(root, '.cyc/runs')).every(name => !name.match(/^[0-9a-f-]{36}$/)), 'a refused start leaves no run');
  for (const playbook of ['investigation', 'explore', 'plan', 'review']) assert.ok(start(root, playbook), `${playbook} is advisory and starts without checks`);

  // A legacy run recorded without checks still cannot verify or pass.
  const legacyRoot = fixture(t); const id = start(legacyRoot); advance(legacyRoot, id, 'verify');
  const statePath = join(legacyRoot, `.cyc/runs/${id}/state.json`);
  const state = JSON.parse(readFileSync(statePath, 'utf8')); state.commands = []; writeFileSync(statePath, JSON.stringify(state));
  assert.throws(() => verifyRun(legacyRoot, id), /No project verification/);
  assert.throws(() => recordHandoff(legacyRoot, packet(legacyRoot, id)), /verification successfully/);
});
test('run identifiers and artifact paths cannot traverse out of the project', t => {
  const root = fixture(t); const id = start(root);
  assert.throws(() => readRun(root, '../../elsewhere'), /valid --run/);
  assert.throws(() => recordHandoff(root, packet(root, id, { artifacts: [{ path: '../outside', sha256: digest('x') }] })), /leaves project/);
});
test('CLI produces structured guidance, errors, and actionable help', t => {
  const root = fixture(t);
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const started = cli('run', 'start', '--goal', 'Investigate saved data', '--playbook', 'investigation');
  assert.equal(started.status, 0, started.stderr);
  assert.equal(JSON.parse(started.stdout).stage, 'scout');
  assert.equal(cli('run', 'next', '--run', 'unknown').status, 1);
  assert.match(cli('help').stdout, /run record/);
  assert.equal(cli('--nonsense').status, 1);
});

test('run start stores the gate key for a native host session ID with hook state, and leaves other IDs unchanged', t => {
  const root = fixture(t, { verification: { commands: [] } });
  const key = digest('codex:019a-native-thread').slice(0, 32);
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  writeFileSync(join(root, '.cyc/runtime', `${key}.state.json`), '{}');
  const session = value => readRun(root, start(root, 'investigation', { session: value })).session;
  assert.equal(session('019a-native-thread'), key);
  // No hook state for this ID under any host: a Cursor tag or subagent ID stays as given.
  assert.equal(session('cursor-chat-tag'), 'cursor-chat-tag');
  assert.equal(session(key), key);
  assert.equal(session(undefined), null);
});

test('CLI JSON start preserves rich metadata and rejects ambiguous input before creating a run', t => {
  const root = fixture(t, { verification: { commands: [] } });
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const input = { goal: 'Inspect "customer" data\nKeep $HOME, $(echo nope), `ticks`, and 日本語 literal.', playbook: 'investigation', criteria: [{ id: 'exact', description: 'Keep quotes "here"\nand Unicode ✓ unchanged.' }], allowedPaths: ['feature.txt'], session: 'json-input-session' };
  const file = join(root, '.cyc/start.json');
  writeFileSync(file, JSON.stringify(input));
  const output = cli('run', 'start', '--file', file);
  assert.equal(output.status, 0, output.stderr);
  const state = readRun(root, JSON.parse(output.stdout).runId);
  assert.equal(state.goal, input.goal);
  assert.deepEqual(state.criteria, input.criteria);
  assert.deepEqual(state.allowedPaths, input.allowedPaths);
  assert.equal(state.session, input.session);
  const ids = () => readdirSync(join(root, '.cyc/runs')).sort();
  const before = ids();
  for (const invalid of ['{', 'null', '[]', JSON.stringify({ ...input, commands: [] }), JSON.stringify({ ...input, allowedPaths: '../outside' }), JSON.stringify({ ...input, allowedPaths: null }), JSON.stringify({ ...input, criteria: [] }), JSON.stringify({ ...input, criteria: null }), JSON.stringify({ ...input, criteria: [{ id: 1, description: 'Do not coerce this ID' }] }), JSON.stringify({ ...input, goal: 3 })]) {
    writeFileSync(file, invalid);
    assert.equal(cli('run', 'start', '--file', file).status, 1, invalid);
    assert.deepEqual(ids(), before, 'invalid input must not create a run');
  }
  writeFileSync(file, JSON.stringify(input));
  assert.equal(cli('run', 'start', '--file', file, '--goal', 'override').status, 1);
  assert.deepEqual(ids(), before, 'conflicting arguments must not create a run');
});

function legacyFixture(t, extra = {}) {
  // 'behavior' is the task's check (red at start by design); 'legacy' is an unrelated broken suite.
  return fixture(t, { verification: { baseline: true, ...extra, commands: [
    { id: 'behavior', command: process.execPath, args: ['-e', "const fs=require('node:fs');process.exit(fs.readFileSync('feature.txt','utf8')==='working'?0:1)"], timeoutMs: 3000 },
    { id: 'legacy', command: process.execPath, args: ['-e', "console.log('legacy: staging database unavailable');process.exit(1)"], timeoutMs: 3000 }
  ] } });
}

test('baseline records failing checks before any change', t => {
  const root = legacyFixture(t); const id = start(root);
  assert.deepEqual(nextRun(root, id).baselineFailures, ['behavior', 'legacy']);
});

// A check that failed before the run, accepted with a reason and failing the same way, is
// disclosed rather than blocking: a correct fix in a project whose own suite was already red
// otherwise could only end blocked. New failures still block (see the regression test below).
test('an accepted pre-existing failure that fails the same way is reported and no longer blocks verification', t => {
  const root = legacyFixture(t); const id = start(root);
  advance(root, id, 'verify');
  writeFileSync(join(root, 'feature.txt'), 'working');
  assert.throws(() => acceptFailure(root, id, { check: 'legacy', reason: '' }), /reason/);
  assert.equal(verifyRun(root, id).passed, false, 'an unaccepted pre-existing failure still fails');
  acceptFailure(root, id, { check: 'legacy', reason: 'Integration suite needs a staging DB; broken on main before this change.' });
  const result = verifyRun(root, id);
  assert.equal(result.passed, true);
  assert.equal(result.verificationStatus, 'passed-with-accepted-failures');
  assert.deepEqual(result.acceptedPreexistingFailures, ['legacy']);
  assert.match(readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8'), /legacy: failed, as it did on the run-start code; accepted: Integration suite needs a staging DB/);
});

test('an accepted failure is excused only while it fails exactly as on the run-start code', t => {
  // 'legacy' reads mode.txt, which the run changes, to fail in a new way; 'behavior' keeps passing.
  const legacy = "const fs=require('node:fs');const m=fs.readFileSync('mode.txt','utf8');"
    + "if(m==='hang')setTimeout(()=>{},60000);"
    + "else if(m==='silent')process.exit(1);"
    + "else{console.log(m==='version'?'not ok 1 - range ^1.2.3 satisfied by 1.9.0':'not ok 1 - range ^1.2.3 satisfied by 1.2.5');"
    + "console.log('# time='+(m==='timing'?'40':'12')+'ms');if(m==='long')console.log('x'.repeat(40000));process.exit(m==='exit3'?3:1)}";
  const outcome = mode => {
    const root = fixture(t, { verification: { baseline: true, commands: [
      { id: 'behavior', command: process.execPath, args: ['-e', 'process.exit(0)'] },
      { id: 'legacy', command: process.execPath, args: ['-e', legacy], timeoutMs: 1500 }
    ] } });
    writeFileSync(join(root, 'mode.txt'), 'start');
    const id = start(root);
    acceptFailure(root, id, { check: 'legacy', reason: 'Range suite was red before this task.' });
    advance(root, id, 'verify');
    writeFileSync(join(root, 'mode.txt'), mode);
    return verifyRun(root, id);
  };
  // Only timings differ: the same failure.
  assert.equal(outcome('timing').verificationStatus, 'passed-with-accepted-failures');
  for (const mode of ['exit3', 'hang', 'silent', 'version', 'long']) {
    const result = outcome(mode);
    assert.equal(result.passed, false, mode);
    assert.equal(result.acceptedFailuresThatChanged?.[0]?.id, 'legacy', mode);
  }
  // TAP output: the moved version is a newly failing test name.
  assert.match(outcome('version').acceptedFailuresThatChanged[0].newFailingTests[0], /satisfied by 1\.9\.0/);
  assert.match(outcome('silent').acceptedFailuresThatChanged[0].missingLines[0], /satisfied by 1\.2\.5/);
});

test('acceptance needs a real reason and, without a test proof, an opt-in baseline', t => {
  const root = legacyFixture(t); const id = start(root);
  assert.throws(() => acceptFailure(root, id, { check: 'legacy', reason: '<why it is unrelated>' }), /replace the template placeholder/);
  const refactor = legacyFixture(t, { baseline: false });
  assert.throws(() => acceptFailure(refactor, start(refactor, 'refactor'), { check: 'legacy', reason: 'Broken before the task.' }), /needs verification\.baseline: true/);
});

test('an accepted failure is not excused when every check fails, or when its output names a changed file', t => {
  // A failing check that prints nothing cannot show it fails the same way: still refused.
  const silent = fixture(t, { verification: { baseline: true, commands: [
    { id: 'behavior', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('feature.txt','utf8')==='working'?0:1)"] },
    { id: 'quiet', command: process.execPath, args: ['-e', 'process.exit(1)'] }
  ] } });
  const silentId = start(silent);
  acceptFailure(silent, silentId, { check: 'quiet', reason: 'Broken before the task.' });
  advance(silent, silentId, 'verify');
  writeFileSync(join(silent, 'feature.txt'), 'working');
  const quiet = verifyRun(silent, silentId);
  assert.equal(quiet.passed, false);
  assert.equal(quiet.acceptedFailuresThatChanged[0].id, 'quiet');
  assert.match(quiet.acceptedFailuresThatChanged[0].reason, /no run-start output to compare/);
  // Only the accepted check exists, so nothing passes: still refused.
  const lone = fixture(t, { verification: { baseline: true, commands: [{ id: 'legacy', command: process.execPath, args: ['-e', "console.log('legacy broken');process.exit(1)"] }] } });
  const loneId = start(lone);
  acceptFailure(lone, loneId, { check: 'legacy', reason: 'Broken before the task.' });
  advance(lone, loneId, 'verify');
  assert.equal(verifyRun(lone, loneId).passed, false);
  // The accepted check now reports a file this run changed: it may be failing there for a new reason.
  const named = fixture(t, { verification: { baseline: true, commands: [
    { id: 'behavior', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('feature.txt','utf8')==='working'?0:1)"] },
    { id: 'lint', command: process.execPath, args: ['-e', "const fs=require('node:fs');console.log('legacy.js: 3 problems');if(fs.readFileSync('feature.txt','utf8')==='working')console.log('feature.txt: 1 problem');process.exit(1)"] }
  ] } });
  const namedId = start(named);
  acceptFailure(named, namedId, { check: 'lint', reason: 'Lint was red before the task.' });
  advance(named, namedId, 'verify');
  writeFileSync(join(named, 'feature.txt'), 'working');
  const result = verifyRun(named, namedId);
  assert.equal(result.passed, false);
  assert.equal(result.verificationStatus, 'unverified');
  assert.deepEqual(result.acceptedFailuresThatChanged.map(item => item.id), ['lint']);
  assert.deepEqual(result.acceptedFailuresThatChanged[0].files, ['feature.txt']);
});

test('an unaccepted pre-existing failure still fails verification', t => {
  const root = legacyFixture(t); const id = start(root);
  advance(root, id, 'verify');
  writeFileSync(join(root, 'feature.txt'), 'working');
  assert.equal(verifyRun(root, id).passed, false);
});

test('a check that passed at baseline can never be accepted: that would hide a regression', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'feature.txt'), 'working');
  const id = start(root);
  assert.throws(() => acceptFailure(root, id, { check: 'behavior', reason: 'Flaky, ignore it.' }), /regression/);
  assert.throws(() => acceptFailure(root, id, { check: 'nope', reason: 'x' }), /Unknown check/);
});

test('with baseline disabled, nothing can be accepted', t => {
  const root = legacyFixture(t, { baseline: false }); const id = start(root);
  assert.deepEqual(nextRun(root, id).baselineFailures, []);
  assert.throws(() => acceptFailure(root, id, { check: 'legacy', reason: 'x' }), /no measurement of the run-start code/);
});

test('a baseline check that rewrites files invalidates the baseline instead of being trusted', t => {
  const root = fixture(t, { verification: { baseline: true, commands: [{ id: 'formatter', command: process.execPath, args: ['-e', "require('node:fs').writeFileSync('feature.txt','formatted')"] }] } });
  const id = start(root);
  const next = nextRun(root, id);
  assert.equal(next.baseline, 'invalid');
  assert.match(next.warning, /files changed/);
  assert.throws(() => acceptFailure(root, id, { check: 'formatter', reason: 'x' }), /invalid/);
});

test('an explicitly deterministic unchanged project reuses the previous baseline instantly', t => {
  const root = legacyFixture(t);
  const path = join(root, '.cyc/config.json'), config = JSON.parse(readFileSync(path, 'utf8'));
  for (const command of config.verification.commands) command.reuse = { kind: 'local-deterministic', inputs: [] };
  writeFileSync(path, JSON.stringify(config));
  const first = start(root);
  assert.equal(nextRun(root, first).baselineReused, false);
  const second = start(root);
  assert.equal(nextRun(root, second).baselineReused, true);
  assert.deepEqual(nextRun(root, second).baselineFailures, ['behavior', 'legacy']);
  writeFileSync(join(root, 'other.txt'), 'changed');
  assert.equal(nextRun(root, start(root)).baselineReused, false, 'a changed project must be measured again');
});

test('the default background baseline lets work start immediately and completes on its own', async t => {
  const root = legacyFixture(t);
  process.env.CYC_BASELINE_MODE = 'background';
  let id;
  try { id = start(root); } finally { process.env.CYC_BASELINE_MODE = 'sync'; }
  assert.equal(nextRun(root, id).baseline, 'measuring');
  // Depending on worker scheduling, workspace ownership can reject first. Both
  // guards must preserve the pending baseline and forbid an acceptance mutation.
  assert.throws(() => acceptFailure(root, id, { check: 'legacy', reason: 'x' }), /still measuring|another CYC operation \(baseline/);
  assert.deepEqual(readRun(root, id).acceptedFailures, []);
  for (let i = 0; i < 100 && nextRun(root, id).baseline === 'measuring'; i++) await new Promise(done => setTimeout(done, 100));
  const record = join(root, `.cyc/runs/${id}/baseline.json`);
  assert.equal(nextRun(root, id).baseline, 'complete', existsSync(record) ? readFileSync(record, 'utf8') : 'no baseline.json');
  assert.deepEqual(nextRun(root, id).baselineFailures, ['behavior', 'legacy']);
});

test('runs record the owning session', t => {
  const root = fixture(t);
  const id = start(root, 'feature', { session: 'session-abc' });
  assert.equal(readRun(root, id).session, 'session-abc');
  assert.throws(() => start(root, 'feature', { session: 'bad id!' }), /--session/);
});

test('fast feature flow: scout → build → verify → deliver with one-line handoffs and controller-computed hashes', t => {
  const root = fixture(t); const id = start(root);
  assert.equal(nextRun(root, id).stage, 'scout');
  quickHandoff(root, id, { summary: 'Plan: persist finished flag in feature.txt; count reads the same field.' });
  writeFileSync(join(root, 'feature.txt'), 'working');
  quickHandoff(root, id, { summary: 'Built the change.', artifacts: ['feature.txt'] });
  assert.equal(readRun(root, id).handoffs.at(-1).artifacts[0].sha256, digest('working'));
  assert.equal(nextRun(root, id).stage, 'verify');
  assert.throws(() => quickHandoff(root, id, { summary: 'Verified.' }), /criteria-passed/);
  assert.equal(verifyRun(root, id).passed, true);
  quickHandoff(root, id, { summary: 'Verified.', passedEvidence: 'behavior check passed in run verify receipt.' });
  quickHandoff(root, id, { summary: 'Delivered.', artifacts: ['feature.txt'], passedEvidence: 'behavior check passed; delivery reviewed.' });
  assert.equal(completeRun(root, id).status, 'complete');
});

test('runs have no wall-clock deadline unless the project sets one', t => {
  const root = fixture(t, { limits: { maxAttempts: 3, maxNoProgress: 2 } });
  const id = start(root);
  assert.equal(readRun(root, id).limits.maxDurationMs, undefined);
  const state = readRun(root, id);
  state.startedAt = new Date(Date.now() - 24 * 3600000).toISOString();
  writeFileSync(join(root, '.cyc/runs', id, 'state.json'), JSON.stringify(state));
  quickHandoff(root, id, { summary: 'A day later, still allowed to continue.' });
  assert.equal(readRun(root, id).status, 'running');
});

test('a configured deadline is still enforced, and null disables it explicitly', t => {
  const off = fixture(t, { limits: { maxAttempts: 3, maxNoProgress: 2, maxDurationMs: null } });
  assert.equal(readRun(off, start(off)).limits.maxDurationMs, undefined);
  const bad = fixture(t, { limits: { maxAttempts: 3, maxNoProgress: 2, maxDurationMs: -5 } });
  assert.throws(() => start(bad), /Invalid run limit/);
});

test('CLI quick flow: separate criteria, several artifacts per flag, and compact output', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'second.txt'), 'two');
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CYC_BASELINE_MODE: 'sync' } });
  const started = JSON.parse(cli('run', 'start', '--goal', 'Finish homework', '--playbook', 'feature', '--criterion', 'Finished leaves the active list', '--criterion', 'Survives reload').stdout);
  assert.deepEqual(started.criteria, ['c1', 'c2']);
  const id = started.runId;
  writeFileSync(join(root, 'feature.txt'), 'still broken');
  const assessmentFile = join(root, '.cyc/runs', id, 'scout.json');
  writeFileSync(assessmentFile, JSON.stringify(fixtureAssessment(readRun(root, id))));
  const scout = cli('run', 'record', '--run', id, '--summary', 'Plan: two files.', '--assessment', assessmentFile);
  assert.equal(scout.status, 0, scout.stderr);
  const built = cli('run', 'record', '--run', id, '--summary', 'Built.', '--artifact', 'feature.txt', 'second.txt');
  assert.equal(built.status, 0, built.stderr);
  assert.ok(built.stdout.length < 3000, 'record output should be a short status, not the whole state file');
  assert.deepEqual(readRun(root, id).handoffs.at(-1).artifacts.map(item => item.path), ['feature.txt', 'second.txt']);
  assert.equal(JSON.parse(built.stdout).stage, 'verify');
  const contextFile = join(root, '.cyc/runs', id, 'context.json');
  writeFileSync(contextFile, JSON.stringify({ records: [{ id: 'finish-homework', currentView: 'This isolated fixture owns feature.txt, read by the behavior command to compare its text with working. The current value deliberately remains broken so the CLI diagnostic can retain a measured old failure; this is not an implemented homework feature. Run the configured behavior command to reproduce the failure and inspect its output tail. Controller receipts stay local; no user acceptance or host activation is claimed.' }] }));
  const prepared = cli('context', 'prepare', '--run', id, '--file', contextFile);
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).ok, true);
  const verified = JSON.parse(cli('run', 'verify', '--run', id).stdout);
  assert.equal(verified.passed, false);
  assert.ok(verified.results[0].outputTail !== undefined && verified.hint);
  // The check also failed before the run, so it is named. Accepting it could not complete this run
  // (no other check passes), so the hint leads with repairing and only notes the earlier failure.
  assert.deepEqual(verified.failedAtRunStart, ['behavior']);
  assert.equal(verified.awaitingAcceptance, undefined);
  assert.match(verified.hint, /Separately, behavior also failed on the run-start code; accept only if unrelated\.$/);
});

test('the finish template is written once to a file, shown first, and refused while unedited', t => {
  const root = fixture(t);
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const file = join(root, '.cyc/runtime/start.json');
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  writeFileSync(file, JSON.stringify({ goal: 'Make the feature work.', playbook: 'feature', criteria: [{ id: 'c1', description: 'Feature works.' }], allowedPaths: ['feature.txt'], plan: 'Write the working value.',
    scout: { context: { status: 'none', evidence: 'No history.', freshness: 'Nothing to revalidate.' }, approach: { kind: 'repair', evidence: 'feature.txt holds the value.' }, alignment: { status: 'clear', evidence: 'Stated.' }, consumers: [{ id: 'direct', description: 'the feature', check: 'behavior check' }] } }));
  const started = cli('run', 'start', '--file', file);
  assert.equal(started.status, 0, started.stderr);
  const output = JSON.parse(started.stdout);
  const keys = Object.keys(output);
  assert.ok(keys.indexOf('finishTemplate') < keys.indexOf('verificationCommands'), keys.join(','));
  assert.equal(output.assessmentTemplate, undefined, 'the long template is in the file, not the output');
  const templatePath = join(root, output.finishTemplate);
  const template = JSON.parse(readFileSync(templatePath, 'utf8'));
  assert.deepEqual(Object.keys(template), ['runId', 'summary', 'criterionEvidence', 'assessment', 'acceptFailures']);
  assert.deepEqual(template.assessment.consumerChecks.map(item => item.id), ['direct']);
  // Finishing from the unedited template is refused before anything runs.
  const unedited = cli('run', 'finish', '--file', templatePath);
  assert.equal(unedited.status, 1);
  assert.match(unedited.stdout + unedited.stderr, /placeholder/);
  // The agent's edits are never overwritten.
  writeFileSync(templatePath, JSON.stringify({ ...template, summary: 'in progress' }));
  assert.equal(cli('run', 'next', '--run', output.runId).status, 0);
  assert.equal(JSON.parse(readFileSync(templatePath, 'utf8')).summary, 'in progress');
});

test('recovery written for the detailed chain still works in fast playbooks: analysis stages map to scout', t => {
  const root = fixture(t);
  for (const stage of ['impact', 'design', 'frame', 'understand']) {
    const id = start(root);
    quickHandoff(root, id, { summary: 'Plan.' });
    quickHandoff(root, id, { summary: 'Built.' });
    retryRun(root, id, { stage, reason: `A missed consumer (${stage}).` });
    assert.equal(nextRun(root, id).stage, 'scout', stage);
    assert.equal(nextRun(root, id).status, 'running');
  }
  const id = start(root);
  assert.throws(() => retryRun(root, id, { stage: 'teach', reason: 'x' }), /earlier or current/);
  const plan = start(root, 'plan');
  assert.throws(() => retryRun(root, plan, { stage: 'scout', reason: 'x' }), /earlier or current/);
});

test('normal startup launches no checks and final verification still executes them', t => {
  const root = fixture(t, { verification: { commands: [{ id: 'must-run', command: process.execPath, args: ['-e', 'process.exit(1)'] }] } });
  const id = start(root);
  assert.equal(nextRun(root, id).baseline, 'none');
  advance(root, id, 'verify');
  assert.equal(verifyRun(root, id).passed, false);
  assert.throws(() => completeRun(root, id));
});

test('ledger selection reuses project conventions and refuses escaping paths', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'INCIDENT-LEDGER.md'), 'Existing ledger');
  assert.equal(nextRun(root, start(root)).ledgerPath, 'INCIDENT-LEDGER.md');
  const configured = fixture(t, { context: { ledgerPath: 'docs/existing-errors.md' } });
  assert.equal(nextRun(configured, start(configured)).ledgerPath, 'docs/existing-errors.md');
  const escaping = fixture(t, { context: { ledgerPath: '../external.md' } });
  assert.throws(() => start(escaping), /leaves project/);
});

test('an engine update cannot silently advance a run from a different version', t => {
  const root = fixture(t); const id = start(root);
  const state = readRun(root, id); assert.ok(state.engineVersion);
  // Simulate a serialized run from a prior installed version, not a real host update.
  state.engineVersion = '0.0.1'; writeFileSync(join(root, '.cyc/runs', id, 'state.json'), JSON.stringify(state));
  assert.throws(() => quickHandoff(root, id, { summary: 'Continue' }), /reload host skills/);
  assert.equal(controlRun(root, id, 'stop').status, 'stopped');
});

test('a new regression inside an accepted failing suite cannot pass verification', t => {
  const root = fixture(t, { verification: { baseline: true, commands: [{ id: 'suite', command: process.execPath, args: ['-e', "const fs=require('node:fs');console.log('FAIL old-test');if(fs.readFileSync('feature.txt','utf8')==='regression') console.log('FAIL new-test');process.exit(1)"] }] } });
  const id = start(root);
  acceptFailure(root, id, { check: 'suite', reason: 'Old test fails before the task.' });
  writeFileSync(join(root, 'feature.txt'), 'regression');
  advance(root, id, 'verify');
  const result = verifyRun(root, id);
  assert.match(result.results[0].stdout, /FAIL new-test/);
  assert.equal(result.passed, false);
  assert.equal(result.verificationStatus, 'unverified');
  assert.throws(() => quickHandoff(root, id, { summary: 'Done', passedEvidence: 'Suite accepted' }), /verification successfully/);
});

test('multiple criteria need individual evidence and CLI exposes changing source paths', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'feature.txt'), 'working');
  const id = start(root, 'feature', { criteria: [{ id: 'one', description: 'Behavior works' }, { id: 'two', description: 'Consumer works' }] });
  advance(root, id, 'verify'); verifyRun(root, id);
  assert.throws(() => quickHandoff(root, id, { summary: 'Verified', passedEvidence: 'All good' }), /Multiple criteria/);
  assert.throws(() => quickHandoff(root, id, { summary: 'Verified', criterionEvidence: { one: 'Observed' } }), /every criterion/);
  quickHandoff(root, id, { summary: 'Verified', criterionEvidence: { one: 'Behavior command passed', two: 'Consumer observed' } });
  assert.equal(readRun(root, id).handoffs.at(-1).criteria[1].evidence, 'Consumer observed');

  const changed = fixture(t, { verification: { commands: [{ id: 'writes', command: process.execPath, args: ['-e', "require('node:fs').writeFileSync('feature.txt','changed')"] }] } });
  const other = start(changed); advance(changed, other, 'verify');
  const result = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'run', 'verify', '--run', other], { cwd: changed, encoding: 'utf8' });
  const output = JSON.parse(result.stdout);
  assert.equal(output.sourceStable, false); assert.deepEqual(output.changedPaths, ['feature.txt']);
});


test('project operation ownership refuses other writes and defers recovery without affecting another project', t => {
  const root = fixture(t, { verification: { baseline: false, commands: [{ id: 'check', command: process.execPath, args: ['-e', ''] }] } }), id = start(root);
  const statePath = join(root, `.cyc/runs/${id}/state.json`), before = readFileSync(statePath, 'utf8');
  const runsBefore = readdirSync(join(root, '.cyc/runs')).sort();
  const lock = join(root, '.cyc/runs/workspace.lock'), owner = JSON.stringify({ operation: 'test proof owned elsewhere', pid: process.pid });
  writeFileSync(lock, owner);
  assert.throws(() => start(root), /project.*CYC operation/);
  assert.throws(() => verifyRun(root, id), /project.*CYC operation/);
  assert.throws(() => reviewRun(root, id), /project.*CYC operation/);
  const recovery = recoverRun(root, id);
  assert.equal(recovery.nextAction.kind, 'wait-workspace');
  assert.equal(recovery.verification.status, 'unverified');
  assert.match(recovery.nextAction.instruction, /operator inspection/);
  assert.equal(readFileSync(statePath, 'utf8'), before);
  assert.equal(readFileSync(lock, 'utf8'), owner);
  assert.deepEqual(readdirSync(join(root, '.cyc/runs')).filter(name => name !== 'workspace.lock').sort(), runsBefore, 'the refused operations wrote nothing');
  const separate = fixture(t); assert.equal(readRun(separate, start(separate)).status, 'running');
  rmSync(lock);
  assert.equal(reviewRun(root, id).status, 'running');
  assert.equal(existsSync(lock), false);
});

test('optional baseline cannot measure source owned by another controller operation', t => {
  const root = fixture(t, { verification: { baseline: true, commands: [{ id: 'marker', command: process.execPath, args: ['-e', "require('fs').appendFileSync('.cyc/runtime/baseline-marker','ran')"] }] } });
  mkdirSync(join(root, '.cyc/runtime'));
  const id = start(root), marker = readFileSync(join(root, '.cyc/runtime/baseline-marker'), 'utf8');
  const stateBefore = readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8');
  const lock = join(root, '.cyc/runs/workspace.lock'); writeFileSync(lock, JSON.stringify({ operation: 'proof', pid: process.pid }));
  const baseline = measureBaseline(root, id);
  assert.equal(baseline.status, 'error'); assert.match(baseline.reason, /project.*CYC operation/);
  assert.equal(readFileSync(join(root, '.cyc/runtime/baseline-marker'), 'utf8'), marker);
  assert.equal(readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8'), stateBefore);
  assert.equal(nextRun(root, id).baseline, 'error');
  rmSync(lock);
});

test('protected project operation storage is refused before creating run metadata', t => {
  const root = fixture(t, { protectedPaths: ['.cyc/runs/workspace.lock'] });
  assert.throws(() => start(root), /operation lock is protected/);
  assert.equal(existsSync(join(root, '.cyc/runs')), false);
});

// Scope strings are literal authority, not patterns. Rejection must precede startup effects.
function literalStartupFixture(t, overrides = {}) {
  const root = fixture(t, overrides);
  const file = join(root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  config.verification.baseline = false;
  writeFileSync(file, JSON.stringify(config));
  return root;
}
function literalStartupInventory(root) {
  const result = {};
  function visit(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const key = prefix + entry.name, path = join(directory, entry.name);
      result[key] = entry.isDirectory() ? 'directory' : digest(readFileSync(path));
      if (entry.isDirectory()) visit(path, key + '/');
    }
  }
  visit(root);
  return result;
}
const invalidLiteralStartupCases = [
  { field: 'allowedPaths', pattern: 'shiftlog/*.py' },
  { field: 'allowedPaths', pattern: 'tests/test_?.py' },
  { field: 'protectedPaths', pattern: 'shiftlog/**' },
  { field: 'protectedPaths', pattern: 'secret?.txt' },
  { field: 'context.ledgerPath', pattern: 'docs/*.md' },
  { field: 'context.ledgerPath', pattern: 'docs/history?.md' }
];
function literalStartupOptions(item) {
  return item.field === 'protectedPaths' ? { protectedPaths: [item.pattern] }
    : item.field === 'context.ledgerPath' ? { context: { ledgerPath: item.pattern } } : {};
}
for (const item of invalidLiteralStartupCases) {
  test('literal startup rejects API ' + item.field + ' ' + item.pattern + ' without writes', t => {
    const root = literalStartupFixture(t, literalStartupOptions(item));
    const before = literalStartupInventory(root);
    const allowedPaths = item.field === 'allowedPaths' ? [item.pattern] : ['feature.txt'];
    assert.throws(() => start(root, 'bug-fix', { allowedPaths }), /literal.*(file|path)/i);
    assert.deepEqual(literalStartupInventory(root), before, 'no path or byte changes on rejection');
    assert.equal(existsSync(join(root, '.cyc/runs')), false);
  });
}
for (const item of invalidLiteralStartupCases.filter(item => item.pattern.includes('*'))) {
  test('literal startup rejects JSON CLI ' + item.field + ' without writes', t => {
    const root = literalStartupFixture(t, literalStartupOptions(item));
    const input = { goal: 'Repair streaming input', playbook: 'bug-fix',
      criteria: [{ id: 'correct', description: 'Preserve correct input and reject malformed input.' }],
      allowedPaths: item.field === 'allowedPaths' ? [item.pattern] : ['feature.txt'] };
    const file = join(root, '.cyc/start-wildcard.json');
    writeFileSync(file, JSON.stringify(input));
    const before = literalStartupInventory(root);
    const output = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'run', 'start', '--file', file],
      { cwd: root, encoding: 'utf8', timeout: 15000 });
    assert.equal(output.status, 1, output.stderr);
    assert.match(output.stdout + output.stderr, /literal.*(file|path)/i);
    assert.deepEqual(literalStartupInventory(root), before);
  });
}
test('literal startup rejects scope flags before any run or lock exists', t => {
  const root = literalStartupFixture(t), before = literalStartupInventory(root);
  const output = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'run', 'start',
    '--goal', 'Repair a parser', '--playbook', 'bug-fix', '--scope', 'tests/test_?.py'],
  { cwd: root, encoding: 'utf8', timeout: 15000 });
  assert.equal(output.status, 1, output.stderr);
  assert.match(output.stdout + output.stderr, /literal.*(file|path)/i);
  assert.deepEqual(literalStartupInventory(root), before);
});
test('literal startup preserves dirty Git bytes and objects on rejection', t => {
  const root = literalStartupFixture(t);
  for (const args of [['init', '-q'], ['add', 'feature.txt'],
    ['-c', 'user.name=CYCFixture', '-c', 'user.email=cyc-fixture@example.invalid', 'commit', '-q', '-m', 'fixture']]) {
    const output = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000 });
    assert.equal(output.status, 0, output.stderr);
  }
  writeFileSync(join(root, 'feature.txt'), 'dirty run-start bytes');
  const before = literalStartupInventory(root);
  assert.throws(() => start(root, 'bug-fix', { allowedPaths: ['*.txt'] }), /literal.*(file|path)/i);
  assert.deepEqual(literalStartupInventory(root), before, 'Git and working tree stay byte-identical');
});
test('literal startup permits future names, spaces, Unicode and bracket routes with exact capture', t => {
  const root = literalStartupFixture(t, { protectedPaths: ['routes/[id]/private 日本語.txt'] });
  mkdirSync(join(root, 'routes/[id]'), { recursive: true });
  writeFileSync(join(root, 'routes/[id]/index.py'), 'original route');
  writeFileSync(join(root, 'routes/[id]/private 日本語.txt'), 'protected original');
  const allowedPaths = ['routes/[id]', 'new widget 日本語.py', 'future/tests'];
  const id = start(root, 'bug-fix', { allowedPaths });
  const state = readRun(root, id);
  assert.equal(state.status, 'running');
  assert.deepEqual(state.allowedPaths, allowedPaths);
  assert.deepEqual(state.sourceCapture.files, ['routes/[id]/index.py']);
  writeFileSync(join(root, 'routes/[id]/index.py'), 'permitted new route');
  assert.equal(recordHandoff(root, packet(root, id)).status, 'running');
  writeFileSync(join(root, 'routes/[id]/private 日本語.txt'), 'forbidden mutation');
  assert.equal(recordHandoff(root, packet(root, id)).status, 'halted');
  assert.equal(readFileSync(join(root, 'routes/[id]/private 日本語.txt'), 'utf8'), 'forbidden mutation');
});
test('literal startup does not widen or rewrite a stored legacy literal scope', t => {
  const root = literalStartupFixture(t), id = start(root, 'bug-fix', { allowedPaths: ['feature.txt'] });
  const stateFile = join(root, '.cyc/runs', id, 'state.json');
  const legacy = readRun(root, id);
  legacy.allowedPaths = ['feature*.txt']; // Synthetic older stored input, not a live-run repair.
  writeFileSync(stateFile, JSON.stringify(legacy));
  writeFileSync(join(root, 'feature.txt'), 'working');
  assert.equal(recordHandoff(root, packet(root, id)).status, 'halted');
  const after = readRun(root, id);
  assert.deepEqual(after.allowedPaths, legacy.allowedPaths);
  assert.equal(after.attempt, legacy.attempt);
  assert.equal(readFileSync(join(root, 'feature.txt'), 'utf8'), 'working');
});
test('literal startup permits existing POSIX wildcard names and ordinary future descendants',
  { skip: process.platform === 'win32' ? 'Windows cannot create literal * or ? filenames.' : false }, t => {
    const root = literalStartupFixture(t);
    mkdirSync(join(root, 'raw *?'));
    writeFileSync(join(root, 'raw *?/source.py'), 'original special directory');
    writeFileSync(join(root, 'existing?.py'), 'original special file');
    const allowedPaths = ['raw *?', 'existing?.py', 'raw *?/future.py'];
    const id = start(root, 'bug-fix', { allowedPaths });
    const state = readRun(root, id);
    assert.deepEqual(state.allowedPaths, allowedPaths);
    assert.deepEqual(state.sourceCapture.files.sort(), ['existing?.py', 'raw *?/source.py']);
  });

function normalizedGitProofFixture(t, original) {
  const root = literalStartupFixture(t);
  mkdirSync(join(root, 'test'));
  writeFileSync(join(root, '.gitattributes'), '*.mjs text eol=lf\n');
  writeFileSync(join(root, 'feature.mjs'), original);
  writeFileSync(join(root, 'test/smoke.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from '../feature.mjs';\ntest('value exists', () => assert.equal(typeof value, 'number'));\n");
  for (const args of [['init', '-q'], ['config', 'core.autocrlf', 'false'],
    ['add', '.gitattributes', 'feature.mjs', 'test/smoke.test.mjs'],
    ['-c', 'user.name=CYCFixture', '-c', 'user.email=cyc-fixture@example.invalid', 'commit', '-q', '-m', 'fixture']]) {
    const output = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000 });
    assert.equal(output.status, 0, output.stderr);
  }
  const configPath = join(root, '.cyc/config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.verification.commands = [{ id: 'unit', command: process.execPath,
    args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"], timeoutMs: 15000 }];
  writeFileSync(configPath, JSON.stringify(config));
  const id = start(root, 'bug-fix', { allowedPaths: ['feature.mjs', 'test'] });
  advance(root, id, 'build');
  assert.equal(readRun(root, id).sourceCapture.files.includes('feature.mjs'), false);
  const candidate = original.replace('value = 0', 'value = 1');
  writeFileSync(join(root, 'feature.mjs'), candidate);
  writeFileSync(join(root, 'test/value.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from '../feature.mjs';\ntest('value is repaired', () => assert.equal(value, 1));\n");
  return { root, id, candidate };
}
test('Git newline recovery proves tracked CRLF bytes contrary to LF attributes exactly', t => {
  const original = '// original 日本語\r\nexport const value = 0;\r\n';
  const { root, id, candidate } = normalizedGitProofFixture(t, original);
  const gitBytes = spawnSync('git', ['show', 'HEAD:feature.mjs'], { cwd: root }).stdout;
  assert.notEqual(digest(gitBytes), digest(Buffer.from(original)));
  assert.equal(gitBytes.includes(Buffer.from('\r\n')), false);
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, JSON.stringify(proof));
  assert.equal(readRun(root, id).testProof.passed, true);
  assert.deepEqual(readFileSync(join(root, 'feature.mjs')), Buffer.from(candidate));
});
test('Git newline recovery refuses mixed original bytes rather than accepting equivalent normalized text', t => {
  const original = '// original 日本語\r\nexport const value = 0;\n';
  const { root, id, candidate } = normalizedGitProofFixture(t, original);
  const before = literalStartupInventory(root);
  assert.throws(() => proveRun(root, id), /Cannot recover the run-start version/);
  assert.deepEqual(literalStartupInventory(root), before);
  assert.equal(readRun(root, id).testProof, null);
  assert.deepEqual(readFileSync(join(root, 'feature.mjs')), Buffer.from(candidate));
});

test('run commands without --run use the single active run, and name every candidate when several are active', t => {
  const root = fixture(t, { verification: { commands: [] } });
  // An unidentified caller, as from a plain terminal: no CYC or host session in the environment.
  const anonymous = { ...process.env, CYC_SESSION: '', CLAUDE_CODE_SESSION_ID: '', CODEX_THREAD_ID: '' };
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8', env: anonymous });
  const output = result => JSON.parse(result.stdout || result.stderr);
  const none = cli('run', 'next');
  assert.equal(none.status, 1);
  assert.match(output(none).error, /No active CYC run/);
  const first = start(root, 'investigation', { session: 'session-aaaa' });
  assert.equal(output(cli('run', 'next')).runId, first);
  const second = start(root, 'investigation', { session: 'session-bbbb' });
  const several = cli('run', 'next');
  assert.equal(several.status, 1);
  assert.match(output(several).error, new RegExp(`Several runs are active: .*${first}.*${second}|Several runs are active: .*${second}.*${first}`));
  assert.equal(output(cli('run', 'next', '--session', 'session-bbbb')).runId, second);
  assert.equal(output(cli('run', 'next', '--run', first)).runId, first, 'explicit --run is unchanged');
  assert.match(output(cli('run', 'next', '--session', 'session-cccc')).error, /No active run for session session-cccc/);
  // Finished runs are never picked up implicitly.
  assert.equal(cli('run', 'stop', '--run', second).status, 0);
  assert.equal(output(cli('run', 'next')).runId, first);
});

test('with no configured checks, start uses the project declared test command, says so, and leaves the config alone', t => {
  const root = fixture(t, { verification: { commands: [] } });
  const config = readFileSync(join(root, '.cyc/config.json'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { test: 'node --test' } }));
  const id = start(root, 'feature');
  const state = readRun(root, id);
  assert.equal(state.verificationSource, 'declared by package.json scripts.test');
  assert.deepEqual(state.commands, [{ id: 'test', ...(process.platform === 'win32' ? { command: 'cmd', args: ['/d', '/s', '/c', 'npm test'] } : { command: 'npm', args: ['test'] }) }]);
  assert.equal(nextRun(root, id).verificationSource, state.verificationSource);
  assert.deepEqual(readFileSync(join(root, '.cyc/config.json')), config, 'the config is not written');
  // npm's placeholder script declares no test, so a code playbook is still refused.
  const placeholder = fixture(t, { verification: { commands: [] } });
  writeFileSync(join(placeholder, 'package.json'), JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }));
  assert.throws(() => start(placeholder, 'feature'), /no verification.commands and the project declares no test command/);
  // Configured checks always win over a declared one.
  const configured = fixture(t);
  writeFileSync(join(configured, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const kept = readRun(configured, start(configured, 'feature'));
  assert.equal(kept.verificationSource, undefined);
  assert.equal(kept.commands[0].id, 'behavior');
});

test('declared npm checks run pretest and posttest as their own checks around the test script alone', t => {
  const npm = line => process.platform === 'win32' ? { command: 'cmd', args: ['/d', '/s', '/c', `npm ${line}`] } : { command: 'npm', args: line.split(' ') };
  const declared = scripts => {
    const root = fixture(t, { verification: { commands: [] } });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts }));
    return readRun(root, start(root, 'feature'));
  };
  // A posttest (lint, a template check) that fails before any change no longer hides the tests.
  const post = declared({ test: 'tap', posttest: 'npm run lint' });
  assert.deepEqual(post.commands, [{ id: 'test', ...npm('test --ignore-scripts') }, { id: 'posttest', ...npm('run posttest') }]);
  assert.equal(post.verificationSource, 'declared by package.json scripts.test, run as test, posttest');
  // A pretest such as a build still runs first.
  assert.deepEqual(declared({ pretest: 'npm run build', test: 'node --test', posttest: 'eslint .' }).commands.map(command => command.id), ['pretest', 'test', 'posttest']);
  // Without hooks, npm test runs as before.
  assert.deepEqual(declared({ test: 'node --test', lint: 'eslint .' }).commands, [{ id: 'test', ...npm('test') }]);
  // --ignore-scripts would also skip hooks of scripts the test script runs, so those keep npm test whole.
  const single = [{ id: 'test', ...npm('test') }];
  assert.deepEqual(declared({ test: 'npm run build && node --test', prebuild: 'node gen.js', build: 'tsc', posttest: 'eslint .' }).commands, single);
  assert.deepEqual(declared({ test: 'run-s lint unit', unit: 'node --test', lint: 'eslint .', posttest: 'eslint .' }).commands, single);
  assert.deepEqual(declared({ test: 'npm run unit', unit: 'node --test', posttest: 'eslint .' }).commands.map(command => command.id), ['test', 'posttest']);
});

test('run start output leads with the checks and finish command, and ends with the fill-in template', t => {
  const root = fixture(t);
  const file = join(root, '.cyc/runtime/start.json');
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  writeFileSync(file, JSON.stringify({ goal: 'Make the feature work.', playbook: 'feature', criteria: [{ id: 'c1', description: 'Feature works.' }] }));
  const result = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'run', 'start', '--file', file], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const keys = Object.keys(JSON.parse(result.stdout));
  assert.equal(keys[0], 'runId');
  assert.ok(keys.indexOf('verificationCommands') < keys.indexOf('assessmentTemplate'), keys.join(','));
  assert.equal(keys.at(-1), 'assessmentTemplate');
  assert.match(JSON.parse(result.stdout).verificationCommands[0], /^behavior: /);
});

test('backslash and absolute in-project paths are accepted; a path outside the project is still refused', t => {
  const root = fixture(t, { verification: { commands: [] } });
  const id = start(root, 'investigation', { allowedPaths: ['docs\\context', join(root, 'feature.txt')] });
  assert.deepEqual(readRun(root, id).allowedPaths, ['docs/context', 'feature.txt']);
  const outside = mkdtempSync(join(tmpdir(), 'cyc-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  assert.throws(() => start(root, 'investigation', { allowedPaths: [join(outside, 'x.txt')] }), /project-relative|leaves project/);
});

test('CLI JSON input with single backslashes in Windows paths is repaired; valid escapes are kept', t => {
  const root = fixture(t, { verification: { commands: [] } });
  const file = join(root, '.cyc/start.json');
  const backslash = String.fromCharCode(92);
  writeFileSync(file, `{"goal": "Line one${backslash}nline two", "playbook": "investigation", "allowedPaths": ["docs${backslash}context"]}`);
  const result = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'run', 'start', '--file', file], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const state = readRun(root, JSON.parse(result.stdout).runId);
  assert.equal(state.goal, 'Line one\nline two');
  assert.deepEqual(state.allowedPaths, ['docs/context']);
  writeFileSync(file, '{"goal": ');
  assert.match(JSON.parse(spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'run', 'start', '--file', file], { cwd: root, encoding: 'utf8' }).stderr).error, /start\.json/);
});

test('an identified caller never gets another conversation\'s run implicitly', t => {
  const root = fixture(t, { verification: { commands: [] } });
  const as = session => (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CYC_SESSION: session, CLAUDE_CODE_SESSION_ID: '', CODEX_THREAD_ID: '' } });
  const output = result => JSON.parse(result.stdout || result.stderr);
  const mine = start(root, 'investigation', { session: 'session-aaaa' });
  const stopped = as('session-zzzz')('run', 'stop');
  assert.equal(stopped.status, 1);
  assert.match(output(stopped).error, /other conversations' runs are not selected implicitly/);
  assert.equal(readRun(root, mine).status, 'running', 'the other conversation\'s run is untouched');
  const theirs = start(root, 'investigation', { session: 'session-bbbb' });
  assert.equal(output(as('session-aaaa')('run', 'next')).runId, mine, 'the caller\'s own run is chosen among several');
  assert.equal(output(as('session-bbbb')('run', 'next')).runId, theirs);
  // run start defaults the run's session to the caller's.
  const created = output(as('session-cccc')('run', 'start', '--goal', 'Explain it.', '--playbook', 'investigation'));
  assert.equal(readRun(root, created.runId).session, 'session-cccc');
});

test('a project that declares several test entry points is refused and the candidates are named', t => {
  const root = fixture(t, { verification: { commands: [] } });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "process.exit(0)"' } }));
  writeFileSync(join(root, 'pytest.ini'), '[pytest]\n');
  assert.throws(() => start(root, 'refactor'), /declares several test entry points \(package\.json scripts\.test, pytest configuration\)/);
});

test('a control character in a path is refused with how it got there', t => {
  const root = fixture(t, { verification: { commands: [] } });
  assert.throws(() => start(root, 'investigation', { allowedPaths: ['src\\parser.py', 'tests\test_parser.py'] }), /control character.*JSON backslash before t, n, r, b, or f.*forward slashes/);
});

test('starting with a scout leaves the background baseline able to complete', async t => {
  const root = legacyFixture(t);
  const scout = { context: { status: 'none', evidence: 'No component history.', freshness: 'Nothing to revalidate.' }, approach: { kind: 'extend', evidence: 'Extend the fixture.' }, alignment: { status: 'clear', evidence: 'Fixture brief.' }, consumers: [{ id: 'behavior', description: 'Fixture behavior.', check: 'Configured command.' }] };
  process.env.CYC_BASELINE_MODE = 'background';
  let id;
  try { id = start(root, 'feature', { scout, plan: 'Extend the fixture behavior.' }); } finally { process.env.CYC_BASELINE_MODE = 'sync'; }
  assert.equal(nextRun(root, id).stage, 'build');
  for (let i = 0; i < 100 && nextRun(root, id).baseline === 'measuring'; i++) await new Promise(done => setTimeout(done, 100));
  assert.equal(nextRun(root, id).baseline, 'complete', JSON.stringify(nextRun(root, id).baselineError ?? readFileSync(join(root, `.cyc/runs/${id}/baseline.json`), 'utf8')));
});

// Audit 2026-10-31, finding 4: Scout recorded at start, then recorded again, landed as Build.
test('a Scout assessment cannot be recorded as the Build handoff after run start recorded Scout', t => {
  const root = fixture(t);
  const scout = fixtureAssessment({ workContractVersion: 1, stages: ['scout'], stageIndex: 0 });
  const id = startRun(root, { goal: 'Persist completed homework.', playbook: 'feature', criteria: [{ id: 'saved', description: 'Completion persists.' }], scout, plan: 'Write the flag to feature.txt.' }).runId;
  assert.equal(nextRun(root, id).stage, 'build');
  assert.throws(() => recordQuick(root, id, { summary: 'Write the flag to feature.txt.', assessment: scout }), /Scout assessment[\s\S]*Build/);
  assert.equal(nextRun(root, id).stage, 'build');
  assert.deepEqual(readRun(root, id).handoffs.map(item => item.stage), ['scout']);
  // A real Build still records.
  writeFileSync(join(root, 'feature.txt'), 'working');
  recordQuick(root, id, { summary: 'Built the change.', artifacts: ['feature.txt'] });
  assert.equal(nextRun(root, id).stage, 'verify');
});

// Audit 2026-10-31, finding 6: a worker that died left the baseline pending for the rest of the run.
test('a background baseline whose worker ended without a result reads as an error, not pending forever', async t => {
  const root = fixture(t, { verification: { baseline: true, commands: [{ id: 'slow', command: process.execPath, args: ['-e', 'setTimeout(() => {}, 4000)'], timeoutMs: 10000 }] } });
  process.env.CYC_BASELINE_MODE = 'background';
  let id;
  try { id = start(root); } finally { process.env.CYC_BASELINE_MODE = 'sync'; }
  assert.equal(nextRun(root, id).baseline, 'measuring');
  const worker = JSON.parse(readFileSync(join(root, `.cyc/runs/${id}/baseline-worker.json`), 'utf8'));
  assert.ok(Number.isInteger(worker.pid) && worker.pid > 0, JSON.stringify(worker));
  process.kill(worker.pid);
  for (let i = 0; i < 60 && nextRun(root, id).baseline === 'measuring'; i++) await new Promise(done => setTimeout(done, 100));
  const view = nextRun(root, id);
  assert.equal(view.baseline, 'error', JSON.stringify(view));
  assert.match(view.warning, /ended before writing its result/);
  assert.equal(existsSync(join(root, `.cyc/runs/${id}/baseline.json`)), false);
  // Let the orphaned check notice its controller ended before the folder is removed.
  await new Promise(done => setTimeout(done, 2500));
});

test('a passed Build with nothing listed and nothing changed is refused; a changed file records without a list', t => {
  const root = fixture(t);
  const scout = fixtureAssessment({ workContractVersion: 1, stages: ['scout'], stageIndex: 0 });
  const id = startRun(root, { goal: 'Persist completed homework.', playbook: 'feature', criteria: [{ id: 'saved', description: 'Completion persists.' }], scout, plan: 'Write the flag to feature.txt.' }).runId;
  assert.throws(() => recordQuick(root, id, { summary: 'Write the flag to feature.txt.', assessment: { plan: 'the plan', notes: 'nothing built yet' } }), /Nothing to record as built/);
  assert.throws(() => recordQuick(root, id, { summary: 'Plan only.' }), /Nothing to record as built/);
  assert.deepEqual(readRun(root, id).handoffs.map(item => item.stage), ['scout']);
  writeFileSync(join(root, 'feature.txt'), 'working');
  recordQuick(root, id, { summary: 'Built the change.' });
  assert.equal(nextRun(root, id).stage, 'verify');
});

test('a background baseline whose worker never started reads as an error', t => {
  const root = fixture(t, { verification: { baseline: true, commands: [{ id: 'quick', command: process.execPath, args: ['-e', ''], timeoutMs: 10000 }] } });
  const saved = { TMP: process.env.TMP, TEMP: process.env.TEMP, TMPDIR: process.env.TMPDIR, mode: process.env.CYC_BASELINE_MODE };
  const missing = join(root, 'no-such-temp');
  process.env.TMP = missing; process.env.TEMP = missing; process.env.TMPDIR = missing; process.env.CYC_BASELINE_MODE = 'background';
  let id;
  try { id = start(root); } finally {
    for (const name of ['TMP', 'TEMP', 'TMPDIR']) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
    process.env.CYC_BASELINE_MODE = saved.mode ?? 'sync';
  }
  const worker = JSON.parse(readFileSync(join(root, `.cyc/runs/${id}/baseline-worker.json`), 'utf8'));
  assert.equal(worker.pid, null, JSON.stringify(worker));
  const view = nextRun(root, id);
  assert.equal(view.baseline, 'error', JSON.stringify(view));
  assert.match(view.warning, /did not start/);
});
