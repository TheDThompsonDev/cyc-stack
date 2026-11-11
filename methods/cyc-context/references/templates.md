# Context templates

The shapes `context lint` checks and `run finish` produces. Names and events are illustrative.

## docs/context/INDEX.md

```markdown
# Context index

Read this index first, then only the docs whose Covers match the paths you are about to change.

| Component | Covers | Doc |
| --- | --- | --- |
| Context layout | methods/cyc-context/** | [Layout](templates.md) |
```

Links resolve relative to INDEX.md. Component, Covers and Doc are required (Area/Record aliases supported); extra columns and rows that link outside the folder stay as written. `context index --write` rebuilds the component rows.

## docs/context/<component>.md

```markdown
# Homework completion

Covers: src/homework/**, src/storage.ts, jobs.json

## Current view

Completion is a persisted boolean; lists and counts derive from one selector, `selectRemaining()`.
Reminder delivery reads the same records through jobs.json by storage key, not by import.
Old saved records have no `finished` field; `loadAll` defaults it.
Adopted decision (owner, 2026-09-25 review): a boolean, not a status enum.

## Lessons

- 2026-10-02 · run 7f3a9c1e: A second list view needed the remaining count, so it moved into one selector; two filters had drifted once already.
- 2026-09-25 · run 3c9d2e1f: Hiding finished items with CSS only left the count wrong.
```

One statement per line, at most 300 lines. The Current view is authored knowledge: preparation replaces it only with the `currentView` you supply. Name who accepted an adopted decision.

## docs/context/changes/<date>-<run>.md

```markdown
# 2026-10-02 · run 7f3a9c1e-2b4d-4c6e-8f90-1a2b3c4d5e6f · Show remaining homework in the week view

Result: passed · unit passed (exit 0)
Completed: 2026-10-02T15:04:11.000Z
Proof: These new tests fail on the original code: week view count (check unit).
Changed: Count comes from selectRemaining(); the week view reuses it.
Learned: Two filters had drifted once already.

Components:
- docs/context/homework-completion.md: The week view reuses the selector.

Files:
- src/homework/select.ts@sha256:9b1c2d3e4f50
```

The controller writes this when the run completes, with each file's full SHA-256; never write one by hand. A hash identifies the bytes the run verified, not that a claim is correct or approved. `context rollup` joins a month's records into `changes/<YYYY-MM>.md`.
