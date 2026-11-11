# Scoped source-bound review

Covers: scripts/runtime.mjs, scripts/work-review.mjs, skills/cyc/SKILL.md, test/scoped-review.test.mjs

## Current view

High-risk work retains an initial fresh-context review where the host supports it. captureReview records source, scope, criteria and dependency/contract context before dispatch; recordReview accepts actual evidence, findings and observed identity text or null. These are agent-reported provenance records, not independent identity or quality attestation.

Follow-up packets list changed paths, known contract-context changes and findings needing disposition. Unchanged scoped coverage can survive an unrelated edit only when reviewed paths, criteria and bounded dependency inputs remain unchanged. New/affected paths need new coverage. Static relative imports and declared context can bound a review; dynamic imports, unresolved aliases such as local #auth, or unknown dependency impact fall back to whole-source freshness.

The initial local-package-import handling assumed a lockfile made every bare import bounded, overlooking #auth's local target. The reviewer reproduced changed authorization behavior with a stale accepted review. Unknown # imports now conservatively use whole-source checks. Preserving an initial review plus an accurately described delta is different from claiming a fresh whole-candidate reread.

Prioritize demonstrated authoritative state transitions, conflicting representations and asynchronous actor/resource write responses before cosmetic issues. Preserve useful history/focus findings and every receipt-scoped disposition. Current feature-context authoring is also a judgment boundary; structural lint cannot decide whether the explanation is true.

Run node --test test/scoped-review.test.mjs test/work-review.test.mjs. The cases cover bounded composition, criteria/auth/dependency/file changes, unresolved import fallback and findings. Detailed agent exchanges and controller receipts may exist only in ignored local storage. Matching fingerprints or reviewer agreement do not establish product readiness, host activation or gains on unseen tasks.

First-task and consequence advice remains advisory and cannot waive existing high-risk challenge/fresh review, criteria or receipt freshness. The initial adoption review ef2ee414 found no demonstrated implementation defect in its bound source; source-only context reconciliation afterward is self-reviewed and is not a fresh review of every final byte. Original stopped scope, actual review limitations and unavailable native/user observations remain traceable.

The optional unified-task-context extension adds parent-owned read/ack and strict contribution reconciliation. Existing source/ownership/retention/proof requirements remain. Runtime binds current context revision/hash into handoffs and verification independently of source hashes; unknown economic advantage selects solo. Read-only host workers cannot complete a parent stage, alter parent limits or create permanent context records per worker. See docs/task-context.md and scripts/task-context.mjs/scripts/delegation.mjs for current contracts and host/usage limitations.

Automatic Codex execution is an additive parent-owned path: atomic assignment claim, correlated terminal cleanup after pause/stop, scoped text input and explicit lead reconciliation. It preserves existing source/proof/retention and dependent-context guards. Runtime diagnosis resolved the earlier live-generation blocker: host-provided CLI succeeds with the same account/model while stale PATH CLI fails. Runtime selection prefers the valid host hint. Actual generated source findings, explicit cancellation and one acknowledged merged context were observed; final source-bound checks are recorded separately.

Delegated token usage is reporting only; it cannot stop workers or refuse assignments. Old active shared views migrate with a new acknowledgment; terminal archives stay immutable. Scope, ownership, terminal cancellation and review/proof remain independently required.

Automatic semantic review checks returned worker claims against scoped source and preserves uncertainty as conflicts; it is separate from required fresh source review. Findings retain worker origins/evidence and judgment labels, not independent certification. Prior knowledge and negative evidence cannot be overwritten by a merge proposal. Review/source freshness and receipt-scoped findings continue to apply to this implementation.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Unknown dependency impact broadens required review; it never becomes unchanged coverage by ignoring a hash.
