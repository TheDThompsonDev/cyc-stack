# Code standards that improve the delivered change

Use these standards while implementing or reviewing code. Read the active project's instructions and applicable `code-standards.md`, design system, contribution guide and tool configuration first. Keep its established conventions unless the task calls for changing them. This guide supplies portable engineering criteria; it does not impose EventConvo's labels, colors, form library or React architecture on other projects.

Apply the relevant rules to the changed code and affected behavior. Fix related findings within scope; record unrelated cleanup separately. Do not turn an ordinary feature into a repository-wide standards migration.

## Comments must carry information the code cannot

For each added or modified comment, ask: **what important fact would a maintainer lose if this comment disappeared?** Keep a comment that explains a constraint, rationale, non-obvious invariant, external contract, deliberate trade-off or supported workaround. If it only translates the next statement into English, remove it. If the code's names or structure cause the confusion, improve those first.

| Remove or improve | Keep when accurate and needed |
| --- | --- |
| `// Get the user` above `getUser()` | Why a lookup must use the historical owner rather than the current owner |
| `// Phase 3`, `// New v2 logic`, or a heading for a tiny obvious block | A compatibility constraint and the supported consumer that requires it |
| `// Intentional` inside an otherwise unexplained empty catch | The allowed loss, why the main operation may succeed and where failure is reported or deliberately discarded |
| A commented-out implementation or chat transcript | A concise explanation of a surprising decision, beside the affected code |
| A stale `TODO` or an unbounded promise to revisit | A concrete deferred limitation, tracked where project conventions require, without hiding unfinished acceptance criteria |

For example, `// Sort events` repeats the operation. `// Tie-break by ID so equal timestamps do not reorder across pages.` explains a constraint that a later simplification could violate. Keep the explanation only if the implementation and pagination contract actually support it.

Preserve license notices, required attribution, compiler/tool directives and meaningful public API documentation. Generated files follow their generator's conventions. Do not remove required text or useful explanations merely to achieve a comment count.

Public documentation should explain the caller's contract: valid input, result, meaningful effects, rejection and limitations that cannot be inferred from the signature. Do not require boilerplate documentation for every private function. A useful rationale can also belong in a named test, but a test elsewhere does not make a necessary local explanation redundant.

## Make structure express responsibility

