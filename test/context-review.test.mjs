import test from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finishRun, nextRun, readRun, recordHandoff, retryRun, startRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { applyEntry, lintContext, measureContext, parseDoc, reviewContext as actualReviewContext, rules } from '../scripts/context-review.mjs';
import * as live from '../scripts/runtime.mjs';
import * as contextTools from '../scripts/context-review.mjs';
import { investigateProject } from '../scripts/project-tools.mjs';
import { installProject } from '../scripts/install.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

// These tests are not about run-start measurement; a background worker would outlive their temp folders.
process.env.CYC_BASELINE_MODE = 'off';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(repo, 'bin/cyc.mjs');
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

function put(root, name, content) { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); }
const validDoc = (title = 'Orders', covers = 'src/orders/**') => `# ${title}\n\nCovers: ${covers}\n\nLast changed by AI: none recorded\n\n## Current view\n\nOrders are persisted as text; the count derives from the same list.\n\n## Lessons\n\n## History\n`;
const validIndex = (rows = '| Orders | src/orders/** | [Orders](orders.md) | none recorded | none |\n| Billing | src/billing/** | [Billing](../billing.md) | reference row | reference row |') =>
  `# Context index\n\nRead the index first.\n\n| Component | Covers | Doc | Last AI change | Lessons |\n| --- | --- | --- | --- | --- |\n${rows}\n`;

