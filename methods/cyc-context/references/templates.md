# Context doc templates

These are the shapes context lint checks and active-run context prepare/finish produces. Plan canonical paths before scope freezes; historical catch-up with context review --write requires --update-run ID. Names and events below are illustrative; substitute observed findings, actual checks and acceptance evidence.

## docs/context/INDEX.md

```markdown
# Context index

Read this index first, then only the docs whose Covers match the paths you are about to change, and the error ledger for that area.

| Component | Covers | Doc | Last AI change | Lessons | Reason to read |
| --- | --- | --- | --- | --- | --- |
| Context layout | methods/cyc-context/** | [Layout](templates.md) | none recorded | none | Layout illustration |
```

Links resolve relative to INDEX.md. Component/Covers/Doc/Last AI change/Lessons are required (Area/Record aliases supported); extra columns survive refresh. Focused canonical rows own feature retention; outside-directory references are useful matched context, never substitute feature records.

## docs/context/<component>.md

```markdown
# Homework completion

Covers: src/homework/**, src/storage.ts, jobs.json

Last changed by AI: 2026-10-02 · run 7f3a9c1e-2b4d-4c6e-8f90-1a2b3c4d5e6f · files: src/homework/select.ts, test/homework.test.js

## Current view

Completion is a persisted boolean; lists and counts derive from the same selector, `selectRemaining()`. Reminder delivery reads the same records through jobs.json by storage key, not by import. Old saved records have no `finished` field and `loadAll` defaults it. Adopted decision (owner, 2026-09-25 review): a boolean, not a status enum.

## Lessons

- 2026-10-02 · run 7f3a9c1e: A second list view needed the remaining count, so it moved into one selector; two filters had drifted once already.
- 2026-09-25 · run 3c9d2e1f: Hiding finished items with CSS only left the count wrong (count test failed at step 2).

## History

### 2026-10-02 · run 7f3a9c1e-2b4d-4c6e-8f90-1a2b3c4d5e6f · Show remaining homework in the week view
**Changed:** Count comes from selectRemaining(); the week view reuses it.
**Learned:** A second list view needed the remaining count, so it moved into one selector; two filters had drifted once already.
**Decisive check:** These new tests fail on the original code: week view count (check unit). Checks: unit passed (exit 0).
**Files:** src/homework/select.ts@sha256:9b1c2d3e4f50, src/homework/week.tsx@sha256:0a1b2c3d4e5f, test/homework.test.js@sha256:5e6f708192a3

```

Entries are newest first. The `**Files:**` items are `path@sha256:<prefix>` as `--write` records them, or `path@<commit>` when written by hand. The Current view is authored knowledge: preparation preserves it unless you supply learning.context/records with actual currentView text. Update it when an entry changes the rule a reader should follow, and name who accepted an adopted decision. A hash identifies the bytes an entry describes; it does not establish that the claim is correct or that anyone approved it.
