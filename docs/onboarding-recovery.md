# Guided onboarding and recovery

Users still enter through `/cyc`. The host assistant uses two supporting CLI views to explain the next action. Both inspect existing records; neither introduces a new playbook, weakens verification, or authorizes publication.

## Onboarding

From the source checkout use `node bin/cyc.mjs`; from an installed project use `node .cyc/engine/bin/cyc.mjs`. All commands accept `--project PATH`.

```text
node .cyc/engine/bin/cyc.mjs onboard
node .cyc/engine/bin/cyc.mjs onboard --verify
node .cyc/engine/bin/cyc.mjs onboard --host codex --session GATE_ID --token CURRENT_INJECTED_TOKEN
```

Plain `onboard` is read-only. It locates CI/project evidence sources and reports installation integrity, configured commands, the last setup-check result, live-host uncertainty, and the first-task step. `nextAction` identifies the first unresolved step. A config-only/plugin project does not need an installation manifest, but its host still needs to supply CYC.

`--verify` explicitly runs the already configured commands, using the controller's command validation and execution. Inspect their purpose and side effects before execution. It stores `.cyc/runtime/onboarding-checks.json`, bound to the configuration and covered-source hashes. Failed commands, source-mutating commands, stale evidence and invalid receipts cannot establish passing setup checks. Command output lives in that receipt; the report stays compact. A setup receipt never replaces task verification and is not an accepted pre-existing-failure baseline.

The host agent reads the discovered files and recommends checks with reasons; filenames alone do not select or authorize commands. Team-owned configuration can be reused. If no meaningful checks exist, disclose that gap and propose one relevant bounded check instead of configuring a no-op.

```text
Installed files → Configured checks → Executed checks → Observed host activation → First bounded task
```

The host step now inspects this session's actual prompt/Stop record. Codex native session identity is detected from its environment; `--host` and `--session` can select an explicit host/native or gate ID. Supply `--token` only from the current request's injected CYC context. No token means current-request activation remains unverified, even if an older accepted turn exists. A manual Cursor-tag packet is not Codex activation.

`ok` and `ready` are false, with CLI exit 1, until installation, configuration, checks and host evidence pass. Missing prompt state is reported as missing; legacy/copied/changed hook or configuration evidence is stale. A matching prompt token yields `pending` until Stop accepts the exact request/response. `canStartTask: true` permits the authorized first task while its completion callback is pending, avoiding a circular wait. Inspect the post-turn state from outside that turn to observe acceptance. Rejected drafts, blocked/not-ready decisions and changed review artifacts cannot establish ready status.

The hook records its implementation/configuration/declaration fingerprint, prompt time, Stop request identity and response hash. These are local editable observations, not a tamper-proof host attestation. Cursor's constant token needs its separate conversation/tag correlation; this checker leaves it unverified. Use the supported host trust UI and a fresh session; do not edit trust records, manually simulate callbacks, or reuse an old token to obtain a passing report. Setup readiness does not establish first-task success or user understanding.

After setup, continue the user's already authorized bounded task through Scout → Build → Verify → Deliver. If no task was requested, recommend one based on the inspected project and let the user choose before making product changes.

## Recovery

```text
node .cyc/engine/bin/cyc.mjs run recover --run RUN_ID
```

The report reads the original goal, criteria, current stage, remaining budgets, current source constraints, last handoff and latest verification receipt. It changes no run state, source, receipt or review document. The existing `review.md` remains the human handoff. Failed verification output also includes recovery guidance, so an exhausted run no longer receives an instruction to blindly run verification again.

| Observation | Next action |
| --- | --- |
| Command failed | Inspect the receipt and reproduce the failure; distinguish a defect from an external prerequisite using evidence |
| Executable unavailable or timed out | Inspect that command and project setup; the process error alone does not diagnose the product |
| Source or configuration drift | Recheck affected evidence; inspect protected/scope changes before advancing |
| Paused | Inspect current edits, then resume the same run when continuing; verification is invalidated |
| Blocked | Resolve the recorded prerequisite first, then resume and reverify |
| Halted, exhausted, stopped, or elapsed time budget | Preserve the work and evidence; explain the needed decision rather than automatically retrying or resetting a budget |
| Recorded completion | Treat it as history; check evidence freshness before relying on it for later work |

