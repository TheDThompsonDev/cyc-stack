# CYC task fixtures

These small source-only projects exercise concrete engineering behavior. They are not copied into application installations. Keep evaluators and reference answers outside the producing agent's project, and preserve the original fixture for repeatable checks.

| Fixture | Purpose | How to check a candidate |
| --- | --- | --- |
| [Homework](homework/request.md) | Add a completion feature while preserving indirect consumers, storage and old records | `node evals/homework/evaluate.mjs PATH_TO_CANDIDATE` |
| [Report refactor](report-refactor/request.md) | Consolidate repeated preparation while preserving text, CSV, JSON and downstream consumers | `node evals/report-refactor/evaluate.mjs PATH_TO_CANDIDATE` |
| [Scheduler review](scheduler-review/request.md) | Review a supplied change without editing product behavior | `node evals/scheduler-review/evaluate.mjs PATH_TO_CANDIDATE PATH_TO_FINDINGS` |
| Cohort task-board journey (`cohort-journey/`) | Known first/related behavior probes plus an actual-user observation protocol | `node evals/cohort-journey/evaluate.mjs PATH_TO_CANDIDATE first` or `related`; recovery needs separate observations |
| [Fresh-session handoff](live-session-reuse.md) | Check saved knowledge and verification across real chats | Follow the protocol in the linked guide |

Give a producer the task, public criteria and a disposable candidate copy. Evaluate its current output separately. Preserve rejected cases and failed observations. A semantic review must establish structural or explanation quality where executable checks cannot.

These are exposed development fixtures with finite checks. They do not establish browser quality, live host activation, performance gains or production reliability. [Validation boundaries](../docs/validation.md) describe the separate evidence needed for those claims.
