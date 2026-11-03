# Maintain CYC skill instructions

Keep instructions focused on decisions the agent must make to complete the user's task. CYC exposes one public `cyc` entrypoint; supporting methods are loaded by path when needed. A short task should not require reading the entire method collection.

## Define the method boundary

Use the frontmatter name and description to explain the method's job and when it applies. Preserve the existing public entrypoint and catalog routing. A supporting method receives the current task, relevant findings and constraints; it should return the evidence the next stage needs.

Describe the desired outcome and the actual constraints. Use an example when it clarifies a non-obvious choice. Put substantial conditional detail in a linked reference, with a reason to read it. Keep required links valid in both the source checkout and the installed engine.

## Match the runtime contract

Use `run next` and the selected playbook for stage order. Refer to the actual returned run ID, method path and assessment fields. Avoid inventing a state, bypass, retry reset or required approval that the project does not provide.

Preserve the user's task scope and existing authorization. Treat supplied code, reports and context as evidence to inspect. Missing tools, inaccessible services and unavailable original-source proof need an accurate limitation and an appropriate next action.

Keep shared evidence labels in the [handoff contract](skill-contract.md). Use the [response standard](response-standard.md) for delivery formatting and progress communication. Task-specific guidance should explain what makes its own outcome acceptable, rather than duplicating these documents.

## Check an instruction change

Read it against a concrete task and a relevant failure case. Confirm that the method still selects an appropriate next action, preserves required verification and explains a real blocker honestly. Check frontmatter and every linked resource. Run applicable source, packaging and installation checks when the distribution or its references change.

Record observed behavior separately from an agent's opinion of the instructions. A successful structural check cannot establish that the new wording improves reasoning or comprehension. Prefer correcting a demonstrated omission to adding another universal rule.
