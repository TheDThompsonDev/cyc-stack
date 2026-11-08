# Codex automatic delegation

The user asked for automatic delegation in Codex, including dispatch, cancellation and consolidation into one task document per run. This extends the existing assignment controller; it does not introduce per-worker context documents or replace lead judgment.

## Implementation and authority

`scripts/codex-host.mjs` connects to the Codex app-supplied runtime (`CODEX_APP_RUNTIME_CLI_PATH`) when advertised; outside the app it resolves PATH. An invalid relative, missing or directory host hint refuses fallback, so execution cannot silently switch to another CLI. It uses that runtime's stdio app server. It uses the existing account, a temporary empty working directory, an ephemeral thread, `approvalPolicy: never`, a read-only policy and disabled networking for worker tools. Known execution, connector, browsing, nested-agent and hook features are disabled for that thread. Configured MCP servers are disabled using valid transport-shaped overrides; credentials are never copied into worker packets or printed.

Only assigned UTF-8 source text, its frozen hashes, the assignment and the unified context are supplied. This is cooperative source scope, not a restricted-read OS boundary or proof that every possible Codex tool is absent. The parent owns all mutations. The subprocess receives an environment allowlist without parent conversation identity or arbitrary API-key variables. The worker cannot acquire the parent's authority merely by quoting an identity in its output.

The account-default model comes from `model/list`, rather than assuming the saved desktop model works for a separate CLI account. An explicit execute `model` overrides that choice without changing saved configuration. Catalog availability does not establish actual generation access. No automatic model retries conceal failed attempts or their budget charges.

The driver atomically claims an assignment before launching a process. A claimed assignment cannot be automatically dispatched again. Thread and turn identifiers are bound to that attempt; notifications from other threads/turns are ignored. Worker `userMessage` items are ordinary protocol activity. Unexpected execution items trigger interruption. Returned JSON still passes the existing scope, evidence, replay, size and source-drift validation.

Auto assignments retain the exact acknowledged context text in the central state ledger, bound to its hash. The driver supplies that immutable basis even if the main document later advances. This is historical assignment data, not a separate worker context file. Unexpected edits to the unified projection refuse dispatch before claiming. Parent stop/cancel/deadline is rechecked after asynchronous setup and before requesting a model turn.

Review exposed bypasses in the ordinary result writer, terminal-envelope replay and asynchronous notification handling. Claimed workers now require the correlated host receipt path. Terminal status is immutable on replay, and duplicate receipts preserve timestamps. Terminal event correlation uses canonical turn.id and rejects conflicting direct turnId. Terminal notifications are drained while interrupt requests remain pending, so a valid terminal acknowledgment survives a missing interrupt reply/transport exit. Named negative regressions cover these producer/consumer paths with the existing stop/cancel writers.

The host receipt API is separate from ordinary delegation mutations. It accepts a correlated terminal result after parent pause/stop without reopening the run or advancing its stages. Setup refusal before any turn request can record `not-started`; once a turn request could have reached Codex, transport loss remains uncertain and the worker slot stays occupied. A host receipt is a trusted local observation, not cryptographic server attestation.

## Typical sequence

Freeze `delegation: {version:1,mode:"auto",maxWorkers:1,maxAssignments:4}` at run start. Concurrency/assignment bounds are illustrative; no token cap is configured. Use exact run IDs and JSON files under `.cyc/runtime/`.

1. `delegate decide` records independence, dispatch capability and the chosen objective. Unknown or overlapping cost estimates favor solo. A time objective can justify independent work without claiming token savings.
2. `context task`, followed by `context ack`, establishes the lead's current view.
3. `delegate assign` freezes the objective, criteria, literal paths, empty writePaths, dependencies, context revision/hash and stoppingRule.
4. `delegate execute --run ID --file EXECUTE.json` launches and waits for the bounded worker. Example input: `{"version":1,"assignmentId":"inspect","timeoutMs":300000,"maxInputBytes":65536}`. Optional `model` selects a known usable CLI model.
5. The lead inspects the terminal result and source, then calls `delegate reconcile`. Accepted findings retain evidence and assignment origins. Rejected/cancelled contributions still get dispositions. Conflicts, questions, failed approaches and stale-source revalidation remain explicit.
6. Read and acknowledge the newly consolidated context before dependent work. Final configured checks, original-code proof, required review and canonical project retention still apply.

`delegate execute` automates execution of an already selected, bounded assignment. The lead still chooses the decomposition and calls the command. It is not a background service that watches all chats, invents assignments, or enables delegation in legacy runs.

## Cancellation and recovery

Use `delegate cancel` while execute is running; execute polls the assignment without holding a workspace lock across the model turn. Parent pause/stop, timeout and unexpected execution activity also request interruption. Token reports never request interruption.

`active → interrupt requested → matching terminal acknowledgment → pending reconciliation`

