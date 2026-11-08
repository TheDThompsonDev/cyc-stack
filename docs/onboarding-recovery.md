# Guided onboarding and recovery

Users enter through /cyc. The agent uses the existing setup, finish and recovery views to explain the confirmed state and one next action. These projections do not authorize publication or change completion decisions.

## Onboarding

Use node bin/cyc.mjs in the source checkout, or node .cyc/engine/bin/cyc.mjs in an installed project. Add --project PATH when needed.

```text
node .cyc/engine/bin/cyc.mjs onboard
node .cyc/engine/bin/cyc.mjs onboard --verify
node .cyc/engine/bin/cyc.mjs onboard --host codex --session GATE_ID --token CURRENT_INJECTED_TOKEN
```

Plain onboard is read-only. It reports installation integrity, configured commands, retained setup checks and current host observations. environment identifies this CLI's Node/OS/architecture, not the host application's version. Config-only/plugin projects need no installation manifest, but host availability still needs confirmation.

The agent reads discovered CI/project files, explains relevant checks and reuses authorized team configuration. Filenames do not authorize commands. Missing meaningful checks remain a gap. After reviewing side effects, --verify runs configured commands and saves .cyc/runtime/onboarding-checks.json, bound to configuration and covered source. Failed, source-mutating, malformed or stale results cannot pass. Setup receipts replace neither task verification nor a measured original baseline.

Installed files → Configured checks → Executed checks → Observed host activation → First bounded task

| guidance.outcome | Meaning and next action |
| --- | --- |
| setup-needed | Address the first unresolved step in nextAction; keep other gaps visible |
| task-can-start | Current prompt observed; continue the authorized task while Stop is pending |
| setup-checked | Setup has matching local checks and host observations; task success still needs verification |

ok/ready remain false (exit 1) until installation, configuration, checks and host evidence pass. canStartTask permits authorized work before its own Stop callback, avoiding a circular wait. With no authorized task, recommend a bounded one and let the user choose before product edits.

For native activation, supply only this request's injected token and actual host/session. Missing prompt state requires inspecting exact hooks and supported host trust controls, then a fresh session/reload. Never repair this by simulating callbacks, editing trust/state, copying old tokens or inventing Cursor tags. Matching prompt evidence stays pending until post-turn Stop accepts the exact request/response and current implementation/configuration/declarations. Rejection needs correction; blocked/not-ready completion, changed artifacts and stale identities cannot establish readiness. Cursor requires its separate conversation/tag correlation and remains unverified by this checker. Local editable traces are observations, not independent certification. See [installation](installation.md#activation-and-diagnosis).

onboard also reports executing-engine identity and an experience view: outcome/preserved behavior before work, consequential rule/decision/check during work, evidence/limits/retained context after work. It certifies neither understanding nor task success. hostVersion remains null unless separately observed; another CLI on PATH is not the running host. responseChoices uses current bound prompt preferences only; missing state remains unverified. Share report fields deliberately, redacting paths/session metadata as needed; never share live tokens or fabricate an activation export.

## Completion guidance

Normal run finish and bounded run wait return additive guidance without replacing existing result/receipt fields:

| outcome | Meaning |
| --- | --- |
| in-progress | Operation active, or one check passed; the workflow is unfinished |
| needs-input | Fill the exact nextAction.inputTemplate for context or proof judgment, then use its run-bound command |
| needs-repair | Inspect the failed step/receipt or delivery-publication error before retrying |
| blocked | Resolve the recorded restriction; preserve work, evidence and budgets |
| complete | Completion recorded; consult the review and delivery evidence for scope and limits |

Silence is not success. A finished worker is distinct from a finished workflow. Recorded completion with failed delivery publication needs repair. Use returned operation handles for progress; locks serve ownership/recovery. See [runtime](runtime.md#execution-capabilities-and-progress).

## Recovery

Run recover --run RUN_ID reads the original goal, criteria, stages, budgets, source constraints, handoff and latest receipt. It changes no source, state, review, receipt or budget. Files remain in place; inspection is not backup/rollback and earlier commands may have side effects.

guidance explains the state. nextAction.command supplies an exact owned resume command only for a resumable paused run, or read-only run next guidance for continuing work. Inspect the diff first. Other recovery actions have no automatic mutation command: resolve blockers before resuming; inspect failed checks and stale reviews; terminal/halted/exhausted/stopped runs cannot resume or reset their budgets. Preserve unrelated edits.

lastCheck is historical diagnosis; verification describes current executable evidence. Reading an old passing receipt cannot restore it. Missing executables and timeouts identify setup observations, not product causes; ordinary failing exits need investigation. Passing commands still require current semantic review and criterion evidence. The existing review.md remains the handoff.

Before delivery use request-scoped [readiness and packet checks](runtime.md#move-through-the-recorded-stages). A completed replacement cannot conceal a stopped original. Diagnostic --since windows use the actual request start and do not override mapped native windows or certify activation.

## Proof conflicts and interrupted ownership

Proof conflicts/restoration failures halt the run and retain proofRecovery backups/manifest and unexpected bytes. Preserve current files, locks and candidate evidence; compare and merge deliberately. A dead process does not establish restoration. Never blindly overwrite files, replay staged state, clear active locks or reset a budget to obtain success.

Busy workspaces defer current-source claims. Failed state/review publication returns inspect-operation-commit: old passing fields/reviews remain untrusted until reconciled. Follow the [shared ownership/recovery contract](runtime.md#shared-working-folder-ownership), including process identity and retained backup pointers. Locks coordinate controllers, not arbitrary editors or external systems; stronger isolation needs a separate quiescent working folder.

## Unavailable original-source proof

[Run-start originals](runtime.md#run-start-originals) support plain/no-commit projects. Missing/changed captures refuse before swapping. Restore only retained bytes matching initial hashes; never relabel repaired code as original. Historical runs retain their limits. Supported exemptions need actual reasons/alternative evidence; unresolved requirements stay blocked.

## Validation boundary

Run node --test for regression coverage; --test-concurrency=2 bounds local scheduling without excluding tests. Simulated hook events test adapters, not live activation. Record actual host/version, prompt and post-turn completion observations separately; missing capabilities stay unverified. See [qualification](validation.md#native-host-qualification). Process checks do not establish product readiness, user comprehension or workflow savings.
