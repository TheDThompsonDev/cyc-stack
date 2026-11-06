import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
import * as review from '../scripts/work-review.mjs';
import * as output from '../scripts/test-output.mjs';
const { validateAssessment, renderReview, validateProofReview } = review;
const { failureHint } = output;

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const put = (root, path, data) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), data); };
function fixture(t, { setup, ...extra } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-evidence-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-evidence-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, 'record.txt', 'stored imported field and access metadata');
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "if(!require('node:fs').readFileSync('record.txt','utf8').includes('imported'))process.exit(1)"] }] } }));
  setup?.(root);
  const criteria = Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 1}`, description: `Original outcome ${i + 1}`, ...(i === 0 ? { clauses: [{ id: 'fields', description: 'Imported fields survive.' }, { id: 'permissions', description: 'Permissions survive.' }] } : {}) }));
  const next = runtime.startRun(root, { goal: 'Keep all eight original outcomes visible.', playbook: 'feature', evidenceVersion: 1, requirements: 'Original outcomes 1 through 8, including imported fields and permissions.', criteria, ...extra });
  return { root, id: next.runId, criteria };
}
function assessment(root, id, stage) { return fixtureAssessment(runtime.readRun(root, id), stage); }
function advance(root, id) {
  runtime.quickHandoff(root, id, { summary: 'Scout: four plan headings retain eight criteria.', assessment: assessment(root, id, 'scout') });
  put(root, 'change.txt', 'A scoped change.');
  runtime.quickHandoff(root, id, { summary: 'Built candidate.', artifacts: ['change.txt'] });
}
function checks(root, id) {
  return runtime.readRun(root, id).criteria.flatMap(c => (c.clauses ?? [{ id: undefined }]).map(clause => ({ id: c.id, ...(clause.id ? { clause: clause.id } : {}), scenario: `${c.id} ${clause.id ?? 'behavior'} through the actual boundary`, check: 'behavior', receipt: 'current-verification', result: 'passed', evidence: 'Inspected stored data after the configured check; fixture observation, not a named runner assertion.', origin: 'agent-reported' })));
}

test('unlinked fresh-context is never displayed as source-linked current review', () => {
  const review = { reviewer: 'fresh-context', intent: 'Intent reviewed.', consumers: 'Consumers reviewed.', conventions: 'Conventions reviewed.', findings: [] };
  const state = { id: 'probe', goal: 'Review provenance', status: 'running', playbook: 'feature', workContractVersion: 1, criteria: [], handoffs: [{ stage: 'verify', status: 'passed', sourceHash: 'now', criteria: [], assessment: { semanticReview: review, consumerChecks: [] } }], history: [] };
  assert.match(renderReview(state, 'now'), /unlinked.*fresh-context|fresh-context.*unlinked/i);
  assert.doesNotMatch(renderReview(state, 'now'), /Semantic review: current; reviewer: fresh-context/);
});

test('versioned start retains original text and clauses and rejects an unsupported contract before writes', t => {
  const { root, id, criteria } = fixture(t);
  const state = runtime.readRun(root, id);
  assert.equal(state.evidenceVersion, 1);
  assert.equal(state.requirements.text, 'Original outcomes 1 through 8, including imported fields and permissions.');
  assert.deepEqual(state.criteria, criteria);
  assert.throws(() => runtime.startRun(root, { goal: 'Invalid', playbook: 'feature', evidenceVersion: 9 }), /evidenceVersion/);
  assert.throws(() => runtime.startRun(root, { goal: 'Missing originals', playbook: 'feature', evidenceVersion: 1, criteria }), /requirements/);
});

test('every original outcome and clause needs a scenario; count-only and unavailable evidence cannot pass', t => {
  const { root, id } = fixture(t); advance(root, id); runtime.verifyRun(root, id);
  const state = runtime.readRun(root, id), a = assessment(root, id, 'verify');
  a.criterionChecks = checks(root, id);
  assert.throws(() => validateAssessment(state, { stage: 'verify', status: 'passed', assessment: { ...a, criterionChecks: a.criterionChecks.slice(1) } }, () => ({})), /fields/);
  assert.throws(() => validateAssessment(state, { stage: 'verify', status: 'passed', assessment: { ...a, criterionChecks: a.criterionChecks.map(c => ({ ...c, scenario: '' })) } }, () => ({})), /scenario/i);
  assert.throws(() => validateAssessment(state, { stage: 'verify', status: 'passed', assessment: { ...a, criterionChecks: a.criterionChecks.map(c => ({ ...c, result: 'unverified' })) } }, () => ({})), /unverified|verified/i);
});

test('review captures the actual source; stale, foreign and altered receipts cannot pass', t => {
  const { root, id } = fixture(t); advance(root, id);
  const receipt = runtime.captureReview(root, id, { reviewer: 'fresh-context', scope: ['record.txt'] });
  assert.equal(receipt.provenance, 'agent-reported');
  assert.equal(receipt.identity, null);
  const recorded = runtime.recordReview(root, id, { reviewId: receipt.id, evidence: 'Inspected actual stored-data producer and restoration contract.', findings: [] });
  assert.equal(recorded.status, 'recorded');
  put(root, 'record.txt', 'new imported data');
  assert.throws(() => runtime.recordReview(root, id, { reviewId: receipt.id, evidence: 'Wrong later source', findings: [] }), /stale|changed/i);
  assert.throws(() => runtime.recordReview(root, id, { reviewId: 'foreign', evidence: 'Foreign', findings: [] }), /Unknown review/);
});

test('fast finish retains scenario evidence and current review receipts, labeling mixed coverage', t => {
  const { root, id } = fixture(t); advance(root, id);
  const refs = [];
  for (const reviewer of ['fresh-context', 'self']) {
    const r = runtime.captureReview(root, id, { reviewer });
    runtime.recordReview(root, id, { reviewId: r.id, evidence: `Actual ${reviewer} fixture review, not independent assurance.`, findings: [] });
    refs.push(r.id);
  }
  const a = { ...assessment(root, id, 'verify'), ...assessment(root, id, 'deliver') };
  a.semanticReview.receipts = refs;
  a.criterionChecks = checks(root, id);
  const result = runtime.finishRun(root, id, { summary: 'Eight outcomes retained; mixed source-linked reviews.', criterionEvidence: Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Named fixture observation retained.'])), assessment: a });
  assert.equal(result.finished, true);
  const state = runtime.readRun(root, id), verify = state.handoffs.find(h => h.stage === 'verify');
  assert.equal(verify.assessment.criterionChecks.length, 9);
  assert.notEqual(verify.assessment.criterionChecks[0].receipt, 'current-verification');
  const report = readFileSync(join(root, result.reviewPath), 'utf8');
  assert.match(report, /mixed/i); assert.match(report, /agent-reported/);
  assert.match(report, /permissions/);
  put(root, 'change.txt', 'Changed after review.'); runtime.reviewRun(root, id);
  assert.match(readFileSync(join(root, result.reviewPath), 'utf8'), /stale/);
});

test('structured CLI exposes review capture and recording without requiring host identity', t => {
  const { root, id } = fixture(t); advance(root, id);
  put(root, '.cyc/runtime/capture.json', JSON.stringify({ reviewer: 'fresh-context' }));
  const cli = (...args) => spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  const captured = cli('run', 'review-capture', '--run', id, '--file', '.cyc/runtime/capture.json');
  assert.equal(captured.status, 0, captured.stderr);
  const r = JSON.parse(captured.stdout);
  put(root, '.cyc/runtime/record.json', JSON.stringify({ reviewId: r.id, evidence: 'Inspected the fixture candidate.', findings: [] }));
  const recorded = cli('run', 'review-record', '--run', id, '--file', '.cyc/runtime/record.json');
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(JSON.parse(recorded.stdout).identity, null);
});

test('mixed baseline proof retains behavioral and missing-interface diagnostics without equating them', t => {
  const { root, id } = fixture(t, { playbook: 'bug-fix', setup(root) {
    put(root, 'duration.mjs', 'export const duration = () => 90;');
    put(root, 'test/behavior.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; import {duration} from '../duration.mjs'; test('original duration',()=>assert.equal(duration(),90));");
    put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/behavior.test.mjs'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"] }] } }));
  } });
  runtime.quickHandoff(root, id, { summary: 'Preserve duration boundary.', assessment: assessment(root, id, 'scout') });
  put(root, 'duration.mjs', 'export const duration = () => 60;');
  put(root, 'helper.mjs', 'export const exists = true;');
  put(root, 'test/behavior.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; import {duration} from '../duration.mjs'; test('original duration',()=>assert.equal(duration(),90)); test('duration regression',()=>assert.equal(duration(),60)); test('new helper',async()=>assert.equal((await import('../helper.mjs')).exists,true));");
  // The old 90-minute assertion is deliberately removed as part of the changed contract.
  put(root, 'test/behavior.test.mjs', readFileSync(join(root, 'test/behavior.test.mjs'), 'utf8').replace("test('original duration',()=>assert.equal(duration(),90)); ", ''));
  runtime.quickHandoff(root, id, { summary: 'Repair duration and add helper.', artifacts: ['duration.mjs', 'helper.mjs', 'test/behavior.test.mjs'] });
  const proof = runtime.proveRun(root, id);
  assert.equal(proof.passed, true, readFileSync(join(root, proof.receiptPath), 'utf8'));
  assert.equal(proof.failures.find(f => f.name === 'duration regression').hint, 'assertion');
  assert.equal(proof.failures.find(f => f.name === 'new helper').hint, 'module-load');
  assert.match(proof.proofClaim, /Diagnostic red/);
  const state = runtime.readRun(root, id), api = proof.failures.find(f => f.name === 'new helper'), behavioral = proof.failures.find(f => f.name === 'duration regression');
  assert.throws(() => validateProofReview(state, { receipt: 'current-proof', cases: [{ id: api.id, category: 'new-interface', reason: 'New helper is absent on baseline.' }] }), /No decisive behavioral proof/);
  assert.doesNotThrow(() => validateProofReview(state, { receipt: 'current-proof', cases: [{ id: behavioral.id, category: 'behavioral', reason: 'Actual duration returns 90, expected 60.', boundary: 'Existing duration() export' }, { id: api.id, category: 'new-interface', reason: 'New helper is absent on baseline.' }] }));
  assert.equal(runtime.verifyRun(root, id).passed, true);
  assert.equal(failureHint({ error: 'TypeError: existing public method crashes' }), 'unclassified');
  assert.doesNotThrow(() => validateProofReview({ ...state, playbook: 'feature' }, { receipt: 'current-proof', cases: [{ id: api.id, category: 'new-interface', reason: 'Feature intentionally adds this interface.' }] }));
});

test('foreign command evidence and tampered review receipts cannot advance Verify', t => {
  const { root, id } = fixture(t); advance(root, id); runtime.verifyRun(root, id);
  const a = assessment(root, id, 'verify'); a.criterionChecks = checks(root, id);
  a.criterionChecks[0].receipt = '.cyc/runs/foreign/checks/fake.json';
  const criterionEvidence = Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Fixture observation.']));
  assert.throws(() => runtime.quickHandoff(root, id, { summary: 'Reject foreign command evidence.', criterionEvidence, assessment: a }), /stale or foreign/);
  a.criterionChecks = checks(root, id);
  const r = runtime.captureReview(root, id, { reviewer: 'fresh-context' });
  runtime.recordReview(root, id, { reviewId: r.id, evidence: 'Inspected fixture source.', findings: [] });
  put(root, r.path, '{}'); a.semanticReview.receipts = [r.id];
  assert.throws(() => runtime.quickHandoff(root, id, { summary: 'Reject altered review.', criterionEvidence, assessment: a }), /Artifact changed/);
  assert.equal(runtime.nextRun(root, id).stage, 'verify');
});

test('fresh-required policy rejects self-only and uncovered review scopes', t => {
  const { root, id } = fixture(t, { reviewPolicy: 'fresh-required' }); advance(root, id); runtime.verifyRun(root, id);
  const criterionEvidence = Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Actual fixture observation.']));
  const a = assessment(root, id, 'verify'); a.criterionChecks = checks(root, id);
  const self = runtime.captureReview(root, id, { reviewer: 'self' });
  runtime.recordReview(root, id, { reviewId: self.id, evidence: 'Self review of the actual fixture candidate.', findings: [] });
  a.semanticReview.receipts = [self.id];
  assert.throws(() => runtime.quickHandoff(root, id, { summary: 'Self is insufficient for this policy.', criterionEvidence, assessment: a }), /fresh-required/);
  const fresh = runtime.captureReview(root, id, { reviewer: 'fresh-context', scope: ['record.txt'] });
  runtime.recordReview(root, id, { reviewId: fresh.id, evidence: 'Fresh review of record only.', findings: [] });
  a.semanticReview.receipts = [fresh.id];
  assert.throws(() => runtime.quickHandoff(root, id, { summary: 'Changed file is uncovered.', criterionEvidence, assessment: a }), /do not cover/);
});

test('Deliver and completion retain command/review fingerprints after fast finish', t => {
  const { root, id } = fixture(t); advance(root, id);
  const r = runtime.captureReview(root, id, { reviewer: 'self' });
  runtime.recordReview(root, id, { reviewId: r.id, evidence: 'Actual fixture review.', findings: [] });
  const a = { ...assessment(root, id, 'verify'), ...assessment(root, id, 'deliver') };
  a.semanticReview.receipts = [r.id]; a.criterionChecks = checks(root, id);
  runtime.finishRun(root, id, { summary: 'Evidence is linked through delivery.', criterionEvidence: Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Fixture observation.'])), assessment: a });
  const state = runtime.readRun(root, id);
  assert(state.handoffs.find(h => h.stage === 'deliver').artifacts.some(a => a.path === r.path));
  put(root, r.path, '{}'); runtime.reviewRun(root, id);
  const rendered = readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8');
  assert.match(rendered, /Semantic review: unverified/);
  assert.throws(() => runtime.completeRun(root, id), /Run is complete/);
});

test('green refactor proof receipt remains bound through Verify Deliver and pre-completion checks', t => {
  const { root, id } = fixture(t, { playbook: 'refactor', setup(root) {
    put(root, 'calc.mjs', 'export const result = () => 2;');
    put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"] }] } }));
  } });
  runtime.quickHandoff(root, id, { summary: 'Characterize existing result.', assessment: assessment(root, id, 'scout') });
  put(root, 'calc.mjs', 'export function result() { return 2; }');
  put(root, 'test/characterization.test.mjs', "import test from 'node:test'; import assert from 'node:assert/strict'; import {result} from '../calc.mjs'; test('existing result',()=>assert.equal(result(),2));");
  runtime.quickHandoff(root, id, { summary: 'Equivalent function declaration.', artifacts: ['calc.mjs', 'test/characterization.test.mjs'] });
  const proof = runtime.proveRun(root, id); assert.equal(proof.passed, true);
  assert.equal(runtime.verifyRun(root, id).passed, true);
  const a = assessment(root, id, 'verify'); delete a.testProof; a.criterionChecks = checks(root, id);
  runtime.quickHandoff(root, id, { summary: 'Green characterization verified.', criterionEvidence: Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Characterization passes on both versions.'])), assessment: a });
  runtime.quickHandoff(root, id, { summary: 'Ready for completion.', criterionEvidence: Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Characterization and evidence retained.'])), assessment: assessment(root, id, 'deliver') });
  assert(runtime.readRun(root, id).handoffs.at(-1).artifacts.some(a => a.path === proof.receiptPath));
  put(root, proof.receiptPath, '{}');
  assert.throws(() => runtime.completeRun(root, id), /Artifact changed/);
});

test('legacy captured review uses the same current-criteria fingerprint as recording', t => {
  const { root, id } = fixture(t, { evidenceVersion: undefined }); advance(root, id);
  const r = runtime.captureReview(root, id, { reviewer: 'fresh-context' });
  runtime.recordReview(root, id, { reviewId: r.id, evidence: 'Inspected legacy-interface candidate.', findings: [] });
  runtime.verifyRun(root, id);
  const a = assessment(root, id, 'verify'); a.semanticReview = { ...a.semanticReview, reviewer: 'fresh-context', receipts: [r.id] };
  runtime.quickHandoff(root, id, { summary: 'Actual linked review on legacy interface.', criterionEvidence: Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Fixture observation.'])), assessment: a });
  assert.match(readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8'), /Semantic review: source-linked/);
});

test('findings from different review receipts require separate receipt-scoped dispositions', t => {
  const { root, id } = fixture(t); advance(root, id);
  const refs = [];
  for (const [reviewer, evidence] of [['fresh-context', 'Original permissions can disappear.'], ['self', 'Concurrent edits can be overwritten.']]) {
    const r = runtime.captureReview(root, id, { reviewer });
    runtime.recordReview(root, id, { reviewId: r.id, evidence: 'Actual fixture review.', findings: [{ id: 'f1', status: 'open', evidence }] }); refs.push(r.id);
  }
  runtime.verifyRun(root, id);
  const a = assessment(root, id, 'verify'); a.criterionChecks = checks(root, id); a.semanticReview.receipts = refs;
  a.semanticReview.findings = [{ id: 'f1', status: 'dismissed', evidence: 'Permissions are preserved.' }];
  const criterionEvidence = Object.fromEntries(runtime.readRun(root, id).criteria.map(c => [c.id, 'Fixture observation.']));
  assert.throws(() => runtime.quickHandoff(root, id, { summary: 'One f1 cannot resolve two independent findings.', criterionEvidence, assessment: a }), /receipt-scoped|disposition/);
  a.semanticReview.findings = refs.map((reviewId, i) => ({ reviewId, id: 'f1', status: 'dismissed', evidence: i ? 'Concurrent-write fixture shows no overwrite.' : 'Permission argument fixture preserves originals.' }));
  assert.doesNotThrow(() => runtime.quickHandoff(root, id, { summary: 'Both distinct findings have dispositions.', criterionEvidence, assessment: a }));
});
