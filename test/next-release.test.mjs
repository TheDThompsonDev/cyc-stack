import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as runtime from '../scripts/runtime.mjs';
import { parseDoc, checkRetention, applyEntry } from '../scripts/context-review.mjs';
import { onboardProject } from '../scripts/onboarding.mjs';
import * as recovery from '../scripts/recovery.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

process.env.CYC_BASELINE_MODE = 'off';
const cli = resolve('bin/cyc.mjs');
const view = 'The order module owns the persisted fixture value in src/orders.mjs. Context maintenance updates the index and retained explanation while leaving that implementation unchanged. The configured check reads the implementation directly. Source hashes identify the inspected bytes; they do not establish semantic truth or native host activation.';
const put = (root, name, source) => { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), source); };
const doc = covers => `# Order persistence\n\nCovers: ${covers}\n\nLast changed by AI: none recorded\n\n## Current view\n\n${view}\n\n## Lessons\n\n## History\n`;
function fixture(t, { covers = 'src/orders.mjs, docs/context/INDEX.md' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-next-release-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'orders', command: process.execPath, args: ['-e', "require('node:assert/strict').equal(require('node:fs').readFileSync('src/orders.mjs','utf8'),'export const value = 1;\\n')"], timeoutMs: 10000 }] } }));
  put(root, 'src/orders.mjs', 'export const value = 1;\n');
  put(root, 'src/unrelated.mjs', 'export const unrelated = true;\n');
  put(root, 'docs/context/orders.md', doc(covers));
  put(root, 'docs/context/INDEX.md', `# Context index\n\n| Component | Covers | Doc | Last AI change | Lessons |\n| --- | --- | --- | --- | --- |\n| Orders | ${covers} | [Orders](orders.md) | none recorded | none |\n`);
  return root;
}
function maintenance(root, paths = ['docs/context/INDEX.md']) {
  const id = runtime.startRun(root, { goal: 'Maintain the order context index.', playbook: 'feature', executionMode: 'standalone', allowedPaths: ['docs/context'], criteria: [{ id: 'context', description: 'The index retains usable order knowledge.' }], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths }] } }).runId;
  runtime.quickHandoff(root, id, { summary: 'Read the focused order record and unchanged implementation.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') });
  put(root, 'docs/context/INDEX.md', readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8') + '\nIndex maintenance preserves implementation behavior.\n');
  const state = runtime.readRun(root, id);
  const assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver'), learning: { status: 'recorded', reason: 'Revalidate the focused owner during context-only maintenance.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view }] } };
  return { id, input: { summary: 'The order index is maintained; no implementation behavior changed.', criterionEvidence: { context: 'Isolated completion assertions and the unchanged order-module check.' }, assessment } };
}
function run(root, args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8', windowsHide: true, timeout: 65000 });
  return { exitCode: result.status, data: JSON.parse(result.stdout || result.stderr) };
}

test('index-only maintenance finishes using unchanged focused implementation evidence', t => {
  const root = fixture(t), original = readFileSync(join(root, 'src/orders.mjs'));
  const { id, input } = maintenance(root);
  const result = runtime.finishRun(root, id, input);
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.deepEqual(readFileSync(join(root, 'src/orders.mjs')), original);
  const record = parseDoc(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), 'orders.md');
  assert.deepEqual(record.history[0].files.map(f => f.path), ['src/orders.mjs']);
  assert.equal(record.history[0].files[0].hash.replace(/^sha256:/, ''), createHash('sha256').update(original).digest('hex'));
  assert.equal(record.history.filter(h => h.run === id).length, 1);
  assert.equal(runtime.finishRun(root, id, input).finished, true, 'resuming delivery preserves the single current History entry');
  assert.equal(parseDoc(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), 'orders.md').history.length, 1);
});

test('context-only maintenance without explicit entrypoints derives its focused owner', t => {
  const root = fixture(t), { id, input } = maintenance(root, []);
  assert.equal(runtime.finishRun(root, id, input).finished, true);
  const state = runtime.readRun(root, id);
  assert.equal(checkRetention(root, state, runtime.sourceSnapshot(root).files).ok, true);
  put(root, 'src/orders.mjs', 'export const value = 2;\n');
  assert.equal(checkRetention(root, state, runtime.sourceSnapshot(root).files).ok, false, 'later implementation drift cannot reuse context authorship');
});

