# Scoped source-bound review

Covers: scripts/runtime.mjs, scripts/work-review.mjs, skills/cyc/SKILL.md, test/scoped-review.test.mjs

Last changed by AI: 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · files: scripts/runtime.mjs, scripts/work-review.mjs, skills/cyc/SKILL.md, test/scoped-review.test.mjs

## Current view

High-risk work retains an initial fresh-context review where the host supports it. captureReview records source, scope, criteria and dependency/contract context before dispatch; recordReview accepts actual evidence, findings and observed identity text or null. These are agent-reported provenance records, not independent identity or quality attestation.

Follow-up packets list changed paths, known contract-context changes and findings needing disposition. Unchanged scoped coverage can survive an unrelated edit only when reviewed paths, criteria and bounded dependency inputs remain unchanged. New/affected paths need new coverage. Static relative imports and declared context can bound a review; dynamic imports, unresolved aliases such as local #auth, or unknown dependency impact fall back to whole-source freshness.

The initial local-package-import handling assumed a lockfile made every bare import bounded, overlooking #auth's local target. The reviewer reproduced changed authorization behavior with a stale accepted review. Unknown # imports now conservatively use whole-source checks. Preserving an initial review plus an accurately described delta is different from claiming a fresh whole-candidate reread.

Prioritize demonstrated authoritative state transitions, conflicting representations and asynchronous actor/resource write responses before cosmetic issues. Preserve useful history/focus findings and every receipt-scoped disposition. Current feature-context authoring is also a judgment boundary; structural lint cannot decide whether the explanation is true.

Run node --test test/scoped-review.test.mjs test/work-review.test.mjs. The cases cover bounded composition, criteria/auth/dependency/file changes, unresolved import fallback and findings. Detailed agent exchanges and controller receipts may exist only in ignored local storage. Matching fingerprints or reviewer agreement do not establish product readiness, host activation or gains on unseen tasks.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Unknown dependency impact broadens required review; it never becomes unchanged coverage by ignoring a hash.

## History

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
