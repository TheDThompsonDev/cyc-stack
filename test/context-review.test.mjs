import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finishRun, nextRun, readRun, recordHandoff, retryRun, startRun } from '../scripts/runtime.mjs';
import { applyEntry, lintContext, measureContext, parseDoc, reviewContext, rules } from '../scripts/context-review.mjs';
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
  assert.match(readFileSync(join(root, `.cyc/runs/${touched}/review.md`), 'utf8'), /- Context docs touched: docs\/context\/orders\.md\. Propose the component doc entry with cyc context review --run /);
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
  assert.equal(result.status, 0);
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
  assert.match(entry, /context review --run <ID> --write/);
  const method = readFileSync(join(repo, 'methods/cyc-context/SKILL.md'), 'utf8');
  assert.match(method, /Read the index first, then only the matched docs/);
  for (const rule of Object.keys(rules)) assert.ok(method.includes(`\`${rule}\``) || method.includes(`(${rule}`), `the method names rule ${rule}`);
  assert.match(method, /Whether that saves tokens is a measurement, not a premise/);
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
