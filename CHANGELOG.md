# Changelog

Release notes describe changes to CYC's methods, local tooling and host adapters. A version entry does not establish npm publication or native host qualification.

## Unreleased (after 0.9.1)

- Record context history as one change record per completed run, written by the controller after verification with the check results it observed, under `<context folder>/changes/`. Component docs now hold Covers, Current view and Lessons only; finish writes no History entry or Last-changed line. Change records are kept with the project and are not verified source; any other file in that folder still is.
- Rebuild the index from the docs without per-run cells (`cyc context index`), insert a new doc's row in sorted position and repair an index left with merge conflict markers. Two branches that finish runs in one component now merge their context files cleanly unless they changed the same line.
- Read freshness from change records in `cyc investigate`, queried paths first, and count a committed change record in `cyc context lint`'s Git freshness.
- Add `cyc context history`, `cyc context rollup` (one digest per earlier month) and `cyc context migrate`, which moves the History of earlier-layout docs into change records without inventing an outcome. The earlier layout still parses, lints and finishes.
- `cyc context review --write` now publishes missing change records and never edits a doc. Its `--new` and `--update-run` options and its per-component and unmapped-file diagnostics were removed; current runs enforce owners at finish.
- Raise the packed-archive and installed-engine size budgets from 1 MiB to 1.1 MiB (owner decision, 2026-11-11): the archive had 283 bytes left before this change.
- Fix what an independent review demonstrated in the first candidate: paths with a space or `@` broke the record, a folder named like a record was hidden from verified source, a routine run's record or a roll-up commit could make a doc look revalidated, and migration could drop per-doc history.
- `learning.context` rows accept optional `changed` (one line for the change record) and `lesson` (one dated line in the doc).
- Address the automated review of the change-record pull request: lint compares records with HEAD, so a staged record is not history yet; a record published later binds the files its run selected; migration keeps History that its existing entry lacks; publication requires the delivered source hash; the guide no longer promises a record for runs that planned no context.
- Tests cover a real two-branch Git merge and a real index conflict with local Git. Hosted merge behavior, measured reading savings and native hook activation are not established by them.

## 0.9.1 (2026-11-08)

- Document recovery from a missing npm trusted-publisher connection, the first-publication validation deadline, and the distinction between a successful GitHub release, registry publication and deployment status.
- Preserve exact release-tag/source checks and failed deployment history. Package runtime behavior is unchanged; trusted publishing still requires a successful authorized release trial.

## 0.9.0 (2026-11-08)

- Keep one versioned task context per run. The lead merges worker findings, evidence, conflicts and dispositions into that document and acknowledges its current revision before dependent work.
- Add automatic Codex swarm planning, conservative delegation decisions, parallel read-only workers and lead-reviewed merging. Default concurrency is two; unknown cost estimates favor solo execution. Explicit policies, scope, dependencies and cancellation remain enforced.
- Treat tokens as usage reporting only. Remove token-based admission and interruption, preserve observed/estimated/unknown usage, and safely migrate authentic active legacy context views without changing completed archives.
- Use the Codex app-provided CLI when available, bind worker and phase results to their actual thread/turn, drain cancellation to matching terminal acknowledgment, and refuse stale results or unsafe redispatch. Retain failed attempts and explicit retry history.
- Improve first-task guidance, setup/recovery/completion explanations, context discovery and feature-history retention. Add development cohort and end-to-end delegation fixtures; simplify shipped guides and diagrams within the existing archive-size ceiling.
- Verify live worker dispatch, overlapping execution, cancellation and findings merged into one acknowledged context. The successful live merge required recovery of its final context acknowledgment after a Windows file-lock failure. Automated tests and these live trials do not establish native hook activation, measured savings or effectiveness on unseen tasks.

## 0.8.3 (2026-11-06)

- Use an explicit local archive path in the trusted npm publisher, keeping exact tag/source checks and the Node 24 test gate.
- Include the indexed feature-context and workflow improvements from 0.8.0, portable diagnostic identities from 0.8.1, and explicit TAP fixtures from 0.8.2.
- Refresh indexed release setup guidance and the shared index-owner history after the observed archive-path failure.

## 0.8.2 (2026-11-06)

- Declare TAP in isolated fixtures that assert named Node proof results, including on Node 24. Keep the original assertions, unnamed-output refusal and Node 24 publishing gate. Document the report-format prerequisite; no application behavior is changed by this fixture correction.

## 0.8.1 (2026-11-06)

- Preserve POSIX roots, decoded URLs and real Windows short-path identities when matching Node load diagnostics to their importer. Add actual encoded-path and 8.3-alias journeys that reject missing-export failures mislabeled as behavioral evidence. Remote CI exposed the portability gap after local Windows checks passed; the 0.8.0 tag remains unchanged and was not published to npm.

## 0.8.0 (2026-11-06)

- Retain new and changed feature context in the target project's indexed `docs/context/` folder. Normal completion prepares the current view and chronological history, checks path ownership and index links, and refuses missing, stale or misleading coverage. Keep legacy stored runs compatible.
- Make execution mode and conversation ownership explicit; support authorized standalone work without claiming hook activation. Generate exact run commands, usable review templates and clear artifact errors.
- Resume completion through proof judgments, captured reviews and one canonical scenario record. Separate focused original-code proof from broad candidate checks, and reuse only compatible evidence.
- Add bounded check progress, source-bound incremental review, external browser/accessibility recipes, and demonstration fixtures for protected state transitions and asynchronous actor/resource responses.
- Repair CYC's feature history and mappings, preserve installer feedback and checked package/plugin distribution, and add behavioral and refusal regressions. Local tests and fixtures do not demonstrate improved results on unseen model tasks or live native-host activation.

