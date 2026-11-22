# CYC work queue implementation plan

Status: slices 0 to 4 are implemented in one controller run on November 19, 2026, from this plan written the same day against commit 25f6626 (version 0.10.0). The user guide is [docs/work-queue.md](../work-queue.md) and the retained record is [docs/context/work-queue.md](../context/work-queue.md). What was built differs from the plan in three places, each marked "As built" below. Unattended running and the other items under [Out of scope](#out-of-scope) remain unbuilt.

## Why a queue

CYC runs one request at a time. A developer writes a task, and one run carries it through Scout, Build, Verify and Deliver. The `plan` playbook already splits larger work into verifiable units, but its output is prose. Nothing records those units, orders them, or starts the next one when the last one passes.

A software factory needs that line. The queue is the first piece: an ordered set of work orders where each order is an ordinary CYC run, and the controller decides which order may start.

```text
Idea → Plan (units with criteria) → Queue
Queue → next ready unit → run (Scout → Build → Verify → Deliver) → complete
complete → next ready unit …      blocked or stopped → line halts → human decision
```

The queue does not make runs unattended, write code with workers, commit, merge or deploy. Those are later parts of the factory and are listed under [Out of scope](#out-of-scope).

## Intended behavior

A person asks for something larger than one change. The plan playbook produces units. Each unit names an outcome, a playbook, acceptance criteria, the paths it may touch and the units it depends on. The agent saves them as a queue.

From then on a short message is enough. "Next" in any chat, including a fresh one, asks the controller for the ready unit. The controller returns that unit's frozen criteria, the change records its dependencies published, and a start file with those fields filled in. The agent scouts, starts the run and works it as it does today.

When the run completes, the next unit becomes ready. When a run ends blocked, halted, exhausted or stopped, the line halts at that unit. Later units do not start until a person decides to retry it, skip it or cancel the queue, and gives a reason.

## What the code allows today

| Fact | Where | What it means for the queue |
| --- | --- | --- |
| Several runs can be active in one project; nothing links them | [scripts/runtime.mjs](../../scripts/runtime.mjs) `activeRun` (line 227), `startRun` (line 1234) | Order and dependency are not enforced anywhere. The queue adds that rule at start. |
| A run halts when files outside its `allowedPaths` change while it runs | `guard` (line 476) | Two units running at once in one checkout would halt each other. Version 1 runs one unit at a time. |
| Completion refuses when the source hash differs from the delivery review | `completeRun` (line 1862) | Queue files must never be counted as project source, or a queue update would invalidate a run's evidence. |
| Controller bookkeeping is excluded from source by a fixed list of three folders | [scripts/source-snapshot.mjs](../../scripts/source-snapshot.mjs) `internal` (line 12) | A new queue folder must join that list. The Stop gate uses the same list for its change check. |
| The Stop gate counts runs by session and request, and skips folders without a readable `state.json` | [scripts/run-gate.mjs](../../scripts/run-gate.mjs) `localRuns` (line 161) | A queue belongs to the project, not to a conversation. It needs no gate rule of its own in the first slices. |
| `run start --file` accepts a fixed list of fields | [bin/cyc.mjs](../../bin/cyc.mjs) (line 206) | Binding a run to a unit is one new optional field. Starts without it are unchanged. |
| Codex workers run with tools disabled and `writePaths: []` | [scripts/codex-host.mjs](../../scripts/codex-host.mjs) (line 13), [scripts/swarm.mjs](../../scripts/swarm.mjs) (line 92) | Existing dispatch cannot build a unit. The host conversation executes each unit. |
| Finish and `run next` already attach advice to their results | [scripts/recovery.mjs](../../scripts/recovery.mjs) `completionGuidance` | "Unit 2 of 5 is ready" can be added the same way, as presentation only. |
| A target project ignores `.cyc/runtime` and `.cyc/runs` | [scripts/install.mjs](../../scripts/install.mjs) (line 213) | Whether queues are local or shared in Git is a decision; see [Open decisions](#open-decisions). |

## Design

### One authority for status

The run's `state.json` stays the only record of how a unit ended. The queue stores the frozen units and which runs were started for each one. A unit's status is read from its latest run each time it is asked for.

| Latest run for the unit | Unit status |
| --- | --- |
| None, and a dependency is not done | waiting |
| None, and every dependency is done | ready |
| running or paused | in progress |
| complete | done |
| blocked, halted, exhausted or stopped | halted |
| A recorded skip decision | skipped |

A skipped unit does not satisfy a dependency. Units that depend on it stay waiting.

Storing a second copy of the status would let a run complete while the queue still says otherwise. Reading it avoids that, and means completion needs no queue write.

### Queue record

Input to `cyc queue create --file QUEUE.json`:

```json
{
  "version": 1,
  "goal": "Customers can export their orders",
  "requirements": "The original request text, kept word for word",
  "units": [
    {
      "id": "export-endpoint",
      "outcome": "An endpoint returns every order matching the current filters as CSV",
      "playbook": "feature",
      "criteria": [{ "id": "all-rows", "description": "Exports all matching orders, not the visible page" }],
      "paths": ["src/orders", "test/orders"],
      "dependsOn": []
    }
  ]
}
```

The controller rejects unknown fields, duplicate unit ids, an unknown playbook, a dependency on a missing unit and a dependency cycle. It stores the record under `.cyc/queues/<queueId>/queue.json` with a hash of the definition. A queue whose definition no longer matches its hash is refused, so criteria cannot be edited after they were agreed.

A playbook that needs checks follows the existing start rule: without configured or declared checks the run is refused. The queue does not add a second check configuration.

### Commands

| Command | Effect |
| --- | --- |
| `cyc queue create --file QUEUE.json` | Validate and store the queue. Returns its id and the first ready unit. |
| `cyc queue status [--queue ID]` | Every unit with its derived status, its runs and any halt reason from the run's own record. |
| `cyc queue next [--queue ID]` | The ready unit, a start file with goal, playbook, criteria, requirements and paths filled in, the change records of its finished dependencies, and any drift. Returns the halted unit instead when the line is halted. |
| `cyc run start --file START.json` with `queue: { id, unit }` | Start that unit's run, subject to the rules below. |
| `cyc queue decide --queue ID --file DECISION.json` | Record `retry`, `skip` or `cancel` for a halted unit with a reason and the calling session. |

### Rules at start

`startRun` checks these under the existing project lock, before any run record exists:

1. The unit is ready. A waiting, in-progress, done or skipped unit is refused.
2. No other unit of this queue is in progress.
3. The start's criteria and playbook equal the unit's frozen ones.
4. The start's `allowedPaths` stay inside the unit's `paths`. Scout may narrow them. Context docs the controller adds for retention are allowed as they are today.
5. A halted unit starts again only after a `retry` decision. Its earlier runs stay listed under the unit.

### Drift between units

When a unit starts, the controller compares the run-start source hash with the source hash its most recently finished predecessor completed at. A difference means something edited the project between units. The start records the changed files and `queue next` shows them, so Scout rechecks what the plan assumed. Drift is a note, not a refusal. People edit projects between tasks.

### Ownership

The queue belongs to the project. Any conversation may ask for the next unit. Each run keeps today's ownership: only the conversation that started it can change it. Queue writes reuse the project lock in `withWorkspaceLock`; the queue adds no lock of its own.

## Impact map

| Area | Connection | Treatment and behavior to verify |
| --- | --- | --- |
| `scripts/queue.mjs` (new) | Holds validation, the derived view, binding and decisions, as `swarm.mjs` and `delegation.mjs` hold theirs | New module of functions over queue state. `runtime.mjs` supplies locking and file access. |
| `scripts/runtime.mjs` `startRun` | Creates every run | Accept the optional binding and apply the start rules. A start without `queue` produces the same state as before. |
| `scripts/source-snapshot.mjs` `internal` | Decides what counts as project source | Add `.cyc/queues`. Verify a queue write between Verify and completion does not change the source hash. |
| `scripts/run-gate.mjs` change check | Blocks a ready reply when project files changed without a run | No rule change. Verify a queue write alone is not reported as a project change. |
| `bin/cyc.mjs` | Option and field allowlists, help text | Add the `queue` command and the `queue` start field with strict inputs. Existing command shapes stay. |
| `scripts/recovery.mjs`, `nextRun` | Advice attached to results | Add `queueAction` after completion and in `run next`. It changes no stage order, ownership or completion decision. |
| `scripts/install.mjs`, `package.json` `files`, distribution checks | Ship the engine and write `.cyc/.gitignore` | Ship the new module and verify a copied install runs `queue status`. The ignore file is managed and hashed, so changing it touches upgrade and conflict behavior. |
| `skills/cyc/SKILL.md`, [plan playbook](../../skills/cyc/references/playbooks/plan.md) | Tell the agent how to route and finish a plan | Plan may save its units as a queue. "Next" continues a queue. A planning-only request still authorizes no building. |
| `docs/runtime.md`, `docs/context/INDEX.md`, a new component record | Describe the controller and its context | Document the commands and keep the queue's rules in one focused record. |
| Registered worktrees | The gate searches them for a session's runs | A queue belongs to one checkout. A queue shared across worktrees is not designed here. |

An affected area is a verification concern, not automatic scope to edit. Recheck this map when a slice shows a consumer it missed.

## Slices

Each slice was planned as one run with its own proof.

As built: slice 0 was run first as an experiment outside the project, and slices 1 to 4 were built in a single run. Every run that changes `scripts/runtime.mjs` or `bin/cyc.mjs` must revalidate nine shared context records, so four runs would have repeated that work without adding proof. Slice 0's result: with and without Git, and with no commit between them, the second run started from the first run's finished files and its proof failed only its own new test. The assertion is kept in `test/queue-journey.test.mjs`.

As built: the queue file stores no unit status. A run carries its binding in its own state, and the queue finds its runs by reading them, so a crash between two writes cannot leave a unit looking ready while a run exists for it. The queue also notes each run it admits, before the run's record is written. The notes give the order of admission, and a note stands in for a run only when its state cannot be read: an independent review showed that a lost run record otherwise freed a halted unit.

As built: three independent reviews ran before completion. The first reproduced eleven findings in the first candidate, none high severity. The second confirmed nine of those corrections outright and found ten more, one of them a defect the first corrections introduced. The third confirmed those ten in behavior and found no high or medium behavior defect, one test gap and several low items. All were corrected in the same run; they are QUEUE-001 in the [error ledger](../context/error-ledger.md). The corrections after the third review were reviewed by the author only.

As built: `.cyc/queues` ignores itself with its own `.gitignore`, so the installer's managed ignore file and existing installs did not need to change.

| # | Outcome | Depends on | How it is verified | Recovery point |
| --- | --- | --- | --- | --- |
| 0 | Characterize two feature runs back to back in one uncommitted fixture project. No engine change. | None | A new test starts, finishes and completes run A, then run B, and observes whether B's proof of failure on the original code uses A's finished files as the original | Test file only; delete it |
| 1 | `queue create` and `queue status` store a queue and show waiting and ready units | 0 | Rejected: unknown field, duplicate id, missing dependency, cycle, edited definition. A queue write leaves the source hash and the gate's change check unchanged | New module and command; no existing behavior touched |
| 2 | A run binds to a unit; order is enforced; `queue next` returns the start file and drift | 1 | Journey through the real CLI: two units, the second refused until the first completes. Rejected: unmet dependency, second unit in progress, changed criteria, paths outside the unit. A start without `queue` matches the original behavior | The `queue` start field is optional; removing it restores slice 1 |
| 3 | A blocked or stopped run halts the line; `retry`, `skip` and `cancel` are recorded | 2 | `next` returns the halted unit and the run's own reason, never the following unit. Retry keeps the earlier run listed. Skip leaves dependents waiting. A decision without a reason is refused | Decisions are additive records |
| 4 | Finish and `run next` say which unit is ready; Plan saves a queue; the engine ships it | 3 | Advice appears only for a bound run and changes no completion result. A packed install runs the queue commands. `node --test` and `npm run check:distribution` pass | Advice and method text are presentation; revert without touching queue state |

Slice 0 goes first because it can change the design. If a second run cannot prove its new tests against the first run's uncommitted result, units would need a commit between them, and a commit needs the user's say each time.

## What would make this design wrong

- **A checklist would do.** The queue earns its place only if the controller refuses things a Markdown list cannot: a unit started out of order, criteria changed after agreement, a failed unit skipped without a recorded reason. If the rejected cases in slices 2 and 3 turn out to be ones no agent would attempt, stop and keep the plan as prose.
- **Plans go stale.** Later units are planned against code that earlier units change. Units therefore carry outcomes and criteria, not implementation steps, and Scout rechecks at each start. A unit whose criteria have become wrong cannot be edited in place; the queue is cancelled and a new one created. If that happens often in practice, in-place revision with a recorded reason needs its own design.
- **Long conversations.** "Next" in the same chat keeps adding to one context. The queue is designed so a fresh chat can continue it, but whether a fresh chat does this well is not established and needs observing on real work.
- **Two copies of status.** If a slice finds it must store a unit's status to make something work, the single-authority rule has failed. Return to the design before adding the copy.

## Out of scope

| Left out | Reason |
| --- | --- |
| Units running in parallel | The scope guard halts a run when files outside its paths change, so parallel units in one checkout stop each other. This needs a worktree per unit. |
| Unattended running | Starting a fresh host session per unit depends on whether a headless Claude Code or Codex session loads project hooks and passes the Stop gate. That is unobserved. Test it on one unit in a real host before designing a runner. Simulated hook events do not answer it. |
| Commit, merge, deploy | The controller authorizes no publication. A gated ship step is a separate part of the factory. |
| Intake for non-developers | Turning a plain idea into units with criteria is the factory's front door. The queue is what that intake will write to. |
| Workers that write code | Current Codex workers are read-only by construction. |

## Open decisions

The three recommendations below were shown to the owner, who then asked for the build without changing them. They are what was built; each remains the owner's to reverse.

1. **Local or shared.** Recommended: keep queues local and ignored in version 1, like runs. A team sharing one line across machines needs the definition in Git and a way to reconcile each person's run records. That is worth its own plan once one person's line works.
2. **Failure policy.** Recommended: any failed unit halts the whole line. The alternative lets units that do not depend on the failed one continue, which finishes more work but leaves a person reviewing a line that moved past a failure.
3. **Paths as a ceiling.** Recommended: a unit's `paths` are a limit agreed with the queue, and a run that needs more is a halt and a decision. The alternative treats them as hints, which is smoother and gives up the scope the plan was approved with.

## Limits of this plan

The plan itself was written from reading the named functions; the line numbers in it are those of commit 25f6626 and have moved since. The build's tests drive the real controller in temporary projects and simulate no host. Nothing here shows that a queue makes delivery faster, cheaper or more reliable, or that a person who is not a developer can use it.
