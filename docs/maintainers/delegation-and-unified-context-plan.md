# CYC delegation and unified task context implementation plan

Status: implementation in progress. Unified task context, conservative routing and bounded read-only assignment contracts are implemented locally. The active host still performs dispatch; automatic execution, write-capable teams and measured savings are not established.

Date: November 7, 2026.

CYC will choose between solo work and bounded delegation using dependencies, context needs, host capabilities, budgets and observed outcomes. Each task/run will have one unified context document. The lead will reconcile worker findings into it and use that current document to continue the task.

The user selected one document per task/run. Existing canonical project feature records remain reusable across tasks. A task spanning several features can update their existing owners; worker count never determines project-document count.

## Intended behavior

The lead performs proportionate discovery, considers a focused solo route and useful alternatives, and records its choice. Duration alone never triggers a swarm. Workers receive narrow assignments and return structured findings and evidence, rather than maintain context documents.

The lead integrates those findings, preserves disagreements and failed approaches, reads the updated shared context, and remains responsible for the combined result and final verification.

```text
Request → Lead discovery → Solo or bounded delegation
Worker findings → Validate → Lead reconciliation → Unified context document
Unified context document → Lead reads current version → Integrate → Verify
```

Transfer useful working knowledge: findings, decisions, assumptions, evidence and remaining work. Do not attempt to export hidden model state or private reasoning. A recorded read establishes a workflow step, not comprehension.

## Current architecture and impact map

The inspected package is version 0.8.3. HEAD is dfb52e58258d769bec05b9c5c94efcc167faa28c, with existing uncommitted work. Selected working-tree hashes appear below; HEAD alone does not identify these bytes.

| Area and inspected entrypoint | Existing connection | Planned treatment and behavior to verify |
| --- | --- | --- |
| [scripts/catalog.mjs](../../scripts/catalog.mjs), routeTask | Advises playbook choice from goal/path signals | Keep delegation separate from playbook selection. A keyword must not authorize spawning or waive checks. |
| [scripts/runtime.mjs](../../scripts/runtime.mjs), startRun, nextRun, recordHandoff, finishRun, completeRun | Owns scope, attempts, source snapshots, handoffs, verification and completion | Add versioned parent-owned delegation/context state through existing transactions. Preserve current proof, failure budgets and completion requirements. |
| [scripts/execution.mjs](../../scripts/execution.mjs), resolveExecution, artifactFiles | Binds actual host ownership and artifact boundaries | Observe agent dispatch/cancellation/usage support separately. Native execution mode does not prove those capabilities exist. |
| [scripts/context-review.mjs](../../scripts/context-review.mjs), planRetention, prepareRetention, checkRetention | Plans focused project records before scope freezes; validates authored knowledge before completion | Feed reconciled conclusions into learning.context. Preserve focused ownership, current source binding and final-check order. |
| [scripts/work-review.mjs](../../scripts/work-review.mjs), [handoff contract](../skill-contract.md) | Distinguishes stage findings, review provenance and task acceptance | Worker success cannot complete a parent stage or replace configured checks. Preserve required fresh review. |
| [bin/cyc.mjs](../../bin/cyc.mjs) | Uses explicit option and JSON input allowlists | Add strict versioned inputs and compact guidance without changing existing command shapes. |
| [skills/cyc/SKILL.md](../../skills/cyc/SKILL.md), affected methods and [scripts/project-tools.mjs](../../scripts/project-tools.mjs) | Host performs methods using focused target-project knowledge | Add assignment/reconciliation/read instructions. Do not create an agent per workflow stage or load engine-development context into target applications. |
| [scripts/run-worker.mjs](../../scripts/run-worker.mjs) | Runs existing controller operations as a process | Keep this meaning unchanged. It is not a model-agent executor. |
| [package.json](../../package.json), [scripts/install.mjs](../../scripts/install.mjs), [distribution checks](../../scripts/check-distribution.mjs) | Explicit release selection feeds installed engines | Include new runtime modules and verify a copied install. This maintainer plan remains outside runtime distribution. |

Confirmed dependencies include native ownership, frozen scope, shared budgets, evidence freshness, review, retained project context and installation. Agent-tool availability, cancellation behavior and detailed usage telemetry require actual host qualification.

An affected area is a verification concern, not automatic scope to edit. Reinspect relevant dirty files and update this map when implementation reveals new consumers.

## Delegation decision

Support solo, solo with parallel tools, lead with a temporary specialist, and lead with bounded workers. Existing required-review policy remains independent of optional delegation.

Scout supplies task family, dependency edges, shared mutable decisions, read/write scopes, acceptance criteria, expected context overlap, integration work, risk and observed capabilities. Label judgments and estimates as agent-reported; do not imply automated dependency discovery.

Apply feasibility rules first. Each assignment needs a bounded deliverable, stopping rule, authority within the parent scope, a supported execution path and budget reserved for integration and verification. Reject assignments that require unresolved cyclic dependencies, overlapping write ownership or unauthorized access. Unknown dependencies mean further discovery or solo work.

Then compare remaining whole-route cost. The selected objective is explicit: tokens, provider spend, or elapsed time under a cost ceiling. A faster, more expensive route can be justified for time; it is not a token saving.

Provider-cost accounting includes every agent, relevant billable input/cache/output category, repairs, failures, paid tools and execution. Count each charge once. Record model/rate provenance and date. Quota observations and API-price estimates are not actual subscription invoices.

Without measured history, use labeled ranges with assumptions, not fabricated precise predictions or statistical confidence intervals. Prefer solo for an economic objective when savings are unknown or estimates overlap materially. Explicit user requests for parallel work and required reviews can justify another route for another objective; record the reason.

With comparable history, estimate cost per accepted task as total spend across all trials divided by accepted tasks. Preserve failed runs and match criteria, task family and model/tool conditions. Before adding a worker, compare expected avoided future effort/repairs with worker execution plus additional coordination and integration. Reassess remaining cost at checkpoints; sunk setup cost does not justify continuing a bad split.

Do not compare a scoped team against an overloaded solo baseline. A useful solo baseline uses focused retrieval, parallel tools and sensible checkpoints.

## Policy and budgets

Introduce a versioned delegation policy with off, recommend and auto modes. Ship recommend first. Auto becomes opt-in for a qualified host/task combination. Off disables optional workers, not an existing required reviewer.

Freeze policy and total ceilings into the parent run. Track maximum active workers, total assignments, direct-child depth, optional elapsed-time ceiling, selected usage ceiling, and the reserve for integration/verification. Initial support is direct children only. Retry and reassignment consume the original parent totals; they never reset existing failure budgets.

Identify which limits are controller/host-enforced and which are cooperative. Assignment count and reservations can be enforced before dispatch. A hard token/spend ceiling additionally requires controls that bound in-flight generation; reports arriving after completion cannot guarantee it. Never advertise hard spending enforcement where it is unavailable.

Missing telemetry means unknown cost. Unsupported dispatch falls back to solo for optional work, with an explanation. Neither permits downgrading an active native execution mode or marking a required fresh review complete.

## Unified context storage

Use one readable document at .cyc/runs/<runId>/context.md, created lazily when delegation is planned or task context is requested. Trivial solo work need not create a document.

The existing parent state.json holds versioned reconciled context data and lifecycle metadata. context.md is its deterministic readable projection, not another independently edited authority. The lead authors changes through reconciliation inputs; workers cannot publish the document or mutate the parent run.

Worker JSON contributions and command receipts can remain in excluded run storage as audit evidence. They are not additional context documents the lead must routinely read. Do not create permanent worker-specific Markdown summaries.

Only the observed parent conversation mutates its run. Workers return reports through the host; the parent imports them. Do not impersonate the parent's session identity or create unrelated controller runs that hide worker failures from parent completion.

The document keeps a stable reading order:

- Original goal, acceptance criteria, constraints and authority.
- Current integrated state and next action.
- Confirmed findings and decisions, with source/evidence references.
- Relevant failed approaches and lessons.
- Unresolved questions, conflicting or stale findings and affected dependencies.
- Active assignments, budget observations and outstanding verification.
- Context revision and source fingerprints.

Retained claims have stable IDs, origin, evidence, dependency basis and status. Distinguish observed facts, lead judgments, hypotheses, superseded claims and stale claims. Worker-reported checks remain agent-reported until supported by compatible receipts.

Maintain a compact current view instead of accumulating transcripts. Keep detailed receipts behind precise references, preserve original requirements and material negative evidence, and enforce configurable size limits. Label token estimates as estimates. If the view is too large, require consolidation into the same document; reject oversized updates without truncating unresolved issues or destroying the previous revision.

