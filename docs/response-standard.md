# CYC human-ready response standard

Status: implemented delivery gate shared by the Codex and Claude Code adapters. Work-run completion is separately recorded by the [controller](runtime.md).

## Delivery contract

Final summaries are at most 1,000 Unicode code points by default. Count the entire raw response, including Markdown, links, newlines, and diagram source, so the limit cannot be bypassed through formatting. Normalize CRLF to LF. The underlying research, code, lessons, and reusable documents are not constrained to 1,000 characters.

Start with the result or blocker, explain the evidence and material limits, and include one useful visual in the final response, including when the 1,000-character limit is on. Plan the visual alongside the answer; do not spend the entire character budget on prose and drop it afterward. A link to a visual is not the same as displaying it.

Choose the form that makes the main idea easiest to grasp:

| What the reader needs to understand | Preferred visual |
| --- | --- |
| A process, dependency, or cause and effect | Compact labeled flow or Mermaid diagram |
| Quantities, trends, or distribution | Chart based on actual data |
| A change in appearance or behavior | Before/after comparison, annotated screenshot, or diagram |
| Options, criteria, or check results | Small comparison or status table |

Tables are appropriate for comparisons and status, not a universal substitute for a diagram or image. Use an available rendering or visualization capability when it improves comprehension; do not assume a particular plugin is installed. Display the visual inline when supported. If the host cannot render it, use a readable labeled text flow or comparison. Preserve meaningful alternative text for images and do not claim rendering was verified unless it was observed.

The visual should communicate the key relationship, difference, or result at a glance. Put supporting evidence and caveats in the prose rather than repeating the visual sentence by sentence. Avoid decoration, invented data or progress percentages, and diagrams that add no understanding. **Every value in a visual is observed, not reconstructed.** A "before" value must come from running the original code (for example the new test or a one-line script against the unchanged files); if you did not run it, show the behavior change in words or show only the measured "after". A guessed before-value is a false claim even when the after-value is right. Keep simple answers proportionate; do not turn an acknowledgment into an elaborate graphic. The gate recognizes structure only, so passing its visual check is not evidence that the visual was useful or rendered correctly.

Use a few short paragraphs or at most five primary list items when useful. These are editorial guidelines, not medical assumptions about the reader. No unsupported time estimates, compulsory next task, or repeated recap. Expansion changes presentation depth, not the standard of evidence.

The reliable expansion commands are a standalone `expand` or `/cyc-expand` (optionally followed by the desired focus). They apply to one user turn. Ordinary references to the word "expand" do not disable the limit. More varied natural-language requests can be supported by an adapter later; for now detailed files preserve a full requested artifact with a short chat handoff.

## Progress updates

Usually give one or two readable paragraphs at a meaningful discovery or decision, and about every minute during long work. Explain the concrete behavior, relevant mechanism, evidence and next uncertainty. A command count, stage name or repeated reassurance is not a useful update. State observed failures separately from suspected causes. Before changing an assertion, explain the requested behavior that justifies it; never change a failing criterion merely to pass.

For long commands, prefer the returned bounded operation handle and latest actual output. No output is silence, not progress or success. Keep setup/host limits separate from product defects. User interruption is not verification. Progress text has no final-response length/visual gate; clarity is a judgment, not a controller-certified property.

## Engineering understanding throughout the work

Help the engineer follow cause and effect while decisions are still useful: trace authoritative state and consumers in Scout, connect the implementation to that contract in Build, explain what a failure disproved during recovery, and connect each decisive check to its practical limits in Verify. Deliver a usable result, maintenance pointer and material limitations. Use the relevant moments naturally; these are not six additional stages or documents.

Use plain language without erasing technical substance. Name a function/interface when it helps locate the issue. Explain consequential choices and rejection/recovery behavior; skip generic lectures, mandatory quizzes and invented user approval. Match depth to the actual question. Keep lasting context in existing run/handoff artifacts rather than a parallel teaching report. The [Teach method](../methods/cyc-teach/SKILL.md) supports requested lessons.

Before delivery, check whether a reader can locate the affected path, follow the consequential choice, understand why the checks matter and find retained evidence. Repair missing explanations. Distinguish explanation supplied from understanding demonstrated: only the engineer's observed reasoning, correction or application supports the latter. A controller pass, fingerprint or agent review does not prove understanding or product correctness.

## Character-limit toggle

Send one of these as a standalone message:

