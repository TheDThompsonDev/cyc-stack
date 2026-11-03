# CYC impact analysis

Status: implemented as the [cyc-impact skill](../methods/cyc-impact/SKILL.md) and a recorded stage in applicable playbooks. The controller validates stage handoffs; the assistant performs the investigation. No exhaustive automated dependency scanner is provided.

## Purpose and position

Before planning a substantive feature or modification, investigate the files, components, consumers, and subsequent behaviors that the change could affect. Use the actual project as evidence. A small visible request can have effects outside its entry point.

The feature workflow is: understand the request -> map impact -> design -> implement -> verify affected behavior -> deliver. Impact analysis can identify alternative implementations with different consequences; update the map after choosing one. It is available again whenever implementation or verification discovers an unexpected connection.

This is read-only investigation. An affected area is a verification concern, not automatic authorization to modify it. Respect existing task scope and data-access boundaries.

## Investigation

1. Identify the visible entry point and the behavior the user wants. Locate the actual route, component, handler, or equivalent and the existing acceptance criteria.
2. Trace the action forward through state changes, services, API requests, persistence, and any events or background work. Inspect relevant types, schemas, validation, and permissions where present.
3. Trace consumers backward and outward. Find callers of changed interfaces, other uses of shared components or helpers, and readers of any data whose meaning could change. Search beyond imports: configuration, route registration, dynamic lookups, subscriptions, generated clients, and external contracts may connect behavior too.
4. Examine user-visible consequences. Consider counts, sorting, filters, summaries, navigation, notifications, accessibility, responsive behavior, and existing records where relevant. These are prompts to investigate, not assumed features or mandatory categories for every task.
5. Locate existing checks and reproduce important current behavior when possible. Identify which checks cover the proposed change and which gaps require a focused regression check or explicit human review.

Use targeted searches followed by relevant reads. Start narrow and expand along discovered connections. For a genuinely local edit, a short trace and direct check can suffice. A shared interface or stored-data change warrants broader investigation. Do not read every file indiscriminately, infer completeness from a text search, or invent dependencies to fill a checklist.

## Impact map passed to subsequent skills

The parent orchestrator should retain a compact map. For each relevant area, record:

| Field | Meaning |
| --- | --- |
| Area and location | Actual file/symbol, route, data contract, service, or user journey |
| Relationship | What connects this area to the proposed change |
| Evidence | Inspected code reference, search result, runtime observation, or project documentation |
| Certainty | Confirmed connection, plausible connection requiring investigation, or unresolved coverage gap |
| Potential effect | What might change or break; distinguish possibility from observed failure |
| Intended treatment | Change here, preserve and regression-check, or investigate further |
| Verification | Specific behavior to check and the expected result |

Also retain the artifact/revision being investigated, search scope and exclusions, candidate implementation choices, and remaining questions. Distinguish established behavior from assumptions. In a working tree, a revision identifier alone is insufficient if relevant uncommitted files differ; identify the actual inspected state.

The map is ready to inform design when the known path from the user action to its outcome is explained, relevant consumers are identified, and uncertainties that materially affect the design have been investigated or clearly surfaced. A count of files or a generic risk score is not a readiness test.

Unknown external behavior remains unknown until supported by accessible contracts or observations. Report meaningful coverage limits; never promise that every possible dependency was found.

## Handoffs and loop behavior

- Design uses the map to choose an approach and preserve affected contracts. Recheck the map when a design choice changes the impact.
- Implementation works within the accepted scope. Discovering another affected area updates the map and plan; it does not automatically expand the feature.
- Verification checks both the requested feature and the relevant existing behaviors identified by the map. "The button works" is insufficient if the affected count or persistence behavior is broken.
- A failed check routes feedback to the responsible stage. Repair an implementation defect locally; revisit the map or design when the failure exposes an overlooked consumer or faulty assumption.
- Before delivery, reconcile the actual changes with the map. Unexpected changes or stale evidence require focused investigation and rechecking. Report verified outcomes and remaining uncertainty without flooding the user with raw search results.

## Example: marking homework finished

This is illustrative, not a claim about files or features in the CYC repository.

| Potential area | Why investigate it? | Possible check |
| --- | --- | --- |
| Assignment card and button | Where the user performs the action | Mouse and keyboard activation change the intended assignment |
| Shared assignment state | Other views may read the same status | Active and finished lists agree |
| Storage and data model | The status must survive reload | Reload preserves completion; existing records still load |
| Pending count and filters, if present | They may depend on assignment status | Counts and filtered views reflect completion |
| Reminder job, if present | It may still treat the assignment as unfinished | Completed assignments are excluded where the product rules require it |
| Shared button component, if modified | Other screens may use it | Existing button behavior remains intact |

Discover whether these areas exist before including them in a real change. A concise student-facing summary could explain that the change touches the button, saved status, and pending count, while the underlying map retains file-level evidence.

## Evaluation

Test this capability against sample projects containing direct and indirect consumers, a shared component, and a connection established through configuration rather than imports. Include a deliberately missed dependency that causes a regression, and verify that the workflow updates its map and returns to the appropriate stage. Also include a local-only change to check that the analysis stays proportionate.

The source checkout's `evals/homework/` fixture supplies named indirect consumers, persistence, and old-record compatibility. Development fixtures are excluded from the runtime distribution. See [validation](validation.md) for the evidence boundaries. Shared UI components, browser behavior and broader project samples need their own checks. Review missed dependencies, unnecessary scope expansion and regressions caught before delivery.
