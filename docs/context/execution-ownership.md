# Execution capability and conversation ownership

Covers: scripts/execution.mjs, scripts/packet.mjs, scripts/runtime.mjs, bin/cyc.mjs, test/workflow-ergonomics.test.mjs

## Current view

A controller execution has an explicit capability: native-codex, native-claude, cursor or intentionally requested standalone. scripts/execution.mjs:resolveExecution separates the real host conversation, a workflow label and the controller run ID. A label's shape does not select Cursor. Runtime assertRunOwner binds the recorded conversation and native gate to the actual caller, including gate-only starts; no-hook or foreign callers cannot borrow the target's stored label to resolve its owner.

The entrypoints are run start, packet/check-reply, and runtime mutations. Native modes require observed context and cannot be downgraded to standalone while a native request is active. Native delivery still checks tokens, request windows, source freshness and exact responses where required. Cursor needs an explicit exact-response packet. Standalone completion writes local delivery evidence without certifying host activation; hexadecimal conversation IDs remain standalone on resume.

artifactFiles preflights regular files inside the target root before publication; directories are not expanded and a failed preflight preserves the previous packet. The initial gate-only owner repair still accepted a named caller without state; the final resolver uses the actual caller without the stored target fallback. That failure and the hexadecimal resume mistake are retained as regression cases.

Run node --test test/workflow-ergonomics.test.mjs and the existing packet/response-gate tests. These exercise simulated native states, foreign/downgrade rejection, templates and packet preflight. They do not prove that a real host loaded hooks. The prior A-H run reported557 passes and2 skips for its own revision; current follow-up receipts are local-only and must not be substituted for rechecking changed code.

The CLI appends completionGuidance from scripts/recovery.mjs to finish and operation responses. It preserves original controller results and exact owned run/input/wait handles. Paused recovery supplies a resume command after diff inspection; terminal/conflicting states have no automatic mutation command. Native tokens, ownership, request windows and execution modes are unchanged. A completed worker or passed check cannot imply workflow completion; delivery publication failure remains visible.

The CLI's additive workflowAdvice derives from the owned run's recorded goal and allowed paths. It is the same advisory catalog guidance exposed by route --goal with path hints. It does not change native/standalone selection, ownership, request windows, source freshness, stage order, review policy or completion decisions. Legacy callers keep existing fields; current tests include public route compatibility.

The compact-advice repair limits workflowAdvice to explicit run next; ordinary record status retains its existing3000-character budget. A real CLI regression observed3231 characters before the repair, and both it and the unchanged original runtime quick-flow case pass afterward. Managed red proof24aa360b observed that same behavioral assertion on the run-start bin. This affects presentation only: explicit advice, criteria/artifacts/stages, native gates and evidence contracts remain. The earlier context-only full run had599pass/1fail/2skip and remains halted after a subsequent pre-start test-ordering mistake triggered its source guard. Its failure is not accepted as pre-existing or erased.

The optional unified-task-context extension adds parent-owned read/ack and strict contribution reconciliation. Existing source/ownership/retention/proof requirements remain. Runtime binds current context revision/hash into handoffs and verification independently of source hashes; unknown economic advantage selects solo. Read-only host workers cannot complete a parent stage, reset budgets or create permanent context records per worker. See docs/task-context.md and scripts/task-context.mjs/scripts/delegation.mjs for current contracts and host/usage limitations.

Automatic Codex execution is an additive parent-owned path: atomic assignment claim, correlated terminal cleanup after pause/stop, scoped text input and explicit lead reconciliation. It preserves existing source/proof/retention and dependent-context guards. Runtime diagnosis resolved the earlier live-generation blocker: host-provided CLI succeeds with the same account/model while stale PATH CLI fails. Runtime selection prefers the valid host hint. Actual generated source findings, explicit cancellation and one acknowledged merged context were observed; final source-bound checks are recorded separately.

Planner and merge review use distinct parent-owned host claims, immutable correlated thread/turn receipts and scoped snapshots. Workers keep private transports; parent identity is excluded from child environment. Claim requires current auto policy and source/context; terminal cleanup can survive parent stop without reopening it. Explicit terminal-only retry archives cycles and preserves counters; unknown claims prohibit dispatch. Read scope remains cooperative, not OS isolation.

## Lessons

- 2026-11-06 · current maintenance: Completion guidance is an additive projection of owned results, including bounded workers; command templates retain the exact run and do not change native ownership or activation requirements.

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Bind the actual caller and explicit capability; neither session shape nor target-side state is authorization.
