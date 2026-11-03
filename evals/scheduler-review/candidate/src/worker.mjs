import { selectDueJobs } from './scheduler.mjs';

// The caller persists dispatches and changes job status after this planning step.
export function planDispatch(snapshot, now, capacity) {
  const ids = selectDueJobs(snapshot.jobs, { now, limit: capacity, runningQueues: snapshot.runningQueues });
  return { ids, unusedCapacity: capacity - ids.length };
}
