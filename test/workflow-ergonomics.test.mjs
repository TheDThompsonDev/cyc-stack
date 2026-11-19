import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { startRun as startCurrentRun } from '../scripts/runtime.mjs';
import { writePacket } from '../scripts/packet.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
import { digest } from '../scripts/response-gate.mjs';
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

function nativeOwnerFixture(t, host = 'codex') {
  const root = fixture(t), keys = ['CYC_SESSION', 'CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'];
  const saved = keys.map(key => process.env[key]);
  const caller = '12345678-1234-1234-1234-123456789abc', gate = digest(`${host}:${caller}`).slice(0, 32);
  const setCaller = (value, actorHost = host) => { keys.forEach(key => delete process.env[key]); if (value) process.env[actorHost === 'claude' ? 'CLAUDE_CODE_SESSION_ID' : 'CODEX_THREAD_ID'] = value; };
  setCaller();
  t.after(() => keys.forEach((key, i) => saved[i] === undefined ? delete process.env[key] : process.env[key] = saved[i]));
  const statePath = `.cyc/runtime/${gate}.state.json`;
  put(root, statePath, JSON.stringify({ host, token: 'simulated-native-owner-test', updatedAt: new Date().toISOString() }));
  return { root, host, caller, gate, setCaller, statePath };
}

for (const host of ['codex', 'claude']) {
  test(`native ${host} gate alias start preserves the real caller through selection and pause/resume`, t => {
    const f = nativeOwnerFixture(t, host); f.setCaller(f.caller);
    const id = start(f.root, { executionMode: `native-${host}`, conversationId: f.gate, session: f.gate });
    assert.equal(runtime.activeRun(f.root), id);
    assert.equal(runtime.activeRun(f.root, f.gate), id);
    const before = runtime.readRun(f.root, id);
    assert.equal(runtime.controlRun(f.root, id, 'pause').status, 'paused');
    assert.equal(runtime.controlRun(f.root, id, 'resume').status, 'running');
    const after = runtime.readRun(f.root, id);
    assert.equal(after.execution.conversationId, f.caller);
    assert.equal(after.execution.gateSession, f.gate);
    assert.equal(after.session, f.gate);
    assert.deepEqual(after.limits, before.limits);
    assert.equal(after.attempt, before.attempt + 1);
    assert.equal(after.failures, before.failures);
    assert.equal(after.noProgress, before.noProgress);
  });

  test(`native ${host} alias without an observed caller retains gate-only identity`, t => {
    const f = nativeOwnerFixture(t, host);
    const id = start(f.root, { executionMode: `native-${host}`, conversationId: f.gate, session: f.gate });
    assert.equal(runtime.readRun(f.root, id).execution.conversationId, null);
    assert.throws(() => runtime.controlRun(f.root, id, 'pause'), /current conversation context/);
    f.setCaller(f.caller);
    assert.equal(runtime.activeRun(f.root, f.gate), id);
    assert.equal(runtime.controlRun(f.root, id, 'pause').status, 'paused');
  });

  for (const representation of ['alias', 'gate-only']) {
    test(`historical native ${host} ${representation} ownership resolves the real caller without rewriting identity`, t => {
      const f = nativeOwnerFixture(t, host);
      const id = start(f.root, { executionMode: `native-${host}`, session: f.gate });
      const path = join(f.root, '.cyc/runs', id, 'state.json'), historical = JSON.parse(readFileSync(path));
      // Older serialized runs could store the gate key as their conversation identity.
      historical.execution.conversationId = representation === 'alias' ? f.gate : null;
      writeFileSync(path, JSON.stringify(historical));
      f.setCaller(f.caller);
      assert.equal(runtime.activeRun(f.root), id);
      assert.equal(runtime.activeRun(f.root, f.gate), id);
      assert.equal(runtime.controlRun(f.root, id, 'pause').status, 'paused');
      assert.equal(runtime.controlRun(f.root, id, 'resume').status, 'running');
      const current = runtime.readRun(f.root, id);
      assert.deepEqual(current.execution, historical.execution);
      assert.deepEqual(current.limits, historical.limits);
      assert.equal(current.attempt, historical.attempt + 1);
      assert.equal(current.failures, historical.failures);
      assert.equal(current.noProgress, historical.noProgress);
    });
  }
}

