# Changelog

Release notes describe changes to CYC's methods, local tooling and host adapters. A version entry does not establish npm publication or native host qualification.

## Unreleased

- Rebuild the frontend design method around what the site contains and lets a visitor do. A builder now writes an inventory (pages, records, one working journey, what is true now) before any visual decision, chooses a site model from eight measured reference sites by the visitor's job, and starts from a plain system: white or near-black, one type family, one brand color. The earlier color and type pages steered every subject toward a tinted canvas and a serif display pairing, which is the look a model produces unasked; they no longer do.
- Add `scripts/first-screen.mjs` to the frontend method: a probe to evaluate in a rendered page and a judge with a floor taken from first screens measured on 2026-11-21 (12 things to act on at desktop width, 6 on a phone, 3 other pages linked, 3 screens of content). It catches a brochure page. It does not measure taste, and one visit per site is a small sample.
- Rework the frontend design method after a rendered comparison: a barbershop built with it had six working pages and one small photograph, and its owner preferred the one-page site built without it. The method now names two failures, the brochure and the bare page, and has the builder choose a look as five choices made from the subject: canvas, type voice, corners, color source and a signature move. A warm canvas and a serif headline are choices again. A new patterns page groups about seventy observed practices by the decision being made, and no file in the method names a studied site.
- The frontend method chooses the opening by the evidence the visitor needs: a scene, comparable items, a worked example or the working records. A full-width photograph with the task on it, and real items directly below, is the opening when the scene helps someone choose; its owner preferred it on a car-dealership comparison. The visual-material page says what makes that photograph strike, and an opening that hides the material a visitor needs is a new bare-page tell.
- `scripts/first-screen.mjs` now also fails a desktop first screen with fewer than four pictures and none covering a quarter of it. Every studied site cleared that on two visits; the barbershop above did not. Results saved earlier still judge. The floor does not measure taste.
- `scripts/first-screen.mjs` now counts access over the whole page and fails a page for it, by WCAG 2.2 AA: no page language or title, an image with no alt attribute, a field with no label, a link or button with no name, a tap target under 24 px with another within reach, a control that looks the same focused and unfocused, or text below contrast on a solid background. It names the elements. Text on a picture, pictures with an empty alt and buttons under 44 px are reported without a verdict. `--access` prints those lines alone for pages other than the home page. The method now asks for alt text that says what the picture shows. Clearing these counts is not an audit: tab order, announcements, reduced motion and text on photographs stay manual. Results saved earlier still judge.
- The frontend judge measures text on photographs. The builder takes two full-page screenshots per width, one after `--mark-text` paints every letter magenta and one after `--hide-text` hides them; the judge finds the letters from the difference and fails text whose colour falls below 4.5:1, or 3:1 when large, behind more than a tenth of its letters, naming the element. Scrims, panels and shadows behind the letters count. The 90 percent rule is the method's own; WCAG gives no method for photographs. Text the screenshots do not show, or where the page changed between them, is reported without a verdict. The probe also reads SVG text by its fill, converts oklch() and other colour formats, and skips text covered by something drawn over it.
- The frontend method names the look a builder reaches for without it and moves sites off it. Built from one-line briefs without the method, three of three sites set the page on cream and two set the headline in Fraunces, while builders guessed their default was a dark page with gold; a card shop built with the method chose ivory and a serif itself. Step 3 now states that measured default and rules out a warm tint under a serif headline unless a brand sets both; either alone is still a choice. The probe records what surface holds the page's text and the headline's typeface, and the judge fails the pair as tell 40. `--brand` turns it into a note for an existing identity. Serifs are recognized by name and generic family, so an aliased or unlisted face can be missed.
- Add a field guide to the frontend method: the 278 practices recorded in eight site studies, one chapter per study, which Step 2 has the builder open by the visitor's decision. Its entries are rewritten so each observation shows the practice in its title: 183 had kept only the study bullet's first sentence, often the setup, so "Give search its own row on a phone" described the desktop. The guide now opens with seventeen practices recorded on three or more of the eight sites, each with its count and chapters. The rewrite is byte-neutral: bold inside observations and three bullets the counted list replaces were removed and long entries tightened. Limits: counts report these studies only, and no site has been built from the rewritten guide.
- Raise the packed-archive and installed-engine size budgets from 1.2 MiB to 1.3 MiB (owner decision, 2026-11-21): the frontend method's access checks left the archive 11,173 bytes over.
- Add a work queue: `cyc queue create`, `status`, `next` and `decide` order a plan's units, each an ordinary run bound through the `queue` field of its start file. The controller refuses a unit out of order, with changed criteria or playbook, or with paths outside the unit's; one unit runs at a time. Status is read from the runs and never stored. A run that is blocked, or ended halted, exhausted or stopped, halts the line until it is resumed or a retry, skip or cancel is recorded with a reason.
- `queue next` returns a start file, the change records of the units it depends on, and the files changed since the last unit completed. Queue files live in `.cyc/queues`, which ignores itself in Git and is not project source. The queue does not start runs; unattended running, parallel units and shipping are not part of it.
- Add a queue board and a review seat: `cyc queue post`, `board` and `wait` carry questions, findings and answers between the agents on a queue and the person; a bound run cannot complete while the board holds it (`run finish` returns `needs-answer`); `queue next --seat review` lets a second conversation review a unit, and `run review-record --from-board` records the receipt.
- After two live trials of the queue: a question closed with an assumption still takes one later answer from whoever it was for or from the person; every queue command accepts `--session`; the no-open-queue error names the queue that finished last; what holds a unit shows the message that clears it; and a behavioral proof case with no boundary is refused with what a boundary is.
- Raise the packed-archive and installed-engine size budgets from 1.1 MiB to 1.2 MiB (owner decision, 2026-11-20): the work queue and its board left 373 bytes.
- Add the hub: `cyc hub` serves a read-only page on this machine where a person watches a queue being worked: the line and each unit's state, every board message as it is posted, what waits on them, and what the runs did. It writes nothing and makes no request to any other machine.
- A focused proof command that names only test files the change adds now reaches a red proof. Its control finds no file on the run-start code; when that control prints no test results and every failing test is in a test file the change added, its exit is read as nothing to run instead of an earlier failure. A mistyped or never-created file, output without test names, or a deleted or moved test file still ends inconclusive.

## 0.10.0 (2026-11-20)

- Start a redesign with `/cyc Make my homepage look better.` CYC compares layouts using the project's content, chooses typography and imagery, and reviews the full page on desktop and phone.
- Check keyboard access, readable contrast and narrow-screen reflow before choosing a layout. The frontend method uses WCAG 2.2 AA as its default target and includes a contrast checker that compares the unrounded ratio with each threshold.
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
