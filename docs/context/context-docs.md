# Component context docs and their quality check

Covers: scripts/context-review.mjs, scripts/project-tools.mjs, scripts/runtime.mjs, scripts/work-review.mjs, scripts/source-snapshot.mjs, scripts/run-gate.mjs, scripts/pack-release.mjs, bin/cyc.mjs, methods/cyc-context/**, docs/context/INDEX.md, docs/context.md, test/context-review.test.mjs, test/context-changes.test.mjs, test-support/historical-runtime.test.fixture.mjs, test-support/historical-baseline.test.fixture.mjs

## Current view

Project context has three parts, all in the target project's context folder (docs/context/ unless `.cyc/config.json` `context.directory` names another).
A component doc says what is true now: title, Covers, Current view, Lessons, at most 300 lines.
The index, INDEX.md, is the table of contents: Component, Covers and Doc columns, rebuilt from the docs.
A change record under changes/ says what one completed run did and how its checks ended.

Planning and the gate (scripts/context-review.mjs, scripts/runtime.mjs):
planRetention and startRun plan each feature's doc and the index before scope freezes; a typed contextRetention plan carries disposition, feature ids, docs and representative entrypoints.
A focused existing doc is updated; distinct features get their own docs; reference guides, the index, ledger, recipes and ignored receipts are supporting evidence, never a feature doc.
Old stored runs without the contract stay historical; an old-shaped current start still receives the default plan.
New scaffolds take their Covers from the actual selected source; broad edit permission does not justify a catch-all or an unrelated directory sample.
prepareRetention writes only the authored Current view and, when given, one lesson per run and component. It writes no per-run entry.
The run state binds the view to the bytes it was written against (contextPreparation.authored: a hash of the view and of the selected source files). checkRetention refuses a scaffold, a placeholder, an unchanged view after its source changed (feature-authoring) and a doc with no selected implementation file (feature-evidence).
Missing, unindexed, nonresolving or mismapped docs stay noncomplete. Global wildcard families such as `**/*` and `src/**/*` cannot stand in for focused Covers; an actual completion probe accepted `**/*` before that guard.
Every changed, new or deleted implementation entrypoint needs a planned owner, including each indexed shared owner of the path, whatever its extension or test classification; novel non-test files need ownership too.
Advisory Markdown additions and source deletions cannot evade retention, and a routine disposition cannot add or delete files.
A doc or index edit after verification stales the checks; replacing a reply packet cannot refresh them. Preparation stages files in run storage and resumes a partial multi-doc write idempotently; the writes are sequential, not one atomic transaction.
Context-only upkeep binds existing implementation files from the focused doc's Covers; a missing owner file cannot borrow unrelated source, whatever a hand-written record lists.

Change records (publishRunChange in scripts/runtime.mjs; changeFor, publishChange, readChanges in scripts/context-review.mjs):
completeRun publishes the record after the complete event, because only completion can state how the checks ended. Before this, History was written ahead of the checks and 79 of 93 entries in this checkout could only say the outcome was not yet claimed.
The record is changes/<date>-<first 8 of run id>.md: Result with the observed check results, Completed, Proof, Changed, Learned, one line per planned component (the `changed` note from learning.context) and every changed or bound file with its full SHA-256 at completion.
It is deliberately not verified source. recordMatcher in scripts/source-snapshot.mjs exempts exactly record and digest file names under the configured folder, and only regular files: a folder, link or submodule under such a name is source. It reads the folder name as the controller does and, on Windows, without regard to case. scripts/run-gate.mjs skips the same names in the Stop change check. Publishing therefore cannot invalidate verification or trip a scope guard.
Any other file in that folder is ordinary source: lint reports change-name, checkRetention carries the folder's issues, and the scope guard halts a run that did not plan it.
The completing run owns its record. An entry for the run that it did not write is replaced, never adopted; catch-up keeps an entry that already exists. A failed write is stored as changeRecord.error and retried by the next finish; it never undoes completion.
Only runs with a required context plan publish a record; routine and advisory runs add no file.

Index, freshness and upkeep:
refreshIndex rebuilds component rows from the docs, drops the earlier Last AI change and Lessons columns, inserts a new doc's row in sorted position and keeps both sides' rows of a merge conflict, one per doc; a side that still has the earlier five-column header is read by column name, the base section of a three-way conflict is not a side, and a conflict that reaches beyond the table is refused. Reference rows, extra columns and the alignment row stay as written. `context index` compares; `--write` applies; markers left in the prose are reported, not removed.
docFreshness compares bytes, since a run that revalidates a doc without rewording it leaves its trace only in its record: a covered file committed after the doc makes it stale unless the file, as committed, is what a committed record made after the doc's last commit verified. Uncommitted edits and uncommitted records never change that answer.
recordFreshness in scripts/project-tools.mjs gives each covered file the hash of the newest entry naming the doc and checks queried paths first; row.match and row.recordEvidence keep their shapes, and every byte result stays semanticCorrectness unverified, selected-files-only.
`context review` lists completed runs without a record; `--write` publishes them from their own state and edits no doc. `--new` and `--update-run` are gone.
`context rollup` joins a month's records into changes/<YYYY-MM>.md and removes a record only after the digest holds it; an interrupted run is finished by running it again, and a record whose text differs from its digest entry stops the fold.
`context migrate` turns the History of earlier-layout docs into one entry per run; what an entry did not record stays "not recorded", what one doc said differently about a shared run goes in that doc's line, and nothing is converted while any doc cannot be converted completely.
The earlier layout (a Last changed by AI line and a History section) still parses, lints and finishes; it only stops growing.
Discovery and lint share one literal/glob grammar: bracketed route directories are literal, `*`, `**` and `?` are wildcards; traversal, foreign roots, symlinks and engine or runtime substitution are rejected. investigate always reads the target map, never the installed engine's development index.

Decisions and dead ends:
A history file beside each doc was rejected: two people in one component still append at the same place. A union merge driver fixed that locally, but hosted pull-request merges appear to ignore it (old sources, not tested live).
Git log as the only history was rejected: it cannot carry the check result or what was learned.
`context review` lost its per-component and unmapped-file diagnostics while this change was being fitted into the 1 MiB release budgets; they served the earlier doc-entry catch-up, and current runs enforce owners at finish instead. They were not restored after the budgets were raised.
Adopted decision (owner, 2026-11-11): the packed-archive budget in scripts/pack-release.mjs and the installed-engine budget asserted in test/install.test.mjs were raised from 1 MiB to 1.1 MiB. The archive had 283 bytes left before this change, and the reviewed change needed about 7.5 KB more.
A record names a doc only when the run planned it: naming a doc says the run verified the doc against the listed bytes. A record for a run that planned no doc lists files only, and the component history finds it through Covers.
A deleted file is recorded as `path@deleted`, so a doc is not drifted forever by a file a later run removed. A covered file changed outside any run stays drifted until a run that plans that path revalidates the doc.
context lint judges staleness by bytes: a covered file committed after the doc counts only if it differs from the hash the newest record naming the doc gave it, so committing a digest never makes a doc fresh.
A required one-sentence "Read when" line and per-path freshness output are not part of this change; they belong to the open audit findings on the index and on freshness noise.

Checks and limits:
Run node --test test/context-changes.test.mjs test/context-review.test.mjs test/next-release.test.mjs test/adoption-journey.test.mjs and node bin/cyc.mjs context lint.
test/context-changes.test.mjs drives real runs, a real two-branch Git merge and a real index conflict; installed disposable fixtures cover fresh context, proof, final verification and source-only transfer.
The historical-runtime.test.fixture helper seeds pre-retention states only for older gate-isolation tests; its historical-baseline wrapper holds the real worker until seeding is published, because rewriting state after start raced that worker and produced EPERM.
Installed-feature fixtures use bounded CLI finish/wait envelopes and unwrap only an observed terminal result; a direct finish does not always return within 30 seconds.
Two edits to the same line of a Current view still conflict, and two new docs whose rows are neighbors conflict in the index until `context index --write`. Merges were tested with local Git only.
A record edited by hand after publication, or written by hand for a run that never existed, is not detected; it is a plain file under review like any other. A migrated run that recorded two hashes for one file keeps both, and investigate reads the first. Structure, mapping and byte checks cannot prove a doc true, complete or adopted, and no token or time saving is claimed.
INDEX.md is itself covered by this doc, so changing a reference row advances this doc's Git freshness boundary even when no contract changed.

Kept from earlier runs that touched the shared controller files this doc covers:
workflowAdvice is limited to explicit run next; ordinary record status keeps its 3000-character budget.
Unified task context adds parent-owned read/ack and strict contribution reconciliation; read-only workers cannot complete a parent stage, reset budgets or create a context doc per worker (docs/task-context.md).
Original-byte recovery also accepts a Git-derived variant whose only difference is a final CRLF, and only when its full SHA-256 equals the frozen initial hash.
Automatic Codex execution is parent-owned: atomic assignment claim, correlated terminal cleanup, scoped text input and explicit lead reconciliation; runtime selection prefers the valid host-provided CLI over a stale PATH one.

## Lessons

- 2026-11-11 · run 7e5579da: An independent review found 15 defects after 66 focused tests passed, two of them high (paths with a space or an at-sign, and a record-named folder hidden from source), and 10 more in the fixes: review the boundary and the writer with hostile inputs before trusting green tests, and re-review fixes. Measure both the installed-engine and the packed-archive size before designing a shipped feature; t…

- 2026-11-06 · current maintenance: Context-only plans need implementation evidence from their existing focused owner; supporting files cannot hash themselves into valid History. Missing anchors must preserve repairable metadata.

- 2026-11-06 · run a81789bf: After targeted checks passed, fresh review demonstrated an omitted CSS owner. Known indexed ownership must not depend on source suffixes or test classification; keep novel-entrypoint detection separate. The repair also rejects advisory additions/deletions and requires catch-up provenance plus final checks.

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-01 · run 38888a8c: Count the same local links that discovery returns, deduplicate documents, and keep the folder-only comparison distinct from a complete reading cost. Track retention by run and component; distinguish genuinely unmapped source from lessons already saved in context or error history. Preserve newer history when catching up an older omission.

- 2026-11-01 · run 3e945303: docs/context/context-docs.md records the layout rules, how a run becomes a doc entry, the duplicated matcher and the measurement limits; docs/context-tokens-2026-11-01.md records the observed sizes. Lesson from the blocked run: the configured tests check must allow for the whole suite (the h2h fixture test alone took 356 s after the 0.6.0 fixtures), and a timed-out check cannot be accepted as pre…
