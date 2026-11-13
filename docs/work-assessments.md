# Work assessments and the shared review

New implementation runs keep Scout → Build → Verify → Deliver. Each stage records only the evidence it owns; no additional agent, approval ceremony, or mandatory document inventory is introduced. Routes containing Build require `workContractVersion: 1`. Advisory routes and serialized legacy runs retain their existing handoff contract and are labeled accordingly.

run next supplies assessmentRequired, finishTemplate and reviewPath. Fill actual judgments in the generated input under .cyc/runs/ID or .cyc/runtime (outside covered source). Implementation runs plan required canonical feature context before Build; learning:none is no longer the default for required retention. Missing Scout history can remain context:none with an honest lookup; that does not waive creating feature knowledge. Error history defaults to none only when no bug-fix/failure requires it. Legacy stored receipts retain their contract.

## Scout: reuse context and choose the approach

Read the target index, matched component records and relevant shared/run-local error history. Revalidate against current code/diff and dependencies; classify reuse, extend, repair or create. Keep consequential decisions explicit: clear follows the request, confirmed needs observed confirmation, needs-input blocks. Before scope freezes, supply contextRetention version 1: disposition required, features [{id,doc,paths}] for each meaningful feature and shared owner. Use focused canonical docs and their index, never engine knowledge or a catch-all row. Inspect inference if omitted. See [Context](../methods/cyc-context/SKILL.md) for scope restrictions and equivalent conventions.

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

