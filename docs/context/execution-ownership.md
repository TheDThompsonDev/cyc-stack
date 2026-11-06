# Execution capability and conversation ownership

Covers: scripts/execution.mjs, scripts/packet.mjs, scripts/runtime.mjs, bin/cyc.mjs, test/workflow-ergonomics.test.mjs

Last changed by AI: 2026-11-06 · run 814322af-3707-43f5-af30-605e6a3d0c96 · files: scripts/runtime.mjs

## Current view

A controller execution has an explicit capability: native-codex, native-claude, cursor or intentionally requested standalone. scripts/execution.mjs:resolveExecution separates the real host conversation, a workflow label and the controller run ID. A label's shape does not select Cursor. Runtime assertRunOwner binds the recorded conversation and native gate to the actual caller, including gate-only starts; no-hook or foreign callers cannot borrow the target's stored label to resolve its owner.

The entrypoints are run start, packet/check-reply, and runtime mutations. Native modes require observed context and cannot be downgraded to standalone while a native request is active. Native delivery still checks tokens, request windows, source freshness and exact responses where required. Cursor needs an explicit exact-response packet. Standalone completion writes local delivery evidence without certifying host activation; hexadecimal conversation IDs remain standalone on resume.

artifactFiles preflights regular files inside the target root before publication; directories are not expanded and a failed preflight preserves the previous packet. The initial gate-only owner repair still accepted a named caller without state; the final resolver uses the actual caller without the stored target fallback. That failure and the hexadecimal resume mistake are retained as regression cases.

Run node --test test/workflow-ergonomics.test.mjs and the existing packet/response-gate tests. These exercise simulated native states, foreign/downgrade rejection, templates and packet preflight. They do not prove that a real host loaded hooks. The prior A-H run reported557 passes and2 skips for its own revision; current follow-up receipts are local-only and must not be substituted for rechecking changed code.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Bind the actual caller and explicit capability; neither session shape nor target-side state is authorization.

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
**Files:** bin/cyc.mjs@sha256:d835354d523f472396da60f46b89f2250196ea286108d2b5b1de4dda0bc3c9ca, scripts/runtime.mjs@sha256:1b3c83bfe0f8f2eb7baae96bccd6e2160062388c15b14d5c07dd9c0d8cf6eaf0, test/workflow-ergonomics.test.mjs@sha256:b8e1f187e5b506e6c6d8da0f914d5a57d580e60dc3ce6d7a660cbfb2ded86889, scripts/execution.mjs@sha256:8d7e43dc4b0be30d75d7e39f6dfa22967a28a4cf7c249ca65c6546bf472c6a59, scripts/packet.mjs@sha256:a1de9ec0fe4a429f66ff4c2bcf2c5095ab5d3e0fe97f5f5a72d4d7cb01fb9b48

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** bin/cyc.mjs@sha256:92a993d7e003, scripts/execution.mjs@sha256:8d7e43dc4b0b, scripts/packet.mjs@sha256:a1de9ec0fe4a, scripts/runtime.mjs@sha256:8a136a426da4, test/workflow-ergonomics.test.mjs@sha256:3252946a3a71
