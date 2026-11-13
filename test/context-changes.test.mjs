import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as live from '../scripts/runtime.mjs';
import { changeFor, historyContext, indexContext, lintContext, parseChanges, parseDoc, publishChange, readChanges, refreshIndex, reviewContext, rollupContext } from '../scripts/context-review.mjs';
import { investigateProject } from '../scripts/project-tools.mjs';
import { changeFingerprint } from '../scripts/run-gate.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

// Change records: what one completed run did and how its checks ended, published by the controller
// after verification. These tests drive real runs in temporary projects, some inside real Git
// repositories; nothing here simulates a host.
process.env.CYC_BASELINE_MODE = 'off';
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/cyc.mjs');
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const sha256 = text => createHash('sha256').update(text).digest('hex');
const put = (root, name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
const read = (root, name) => readFileSync(join(root, name), 'utf8');
const view = (...lines) => ['Orders are stored as text under src/orders; every reader goes through the adapter in the same folder.', ...lines].join('\n');
const doc = (body, covers = 'src/orders/**') => `# Orders\n\nCovers: ${covers}\n\n## Current view\n\n${body}\n\n## Lessons\n`;
const index = (rows = '| Orders | src/orders/** | [Orders](orders.md) |') => `# Context index\n\nRead the index first.\n\n| Component | Covers | Doc |\n| --- | --- | --- |\n${rows}\n`;
const record = ({ date, run, doc: name = 'docs/context/orders.md', files = ['src/orders/a.txt@sha256:' + sha256('a1')], result = 'passed · checks passed (exit 0)', completed }) =>
  `# ${date} · run ${run} · Change orders\n\nResult: ${result}\n${completed ? `Completed: ${completed}\n` : ''}Proof: No test proof recorded.\nChanged: Orders changed.\nLearned: No reusable learning recorded for this run.\n\nComponents:\n- ${name}: no component note recorded\n\nFiles:\n${files.map(f => `- ${f}`).join('\n')}\n`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-changes-'));
  t.after(() => { assert.ok(root.includes('cyc-changes-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'checks', command: process.execPath, args: ['-e', 'process.exit(0)'], timeoutMs: 5000 }] } }));
  put(root, 'src/orders/a.txt', 'a1');
  put(root, 'src/orders/b.txt', 'b1');
  put(root, 'docs/context/orders.md', doc(view('Reads never mutate the stored text.', 'Writes replace the whole value.', 'The count derives from the same list.')));
  put(root, 'docs/context/INDEX.md', index());
  return root;
}
// A real feature run from start to complete: edit, author the view, finish.
function finish(root, { goal, edit, currentView, changed, lesson }) {
  const id = live.startRun(root, { goal, playbook: 'feature', criteria: [{ id: 'c1', description: 'It works.' }], executionMode: 'standalone', allowedPaths: ['src/orders'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/a.txt'] }] } }).runId;
  live.quickHandoff(root, id, { summary: 'Read the order storage and its doc.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  edit();
  const state = live.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  // Inside a Git fixture the run has originals; this file is about context files, not test proof.
  assessment.testProof ??= { status: 'exempt', reason: 'Context-file fixture with text files only; original-code proof is tested separately, not claimed here.' };
  assessment.learning = { status: 'recorded', reason: 'Keep the storage rule current.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView, ...(changed ? { changed } : {}), ...(lesson ? { lesson } : {}) }] };
  const result = live.finishRun(root, id, { summary: `${goal} Done.`, criterionEvidence: { c1: 'Configured fixture check.' }, assessment });
  assert.equal(result.finished, true, JSON.stringify(result));
  return { id, result };
}
function git(root, args, env = {}) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'f@example.com', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'f@example.com', ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}`.trim() };
}
const ok = (root, args, env) => { const r = git(root, args, env); assert.equal(r.status, 0, r.out); return r.out; };
function cyc(root, args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8' });
  return { status: result.status, data: JSON.parse(result.stdout || result.stderr) };
}

test('two branches that each finish a run in the same component merge their doc, index and change records without a conflict', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  put(root, '.gitignore', '.cyc/runs/\n.cyc/runtime/\n');
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['config', 'core.autocrlf', 'false']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base']);
  const base = view('Reads never mutate the stored text.', 'Writes replace the whole value.', 'The count derives from the same list.');
  ok(root, ['checkout', '-q', '-b', 'reads']);
  const reads = finish(root, { goal: 'Make order reads tolerate an empty file.', edit: () => put(root, 'src/orders/a.txt', 'a2'), currentView: base.replace('Reads never mutate the stored text.', 'Reads never mutate the stored text and treat an empty file as no orders.'), changed: 'Reads accept an empty file.' });
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Reads tolerate an empty file']);
  ok(root, ['checkout', '-q', 'main']); ok(root, ['checkout', '-q', '-b', 'count']);
  const count = finish(root, { goal: 'Count orders after trimming blank lines.', edit: () => put(root, 'src/orders/b.txt', 'b2'), currentView: base.replace('The count derives from the same list.', 'The count derives from the same list, after blank lines are trimmed.'), changed: 'The count ignores blank lines.' });
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Count ignores blank lines']);
  const merged = git(root, ['merge', '--no-edit', 'reads']);
  assert.equal(merged.status, 0, `the merge must not conflict: ${merged.out}`);
  assert.equal(ok(root, ['status', '--porcelain']), '', 'nothing is left unmerged');
  const body = read(root, 'docs/context/orders.md');
  assert.match(body, /treat an empty file as no orders\./, 'the doc keeps the line one branch changed');
  assert.match(body, /after blank lines are trimmed\./, 'and the line the other branch changed');
  assert.doesNotMatch(body, /Last changed by AI|## History/);
  assert.equal(read(root, 'docs/context/INDEX.md'), index(), 'the index had no per-run cell to collide on');
  const changes = readChanges(root);
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(changes.entries.map(e => e.run).sort(), [reads.id, count.id].sort(), 'each branch brought its own record file');
  assert.deepEqual(changes.entries.map(e => e.fields.result), ['passed · checks passed (exit 0)', 'passed · checks passed (exit 0)']);
  assert.deepEqual(historyContext(root, { doc: 'orders' }).entries.map(e => e.changed).sort(), ['Reads accept an empty file.', 'The count ignores blank lines.']);
  assert.equal(lintContext(root).ok, true, JSON.stringify(lintContext(root).index.issues));
});

test('the change record is published only at completion, once, and is not verified source', t => {
  const root = fixture(t);
  const id = live.startRun(root, { goal: 'Change the first order file.', playbook: 'feature', criteria: [{ id: 'c1', description: 'It works.' }], executionMode: 'standalone', allowedPaths: ['src/orders'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/a.txt'] }] } }).runId;
  live.quickHandoff(root, id, { summary: 'Read the order storage.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  put(root, 'src/orders/a.txt', 'a2');
  assert.throws(() => changeFor(root, live.readRun(root, id)), /is running; only a completed run leaves a change record/);
  assert.throws(() => publishChange(root, live.readRun(root, id)), /only a completed run/);
  assert.equal(existsSync(join(root, 'docs/context/changes')), false, 'a refused publish creates nothing');
  // A record written by hand for this run before its checks is never adopted as the run's record.
  const forged = `docs/context/changes/${new Date().toISOString().slice(0, 10)}-${id.slice(0, 8)}.md`;
  put(root, forged, record({ date: forged.slice(21, 31), run: id, result: 'passed · written by hand before the checks ran' }));
  const state = live.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Keep the storage rule current.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view('Reads never mutate the stored text.', 'Writes replace the whole value and are now versioned.'), changed: 'Writes are versioned.', lesson: 'A partial write once left the count stale.' }] };
  const result = live.finishRun(root, id, { summary: 'The first order file is versioned.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment });
  assert.equal(result.finished, true, JSON.stringify(result));
  const done = live.readRun(root, id), name = readdirSync(join(root, 'docs/context/changes'));
  assert.deepEqual(name, [`${done.history.find(h => h.type === 'complete').time.slice(0, 10)}-${id.slice(0, 8)}.md`]);
  assert.equal(result.changeRecord.path, `docs/context/changes/${name[0]}`);
  assert.ok(done.history.findIndex(h => h.type === 'change-record') > done.history.findIndex(h => h.type === 'complete'), 'the record is written after the run completed, so it can state the outcome');
  const text = read(root, result.changeRecord.path);
  assert.match(text, new RegExp(`^# \\d{4}-\\d{2}-\\d{2} · run ${id} · Change the first order file\\.\n\nResult: passed · checks passed \\(exit 0\\)\nCompleted: ${done.history.find(h => h.type === 'complete').time}\n`));
  assert.match(text, /\nChanged: The first order file is versioned\.\nLearned: Keep the storage rule current\.\n\nComponents:\n- docs\/context\/orders\.md: Writes are versioned\.\n\nFiles:\n/);
  assert.ok(text.endsWith(`Files:\n- src/orders/a.txt@sha256:${sha256('a2')}\n`), 'the bytes the run verified, with full hashes');
  assert.equal(result.changeRecord.path, forged);
  assert.doesNotMatch(text, /written by hand/, 'the controller replaced the hand-written record with what it observed');
  assert.match(read(root, 'docs/context/orders.md'), /## Lessons\n\n- \d{4}-\d{2}-\d{2} · run [0-9a-f]{8}: A partial write once left the count stale\.\n$/, 'the lesson is kept in the doc, the history is not');
  // Not verified source: the snapshot the run verified is unchanged by its own record.
  assert.equal(live.sourceSnapshot(root).hash, done.verification.sourceHash);
  assert.equal(live.sourceSnapshot(root).files[result.changeRecord.path], undefined);
  // Once: neither a resumed finish nor a direct call writes a second record, and the first is not rewritten.
  assert.deepEqual(publishChange(root, done), { path: result.changeRecord.path, created: false });
  assert.equal(live.finishRun(root, id, {}).changeRecord.path, result.changeRecord.path);
  assert.deepEqual(readdirSync(join(root, 'docs/context/changes')), name);
  assert.equal(read(root, result.changeRecord.path), text);
  // A doc edit after completion is still a source change: delivery evidence cannot be republished over it.
  put(root, 'docs/context/orders.md', read(root, 'docs/context/orders.md').replace('are now versioned', 'are versioned'));
  assert.throws(() => live.finishRun(root, id, {}), /changed|Stale|modified|artifact/i);
});

test('a failed check leaves no record, and a routine run that plans no context leaves none either', t => {
  const failing = fixture(t);
  put(failing, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'checks', command: process.execPath, args: ['-e', 'process.exit(1)'], timeoutMs: 5000 }] } }));
  const id = live.startRun(failing, { goal: 'Change orders with a failing check.', playbook: 'feature', criteria: [{ id: 'c1', description: 'It works.' }], executionMode: 'standalone', allowedPaths: ['src/orders'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/a.txt'] }] } }).runId;
  live.quickHandoff(failing, id, { summary: 'Read the order storage.', assessment: fixtureAssessment(live.readRun(failing, id), 'scout') });
  put(failing, 'src/orders/a.txt', 'a2');
  const state = live.readRun(failing, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Keep the storage rule current.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view('Writes replace the whole value and are versioned.') }] };
  const result = live.finishRun(failing, id, { summary: 'The check fails.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment });
  assert.deepEqual([result.finished, result.failedAt], [false, 'verify']);
  assert.notEqual(live.readRun(failing, id).status, 'complete');
  assert.equal(existsSync(join(failing, 'docs/context/changes')), false, 'no record claims a run whose checks failed');
  assert.equal(live.readRun(failing, id).changeRecord, undefined);
  const routine = fixture(t);
  const routineId = live.startRun(routine, { goal: 'Reformat an order file.', playbook: 'refactor', executionMode: 'standalone', criteria: [{ id: 'c1', description: 'Same bytes meaning.' }], contextRetention: { disposition: 'unnecessary', routine: true, reason: 'Formatting only; no rule a reader follows changed.' } }).runId;
  live.quickHandoff(routine, routineId, { summary: 'Read the file.', assessment: fixtureAssessment(live.readRun(routine, routineId), 'scout') });
  put(routine, 'src/orders/a.txt', 'a1 ');
  const s = live.readRun(routine, routineId);
  const finished = live.finishRun(routine, routineId, { summary: 'Reformatted.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment: { ...fixtureAssessment(s, 'verify'), ...fixtureAssessment(s, 'deliver') } });
  assert.equal(finished.finished, true, JSON.stringify(finished));
  assert.equal(finished.changeRecord, undefined);
  assert.equal(existsSync(join(routine, 'docs/context/changes')), false, 'routine work adds no file');
});

test('only well-formed records are exempt from source and the Stop change check; lint names everything else', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  put(root, '.gitignore', '.cyc/runs/\n.cyc/runtime/\n');
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base']);
  const source = live.sourceSnapshot(root).hash, before = changeFingerprint(root);
  put(root, 'docs/context/changes/2026-11-02-aaaa1111.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001' }));
  put(root, 'docs/context/changes/2026-10.md', record({ date: '2026-10-05', run: 'bbbb2222-0000-4000-8000-000000000002' }));
  assert.equal(live.sourceSnapshot(root).hash, source, 'a record and a digest are not source');
  assert.deepEqual(changeFingerprint(root).files, before.files, 'and are not a project edit the Stop gate must account for');
  assert.equal(lintContext(root, { git: false }).ok, true);
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Records']);
  put(root, 'docs/context/changes/2026-11-02-aaaa1111.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001', result: 'passed · edited later' }));
  assert.equal(live.sourceSnapshot(root).hash, source, 'a tracked record stays outside source');
  for (const name of ['notes.txt', 'helper.mjs', '2026-11-02.md', 'nested/2026-11-02-cccc3333.md']) {
    put(root, `docs/context/changes/${name}`, 'export const hidden = true;\n');
    assert.notEqual(live.sourceSnapshot(root).hash, source, `${name} is ordinary source`);
    assert.ok(Object.keys(changeFingerprint(root).files).some(path => path.includes(name.split('/')[0])), `${name} is a project edit`);
    assert.ok(lintContext(root, { git: false }).changes.issues.some(i => i.rule === 'change-name'), `${name} is named by lint`);
    rmSync(join(root, 'docs/context/changes', name.split('/')[0]), { recursive: true, force: true });
  }
  const rules = () => lintContext(root, { git: false }).changes.issues.map(i => i.rule);
  put(root, 'docs/context/changes/2026-11-03-dddd4444.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001' }));
  assert.deepEqual(rules().sort(), ['change-duplicate', 'change-entry'], 'a second entry for a run, under a name that is not its own');
  put(root, 'docs/context/changes/2026-11-03-dddd4444.md', record({ date: '2026-11-03', run: 'dddd4444-0000-4000-8000-000000000004' }).replace(/^Result: .*\n/m, ''));
  assert.deepEqual(rules(), ['change-entry'], 'an entry without its result');
  put(root, 'docs/context/changes/2026-11-03-dddd4444.md', record({ date: '2026-11-03', run: 'dddd4444-0000-4000-8000-000000000004', files: ['src/orders/a.txt without a hash'] }));
  assert.deepEqual(rules(), ['change-entry'], 'a file without its hash');
  put(root, 'docs/context/changes/2026-10.md', record({ date: '2026-11-05', run: 'bbbb2222-0000-4000-8000-000000000002' }));
  assert.ok(rules().includes('change-entry'), 'a digest holding another month');
  // A project that keeps context elsewhere exempts that folder's records, not docs/context.
  const elsewhere = fixture(t);
  put(elsewhere, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, context: { directory: 'knowledge' }, verification: { commands: [] } }));
  const plain = live.sourceSnapshot(elsewhere).hash;
  put(elsewhere, 'knowledge/changes/2026-11-02-aaaa1111.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001' }));
  assert.equal(live.sourceSnapshot(elsewhere).hash, plain);
  put(elsewhere, 'docs/context/changes/2026-11-02-aaaa1111.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001' }));
  assert.notEqual(live.sourceSnapshot(elsewhere).hash, plain, 'the default folder is ordinary source there');
});

