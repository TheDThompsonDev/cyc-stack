# Plan

Use for work spanning several components, milestones, or dependencies. Stages: [frame](../../../../methods/cyc-frame/SKILL.md) → [understand](../../../../methods/cyc-understand/SKILL.md) → [impact](../../../../methods/cyc-impact/SKILL.md) → [design](../../../../methods/cyc-design/SKILL.md) → [challenge](../../../../methods/cyc-challenge/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

Investigate current behavior and run impact analysis before selecting the sequence. Identify shared interfaces, stored-data transitions, deployment dependencies, and places where work can proceed independently.

Break the result into reviewable increments, each with an observable outcome, affected areas, prerequisite, verification method, and recovery point. Front-load experiments that could invalidate the design. Separate preparation, implementation, rollout, and external approvals when the project actually requires them. Avoid speculative estimates presented as commitments.

When the user wants the plan carried out in order, save its increments as a [work queue](../../../../docs/work-queue.md): one unit per increment, each with an outcome, a playbook, its acceptance criteria, the paths it may change and the units it depends on. State what is true when a unit is done, not how to build it; earlier units change the code later units meet. `queue create` freezes the units, so settle criteria and paths with the user first.

Planning does not claim the planned checks have run. When a key assumption remains untested, propose the bounded investigation needed before expensive execution. A planning-only request ends with the plan; it does not authorize building, publishing, or merging it.

**Acceptance:** a feasible dependency-aware plan that preserves scope and can be handed to an implementer.
