# Bounded worker progress and cancellation

Covers: scripts/run-worker.mjs, scripts/runtime.mjs, bin/cyc.mjs, test/operation-progress.test.mjs

Last changed by AI: 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · files: scripts/runtime.mjs

## Current view

Long finish/proof/verification work enters scripts/runtime.mjs:startOperation and scripts/run-worker.mjs:executeOperation. The worker owns existing controller transactions and persistence; it does not launch model agents. run wait with the returned exact run/operation IDs waits up to60000ms and reports phase, check, elapsed time, latest actual output, last-output time and disk logs. operationComplete differs from workflow finished. Silence is represented as silence, not fabricated advancement.

runCheckProcess isolates each check and bounds output storage. It distinguishes timeout, check-runner crash, controller loss and intentional cancellation. controlRun(stop) records an owned cancellation request without waiting for the check lock; the helper stops the process tree and later checks are skipped. An original-source proof restores candidate bytes before acknowledging stopped. Genuine source conflicts retain halted recovery and backups instead. Multi-step preparation/check work is not an atomic filesystem transaction.

The original public stop path needed the same lock held by the worker and could not cancel it. Another failure was in verification fixtures: assuming every process starts within one second made full-suite load look like missing progress. The tests now observe bounded output and hold work until explicit release/stop, preserving phase/log/receipt and restoration assertions.

Run node --test test/operation-progress.test.mjs. A separate scoped harness delayed actual workers1500ms and the four progress cases passed; this is local scheduling evidence, not a guarantee about every OS kill race or live user interruption. Preserve ownership/backup records on forced termination and use run recover. Normal progress never requires reading lock files. Required feature context may return needs-context before any command starts; that is not a passed check.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Synchronize verification with actual observable state; stop requests are acknowledged only after safe unwinding.

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
**Files:** bin/cyc.mjs@sha256:d835354d523f472396da60f46b89f2250196ea286108d2b5b1de4dda0bc3c9ca, scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, test/operation-progress.test.mjs@sha256:6db1bddbd829c37eb845af867afdf39deeca7defae69fb1932a8ca27ff1bb48a, scripts/run-worker.mjs@sha256:a8380c285f328b7d5ec3a08f1120ed1a6267deaa0adc8f07f4078c1ca9ea52da

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** bin/cyc.mjs@sha256:92a993d7e003, scripts/run-worker.mjs@sha256:a8380c285f32, scripts/runtime.mjs@sha256:8a136a426da4, test/operation-progress.test.mjs@sha256:f354e80382d0
