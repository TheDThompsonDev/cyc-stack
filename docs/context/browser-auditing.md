# External browser and accessibility recipes

Covers: scripts/browser-audit.mjs, scripts/project-tools.mjs, docs/project-tools.md, test/browser-recipe.test.mjs

Last changed by AI: 2026-11-07 · run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 · files: scripts/project-tools.mjs, docs/project-tools.md

## Current view

Browser auditing extends the target project's existing recipe mechanism. A recipe names prerequisites, viewport/state/action/outcome journeys and a supplied driver/scanner capability. scripts/browser-audit.mjs:runBrowserAudit uses the host's actual supported handles through explicit adapters; it does not guess APIs. project-tools:runRecipe retains a supplemental result, not a replacement for required command proof or final verification.

Inspect existing preview, CSS and build requirements before adding a harness. Supplementary accessibility scanning runs in a separate browser context, with dependencies/artifacts in a designated isolated scope. Never rewrite application layouts by string replacement to install audit instrumentation. The harness compares prerequisite bytes and closes contexts; missing capability/prerequisites or user interruption remain limited instead of becoming fabricated browser success.

Coverage is proportional: desktop/phone, keyboard and return focus, overflow, meaningful actions, reload, empty/error and membership-loss states when the changed flow needs them. Independent observations may batch only with known UI state and driver/host permission. Browser scanning cannot establish server authorization or complete accessibility.

Run node --test test/browser-recipe.test.mjs; in CYC development, its actual Playwright/axe harness lives under ignored .cyc/runtime/quality-efficiency/browser-harness and needs a usable local browser. It detects seeded missing button-name/return-focus defects in a disposable preview and checks their repair without changing prerequisite bytes. Missing harness dependencies skip or limit that local evidence; no production page, native host browser activation or human acceptance is inferred. Browser recipe discovery remains separate from canonical feature-context discovery.

The adoption extension adds path/goal match reasons and bounded recordEvidence beside unchanged records. This does not change browser recipe selection/execution, scanner prerequisites or required-check boundaries. Canonical byte freshness remains separate from semantic/browser evidence; context lint supplies Git inspection. The first frozen adoption scope omitted this shared owner; it remains stopped and this actual follow-up retains the reconciliation.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: A recipe is repeatable check machinery; it does not replace feature ownership, decisions or constraints.

## History

### 2026-11-07 · run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 · Reconcile omitted canonical context owners and verify the final local adoption implementation witho…
**Changed:** Reconcile all10 affected canonical owners and index for the reviewed adoption changes; public code/tests remain unchanged.
**Learned:** Retain current shared contract implications, source bindings and explicit original-run/proof/live-validation limits.
**Decisive check:** Planned commands: node --test --test-concurrency=4. Final outcomes are not yet claimed; inspect run 6938497e-dc8b-4f49-8c6c-e6fdb3a6ab42 command receipts separately. Local receipts may not travel with source.
**Files:** scripts/project-tools.mjs@sha256:4771d6f141934691b4e68ddccce1a24aa73db035b4d0358838ea4123dc802cf3, docs/project-tools.md@sha256:dd8af59fc0fe183feecfcb6db1ee6b4fdc83fb84e7e4b2fb76bf9de90fcf2efd

### 2026-11-06 · run a81789bf-63d2-4f61-8849-6395cd2c791c · Enforce canonical indexed feature context during normal completion and repair current context/histo…
**Changed:** Require source-bound canonical feature retention before final checks; repair missing A-H feature records/mappings and actual historical evidence without rewriting completed receipts.
**Learned:** Default feature plans freeze target documentation scope, normal finish prepares authored knowledge, and relevant lint/discovery/source freshness block incomplete claims. Local fixtures expose mechanical guarantees; semantics, independent effectiveness and native activation remain unverified.
**Decisive check:** Planned commands: node --test. Final outcomes are not yet claimed; inspect run a81789bf-63d2-4f61-8849-6395cd2c791c command receipts separately. Local receipts may not travel with source.
**Files:** docs/project-tools.md@sha256:d53778a10e000e64f54d0b43ce70ba62b9e3908f4100c9a23df126865e7ea312, scripts/project-tools.mjs@sha256:80e1ada2f09491bc89e65ab9112a416e0090fa737cf41c6fd10104ba44f19f57, scripts/browser-audit.mjs@sha256:8fc4fbad74993ce52f36046a79f253089848ca8774a8b333abcf9e79e1503e02, test/browser-recipe.test.mjs@sha256:0502d213c6b8a670dd1f5803b224586b9891c310f38b1e7f8b430bd609f16630

### 2026-11-05 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · Implement quality contracts and lower-friction, source-bound CYC completion and verification, prese…
**Changed:** Implemented A-H within the existing controller/recipe architecture. Known isolated behavioral/browser contracts and negative guards are exercised; model effectiveness, measured workflow savings and live native hook activation remain unverified. No release or external application edits.
**Learned:** Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification. FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit. Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence. Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
**Decisive check:** Reason-reviewed baseline evidence (agent-reported interpretation): behavioral cases [packet: a completed run finish writes this request's review packet, and the Stop gate accepts it with no cyc packet call; changed auth contract, added/del… Checks: tests passed (exit 0).
**Files:** docs/project-tools.md@sha256:af534ba0e6ee, scripts/browser-audit.mjs@sha256:8fc4fbad7499, scripts/project-tools.mjs@sha256:60e986eea2c7, test/browser-recipe.test.mjs@sha256:0502d213c6b8
