# Review scheduler selection optimization

Review `candidate/change.patch` against the current implementation and its consumer. This is a read-only code review: do not change candidate files. Identify consequential defects introduced by this patch and avoid speculative or stylistic findings. You may run the existing tests and additional read-only experiments.

The public contract of `selectDueJobs(jobs, { now, limit, runningQueues })` is:

- Inputs are well-formed job records with unique string IDs, string queue names, finite numeric priority and runAt, string status, and optional boolean enabled. Options supply a finite numeric now, a nonnegative integer limit (default 10), and an array of currently occupied queue names (default empty).
- Eligible jobs are pending, not explicitly disabled, due at or before now, and in a queue that is not currently occupied. Running queues remain occupied for this selection call. Selecting one job does not itself occupy its queue.
- Return IDs of up to `limit` eligible jobs, with higher priority first, then earlier runAt, then original order for ties. Fill the requested capacity whenever enough eligible jobs exist. Do not mutate inputs.
- Invalid now throws TypeError; invalid limit throws RangeError. The existing exact messages and defaults remain unchanged.
- `planDispatch` delegates to this function and reports remaining capacity; other dispatch lifecycle steps are outside this change.

Save your findings as JSON at the separate findings path supplied by the runner, outside candidate. Use this structure:

```json
{
  "findings": [
    {
      "file": "src/scheduler.mjs",
      "symbol": "selectDueJobs",
      "explanation": "Explain the causal error and its user-visible consequence.",
      "input": {
        "jobs": [],
        "options": { "now": 100, "limit": 1, "runningQueues": [] }
      },
      "expected": [],
      "actual": []
    }
  ]
}
```

For each finding, give a concrete valid input and the exact expected and actual returned ID arrays demonstrating the regression. File and symbol should identify the affected public function. If there are no findings, write an empty array. Wording, title, severity labels, and report headings are not scored. Briefly summarize your review and verification separately.
