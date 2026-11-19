# CYC journey pilot — November 14, 2026

This source-only report records a local CYC installation, two distinct native CLI chats, a controlled delivery-rejection probe and recovery of an interrupted native run. The pilot found a real ownership defect; the corrected development controller completed that original run. This is one exposed development fixture, not an effectiveness or participant trial.

## What was observed

| Journey | Observed result | Boundary |
| --- | --- | --- |
| Install safely | Four checks passed: preview changed no bytes, existing instructions survived, an unrelated Stop hook survived, and a modified managed file caused refusal without writes | The preserved hook was not invoked as activation proof |
| First task | Open-task filtering completed; six local tests and two external behavior checks passed; the actual prompt and Stop evidence matched the request and final response | One known task-board fixture |
| Fresh related chat | Nine local tests and three external checks passed; a different chat read the index and relevant record and ran investigation with matching current file evidence | No resume/fork, first transcript or expected document path in the follow-up prompt |
| Reject stale delivery | One actual Stop rejection followed a controlled artifact mutation; the refreshed review was accepted after correction | A test-only wrapper forwarded the actual host event unchanged to the unchanged gate |
| Interrupt and recover | The original CLI thread and run completed through the corrected development controller; eight local tests and two external behavior checks passed | Same recorded identity, limits and unrelated-file bytes; invocation-only trust |

Install → observe actual host → preserve/recover work → revalidate in a fresh chat

The external evaluator checked exact-false Open membership, complete stored-record/input preservation and, for the related task, count consistency with the same selector. It ran outside the producing project. Evaluator success alone does not establish host activation or context use; the separate command and hook observations support those limited claims.

## Environment and identities

- Windows; CYC package version 0.9.1; actual Codex CLI 0.167.0-alpha.3.2; account-default model selected through model discovery: gpt-6.1-sol.
- Source baseline: 073243ad1edca70ee90343ab4f49366e0bb032ec, with the recorded dirty documentation bytes. The installed-engine and skill file manifests remain in local baseline/checkpoint evidence; the commit alone does not identify them.
- First chat: 01a1dc07-d517-7490-b9b1-043dc11a05bf, run 77a4b226-ed52-4970-9fb5-312baafd3d20.
- Related chat: 01a1dc0e-809f-7b63-9420-542682c1289b, run f24f04e5-b925-4bdf-8b61-c7d2c913a494.
- Recovery chat: 01a1dc22-7beb-78c3-afd7-50454772448a, original run 498ac563-35b2-429d-bcd9-2aaa176f079a.
- Native CLI launches inspected the generated hooks, enabled hooks and used invocation-only hook trust. This does not qualify interactive trust. Parent conversation IDs were excluded from child launches.

## Failure, repair and verification roles

The interrupted native run stored its gate key as conversationId. After actual PTY Ctrl+C, the same persisted CLI thread could not mutate that accepted run: the mutation guard compared the raw UUID before checking the gate. The record and its limits were preserved.

The source repair canonicalizes a valid native alias to an actually observed caller, preserves exact historical gate-alias compatibility through the current caller's gate, and applies the same owner check during active-run selection. Native environment variables retain their source host. Standalone identity and manual session precedence retain their existing contracts. See [execution ownership](../../docs/context/execution-ownership.md).

An initial independent review demonstrated a cross-host bypass when two hosts shared a raw ID. The corrected candidate refuses that case. The original-code proof records nine named behavioral failures with original-only controls passing; this is not a count of repaired defects. Eighteen focused ownership tests pass on the corrected source, including selection, pause/resume, unchanged refused writes, absent/no-hook/foreign/cross-host callers and canonical-identity controls.

The correct host guard also exposed nine failures in response-hook test fixtures that inherited the live runner's native ID. With unchanged tests and only those IDs cleared in a diagnostic child, all 98 gate tests passed. The fixture now saves, clears and restores ambient caller IDs once per test, including tests that create multiple fixtures. No assertion or production check was weakened. The combined command below passed all 116 cases in the normal parent environment:

```text
node --test --test-reporter=tap test/response-gate.test.mjs test/workflow-ergonomics.test.mjs
```

The first repair run, 7b70042f-344e-49cd-af64-2427ebcf1de9, stopped because its frozen retention plan omitted five indexed shared runtime owners. Its proof and stopped history remain intact. The user separately authorized verification/retention run 71d6a5f8-3678-4e74-adf8-4f62ea5276d0, which plans all eight affected owners. The verify playbook does not support versioned implementation evidence or an enforced reviewPolicy; fresh captured review remains an explicit procedural requirement. No new proof against this follow-up's already-patched baseline is claimed.

That follow-up's first broad verification passed 715 tests with two skips, yet fresh review demonstrated a missed task-context consumer. With both native hosts' states present for the same raw ID, the Codex owner could start/select/pause/resume but task read/acknowledgment/reconciliation rejected it: assertTaskOwner discarded the validated host and used an older Claude-first mapping. The review finding and unchanged refused-state bytes were preserved. An explicit retry within the same run's existing limits retained the earlier result as historical.

