# Refactor

Use to improve structure while preserving behavior. Stages: [scout](../../../../methods/cyc-scout/SKILL.md) → [build](../../../../methods/cyc-build/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

1. **Find the contract.** Identify the boundary whose behavior must not change and every caller of what you'll restructure. If the cleanup reveals a missing feature or a real bug, split it out; this run changes structure only.
2. **Capture behavior first.** Write or find characterization tests at that boundary that would fail if its behavior changed. Type checks and lint do not capture behavior.
3. **Check the capture on the original.** Run the characterization tests before changing production code; they must pass. Keep that observation. The controller's `run prove-red` receipt comes after the refactor, when both code and test changes exist; invoking it with only test changes is refused.
4. **Subtract, then reshape.** Remove dead code and one-caller wrappers first, then move in small steps, rerunning the tests after each. Migrate every caller and delete the old API in the same change.
5. **Keep only improvements.** Revert any step that doesn't make the code easier to read or change.
6. **Prove and review the final candidate.** Check the final diff and file formatting, then run `run prove-red --run <ID>`: refactor tests must pass on the run-start code. Review against the [senior bar](../../../../docs/principles.md), then `run finish`.

**Acceptance:** the same observable behavior, characterization tests proven against the original code, every configured check passing, and callers updated consistently.