for (const host of ['codex', 'claude']) for (const representation of ['canonical', 'alias', 'gate-only']) {
  test(`native ${host} ${representation} task context retains the validated host through read and acknowledgment`, t => {
    const f = nativeOwnerFixture(t, host), otherHost = host === 'codex' ? 'claude' : 'codex';
    put(f.root, `.cyc/runtime/${digest(`${otherHost}:${f.caller}`).slice(0, 32)}.state.json`, JSON.stringify({ host: otherHost, token: 'simulated-overlapping-host' }));
    if (representation !== 'gate-only') f.setCaller(f.caller);
    const { runId: id } = startCurrentRun(f.root, {
      goal: 'Read and acknowledge the actual native owner task context.', playbook: 'verify',
      criteria: [{ id: 'owner', description: 'The current host owner can read and acknowledge context with overlapping host IDs.' }],
      executionMode: `native-${host}`, conversationId: representation === 'gate-only' ? f.gate : f.caller,
      session: f.gate, baselineMode: 'off', taskContext: { version: 1 }
    });
    const path = join(f.root, '.cyc/runs', id, 'state.json');
    if (representation === 'alias') {
      // Exercise an older serialized identity only in this disposable fixture.
      const historical = JSON.parse(readFileSync(path)); historical.execution.conversationId = f.gate;
      writeFileSync(path, JSON.stringify(historical));
    }
    f.setCaller(f.caller);
    const before = runtime.readRun(f.root, id);
    assert.equal(runtime.activeRun(f.root), id);
    assert.equal(runtime.controlRun(f.root, id, 'pause').status, 'paused');
    assert.equal(runtime.controlRun(f.root, id, 'resume').status, 'running');
    const view = runtime.taskContext(f.root, id, 'task');
    const ack = { version: 1, revision: view.revision, hash: view.hash, receipt: view.receipt, application: 'Use the actual host-owned task context.' };
    assert.equal(runtime.taskContext(f.root, id, 'ack', ack).acknowledged, true);
    const after = runtime.readRun(f.root, id);
    assert.deepEqual(after.execution, before.execution);
    assert.deepEqual(after.limits, before.limits);
    for (const actor of [() => f.setCaller(f.caller, otherHost), () => f.setCaller('foreign-caller-without-state'), () => f.setCaller()]) {
      actor(); const unchanged = readFileSync(path);
      assert.throws(() => runtime.taskContext(f.root, id, 'task'), /conversation|native|hook state|context/i);
      assert.throws(() => runtime.taskContext(f.root, id, 'ack', ack), /conversation|native|hook state|context/i);
      assert.deepEqual(readFileSync(path), unchanged);
    }
    f.setCaller(f.caller);
    assert.equal(runtime.taskContext(f.root, id, 'task').runId, id);
  });
}

test('historical native aliases reject absent, unobserved, foreign and cross-host callers without writes', t => {
  const f = nativeOwnerFixture(t), id = start(f.root, { executionMode: 'native-codex', session: f.gate });
  const path = join(f.root, '.cyc/runs', id, 'state.json'), historical = JSON.parse(readFileSync(path));
  historical.execution.conversationId = f.gate; writeFileSync(path, JSON.stringify(historical));
  const ownState = readFileSync(join(f.root, f.statePath));
  const foreign = '87654321-4321-4321-4321-cba987654321', foreignGate = digest(`codex:${foreign}`).slice(0, 32);
  put(f.root, `.cyc/runtime/${foreignGate}.state.json`, JSON.stringify({ host: 'codex', token: 'simulated-foreign-owner-test' }));
  const otherHostGate = digest(`claude:${f.caller}`).slice(0, 32);
  put(f.root, `.cyc/runtime/${otherHostGate}.state.json`, JSON.stringify({ host: 'claude', token: 'simulated-cross-host-test' }));
  const cases = [
    () => f.setCaller(),
    () => f.setCaller('named-caller-without-hook-state'),
    () => { f.setCaller(f.caller); rmSync(join(f.root, f.statePath)); },
    () => f.setCaller(foreign),
    () => f.setCaller(f.caller, 'claude'),
    () => { f.setCaller(f.caller, 'claude'); rmSync(join(f.root, `.cyc/runtime/${otherHostGate}.state.json`)); },
    () => { f.setCaller(f.caller, 'claude'); rmSync(join(f.root, f.statePath)); }
  ];
  for (const prepare of cases) {
    put(f.root, f.statePath, ownState);
    put(f.root, `.cyc/runtime/${otherHostGate}.state.json`, JSON.stringify({ host: 'claude', token: 'simulated-cross-host-test' }));
    prepare();
    const before = readFileSync(path), directory = readdirSync(join(f.root, '.cyc')).sort();
    assert.throws(() => runtime.activeRun(f.root), /No active run|No active CYC run/);
    assert.throws(() => runtime.activeRun(f.root, f.gate), /No active run|No active CYC run/);
    assert.throws(() => runtime.controlRun(f.root, id, 'pause'), /conversation|native|hook state|current.*context/i);
    assert.deepEqual(readFileSync(path), before);
    assert.deepEqual(readdirSync(join(f.root, '.cyc')).sort(), directory);
  }
});

test('canonical native ownership does not become gate-owned or accept contradictory identity', t => {
  const f = nativeOwnerFixture(t); f.setCaller(f.caller);
  const id = start(f.root, { executionMode: 'native-codex', conversationId: f.caller, session: f.gate });
  const path = join(f.root, '.cyc/runs', id, 'state.json'), canonical = readFileSync(path);
  f.setCaller(f.gate);
  assert.throws(() => runtime.activeRun(f.root, f.gate), /No active run|No active CYC run/);
  assert.throws(() => runtime.controlRun(f.root, id, 'pause'), /conversation/);
  assert.deepEqual(readFileSync(path), canonical);
  f.setCaller(f.caller);
  const contradictory = JSON.parse(canonical); contradictory.execution.conversationId = 'different-canonical-owner';
  writeFileSync(path, JSON.stringify(contradictory)); const before = readFileSync(path);
  assert.throws(() => runtime.activeRun(f.root, f.gate), /No active run|No active CYC run/);
  assert.throws(() => runtime.controlRun(f.root, id, 'pause'), /conversation/);
  assert.deepEqual(readFileSync(path), before);
});
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