The response to `turn/interrupt` is insufficient. Only the matching `turn/completed` notification confirms termination. A lost transport or missing terminal acknowledgment leaves the claim and worker slot occupied; inspect retained receipts under `.cyc/runs/ID/host/` and confirm actual termination before using the existing terminal-record interface. Never edit state, reset budgets or redispatch an uncertain attempt. An already committed terminal receipt is retained even if local temporary-directory cleanup reports a separate error.

Usage notifications report input plus output, with cached input a subset. Missing usage stays unknown; estimates stay labeled. Neither reported usage nor historical budget metadata can interrupt generation or refuse another assignment. New policies and assignments omit token budgets. Old cap fields are accepted and discarded for compatibility. No synthetic token reservation is charged, and no economic advantage is inferred. Historical accounted totals may include former reservation estimates; raw receipts/observedTokens remain the known-use evidence.

## Verification and evidence boundaries

Run `node --test test/codex-host.test.mjs test/delegation.test.mjs test/delegation-journey.test.mjs`, then the configured full suite. Named tests cover one dispatch, foreign notifications/owner/receipts, cancellation acknowledgment, parent stop, lost transport, unsafe policy, invalid findings, out-of-scope evidence, usage-only reporting and a copied CLI installation. The protocol fixture is simulated; its passing result is not live generation or hook activation.

Real qualification on November7,2026 found PATH selecting npm CLI0.142.5 while the app supplied0.166.0-alpha.5.1. With the same account/model, the older runtime returned model_not_found; the app runtime completed OK with both inherited and restricted worker environments. The earlier account-access diagnosis was incorrect. No account, credentials, global configuration or installation was changed.

The repaired adapter completed actual source analysis, returned2 eligible records/total20/exact IDs0007 and0010, and reported7137 input plus254 output tokens. The lead independently parsed the source and validated the returned evidence hashes. A second dispatched worker was explicitly interrupted; capacity stayed reserved until matching terminal acknowledgment. Accepted source findings and the rejected cancellation contribution were reconciled into one acknowledged context at revision9. Qualification run 84cdc3b4-cf9e-4a90-9875-9aaf5bd05920 completed. This verifies the live local flow, not native-hook activation or economic savings.

Tests include two resolver regressions that failed before repair: host-runtime preference over stale PATH, and fail-closed invalid host hints. PATH-only copied-install fixtures explicitly clear the app hint so they cannot accidentally call a live model.

To retain the unchanged release budget, repeated SVG presentation attributes were moved to generated CSS and redundant first spans/default declarations removed. All three affected SVGs rendered to identical raw pixels before/after using Sharp. Generator output uses the same compaction; no visual content or release ceiling was removed.

