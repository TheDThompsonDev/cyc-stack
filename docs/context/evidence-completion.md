# Canonical completion and proof judgments

Covers: scripts/runtime.mjs, scripts/work-review.mjs, scripts/packet.mjs, test/completion-evidence.test.mjs, test/evidence-contract.test.mjs

## Current view

Normal completion uses run finish with the generated exact-run input. It prepares required target feature context before final verification, records Build as needed, executes pending proof, requests only the needed judgment, runs broad checks, records Verify/Deliver and generates capability-appropriate delivery evidence. An incomplete context record or unavailable journey stays noncomplete. A packet cannot refresh changed covered source.

Canonical named scenario rows preserve each original criterion and material clause, configured command/receipt references, consumers and actual observations. Criterion/consumer/delivery views are derived only through exact mappings. Command success does not establish a named semantic assertion; these interpretations remain agent-reported. Captured review records supply receipt-scoped findings without manual transcription, and unresolved findings still block.

needs-proof-review returns failure IDs, observed errors, known boundaries or null, and a bounded continuation tied to source/tests/configuration/proof and execution inputs. A feature can demonstrate a missing interface; a bug fix still needs decisive existing behavior. Node missing-module and missing-export wrappers retain exact importer/file diagnostics. A generic test-file failure cannot be promoted to behavioral evidence. This supersedes earlier inference from a red suite alone.

Interrupted delivery can resume from confirmed handoff/evidence without repeating completed stages; native request windows remain enforced. CODEX_TOOL_CALL_ID is transport metadata: it is absent from child checks and compatibility keys. Its earlier inclusion rejected unchanged continuations across actual tool calls. Other environment and native identity inputs remain bound.

Run node --test test/completion-evidence.test.mjs test/evidence-contract.test.mjs test/finish.test.mjs. Local receipts under .cyc/runs identify exact measured bytes and agent judgments, but may be absent in a teammate copy. A controller pass, matching hash, agent review or self score does not independently certify correctness, user acceptance or host activation.

Node file-URL importer diagnostics use fileURLToPath and native realpath before project-relative containment and matching, preserving POSIX roots, escaped characters and Windows 8.3 aliases. Foreign roots reject before lookup; invalid/unavailable identities stay unknown. Actual encoded importer and short-path journeys in test/completion-evidence.test.mjs retain module boundaries, unrelated assertion identity and rejection of module-load failures mislabeled as behavioral proof. Release CI for v0.8.0 exposed a portability gap after local Windows checks passed; the failed tag is preserved. Fresh review independently reproduced an alias gap, without proving it was the exact remote CI cause.

When a Node check needs individual failure identities, declare --test-reporter=tap rather than relying on version-dependent presentation defaults. The proof/completion fixtures explicitly request TAP; their dot-reporter control still rejects unnamed output. Node24 publisher failures were reproduced as fixture protocol setup, with assertion bodies and suite scope unchanged. TAP/Jest/Mocha remain the supported parsed formats; Spec or other unsupported reports remain diagnostic and cannot establish named semantic coverage.

The optional unified-task-context extension adds parent-owned read/ack and strict contribution reconciliation. Existing source/ownership/retention/proof requirements remain. Runtime binds current context revision/hash into handoffs and verification independently of source hashes; unknown economic advantage selects solo. Read-only host workers cannot complete a parent stage, reset budgets or create permanent context records per worker. See docs/task-context.md and scripts/task-context.mjs/scripts/delegation.mjs for current contracts and host/usage limitations.

Automatic Codex execution is an additive parent-owned path: atomic assignment claim, correlated terminal cleanup after pause/stop, scoped text input and explicit lead reconciliation. It preserves existing source/proof/retention and dependent-context guards. Runtime diagnosis resolved the earlier live-generation blocker: host-provided CLI succeeds with the same account/model while stale PATH CLI fails. Runtime selection prefers the valid host hint. Actual generated source findings, explicit cancellation and one acknowledged merged context were observed; final source-bound checks are recorded separately.

Parent readiness now includes active/planned automatic phases before any worker assignment exists. Their model results never pass a parent stage or replace criterion evidence/check receipts. Merge commit records its context hash/revision; failed final acknowledgment reports committed work with pending local read/ack rather than a new failed generation. Nonrunning parent status remains authoritative.

Completion also publishes the run's change record (publishRunChange in scripts/runtime.mjs) after the complete event, with the observed check results. The record is outside the source snapshot, so the delivery source hash, the artifacts and the review packet are unaffected; a failed write is stored as changeRecord.error and retried by the next finish without undoing completion. Finish returns changeRecord and review.md prints its path.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Separate missing interfaces, load/setup failures and behavioral assertions; stable process provenance is not product correctness.