| Message | Effect |
| --- | --- |
| `limit off` | Remove the character cap until you turn it back on. |
| `limit on` | Restore the 1,000-character maximum immediately. |
| `limit status` | Report the current setting without changing it. |
| `expand` | Allow a detailed response once; preserve the persistent setting. |

The toggle applies to the current conversation in the current host. It survives subsequent turns and resuming the same session; new conversations start with the limit ON. It does not change other conversations or synchronize between Codex and Claude Code. Both hosts support the same behavior.

Standalone "Turn off the thousand character limit" and "Turn on the 1,000-character limit" are also recognized, with optional "please" and trailing punctuation. Mentioning a toggle inside a longer request, quotation, code block, or example does not activate it. Use plain `limit off` and `limit on` to avoid host-specific slash-command routing.

The assistant confirms the setting after a toggle. Turning the limit OFF only lifts the length cap: visuals, acceptance checks, evidence, and honest limitations remain required. OFF permits useful depth without requiring verbosity. Expansion never silently turns an OFF setting back ON. Hook-generated repair continuations retain both the setting and retry budget.

`cyc check-reply` without `--session` is a stateless diagnostic: its default remains capped, and `--expanded` explicitly checks without the cap. With `--session`, and in the hook, the conversation setting applies automatically.

## Levels of done

| Level | What must be established |
| --- | --- |
| Produced | The requested work exists and addresses the current scope. |
| Checked | Task-specific acceptance criteria have observable supporting evidence. |
| Human-ready | The result, useful visual, evidence, and limits are understandable to this audience. |

Only a ready handoff may describe work as complete. It must clear all three levels. For a conversation-only answer, a relevant comparison or source-supported explanation may be the deliverable; do not invent a software test requirement. A blocked handoff can be human-ready while the task remains incomplete.

## Review packet

The UserPromptSubmit hook supplies a local packet path and a fresh token. Write a review to that path before finishing. The token prevents a packet from an earlier request from being reused.

Native Claude/Codex finish generates the request-bound packet from the canonical run evidence, without claiming human review of the reply. Stop still checks length, visual and blocked prefix. It accepts a finish packet only when every named run completed in this request for this session, the writer recorded its exact digest, and no later finish superseded it. Multiple completed runs retain compatible checks/files. A forged writtenBy label cannot substitute. If response is included it must match exactly; Cursor requires it because Stop lacks reply text. Explicit mode selects capability, never a session string's length.

Authorized standalone finish writes run-local delivery.json with hook activation unverified and product readiness uncertified. It cannot downgrade a live native request or fabricate its state/token. Native manual packets remain for advisory/blocked work or source changes after finish; Cursor uses its explicit exact-response packet. Reread the final reply for all four human-readiness questions even when finish generated the packet. Never paste packet bookkeeping into the final answer.

For code changes, include the decisive regression's exact name or precise review location with its command and result. A count alone leaves a reviewer searching for the assertion. Conversation-only work does not need an invented regression. Codex/Claude packet preflight also checks the current hook request's controller statuses; a completed latest run cannot hide a stopped original. Use `cyc readiness --session ID` for diagnosis. Explicit `--since` windows and Cursor-tag diagnostics remain separate from live host enforcement.

`cyc packet --session ID --passed "criterion :: evidence"... [--unmet ...] [--artifact PATH]... [--status ready|blocked] [--blocker TEXT] [--response FILE] --reviewed` writes this packet. It reads the token from the session's hook state, hashes the listed artifacts, and runs the Stop hook's packet and run checks, printing any issue so it can be repaired before the turn ends. With `--response`, it also checks that reply, and Cursor requires it. A reply drafted under `.cyc/runtime/` and passed with `--response` is checked for length and visual before it is sent; send that text unchanged. `--reviewed` is the agent's explicit affirmation of the four human-readiness questions after rereading the reply; the command does not judge them. Hand-written packets in the format below remain valid.

Without `--status`, the controller's record decides. In Claude Code and Codex, a run touched during the request that ended blocked, halted, paused, stopped, exhausted, or past its time budget makes the packet `blocked`. That run is one this session owns, or an unowned legacy run, the same runs the Stop gate counts. Cursor packets have no request window, so Cursor states `--status blocked --blocker`. Its `blockedBy` lists those runs with their status and the reason the controller logged, so the agent does not retype them. `--blocker` alone also means blocked. An explicit `--status ready` is kept, and the run gate then refuses it. At Stop, every run named in `blockedBy` must be an unfinished run of this request; a run that has since completed, belongs to another session, or does not exist is refused.