test('the index gains a new doc in sorted position and survives a real merge conflict with both rows', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  put(root, 'docs/context/INDEX.md', index('| Billing | src/billing/** | [Billing](billing.md) |\n| Orders | src/orders/** | [Orders](orders.md) |\n| Guide | src/** | [Guide](../guide.md) |'));
  put(root, 'docs/guide.md', 'A reference guide outside the context folder.');
  put(root, 'docs/context/billing.md', doc(view(), 'src/billing/**').replace('# Orders', '# Billing'));
  put(root, 'docs/context/carts.md', doc(view(), 'src/carts/**').replace('# Orders', '# Carts'));
  assert.deepEqual(lintContext(root, { git: false }).index.issues.map(i => i.rule), ['toc-unindexed']);
  assert.deepEqual(refreshIndex(root), { current: false, addedRows: 1, droppedColumns: [] });
  assert.equal(read(root, 'docs/context/INDEX.md'), index('| Billing | src/billing/** | [Billing](billing.md) |\n| Carts | src/carts/** | [Carts](carts.md) |\n| Orders | src/orders/** | [Orders](orders.md) |\n| Guide | src/** | [Guide](../guide.md) |'), 'between its neighbors, with the reference row left in place');
  assert.deepEqual(refreshIndex(root), { current: true, addedRows: 0, droppedColumns: [] }, 'rebuilding an index that matches writes nothing');
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['config', 'core.autocrlf', 'false']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base']);
  // Two branches each add a doc whose rows are neighbors: the one place the index can still conflict.
  for (const [branch, name, title] of [['payments', 'payments', 'Payments'], ['parcels', 'parcels', 'Parcels']]) {
    ok(root, ['checkout', '-q', '-b', branch, 'main']);
    put(root, `docs/context/${name}.md`, doc(view(), `src/${name}/**`).replace('# Orders', `# ${title}`));
    refreshIndex(root);
    ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', `Add ${name}`]);
  }
  const merged = git(root, ['merge', '--no-edit', 'payments']);
  assert.notEqual(merged.status, 0, 'adjacent new rows do conflict in Git');
  assert.match(read(root, 'docs/context/INDEX.md'), /^<<<<<<< /m);
  assert.deepEqual(lintContext(root, { git: false }).index.issues.map(i => i.rule), ['toc-conflict']);
  const repaired = cyc(root, ['context', 'index', '--write']);
  assert.equal(repaired.status, 0, JSON.stringify(repaired.data));
  assert.equal(read(root, 'docs/context/INDEX.md'), index('| Billing | src/billing/** | [Billing](billing.md) |\n| Carts | src/carts/** | [Carts](carts.md) |\n| Orders | src/orders/** | [Orders](orders.md) |\n| Parcels | src/parcels/** | [Parcels](parcels.md) |\n| Payments | src/payments/** | [Payments](payments.md) |\n| Guide | src/** | [Guide](../guide.md) |'), 'one command keeps both sides\' rows and removes the markers');
  assert.equal(lintContext(root, { git: false }).ok, true);
  assert.equal(indexContext(root).current, true);
});

