---
name: cyc-build
description: "Implement a planned change in thin, tested slices where every line traces to a requirement. Use for feature work, bug repairs, and refactors once the Scout plan (or, on longer routes, the design) exists."
---

# Build the change

For a new web page or visual redesign, follow the [frontend design method](../cyc-design/frontend-design/SKILL.md): build the signature section from `design/decisions.md` with final copy, the chosen imagery, the main action and the next section's start; render it at desktop and phone width and score it with the generic-tells sheet **before expanding the rest of the page**. Three or more tells means a changed decision, not a color swap. End-of-build screenshots do not perform this checkpoint. No variant quota or user approval round is required. Narrow UI repairs retain the established direction.

Ship the design, slice by slice, with a loop running the whole time. Follow the [handoff contract](../../docs/skill-contract.md).

For user updates, follow the shared [progress standard](../../docs/response-standard.md#progress-updates): briefly connect the code change to the behavior it fixes and what the chosen approach preserves. Explain meaningful changes of direction without narrating every edit.

At a consequential slice, explain how the changed state or contract reaches its readers and why the fix belongs at that boundary. When a failure changes the approach, share the observation, the assumption it challenges, and the next discriminating check. Follow the [engineering understanding standard](../../docs/response-standard.md#engineering-understanding-throughout-the-work); a list of edited files or "retrying" does not explain the engineering.

Write code to the [engineering principles](../../docs/principles.md): the smallest change, the cause fixed where it starts, tests that assert observable behavior, and the codebase's existing patterns.

Before implementation, read the project's applicable `code-standards.md` and follow the relevant [code standards](../../docs/engineering/code-standards.md). Review comments for information value, types for supported facts, catches for an allowed failure contract and abstractions for real responsibility. Preserve required documentation and local conventions; numerical complexity thresholds are investigation signals, not automatic refactor instructions.

Before implementing a slice that adds or changes business rules/transitions, read the [domain design examples](../../docs/engineering/domain-design.md) to locate the invariant's owner and affected writers/readers. For rejection, I/O or partial effects, read the [failure handling examples](../../docs/engineering/failure-handling.md) to decide what committed, what callers can distinguish, and whether retry is safe. Load only applicable guidance and preserve its legitimate exceptions and the project's conventions.

## The core loop

1. **Check the ground.** Look at the working tree and the files you will touch. Preserve uncommitted user work. Start the first useful source or test edit as soon as the short plan is ready. Never wait for an optional baseline: edits may invalidate that diagnostic measurement, but final verification still checks the finished work.
2. **Capture behavior before you change it.** For a bug, the failing reproduction from the [diagnose procedure](../cyc-understand/references/diagnose.md) is that check. For a refactor, write or find a characterization test that captures current behavior at the boundary; type checks and lint do not capture behavior. For a feature, write the first slice's test.
3. **Match the feedback loop to the change.** For a feature or bug fix, write one test for the slice, watch it fail for the intended reason, make it pass, then move to the next slice. For a refactor, run characterization tests on the original and candidate code and keep both green; do not invent a behavior change to manufacture red. Reuse adequate existing tests. For a change without executable behavior, record the specific reason and the inspection that checks it. Copy, styling, and configuration can affect behavior; their file type alone is not an exemption. A prose skip does not replace any `testProof` assessment required by the controller.
4. **Keep the data consistent.** A visible control is not the feature. When the state changes, every reader named in the plan (or impact map) sees it: the count, the filter, the saved record.
5. **Do repetitive work by hand once, then automate.** If the change repeats across many files, do the first by hand, write a script or codemod for the rest, and diff its output against your hand version.
6. **Keep feedback focused.** Use the narrowest applicable verification recipe selected by Scout (`recipe run --recipe <ID>`), or a focused project check when none exists. Run it after meaningful slices and type checks when affected contracts require them; keep expensive journey checks for Verify. Respect recipe prerequisites/effects and current authorization. Let final Verify own the configured suite; preserve required proof/final commands even after an earlier focused pass.
7. **Check the final bytes, then trace every line.** Prefer a focused patch to rewriting an entire file. Preserve its encoding and line endings; on Windows, follow the [file-write check](references/file-writes.md) when generating or replacing text files. In Git projects, run `git diff --check` before recording Build or creating a test-proof receipt, so cleanup does not immediately invalidate that proof. Read the full diff: each change should trace to a criterion, the design, or the impact map. Revert speculative "might help" edits and drive-by cleanups.
8. **Quality pass.** Trace the important value/state from its origin through updates, consumers, and relevant failure paths. For changes to ownership, state, or interfaces, apply the [architecture questions](../../docs/code-quality.md#choose-a-structure-that-protects-the-contract). Check the domain/failure decisions used for this slice: one owner of shared policy, callers that can distinguish rejection from failure, and no hidden partial effect or unsafe retry. Can a maintainer locate the invariant and the boundary for a likely next change? Fix concrete shortfalls inside scope; preserve meaningful adapters and abstractions. File length and caller count are investigation clues, not deletion rules.
9. **Clean up.** Remove debug logs (search for your debug marker), throwaway harnesses, and commented-out code.
10. **Retain learning before final verification.** Append attempted fixes and evidence to `run next`'s selected `ledgerPath` as they happen. Its [Error ledger method](../cyc-error-ledger/SKILL.md) distinguishes shared lookup from run-local recording when documentation is outside scope. Author/update every planned canonical feature/shared record and index before Verify. Use finish’s learning.context input or context prepare --run ID; placeholders and generated History alone cannot satisfy retention. Preserve historical entries, write only available observations and keep future final outcomes in run receipts. Finalize ledger updates too; keep unverified hypotheses and undecided proposals in run-local notes. Follow the [learning lifecycle](../../docs/work-assessments.md#learning-lifecycle-and-final-file-order). Implementation readiness is not user acceptance of a design.

## Done when

- Each slice has the applicable evidence: red then green for changed behavior, green on original and candidate for preserved behavior, or a justified alternative check.
- The full diff was read and each hunk traces to a reason.
- The quality pass found nothing left to fix within scope.
- Focused checks and type check pass on the final file state.
- Anything that could not be done is listed with why.

Build passing does not mean the task passed. Hand off to Verify.

## Stop rules

When a failure or interruption prevents progress, read `run recover --run ID` and follow the [recovery guidance](../../docs/onboarding-recovery.md). Explain the observation, preserved work and next action before presenting a raw log. Resume only after a real prerequisite is resolved; keep terminal runs and their budgets intact.

- The approach turns out wrong (the same workaround twice, escape-hatch types): stop and rethink the plan. In fast playbooks that's `run retry --stage scout`; in the detailed chain, [Design](../cyc-design/SKILL.md).
- A consumer the plan missed appears: add it to the plan and handle it. It only needs a retry if it changes the approach ([Impact](../cyc-impact/SKILL.md) in the detailed chain).
- Two fix attempts fail the same way: stop patching. Write down the assumption both attempts share, and check it before a third (see [Challenge](../cyc-challenge/SKILL.md)).

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Guard patch | Adding `if (x == null) return` to silence the symptom | Find why it is null |
| Toast fix | Adding a "Saved!" message when saving is what's broken | Fix the write, then verify reload |
| Instance fix | Fixing one call site of a repeated bad pattern | Search for the pattern and fix or list all of them |
| Drive-by | Renames and reformatting unrelated to the task | Revert; mention it separately |
| Untested refactor | Restructuring with no behavior test in place | Add a characterization test first |

## Handoff

Give [Verify](../cyc-verify/SKILL.md) the changed files, the tests added (with their red and green output), the commands run, and any deviation from the design with its reason. A local checkpoint is not permission to commit, merge, or publish.
