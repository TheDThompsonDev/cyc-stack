---
name: cyc-scout
description: "Get from request to a concrete plan in one or two minutes: one parallel batch of searches and reads, then a short plan naming the files to change, the consumers to keep consistent, and the checks to run. Use at the start of any feature, bug fix, refactor, or verification task before editing code."
---

# Scout, then build

For a new website, composed interface or visual redesign, use the [frontend design method](../cyc-design/frontend-design/SKILL.md) before choosing structure or acceptance criteria: write `design/decisions.md` (archetype, typeface pair, palette values, signature element, rejection condition) and, for several sites, the set-divergence table. A palette, image presence and readability cannot be the entire visual criterion. Keep this within the user's criterion count; a narrow repair preserves the existing direction.

Scouting establishes the affected behavior and the next justified action. For an implementation route, aim for a short plan and a useful first edit; for Investigation, Review, or Verify, establish the explanation or checks without assuming permission to change the product. Expand investigation for consequential uncertainty; verification cannot justify skipping relevant project history or a misunderstood goal.

For user updates, follow the shared [progress standard](../../docs/response-standard.md#progress-updates): explain the observed behavior and the likely or confirmed mechanism in short, readable prose, then the next useful change or unresolved question. File counts alone do not explain a discovery.

Build the engineer's picture of the affected system: connect the relevant input, state, and readers; explain how checked project history informs the approach and which trade-off matters. Follow the [engineering understanding standard](../../docs/response-standard.md#engineering-understanding-throughout-the-work). Agreement on scope is not evidence of comprehension; ask only for a consequential missing decision.

## The pass

After locating the affected paths, run `node <cli> investigate --path <paths>` (or `--run <ID>` with a known scope). Read the returned records and recipe definitions. Run applicable investigation recipes when their prerequisites hold and effects are already authorized; explain unavailable checks. Reuse equivalent current evidence already returned by discovery rather than rerunning solely to create a receipt. Do this without a separate user request, and reuse the result until paths or evidence change. Missing recipes mean ordinary focused discovery, not a new documentation requirement. See [project tools](../../docs/project-tools.md).

1. **One parallel batch, not a file-by-file tour.** In a single round of tool calls, run together:
   - a search for the entry point (the visible string, route, function, or error message)
   - a search for every reader and writer of the data you'll change (field name, storage key, event name, exported function)
   - the existing feature map (if any), `docs/context/INDEX.md`, and the selected error ledger for these paths
   - `git status` / `git diff --stat` when work is already in progress
2. **Reuse what is established.** Read matching current component context, then inspect the affected functions and integration boundaries. Follow [Context](../cyc-context/SKILL.md) for revision/file-evidence checks; revalidate affected claims when dependencies drift. Reuse still-applicable impact knowledge, failed approaches, and check recipes rather than reconstructing them. Expand for missing consumers or consequential unknowns. State when no history applies. Choose **reuse, extend, repair, or create**, with evidence; use the project's existing capability map. Stop when affected behavior, intended files, consumers, and checks are understood.
When the change introduces or reshapes state, ownership, or an interface, use the [architecture questions](../../docs/code-quality.md#choose-a-structure-that-protects-the-contract) while choosing the approach. Name the authoritative state, permitted writers, and invariant at the real caller. Compare another shape only if consequential uncertainty remains; a familiar local change does not need a design exercise.

3. **Write the plan in about ten lines:**

   ```text
   Goal: one sentence.  Done when: 2-4 checks.
   Approach: reuse/extend/repair/create → existing capability and reason.
   Context: relevant history, freshness, known failed approaches (or no match).
   Change: file → what changes (one line each)
   Keep consistent: consumer → why it depends on this (from the search)
   Test: the checks that would show it broken
   Open: only decisions that change the solution (with your recommendation)
   ```

4. **Explain consequential changes.** Current behavior → proposed change → reason → decision needed. Ask only when an unresolved answer changes the solution; bundle questions with a recommendation. Otherwise state supported assumptions and continue. Record alignment as clear or actually confirmed; unresolved consequential alignment is blocked, not assumed approved.
5. **Record and move on.** If `run start` was given `scout`, Scout is already recorded: do not record it again, because a second record lands at Build. Otherwise `cyc run record --run ID --summary "<plan>" --assessment <scout.json>` for new implementation runs. The [assessment](../../docs/work-assessments.md) records context lookup/freshness, approach, alignment, and stable consumer IDs/checks, including directly affected behavior. Keep JSON in the run directory. Advisory routes retain ordinary handoffs.

## Scale by risk, not by habit

- **Normal work:** the pass above. Do not add paperwork or invent alternatives without a real decision to resolve. For visual frontend work, a useful first implementation can resolve the actual composition with meaningful content and assets; source-edit speed is not a reason to settle for a generic scaffold.
- **High risk** (auth, payments, data migrations, deletes, public interfaces): also run [Challenge](../cyc-challenge/SKILL.md) on the plan before building. It's one focused pass, not a new research phase.
- **Bugs:** include getting the failure to reproduce in the same batch (run the failing test or request). See the [diagnose branch](../cyc-understand/references/diagnose.md) only if it doesn't reproduce quickly.

The detailed skills ([Understand](../cyc-understand/SKILL.md), [Impact](../cyc-impact/SKILL.md), [Design](../cyc-design/SKILL.md)) are reference material for when something is genuinely unclear. Don't read them by default.

## Done when

The findings name the affected files, consumers supported by inspection, checks to run, and the next stage for the selected route. For implementation, begin a safe, useful test or reversible slice once the plan is ready. For advisory work, pass the supported findings onward without editing the product. If investigation takes longer than expected, identify the unresolved question; surface a real blocker promptly. Never defer a critical permission, data-loss, or interface-contract question on the assumption that verification will catch it.

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Serial tour | One file read per step, narrating each | Batch searches and reads in parallel |
| Reading for completeness | Understanding code paths the change doesn't touch | Stop when every changed file and consumer is named |
| Paperwork | Tables, evidence rungs, category checklists | Ten-line plan |
| Pre-verifying | Measuring or testing hypotheticals before any edit | Build, then let the verify loop measure |
| Re-reading instructions | Opening unrelated methods at every step | Load needed instructions once; preserve required outcomes |

## Handoff

Pass the findings to the stage returned by `run next`: Build for implementation, Challenge for review, Verify for verification, Explore for experience work, or Deliver for investigation. Advisory Scout establishes an evidence-backed explanation or review scope, not permission to edit. If later work finds a consumer the plan missed, update the plan and relevant retained context before verification.
