# CYC execution controller

The controller tracks a task through the catalog's skill stages, validates recorded handoffs, runs configured project checks, and refuses unsupported completion. The existing AI host reads and performs the skills. CYC does not launch model calls, create paid agent fleets, or infer authorization to publish work.

New implementation runs (routes containing Build) record work assessment contract v1. Scout must account for context freshness, existing functionality, alignment, and affected consumers. Verify must record semantic review and consumer checks. Deliver must account for retained learning and the selected error ledger. These are fields in existing handoffs, not new stages. See [assessment examples and the knowledge lifecycle](work-assessments.md). Advisory routes and legacy runs retain their prior handoffs and are explicitly labeled.

## Start with a project and criteria

From an installed project use `node .cyc/engine/bin/cyc.mjs`; inside the CYC source checkout use `node bin/cyc.mjs`. Add `--project PATH` when working from elsewhere. Without that option the CLI looks for `.cyc/config.json` in the current directory and its parents.

Create explicit acceptance criteria before starting a substantial run:

```json
[
  { "id": "complete", "description": "Marking one assignment finished moves only that assignment." },
  { "id": "persist", "description": "Refreshing preserves its finished status." },
  { "id": "count", "description": "The remaining-assignment count stays consistent." }
]
```

These are illustrative requirements; discover the actual project behavior before adopting them. Save this file before starting the run or beneath an excluded runtime location. Ordinary project files created later count as source changes.

```text
node .cyc/engine/bin/cyc.mjs run start --goal "Add assignment completion" --playbook feature --criterion "Finished work leaves the active list" --criterion "Survives reload" --session <ID> --scope src --scope test
```

Each `--criterion` becomes a separate acceptance criterion (`c1`, `c2`, …); `--criteria FILE` accepts a JSON array instead. `--session` ties the run to the conversation that started it (the ID comes from the CYC gate context), so another conversation's run status does not block this conversation's completion gate. A native host session ID that has hook state in this project is stored as that conversation's gate key. Controller operations sharing one working folder are serialized as described below.

### Structured input without shell quoting

Prefer JSON-file input for generated metadata, multiline text, quotes, or literal shell characters. `run start --file START.json` accepts this object; `--project PATH` selects the project independently:

```json
{
  "goal": "Repair saved customer status\nPreserve compatibility.",
  "playbook": "bug-fix",
  "criteria": [{"id": "reload", "description": "Saved status survives reload."}],
  "allowedPaths": ["src", "test"],
  "session": "CURRENT_SESSION_ID"
}
```

Save input under `.cyc/runtime/` before starting. `run start --file START.json` also accepts `scout` (the filled Scout assessment) with `plan` (a short approach summary), and records Scout in the same call; an invalid scout creates no run. `run finish --file FINISH.json` accepts `summary`, `assessment` (the filled Verify/Deliver object), `criterionEvidence` (an object mapping criterion IDs to strings), and optional `runId` and `artifacts` (path array). Run commands without `--run` use the single active run in the project, narrowed by `--session` when given, and name the candidates when several are active. JSON input tolerates a byte-order mark and single backslashes in Windows paths. Only invalid escapes are repaired, so a path such as `C:\new` still reads its `\n` as a newline; prefer forward slashes. Paths may use backslashes or be absolute inside the project. Assessments accept `resolution` for a finding's `status`, `fixed` for `resolved`, `reason` for a finding's `evidence`, `pass` for `passed`, and empty lists where a `none` status implies them. Evidence text and findings are never filled in. `passedEvidence` remains available for a single criterion. Use the actual fields returned by `run next`; this abbreviated shape is not a ready assessment:

```json
{
  "runId": "ACTUAL_RUN_ID",
  "summary": "Reload preserves status; live host activation unverified.",
  "criterionEvidence": {"reload": "Named reload regression passes."},
  "assessment": {},
  "artifacts": ["src/store.py", "test/test_store.py"]
}
```

The ordinary stage assessment still applies. Unknown envelope fields, non-object JSON, invalid field types and mixed field flags are rejected before invoking the controller. Do not mix `--file` with `--goal`, `--summary`, or assessment/evidence flags; a matching `--run` is allowed for finish. JSON cannot override project configuration, commands, budgets, or protected paths. Existing argument-based commands and `run record --file` remain available.

Most build playbooks are fast: **scout → build → verify → deliver**. Scout replaces frame, understand, impact, and design with one parallel pass and a short plan. The plan, explore, teach, and evaluate playbooks keep the detailed chain.

