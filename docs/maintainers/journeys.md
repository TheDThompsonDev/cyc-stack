# CYC user journeys and verification

This source-only guide connects CYC's implementation checks to outcomes a developer can observe. Follow a recorded current version in an isolated project, preserve failed attempts and keep the evidence for each claim separate. A listed test or historical receipt does not establish current live behavior.

| Journey | Observable outcome | Existing checks and procedure | Evidence still needed |
| --- | --- | --- | --- |
| Install safely | Existing project instructions and unrelated hooks survive installation; a conflicting managed-file update is refused | `test/install.test.mjs`, `test/package-install.test.mjs`; [installation](../installation.md) | Current installation result, preservation comparison, rejected conflict and exact installed version |
| Confirm host activation | The actual host issues prompt context and accepts a valid completion; an invalid delivery triggers a real correction | `test/host-activation.test.mjs`, `test/response-gate.test.mjs`; [setup diagnostics](../onboarding-recovery.md) | Request-bound prompt and post-turn Stop observations in each qualified host; discovery and simulated callbacks alone are insufficient |
| Complete and recover | A bounded task completes with current checks; interruption or pause preserves work and budgets, and recovery cannot reuse stale evidence | `test/finish.test.mjs`, `test/recovery.test.mjs`, `test/runtime-adversarial.test.mjs`; [runtime](../runtime.md) | Actual owned run, preserved files, interruption/pause boundary, recovery decisions and current completion evidence; controller pause is distinct from host turn interruption |
| Continue in a fresh chat | A different chat discovers and revalidates retained project knowledge, applies the relevant rule and verifies the related change | [fresh-session protocol](../../evals/live-session-reuse.md), `evals/cohort-journey/evaluate.mjs`; [project context](../context.md) | Distinct host IDs without resume/fork/history injection, actual record discovery/read, supported revalidation, resulting decision and fresh behavioral checks |

## Use the existing checks

Discover relevant project recipes through `cyc investigate` and `cyc recipe list`. Inspect prerequisites, effects and expected outcomes before execution. Required configured verification remains separate; a supplementary recipe cannot complete a controller run or turn an old result into current proof. See [project tools](../project-tools.md).

Keep a small task-specific record of the journey, source/engine identity, commands and observed outcomes. Link the original evidence instead of copying a success label into several independent records. If a check passes while the intended outcome fails, preserve both observations and investigate the assertion or path being exercised.

## Repair an observed failure

Observation → reproduce the cause → repair the responsible boundary → repeat the affected journey

Investigate discovery when a relevant record is missed, revalidation when an outdated claim is accepted, and behavioral coverage when an affected consumer breaks. These are starting points, not diagnoses. Use the smallest justified interface change, regression, helper or instruction; retain rationale that the executable check cannot express. A minor wording correction does not require new infrastructure.

## Interpret pilot results

An isolated development fixture can show behavior and host observations for that case. It cannot establish unseen-task effectiveness, human understanding, reliability across hosts or measured efficiency. Invocation-only hook trust in vetted automation does not qualify the interactive trust experience. Keep missing observations unverified and failed criteria failed; do not weaken a journey to obtain a success label.

The [live-session protocol](../../evals/live-session-reuse.md) owns the experiment procedure. The [November 14 pilot](../../evals/results/2026-11-14-journey-pilot.md) records actual CLI observations, an ownership repair and remaining limits; it is historical evidence for that case. The [validation guide](../validation.md) defines evidence limits. The journey index adds no controller stage or additional mandatory report format.
