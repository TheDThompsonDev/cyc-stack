---
name: cyc
description: "Run a software task through CYC: a fast scout, a build, and a verify loop that repeats until the project's real checks pass, then a concise handoff. Use when the user says \"cyc\", \"run this through cyc\", or, in a project with CYC installed, asks for a feature, bug fix, refactor, performance improvement, review, or verification, or asks to explain how code works, plan or compare approaches, resume interrupted work, prepare a handoff, or set up CYC."
---

# CYC

You own the outcome. Keep normal work short without dropping context reuse, review, or retained learning. Follow Scout and the compact [work assessment contract](../../docs/work-assessments.md) when `run next` requires it; load deeper methods only for the relevant question. A short route still owes every required outcome.

**One entry point.** Users invoke only `/cyc` and describe their outcome. Select the playbook and supporting methods yourself; never ask the user to choose a skill or present the internal catalog as a menu. Ask only about consequential missing requirements. For `/cyc` without a task, ask what they want to accomplish. For setup requests, use the linked Setup method. Supporting methods are internal instructions loaded by file path, not public slash commands; load only what the current step needs.

## Frontend work

For new websites, composed interfaces or visual redesigns, apply the [frontend design method](../../methods/cyc-design/frontend-design/SKILL.md) and its three gates. Before any page markup, `design/decisions.md` exists with a named layout archetype (never the centered hero and card grid), a named typeface pair, seven palette values derived from the subject, a signature element and a rejection condition; for several sites, its set-divergence table is filled first. Build renders the signature section and scores it against the generic-tells list (three or more tells fails) before extending the page. Verify scores the finished page at desktop and phone width and runs the experience review; a working page that still reads as a default page has an unmet criterion. A lightweight stack or simple scope does not lower the target. Combine host or platform design guidance into that one sheet rather than accumulating style checklists. Carry it through Scout, Build and Verify, including fast routes with no separate Design stage. Narrow UI repairs preserve the existing identity and use only relevant checks; review-only requests remain review-only.

## The flow

Choose from the requested outcome and permissions, not isolated words: "review this bug fix; don't edit" is Review, not Bug fix; "explain this refactor" is Investigation, not Refactor. `cyc route` is a keyword suggestion only. Read the selected playbook before starting. The four-stage flow below applies to implementation routes; on every route, `run next` owns the stage order. A route without Build does not authorize product edits. A quick explanation or local copy correction need not become a controller run unless the user or project requires one; keep the applicable evidence and delivery standards. If it changes project files, record why no run applies with `packet --advisory "<reason>"`; Stop blocks unexplained changes made without a run.

```text
scout → build → verify ⟲ repair within budget → deliver → reply
```