Repeated `--scope` arguments and structured `allowedPaths` use literal project-relative files or directory prefixes, such as `src/parser.py` and `tests/test_parser.py`. Translate a task brief's `src/*.py` notation into the actual permitted files or already-authorized directory prefixes; do not broaden task permissions. These entries restrict net changes accepted by the source guard, and do not restrict the operating system's write permissions. Omit scope only when the task legitimately needs project-wide changes. The controller returns a run ID; use that exact ID for subsequent operations. Criteria omitted at start default to an inferred goal criterion, which the state labels as inferred rather than pretending detailed acceptance was established.

The same literal-path rule applies to `protectedPaths` and `context.ledgerPath`. Startup rejects a `*` or `?` component that does not already name a literal filesystem entry, before creating a run, workspace lock, Git snapshot or original-source capture. The error asks for explicit permitted paths; no patterns are expanded. Existing POSIX names containing those characters remain literal. Bracketed routes such as `routes/[id]`, spaces, Unicode and ordinary future paths remain valid. A permitted missing ordinary path may be intentional, so this is not a general typo detector. Stored older runs keep their frozen literal scopes and guards; no failed run is widened or reset by this validation.


## Move through the recorded stages

`run next` includes read-only tool hints at Scout/Understand/Impact and recipe-list hints at Build/Verify. Use [project tools](project-tools.md) to select context and applicable project checks from the run's changed paths or declared scope. Recipe execution retains diagnostic evidence outside covered source; it cannot advance stages, reset budgets, or replace the required command/test-proof gates.

| Command | Result |
| --- | --- |
| `run next --run ID` | Current stage, attempt, required criteria, skill location, and recent feedback |
| `run record --run ID --summary TEXT [--artifact PATH...] [--criteria-passed EVIDENCE] [--status failed\|blocked]` | One-line handoff: the controller fills stage, attempt, and criteria and hashes the artifacts itself. Verify and deliver need evidence: `--criteria-passed TEXT` for one criterion; `--criterion-evidence JSON` mapping every ID to its own evidence for multiple criteria |
| `run record --file FILE` | Full form: validate and record a hand-written handoff |
| `run record ... --assessment FILE` | Add the required stage assessment to a quick handoff; assessment artifact hashes are computed by the controller |
| `run review --run ID` | Refresh `.cyc/runs/ID/review.md` from the recorded evidence and current source; reuse for developer review and authorized PRs |
| `run verify --run ID` | Execute configured project checks and retain their receipt |
| `run prove-red --run ID [--tests PATH...]` | Run configured checks with new or changed tests against exact run-start code recovered from the recorded Git base and/or source capture, then restore the candidate bytes that CYC still owns, halting with backups if unexpected edits are detected. Bug fixes and features need a check that fails there while the original control passes; refactors need the new tests to pass there. Test paths (`test/`, `*.test.*`, `*_test.go`, `test_*.py`, ...) are detected or named with `--tests`. Missing/corrupt needed originals are refused before source changes |
| `run finish --run ID --summary TEXT --assessment FILE --criterion-evidence JSON [--artifact PATH...]` | From Build or Verify, in order: refuse incomplete evidence or assessments before running anything; record Build; run `prove-red` when the proof is missing or outdated and no exemption is given; run the checks; record Verify and Deliver from one assessment file; complete; and, in Claude Code and Codex, write this request's review packet from the run's record (`packet` in the result). Artifacts default to the files changed since run start. A failed proof stops with its verdict. A failed check is recorded as a normal failed attempt and nothing else is recorded. Any later refusal names the step it stopped at and leaves the run there for an ordinary `run record`. If a step halts the run, for example because a protected file or a file outside `allowedPaths` changed, finish stops there and returns `failedAt`, the files, and whether Verify was recorded. With `--file`, a test proof exemption may be given as top-level `testProof` or as `assessment.testProof`, not both with different values. From Deliver: record Deliver and complete |
| `run retry --run ID --stage STAGE --reason TEXT` | Return to the current or an earlier stage within the shared budget. In fast playbooks, `frame`, `understand`, `impact`, and `design` map to `scout` |
| `run accept-failure --run ID --check ID --reason TEXT` | Accept a check that already failed on the run-start code, measured by an opt-in baseline or the proof's control run. Also available as `acceptFailures` in `run finish`. Verification then passes only if that check fails the same way (see Baselines) |
| `run status --run ID` | Read the complete current state and history (other commands print a compact summary; add `--verbose` for full output) |
| `readiness --session ID [--since ISO_TIMESTAMP]` | Read current-request controller statuses before delivery. Uses this session's hook `updatedAt` when available; otherwise requires an explicit non-future timestamp. An explicit window is diagnostic and can omit work if chosen incorrectly. Reports no host activation or source-quality guarantee |
| `run recover --run ID` | Read-only explanation of current constraints, historical check results, preserved work and the next justified action; does not resume or reset a run |
| `run pause --run ID` | Preserve a running task as paused |
| `run resume --run ID` | Resume a paused or blocked task without resetting its budget |
| `run stop --run ID` | End the run without claiming success |
| `run complete --run ID` | Check that every stage and required completion condition passed |