test('investigate binds each covered file to its newest recorded hash and checks the queried path first', t => {
  const root = fixture(t);
  const older = record({ date: '2026-11-01', run: 'aaaa1111-0000-4000-8000-000000000001', completed: '2026-11-01T09:00:00.000Z', files: [`src/orders/a.txt@sha256:${sha256('a0')}`, `src/orders/b.txt@sha256:${sha256('b1')}`, `src/billing/x.txt@sha256:${sha256('x')}`] });
  const newer = record({ date: '2026-11-01', run: 'bbbb2222-0000-4000-8000-000000000002', completed: '2026-11-01T17:00:00.000Z', files: [`src/orders/a.txt@sha256:${sha256('a1')}`] });
  put(root, 'docs/context/changes/2026-11-01-aaaa1111.md', older);
  put(root, 'docs/context/changes/2026-11-01-bbbb2222.md', newer);
  const evidence = (paths, limit) => investigateProject(root, { paths, ...(limit ? { limit } : {}) }).contexts[0].recordEvidence[0];
  const all = evidence(['src/orders/b.txt']);
  assert.equal(all.status, 'matches', JSON.stringify(all));
  assert.deepEqual(all.files, [{ path: 'src/orders/b.txt', status: 'matches' }, { path: 'src/orders/a.txt', status: 'matches' }], 'the later run of the same day decides a.txt; b.txt keeps its last recorded hash; the uncovered file is not this doc\'s evidence');
  const limited = evidence(['src/orders/b.txt'], 1);
  assert.deepEqual([limited.files, limited.truncated, limited.totalBindings], [[{ path: 'src/orders/b.txt', status: 'matches' }], true, 2], 'the limit never hides the file that was asked about');
  put(root, 'src/orders/b.txt', 'b2');
  assert.deepEqual(evidence(['src/orders/b.txt'], 1).files, [{ path: 'src/orders/b.txt', status: 'changed' }]);
  assert.equal(evidence(['src/orders/b.txt']).status, 'drifted');
  // A record that does not name the doc binds nothing for it, whatever files it lists.
  rmSync(join(root, 'docs/context/changes'), { recursive: true });
  put(root, 'docs/context/changes/2026-11-01-aaaa1111.md', record({ date: '2026-11-01', run: 'aaaa1111-0000-4000-8000-000000000001', doc: 'docs/context/other.md', files: [`src/orders/a.txt@sha256:${sha256('a1')}`] }));
  assert.equal(evidence(['src/orders/a.txt']).status, 'unverified');
});

