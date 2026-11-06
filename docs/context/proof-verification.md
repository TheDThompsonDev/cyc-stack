# Focused proof and broad verification

Covers: scripts/runtime.mjs, scripts/test-output.mjs, test/proof-plan.test.mjs, test/prove-red.test.mjs, test/runtime-adversarial.test.mjs

Last changed by AI: 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · files: scripts/runtime.mjs

## Current view

startRun can freeze proofCommands for decisive regression/feature checks. The --tests option selects which test files are swapped and does not narrow the command plan. proveRun applies exact recorded originals, retains new tests, measures diagnostic red/green behavior and restores owned candidate bytes. Original-only, original-plus-new-tests and candidate receipts are distinct roles and cannot replace one another.

Candidate verification retains the full configured broad plan. Accepting a pre-existing broad failure needs compatible measured original broad evidence; a focused proof cannot excuse a changed/new broad failure. Existing baseline-cache storage is reused rather than adding another cache. Untouched focused treatment may be retained when compatible broad originals must be measured for a failure decision.

Receipt reuse is opt-in for declared local-deterministic checks. Inputs bind source/tests, commands, config, selected dependencies, environment and toolchain; unknown/linked/unbounded dependencies disable reuse. External or freshness-dependent checks do not silently reuse a local result. Actual CODEX tool-call transport metadata is removed from checks as well as fingerprints, while relevant environment changes and later context edits invalidate dependent evidence.

Source swaps publish candidate backups and owner records before changing files. Unexpected concurrent edits, invalid originals or incomplete restoration preserve recovery evidence and halt instead of overwriting unknown bytes. External editors remain outside controller locks; the workflow is coordination, not attestation or an atomic compare-and-swap.

Run node --test test/proof-plan.test.mjs test/prove-red.test.mjs test/runtime-adversarial.test.mjs. Use a focused plan at start; final broad verification is still required. The audit observed distinct original/proof/candidate states, not a demonstrated duplicate-final-run bug. No request/time savings or unseen-model improvement has been measured. Local receipts are revision-specific and are not guaranteed to travel with source.

Node file-URL importer diagnostics use fileURLToPath and native realpath before project-relative containment and matching, preserving POSIX roots, escaped characters and Windows 8.3 aliases. Foreign roots reject before lookup; invalid/unavailable identities stay unknown. Actual encoded importer and short-path journeys in test/completion-evidence.test.mjs retain module boundaries, unrelated assertion identity and rejection of module-load failures mislabeled as behavioral proof. Release CI for v0.8.0 exposed a portability gap after local Windows checks passed; the failed tag is preserved. Fresh review independently reproduced an alias gap, without proving it was the exact remote CI cause.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Keep measured states role-distinct, and bound reuse by actual inputs rather than a successful stage.

## History

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
