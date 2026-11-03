# Architecture and code review decisions

Use this guide when a change affects shared state, an interface or a meaningful failure path. Apply it to the actual diff and callers; it does not add another controller stage. [Engineering principles](principles.md) describe the overall review responsibilities.

## Choose a structure that protects the contract

Begin with one legitimate caller: what can it supply, what does it expect and which result must remain consistent? Trace the authoritative state, the operation that changes it, stored representations and downstream readers. Include configuration or registered callbacks when they connect behavior outside direct imports.

| Question | Evidence to examine |
| --- | --- |
| Where is a shared rule enforced? | The actual writers and the paths that can bypass or repeat the rule |
| Can callers observe inconsistent state? | The transition, related updates, old records and a relevant interruption or retry |
| What decision belongs behind this interface? | Which details a caller must currently coordinate, and which consumer needs those details |
| What changes together when requirements change? | Repeated policy, synchronized declarations and the callers that depend on them |
| Does an existing component already serve this task? | Its contract, current consumers and the specific missing behavior |

Keep a suitable project pattern. Compare a different design only when uncertainty could materially affect correctness, ownership or maintenance. Explain the trade-off through a concrete operation. A component's size or number of callers is a reason to investigate its responsibility, not sufficient evidence to delete it.

Use the relevant worked guide for the decision:

- [Code standards](engineering/code-standards.md) for comments, types, component structure and error interpretation.
- [Domain design](engineering/domain-design.md) for invariants, transitions and several readers or writers.
- [Failure handling](engineering/failure-handling.md) for rejection, partial effects and retry behavior.

For a small local change, state the fitting existing pattern and the check that protects it. Do not create an abstraction or comparison exercise solely to fill an assessment.

## Review findings before turning them into edits

A useful finding identifies the location, legitimate trigger or plausible maintenance change, consequence and supporting evidence. Reproduce a suspected runtime failure when practical. For a structural concern, show the repeated policy or caller coordination that makes the next change difficult. Label an untested hypothesis.

Choose a disposition based on that evidence:

| Disposition | What must be recorded |
| --- | --- |
| Repair within scope | The observed defect, correction and check of the affected behavior |
| Investigate before accepting | The unresolved consequential question and the evidence needed to settle it |
| Keep outside this change | Why the improvement is useful but unnecessary for the current task |
| Dismiss | The caller or contract evidence showing that the concern does not apply |

Review the repair itself. Confirm that consumers still satisfy their contracts and that an error or compatibility path was not removed merely to simplify the diff. Keep required unresolved findings open. A successful review may find no actionable issue; a passing test suite does not establish every architectural judgment.

In a managed implementation run, record this reasoning in the Verify assessment alongside each named consumer's executed checks. Distinguish self-review, another agent's review and human acceptance. If a repair changes covered source, refresh the affected verification before completion.
