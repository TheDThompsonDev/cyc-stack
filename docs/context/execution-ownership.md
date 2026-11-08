# Execution capability and conversation ownership

Covers: scripts/execution.mjs, scripts/packet.mjs, scripts/runtime.mjs, bin/cyc.mjs, test/workflow-ergonomics.test.mjs

Last changed by AI: 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · files: bin/cyc.mjs, scripts/runtime.mjs

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

## History

### 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · Automatically decide whether a swarm is worthwhile, split independent work across agents in paralle…
**Changed:** Add automatic scoped swarm planning, atomic parallel dispatch and source-bound semantic reconciliation with safe cancellation/recovery.
**Learned:** Retain automatic decision/parallelism/one-context contracts and actual schema, publication and parent-handoff failures before final checks.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 318f64bc-134d-46b7-865e-6903d3d71494 command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:43d4ad265cd3c7346caddaf1d49235b9bd0adfb712075912974e85c207393e13, scripts/runtime.mjs@sha256:a734cc7de3c9c2d0fcf36deef0c3a7de3eb6c73b5e07dc6444b30c5db6c0ff84

### 2026-11-07 · run be41a8ca-77fb-4e6c-8785-780005ec49a2 · Implement automatic bounded Codex worker dispatch, acknowledged cancellation and unified-context in…
**Changed:** Resolved stale CLI selection and verified actual generated findings, cancellation and one shared context.
**Learned:** Retain measured runtime diagnosis and real qualification before final source checks.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run be41a8ca-77fb-4e6c-8785-780005ec49a2 command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:05dea3753ed07c773adea19849c2ff1fc10df90f498e657e3f2018aeaddfc120, scripts/runtime.mjs@sha256:ef714a5ffc8866703fcbd23be812053712423e9e3127be729299527cc791b1dd

### 2026-11-07 · run 10e609d6-1319-41b5-b1a6-53e66bed9656 · Implement unified task context and bounded read-only delegation with parent-owned reconciliation an…
**Changed:** Implement unified task context and bounded read-only delegation while preserving legacy contracts.
**Learned:** One shared document per run, explicit reconciliation, conservative budgets, actual parent identity and no automatic model dispatch or measured savings claim.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 10e609d6-1319-41b5-b1a6-53e66bed9656 command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:b7c26d67c7317b23b4749b4da6fb679767ba0adc4f2d80f7b721b0cb86700695, scripts/runtime.mjs@sha256:767c933c0579f20912005fb0045281ead3c9c2de1cfed3c7756288baa8c901ae

### 2026-11-07 · run 16b78baa-588b-4340-bd22-3d7e206e451e · Repair introduced CLI record-output bloat while retaining explicit workflow advice.
**Changed:** Repair introduced record output bloat; keep workflow advice on explicit next and preserve the existing status budget and all artifacts/criteria.
**Learned:** Retain actual3231-character original failure,2-case targeted pass and managed red proof; preserve earlier halted/stopped outcomes and external validation limits.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 16b78baa-588b-4340-bd22-3d7e206e451e command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:0ccd05809766792fe6e836a64811f370dfad41a13eaa291cdbdf4ef303a7a441

### 2026-11-07 · run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 · Reconcile omitted canonical context owners and verify the final local adoption implementation witho…
**Changed:** Reconcile all10 affected canonical owners and index for the reviewed adoption changes; public code/tests remain unchanged.
**Learned:** Retain current shared contract implications, source bindings and explicit original-run/proof/live-validation limits.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:6086fd78f343b2d9157280a603bfffa66245f2c06f079725c8e9c59eaa2b64fc

### 2026-11-07 · run b70fdf23-cc8b-4028-be98-7e9cad40755d · Implement local CYC adoption, context visibility and proportional guidance; prepare isolated cohort…
**Changed:** Implement first-task/context/response guidance, bounded context reasons and byte observations, conservative workflow advice and isolated cohort evaluation preparation.
**Learned:** Preserve backward-compatible shapes, current native gates and actual provenance. Explanations and fixtures do not establish live activation, participant understanding or workflow savings.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run b70fdf23-cc8b-4028-be98-7e9cad40755d command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:6086fd78f343b2d9157280a603bfffa66245f2c06f079725c8e9c59eaa2b64fc

### 2026-11-07 · run 58050570-ae16-4f59-8075-d78d67e8a764 · Repair context-only completion and make finish, recovery and real-host setup guidance usable withou…
**Changed:** Context-only completion now retains unchanged focused implementation evidence; finish/recovery/setup expose actionable derived guidance. Changes stay local and uncommitted. Actual current-chat native activation is missing; fresh-host confirmation remains pending and simulated hook tests do not establish it.
**Learned:** Retain the focused evidence fallback and truthful setup/completion/recovery boundaries before final verification; automated checks do not establish semantic truth or real-host activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 58050570-ae16-4f59-8075-d78d67e8a764 command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:ee19440c522fc9c1d9df268c3939e7935bd9349d41852898fdea98b9fd7fc16c

### 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · Preserve POSIX and encoded file URL identities when associating Node load diagnostics with their te…
**Changed:** Repair Node importer diagnostic identity using fileURLToPath and native canonical paths, preserving containment and truthful module-load judgments. Encoded-path original and real 8.3-alias failures are retained; focused candidate completion checks pass 6/6, with full verification still required.
**Learned:** Retain actual Linux-only release failure, encoded-path reproduction and standard URL decoding under the existing scoped proof/completion contracts. Shared runtime owners retain their prior policies; local receipts and CI establish specific checks, not unseen model quality or hook activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 814322af-3707-43f5-af30-605e6a3d0c96 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:f41c01a0964fff0dadae49f5f12264e989e9e3a129ddbba828143b431ddb4d40

### 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · Enforce canonical indexed feature context during normal completion and repair current context/histo…
**Changed:** Require source-bound canonical feature retention before final checks; repair missing A-H feature records/mappings and actual historical evidence without rewriting completed receipts.
**Learned:** Default feature plans freeze target documentation scope, normal finish prepares authored knowledge, and relevant lint/discovery/source freshness block incomplete claims. Local fixtures expose mechanical guarantees; semantics, independent effectiveness and native activation remain unverified.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run a81789bf-63d2-4f61-8849-6395cd2c791c command receipts separately. Local receipts may not travel with source.
**Files:** bin/cyc.mjs@sha256:d835354d523f472396da60f46b89f2250196ea286108d2b5b1de4dda0bc3c9ca, scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, test/workflow-ergonomics.test.mjs@sha256:b8e1f187e5b506e6c6d8da0f914d5a57d580e60dc3ce6d7a660cbfb2ded86889, scripts/execution.mjs@sha256:8d7e43dc4b0be30d75d7e39f6dfa22967a28a4cf7c249ca65c6546bf472c6a59, scripts/packet.mjs@sha256:a1de9ec0fe4a429f66ff4c2bcf2c5095ab5d3e0fe97f5f5a72d4d7cb01fb9b48

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** bin/cyc.mjs@sha256:92a993d7e003, scripts/execution.mjs@sha256:8d7e43dc4b0b, scripts/packet.mjs@sha256:a1de9ec0fe4a, scripts/runtime.mjs@sha256:8a136a426da4, test/workflow-ergonomics.test.mjs@sha256:3252946a3a71