test('context lint judges a doc against the bytes a change record verified, not against who committed last', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  const at = date => ({ GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date }), status = () => lintContext(root).index.freshness[0].status;
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Doc and source together'], at('2026-10-01T10:00:00Z'));
  put(root, 'src/orders/a.txt', 'a2');
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Change an order file'], at('2026-10-02T10:00:00Z'));
  assert.equal(status(), 'stale', 'the code moved and nothing says the doc was looked at');
  // The run that revalidated the doc changed no word of it: its trace is the record that names the doc.
  put(root, 'docs/context/changes/2026-10-03-aaaa1111.md', record({ date: '2026-10-03', run: 'aaaa1111-0000-4000-8000-000000000001', doc: 'docs/context/other.md', files: [`src/orders/a.txt@sha256:${sha256('a2')}`] }));
  assert.equal(status(), 'stale', 'a record that names another doc does not count');
  put(root, 'docs/context/changes/2026-10-04-bbbb2222.md', record({ date: '2026-10-04', run: 'bbbb2222-0000-4000-8000-000000000002', files: [`src/orders/a.txt@sha256:${sha256('a1')}`] }));
  assert.equal(status(), 'stale', 'a record that verified other bytes does not count');
  put(root, 'docs/context/changes/2026-10-04-bbbb2222.md', record({ date: '2026-10-04', run: 'bbbb2222-0000-4000-8000-000000000002', files: [`src/orders/a.txt@sha256:${sha256('a2')}`] }));
  assert.equal(status(), 'stale', 'a record that is not committed is not history yet');
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Record the revalidation'], at('2026-10-04T10:00:00Z'));
  const fresh = lintContext(root);
  assert.equal(fresh.index.freshness[0].status, 'fresh', JSON.stringify(fresh.index.issues));
  assert.equal(fresh.ok, true);
});

test('rollup folds earlier months into one digest each without losing a record, and history reads through it', t => {
  const root = fixture(t);
  const runs = [['2026-09-03', 'aaaa1111-0000-4000-8000-000000000001'], ['2026-09-20', 'bbbb2222-0000-4000-8000-000000000002'], ['2026-10-07', 'cccc3333-0000-4000-8000-000000000003'], ['2026-11-02', 'dddd4444-0000-4000-8000-000000000004']];
  for (const [date, run] of runs) put(root, `docs/context/changes/${date}-${run.slice(0, 8)}.md`, record({ date, run }));
  const text = Object.fromEntries(readChanges(root).entries.map(e => [e.run, e.source]));
  const before = readdirSync(join(root, 'docs/context/changes'));
  const dry = cyc(root, ['context', 'rollup', '--before', '2026-11']);
  assert.equal(dry.status, 0, JSON.stringify(dry.data));
  assert.deepEqual(dry.data.digests.map(d => [d.path, d.records.length]), [['docs/context/changes/2026-09.md', 2], ['docs/context/changes/2026-10.md', 1]]);
  assert.deepEqual(readdirSync(join(root, 'docs/context/changes')), before, 'a dry run writes nothing');
  assert.equal(cyc(root, ['context', 'rollup', '--before', '2026-11', '--write']).status, 0);
  assert.deepEqual(readdirSync(join(root, 'docs/context/changes')).sort(), ['2026-09.md', '2026-10.md', '2026-11-02-dddd4444.md'], 'four files became three: one per earlier month plus the current record');
  const after = readChanges(root);
  assert.deepEqual(after.issues, []);
  assert.deepEqual(after.entries.map(e => e.run), runs.map(([, run]) => run).reverse(), 'every run is still there, newest first');
  assert.deepEqual(Object.fromEntries(after.entries.map(e => [e.run, e.source])), text, 'with its full text');
  assert.deepEqual(parseChanges(read(root, 'docs/context/changes/2026-09.md')).map(e => e.date), ['2026-09-20', '2026-09-03']);
  assert.deepEqual(historyContext(root, { doc: 'orders' }).entries.map(e => [e.date, e.record]), [['2026-11-02', 'docs/context/changes/2026-11-02-dddd4444.md'], ['2026-10-07', 'docs/context/changes/2026-10.md'], ['2026-09-20', 'docs/context/changes/2026-09.md'], ['2026-09-03', 'docs/context/changes/2026-09.md']]);
  assert.deepEqual(rollupContext(root, { before: '2026-11', write: true }).digests, [], 'nothing left to fold');
  // A record that arrives late for a folded month joins the digest; one already there is not doubled.
  put(root, 'docs/context/changes/2026-09-11-eeee5555.md', record({ date: '2026-09-11', run: 'eeee5555-0000-4000-8000-000000000005' }));
  put(root, 'docs/context/changes/2026-09-03-aaaa1111.md', text[runs[0][1]]);
  assert.deepEqual(lintContext(root, { git: false }).changes.issues.map(i => i.rule), ['change-duplicate'], 'as an interrupted rollup would leave it');
  rollupContext(root, { before: '2026-11', write: true });
  assert.deepEqual(parseChanges(read(root, 'docs/context/changes/2026-09.md')).map(e => e.date), ['2026-09-20', '2026-09-11', '2026-09-03']);
  assert.deepEqual(readChanges(root).issues, []);
  // Refusals: a folder with a foreign file is repaired first, and the month must be a month.
  put(root, 'docs/context/changes/notes.txt', 'x');
  assert.throws(() => rollupContext(root, { write: true }), /Repair the changes folder first/);
  assert.equal(cyc(root, ['context', 'rollup', '--before', 'last-month']).status, 1);
});

test('context history is refused for a path that is not a component doc, and lists the whole project without one', t => {
  const root = fixture(t);
  put(root, 'docs/context/changes/2026-11-02-dddd4444.md', record({ date: '2026-11-02', run: 'dddd4444-0000-4000-8000-000000000004', doc: 'docs/context/billing.md', files: [`src/billing/x.txt@sha256:${sha256('x')}`] }));
  put(root, 'docs/context/changes/2026-11-03-eeee5555.md', record({ date: '2026-11-03', run: 'eeee5555-0000-4000-8000-000000000005', doc: 'docs/context/billing.md', files: [`src/orders/a.txt@sha256:${sha256('a1')}`] }));
  const listed = cyc(root, ['context', 'history', 'orders']);
  assert.equal(listed.status, 0, JSON.stringify(listed.data));
  assert.deepEqual(listed.data.entries.map(e => [e.run.slice(0, 8), e.files]), [['eeee5555', ['src/orders/a.txt']]], 'a run that changed a covered file belongs to the component even when it named another doc');
  assert.deepEqual(cyc(root, ['context', 'history']).data.entries.map(e => e.run.slice(0, 8)), ['eeee5555', 'dddd4444']);
  assert.equal(cyc(root, ['context', 'history', 'missing']).status, 1);
  assert.match(cyc(root, ['context', 'history', '--doc', '../outside.md']).data.error, /not a component doc/);
});

// The cases below were each demonstrated against the first candidate by an independent review.

test('a changed path with a space or an "@" is recorded, read back, and does not block the next run', t => {
  const root = fixture(t);
  const first = finish(root, { goal: 'Add order notes and a modal page.', edit: () => { put(root, 'src/orders/my notes.txt', 'n1'); put(root, 'src/orders/@modal/page.txt', 'p1'); }, currentView: view('Notes and the modal page are stored beside the orders.') });
  assert.deepEqual(readChanges(root).issues, [], 'the controller can read the record it wrote');
  assert.deepEqual(readChanges(root).entries[0].files, [{ path: 'src/orders/@modal/page.txt', hash: `sha256:${sha256('p1')}` }, { path: 'src/orders/a.txt', hash: `sha256:${sha256('a1')}` }, { path: 'src/orders/my notes.txt', hash: `sha256:${sha256('n1')}` }]);
  assert.deepEqual(historyContext(root, { doc: 'orders' }).entries[0].files, ['src/orders/@modal/page.txt', 'src/orders/a.txt', 'src/orders/my notes.txt']);
  assert.equal(lintContext(root, { git: false }).ok, true);
  const second = finish(root, { goal: 'Change the notes.', edit: () => put(root, 'src/orders/my notes.txt', 'n2'), currentView: view('Notes and the modal page are stored beside the orders; notes are versioned.') });
  assert.notEqual(second.id, first.id);
  assert.equal(investigateProject(root, { paths: ['src/orders/my notes.txt'] }).contexts[0].recordEvidence[0].status, 'matches');
});