function fixture(t, { index = validIndex(), doc = validDoc() } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-context-'));
  t.after(() => { assert.ok(root.includes('cyc-context-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'checks', command: process.execPath, args: ['-e', 'process.exit(0)'], timeoutMs: 5000 }] } }));
  put(root, 'src/orders/order.txt', 'v1');
  put(root, 'src/billing/bill.txt', 'v1');
  put(root, 'docs/billing.md', 'Billing reference doc outside the context folder.');
  put(root, 'docs/context/error-ledger.md', '# Error ledger\n\n');
  if (index !== null) put(root, 'docs/context/INDEX.md', index);
  if (doc !== null) put(root, 'docs/context/orders.md', doc);
  return root;
}

// Drive a run from start to complete: Scout recorded, an edit, optional retry and ledger entry, then finish.
function completeRun(root, { goal, playbook = 'feature', edit, retry, ledger }) {
  const id = startRun(root, { goal, playbook, criteria: [{ id: 'c1', description: 'It works.' }], allowedPaths: ['src', 'docs/context'] }).runId;
  const next = nextRun(root, id);
  recordHandoff(root, { runId: id, stage: 'scout', attempt: next.attempt, status: 'passed', summary: 'Scouted.', evidence: [{ kind: 'observation', detail: 'fixture' }], artifacts: [], assessment: fixtureAssessment(readRun(root, id)), criteria: [{ id: 'c1', result: 'unverified', evidence: 'later' }] });
  edit();
  if (retry) retryRun(root, id, { stage: 'build', reason: retry });
  if (ledger) appendFileSync(join(root, 'docs/context/error-ledger.md'), ledger(id));
  const state = readRun(root, id);
  const result = finishRun(root, id, { summary: `${goal} is done.`, criterionEvidence: { c1: 'checks passed' }, assessment: { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') } });
  assert.equal(result.finished, true, JSON.stringify(result));
  return id;
}
function twoRuns(root) {
  const first = completeRun(root, { goal: 'Persist orders as text.', edit: () => put(root, 'src/orders/order.txt', 'v2') });
  const second = completeRun(root, { goal: 'Fix the order count after reload.', playbook: 'bug-fix', edit: () => put(root, 'src/orders/order.txt', 'v3'), retry: 'The first fix hid finished orders with a filter the count did not share.', ledger: id => `## ERR-001 · resolved · Count drifted from the list\n\n- Evidence: run ${id}\n` });
  return { first, second };
}
function run(root, args) {
  if (args[0] === 'context' && args[1] === 'review' && args.includes('--write') && !args.includes('--update-run')) args = [...args, '--update-run', updateRun(root, args.includes('--new') ? args[args.indexOf('--new') + 1] : undefined)];
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8' });
  return { ...result, data: JSON.parse(result.stdout || result.stderr) };
}
function treeBytes(root) {
  return readdirSync(root, { withFileTypes: true }).filter(entry => entry.name !== '.cyc').flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? [[path, null], ...treeBytes(path)] : [[path, readFileSync(path).toString('base64')]];
  }).sort(([a], [b]) => a.localeCompare(b));
}
const sha = (root, id, path) => readRun(root, id).handoffs.findLast(h => h.stage === 'deliver').artifacts.find(a => a.path === path).sha256;

// These older backlog fixtures intentionally contain incomplete historical runs.
// Writes now happen inside a separate authorized update, never in their receipt.
function updateRun(root, newDoc) {
  const names = [...new Set([...contextTools.lintContext(root, { git: false }).docs.map(d => d.path), ...(newDoc ? [`docs/context/${newDoc}.md`] : [])])];
  return live.startRun(root, { goal: 'Repair retained historical context.', playbook: 'feature', executionMode: 'standalone', allowedPaths: ['docs/context'], contextRetention: { disposition: 'required', features: names.map(doc => ({ id: doc.split('/').at(-1).slice(0, -3), doc, paths: [] })) } }).runId;
}
function reviewContext(root, options = {}) { return actualReviewContext(root, options.write && !options.updateRun ? { ...options, updateRun: updateRun(root, options.newDoc) } : options); }

test('context review maps two completed runs to one component and proposes both entries with their evidence, read-only', t => {
  const root = fixture(t);
  const { first, second } = twoRuns(root);
  const before = treeBytes(root);
  const result = run(root, ['context', 'review']);
  assert.equal(result.status, 0, result.stderr);
  const { data } = result;
  assert.deepEqual(data.runs.map(r => r.runId), [first, second], 'oldest first, every unrecorded completed run');
  for (const [proposal, id] of [[data.runs[0], first], [data.runs[1], second]]) {
    const orders = proposal.components.find(c => c.component === 'Orders');
    assert.ok(orders, 'the changed file maps to the Orders row');
    assert.equal(orders.writable, true);
    assert.equal(orders.touched, false);
    assert.equal(orders.shouldHaveBeenTouched, true, 'the run did not update its component doc');
    assert.deepEqual(orders.files, [{ path: 'src/orders/order.txt', sha256: sha(root, id, 'src/orders/order.txt') }], 'files carry the final handoff hashes');
    assert.match(orders.entry, new RegExp(`^### \\d{4}-\\d{2}-\\d{2} · run ${id} · `));
    assert.match(orders.entry, /\*\*Decisive check:\*\* No test proof \(exempt\): .*Checks: checks passed \(exit 0\)\./);
    assert.match(orders.entry, new RegExp(`\\*\\*Files:\\*\\* src/orders/order\\.txt@sha256:${sha(root, id, 'src/orders/order.txt').slice(0, 12)}$`, 'm'));
    assert.ok(!proposal.components.some(c => c.component === 'Billing'), 'an untouched component is not proposed');
  }
  assert.match(data.runs[0].components[0].entry, /\*\*Learned:\*\* No reusable learning recorded for this run\./, 'a run without learning says so instead of inventing it');
  const lessons = data.runs[1].lessons;
  assert.ok(lessons.some(l => l.startsWith('Synthetic failures represented')), 'the error history reason becomes a lesson');
  assert.ok(lessons.some(l => l.startsWith('Retry: The first fix hid finished orders')), 'retry reasons become lessons');
  assert.ok(lessons.some(l => l === 'Ledger ERR-001: resolved · Count drifted from the list'), 'ledger entries naming the run become lessons');
  assert.deepEqual(data.runs[1].ledgerEntries.map(e => e.id), ['ERR-001']);
  assert.equal(data.written, null);
  assert.deepEqual(treeBytes(root), before, 'review without --write changes no project file');
});

test('context review --write appends the entries newest first, refreshes the index, lints clean, and is idempotent', t => {
  const root = fixture(t);
  const { first, second } = twoRuns(root);
  const result = run(root, ['context', 'review', '--write']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.data.written.map(w => [w.doc, w.runId, w.written]), [['docs/context/orders.md', first, true], ['docs/context/orders.md', second, true]]);
  assert.equal(result.data.lint.ok, true, JSON.stringify(result.data.lint));
  const doc = readFileSync(join(root, 'docs/context/orders.md'), 'utf8');
  const parsed = parseDoc(doc, 'orders.md');
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.history.map(e => e.run), [second, first], 'newest first');
  assert.equal(parsed.lastChange.run, second);
  assert.deepEqual(parsed.lastChange.files, ['src/orders/order.txt']);
  assert.equal(parsed.history[0].files[0].hash, `sha256:${sha(root, second, 'src/orders/order.txt').slice(0, 12)}`);
  assert.equal(parsed.lessons.length, 3, 'the bug fix contributed three lessons, the feature none');
  assert.ok(parsed.lessons.every(l => l.source === `run ${second.slice(0, 8)}`));
  assert.match(doc, /## Current view\n\nOrders are persisted as text; the count derives from the same list\.\n/, 'the Current view is untouched');
  const index = readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8');
  const row = index.split('\n').find(line => line.includes('[Orders](orders.md)'));
  assert.match(row, new RegExp(`\\| \\d{4}-\\d{2}-\\d{2} · run ${second.slice(0, 8)} · Fix the order count after reload\\. \\| 3 · latest: Synthetic failures`));
  assert.match(index, /\| Billing \| src\/billing\/\*\* \| \[Billing\]\(\.\.\/billing\.md\) \| reference row \| reference row \|/, 'reference rows are kept as written');
  const again = run(root, ['context', 'review', '--write']);
  assert.equal(again.status, 0);
  assert.deepEqual(again.data.runs, [], 'both runs are now recorded in a doc');
  assert.equal(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), doc, 'a second write adds nothing');
  const forced = run(root, ['context', 'review', '--run', first, '--write']);
  assert.equal(forced.data.runs[0].components[0].alreadyRecorded, true);
  assert.deepEqual(forced.data.written, [], 'a recorded run is not written twice');
  assert.equal(lintContext(root, { git: false }).ok, true);
});

test('--new creates a doc for unmapped files, with its placeholder reported, and an index row', t => {
  const root = fixture(t);
  const id = completeRun(root, { goal: 'Round bills.', edit: () => put(root, 'src/billing/bill.txt', 'v2') });
  const dry = run(root, ['context', 'review', '--run', id]);
  assert.deepEqual(dry.data.unmappedFiles, [], 'the billing reference row covers the file');
  assert.equal(dry.data.runs[0].components[0].writable, false, 'a reference row is matched but not writable');
  put(root, 'src/shipping/ship.txt', 'v1');
  const shipped = completeRun(root, { goal: 'Ship orders.', edit: () => put(root, 'src/shipping/ship.txt', 'v2') });
  const proposal = run(root, ['context', 'review', '--run', shipped, '--new', 'shipping']);
  assert.deepEqual(proposal.data.unmappedFiles.map(f => f.path), ['src/shipping/ship.txt']);
  assert.equal(proposal.data.runs[0].newDoc.path, 'docs/context/shipping.md');
  assert.equal(proposal.data.runs[0].newDoc.exists, false);
  const written = run(root, ['context', 'review', '--run', shipped, '--new', 'shipping', '--write']);
  assert.deepEqual(written.data.written, [{ doc: 'docs/context/shipping.md', runId: shipped, written: true, created: true }]);
  const parsed = parseDoc(readFileSync(join(root, 'docs/context/shipping.md'), 'utf8'), 'shipping.md');
  assert.deepEqual(parsed.covers, ['src/shipping/ship.txt']);
  assert.deepEqual(parsed.history.map(e => e.run), [shipped]);
  assert.deepEqual(parsed.issues.map(i => i.rule), ['current-view'], 'the template placeholder is reported until someone writes the view');
  assert.deepEqual(written.data.lint.docs.map(d => d.path), ['docs/context/shipping.md']);
  assert.match(readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8'), /\| Shipping \| src\/shipping\/ship\.txt \| \[Shipping\]\(shipping\.md\) \| \d{4}-\d{2}-\d{2} · run /);
  assert.equal(run(root, ['context', 'review', '--new', 'Bad_Name']).status, 1);
});

test('the Deliver handoff records the context docs the change touched and review.md prints them', t => {
  const root = fixture(t);
  const touched = completeRun(root, { goal: 'Document the count rule.', edit: () => { put(root, 'src/orders/order.txt', 'v2'); appendFileSync(join(root, 'docs/context/orders.md'), ''); writeFileSync(join(root, 'docs/context/orders.md'), validDoc().replace('same list.', 'same list; see count().')); } });
  const untouched = completeRun(root, { goal: 'Tweak order text.', edit: () => put(root, 'src/orders/order.txt', 'v3') });
  const deliverOf = id => readRun(root, id).handoffs.findLast(h => h.stage === 'deliver');
  assert.deepEqual(deliverOf(touched).contextDocs, ['docs/context/orders.md']);
  assert.deepEqual(deliverOf(untouched).contextDocs, []);
  assert.match(readFileSync(join(root, `.cyc/runs/${touched}/review.md`), 'utf8'), /- Context docs touched: docs\/context\/orders\.md\. Historical catch-up requires a new scoped update: cyc context review --run /);
  assert.match(readFileSync(join(root, `.cyc/runs/${untouched}/review.md`), 'utf8'), /- Context docs touched: none\./);
  const review = reviewContext(root, { all: true });
  const byRun = Object.fromEntries(review.runs.map(r => [r.runId, r.components.find(c => c.component === 'Orders')]));
  assert.equal(byRun[touched].touched, true);
  assert.equal(byRun[touched].shouldHaveBeenTouched, false);
  assert.deepEqual(review.runs.find(r => r.runId === touched).contextDocsTouched, ['docs/context/orders.md']);
  assert.equal(byRun[untouched].shouldHaveBeenTouched, true);
});

test('every structure rule is rejected by name and a valid doc passes', t => {
  const good = validDoc();
  assert.deepEqual(parseDoc(good, 'orders.md').issues, []);
  const cases = {
    name: [good, 'Orders.md'],
    title: [good.replace('# Orders', 'Orders'), 'orders.md'],
    covers: [good.replace('Covers: src/orders/**', 'Covers: ../outside/**'), 'orders.md'],
    'last-change': [good.replace('Last changed by AI: none recorded', 'Last changed by AI: yesterday'), 'orders.md'],
    sections: [good.replace('## Lessons\n\n## History', '## History\n\n## Lessons'), 'orders.md'],
    'current-view': [good.replace('Orders are persisted as text; the count derives from the same list.', '<Write the view here.>'), 'orders.md'],
    'lesson-dated': [good.replace('## Lessons\n', '## Lessons\n\n- Counts drift when two filters exist.\n'), 'orders.md'],
    'history-entry': [good + '\n### Added the count\n**Files:** src/orders/order.txt@sha256:0123456789ab\n', 'orders.md'],
    evidence: [good + '\n### 2026-11-01 · run abcd1234 · Added the count\n**Changed:** count.\n', 'orders.md'],
    'last-change-current': [good + '\n### 2026-11-01 · run abcd1234 · Added the count\n**Files:** src/orders/order.txt@sha256:0123456789ab\n', 'orders.md'],
    size: [good + '\n### 2026-11-01 · run abcd1234 · Big\n**Files:** a@0123456\n' + '\n'.repeat(300), 'orders.md']
  };
  for (const [rule, [source, name]] of Object.entries(cases)) {
    const issues = parseDoc(source, name).issues;
    assert.ok(issues.some(i => i.rule === rule), `${rule}: expected it among ${JSON.stringify(issues)}`);
    assert.ok(rule in rules, `${rule} is documented`);
  }
  const twoH1 = parseDoc(good + '\n# Another component\n', 'orders.md').issues;
  assert.ok(twoH1.some(i => i.rule === 'title' && /found 2/.test(i.message)), 'one component per file');
  const notNewestFirst = good + '\n### 2026-10-01 · run aaaa1 · Old\n**Files:** a@0123456\n\n### 2026-11-01 · run bbbb2 · New\n**Files:** a@0123456\n';
  assert.ok(parseDoc(notNewestFirst.replace('none recorded', '2026-10-01 · run aaaa1 · files: a'), 'orders.md').issues.some(i => i.rule === 'history-entry' && /newest first/.test(i.message)));
  assert.ok(parseDoc(good + '\n### 2026-11-01 · run a1 · Short id\n**Files:** a@0123456\n', 'orders.md').issues.some(i => i.rule === 'history-entry' && /Unreadable entry heading/.test(i.message)), 'a run id needs at least four characters');
  const root = fixture(t, { doc: cases['lesson-dated'][0] });
  const result = run(root, ['context', 'lint', '--doc', 'docs/context/orders.md']);
  assert.equal(result.status, 1, 'a failing lint exits 1');
  assert.deepEqual(result.data.docs[0].issues.map(i => i.rule), ['lesson-dated']);
  assert.equal(result.data.docs[0].issues[0].line, 13);
});

test('index rows are checked against their docs: columns, links, coverage, last change, lessons, one row per doc', t => {
  const root = fixture(t, { index: validIndex('| Orders | src/orders/** | [Orders](orders.md) | 2026-01-01 · run deadbeef · Old | 4 · latest: none |\n| Ghost | src/ghost/** | [Ghost](ghost.md) | none recorded | none |\n| Orders again | src/orders/** | [Orders](orders.md) | none recorded | none |') });
  put(root, 'docs/context/billing-rules.md', validDoc('Billing rules', 'src/billing/**'));
  const result = lintContext(root, { git: false });
  assert.equal(result.ok, false);
  const rulesHit = result.index.issues.map(i => i.rule).sort();
  assert.deepEqual(rulesHit, ['toc-last-change', 'toc-lessons', 'toc-link', 'toc-unindexed', 'toc-unindexed']);
  assert.ok(result.index.issues.some(i => i.rule === 'toc-unindexed' && /billing-rules\.md has no index row/.test(i.message)));
  assert.ok(result.index.issues.some(i => i.rule === 'toc-unindexed' && /more than one row/.test(i.message)));
  put(root, 'docs/context/INDEX.md', validIndex('| Orders | src/orders/**, src/legacy/** | [Orders](orders.md) | none recorded | none |\n| Billing rules | src/billing/** | [Billing rules](billing-rules.md) | none recorded | none |'));
  assert.deepEqual(lintContext(root, { git: false }).index.issues.map(i => i.rule), ['toc-covers']);
  put(root, 'docs/context/INDEX.md', '# Index\n\n| Area | Covers | Record |\n| --- | --- | --- |\n| Orders | src/orders/** | [Orders](orders.md) |\n| Billing rules | src/billing/** | [Billing rules](billing-rules.md) |\n');
  const old = lintContext(root, { git: false });
  assert.deepEqual(old.index.issues.map(i => [i.rule, i.message]), [['toc-columns', 'Missing column last ai change.'], ['toc-columns', 'Missing column lessons.']], 'an older index is accepted by investigate but told what it lacks');
  const id = completeRun(root, { goal: 'Persist orders.', edit: () => put(root, 'src/orders/order.txt', 'v2') });
  const written = reviewContext(root, { run: id, write: true });
  assert.equal(written.lint.ok, true);
  assert.deepEqual(written.indexRefreshed, { addedColumns: ['Last AI change', 'Lessons'], addedRows: 0 });
  assert.match(readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8'), /^\| Area \| Covers \| Record \| Last AI change \| Lessons \|$/m, '--write adds the two columns to an older index');
  const missingIndex = fixture(t, { index: null });
  assert.deepEqual(lintContext(missingIndex, { git: false }).index.issues.map(i => i.rule), ['toc-unindexed']);
});

test('--write refuses a doc without the layout and names what to fix; review refuses an unfinished run', t => {
  const root = fixture(t, { doc: '# Orders\n\nFree-form notes about orders.\n' });
  const id = completeRun(root, { goal: 'Persist orders.', edit: () => put(root, 'src/orders/order.txt', 'v2') });
  const before = readFileSync(join(root, 'docs/context/orders.md'), 'utf8');
  const result = run(root, ['context', 'review', '--run', id, '--write']);
  assert.equal(result.status, 0, JSON.stringify(result.data));
  assert.equal(result.data.written[0].written, false);
  assert.match(result.data.written[0].reason, /^Fix first: last-change \(Missing "Last changed by AI:" line\.\); sections \(Found sections: none\.\)/);
  assert.equal(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), before, 'nothing was written to the nonconforming doc');
  const running = startRun(root, { goal: 'Still running.', playbook: 'feature', criteria: [{ id: 'c1', description: 'x' }], allowedPaths: ['src'] }).runId;
  const refused = run(root, ['context', 'review', '--run', running]);
  assert.equal(refused.status, 1);
  assert.match(refused.data.error, /is running; context proposals come from completed runs/);
  assert.equal(run(root, ['context', 'frobnicate']).status, 1);
  assert.equal(run(root, ['context', 'review', '--since', 'last week']).status, 1);
  assert.equal(run(root, ['run', 'status', '--write']).status, 1, '--write belongs to context only');
});

test('a stale index entry is detected against git, and committing the doc makes it fresh again', { skip: !hasGit && 'git is not installed' }, t => {
  const root = fixture(t);
  const git = (args, env = {}) => { const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'f@example.com', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'f@example.com', ...env } }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git(['init', '-q']);
  git(['add', '.']);
  git(['commit', '-q', '-m', 'Doc and source together'], { GIT_COMMITTER_DATE: '2026-10-01T10:00:00Z', GIT_AUTHOR_DATE: '2026-10-01T10:00:00Z' });
  assert.equal(lintContext(root).index.freshness[0].status, 'fresh', 'same commit is fresh');
  put(root, 'src/orders/order.txt', 'v2');
  assert.equal(lintContext(root).index.freshness[0].status, 'dirty', 'an uncommitted covered edit is dirty, not stale');
  git(['add', '.']);
  // Same second as the first commit on purpose: ancestry, not the timestamp, decides.
  git(['commit', '-q', '-m', 'Change the order format'], { GIT_COMMITTER_DATE: '2026-10-01T10:00:00Z', GIT_AUTHOR_DATE: '2026-10-01T10:00:00Z' });
  const stale = lintContext(root);
  assert.equal(stale.ok, false);
  const issue = stale.index.issues.find(i => i.rule === 'stale-against-git');
  assert.ok(issue, JSON.stringify(stale.index.issues));
  assert.match(issue.message, new RegExp(`^docs/context/orders\\.md: ${git(['rev-parse', '--short=7', 'HEAD'])} \\(2026-10-01, Change the order format\\) touched covered paths after the doc's last commit`));
  assert.equal(stale.index.freshness[0].coveredCommit.commit, git(['rev-parse', 'HEAD']));
  const cliResult = run(root, ['context', 'lint']);
  assert.equal(cliResult.status, 1);
  put(root, 'docs/context/orders.md', validDoc().replace('same list.', 'same list; the format is v2.'));
  git(['add', '.']);
  git(['commit', '-q', '-m', 'Update the orders doc'], { GIT_COMMITTER_DATE: '2026-10-02T10:00:00Z', GIT_AUTHOR_DATE: '2026-10-02T10:00:00Z' });
  const fresh = lintContext(root);
  assert.equal(fresh.ok, true, JSON.stringify(fresh.index.issues));
  assert.equal(fresh.index.freshness[0].status, 'fresh');
  const plain = fixture(t);
  assert.equal(lintContext(plain).index.freshness[0].status, 'unknown', 'without git, freshness is not compared');
});

test('context measure counts the index path against every doc and the run records without claiming savings', t => {
  const root = fixture(t);
  put(root, 'docs/context/billing-rules.md', validDoc('Billing rules', 'src/billing/**'));
  put(root, 'docs/context/INDEX.md', validIndex('| Orders | src/orders/** | [Orders](orders.md) | none recorded | none |\n| Billing rules | src/billing/** | [Billing rules](billing-rules.md) | none recorded | none |'));
  const id = completeRun(root, { goal: 'Persist orders.', edit: () => put(root, 'src/orders/order.txt', 'v2') });
  const chars = name => [...readFileSync(join(root, 'docs/context', name), 'utf8').replaceAll('\r\n', '\n')].length;
  const result = run(root, ['context', 'measure', '--path', 'src/orders/order.txt']);
  assert.equal(result.status, 0, result.stderr);
  const { data } = result;
  assert.deepEqual(data.tocPath.files.map(f => f.path), ['docs/context/INDEX.md', 'docs/context/orders.md']);
  assert.equal(data.tocPath.chars, chars('INDEX.md') + chars('orders.md'));
  assert.equal(data.tocPath.approxTokens, Math.round(data.tocPath.chars / 4));
  assert.equal(data.allDocs.files, 4, 'INDEX, ledger and both component docs');
  assert.equal(data.allDocs.chars, chars('INDEX.md') + chars('orders.md') + chars('billing-rules.md') + chars('error-ledger.md'));
  assert.equal(data.runRecords.runs, 1);
  assert.equal(data.runRecords.chars, [...readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8')].length + [...readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8').replaceAll('\r\n', '\n')].length);
  assert.match(data.note, /no tokenizer was run/);
  assert.match(data.note, /not evidence that the next task succeeds/);
  const byRun = measureContext(root, { run: id });
  assert.deepEqual(byRun.paths, ['src/orders/order.txt'], 'the run supplies its changed paths');
  assert.throws(() => measureContext(root, { paths: ['../outside'] }), /canonical/);
});

test('the entry skill reads the index first and the context method states the rules, without claiming savings as fact', () => {
  const entry = readFileSync(join(repo, 'skills/cyc/SKILL.md'), 'utf8');
  assert.match(entry, /Read the project's context index first, `docs\/context\/INDEX\.md`, and then only the component docs whose Covers match/);
  assert.match(entry, /Completed-run catch-up needs a new scoped update/);
  const method = readFileSync(join(repo, 'methods/cyc-context/SKILL.md'), 'utf8');
  assert.match(method, /Read the target index, then matched records/);
  for (const rule of Object.keys(rules)) assert.ok(method.includes(`\`${rule}\``) || method.includes(`(${rule}`), `the method names rule ${rule}`);
  assert.match(method, /not provider usage, savings or successful reuse/);
  assert.doesNotMatch(method, /saves \d|\d+% fewer tokens|reduces tokens by/);
});

test('context measurement counts every discovered local link once and excludes unrelated or unsafe documents', t => {
  const root = fixture(t, { index: validIndex('| Orders | src/orders/** | [Orders](orders.md), [Billing](../billing.md#rules), [Again](../billing.md), [Missing](missing.md), [Web](https://example.invalid/doc), [Here](#section), [Index](INDEX.md) | none recorded | none |\n| Unrelated | src/billing/** | [Private](../unrelated.md) | reference row | reference row |') });
  put(root, 'docs/unrelated.md', 'Not relevant to orders.');
  const paths = ['src/orders/order.txt'];
  const discovered = investigateProject(root, { paths });
  const expected = [...new Set(['docs/context/INDEX.md', ...discovered.contexts.flatMap(c => c.records.filter(r => r.exists).map(r => r.path))])].sort();
  const before = treeBytes(root);
  const measured = measureContext(root, { paths });
  assert.deepEqual(measured.tocPath.files.map(f => f.path).sort(), expected, 'all local links returned by discovery are counted once, including the index');
  assert.equal(measured.tocPath.chars, expected.reduce((total, path) => total + [...readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n')].length, 0));
  assert.ok(!measured.tocPath.files.some(f => f.path.includes('unrelated') || f.path.includes('missing')));
  assert.deepEqual(treeBytes(root), before, 'measurement stays read-only');
  put(root, 'docs/context/INDEX.md', validIndex('| Orders | src/orders/** | [Orders](orders.md), [Escape](../../../outside.md) | none recorded | none |'));
  assert.throws(() => measureContext(root, { paths }), /canonical/, 'a later link cannot escape the project');
});

function recordOneComponent(root, id, path = 'docs/context/orders.md') {
  const proposal = reviewContext(root, { run: id }).runs[0];
  const component = proposal.components.find(c => c.doc === path);
  put(root, path, applyEntry(readFileSync(join(root, path), 'utf8'), { entry: component.entry, lessons: component.lessons, lastChange: `Last changed by AI: ${proposal.date} · run ${id} · files: ${component.files.map(f => f.path).join(', ')}` }));
}

test('batch context review retains a partially recorded run and writes only the missing component', t => {
  const root = fixture(t, { index: validIndex('| Orders | src/orders/** | [Orders](orders.md) | none recorded | none |\n| Order access | src/orders/** | [Access](access.md) | none recorded | none |') });
  put(root, 'docs/context/access.md', validDoc('Order access'));
  const id = completeRun(root, { goal: 'Keep order access consistent.', edit: () => put(root, 'src/orders/order.txt', 'v2') });
  recordOneComponent(root, id);
  const original = readFileSync(join(root, 'docs/context/orders.md'), 'utf8');
  const before = treeBytes(root);
  const pending = run(root, ['context', 'review']);
  assert.equal(pending.status, 0, pending.stderr);
  assert.deepEqual(pending.data.runs.map(r => r.runId), [id], 'one recorded component cannot hide another component');
  assert.deepEqual(pending.data.runs[0].components.map(c => [c.doc, c.alreadyRecorded]), [['docs/context/orders.md', true], ['docs/context/access.md', false]]);
  assert.deepEqual(treeBytes(root), before, 'proposal does not write');
  assert.deepEqual(reviewContext(root, { since: '2099-01-01' }).runs, [], 'date filtering still applies');
  const written = reviewContext(root, { write: true });
  assert.deepEqual(written.written.map(w => w.doc), ['docs/context/access.md']);
  assert.equal(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), original, 'existing component history is never duplicated or rewritten');
  assert.equal(written.lint.ok, true, JSON.stringify(written.lint));
  assert.deepEqual(reviewContext(root).runs, [], 'fully recorded runs leave the default backlog');
  assert.equal(reviewContext(root, { all: true }).runs.length, 1, '--all keeps the explicit diagnostic view');
  assert.deepEqual(reviewContext(root, { write: true }).written, [], 'repeating the write is idempotent');
});

test('batch context review keeps unmapped files and preserves newer history while catching up older entries', t => {
  const root = fixture(t, { index: validIndex('| Orders | src/orders/** | [Orders](orders.md) | none recorded | none |\n| Order access | src/orders/** | [Access](access.md) | none recorded | none |') });
  const newer = '2099-01-01 · run future-run';
  put(root, 'docs/context/access.md', validDoc('Order access').replace('Last changed by AI: none recorded', `Last changed by AI: ${newer} · files: src/orders/order.txt`).replace('## Lessons\n', '## Lessons\n\n- 2099-01-01 · run future-run: Later constraint.\n').replace('## History\n', `## History\n\n### ${newer} · Later change\n**Files:** src/orders/order.txt@abcdef1\n`));
  const id = completeRun(root, { goal: 'Keep cross-component knowledge.', retry: 'An older failed attempt must remain below later lessons.', edit: () => { put(root, 'src/orders/order.txt', 'v2'); put(root, 'src/new-area/value.txt', 'v2'); } });
  recordOneComponent(root, id);
  const pending = reviewContext(root);
  assert.deepEqual(pending.unmappedFiles, [{ path: 'src/new-area/value.txt', runs: [id] }]);
  const written = reviewContext(root, { write: true, newDoc: 'new-area' });
  const access = parseDoc(readFileSync(join(root, 'docs/context/access.md'), 'utf8'), 'access.md');
  assert.deepEqual(access.history.map(h => h.run), ['future-run', id], 'catch-up entries do not become the newest history');
  assert.equal(access.lastChange.run, 'future-run');
  assert.equal(access.lessons[0].source, 'run future-run');
  assert.ok(written.written.some(w => w.doc === 'docs/context/new-area.md' && w.created));
  assert.deepEqual(reviewContext(root).runs, [], 'the new component resolves the unmapped backlog');
  // A run still needs a proposal when its only missing context is an unmapped file.
  rmSync(join(root, 'docs/context/new-area.md'));
  put(root, 'docs/context/INDEX.md', validIndex('| Orders | src/orders/** | [Orders](orders.md) | none recorded | none |\n| Order access | src/orders/** | [Access](access.md) | none recorded | none |'));
  assert.deepEqual(reviewContext(root).runs.map(r => r.runId), [id]);
});

test('installed context discovery works for a fresh user and a teammate without private run history', t => {
  const root = fixture(t);
  const config = readFileSync(join(root, '.cyc/config.json'));
  rmSync(join(root, '.cyc/config.json'));
  assert.equal(installProject(root, { hosts: ['codex'] }).ok, true);
  put(root, '.cyc/config.json', config);
  put(root, 'docs/billing.md', 'Orders must use the existing server permission rules. Preserve this boundary.');
  put(root, 'docs/context/INDEX.md', validIndex('| Orders | src/orders/** | [Orders](orders.md), [Permission boundary](../billing.md) | none recorded | none |'));
  const installedCli = join(root, '.cyc/engine/bin/cyc.mjs');
  const invoke = (project, action) => {
    const result = spawnSync(process.execPath, [join(project, '.cyc/engine/bin/cyc.mjs'), action, ...(action === 'context' ? ['measure'] : []), '--project', project, '--path', 'src/orders/order.txt'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const first = invoke(root, 'investigate');
  assert.deepEqual(first.contexts[0].records.map(r => r.path), ['docs/context/orders.md', 'docs/billing.md']);
  assert.equal(invoke(root, 'context').tocPath.files.length, 3, 'installed engine counts both shared docs and index');
  put(root, '.cyc/runs/private/history.txt', 'Original conversation and private diagnostic history.');
  const teammate = fixture(t, { index: null, doc: null });
  cpSync(root, teammate, { recursive: true, filter: path => !['.cyc/runs', '.cyc/runtime'].some(p => path === join(root, p) || path.startsWith(join(root, p) + '/')) });
  rmSync(join(teammate, '.cyc/runs'), { recursive: true, force: true });
  rmSync(join(teammate, '.cyc/runtime'), { recursive: true, force: true });
  const next = invoke(teammate, 'investigate');
  assert.deepEqual(next.contexts, first.contexts, 'the teammate resolves the same shared knowledge without private records');
  assert.match(readFileSync(join(teammate, next.contexts[0].records[1].path), 'utf8'), /server permission rules/);
  assert.equal(invoke(teammate, 'context').tocPath.files.length, 3);
  const setup = spawnSync(process.execPath, [installedCli, 'onboard', '--project', root, '--host', 'codex', '--session', 'fixture-fresh-session'], { encoding: 'utf8' });
  const host = JSON.parse(setup.stdout).steps.find(s => s.id === 'host');
  assert.equal(host.reason, 'prompt-not-observed', 'installed files alone must not claim live activation');
  assert.equal(host.canStartTask, false);
});

// Current retention contract: real API, not the historical fixture constructor above.
const retainedView = 'Orders expose the persisted text through src/orders/order.txt. The local adapter owns the value and the checks read that same source; this fixture has no remote service or authentication claim. The configured check guards controller integration only, not a production order system. Review the current source and run node --test for independent behavior assertions; local run receipts do not travel with a source-only copy.';
function currentFeature(t, extra = {}, opts = {}) {
  const root = fixture(t, { index: null, doc: null, ...opts });
  const id = live.startRun(root, { goal: 'Persist orders for the next task.', playbook: 'feature', criteria: [{ id: 'c1', description: 'Persist the fixture order value.' }], executionMode: 'standalone', allowedPaths: ['src/orders'], contextRetention: { version: 1, disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.txt'] }] }, ...extra }).runId;
  live.quickHandoff(root, id, { summary: 'Read existing order storage and planned target context.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  put(root, 'src/orders/order.txt', 'v2');
  const state = live.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Retain the actual fixture storage boundary, checks and local-only limitations.', artifacts: ['docs/context/orders.md'] };
  const input = { summary: 'Order fixture updates its persisted text; no production-service claim.', criterionEvidence: { c1: 'Configured fixture check and retained-context assertions.' }, assessment };
  return { root, id, input };
}
test('retention: default old-shaped feature input cannot complete without canonical context', t => {
  const root = fixture(t, { index: null, doc: null });
  const id = live.startRun(root, { goal: 'Add order state.', playbook: 'feature', allowedPaths: ['src'] }).runId;
  assert.equal(live.readRun(root, id).contextRetention.version, 1);
  live.quickHandoff(root, id, { summary: 'Read source.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') }); put(root, 'src/orders/order.txt', 'v2');
  const state = live.readRun(root, id);
  assert.throws(() => live.finishRun(root, id, { summary: 'A feature cannot discard retained knowledge.', passedEvidence: 'Fixture checks.', assessment: { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') } }), /feature context|learning/);
  assert.notEqual(live.readRun(root, id).status, 'complete');
  const feature = live.readRun(root, id).contextRetention.features[0], assessment = { ...fixtureAssessment(live.readRun(root, id), 'verify'), ...fixtureAssessment(live.readRun(root, id), 'deliver') };
  assessment.learning = { status: 'recorded', reason: 'Retain focused order knowledge from the inferred directory scope.', artifacts: [feature.doc], context: [{ id: feature.id, currentView: retainedView }] };
  assert.equal(live.finishRun(root, id, { summary: 'The inferred order record owns actual changed files.', passedEvidence: 'Isolated controller gate checks.', assessment }).finished, true);
  const generated = parseDoc(readFileSync(join(root, feature.doc), 'utf8'), feature.doc.split('/').at(-1));
  assert.deepEqual(generated.covers, ['src/orders/order.txt'], 'broad edit permission does not become a catch-all or unrelated billing mapping');
});
test('retention: normal finish scaffolds target records, rejects placeholders, then completes before stable verification', t => {
  const { root, id, input } = currentFeature(t);
  const planned = live.readRun(root, id);
  assert(planned.allowedPaths.includes('docs/context/orders.md')); assert(planned.allowedPaths.includes('docs/context/INDEX.md'));
  const first = live.finishRun(root, id, structuredClone(input));
  assert.equal(first.status, 'needs-context', JSON.stringify(first)); assert.equal(first.finished, false); assert.equal(live.readRun(root, id).verification, null);
  assert.equal(lintContext(root, { git: false }).ok, false);
  input.assessment.learning.context = [{ id: 'orders', currentView: retainedView }];
  const second = live.finishRun(root, id, input); assert.equal(second.finished, true, JSON.stringify(second));
  const state = live.readRun(root, id);
  assert.deepEqual(state.handoffs.at(-1).contextDocs, ['docs/context/orders.md']);
  assert.equal(lintContext(root, { git: false }).ok, true);
  assert.equal(parseDoc(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), 'orders.md').history.filter(h => h.run === id).length, 1);
  assert.equal(state.verification.sourceHash, state.handoffs.at(-1).sourceHash);
  const found = investigateProject(root, { paths: ['src/orders/order.txt'] }); assert(found.contexts.some(c => c.records.some(r => r.path === 'docs/context/orders.md')));
});
test('retention: learning recorded cannot conceal the audited missing History mismatch', t => {
  const bad = validDoc().replace('Last changed by AI: none recorded', 'Last changed by AI: 2026-11-04 · run ed2b9913-a853-46b9-82da-3da9fe989c7f · files: src/orders/order.txt');
  const { root, id, input } = currentFeature(t, {}, { doc: bad, index: validIndex('| Orders | src/orders/** | [Orders](orders.md) | 2026-11-04 · run ed2b9913 | none |') });
  assert(lintContext(root, { git: false }).docs[0].issues.some(i => i.rule === 'last-change-current') || !parseDoc(bad, 'orders.md').history.length);
  input.assessment.learning.context = [{ id: 'orders', currentView: retainedView }];
  assert.throws(() => live.finishRun(root, id, input), /metadata\/history|older run|incomplete/);
  assert.notEqual(live.readRun(root, id).status, 'complete');
});

test('retention: focused records reject missing links, mappings, placeholders and inconsistent metadata before checks', t => {
  const corruptions = [
    ...['**/*', 'src/**/*', '**/*.*', 'src/**/**'].map(pattern => [`catch-all ${pattern}`, root => {
      put(root, 'docs/context/orders.md', readFileSync(join(root, 'docs/context/orders.md'), 'utf8').replace('Covers: src/orders/order.txt', `Covers: ${pattern}`));
      contextTools.refreshIndex(root, { docs: ['docs/context/orders.md'] });
    }]),
    ['new-entrypoint', root => put(root, 'src/orders/helper.mjs', 'export const helper=()=>1;')],
    ['new-stylesheet', root => put(root, 'src/orders/theme.css', 'body{color:blue}')],
    ['unindexed', (root) => fs.unlinkSync(join(root, 'docs/context/INDEX.md'))],
    ['broken-link', root => put(root, 'docs/context/INDEX.md', readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8').replace('(orders.md)', '(missing.md)'))],
    ['missing-mapping', root => put(root, 'docs/context/orders.md', readFileSync(join(root, 'docs/context/orders.md'), 'utf8').replace('Covers: src/orders/order.txt', 'Covers: src/unrelated.mjs'))],
    ['inline-placeholder', root => put(root, 'docs/context/orders.md', readFileSync(join(root, 'docs/context/orders.md'), 'utf8').replace(retainedView, 'Still unfinished: <Describe the feature contracts here>.'))],
    ['last-history', root => put(root, 'docs/context/orders.md', readFileSync(join(root, 'docs/context/orders.md'), 'utf8').replace(/^Last changed by AI:.+$/m, 'Last changed by AI: 2026-11-05 · run other-run · files: src/orders/order.txt'))]
  ];
  for (const [kind, corrupt] of corruptions) {
    const { root, id } = currentFeature(t);
    assert.equal(live.prepareRunContext(root, id, { records: [{ id: 'orders', currentView: retainedView }], summary: 'Actual fixture source inspected.' }).ok, true);
    corrupt(root);
    assert.equal(contextTools.checkRetention(root, live.readRun(root, id), live.sourceSnapshot(root).files).ok, false, kind);
    const blocked = live.verifyRun(root, id); assert.equal(blocked.status, 'needs-context', kind); assert.equal(live.readRun(root, id).verification, null);
  }
  for (const doc of ['docs/context/INDEX.md', 'docs/context/error-ledger.md', 'docs/context/verify-recipe.md', 'docs/feature-guide.md', '.cyc/runtime/handoff.md']) {
    const root = fixture(t, { index: null, doc: null });
    assert.throws(() => live.startRun(root, { goal: 'Add an order feature.', playbook: 'feature', contextRetention: { disposition: 'required', features: [{ id: 'orders', doc, paths: ['src/orders/order.txt'] }] } }), /canonical|feature/);
  }
});
test('retention: changed existing feature revalidates its record; distinct features keep separate records and unrelated docs', t => {
  const { root, id, input } = currentFeature(t);
  input.assessment.learning.context = [{ id: 'orders', currentView: retainedView }]; assert.equal(live.finishRun(root, id, input).finished, true);
  put(root, 'docs/context/unrelated.md', validDoc('Unrelated capability', 'src/unrelated/**'));
  contextTools.refreshIndex(root); const unrelated = readFileSync(join(root, 'docs/context/unrelated.md'));
  const read = fs.readFileSync;
  try {
    fs.readFileSync = (path, ...args) => { assert.notEqual(String(path), join(root, 'docs/context/unrelated.md'), 'bounded refresh must not read unrelated historical prose'); return read(path, ...args); }; syncBuiltinESMExports();
    contextTools.refreshIndex(root, { docs: ['docs/context/orders.md'] });
  } finally { fs.readFileSync = read; syncBuiltinESMExports(); }
  const nextId = live.startRun(root, { goal: 'Change the order storage contract.', playbook: 'feature', criteria: [{ id: 'c1', description: 'Stored text contract remains discoverable.' }], allowedPaths: ['src/orders', 'src/billing'], contextRetention: { disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.txt'] }, { id: 'billing', doc: 'docs/context/billing.md', paths: ['src/billing/bill.txt'] }] } }).runId;
  live.quickHandoff(root, nextId, { summary: 'Plan existing orders and distinct billing knowledge.', assessment: fixtureAssessment(live.readRun(root, nextId), 'scout') });
  put(root, 'src/orders/order.txt', 'v3'); put(root, 'src/billing/bill.txt', 'v2');
  const a = { ...fixtureAssessment(live.readRun(root, nextId), 'verify'), ...fixtureAssessment(live.readRun(root, nextId), 'deliver') };
  a.learning = { status: 'recorded', reason: 'Revalidate existing order knowledge and separately retain billing.', artifacts: ['docs/context/orders.md', 'docs/context/billing.md'] };
  const nextInput = { summary: 'Order v3 and billing v2 are isolated persistence fixtures.', passedEvidence: 'Fixture checks.', assessment: a };
  assert.equal(live.finishRun(root, nextId, structuredClone(nextInput)).status, 'needs-context', 'generated History cannot masquerade as authored contract revalidation');
  a.learning.context = [{ id: 'orders', currentView: retainedView + ' This change now retains the third fixture value.' }, { id: 'billing', currentView: 'Billing owns the text in src/billing/bill.txt and is independent of orders. Its local check has no network or payment integration; the fixture does not certify a billing service. Keep billing decisions separate, run the configured check, and inspect real integrations before reuse. Ignored receipts are local evidence only.' }];
  assert.equal(live.finishRun(root, nextId, nextInput).finished, true);
  assert.equal(parseDoc(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), 'orders.md').history.length, 2);
  assert.deepEqual(readFileSync(join(root, 'docs/context/unrelated.md')), unrelated);
  assert.deepEqual(live.readRun(root, nextId).handoffs.at(-1).contextDocs, ['docs/context/orders.md', 'docs/context/billing.md']);
});
test('retention: restrictions stay pending, routine/read-only stays proportional, and misleading routes cannot add a feature', t => {
  const { root, id, input } = currentFeature(t, { allowedPaths: ['src/orders'], contextRetention: { disposition: 'restricted', reason: 'The user explicitly forbids documentation edits.', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.txt'] }] } });
  input.assessment.learning = { status: 'none', reason: 'Required context is pending the explicit documentation restriction.', artifacts: [] };
  const before = treeBytes(root), result = live.finishRun(root, id, input);
  assert.equal(result.finished, false); assert.equal(result.retention.status, 'pending'); assert.deepEqual(treeBytes(root), before);
  const readonly = fixture(t), checkId = live.startRun(readonly, { goal: 'Verify existing fixture state.', playbook: 'verify' }).runId;
  live.quickHandoff(readonly, checkId, { summary: 'Read-only verification selected.' }); assert.equal(live.verifyRun(readonly, checkId).passed, true);
  const mislabel = fixture(t), badId = live.startRun(mislabel, { goal: 'Inspect existing state.', playbook: 'verify' }).runId;
  live.quickHandoff(mislabel, badId, { summary: 'Read-only route does not authorize feature completion.' }); put(mislabel, 'src/new-feature.mjs', 'export const added=()=>1;');
  assert.equal(live.verifyRun(mislabel, badId).status, 'needs-context');
  const routine = fixture(t); put(routine, 'src/format.mjs', 'export const n=1;\n');
  const routineId = live.startRun(routine, { goal: 'Format existing spacing only.', playbook: 'refactor', contextRetention: { disposition: 'unnecessary', routine: true, reason: 'Agent-reviewed formatting; no new capability or reusable contract changed.' } }).runId;
  put(routine, 'src/format.mjs', 'export const n = 1;\n');
  assert.equal(contextTools.checkRetention(routine, live.readRun(routine, routineId), live.sourceSnapshot(routine).files).status, 'unnecessary');
});

test('retention: changed shared entrypoints require every indexed canonical owner, including stylesheet and test owners', t => {
  for (const [owner, sharedPath, original, candidate] of [
    ['auth', 'src/auth.mjs', 'export const authorized=()=>false;', 'export const authorized=()=>true;'],
    ['styling', 'src/styles.css', 'body{color:red}', 'body{color:blue}'],
    ['contract-tests', 'test/shared-contract.test.mjs', 'export const expected=false;', 'export const expected=true;']
  ]) for (const includeShared of [false, true]) {
    const doc = `docs/context/${owner}.md`;
    const root = fixture(t, { doc: validDoc('Orders', `src/orders/order.mjs, ${sharedPath}`), index: validIndex(`| Orders | src/orders/order.mjs, ${sharedPath} | [Orders](orders.md) | none recorded | none |\n| Shared ${owner} | ${sharedPath} | [Shared](${owner}.md) | none recorded | none |`) });
    put(root, doc, validDoc(`Shared ${owner}`, sharedPath));
    put(root, 'src/orders/order.mjs', 'export const order=()=>0;'); put(root, sharedPath, original);
    const before = readFileSync(join(root, doc));
    const features = [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.mjs'] }, ...(includeShared ? [{ id: owner, doc, paths: [sharedPath] }] : [])];
    const id = live.startRun(root, { goal: 'Change order and shared contract fixtures.', playbook: 'feature', allowedPaths: ['src/orders/order.mjs', sharedPath], contextRetention: { disposition: 'required', features } }).runId;
    live.quickHandoff(root, id, { summary: 'Inspect both existing contracts.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
    put(root, 'src/orders/order.mjs', 'export const order=()=>1;'); put(root, sharedPath, candidate);
    const assessment = { ...fixtureAssessment(live.readRun(root, id), 'verify'), ...fixtureAssessment(live.readRun(root, id), 'deliver') };
    assessment.learning = { status: 'recorded', reason: 'Retain both inspected contract changes.', artifacts: features.map(f => f.doc), context: features.map(f => ({ id: f.id, currentView: `The ${f.id} fixture owns ${f.paths[0]} and is isolated from a real service. This change updates its local contract and requires its existing indexed shared record as well as order context. Run the configured check and inspect both contracts before reuse; these synthetic gate assertions do not certify production behavior or user acceptance. Detailed receipts remain local.` })) };
    const result = live.finishRun(root, id, { summary: 'Both existing contracts changed.', passedEvidence: 'Isolated gate checks.', assessment });
    if (includeShared) {
      assert.equal(result.finished, true, `${owner}: ${JSON.stringify(result)}`);
      assert.equal(parseDoc(readFileSync(join(root, doc), 'utf8'), `${owner}.md`).history[0].run, id);
    } else {
      assert.equal(result.status, 'needs-context', owner); assert.equal(result.finished, false);
      assert(result.retention.issues.some(i => i.rule === 'feature-owner' && i.message.includes(doc)), owner);
      assert.deepEqual(readFileSync(join(root, doc)), before);
      assert(!live.readRun(root, id).allowedPaths.includes(doc), 'late discovery cannot broaden the frozen plan');
      assert.equal(live.readRun(root, id).verification, null);
    }
  }
});

test('retention: advisory completion cannot hide Markdown features or source deletions behind unnecessary/routine dispositions', t => {
  for (const routine of [false, true]) for (const remove of [false, true]) {
    const root = fixture(t, { index: null, doc: null }); put(root, 'src/existing.mjs', 'export const value=1;');
    const id = live.startRun(root, { goal: 'Investigate a capability.', playbook: 'investigation', executionMode: 'standalone', allowedPaths: ['methods/new-capability', 'src/existing.mjs'], ...(routine ? { contextRetention: { disposition: 'unnecessary', routine: true, reason: 'Synthetic routine claim must not authorize adding/deleting implementation files.' } } : {}) }).runId;
    live.quickHandoff(root, id, { summary: 'Read the fixture.' });
    if (remove) fs.unlinkSync(join(root, 'src/existing.mjs')); else put(root, 'methods/new-capability/SKILL.md', '# New capability\n\nReusable implementation instructions added through an advisory route.');
    assert.throws(() => { live.quickHandoff(root, id, { summary: 'Claim advisory delivery.', passedEvidence: 'Inspected source.' }); live.completeRun(root, id); }, /context|retention/i);
    assert.notEqual(live.readRun(root, id).status, 'complete');
    assert(contextTools.checkRetention(root, live.readRun(root, id), live.sourceSnapshot(root).files).issues.some(i => i.rule === 'feature-plan'));
  }
});

test('retention: catch-up refuses advisory writers and requires the repair run history plus fresh verification', t => {
  const root = fixture(t), oldId = completeRun(root, { goal: 'Historical stored order.', edit: () => put(root, 'src/orders/order.txt', 'historical') });
  const old = readFileSync(join(root, `.cyc/runs/${oldId}/state.json`));
  const advisory = live.startRun(root, { goal: 'Investigate missing history.', playbook: 'investigation', allowedPaths: ['docs/context'] }).runId;
  live.quickHandoff(root, advisory, { summary: 'Read the old record.' }); const before = treeBytes(root);
  assert.throws(() => actualReviewContext(root, { run: oldId, write: true, updateRun: advisory }), /required feature-context plan.*executable final verification/);
  assert.deepEqual(treeBytes(root), before, 'advisory catch-up rejects before writes');
  const id = live.startRun(root, { goal: 'Retain the missing order history.', playbook: 'feature', allowedPaths: ['docs/context'], contextRetention: { disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.txt'] }] } }).runId;
  live.quickHandoff(root, id, { summary: 'Inspect actual historical evidence and canonical order record.', assessment: fixtureAssessment(live.readRun(root, id), 'scout') });
  const written = actualReviewContext(root, { run: oldId, write: true, updateRun: id }); assert.equal(written.lint.ok, true);
  assert.equal(live.verifyRun(root, id).status, 'needs-context', 'historical entry alone is not evidence of a verified repair');
  const a = { ...fixtureAssessment(live.readRun(root, id), 'verify'), ...fixtureAssessment(live.readRun(root, id), 'deliver') };
  a.learning = { status: 'recorded', reason: 'Restore actual older evidence while documenting this repair under its own run.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: retainedView }] };
  assert.equal(live.finishRun(root, id, { summary: 'Historical order evidence is retained; the repair has current provenance.', passedEvidence: 'Actual context and configured fixture checks.', assessment: a }).finished, true);
  const completed = live.readRun(root, id), parsed = parseDoc(readFileSync(join(root, 'docs/context/orders.md'), 'utf8'), 'orders.md');
  assert.equal(completed.verification.passed, true); assert.equal(parsed.history[0].run, id); assert(parsed.history.some(h => h.run === oldId));
  assert.deepEqual(readFileSync(join(root, `.cyc/runs/${oldId}/state.json`)), old);
  assert.deepEqual(completed.handoffs.at(-1).contextDocs, ['docs/context/orders.md']); assert.equal(lintContext(root, { git: false }).ok, true);
});
test('retention: paths, source freshness and conversation ownership survive context preparation', t => {
  const { root, id, input } = currentFeature(t);
  assert.throws(() => live.prepareRunContext(root, id, { records: [{ id: 'late-feature', currentView: retainedView }] }), /planned ids/);
  input.assessment.learning.context = [{ id: 'orders', currentView: retainedView }];
  assert.equal(live.prepareRunContext(root, id, { records: input.assessment.learning.context }).ok, true);
  live.quickHandoff(root, id, { summary: 'Actual feature code built.' }); assert.equal(live.verifyRun(root, id).passed, true);
  put(root, 'docs/context/orders.md', readFileSync(join(root, 'docs/context/orders.md'), 'utf8').replace(retainedView, retainedView + ' Changed after verification.'));
  assert.throws(() => live.quickHandoff(root, id, { summary: 'Old verification cannot pass new context.', passedEvidence: 'Old result.', assessment: fixtureAssessment(live.readRun(root, id), 'verify') }), /context|changed|stale/);
  assert.throws(() => live.prepareRunContext(root, id, { records: input.assessment.learning.context }), /after verification|retry/);
  const other = fixture(t), previous = process.env.CYC_SESSION; process.env.CYC_SESSION = 'retention-owner';
  try {
    const owned = live.startRun(other, { goal: 'Retain owned state.', playbook: 'feature', executionMode: 'standalone' }).runId;
    process.env.CYC_SESSION = 'foreign-retention-chat'; const before = treeBytes(other);
    assert.throws(() => live.prepareRunContext(other, owned, {}), /belongs to conversation/); assert.deepEqual(treeBytes(other), before);
  } finally { if (previous === undefined) delete process.env.CYC_SESSION; else process.env.CYC_SESSION = previous; }
  // A simulated native gate checks the same current retention contract without
  // certifying real host activation or permitting a foreign preparation.
  const native = fixture(t), keys = ['CYC_SESSION', 'CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'], saved = keys.map(key => process.env[key]);
  const owner = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', foreign = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  for (const key of [owner, foreign]) put(native, `.cyc/runtime/${key}.state.json`, JSON.stringify({ host: 'codex', token: 'simulated-retention-test', updatedAt: new Date().toISOString() }));
  try {
    keys.forEach(key => delete process.env[key]); process.env.CYC_SESSION = owner;
    const nativeId = live.startRun(native, { goal: 'Retain native order context.', playbook: 'feature', executionMode: 'native-codex', session: owner, allowedPaths: ['src/orders'], contextRetention: { disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.txt'] }] } }).runId;
    live.quickHandoff(native, nativeId, { summary: 'Inspect native fixture storage.', assessment: fixtureAssessment(live.readRun(native, nativeId), 'scout') }); put(native, 'src/orders/order.txt', 'v2');
    process.env.CYC_SESSION = foreign;
    assert.throws(() => live.prepareRunContext(native, nativeId, { records: [{ id: 'orders', currentView: retainedView }] }), /native gate|conversation/);
    process.env.CYC_SESSION = owner;
    const a = { ...fixtureAssessment(live.readRun(native, nativeId), 'verify'), ...fixtureAssessment(live.readRun(native, nativeId), 'deliver') };
    a.learning = { status: 'recorded', reason: 'Retain native fixture behavior with simulated gate provenance.', artifacts: ['docs/context/orders.md'], context: [{ id: 'orders', currentView: retainedView }] };
    const finished = live.finishRun(native, nativeId, { summary: 'Native fixture retains canonical context.', passedEvidence: 'Isolated gate assertions.', assessment: a });
    assert.equal(finished.finished, true); assert.equal(finished.packet.written, true);
    const packet = JSON.parse(readFileSync(join(native, finished.packet.path)));
    assert.equal(packet.token, 'simulated-retention-test');
    assert.deepEqual(live.readRun(native, nativeId).handoffs.at(-1).contextDocs, ['docs/context/orders.md']);
  } finally { keys.forEach((key, index) => saved[index] === undefined ? delete process.env[key] : process.env[key] = saved[index]); }
});
test('retention: interrupted multi-record preparation resumes without duplicate History or unrelated writes', t => {
  const { root, id, input } = currentFeature(t, { allowedPaths: ['src/orders', 'src/billing'], contextRetention: { disposition: 'required', features: [{ id: 'orders', doc: 'docs/context/orders.md', paths: ['src/orders/order.txt'] }, { id: 'billing', doc: 'docs/context/billing.md', paths: ['src/billing/bill.txt'] }] } });
  put(root, 'src/billing/bill.txt', 'v2');
  const records = [{ id: 'orders', currentView: retainedView }, { id: 'billing', currentView: 'Billing owns src/billing/bill.txt as a local stored text fixture. Its contract is distinct from orders and has no payment or network service. The configured check protects controller behavior only; run and inspect actual billing integrations before reuse. Local receipts do not constitute user acceptance.' }];
  const rename = fs.renameSync; let injected = false;
  fs.renameSync = (from, to) => { if (!injected && String(to).replaceAll('\\', '/').endsWith('/docs/context/billing.md')) { injected = true; throw new Error('seeded context publication failure'); } return rename(from, to); }; syncBuiltinESMExports();
  try { assert.throws(() => live.prepareRunContext(root, id, { records }), /seeded context publication/); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.equal(readFileSync(join(root, 'src/orders/order.txt'), 'utf8'), 'v2');
  assert.equal(live.prepareRunContext(root, id, { records }).ok, true);
  for (const name of ['orders', 'billing']) assert.equal(parseDoc(readFileSync(join(root, `docs/context/${name}.md`), 'utf8'), `${name}.md`).history.filter(h => h.run === id).length, 1);
  const bytes = treeBytes(root); assert.equal(live.prepareRunContext(root, id, { records }).ok, true); assert.deepEqual(treeBytes(root), bytes, 'unchanged preparation writes no new History or source');
  const name = 'docs/context/orders.md', prepared = readFileSync(join(root, name), 'utf8');
  const own = prepared.slice(prepared.indexOf('### '));
  put(root, name, prepared + '\n' + own);
  assert.equal(live.prepareRunContext(root, id, { records }).ok, true);
  assert.equal(parseDoc(readFileSync(join(root, name), 'utf8'), 'orders.md').history.filter(h => h.run === id).length, 1, 'resumption repairs duplicate active entries without changing completed history');
});
test('retention: equivalent project context and literal dynamic-route paths resolve without engine-map substitution', t => {
  const root = fixture(t, { index: null, doc: null }), cfg = JSON.parse(readFileSync(join(root, '.cyc/config.json')));
  cfg.context = { directory: 'knowledge/features' }; put(root, '.cyc/config.json', JSON.stringify(cfg));
  const route = 'src/app/api/events/[eventId]/route.ts'; put(root, route, 'export const GET=()=>"fixture";');
  const id = live.startRun(root, { goal: 'Retain a dynamic route contract.', playbook: 'feature', allowedPaths: [route], contextRetention: { disposition: 'required', features: [{ id: 'event-route', doc: 'knowledge/features/event-route.md', paths: [route] }] } }).runId;
  put(root, route, 'export const GET=()=>"updated fixture";');
  assert.equal(live.prepareRunContext(root, id, { records: [{ id: 'event-route', currentView: 'The source at src/app/api/events/[eventId]/route.ts owns this dynamic-route fixture. Brackets are literal directory characters, not character classes. This test validates discovery and byte provenance, not a running Next.js server. Inspect actual authorization and rerun framework checks before application reuse; local controller receipts are not portable validation.' }] }).ok, true);
  const found = investigateProject(root, { paths: [route] }); assert.equal(found.index.path, 'knowledge/features/INDEX.md'); assert(found.contexts.some(c => c.records.some(r => r.path === 'knowledge/features/event-route.md')));
  assert.equal(investigateProject(root, { paths: ['src/app/api/events/[otherId]/route.ts'] }).totalContextMatches, 0);
  assert.throws(() => investigateProject(root, { paths: ['../foreign/route.ts'] }), /canonical|project-relative/);
  assert.equal(lintContext(root, { git: false }).ok, true);
});
test('retention: completed catch-up needs a new scoped update and cannot mutate the completed receipt', t => {
  const root = fixture(t), oldId = completeRun(root, { goal: 'Historical orders.', edit: () => put(root, 'src/orders/order.txt', 'old done') });
  const receipt = readFileSync(join(root, `.cyc/runs/${oldId}/state.json`)), bytes = treeBytes(root);
  assert.throws(() => actualReviewContext(root, { run: oldId, write: true }), /new active scoped update/); assert.deepEqual(treeBytes(root), bytes);
  const active = live.startRun(root, { goal: 'Plan a small source-only investigation.', playbook: 'plan', allowedPaths: ['src/orders'] }).runId;
  assert.throws(() => actualReviewContext(root, { run: oldId, write: true, updateRun: active }), /outside frozen/);
  assert.deepEqual(readFileSync(join(root, `.cyc/runs/${oldId}/state.json`)), receipt);
});

test('retention: installed fresh feature finishes through context and proof continuation, then transfers without local receipts', t => {
  const root = mkdtempSync(join(tmpdir(), 'cyc-retain-installed-'));
  const portable = mkdtempSync(join(tmpdir(), 'cyc-retain-portable-'));
  t.after(() => { for (const [path, prefix] of [[root, 'cyc-retain-installed-'], [portable, 'cyc-retain-portable-']]) { assert.equal(dirname(path), resolve(tmpdir())); assert(path.startsWith(join(resolve(tmpdir()), prefix))); rmSync(path, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } });
  put(root, 'package.json', JSON.stringify({ type: 'module' }));
  const installation = installProject(root, { hosts: ['codex'] }); assert.equal(installation.ok, true, JSON.stringify(installation));
  const installedConfig = JSON.parse(readFileSync(join(root, '.cyc/config.json')));
  installedConfig.verification = { commands: [{ id: 'behavior', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT;const r=require('node:child_process').spawnSync(process.execPath,['--test'],{stdio:'inherit'});process.exit(r.status??1)"] }] };
  put(root, '.cyc/config.json', JSON.stringify(installedConfig));
  const installedCli = join(root, '.cyc/engine/bin/cyc.mjs');
  function installed(args) { const r = spawnSync(process.execPath, [installedCli, ...args], { cwd: root, encoding: 'utf8', timeout: 30000 }); assert.equal(r.status, 0, r.stderr || r.stdout); return JSON.parse(r.stdout); }
  const doc = 'docs/context/greeting.md';
  const start = { goal: 'Add a local greeting capability.', playbook: 'feature', executionMode: 'standalone', session: 'fresh-installed', evidenceVersion: 1, requirements: 'A pure greet(name) returns Hello plus that name; retained target knowledge remains discoverable.', criteria: [{ id: 'greeting', description: 'greet returns the expected string.' }], allowedPaths: ['src', 'test'], contextRetention: { disposition: 'required', features: [{ id: 'greeting', doc, paths: ['src/greet.mjs', 'test/greet.test.mjs'] }] } };
  put(root, '.cyc/runtime/start.json', JSON.stringify(start)); const began = installed(['run', 'start', '--file', '.cyc/runtime/start.json']); const id = began.runId;
  assert.equal(live.readRun(root, id).contextRetention.index, 'docs/context/INDEX.md');
  put(root, '.cyc/runtime/scout.json', JSON.stringify({ runId: id, stage: 'scout', attempt: began.attempt, status: 'passed', summary: 'Read the blank target and plan greeting context before Build.', evidence: [{ kind: 'observation', detail: 'Target index absent; engine development docs are not target context.' }], artifacts: [], criteria: [{ id: 'greeting', result: 'unverified', evidence: 'Later behavioral check.' }], assessment: fixtureAssessment(live.readRun(root, id), 'scout') }));
  installed(['run', 'record', '--run', id, '--file', '.cyc/runtime/scout.json']);
  put(root, 'src/greet.mjs', 'export const greet=name=>"Hello "+name;');
  put(root, 'test/greet.test.mjs', 'import test from "node:test";import assert from "node:assert/strict";import {greet} from "../src/greet.mjs";test("greet returns the name",()=>assert.equal(greet("Ada"),"Hello Ada"));');
  const a = { ...fixtureAssessment(live.readRun(root, id), 'verify'), ...fixtureAssessment(live.readRun(root, id), 'deliver') }; delete a.testProof;
  a.learning = { status: 'recorded', reason: 'Retain the pure greeting entrypoint, check, and absence of persistence/network behavior.', artifacts: [doc] };
  const input = { runId: id, summary: 'The local greeting returns its supplied name.', scenarioEvidence: [{ id: 'greeting', scenario: 'greet returns the name', check: 'behavior', receipt: 'current-verification', result: 'passed', origin: 'agent-reported', consumers: ['behavior'], evidence: 'Actual isolated assertion compares greet(Ada) with Hello Ada; not a production integration claim.' }], assessment: a };
  put(root, '.cyc/runtime/finish.json', JSON.stringify(input));
  assert.equal(installed(['run', 'finish', '--run', id, '--file', '.cyc/runtime/finish.json']).status, 'needs-context');
  assert.equal(live.readRun(root, id).verification, null); assert.equal(lintContext(root, { git: false }).ok, false);
  a.learning.context = [{ id: 'greeting', currentView: 'The user capability is a pure local greet(name), exported by src/greet.mjs, that returns Hello followed by the supplied name. It has no storage, membership policy, network request or asynchronous lifecycle. Keeping it pure avoids a service dependency for this capability. Run node --test: test/greet.test.mjs checks Ada maps to Hello Ada. These are isolated development checks, not user acceptance, native hook activation or unseen-task evidence. Detailed controller receipts stay in ignored local storage and may be absent in another checkout; re-run the command and inspect the source before reuse.' }];
  put(root, '.cyc/runtime/finish.json', JSON.stringify(input));
  const proof = installed(['run', 'finish', '--run', id, '--file', '.cyc/runtime/finish.json']); assert.equal(proof.status, 'needs-proof-review', JSON.stringify(proof));
  const remaining = JSON.parse(readFileSync(join(root, proof.nextAction.inputTemplate)));
  remaining.assessment.proofReview.cases = proof.proof.failures.map(f => ({ id: f.id, category: 'new-interface', reason: 'The original blank target lacks src/greet.mjs, observed by the actual import diagnostic; this feature establishes a new interface rather than a repaired existing behavior.', boundary: f.boundary ?? '' }));
  put(root, '.cyc/runtime/remaining.json', JSON.stringify(remaining));
  assert.equal(installed(['run', 'finish', '--run', id, '--file', '.cyc/runtime/remaining.json']).finished, true);
  const completed = live.readRun(root, id); assert.equal(completed.verification.role, 'candidate'); assert.equal(completed.verification.results[0].exitCode, 0); assert.deepEqual(completed.handoffs.at(-1).contextDocs, [doc]);
  assert.equal(lintContext(root, { git: false }).ok, true);
  for (const path of ['src', 'test', 'docs', 'package.json', '.cyc/config.json']) { mkdirSync(dirname(join(portable, path)), { recursive: true }); cpSync(join(root, path), join(portable, path), { recursive: true }); }
  assert.equal(fs.existsSync(join(portable, '.cyc/runtime')), false);
  const found = investigateProject(portable, { paths: ['src/greet.mjs'] }); assert.equal(found.index.path, 'docs/context/INDEX.md'); assert(found.contexts.some(c => c.records.some(r => r.path === doc)));
  const knowledge = readFileSync(join(portable, doc), 'utf8'); assert.match(knowledge, /pure local greet\(name\)/); assert.match(knowledge, /no storage/); assert.match(knowledge, /node --test/); assert.match(knowledge, /ignored local storage/);
  const checked = spawnSync(process.execPath, ['-e', "delete process.env.NODE_TEST_CONTEXT;const r=require('node:child_process').spawnSync(process.execPath,['--test'],{stdio:'inherit'});process.exit(r.status??1)"], { cwd: portable, encoding: 'utf8' }); assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  const edited = knowledge.replace('pure local greet(name)', 'changed local greet(name)'); put(root, doc, edited);
  assert.throws(() => live.finishRun(root, id, {}), /changed|Stale|modified|artifact/i, 'replacing delivery evidence cannot certify edited canonical context');
});
test('retention: linked context cannot write to another project', t => {
  const root = fixture(t, { index: null, doc: null }), outside = fixture(t, { index: null, doc: null });
  put(outside, 'feature.md', 'Outside bytes stay unchanged.');
  try { fs.symlinkSync(outside, join(root, 'docs/linked-context'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Host cannot create the isolated link fixture.'); throw error; }
  const cfg = JSON.parse(readFileSync(join(root, '.cyc/config.json'))); cfg.context = { directory: 'docs/linked-context' }; put(root, '.cyc/config.json', JSON.stringify(cfg));
  assert.throws(() => live.startRun(root, { goal: 'Add linked feature.', playbook: 'feature' }), /Linked path/);
  assert.equal(readFileSync(join(outside, 'feature.md'), 'utf8'), 'Outside bytes stay unchanged.');
});

test('retention: historical seeding precedes the real background worker even when the seed write is delayed', async t => {
  const root = fixture(t), cfg = JSON.parse(readFileSync(join(root, '.cyc/config.json')));
  cfg.verification = { baseline: true, commands: [{ id: 'observed', command: process.execPath, args: ['-e', "const fs=require('node:fs');const id=fs.readdirSync('.cyc/runs').find(x=>fs.existsSync('.cyc/runs/'+x+'/state.json'));const state=JSON.parse(fs.readFileSync('.cyc/runs/'+id+'/state.json'));fs.writeFileSync('.cyc/runtime/observed-historical.json',JSON.stringify({retention:state.contextRetention??null}));process.exit(state.contextRetention?1:0)"] }] };
  put(root, '.cyc/config.json', JSON.stringify(cfg));
  const mode = process.env.CYC_BASELINE_MODE, rename = fs.renameSync; let stateWrites = 0, held = false;
  process.env.CYC_BASELINE_MODE = 'background';
  fs.renameSync = (from, to) => {
    if (String(to).endsWith('state.json') && ++stateWrites === 2) {
      const end = Date.now() + 10000;
      while (!readdirSync(join(root, '.cyc/runtime')).some(p => p.endsWith('.ready.started')) && Date.now() < end) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      assert(readdirSync(join(root, '.cyc/runtime')).some(p => p.endsWith('.ready.started')), 'a real existing worker reached the seed barrier');
      assert.equal(fs.existsSync(join(root, '.cyc/runtime/observed-historical.json')), false, 'worker must not read unseeded current state');
      held = true;
    }
    return rename(from, to);
  }; syncBuiltinESMExports();
  let id;
  try { id = startRun(root, { goal: 'Exercise historical background measurement.', playbook: 'feature' }).runId; }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); mode === undefined ? delete process.env.CYC_BASELINE_MODE : process.env.CYC_BASELINE_MODE = mode; }
  assert.equal(held, true);
  const end = Date.now() + 15000;
  while (!fs.existsSync(join(root, `.cyc/runs/${id}/baseline.json`)) && Date.now() < end) await new Promise(done => setTimeout(done, 25));
  assert.equal(JSON.parse(readFileSync(join(root, '.cyc/runtime/observed-historical.json'))).retention, null);
  assert.equal(JSON.parse(readFileSync(join(root, `.cyc/runs/${id}/baseline.json`))).results[0].exitCode, 0);
  assert.equal(live.readRun(root, id).contextRetention, undefined);
});
