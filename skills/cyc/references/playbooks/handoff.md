# Prepare a handoff

Use when a result needs to be ready for a reviewer, teammate, or later session. Stages: [understand](../../../../methods/cyc-understand/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

Inspect actual changes and current verification evidence. Reconcile them with the requested scope and impact map. Identify unresolved failures, unverified environments, and decisions the recipient must understand.

Use [Remember](../../../../methods/cyc-remember/SKILL.md) for a durable checkpoint and [Deliver](../../../../methods/cyc-deliver/SKILL.md) for a readable summary. Reuse the implementation run's generated `.cyc/runs/ID/review.md`, refreshing with `run review` when necessary; do not create a competing account. Include artifact locations, validation, known limits, and next actions only when needed. Reuse that final behavior/evidence in a PR description without requiring the conversation history. Prepare the artifact before any required publication approval.

Existing green evidence must be rechecked if the relevant files changed. Publishing, opening a pull request, sending messages, and merging remain separate actions governed by the user's request and host permissions; the playbook does not grant them.

**Acceptance:** a recipient-ready artifact with accurate status. A useful blocked handoff remains incomplete work, clearly labelled.