test('context-only maintenance cannot substitute an unrelated source for a missing owner', t => {
  const root = fixture(t, { covers: 'src/missing.mjs, docs/context/INDEX.md' });
  const { id, input } = maintenance(root);
  const result = runtime.finishRun(root, id, input);
  assert.equal(result.finished, false);
  assert.equal(result.status, 'needs-context');
  assert(result.retention.issues.some(i => i.rule === 'feature-evidence'));
  assert.equal(runtime.readRun(root, id).verification, null);
  const repeated = runtime.finishRun(root, id, input);
  assert.equal(repeated.status, 'needs-context', 'an absent anchor stays repairable on the next finish');
  assert(!repeated.retention.issues.some(i => i.rule === 'last-change'), 'missing evidence must not publish malformed metadata');
});

test('finish guidance points to the exact remaining input without reporting completion', t => {
  const root = fixture(t), { id, input } = maintenance(root);
  delete input.assessment.learning.context;
  put(root, '.cyc/runtime/finish.json', JSON.stringify({ runId: id, ...input }));
  const result = run(root, ['run', 'finish', '--run', id, '--file', join(root, '.cyc/runtime/finish.json')]);
  assert.equal(result.data.finished, false);
  assert.equal(result.data.guidance.outcome, 'needs-input');
  assert.match(result.data.guidance.summary, /context/i);
  assert.equal(result.data.guidance.nextAction.inputTemplate, `.cyc/runs/${id}/finish-context.json`);
  assert.match(result.data.guidance.nextAction.command, new RegExp(`--run ${id} `));
  assert.equal(runtime.readRun(root, id).verification, null);
});

test('paused recovery gives an exact owned resume action and changes no state', t => {
  const root = fixture(t), { id } = maintenance(root);
  runtime.controlRun(root, id, 'pause');
  const statePath = join(root, `.cyc/runs/${id}/state.json`), before = readFileSync(statePath);
  const result = runtime.recoverRun(root, id);
  assert.equal(result.guidance.outcome, 'paused');
  assert.equal(result.nextAction.command, `run resume --run ${id}`);
  assert.match(result.guidance.summary, /preserv|remain/i);
  assert.deepEqual(readFileSync(statePath), before);
  runtime.controlRun(root, id, 'stop');
  const stopped = runtime.recoverRun(root, id);
  assert.equal(stopped.guidance.outcome, 'blocked');
  assert.equal(stopped.nextAction.command, null, 'terminal work must not receive an executable retry');
});

test('onboarding guidance separates passing local checks from missing real host observations', t => {
  const root = fixture(t);
  const report = onboardProject(root, { verify: true, host: 'codex', session: 'unobserved-host-session', env: {} });
  assert.equal(report.steps.find(s => s.id === 'checks').status, 'passed');
  assert.equal(report.steps.find(s => s.id === 'host').reason, 'prompt-not-observed');
  assert.equal(report.ready, false);
  assert.equal(report.guidance.outcome, 'setup-needed');
  assert.match(report.guidance.summary, /host|hook/i);
  assert.match(report.nextAction.instruction, /trust|reload|fresh/i);
  assert.equal(report.environment.node, process.version);
  assert.equal(report.environment.platform, process.platform);
});

test('finish guidance survives bounded worker completion and identifies published delivery', t => {
  const root = fixture(t), { id, input } = maintenance(root);
  put(root, '.cyc/runtime/finish.json', JSON.stringify({ runId: id, ...input }));
  let result = run(root, ['run', 'finish', '--run', id, '--file', join(root, '.cyc/runtime/finish.json'), '--wait-ms', '30000']);
  const deadline = Date.now() + 120000;
  while (result.data.operationId && !result.data.operationComplete && Date.now() < deadline) result = run(root, ['run', 'wait', '--run', id, '--operation', result.data.operationId, '--wait-ms', '30000']);
  assert.equal(result.exitCode, 0, JSON.stringify(result.data));
  assert.equal(result.data.operationComplete, true);
  assert.equal(result.data.result.packet.written, true);
  assert.equal(result.data.guidance.outcome, 'complete');
  assert.equal(result.data.guidance.nextAction, null);
  assert.match(result.data.guidance.summary, /does not certify host activation/);
});