The active host agent reads the current skill, performs its bounded work, and writes the [handoff contract](skill-contract.md). Save packet files beneath `.cyc/runs/ID/`, not beside application source. Do not modify controller state or verification receipts. The response hook has a separate packet format; neither packet substitutes for the other.

`run next` exposes `assessmentRequired`, an `assessmentTemplate` to fill in (at Verify it covers Verify and Deliver, with consumer checks prefilled from Scout, and `finishWith` shows the call), `workContractVersion`, and `reviewPath`. Both list only the fields the agent must judge. The controller records the rest when they are left out, and says so in each one's reason: `learning` as none, `errorHistory` as none for a run that is not a bug fix and has no failed attempt, and Scout's `context` as none when the project has no `docs/context/INDEX.md` and no ledger. A bug fix's error history, consumer checks and the semantic review always come from the agent. Once the run reaches finishing, the whole finish input is also written once to `.cyc/runs/ID/finish-template.json`. The agent's edits to it are never overwritten; while it is untouched, a run-start baseline that finds a failing check adds that check to its `acceptFailures` with a placeholder reason. The compact CLI output then shows `finishTemplate` first and prints the inline template only with `--verbose`. Any leftover `<placeholder>` value or `a | b` choice is rejected, so a template submitted unedited never passes. The generated review updates at recorded mutations and preserves recovery history while dropping invalidated later assessments. Refresh it after external edits to mark stale results. It lives outside covered source; durable context/ledger files do not. Finish intended project documentation edits before final verification. Pending acceptance uses a referenced run-local draft, never invented approval. The Deliver handoff also records `contextDocs`: the component docs under `docs/context/` among the artifacts and `learning.artifacts`, printed in `review.md` and read by `cyc context review`, which proposes a component doc entry from a completed run's record ([project tools](project-tools.md#component-context-docs)). A passing Verify handoff's semantic review is tied to its source snapshot; later source changes require retrying Verify even if commands have since passed again.

Pass every configured criterion ID exactly once in each handoff. Early stages can honestly mark task criteria unverified. Passing verification or delivery requires all criteria passed. A successful early stage means its local output is usable, not that the whole feature already works.

## Configure meaningful executable checks

Use `onboard` to inspect setup and locate project evidence sources. After reviewing and authorizing configured commands, `onboard --verify` executes them once and saves a source/configuration-bound diagnostic receipt. This does not replace `run verify`, establish a baseline for `run accept-failure`, or confirm live host activation. See [guided onboarding and recovery](onboarding-recovery.md).

Before starting a code run, configure actual project checks in `.cyc/config.json`:

```json
{
  "schemaVersion": 1,
  "limits": {
    "maxAttempts": 3,
    "maxNoProgress": 2
  },
  "verification": {
    "commands": [
      {
        "id": "tests",
        "command": "node",
        "args": ["--test"],
        "timeoutMs": 900000
      }
    ]
  },
  "protectedPaths": []
}
```

Use the project's own executable and arguments; this Node example does not imply another language's project must use Node tests. Commands run without shell interpolation, with the project as working directory. On Windows, use an actual executable or explicitly invoke the project's intended runner rather than assuming shell aliases resolve. Inspect commands for intended side effects before authorizing their execution.

Configuration is captured at run start, and `.cyc/config.json` is protected against changes during that run. Additional `protectedPaths` are separately fingerprinted even when ordinary source snapshots exclude their directory. Do not weaken checks mid-run to obtain a green result. A legitimate configuration correction requires an explicitly explained new run, preserving the earlier outcome rather than hiding it.

