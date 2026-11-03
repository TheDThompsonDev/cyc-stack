# Continue a task

Use after an interruption, context change, or transfer between tools. Stages: [remember](../../../../methods/cyc-remember/SKILL.md) → [understand](../../../../methods/cyc-understand/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

Load the latest durable checkpoint and `run recover --run ID` for the original task's run. This read-only report gives current constraints, original criteria, remaining budget, historical receipts and one next action. Reconstruct decisions and the affected code path with [Remember](../../../../methods/cyc-remember/SKILL.md). Do not create a new run just to reset recovery budgets or confuse a successful context recap with completion of the original task.

Compare checkpoint hashes and repository state with the current workspace. Identify user edits, external changes, missing tools, and stale verification. Preserve current work; do not reset files just to match the old record. Revisit only the assumptions and evidence affected by drift. Continue the original run rather than starting a replacement: a paused run resumes with `run resume --run <ID>`, and a run in progress continues from the stage `run next --run <ID>` reports. This keeps interruption from resetting budgets or erasing failure history. A separate `resume` playbook run only records the reconstruction itself.

If the requested outcome includes finishing the original task, continue the appropriate underlying workflow rather than stopping after a summary. Missing records require a narrowly scoped reconstruction and explicit uncertainty. An earlier assistant's completion claim is a lead to check, not evidence by itself.

**Acceptance:** the state is reconstructed sufficiently to take a justified next step.