test('a deleted covered file is recorded as deleted and stops counting as drift', t => {
  const root = fixture(t);
  finish(root, { goal: 'Bind both order files.', edit: () => { put(root, 'src/orders/a.txt', 'a2'); put(root, 'src/orders/b.txt', 'b2'); }, currentView: view('Both files hold orders.') });
  finish(root, { goal: 'Fold the second order file into the first.', edit: () => { put(root, 'src/orders/a.txt', 'a3'); rmSync(join(root, 'src/orders/b.txt')); }, currentView: view('One file holds every order.') });
  assert.match(read(root, readChanges(root).entries[0].file), /^- src\/orders\/b\.txt@deleted$/m);
  const evidence = () => investigateProject(root, { paths: ['src/orders/b.txt'] }).contexts[0].recordEvidence[0];
  assert.deepEqual([evidence().status, evidence().files], ['matches', [{ path: 'src/orders/b.txt', status: 'matches' }, { path: 'src/orders/a.txt', status: 'matches' }]]);
  put(root, 'src/orders/b.txt', 'back again');
  assert.equal(evidence().status, 'drifted', 'a file the last run verified as gone is drift when it returns');
});

test('a record for a run that planned no doc names none, so it cannot stand in for revalidating the doc', t => {
  const root = fixture(t);
  finish(root, { goal: 'Bind the first order file.', edit: () => put(root, 'src/orders/a.txt', 'a2'), currentView: view('The first file holds orders.') });
  const evidence = () => investigateProject(root, { paths: ['src/orders/a.txt'] }).contexts[0].recordEvidence[0].status;
  assert.equal(evidence(), 'matches');
  const id = live.startRun(root, { goal: 'Reformat the first order file.', playbook: 'refactor', executionMode: 'standalone', criteria: [{ id: 'c1', description: 'Same meaning.' }], contextRetention: { disposition: 'unnecessary', routine: true, reason: 'Formatting only.' } }).runId;
  live.quickHandoff(root, id, { summary: 'Read the file.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  put(root, 'src/orders/a.txt', 'a2 ');
  const s = live.readRun(root, id);
  assert.equal(live.finishRun(root, id, { summary: 'Reformatted.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment: { ...fixtureAssessment(s, 'verify'), ...fixtureAssessment(s, 'deliver') } }).finished, true);
  assert.equal(evidence(), 'drifted', 'the doc was not verified against the reformatted bytes');
  assert.equal(reviewContext(root, { run: id, write: true }).written[0].created, true);
  const entry = readChanges(root).entries.find(e => e.run === id);
  assert.deepEqual(entry.components, [], 'the routine run did not look at the doc, so its record does not name it');
  assert.equal(evidence(), 'drifted', 'publishing that record changes nothing about the doc');
  assert.ok(historyContext(root, { doc: 'orders' }).entries.some(e => e.run === id), 'the component history still shows the run, by the file it changed');
});

test('an entry the controller did not write is removed at completion wherever it sits', t => {
  const root = fixture(t);
  const id = live.startRun(root, { goal: 'Change the first order file.', playbook: 'feature', criteria: [{ id: 'c1', description: 'It works.' }], executionMode: 'standalone', allowedPaths: ['src/orders'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/a.txt'] }] } }).runId;
  live.quickHandoff(root, id, { summary: 'Read the order storage.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  put(root, 'src/orders/a.txt', 'a2');
  const other = 'eeee5555-0000-4000-8000-000000000005', month = new Date().toISOString().slice(0, 7);
  put(root, `docs/context/changes/${month}.md`, record({ date: `${month}-01`, run: other }) + '\n' + record({ date: `${month}-01`, run: id, result: 'passed · written by hand before the checks ran' }));
  const state = live.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Keep the storage rule current.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view('Writes replace the whole value and are versioned.') }] };
  const result = live.finishRun(root, id, { summary: 'Versioned.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.match(result.changeRecord.path, new RegExp(`^docs/context/changes/\\d{4}-\\d{2}-\\d{2}-${id.slice(0, 8)}\\.md$`));
  const changes = readChanges(root);
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(changes.entries.filter(e => e.run === id).map(e => e.fields.result), ['passed · checks passed (exit 0)'], 'one entry for the run: the controller\'s');
  assert.deepEqual(parseChanges(read(root, `docs/context/changes/${month}.md`)).map(e => e.run), [other], 'the other run\'s entry in that digest is untouched');
});

test('a folder under a record name, and a context folder spelled differently in the configuration, do not move the source boundary', t => {
  const root = fixture(t), source = live.sourceSnapshot(root).hash, seen = changeFingerprint(root).files;
  put(root, 'docs/context/changes/2026-11.md/helper.mjs', 'export const hidden = true;\n');
  assert.notEqual(live.sourceSnapshot(root).hash, source, 'a folder named like a digest is not a digest');
  assert.notDeepEqual(changeFingerprint(root).files, seen, 'and the Stop change check sees what is inside it');
  assert.ok(Object.keys(live.sourceSnapshot(root).files).includes('docs/context/changes/2026-11.md/helper.mjs'));
  assert.deepEqual(lintContext(root, { git: false }).changes.issues.map(i => i.rule), ['change-name']);
  const spaced = fixture(t);
  put(spaced, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, context: { directory: 'knowledge ' }, verification: { commands: [] } }));
  const plain = live.sourceSnapshot(spaced).hash;
  put(spaced, 'knowledge/changes/2026-11-02-aaaa1111.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001' }));
  assert.equal(live.sourceSnapshot(spaced).hash, plain, 'the exemption reads the folder name as the controller does');
  if (process.platform === 'win32') {
    const cased = fixture(t), before = live.sourceSnapshot(cased).hash;
    put(cased, 'docs/context/Changes/2026-11-02-aaaa1111.md', record({ date: '2026-11-02', run: 'aaaa1111-0000-4000-8000-000000000001' }));
    assert.equal(live.sourceSnapshot(cased).hash, before, 'Windows names the same folder whatever its case');
  }
});

test('index repair handles a conflict between the earlier and the current layout, and leaves a prose conflict alone', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  put(root, 'docs/context/billing.md', doc(view(), 'src/billing/**').replace('# Orders', '# Billing'));
  put(root, 'docs/context/INDEX.md', '# Context index\n\n| Component | Covers | Doc | Last AI change | Lessons |\n| :--- | --- | --- | --- | --- |\n| Billing | src/billing/** | [Billing](billing.md) | none recorded | none |\n| Orders | src/orders/** | [Orders](orders.md) | none recorded | none |\n');
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['config', 'core.autocrlf', 'false']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base']);
  ok(root, ['checkout', '-q', '-b', 'current']); refreshIndex(root); ok(root, ['commit', '-q', '-am', 'Drop the per-run columns']);
  ok(root, ['checkout', '-q', '-b', 'earlier', 'main']);
  put(root, 'docs/context/INDEX.md', read(root, 'docs/context/INDEX.md').replace('[Orders](orders.md) | none recorded | none', '[Orders](orders.md) | 2026-11-01 · run abcd1234 · Later | 1 · latest: x'));
  ok(root, ['commit', '-q', '-am', 'An earlier-engine run changed a cell']);
  assert.notEqual(git(root, ['merge', '--no-edit', 'current']).status, 0, 'the two layouts conflict in Git');
  const repaired = cyc(root, ['context', 'index', '--write']);
  assert.equal(repaired.status, 0, JSON.stringify(repaired.data));
  assert.equal(read(root, 'docs/context/INDEX.md'), '# Context index\n\n| Component | Covers | Doc |\n| :--- | --- | --- |\n| Billing | src/billing/** | [Billing](billing.md) |\n| Orders | src/orders/** | [Orders](orders.md) |\n', 'one table, each doc once, no markers, the alignment row as written');
  assert.equal(lintContext(root, { git: false }).ok, true);
  assert.equal(indexContext(root).current, true, 'an alignment row is not a difference');
  const prose = `${read(root, 'docs/context/INDEX.md')}<<<<<<< ours\nOne note.\n=======\nAnother note.\n>>>>>>> theirs\n`;
  put(root, 'docs/context/INDEX.md', prose);
  const left = indexContext(root, { write: true });
  assert.deepEqual([left.ok, left.written, !!left.conflict], [false, false, true], 'a conflict in the prose is reported, not half removed');
  assert.equal(read(root, 'docs/context/INDEX.md'), prose);
});

test('context lint does not call a doc fresh because a record verified other bytes or because rollup committed a digest', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  const at = date => ({ GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date }), status = () => lintContext(root).index.freshness[0].status;
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base'], at('2026-09-01T10:00:00Z'));
  put(root, 'src/orders/a.txt', 'a2');
  put(root, 'docs/context/changes/2026-09-02-aaaa1111.md', record({ date: '2026-09-02', run: 'aaaa1111-0000-4000-8000-000000000001', files: [`src/orders/a.txt@sha256:${sha256('a2')}`] }));
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'A run changes a file and records it'], at('2026-09-02T10:00:00Z'));
  assert.equal(status(), 'fresh');
  put(root, 'src/orders/a.txt', 'a3 by hand');
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'A hand edit'], at('2026-10-02T10:00:00Z'));
  assert.equal(status(), 'stale', 'the record verified a2, not these bytes');
  rollupContext(root, { before: '2026-10', write: true });
  ok(root, ['add', '-A']); ok(root, ['commit', '-q', '-m', 'Roll up September'], at('2026-11-03T10:00:00Z'));
  assert.deepEqual(readdirSync(join(root, 'docs/context/changes')), ['2026-09.md']);
  assert.equal(status(), 'stale', 'a newer commit of the digest is not a newer look at the doc');
});