A check without `timeoutMs` may run for 30 minutes, the same default for configured and package-declared checks; the receipt records the limit it ran under. A check that runs out of time is stopped together with the processes it started, and fails with an error naming its limit and how to raise it; one cut short by the run's own deadline (`limits.maxDurationMs`) says so instead. Each check runs through a small Node helper that copies its output to temporary files outside the project, at most 64 MB per stream plus a rolling tail, and removes them afterwards, so output size never fails a check and a check that prints without end cannot fill the disk. The helper is a generated CommonJS file, run without `NODE_OPTIONS` so a preload cannot break it (the check still gets them). It stops the check if the controller ends, calls `taskkill` by its full path on Windows, and reports a check that exits while a process it started still holds its output two seconds later. Without a writable system temp folder, the files go to `.cyc/runtime/checks`. The optional run-start baseline runs checks while holding the operation lock, so a hung check without `timeoutMs` can block other controller commands for up to 30 minutes; give checks that may hang a `timeoutMs`.

Receipts contain the commands, exit status, bounded output, execution errors, and source fingerprint. Successful execution and an unchanged covered source snapshot are required for a passing receipt. A command that rewrites covered source does not establish verification of a stable candidate; finalize generated artifacts first or select a check that does not mutate the candidate.

The runtime cannot judge whether a command is meaningful. `node -e "process.exit(0)"` would not test a feature, even though it exits successfully. Choose checks that exercise the promised behavior and affected consumers. Distinguish existing suite coverage from additional manual observations.

## Recovery and budgets

There is no wall-clock deadline by default: a long task may take as long as it needs. The loop is bounded by failed attempts (`maxAttempts`, default 3) and repeated unchanged failures (`maxNoProgress`, default 2). A project can opt into a deadline with `limits.maxDurationMs`.

Baseline checks are **off by default**. Final verification still runs every configured command. Set `verification.baseline: true` only for optional diagnostic background measurements; never wait for these before editing. If covered files change while they run, the baseline is invalid. A matching source/command cache is diagnostic evidence only and may not reflect a changed external service. `run accept-failure` takes the baseline from that measurement when it is complete. Otherwise it uses the proof's control run, which ran every check on the run-start code. Only bug fixes and features have one; refactors, exempt proofs and other playbooks need `verification.baseline: true` set before the run.

**When the proof skips its control run.** The control run measures the run-start code so that a failure the new tests cause can be told from one that was already there. It cannot change the verdict in two cases, and finish then runs the suite twice (treatment and verify) instead of three times:
- the treatment passes every check, so the new tests would not catch the change; or
- the change only adds new test files (no existing test file is edited, moved or deleted), and every failure in the treatment is in those files, matched by exact project path, with TAP, mocha or jest output complete enough to name the failing tests and nothing else printed. The treatment is then exactly the run-start suite plus the new files, so the run-start suite alone can only pass.

A test added to an existing test file, a moved or deleted test file, a check that prints no test names (lint, a template check) or anything besides test results (a coverage line, a warning), and output cut short all run the control as before. Test titles are never matched against source text: an edited file can hide a data-driven or renamed old failure behind any title. The proof receipt records `controlSource`. After a skipped control, the treatment has shown every check passing on the run-start code apart from the new files: a finish `acceptFailures` entry is dropped as unnecessary, and `run accept-failure` refuses, since a failure now is a regression.

With a run-start baseline, a check that failed there is also listed in the run's `finish-template.json` as an `acceptFailures` entry with a placeholder reason, while the agent has not edited that file, so the agent decides before finishing instead of finding out at verify. Finish refuses a placeholder reason before running anything. A finish entry for a check that passed at run start is dropped with a note in `droppedAcceptFailures`; verify still requires that check to pass.

An accepted check that still fails does not block completion if it fails exactly as it did on the run-start code, and at least one check passes. "Exactly" means:
- the same exit code and error;
- the same set of output lines, with only timestamps, clock times, durations, and the process ID in node warnings such as `(node:12316)` ignored;
- neither output cut off: each stream keeps its last 32,000 characters, so longer output can be compared only test by test (below), and only when a test failed at the run start;
- no file the run changed named in the output.

The receipt marks verification `passed-with-accepted-failures`, `review.md` lists each accepted failure with its reason, and `run finish` returns them for the reply to name. A suite can contain both old and new failures, so any of the following leaves the check **unverified** and blocks:
- a new or lost line, such as a new failing test, a new lint error, or a version number that moved;
- a different exit code or a hang;
- truncated output;
- a mention of a changed file;
- a check that printed nothing at the run start.

`acceptedFailuresThatChanged` in the verify output says which of these applied. When verification fails, `failedAtRunStart` lists the failing checks that also failed in the run-start measurement and are not accepted yet. The CLI hint shows the `acceptFailures` entry to add if they are unrelated.