1. **Scout.** Pick the playbook from the table below (usually `feature` or `bug-fix`) and open its page. Read the project's context index first, `docs/context/INDEX.md`, and then only the component docs whose Covers match the paths you will touch (`node <cli> investigate --path <paths>` does the match and checks their evidence), plus the error ledger for that area; each row's `Last AI change` and `Lessons` cells say whether the doc is worth opening. Do not read every doc, and do not start from the code when a matched doc exists. Then follow [Scout](../../methods/cyc-scout/SKILL.md): focused searches, matched component history and ledger lookup, freshness checks, and a short plan. Identify existing functionality and choose reuse, extend, repair, or create. Explain consequential behavior changes and trade-offs; ask only for unresolved decisions that affect the solution. Fill every field with what you found; unedited placeholders are rejected. Aim for a first useful edit within a couple of minutes without skipping critical unknowns.
2. **Start the run with its plan.** Save a JSON object under `.cyc/runtime/` with these fields:
   - `goal`, `playbook`, `criteria` (`[{"id":"c1","description":"..."}]`), `allowedPaths`, and `session`;
   - `plan`: one or two sentences;
   - `scout`: `{"context":{"status":"used|none","evidence":"...","freshness":"...","sources":[]},"approach":{"kind":"reuse|extend|repair|create","evidence":"..."},"alignment":{"status":"clear|confirmed","evidence":"..."},"consumers":[{"id":"direct","description":"...","check":"..."}]}`. `context.sources` are matched history (context docs, decisions, ledger entries); with `status: "none"`, list the code you read as `context.read` instead. Omit `context` only when the project has no `docs/context/INDEX.md` and no ledger: the controller then records that there was no history to consult.

   Run `node <cli> run start --file START.json`. It records Scout in the same call, so do not record Scout again (a second record would land at Build), and writes the finish input to `.cyc/runs/<ID>/finish-template.json`, shown first in its output as `finishTemplate`. You fill that file in at the end, so you do not need `run next` for it. If the scout is invalid, no run is created. If you started without `scout`, `run start` returned its template: save it under `.cyc/runs/<ID>/` and record it with `run record --summary "<plan>" --assessment <scout.json>`. A file preserves multiline text, quotes, and literal shell characters; do not interpolate rich text into shell arguments. Simple `--goal`/`--criterion`/`--scope` arguments remain supported; see the [input examples](../../docs/runtime.md#structured-input-without-shell-quoting).

   The session comes from the CYC gate context (in Cursor, your conversation's tag; as a subagent, a stable ID you were given; 4–80 characters). Use the actual task scope as literal file or directory prefixes in `allowedPaths`; it also bounds captured originals when Git cannot recover them. Translate brief-style globs into the permitted files or already-authorized directory prefixes (for example `["src/parser.py", "tests/test_parser.py"]`), without broadening task permissions. Glob matching is unsupported; bracketed routes such as `src/[id]` are literal names.

   Start before editing. Later commands find the active run themselves; pass `--run <ID>` only when several runs are active. The CLI is `.cyc/engine/bin/cyc.mjs`, or [bin/cyc.mjs](../../bin/cyc.mjs) for plugin installs. No `.cyc/config.json` yet? Run [Setup](../../methods/cyc-setup/SKILL.md) first.
3. **Build.** Follow [Build](../../methods/cyc-build/SKILL.md). Work in small slices: features and bug fixes use red then green; refactors keep characterization tests green on original and candidate code. Keep named consumers consistent. Record failed fixes in the selected ledger immediately, with evidence and the next hypothesis; if `run next`'s `ledgerPath` does not exist yet, create it in the [entry format](../../methods/cyc-error-ledger/references/entry-format.md). Reread the diff and fix shortfalls. `run finish` records Build and lists the files you changed; `run record` remains for step-by-step work. Finalize authorized context/index and ledger edits before final verification. Verified facts keep their evidence and limits; unverified hypotheses and undecided proposals stay labeled in run-local notes.
4. **Prove, verify, and deliver in one call.** Use [Verify](../../methods/cyc-verify/SKILL.md)'s applicable checks: task criteria, affected consumers, rejected cases, and the real journey/recipe.
   - **Test proof.** New regression tests must detect the original defect. `run finish` runs `prove-red` itself when the proof is missing or outdated: tests for bug fixes and features must fail on the run-start code, and refactor tests must pass on it. A change with no testable behavior records `testProof: {"status":"exempt","reason":"..."}`, in FINISH.json or its assessment. With TAP (`node --test`, `tap`), mocha, or jest output, the proof names the new tests that fail on the original code, including output longer than the 32,000 characters kept. It does so even when an older test in the same suite already failed there, because it compares failing test names. Other output gives a per-check result: at least one new test fails on the original. In `criterionEvidence` and the reply, say a specific case failed before the fix only if the proof named it or you ran it on the original code yourself. Otherwise quote `proofClaim` from the finish result.
   - **Review.** Review the current diff against the senior bar below for intent, consumers, and conventions, and resolve or justify dismissing every finding. Tests alone cannot replace review. Each finding is `{"id":"f1","status":"resolved|dismissed|open","evidence":"<how it was resolved, or why it is dismissed>"}`; an open finding blocks verification.
   - **Finish.** Copy `finishTemplate` to `FINISH.json` and replace every `<...>` with what you found: `summary`, `assessment`, `criterionEvidence` (each criterion ID mapped to its evidence), and `acceptFailures` (see below). The template asks only for what you must judge: `errorHistory` appears for bug fixes, and `learning` is yours to add when you recorded something reusable. Left out, the controller records none and says so. If the template lists an `acceptFailures` entry, that check already failed in the project's run-start baseline: replace its reason with why it is unrelated, or delete the entry and fix the check. Placeholders left in are refused. Add `artifacts` only to override the changed-file list. Run `run finish --file FINISH.json`; the [input examples](../../docs/runtime.md#structured-input-without-shell-quoting) show the envelope. It records Build if needed, proves the new tests, runs the configured checks, records both stages, and completes the run. It refuses an incomplete assessment before running anything.
   - **If the proof or a check fails**, finish stops and says which. Read the receipt, then run `run retry --stage build --reason "<what the failure showed>"` before editing, so the repair is recorded as a build artifact. Do not rerun checks on unchanged files to reproduce a failure, because repeated identical failures exhaust the run.

   Changes after a passing review require returning to Verify. `run prove-red`, `run verify`, `run record`, and `run complete` remain available for step-by-step use.
5. **Deliver the reply.** Follow [Deliver](../../methods/cyc-deliver/SKILL.md). Learning is proportionate: for a small change with nothing reusable, leave `learning` out rather than writing context docs to fill the field. Bug fixes and runs with failures still record error history. With a run-local ledger, `errorHistory.reason` becomes that entry when you have not written it. `run finish` records on the Deliver handoff which component docs under `docs/context/` the change touched (`contextDocs`, also in `review.md`). If the change touched a component that has a doc and you did not update that doc, run `node <cli> context review --run <ID> --write` after finish: it appends the entry from the run's own record (what changed, what was learned, the decisive check, the files with hashes) and refreshes the index; then write the packet with `cyc packet`, since files changed after finish. Otherwise leave the doc to the batched `cyc context review`, which proposes entries for every completed run no doc records yet. See [Context](../../methods/cyc-context/SKILL.md).

   Reply with the result first, then the criteria evidence and what was not checked. For code work, name the decisive regression test and link the generated `.cyc/runs/ID/review.md`; reuse it for an authorized PR. Under CYC presentation, follow the [response standard](../../docs/response-standard.md): include one useful visual even within the 1,000-character default. Every value in that visual must be observed this run; a "before" value comes from running the original code, never from reading it.

   Before sending, reread your reply: it answers the request, is understandable, its visual adds information, and it states the limits. In Claude Code and Codex, a completed `run finish` has already written the review packet from the run's record (`packet.written` in its result), and the Stop gate checks the reply's length, visual, and blocked prefix itself; do not run `cyc packet` after it. Run `node <cli> packet --session <ID> --passed "<criterion> :: <evidence>" --artifact <files> --reviewed` yourself when no run completed (a blocked run, or an advisory change with `--advisory`), when you changed files after finish, and always in Cursor, with `--response <file>` holding the exact reply. Draft the reply in `.cyc/runtime/reply.md`, run `node <cli> check-reply .cyc/runtime/reply.md --session <ID>` to see its character count and visual before sending, and send that text unchanged; a rejected reply costs a whole turn, and the check costs one command. `cyc packet --response .cyc/runtime/reply.md` checks the same when you write the packet yourself. If this session's run ended blocked, halted, paused, or stopped, the packet marks itself blocked from the run's record: start the reply with "Blocked:" or "Not ready:" and say what stops completion. After a rejected reply, revise it; rerun the packet only if you wrote it yourself. Codex/Claude packet preflight also checks this hook request's run statuses. For a readiness diagnosis, or in Cursor, use `readiness --session <ID>`; without mapped hook state it needs the actual request start as `--since ISO_TIMESTAMP`, and it remains an explicit diagnostic. A completed replacement does not hide a stopped original. Respect project delivery settings; `delivery.presentation: "project"` delegates formatting to project rules.

**Other stages.** Playbooks such as plan, explore, teach, handoff, resume, reflect, and evaluate use stages beyond these four. The playbook page links each stage's method, and `run next` returns the current one as `skillFile` (an absolute path; `skill` is the same file relative to the CYC engine, not the project). Load that method for the current stage only, then record the stage with `run record --run <ID>`.

Store assessment JSON beneath the actual run directory. At finish, `finishTemplate` holds the required fields; for other stages, `run next` returns them as a fill-in `assessmentTemplate`. The contract docs are needed only for unusual cases. Advisory and legacy runs retain ordinary handoffs; do not add implementation paperwork to an explanation. The shared review is generated from evidence, not a second manually maintained report. Context and ledger edits after final verification invalidate source evidence like other edits.

Before an executable run, check that the project has real `verification.commands`. If the list is empty, `run start` uses the project's declared test command and reports it as `verificationSource`; disclose that in the reply. An npm `pretest` or `posttest` hook runs as its own check around the test script, so a red posttest (lint, a template check) cannot hide the tests. The declared sources are package.json `scripts.test`, a Makefile `test` target, pytest configuration, go.mod, and Cargo.toml. If the project declares none, run [Setup](../../methods/cyc-setup/SKILL.md) steps 3-7 **before** `run start`, which refuses code playbooks without checks. On an unattended run, configure the commands the project itself defines and disclose them. Never edit `.cyc/config.json` after a run starts: that halts the run. Reuse established setup for ordinary tasks rather than rerunning onboarding checks before each change.

In Codex/Claude, missing injected CYC gate context is a setup gap: use [Setup](../../methods/cyc-setup/SKILL.md)'s host check and supported trust/reload flow. Never invent a Cursor tag or use an old state token as a substitute. A current prompt observation with `canStartTask: true` permits the first task while Stop is pending; final activation is observed after the turn ends. Existing authorization permits local repairs while activation is pending, but does not turn them into hook-verified delivery.

## Explain progress

Use enough engineering detail for the developer to assess the reasoning. A stage name or "retrying" is insufficient: name the affected mechanism and evidence. For a return to earlier work, explain which assumption or implementation failed, why the chosen destination can repair it, and which results must be re-established. Plain language should clarify technical substance, not remove it; see the [detailed workflow and recovery routes](../../docs/cyc-workflow.md).

Engineering understanding is part of every stage. During Scout, explain the affected flow and why the approach fits; during Build, explain consequential changes to state, boundaries, or consumers; during recovery, explain what the failure rules out and the next hypothesis; during Verify, connect results to behavior and limits; during Deliver, leave a usable before/after explanation and pointers for maintenance. Adapt depth to the engineer and task. Combine these for small work; do not turn them into a lecture, quiz, or additional approval gate. Follow the [engineering understanding standard](../../docs/response-standard.md#engineering-understanding-throughout-the-work). Supplying an explanation is not proof the engineer understands it.

Keep the engineer informed at meaningful discoveries, decisions, and verification results. Usually use one or two short paragraphs: describe the concrete behavior, add a sentence explaining the engineering mechanism, then explain the change or next check. Select what matters now; do not repeat every part in every update. Say what information was lost or behavior changed, rather than just "found the bug." Connect technical terms to their effect. Distinguish suspected causes from confirmed findings and focused checks from full verification.

Explain consequential choices and what they protect without narrating every tool call or writing a design review. During longer work, give a useful update about every minute, naming what remains unresolved. Communicate as work proceeds; do not add a reporting stage or delay useful edits. When delegating, pass this guidance along and consolidate findings into coherent user updates. See the [progress standard and example](../../docs/response-standard.md#progress-updates) when needed; it applies to supporting methods too.

## The senior bar

Every change is judged as a senior reviewer would. The [engineering principles](../../docs/principles.md) give each rule's trigger and the sign that it was skipped:

1. Make the smallest change that solves the problem. No speculative options, layers, or guards.
2. Fix the cause where it starts. A guard is a fix only if the state it handles is legitimate.
3. A test that cannot fail proves nothing. `run prove-red` checks it against the run-start code.
4. Test behavior callers can observe, not internals.
5. Match the codebase. Reuse its helpers and patterns; never fork one.
6. Put the domain in data (a state machine or table), not in growing branches.
7. Validate at boundaries and trust internal types.
8. Migrate every caller, then delete the old path.
9. After two failures on one assumption, test the assumption before a third fix.
10. Claim only what you observed this run.
11. Leave the code easier to read than you found it.

## Rigor

The quality bar is always the highest. Only the process scales:

- **Normal:** the flow above.
- **High risk** (auth, permissions, payments, data migrations, deletes, public APIs): run one focused [Challenge](../../methods/cyc-challenge/SKILL.md) pass on the plan before building. Before finishing, get a fresh-context review when the host can start a subagent: give it only the diff, the criteria, and the [principles](../../docs/principles.md), never your reasoning, and ask for findings it can demonstrate. Resolve or dismiss each with evidence and record `reviewer: "fresh-context"`. If no subagent is available, record `self` and say so in the reply. Use additional agents only for specific independent questions that warrant them.

## When things go wrong

For a failed command, blocked/paused run, or interrupted task, use `node <cli> run recover --run ID`. This is read-only guidance from current files and retained run evidence. Explain the observed failure, what remains in place, what evidence needs rechecking, and the next justified action; see [recovery guidance](../../docs/onboarding-recovery.md). Raw error output is supporting evidence, not the whole explanation. Do not infer a missing service from an ordinary nonzero exit. The report cannot authorize a state transition, erase failures, or certify completion.

- A bug or error log: search the [error ledger](../../methods/cyc-error-ledger/SKILL.md) first. Don't change code for a bug you haven't reproduced.
- A check was already failing before you started and is unrelated, for example lint or a template check on files you did not touch: list it in FINISH.json as `"acceptFailures": [{"check": "<id>", "reason": "<why it is unrelated>"}]` (or run `run accept-failure` after `prove-red`). For bug fixes and features, the proof's control run is the baseline; other runs need `verification.baseline`. The run can still complete only if that check fails exactly as it did on the run-start code: the same exit code, the same output lines apart from timings, and no file you changed named in it. For a TAP, mocha, or jest suite, that means all of these:
- no test fails that did not fail then;
- every old failure keeps its error, and its stack does not run through source you changed;
- no new non-test line appears. When verification fails, `failedAtRunStart` lists the failing checks that also failed before the run, so decide for each: accept it if it is unrelated, or fix it if your change caused it. Do not retry unchanged. Name it in the reply as a pre-existing failure. A check that passed before and fails now is a regression and is refused.
- A consumer the plan missed breaks: add it to the plan, fix it, and verify again.
- Two fixes fail the same way: stop and question the shared assumption before a third.
- The user says "not it": follow [Correct](../../methods/cyc-correct/SKILL.md) and ask what's missing before revising.
- Blocked by something outside your control: record `--status blocked` with the controller, then `cyc packet` marks the review blocked from that run; tell the user the one thing you need. With no run, pass `--blocker "<what stops completion>"` to `cyc packet` and include that text in the reply.

Preserve findings through the [context lifecycle](../../docs/work-assessments.md#learning-lifecycle-and-final-file-order): retain verified technical knowledge with evidence and limits; claim adopted decisions only with actual acceptance. Keep unverified hypotheses and undecided proposals explicit in run-local notes. Record failures immediately and close resolved ledger entries before final verification. Later promotion needs a scoped follow-up; do not silently change a completed run's verified source.

## Playbooks

Use the [project tools](../../docs/project-tools.md) automatically when relevant: Scout/Understand discover matching context and recipes with `investigate`; Build uses a narrow recipe for feedback; Verify runs applicable authorized supplementary recipes and the controller's required checks. `run next` supplies stage-specific tool hints. Missing or inapplicable recipes fall back to project evidence; matched paths do not authorize side effects, and old receipts do not replace current verification.

| Intent | Playbook |
| --- | --- |
| Explain current behavior or reasons | [Investigation](references/playbooks/investigation.md) |
| Compare possible directions | [Explore](references/playbooks/explore.md) |
| Organize a multi-stage change | [Plan](references/playbooks/plan.md) |
| Add or change behavior | [Feature](references/playbooks/feature.md) |
| Repair broken behavior | [Bug fix](references/playbooks/bug-fix.md) |
| Preserve behavior while changing structure | [Refactor](references/playbooks/refactor.md) |
| Improve measured speed or cost | [Performance](references/playbooks/performance.md) |
| Assess existing work | [Review](references/playbooks/review.md) |
| Establish whether criteria hold | [Verify](references/playbooks/verify.md) |
| Improve an end-to-end user experience | [Experience](references/playbooks/experience.md) |
| Explain and support learning | [Teach](references/playbooks/teach.md) |
| Prepare a reviewable result | [Handoff](references/playbooks/handoff.md) |
| Recover an interrupted task | [Resume](references/playbooks/resume.md) |
| Extract supported lessons | [Reflect](references/playbooks/reflect.md) |
| Compare skill or workflow effectiveness | [Evaluate](references/playbooks/evaluate.md) |

## Autonomy

Just do: read, search, run tests, edit files in scope, build prototypes. Always ask first: commits and pushes (unless asked), publishing, deleting user data, global installs, sending messages. The delivery gate won't let you finish while your run is still open; a run that ends blocked is reported as blocked, never as done.
