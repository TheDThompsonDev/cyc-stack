# Focused proof and broad verification

Covers: scripts/runtime.mjs, scripts/test-output.mjs, test/proof-plan.test.mjs, test/prove-red.test.mjs, test/runtime-adversarial.test.mjs, test/cost-cuts.test.mjs, test/finish-runners.test.mjs

Last changed by AI: 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · files: scripts/runtime.mjs

## Current view

startRun can freeze proofCommands for decisive regression/feature checks. The --tests option selects which test files are swapped and does not narrow the command plan. proveRun applies exact recorded originals, retains new tests, measures diagnostic red/green behavior and restores owned candidate bytes. Original-only, original-plus-new-tests and candidate receipts are distinct roles and cannot replace one another.

Candidate verification retains the full configured broad plan. Accepting a pre-existing broad failure needs compatible measured original broad evidence; a focused proof cannot excuse a changed/new broad failure. Existing baseline-cache storage is reused rather than adding another cache. Untouched focused treatment may be retained when compatible broad originals must be measured for a failure decision.

Receipt reuse is opt-in for declared local-deterministic checks. Inputs bind source/tests, commands, config, selected dependencies, environment and toolchain; unknown/linked/unbounded dependencies disable reuse. External or freshness-dependent checks do not silently reuse a local result. Actual CODEX tool-call transport metadata is removed from checks as well as fingerprints, while relevant environment changes and later context edits invalidate dependent evidence.

Source swaps publish candidate backups and owner records before changing files. Unexpected concurrent edits, invalid originals or incomplete restoration preserve recovery evidence and halt instead of overwriting unknown bytes. External editors remain outside controller locks; the workflow is coordination, not attestation or an atomic compare-and-swap.

Run node --test test/proof-plan.test.mjs test/prove-red.test.mjs test/runtime-adversarial.test.mjs. Use a focused plan at start; final broad verification is still required. The audit observed distinct original/proof/candidate states, not a demonstrated duplicate-final-run bug. No request/time savings or unseen-model improvement has been measured. Local receipts are revision-specific and are not guaranteed to travel with source.

Node file-URL importer diagnostics use fileURLToPath and native realpath before project-relative containment and matching, preserving POSIX roots, escaped characters and Windows 8.3 aliases. Foreign roots reject before lookup; invalid/unavailable identities stay unknown. Actual encoded importer and short-path journeys in test/completion-evidence.test.mjs retain module boundaries, unrelated assertion identity and rejection of module-load failures mislabeled as behavioral proof. Release CI for v0.8.0 exposed a portability gap after local Windows checks passed; the failed tag is preserved. Fresh review independently reproduced an alias gap, without proving it was the exact remote CI cause.

When a Node check needs individual failure identities, declare --test-reporter=tap rather than relying on version-dependent presentation defaults. The proof/completion fixtures explicitly request TAP; their dot-reporter control still rejects unnamed output. Node24 publisher failures were reproduced as fixture protocol setup, with assertion bodies and suite scope unchanged. TAP/Jest/Mocha remain the supported parsed formats; Spec or other unsupported reports remain diagnostic and cannot establish named semantic coverage.

The optional unified-task-context extension adds parent-owned read/ack and strict contribution reconciliation. Existing source/ownership/retention/proof requirements remain. Runtime binds current context revision/hash into handoffs and verification independently of source hashes; unknown economic advantage selects solo. Read-only host workers cannot complete a parent stage, reset budgets or create permanent context records per worker. See docs/task-context.md and scripts/task-context.mjs/scripts/delegation.mjs for current contracts and host/usage limitations.

Original-byte recovery additionally checks a Git-derived variant with only the final newline converted to CRLF. It is accepted only when the full SHA-256 equals the frozen initial source hash. This repairs a real mixed-final-newline proof refusal without normalizing equality, editing captures or weakening original-source proof. test/delegation-journey.test.mjs reproduces refusal before repair and verifies candidate-byte restoration after proof.

Automatic Codex execution is an additive parent-owned path: atomic assignment claim, correlated terminal cleanup after pause/stop, scoped text input and explicit lead reconciliation. It preserves existing source/proof/retention and dependent-context guards. Runtime diagnosis resolved the earlier live-generation blocker: host-provided CLI succeeds with the same account/model while stale PATH CLI fails. Runtime selection prefers the valid host hint. Actual generated source findings, explicit cancellation and one acknowledged merged context were observed; final source-bound checks are recorded separately.

Active planning/planned/work phases block parent proof/check handoffs, including the initial no-worker planner window. Internal claims use explicit state guards and never certify criteria. Source/context/result-set bindings protect automatic proposals independently of source proof. Semantic model review and parallel success cannot waive original-code proof, retained feature knowledge or configured broad verification.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Keep measured states role-distinct, and bound reuse by actual inputs rather than a successful stage.

## History

