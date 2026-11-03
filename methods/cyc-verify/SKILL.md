---
name: cyc-verify
description: "Prove the requested change works and nothing it touches broke, using checks you actually ran against the current files. Use before accepting any change, when asked \"does it work?\", after a repair, or when a handoff claims success."
---

# Verify the promised outcome

For a new web interface or visual redesign, score the finished page with the [generic-tells sheet](../cyc-design/frontend-design/references/generic-tells.md#score-sheet) at desktop and phone width, then run the [experience review](../cyc-design/frontend-design/references/experience-review.md) against the decision sheet's rejection condition. A theme description, image presence and no clipping cannot establish design quality. If the criterion admits any default page, restore the original ambition before judging; never weaken it to fit the output. Keep a material visual miss unmet despite passing behavior checks. Inspect the main action and access/recovery states separately. Narrow repairs need only applicable checks.

For user updates, follow the shared [progress standard](../../docs/response-standard.md#progress-updates): explain which behavior the checks establish and what remains unverified, rather than reporting only pass counts. When a check fails, explain what it revealed and how that affects the next decision.

Help the engineer interpret the evidence: connect an important check to the path or consumer it exercises, the defect or rejected case it could detect, and the limit of that conclusion. Explain separately why the implementation fits the intended behavior; semantic review is a judgment, not an executed check. Follow the [engineering understanding standard](../../docs/response-standard.md#engineering-understanding-throughout-the-work).

For implementation, verify the changed behavior with executable checks. For advisory Review or Handoff, verify the claims and cited evidence without manufacturing a code change or failing test. An accurate report of a defect can satisfy a review criterion; it cannot satisfy a criterion that the product works. Follow the [handoff contract](../../docs/skill-contract.md) for evidence labels.

Apply the project's applicable `code-standards.md` and the relevant [code standards](../../docs/engineering/code-standards.md) to the actual diff and callers. Check information-bearing comments, justified assertions/suppressions, failure outcomes and useful structure; preserve legitimate exceptions. Record tool results separately from this semantic judgment. Reading the standards, a comment search or an unchecked checklist does not prove compliance.

## The core loop

0. **Use applicable recipes automatically.** Run `node <cli> recipe list --run <ID>` or `--path <affected paths>`. Read selected expected outcomes, prerequisites/effects and any relevant manual steps in `docs/context/verify-recipe.md`. Execute applicable authorized supplementary checks with `recipe run --recipe <ID>`; explain unavailable prerequisites or scope boundaries. Entries with `configuredCommandIds` are already owned by final configured verification: defer those to step 5 and cite that actual result, avoiding duplicate final execution. Old recipe receipts are diagnostic history. When nothing matches, discover the needed check through [references/recipe.md](references/recipe.md). Retain authorized reusable steps before final verification; document/CLI work does not require a browser recipe.
1. **Build the check matrix first.** One row per acceptance criterion and one row per consumer named in the plan (or the [impact map](../cyc-impact/SKILL.md) in the detailed chain). Each row names the check that would show it *red* if it were broken. A row with no red-capable check is a gap; record it now, not at the end.
2. **Establish the appropriate test proof.** For features and bugs, check that the regression test fails on the original code for the intended reason and passes on the candidate. For refactors, characterization tests must pass on both. In a managed run, `run finish` runs `prove-red` when the proof is missing or outdated; run `run prove-red` yourself for an earlier check, and inspect its receipt. Do not manually revert shared working files. New runs retain permitted originals through Git and/or bounded run-start capture, including plain/no-commit projects; older runs cannot gain a capture after edits. Missing or changed needed originals refuse proof. Use a quiescent working folder: the project operation lock coordinates controllers, while external edits are checked only at boundaries. On a conflict or interruption, use `run recover`, preserve current files/locks and the recorded candidate backup, and compare deliberately; never clear locks, overwrite another writer or reset a halted run to force proof. See [ownership and recovery](../../docs/onboarding-recovery.md#proof-conflicts-and-interrupted-ownership). The aggregate proof establishes that at least one new test detects changed behavior, not that every test does. Existing-behavior guards may stay green. For advisory claims, inspect primary evidence and reproduce findings where feasible; no manufactured red test is required. If proof is unavailable, record the actual limitation and alternative evidence through the supported assessment exemption; never describe it as proven or disguise testable behavior as untestable. See [run-start originals](../../docs/runtime.md#run-start-originals).
3. **Run the journey, not only the unit.** Run the recipe's checks that apply to this change first. For anything the recipe doesn't cover, pick the tightest loop that exercises the real path, in this order of preference:
   1. the project's existing test for that behavior
   2. a new focused test at the boundary the user touches
   3. a script or CLI call with a snapshot or diff of output
   4. an HTTP request (`curl`) against the running app
   5. a headless browser such as Playwright for UI journeys (click, reload, check again)
   6. a human-in-the-loop step, as a last resort, with exact instructions and the expected observation
4. **Hit the edges the change created.** Old saved data, repeat actions (clicking twice), unknown IDs, empty state, and the error path. For a guard, show a rejected case, not only an allowed one.
5. **Run configured checks on the final candidate.** For step-by-step execution use `run verify --run <ID>`; the fast implementation route's `run finish` executes these checks itself. Do not run both on an unchanged candidate merely to duplicate a receipt. Advisory routes without configured checks use clearly labeled inspected evidence. Focused checks give fast feedback; final checks cover the affected behavior.
6. **Fill the matrix with results.** Each row: passed (with the command and what you saw), failed (with output), or unverified (with why, such as no browser access). Model review of code goes in its own labeled row and never turns a row green.
7. **Record semantic review separately.** Trace the important state, shared invariant, consumers and relevant failure paths in the actual diff; identify where a likely next change belongs. Review intent, conventions and the [engineering principles](../../docs/principles.md), using the [finding adjudication guidance](../../docs/code-quality.md#review-findings-before-turning-them-into-edits) for consequential diffs. For changed business rules/transitions, inspect the owner and callers using the [domain examples](../../docs/engineering/domain-design.md); for rejection, I/O or partial effects, inspect failure identity, committed/unknown state and retry safety using the [failure examples](../../docs/engineering/failure-handling.md). Apply their stated contracts and exceptions rather than requiring their exact code shape. Show the legitimate trigger or concrete maintenance consequence before requiring a repair; check whether a proposed simplification removes policy duplication or merely moves it. Resolve or dismiss findings with evidence, and keep unresolved required findings open and blocking. New implementation runs require the [Verify assessment](../../docs/work-assessments.md#verify-executable-evidence-plus-semantic-judgment), with a passing check for every Scout consumer and newly discovered consumer. Label self-review; extra reviewers depend on risk. If final context/ledger edits change source, rerun checks before recording the assessment.

## Done when

Applicable checks have captured evidence, every criterion and affected consumer has a result, and every passing claim cites evidence for the current file state. Changed behavior has the required red/green proof; refactors have preservation evidence; exemptions and advisory observations remain labeled. If a required criterion is failed or unverified, do not record a passing stage: route it using the table below. A review can report defects successfully when its criteria ask for supported findings rather than a working product.

**Suspect the observation before the system.** When a result surprises you, first check that the check itself measures the right thing (right port, right build, right data).

**Pre-existing failures.** Normal runs do not run a baseline before editing. A project may explicitly enable `verification.baseline: true` for diagnostic background measurements; do not wait for them. For bug fixes and features without one, the proof's control run measures every check on the run-start code. An unrelated check that already failed there can be accepted with a reason, in `run finish` (`acceptFailures`) or with `run accept-failure`. It no longer blocks completion while it fails exactly as it did then, and another check passes. "Exactly" means the same exit code, the same output lines apart from timings, and no file you changed named in its output.

For a TAP (`node --test`, `tap`), mocha, or jest suite, "exactly" means all of these, also for output longer than the 32,000 characters kept, provided a test in it already failed at the run start:
- no test fails that did not fail then;
- every old failure has the same error, and its stack does not run through source you changed;
- no new non-test line appears. A failed verification lists `failedAtRunStart`: decide for each check whether it is unrelated (accept it) or caused by your change (fix it). Do not retry unchanged. Name it in the reply as a pre-existing failure. New regressions can hide inside the same command. Any of these still leaves verification unverified, with the cause in `acceptedFailuresThatChanged`:
- a new or lost line;
- a different exit code or a hang;
- truncated output;
- a check that prints nothing. Report a blocked handoff when the failure cannot be repaired within scope. Do not change configuration or drop tests mid-run to obtain success.

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Green-by-reading | "The logic looks correct" with no command run | Run something that could fail |
| Tautological test | The expected value is computed the same way the code computes it | Assert a literal known-good value |
| Hollow test | It would still pass if every imported function returned `undefined` | Assert on real output, not on mocks or fixtures |
| Wrong surface | Checked the API when the user asked about the page | Verify where the user sees the behavior |
| Unit-only for a journey | Component test passes; nobody reloaded the page | Add the journey check from step 3 |
| Retry until green | Rerunning a flaky test until it passes | Diagnose the flake or mark unverified |
| Stale evidence | Result is from before the last edit | Rerun after the final change |

## Routing failures

Read `run recover --run ID` after a verification failure or interruption. Failed receipts remain diagnostic even when current verification has been invalidated. Describe the specific failed behavior, the cause only as far as the evidence supports it, and the next justified action. Executable-not-found and timeout observations do not by themselves diagnose the application. Use the existing review and receipt when teammate help is needed; never automatically message someone or start a new budget after exhaustion. See [recovery guidance](../../docs/onboarding-recovery.md).

In fast playbooks (scout → build → verify → deliver), Frame, Impact, and Design map to Scout. Before an authorized implementation repair, use `run retry --run <ID> --stage build --reason "<finding>"`, record the repaired artifacts, and verify again. Return to Scout when a missed consumer or invalid approach changes the plan. Advisory routes report the finding unless repairs are authorized. Changes after a passing Verify handoff require returning to Verify with fresh checks and semantic review before delivery; implementation repairs return through Build first.

| What you saw | Send it to |
| --- | --- |
| Right design, wrong code | [Build](../cyc-build/SKILL.md) with the failing command |
| A consumer nobody mapped broke | [Impact](../cyc-impact/SKILL.md), then affected work |
| The approach cannot meet a criterion | [Design](../cyc-design/SKILL.md) with the disproved assumption |
| The criterion measures the wrong thing | [Frame](../cyc-frame/SKILL.md), keeping the failed result on record |
| Missing access or service | Blocked, naming the smallest thing the user can provide |

Never edit thresholds, skip tests, or loosen criteria to pass. When a recipe check fails, fix the cause and rerun the whole applicable set: this is the loop, and it runs without the user pointing anything out.

**Retain missing checks without changing the contract.** Save proposed checks in `.cyc/runs/<runId>/proposed-checks.json` when durable recipe edits are outside scope. Never edit `.cyc/config.json` during an active run. Promote authorized proposals in a subsequent scoped change and verify that change; edits after completion are not covered by the completed run's evidence. Do not ask for permission again when the user already authorized that follow-up.

## Example

Homework "mark finished": the matrix has rows for the click, the active list, the remaining count, reload persistence, old saved records without a `finished` field, and double-marking. The new persistence test is first run against the unmodified save code and fails, proving it can catch the bug. After the fix it passes, and a reload check in the browser confirms it. The row for cross-device sync stays out of the matrix because it was never requested.