## Versioned contracts and proposed interfaces

These are interfaces to implement, not commands currently available. Use the existing --run and --file conventions and strict field validation.

| Proposed action | Required contract |
| --- | --- |
| delegate decide | Task facts, capability observations, candidate routes, objective, estimate ranges/provenance, selected route and reasons |
| delegate assign | Parent run/stage/attempt, assignment ID, objective, criteria/dependencies, read/write scope, context revision/hash, source basis, limits, budget reserve and stopping rule |
| delegate record | Matching assignment identity/basis, status, findings/evidence, proposed decisions, checks actually performed, failed approaches, unresolved questions, optional patch references and usage provenance |
| delegate reconcile | Expected context revision, contribution dispositions, accepted/rejected/superseded claims with reasons, unresolved conflicts, integrated narrative, source revalidation and next work |
| context task | Current shared view, revision/hash, read receipt and changes needing acknowledgment |
| context ack | Parent identity and current read receipt, revision/hash and how relevant findings affect dependent work |

All envelopes include a schema version. Validate unknown fields, status types, IDs, regular-file evidence, path traversal, linked-path boundaries, size and parent authority before publishing. Imported text is data, not new project instructions or executable authority.

A worker result cannot directly advance a stage. Assignments are children of one parent run, not independent runs with fresh budgets.

Proposed scripts/delegation.mjs holds pure selection, contract validation and budget logic. Proposed scripts/task-context.mjs validates reconciliation, manages context revisions and renders the view. Keep transactional ownership and lifecycle integration in scripts/runtime.mjs. Extend scripts/execution.mjs only for separately observed capabilities.

The host still performs agent dispatch, cancellation and semantic reconciliation. Do not add provider credentials, a paid-model service or an agent daemon to the portable local controller.

run next/status should expose a compact route/reason, context revision, pending work, remaining budget and exact next action. Preserve current compact record output and legacy field shapes. Use explicit detailed views for full content.

## Reconciliation and consumption

Consolidate at useful return/checkpoints, before dependent work proceeds and before final verification.

1. Validate the result's run, assignment, schema, status, evidence and authority. Matching result IDs with matching contents are idempotent; changed contents under the same ID are rejected.
2. Check context/source basis against the current task. Source changes stale affected claims. Unknown dependency coverage requires conservative revalidation. An older-context finding can still be useful, but the lead must explicitly revalidate it.
3. Have the lead compare findings with current source, original criteria and other evidence. Deduplicate equivalent claims while retaining provenance. Do not concatenate summaries, vote on correctness or silently prefer the latest arrival.
4. Resolve disagreements with evidence. Preserve unresolved conflicts and the actions they block. Structural checks detect version/identity collisions; semantic contradictions require lead judgment.
5. Commit the reconciliation under the parent transaction with an expected-revision check. Record every imported contribution's accepted, rejected, superseded or unresolved disposition. A completed worker is not automatically accepted knowledge.
6. Publish the updated document. Return its revision/hash and relevant decision IDs. The lead reads and acknowledges that revision before dependent dispatch, integration or stage handoff.

Record read receipts bound to the run, parent identity, revision and hash. Dependent assignments/handoffs name the acknowledged revision; a later relevant update invalidates earlier acknowledgments. next/status exposes the current view after restart.

Controller transitions can enforce these records. They cannot observe every host tool call or prove that a model understood the content. Final acceptance still depends on source review and actual outcome checks.

Failed/cancelled workers return partial findings when available, clearly labeled. Material unresolved conflicts and undisposed relevant results block completion. Late results after cancellation/terminal completion cannot reopen the run or replace context; preserve valid late evidence as labeled audit data.

## Recovery and evidence freshness

Reuse existing run ownership and transaction machinery. Commit canonical context data with its expected rendered hash, then publish context.md with a staged single-file rename. This is recoverable sequential publication, not an atomic transaction across state.json and Markdown.

If a crash separates publication steps, next, acknowledge and finish detect revision/hash disagreement and return needs-context-sync. Recovery renders from committed state without repeating semantic reconciliation or resetting budgets. Regenerate only when the file matches an expected prior/staged revision; preserve unexpected edits for deliberate recovery.

Active-worker capacity is released only after terminal/cancellation acknowledgment. In-flight work remains visible. Stop or restart does not silently discard assigned work or its reserved totals.

Run storage is excluded from source snapshots. Therefore bind accepted context/result revisions explicitly into handoff and finish evidence instead of relying on Git freshness. New material findings after verification require supported invalidation, affected review and fresh checks. A display-only refresh of existing receipts can preserve the semantic revision; new conclusions cannot.

Fresh reviewers continue to receive original requirements and current source under the existing independent-review brief. Do not feed them implementation rationale merely to synchronize context. Their findings return through the same consolidation path without another permanent context document.

## Project retention after consolidation

Before proof/final verification, the lead takes durable conclusions from the unified task context and authors learning.context for the already frozen contextRetention features. Use normal preparation and source-bound retention checks.

Update actual canonical feature owners, not a document per worker. A task spanning features may update several existing records, each with its relevant contract, decision, failure and reproducible checks. Do not paste the complete shared task context into every owner.

The task document does not replace required feature records or their index. Missing retained knowledge remains needs-context. Discovering an unplanned owner after scope freezes follows existing recovery rules, without silently broadening scope.

Essential retained conclusions must travel in project source without assuming ignored worker receipts exist in another checkout. Preserve reference/provenance limits and final-file ordering.

## Implementation phases

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| Shared context foundation | Versioned state, deterministic document, expected-revision updates, read/ack and recovery | Contributions update/resume one document without loss, stale acknowledgment acceptance or worker-specific context files |
| Routing and bounded assignments | Scout facts, feasibility rules, economic ranges, parent reservations and strict imports | Explainable decisions; invalid plans/results change no protected state; legacy runs remain compatible |
| Native read-only delegation | Host dispatch/cancel/result flow; temporary specialist before bounded concurrency | A real supported host returns evidence that the lead reconciles and uses; configured checks remain mandatory |
| Retention and completion integration | Bind context to handoffs, review and finish; derive authored project knowledge | Stale/unresolved task context cannot bypass final verification or canonical retention |
| Economic qualification and expansion | Matched repeated trials, worker-model evaluation and optional auto routing | Report measured costs, failures, acceptance and time; enable only supported host/task combinations |

Start with read-only assignments. Write-capable workers follow after isolated change integration has dedicated proof/review coverage. Prefer a proposed patch against declared hashes, or a deliberately supported isolated checkout, with lead review/application in the parent workspace. Do not initially allow concurrent model agents to edit the same parent workspace. Scope validation is not an operating-system write sandbox.

## Verification and negative cases

The tests below are planned acceptance checks, not passing results from this documentation task.

| Proposed test file | Behaviors to establish |
| --- | --- |
| test/delegation.test.mjs | Reject cycles, overlapping writes, widened scope, unknown fields and exhausted reservations; prefer solo for unknown economics; preserve required-review policy |
| test/task-context.test.mjs | Deduplicate with provenance; retain conflict/negative evidence; reject stale revisions, incorrect hashes and oversized updates while preserving the prior view |
| test/delegation-runtime.test.mjs | Reject foreign mutation and altered replays; preserve retry totals across restart; prevent late result promotion and premature capacity release |
| test/task-context-recovery.test.mjs | Recover interrupted publication; reject stale/foreign acknowledgments; preserve unexpected document edits; invalidate material updates after verification |
| test/delegation-journey.test.mjs | Exercise route, assignment, host result, reconciliation, lead read/ack, integrated outcome and final parent checks; expose a deliberate conflict/stale finding |
| Existing runtime, review, context, ownership and distribution suites | Preserve original proof, final checks, feature retention, native identity and copied-install behavior |

Include unsupported hosts, missing usage, workers claiming success without receipts, cooperative budget overshoot, instruction-changing contribution text, source drift after dispatch and conflicting results after an earlier success report. None may be promoted to verified behavior.

For semantic transfer, give a worker a non-obvious supported finding and an unresolved competing claim. Observe the lead's dependent decision after reconciliation. Confirm that it applies supported evidence and respects the conflict; a parser pass or acknowledgment alone does not establish useful reuse.

When implementation changes the controller or delivery gate, run node --test with rejection cases. After adding runtime modules/method links run npm run check:distribution and a disposable copied-install journey. Run context lint after canonical retention changes. Validate actual native dispatch, cancellation and restart separately from simulated hook events.

## Economic evaluation and rollout

