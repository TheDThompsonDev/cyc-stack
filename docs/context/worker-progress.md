# Bounded worker progress and cancellation

Covers: scripts/run-worker.mjs, scripts/runtime.mjs, bin/cyc.mjs, test/operation-progress.test.mjs

## Current view

Long finish/proof/verification work enters scripts/runtime.mjs:startOperation and scripts/run-worker.mjs:executeOperation. The worker owns existing controller transactions and persistence; it does not launch model agents. run wait with the returned exact run/operation IDs waits up to60000ms and reports phase, check, elapsed time, latest actual output, last-output time and disk logs. operationComplete differs from workflow finished. Silence is represented as silence, not fabricated advancement.

runCheckProcess isolates each check and bounds output storage. It distinguishes timeout, check-runner crash, controller loss and intentional cancellation. controlRun(stop) records an owned cancellation request without waiting for the check lock; the helper stops the process tree and later checks are skipped. An original-source proof restores candidate bytes before acknowledging stopped. Genuine source conflicts retain halted recovery and backups instead. Multi-step preparation/check work is not an atomic filesystem transaction.

The original public stop path needed the same lock held by the worker and could not cancel it. Another failure was in verification fixtures: assuming every process starts within one second made full-suite load look like missing progress. The tests now observe bounded output and hold work until explicit release/stop, preserving phase/log/receipt and restoration assertions.

Run node --test test/operation-progress.test.mjs. A separate scoped harness delayed actual workers1500ms and the four progress cases passed; this is local scheduling evidence, not a guarantee about every OS kill race or live user interruption. Preserve ownership/backup records on forced termination and use run recover. Normal progress never requires reading lock files. Required feature context may return needs-context before any command starts; that is not a passed check.

Additive CLI guidance covers both immediate finish and bounded wait results. Active phase/silence remains in-progress; a passed verify/proof check can remain unfinished, while published completed delivery is complete. Crashes and delivery publication errors require recovery, preserving the returned operation/run identity. This presentation does not modify worker state, locking, cancellation or original-source restoration.

Progress fixtures wait up to the supported 60000ms per observation/terminal acknowledgement rather than require a whole worker transaction to finish after one 10000ms wait. Active output must still be observed before cancellation. Intentional check timeout values, timeout/crash distinctions, cancellation flags/error codes/receipts, skipped later checks and candidate-byte restoration assertions are unchanged. A check-complete/cancelled progress phase can precede publication of operationComplete/result. Fixture guards retain bounded failure; they do not fabricate success or progress.

The adoption CLI projection adds workflow advice on ordinary next views, preserving bounded operation identity, wait behavior and original progress fields. Recovery effort reports only existing failure/no-progress counters; model requests and total journey duration stay null. Operation elapsed time remains available in existing wait views and cannot be promoted to full-task savings or summed across overlapping work.

The compact-advice repair limits workflowAdvice to explicit run next; ordinary record status retains its existing3000-character budget. A real CLI regression observed3231 characters before the repair, and both it and the unchanged original runtime quick-flow case pass afterward. Managed red proof24aa360b observed that same behavioral assertion on the run-start bin. This affects presentation only: explicit advice, criteria/artifacts/stages, native gates and evidence contracts remain. The earlier context-only full run had599pass/1fail/2skip and remains halted after a subsequent pre-start test-ordering mistake triggered its source guard. Its failure is not accepted as pre-existing or erased.

The optional unified-task-context extension adds parent-owned read/ack and strict contribution reconciliation. Existing source/ownership/retention/proof requirements remain. Runtime binds current context revision/hash into handoffs and verification independently of source hashes; unknown economic advantage selects solo. Read-only host workers cannot complete a parent stage, reset budgets or create permanent context records per worker. See docs/task-context.md and scripts/task-context.mjs/scripts/delegation.mjs for current contracts and host/usage limitations.

Automatic Codex execution is an additive parent-owned path: atomic assignment claim, correlated terminal cleanup after pause/stop, scoped text input and explicit lead reconciliation. It preserves existing source/proof/retention and dependent-context guards. Runtime diagnosis resolved the earlier live-generation blocker: host-provided CLI succeeds with the same account/model while stale PATH CLI fails. Runtime selection prefers the valid host hint. Actual generated source findings, explicit cancellation and one acknowledged merged context were observed; final source-bound checks are recorded separately.

Private planner/worker/merge transports keep events correlated; parallel batches share one acknowledged snapshot and allSettled drains siblings after failure. Cancellation needs matching terminal acknowledgment. Unknown transport keeps claims, no silent redispatch. Explicit retries retain cycles/usage/failures/assignment totals. Windows transient publication retries only the same staged rename; committed merge plus ack failure returns pending read/ack without generation retry.

## Lessons

- 2026-11-06 · current maintenance: A finished worker or passing check is distinct from workflow completion. CLI guidance retains the exact wait handle and exposes failed delivery publication without claiming activation.

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Synchronize verification with actual observable state; stop requests are acknowledged only after safe unwinding.
