import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finishRun, nextRun, readRun, recordHandoff, startRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
import { writePacket } from '../scripts/packet.mjs';

process.env.CYC_BASELINE_MODE = 'sync';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-finish-'));
  t.after(() => { assert.ok(root.includes('cyc-finish-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  mkdirSync(join(root, '.cyc'));
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({
    schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 },
    verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "process.exit(require('node:fs').readFileSync('feature.txt','utf8')==='working'?0:1)"], timeoutMs: 5000 }] }
  }));
  writeFileSync(join(root, 'feature.txt'), 'broken');
  mkdirSync(join(root, 'docs/context'), { recursive: true });
  writeFileSync(join(root, 'docs/context/error-ledger.md'), 'Fixture ledger.');
  return root;
}
function toVerify(root, playbook = 'feature') {
  const id = startRun(root, { goal: 'Make the feature work.', playbook, criteria: [{ id: 'c1', description: 'Feature works.' }, { id: 'c2', description: 'Consumers agree.' }] }).runId;
  while (nextRun(root, id).stage !== 'verify') {
    const next = nextRun(root, id);
    // Build the change before recording Build: a Build that changed nothing and lists nothing is refused.
    if (next.stage === 'build') writeFileSync(join(root, 'feature.txt'), 'working');
    recordHandoff(root, { runId: id, stage: next.stage, attempt: next.attempt, status: 'passed', summary: 'Stage done.', evidence: [{ kind: 'observation', detail: 'fixture' }], artifacts: [], assessment: fixtureAssessment(readRun(root, id)), criteria: next.criteria.map(item => ({ id: item.id, result: 'unverified', evidence: 'later' })) });
  }
  return id;
}
const finalAssessment = state => ({ ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') });
const evidence = { c1: 'behavior check passed', c2: 'consumer check passed' };

test('run next at verify returns one fill-in template covering verify and deliver', t => {
  const root = fixture(t); const id = toVerify(root);
  const next = nextRun(root, id);
  // learning, and errorHistory for a feature without a failed attempt, are recorded by the controller when left out.
  assert.deepEqual(next.assessmentRequired, ['semanticReview', 'consumerChecks']);
  assert.deepEqual(Object.keys(next.assessmentTemplate), next.assessmentRequired);
  assert.match(next.finishWith, /run finish --file FINISH\.json/);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(root, next.finishTemplate), 'utf8'))), ['runId', 'summary', 'criterionEvidence', 'assessment', 'acceptFailures']);
  assert.deepEqual(next.assessmentTemplate.consumerChecks.map(item => item.id), readRun(root, id).handoffs.find(h => h.stage === 'scout').assessment.consumers.map(item => item.id), 'consumer checks are prefilled from Scout');
});

test('run finish verifies, records verify and deliver, and completes in one call', t => {
  const root = fixture(t); const id = toVerify(root);
  const result = finishRun(root, id, { summary: 'Feature works; no performance measurement.', criterionEvidence: evidence, assessment: finalAssessment(readRun(root, id)) });
  assert.equal(result.finished, true);
  assert.deepEqual(result.steps, ['verify', 'record verify', 'record deliver', 'complete']);
  const state = readRun(root, id);
  assert.equal(state.status, 'complete');
  assert.deepEqual(state.handoffs.slice(-2).map(h => h.stage), ['verify', 'deliver']);
});

test('run finish records a failed check as a normal failed attempt and records nothing else', t => {
  const root = fixture(t); const id = toVerify(root);
  writeFileSync(join(root, 'feature.txt'), 'broken again');
  const result = finishRun(root, id, { summary: 'Should not finish.', criterionEvidence: evidence, assessment: finalAssessment(readRun(root, id)) });
  assert.equal(result.finished, false);
  assert.equal(result.failedAt, 'verify');
  const state = readRun(root, id);
  assert.equal(state.failures, 1);
  assert.notEqual(state.status, 'complete');
  assert.ok(!state.handoffs.some(h => h.stage === 'verify'), 'no verify handoff after a failed check');
});

test('run finish refuses an incomplete assessment before running any checks and leaves the run usable', t => {
  const root = fixture(t); const id = toVerify(root);
  const partial = finalAssessment(readRun(root, id)); delete partial.semanticReview;
  assert.throws(() => finishRun(root, id, { summary: 'Missing review.', criterionEvidence: evidence, assessment: partial }), /missing semanticReview/i);
  const state = readRun(root, id);
  assert.equal(nextRun(root, id).stage, 'verify');
  assert.equal(state.verification, null, 'no suite ran for input that could not pass');
  assert.throws(() => finishRun(root, id, { summary: 'x', criterionEvidence: evidence, assessment: {} }), /missing/i);
});

