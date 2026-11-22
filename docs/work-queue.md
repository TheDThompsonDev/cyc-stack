# Work queue

A work queue is an ordered set of units. Each unit is an ordinary CYC run with its own criteria, checks and evidence. The [controller](runtime.md) decides which unit may start, so a larger piece of work moves one verified step at a time.

```text
Plan → queue create → queue next → run start → run finish → queue next → …
                                   a run that ends short of complete halts the line
```

Use a queue when a [plan](../skills/cyc/references/playbooks/plan.md) has several units and the order matters. One change does not need one.

## The queue file

Save the units under `.cyc/runtime` and pass the file to `queue create`:

```json
{
  "version": 1,
  "goal": "Customers can export their orders",
  "requirements": "The original request, word for word",
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

A unit names what is true when it is done, not how to build it: earlier units change the code that later units meet. `paths` is the limit of what the unit's run may change. `dependsOn` lists units that must be done first.

Unknown fields, duplicate or missing unit ids, an unknown playbook, a unit without paths and a dependency cycle are refused. The units are frozen when the queue is created. A queue whose units were edited afterwards is refused; cancel it and create a new one.

## Commands

| Command | What it does |
| --- | --- |
| `cyc queue create --file QUEUE.json` | Checks and stores the queue. |
| `cyc queue status [--queue ID]` | Every unit with its status and runs. |
| `cyc queue next [--queue ID]` | The ready unit with a start file, or the halted unit and why. |
| `cyc queue decide [--queue ID] --file DECISION.json` | Records a person's decision about a halted unit. |

`--queue` may be left out while one queue is open; when none is, the error names the queue that finished last. Every queue command accepts `--session`.

`queue next` writes a start file with the unit's goal, playbook, criteria, paths and a `queue` field. For a playbook that starts with Scout, scout the unit, add `scout` and `plan` (and `contextRetention` when it builds) to that file, then `run start --file` it. Other playbooks start the file as written. From there the run is worked and finished like any other.

`queue next` also lists the change records of the units this one depends on, and `drift`: the files changed since the last unit completed, or since the line's first run started. They come from an attempt that ended short of complete or an edit outside the line, and a retry starts from them. `drift.outsideUnit` lists the ones the unit's run may not touch: tell the user before building on them. A bound run records the same drift at start. Drift never refuses a start, and says so (`lostRuns`) when a lost run record leaves the starting point unknown.

## Rules at start

A run with a `queue` field starts only when all of these hold. They are checked before any run record is written.

1. The unit is ready: every unit it depends on is done.
2. No other unit of the queue is in progress or halted. One unit runs at a time.
3. The playbook and criteria equal the unit's.
4. Every entry in `allowedPaths` is inside the unit's `paths`. Narrower is fine. The context docs the controller adds for retention are allowed as usual.

A start without a `queue` field is an ordinary run, unchanged.

## Unit status

Status is read from the unit's runs each time. The queue stores no copy of it.

| The unit's latest run | Status |
| --- | --- |
| None yet, and a dependency is not done | `waiting` |
| None yet, and every dependency is done | `ready` |
| Running or paused | `in-progress` |
| Complete | `done` |
| Blocked, halted, exhausted or stopped | `halted` |
| Its record can no longer be read (`missing`) | `halted` |
| Ended, with a recorded skip | `skipped` |
| Any, not done, in a cancelled queue | `cancelled` |

A unit's attempts are ordered by attempt number, and a run that has not ended decides the unit whichever attempt it is.

The line as a whole is `halted` when any unit is halted, `in-progress` when one is running, `complete` when all are done, `ready` when a unit can start, `ended` when what remains was skipped or waits on a skipped unit, and `cancelled` after a cancel. An ended line needs a cancel before a new queue replaces it.

## When the line halts

A halted unit stops the whole line. `queue next` returns that unit, the reason its run recorded and the same `drift`, so the files a retry would start from are seen before anyone decides.

A blocked run has not ended: resume and finish it, or stop it. A stopped run keeps the reason it was blocked for. A run that ended halted, exhausted or stopped, or whose record is missing, needs a decision from a person:

```json
{ "version": 1, "unit": "export-endpoint", "action": "retry", "reason": "The failing check was a network outage" }
```

| Action | Effect |
| --- | --- |
| `retry` | The unit may start again. The earlier run stays listed under it. |
| `skip` | The unit is passed over. Units that depend on it keep waiting. |
| `cancel` | Closes the queue. It takes no `unit`. |

Every decision needs a reason. A decision is about one run as it stood: it does not pass a later attempt, or the same run if its record reads differently later. An agent does not record a decision the user has not made.

A queue whose units were edited after creation is refused everywhere except `queue decide --queue ID` with `cancel`, which is how it is closed.

## The board

Agents working a queue, and the person, talk through the queue's board. A message is stored once, with its author filled in by the controller.

```json
{ "version": 1, "kind": "question", "to": "person", "text": "May the export include cancelled orders?" }
```

| Kind | From | To | Closed by |
| --- | --- | --- | --- |
| `question` | Anyone | One unit, or `person` | An `answer` with its `replyTo` |
| `finding` | A reviewer or the person | One unit | An `answer` with `disposition` `fixed` or `declined` |
| `answer` | Whoever the item is for, the person, or its author | Whoever asked | It closes the item |
| `notice` | Anyone | A unit, `person` or `all` | It needs no answer |

Whoever asked may close their own item: a question with `disposition` `assumed` and what they assumed, or either kind with `withdrawn`. A question closed with `assumed` still takes one answer, from whoever it was for or from the person: people often answer after an agent has gone on. That answer reaches the asker at its next command or, once the asker is done, the units that build on it. It holds nothing, and is shown beside the assumption in `queue board` and in `queue next`. The asker cannot give it for someone else.

| Command | What it does |
| --- | --- |
| `cyc queue post [--queue ID] [--run RUN \| --seat SEAT] --file MESSAGE.json` | Posts for a run's unit, for a reviewer, or with neither for the person. |
| `cyc queue board [--queue ID] [--unit ID] [--open]` | Reads the messages; `--open` lists unanswered items. |
| `cyc queue wait [--queue ID] (--run RUN \| --seat SEAT) [--wait-ms N]` | Returns when a message arrives, or after N ms (at most 60000). |

A message reaches an agent at its next controller command. The result of a `run` command for a bound run starts with a `board` entry when something is new for its unit: messages for it or for `all`, and answers to what it posted (the newest 20, with a count of earlier ones). They count as shown once the run's own conversation has run such a command; `run status` and `run recover` do not count. A unit that starts later is shown what was left for it.

`queue status` and `queue next` show how many items are open, the ones that wait for the person, and the latest said to the person. `queue next` also lists `assumed`: what the units this one depends on went on with.

1. A unit cannot complete while a question or finding addressed to it is open. `run finish` returns `needs-answer` and names each one before it runs any check.
2. A unit cannot complete while a question of its own is open. It waits, or closes the question with `assumed`.
3. An item for a unit that is done, skipped or cancelled is the person's, and the post says so.
4. An agent does not post as the person. A post with no `--run` and no `--seat` is the person's. From a conversation that builds or reviews on the queue it is accepted only to relay the person's answer to a question that waits for them, and is recorded as relayed.

### The review seat

A second conversation can review a unit while it is built. It starts no run and changes no file.

```text
reviewer: queue next --seat review --session ID   → the unit, its criteria, the changed files, the sourceHash
reviewer: queue post --seat SEAT   (kind finding)  → the builder sees it at its next command
builder:  queue post --run RUN     (kind answer, disposition fixed or declined)
builder:  queue post --run RUN     (kind notice, topic ready-for-review)
reviewer: queue post --seat SEAT   (kind notice, topic review-done, sourceHash)
builder:  run review-record --run RUN --from-board → one peer receipt, built from the board
```

A seat belongs to the conversation that took it, and the conversation that builds the unit cannot take it. A conversation is the session its host reports; `--session` names it only when the host reports none. `--wait-ms N` lets a reviewer that arrives early wait for a unit to start.

While the seat is held, the unit cannot complete until the reviewer posts `review-done`. The seat also clears on `cyc queue release --seat SEAT`, after 30 minutes with no post, read or wait from the reviewer and no new `ready-for-review`, or when the run ends.

`review-done` carries the `sourceHash` the reviewer read, which every reviewer command returns, and is refused when the source is no longer that. `review-record --from-board` is refused when a finding has no answer, when the source changed after the sign-off, and when the builder has since asked for another look. Settle the context records first, then ask for review.

## The hub

The hub is a page where a person watches a queue being worked. Agents talk through commands and files; the hub is where that becomes visible.

```text
cyc hub   →   http://127.0.0.1:4780/   →   open it in a browser and leave it open
```

| On the page | What it shows |
| --- | --- |
| The line | Each unit in order: done, in progress and what its run is doing, next up, waiting, or halted and why |
| Conversation | Every board message as it is posted: who said it, to whom, and how it was answered |
| Waiting on you | What an agent asked you, or found for you to settle, and has no answer yet. A question you asked yourself stays in the conversation, marked open |
| Activity | What each run did, in plain words: started, finished building, ran the checks, completed |

The hub is read-only and local. It is served from this machine to this machine, answers only `GET`, and refuses a request that reaches it under any other name. It writes no file and moves no read mark, so watching never changes what an agent is shown. It reads the same records the controller writes, about every second and a half, so what it shows is at most a moment behind them. A page that is already current is told so and redraws nothing.

`cyc hub` prints its address and keeps running until it is stopped. Without `--port` it takes the first free port from 4780 to 4799; a port that is asked for and already answers on this machine is an error. It shows the open queue. With several open it shows the one being worked, then a halted one; with none open, the last one created. The queue list on the page, or `?queue=ID` in the address, picks another.

To answer what waits on you, tell your agent what you decided; it posts your answer. Answering from the page is not built yet.

## Limits

- The queue orders runs; it does not start them. Unattended running, parallel units, commits, merges and deploys are not part of it.
- A done unit means its run completed, not that the product is certified.
- Only runs that carry the `queue` field are bound by the rules.
- One unit at a time holds within a queue. Two open queues in one checkout can halt each other's runs.
- A retry starts from the files the halted attempt left, including any outside the unit's paths; they are listed, not reverted.
- Queues are local: `.cyc/queues` ignores itself in Git and is never project source.
- A message cannot interrupt an agent: it is handed over at the next controller command or wait.
- The hub shows what is recorded. Work an agent is doing between two controller commands appears when the next command records it.
- The board is a local file that records what the controller was told. A run is spoken for by the session it recorded; one that recorded none can be posted for by anyone who has its ID. The relay rule knows a builder or reviewer only while its run is open or its seat held, and only by that session.
- A reviewer works in the builder's folder and is trusted to change nothing.
- A queue belongs to one checkout, and its files are editable local records, not attestation. A lost run record halts its unit instead of freeing it; a queue file and its runs edited together are not detected.