test('progress, passing checks and failed delivery cannot masquerade as completed work', () => {
  const runId = 'owned-example-run';
  const nextAction = { command: `run wait --run ${runId} --operation op --wait-ms 30000` };
  assert.equal(recovery.completionGuidance({ runId, operationId: 'op', operationComplete: false, action: 'finish', phase: 'verify', latestOutput: '', nextAction }).outcome, 'in-progress');
  assert.equal(recovery.completionGuidance({ runId, operationId: 'op', operationComplete: true, action: 'verify', result: { passed: true, status: 'running' } }).outcome, 'in-progress');
  const unpublished = recovery.completionGuidance({ runId, status: 'complete', finished: true, packet: { written: false, reason: 'Permission denied.' } });
  assert.equal(unpublished.outcome, 'needs-repair');
  assert.match(unpublished.summary, /Permission denied/);
  assert.equal(unpublished.nextAction.command, `run recover --run ${runId}`);
  const crashed = recovery.completionGuidance({ runId, operationId: 'op', operationComplete: true, error: { message: 'Worker ended without a result.' } });
  assert.equal(crashed.outcome, 'blocked');
  assert.match(crashed.summary, /without a result/);
});

test('context-only evidence remains scoped and a supporting-only record remains incomplete', t => {
  const root = fixture(t, { covers: 'docs/context/INDEX.md' }), { id, input } = maintenance(root);
  const result = runtime.finishRun(root, id, input);
  assert.equal(result.status, 'needs-context');
  assert.equal(result.finished, false);
  assert.equal(runtime.readRun(root, id).verification, null);
  assert.equal(parseDoc(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), 'orders.md').history.length, 0);
});

test('a current-run History cannot substitute unrelated hashes for a missing focused owner', t => {
  const root = fixture(t, { covers: 'src/missing.mjs, docs/context/INDEX.md' }), { id, input } = maintenance(root);
  const hash = createHash('sha256').update(readFileSync(join(root, 'src/unrelated.mjs'))).digest('hex');
  const date = new Date().toISOString().slice(0, 10);
  const name = 'docs/context/orders.md';
  put(root, name, applyEntry(readFileSync(join(root, name), 'utf8'), { entry: `### ${date} · run ${id} · Adversarial isolated History\n**Changed:** Context fixture only.\n**Learned:** An unrelated valid hash cannot establish feature ownership.\n**Decisive check:** Isolated refusal assertion.\n**Files:** src/unrelated.mjs@sha256:${hash}`, lessons: [], lastChange: `Last changed by AI: ${date} · run ${id} · files: src/unrelated.mjs` }));
  const result = runtime.finishRun(root, id, input);
  assert.equal(result.finished, false, 'valid bytes outside the focused owner cannot replace a missing anchor');
  assert.equal(result.status, 'needs-context');
  assert(result.retention.issues.some(i => i.rule === 'feature-evidence'));
  assert.equal(runtime.readRun(root, id).verification, null);
});

test('Cursor finish guidance preserves the expected exact-response step and actual publication errors', t => {
  const root = fixture(t);
  const id = runtime.startRun(root, { goal: 'Retain order context through Cursor.', playbook: 'feature', executionMode: 'cursor', session: 'cursor-example', allowedPaths: ['docs/context'], criteria: [{ id: 'context', description: 'Retain order knowledge.' }], contextRetention: { disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders.mjs'] }] } }).runId;
  runtime.quickHandoff(root, id, { summary: 'Read the isolated order owner.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') });
  put(root, 'docs/context/INDEX.md', readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8') + '\nCursor context maintenance retains its owner.\n');
  const state = runtime.readRun(root, id);
  const assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver'), learning: { status: 'recorded', reason: 'Retain order owner.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view }] } };
  put(root, '.cyc/runtime/cursor-finish.json', JSON.stringify({ runId: id, summary: 'Order knowledge retained; Cursor response packet remains required.', criterionEvidence: { context: 'Isolated assertions.' }, assessment }));
  const result = run(root, ['run', 'finish', '--run', id, '--file', join(root, '.cyc/runtime/cursor-finish.json')]);
  assert.equal(result.exitCode, 0, JSON.stringify(result.data));
  assert.equal(result.data.finished, true);
  assert.equal(result.data.packet.written, false);
  assert.equal(result.data.guidance.outcome, 'needs-input');
  assert.equal(result.data.guidance.nextAction.action, 'packet');
  assert.match(result.data.guidance.nextAction.instruction, /--mode cursor.*--session cursor-example.*--response FILE/);
  assert.equal(recovery.completionGuidance({ runId: id, status: 'complete', finished: true, packet: { written: false, reason: 'Delivery evidence publication failed (permission denied)' } }, { executionMode: 'cursor' }).outcome, 'needs-repair');
});
