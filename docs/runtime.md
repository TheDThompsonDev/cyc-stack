# CYC execution controller

The controller validates handoffs/checks and optionally dispatches bounded Codex workers. It authorizes no publication. Scout → Build → Verify → Deliver is the implementation route; other routes use [playbooks](../catalog/playbooks.json). Evidence establishes what was checked.

## Start and authority

Use node bin/cyc.mjs here or node .cyc/engine/bin/cyc.mjs installed. Save inputs under .cyc/runtime; run start --file START.json records goal, criteria/clauses, literal scope, identity and contextRetention before freezing. Confirm inferred criteria/owners before start.

evidenceVersion:1 requires original requirements/criteria; reviewPolicy is self-allowed/fresh-required. Follow exact generated IDs/templates and [assessment](work-assessments.md)/[handoff](skill-contract.md) fields.

<a id="execution-capabilities-and-progress"></a>

executionMode is native-codex/native-claude/cursor or authorized standalone. Conversation, workflow session and run IDs differ. Native modes need actual hook context; no downgrade or label-shape inference. Legacy limits remain; standalone delivery is local and does not establish activation.

Literal project paths, config/protection and scope freeze at start. Wildcard expansion and escaped paths reject; literal existing names/bracketed routes remain valid. Scope is not OS isolation. Prefer forward slashes; unknown/mixed inputs reject.

## Move through the recorded stages

Bind --run ID. next/status inspect; record submits a handoff; finish orchestrates context/proof/checks/delivery. prove-red/verify preserve prerequisites. review-capture precedes dispatch and review-record records observations. retry/recover/pause/resume preserve budgets. stop is cancellation; complete requires every completion condition.

Use --wait-ms 30000 for long checks and run wait with the returned operation ID. Silence/operation completion is not workflow success. Honor interruption and restoration acknowledgment.

Verify/Deliver needs criterion evidence: --criteria-passed for one or --criterion-evidence for multiple. Worker/model reports cannot replace configured checks, original proof or semantic review.

## Context and delegation

Plan focused feature/shared records and index before Build. Author learning.context or planned docs through context prepare/finish before checks. Missing/restricted/stale knowledge stays needs-context; support files do not substitute. Completion publishes the run's change record, which is history and not verified source. [Context](context.md) defines retention.

Optional [task context/delegation](task-context.md) provides one parent document and read-only assignments. Auto swarm plans, decides, fans out concurrently and reviews/merges via parent transactions; solo and unresolved conflicts remain explicit. Manual execute/reconcile stays available. Handoffs/checks bind revision/hash separately from source. Token usage is reporting only.

## Checks, proof and recovery

Configure meaningful executable/argv checks before start. No shell interpolation or no-op substitutes. Checks must leave source stable. Onboard diagnostics are not final evidence. Check timeout defaults to 30 minutes; maxDurationMs is separate. Full logs, not tails alone, establish failure equivalence.

Failed attempts share maxAttempts (default 3) and maxNoProgress (default 2); recovery never resets them. Baselines default off. Reuse requires explicitly bounded local-deterministic inputs covering source, config, dependencies, environment and toolchain; CODEX_TOOL_CALL_ID is excluded. Unknown inputs rerun.

Proof separates original control, originals with new tests and candidate. Features may prove a missing interface; bugs need existing behavior. Only compatible measured broad originals can excuse broad candidate failures. Matching diagnostics/passing evidence and reasons are required; changed causes, new/lost failures, cutoff and unknowns stay blocking. Disclose accepted failures.

<a id="run-start-originals"></a>

## Shared working-folder ownership

Workspace/run locks coordinate controllers. Proof publishes backup ownership before swaps; conflicts, external edits or publication failures preserve bytes/evidence and halt. Reclaim only ended same-host idle owners; never clear unknown locks or reconstruct originals from repaired source. Git/captured originals require exact hashes. Runtime/engine data and untracked secrets are excluded; tracked source remains covered. Symlink targets cannot receive executable verification.

Full evidence boundaries hash source; intermediate caches and parallel hash readers do not relax serial policy. Scope guards are not OS isolation, locks are not filesystem compare-and-swap, and local hooks are not attestation. Use actual host access controls.

context.ledgerPath selects history; restricted writes use the disclosed run-local ledger. Engine changes need stop/reload/new decision. [Response standard](response-standard.md) owns request readiness, packets, presentation and host limits.