When the Stop gate rejects a reply whose packet does not copy it, the same correction says to rerun `cyc packet --reviewed` for the revised reply. A review written before a rejection never covers the revision; a packet that copies the reply is tied to its text instead.

```json
{
  "token": "TOKEN_FROM_HOOK",
  "response": "The report is ready.\n\n| Check | Result |\n| --- | --- |\n| Sources | Verified |\n\nSay expand for details.",
  "status": "ready",
  "checks": [
    {
      "criterion": "The report answers the requested comparison",
      "result": "passed",
      "evidence": "Reviewed all three requested options against the supplied criteria."
    }
  ],
  "humanReview": {
    "answersRequest": true,
    "understandable": true,
    "visualAddsInformation": true,
    "limitationsDisclosed": true
  },
  "artifacts": [
    { "path": "report.md", "sha256": "SHA256_OF_CURRENT_FILE" }
  ]
}
```

Use `artifacts: []` for conversation-only work. For created or changed deliverables, include their paths and current SHA-256 hashes. Artifacts must be files within this project. The gate checks their current bytes, including resolving symlinks, so changing a listed file invalidates its review. It cannot discover omitted artifacts or determine if checks are truthful. Evidence should identify the actual command/result, source, or human review used. Hashes bind evidence to a revision; they do not establish correctness.

For an external blocker, use `status: "blocked"` with either a nonempty `blocker` field repeated verbatim in the response, or the `blockedBy` runs `cyc packet` records, and retain checks with `result: "unmet"` as appropriate. Start that response with "Blocked:" or "Not ready:" and say what stops completion. Record what was attempted and what is needed; never relabel this as success. The gate checks the prefix and the verbatim blocker text, not whether the explanation is adequate.

## Correction loop

1. Produce or repair the work against the accepted criteria.
2. Perform meaningful checks and retain evidence.
3. Draft and review the final response and visual.
4. Run the delivery gate; address specific failures before trying to finish again.

The gate allows three correction passes, then stops with an explicit NOT READY system message. This bounds an unproductive loop without issuing a success decision. A genuine external blocker can be handed off earlier. The counter belongs to a session and resets for a new user request, not for a hook-generated continuation. Interruptions remain controlled by the host.

A correction is short: a header line (`CYC_GATE_CONTINUE: Correction n/3. Revise the reply:`), one line per issue starting with `- `, and one line naming the draft check. The length issue says how many characters to cut. The prompt-time instructions are not repeated; the correction carries only the packet path and the token. The same lines make up the NOT READY message.

Check a draft before sending it: `cyc check-reply .cyc/runtime/reply.md --session ID` applies the reply's own checks, character count against the cap, how much to cut, and whether a visual is recognized, reads the conversation's `limit off` or `expand` state, and writes nothing (`--expanded` instead of `--session` checks without the cap). The recognized visual forms are a Markdown table, a mermaid block, an image with alternative text, and a labeled arrow flow of three or more steps, on its own line with `→` or inside a fenced block with `->`, `-->`, `──►` or `→`. Two words joined by an arrow are a phrase, not a flow.

## Enforcement boundaries

The command hooks enforce length, recognizable visual structure, packet freshness, a recorded review, current listed artifacts, and bounded retries. They require the agent to assess meaning, audience fit, truthful evidence, visual relevance, and task completeness. They cannot mathematically certify those judgments. Code workflows additionally use configured project commands through the controller. The Stop hook is run-aware: any controller run touched during the current request (see `scripts/run-gate.mjs`) must end complete before a ready delivery. A run still running blocks completion; a paused, blocked, stopped, halted, exhausted, or expired run permits only a blocked handoff. Runs untouched during the request are ignored so stale work cannot block conversation, and malformed run files are skipped. Runs are owned by the session that started them (`run start --session`, with the ID supplied in the gate context); another conversation's run never blocks this one, so several conversations can work in the same folder. Runs started without a session are treated as unowned and still count if touched during the request. The hook checks run status only; it does not re-run verification.

The Stop hook is also change-aware. At the prompt it records the commit that is checked out and the files Git reports as changed. Without Git, it records the controller's source selection instead. At Stop it compares again. An edit committed during the request still counts. Committing, staging, or `git reset --soft` does not count, as long as the file's working-tree content is the same as at the prompt. For a file that was clean at the prompt, that content is its blob in the commit checked out at the time. If project files changed and this session touched no run, a ready delivery is blocked. Two things let it through: a blocked handoff, or a packet `advisory` that states why no run applies (`cyc packet --advisory "<reason>"`). The comparison also skips:
- controller bookkeeping under `.cyc/runtime`, `.cyc/runs`, and `.cyc/engine`, so write reply drafts there;
- files inside the scope of another conversation's run that was touched during the request.

