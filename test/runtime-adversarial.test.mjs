import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { completeRun, nextRun, readRun, recordHandoff, retryRun, sourceSnapshot, startRun, verifyRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

// Measure baselines inline so tests are deterministic; one test covers the background worker.
process.env.CYC_BASELINE_MODE = 'sync';

function fixture(t, prefix = 'cyc-runtime-adversarial-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function configure(root) {
  mkdirSync(join(root, '.cyc'));
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({
    limits: { maxAttempts: 8 },
    verification: { commands: [{ id: 'fixture-check', command: process.execPath, args: ['-e', 'process.exit(0)'] }] }
  }));
}
function handoff(root, runId) {
  const next = nextRun(root, runId);
  return {
    runId, stage: next.stage, attempt: next.attempt, status: 'passed',
    summary: 'Fixture stage reviewed', artifacts: [], assessment: fixtureAssessment(readRun(root, runId)),
    evidence: [{ kind: 'observation', detail: 'Self-review: isolated adversarial controller fixture.' }],
    criteria: next.criteria.map(item => ({ id: item.id, result: 'passed', evidence: 'Fixture assertion, not product evidence.' }))
  };
}
function advanceTo(root, runId, stage) {
  while (nextRun(root, runId).stage !== stage) {
    // A passed Build records what was built; the fixture builds one file.
    if (nextRun(root, runId).stage === 'build') writeFileSync(join(root, 'fixture.txt'), 'built');
    recordHandoff(root, handoff(root, runId));
  }
}

test('a downstream packet cannot be replayed after rewinding and revisiting that stage', t => {
  const root = fixture(t); configure(root);
  const { runId } = startRun(root, { goal: 'Plan fixture behavior', playbook: 'plan' });
  recordHandoff(root, handoff(root, runId));
  const staleUnderstand = handoff(root, runId);
  recordHandoff(root, staleUnderstand);
  retryRun(root, runId, { stage: 'frame', reason: 'A material framing assumption changed.' });
  recordHandoff(root, handoff(root, runId));
  assert.equal(nextRun(root, runId).stage, 'understand');
  assert.notEqual(nextRun(root, runId).attempt, staleUnderstand.attempt);
  assert.throws(() => recordHandoff(root, staleUnderstand), /run, stage, and attempt/);
});

test('adding an out-of-scope junction is a detected change rather than an invisible dependency', t => {
  const root = fixture(t); const external = fixture(t, 'cyc-external-fixture-'); configure(root);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(external, 'dependency.txt'), 'external fixture');
  const { runId } = startRun(root, { goal: 'Inspect only src', playbook: 'investigation', allowedPaths: ['src'] });
  const packet = handoff(root, runId);
  const before = sourceSnapshot(root);
  symlinkSync(external, join(root, 'outside-src'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(sourceSnapshot(root).hash, before.hash);
  const result = recordHandoff(root, packet);
  assert.equal(result.status, 'halted');
  assert.ok(result.history.some(item => item.type === 'guard-halt' && item.outOfScope.includes('outside-src')));
});

test('a newly introduced linked dependency invalidates an already passing executable receipt', t => {
  const root = fixture(t); const external = fixture(t, 'cyc-external-fixture-'); configure(root);
  writeFileSync(join(external, 'dependency.txt'), 'external fixture');
  const { runId } = startRun(root, { goal: 'Check fixture', playbook: 'feature' });
  advanceTo(root, runId, 'verify');
  assert.equal(verifyRun(root, runId).passed, true);
  symlinkSync(external, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => recordHandoff(root, handoff(root, runId)), /changed|symlink|link|coverage/i);
  assert.notEqual(nextRun(root, runId).stage, 'deliver');
  assert.throws(() => completeRun(root, runId), /Unfinished stage/);
});

test('an existing linked dependency cannot be silently certified by an executable run', t => {
  const root = fixture(t); const external = fixture(t, 'cyc-external-fixture-'); configure(root);
  writeFileSync(join(external, 'dependency.txt'), 'external fixture');
  symlinkSync(external, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const { runId } = startRun(root, { goal: 'Check fixture with linked data', playbook: 'feature' });
  advanceTo(root, runId, 'verify');
  let result;
  try { result = verifyRun(root, runId); }
  catch (error) { assert.match(error.message, /symlink|link|coverage/i); return; }
  assert.equal(result.passed, false, 'Unsupported linked dependencies must not receive a passing receipt');
  assert.throws(() => recordHandoff(root, handoff(root, runId)), /verification|symlink|link|coverage/i);
});

test('an explicit project-root scope produces guidance instead of an empty unusable path prefix', t => {
  const root = fixture(t); configure(root);
  assert.throws(() => startRun(root, { goal: 'Inspect fixture', playbook: 'investigation', allowedPaths: ['.'] }), /omit.*scope|entire project/i);
});
