import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { writePacket } from '../scripts/packet.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const put = (root, path, data) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), data); };
function fixture(t, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-ergonomic-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-ergonomic-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, 'value.txt', 'original');
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'test', command: process.execPath, args: ['-e', 'process.exit(0)'], ...extra.command }] } }));
  return root;
}
const start = (root, extra = {}) => runtime.startRun(root, { goal: 'Verify explicit completion contracts.', playbook: 'feature', executionMode: 'standalone', session: 'human-workflow-label', ...extra }).runId;
function build(root, id) { runtime.quickHandoff(root, id, { summary: 'Read existing behavior.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') }); put(root, 'value.txt', 'candidate'); }
const final = (root, id, extra = {}) => ({ summary: 'Observed fixture result; no host activation claim.', passedEvidence: 'Executed the configured fixture command.', assessment: { ...fixtureAssessment(runtime.readRun(root, id), 'verify'), ...fixtureAssessment(runtime.readRun(root, id), 'deliver') }, ...extra });
test('explicit standalone finish with a human workflow label generates delivery without native or Cursor packet', t => {
  const root = fixture(t), id = start(root); build(root, id);
  const result = runtime.finishRun(root, id, final(root, id));
  assert.equal(result.finished, true); assert.equal(result.packet.mode, 'standalone');
  const delivery = JSON.parse(readFileSync(join(root, result.packet.path)));
  assert.equal(delivery.execution.workflowSession, 'human-workflow-label'); assert.equal(delivery.hookActivation, 'unverified');
  assert.equal(delivery.productReadiness, 'not-certified');
  rmSync(join(root, result.packet.path));
  const resumed = runtime.finishRun(root, id, {});
  assert.equal(resumed.finished, true); assert.equal(resumed.packet.written, true);
  assert.deepEqual(resumed.steps, ['resume delivery']);
  assert(!existsSync(join(root, '.cyc/runtime')) || !readdirSync(join(root, '.cyc/runtime')).some(name => /state\.json|cursor.*review/.test(name)));
  const checked = spawnSync(process.execPath, [join(repo, 'bin/cyc.mjs'), 'check-reply', 'value.txt', '--project', root, '--mode', 'standalone', '--session', 'human-workflow-label'], { encoding: 'utf8' });
  assert.doesNotMatch(checked.stderr, /No hook state|Cursor/);
});
test('explicit modes reject unknown capabilities and cannot downgrade a live native request', t => {
  const root = fixture(t);
  assert.throws(() => start(root, { executionMode: 'guess-host' }), /executionMode/);
  assert(!existsSync(join(root, '.cyc/runs')));
  const session = 'abcdef0123456789abcdef0123456789';
  put(root, `.cyc/runtime/${session}.state.json`, JSON.stringify({ token: 'actual-fixture-token', updatedAt: new Date().toISOString(), host: 'codex' }));
  const before = process.env.CYC_SESSION; process.env.CYC_SESSION = session;
  try { assert.throws(() => start(root), /Active native-codex.*standalone/); }
  finally { if (before === undefined) delete process.env.CYC_SESSION; else process.env.CYC_SESSION = before; }
  assert.throws(() => start(root, { executionMode: 'native-claude', conversationId: 'missing-native-chat' }), /hook state|native context/i);
});
test('conversation ownership rejects implicit and explicit foreign mutation', t => {
  const root = fixture(t), before = process.env.CYC_SESSION; process.env.CYC_SESSION = 'chat-owner-a';
  let id;
  try {
    id = start(root); process.env.CYC_SESSION = 'chat-owner-b';
    assert.throws(() => runtime.activeRun(root), /No active run/);
    assert.throws(() => runtime.controlRun(root, id, 'stop'), /owner|conversation/i);
    assert.equal(runtime.readRun(root, id).status, 'running');
    process.env.CYC_SESSION = 'chat-owner-a'; assert.equal(runtime.activeRun(root), id);
  } finally { if (before === undefined) delete process.env.CYC_SESSION; else process.env.CYC_SESSION = before; }
});
test('review capture returns a valid record template and field errors preserve the captured receipt', t => {
  const root = fixture(t), id = start(root); build(root, id);
  const captured = runtime.captureReview(root, id, { reviewer: 'self' });
  const template = JSON.parse(readFileSync(join(root, captured.recordTemplate)));
  assert.equal(template.reviewId, captured.id); assert.equal(template.identity, null); assert.deepEqual(template.findings, []);
  const bytes = readFileSync(join(root, captured.path));
  assert.throws(() => runtime.recordReview(root, id, { ...template, identity: {}, evidence: 'Actual fixture observation.' }), /identity/);
  assert.throws(() => runtime.recordReview(root, id, template), /evidence/);
  assert.deepEqual(readFileSync(join(root, captured.path)), bytes);
  const recorded = runtime.recordReview(root, id, { ...template, evidence: 'Executed the real isolated fixture boundary.' });
  assert.equal(recorded.status, 'recorded');
  assert(runtime.nextRun(root, id).nextAction.command.includes(`--run ${id}`));
});
test('native gate-only ownership rejects absent and foreign caller context', t => {
  const root = fixture(t), keys = ['CYC_SESSION', 'CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'];
  const saved = keys.map(key => process.env[key]); keys.forEach(key => delete process.env[key]);
  const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  for (const key of [a, b]) put(root, `.cyc/runtime/${key}.state.json`, JSON.stringify({ host: 'codex', token: 'simulated-test-state' }));
  try {
    const id = start(root, { executionMode: 'native-codex', session: a });
    assert.throws(() => runtime.controlRun(root, id, 'stop'), /current conversation context/);
    process.env.CYC_SESSION = b;
    assert.throws(() => runtime.controlRun(root, id, 'stop'), /belongs to native gate/);
    process.env.CYC_SESSION = 'named-caller-without-hook-state';
    assert.throws(() => runtime.controlRun(root, id, 'stop'), /native hook state|native context/);
    assert.equal(runtime.readRun(root, id).status, 'running');
    process.env.CYC_SESSION = a; assert.equal(runtime.controlRun(root, id, 'stop').status, 'stopped');
  } finally { keys.forEach((key, i) => saved[i] === undefined ? delete process.env[key] : process.env[key] = saved[i]); }
});
test('standalone delivery resume uses explicit capability even for a native-shaped conversation ID', t => {
  const root = fixture(t), saved = process.env.CYC_SESSION; process.env.CYC_SESSION = 'cccccccccccccccccccccccccccccccc';
  try {
    const id = start(root); build(root, id); const result = runtime.finishRun(root, id, final(root, id));
    assert.equal(result.packet.mode, 'standalone');
    assert.equal(runtime.finishRun(root, id, {}).packet.mode, 'standalone');
  } finally { if (saved === undefined) delete process.env.CYC_SESSION; else process.env.CYC_SESSION = saved; }
});
test('Cursor finish requires its exact-reply packet instead of emitting a native packet', t => {
  const root = fixture(t), id = start(root, { executionMode: 'cursor', session: 'cursor-workflow' }); build(root, id);
  const result = runtime.finishRun(root, id, final(root, id));
  assert.equal(result.finished, true); assert.equal(result.packet.written, false);
  assert.match(result.packet.reason, /--mode cursor.*--response FILE/);
});
test('directory artifacts are rejected before replacing an existing native packet', t => {
  const root = fixture(t), key = 'abcdef0123456789abcdef0123456789';
  put(root, `.cyc/runtime/${key}.state.json`, JSON.stringify({ token: 'fixture-token', updatedAt: new Date().toISOString(), host: 'codex' }));
  const packet = `.cyc/runtime/${key}.review.json`; put(root, packet, 'previous packet');
  mkdirSync(join(root, 'artifacts'));
  assert.throws(() => writePacket(root, { executionMode: 'native-codex', session: key, artifacts: ['artifacts'], reviewed: true, passed: ['Result :: observed'] }), /regular file|directories/);
  assert.equal(readFileSync(join(root, packet), 'utf8'), 'previous packet');
});