If those checks are the only failures, and each fails exactly as it did then, the stop is logged as `awaiting-acceptance`: a decision still to make, not a failed fix. Once per run, such a stop does not count against the failure budget or require error history. Every later stop counts, whatever changed, so the loop stays bounded. The CLI's accept hint appears only on that stop; otherwise the recovery instruction leads.

Test runner output is compared by test instead of by line, because the new tests add passing lines to the suite. `scripts/test-output.mjs` reads TAP (`node --test`, `tap`), mocha (any reporter: it reads the numbered failures after "N passing"), and jest. Failing tests are keyed by their file and their name under parent suites, and counted. The file comes from the failure's `location` in TAP, a subtest named after a test file for `tap`, the `Context.<anonymous>` stack frame for mocha, and the `FAIL` line for jest. Suites, `describe` groups, and skipped, pending, or todo tests are not tests, and jest's `● Console` is output, not a test. The report is read from the stream the runner writes it to (jest uses stderr, the others stdout); every line of the other stream is other output. TAP is tried first only when the output declares `TAP version`, so a stray `ok` line does not hide a mocha or jest report.

When a check prints more than the 32,000 characters kept per stream, the whole output is read as the check finishes, and its results are kept whole with the receipt: every failing test with all of its details, the passing count, and every other line. Up to 64 MB of each stream is kept for this; past that only the tail is kept and the results count as cut off, while the exit code still decides whether the check passed. A summary over 4,000,000 characters keeps only counts and also counts as cut off. An accepted check whose output a reader recognizes, and which had a failing test at the run start, is excused if all of these hold:
- no test fails that did not fail at the run start, and none fails more often;
- every old failure still has the same error;
- no failure's stack or error names a changed source file;
- every line that is not a test result, plan, summary, or failure diagnostic also appeared then;
- at least one of its tests passes.

The proof uses the same names, because its two runs differ only by the new tests. A failure counts as a new test failing on the original code only if all of these hold:
- it sits in a changed test file;
- it is not an old failure renamed or wrapped in place;
- neither output was cut off without a complete summary.

This works even when the suite already failed for an older test, and `proofClaim` names those tests.

Other output, such as node's dot reporter, and output whose run-start failure was not a test (a coverage threshold, say), is compared by whole output, so it cannot be excused once it is longer than the kept tail. A runner that reports only counts cannot reveal a new failure, so give such checks a reporter that names failures. Report a blocker rather than changing checks to force completion.

With no configured commands, a declared npm test whose package defines `pretest` or `posttest` runs each hook as its own check around `npm test --ignore-scripts`. A posttest that already fails, such as lint or a template check, then leaves the test runner as a check that passes on the run-start code, which the proof needs. `--ignore-scripts` also skips the hooks of npm scripts that the test script runs. So npm test stays whole when any script it reaches has its own hooks, or when it uses a script runner such as `run-s` or `concurrently`.

Failures across all stages share one budget. A failed handoff or failed verification consumes that budget; moving to an earlier stage does not provide a fresh allowance. Repeated unchanged failure signatures can exhaust the no-progress threshold sooner. This signature comparison is a heuristic, not a semantic judgment that all meaningful progress has stopped.

Recovery invalidates dependent later handoffs and verification. The attempt identifier advances across stages and recovery, so a packet from an earlier visit to the same stage cannot be replayed. Read the current value from `run next`; do not calculate it yourself. Pause/resume preserves any configured wall-clock deadline and invalidates executable verification so resumed work must be checked again. The controller checks budgets when an operation advances work; it does not continuously monitor a host agent between calls or terminate that agent.

States distinguish running, paused, blocked, complete, exhausted, halted, and stopped. A blocker is an external prerequisite or needed participation, not a successful outcome. A halted guard preserves changes for review rather than rolling them back. Starting a new run must be an explicit task decision, not an automatic escape from a failed budget.

### Shared working-folder ownership

Controller starts, verification/proof, handoffs, review updates and optional baseline measurements use an exclusive project-local operation record at `.cyc/runs/workspace.lock`. A second controller operation is refused before checks, run writes or failure-budget use; independent working folders remain independent. Existing per-run locks remain. A busy optional baseline records an unavailable diagnostic instead of measuring temporary source. Startup releases ownership before launching its baseline. Read-only recovery reports the owner and defers source interpretation. This is separate from session ownership in the completion gate.