The report separates `lastCheck` (historical diagnosis) from `verification` (current executable evidence). Failure handling deliberately clears the latter; reading a receipt does not restore it. A passing current command result still needs the task's criteria, semantic review and controller completion conditions.

The assistant's explanation should connect the actual observation to what remains usable and the next action. For example, only when supported by a recorded command result: “The database executable could not be started. The candidate changes remain in place, but integration verification has not passed. The next step is to check the executable against the project's setup instructions.” Do not invent that diagnosis from a generic exit code.

Recovery preserves files by not modifying them; it is not a backup or rollback mechanism. A prior project command may have side effects. Inspect the current diff and retain unrelated edits. If human assistance is required, prepare the existing review, relevant receipt and smallest missing prerequisite; sending that material requires authorization.

Before delivery, `readiness --session ID` inspects every relevant run for the hook request, including registered worktrees. A completed replacement cannot conceal a stopped original. Where hook state is not mapped (including Cursor tags), `--since ISO_TIMESTAMP` supplies an explicit diagnostic window; use the actual request start and disclose that it is not the hook's decision. Existing mapped hook windows cannot be overridden by this flag. Codex/Claude `packet` preflight checks the actual hook request window automatically; Cursor packet output labels that preflight unverified. None of these commands resumes, stops, supersedes or resets a run.

## Proof conflicts and interrupted ownership

A detected proof-time edit, deletion, path replacement or restoration failure halts the run. `run recover --run ID` returns `proofRecovery`: candidate backup path, conflicts, changed paths and any preservation error. The generated review lists those conflicts. Preserve the current files, candidate copies and saved unexpected bytes; inspect manifest.json, then compare and merge deliberately. Do not blindly restore over the other writer or reuse an earlier passing proof. Current proof/verification are cleared, and the halted run cannot resume or automatically start a new budget.

Controller operations in one folder also use `.cyc/runs/workspace.lock`. When busy, recovery reports the owning operation/PID and defers current-source claims. For a process interrupted during proof, that record contains the candidate backup pointer published before source substitution; the per-run state lock remains too. Confirm the owner actually stopped before any operator cleanup, preserve both locks/evidence, inspect the recorded phase and compare files. Recovery itself changes no state, files, locks or budgets. Do not remove an active lock, infer full restoration from a dead process, or alter state to obtain success.

If state/review publication fails, recovery reports `inspect-operation-commit`. Both locks remain and the owner retains the pre-published candidate backup pointer. State may still contain an earlier passing proof/verification, or state may be saved while the generated review remains old; neither is current evidence while publication is unresolved. Preserve the evidence, inspect whether the operation has stopped, compare/merge deliberately and diagnose storage access before operator cleanup. Do not replay a staged state file or clear locks just to obtain success. If the failure record cannot be written, the earlier owner/backup pointer still supports inspection without claiming the outcome committed.

The lock coordinates controllers; arbitrary editors and standalone recipe commands are not isolated. Boundary checks cannot eliminate every filesystem race or open-handle write. Stronger assurance requires a quiescent separate working folder. A normal passing proof establishes its documented check-level result, not crash recovery for all external systems.

## Unavailable original-source proof

New implementation runs supplement Git with [run-start originals](runtime.md#run-start-originals), including plain/no-commit projects. If a needed capture is missing or changed, proof refuses before swapping source. Restore only retained original bytes that match the recorded initial hash, then rerun proof; never regenerate an original by treating the repaired code as its baseline. Older runs do not acquire a capture flag after editing. Retain their actual limitation and alternative evidence, using a truthful supported exemption only when the task's criteria permit it; otherwise keep the handoff blocked. A completed replacement cannot erase that original result.

## Validation boundary

Automated tests cover read-only inspection, explicit command execution, stale and failing evidence, interrupted runs, unchanged budgets, terminal-state guidance, and installed CLI packaging. They do not establish live activation in any host or improvement in junior developers' comprehension. Those remain real-session evaluation tasks.