test('migration keeps what each doc said about a shared run, and converts nothing when one doc cannot be converted', t => {
  const root = fixture(t);
  const entry = (extra = '') => `\n### 2026-10-01 · run abcd1234 · Shared change\n**Changed:** Both components changed.\n**Learned:** ORDERS-LEARNED\n**Decisive check:** ORDERS-PROOF\nORDERS-EXTRA line\n**Files:** src/orders/a.txt@sha256:${sha256('a1')}${extra}\n`;
  const earlier = (title, covers, body) => `# ${title}\n\nCovers: ${covers}\n\nLast changed by AI: 2026-10-01 · run abcd1234 · files: src/orders/a.txt\n\n## Current view\n\n${view()}\n\n## Lessons\n\n## History\n${body}`;
  put(root, 'docs/context/orders.md', earlier('Orders', 'src/orders/**', entry()));
  put(root, 'docs/context/billing.md', earlier('Billing', 'src/billing/**', entry().replace('2026-10-01 · run abcd1234 · Shared change', '2026-10-02 · run abcd1234 · Shared change, billing side').replace('ORDERS-LEARNED', 'BILLING-LEARNED').replace('ORDERS-PROOF', 'BILLING-PROOF').replace('ORDERS-EXTRA line\n', '').replace(sha256('a1'), sha256('other bytes'))).replace('2026-10-01 · run abcd1234 · files', '2026-10-02 · run abcd1234 · files'));
  put(root, 'docs/context/INDEX.md', index('| Billing | src/billing/** | [Billing](billing.md) |\n| Orders | src/orders/** | [Orders](orders.md) |'));
  put(root, 'docs/context/carts.md', `# Carts\n\nCovers: src/carts/**\n\nLast changed by AI: 2026-10-05 · run ffff9999 · files: src/carts/c.txt\n\n## Current view\n\n${view()}\n\n## Lessons\n\n## History\n`);
  const before = ['orders', 'billing', 'carts'].map(name => read(root, `docs/context/${name}.md`));
  const blocked = cyc(root, ['context', 'migrate', '--write']);
  assert.deepEqual([blocked.status, blocked.data.written, blocked.data.skipped.map(s => s.path)], [1, false, ['docs/context/carts.md']], 'a doc that names a run with no entry cannot be converted without dropping that claim');
  assert.deepEqual(['orders', 'billing', 'carts'].map(name => read(root, `docs/context/${name}.md`)), before, 'so nothing is converted');
  assert.equal(existsSync(join(root, 'docs/context/changes')), false);
  rmSync(join(root, 'docs/context/carts.md'));
  assert.equal(cyc(root, ['context', 'migrate', '--write']).status, 0);
  const text = read(root, 'docs/context/changes/2026-10.md');
  for (const kept of ['ORDERS-LEARNED', 'ORDERS-PROOF', 'ORDERS-EXTRA line', 'BILLING-LEARNED', 'BILLING-PROOF', 'Shared change, billing side', '2026-10-02', sha256('a1'), sha256('other bytes')]) assert.ok(text.includes(kept), `${kept} is kept`);
  assert.deepEqual(readChanges(root).issues, []);
  assert.ok(parseDoc(doc(view()).replace('## Current view', '## Current view  '), 'orders.md').issues.some(i => i.rule === 'sections'), 'a heading with trailing space is not the heading the writer looks for');
});

test('rollup refuses to drop a record that differs from its digest, and stray text in a record is reported first', t => {
  const root = fixture(t), run = 'aaaa1111-0000-4000-8000-000000000001';
  put(root, 'docs/context/changes/2026-09.md', record({ date: '2026-09-03', run, result: 'passed · the digest says this' }));
  put(root, 'docs/context/changes/2026-09-03-aaaa1111.md', record({ date: '2026-09-03', run, result: 'passed · the record says that' }));
  assert.throws(() => rollupContext(root, { before: '2026-11', write: true }), /two entries with different text/);
  assert.equal(existsSync(join(root, 'docs/context/changes/2026-09-03-aaaa1111.md')), true, 'the record is kept');
  rmSync(join(root, 'docs/context/changes/2026-09.md'));
  put(root, 'docs/context/changes/2026-09-03-aaaa1111.md', 'A note someone added above the entry.\n\n' + record({ date: '2026-09-03', run }));
  assert.deepEqual(lintContext(root, { git: false }).changes.issues.map(i => i.rule), ['change-entry']);
  assert.throws(() => rollupContext(root, { before: '2026-11', write: true }), /Repair the changes folder first/);
});

