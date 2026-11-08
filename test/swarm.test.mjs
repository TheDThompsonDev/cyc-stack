import test from 'node:test';
import assert from 'node:assert/strict';
import nativeFS, { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
import * as runtime from '../scripts/runtime.mjs';
import { digest } from '../scripts/response-gate.mjs';

const server = fileURLToPath(new URL('../test-support/swarm-server.fixture.mjs', import.meta.url));
const sessions = new WeakSet();
function fixture(t, policy = {}) {
  if (!sessions.has(t)) {
    sessions.add(t);
    const previous = process.env.CYC_SESSION;
    process.env.CYC_SESSION = 'swarm-lead';
    t.after(() => previous === undefined ? delete process.env.CYC_SESSION : process.env.CYC_SESSION = previous);
  }
  const directory = mkdtempSync(join(tmpdir(), 'cyc-swarm-'));
  const root = join(directory, 'project'), trace = join(directory, 'transport');
  mkdirSync(root); mkdirSync(trace);
  writeFileSync(join(root, 'left.txt'), 'left value');
  writeFileSync(join(root, 'right.txt'), 'right value');
  writeFileSync(join(root, 'secret.txt'), 'outside the authorized source scope');
  const id = runtime.startRun(root, {
    goal: 'Independently inspect both source files and reconcile the observations.', playbook: 'investigation', session: 'swarm-lead',
    allowedPaths: ['left.txt', 'right.txt'], criteria: [{ id: 'value', description: 'Retain supported observations for both source files.' }],
    delegation: { version: 1, mode: 'auto', maxAssignments: 6, ...policy }
  }).runId;
  const f = { root, id, trace };
  t.after(async () => {
    if (f.pending) {
      try { runtime.delegateRun(root, id, 'cancel-swarm', { version: 1, reason: 'Fixture cleanup.' }); } catch { /* already terminal */ }
      await f.pending.catch(() => {});
    }
    assert.ok(directory.startsWith(join(tmpdir(), 'cyc-swarm-')));
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return f;
}
const state = f => runtime.readRun(f.root, f.id);
const events = f => existsSync(join(f.trace, 'events.jsonl')) ? readFileSync(join(f.trace, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const workEvents = f => events(f).filter(e => e.event === 'work-start');
async function execute(f, scenario = 'complete', input = {}) {
  const { executeSwarm } = await import('../scripts/swarm.mjs');
  f.pending = executeSwarm(f.root, f.id, { version: 1, objective: 'time', timeoutMs: 15000, ...input }, {
    launch: { command: process.execPath, args: [server, '--scenario=' + scenario, '--trace-dir=' + f.trace] }, pollMs: 10, interruptGraceMs: 250
  });
  return f.pending;
}
async function waitFor(f, predicate, explanation) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw Error(explanation + ': ' + JSON.stringify(events(f)));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function attempt(operation) { try { return { result: await operation() }; } catch (error) { return { error }; } }
function changeContext(f) {
  const before = state(f), v = runtime.taskContext(f.root, f.id, 'task');
  runtime.delegateRun(f.root, f.id, 'reconcile', {
    version: 1, expectedRevision: v.revision, summary: 'Parent changed context while the model was working.', nextAction: 'Preserve the new parent state.',
    findings: before.taskContext.findings, conflicts: before.taskContext.conflicts, failedApproaches: before.taskContext.failedApproaches, dispositions: []
  });
}
function acknowledge(f, application = 'Use the current parent context for an explicit retry.') {
  const v = runtime.taskContext(f.root, f.id, 'task');
  runtime.taskContext(f.root, f.id, 'ack', { version: 1, revision: v.revision, hash: v.hash, receipt: v.receipt, application });
}

test('automatic swarm exposes its parent orchestration interface', async t => {
  const { executeSwarm } = await import('../scripts/swarm.mjs');
  assert.equal(typeof executeSwarm, 'function');
  const f = fixture(t), result = await execute(f);
  assert.equal(result.status, 'merged', JSON.stringify(result));
  const returned = state(f);
  assert.equal(returned.delegation.policy.maxWorkers, 2, 'A new auto policy permits the declared two-worker batch.');
  assert.equal(returned.stageIndex, 0);
  assert.equal(returned.handoffs.length, 0, 'A swarm result cannot pass a parent stage.');
  assert.equal(returned.delegation.assignments.length, 2);
  assert.ok(returned.delegation.assignments.every(a => a.result.status === 'passed' && a.disposition === 'accepted'));
  assert.equal(returned.taskContext.findings.length, 2);
  assert.equal(new Set(returned.taskContext.findings.map(f => f.id)).size, 2, 'Colliding worker-local IDs receive distinct global IDs.');
  assert.deepEqual(new Set(returned.taskContext.findings.flatMap(f => f.evidence.map(e => e.path))), new Set(['left.txt', 'right.txt']));
  const projection = readFileSync(join(f.root, '.cyc/runs', f.id, 'context.md'));
  assert.equal(returned.taskContext.acknowledgment.hash, digest(projection));
  assert.equal(readdirSync(join(f.root, '.cyc/runs', f.id), { recursive: true }).filter(p => p.endsWith('context.md')).length, 1);
  const trace = events(f), firstOutput = trace.findIndex(e => e.event === 'work-output');
  assert.equal(trace.slice(0, firstOutput).filter(e => e.event === 'work-start').length, 2, 'Both independent processes reached the barrier before either returned.');
  assert.equal(new Set(workEvents(f).map(e => e.pid)).size, 2, 'Workers use private transports.');
  assert.equal(new Set(workEvents(f).map(e => e.contextHash)).size, 1, 'The batch shares one acknowledged context snapshot.');
  assert.ok(returned.delegation.observedTokens >= 1802000, 'Large observed usage is retained without a token stop.');
  assert.throws(() => runtime.completeRun(f.root, f.id), /Unfinished|handoff|stage/i);
});

test('economic uncertainty, overlap and dependent work select solo without worker assignments', async t => {
  for (const [scenario, objective] of [['complete', 'tokens'], ['complete', 'spend'], ['overlap', 'tokens'], ['dependent', 'time'], ['shared', 'time']]) {
    const f = fixture(t), result = await execute(f, scenario, { objective });
    assert.equal(result.status, 'solo', JSON.stringify(result));
    assert.equal(state(f).delegation.assignments.length, 0);
    assert.equal(workEvents(f).length, 0);
  }
});

test('invalid objective values cannot silently start time-based model work', async t => {
  for (const objective of ['', null, 0, false, 'unknown']) {
    const f = fixture(t);
    await assert.rejects(execute(f, 'complete', { objective }), /Invalid swarm objective/);
    assert.equal(state(f).delegation.swarm, undefined);
    assert.equal(events(f).length, 0);
  }
});

test('supported full-route economic estimates may select an independent parallel swarm', async t => {
  const f = fixture(t), result = await execute(f, 'economic-win', { objective: 'tokens' });
  assert.equal(result.status, 'merged', JSON.stringify(result));
  assert.equal(workEvents(f).length, 2);
});

test('planner output schema binds criterion IDs instead of accepting freeform descriptions', async t => {
  const f = fixture(t), outcome = await attempt(() => execute(f, 'schema-constrained'));
  assert.equal(outcome.result?.status, 'merged', outcome.error?.stack ?? JSON.stringify(outcome.result));
  const schema = events(f).find(e => e.event === 'planner-schema');
  assert.deepEqual(schema.criterionIds, ['value']);
  assert.deepEqual([...schema.paths].sort(), ['left.txt', 'right.txt']);
  const id = new RegExp(schema.idPattern);
  assert.ok(id.test('task_1'));
  assert.equal(id.test('a'.repeat(33)), false);
  assert.equal(id.test('../scope'), false);
  assert.equal(schema.maxTasks, 2);
  const mergeSchema = events(f).find(e => e.event === 'merge-schema');
  assert.deepEqual([...mergeSchema.assignmentIds].sort(), state(f).delegation.assignments.map(a => a.id).sort());
});

test('an explicitly frozen single-worker policy remains solo', async t => {
  const f = fixture(t, { maxWorkers: 1 }), result = await execute(f);
  assert.equal(result.status, 'solo', JSON.stringify(result));
  assert.equal(state(f).delegation.policy.maxWorkers, 1);
  assert.equal(state(f).delegation.assignments.length, 0);
  assert.equal(workEvents(f).length, 0);
});

test('recommend and off policies cannot silently opt into automatic model dispatch', async t => {
  for (const mode of ['recommend', 'off']) {
    const f = fixture(t, { mode }), outcome = await attempt(() => execute(f));
    assert.notEqual(outcome.result?.status, 'merged');
    assert.equal(state(f).delegation.assignments.length, 0);
    assert.equal(events(f).filter(e => e.event === 'turn-requested').length, 0);
  }
});

test('obsolete numeric token metadata cannot ration the automatic swarm', async t => {
  const f = fixture(t, { budgetTokens: 1, reserveTokens: 1 }), result = await execute(f);
  assert.equal(result.status, 'merged', JSON.stringify(result));
  assert.equal(state(f).delegation.assignments.length, 2);
  assert.ok(state(f).delegation.observedTokens >= 1802000);
  assert.equal(events(f).filter(e => e.event === 'interrupt-requested').length, 0);
});

test('repeating the same parent swarm cannot redispatch its workers', async t => {
  const f = fixture(t); await execute(f);
  const before = state(f).delegation.assignments.map(a => ({ id: a.id, resultId: a.result.resultId }));
  const count = workEvents(f).length;
  await attempt(() => execute(f));
  assert.equal(workEvents(f).length, count);
  assert.deepEqual(state(f).delegation.assignments.map(a => ({ id: a.id, resultId: a.result.resultId })), before);
});

test('explicit retry preserves failed history, usage and completed assignment identities', async t => {
  const f = fixture(t), failed = await attempt(() => execute(f, 'invalid-plan'));
  assert.ok(failed.error, 'The initial invalid plan is retained as an actual failed attempt.');
  const failureState = state(f), oldCycle = structuredClone(failureState.delegation.swarm);
  assert.equal(failureState.delegation.assignments.length, 0);
  assert.ok(failureState.failures >= 1);
  assert.ok(oldCycle.jobs.plan.result, 'A rejected plan still has its terminal phase result.');
  acknowledge(f);
  assert.equal((await execute(f, 'complete', { retry: true })).status, 'merged');
  const first = state(f);
  assert.notEqual(first.delegation.swarm.id, oldCycle.id);
  assert.equal(first.delegation.swarmHistory.length, 1);
  assert.deepEqual(first.delegation.swarmHistory[0].jobs.plan.result, oldCycle.jobs.plan.result);
  assert.equal(first.failures, failureState.failures, 'Explicit retry cannot reset the parent failure budget.');
  assert.equal(first.delegation.assignments.length, 2);
  const retained = first.delegation.assignments.map(a => ({ id: a.id, result: a.result }));
  const observed = first.delegation.observedTokens, usageReceipts = [...first.delegation.usageReceipts];
  assert.equal((await execute(f, 'complete', { retry: true })).status, 'merged');
  const second = state(f);
  assert.equal(second.delegation.swarmHistory.length, 2);
  assert.equal(second.delegation.assignments.length, 4);
  assert.equal(new Set(second.delegation.assignments.map(a => a.id)).size, 4);
  for (const old of retained) assert.deepEqual(second.delegation.assignments.find(a => a.id === old.id).result, old.result);
  assert.equal(second.delegation.observedTokens, observed + 1802000);
  assert.ok(usageReceipts.every(id => second.delegation.usageReceipts.includes(id)));
  assert.equal(second.delegation.usageReceipts.length, usageReceipts.length + 2);
  assert.equal(second.failures, failureState.failures);
  assert.equal(second.taskContext.findings.length, 4, 'A new cycle cannot overwrite prior worker observations.');
  const trace = events(f), batches = new Set(workEvents(f).map(e => e.contextHash));
  assert.equal(batches.size, 2);
  for (const contextHash of batches) {
    const output = trace.findIndex(e => e.event === 'work-output' && e.contextHash === contextHash);
    assert.equal(trace.slice(0, output).filter(e => e.event === 'work-start' && e.contextHash === contextHash).length, 2, 'Every retry cycle reaches its own parallel barrier.');
  }
  const job = oldCycle.jobs.plan;
  const receipt = { version: 1, swarmId: oldCycle.id, phase: 'plan', hostId: job.host.id, threadId: job.host.threadId, turnId: job.host.turnId, terminalStatus: job.host.terminalStatus, result: job.result };
  assert.equal(runtime.swarmHost(f.root, f.id, 'record', receipt).duplicate, true);
  assert.deepEqual(state(f).delegation.swarmHistory, second.delegation.swarmHistory);
  assert.equal(state(f).delegation.observedTokens, second.delegation.observedTokens);
  assert.equal(state(f).taskContext.revision, second.taskContext.revision);
  for (const action of ['claim', 'bind']) assert.throws(() => runtime.swarmHost(f.root, f.id, action, receipt), /archiv|current|histor/i);
});

test('explicit retry refuses uncertain phase or worker claims without dispatching replacements', async t => {
  for (const scenario of ['lost-plan', 'lost-transport']) {
    const f = fixture(t), initial = await attempt(() => execute(f, scenario));
    assert.notEqual(initial.result?.status, 'merged');
    const before = state(f), cycle = before.delegation.swarm;
    assert.ok(Object.values(cycle.jobs).some(j => j.host && !j.result) || before.delegation.assignments.some(a => a.host && !a.result));
    const known = before.delegation.assignments.filter(a => a.result && !a.disposition);
    if (known.length) {
      const v = runtime.taskContext(f.root, f.id, 'task');
      runtime.delegateRun(f.root, f.id, 'reconcile', {
        version: 1, expectedRevision: v.revision, summary: 'The known sibling result was retained; another claim remains uncertain.', nextAction: 'Inspect the missing terminal receipt.',
        findings: before.taskContext.findings, conflicts: before.taskContext.conflicts, failedApproaches: before.taskContext.failedApproaches,
        dispositions: known.map(a => ({ assignmentId: a.id, status: 'rejected', reason: 'Known sibling retained during recovery of the uncertain claim.', findingIds: [] }))
      });
    }
    acknowledge(f);
    const traceBefore = events(f).length, assignments = state(f).delegation.assignments.map(a => a.id), history = state(f).delegation.swarmHistory;
    const retry = await attempt(() => execute(f, 'complete', { retry: true }));
    assert.notEqual(retry.result?.status, 'merged');
    assert.equal(events(f).length, traceBefore);
    assert.equal(state(f).delegation.swarm.id, cycle.id);
    assert.deepEqual(state(f).delegation.assignments.map(a => a.id), assignments);
    assert.deepEqual(state(f).delegation.swarmHistory, history);
  }
});

test('atomicJSON retries only transient Windows rename failures and preserves destinations on failure', t => {
  if (process.platform !== 'win32') { t.skip('The requested transient rename retry is Windows-specific.'); return; }
  const directory = mkdtempSync(join(tmpdir(), 'cyc-swarm-rename-'));
  t.after(() => {
    assert.ok(directory.startsWith(join(tmpdir(), 'cyc-swarm-rename-')));
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const target = join(directory, 'destination.json'), originalRename = nativeFS.renameSync;
  const install = handler => { nativeFS.renameSync = handler; syncBuiltinESMExports(); };
  const restore = () => { nativeFS.renameSync = originalRename; syncBuiltinESMExports(); };
  writeFileSync(target, '{"value":"original"}\n');
  let calls = 0, sources = [];
  try {
    install((from, to) => {
      if (resolve(to) === resolve(target)) {
        sources.push(String(from));
        if (++calls === 1) throw Object.assign(Error('Injected first transient rename failure.'), { code: 'EPERM' });
      }
      return originalRename(from, to);
    });
    runtime.atomicJSON(target, { value: 'replacement' });
    assert.equal(calls, 2);
    assert.equal(new Set(sources).size, 1, 'Retry repeats the same staged rename, rather than a new write/transaction.');
    assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), { value: 'replacement' });
  } finally { restore(); }
  const preserved = readFileSync(target, 'utf8');
  for (const [code, attempts] of [['EIO', 1], ['EPERM', 3]]) {
    calls = 0; sources = [];
    try {
      install((from, to) => {
        if (resolve(to) === resolve(target)) { calls++; sources.push(String(from)); throw Object.assign(Error('Injected persistent rename failure.'), { code }); }
        return originalRename(from, to);
      });
      assert.throws(() => runtime.atomicJSON(target, { value: 'must not commit' }), error => error.code === code);
      assert.equal(calls, attempts);
      assert.equal(new Set(sources).size, 1);
      assert.equal(readFileSync(target, 'utf8'), preserved);
    } finally { restore(); }
  }
});

test('committed swarm merge survives final acknowledgment lock publication failure', async t => {
  const f = fixture(t), originalRename = nativeFS.renameSync;
  const lock = join(f.root, '.cyc/runs/workspace.lock'), saved = join(f.root, '.cyc/runs', f.id, 'state.json');
  let injected = false, committed;
  nativeFS.renameSync = (from, to) => {
    if (!injected && resolve(to) === resolve(lock) && existsSync(saved)) {
      const current = JSON.parse(readFileSync(saved, 'utf8'));
      if (current.delegation?.swarm?.status === 'merged' && !current.taskContext.acknowledgment) {
        injected = true; committed = structuredClone(current);
        throw Object.assign(Error('Injected final acknowledgment lock publication failure.'), { code: 'EIO' });
      }
    }
    return originalRename(from, to);
  };
  syncBuiltinESMExports();
  let outcome;
  try { outcome = await attempt(() => execute(f)); }
  finally { nativeFS.renameSync = originalRename; syncBuiltinESMExports(); }
  assert.ok(injected, 'The real merged state reached the final read/ack transaction.');
  assert.equal(outcome.result?.status, 'needs-context-ack', outcome.error?.stack ?? JSON.stringify(outcome.result));
  assert.equal(outcome.result.committed, true);
  const after = state(f);
  assert.equal(after.delegation.swarm.status, 'merged');
  assert.deepEqual(after.delegation.assignments, committed.delegation.assignments);
  assert.deepEqual(after.taskContext.findings, committed.taskContext.findings);
  assert.equal(after.failures, committed.failures);
  assert.equal(after.attempt, committed.attempt);
  assert.equal(after.delegation.observedTokens, committed.delegation.observedTokens);
  const turns = events(f).filter(e => e.event === 'turn-requested').length;
  acknowledge(f, 'Use the already committed semantic merge after restoring local acknowledgment I/O.');
  const acknowledged = state(f), projection = readFileSync(join(f.root, '.cyc/runs', f.id, 'context.md'));
  assert.equal(acknowledged.taskContext.acknowledgment.hash, digest(projection));
  assert.deepEqual(acknowledged.delegation.assignments.map(a => a.id), committed.delegation.assignments.map(a => a.id));
  assert.equal(events(f).filter(e => e.event === 'turn-requested').length, turns, 'Local acknowledgment recovery must not generate another model turn.');
});

test('foreign owners and invalid plans cannot partially allocate worker assignments', async t => {
  const foreign = fixture(t); process.env.CYC_SESSION = 'foreign-lead';
  await assert.rejects(execute(foreign), /owner|parent|conversation|another/i); process.env.CYC_SESSION = 'swarm-lead';
  assert.equal(state(foreign).delegation.assignments.length, 0);
  for (const scenario of ['invalid-scope', 'invalid-plan']) {
    const f = fixture(t), outcome = await attempt(() => execute(f, scenario));
    assert.notEqual(outcome.result?.status, 'merged');
    assert.equal(state(f).delegation.assignments.length, 0, 'Batch validation is all-or-none.');
    assert.equal(workEvents(f).length, 0);
  }
});

for (const phase of ['plan', 'merge']) {
  for (const changed of ['source', 'context']) {
    test('stale ' + phase + ' output cannot overwrite a changed ' + changed + ' basis', async t => {
      const f = fixture(t), pending = attempt(() => execute(f, 'stale-' + phase + '-' + changed));
      await waitFor(f, () => events(f).some(e => e.event === phase + '-ready'), 'Model did not reach the ' + phase + ' barrier');
      if (changed === 'source') writeFileSync(join(f.root, 'left.txt'), 'new parent source value');
      else changeContext(f);
      writeFileSync(join(f.trace, 'release-' + phase), 'release the old response');
      const outcome = await pending;
      assert.notEqual(outcome.result?.status, 'merged');
      if (phase === 'plan') assert.equal(state(f).delegation.assignments.length, 0);
      if (changed === 'context') assert.equal(state(f).taskContext.summary, 'Parent changed context while the model was working.');
    });
  }
}

test('parent handoff cannot advance while the automatic planner is active', async t => {
  const f = fixture(t), pending = attempt(() => execute(f, 'stale-plan-context'));
  await waitFor(f, () => events(f).some(e => e.event === 'plan-ready') && state(f).delegation.swarm.jobs.plan.host?.turnId, 'Planner did not reach its active phase barrier');
  const before = state(f);
  assert.equal(before.delegation.assignments.length, 0, 'Only a planner phase is active; the existing worker-assignment guard has nothing to detect.');
  assert.equal(before.delegation.swarm.jobs.plan.result, undefined);
  const handoff = await attempt(() => runtime.quickHandoff(f.root, f.id, {
    summary: 'Parent inspected the two declared source paths while independent analysis remains pending.',
    passedEvidence: 'Direct parent reads observed left.txt=' + readFileSync(join(f.root, 'left.txt'), 'utf8') + ' and right.txt=' + readFileSync(join(f.root, 'right.txt'), 'utf8') + '; the active planner has not returned.'
  }));
  const during = state(f);
  writeFileSync(join(f.trace, 'release-plan'), 'Allow this same automatic operation to finish.');
  const result = await pending;
  assert.ok(handoff.error, 'An active planner must block a public passing parent handoff.');
  assert.match(handoff.error.message, /swarm|phase|pending|planner/i);
  assert.equal(during.stageIndex, before.stageIndex);
  assert.equal(during.handoffs.length, before.handoffs.length);
  assert.equal(result.result?.status, 'merged', result.error?.stack ?? JSON.stringify(result.result));
});

test('semantic consolidation retains prior findings, worker questions and negative evidence', async t => {
  const f = fixture(t), v = runtime.taskContext(f.root, f.id, 'task');
  const prior = { id: 'prior', status: 'observed', text: 'Prior source evidence must survive the automatic merger.', evidence: [{ path: 'left.txt', sha256: digest('left value') }] };
  runtime.delegateRun(f.root, f.id, 'reconcile', { version: 1, expectedRevision: v.revision, summary: 'Prior source was inspected.', nextAction: 'Compare independent sources.', findings: [prior], conflicts: [], failedApproaches: ['A previous assumption failed.'], dispositions: [] });
  const read = runtime.taskContext(f.root, f.id, 'task');
  runtime.taskContext(f.root, f.id, 'ack', { version: 1, revision: read.revision, hash: read.hash, receipt: read.receipt, application: 'Preserve prior evidence while comparing source slices.' });
  const result = await execute(f, 'questions'), after = state(f);
  assert.equal(result.status, 'needs-reconciliation', JSON.stringify(result));
  assert.deepEqual(after.taskContext.findings.find(f => f.id === prior.id), prior);
  assert.ok(after.taskContext.failedApproaches.includes('A previous assumption failed.'));
  assert.ok(after.taskContext.failedApproaches.includes('A cached explanation did not establish the source value.'));
  assert.ok(after.taskContext.conflicts.some(c => /disagree|question/i.test(c.detail)));
  assert.equal(after.taskContext.findings.filter(f => f.id !== prior.id).length, 2);
  assert.throws(() => runtime.quickHandoff(f.root, f.id, { summary: 'Cannot hide an unresolved question.' }), /conflict|acknowledg|pending/i);
});

test('uncertain semantic review remains a blocking conflict rather than unanimous acceptance', async t => {
  const f = fixture(t), result = await execute(f, 'uncertain'), after = state(f);
  assert.equal(result.status, 'needs-reconciliation', JSON.stringify(result));
  assert.ok(after.taskContext.conflicts.length);
  assert.equal(after.taskContext.findings.length, 2, 'Both original observations survive uncertainty.');
  assert.ok(after.delegation.assignments.some(a => a.disposition !== 'accepted'));
});

test('a merger cannot inject authority or completion fields', async t => {
  const f = fixture(t), outcome = await attempt(() => execute(f, 'invalid-merge'));
  assert.notEqual(outcome.result?.status, 'merged');
  const after = state(f);
  assert.deepEqual(after.allowedPaths, ['left.txt', 'right.txt']);
  assert.notEqual(after.status, 'complete');
  assert.equal(after.handoffs.length, 0);
});

for (const stopping of ['cancel', 'stop']) {
  test('parent ' + stopping + ' drains all parallel workers through correlated terminal receipts', async t => {
    const f = fixture(t), pending = execute(f, stopping);
    await waitFor(f, () => workEvents(f).length === 2 && state(f).delegation.assignments.every(a => a.host?.turnId), 'Parallel workers did not bind');
    if (stopping === 'cancel') runtime.delegateRun(f.root, f.id, 'cancel-swarm', { version: 1, reason: 'Explicit parent group cancellation.' });
    else runtime.controlRun(f.root, f.id, 'stop');
    assert.ok(state(f).delegation.assignments.every(a => !a.result), 'Slots remain occupied before matching terminal acknowledgment.');
    const outcome = await attempt(() => pending), after = state(f);
    assert.notEqual(outcome.result?.status, 'merged');
    assert.ok(after.delegation.assignments.every(a => a.result?.status === 'cancelled' && a.host.terminalStatus === 'interrupted'));
    assert.equal(events(f).filter(e => e.event === 'interrupt-requested' && e.role === 'work').length, 2);
    if (stopping === 'stop') assert.equal(after.status, 'stopped');
  });
}

test('lost parallel transport retains its slot, drains siblings and forbids replacement dispatch', async t => {
  const f = fixture(t), result = await execute(f, 'lost-transport');
  assert.equal(result.status, 'needs-host-recovery', JSON.stringify(result));
  const after = state(f), lost = after.delegation.assignments.find(a => !a.result);
  assert.ok(lost?.host, 'The uncertain attempt keeps its claimed worker slot.');
  assert.ok(after.delegation.assignments.some(a => a.result), 'The other worker is drained and retained.');
  const before = workEvents(f).length;
  await attempt(() => execute(f));
  assert.equal(workEvents(f).length, before);
  assert.equal(events(f).filter(e => e.role === 'merge' && e.event === 'turn-requested').length, 0);
});

test('a failed worker is retained and all sibling terminals drain before the parent returns', async t => {
  const f = fixture(t), outcome = await attempt(() => execute(f, 'worker-failed')), after = state(f);
  assert.notEqual(outcome.result?.status, 'merged');
  assert.equal(after.delegation.assignments.length, 2);
  assert.ok(after.delegation.assignments.every(a => a.result && a.host.terminalStatus));
  assert.ok(after.delegation.assignments.some(a => a.result.status === 'failed'));
  assert.ok(after.failures >= 1, 'The existing parent failure budget records the failed worker.');
  assert.notEqual(after.status, 'complete');
});