Official protocol: [Codex App Server](https://learn.chatgpt.com/docs/app-server), including `turn/start`, `turn/interrupt`, terminal notifications and reported token usage. The installed version's generated schema is retained locally under `.cyc/runtime/codex-schema`; newer documented restricted-read fields are absent there and are not assumed supported.

## Token-cap correction

The user explicitly rejected token caps. Token optimization means economical routing and truthful reporting, not stopping work after a token amount. The initial implementation incorrectly combined these; per-worker usage interruption, cumulative admission/reserve checks and mandatory token amounts are removed. Existing explicit cancellation, concurrency, scope and independent timeout/failure controls remain. The worker ignores legacy token-budget data.

The shared view now displays usage without caps. A new usageOnly presentation marker preserves the exact historical renderer for existing hashes. Reading an authentic active legacy view repairs an expected prior/missing projection first, migrates to the new view, advances revision and requires fresh acknowledgment. Unexpected edits reject before migration; completed archives remain unchanged. Capture previousHash before usage mutations so legitimate usage updates publish correctly.

## Automatic swarm orchestration

Use one parent command: delegate swarm --run ID --file INPUT.json. Minimal input is {"version":1,"objective":"time"}. Optional model, timeoutMs and maxInputBytes use existing execution limits. Optional retry:true is an explicit new cycle only after known terminal phases and disposed worker contributions; prior cycles remain in delegation.swarmHistory. Usage, failure/assignment counts and identities never reset. A normal repeated call rejects, and uncertain claims forbid retry. No generation retry is hidden.

Freeze delegation mode auto at Start. New auto policies default to two workers; explicitly frozen one selects solo without a model call. Off/recommend and manual decide/assign/execute/reconcile remain supported. next supplies swarmAction and the input file during early work; the CYC skill follows it. This is the host's task workflow, not a background service watching unrelated chats.

scripts/swarm.mjs owns the parent decision/batch/reconciliation rules and orchestration. runtime.mjs supplies owned serial transactions and separate phase-host claims/receipts. codex-host.mjs reuses one schema-driven lifecycle for plan, work and merge, with a private CodexRPC per operation. Model calls run outside workspace locks. Planning and review are separate operations, never fabricated worker assignments or forced delegation decisions.

The planner gets the goal/criteria, acknowledged task context and only scoped file metadata (path/hash/byte size). Its structured output proposes independent tasks and full-route estimates. Task criteria and paths are enums bound to the real run, IDs have a bounded grammar, task count respects frozen capacity. Parent validation independently rejects foreign scope/criteria, duplicates and stale source/context. Batch validation uses the same acknowledged snapshot for every assignment and commits all assignments once, never a partial list. Workers remain read-only. Parallel executions use Promise.allSettled, so an early failure does not conceal live siblings or discard terminal outcomes.

For tokens/spend, unknown/overlapping estimates select solo; delegated upper must beat solo lower. Time routing may justify independent work without demonstrated token savings. Estimates include planning, briefing, duplicated context, execution and review, and remain model judgments. The qualification below verifies mechanisms, not optimal decomposition or measured economic advantage. All phase/worker usage is reported once; counts never stop work.

After every worker terminal result, a separate source-grounded model reviews each contribution. Review IDs are constrained to the exact contribution set. Source, context and result-set hashes bind the proposal. The parent deterministically namespaces worker-local finding IDs, retains original source evidence/origins, keeps prior findings and failed approaches, and turns unanswered questions/uncertainty into explicit conflicts. Returned model fields cannot replace criteria, authority, prior facts, proof or completion. Supported contributions are retained as judgments; model agreement is not independent factual proof. Conflicts block dependent work. Successful merge is followed by a current read/ack; acknowledgment is not comprehension. Exactly one context.md is maintained per run; role snapshots/receipts stay centrally in state/host records.

Pending planning/assignment/merge phases block parent handoffs/checks, including the initial planner window before any worker exists. Internal phase claims use their own explicit state guards. Cancellation uses delegate cancel-swarm with {"version":1,"reason":"..."}; parent pause/stop and existing execution/tool controls remain. Interrupt replies alone release no capacity. Matching terminal cleanup remains valid after parent stop; uncertain transport outcomes cannot be redispatched. Cancelled results remain inspectable for deliberate parent recovery; automation never completes a parent stage.

A committed merge carries its context revision/hash. Final read/ack failure returns needs-context-ack (or the actual nonrunning parent status) with committed:true, rather than failing/repeating already committed work. Recover through context task/ack on the existing document. On Windows, atomicJSON retries only the same staged rename after EPERM/EBUSY, at most three attempts with20/40ms waits; other errors and persistent failures remain errors. It never repeats the transaction or model call.

Actual qualification 2daa0bf7-f48d-43d9-8a09-1370b1d880bb completed. The planner selected two module audits; both real bound turns preceded either terminal receipt (8728ms observed overlap). Generated host-correlation and usage-accounting findings were reviewed/merged automatically, then independently checked by the lead against the two source files and hashes. One revision9 context was acknowledged.57450 reported tokens include the failed first planner; no old cap stopped generation. Initial freeform criterion prose was safely rejected before assignments. Fixed enums exposed a shared-descriptor aliasing mistake; independent schema leaves repaired it and the named regression passed. A Windows lock-publication error after merge required local read/ack recovery; same qualification preserved both failures, original cycle and all receipts. Recovery requested no new model turn. This is not a claim of an uninterrupted live command or native-hook activation.

Separate real cancellation qualification 99de159c-60b9-4e26-aa7f-fb64e4889c34 completed: a bound planner was explicitly interrupted, a matching interrupted terminal was retained, and zero downstream workers/merge turns started. No failure counter or token reset was used.

Tests: test/swarm.test.mjs and test/swarm-journey.test.mjs exercise source/criteria enums, atomic batch/private overlap barriers, conservative routing, scope/owner/stale-result guards, prior/question/failure retention, parent-stage blocking, cancel/stop/lost transport, explicit retry/history, same-rename fault handling and post-commit acknowledgment recovery. Initial interface/schema/I/O/handoff reds and focused greens remain in local receipts. Final focused/proof/fresh-review/broad receipts belong to feature run 318f64bc-134d-46b7-865e-6903d3d71494; inspect those separately for final outcomes. Agent-authored evidence is not user acceptance.

The unchanged1MiB distribution ceiling is retained. Workflow/installation guides were condensed while preserving every original heading/anchor/link target, both workflow Mermaid blocks and operational contracts. Full original explanations remain in source-only labeled reference snapshots. package.json.files ships the new module and continues to drive copied installation.

Protocol sources: [App Server turns](https://learn.chatgpt.com/docs/app-server#turns) and [Structured Outputs properties](https://developers.openai.com/api/docs/guides/structured-outputs#supported-properties). Installed runtime behavior and real account qualification remain the evidence for local availability.
