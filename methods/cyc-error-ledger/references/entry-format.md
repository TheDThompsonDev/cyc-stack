# Error ledger entry format

Newest entries go at the top. Each entry has a stable ID (`ERR-` plus a number) so other docs and commits can reference it.

```markdown
# Error ledger

Search this file before debugging. Signatures strip IDs, timestamps, and paths.

## ERR-012 · resolved · Homework finished flag missing after reload

- **Signature:** `TypeError: Cannot read properties of undefined (reading 'finished') @ loadAll`
- **Area:** src/storage.ts, src/homework/**
- **First seen:** 2026-09-25 · **Resolved:** 2026-09-25 at a1b2c3d
- **Symptom:** App crashes on load for users with homework saved before the finished feature.
- **Reproduce:** `node --test test/storage.test.js --test-name-pattern legacy`

**Attempts**
1. ✗ Added `?.` at the crash site. The crash stopped, but old items showed as finished because `undefined` was treated as truthy downstream. Evidence: the legacy count test stayed red.
2. ✗ Migrated records on save. Did not help users who load before their first save. Evidence: fresh-load test red.
3. ✓ Default `finished: false` in `loadAll` for records missing the field. Legacy, fresh, and double-mark tests all green.

- **Root cause:** Records saved before the feature have no `finished` key, and `loadAll` passed them through unchanged.
- **Guard:** `test/storage.test.js` › "loads legacy records without finished"
- **Related:** context doc homework.md, 2026-09-25 entry

## ERR-011 · open · Intermittent 502 on /api/assignments

- **Signature:** `502 Bad Gateway /api/assignments` (about 1 in 40 requests)
- **Area:** server/routes/assignments.ts
- **First seen:** 2026-09-20
- **Reproduce:** `for i in $(seq 200); do curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/assignments; done | sort | uniq -c`

**Attempts**
1. ✗ Raised the proxy timeout from 30s to 60s. Rate unchanged (5 in 200). Not a timeout.

- **Current best hypothesis:** Connection pool exhaustion under the concurrent reminder job. Next check: log pool size during the job window.
```
