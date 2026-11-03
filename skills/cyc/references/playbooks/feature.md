# Feature

Use for new or changed behavior. Stages: [scout](../../../../methods/cyc-scout/SKILL.md) → [build](../../../../methods/cyc-build/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

1. **Scout in one pass.** Find the entry point, every reader and writer of the data you'll change, and existing code to reuse. Write a plan of ten lines or fewer naming the data shape, the files, the consumers to keep consistent, and the checks.
2. **Settle the data shape first.** Choose the structure that keeps invalid states out (a state machine, table, or typed model) before writing logic. For high-risk changes, [challenge](../../../../methods/cyc-challenge/SKILL.md) the plan now.
3. **Build in tested slices.** For each slice, write a test of observable behavior, see it fail for the right reason, make it pass, and move on. Use the project's existing helpers and conventions.
4. **Keep consumers consistent.** Update every caller you found. Add consumers you discover late to the plan and the Verify assessment; revisit Scout if they change the approach.
5. **Prove the tests.** `run prove-red --run <ID>`. At least one new test must fail on the run-start code; tests that guard existing behavior may pass there.
6. **Review the diff** against the [senior bar](../../../../docs/principles.md). For user-facing changes, also run the [verify recipe](../../../../methods/cyc-verify/references/recipe.md) in the real app. Then `run finish`.

Follow the [implementation assessment contract](../../../../docs/work-assessments.md): Scout records context freshness, existing-capability choice, and alignment; Verify records semantic review and consumer checks; Deliver records learning and error history. Reuse the generated review artifact through developer review and any authorized PR.

**Acceptance:** the requested behavior, new tests proven to catch the change (at least one fails without it), every configured check passing, and named consumers still correct. Annotating a pre-existing failure never makes a failed command pass.
