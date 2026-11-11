# External browser and accessibility recipes

Covers: scripts/browser-audit.mjs, scripts/project-tools.mjs, docs/project-tools.md, test/browser-recipe.test.mjs

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
