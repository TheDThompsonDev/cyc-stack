# Refactor report dispatch

The report generator repeats row preparation in every output-format branch. Refactor it so filtering, ordering, and aggregation have a single shared path, with format-specific rendering dispatched through a collection of handlers. Keep the public exports and both consumers working. Choose your own internal organization; do not add dependencies or new features.

Preserve all existing observable behavior. Supported inputs are arrays of records with string `id` and `label`, safe-integer `amountCents` (including negative and zero), and string `status`; totals remain safe integers. Inputs and options must not be mutated. Options are optional.

- `format` defaults to `text` when absent or null. Valid formats are `text`, `csv`, `json`. Reject other values with `RangeError("Unknown format: VALUE")` before checking enabled formats.
- If `enabledFormats` is provided, the selected format must occur in that array, including when the array is empty. Otherwise throw `RangeError("Disabled format: VALUE")`.
- Exclude status `void` unless `includeVoided` is truthy. Retain amounts greater than or equal to `minimumCents`, defaulting to zero when absent or null. Both filters apply for every format.
- Preserve input order unless `sort` is exactly `label`; then sort ascending by JavaScript string comparison, retaining input order for equal labels.
- Return exactly `{ format, count, totalCents, body }`. Count and total use only retained rows. Text has one `id: label = amountCents` line per row, joined by LF. CSV starts with `id,label,amountCents`, uses CRLF separators and no trailing separator, and quotes cells containing comma, quote, CR or LF with doubled embedded quotes. JSON is compact, with each row projected to `id`, `label`, `amountCents` in that property order.
- Empty bodies are `""` for text, the header alone for CSV, and `"[]"` for JSON.
- `makeSummaryEmail` always chooses text even if config contains a different `format`, preserves enabled-format restrictions, and returns the existing subject and empty-message fallback.
- `makeArchive` chooses `archiveFormat` (default CSV when absent or null), overriding config `format`, and preserves the existing filename, MIME type, content, and total fields for all three formats.

Keep all work within the candidate directory. Run the existing tests and add focused tests if useful. Summarize what changed and what you verified. No required report headings or implementation naming conventions.
