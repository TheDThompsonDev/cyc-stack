# Context reuse in CYC orchestration

Covers: methods/cyc-scout/**, methods/cyc-build/**, methods/cyc-verify/**, methods/cyc-deliver/**, methods/cyc-remember/**, skills/cyc/SKILL.md, docs/work-assessments.md

Last changed by AI: 2026-11-01 · run 3e945303-616f-49c4-b06b-6a1a32bad5dd · files: methods/cyc-deliver/SKILL.md, skills/cyc/SKILL.md

## Current view

Successful feature and component work is the project's living knowledge source. Verified technical facts are retained with their evidence and limits; a design choice counts as adopted only with actual acceptance, so retained facts never imply that an agent's decision received human approval. Unsupported hypotheses and undecided proposals stay provisional in run-local notes. The [assessment contract](../work-assessments.md#learning-lifecycle-and-final-file-order) carries this with its existing `learning` statuses; no runtime schema was added for the distinction.

Durable context and ledger edits must precede final verification: the controller's covered-source fingerprint includes ordinary documentation, so a late context edit stales an otherwise passing verification. Context manifests do not change that selection or authorize reusing an old passing receipt. Since 2026-11-01 the Deliver handoff records `contextDocs`, the component docs under `docs/context/` that the change touched, and `cyc context review` proposes the component doc entry from the completed run's record; see [Context docs](context-docs.md).

Scout reuses the matched current context and inspects the change boundary; deeper investigation follows missing consumers or consequential uncertainty. Build uses focused feedback for meaningful slices and leaves configured final verification to Verify. Required proof and final commands stay in place. The shared [decision reference](../code-quality.md) is loaded by Scout and Build for changes to state, ownership or interfaces; Challenge and Verify use its finding adjudication. Caller count, file size and model agreement do not establish a defect. Human review traces the state, invariant and future extension boundary; a filled assessment does not establish comprehension.

The entrypoint loads frontend design guidance for website and page work, carrying rendered desktop/phone review and usable-action checks through verification. Delivery drafts use `cyc check-reply` before sending; a completed `run finish` writes its review packet, while advisory work uses an explicit reviewed packet. These instructions preserve the difference between a current command result, an agent assessment and human acceptance. Historical entries below retain their original paths and hashes; their source manifest is not current evidence for this working tree.

`cyc investigate` selects context and recipes from changed paths, declared scope, or explicitly advisory goal words, checks linked byte manifests without running project recipes, and reads the application's own registry, never CYC's development recipes. `recipe run` records each attempt outside covered source; a changed registry, configuration or covered source prevents a passing receipt, and supplemental recipes never advance a run or replace test proof. See the [project-tools contract](../project-tools.md).

Limits: this record describes implementation mechanics and the owner's stated goal, not human acceptance of every engineering decision, measured token savings, demonstrated speedup, or live-host validation. Standalone recipes are not serialized against controller operations, and external editors remain outside the lock; a quiescent working folder is required when other actors could write.

## Lessons

- 2026-11-01 · run 3e945303: docs/context/context-docs.md records the layout rules, how a run becomes a doc entry, the duplicated matcher and the measurement limits; docs/context-tokens-2026-11-01.md records the observed sizes. Lesson from the blocked run: the configured tests check must allow for the whole suite (the h2h fixture test alone took 356 s after the 0.6.0 fixtures), and a timed-out check cannot be accepted as pre…
- 2026-10-23 · run 1cf807d8: Retained observed literal input/authority behavior, exact-SHA recovery requirement and original limitations; refreshed40 selected dependency hashes after revalidation. No human acceptance/effectiveness claim.
- 2026-10-23 · run 1cf807d8: ERR-002 retains startup red failures and correction; ERR-003 retains actual proof refusal, failing CRLF fixture and exact-byte repair. Initial review/setup harness corrections remain local with raw outputs.
- 2026-10-23 · run 1cf807d8: Ledger ERR-003: resolved · Git normalization cannot reproduce manually held CRLF originals
- 2026-10-23 · run ffd16511: Record byte ownership, durable pointer and publication outcome limits plus revalidated context; retain original failures and distinguish aggregate proof, agent review and native/human/comparison gaps.
- 2026-10-23 · run ffd16511: RESTORE-001 records source loss, overlap, initial correction, OWN-F1, stale-vs-unverified failure and fresh correction evidence; CTX-002 retains original drift and revalidation. Failed setup/handoff and probe harness outputs remain in ignored evidence.
- 2026-10-23 · run ffd16511: Ledger RESTORE-001: Concurrent edit overwritten during test proof

## History

### 2026-11-01 · run 3e945303-616f-49c4-b06b-6a1a32bad5dd · Complete the verification and delivery of the cyc context work (component context docs and their qu…
**Changed:** Verified under the raised limit the cyc context work committed as fbed606 (run 2e23950e built and proved it, then blocked at verify on the 300 s check timeout). cyc context review/lint/measure exist in scripts/context-review.mjs and bin/cyc.mjs: review maps completed runs' changed files to docs/context component docs through the index's Covers and proposes each entry from the run record (Build su…
**Learned:** docs/context/context-docs.md records the layout rules, how a run becomes a doc entry, the duplicated matcher and the measurement limits; docs/context-tokens-2026-11-01.md records the observed sizes. Lesson from the blocked run: the configured tests check must allow for the whole suite (the h2h fixture test alone took 356 s after the 0.6.0 fixtures), and a timed-out check cannot be accepted as pre…
**Decisive check:** No test proof (exempt): The feature and its tests were proven under run 2e23950e (receipt .cyc/runs/2e23950e-d1fb-4e87-a060-d02fb9e24b2d/checks/proof-3b4a10d3-b0f8-4741-8b52-eee74ea134a4.json: test/context-review.test.mjs f… Checks: tests passed (exit 0).
**Files:** methods/cyc-deliver/SKILL.md@sha256:573f5e1995e9, skills/cyc/SKILL.md@sha256:9e81dd0d2ffc

### 2026-10-23 · run 1cf807d8-a42b-48e8-91c1-141126588f1b · Reject unsupported wildcard scope/protection input before controller startup writes, preserve liter…
**Changed:** Reject unsupported wildcard scope/protection/ledger before startup effects and clarify literal scope translation. Preserve legacy authority and legitimate literal names. Exact-SHA CRLF reconstruction repairs observed tracked proof refusal without normalized equivalence. Focused reds/greens, two fresh reviews, actual original proof and exposed forward completion retained; code quality comparison s…
**Learned:** Retained observed literal input/authority behavior, exact-SHA recovery requirement and original limitations; refreshed40 selected dependency hashes after revalidation. No human acceptance/effectiveness claim. ERR-002 retains startup red failures and correction; ERR-003 retains actual proof refusal, failing CRLF fixture and exact-byte repair. Initial review/setup harness corrections remain local with raw outputs. Ledger ERR-003: resolved · Git normalization cannot reproduce manually held CRLF originals
**Decisive check:** With the new tests added, check tests fails on the run-start code, which otherwise passes it, so at least one new test catches this change. Checks: tests passed (exit 0).
**Files:** skills/cyc/SKILL.md@sha256:f63e6aeb1d92

### 2026-10-23 · run ffd16511-35d5-44fa-b217-07fc6433c19d · Prevent detected proof-time source edits from being overwritten, retain recovery evidence and refus…
**Changed:** Preserve detected external proof edits and recoverable candidate backups; coordinate controller operations, retain both locks on failed outcome publication, expose read-only recovery, and revalidate current40-file context. Real original proof passes without exemption; candidate278/278, fresh correction119/119, exact scope12files/205unchanged, clean install685254bytes/99files/19modules. Arbitrary…
**Learned:** Record byte ownership, durable pointer and publication outcome limits plus revalidated context; retain original failures and distinguish aggregate proof, agent review and native/human/comparison gaps. RESTORE-001 records source loss, overlap, initial correction, OWN-F1, stale-vs-unverified failure and fresh correction evidence; CTX-002 retains original drift and revalidation. Failed setup/handoff and probe harness outputs remain in ignored evidence. Ledger RESTORE-001: Concurrent edit overwritten during test proof
**Decisive check:** With the new tests added, check tests fails on the run-start code, which otherwise passes it, so at least one new test catches this change. Checks: tests passed (exit 0).
**Files:** methods/cyc-verify/SKILL.md@sha256:1435cf013c6f
