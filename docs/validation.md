# Validation and evidence

CYC combines executable checks with agent judgment. A passing command establishes the behavior it exercised; an assessment records the agent's reasoning. Neither establishes universal reliability or human approval.

## Automated coverage

The source checkout's tests exercise these boundaries:

| Area | What to inspect |
| --- | --- |
| Controller | Stage order, failure budgets, original-code test proof and current-source evidence |
| Recovery | Conflicts, retained backups, interrupted operations and completion refusals |
| Context | Scoped discovery, document validation, reading-size measurements and retained knowledge |
| Installation | Ownership, conflicts, updates, removal and offline archive installation |
| Hook adapters | Event parsing, request/response identity, packet validation and simulated rejection cases |
| Distribution | Package contents, plugin/version consistency and release-context checks |

Run the full suite from the CYC source checkout:

```sh
node --test
npm run check:distribution
```

Tests and development fixtures are excluded from the installed engine. Applications configure and execute their own checks; CYC's development suite is not a substitute for them. See [installation](installation.md) and [project tools](project-tools.md).

## Native host qualification

Confirm that a fresh real host session loads the intended skill and hooks. Inspect the current request's prompt evidence and its post-turn Stop decision. Test a relevant rejection/correction path as well as a valid completion. Do not manufacture callbacks, reuse old tokens or infer activation from files alone.

The current adapters still require qualification for the environments advertised to users, including desktop behavior, host trust, live continuation and marketplace installation. Automated simulated events do not establish those outcomes. [Onboarding and recovery](onboarding-recovery.md) explains the diagnostic states.

The source-only cohort exercise in `evals/cohort-journey/` prepares first/related-task behavior probes and an observation protocol. Its exposed fixtures are known development material; no participant, fresh-chat, recovery, host activation or efficiency result follows from a passing probe. Recruit only with explicit authorization; keep separate evaluator checks outside producer projects and actual unknown measurements null.

## Product and team acceptance

For user interfaces, inspect current rendered desktop and phone views, exercise the primary action and relevant failure states, and check keyboard use and applicable access requirements. Build success alone cannot establish visual quality. Missing browser evidence remains unverified.

For context reuse, let a fresh chat or teammate extend a completed task using the repository's saved knowledge. Observe retrieval, freshness checks and the resulting decision, then verify the changed behavior. The [context guide](context.md) explains this boundary.

Record commands, observations, source revision and remaining gaps with the task. Self-review is traceable agent judgment; a second AI review is not human acceptance. Current checks do not establish speed, token savings, broad enterprise readiness or comprehension.
