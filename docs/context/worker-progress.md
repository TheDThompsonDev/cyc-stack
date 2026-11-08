# Bounded worker progress and cancellation

Covers: scripts/run-worker.mjs, scripts/runtime.mjs, bin/cyc.mjs, test/operation-progress.test.mjs

Last changed by AI: 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · files: bin/cyc.mjs, scripts/runtime.mjs

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

### 2026-11-07 · run 5db3edd0-b55f-40eb-8438-8c43a40dcdbe · Correct asynchronous verification fixtures and local full-suite scheduling without changing public…
**Changed:** Asynchronous verification fixtures follow observed operation completion with bounded waits and all outcome assertions preserved. Complete local test discovery uses four file workers and a 30-minute cap. Prior exhausted/stopped runs and their failures remain preserved; public implementation is unchanged and native activation remains unverified.
**Learned:** Retain observed asynchronous fixture publication boundaries and local verification setup without promoting old timeouts, missing original bytes or unverified host observations.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 5db3edd0-b55f-40eb-8438-8c43a40dcdbe command receipts separately. Local receipts may not travel with source.
**Files:** test/operation-progress.test.mjs@sha256:7fbf41e10f6a4a94571af4e7c2144723b7c60742a674bf42924a8a9bdd4a6a4f

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
**Files:** bin/cyc.mjs@sha256:d835354d523f472396da60f46b89f2250196ea286108d2b5b1de4dda0bc3c9ca, scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, test/operation-progress.test.mjs@sha256:6db1bddbd829c37eb845af867afdf39deeca7defae69fb1932a8ca27ff1bb48a, scripts/run-worker.mjs@sha256:a8380c285f328b7d5ec3a08f1120ed1a6267deaa0adc8f07f4078c1ca9ea52da

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** bin/cyc.mjs@sha256:92a993d7e003, scripts/run-worker.mjs@sha256:a8380c285f32, scripts/runtime.mjs@sha256:8a136a426da4, test/operation-progress.test.mjs@sha256:f354e80382d0