## 0.7.1 (2026-11-04)

- Show a concise summary, setup notes and next step for interactive `init` and `install` commands instead of listing every managed engine file.
- Preserve complete JSON for piped output, `--json` and `--verbose`; keep previews, customized-file conflicts and errors explicit without reporting planned writes as completed.
- Retain the controller and instruction improvements from 0.7.0. File installation does not establish native host hook activation.

## 0.7.0 (2026-11-04)

- Add trusted whole-record preservation and representative fixture guidance for destructive restoration, including relevant references and access metadata.
- Add opt-in versioned evidence records for original outcomes/clauses, source-linked review capture and receipt-scoped finding dispositions. Preserve unversioned clients and historical evidence limits.
- Retain baseline failure diagnostics with case-specific behavioral, new-interface and setup interpretations; bind both red and green proof receipts through completion.
- Include the checked npm/plugin packaging and installer/documentation cleanup present in this source checkout. Native host activation and effectiveness on unseen tasks remain separate checks.

## Unreleased

- Add a portable root plugin manifest with guided setup, shared checked npm/plugin archive builds and checksums, version/lockfile consistency checks, and first-publication instructions. Keep registry authentication and native hook trust as explicit release prerequisites.

- Rebuild the frontend design method around three gates: a decision sheet (named layout archetype, typeface pair, seven palette values, signature element, rejection condition) before any markup, a rendered signature section scored against a numbered generic-tells list before the page is extended, and a set-divergence table when several sites are requested. Replace the abstract art-direction, technique and craft references with concrete typography, color, layout-archetype and craft-rule references and observed reference standards.
- Organize maintained documentation around installation, workflow, context and validation. Retire dated research reports and benchmark campaigns; retain task-focused development fixtures.
- Prepare npm, agent-guided and native plugin installation routes with public package metadata, release preflight and a manually triggered publishing workflow. Registry publication and native plugin qualification remain pending.
- Share context measurement and discovery link extraction. Count each matching document once, retain per-component catch-up work and preserve chronological history.
- Add `cyc check-reply` for draft length and visual checks, shorter completion corrections and bounded cleanup of old hook bookkeeping.
- Remove the standalone `check-response` script and `npm run check-response`; `cyc check-reply` and `cyc packet` cover its checks, and updating an install removes the unchanged old copy. Drop two unlinked workflow PNGs from the source checkout.
- Add component context review, layout/freshness validation and reading-size inspection. Measurements describe local files, not demonstrated token savings.
- Make Windows timeout-fixture cleanup tolerate delayed release of temporary directories without changing refusal assertions.

## 0.6.0 (2026-10-31)

- Use the MIT license and copy it with the installed engine.
- Tighten delivery-gate failures, command validation, empty-change rejection, source evidence and Windows scope casing.
- Support larger source selections with bounded capture and clearer recovery evidence.
- Reduce repeated controller operations with prepared start/finish inputs, direct draft checks and one final verification path.
- Require a managed run for implementation changes, with an explicit advisory path for work that does not need one.
- Establish original-code test proof and explicit treatment of unrelated existing failures. Preserve changed-test sensitivity and source-bound evidence.
- Keep retry budgets across stages and reject unchanged repeated attempts; preserve diagnostic history.
- Keep installed code compatible with project linting and portable host bootstraps.
- Record engineering review, useful learning and failure history alongside executable checks. Extra review depends on risk.
- Resolve playbook/method links and provide the current callable method path in stage guidance.

## 0.5.1 (2026-09-28)

- Run the background baseline worker outside the project directory to avoid locking it on Windows. Finish writes before reporting completion.

## 0.5.0 (2026-09-28)

- Remove the exact legacy default time limit on update while preserving deliberate limits and active-run configuration.
- Require compact Scout, Verify and Deliver assessments on new implementation runs; keep advisory and legacy contracts explicit.
- Generate one reusable developer review artifact, with source/artifact freshness and recovery history.
- Distinguish explanations supplied from demonstrated human comprehension.
- Retain verified technical knowledge separately from pending proposals; finalize authorized context before verification.

## 0.4.2 (2026-09-26)

- Expose one public `cyc` skill with internal methods. Remove unchanged owned legacy entries while preserving customization conflicts.
- Improve progress explanations and use a managed Claude hook launcher through Bash.
- Prepare release archives/checksums and verify offline installation, preview and diagnostics.

## 0.4.1 (2026-09-26)

- Add a configurable character-limit default while preserving explicit session toggles.
- Document authenticated-checkout installation when private Git fetching fails.

## 0.4.0 (2026-09-26)

- Make diagnostic baselines optional while retaining final verification.
- Add Git-aware source selection, explicit generated-input coverage and source-drift diagnostics.
- Preserve evidence for each acceptance criterion and refuse incomplete verification.
- Improve installed hook portability, version diagnostics, worktree discovery and project-owned presentation/ledger configuration.

## 0.3.0 (2026-09-25)

- Use Scout, Build, Verify and Deliver for the compact implementation flow.
- Bound retries by failures and repeated lack of progress; remove a default wall-clock limit.
- Add conversation-owned runs, run-aware delivery, host detection and project installation.
- Add setup, context and error-history methods; repair frontmatter, Windows command launching and recovery routing.

## 0.2.0

- Introduce the local pilot with methods, playbooks, controller, project installer and response gate.