test('unedited and partially filled assessment templates cannot pass', t => {
  const root = fixture(t); const id = toVerify(root);
  const template = { ...nextRun(root, id).assessmentTemplate, testProof: fixtureAssessment(readRun(root, id), 'verify').testProof };
  assert.throws(() => finishRun(root, id, { summary: 'Template only.', criterionEvidence: evidence, assessment: template }), /placeholder/i);
  const withPlaceholder = finalAssessment(readRun(root, id)); withPlaceholder.semanticReview.intent = '<does the diff do what was asked>';
  const fresh = fixture(t); const other = toVerify(fresh);
  assert.throws(() => finishRun(fresh, other, { summary: 'Placeholder left.', criterionEvidence: evidence, assessment: { ...finalAssessment(readRun(fresh, other)), semanticReview: withPlaceholder.semanticReview } }), /placeholder at assessment\.semanticReview\.intent/);
});

test('run finish refuses before verify', t => {
  const root = fixture(t);
  const id = startRun(root, { goal: 'Make the feature work.', playbook: 'feature', criteria: [{ id: 'c1', description: 'Feature works.' }] }).runId;
  assert.throws(() => finishRun(root, id, { summary: 'Too early.', passedEvidence: 'x' }), /starts at build, verify, or deliver; this run is at scout/);
});

function session(root, state) {
  const key = 'a'.repeat(32);
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  writeFileSync(join(root, '.cyc/runtime', `${key}.state.json`), JSON.stringify({ token: 'tok-123', characterLimitEnabled: true, expanded: false, updatedAt: '2026-01-01T00:00:00.000Z', ...state }));
  return key;
}
const reply = 'Done.\n\n| Check | Result |\n| --- | --- |\n| Tests | Pass |';

test('cyc packet writes a packet with the session token and passes the gate check', t => {
  const root = fixture(t); const key = session(root);
  writeFileSync(join(root, 'reply.md'), `${reply}\n`);
  const result = writePacket(root, { session: key, responseFile: 'reply.md', passed: ['Tests pass :: node --test 3/3'], artifacts: ['feature.txt'], reviewed: true });
  assert.equal(result.ok, true, result.issues.join(' '));
  const written = JSON.parse(readFileSync(result.packetPath, 'utf8'));
  assert.equal(written.token, 'tok-123');
  assert.equal(written.response, reply, 'trailing newline is not part of the reply');
  assert.equal(written.artifacts[0].path, 'feature.txt');
});

test('cyc packet reports the gate issues instead of letting the reply bounce', t => {
  const root = fixture(t); const key = session(root);
  writeFileSync(join(root, 'reply.md'), 'x'.repeat(1001));
  const result = writePacket(root, { session: key, responseFile: 'reply.md', passed: ['a :: b'], reviewed: true });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => /1001 characters/.test(issue)));
  assert.ok(result.issues.some(issue => /compact relevant visual: a Markdown table/.test(issue)));
  writeFileSync(join(root, 'reply.md'), reply);
  const blocked = writePacket(root, { session: key, responseFile: 'reply.md', status: 'blocked', blocker: 'needs a key', unmet: ['Deployed :: no credentials'], reviewed: true });
  assert.ok(blocked.issues.some(issue => /Blocked: or Not ready:/.test(issue)), 'a blocked packet must still disclose its blocker in the reply');
});

test('cyc packet refuses without a review, a valid session, or well-formed checks', t => {
  const root = fixture(t); const key = session(root);
  writeFileSync(join(root, 'reply.md'), reply);
  assert.throws(() => writePacket(root, { session: key, responseFile: 'reply.md', passed: ['a :: b'] }), /--reviewed/);
  assert.throws(() => writePacket(root, { session: 'b'.repeat(32), responseFile: 'reply.md', passed: ['a :: b'], reviewed: true }), /No hook state/);
  assert.throws(() => writePacket(root, { session: key, responseFile: 'reply.md', passed: ['no separator'], reviewed: true }), /criterion :: evidence/);
  assert.throws(() => writePacket(root, { session: '../x', responseFile: 'reply.md', passed: ['a :: b'], reviewed: true }), /Session must be/);
});

test('the CLI exposes run finish and packet with a failing exit code when not ready', t => {
  const root = fixture(t); const key = session(root);
  writeFileSync(join(root, 'reply.md'), 'no visual here');
  const out = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'packet', '--project', root, '--session', key, '--response', 'reply.md', '--passed', 'a :: b', '--reviewed'], { encoding: 'utf8' });
  assert.equal(out.status, 1);
  assert.equal(JSON.parse(out.stdout).ok, false);
});

