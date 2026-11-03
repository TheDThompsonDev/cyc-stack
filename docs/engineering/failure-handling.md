# Failure handling at real boundaries

Read this when an operation can reject input, fail during I/O, partially complete, or be retried. First inspect how callers already distinguish failures. Keep the project's existing result types, exception classes, and logging conventions; introduce a new taxonomy only when callers need a distinction they cannot currently express.

## Decide what a failure means

| Trigger | Decision while building | Question during review |
| --- | --- | --- |
| A catch returns an empty collection, default, or success | Identify which failure is actually allowed to mean that value; propagate or represent the others. | Could a legitimate outage or corrupt record look like valid empty data? |
| Callers must handle expected rejection differently from an outage | Use an established error code/result variant or exception type; preserve unexpected failures and useful cause information. | Does a caller branch on a stable contract, or parse message text and guess? |
| An operation writes state and then performs another effect | Define what committed, what remains pending, and how it can be recovered. | Could a later failure invite the caller to repeat an already completed effect? |
| A caller adds a retry, timeout, or cancellation | Establish retry safety, attempt limits, deadline/cancellation ownership, and what happens to in-flight work. | Is the outcome known to have failed, or only unknown to this caller? |

Keep diagnostic causes available to the appropriate internal boundary without exposing secrets or raw storage/network errors to users. Wrap an error only when adding useful operation context, preserving its cause where supported. Log at the boundary that owns reporting; logging and rethrowing at every layer creates duplicates.

## Bad example failure disguised as empty data

Contract for this example: configuration must be readable JSON containing an object with an `items` array. An empty array is valid; a missing/unreadable file, invalid JSON, or wrong shape is a failure. `readText` is the existing asynchronous storage adapter.

```js
async function loadItems(readText) {
  try {
    return JSON.parse(await readText()).items;
  } catch {
    return [];
  }
}
```

A caller cannot distinguish an empty collection from lost access or corrupt data. The wrong shape can also escape as `undefined`. This can be especially damaging if a later save overwrites existing data with the fallback empty collection.

## Good example classify only the failures you own

```js
async function loadItems(readText) {
  const text = await readText(); // Unexpected I/O failures retain their cause.
  let data;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    return { ok: false, error: { code: 'INVALID_JSON', cause } };
  }
  if (data === null || typeof data !== 'object' ||
      Array.isArray(data) || !Array.isArray(data.items)) {
    return { ok: false, error: { code: 'INVALID_SHAPE' } };
  }
  return { ok: true, value: data.items };
}
```

Here invalid document content is an expected rejection; adapter failures reject the promise and reach the operation's existing reporting boundary. The caller must handle both the explicit rejection and unexpected exceptions. A project that uses typed exceptions for all failures should retain that convention instead of adopting this mixed style. Validate each item too when the actual domain contract requires an item schema; this example checks only the stated envelope.

The `cause` is internal diagnostic data. The outer handler maps stable codes to the existing user-facing error contract and logs appropriate detail without serializing the raw cause to a response.

## Bad example retrying an entire partially completed operation

Contract for this example: `orders.insert` commits an order and allocates a new identifier on every call. Email happens after commit, and callers may retry a rejected request.

```js
async function placeOrder(orders, mailer, input) {
  const order = await orders.insert(input);
  await mailer.sendConfirmation(order);
  return { ok: true, order };
}
```

If email fails, the promise rejects after the order exists. Retrying the whole request can create a second order. A `try/catch` that retries this function repeats the wrong boundary.

## Good example report the committed result and pending effect

```js
async function placeOrder(orders, mailer, input) {
  const order = await orders.insert(input);
  try {
    await mailer.sendConfirmation(order);
    return { ok: true, order, confirmation: 'sent' };
  } catch (cause) {
    return { ok: true, order, confirmation: 'unknown', cause };
  }
}
```

This is appropriate **only** if the product contract accepts order creation without confirmed email delivery. The caller must surface or report the unknown confirmation through an existing operational path; it must not present full completion. `unknown` is intentional: a timeout may occur after an email provider accepted the message. The internal cause is not part of a public response.

This minimal change does not guarantee eventual email delivery or make order creation safe after a lost response. If durable delivery is required, use the project's transactional intent/outbox and delivery worker; if request retry safety is required, enforce the same idempotency key with the order commit and reject incompatible reuse. A stable key alone does not make an operation idempotent. Retries need bounded attempts, appropriate backoff and cancellation/deadline handling, and an explicit owner of exhausted or uncertain work. Do not add this infrastructure to a local operation with no such requirement.

## Legitimate exceptions

- A missing file may mean first-run defaults if that is the documented contract. Handle the adapter's specific not-found condition; permission errors and corrupt files do not automatically mean first run.
- A pure internal function may let programmer errors propagate. Blanket catches and a new error class for every function obscure the original fault.
- Optional telemetry or decoration may fail without failing the main operation. Document the allowed loss and use the established reporting path when needed; a required audit record is not optional telemetry.
- A transaction may roll back all related local writes. External side effects outside that transaction still need an explicit outcome and recovery contract.
- Result variants and typed exceptions are both valid. Match the caller and language, and preserve compatibility instead of forcing one representation across unrelated modules.

## Apply during Build and review

While building, trace the failure from the boundary to its real caller: the stable distinction the caller needs, any mutations already committed, the reporting owner, and whether retry is safe. Make partial or unknown outcomes visible in the existing contract. Do not convert failure to success merely to satisfy a check.

During review, follow at least the consequential rejection or failure path as well as success. Flag swallowed errors, message-text branching, unconditional retries, or misleading completion only with a legitimate trigger and consequence. Check the proposed repair against the exception cases above. Resolve findings through the existing [review guidance](../code-quality.md#review-findings-before-turning-them-into-edits); use the controller's existing recovery rules for workflow failures.
