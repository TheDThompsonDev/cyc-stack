# CYC queue board and side-by-side units plan

Status: slices 1 and 2, the board and the review seat, were built in one controller run on November 20, 2026, from this plan written the same day against the uncommitted work queue on top of commit 25f6626 (version 0.10.0). What was built differs from the plan in the places marked "As built". The user guide is [docs/work-queue.md](../work-queue.md). Slices 3 to 7 are not built. It follows the [work queue plan](work-queue-plan.md) and changes two of its rules: one unit at a time, and no commits. An independent review challenged the first draft; what it found and what changed is under [Challenge](#challenge).

## Why

The first live trial of the queue ran a fresh session on three units in a throwaway project. All three completed in order, each as its own run with a passing proof. No agent spoke to another, because there was only ever one agent, on one unit. Each unit left a change record for the next and that was the only exchange.

A software factory has several stations working at once, and the stations ask each other things: "what does your function return", "I changed the file format", "this finding still stands". Today CYC has no place for that. This plan adds one.

```text
Today:    unit A → change record → unit B → change record → unit C      one agent at a time
Planned:  reviewer ⇄ board ⇄ builder     two agents on one unit           (first half)
          person ⇄ board                 questions for the person wait in one place
          unit A ⇄ board ⇄ unit B        both building, each in its own workspace   (second half)
```

The plan has two halves. The first half, the board and the review seat, puts two agents in conversation inside one checkout and changes no existing rule. The second half, side-by-side builders, needs separate workspaces, commits and an integration step, and is several times the work and the risk. The first half is worth building and trying live before the second is started.

## Intended behavior

**First half.** One session builds unit `store`. A second session takes the review seat on it. The reviewer reads the diff, changes nothing, and posts findings. The builder sees them in the result of its next controller command and answers each one: fixed, or declined with a reason. The builder cannot finish while a finding addressed to its unit has no answer. A question the builder cannot settle goes to the person and waits in `queue status`; the person answers in any chat. A note left for a later unit is shown to that unit when it starts.

**Second half.** A queue has units `store` and `format`, which do not depend on each other, and `cli`, which depends on both. The queue file allows two units at once. Two sessions each take a unit and get a workspace each. The `format` agent needs the shape of a saved task, posts a question to unit `store` and keeps working on what it can. The `store` agent answers at its next controller command. When each unit's run completes, the unit is built but not yet in the line. An integration run merges it into the line and runs the project's checks there. Only when both are in the line is `cli` ready.

## What the code allows today

| Fact | Where | What it means for this plan |
| --- | --- | --- |
| A unit is refused while another unit of the queue is in progress or halted | [scripts/queue.mjs](../../scripts/queue.mjs) `bindUnit` (lines 225 to 226) | This is the rule the second half changes. It stays the default. |
| A run halts when a file outside its `allowedPaths` changes | [scripts/runtime.mjs](../../scripts/runtime.mjs) `guard` (line 477) | Two builders in one checkout halt each other. So does any merge into a checkout that has an open run. |
| The red proof calls the guard first, then puts the run's changed source files back to their original bytes, runs the checks and restores them. An outside edit during the swap halts the run | `proveRun` (line 928) | A second builder's files halt the proof before it starts. |
| Verification runs the project's whole check command | `.cyc/config.json` `verification.commands` | One builder's half-written code fails the other's verification. |
| The scope the controller enforces is wider than the unit's `paths`: it adds the context index and the feature records | `startRun` (lines 1286 to 1289) | Two units with separate `paths` can still both edit one record. Separate paths are not separate scopes. |
| Controller locks fail at once when held, and a lock is held through a check run | runtime.mjs `takeLock`, `withWorkspaceLock` (lines 329 to 350) | A board that used the project lock would refuse posts for as long as checks run. |
| A run can be changed only by the conversation that owns it | runtime.mjs `assertRunOwner` (line 431) | A reviewer in another session cannot capture or record a review on the builder's run. |
| A queue decision applies only to a run that ended short of complete | queue.mjs `decideQueue` (line 272) | A unit whose run completed but whose merge failed has no decision that fits. |
| The queue stores no unit status. It reads status from run records in one checkout | queue.mjs `queueView`; runtime.mjs `queueIO.runs` (line 2481) | A status that depends on a merge needs a record to be read from. Run records in a removed worktree are lost. |
| Hook state and review packets live under the folder a session is opened in | `.cyc/runtime` | A session must be opened in the workspace it works in. |
| The Stop gate finds a session's runs across registered Git worktrees, for that session only, and skips a failed listing silently | [scripts/run-gate.mjs](../../scripts/run-gate.mjs) (lines 23 to 26, 173) | The lookup is a precedent, but the queue must fail closed where the gate skips. |
| The Stop gate excuses files inside the scope of another conversation's run touched during the request | `docs/response-standard.md`, run-gate.mjs | A reviewer session in the builder's checkout is not blamed for the builder's edits. A merge into the line with no run is blamed on every session there. |
| Queue files live in one checkout and ignore themselves in Git | `.cyc/queues/.gitignore` | A workspace does not have the queue. It reaches the line's copy. |
| `run next`, `run finish` and long-running operation results carry a `queue` entry. `run verify`, `prove-red`, `review-capture`, `review-record`, `status` and `recover` do not | [bin/cyc.mjs](../../bin/cyc.mjs) `compact` (lines 365 to 385) | Messages can ride results, but the results that carry them must be extended. |
| Helper workers are read-only and return questions only inside their final result | [scripts/delegation.mjs](../../scripts/delegation.mjs) (lines 54, 89, 153) | Existing delegation is lead-to-helper. Helpers never reach each other, and nothing arrives mid-work. |
| CYC installs hooks at the prompt and at Stop for Claude Code and Codex, and three for Cursor. None fires between tool calls | [docs/installation.md](../installation.md) | A message cannot interrupt an agent. It is handed over at a controller command or a new prompt. |

## Design: first half

### The board

One board per queue, stored beside it as `.cyc/queues/<id>/board.json`. The controller writes it under a lock of its own, `.cyc/queues/<id>/board.lock`, held only for one read and one write and retried for up to two seconds. It is never held across a check, a merge or any other command, so posting works while checks run.

A message:

```json
{ "id": 7, "at": "2026-11-20T16:02:11Z", "from": { "unit": "store", "seat": "review", "session": "…" }, "to": "store",
  "kind": "finding", "text": "done() saves the list even when no id matched.", "about": ["src/tasks/tasks.mjs"], "sourceHash": "…", "replyTo": null }
```

| Field | Values |
| --- | --- |
| `kind` | `question`, `finding`, `answer`, `notice` |
| `to` | A unit id or `person` for a question or finding. A notice may also go to `all`. |
| `from` | Filled in by the controller: the unit and run of the posting run, or the unit and seat of a seated reviewer. A post with neither is the person's. |
| `disposition` | On an answer to a finding: `fixed` or `declined`. On an asker closing its own question: `assumed`. |
| `topic` | On a notice, optional: `ready-for-review` or `review-done`. |

Text is capped at 2,000 characters. A board takes 500 new questions, findings and notices; answers and closings are always accepted, so the cap can never trap an open item.

| Command | What it does |
| --- | --- |
| `cyc queue post [--queue ID] --run RUN --file MESSAGE.json` | A builder posts for its unit. |
| `cyc queue post [--queue ID] --seat SEAT --file MESSAGE.json` | A seated reviewer posts. |
| `cyc queue post [--queue ID] --file MESSAGE.json` | The person posts or answers. |
| `cyc queue board [--queue ID] [--unit ID] [--open]` | Reads the board. It writes nothing. |

`queue status` and `queue next` show the count of open items, and those addressed to the person in full.

### How a message reaches an agent

Each run keeps the id of the last message it was shown in its own state. Every result of a controller command that already changes that run gains a `board` entry with the newer messages addressed to its unit or to `all`, and moves the mark in the same write. That covers `run start`, `run next`, `run record`, `run verify`, `prove-red`, `run wait` and `run finish`; `compact` is extended so each of them carries it. Read-only commands show messages and move no mark.

As built: the read marks are kept in the board file, under the board's lock, not in each run's state. That needs no second write to a run's record and no change to who may write it. The mark moves only when the caller is the conversation the run belongs to. The board entry is placed first in the result, because the first live trial showed agents acting on the head of a result. `cyc queue wait` was added: it returns when a message arrives or after at most a minute, so an agent can wait for an answer without a loop of its own.

This is delivery at checkpoints. An agent deep in an edit sees a message at its next controller command. The skill tells an agent that has asked something to call `run next` before building on a guess.

### Rules that make it more than chat

1. **A unit cannot complete with an open question or finding addressed to it.** The check is made inside `completeRun`. As built: an item that lands after that check finds the unit done and goes to the person under rule 3; the board's lock is not held through completion. `run finish` returns `needs-answer` and lists the items. Answering is always possible, so two units that ask each other cannot deadlock.
2. **A unit cannot complete with a question of its own still open.** The asker closes it with the answer it got, or with the assumption it went on with. An assumption is shown to whoever was asked and listed in the asker's change record.
3. **Anything addressed to a unit that is not running goes to the person**, and says so. That covers a unit that is done, skipped or cancelled, and a finding that arrives after the run completed.
4. **Answers a unit relied on are evidence.** As built: the board keeps every message as the record. `queue next` shows a unit the assumptions that the units it depends on went on with. The change record's format was left unchanged.
5. **An agent does not post as the person.** This is the same rule as queue decisions, with the same limit: these are local, editable records. As built: the controller also enforces part of it. A post with neither run nor seat from a conversation that owns an open run of the queue, or holds a seat, is accepted only as an answer to a question that waits for the person, and is recorded as relayed. A review showed the builder otherwise declining a reviewer's finding as the person.

### The review seat

A unit in progress offers one review seat. `cyc queue next --seat review` records a seat on the board (as built; the plan said the queue file, whose writes take the project lock) for the asking session, with the unit, the run and the time, and returns the unit, its criteria, the run's changed files and a read-only instruction. The reviewer session is opened in the builder's folder. It starts no run and changes no file. It posts findings through its seat, each with the source hash it read. As built: a seat is used only by the conversation that took it; the sign-off must carry the source hash the reviewer read and is refused when the source is no longer that; reading and waiting count as the reviewer being there; and `--wait-ms` lets a reviewer that arrives early wait for a unit to start.

The board is the one record of findings and their answers. The reviewer does not capture or record a review on the builder's run, because only the run's owner may. When the reviewer posts `review-done`, the builder's `review-record` takes a new source, `--from-board`: the controller builds the receipt from the seat, the finding ids and their dispositions, marked as a peer review led through the board. As built: one call captures and records it, and it is refused unless the source still equals the source the reviewer signed off, so the builder settles context records before asking for review. It refuses when the seat's session is the builder's own.

While a seat is held, the unit cannot complete until the reviewer posts `review-done`, the seat is given up, or the seat lapses. A seat lapses after 30 minutes without a post and ends when the run ends. A lapsed seat is shown in the result, and the unit completes with its usual self review.

The Stop gate already excuses a session for files inside another conversation's active run. A test fixes that for a reviewer and a builder sharing one checkout.

## Design: second half

### Starting side by side

A queue file may set `"maxParallel": 2`. The default is 1, which is today's behavior with no change. `queue create` refuses a higher value without Git, and when the line has uncommitted source changes, naming them. A worktree is cut from a commit, so work that is not committed cannot reach it.

`cyc queue next --take` records a hold on a ready unit for the asking session, under the board lock, and returns its workspace. Two sessions asking at once get different units. A hold counts as in progress for the rules below. It ends when its run starts, when the session gives it up with `queue release`, or when the person releases it; `queue status` shows every hold with its age. A hold has no timer, because Scout can take longer than any timer worth setting.

A unit may be taken or started when all of these hold:

1. It is ready: every unit it depends on is done, which now means in the line.
2. Fewer than `maxParallel` units are held or in progress.
3. Its scope shares nothing with the scope of any unit held or in progress. At `--take` the unit's `paths` are compared. At `run start` the enforced scope is compared, with the feature records the controller added. Two units that keep the same feature record are not independent and run one after the other.
4. No unit is halted. A halted unit stops new starts. Units already in progress may finish.

The context index and the error ledger are shared by every run, so rule 3 leaves them out. How two branches' edits to them merge is one of the questions for [slice 0](#slices).

### Workspaces

With `maxParallel` above 1, no unit builds in the line. The line is where units are integrated. Every unit builds in its own Git worktree, on its own branch, cut from the line's latest commit.

- **Where a session opens.** A builder's session is opened in its unit's workspace, because hook state and review packets live under the folder a session is opened in. Every command `queue next` returns names the workspace with `--project`.
- **Reaching the queue.** The start file carries the line's path. The controller confirms it is a registered worktree of the same repository before using it. A worktree listing that fails is an error, not a skip.
- **Run records.** A workspace keeps its own run records. When a run ends in any way, the controller writes one closing note into the queue file: the run, its final status, its branch, its commit and its change record. A unit's status is read from the live run while the workspace exists, and from the closing note after. A workspace that disappears while its run is open reads as `missing`, which halts, as today.
- **Life of a workspace.** Made at `--take`. Reused, with its branch, by a retry. Kept after its unit is done. `cyc queue clean` lists the workspaces of done units and removes them when the person asks; it refuses one with uncommitted changes.
- **Drift.** A fresh workspace starts from a commit, so it has no drift. The line's drift is measured from its last integration commit.

### Integration is a run

A unit whose build run completed is `built`. It becomes `done` through an integration run: an ordinary run in the line, bound to the unit with the role `integrate`.

| The unit's runs | Status |
| --- | --- |
| Build run complete, no integration run complete | `built` |
| Integration run in progress | `integrating` |
| Integration run complete | `done` |
| Integration run blocked, halted, exhausted or stopped | `halted` |

`cyc queue next` offers the integration of a built unit before any new unit. Starting it requires that no other run is open in the line, so the merge halts nobody. At start the controller commits the unit's work on its branch, merges the branch into the line without committing, and sets the run's scope to the files the branch changed. Conflicts are left for the run's agent to resolve inside that scope. The run verifies with the project's checks in the line, where two units that each passed alone can fail together. At completion the controller commits the merge.

Because integration is a run, nothing new is needed around it. Its status is read from its run record. A failed integration is an ended run, so the existing `retry`, `skip` and `cancel` decisions apply to it. The Stop gate sees a run for the files the merge changed. The evidence is a run record like any other.

With `maxParallel` at 1 there is no workspace, no branch and no integration. A complete run is `done`, as today.

## As built: first half

One controller run built slices 1 and 2. An independent review of its first candidate demonstrated fourteen findings, three of them high; all were corrected and are recorded as QUEUE-002 in the project's error ledger. The corrections that changed this design are marked "As built" above. Two more things the design did not foresee:

- The board's lock needed more than "held briefly". It is found through the queue's folder, a stale lock is claimed by renaming it, and a holder removes only a lock that carries its own mark.
- The release size budget. The board fit inside the 1.1 MiB budget with 373 bytes to spare, and only after comments and message text were shortened. The owner raised the budget to 1.2 MiB on November 20, 2026.

Slice 3, the live trial, ran on November 20, 2026 in a throwaway project: a builder session and a reviewer session, neither told how the board works. They exchanged eleven messages in about three minutes. The reviewer posted three findings, two of them real defects in the unit; the builder fixed two, declined one with its reason, and the reviewer signed off on the final source; the builder recorded the receipt from the board and the unit completed with its proof and 40 passing tests. The transcript is kept with the run's working files, not in the repository. What the trial showed wrong was corrected in a following run: the builder closed a question to the person with an assumption 68 seconds after asking, and the person's answer, given afterwards, had nowhere to go; `queue next --session` was refused; and the builder read the board module to learn the message fields.

## Slices

| Slice | Outcome | Depends on | How it is checked | Recovery point |
| --- | --- | --- | --- | --- |
| 1. Board | Post, read and answer on a one-at-a-time queue. Messages ride controller results. Rules 1 to 5 hold. The person takes part. A unit can leave a note for a later unit | Nothing | A test per rule, with its refusal. A unit leaves a notice for a later unit, which is shown it at its start; a question from the person holds a unit until it answers (as built: rule 2 means a unit cannot leave its own question open for a later unit, so the forward note is a notice). A test that posting succeeds while a check is running | The board file is additive. A queue without one behaves as today |
| 2. Review seat | A second session reviews a unit in progress through the board. The builder records one receipt from it | Slice 1 | Journey test with two processes and two sessions on one checkout: a finding blocks completion, an answer releases it, a lapsed seat releases it, the builder's own session is refused as reviewer, and the reviewer's Stop is not blocked by the builder's edits | The seat is optional. A unit without a reviewer is unchanged |
| 3. First-half live trial | Two real sessions on one unit of a throwaway project, one building and one reviewing, with one planted defect | Slice 2 | A person watches. Pass means: the reviewer found the defect unprompted, the builder saw it at a checkpoint and answered, and the unit did not complete before the answer | Throwaway project |
| 4. Workspace experiment | A written answer, from hand-made worktrees and no product code, to the questions below | Nothing | Observed and recorded with what was run | Nothing to undo |
| 5. Side-by-side start | `maxParallel`, the four rules, holds, workspaces, closing notes, the queue reached from a workspace | Slices 1 and 4 | Two workspace runs in progress at once, both read correctly from the line. Two simultaneous `--take` calls get different units. Each refusal: shared scope, over the limit, a halted line, a hold already taken, a path that is not a worktree of this repository, an uncommitted line. A removed workspace after a closed run still reads `built` | Default of 1 keeps every existing queue as it is |
| 6. Integration | `built`, the integration run, merge at start, commit at completion | Slice 5 | Journey test: units A and B each pass alone; A integrates; B's integration fails the line's checks and halts naming B and the failing check; a `retry` decision lets B integrate after repair. A conflict in the shared ledger is resolved inside the integration run's scope | An integration run that has not completed leaves the merge uncommitted and the line's last commit intact |
| 7. Second-half live trial | Two builders and one reviewer on a queue of `A` and `B` side by side, then `C`, with one planted question from `B` to `A` | Slices 2 and 6 | A person watches. Pass means: the question was answered by the other agent, both units reached the line, and `C` started from both | Throwaway project |

Slice 4 must answer, each with a pass condition:

1. Does a session opened in a worktree of an installed project get live hooks and a working engine? Pass: its prompt and Stop are recorded in that worktree's `.cyc/runtime`. This repository ignores its own engine and hook settings, so the experiment uses an installed project.
2. Do two live sessions in two worktrees collide on any lock or state file? Pass: two runs finish at overlapping times with no refusal.
3. What does a fresh worktree lack that checks need, such as installed dependencies or ignored files? Pass: a list, and whether a setup command in `.cyc/config.json` is needed. If it is, it joins slice 5.
4. Do two branches that each add an index row and a ledger entry merge to a file that passes context lint? Pass or fail decides whether slice 6 needs a union merge for those two files.
5. Does `git worktree` behave on Windows with long paths and a path containing spaces?

## Impact map

| Area | Affected by | Verify |
| --- | --- | --- |
| `scripts/queue.mjs` | Board, seats, holds, start rules, closing notes, `built` and `integrating` | The existing queue tests pass unchanged with no board and `maxParallel` absent |
| `scripts/runtime.mjs` `completeRun`, `startRun`, `queueIO`, review recording | Rules 1 and 2 inside completion; scope comparison; the line reached from a workspace; a receipt built from the board; merge at an integration run's start, commit at its completion | A bound run in a one-at-a-time queue with no board message takes none of the new path |
| `bin/cyc.mjs` `compact`, the queue dispatch | `board` on every run result that changes the run; `post`, `board`, `release`, `clean`, `--seat`, `--take` | Unbound run output is byte-identical to before |
| `scripts/run-gate.mjs` | A reviewer session touches no run. An integration run changes many files in the line | Stop tests for a reviewer beside a builder, and for a session in the line during another session's integration run |
| `scripts/source-snapshot.mjs` | The board and its lock sit under `.cyc/queues`, already excluded | Posting a message does not change a run's source hash |
| Scope guard | A merge into the line; a session that edits in the line while units build | Integration refuses to start with another run open in the line |
| Change records and receipts | "From the board"; a peer receipt led through the board | Context lint and the review renderer accept both |
| Skill and guide | Where a session opens, when to post, when to check, never posting as the person | Read by fresh sessions in both live trials |
| Release size | New module code and guide text against the 1.1 MiB budget | `pack:release` size assertion |

## What would make this design wrong

- **Agents ignore messages attached to command results.** Then checkpoint delivery fails and nothing else here matters. No fixture can show this. Slice 3 is placed before any second-half work for that reason.
- **A reviewer and a builder never meet.** If the builder finishes before the reviewer's first finding lands, the seat is theater. The rule that a held seat blocks completion is the answer proposed; slice 3 shows whether it costs more waiting than it is worth.
- **A worktree cannot run real projects' checks, or shared records cannot merge.** Slice 4 finds out before slices 5 and 6 are built.
- **Integration needs more judgment than a run in the line can give.** If most integrations conflict, side-by-side units save nothing. The start rule on shared feature records is meant to prevent that; slice 7 measures it once.
- **Talk costs more than it saves.** Two agents asking each other trivia is slower than one agent reading the code. The skill should say: read first, ask when the answer is a decision the other unit owns.

## Decisions for the owner

1. **Build the first half and try it live before starting the second?** Recommended: yes. Slices 1 to 3 change no existing rule and need no commits.
2. **May a side-by-side queue commit locally?** Recommended: yes, for queues with `maxParallel` above 1 only, stated in the queue file: one commit per built unit on its branch and one merge commit per integration, never pushed, no attribution lines. Worktrees and merges need commits. Without this the second half cannot be built as designed.
3. **Must the line be committed before a side-by-side queue is created?** Recommended: yes. The alternative is to carry uncommitted work into each workspace, which hides what each unit started from.
4. **Does a halted unit stop units already in progress?** Recommended: no. It stops new starts; work in flight finishes and waits as `built`.
5. **Does a held review seat block completion?** Recommended: yes, until `review-done`, release or a 30-minute lapse.
6. **Who answers for a unit that is no longer running?** Recommended: the person.

## Out of scope

- Starting sessions. A person, or a lead session where the host allows it, still opens each one. Unattended running is its own slice and needs its own host test.
- Instant delivery. No message interrupts an agent between its controller commands.
- Push, pull requests and deploys.
- Boards across machines. A board belongs to one checkout, like its queue.
- Proving who posted. `from` and a seat's session are what the controller was told.
- The three small defects the first trial found: an unexplained proof-review refusal, `queue status` after the line completes, and two sessions in one folder sharing one reply draft. They are fixes of their own.

## Challenge

A fresh-context reviewer read the first draft against the code and reported twelve findings, six of them high. It ran nothing beyond read-only searches. Each finding was checked against the code before the plan was changed.

| Finding | What changed |
| --- | --- |
| A failed integrate had no exit: no decision applies to a complete run | Integration became a run, so the existing decisions apply |
| A session cannot follow its run into a worktree | Each builder session opens in its workspace; slice 4 has pass conditions |
| The reviewer had no identity and could not record a review | Seats are recorded; the builder records a receipt built from the board |
| `built` and `done` could not be read from runs | They are read from the build run and the integration run |
| Locking was assumed | The board has its own short lock; rule 1 is checked inside completion; read marks live in each run's own state |
| Run records die with their worktree | A closing note per ended run in the queue file; a workspace lifecycle |
| Separate `paths` are not separate scopes | The start rule compares enforced scope; shared index and ledger go to slice 4 |
| Stop gate and guard at a merge were understated | No unit builds in the line; integration needs no other open run there |
| The uncommitted line was undecided | Decision 3; drift baselines stated |
| Stuck and undefined cases in the rules | Cap exempts answers; `to: all` is for notices; own questions must be closed; kinds and dispositions listed; seats lapse; holds count and have no timer |
| Slice checks missed outcomes | Positive journeys added; the test count claim removed |
| Two records of one finding | The board is the record; the receipt cites it |

Three rows of the facts table were also corrected: what the proof does first, which results carry queue advice, and how many hooks Cursor has.

The revised plan has not been reviewed again. The changes are mine.

## Limits of this plan

- It is written from the code and one live trial of the one-at-a-time queue. No part of it has run.
- Line numbers are from the working tree on November 20, 2026, which includes uncommitted work.
- The second half rests on Git behavior that has not been tried here: worktrees on Windows, merges of the shared context files, and checks in a fresh worktree. Slice 4 exists to try them.
- Merging at the start of an integration run and committing at its completion is new controller behavior with no precedent in the code. Its design will need its own Scout.
- The plan assumes CYC keeps to prompt and Stop hooks. A host hook that fires after each tool call would allow faster delivery and is not used.