Six new production-runtime regression cases exercise start, selection, pause/resume, task read and current-receipt acknowledgment for both hosts and canonical, historical-alias and gate-only identities. Before correction, the three Codex cases failed and the three Claude controls passed. All six pass after assertRunOwner returns its validated execution and assertTaskOwner reuses that native gate; cross-host, absent and no-hook task reads/acknowledgments still reject without state writes. Legacy/non-native task mapping keeps its existing branch. The pre-change/after reproductions and exact test logs are separate evidence from the stopped implementation's nine-failure managed proof. This verify playbook has no managed original-source capture, so these new red/green checks are direct executions against recorded pre-change and corrected source bytes, not a new managed proof receipt.

Configured final source verification is `node --test --test-concurrency=4`. Its measured result and final source bindings belong to this verification run's controller-published [change record](../../docs/context/changes/), not to the earlier 705-pass/two-skip pre-repair baseline. The report is authored before those final checks; a missing completion record must not be read as a pass. Distribution and link/name checks are separate supplementary checks.

The preserved native recovery completed using the development checkout's controller explicitly, with these implementation bytes:

| File | SHA-256 |
| --- | --- |
| scripts/execution.mjs | 0832eed272d6cd2c332db6e62d500d27945541182bd4a63066b1fe4d365932f0 |
| scripts/runtime.mjs | 8357c160a795d148afb7550a9bb7b0428a88cb4ae8176f60050a4e2997fec0c0 |

The installed engine, saved ownership fields and failure limits were not rewritten. This is a development source repair, not a published fixed release. The CLI interruption used PTY Ctrl+C; no App Server terminal acknowledgment is claimed for that control.

The later task-context correction changes the development runtime hash to a8eb2a57f77c577fa8fc35a7e790211a7539967ff1e1f07afa92f3dd69d262f1. It was tested with overlapping simulated host states; the original native recovery used the earlier runtime bytes in the table above and did not exercise that overlap. Do not attribute native qualification of the later correction to that earlier continuation.

## Failed probes and limits retained

The initial rejection prompt asked the agent to violate its delivery instructions. The agent refused, so that attempt does not establish invalid-delivery rejection/continuation. The later stale-artifact probe used a wrapper configured before the task, changed a listed artifact once and forwarded the unmodified actual Stop payload. One rejection and a corrected acceptance were observed. This qualifies that controlled case, not the default installation experience.

App Server attempts showed that hook discovery and hook execution differ. One interrupted API run recovered in standalone mode but lacked native prompt context; stricter attempts refused before native implementation. Even discovery of two hooks did not establish prompt-context delivery in an API model turn. These attempts are excluded from native qualification. No callback, token or native state was manufactured.

After all model turns ended, teardown removed exactly three pilot-specific project-trust stanzas and preserved every other byte of the then-current global configuration. No pre-launch full global snapshot exists, so this proves targeted cleanup, not the absence of all earlier host side effects.

No interactive trust, Claude/Cursor activation, browser quality, held-out task effectiveness, participant understanding, reliability rate or time/token/cost saving is established. No root source commit, publication or global CYC installation was made. Earlier comparison archives and four affected worktrees were preserved outside the repository with authorization; project knowledge records describe CYC's own contracts.

## Retained evidence

Raw prompts, host transcripts, tokens, controller inputs and disposable projects remain local-only under `.cyc/runtime/journey-pilot-2026-11-14/`; they are excluded from distribution. The managed original-code proof remains under the stopped run's `checks/` directory. A teammate may not have these ignored files. These hashes bind the recorded evidence bytes; they neither reproduce the experiment nor independently certify the interpretation.

| Local evidence file | SHA-256 |
| --- | --- |
| installation.checkpoint.json | 8e71eb7e2b987c7ba1cac3d1ab1ec9779de4a578cd186a5bea284318a2713e47 |
| first.checkpoint.json | 1326af074f437dc78c9c111d148c569bbcaaed3627afd95e9eb635a57c0efc54 |
| related.checkpoint.json | 84f0c7762c557471b41207dce30c5d5da168f5b699dd9907d9b2a2f533ddfa59 |
| reuse.checkpoint.json | 1042b977525d9a1d79254616029cf2f18df42fda15c5589b070f80c656272abc |
| freshness.checkpoint.json | 3ac477bb4a7125b8469f3de421b973dc65fed786881e69318931d4c192c70878 |
| cli-recovery.checkpoint.json | 575af695249eec14d93b8c94c53f37ac7976ffc10a129af47a9220580cead256 |
| trust-cleanup.json | 9d864ac24e9ef8b92859a0ad909b00d379876fb25fae751baf41ec22df5adf7a |
| followup-focused.log | 661b0a34d93ae2d877ed43226bb150498310e1be6c7c3d33be11de024e9b884a |
| proof-8d913e64-bd1e-4adf-9fba-2ff8846d0e55.json | c564536a0ed6916b28989467e5101a9ac114f4d8a359f310c76560665bebd622 |
| task-owner-before.json | 7228d80991e7103d53c9205f40203675b077370f41bd5c31b391795f167a44e0 |
| task-owner-after.json | bc97fcdf237b4bbd5b30dcaa9ee81456bd2d24bba6445089d6fe22cb1205d67d |
| task-owner-red.log | 13f20d27d3b1d85b4bc7752f32445c66ea9cc91591b9f84a6b26c807e4a332a5 |
| task-owner-green.log | ce09978b889512609c3cadc9311e9bd484819ba00af588710650cefa8d57a85f |

Repeat using the [journey map](../../docs/maintainers/journeys.md) and [live-session protocol](../live-session-reuse.md), preserving failed observations and recording the current engine, client, model, trust mechanism and actual source bytes.
