# Canonical completion and proof judgments

Covers: scripts/runtime.mjs, scripts/work-review.mjs, scripts/packet.mjs, test/completion-evidence.test.mjs, test/evidence-contract.test.mjs

Last changed by AI: 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · files: scripts/runtime.mjs, scripts/work-review.mjs, test/completion-evidence.test.mjs, test/evidence-contract.test.mjs

## Current view

Normal completion uses run finish with the generated exact-run input. It prepares required target feature context before final verification, records Build as needed, executes pending proof, requests only the needed judgment, runs broad checks, records Verify/Deliver and generates capability-appropriate delivery evidence. An incomplete context record or unavailable journey stays noncomplete. A packet cannot refresh changed covered source.

Canonical named scenario rows preserve each original criterion and material clause, configured command/receipt references, consumers and actual observations. Criterion/consumer/delivery views are derived only through exact mappings. Command success does not establish a named semantic assertion; these interpretations remain agent-reported. Captured review records supply receipt-scoped findings without manual transcription, and unresolved findings still block.

needs-proof-review returns failure IDs, observed errors, known boundaries or null, and a bounded continuation tied to source/tests/configuration/proof and execution inputs. A feature can demonstrate a missing interface; a bug fix still needs decisive existing behavior. Node missing-module and missing-export wrappers retain exact importer/file diagnostics. A generic test-file failure cannot be promoted to behavioral evidence. This supersedes earlier inference from a red suite alone.

Interrupted delivery can resume from confirmed handoff/evidence without repeating completed stages; native request windows remain enforced. CODEX_TOOL_CALL_ID is transport metadata: it is absent from child checks and compatibility keys. Its earlier inclusion rejected unchanged continuations across actual tool calls. Other environment and native identity inputs remain bound.

Run node --test test/completion-evidence.test.mjs test/evidence-contract.test.mjs test/finish.test.mjs. Local receipts under .cyc/runs identify exact measured bytes and agent judgments, but may be absent in a teammate copy. A controller pass, matching hash, agent review or self score does not independently certify correctness, user acceptance or host activation.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Separate missing interfaces, load/setup failures and behavioral assertions; stable process provenance is not product correctness.

## History

### 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · Enforce canonical indexed feature context during normal completion and repair current context/histo…
**Changed:** Require source-bound canonical feature retention before final checks; repair missing A-H feature records/mappings and actual historical evidence without rewriting completed receipts.
**Learned:** Default feature plans freeze target documentation scope, normal finish prepares authored knowledge, and relevant lint/discovery/source freshness block incomplete claims. Local fixtures expose mechanical guarantees; semantics, independent effectiveness and native activation remain unverified.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run a81789bf-63d2-4f61-8849-6395cd2c791c command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, scripts/work-review.mjs@sha256:bac64a95d90836ec39573ec74be3b9fb8b3903f56d5f55bb5f61ffc7a583145e, test/completion-evidence.test.mjs@sha256:7a709f278f8581a745f50c4cc2d185f504f7a948a45518c282ffc0d5f5e916cc, test/evidence-contract.test.mjs@sha256:ec615f826f68335cf86716c0e05311537a6de6494ffc62eeaa8dedd3e7bf2726

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** scripts/packet.mjs@sha256:a1de9ec0fe4a, scripts/runtime.mjs@sha256:8a136a426da4, scripts/work-review.mjs@sha256:c6dd9f4e10bc, test/completion-evidence.test.mjs@sha256:06ffcb0dff1d