Compare focused solo work with selective delegation using matched repository states, requirements, acceptance checks and comparable total budgets. Include sequential work, independent research, shared-state changes, small routine work and branch-heavy investigation. Hold models/tools constant initially, then test cheaper specialists separately.

Count discovery, reconciliation, verification, failures, fallback and repairs. Record actual usage per invocation with stable receipt IDs; do not double count cumulative reports. Keep unobserved usage unknown and distinguish API-price estimates from observed spend.

Report total spend, acceptance coverage, cost per accepted task, elapsed time, coordination overhead, stale/conflicting findings, repairs, sample size and uncertainty. Different task mixes are not directly comparable. Test history-based routing on held-out tasks before treating it as predictive.

Enable auto only for qualified host/task combinations meeting the chosen quality and budget conditions. Preserve recommend/solo fallback and previous evidence when disabling a route. This plan establishes no universal token threshold or measured CYC saving.

## Fixed decisions and implementation questions

Use one task/run context document, lead-owned reconciliation/integration and structured worker evidence. Preserve existing project feature records, native ownership, frozen scope, shared budgets, required review, original-code proof and final checks. Start with read-only workers.

Qualify actual host dispatch, cancellation, telemetry and enforceable generation ceilings during implementation. Those observations determine what automatic routing and budget guarantees CYC can support.

## Selected source fingerprints

These hashes identify inspected working-tree bytes, including uncommitted changes. Revalidate before implementation; they do not certify semantic correctness or complete coverage.

```text
skills/cyc/SKILL.md       06826cc1aa36588ac5e8756640fb9dcc4cbd7ef826d06f5495c4e9175612a958
scripts/catalog.mjs     b30ca55fcfd7198200003ddd25d7cf1ea1696e5a59b111c5095b68927bda8692
scripts/runtime.mjs     f41c01a0964fff0dadae49f5f12264e989e9e3a129ddbba828143b431ddb4d40
scripts/execution.mjs   8d7e43dc4b0be30d75d7e39f6dfa22967a28a4cf7c249ca65c6546bf472c6a59
scripts/context-review.mjs 5963771e3d4b72428151a192e7922cb12fafbfb08c77f237bcce089e696d4250
scripts/work-review.mjs bac64a95d90836ec39573ec74be3b9fb8b3903f56d5f55bb5f61ffc7a583145e
scripts/project-tools.mjs 4771d6f141934691b4e68ddccce1a24aa73db035b4d0358838ea4123dc802cf3
bin/cyc.mjs             0ccd05809766792fe6e836a64811f370dfad41a13eaa291cdbdf4ef303a7a441
docs/context.md         4b0aa14aa97d5e484219151fd7cd18e3e3bf3eef57944e63154d258b1c4a6ab6
docs/skill-contract.md  4c8b2a85fbc23612bdad87f23a3a04e4999b0a05d1a45569066caab0a45407d2
package.json            4d293022ddcf0685bf07e00fd0f1044309593a5197acf239ceabb315e54fe010
```

## Reference text retained during package consolidation

The release was near its existing size ceiling before delegation. These complete pre-consolidation guides remain as historical source reference, not parallel operating instructions. Current installed instructions are the concise guides at their original paths; deeper runtime behavior remains inspectable in source and work assessments. This appendix is excluded from runtime distribution.

### docs/runtime.md before consolidation

````text
# CYC execution controller

The controller validates skill handoffs and configured checks; the host performs the methods. It neither launches model fleets nor authorizes publication. Build routes require Scout context/approach/alignment/consumers, Verify semantic review/consumer checks and Deliver retained learning/error history in existing handoffs.

