const DEFAULT_LIMIT = 10;

function compareJobs(a, b) {
  return b.priority - a.priority || a.runAt - b.runAt;
}

export function selectDueJobs(jobs, { now, limit = DEFAULT_LIMIT, runningQueues = [] }) {
  if (!Number.isFinite(now)) throw new TypeError('now must be finite');
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError('limit must be a nonnegative integer');
  const occupied = new Set(runningQueues);
  const due = jobs.filter(job => job.status === 'pending' && job.enabled !== false && job.runAt <= now);
  // Bound the candidate list before checking queues to reduce selection work.
  const shortlist = due.sort(compareJobs).slice(0, limit);
  return shortlist.filter(job => !occupied.has(job.queue)).map(job => job.id);
}
