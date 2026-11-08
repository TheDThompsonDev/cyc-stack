import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
function fixture(t, args, timeoutMs = 10000, following = []) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-progress-'));
  const runs = new Set();
  t.after(() => {
    for (const id of [...runs].reverse()) if (runtime.readRun(root, id).status === 'running') {
      const stopped = runtime.controlRun(root, id, 'stop');
      if (stopped.operationId) assert(runtime.waitOperation(root, id, stopped.operationId, 60000).operationComplete);
    }
    assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-progress-')));
    rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  mkdirSync(join(root, '.cyc')); writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ verification: { commands: [{ id: 'slow', command: process.execPath, args, timeoutMs }, ...following] } }));
  const id = runtime.startRun(root, { goal: 'Observe a real slow check.', playbook: 'verify', executionMode: 'standalone' }).runId;
  runs.add(id);
  runtime.quickHandoff(root, id, { summary: 'Actual local check selected.' });
  return { root, id, runs };
}
function started(root, id, operationId, pattern) {
  const deadline = Date.now() + 60000;
  let view;
  do {
    view = runtime.waitOperation(root, id, operationId, 200);
    if (pattern.test(view.latestOutput ?? '') || view.operationComplete) break;
  } while (Date.now() < deadline);
  assert.match(view.latestOutput, pattern, JSON.stringify(view));
  assert.equal(view.operationComplete, false, 'check must still be active at the observed action boundary');
  return view;
}
test('a slow check exposes phase/output/logs and one bounded wait reaches its receipt without lock discovery', t => {
  const { root, id } = fixture(t, ['-e', "console.log('check started');let ready=false;setTimeout(()=>ready=true,2200);const timer=setInterval(()=>{if(ready&&require('node:fs').existsSync('.cyc/runtime/release-check')){console.log('check done');clearInterval(timer)}},100)"]);
  const launched = runtime.startOperation(root, id, { action: 'verify', waitMs: 0 });
  assert.equal(launched.operationComplete, false); assert(launched.nextAction.command.includes(`--run ${id}`));
  const active = started(root, id, launched.operationId, /check started/);
  assert.equal(active.phase, 'candidate'); assert.equal(active.check, 'slow'); assert.match(active.latestOutput, /check started/); assert(active.elapsedSeconds > 0);
  assert(existsSync(active.logs.stdout)); assert.doesNotMatch(active.nextAction.command, /lock/);
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true }); writeFileSync(join(root, '.cyc/runtime/release-check'), 'release');
  const completed = runtime.waitOperation(root, id, launched.operationId, 60000);
  assert.equal(completed.operationComplete, true); assert.equal(completed.result.passed, true); assert(completed.result.receiptPath);
  assert.match(readFileSync(completed.logs.stdout, 'utf8'), /check done/);
});
test('silent success, timeout and runner crash have distinct outcomes', t => {
  for (const [args, timeoutMs, expected] of [
    [['-e', 'setTimeout(()=>{},250)'], 5000, null],
    [['-e', 'setTimeout(()=>{},5000)'], 120, 'ETIMEDOUT'],
    [['-e', "process.kill(process.ppid,'SIGKILL')"], 5000, 'CYC_CHECK_RUNNER']
  ]) {
    const { root, id } = fixture(t, args, timeoutMs);
    const result = runtime.startOperation(root, id, { action: 'verify', waitMs: 60000 });
    assert.equal(result.operationComplete, true, JSON.stringify(result));
    assert.equal(result.result.results[0].errorCode, expected);
    if (expected === null) { assert.equal(result.result.passed, true); assert.equal(result.lastOutputAt, null); assert.equal(result.latestOutput.trim(), ''); }
    else assert.equal(result.result.passed, false);
  }
});
test('owned public stop cancels an active check, retains its receipt and skips later checks', t => {
  const { root, id } = fixture(t, ['-e', "console.log('ready to stop');setInterval(()=>{},1000)"], 20000, [{ id: 'later', command: process.execPath, args: ['-e', "require('node:fs').writeFileSync('.cyc/runtime/should-not-run','bad')"] }]);
  const launched = runtime.startOperation(root, id, { action: 'verify', waitMs: 0 });
  started(root, id, launched.operationId, /ready to stop/);
  const stop = runtime.controlRun(root, id, 'stop'); assert.equal(stop.status, 'stop-requested');
  const result = runtime.waitOperation(root, id, launched.operationId, 60000);
  assert.equal(result.status, 'cancelled'); assert.equal(result.result.cancelled, true); assert.equal(result.result.passed, false);
  assert.equal(result.result.results[0].errorCode, 'CYC_CHECK_CANCELLED'); assert(result.result.receiptPath);
  assert.equal(runtime.readRun(root, id).status, 'stopped'); assert(!existsSync(join(root, '.cyc/runtime/should-not-run')));
});
test('stop during original proof restores candidate bytes before acknowledging the stopped run', t => {
  const { root, runs } = fixture(t, ['-e', "console.log('original running');setInterval(()=>{},1000)"], 20000);
  writeFileSync(join(root, 'source.mjs'), 'export const value=0;');
  const id = runtime.startRun(root, { goal: 'Cancel safely during original source proof.', playbook: 'feature', executionMode: 'standalone' }).runId;
  runs.add(id);
  runtime.quickHandoff(root, id, { summary: 'Trace source and test.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') });
  writeFileSync(join(root, 'source.mjs'), 'export const value=1;');
  mkdirSync(join(root, 'test')); writeFileSync(join(root, 'test/new.test.mjs'), "import test from 'node:test';test('new feature',()=>{});");
  runtime.quickHandoff(root, id, { summary: 'Candidate is built.', artifacts: ['source.mjs', 'test/new.test.mjs'] });
  const launched = runtime.startOperation(root, id, { action: 'prove-red', waitMs: 0 });
  started(root, id, launched.operationId, /original running/); assert.equal(readFileSync(join(root, 'source.mjs'), 'utf8'), 'export const value=0;');
  assert.equal(runtime.controlRun(root, id, 'stop').status, 'stop-requested');
  const result = runtime.waitOperation(root, id, launched.operationId, 60000);
  assert.equal(result.status, 'cancelled'); assert.equal(runtime.readRun(root, id).status, 'stopped');
  assert.equal(readFileSync(join(root, 'source.mjs'), 'utf8'), 'export const value=1;');
  assert(existsSync(join(root, 'test/new.test.mjs')));
});