Choose names that reveal the domain, units and intent. Separate facts that can vary independently; derive redundant state where practical. Keep related behavior together and make the owner of an important rule discoverable. Follow the [architecture questions](../code-quality.md#choose-a-structure-that-protects-the-contract) when ownership or boundaries change.

Treat deep nesting, long files, many props and repeated syntax as investigation signals. They do not prove a defect or dictate a repair. Flatten control flow when that clarifies the same outcomes; preserve distinct unauthorized, unavailable, loading and failed states. Extract a function when it names a decision, hides complexity or supports real reuse, not just to move lines out of sight.

For component data flow, first inspect state ownership and composition. Passing a few explicit props can be clearer than introducing shared state. Context or a store is appropriate for a real shared lifetime or access need, not because a prop crossed a third layer. A custom hook can encapsulate access to shared state; two independent local-state hooks do not become shared merely because they have the same name. Group props only when they form a meaningful concept.

Remove unused imports, dead branches, debug residue and abandoned code introduced or made obsolete by the change. Before removing a wrapper or empty element, inspect layout, semantics, measurement, ref and integration use. A container that owns a layout or focus boundary is not useless because it has no text.

## Types must describe facts, not wish them into existence

Derive types from the authoritative schema or existing domain model. Validate external and legacy data at the relevant boundary and preserve the established rejection path. Narrow types through actual checks. A type assertion, non-null assertion or relocation of a cast does not validate data.

For example, replacing three `payload as Profile` assertions with `const profile = payload as Profile` may reduce repetition while preserving the same unsupported assumption. Use the project's existing parser or prove the shape before treating an untrusted payload as a profile. Known trusted framework boundaries and generated adapters can justify a narrow assertion; keep the reason inspectable.

Do not add broad `any`, blanket type ignores, lint disables, optional chaining or fallback defaults just to make a diagnostic disappear. Fix the source of the uncertainty. A justified suppression should cover the smallest useful scope, explain the actual tool limitation and retain any project-required tracking or removal condition. Handle legitimate optional values and compatibility data explicitly; do not replace them with invented values.

## Failure handling must preserve the outcome

A catch is justified by recovery, translation, cleanup or reporting that the caller needs. Remove a catch that only rethrows the same error and owns no other behavior. Preserve meaningful cleanup, rollback, diagnostic context and error causes. Do not remove a useful boundary merely because it eventually rethrows.

An empty catch needs an actual product contract permitting the lost effect; adding a comment cannot create that permission. An optional analytics event may be disposable. A failed save, access check or required audit record is not optional merely because the UI should keep moving. Avoid duplicate reporting at every layer and do not expose secrets or raw internal errors.

Do not turn a failed read into a plausible empty list, claim a successful save before it commits, or retry effects with unknown outcomes. For I/O, partial completion or retries, use [failure handling](failure-handling.md); for shared business rules, use [domain design](domain-design.md). Match the established error representation rather than inventing a taxonomy for every function.

## Project conventions are explicit local choices

Reuse the project's established localization, styling, form, logging, validation and test approaches when they fit. A centralized labels file, a specific form library, token-only colors or solid buttons can be legitimate **project requirements**. They are not universal indicators of quality. Do not introduce these systems or ban an existing library solely because a reference project uses something different.

Use configured import ordering and formatting. Do not manually enforce a second style beside the project's formatter. Preserve established design tokens and reuse fitting input components; make a new reusable component when it owns a useful behavior or serves real consistency, rather than wrapping every one-off element.

Interactive work must expose the relevant loading, empty, validation, failure and success states truthfully. Use semantic controls and accessible names; preserve keyboard behavior, focus, applicable contrast and reflow requirements. Give informative images meaningful alternatives and decorative images empty alternative text. For visual design or a new page, follow the existing [frontend experience review](../../methods/cyc-design/frontend-design/references/experience-review.md).

## Review the actual diff before delivery

Read the complete final diff, including deleted behavior and changed tests. Trace consequential values through input, ownership, changes, output and failure. Ask whether each new helper, comment, dependency and fallback earns its place. Review tests against the requested behavior; do not accept implementation-shaped expectations that merely confirm the chosen code.

Resolve each material finding with a specific repair and recheck, or a concrete reason it is not a defect. Do not manufacture findings or demand a minimum number of deletions. A checklist saying "reviewed" does not establish that the work is good. Identify the location and actual consequence when reporting an issue.

Review should catch both sides of a rule: remove the narration comment but keep the concurrency explanation; reject a silent save failure but allow documented optional telemetry loss; remove a forwarding wrapper but retain an adapter with a real contract. A comment keyword or file-size threshold cannot decide those cases reliably.

## Make standards observable without pretending judgment is automated

Use three complementary layers:

```text
Applicable instructions → working change → executable checks
                                  ↓
                           semantic diff review
                                  ↓
                         repair + fresh evidence
```

| Concern | Suitable enforcement | Remaining judgment |
| --- | --- | --- |
| Formatting, configured import order, unused imports | Existing formatter and linter | Whether a dependency or abstraction is worthwhile |
| Invalid types and prohibited suppressions | Type checking and configured static rules | Whether a cast is justified and the boundary validates the right contract |
| Empty catches and trivial rethrows | Configured lint rules can flag candidates | Whether recovery or tolerated loss is legitimate |
| Redundant comments, fake abstractions, unclear ownership | Review the changed code and its callers | Whether information or responsibility is actually lost |
| Required behavior and failure cases | Observable tests and appropriate integration checks | Whether the checks cover the requested outcome |
| Visual quality and interaction | Rendered-page review plus applicable automated checks | Composition, clarity and completeness of the user's journey |

A host hook can supply the current standards or run configured checks when its supported event fires. That can reduce missed instructions and refuse observed machine-check failures. Loading a file, asking for an acknowledgment or finding a comment phrase does not prove that a model understood or obeyed it. Actual event support, trust, scope, invocation and refusal must be validated in the target host before claiming enforcement.

When adopting the standard in another project, identify the files, real commands and generated-file exclusions it uses. Integrate justified deterministic rules with the existing tooling and CI; do not install a generic bundle or modify host configuration as an incidental cleanup. Choose blocking checks deliberately, run them, and exercise both a legitimate case and a violation that must be refused. Keep baseline failures visible. Hooks and CI should check the same accepted contracts where feasible; a local model-authored review remains separate evidence.

In CYC, read the project's applicable standards during Scout/Build and carry them into Verify's semantic review. Existing configured executable checks and controller evidence retain their current meanings; this document adds no hook, parser, stage or machine-enforced comment-quality check. Record only checks actually run on the final candidate, and disclose material unverified behavior.

## Changes from the supplied older standard

The supplied EventConvo example was inspected as evidence on 2026-11-02. Its specific labels path, design-system file, colors and form stack remain local project choices. The improvements here address these concrete weaknesses:

- **Comment count → information value.** Keep necessary rationale, notices and contracts while removing narration.
- **An annotated empty catch → an allowed failure contract.** A word such as "intentional" cannot justify hiding a failed operation.
- **Fewer assertions → supported types.** Moving an unsafe assertion does not make external data safe.
- **Depth/prop thresholds → visible responsibility.** Preserve distinct outcomes and avoid unnecessary shared state.
- **Universal frontend prescriptions → explicit project bindings.** Reuse local conventions without copying another product's stack or visual identity.
- **A forced read → checks plus accountable review.** Machine results and agent judgment are separate; neither guarantees defect-free output.
