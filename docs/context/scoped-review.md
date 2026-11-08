# Scoped source-bound review

Covers: scripts/runtime.mjs, scripts/work-review.mjs, skills/cyc/SKILL.md, test/scoped-review.test.mjs

Last changed by AI: 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · files: scripts/runtime.mjs, skills/cyc/SKILL.md

## Current view

High-risk work retains an initial fresh-context review where the host supports it. captureReview records source, scope, criteria and dependency/contract context before dispatch; recordReview accepts actual evidence, findings and observed identity text or null. These are agent-reported provenance records, not independent identity or quality attestation.

Follow-up packets list changed paths, known contract-context changes and findings needing disposition. Unchanged scoped coverage can survive an unrelated edit only when reviewed paths, criteria and bounded dependency inputs remain unchanged. New/affected paths need new coverage. Static relative imports and declared context can bound a review; dynamic imports, unresolved aliases such as local #auth, or unknown dependency impact fall back to whole-source freshness.

The initial local-package-import handling assumed a lockfile made every bare import bounded, overlooking #auth's local target. The reviewer reproduced changed authorization behavior with a stale accepted review. Unknown # imports now conservatively use whole-source checks. Preserving an initial review plus an accurately described delta is different from claiming a fresh whole-candidate reread.

Prioritize demonstrated authoritative state transitions, conflicting representations and asynchronous actor/resource write responses before cosmetic issues. Preserve useful history/focus findings and every receipt-scoped disposition. Current feature-context authoring is also a judgment boundary; structural lint cannot decide whether the explanation is true.

Run node --test test/scoped-review.test.mjs test/work-review.test.mjs. The cases cover bounded composition, criteria/auth/dependency/file changes, unresolved import fallback and findings. Detailed agent exchanges and controller receipts may exist only in ignored local storage. Matching fingerprints or reviewer agreement do not establish product readiness, host activation or gains on unseen tasks.

First-task and consequence advice remains advisory and cannot waive existing high-risk challenge/fresh review, criteria or receipt freshness. The initial adoption review ef2ee414 found no demonstrated implementation defect in its bound source; source-only context reconciliation afterward is self-reviewed and is not a fresh review of every final byte. Original stopped scope, actual review limitations and unavailable native/user observations remain traceable.

The optional unified-task-context extension adds parent-owned read/ack and strict contribution reconciliation. Existing source/ownership/retention/proof requirements remain. Runtime binds current context revision/hash into handoffs and verification independently of source hashes; unknown economic advantage selects solo. Read-only host workers cannot complete a parent stage, alter parent limits or create permanent context records per worker. See docs/task-context.md and scripts/task-context.mjs/scripts/delegation.mjs for current contracts and host/usage limitations.

Automatic Codex execution is an additive parent-owned path: atomic assignment claim, correlated terminal cleanup after pause/stop, scoped text input and explicit lead reconciliation. It preserves existing source/proof/retention and dependent-context guards. Runtime diagnosis resolved the earlier live-generation blocker: host-provided CLI succeeds with the same account/model while stale PATH CLI fails. Runtime selection prefers the valid host hint. Actual generated source findings, explicit cancellation and one acknowledged merged context were observed; final source-bound checks are recorded separately.

Delegated token usage is reporting only; it cannot stop workers or refuse assignments. Old active shared views migrate with a new acknowledgment; terminal archives stay immutable. Scope, ownership, terminal cancellation and review/proof remain independently required.

Automatic semantic review checks returned worker claims against scoped source and preserves uncertainty as conflicts; it is separate from required fresh source review. Findings retain worker origins/evidence and judgment labels, not independent certification. Prior knowledge and negative evidence cannot be overwritten by a merge proposal. Review/source freshness and receipt-scoped findings continue to apply to this implementation.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Unknown dependency impact broadens required review; it never becomes unchanged coverage by ignoring a hash.

## History

### 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · Automatically decide whether a swarm is worthwhile, split independent work across agents in paralle…
**Changed:** Add automatic scoped swarm planning, atomic parallel dispatch and source-bound semantic reconciliation with safe cancellation/recovery.
**Learned:** Retain automatic decision/parallelism/one-context contracts and actual schema, publication and parent-handoff failures before final checks.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 318f64bc-134d-46b7-865e-6903d3d71494 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:a734cc7de3c9c2d0fcf36deef0c3a7de3eb6c73b5e07dc6444b30c5db6c0ff84, skills/cyc/SKILL.md@sha256:5c9c7c0bb7998344f6cf09bc2b0c50cfdcfd8d0bb06786adffad6f2d187e02bc

