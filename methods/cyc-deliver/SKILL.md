---
name: cyc-deliver
description: "Write the final handoff: result first, evidence labeled in the same sentence, one useful visual, and honest limits. Use at the end of any CYC task, when handing off to another person or session, or when a blocker stops the work."
---

# Deliver the result

The reader should know in ten seconds what happened and whether to trust it. Follow the [response standard](../../docs/response-standard.md) and [handoff contract](../../docs/skill-contract.md).

Leave the engineer able to follow and maintain the change: summarize the before/after mechanism, the consequential choice, and where to find the relevant check and retained context. Reuse the shared review and existing evidence rather than adding a teaching report. Self-review the [engineering understanding criteria](../../docs/response-standard.md#engineering-understanding-throughout-the-work); do not claim comprehension merely because explanations were supplied.

## The core loop

1. **Lead with the result or the blocker.** First sentence: what now works, or what stopped you. "Homework can now be marked finished and it survives reload."
2. **Label each claim in the same sentence.** *Ran*: "the persistence test fails on the old code and passes now." *Read*: "the reminder job skips unknown fields (read, not run)." *Didn't check*: "cross-device sync is untested." For code changes, name the decisive regression test or its precise review location alongside the command/result so a maintainer can find the assertion; this does not apply to conversation-only work. Never hand the reader a check you could have run yourself.
3. **Frame impact for the user, then the maintainer.** What they will see, then what changed in the code.
4. **Include and display one visual that carries information, even under the 1,000-character limit.** Choose it with the answer: a diagram or labeled flow for processes and relationships, a data chart for quantities, a before/after for changes, or a table for comparisons and status. Use available rendering tools when helpful; otherwise use a readable text flow. A bare link, decoration, or a table that restates the paragraph above it doesn't count. Check that the visual makes the main idea easier to grasp, not merely that its markup passes the gate. Every number or output in it must be one you observed this run: take "before" values from running the original code, never from reading it. If you did not run the old code, describe the change without a before-value.
5. **Use the shared review artifact.** Link `.cyc/runs/ID/review.md`, generated from handoffs and receipts, alongside relevant files/diffs. Refresh it with `run review` after external changes and reuse it for an authorized PR. Update underlying records rather than maintaining competing reports.
6. **Retain what the next task needs.** Follow the [Deliver assessment](../../docs/work-assessments.md#learning-lifecycle-and-final-file-order): record verified reusable facts, actual adopted decisions, and error history with evidence and limits; keep unverified hypotheses or undecided proposals explicit in run-local notes. Name the canonical component/index path so a teammate can find the learning; identify local-only evidence. Bug fixes and recorded failures require the selected `ledgerPath`; when run-local, explain in `errorHistory.reason` that shared-log promotion remains pending authorized scope. Do not claim the shared log was updated. Finalize durable updates before final verification; source changes afterwards require fresh Verify. No reusable finding is a valid `learning: none` with a reason. The Deliver handoff records `contextDocs`, the component docs under `docs/context/` among the artifacts and `learning.artifacts`; a mapped component whose doc the run did not touch is what `cyc context review --run ID` proposes an entry for, from the run's record, and `--write` appends it and refreshes the index (see [Context](../cyc-context/SKILL.md)).
7. **Check session readiness and say what is left.** The latest run's completion is not the whole session's readiness. Codex/Claude `packet` preflight includes current-request run status; `cyc readiness --session ID` provides a read-only diagnosis. Without mapped hook state, supply the actual request start with `--since ISO_TIMESTAMP`; that explicit window does not replace the Stop hook. Cursor packet preflight leaves controller readiness unverified, so inspect its actual request window separately. Preserve stopped originals and failed attempts; do not start replacements or change a cutoff to evade a block. Disclose accepted pre-existing failures (each with its reason), unverified rows, known limits, and a decision only if one remains. No forced "next task."

## Shape for code work

```text
Result: one or two sentences.

[One displayed visual: changed flow, before/after, or criteria table,
chosen for what the reader needs to understand.]

Changed: files and why (short).
Not covered: what wasn't checked and why.
Your call: a decision, only if one exists.
```

## Done when

The first sentence states the result or the blocker. Every claim has a label. The visual is included in the response, its form fits the subject, and it adds understanding. Limits are stated. The length honors the conversation's `limit on` or `limit off` setting; shortening prose must not silently remove the visual.

If the host gate provides a review token and packet path: in Claude Code and Codex, a completed `run finish` writes the packet from the run's record, and the Stop gate checks the reply itself. Otherwise (no completed run, files changed after finish, or Cursor) write it with `cyc packet`; Cursor's packet carries the exact final response. Before sending, draft the reply in `.cyc/runtime/reply.md` and run `cyc check-reply .cyc/runtime/reply.md --session <ID>`: it reports the character count, how much to cut, and whether the visual is recognized, writes nothing, and is the same check the gate applies. If hooks aren't active, say that automatic enforcement is unverified.

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Buried lead | Three sentences of process before the result | Result first |
| Unlabeled claim | "Everything works" | Say what was run, read, or unchecked |
| Log replay | Narrating each step taken | Report outcomes, link logs |
| Decoration | An emoji or a table that repeats the prose | Use a visual that adds facts |
| Reconstructed before-value | A before/after row whose "before" was worked out by reading old code | Run the old code, or drop the before-value |
| Hedge fog | "Should probably mostly work" | State what's proven and what isn't, plainly |

A blocked handoff starts with "Blocked:", names the missing prerequisite, and names the smallest action the user can take. It is never presented as done. If verification failed, send the work back to its stage instead of polishing the summary.