Proof writes its candidate backup and manifest outside test discovery, then publishes the backup path, candidate source hash and prepared phase in the operation record before replacing source. At phase boundaries and restoration, it compares temporary files with the bytes CYC last placed. A detected edit, deletion, path-type change, restoration error or final source mismatch halts the run, clears current proof/verification and retains the candidate backup. Unexpected regular bytes are also copied into that backup when possible; copy/manifest errors remain disclosed. Other owned paths are restored independently. No successful proof receipt is issued for a conflict. `run recover` and the generated review name the retained evidence and require deliberate comparison/merge; a halted run cannot resume.

Both locks record the owner's process ID, host name, operating system and, on Linux, process ID namespace, so a container or WSL that shares the host name and the folder is never judged by process IDs it cannot see. The next controller operation reclaims a lock only when it was taken in this same place, is not the current process, its process is no longer running (only "no such process" counts as ended), and it was idle when it ended. Idle means no commit under way (both locks record one before it starts, so a failure whose own record cannot be written still leaves the lock kept), no proof with swapped or halted source (a backup pointer in any phase but `restored`), no publication failure, and no phase this engine does not know. While a check runs, the operation lock also records until when it may run, and the lock is not reclaimed before then: on Windows a check started through `cmd` or another program can outlive a controller killed by force. If that record cannot be written, for example while a scanner holds the lock file, the check still runs and the lock only lacks this protection. Reclaiming a lock left by a run-start measurement records that measurement as failed, so the run stops waiting for it. A reclaimer first creates an exclusive `<lock>.reclaim` guard, then removes the lock only if it still holds exactly the owner record it judged; another process reclaiming at the same moment is refused as busy, and a lock written by a newer operation is left alone. Each reclaim is appended to `.cyc/runs/lock-reclaims.jsonl` with the old owner record. A process ID the system has reused for another program reads as alive, which only ever keeps a lock. Every other lock stays for the operator, and the busy error says why: another host or namespace, an older engine without a host name, an empty or partly written record, a commit or proof that may not have completed, a check that may still be running, or a guard left by a reclaimer that crashed, with that guard's process and whether it still runs.

So a killed proof still leaves the operation and per-run locks plus the pre-published backup pointer. Recovery performs no automatic rollback. Confirm the owner has stopped, preserve current files and locks, inspect the backup manifest and compare versions before deliberate operator cleanup. Never clear locks or rewrite state merely to obtain completion. A restored phase records completed source restoration; a remaining backup may already have been removed after that point.

If committing run state or publishing its generated review fails, both operation and per-run locks remain. The owner record retains the backup pointer and, when writable, a publication failure identifying whether state was saved; the run lock records the same failure. Both already record the commit under way, so neither lock is reclaimed as merely abandoned even when the failure record cannot be written. Read-only recovery treats earlier passing fields as unverified, names the retained evidence and warns that the old review may be stale. It does not publish the staged outcome, clear locks or resume the run automatically. A prior durable backup pointer still remains if the later failure record itself cannot be written.

This coordination covers controller operations and baseline measurement, not arbitrary editors, external tools or independent recipe invocations. Recipes still use the configured runner directly, including recipes intentionally called by a controller command; coordinate separate invocations yourself. Byte checks are not an atomic filesystem compare-and-swap and cannot rule out a write between observation and replacement or through an existing open handle. Use a quiescent, isolated working folder for proof when other actors could write. Local editable locks are workflow coordination, not an access-control or enterprise attestation boundary.

## What the controller establishes—and what it does not

It checks matching run/stage/attempt identity, criterion preservation, evidence presence, current declared file hashes, configured command outcomes, covered source stability, scope guards, and budgets. Non-executable playbooks can complete with clearly labelled agent-reviewed observations; they do not receive invented machine-verification claims.

Evidence quality still needs judgment. The controller cannot prove an observation is truthful, discover every omitted artifact, establish user acceptance, or guarantee that a test measured the desired result. Skill validation checks document structure, not teaching quality or engineering effectiveness.

The source guard compares project state at checkpoints. It is not a filesystem sandbox. Git projects select tracked files plus untracked files not ignored by Git; tracked files remain covered even when ignore rules or `source.exclude` match them. CYC's own runtime/run/engine directories and Git metadata are always outside ordinary snapshots. Untracked dependency/build directories and untracked `.env` secrets are excluded. Tracked secrets remain tracked source: do not commit secrets.

### Run-start originals

