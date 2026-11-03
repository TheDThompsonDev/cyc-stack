import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDueJobs } from '../src/scheduler.mjs';
import { planDispatch } from '../src/worker.mjs';

const job = (id, overrides = {}) => ({ id, queue: id, priority: 1, runAt: 50, status: 'pending', enabled: true, ...overrides });
test('orders due pending work by priority then runAt', () => {
  const jobs = [job('late', { runAt: 60 }), job('early'), job('high', { priority: 2 }), job('future', { runAt: 200 }), job('done', { status: 'done' })];
  assert.deepEqual(selectDueJobs(jobs, { now: 100, limit: 2 }), ['high', 'early']);
});
test('ignores disabled jobs', () => assert.deepEqual(selectDueJobs([job('off', { enabled: false })], { now: 100 }), []));
test('excludes occupied queues', () => assert.deepEqual(selectDueJobs([job('blocked')], { now: 100, runningQueues: ['blocked'] }), []));
test('worker reports idle capacity', () => assert.deepEqual(planDispatch({ jobs: [job('one')], runningQueues: [] }, 100, 3), { ids: ['one'], unusedCapacity: 2 }));
test('rejects invalid limits', () => assert.throws(() => selectDueJobs([], { now: 100, limit: -1 }), RangeError));
