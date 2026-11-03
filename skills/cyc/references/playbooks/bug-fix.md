# Bug fix

Use when behavior contradicts what's intended. Stages: [scout](../../../../methods/cyc-scout/SKILL.md) → [build](../../../../methods/cyc-build/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

1. **Check history.** Search the [error ledger](../../../../methods/cyc-error-ledger/SKILL.md) for this symptom; a past entry may name the cause or fixes that already failed.
2. **Reproduce.** Run the failing test, request, or script and capture the actual output. If it won't reproduce quickly, use the [diagnose procedure](../../../../methods/cyc-understand/references/diagnose.md) from [Understand](../../../../methods/cyc-understand/SKILL.md). Don't change code for a bug you haven't reproduced.
3. **Find the cause.** Trace from the symptom to the first place the code does something wrong. Ask whether the triggering state is legitimate; a guard at the symptom is a fix only if it is. Look for the same fault elsewhere.
4. **Write the regression test** from the reproduction, asserting the behavior callers observe. Watch it fail for the reported reason.
5. **Fix the cause** with the smallest change. Record any failed attempt in the ledger as it happens.
6. **Prove the test.** `run prove-red --run <ID>`. It must fail on the run-start code. If it passes there, the test doesn't capture the bug, so strengthen it.
7. **Review the diff** against the [senior bar](../../../../docs/principles.md), then `run finish`. Close the ledger entry with the cause, the fix, and the guard.

**Acceptance:** the original reproduction now passes, the regression test is proven to fail against the unfixed code, every configured check passes, and the ledger entry names the cause, fix, and guard. If reproduction is impossible, say so, and distinguish a plausible mitigation from a verified fix.
