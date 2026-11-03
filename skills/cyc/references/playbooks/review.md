# Review

Use to assess existing work and find what matters. Stages: [scout](../../../../methods/cyc-scout/SKILL.md) → [challenge](../../../../methods/cyc-challenge/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

In the scout pass, read the change and find its consumers and criteria. Challenge it from separate angles (spec, consumers, edges, premise) and try to prove each finding. Verify the findings that can be checked by running something. Do not modify the work under review unless fixing is in scope.

When the change alters a business rule or state transition, use the [domain design examples](../../../../docs/engineering/domain-design.md) to inspect invariant ownership and the affected writers/readers. When it changes rejection, I/O or partial effects, use the [failure handling examples](../../../../docs/engineering/failure-handling.md) to inspect failure identity, committed/unknown outcomes and retry safety. Load only applicable guidance, preserve legitimate exceptions and existing contracts, and support findings with concrete consequences; neither guide requires a new layer or error convention.

**Acceptance:** prioritized findings worth acting on, each with its concrete consequence, evidence and whether it was reproduced, plus what was examined and dismissed. Group related causes without hiding material issues. No findings is a valid result when the evidence supports it.