test('CLI JSON finish preserves assessment and summary while refusing mixed or malformed input without mutation', t => {
  const root = fixture(t); const id = toVerify(root);
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  const file = join(root, '.cyc/runs', id, 'finish.json');
  const input = { runId: id, summary: 'Fixed "reload"\nPreserve $HOME and 日本語.', criterionEvidence: evidence, assessment: finalAssessment(readRun(root, id)), artifacts: ['feature.txt'] };
  const before = readFileSync(join(root, '.cyc/runs', id, 'state.json'), 'utf8');
  const missingReview = structuredClone(input.assessment); delete missingReview.semanticReview;
  for (const invalid of ['[]', '{', JSON.stringify({ ...input, ignoreFailures: true }), JSON.stringify({ ...input, artifacts: 'feature.txt' }), JSON.stringify({ ...input, summary: 2 }), JSON.stringify({ ...input, criterionEvidence: {} }), JSON.stringify({ ...input, assessment: missingReview }), JSON.stringify({ ...input, artifacts: ['missing.py'] })]) {
    writeFileSync(file, invalid);
    assert.equal(cli('run', 'finish', '--file', file).status, 1, invalid);
    assert.equal(readFileSync(join(root, '.cyc/runs', id, 'state.json'), 'utf8'), before);
  }
  // acceptFailures is a finish field: the CLI passes it on, and finish checks it before running anything.
  writeFileSync(file, JSON.stringify({ ...input, acceptFailures: [{ check: 'nope', reason: 'x' }] }));
  const unknownCheck = cli('run', 'finish', '--file', file);
  assert.equal(unknownCheck.status, 1);
  assert.match(unknownCheck.stderr + unknownCheck.stdout, /acceptFailures lists checks that already failed before this run/);
  assert.doesNotMatch(unknownCheck.stderr + unknownCheck.stdout, /Unknown input field/);
  assert.equal(readFileSync(join(root, '.cyc/runs', id, 'state.json'), 'utf8'), before);
  writeFileSync(file, JSON.stringify(input));
  assert.equal(cli('run', 'finish', '--file', file, '--summary', 'override').status, 1);
  assert.equal(cli('run', 'finish', '--file', file, '--run', 'different-id').status, 1);
  assert.equal(readFileSync(join(root, '.cyc/runs', id, 'state.json'), 'utf8'), before);
  const output = cli('run', 'finish', '--file', file);
  assert.equal(output.status, 0, output.stderr);
  assert.equal(JSON.parse(output.stdout).finished, true);
  const final = readRun(root, id);
  assert.equal(final.handoffs.at(-1).summary, input.summary);
  assert.deepEqual(final.handoffs.at(-1).assessment, { learning: input.assessment.learning, errorHistory: input.assessment.errorHistory });
});

test('packet preflight rejects a stopped original despite a completed replacement and isolates other sessions', t => {
  const root = fixture(t); const key = session(root);
  writeFileSync(join(root, 'reply.md'), reply);
  const put = (id, owner, status) => {
    const directory = join(root, '.cyc/runs', id); mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'state.json'), JSON.stringify({ id, session: owner, status, startedAt: '2026-01-02T00:00:00.000Z', stages: ['scout','deliver'], stageIndex: 1, playbook: 'feature' }));
  };
  put('stopped-original', key, 'stopped'); put('replacement', key, 'complete'); put('other-session', 'b'.repeat(32), 'running');
  // Claiming readiness explicitly is refused while the original is stopped.
  const ready = writePacket(root, { session: key, responseFile: 'reply.md', status: 'ready', passed: ['a :: b'], reviewed: true });
  assert.equal(ready.ok, false);
  assert.equal(ready.issues.length, 1);
  assert.match(ready.issues[0], /stopped-original.*stopped/);
  // Without a status the review is blocked by this session's stopped run only, and a reply that
  // does not say so is still refused.
  const derived = writePacket(root, { session: key, responseFile: 'reply.md', passed: ['a :: b'], reviewed: true });
  assert.equal(derived.status, 'blocked');
  assert.deepEqual(derived.blockedBy.map(entry => entry.run), ['stopped-original']);
  assert.equal(derived.ok, false);
  assert.deepEqual(derived.issues, ['A blocked handoff must start with Blocked: or Not ready:.']);
  const text = `Blocked: original run is stopped.\n\n| Work | Status |\n| --- | --- |\n| Original | Stopped |`;
  writeFileSync(join(root, 'reply.md'), text);
  const blocked = writePacket(root, { session: key, responseFile: 'reply.md', status: 'blocked', blocker: 'original run is stopped', unmet: ['Delivered :: retained original requires blocked handoff'], reviewed: true });
  assert.equal(blocked.ok, true, blocked.issues.join(' '));
  const fromRuns = writePacket(root, { session: key, responseFile: 'reply.md', unmet: ['Delivered :: retained original requires blocked handoff'], reviewed: true });
  assert.equal(fromRuns.ok, true, fromRuns.issues.join(' '));
});