test('an earlier-layout doc is read from its History when that is newer than any change record', t => {
  const root = fixture(t);
  put(root, 'docs/context/orders.md', `# Orders\n\nCovers: src/orders/**\n\nLast changed by AI: 2026-11-08 · run bbbb2222 · files: src/orders/a.txt\n\n## Current view\n\n${view()}\n\n## Lessons\n\n## History\n\n### 2026-11-08 · run bbbb2222 · Newer\n**Files:** src/orders/a.txt@sha256:${sha256('a1')}\n`);
  put(root, 'docs/context/changes/2026-10-01-aaaa1111.md', record({ date: '2026-10-01', run: 'aaaa1111-0000-4000-8000-000000000001', files: [`src/orders/a.txt@sha256:${sha256('older bytes')}`] }));
  const status = () => investigateProject(root, { paths: ['src/orders/a.txt'] }).contexts[0].recordEvidence[0].status;
  assert.equal(status(), 'matches');
  put(root, 'docs/context/changes/2026-11-09-cccc3333.md', record({ date: '2026-11-09', run: 'cccc3333-0000-4000-8000-000000000003', files: [`src/orders/a.txt@sha256:${sha256('newer bytes')}`] }));
  assert.equal(status(), 'drifted', 'a record newer than the History decides');
});

// Second review pass: weaknesses demonstrated in the fixes above.

test('a stale doc stays stale through an uncommitted edit, an uncommitted record, and a revert to bytes an older record verified', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  const at = date => ({ GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date }), status = () => lintContext(root).index.freshness[0].status;
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base'], at('2026-09-01T10:00:00Z'));
  put(root, 'src/orders/a.txt', 'a2');
  put(root, 'docs/context/changes/2026-09-02-aaaa1111.md', record({ date: '2026-09-02', run: 'aaaa1111-0000-4000-8000-000000000001', files: [`src/orders/a.txt@sha256:${sha256('a2')}`] }));
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'A run changes a file and records it'], at('2026-09-02T10:00:00Z'));
  assert.equal(status(), 'fresh');
  put(root, 'src/orders/a.txt', 'a3 by hand');
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'A hand edit'], at('2026-10-02T10:00:00Z'));
  assert.equal(status(), 'stale');
  put(root, 'src/orders/a.txt', 'a4 not committed');
  assert.equal(status(), 'stale', 'an uncommitted edit on top does not hide the committed one');
  put(root, 'src/orders/a.txt', 'a3 by hand');
  put(root, 'docs/context/changes/2026-10-03-feedface.md', record({ date: '2026-10-03', run: 'feedface-0000-4000-8000-000000000009', files: [`src/orders/a.txt@sha256:${sha256('a3 by hand')}`] }));
  assert.equal(status(), 'stale', 'a record that is not committed is not history yet');
  rmSync(join(root, 'docs/context/changes/2026-10-03-feedface.md'));
  put(root, 'docs/context/orders.md', doc(view('The first file was reworked by hand and holds the reworked orders.')));
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Reword the doc for the hand edit'], at('2026-10-05T10:00:00Z'));
  assert.equal(status(), 'fresh');
  put(root, 'src/orders/a.txt', 'a2');
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Revert the code only'], at('2026-10-06T10:00:00Z'));
  assert.equal(status(), 'stale', 'the September record verified a2 for the doc as it was then, not for the reworded doc');
});

test('a component named Covers is a row, a conflict that reaches beyond the table is refused, and a three-way base is not a side', t => {
  const root = fixture(t);
  put(root, 'docs/context/covers.md', doc(view(), 'src/covers/**').replace('# Orders', '# Covers'));
  put(root, 'docs/context/INDEX.md', index('| Covers | src/covers/** | [Covers](covers.md) |\n| Orders | src/orders/** | [Orders](orders.md) |'));
  assert.equal(lintContext(root, { git: false }).ok, true);
  assert.deepEqual(refreshIndex(root), { current: true, addedRows: 0, droppedColumns: [] });
  const text = read(root, 'docs/context/INDEX.md');
  const reaching = `${text.replace('Read the index first.', '<<<<<<< ours\nRead the index first.').replace('| Orders |', '=======\n| Orders |')}>>>>>>> theirs\n`;
  put(root, 'docs/context/INDEX.md', reaching);
  assert.throws(() => refreshIndex(root), /reaches beyond its table/);
  assert.equal(read(root, 'docs/context/INDEX.md'), reaching, 'nothing is rewritten');
  put(root, 'docs/context/INDEX.md', index('| Covers | src/covers/** | [Covers](covers.md) |\n<<<<<<< ours\n| Orders | src/orders/** | [Orders](orders.md) |\n||||||| base\n| Gone | src/gone/** | [Gone](../gone.md) |\n=======\n| Orders | src/orders/** | [Orders](orders.md) |\n>>>>>>> theirs'));
  refreshIndex(root);
  assert.equal(read(root, 'docs/context/INDEX.md'), text, 'a row both sides removed is not restored from the base section');
});

test('migration keeps a long title and long notes whole', t => {
  const root = fixture(t), title = `Long ${'title '.repeat(30)}TITLE-END`;
  const extra = Array.from({ length: 30 }, (_, i) => `NOTE-${i + 1} ${'x'.repeat(90)} NOTE-${i + 1}-END`).join('\n');
  put(root, 'docs/context/orders.md', `# Orders\n\nCovers: src/orders/**\n\nLast changed by AI: 2026-10-01 · run abcd1234 · files: src/orders/a.txt\n\n## Current view\n\n${view()}\n\n## Lessons\n\n## History\n\n### 2026-10-01 · run abcd1234 · ${title}\n**Changed:** x\n${extra}\n**Files:** src/orders/a.txt@sha256:${sha256('a1')}\n`);
  assert.equal(cyc(root, ['context', 'migrate', '--write']).status, 0);
  const text = read(root, 'docs/context/changes/2026-10.md');
  for (const kept of ['TITLE-END', 'NOTE-20-END', 'NOTE-30-END']) assert.ok(text.includes(kept), `${kept} is kept`);
  assert.deepEqual(readChanges(root).issues, []);
});

test('the completing run removes every entry it did not write, and a same-day record outranks an earlier-layout History', t => {
  const root = fixture(t), today = new Date().toISOString().slice(0, 10);
  put(root, 'docs/context/orders.md', `# Orders\n\nCovers: src/orders/**\n\nLast changed by AI: ${today} · run bbbb2222 · files: src/orders/a.txt\n\n## Current view\n\n${view()}\n\n## Lessons\n\n## History\n\n### ${today} · run bbbb2222 · Earlier today\n**Files:** src/orders/a.txt@sha256:${sha256('a1')}\n`);
  const { id, result } = finish(root, { goal: 'Change the first order file again.', edit: () => put(root, 'src/orders/a.txt', 'a2'), currentView: view('The first file holds the second value.') });
  assert.equal(investigateProject(root, { paths: ['src/orders/a.txt'] }).contexts[0].recordEvidence[0].status, 'matches', 'the record of a run that re-authored the doc today decides, not the History entry of the same day');
  const done = live.readRun(root, id), other = 'eeee5555-0000-4000-8000-000000000005';
  rmSync(join(root, result.changeRecord.path));
  put(root, `docs/context/changes/2026-01-05-${id.slice(0, 8)}.md`, record({ date: '2026-01-05', run: id, result: 'passed · forged one' }));
  put(root, 'docs/context/changes/2026-02.md', `${record({ date: '2026-02-01', run: other })}\n${record({ date: '2026-02-02', run: id, result: 'passed · forged two' })}`);
  assert.deepEqual(publishChange(root, done, live.sourceSnapshot(root).files), { path: result.changeRecord.path, created: true });
  const changes = readChanges(root);
  assert.deepEqual(changes.issues, []);
  assert.deepEqual(changes.entries.filter(e => e.run === id).map(e => e.fields.result), ['passed · checks passed (exit 0)']);
  assert.deepEqual(changes.files.sort(), ['2026-02.md', result.changeRecord.path.split('/').at(-1)].sort(), 'the forged record file is gone and the digest keeps only the other run');
});