### 2026-11-08 · run 0e6acf48-127d-4257-9352-f3b20fbe1ee8 · Remove token caps from CYC delegation and preserve usage-only reporting, live completion, unified c…
**Changed:** Remove token-based admission/interruption; preserve usage, cancellation and one safely migrated shared task context.
**Learned:** User rejects forced token stops. Retain actual regression, migration and live qualification evidence.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 0e6acf48-127d-4257-9352-f3b20fbe1ee8 command receipts separately. Local receipts may not travel with source.
**Files:** skills/cyc/SKILL.md@sha256:094edb301c690351a38a63a38c99345792fdc3ed6b2e7be5d0008a8531637fcd

### 2026-11-07 · run be41a8ca-77fb-4e6c-8785-780005ec49a2 · Implement automatic bounded Codex worker dispatch, acknowledged cancellation and unified-context in…
**Changed:** Resolved stale CLI selection and verified actual generated findings, cancellation and one shared context.
**Learned:** Retain measured runtime diagnosis and real qualification before final source checks.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run be41a8ca-77fb-4e6c-8785-780005ec49a2 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:ef714a5ffc8866703fcbd23be812053712423e9e3127be729299527cc791b1dd, skills/cyc/SKILL.md@sha256:14b001b58ae584b393850f494c3ab73828ca32566e14a4d3bbf6264aa145c3ac

### 2026-11-07 · run 10e609d6-1319-41b5-b1a6-53e66bed9656 · Implement unified task context and bounded read-only delegation with parent-owned reconciliation an…
**Changed:** Implement unified task context and bounded read-only delegation while preserving legacy contracts.
**Learned:** One shared document per run, explicit reconciliation, conservative budgets, actual parent identity and no automatic model dispatch or measured savings claim.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 10e609d6-1319-41b5-b1a6-53e66bed9656 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:767c933c0579f20912005fb0045281ead3c9c2de1cfed3c7756288baa8c901ae, skills/cyc/SKILL.md@sha256:50438ee5ecd137bd81f4613ccb3d4223c1fc00b24f594617c4ddfef2c73626d0

### 2026-11-07 · run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 · Reconcile omitted canonical context owners and verify the final local adoption implementation witho…
**Changed:** Reconcile all10 affected canonical owners and index for the reviewed adoption changes; public code/tests remain unchanged.
**Learned:** Retain current shared contract implications, source bindings and explicit original-run/proof/live-validation limits.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 command receipts separately. Local receipts may not travel with source.
**Files:** skills/cyc/SKILL.md@sha256:06826cc1aa36588ac5e8756640fb9dcc4cbd7ef826d06f5495c4e9175612a958

### 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · Preserve POSIX and encoded file URL identities when associating Node load diagnostics with their te…
**Changed:** Repair Node importer diagnostic identity using fileURLToPath and native canonical paths, preserving containment and truthful module-load judgments. Encoded-path original and real 8.3-alias failures are retained; focused candidate completion checks pass 6/6, with full verification still required.
**Learned:** Retain actual Linux-only release failure, encoded-path reproduction and standard URL decoding under the existing scoped proof/completion contracts. Shared runtime owners retain their prior policies; local receipts and CI establish specific checks, not unseen model quality or hook activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 814322af-3707-43f5-af30-605e6a3d0c96 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:f41c01a0964fff0dadae49f5f12264e989e9e3a129ddbba828143b431ddb4d40

### 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · Enforce canonical indexed feature context during normal completion and repair current context/histo…
**Changed:** Require source-bound canonical feature retention before final checks; repair missing A-H feature records/mappings and actual historical evidence without rewriting completed receipts.
**Learned:** Default feature plans freeze target documentation scope, normal finish prepares authored knowledge, and relevant lint/discovery/source freshness block incomplete claims. Local fixtures expose mechanical guarantees; semantics, independent effectiveness and native activation remain unverified.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run a81789bf-63d2-4f61-8849-6395cd2c791c command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, scripts/work-review.mjs@sha256:bac64a95d90836ec39573ec74be3b9fb8b3903f56d5f55bb5f61ffc7a583145e, skills/cyc/SKILL.md@sha256:2e8476182e091afe72b1247343fe8bc5b426a42b4cf0ab628dbc1bbac55e3c3c, test/scoped-review.test.mjs@sha256:48b9007ebe9d36ac4c5aa7d04d961f40fa8deef30db6b14bd95a55a40e14f278

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** scripts/runtime.mjs@sha256:8a136a426da4, scripts/work-review.mjs@sha256:c6dd9f4e10bc, skills/cyc/SKILL.md@sha256:33112ab21b84, test/scoped-review.test.mjs@sha256:b18c02e6d4d0