test('finding spellings: a leading status word and a missing id are read; an unknown status or missing evidence is still refused', t => {
  const attempt = findings => {
    const root = fixture(t); const id = toVerify(root);
    const assessment = finalAssessment(readRun(root, id)); assessment.semanticReview.findings = findings;
    return { root, id, finish: () => finishRun(root, id, { summary: 'Feature works.', criterionEvidence: evidence, assessment }) };
  };
  const spelled = attempt([
    { id: 'f1', summary: 'Empty list markers still nest', resolution: 'dismissed: out of brief scope, unchanged behavior' },
    { finding: 'Payments under a day late get no fee', resolution: 'Dismissed: the brief defines lateness in whole days' }
  ]);
  assert.equal(spelled.finish().finished, true);
  const recorded = readRun(spelled.root, spelled.id).handoffs.find(item => item.stage === 'verify').assessment.semanticReview.findings;
  assert.deepEqual(recorded.map(({ id, status, evidence }) => ({ id, status, evidence })), [
    { id: 'f1', status: 'dismissed', evidence: 'out of brief scope, unchanged behavior' },
    { id: 'f2', status: 'dismissed', evidence: 'the brief defines lateness in whole days' }
  ]);
  assert.throws(attempt([{ id: 'f1', summary: 'First attempt broke negation', resolution: 'Excluded negated extglobs; existing test passes' }]).finish, /Finding f1 status must be.*Each finding is/);
  assert.throws(attempt([{ finding: 'Rounding', resolution: 'Dismissed' }]).finish, /Finding f1 resolution or dismissal needs meaningful evidence/);
  // A status word that is part of other text states no status.
  for (const resolution of ['Fixed-width output still misaligns on Windows; left for follow-up', 'Resolved? No, it still double-fires on timeout', 'Open-ended input is now rejected']) {
    assert.throws(attempt([{ id: 'f1', resolution }]).finish, /Finding f1 status must be.*Each finding is/, resolution);
  }
  // A supplied id never collides with an explicit one, and an explicit status keeps the resolution as its evidence.
  const mixed = attempt([{ id: 'f1', status: 'resolved', evidence: 'Renamed the helper.' }, { status: 'dismissed', resolution: 'out of scope per brief' }]);
  assert.equal(mixed.finish().finished, true);
  const ids = readRun(mixed.root, mixed.id).handoffs.find(item => item.stage === 'verify').assessment.semanticReview.findings;
  assert.deepEqual(ids.map(({ id, status, evidence }) => ({ id, status, evidence })), [
    { id: 'f1', status: 'resolved', evidence: 'Renamed the helper.' },
    { id: 'f2', status: 'dismissed', evidence: 'out of scope per brief' }
  ]);
});

test('common assessment spellings are accepted, but missing evidence and findings are never filled in', t => {
  const attempt = mutate => {
    const root = fixture(t); const id = toVerify(root);
    const assessment = finalAssessment(readRun(root, id));
    mutate(assessment);
    return () => finishRun(root, id, { summary: 'Feature works.', criterionEvidence: evidence, assessment });
  };
  assert.throws(attempt(a => { delete a.semanticReview.findings; }), /needs findings/);
  assert.throws(attempt(a => { a.semanticReview.findings = [{ id: 'f1', resolution: 'dismissed' }]; }), /Finding f1 resolution or dismissal needs meaningful evidence.*Each finding is/);
  assert.throws(attempt(a => { a.semanticReview.findings = [{ id: 'f1', status: 'maybe', evidence: 'x' }]; }), /Finding f1 status must be.*Each finding is/);
  assert.throws(attempt(a => { a.consumerChecks[0].evidence = ''; }), /Consumer check result needs meaningful evidence/);
  assert.throws(attempt(a => { delete a.learning.reason; }), /learning disposition needs meaningful evidence/);
  // Same structure under another name passes: status from resolution, evidence from reason, pass for passed, implied empty lists.
  const accepted = attempt(a => {
    a.semanticReview.findings = [{ id: 'f1', resolution: 'fixed', reason: 'Renamed the helper to match the module.' }];
    a.consumerChecks = a.consumerChecks.map(item => ({ ...item, result: 'pass' }));
    delete a.learning.artifacts;
  })();
  assert.equal(accepted.finished, true, JSON.stringify(accepted));
});
