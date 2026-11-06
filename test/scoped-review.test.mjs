import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
const put = (root, path, data) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), data); };
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-scoped-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-scoped-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', 'process.exit(0)'] }] } }));
  put(root, 'backend/handler.mjs', "import {member} from '../auth.mjs';export const read=()=>member();"); put(root, 'auth.mjs', 'export const member=()=>true;'); put(root, 'ui.mjs', 'export const focus=0;');
  const id = runtime.startRun(root, { goal: 'Composed source-linked review coverage.', playbook: 'feature', evidenceVersion: 1, requirements: 'The scoped fixture remains coherent.', reviewPolicy: 'fresh-required', criteria: [{ id: 'works', description: 'Observed fixture behavior.' }] }).runId;
  runtime.quickHandoff(root, id, { summary: 'Read source boundaries.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') });
  put(root, 'backend/handler.mjs', "import {member} from '../auth.mjs';export const read=()=>Boolean(member());"); put(root, 'ui.mjs', 'export const focus=1;');
  return { root, id };
}
function capture(root, id, scope, extra = {}) { return runtime.captureReview(root, id, { reviewer: 'fresh-context', scope, contextPaths: [], contextEvidence: 'Inspected static local dependencies and explicit domain boundary; fixture-only review evidence.', ...extra }); }
function record(root, id, receipt, findings = []) { return runtime.recordReview(root, id, { reviewId: receipt.id, evidence: 'Actual fixture source inspected; this is agent-reported provenance, not independent product certification.', findings }); }
test('bounded unchanged backend coverage survives a UI fix and composes with fresh focus/history follow-up', t => {
  const { root, id } = fixture(t);
  const backend = capture(root, id, ['backend']); assert.equal(backend.contextMode, 'bounded'); assert(backend.contextPaths.includes('auth.mjs'));
  record(root, id, backend, [{ id: 'history', status: 'resolved', evidence: 'Fixture continuity finding disposition retained.' }]);
  put(root, 'ui.mjs', 'export const focus=2;');
  const ui = capture(root, id, ['ui.mjs']);
  const followup = JSON.parse(readFileSync(join(root, ui.followupPath)));
  assert.deepEqual(followup.changedPaths, ['ui.mjs']); assert(followup.findings.some(f => f.id === 'history'));
  record(root, id, ui, [{ id: 'focus', status: 'open', evidence: 'Fixture focus assertion has not been repaired.' }]);
  const input = () => { const state = runtime.readRun(root, id), a = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') }; a.criterionChecks = [{ id: 'works', scenario: 'fixture boundary inspected', check: 'behavior', receipt: 'current-verification', result: 'passed', evidence: 'Fixture observation separate from command status.', origin: 'agent-reported' }]; a.semanticReview.reviewer = 'fresh-context'; return { summary: 'Scoped fixture review only.', assessment: a }; };
  assert.throws(() => runtime.finishRun(root, id, input()), /Open semantic review/);
  put(root, 'ui.mjs', 'export const focus=3;');
  const repaired = capture(root, id, ['ui.mjs']); record(root, id, repaired, [{ id: 'focus', status: 'resolved', evidence: 'Fixture focus repair reviewed.' }]);
  const done = runtime.finishRun(root, id, input()); assert.equal(done.finished, true);
  const refs = runtime.readRun(root, id).handoffs.find(h => h.stage === 'verify').assessment.semanticReview.receipts;
  assert(refs.includes(backend.id)); assert(refs.includes(repaired.id)); assert(!refs.includes(ui.id));
});
test('changed auth contract, added/deleted files, criteria and dependency bytes invalidate bounded scopes', t => {
  for (const change of ['auth', 'add', 'delete', 'criteria', 'dependency']) {
    const { root, id } = fixture(t), receipt = capture(root, id, ['backend']);
    if (change === 'auth') put(root, 'auth.mjs', 'export const member=()=>false;');
    if (change === 'add') put(root, 'backend/new.mjs', 'export const unreviewed=true;');
    if (change === 'delete') unlinkSync(join(root, 'backend/handler.mjs'));
    if (change === 'dependency') put(root, 'node_modules/pkg/index.mjs', 'export const changed=true;');
    if (change === 'criteria') { const state = runtime.readRun(root, id); state.criteria[0].description = 'A different contract.'; runtime.atomicJSON(join(root, '.cyc/runs', id, 'state.json'), state); }
    assert.throws(() => record(root, id, receipt), /stale/, change);
  }
});
test('unknown dependency impact falls back to whole-source freshness', t => {
  const { root, id } = fixture(t); put(root, 'backend/handler.mjs', 'export const read=(path)=>import(path);');
  const receipt = capture(root, id, ['backend']); assert.equal(receipt.contextMode, 'whole-source');
  put(root, 'ui.mjs', 'export const focus=9;'); assert.throws(() => record(root, id, receipt), /stale/);
});
test('local package-import aliases cannot leave an untracked authorization dependency current', async t => {
  const { root, id } = fixture(t);
  put(root, 'package.json', JSON.stringify({ type: 'module', imports: { '#auth': './auth.mjs' } }));
  put(root, 'package-lock.json', '{}');
  put(root, 'backend/handler.mjs', "import {member} from '#auth';export const read=()=>member();");
  const receipt = capture(root, id, ['backend']); assert.equal(receipt.contextMode, 'whole-source');
  put(root, 'auth.mjs', 'export const member=()=>false;');
  assert.throws(() => record(root, id, receipt), /stale/);
});
