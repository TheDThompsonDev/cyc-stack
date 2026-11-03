# Context doc templates

These are the shapes `cyc context lint` checks and `cyc context review --write` produces. Names and events below are illustrative; substitute observed findings, actual checks and acceptance evidence.

## docs/context/INDEX.md

```markdown
# Context index

Read this index first, then only the docs whose Covers match the paths you are about to change, and the error ledger for that area.

| Component | Covers | Doc | Last AI change | Lessons | Reason to read |
| --- | --- | --- | --- | --- | --- |
| Context evidence helper | methods/cyc-context/scripts/**, methods/cyc-context/references/evidence.md | [Evidence helper](evidence.md) | 2026-10-02 · run 7f3a9c1e · Capture selected bytes | 3 · latest: Capturing the whole repository invalidates useful context | Byte evidence for selected claims |
| Context doc layout | methods/cyc-context/** | [Templates](templates.md) | none recorded | none | The fixed layout and its rules |
| Error ledger | all | [Ledger format](../../cyc-error-ledger/references/entry-format.md) | reference row | reference row | Past errors, causes, and fixes tried |
```

Links are relative to `INDEX.md`; in a project index the Doc cell is the doc's file name, `homework.md`, in a Markdown link. `Component`, `Covers`, `Doc`, `Last AI change` and `Lessons` are required (`Area` and `Record` are accepted aliases); other columns are kept as written. `--write` fills the two AI columns from the doc and adds them to an older index. A row whose Doc link points outside `docs/context/` is a reference row: matched like the others, never written.

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

### 2026-09-25 · run 3c9d2e1f-7a8b-4c9d-8e0f-1a2b3c4d5e6f · Mark homework finished
**Changed:** finished is a persisted boolean; loadAll defaults it for legacy records.
**Learned:** Hiding finished items with CSS only left the count wrong (count test failed at step 2). Ledger ERR-012: resolved · Homework finished flag missing after reload
**Decisive check:** These new tests fail on the original code: legacy-record load, double-mark (check unit). Checks: unit passed (exit 0).
**Files:** src/homework/finish.ts@sha256:1a2b3c4d5e6f, src/storage.ts@sha256:a1b2c3d4e5f6, test/homework.test.js@sha256:f6e5d4c3b2a1
```

Entries are newest first. The `**Files:**` items are `path@sha256:<prefix>` as `--write` records them, or `path@<commit>` when written by hand. The Current view is yours: the tool never edits it, so update it when an entry changes the rule a reader should follow, and name who accepted an adopted decision. A hash identifies the bytes an entry describes; it does not establish that the claim is correct or that anyone approved it.
