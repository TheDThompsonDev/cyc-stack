# Unified task context and delegation

state.json renders .cyc/runs/<runId>/context.md; no worker context files.

## Start and route

Optional frozen policy:

```json
{"delegation":{"version":1,"mode":"auto","maxWorkers":2,"maxAssignments":4}}
```

Modes: recommend (default), auto, off. Optional taskContext {version:1,maxBytes:24576} bounds the view.

Auto defaults to two workers; explicit one selects solo. delegate swarm {version:1,objective:"time"} plans from criteria/inventory, routes, batches concurrent work, reviews and merges/acks one context. next supplies swarmAction. Cost routing needs nonoverlapping full-route estimates; unknown favors solo. Planning/merge usage counts; model judgments prove no savings. Explicit retry:true retains terminal cycles/counters; uncertain claims reject. No hidden retries.

Token usage never interrupts workers or refuses assignments. Old budgetTokens/reserveTokens/tokenBudget inputs are optional and discarded.

Parent-only [CLI](runtime.md): --run/--file, version:1 JSON; unknown fields reject.

| Action | Input |
| --- | --- |
| delegate swarm | version:1; optional objective time/tokens/spend, model, timeoutMs,maxInputBytes |
| delegate cancel-swarm | version:1,reason; stops further generation, drains terminal outcomes |
| delegate decide | objective tokens/spend/time; facts {independent,sharedState,evidence}; capabilities {dispatch,evidence}; optional estimates {solo:{min,max},delegated:{min,max},evidence} |
| context task | Returns document, revision, hash, read receipt |
| context ack | revision, hash, receipt, application |
| delegate assign | id, objective, criteria IDs, paths, writePaths:[], dependencies, contextRevision, contextHash, stoppingRule; optional hostReference |
| delegate execute | assignmentId; optional model, timeoutMs (100–900000; default 300000), maxInputBytes (1024–262144; default 65536) |
| delegate record | assignmentId, resultId, status passed/failed/cancelled, assignment contextRevision/contextHash/basisHash, summary, hostStopped:true, findings, failedApproaches, questions; optional checks,usage |
| delegate cancel | assignmentId, reason; worker slot stays occupied until terminal acknowledgment |
| delegate reconcile | expectedRevision, summary, nextAction, findings, conflicts, failedApproaches, dispositions; optional resolutions |

Unknown/overlapping estimates favor solo; delegated upper must beat solo lower. Time may justify delegation. Estimates never ration execution.

Execute claims once; uses CODEX_APP_RUNTIME_CLI_PATH in Codex, PATH elsewhere; invalid hints reject. Account-default model gets scoped UTF-8 and acknowledged context. Read-only turns disable known execution/connectors. Scope is cooperative, not OS isolation. Lead reconciles/acks.

## Evidence and consolidation

Findings: id,text,evidence; unified findings add status observed/judgment/hypothesis/superseded/stale and origins. Evidence {path,sha256} is canonical, link-free, scoped. Active hashes must match; historical hashes may survive deletion.

Conflicts {id,detail} need resolutions {id,evidence}. Retain failedApproaches. Dispositions {assignmentId,status:accepted/rejected,reason,findingIds,revalidation?} need current findings/origins and drift revalidation. Lead checks source/criteria.

Pending contributions/conflicts, stale evidence or missing acknowledgment block handoffs/checks. Ack is not comprehension.

Merge binds source/context/result-set hashes; namespaces findings; preserves prior knowledge, origins, questions and failures. A model reviews support; conflicts block dependent work. Private transports/all-settled draining preserve siblings. Pending phases block parent handoffs. Cancel/stop/lost transport retains uncertain claims. After committed-merge I/O failure, read/ack the existing context; never regenerate it. No automatic parent completion.

## Usage and recovery

Usage {receiptId,inputTokens,outputTokens,cachedInputTokens,model,origin:host-reported/agent-estimated} is telemetry. Cached input is a subset. Missing use stays unknown; estimates stay labeled. No reservation charge. Historical counters may include estimates; receipts/observedTokens identify known usage.

Scope, dependencies, concurrency, assignment count and replay remain controlled; failures consume attempts. Explicit cancel, parent stop/pause, timeout and unexpected tools interrupt. Only matching turn/completed releases the slot. Lost transport retains the claim; never redispatch. Claimed workers require correlated host receipts.

Authentic active legacy views migrate on read; need fresh acknowledgment. Completed archives keep their bytes. Missing/expected prior projections recover; unexpected edits remain needs-context-sync. Never edit state. Later material context needs retry/reverification.

Retain [learning](context.md) before checks. Proof/review remain. Fixtures prove no activation/savings.
