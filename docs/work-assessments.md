# Work assessments and the shared review

New implementation runs keep Scout → Build → Verify → Deliver. Each stage records only the evidence it owns; no additional agent, approval ceremony, or mandatory document inventory is introduced. Routes containing Build require `workContractVersion: 1`. Advisory routes and serialized legacy runs retain their existing handoff contract and are labeled accordingly.

`run next` lists `assessmentRequired` and `reviewPath`. It lists only the fields the agent must judge: when they are left out, the controller records `learning` as none, `errorHistory` as none for a run that is not a bug fix and has no failed attempt, and Scout's `context` as none when the project has no `docs/context/INDEX.md` and no ledger, each with a reason saying it was not given. The agent supplies a small JSON assessment with `run record --assessment FILE` alongside the usual summary/criteria, or as `assessment` in a full handoff packet. Store assessment inputs beneath `.cyc/runs/ID/` so they do not change covered source. The user describes the desired outcome; the agent operates this interface.

## Scout: reuse context and choose the approach

Read the existing feature map or equivalent if one exists, search current implementations, and classify the change as reuse, extend, repair, or create. A context index locates historical reasoning; it need not become a second feature inventory. When no capability map exists, put the small relevant capability description in the existing context index only when useful. Avoid cataloging the entire project.

Read the matched component documents, not only their index. Search shared error history (`projectLedgerPath`) and relevant earlier run-local histories. Check relevant commits and working-tree differences; a commit alone does not establish freshness in a dirty checkout. Treat old entries as leads until confirmed. Explain consequential changes as current behavior → proposed change → reason → decision needed. `clear` means the request already settles the decision; `confirmed` requires actual user confirmation. `needs-input` must block the handoff, not manufacture approval.

```json
{
  "context": {
    "status": "used",
    "sources": ["docs/context/orders.md"],
    "evidence": "Read the orders history and searched the error ledger for pagination failures.",
    "freshness": "Compared the recorded revision and working diff with the current export query; the access constraint still applies."
  },
  "approach": {
    "kind": "extend",
    "evidence": "Existing filtered server query already applies access rules; extend it for export instead of creating a parallel query."
  },
  "alignment": {
    "status": "clear",
    "evidence": "The request explicitly requires all matching rows and existing access restrictions; explained reuse of the server query."
  },
  "consumers": [
    { "id": "export", "description": "Export includes all filtered rows.", "check": "Export fixture spans multiple pages." },
    { "id": "access", "description": "Restricted users cannot export another account's rows.", "check": "Rejected access case." }
  ]
}
```

When no relevant history exists, use `context.status: "none"`, `sources: []`, and evidence explaining the lookup and why there is no matched history to revalidate. Do not fabricate a document. Code read during the lookup may be listed as `context.read`; a `none` assessment that lists files under `sources` keeps its `none` claim and has them recorded as `read`, because they are not history sources. Include at least the directly affected behavior in `consumers`; do not invent downstream consumers. Source paths are canonical, project-relative, use forward slashes, and are fingerprinted by the controller when recorded.

## Build and recovery: preserve failures when they happen

Build still records its summary and changed artifacts. Record each attempted product fix and result immediately in the selected ledger, including failed and abandoned work. Do not wait until delivery to reconstruct history. A controller retry invalidates later assessments along with later handoffs. Record a failed or blocked handoff honestly when an assessment cannot pass; success-only assessment requirements must not prevent reporting a failure.

## Verify: executable evidence plus semantic judgment

Run the applicable real journey/recipe checks, map acceptance criteria and affected consumers to checks, and demonstrate that new regression tests detect the defect. Then review intent, consumers, and project conventions against the actual diff. This is a focused review within Verify; additional reviewers are risk-driven, not mandatory. Identify model review as `self`, `fresh-context` (a subagent given only the diff, criteria, and principles), or `peer`, never as a machine check or human approval.