New bug-fix, feature and refactor runs retain selected originals needed for later proof. A successfully recorded Git working-tree base supplies ordinary tracked files; the existing source scan reuses Git index flags without another inventory scan. Files marked assume-unchanged or skip-worktree are captured because Git can omit their working bytes even when the snapshot command succeeds. Other permitted regular originals are captured as extensionless hash-named blobs in `.cyc/runs/ID/original-source/`, with a `sourceCapture` record in state. If Git cannot record that working tree, capture supplies the permitted selected bytes instead of assuming HEAD matches. This includes permitted ignored inputs explicitly selected through `source.include`; excluded untracked secrets, links, protected files and source outside task scope are not copied. Git source-selection failures still refuse startup rather than silently scanning ignored files.

Proof accepts recovered filtered or raw Git bytes only when they match the recorded original SHA exactly. For manually held CRLF bytes that disagree with current Git line-ending attributes, it may try a byte-preserving CRLF reconstruction under that same hash check. Equivalent normalized text is insufficient: unreconstructable mixed endings or other filters still refuse proof. This does not rewrite original hashes, captured-file lists or older run state.

Without a Git commit or Git repository, capture supplies the permitted selected originals, so new runs still require a current proof. Narrow `allowedPaths` to the actual task: unrestricted plain projects can capture all covered regular source. Capture holds originals in memory until the run is recorded, so it has its own limit of 20,000 files and 128 MiB, below the selected-source limits; a larger plain project must narrow `allowedPaths` or commit so Git keeps the originals. Equal bytes within a run share one blob. This is working evidence stored separately from the installed engine, not a complete checkout backup or an automatic retention/pruning policy.

Captured bytes must match the initial source hashes before the run is recorded and again when used for proof. Protected run storage, including demonstrated junction/casing aliases, is rejected before new records/blobs. Proof keeps the configured commands and working folder; its temporary restoration backup remains outside test discovery. The receipt binds the original source hash, control/treatment results and current test hashes. As before, it establishes a check-level result, not that every new test detects the defect.

Existing serialized runs keep their original recovery contract. They do not gain a capture after editing; an older null-base run remains unavailable, and an older untracked file may remain unrecoverable. Missing Git objects, noninvertible content filters or missing/changed needed captures can still prevent exact recovery. Preserve the actual limitation and evidence; never manufacture originals from the repaired code. A supported exemption needs a truthful reason and does not become a proof receipt. Local editable state/capture records are not independent enterprise attestation.

For generated inputs that genuinely affect behavior, configure literal project-relative paths in `source.include`. Use `source.exclude` for additional untracked artifacts; it cannot hide tracked files. Neither field expands glob patterns. Missing `*` or `?` components reject with literal-path guidance; both fields are validated before controller startup writes. Ordinary future paths, spaces, Unicode and bracketed routes remain literal. Existing POSIX wildcard-named components can be named literally, but validation never follows a symlink/junction to establish unresolved wildcard components in its target. Explicit includes do not follow symlinks or include untracked `.env` secrets. Non-Git projects use filesystem traversal with dependency/build defaults and these explicit paths; `.gitignore` is not interpreted without Git. Git file-selection errors in a repository fail rather than silently scanning ignored output.

Example: `"source": { "include": ["generated/api-types.d.ts"], "exclude": ["output", ".eslintcache"], "maxFiles": 300000 }`. Selected source is limited to 200,000 files and 2 GiB by default; `source.maxFiles` and `source.maxBytes` (positive integers) change those limits, and the error for a larger selection names the setting to change.

Snapshots that record evidence hash every selected file: at run start, before and after a proof's source swap, after verification, baseline, recipe and onboarding commands, and at completion. Between them, guards, review files, status and recovery reuse a file's SHA-256 from `.cyc/runs/source-cache.json` when its size, modification time, change time and file ID all match an entry hashed after the file had been still for two seconds. Ordinary writes move the change time, but not all do: on Windows a write through a memory-mapped view leaves every timestamp unchanged and tools can set the change time back, and FAT keeps none. So a stale cached hash can only affect those intermediate views until the next evidence snapshot, which reads every file and repairs the cache. A stale hash before verification makes the check look unstable, never stable. Only controller operations holding the operation lock update the cache. Their snapshots collect updates in memory, later snapshots in the same operation reuse them, and they are stored when the operation returns, before the lock is released, including an operation that records a failed check or halts a run. An operation that throws, such as a refused proof or completion, stores no new hashes, so a refusal adds nothing to the project. It only removes entries one of its full reads proved wrong (same size, times and file ID, other bytes), so the cache does not go on hiding that change from the next verification. Read-only commands such as `run recover`, `investigate` and `recipe list` write nothing. The cache is a local record like run state, not an attestation. Git file listing allows 512 MB of paths and two minutes. Scope limits still restrict edits, not which files are fingerprinted. Verification outputs `sourceStable` and `changedPaths` so all-green commands with changing source have an actionable explanation.

