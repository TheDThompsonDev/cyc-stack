# Authoritative writer and asynchronous response journeys

Covers: test-support/contract-journeys.mjs, test/quality-journeys.test.mjs, methods/cyc-scout/SKILL.md, methods/cyc-challenge/SKILL.md, methods/cyc-verify/SKILL.md, methods/cyc-verify/references/recipe.md

## Current view

For a new protected consumer, execute the existing authoritative state-changing entrypoint followed by status and the new protected reads/writes in one named decisive journey. Reuse one authoritative resolver or explicitly reconcile conflicting canonical/legacy representations. Preserve original outcome/consumer mappings. Separate cancellation/status checks from chat access is insufficient when their policies can disagree.

The isolated query-aware adapters in test-support/contract-journeys.mjs exercise actual fixture Request/Response entrypoints for cancellation, status, history and send. Cases include an older canonical cancelled RSVP with newer legacy Going, canonical/legacy-only records, ordinary cancellation, eligible, unauthenticated and other-resource controls. A deliberately inconsistent resolver fails the same journey that a coherent one passes. This adapts known audit contracts; it is not execution of a frozen application or an unseen-task effectiveness test.

Asynchronous responses must validate actor, resource and operation context before merging or acknowledging success, including send/write responses while cached identity is unchanged. Mismatch retires stale conversation context and leaves the draft unacknowledged. Prior operations cannot merge into newer contexts. Delayed empty polling must not erase a newly acknowledged send while leaving misleading sent feedback.

Server authorization remains server-owned. An expected-actor/session precondition can reject an actual server write under a changed identity; a client response guard cannot reverse an already completed write. Earlier event-chat documentation about latest-updated membership and broad identity handling was superseded by the audit's cancellation/send findings; those frozen assumptions are not validated guarantees here.

Run node --test test/quality-journeys.test.mjs. Scout consumers, consumerChecks and criterionChecks retain the named journey. Unavailable evidence stays unverified; generic prose, a broad passing count or a model score does not become machine-observed semantic coverage. Local model/receipt evidence may be unavailable to a teammate; these deterministic fixtures do not establish human acceptance, live services or future model behavior.

Scout now explains a relevant project rule, its code revalidation and the decision/check it changes. That communication extends, and does not replace, the authoritative writer/status/protected read/write journey or actor/resource response checks. A known cohort filtering fixture is unrelated to live membership authorization; its successes cannot certify application privacy or unseen model behavior. This shared-owner update is recorded separately from the stopped original adoption scope.

## Lessons

- 2026-11-05 · run ed2b9913: Retained current execution/progress/proof/review boundaries and development-evidence limits in existing component/context docs before final verification.
- 2026-11-05 · run ed2b9913: FLOW-001 retains actual failed assertions, initial review-import/output timing mistakes, package limit repair, native owner/import/cancellation fresh-review findings and Windows case-insensitive redirection setup limit.
- 2026-11-05 · run ed2b9913: Retry: Repair required index-first instruction and replace under-load one-second test assumptions with bounded event-based progress observation; retain all behavioral assertions and failed candidate evidence.
- 2026-11-05 · run ed2b9913: Ledger FLOW-001: corrected in scoped candidate · Completion evidence and diagnostic assumptions
- 2026-11-05 · run a81789bf: Verify an authoritative state transition and its protected consumers together; apply response identity to writes as well as reads.
