import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { completeRun, controlRun, nextRun, quickHandoff, readRun, retryRun, reviewRun, sourceSnapshot, startRun, verifyRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
// These tests are not about run-start measurement; a background worker would outlive their temp folders.
process.env.CYC_BASELINE_MODE = 'off';

const repo = fileURLToPath(new URL('..', import.meta.url));
function put(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content);
}
function fixture(t, playbook = 'feature', options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-quality-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert.ok(root.startsWith(join(resolve(tmpdir()), 'cyc-quality-'))); rmSync(root, { recursive: true, force: true }); });
  put(root, 'behavior.txt', 'working');
  put(root, 'docs/context/error-ledger.md', 'Fixture: broken behavior fails the check; repair restores working.');
  put(root, '.cyc/config.json', JSON.stringify({ limits: { maxAttempts: 8 }, verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('behavior.txt','utf8')==='working'?0:1)"] }] }, ...options.config }));
  const { runId: id } = startRun(root, { goal: 'Keep the public behavior working.', playbook, criteria: [{ id: 'works', description: 'Public behavior returns working.' }], allowedPaths: options.allowedPaths });
  return { root, id };
}
function record(root, id, assessment = fixtureAssessment(readRun(root, id)), overrides = {}) {
  const state = readRun(root, id);
  const build = state.stages[state.stageIndex] === 'build' && state.workContractVersion === 1;
  return quickHandoff(root, id, { summary: 'Synthetic fixture evidence.', assessment, passedEvidence: 'Executed behavior check and fixture review.', ...(build ? { artifacts: ['behavior.txt'] } : {}), ...overrides });
}
function toVerify(root, id) { record(root, id); record(root, id); assert.equal(verifyRun(root, id).passed, true); }
function report(root, id) { return readFileSync(join(root, '.cyc/runs', id, 'review.md'), 'utf8'); }

test('new implementation routes require assessments but advisory work stays proportionate', t => {
  const { root, id } = fixture(t);
  assert.deepEqual(nextRun(root, id).assessmentRequired, ['context', 'approach', 'alignment', 'consumers']);
  assert.throws(() => quickHandoff(root, id, { summary: 'Skip context and alignment.' }), /needs an assessment/);
  assert.equal(nextRun(root, id).stage, 'scout');
  const advisory = startRun(root, { goal: 'Explain behavior', playbook: 'investigation' }).runId;
  quickHandoff(root, advisory, { summary: 'Read behavior.txt.' });
  quickHandoff(root, advisory, { summary: 'Explained behavior.', passedEvidence: 'Read, not executed.' });
  assert.equal(completeRun(root, advisory).status, 'complete');
  assert.match(report(root, advisory), /implementation assessments not required/);
});

test('Scout refuses unresolved alignment, undocumented context freshness, and absent context sources', t => {
  const { root, id } = fixture(t);
  for (const mutate of [
    a => { a.alignment.status = 'needs-input'; },
    a => { a.context.freshness = ''; },
    a => { a.context.status = 'used'; },
    a => { a.approach.kind = 'guess'; },
    a => { a.consumers = []; }
  ]) {
    const assessment = fixtureAssessment(readRun(root, id)); mutate(assessment);
    assert.throws(() => record(root, id, assessment));
    assert.equal(nextRun(root, id).stage, 'scout');
  }
  const blocked = record(root, id, { alignment: { status: 'needs-input' } }, { status: 'blocked', summary: 'Need the product owner to choose behavior.' });
  assert.equal(blocked.status, 'blocked');
  assert.match(report(root, id), /Need the product owner/);
});

test('context files are fingerprinted and unsafe or missing references cannot pass', t => {
  const { root, id } = fixture(t);
  const assessment = fixtureAssessment(readRun(root, id));
  assessment.context = { status: 'used', sources: ['docs/context/error-ledger.md'], evidence: 'Read the fixture history.', freshness: 'Compared its claims with behavior.txt.' };
  for (const path of ['../outside.md', 'docs/missing.md', `.cyc/runs/${id}/review.md`]) {
    assert.throws(() => record(root, id, { ...assessment, context: { ...assessment.context, sources: [path] } }));
  }
  record(root, id, assessment);
  const artifact = readRun(root, id).handoffs[0].artifacts[0];
  assert.equal(artifact.path, 'docs/context/error-ledger.md'); assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
});

test('passing machine checks cannot bypass semantic review or consumer coverage', t => {
  const { root, id } = fixture(t); toVerify(root, id);
  assert.throws(() => quickHandoff(root, id, { summary: 'Tests passed', passedEvidence: 'Receipt' }), /needs an assessment/);
  const assessment = fixtureAssessment(readRun(root, id));
  assessment.semanticReview.findings = [{ id: 'wrong-intent', status: 'open', evidence: 'Implementation misses the requested behavior.' }];
  assert.throws(() => record(root, id, assessment), /Open semantic/);
  assessment.semanticReview.findings[0].status = 'resolved';
  assessment.consumerChecks = [];
  assert.throws(() => record(root, id, assessment), /Missing check.*behavior/);
  assessment.consumerChecks = [{ id: 'behavior', result: 'unverified', evidence: 'Not checked.' }];
  assert.throws(() => record(root, id, assessment), /not verified/);
  assert.equal(nextRun(root, id).stage, 'verify');
});

test('the shared artifact updates without changing source and includes complete review evidence', t => {
  const { root, id } = fixture(t); const before = sourceSnapshot(root).hash;
  toVerify(root, id); record(root, id); record(root, id, undefined, { summary: 'Behavior preserved. No product risks found in this fixture.' });
  assert.equal(completeRun(root, id).status, 'complete');
  assert.equal(sourceSnapshot(root).hash, before);
  const markdown = report(root, id);
  for (const expression of [/Status: complete/, /Approach \(extend\)/, /Semantic review: current/, /Consumer behavior: passed/, /learning \(none\)/, /No product risks/]) assert.match(markdown, expression);
  put(root, 'behavior.txt', 'broken'); reviewRun(root, id);
  assert.match(report(root, id), /stale \/ unverified/);
  assert.match(report(root, id), /Semantic review: stale/);
});

test('source changes require a new semantic review even after commands pass again', t => {
  const { root, id } = fixture(t); toVerify(root, id); record(root, id);
  put(root, 'new-consumer.txt', 'changed'); assert.equal(verifyRun(root, id).passed, true);
  assert.throws(() => record(root, id), /Semantic review is missing or stale/);
  retryRun(root, id, { stage: 'verify', reason: 'Review the changed consumer.' });
  assert.match(report(root, id), /No passing semantic-review assessment/);
  assert.equal(verifyRun(root, id).passed, true); record(root, id); record(root, id);
  assert.equal(completeRun(root, id).status, 'complete');
});

test('bug fixes and recorded failures require the selected error ledger', t => {
  const { root, id } = fixture(t, 'bug-fix'); toVerify(root, id); record(root, id);
  const assessment = fixtureAssessment(readRun(root, id));
  assessment.errorHistory = { status: 'none', reason: 'Forgot the log.', artifacts: [] };
  assert.throws(() => record(root, id, assessment), /need error-history/);
  assessment.errorHistory = { status: 'recorded', reason: 'Used the wrong document.', artifacts: ['behavior.txt'] };
  assert.throws(() => record(root, id, assessment), /selected ledger/);
  record(root, id); assert.equal(completeRun(root, id).status, 'complete');
});

test('pending learning is retained without inventing acceptance and its hashes remain enforced', t => {
  const { root, id } = fixture(t); toVerify(root, id); record(root, id);
  const draft = `.cyc/runs/${id}/learning.md`; put(root, draft, 'Pending acceptance: reviewed fixture finding.');
  const assessment = fixtureAssessment(readRun(root, id));
  assessment.learning = { status: 'pending-acceptance', reason: 'Awaiting user acceptance; no approved knowledge claimed.', artifacts: [draft] };
  assert.throws(() => record(root, id, { ...assessment, learning: { ...assessment.learning, artifacts: ['behavior.txt'] } }), /Pending learning belongs/);
  assert.throws(() => record(root, id, { ...assessment, learning: { ...assessment.learning, artifacts: [`.cyc/runs/${id}/../../../behavior.txt`] } }), /canonical/);
  record(root, id, assessment);
  assert.match(report(root, id), /pending-acceptance/);
  put(root, draft, 'Changed after delivery.');
  assert.throws(() => completeRun(root, id), /Artifact changed/);
  reviewRun(root, id);
  assert.match(report(root, id), /Stale artifact: .*learning.md/);
  assert.match(report(root, id), /stale \/ unverified/);
});

test('the selected ledger remains stable if another conventional ledger appears mid-run', t => {
  const { root, id } = fixture(t);
  put(root, 'INCIDENT-LEDGER.md', 'A newly introduced, different ledger.');
  assert.equal(nextRun(root, id).ledgerPath, 'docs/context/error-ledger.md');
});

test('scoped bug fixes finish with required run-local history while missing foreign and stale evidence is rejected', t => {
  const { root, id } = fixture(t, 'bug-fix', { allowedPaths: ['behavior.txt'] });
  const next = nextRun(root, id), history = `.cyc/runs/${id}/error-history.md`;
  assert.equal(next.ledgerPath, history);
  assert.equal(next.projectLedgerPath, 'docs/context/error-ledger.md');
  const shared = readFileSync(join(root, next.projectLedgerPath));
  toVerify(root, id); record(root, id);
  assert.throws(() => record(root, id), /ENOENT/);
  const assessment = fixtureAssessment(readRun(root, id));
  assessment.errorHistory = { status: 'none', reason: 'No history recorded.', artifacts: [] };
  assert.throws(() => record(root, id, assessment), /need error-history/);
  const foreign = '.cyc/runs/another-run/error-history.md'; put(root, foreign, 'Another run history.');
  assessment.errorHistory = { status: 'recorded', reason: 'Wrong run evidence.', artifacts: [foreign] };
  assert.throws(() => record(root, id, assessment), /selected ledger/);
  const evidence = 'Synthetic defect and failed attempt retained; behavior check restored working.';
  put(root, history, evidence); record(root, id);
  assert(report(root, id).includes(next.projectLedgerPath));
  assert(report(root, id).includes(history));
  put(root, history, 'Changed after review.');
  assert.throws(() => completeRun(root, id), /Artifact changed/);
  put(root, history, evidence);
  assert.equal(completeRun(root, id).status, 'complete');
  assert.deepEqual(readFileSync(join(root, next.projectLedgerPath)), shared);
});

test('custom ledger lookup is preserved and only disallowed or protected shared writes select run-local history', t => {
  for (const protectedPaths of [[], ['notes'], ['notes/errors.md']]) {
    const { root, id } = fixture(t, 'bug-fix', { allowedPaths: ['notes'], config: { context: { ledgerPath: 'notes/errors.md' }, protectedPaths } });
    const next = nextRun(root, id);
    assert.equal(next.projectLedgerPath, 'notes/errors.md');
    assert.equal(next.ledgerPath, protectedPaths.length ? `.cyc/runs/${id}/error-history.md` : 'notes/errors.md');
    assert.equal(existsSync(join(root, 'notes/errors.md')), false);
  }
  const { root, id } = fixture(t, 'bug-fix', { allowedPaths: ['behavior.txt'], config: { context: { ledgerPath: 'notes/errors.md' } } });
  const selected = nextRun(root, id);
  assert.equal(selected.projectLedgerPath, 'notes/errors.md');
  assert.equal(selected.ledgerPath, `.cyc/runs/${id}/error-history.md`);
  put(root, 'INCIDENT-LEDGER.md', 'New convention after selection.');
  assert.equal(nextRun(root, id).projectLedgerPath, selected.projectLedgerPath);
  assert.equal(nextRun(root, id).ledgerPath, selected.ledgerPath);
});

test('a protected run-local fallback is rejected before another run or history file is written', t => {
  const { root, id } = fixture(t);
  const state = readRun(root, id), runs = readdirSync(join(root, '.cyc/runs')).sort();
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
  put(root, '.cyc/config.json', JSON.stringify({ ...config, protectedPaths: ['docs', '.cyc/runs'] }));
  assert.throws(() => startRun(root, { goal: 'Do not write protected evidence.', playbook: 'bug-fix' }), /history.*protected|protected.*history/i);
  assert.deepEqual(readdirSync(join(root, '.cyc/runs')).sort(), runs);
  assert.deepEqual(readRun(root, id), state);
});

test('protected history storage is rejected through a project-local junction before writing a run', t => {
  const { root, id } = fixture(t);
  const storage = join(root, 'stored-runs'), original = join(root, '.cyc/runs');
  assert.equal(dirname(storage), root); assert.equal(dirname(dirname(original)), root);
  renameSync(original, storage); symlinkSync(storage, original, 'junction');
  const runs = readdirSync(storage).sort(), state = readRun(root, id);
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
  put(root, '.cyc/config.json', JSON.stringify({ ...config, protectedPaths: ['stored-runs'] }));
  assert.throws(() => startRun(root, { goal: 'Respect physical protected storage.', playbook: 'bug-fix', allowedPaths: ['behavior.txt'] }), /history.*protected|protected.*history/i);
  assert.deepEqual(readdirSync(storage).sort(), runs);
  assert.deepEqual(readRun(root, id), state);
});

test('Windows casing aliases cannot select protected run history storage', { skip: process.platform !== 'win32' }, t => {
  const { root, id } = fixture(t);
  const runs = readdirSync(join(root, '.cyc/runs')).sort(), state = readRun(root, id);
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
  put(root, '.cyc/config.json', JSON.stringify({ ...config, protectedPaths: ['docs', '.CYC/runs'] }));
  assert.throws(() => startRun(root, { goal: 'Respect casing aliases in protected storage.', playbook: 'bug-fix' }), /history.*protected|protected.*history/i);
  assert.deepEqual(readdirSync(join(root, '.cyc/runs')).sort(), runs);
  assert.deepEqual(readRun(root, id), state);
});

test('run-local history does not exempt unauthorized product edits or protected configuration changes', t => {
  for (const changed of ['outside.txt', '.cyc/config.json']) {
    const { root, id } = fixture(t, 'bug-fix', { allowedPaths: ['behavior.txt'] });
    assert.equal(nextRun(root, id).ledgerPath, `.cyc/runs/${id}/error-history.md`);
    record(root, id); record(root, id);
    put(root, `.cyc/runs/${id}/error-history.md`, 'Retained failure evidence.');
    put(root, changed, changed === 'outside.txt' ? 'Unauthorized source.' : JSON.stringify({ verification: { commands: [] } }));
    assert.equal(verifyRun(root, id).status, 'halted');
    const halt = readRun(root, id).history.findLast(item => item.type === 'guard-halt');
    assert((changed === 'outside.txt' ? halt.outOfScope : halt.protectedChanges).includes(changed));
  }
});

test('durable context must be finalized before verification; no source exemption is introduced', t => {
  const { root, id } = fixture(t); toVerify(root, id); record(root, id);
  put(root, 'docs/context/component.md', 'Accepted finding.');
  const assessment = fixtureAssessment(readRun(root, id));
  assessment.learning = { status: 'recorded', reason: 'Recorded approved reasoning.', artifacts: ['docs/context/component.md'] };
  assert.throws(() => record(root, id, assessment), /Source changed after verification/);
});

test('failed verification and recovery remain visible after invalidating later assessments', t => {
  const { root, id } = fixture(t); record(root, id); record(root, id);
  put(root, 'behavior.txt', 'broken'); assert.equal(verifyRun(root, id).passed, false);
  assert.match(report(root, id), /attempt-failed/);
  retryRun(root, id, { stage: 'scout', reason: 'Reconsider the shared assumption.' });
  assert.match(report(root, id), /No current Scout assessment/);
  assert.match(report(root, id), /Reconsider the shared assumption/);
  assert.deepEqual(nextRun(root, id).assessmentRequired, ['context', 'approach', 'alignment', 'consumers']);
});

test('CLI accepts assessment files and refreshes the same review artifact', t => {
  const { root, id } = fixture(t);
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  const assessmentFile = `.cyc/runs/${id}/scout.json`; put(root, assessmentFile, JSON.stringify(fixtureAssessment(readRun(root, id))));
  const rejected = cli('run', 'record', '--run', id, '--summary', 'Missing assessment');
  assert.equal(rejected.status, 1); assert.match(rejected.stderr, /needs an assessment/);
  const accepted = cli('run', 'record', '--run', id, '--summary', 'Reviewed Scout', '--assessment', assessmentFile);
  assert.equal(accepted.status, 0, accepted.stderr);
  const refreshed = cli('run', 'review', '--run', id);
  assert.equal(refreshed.status, 0, refreshed.stderr);
  assert.equal(JSON.parse(refreshed.stdout).reviewPath, `.cyc/runs/${id}/review.md`);
});

test('legacy serialized runs remain labeled and preserve their original contract', t => {
  const { root, id } = fixture(t);
  const state = readRun(root, id); delete state.workContractVersion;
  // Simulated upgrade fixture only; production clients must never edit run state.
  put(root, `.cyc/runs/${id}/state.json`, JSON.stringify(state));
  quickHandoff(root, id, { summary: 'Legacy Scout.' });
  assert.match(report(root, id), /legacy\/advisory/);
  assert.deepEqual(nextRun(root, id).assessmentRequired, []);
});

test('advisory handoffs do not interpret optional metadata as an implementation assessment', t => {
  const { root, id } = fixture(t, 'investigation');
  quickHandoff(root, id, { summary: 'Read fixture', assessment: { note: 'Optional advisory metadata' } });
  quickHandoff(root, id, { summary: 'Explained fixture', passedEvidence: 'Read, not executed', assessment: { learning: { note: 'Not an implementation disposition' } } });
  assert.equal(completeRun(root, id).status, 'complete');
  put(root, 'behavior.txt', 'changed'); reviewRun(root, id);
  assert.match(report(root, id), /stale \/ unverified/);
});

test('pausing and resuming never leaves passing executable evidence in the review', t => {
  const { root, id } = fixture(t); toVerify(root, id); record(root, id);
  controlRun(root, id, 'pause'); controlRun(root, id, 'resume');
  assert.match(report(root, id), /Configured checks: not current and passing/);
  assert.throws(() => record(root, id), /verification successfully/);
});

// Audit 2026-10-31, finding 5: a mis-cased scope entry halted the run and captured no originals.
test('Windows casing in allowedPaths is canonicalized so edits under the real path stay in scope', { skip: process.platform !== 'win32' }, t => {
  const root = mkdtempSync(join(tmpdir(), 'cyc-quality-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert.ok(root.startsWith(join(resolve(tmpdir()), 'cyc-quality-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, 'src/behavior.txt', 'working');
  put(root, 'docs/context/error-ledger.md', 'Fixture: broken behavior fails the check; repair restores working.');
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('src/behavior.txt','utf8')==='working'?0:1)"] }] } }));
  const { runId: id } = startRun(root, { goal: 'Keep the public behavior working.', playbook: 'feature', criteria: [{ id: 'works', description: 'Public behavior returns working.' }], allowedPaths: ['SRC', 'Docs/Context/error-ledger.md', 'src/new-file.txt'] });
  assert.deepEqual(readRun(root, id).allowedPaths, ['src', 'docs/context/error-ledger.md', 'src/new-file.txt']);
  record(root, id);
  put(root, 'src/behavior.txt', 'still working');
  record(root, id, undefined, { artifacts: ['src/behavior.txt'] });
  assert.equal(readRun(root, id).status, 'running');
  assert.deepEqual(readRun(root, id).handoffs.map(item => item.stage), ['scout', 'build']);
});