A full-content snapshot of 1,000 or more files reads them on up to eight worker threads (`scripts/source-hash-worker.mjs`); smaller ones stay on one thread, since workers take about 25 ms to start. Opening each file is most of the cost, about 0.4 ms on Windows with its file system filters, so on this Windows machine a 60,000-file snapshot that took 25.8–26.0 s on one thread takes 6.8 s (three runs each, alternating; four or six threads were slower, more than eight no faster), and a feature run on that project starts in 15 s instead of 35–37 s and finishes in 57 s instead of 133 s. Workers only read and SHA-256 regular files no larger than `source.maxBytes`, in 1 MiB chunks, so a large file never sits whole in memory; like the earlier `readFileSync`, a read stops at the size the file had when opened, and a file over 2 GiB is now hashed instead of failing with `ERR_FS_FILE_TOO_LARGE`. The main thread applies their results in path order, so file selection, limits, the order of entries and so the snapshot hash, and cache updates are those of a single-threaded read. Links, directories, vanished files, a file the byte limit stops, and read errors go back to the main thread, which inspects them in order, so an error is raised where a single-threaded read raises it and a file over the limit is never read. Workers get no `NODE_OPTIONS` or command-line preloads, and their output never reaches a command's result. If no worker has started after two seconds, or no read has progressed for five (workers report each chunk, so a long read counts as progress), the main thread reads the files it is waiting for itself. Before a snapshot returns or throws, it waits for reads in progress, so no worker still holds a file open, giving up only after five seconds without progress. A copy of `source-snapshot.mjs` without its worker file reads on one thread. Cached views and the delivery gate's size-and-time snapshot stay on one thread.

Linked paths in the covered project tree are fingerprinted by their identity, but their targets are not recursively verified. Executable verification refuses unsupported symlink/junction coverage rather than issuing a passing receipt. Adding or changing such a link is also a source change. Linked dependencies inside excluded dependency directories remain outside this guard's coverage; use the project's dependency controls for those.

Use the host's actual sandbox, access controls, and authorization boundaries where isolation matters. Local editable records are workflow guardrails, not tamper-proof enterprise attestation. Hook trust and live host activation remain distinct from successful local controller tests.


## Project conventions

Set `context.ledgerPath` to the existing project ledger. Without it, CYC prefers `INCIDENT-LEDGER.md` if present, otherwise `docs/context/error-ledger.md`. New runs freeze `projectLedgerPath` for lookup and `ledgerPath` for recording. If allowed/protected paths prevent shared-ledger edits, recording uses `.cyc/runs/ID/error-history.md`; `ledgerNote` explains the choice. A protected fallback is rejected before creating a run. Existing serialized runs keep their captured selection.

Run-local storage retains required failure evidence without authorizing shared-document edits. Deliver still requires the exact selected file and checks its hash; protected-source and scope guards remain. The generated review identifies both paths and deferred shared-log promotion. Search relevant earlier run-local histories too, but disclose that they may exist only in this checkout. Explicit project policies still apply; a separate requirement for a committed shared record cannot be waived by this selection. Later promotion needs authorized scope and fresh verification.

Set `delivery.presentation: "project"` when an existing hook owns reply formatting. CYC then delegates length, visuals and presentation review to project instructions, while its controller-completion gate remains active. Cursor still needs the small identity packet described in its installed rule. Defaults retain CYC presentation checks.

The delivery gate checks this session's runs in the current checkout and Git-registered worktrees of the same repository. Other sessions and unowned legacy runs in other worktrees are excluded. Arbitrary independent folders are not discovered: use their own activated host session. Worktree discovery is a local protocol check, not proof of live host loading.

Runs record their starting engine version. An engine version change prevents an active run from advancing; stop it, reload the host, and explicitly start a new run. Legacy runs without version metadata remain labeled unknown.

The `skill` field returned by `run next` points to an internal `methods/cyc-<stage>/SKILL.md` relative to the engine root. `skillFile` gives the same method as an absolute path, so an agent working from the project root can open it directly. These files are read by the orchestrator, not registered as separate slash commands. `/cyc` is the only public entry.