**Test proof.** New bug-fix, feature and refactor runs require a current `run prove-red` receipt even without a Git commit. Run-start source capture supplements the recorded Git base within source policy and task scope; older runs retain their actual recovery limitations. New or changed tests must fail on the original code (bug fix, feature) or pass there (refactor), while the original control passes its existing checks. Editing a proven test makes the proof stale. A change with no testable behavior records `"testProof": {"status": "exempt", "reason": "..."}` in the Verify assessment; an actual unavailable-proof case must state its limitation and supporting alternative evidence truthfully. The exemption and reason appear in the generated review and never count as a proof receipt. See [run-start originals](runtime.md#run-start-originals).

```json
{
  "semanticReview": {
    "reviewer": "self",
    "intent": "Diff preserves filters and exports all matching rows.",
    "consumers": "Existing paginated dashboard keeps its original behavior; export reuses its access predicate.",
    "conventions": "Existing query and error-handling conventions retained.",
    "findings": [
      { "id": "page-only", "status": "resolved", "evidence": "Removed the UI-page limit; multi-page regression now passes." }
    ]
  },
  "consumerChecks": [
    { "id": "export", "result": "passed", "evidence": "Multi-page export regression passed against this candidate." },
    { "id": "access", "result": "passed", "evidence": "Cross-account export remains rejected in the access test." }
  ]
}
```

Every Scout consumer must appear once; add newly discovered consumers with their own evidence. All listed checks must pass. Findings may be `resolved` or `dismissed` with evidence; an `open` finding prevents a passing Verify handoff. An empty findings array means the reviewer found no issues, not that review was skipped. Passing configured commands never substitutes for this assessment, and the controller cannot determine whether an agent's stated observations are true. Changes after the Verify handoff require returning to Verify, rerunning checks, and reviewing the current files before delivery.

## Learning lifecycle and final file order

1. Keep consequential decisions and provisional findings in run-local notes during work. Append failures to `run next`'s selected `ledgerPath` immediately, even for abandoned tasks. Preserve existing ledger formats. New runs use run-local history when shared documentation is outside permitted writes; retain shared-history lookup through `projectLedgerPath` and disclose pending promotion in `errorHistory.reason`. This does not waive explicit project policy or authorize more scope.
2. Before final verification, finalize authorized durable context/index updates and the ledger. Verified technical findings can be recorded with their observed scope, evidence, supporting dependencies, and limits. A passing test establishes its observed behavior, not human approval of a design. Mark a decision adopted only with actual acceptance evidence; use existing authorization and review rather than adding another approval ceremony.
3. Keep unverified hypotheses and design proposals awaiting acceptance in referenced run-local drafts marked pending acceptance. A component record may contain verified facts while a separate proposal is pending; retain the facts under `learning: recorded` and reference the pending proposal separately in the handoff. If only pending proposals exist, use `learning: pending-acceptance`. Later promotion is a scoped documentation update with fresh review; never silently edit a completed run's verified source.
4. Run final verification on the final project files, record the semantic review and consumer evidence, then record Deliver and complete. Source changes to context docs or the ledger invalidate earlier verification exactly like other source changes. Include intended documentation paths in `--scope`; do not broaden scope after the run has started.

```json
{
  "learning": {
    "status": "pending-acceptance",
    "reason": "The only new learning is a proposed architecture decision awaiting acceptance; the existing verified behavior is unchanged.",
    "artifacts": [".cyc/runs/RUN_ID/learning.md"]
  },
  "errorHistory": {
    "status": "recorded",
    "reason": "Recorded the page-limited attempt, correction, and regression evidence.",
    "artifacts": ["docs/context/error-ledger.md"]
  }
}
```

Replace `RUN_ID` with the actual run ID. Learning status is `recorded`, `pending-acceptance`, or `none`. Error-history status is `recorded` or `none`. Both require a reason. `none` uses an empty artifacts array; do not create filler documentation when there is nothing reusable to record. Other statuses require existing files, automatically fingerprinted and checked again at completion. Pending learning must live inside this run's directory. Recorded error history must include the selected ledger returned by `run next`. Bug-fix runs and runs with recorded failures cannot finish with `errorHistory: none`.

The controller cannot see unreported fix attempts, infer acceptance, or prove that a ledger describes the actual failure. These remain agent responsibilities. The structured record makes the claims inspectable; it does not certify them.

Context file evidence is optional. The Context method's helper compares selected file hashes without changing the run contract. A matching hash is not a semantic verdict or a substitute for final verification; existing Git/diff checks remain usable for records without manifests. Include integration/configuration dependencies that support a claim, then revalidate affected claims when evidence drifts. Ensure shared component records identify evidence that exists only in ignored run directories before claiming another checkout can reproduce it.

## One review artifact, reused throughout delivery

The controller generates `.cyc/runs/ID/review.md` at startup and after recorded changes. It contains the outcome, criteria, approach, context/freshness, changed artifacts, configured results, semantic review, consumer evidence, learning dispositions, failures, and remaining decisions. It is derived from the surviving handoffs and receipts; rewinding removes invalidated assessments from the current review while recovery events remain visible.

Use `cyc run review --run ID` to refresh it after external edits. The document records the source fingerprint and marks stale verification/review instead of presenting it as current. Link this same artifact in developer review and reuse its content for an authorized PR. Keep edits in the underlying handoffs, not the generated Markdown. Run directories may be ignored by Git: publish or copy the review only when authorized, and do not put secrets in it.

The generated document is outside covered source, so generating it does not invalidate verification. Declared context/learning/ledger files retain ordinary artifact hash checks. A generated review cannot serve as its own assessment evidence. This is a review aid, not an approval to commit, publish, or merge.