How changes are detected:
- Tracked edits are compared by content.
- Untracked files are compared by size and modification time.
- Submodules and nested repositories are compared by their own changes.
- More than 5,000 untracked files are compared as a single digest of their paths.
- Git runs without optional locks, so the check never rewrites `.git/index`.

This check has limits:
- The advisory is a recorded self-declaration, not proof.
- Edits made after a run completes, within the same request, are not compared with that run's verified source.
- A touch that changes an untracked file's modification time counts as a change.
- The rule compares working-tree content. A commit of other content, followed by restoring the prompt-time file, is not detected.
- Nested repositories, and more than 5,000 untracked files, are compared by digest, so committing inside them still counts as a change.
- Hook state from before this check, or a project where Git and the snapshot are both unreadable, skips the comparison.
- A reading that does not finish within its deadline (a slow `git status`, or many changed files to hash) is reported as an issue rather than skipped: deliver a blocked handoff, or record an advisory when no project files changed. The installed hook timeout is 60 seconds for the same reason; a hook the host kills never reaches the gate.

At each prompt the hook also removes its own files under `.cyc/runtime` that are older than 14 days and belong to another conversation: `<key>.state.json`, `<key>.review.json`, a set-aside `<key>.state.json.corrupt-<id>`, `cursor*.review.json`, and `*.tmp` leftovers. It removes nothing else there and enters no folder, so drafts, `FINISH.json`, check output and anything an agent keeps under `.cyc/runtime` stay.

`run start` stores the gate key when it is given a native host session ID that has hook state, so the run stays visible to that conversation's gate. A gate fault at the prompt, such as invalid configuration or a missing module, adds a warning instead of refusing the request; Stop stays strict. When Git cannot list registered worktrees, Stop checks this checkout's runs only.

Stop hooks request continuation at completion time. They do not buffer or retract text already streamed to the user. Strictly withholding every draft requires a separate buffered delivery surface. Host limits, interruptions, disabled hooks, or unsupported versions can also prevent enforcement. Local editable hooks are workflow guardrails, not a tamper-proof enterprise security boundary.

## Host setup and status

- Project-local Codex configuration: `.codex/hooks.json`.
- Project-local Claude Code configuration: `.claude/settings.json`.
- Both invoke the same Node implementation with a host identifier.
- Use the [project installer](installation.md) to generate commands referencing the target project's copied engine and explicit root. Reinstall after moving the project or changing the Node installation. This source checkout's existing hook configuration is local to its original path.
- Codex requires trust for the project configuration and exact hook definitions. Review them with `/hooks` in a new Codex CLI session. A configuration file does not establish that this already-running desktop task loaded it.
- Setup can inspect this request with `onboard --host codex --session ID --token TOKEN`, using the injected token. It distinguishes missing/stale evidence, prompt pending completion, rejected drafts and accepted Stop. New state binds implementation/configuration/declarations and response identity; older state is intentionally unverified until a fresh prompt. See [setup diagnostics](onboarding-recovery.md). This local trace does not certify host trust or replace the run/response gates.
- Restart Claude Code in this project and review its hook configuration. Claude Code is not installed on the current command path, so live execution there has not been verified.
- Tests exercise real hook subprocesses with simulated host events. They do not constitute an end-to-end test inside either host.

Hook protocol references: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code hooks](https://code.claude.com/docs/en/hooks). Reviewed September 25, 2026.


## Project-owned presentation

With `.cyc/config.json` setting `delivery.presentation: "project"`, the project's existing response rules own length, visuals and presentation review instead of this standard's CYC checks. The controller run gate still requires completed work or an honest blocked handoff. Cursor needs a minimal exact-response identity packet to associate session-tagged runs; see the installed Cursor rule. This setting does not disable project hooks or declare them verified. It is captured by project configuration and must not be changed mid-run to bypass a failed check.

Registered Git worktrees are searched for runs owned by this same session. Independent folders need their own hook activation. This does not establish live host loading.

Projects may set `delivery.defaultCharacterLimitEnabled: false` to start new sessions without the character cap. The default remains true when omitted. Explicit session toggles always win and remain persistent. This changes only length, not visual/readiness checks.