### 2026-11-08 · run 318f64bc-134d-46b7-865e-6903d3d71494 · Automatically decide whether a swarm is worthwhile, split independent work across agents in paralle…
**Changed:** Add automatic scoped swarm planning, atomic parallel dispatch and source-bound semantic reconciliation with safe cancellation/recovery.
**Learned:** Retain automatic decision/parallelism/one-context contracts and actual schema, publication and parent-handoff failures before final checks.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 318f64bc-134d-46b7-865e-6903d3d71494 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:a734cc7de3c9c2d0fcf36deef0c3a7de3eb6c73b5e07dc6444b30c5db6c0ff84

### 2026-11-07 · run be41a8ca-77fb-4e6c-8785-780005ec49a2 · Implement automatic bounded Codex worker dispatch, acknowledged cancellation and unified-context in…
**Changed:** Resolved stale CLI selection and verified actual generated findings, cancellation and one shared context.
**Learned:** Retain measured runtime diagnosis and real qualification before final source checks.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run be41a8ca-77fb-4e6c-8785-780005ec49a2 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:ef714a5ffc8866703fcbd23be812053712423e9e3127be729299527cc791b1dd

### 2026-11-07 · run 10e609d6-1319-41b5-b1a6-53e66bed9656 · Implement unified task context and bounded read-only delegation with parent-owned reconciliation an…
**Changed:** Implement unified task context and bounded read-only delegation while preserving legacy contracts.
**Learned:** One shared document per run, explicit reconciliation, conservative budgets, actual parent identity and no automatic model dispatch or measured savings claim.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 10e609d6-1319-41b5-b1a6-53e66bed9656 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:767c933c0579f20912005fb0045281ead3c9c2de1cfed3c7756288baa8c901ae

### 2026-11-06 · run 3ce340a0-2f40-4f23-b489-d37968319c71 · Declare the TAP protocol explicitly in proof fixtures so Node24 presentation defaults cannot invali…
**Changed:** Declare TAP explicitly in the isolated fixtures that require named proof output. Existing assertion bodies, suite scope, dot-output rejection and Node24 release gate are preserved. OfficialNode24 before failures and focused4/4 after results are retained; broad final verification is pending.
**Learned:** Retain the explicit TAP protocol prerequisite for named Node evidence, Node24 default presentation mismatch, and unchanged unknown-output boundaries. This is setup verification, not application defect proof or native activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 3ce340a0-2f40-4f23-b489-d37968319c71 command receipts separately. Local receipts may not travel with source.
**Files:** test/cost-cuts.test.mjs@sha256:64c70bc2865060f815df157dbe6febf4bf90b3fbf922d71e00cece4d3cfe018b, test/finish-runners.test.mjs@sha256:6202a1ac7f5dab4531f7b47cf5f50466ab697756eea42b60782469635bf4a594, test/proof-plan.test.mjs@sha256:5e4fafa002ffbc3c51fa524878c26791d52093c2a5b12ea65a6fdd00a69e7842, test/prove-red.test.mjs@sha256:41f61d0276dedfe0fd4c7bcdb4822053e52713b9f5578e360d0b1d5143f0d8af

### 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · Preserve POSIX and encoded file URL identities when associating Node load diagnostics with their te…
**Changed:** Repair Node importer diagnostic identity using fileURLToPath and native canonical paths, preserving containment and truthful module-load judgments. Encoded-path original and real 8.3-alias failures are retained; focused candidate completion checks pass 6/6, with full verification still required.
**Learned:** Retain actual Linux-only release failure, encoded-path reproduction and standard URL decoding under the existing scoped proof/completion contracts. Shared runtime owners retain their prior policies; local receipts and CI establish specific checks, not unseen model quality or hook activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 814322af-3707-43f5-af30-605e6a3d0c96 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:f41c01a0964fff0dadae49f5f12264e989e9e3a129ddbba828143b431ddb4d40

### 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · Enforce canonical indexed feature context during normal completion and repair current context/histo…
**Changed:** Require source-bound canonical feature retention before final checks; repair missing A-H feature records/mappings and actual historical evidence without rewriting completed receipts.
**Learned:** Default feature plans freeze target documentation scope, normal finish prepares authored knowledge, and relevant lint/discovery/source freshness block incomplete claims. Local fixtures expose mechanical guarantees; semantics, independent effectiveness and native activation remain unverified.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run a81789bf-63d2-4f61-8849-6395cd2c791c command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, test/proof-plan.test.mjs@sha256:744889964297b3a07082439a913b3d005b4ad5489a9062712fb4a54235f1cefd, test/prove-red.test.mjs@sha256:26a9a0fa983df23aeb6e5e37f3d4b36c1be3e4e0263c307340ebe889a4e78607, test/runtime-adversarial.test.mjs@sha256:6ad4a9d9be49c5685298d13559e6c8c4ae91ed02da1993e714f7ed471755c7f2

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** scripts/runtime.mjs@sha256:8a136a426da4, test/proof-plan.test.mjs@sha256:8be1f504d141
