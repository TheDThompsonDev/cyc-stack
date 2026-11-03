# Domain design in everyday changes

Read this when adding or changing a business rule, state transition, or public operation, or when several callers must agree on the same decision. Use the existing project model and conventions. The goal is a rule a maintainer can locate and change coherently; a domain framework, class hierarchy, or new service layer is not required.

## Choose the owner before the shape

Start with one real operation and state its invariant: what must stay true before and after it? Find the authoritative data, every permitted writer, and readers whose behavior depends on that invariant. Choose the smallest existing operation that can own the decision.

| Trigger | Decision while building | Question during review |
| --- | --- | --- |
| Booking, an admin action, and a display repeat an availability condition | Derive the shared decision once; let each caller translate the result for its purpose. | Would adding one legitimate unavailable state require editing several rule implementations? |
| Flags can describe contradictory lifecycle states | Use the project's tagged state, enum, or transition operation; validate external/legacy representations at their boundary. | Can a valid caller create an impossible combination or skip a required transition? |
| Callers perform several internal mutations to complete one operation | Put the invariant-preserving operation at the owner; keep storage and transport adaptation outside its pure decision when practical. | Could a caller stop midway and expose inconsistent state? |
| A handler mixes domain choices with database or network calls | Extract the consequential calculation or decision into a plain function when that makes the rule reusable or inspectable. | Does the extraction own a meaningful decision, or merely forward arguments? |

Distinguish a shared business rule from similar syntax. Two roles may intentionally have different eligibility rules. Name that difference rather than merging their behavior to reduce line count.

## Bad example repeated eligibility policy

Contract for this example: a closed window rejects bookings even with spare capacity; an open full window also rejects them. Input is already validated: `capacity` and `reserved` are nonnegative integers, with `reserved <= capacity`.

```js
function book(window) {
  if (window.closed || window.reserved >= window.capacity) {
    return { ok: false };
  }
  window.reserved += 1;
  return { ok: true };
}

function portalStatus(window) {
  if (window.closed) return 'closed';
  return window.reserved >= window.capacity ? 'full' : 'available';
}
```

The current behavior can be correct. The maintainability problem is concrete: adding a maintenance hold requires updating the booking decision and the display decision together. Moving only the display expression into a helper leaves that coupling intact.

## Good example one decision with distinct consumers

```js
function availability(window) {
  const remaining = window.capacity - window.reserved;
  if (window.closed) return { kind: 'closed', remaining };
  if (remaining === 0) return { kind: 'full', remaining };
  return { kind: 'available', remaining };
}

function book(window) {
  const state = availability(window);
  if (state.kind !== 'available') {
    return { ok: false };
  }
  window.reserved += 1;
  return { ok: true };
}

function portalStatus(window) {
  return availability(window).kind;
}
```

The helper owns closure/capacity precedence; booking owns its mutation; the portal owns presentation. `remaining` is derived from authoritative counts, not a synchronized field to save separately. Both public functions preserve their previous return shapes. Adapt the internal decision to existing callers instead of changing their contract just to introduce a helper.

This example assumes one in-memory writer. It does **not** prevent two processes from booking the same last place. Where concurrent writes are legitimate, enforce the invariant in the existing transaction, conditional update, lock, or other storage consistency mechanism. A pure predicate cannot make a check followed by a write atomic. Do not silently clamp corrupt counts to hide a broken invariant.

For lifecycle data, apply the same ownership reasoning: a single `pending | running | succeeded | failed` state is useful when those states are mutually exclusive. Include the data each state needs and permit transitions through the existing owner. Do not collapse independently meaningful facts, such as `isArchived` and `isPaid`, into one lifecycle merely because both are booleans.

## Legitimate exceptions

- A one-off local rule with one caller can stay inline. A new layer needs a meaningful decision, boundary, or reuse benefit.
- Read models, caches, and remote projections may deliberately duplicate derived state. Preserve their freshness, invalidation, and reconciliation contract; a display projection must not authorize a write using stale data.
- Different consumers may legitimately apply different policies. Reuse the common facts and explicitly name the varying policy; do not force one predicate onto distinct requirements.
- Existing callers or stored records can require compatibility adapters and old representations during migration. Translate at a clear boundary rather than deleting a supported path to obtain a cleaner model.
- A small application may keep policy and orchestration in one file. Separation of responsibilities does not require separation into files or services.

## Apply during Build and review

While building, name the invariant and its owner in the existing plan or explanation, then trace the chosen operation through writers and readers. Inspect both the successful transition and a rejected transition for partial mutation. Keep the project's established types, errors, and return conventions.

During review, locate the rule and a plausible next change. If a finding is about duplicated policy, show the affected callers and coordinated edits it would require; identical syntax or a preference for another pattern is insufficient. If an exception fits, record that reason instead of demanding a redesign. Use the existing [finding dispositions](../code-quality.md#review-findings-before-turning-them-into-edits); this guide adds no assessment fields or approval step.