**Test proof.** Normal finish runs the frozen proof plan on originals plus changed tests and restores owned candidate bytes. Bug fixes/features require decisive red; refactors require green characterization. Missing originals remain unavailable. A genuinely non-testable change can use testProof:{status:"exempt",reason:"actual limitation and alternative evidence"}; this never becomes a proof receipt. Changed tests invalidate proof. See [originals/ownership](runtime.md#run-start-originals).

Node checks that need named-case evidence should explicitly request --test-reporter=tap. Presentation defaults vary; unsupported output remains diagnostic, not named semantic coverage.

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

Each Scout consumer appears once, plus newly discovered consumers. All required checks must pass; open findings block. Resolved/dismissed findings need evidence. Empty findings means reviewed without issues, not skipped. Commands do not substitute for semantic judgment or prove reported observations. Later covered edits invalidate dependent verification/review.

## Versioned evidence records

Start updated implementation runs with evidenceVersion:1, original requirements text and explicit criteria/clauses. Keep the user's original IDs and material obligations. The controller stores requirements and criteria fingerprints, but cannot judge whether all meaning was captured. Unversioned clients and schema-1 historical runs remain supported with their original limits; missing provenance is never manufactured.

reviewPolicy is self-allowed or fresh-required. The latter needs current source-linked fresh-context coverage of every changed source path. Select the actual available reviewer at start and disclose a fallback; do not invent an identity or approval. A reviewer label without its receipt remains unlinked.

### Capture the candidate before review

Use run review-capture --run ID --file CAPTURE.json with reviewer and optional literal scope. Empty scope means whole source. The result provides recordTemplate with reviewId, identity:null, evidence placeholder and findings. Fill that exact file from actual observations, then use its exact review-record command. Invalid identity/evidence gets a field-specific repair pointer before mutation. Capture before dispatch: attaching current hashes to an older review is invalid.

For bounded follow-up, add contextPaths and meaningful contextEvidence after inspecting dependencies/contracts. Static local imports extend the context, along with package/lock/configuration and bounded toolchain/environment/dependency inputs. Unknown import/impact information falls back to whole-source freshness. Unchanged bounded scopes may survive an unrelated edit; changed, added or deleted scoped files, criteria and relevant contracts invalidate them. followupPath lists changes/contracts/findings. Broader review is required when impact cannot be bounded. Preserve the initial high-risk fresh review and history/focus coverage; composed scopes do not mean one reviewer read every final byte.

Finish imports current recorded receipt IDs/findings when omitted. Explicit receipts/dispositions remain compatible. Open findings block; final dispositions use reviewId plus finding id, so same-named findings from different receipts cannot resolve one another. Missing generic findings are not invented when no record exists. Altered/stale/foreign receipts remain unverified, with hashes retained through completion. All review provenance is agent-reported, not an independence or correctness attestation.

### Record a scenario for every outcome and clause

Versioned finish templates use scenarioEvidence as the canonical observation input; existing criterionChecks/consumerChecks/criterionEvidence forms remain supported. Each row contains id, optional clause, named scenario, configured check ID, receipt:current-verification, result:passed, origin:agent-reported, actual evidence and consumers:[Scout IDs]. Keep exactly one row for each original criterion/material clause. One row may cite several decisive cases. Finish projects exact criterion/consumer views when omitted and binds the canonical record in state.evidence; generated native/standalone delivery includes the same record.

For example: a restore/permissions row names delete-then-undo with imported fields/access metadata, cites its actual adapter observation and maps to the access consumer. A declared protected journey must use its named writer/status/read-write scenario. A missing mapping or unavailable external journey stays unverified; prose and aggregate counts cannot become machine-observed named coverage. The parser retains failing identities and aggregate passing counts, not proof that a named passing assertion ran. Agent observations stay labeled even when a suite passes or retains an accepted unrelated failure.

### Review the meaning of baseline failures

Finish returns noncomplete needs-proof-review when measured failure IDs need judgment: receipt/failure IDs, decisive errors, known/unknown boundaries and the exact continuation input. Fill category/reason and invoke its command; bindings cover run/source/tests/config/proof/input and bound retries. Stale/foreign/placeholder/inadequate judgments cannot complete. Categories are behavioral, new-interface, setup, unclassified. Module-load/setup failures do not prove an existing behavioral defect; an absent interface can honestly establish feature red proof, while bug fixes need a decisive existing behavior. Setup/unclassified alone cannot pass. Unknown boundaries and unselected diagnostics remain visible.

Optional proofCommands freezes focused execution at start; --tests selects swapped files only. Final candidate checks remain broad, and accepting unrelated broad failures requires compatible measured broad originals. Explicit local-deterministic receipt reuse requires matching bounded inputs; unknown/external/freshness checks rerun. See [runtime](runtime.md#recovery-and-budgets). Process completion, fingerprints and model scores do not certify product readiness or hook activation.

## Learning lifecycle and final file order

1. Record failed attempts promptly in the selected ledger, even abandoned work. projectLedgerPath selects lookup; ledgerPath selects recording, with run-local fallback when shared writes are outside scope. Disclose pending shared promotion; do not infer expanded permission.
2. Author each planned feature/shared doc before final verification: capability and boundaries, contracts, choices with reasons, failures, decisive checks and limits. Keep proposals labeled; tests do not establish adoption. The index, ledgers, recipes, handoffs and ignored logs support context but cannot replace it.
3. Supply learning.context [{id,currentView,changed?,lesson?}] in finish, or author docs and use context prepare --run ID. Finish scaffolds missing docs and index rows, binds each authored view to selected source and returns needs-context until valid; a scaffold is not authorship.
4. Verify final files, review the candidate, then complete. A covered context/ledger edit invalidates dependent evidence like code; a packet cannot reverify it. Completion publishes the change record (history, not verified source) with the check outcome. Late needs cannot broaden frozen scope.

Example finish assessment fragment (use actual planned IDs, prose and paths):

```json
{"learning":{"status":"recorded","reason":"Retain the owned order-storage contract and its check limits.","artifacts":["docs/context/orders.md"],"context":[{"id":"orders","currentView":"Actual capability, contracts, decisions, failures, commands and known limits from this implementation."}]},"errorHistory":{"status":"recorded","reason":"Record the observed failed attempt and repair.","artifacts":["docs/context/error-ledger.md"]}}
```

Learning statuses: recorded, pending-acceptance, none; error-history: recorded, none. Both need reasons. Non-none artifacts must exist and are fingerprinted/rechecked. Pending proposals belong under this run and are not a substitute for required feature context; retained facts can coexist with a pending proposal. None uses empty artifacts and is proportional only when no feature retention is required. Explicit documentation restrictions remain pending/incomplete without unauthorized writes. Bug fixes/recorded failures require the selected ledger. Routine dispositions and semantic completeness remain agent judgments, not machine truth.

Current runs enforce doc layout, index mappings and source evidence, with the authored Current view bound to selected source. Validation reads planned docs plus index consistency; explanatory truth and unreported failures still need judgment. Old receipts are not upgraded. Optional byte manifests supplement change records. Summarize local-only receipt conclusions and reproducible commands for source-only readers.

## One review artifact, reused throughout delivery

The generated .cyc/runs/ID/review.md projects surviving handoffs/receipts: criteria, approach, changed source, check results, semantic review, consumers, learning, failures and decisions. Rewind removes invalidated assessments but retains recovery events. run review --run ID refreshes current fingerprints/staleness. Edit underlying handoffs, not this Markdown; a generated view cannot prove itself. Reuse it for review/authorized PRs, disclosing ignored/local-only evidence. Generation outside source does not invalidate checks; covered context/ledger edits still do. No commit/publication authority is implied.
