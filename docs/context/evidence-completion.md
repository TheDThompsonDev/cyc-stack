# Canonical completion and proof judgments

Covers: scripts/runtime.mjs, scripts/work-review.mjs, scripts/packet.mjs, test/completion-evidence.test.mjs, test/evidence-contract.test.mjs

Last changed by AI: 2026-11-06 · run 3ce340a0-2f40-4f23-b489-d37968319c71 · files: test/completion-evidence.test.mjs, test/evidence-contract.test.mjs

## Current view

Normal completion uses run finish with the generated exact-run input. It prepares required target feature context before final verification, records Build as needed, executes pending proof, requests only the needed judgment, runs broad checks, records Verify/Deliver and generates capability-appropriate delivery evidence. An incomplete context record or unavailable journey stays noncomplete. A packet cannot refresh changed covered source.

Canonical named scenario rows preserve each original criterion and material clause, configured command/receipt references, consumers and actual observations. Criterion/consumer/delivery views are derived only through exact mappings. Command success does not establish a named semantic assertion; these interpretations remain agent-reported. Captured review records supply receipt-scoped findings without manual transcription, and unresolved findings still block.

needs-proof-review returns failure IDs, observed errors, known boundaries or null, and a bounded continuation tied to source/tests/configuration/proof and execution inputs. A feature can demonstrate a missing interface; a bug fix still needs decisive existing behavior. Node missing-module and missing-export wrappers retain exact importer/file diagnostics. A generic test-file failure cannot be promoted to behavioral evidence. This supersedes earlier inference from a red suite alone.

Interrupted delivery can resume from confirmed handoff/evidence without repeating completed stages; native request windows remain enforced. CODEX_TOOL_CALL_ID is transport metadata: it is absent from child checks and compatibility keys. Its earlier inclusion rejected unchanged continuations across actual tool calls. Other environment and native identity inputs remain bound.

Run node --test test/completion-evidence.test.mjs test/evidence-contract.test.mjs test/finish.test.mjs. Local receipts under .cyc/runs identify exact measured bytes and agent judgments, but may be absent in a teammate copy. A controller pass, matching hash, agent review or self score does not independently certify correctness, user acceptance or host activation.

Node file-URL importer diagnostics use fileURLToPath and native realpath before project-relative containment and matching, preserving POSIX roots, escaped characters and Windows 8.3 aliases. Foreign roots reject before lookup; invalid/unavailable identities stay unknown. Actual encoded importer and short-path journeys in test/completion-evidence.test.mjs retain module boundaries, unrelated assertion identity and rejection of module-load failures mislabeled as behavioral proof. Release CI for v0.8.0 exposed a portability gap after local Windows checks passed; the failed tag is preserved. Fresh review independently reproduced an alias gap, without proving it was the exact remote CI cause.

When a Node check needs individual failure identities, declare --test-reporter=tap rather than relying on version-dependent presentation defaults. The proof/completion fixtures explicitly request TAP; their dot-reporter control still rejects unnamed output. Node24 publisher failures were reproduced as fixture protocol setup, with assertion bodies and suite scope unchanged. TAP/Jest/Mocha remain the supported parsed formats; Spec or other unsupported reports remain diagnostic and cannot establish named semantic coverage.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Separate missing interfaces, load/setup failures and behavioral assertions; stable process provenance is not product correctness.

## History

### 2026-11-06 · run 3ce340a0-2f40-4f23-b489-d37968319c71 · Declare the TAP protocol explicitly in proof fixtures so Node24 presentation defaults cannot invali…
**Changed:** Declare TAP explicitly in the isolated fixtures that require named proof output. Existing assertion bodies, suite scope, dot-output rejection and Node24 release gate are preserved. OfficialNode24 before failures and focused4/4 after results are retained; broad final verification is pending.
**Learned:** Retain the explicit TAP protocol prerequisite for named Node evidence, Node24 default presentation mismatch, and unchanged unknown-output boundaries. This is setup verification, not application defect proof or native activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 3ce340a0-2f40-4f23-b489-d37968319c71 command receipts separately. Local receipts may not travel with source.
**Files:** test/completion-evidence.test.mjs@sha256:e66f9305e9258575d043ffeb97179ffc37a5c79c29d1e8cf1fb66a7ba0883327, test/evidence-contract.test.mjs@sha256:b0191743365120aff1ac471bca6f1dd99bbc7e22571675e1db73da6e248ca2f2

### 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · Preserve POSIX and encoded file URL identities when associating Node load diagnostics with their te…
**Changed:** Repair Node importer diagnostic identity using fileURLToPath and native canonical paths, preserving containment and truthful module-load judgments. Encoded-path original and real 8.3-alias failures are retained; focused candidate completion checks pass 6/6, with full verification still required.
**Learned:** Retain actual Linux-only release failure, encoded-path reproduction and standard URL decoding under the existing scoped proof/completion contracts. Shared runtime owners retain their prior policies; local receipts and CI establish specific checks, not unseen model quality or hook activation.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run 814322af-3707-43f5-af30-605e6a3d0c96 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/runtime.mjs@sha256:f41c01a0964fff0dadae49f5f12264e989e9e3a129ddbba828143b431ddb4d40, test/completion-evidence.test.mjs@sha256:896eee9df3e8148b4cb83b98e8a593bd42ef2739edd464c797fa5ed63b23302c

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
