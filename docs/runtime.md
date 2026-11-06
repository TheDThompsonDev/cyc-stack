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
