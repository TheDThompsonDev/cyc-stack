# Evaluate CYC

Use to determine whether a skill, prompt, or workflow change actually helps. Stages: [frame](../../../../methods/cyc-frame/SKILL.md) → [understand](../../../../methods/cyc-understand/SKILL.md) → [explore](../../../../methods/cyc-explore/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [reflect](../../../../methods/cyc-reflect/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

State the behavior being tested, representative tasks, baseline, candidate, success criteria, and cost measures before examining outcomes. Include negative cases where a plausible answer should fail and cases where extra process would be unnecessary. Prefer representative tasks from the target project and freeze its outcome checks before production. Source-only task fixtures live under `evals/`; they are not included in the runtime distribution. Distinguish proposed evaluations from completed runs.

Separate behavior preservation from task completion. An untouched refactor baseline can pass every behavior check while missing the requested structural change; a review example can reproduce a defect while its explanation misstates the cause. Use semantic inspection for those claims. Controller completion, report length, and test count are observations, not correctness scores. When every condition succeeds, report the tie and seek harder unseen tasks instead of adding points for your preferred workflow's artifacts.

Run comparisons in isolated disposable project copies with equivalent starting artifacts and permissions. Keep expected answers and reserved evaluation data out of the producing agent's context. Separate development feedback from a final reserved assessment; repeatedly revealing held-out failures makes that material development data. Where feasible, have an independent reviewer score anonymized artifacts against the same rubric.

Capture raw outputs, actual check results, attempts, time/cost when available, and intervention needs. Do not silently add paid runs or external side effects beyond the authorized budget. If the candidate games the metric or weakens the task, count that as failure rather than improvement.

**Acceptance:** a reproducible comparison with a defensible conclusion, including a valid inconclusive result. A small sample cannot establish universal improvement.