// Findings from the automated review of the pull request.

test('a staged record is not committed history: it does not make a stale doc fresh until it is committed', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  const at = date => ({ GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date }), status = () => lintContext(root).index.freshness[0].status;
  ok(root, ['init', '-q', '-b', 'main']); ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Base'], at('2026-10-01T10:00:00Z'));
  put(root, 'src/orders/a.txt', 'a2');
  ok(root, ['add', '.']); ok(root, ['commit', '-q', '-m', 'Change an order file'], at('2026-10-02T10:00:00Z'));
  assert.equal(status(), 'stale');
  put(root, 'docs/context/changes/2026-10-03-bbbb2222.md', record({ date: '2026-10-03', run: 'bbbb2222-0000-4000-8000-000000000002', files: [`src/orders/a.txt@sha256:${sha256('a2')}`] }));
  ok(root, ['add', 'docs/context/changes']);
  assert.match(ok(root, ['status', '--porcelain']), /^A  docs\/context\/changes\/2026-10-03-bbbb2222\.md$/, 'the record is staged, not committed');
  assert.equal(status(), 'stale', 'a staged record is not history yet');
  ok(root, ['commit', '-q', '-m', 'Record the revalidation'], at('2026-10-03T10:00:00Z'));
  assert.equal(status(), 'fresh');
  put(root, 'docs/context/changes/2026-10-03-bbbb2222.md', record({ date: '2026-10-03', run: 'bbbb2222-0000-4000-8000-000000000002', files: [`src/orders/a.txt@sha256:${sha256('a2')}`], result: 'passed · edited and staged' }));
  ok(root, ['add', 'docs/context/changes']);
  assert.equal(status(), 'stale', 'a committed record with a staged edit is not the committed record');
});

test('a record published later for a context-only run still names the implementation bytes that run verified', t => {
  const root = fixture(t);
  const id = live.startRun(root, { goal: 'Reword the order doc.', playbook: 'feature', criteria: [{ id: 'c1', description: 'The doc is current.' }], executionMode: 'standalone', allowedPaths: ['docs/context'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/a.txt'] }] } }).runId;
  live.quickHandoff(root, id, { summary: 'Read the order storage and its doc.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  put(root, 'docs/context/INDEX.md', `${read(root, 'docs/context/INDEX.md')}\nA note under the table.\n`);
  const state = live.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Keep the storage rule current.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view('Reads never mutate the stored text, and that rule was checked again against the unchanged adapter file.') }] };
  const result = live.finishRun(root, id, { summary: 'The order doc is reworded; no implementation changed.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment });
  assert.equal(result.finished, true, JSON.stringify(result));
  const anchor = [{ path: 'src/orders/a.txt', hash: `sha256:${sha256('a1')}` }];
  assert.deepEqual(readChanges(root).entries[0].files, anchor, 'the unchanged file the view was written against is bound at completion');
  rmSync(join(root, result.changeRecord.path));
  assert.equal(reviewContext(root, { run: id, write: true }).written[0].created, true);
  assert.deepEqual(readChanges(root).entries[0].files, anchor, 'publishing it again later keeps that binding');
  assert.equal(investigateProject(root, { paths: ['src/orders/a.txt'] }).contexts[0].recordEvidence[0].status, 'matches');
});

test('migration keeps a History entry that says more than its existing change entry, and finishes an interrupted migration', t => {
  const earlier = (learned = 'DOC-LEARNED') => `# Orders\n\nCovers: src/orders/**\n\nLast changed by AI: 2026-10-01 · run abcd1234 · files: src/orders/a.txt\n\n## Current view\n\n${view()}\n\n## Lessons\n\n## History\n\n### 2026-10-01 · run abcd1234 · Shared change\n**Changed:** Orders changed.\n**Learned:** ${learned}\n**Files:** src/orders/a.txt@sha256:${sha256('a1')}\n`;
  const differing = fixture(t);
  put(differing, 'docs/context/orders.md', earlier('ONLY-IN-THE-DOC'));
  put(differing, 'docs/context/changes/2026-10-01-abcd1234.md', record({ date: '2026-10-01', run: 'abcd1234' }));
  const refused = cyc(differing, ['context', 'migrate', '--write']);
  assert.deepEqual([refused.status, refused.data.written, refused.data.skipped.map(s => s.path)], [1, false, ['docs/context/orders.md']]);
  assert.match(refused.data.skipped[0].reason, /lacks part of its History; reconcile the two first/);
  assert.equal(read(differing, 'docs/context/orders.md'), earlier('ONLY-IN-THE-DOC'), 'the History that only the doc holds is still there');
  const interrupted = fixture(t);
  put(interrupted, 'docs/context/orders.md', earlier());
  assert.equal(cyc(interrupted, ['context', 'migrate', '--write']).status, 0);
  const digest = read(interrupted, 'docs/context/changes/2026-10.md');
  put(interrupted, 'docs/context/orders.md', earlier());
  const resumed = cyc(interrupted, ['context', 'migrate', '--write']);
  assert.deepEqual([resumed.status, resumed.data.written, resumed.data.runs, resumed.data.docs], [0, true, 0, [{ path: 'docs/context/orders.md', entries: 1 }]], 'the entry already holds everything this History says, so the doc is converted');
  assert.equal(parseDoc(read(interrupted, 'docs/context/orders.md'), 'orders.md').layout, 'current');
  assert.equal(read(interrupted, 'docs/context/changes/2026-10.md'), digest, 'and the digest is not rewritten');
});

test('a source file changed between completion and publication is not bound to the passed result', t => {
  const root = fixture(t);
  const id = live.startRun(root, { goal: 'Change the first order file.', playbook: 'feature', criteria: [{ id: 'c1', description: 'It works.' }], executionMode: 'standalone', allowedPaths: ['src/orders'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/a.txt'] }] } }).runId;
  live.quickHandoff(root, id, { summary: 'Read the order storage.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  put(root, 'src/orders/a.txt', 'a2');
  const state = live.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Keep the storage rule current.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: view('Writes replace the whole value and are versioned.') }] };
  // Change the file in the gap the review named: after the completion commit, before publication.
  const rename = fs.renameSync; let changed = false;
  fs.renameSync = (from, to) => {
    const done = rename(from, to);
    if (!changed && String(to).endsWith('state.json') && JSON.parse(readFileSync(to, 'utf8')).status === 'complete') { changed = true; put(root, 'src/orders/a.txt', 'changed after completion'); }
    return done;
  }; syncBuiltinESMExports();
  let result;
  try { result = live.finishRun(root, id, { summary: 'Versioned.', criterionEvidence: { c1: 'Configured fixture check.' }, assessment }); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.equal(changed, true, 'the file was changed inside the gap');
  assert.deepEqual([result.finished, result.status], [true, 'complete'], 'completion stands');
  assert.match(result.changeRecord.error, /Source changed after the run completed/);
  assert.equal(result.changeRecord.path, undefined);
  assert.equal(existsSync(join(root, 'docs/context/changes')), false, 'no record binds bytes the checks did not see');
  assert.match(read(root, `.cyc/runs/${id}/review.md`), /- Change record: not written \(Source changed after the run completed/);
});