Select `evidenceVersion:1` to retain original requirements, criteria/clauses, named scenarios, source-bound review and case-specific proof judgments. `reviewPolicy` is `self-allowed` or `fresh-required`. [Assessment examples](work-assessments.md#versioned-evidence-records) define these fields. Legacy/advisory callers remain supported and labeled; historical reviewer prose is never upgraded into linked provenance.

## Start with a project and criteria

Installed CLI: node .cyc/engine/bin/cyc.mjs; source checkout: node bin/cyc.mjs. --project PATH selects a target; otherwise the CLI finds the nearest parent .cyc/config.json. Save inputs under excluded .cyc/runtime before start. Prefer run start --file START.json for multiline/quoted metadata:

```json
{"goal":"Repair saved status","playbook":"bug-fix","criteria":[{"id":"reload","description":"Saved status survives reload."}],"allowedPaths":["src","test"],"executionMode":"standalone","session":"workflow-label","contextRetention":{"version":1,"disposition":"required","features":[{"id":"status","doc":"docs/context/status.md","paths":["src/status"]}]}}
```

Use actual authorized mode/context. Optional scout/plan records Scout once at start; invalid input creates no run. Legacy argument commands remain supported: repeated --criterion yields c1,c2,…; --criteria FILE accepts IDs; omitted criteria are explicitly inferred. Fast routes use scout → build → verify → deliver; detailed plan/explore/teach/evaluate retain their chain. Follow returned exact runId/templates; implicit selection requires an unambiguous owned run, never another conversation's sole run.

JSON accepts BOM/repairs invalid Windows escapes only: use forward slashes because C:\new contains a valid newline escape. Canonical paths stay inside the target. Assessment aliases normalize spelling, not observations. Unknown fields/types and mixed file/field flags reject; matching --run is permitted with finish input. Inputs cannot override config, budgets or protected paths; proofCommands freezes at start.

allowedPaths/--scope restrict net changes to literal files/directory prefixes, not OS writes. Translate brief globs into authorized literal paths without broadening. Omit only for project-wide authorization. protectedPaths, context.ledgerPath and source include/exclude use the same literal rule: missing * or ? components reject before locks/snapshots/capture, never expand. Existing POSIX wildcard filenames remain literal; ordinary future paths, spaces, Unicode and [id] routes are valid. Historical scopes stay frozen; no failed run is widened/reset.

## Execution capabilities and progress

New start inputs may set executionMode to native-codex, native-claude, cursor or explicitly authorized standalone. conversationId identifies the real host conversation, session is a separate workflow label, and runId identifies controller work. A label's length does not choose Cursor. Native modes require actual context; standalone cannot downgrade a live native request or create activation evidence. Explicit ownership rejects foreign mutations. Legacy runs retain their original schema/evidence limits. Standalone finish generates run-local delivery.json; native packet tokens, windows, exact-response and blocked-run gates remain active.

Use --wait-ms 30000 on finish/verify/prove-red. operationComplete differs from workflow finished. Phase/check, elapsed time, actual output, logs and a handle support run wait --run ID --operation OPERATION_ID --wait-ms 30000 (maximum 60000). Silence is not success. Owned run stop requests cancellation outside the check lock; wait for acknowledgement and proof restoration. Conflicts retain halted recovery instead. Locks protect ownership/recovery, not status discovery.

Optional proofCommands freezes a focused command array at start; --tests selects swapped files, not execution scope. Final verification still runs all broad commands. Focused proof cannot substitute for a compatible measured original broad failure. Finish requests bounded proof judgment and measures broad originals when needed, retaining compatible focused treatment.

Reuse is opt-in per check: reuse:{kind:"local-deterministic",inputs:["explicit/dependency/path"]}. Include relevant non-source inputs. Keys also cover source/tests/configuration, installed dependencies, environment and executable/toolchain bytes. Unknown/unbounded inputs, links, external/freshness checks or changed inputs disable reuse. The existing baseline cache is reused; no competing evidence cache is introduced. Old records are never upgraded without measurement. CODEX_TOOL_CALL_ID is removed from checks and fingerprints; other environment inputs remain bound.

## Move through the recorded stages

`run next` includes read-only tool hints at Scout/Understand/Impact and recipe-list hints at Build/Verify. Use [project tools](project-tools.md) to select context and applicable project checks from the run's changed paths or declared scope. Recipe execution retains diagnostic evidence outside covered source; it cannot advance stages, reset budgets, or replace the required command/test-proof gates.

| Command (always bind --run ID) | Purpose |
| --- | --- |
| run next/status | Next stage/attempt/criteria/templates/skills or full state |
| run record --summary TEXT --assessment FILE | Quick handoff; generated stage/attempt/artifact hashes. Use --file for full packet. |
| run finish --file FINISH.json --wait-ms 30000 | Normal resumable context → proof/judgment → broad Verify → Deliver/completion |
| run prove-red [--tests PATH...] / run verify | Execute proof or broad final checks without skipping prerequisites |
| run review / review-capture / review-record | Generated review/current source provenance; see assessments |
| run retry --stage STAGE --reason TEXT | Rewind within shared budget (early detailed stages map to Scout on fast routes) |
| run accept-failure --check ID --reason TEXT | Judge a compatible measured original broad failure |
| run recover | Read-only constraints, preserved evidence and justified next action |
| run pause/resume/stop | Pause; resume without budget reset; stop without success |
| run complete | Require every completion condition; cannot substitute for finish work |

Quick record needs --criteria-passed TEXT for one criterion or --criterion-evidence JSON per ID for multiple criteria; early criteria can be unverified, Verify/Deliver require passed evidence. Failed/blocked handoffs report that status honestly. Full packets follow the [handoff contract](skill-contract.md). Keep input/receipts in excluded run storage; never edit state to pass. Returned commands/templates preserve exact IDs and agent edits. Current review records feed finish; generated projections are not their own evidence. See [assessments](work-assessments.md).

readiness --session ID [--since ISO_TIMESTAMP] diagnoses request-scoped states. Use the actual hook window; explicit non-future windows may omit work and do not certify activation/quality. Response packets remain separate from handoffs.

## Feature context before completion

Current implementation starts receive contextRetention version 1 independently of evidenceVersion or input envelope. Supply a focused features array [{id,doc,paths}] before Build; omission infers existing focused owners or a goal-named record. Each canonical record and the target index join scope before freezing. New source entrypoints must resolve to planned owners; catch-all records and reference-only rows cannot satisfy retention. Meaningful shared-component changes require their focused records too; inference cannot establish semantic completeness.

Use learning.context [{id,currentView}] in finish, or author planned records then context prepare --run ID. Finish prepares missing records/index and returns noncomplete needs-context with exact remaining input until authored knowledge, index/mappings, current History/source evidence and freshness pass. It does this before proof/final verification; direct verify/complete cannot skip the gate. Current-view authorship binds to selected source; generated History alone is insufficient. Preparation uses actual available observations and stable run/command references, not future passing claims or self hashes. Sequential writes resume without duplicate current History; they are not atomic across files.

Default target convention is docs/context/<feature>.md plus INDEX.md. Configure context.directory before start to reuse a project-owned equivalent directory. Engine/runtime storage is invalid; index/ledger/recipe/receipt files are supporting records, excluded from contextDocs. Validation reads planned docs plus index consistency, not every historical Current view. Semantic correctness and adoption remain agent/reviewer judgments.

An honest nonfeature routine/read-only disposition remains proportional. A feature cannot waive retention through learning:none or an older start shape. Explicit scope/protected-document restrictions remain pending/incomplete without writes. A late need cannot broaden frozen scope. Older stored records preserve their contract and are labeled legacy. Completed-run catch-up requires a new implementation update with a required canonical plan and final executable checks (--update-run ID); fresh verification follows context edits, and a new reply packet cannot restore stale evidence. See [Context](../methods/cyc-context/SKILL.md).

## Configure meaningful executable checks

Use onboard for read-only setup; authorized onboard --verify saves diagnostic evidence, not final verification, failure-acceptance baseline or host activation. Configure genuine project checks **before** starting:

```json
{"schemaVersion":1,"limits":{"maxAttempts":3,"maxNoProgress":2},"verification":{"commands":[{"id":"tests","command":"node","args":["--test"],"timeoutMs":900000}]},"protectedPaths":[]}
```

Commands use executable/argv without shell interpolation in the target working directory; inspect side effects. A successful no-op is not a meaningful check. Configuration is frozen/protected during a run, including protectedPaths even outside ordinary source selection. A legitimate config correction needs an explained new run preserving the old result, never weakened checks.

Default timeout is 30 minutes, distinct from optional run deadline. The runner stops process trees on timeout/controller loss/owned cancellation (full-path taskkill on Windows). The helper excludes NODE_OPTIONS; checks retain it. Logs keep up to 64 MiB per stream plus tails outside source; escaped output holders drain for two seconds after exit. Receipts bind commands, actual exit/errors/output and covered source stability. All-green commands that change covered source do not verify a stable candidate; finalize generated files first.

## Recovery and budgets

No wall-clock deadline applies unless limits.maxDurationMs is configured. Failed attempts share maxAttempts (default 3) and maxNoProgress (default 2) across stages; retries cannot reset them. No-progress signatures are heuristics. Pause/resume preserves deadlines and invalidates executable verification. Attempt IDs advance on recovery; read run next rather than replaying an earlier packet.

Baseline measurement is off by default. verification.baseline:true measures originals with workspace ownership; edits invalidate it. Compatible explicitly deterministic inputs use the existing cache. Otherwise accepting an old broad failure needs a measured broad original control. Focused proof cannot excuse omitted broad checks. Refactor/exempt runs needing acceptance must arrange broad originals before edits.

Proof roles remain original-only control, originals-plus-new-tests treatment and candidate. Control may be skipped when treatment passes (no decisive red), or only newly added exact-path tests fail with complete named output and no extra diagnostics. Edited/moved/deleted tests, unknown names, cutoff or other errors require control. Do not infer identities from test source. npm pretest/posttest lifecycle checks remain required.

Finish templates list measured old failures with placeholder reasons; fill genuine reasons or fix them. Passing originals do not need acceptance. A failing candidate check may be accepted only with compatible broad original evidence, at least one passing check, and identical exit/error plus stable failures/non-test diagnostics. Timings, dates, durations and Node warning PIDs may differ. Changed-source stack paths, new/lost failures or lines, hangs, empty/cutoff evidence and changed errors block. Parser-aware TAP/mocha/jest comparison retains identity/file/parent path/count/error; unknown formats use conservative line comparison. Large complete output can compare parsed tests within the 64-MiB limit; 32,000-character tails alone cannot prove equality. See scripts/test-output.mjs and its adversarial tests.

Once per run, only unchanged measured old failures can stop as awaiting-acceptance without consuming the failure budget; later stops count. Accepted failures remain passed-with-accepted-failures and require disclosure. failedAtRunStart and acceptedFailuresThatChanged distinguish missing judgments from incompatibility.

Recovery invalidates dependent later handoffs/evidence. States distinguish running, paused, blocked, complete, exhausted, halted and stopped. A blocker is an unmet prerequisite, not success. Halt preserves unexpected source for review, not rollback. The controller checks budgets when advancing; it does not terminate the host agent. New runs require an explicit task decision, never automatic escape from a failed budget.

### Shared working-folder ownership

Controller mutations/baselines hold exclusive project-local .cyc/runs/workspace.lock plus per-run locks. A second controller is refused before writes/checks/budget use. Startup releases ownership before optional baseline launch; busy baselines become unavailable. Read-only recovery reports owners and defers source interpretation.

Proof publishes its extensionless candidate backup/manifest pointer and phase **before** temporary source replacement. At each boundary/restoration it compares files with its own last bytes. Unexpected edits, deletion, type changes, restore/publication failures or final mismatch halt the run and retain backup evidence; other owned paths restore independently. Unexpected regular bytes are preserved when possible; capture failures are disclosed. No successful proof receipt is issued for conflicts. A killed proof requires deliberate operator comparison, never automatic rollback or lock clearing.

Locks bind PID, host, OS and Linux PID namespace. Reclaim requires same identity, ended owner and idle phase; commit/publication failures, swapped/halted backups and unknown phases remain protected. Recorded deadlines protect checks outliving the controller; scanner-blocked deadline updates disclose that missing extra protection. Reclaim compares exact owner under its own exclusive guard, preserves newer owners and logs lock-reclaims.jsonl; abandoned baselines become failed. Foreign/unknown owners need operator recovery.

State/review publication failures retain both locks and backup pointer; commit-in-progress remains protected even if writing the failure record also fails. Recovery marks old passing fields/review unverified; it neither publishes the staged result nor resumes work. A restored phase can retain a pointer whose backup was already removed after restoration.

This coordinates controller work, not arbitrary editors or independent recipes. Locks are local workflow records, not access control/attestation. Byte checks are not filesystem compare-and-swap; an external write/open handle can race observation/replacement. Use an isolated quiescent folder when proof could overlap other writers.

## What the controller establishes—and what it does not

It checks matching run/stage/attempt identity, criterion preservation, evidence presence, current declared file hashes, configured command outcomes, covered source stability, scope guards, and budgets. Non-executable playbooks can complete with clearly labelled agent-reviewed observations; they do not receive invented machine-verification claims.

Evidence quality still needs judgment. The controller cannot prove an observation is truthful, discover every omitted artifact, establish user acceptance, or guarantee that a test measured the desired result. Skill validation checks document structure, not teaching quality or engineering effectiveness.

The source guard compares project state at checkpoints. It is not a filesystem sandbox. Git projects select tracked files plus untracked files not ignored by Git; tracked files remain covered even when ignore rules or `source.exclude` match them. CYC's own runtime/run/engine directories and Git metadata are always outside ordinary snapshots. Untracked dependency/build directories and untracked `.env` secrets are excluded. Tracked secrets remain tracked source: do not commit secrets.

### Run-start originals

New bug-fix/feature/refactor runs capture permitted selected originals for exact proof. A recorded Git working tree supplies ordinary tracked bytes; assume-unchanged/skip-worktree files and permitted uncaptured originals use extensionless hash blobs in .cyc/runs/ID/original-source with sourceCapture metadata. Without Git, or if Git cannot record working bytes, capture supplies them. Git selection failure refuses startup instead of reading ignored data. Protected/out-of-scope/link/excluded-secret inputs are not captured.

Captured hashes must match before recording and using originals. Filtered or raw Git bytes are accepted only with exact initial SHA; CRLF reconstruction is attempted only under that same check. Equivalent text is insufficient for mixed endings/noninvertible filters. Missing objects/captures remain unavailable, never reconstructed from repaired code. Historical runs do not gain new captures. Honest exemptions remain labeled limitations, not proof receipts.

Capture holds originals until startup records them: max 20,000 files/128 MiB, deduplicated within a run. Larger plain projects must narrow scope or use Git. Storage is separate from the installed engine, not a full backup or retention/pruning policy. Protected storage/junction/casing aliases are refused before recording. Proof backups remain outside test discovery and bind original source, control/treatment and candidate tests; this establishes check-level evidence, not that every assertion detects a defect.

source.include/exclude use literal relative paths, never globs. Include real generated inputs; exclude only untracked artifacts (tracked files remain covered). Missing wildcard components reject before startup writes; ordinary future paths, spaces, Unicode and bracketed routes remain literal. Existing literal wildcard names on POSIX do not enable expansion or symlink following. Includes cannot expose untracked .env secrets. Non-Git traversal uses dependency/build defaults, not .gitignore. Selected-source defaults are 200,000 files/2 GiB; positive source.maxFiles/maxBytes can change them. Example: {"source":{"include":["generated/api-types.d.ts"],"exclude":["output"],"maxFiles":300000}}.

Evidence snapshots fully hash selected files at start, proof swap/restore, final checks, baseline/recipes/onboarding and completion. Intermediate guarded views can reuse .cyc/runs/source-cache.json SHA when size/mtime/ctime/file ID match a file hashed after two seconds stillness. Windows mapped writes/reset timestamps and FAT can defeat that intermediate heuristic; the next full evidence read repairs it. Stale preverification views make checks unstable, never certify stability. Only operation owners update cache; successful/recorded-failure returns publish accumulated updates, thrown refusals publish none and remove only demonstrated wrong entries. Read-only recover/investigate/recipe list write nothing. Git listing bounds are 512 MiB/two minutes. Scope restricts edits, not fingerprint selection. sourceStable/changedPaths explain mutations during passing checks.

Full snapshots of at least 1,000 files use up to eight source-hash-worker threads, reading SHA-256 in 1-MiB chunks and applying results/errors in original path order. Links/type changes/read errors/size limits defer to main-thread policy. Workers exclude preloads/NODE_OPTIONS, expose no output and fall back after two seconds without startup or five without progress; snapshot exit waits for active reads, bounded by five seconds of silence. A missing worker module falls back to one thread. Cached/gate views remain single-threaded. Local performance observations are not generalized savings claims; behavior/order/source limits remain those of the serial reader.

Linked paths in the covered project tree are fingerprinted by their identity, but their targets are not recursively verified. Executable verification refuses unsupported symlink/junction coverage rather than issuing a passing receipt. Adding or changing such a link is also a source change. Linked dependencies inside excluded dependency directories remain outside this guard's coverage; use the project's dependency controls for those.

Use the host's actual sandbox, access controls, and authorization boundaries where isolation matters. Local editable records are workflow guardrails, not tamper-proof enterprise attestation. Hook trust and live host activation remain distinct from successful local controller tests.


## Project conventions

context.ledgerPath selects the existing ledger (otherwise INCIDENT-LEDGER.md, then docs/context/error-ledger.md). Start freezes projectLedgerPath for lookup and ledgerPath for recording. Out-of-scope/protected shared writes use .cyc/runs/ID/error-history.md; a protected fallback rejects before creating the run. Record failures in the selected file, disclose deferred shared promotion and search relevant local histories. Old states retain their selection; explicit shared-record requirements are not waived. See [learning/file order](work-assessments.md#learning-lifecycle-and-final-file-order).

delivery.presentation:"project" delegates reply formatting to project instructions while keeping controller completion gates; Cursor still needs its identity/exact-response packet. Default presentation checks remain. Gate discovery includes this session's runs in this checkout and registered Git worktrees, excludes foreign sessions/unowned legacy runs elsewhere and never searches independent folders. This protocol does not prove live host loading.

An active run cannot advance across an engine-version change: stop, reload and explicitly start new work preserving the prior outcome. Old metadata stays unknown. run next returns internal skill and absolute skillFile paths under the engine; methods are supporting resources, and /cyc remains the public entry.

## Unified task context and read-only delegation

Optional versioned taskContext/delegation start policies enable one parent-owned context document and bounded host-performed work. New context task/ack and delegate decide/assign/record/cancel/reconcile actions validate ownership, revisions, source evidence, contribution dispositions and parent budget reservations. Current task context is bound into handoff and verification records independently of source hashes. Existing runs without the feature preserve their prior behavior. Auto routing is not qualified; token ceilings are cooperative. The controller still launches no model agents. See [contracts and examples](task-context.md).
````

### methods/cyc-build/SKILL.md before consolidation

````text
---
name: cyc-build
description: "Implement a planned change in thin, tested slices where every line traces to a requirement. Use for feature work, bug repairs, and refactors once the Scout plan (or, on longer routes, the design) exists."
---

# Build the change

For a new web page or visual redesign, follow the [frontend design method](../cyc-design/frontend-design/SKILL.md): build the signature section from `design/decisions.md` with final copy, the chosen imagery, the main action and the next section's start; render it at desktop and phone width and score it with the generic-tells sheet **before expanding the rest of the page**. Three or more tells means a changed decision, not a color swap. End-of-build screenshots do not perform this checkpoint. No variant quota or user approval round is required. Narrow UI repairs retain the established direction.

Ship the design, slice by slice, with a loop running the whole time. Follow the [handoff contract](../../docs/skill-contract.md).

For user updates, follow the shared [progress standard](../../docs/response-standard.md#progress-updates): briefly connect the code change to the behavior it fixes and what the chosen approach preserves. Explain meaningful changes of direction without narrating every edit.

At a consequential slice, explain how the changed state or contract reaches its readers and why the fix belongs at that boundary. When a failure changes the approach, share the observation, the assumption it challenges, and the next discriminating check. Follow the [engineering understanding standard](../../docs/response-standard.md#engineering-understanding-throughout-the-work); a list of edited files or "retrying" does not explain the engineering.

Write code to the [engineering principles](../../docs/principles.md): the smallest change, the cause fixed where it starts, tests that assert observable behavior, and the codebase's existing patterns.

Before implementation, read the project's applicable `code-standards.md` and follow the relevant [code standards](../../docs/engineering/code-standards.md). Review comments for information value, types for supported facts, catches for an allowed failure contract and abstractions for real responsibility. Preserve required documentation and local conventions; numerical complexity thresholds are investigation signals, not automatic refactor instructions.

Before implementing a slice that adds or changes business rules/transitions, read the [domain design examples](../../docs/engineering/domain-design.md) to locate the invariant's owner and affected writers/readers. For rejection, I/O or partial effects, read the [failure handling examples](../../docs/engineering/failure-handling.md) to decide what committed, what callers can distinguish, and whether retry is safe. Load only applicable guidance and preserve its legitimate exceptions and the project's conventions.

## The core loop

1. **Check the ground.** Look at the working tree and the files you will touch. Preserve uncommitted user work. Start the first useful source or test edit as soon as the short plan is ready. Never wait for an optional baseline: edits may invalidate that diagnostic measurement, but final verification still checks the finished work.
2. **Capture behavior before you change it.** For a bug, the failing reproduction from the [diagnose procedure](../cyc-understand/references/diagnose.md) is that check. For a refactor, write or find a characterization test that captures current behavior at the boundary; type checks and lint do not capture behavior. For a feature, write the first slice's test.
3. **Match the feedback loop to the change.** For a feature or bug fix, write one test for the slice, watch it fail for the intended reason, make it pass, then move to the next slice. For a refactor, run characterization tests on the original and candidate code and keep both green; do not invent a behavior change to manufacture red. Reuse adequate existing tests. For a change without executable behavior, record the specific reason and the inspection that checks it. Copy, styling, and configuration can affect behavior; their file type alone is not an exemption. A prose skip does not replace any `testProof` assessment required by the controller.
4. **Keep the data consistent.** A visible control is not the feature. When the state changes, every reader named in the plan (or impact map) sees it: the count, the filter, the saved record.
5. **Do repetitive work by hand once, then automate.** If the change repeats across many files, do the first by hand, write a script or codemod for the rest, and diff its output against your hand version.
6. **Keep feedback focused.** Use the narrowest applicable verification recipe selected by Scout (`recipe run --recipe <ID>`), or a focused project check when none exists. Run it after meaningful slices and type checks when affected contracts require them; keep expensive journey checks for Verify. Respect recipe prerequisites/effects and current authorization. Let final Verify own the configured suite; preserve required proof/final commands even after an earlier focused pass.
7. **Check the final bytes, then trace every line.** Prefer a focused patch to rewriting an entire file. Preserve its encoding and line endings; on Windows, follow the [file-write check](references/file-writes.md) when generating or replacing text files. In Git projects, run `git diff --check` before recording Build or creating a test-proof receipt, so cleanup does not immediately invalidate that proof. Read the full diff: each change should trace to a criterion, the design, or the impact map. Revert speculative "might help" edits and drive-by cleanups.
8. **Quality pass.** Trace the important value/state from its origin through updates, consumers, and relevant failure paths. For changes to ownership, state, or interfaces, apply the [architecture questions](../../docs/code-quality.md#choose-a-structure-that-protects-the-contract). Check the domain/failure decisions used for this slice: one owner of shared policy, callers that can distinguish rejection from failure, and no hidden partial effect or unsafe retry. Can a maintainer locate the invariant and the boundary for a likely next change? Fix concrete shortfalls inside scope; preserve meaningful adapters and abstractions. File length and caller count are investigation clues, not deletion rules.
9. **Clean up.** Remove debug logs (search for your debug marker), throwaway harnesses, and commented-out code.
10. **Retain learning before final verification.** Append attempted fixes and evidence to `run next`'s selected `ledgerPath` as they happen. Its [Error ledger method](../cyc-error-ledger/SKILL.md) distinguishes shared lookup from run-local recording when documentation is outside scope. Author/update every planned canonical feature/shared record and index before Verify. Use finish’s learning.context input or context prepare --run ID; placeholders and generated History alone cannot satisfy retention. Preserve historical entries, write only available observations and keep future final outcomes in run receipts. Finalize ledger updates too; keep unverified hypotheses and undecided proposals in run-local notes. Follow the [learning lifecycle](../../docs/work-assessments.md#learning-lifecycle-and-final-file-order). Implementation readiness is not user acceptance of a design.

## Done when

- Each slice has the applicable evidence: red then green for changed behavior, green on original and candidate for preserved behavior, or a justified alternative check.
- The full diff was read and each hunk traces to a reason.
- The quality pass found nothing left to fix within scope.
- Focused checks and type check pass on the final file state.
- Anything that could not be done is listed with why.

Build passing does not mean the task passed. Hand off to Verify.

## Stop rules

When a failure or interruption prevents progress, read `run recover --run ID` and follow the [recovery guidance](../../docs/onboarding-recovery.md). Explain the observation, preserved work and next action before presenting a raw log. Resume only after a real prerequisite is resolved; keep terminal runs and their budgets intact.

- The approach turns out wrong (the same workaround twice, escape-hatch types): stop and rethink the plan. In fast playbooks that's `run retry --stage scout`; in the detailed chain, [Design](../cyc-design/SKILL.md).
- A consumer the plan missed appears: add it to the plan and handle it. It only needs a retry if it changes the approach ([Impact](../cyc-impact/SKILL.md) in the detailed chain).
- Two fix attempts fail the same way: stop patching. Write down the assumption both attempts share, and check it before a third (see [Challenge](../cyc-challenge/SKILL.md)).

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Guard patch | Adding `if (x == null) return` to silence the symptom | Find why it is null |
| Toast fix | Adding a "Saved!" message when saving is what's broken | Fix the write, then verify reload |
| Instance fix | Fixing one call site of a repeated bad pattern | Search for the pattern and fix or list all of them |
| Drive-by | Renames and reformatting unrelated to the task | Revert; mention it separately |
| Untested refactor | Restructuring with no behavior test in place | Add a characterization test first |

## Handoff

Give [Verify](../cyc-verify/SKILL.md) the changed files, the tests added (with their red and green output), the commands run, and any deviation from the design with its reason. A local checkpoint is not permission to commit, merge, or publish.

## Shared task knowledge

When the run has unified task context, read and acknowledge its current document before dependent work. Host workers are read-only and return structured results to the lead. Reconcile every relevant contribution, preserve unresolved conflicts and failed approaches, then use current source evidence for integration. Do not copy worker transcripts into new context documents, borrow parent identity, or treat worker success as a passing parent check. See [task context](../../docs/task-context.md).
````

### methods/cyc-deliver/SKILL.md before consolidation

````text
---
name: cyc-deliver
description: "Write the final handoff: result first, evidence labeled in the same sentence, one useful visual, and honest limits. Use at the end of any CYC task, when handing off to another person or session, or when a blocker stops the work."
---

# Deliver the result

The reader should know in ten seconds what happened and whether to trust it. Follow the [response standard](../../docs/response-standard.md) and [handoff contract](../../docs/skill-contract.md).

Leave the engineer able to follow and maintain the change: summarize the before/after mechanism, the consequential choice, and where to find the relevant check and retained context. Reuse the shared review and existing evidence rather than adding a teaching report. Self-review the [engineering understanding criteria](../../docs/response-standard.md#engineering-understanding-throughout-the-work); do not claim comprehension merely because explanations were supplied.

## The core loop

1. **Lead with the result or the blocker.** First sentence: what now works, or what stopped you. "Homework can now be marked finished and it survives reload."
2. **Label each claim in the same sentence.** *Ran*: "the persistence test fails on the old code and passes now." *Read*: "the reminder job skips unknown fields (read, not run)." *Didn't check*: "cross-device sync is untested." For code changes, name the decisive regression test or its precise review location alongside the command/result so a maintainer can find the assertion; this does not apply to conversation-only work. Never hand the reader a check you could have run yourself.
3. **Frame impact for the user, then the maintainer.** What they will see, then what changed in the code.
4. **Include and display one visual that carries information, even under the 1,000-character limit.** Choose it with the answer: a diagram or labeled flow for processes and relationships, a data chart for quantities, a before/after for changes, or a table for comparisons and status. Use available rendering tools when helpful; otherwise use a readable text flow. A bare link, decoration, or a table that restates the paragraph above it doesn't count. Check that the visual makes the main idea easier to grasp, not merely that its markup passes the gate. Every number or output in it must be one you observed this run: take "before" values from running the original code, never from reading it. If you did not run the old code, describe the change without a before-value.
5. **Use the shared review artifact.** Link `.cyc/runs/ID/review.md`, generated from handoffs and receipts, alongside relevant files/diffs. Refresh it with `run review` after external changes and reuse it for an authorized PR. Update underlying records rather than maintaining competing reports.
6. **Deliver retained feature knowledge.** Required feature/shared records and index must already be authored and source-bound before final verification; finish enforces the [Context contract](../cyc-context/SKILL.md). Report their canonical paths and local-only receipt limits. Index, ledger, recipes and runtime logs are supporting records, excluded from contextDocs. Learning:none is proportional only for genuinely nonfeature work. Preserve explicit restrictions as incomplete/pending. Bug fixes and recorded failures require the selected ledgerPath; run-local error history must disclose pending shared promotion. Do not infer adoption from passing tests. Completed-run catch-up needs a new scoped update and fresh checks; editing context then generating a packet cannot restore verification.
7. **Check session readiness and say what is left.** The latest run's completion is not the whole session's readiness. Codex/Claude `packet` preflight includes current-request run status; `cyc readiness --session ID` provides a read-only diagnosis. Without mapped hook state, supply the actual request start with `--since ISO_TIMESTAMP`; that explicit window does not replace the Stop hook. Cursor packet preflight leaves controller readiness unverified, so inspect its actual request window separately. Preserve stopped originals and failed attempts; do not start replacements or change a cutoff to evade a block. Disclose accepted pre-existing failures (each with its reason), unverified rows, known limits, and a decision only if one remains. No forced "next task."

For a first-task handoff, briefly connect one consequential decision to its observed check and link the saved canonical context. Follow the response standard’s length-choice footer when concise delivery points to more detail; omit it for expanded/OFF or project-owned presentation. Do not promise the next chat will reuse a record until observed.

## Shape for code work

```text
Result: one or two sentences.

[One displayed visual: changed flow, before/after, or criteria table,
chosen for what the reader needs to understand.]

Changed: files and why (short).
Not covered: what wasn't checked and why.
Your call: a decision, only if one exists.
```

## Done when

The first sentence states the result or the blocker. Every claim has a label. The visual is included in the response, its form fits the subject, and it adds understanding. Limits are stated. The length honors the conversation's `limit on` or `limit off` setting; shortening prose must not silently remove the visual.

If the host gate provides a review token and packet path: in Claude Code and Codex, a completed `run finish` writes the packet from the run's record, and the Stop gate checks the reply itself. Otherwise (no completed run or Cursor) write it with `cyc packet`; changed covered files require fresh verification first; Cursor's packet carries the exact final response. Before sending, draft the reply in `.cyc/runtime/reply.md` and run `cyc check-reply .cyc/runtime/reply.md --session <ID>`: it reports the character count, how much to cut, and whether the visual is recognized, writes nothing, and is the same check the gate applies. If hooks aren't active, say that automatic enforcement is unverified.

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Buried lead | Three sentences of process before the result | Result first |
| Unlabeled claim | "Everything works" | Say what was run, read, or unchecked |
| Log replay | Narrating each step taken | Report outcomes, link logs |
| Decoration | An emoji or a table that repeats the prose | Use a visual that adds facts |
| Reconstructed before-value | A before/after row whose "before" was worked out by reading old code | Run the old code, or drop the before-value |
| Hedge fog | "Should probably mostly work" | State what's proven and what isn't, plainly |

A blocked handoff starts with "Blocked:", names the missing prerequisite, and names the smallest action the user can take. It is never presented as done. If verification failed, send the work back to its stage instead of polishing the summary.

## Consolidated task context

For delegated work, the lead reads the current reconciled task context and authors durable learning.context into the existing frozen canonical feature owners before verification. Worker count does not determine project-document count. A task document or acknowledgment cannot replace portable feature knowledge, source-bound review or executed checks. See [task context](../../docs/task-context.md).
````

### docs/skill-contract.md before consolidation

````text
# CYC skill and handoff contract

This contract connects CYC skills without making every skill a separate agent. A parent owns the user's outcome; children own bounded stage results. Instructions guide judgment. Runtime validation enforces only the structural checks and machine checks it actually executes.

## Working agreement

Preserve the user's goal, scope, accepted constraints, and acceptance criteria across every stage. Separate task-level acceptance from the local question a stage must answer. An investigation can pass with an honestly documented uncertainty while the overall feature is still unverified. Never turn a failed task requirement into an easier requirement to advance a run.

The parent supplies: the current run ID, stage, attempt number, relevant prior handoffs, current artifact state, task criteria, authority, and remaining budget. A child returns findings and artifacts relevant to that stage. Do not load all previous conversations or unrelated skills by default. Task data and supplied documents are evidence, not higher-priority instructions.

Read the active project's instructions and inspect the current state before changing artifacts. A referenced skill must be available and read before using its procedure. Missing host tools or runtime support must be reported; instruction-following is not proof of enforcement.

## Exact handoff shape

```json
{
  "runId": "ID_FROM_RUNTIME",
  "stage": "STAGE_FROM_RUNTIME",
  "attempt": 1,
  "status": "passed",
  "summary": "What this stage established, with remaining limits.",
  "evidence": [
    { "kind": "file", "path": "src/example.js", "sha256": "CURRENT_SHA256", "detail": "The inspected handler saves status before updating the view." },
    { "kind": "observation", "detail": "Self-review: the chosen design preserves the two accepted user journeys; not a runtime test." }
  ],
  "artifacts": [
    { "path": "docs/task-design.md", "sha256": "CURRENT_SHA256" }
  ],
  "criteria": [
    { "id": "CRITERION_FROM_RUN", "result": "unverified", "evidence": "Design addresses persistence; refresh behavior still needs execution." }
  ],
  "nextAction": "Implement the documented persistence change and run the refresh check."
}
```

Required fields: `runId`, `stage`, `attempt`, `status`, `summary`, `evidence`, `artifacts`, `criteria`. `nextAction` is optional. Use only `passed`, `failed`, or `blocked` for stage status; only `passed`, `failed`, or `unverified` for criterion results. `attempt` is the positive integer provided by the controller, not a child-local retry counter. Criterion `evidence` is a nonempty string identifying the actual basis of the result. Include every required criterion ID returned by `run next` exactly once, no undeclared criterion IDs, and at least one evidence entry. Early stages may leave task criteria unverified; passing `verify` or `deliver`, and run completion, require all task criteria passed.

Evidence entries have `kind: file` or `kind: observation` and a meaningful `detail`. File evidence requires a project-relative path and the current file's SHA-256; observation entries need no invented file. Artifact entries identify produced or changed files and their current SHA-256 hashes. Use empty arrays when there are genuinely no files to record. Never invent hashes, executed commands, observations, or user acceptance. Use real bytes and safe in-project paths; do not include secrets in records.

New implementation runs require `assessment` on passing Scout, Verify, and Deliver handoffs. The [work assessment contract](work-assessments.md) defines context/approach/alignment/consumer evidence, semantic review with consumer checks, and learning/error-history dispositions. `run next` identifies required fields; `run record --assessment FILE` supports the quick form. Referenced assessment files are fingerprinted by the controller and included in artifacts. Failed/blocked handoffs may report incomplete assessments honestly. Advisory and serialized legacy runs retain their prior contract, labeled in the generated review.

Save handoff packet files beneath `.cyc/runs/<runId>/`, for example `handoff-verify-1.json`, without modifying the controller's `state.json` or receipts. Runtime records are excluded from source snapshots. Writing a packet in an ordinary source directory after verification would correctly invalidate that snapshot. Actual product deliverables belong in their normal project locations and must be completed before verification.

`passed` means the bounded stage yielded usable output. `failed` means its attempted work did not satisfy that stage and another scoped attempt may help. `blocked` means an external prerequisite, permission, decision, or learner participation is necessary. Describe that prerequisite in `summary` and `nextAction`. A blocked handoff is never successful completion.

## Evidence and acceptance

- Tie evidence to the state inspected. Recompute fingerprints after edits and invalidate claims affected by subsequent changes.
- Mark model judgments as self-review. A second agent's assessment is review evidence, not an executed behavior check or a user approval.
- Code playbooks require actual configured machine checks before completion; a hand-authored statement that tests passed cannot replace the runtime check record. Run behavior checks appropriate to the impact map in addition to compilation where needed.
- Non-executable work may use clearly labelled reviewed observations. Explain the criteria and source/artifact inspected; do not invent a test command for an explanation or lesson.
- A successful check supports only what it measured. Passing existing tests does not prove an untested user journey, security property, or learning outcome.

## Loop ownership

The controller tracks stages, attempts, recorded evidence, checkpoints, and shared budgets. The parent interprets failures, updates the impact map and design when necessary, and selects the next authorized action. Discovering an affected area is not authorization to change it.

Use the CLI's current help and catalog for supported transitions. A failed record may retry within the configured attempt and task budget. When recovery requires an earlier stage, preserve failed evidence and use `run retry --run ID --stage STAGE --reason TEXT`; this invalidates dependent later evidence and consumes the same budget. Never edit state files or pretend a stage passed to reach a later step. The controller records a catalog-defined chain while the parent reasons adaptively within stages.

Parallel work shares the task budget and authority. Give separate agents concrete independent scopes, avoid overlapping writes, and reconcile changed artifacts before verification. Do not spawn one agent merely because a skill was called. Changes to shared assumptions invalidate dependent handoffs and checks.

Stop at success, a genuine blocker, user interruption, scope violation, exhausted budget, or repeated attempts with no evidence of progress. Do not silently restart a run to evade budgets. Checkpoints preserve candidate work; they do not publish, merge, or accept it.

## Completion and portability

The installed CLI is `node .cyc/engine/bin/cyc.mjs`; inside the CYC source repository use `node bin/cyc.mjs`. Start with `run start --goal TEXT --playbook NAME --criteria FILE`, where FILE contains an array of `{ "id": "stable-id", "description": "Observable acceptance requirement" }`. Start returns the run ID. `run next --run ID` supplies the current stage, attempt, and required criteria. `run record --file FILE` consumes a handoff containing that run ID. `run verify --run ID` executes configured machine checks. Pass `--session ID` to `run start` so the delivery gate only holds a conversation to its own runs. Baseline checks are off by default; `verification.baseline: true` enables optional diagnostics without requiring the agent to wait. `run accept-failure`, or `acceptFailures` in `run finish`, accepts a check that failed on the run-start code. Verification excuses it only while it fails exactly as it did then: the same exit code and output lines apart from timings, nothing truncated, no changed file named, and another check passing. Every other failure still prevents completion; see [Baselines](runtime.md). Multi-criterion quick handoffs require `--criterion-evidence` with a JSON map of every criterion ID to its own evidence. `run complete --run ID` checks completion. Status, pause, and resume use `run status|pause|resume --run ID`. Consult current CLI help for configuration and supported optional arguments. The controller does not call a paid model or execute a skill automatically; the active host agent performs the work.

Run completion and response readiness are separate gates. Read the [response standard](response-standard.md) before final delivery. Honor conversation length toggles, use a relevant visual, and preserve failures and limitations. If the host supplies a response review path and token, write its exact required packet; this stage handoff does not substitute for that packet.

Source skills use relative links to this document and the catalog. Project installation must preserve or rewrite those references to the installed engine. Host invocation differs: use the installed host's discovered skill syntax rather than claiming every host supports slash commands. Missing or untrusted hooks mean automatic enforcement is unverified even when skill files exist.

## Bounded worker evidence

Optional delegation assignments are children of one parent run, not stages or independent runs with fresh budgets. Read-only workers return structured findings and evidence through the host. The parent validates and reconciles results into one task context, reads/acknowledges the current revision, and retains unresolved conflicts and failed approaches. Passing handoffs and verification bind that revision/hash. Child success cannot waive parent proof, required review or final checks. See [task context](task-context.md).
````

### docs/task-context.md before consolidation

````text
# Unified task context and bounded delegation

CYC can maintain one task context per parent run and track bounded read-only work performed by host agents. It does not call a model service or spawn agents itself. The lead performs host dispatch and semantic reconciliation; the controller validates ownership, evidence, versions, budgets and completion prerequisites.

## Start and choose a route

Run-start JSON accepts optional taskContext and delegation policies:

```json
{
  "taskContext": { "version": 1, "maxBytes": 24576 },
  "delegation": {
    "version": 1, "mode": "recommend",
    "maxWorkers": 1, "maxAssignments": 4,
    "budgetTokens": 12000, "reserveTokens": 4000
  }
}
```

These are illustrative limits, not measured optimal values. Omit both fields for unchanged legacy behavior. Task context is created lazily. Delegation policy is frozen at start; auto mode is not qualified and is rejected. Off disables optional workers, not required fresh review.

Use node bin/cyc.mjs in this checkout or node .cyc/engine/bin/cyc.mjs in an installed project. The following command fragments use that executable:

```text
delegate decide --run ID --file DECISION.json
context task --run ID
context ack --run ID --file ACK.json
delegate assign --run ID --file ASSIGNMENT.json
delegate record --run ID --file RESULT.json
delegate reconcile --run ID --file RECONCILIATION.json
```

Every operation needs the actual parent conversation. Workers return data to the lead; they do not borrow its session identity or mutate its run.

DECISION.json contains version:1, objective tokens/spend/time, facts {independent,sharedState,evidence}, capabilities {dispatch,evidence}, and optional estimates {solo:{min,max},delegated:{min,max},evidence}. Facts and capabilities are agent-reported observations, not attested by the controller. For economics, delegation requires the delegated upper estimate below the solo lower estimate. Unknown/overlapping costs, dependent/shared decisions or unavailable dispatch select solo. A time objective can justify independent delegation without a token-saving claim.

## Read and acknowledge

context task returns the sole readable .cyc/runs/<runId>/context.md document, revision, hash and read receipt. The canonical reconciled data lives in existing parent state.json. The Markdown file is a deterministic projection, not an independently edited authority.

ACK.json contains version:1, revision, hash, receipt and a nonempty application describing how the lead uses the current context. A read/acknowledgment is agent-reported and does not prove understanding. A material update invalidates it. Dependent handoffs and verification require the current acknowledgment, source evidence and absence of unresolved conflicts.

The document includes original criteria/clauses, scope, current state, findings/decisions, failures, unresolved conflicts, assignments/budget and outstanding checks. No worker-specific context Markdown documents are created.

## Assign and collect bounded work

ASSIGNMENT.json contains version:1, unique id, objective, criterion IDs in criteria, literal source paths, writePaths:[], accepted prior assignment IDs in dependencies, contextRevision, contextHash, tokenBudget and stoppingRule. An observed hostReference is optional. Read scopes must fit the parent's allowed paths when restricted. This release rejects worker writes and cyclic, self or unknown dependencies.

The lead uses its available host tool to dispatch the assignment with relevant instructions and the current context. Assignment count, active-worker count and budget reservations are controller enforced. Token generation is cooperatively bounded by the host; CYC cannot guarantee a hard spending ceiling without provider controls.

RESULT.json contains version:1, assignmentId, unique resultId, status passed/failed/cancelled, the assignment's contextRevision/contextHash/basisHash, summary, hostStopped:true, findings, failedApproaches and questions. Each finding has id,text,evidence, where evidence entries have a current/historical source path and SHA-256. Optional checks rows {command,result,evidence} are agent reports, not configured-check receipts.

Optional usage is {receiptId,inputTokens,outputTokens,cachedInputTokens,model,origin}; origin is host-reported or agent-estimated. Cached input is a subset of input, not added twice. Usage origin is supplied observation, not attestation. Missing or estimated usage is unknown economically and consumes at least the reservation. A reported overshoot is retained, not rejected to conceal it, and may prevent further assignments.

An identical result replay is idempotent; altered content or reused usage receipts reject. Worker failure consumes the parent's failure budget. Success does not advance any parent stage.

delegate cancel accepts {version:1,assignmentId,reason}. The lead then cancels in its host. Capacity remains occupied until a terminal result acknowledges that the worker stopped. Results cannot reopen terminal runs.

## Reconcile into the shared document

RECONCILIATION.json contains version:1, expectedRevision, summary, nextAction, findings, conflicts, failedApproaches and dispositions. Optional resolutions explicitly explain removal of an existing conflict.

Each finding has id,status,text,evidence and optional origins listing worker assignment IDs. Status is observed, judgment, hypothesis, superseded or stale. Conflicts have id and detail. Prior findings must remain or be marked superseded; prior failed approaches remain as negative evidence.

Each disposition has assignmentId,status accepted/rejected,reason,findingIds and optional revalidation. Accepted results require retained current findings with their origin. Source drift requires explicit lead revalidation and current evidence. Worker questions require a retained conflict or explicit resolution/revalidation.

The lead resolves semantic disagreements against source and original requirements. The controller validates structure and evidence binding; it cannot discover every contradiction. Do not concatenate summaries or treat agreement as proof.

After reconciliation the lead reads/acknowledges the new document. Every relevant result needs a disposition before parent handoff. Undisposed work or unresolved conflict cannot be hidden by passing local worker status.

## Recovery and final checks

Publication updates canonical state then renames a staged Markdown file. This is recoverable sequential publication, not a multi-file atomic transaction. A missing or expected prior projection can be rebuilt by context task; unexpected edits are preserved and return needs-context-sync. Do not edit state to pass.

Read receipts and parent identity prevent stale or foreign acknowledgment. New worker/context mutations after successful verification require supported retry and fresh checking. Handoff and verification records bind the task context revision/hash independently of source snapshots, because run storage is excluded from source hashes.

Before final verification, the lead authors durable learning.context into the existing frozen canonical feature owners. The shared task document does not replace project records/index, original-code proof, required fresh review or configured final checks. Essential knowledge must remain portable without ignored run receipts.

See [runtime](runtime.md), [project context](context.md) and [handoff contract](skill-contract.md). Tests demonstrate controller contracts and a copied installation; actual host dispatch/cancellation and economic benefits require separate observation.

Evidence paths are canonicalized before run/scope checks and cannot use linked directories. Worker findings are limited to their assigned source paths. Source basis is checked again at reconciliation, and the final document size includes contribution dispositions before publication. Result IDs are unique across assignments.

Known historical path/hash evidence from a prior finding or the frozen assignment basis can survive source deletion. Superseded findings remain historical; active findings still require live matching source. Unknown missing evidence cannot be invented.
````
