# Checking selected context evidence

Use the bundled Node helper when a component record needs repeatable file-byte checks, particularly for uncommitted work. Existing records without manifests keep their Git/diff freshness procedure. This is optional evidence support, not a new controller gate.

Pass the absolute project and the helper in the loaded Context method:

```text
node <context-method>/scripts/evidence.mjs capture --project <project-root> --file src/component.mjs --file config/registry.json
```

Capture prints JSON with `schemaVersion: 1` and a `files` object mapping literal project-relative paths to SHA-256 hashes. Save that output with the normal file tool as, for example, `docs/context/component.evidence.json`, and link it from the component record. Capture writes nothing. Finalize supporting files before capturing; a later change requires new evidence. Never include the manifest in its own file list.

Include critical dependencies that support the claim: a registration file, consumer, schema, or relevant test where applicable. No glob expansion or exhaustive dependency discovery is provided. Capturing the whole repository makes unrelated work invalidate useful context.

```text
node <context-method>/scripts/evidence.mjs check --project <project-root> --manifest docs/context/component.evidence.json
```

| Exit | Status | Next action |
| --- | --- | --- |
| 0 | `unchanged` | Selected bytes match. Inspect the affected boundary and confirm the claim still applies. |
| 1 | `drift` | A selected file changed or disappeared. Revalidate the affected claim and its consumers. |
| 2 | `invalid` | Repair the manifest/path/permission issue or report unavailable evidence. |

Both modes read only. Paths must be canonical project-relative regular files, using forward slashes. Parent/absolute paths, globs, and symlinks/junctions are rejected rather than followed. Byte comparison detects newline changes as well as behavior edits. It cannot prove semantics, human approval, the truth of a claim, or freshness of unlisted dependencies.

A matching manifest never replaces project checks, grants permission, or makes an old passing result current.
