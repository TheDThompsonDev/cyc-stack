# Focused proof and broad verification

Covers: scripts/runtime.mjs, scripts/test-output.mjs, test/proof-plan.test.mjs, test/prove-red.test.mjs, test/runtime-adversarial.test.mjs, test/cost-cuts.test.mjs, test/finish-runners.test.mjs

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
