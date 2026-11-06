import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { investigateProject, listRecipes, runRecipe } from '../scripts/project-tools.mjs';
import { controlRun, nextRun, quickHandoff, readRun, startRun, verifyRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { installProject } from '../scripts/install.mjs';
// These tests are not about run-start measurement; a background worker would outlive their temp folders.
process.env.CYC_BASELINE_MODE = 'off';

function put(root, name, content) { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content)); }
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc reusable tools '));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, 'src/order.txt', 'ok'); put(root, 'src/rules.json', '{"mode":1}');
  put(root, 'tools/contracts.mjs', "import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; assert.equal(readFileSync('src/order.txt','utf8'),'ok'); console.log('contract passed');");
  put(root, '.cyc/config.json', { schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'required', command: process.execPath, args: ['-e', 'process.exit(1)'] }] } });
  put(root, 'docs/context/orders.md', 'Orders reason and constraints.');
  put(root, 'docs/context/billing.md', 'Unrelated billing record.');
  const digest = name => createHash('sha256').update(readFileSync(join(root, name))).digest('hex');
  put(root, 'docs/context/orders.evidence.json', { schemaVersion: 1, files: { 'src/order.txt': digest('src/order.txt'), 'src/rules.json': digest('src/rules.json') } });
  put(root, 'docs/context/INDEX.md', '| Area | Covers | Record | Evidence |\n| --- | --- | --- | --- |\n| Orders | src/order.txt, src/orders/**, src/rules.json | [Orders](orders.md) | [Evidence](orders.evidence.json) |\n| Billing | billing/** | [Billing](billing.md) | no manifest |\n');
  register(root);
  return root;
}
function recipe(overrides = {}) { return { id: 'orders', kind: 'verification', description: 'Verify order contract', covers: ['src/order.txt', 'src/orders/**'], command: process.execPath, args: ['tools/contracts.mjs'], expected: 'Order contract assertion passes', effects: 'Reads fixture data', prerequisites: [], references: ['tools/contracts.mjs'], timeoutMs: 5000, ...overrides }; }
function register(root, recipes = [recipe()]) { put(root, 'docs/context/recipes.json', { schemaVersion: 1, recipes }); }
function cli(root, args, executable = resolve('bin/cyc.mjs')) { const result = spawnSync(process.execPath, [executable, ...args, '--project', root], { encoding: 'utf8' }); return { ...result, data: JSON.parse(result.stdout || result.stderr) }; }

function mixedRecipes(root) {
  register(root, [
    recipe(), recipe({ id: 'orders-inspect', kind: 'investigation' }),
    recipe({ id: 'billing', description: 'Check billing', covers: ['billing/**'] }),
    recipe({ id: 'billing-inspect', kind: 'investigation', description: 'Inspect billing', covers: ['billing/**'] })
  ].map(r => ({ ...r, args: ['-e', "require('node:fs').writeFileSync('executed.txt','yes')"] })));
}

function treeBytes(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? [[path, null], ...treeBytes(path)] : [[path, readFileSync(path).toString('base64')]];
  }).sort(([a], [b]) => a.localeCompare(b));
}

test('recipe kind API intersects all, paths, goals and run selection without writing', t => {
  const root = fixture(t); mixedRecipes(root);
  const scoped = startRun(root, { goal: 'billing', playbook: 'verify', allowedPaths: ['src'] });
  const goalOnly = startRun(root, { goal: 'billing', playbook: 'verify' });
  const before = treeBytes(root);
  const cases = [
    [{ all: true }, ['orders', 'orders-inspect', 'billing', 'billing-inspect']],
    [{ all: true, paths: ['unmatched'] }, ['orders', 'orders-inspect', 'billing', 'billing-inspect']],
    [{ paths: ['src'], goal: 'billing' }, ['orders', 'orders-inspect']],
    [{ paths: ['src', 'billing'] }, ['orders', 'orders-inspect', 'billing', 'billing-inspect']],
    [{ goal: 'billing' }, ['billing', 'billing-inspect']],
    [{ run: scoped.runId }, ['orders', 'orders-inspect']],
    [{ run: goalOnly.runId }, ['billing', 'billing-inspect']],
    [{ run: scoped.runId, paths: ['billing'] }, ['billing', 'billing-inspect']],
    [{ run: goalOnly.runId, goal: 'orders' }, ['orders', 'orders-inspect']],
    [{ paths: ['unmatched'] }, []], [{}, []]
  ];
  for (const [options, ids] of cases) {
    const unfiltered = listRecipes(root, options);
    assert.deepEqual(unfiltered.recipes.map(r => r.id), ids);
    assert.deepEqual(listRecipes(root, { ...options, kind: undefined }), unfiltered);
    for (const kind of ['investigation', 'verification']) {
      assert.deepEqual(listRecipes(root, { ...options, kind }), {
        ...unfiltered, recipes: unfiltered.recipes.filter(r => r.kind === kind)
      });
    }
  }
  assert.deepEqual(treeBytes(root), before);
  put(root, 'billing/new.txt', 'changed after run start');
  const changed = treeBytes(root);
  const result = listRecipes(root, { run: scoped.runId, kind: 'investigation' });
  assert.deepEqual(result.paths, ['billing/new.txt']);
  assert.deepEqual(result.recipes.map(r => r.id), ['billing-inspect']);
  assert.deepEqual(treeBytes(root), changed);
});

test('recipe kind CLI preserves unfiltered results and combines selection without writing', t => {
  const root = fixture(t); mixedRecipes(root);
  const scoped = startRun(root, { goal: 'billing', playbook: 'verify', allowedPaths: ['src'] });
  const goalOnly = startRun(root, { goal: 'billing', playbook: 'verify' });
  const before = treeBytes(root);
  for (const [args, ids] of [
    [[], ['orders', 'orders-inspect', 'billing', 'billing-inspect']],
    [['--path', 'src', '--goal', 'billing'], ['orders', 'orders-inspect']],
    [['--goal', 'billing'], ['billing', 'billing-inspect']],
    [['--run', scoped.runId], ['orders', 'orders-inspect']],
    [['--run', goalOnly.runId], ['billing', 'billing-inspect']],
    [['--run', scoped.runId, '--path', 'billing'], ['billing', 'billing-inspect']],
    [['--run', goalOnly.runId, '--goal', 'orders'], ['orders', 'orders-inspect']],
    [['--path', 'unmatched'], []]
  ]) {
    const unfiltered = cli(root, ['recipe', 'list', ...args]);
    assert.equal(unfiltered.status, 0);
    assert.deepEqual(unfiltered.data.recipes.map(r => r.id), ids);
    for (const kind of ['investigation', 'verification']) {
      const filtered = cli(root, ['recipe', 'list', ...args, '--kind', kind]);
      assert.equal(filtered.status, 0, JSON.stringify(filtered.data));
      assert.deepEqual(filtered.data, { ...unfiltered.data, recipes: unfiltered.data.recipes.filter(r => r.kind === kind) });
    }
  }
  assert.deepEqual(treeBytes(root), before);
  put(root, 'billing/new.txt', 'changed after run start');
  const changed = treeBytes(root);
  const result = cli(root, ['recipe', 'list', '--run', scoped.runId, '--kind', 'verification']);
  assert.equal(result.status, 0);
  assert.deepEqual(result.data.paths, ['billing/new.txt']);
  assert.deepEqual(result.data.recipes.map(r => r.id), ['billing']);
  assert.deepEqual(treeBytes(root), changed);
});

test('recipe kind rejects invalid values and stays out of recipe execution', t => {
  const root = fixture(t); mixedRecipes(root);
  const before = treeBytes(root);
  for (const kind of ['unsupported', 'Verification', 'all', '', null, false, 0, [], {}]) {
    assert.throws(() => listRecipes(root, { all: true, kind }), /kind.*investigation.*verification/i);
  }
  for (const kind of ['unsupported', 'Verification', 'all']) {
    const result = cli(root, ['recipe', 'list', '--kind', kind]);
    assert.notEqual(result.status, 0);
    assert.match(result.data.error, /kind.*investigation.*verification/i);
  }
  const missing = cli(root, ['recipe', 'list', '--kind']);
  assert.notEqual(missing.status, 0); assert.match(missing.data.error, /--kind needs a value/);
  const help = spawnSync(process.execPath, [resolve('bin/cyc.mjs'), 'help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /recipe list[^\n]*\[--kind investigation\|verification\]/);
  for (const args of [['recipe', 'run', '--recipe', 'orders']]) {
    const result = cli(root, [...args, '--kind', 'verification']);
    assert.notEqual(result.status, 0); assert.match(result.data.error, /--kind.*only.*recipe list/);
  }
  const investigation = investigateProject(root, { paths: ['src'], limit: 1 });
  assert.equal(investigation.totalRecipeMatches, 2); assert.equal(investigation.recipesTruncated, true);
  const inspected = cli(root, ['investigate', '--path', 'src']);
  assert.equal(inspected.status, 0);
  assert.deepEqual(inspected.data.recipes.map(r => r.kind), ['verification', 'investigation']);
  assert.deepEqual(treeBytes(root), before);
  register(root);
  assert.deepEqual(listRecipes(root, { all: true, kind: 'investigation' }).recipes, []);
  const empty = cli(root, ['recipe', 'list', '--kind', 'investigation']);
  assert.equal(empty.status, 0); assert.deepEqual(empty.data.recipes, []);
  register(root, [recipe(), recipe({ id: 'invalid', kind: 'unsupported' })]);
  assert.throws(() => listRecipes(root, { all: true, kind: 'verification' }), /Each recipe needs/);
  rmSync(join(root, 'docs/context/recipes.json'));
  assert.equal(listRecipes(root, { all: true, kind: 'verification' }).available, false);
  assert.throws(() => listRecipes(root, { all: true, kind: 'unsupported' }), /kind.*investigation.*verification/i);
});

test('investigate kind intersects matching and preserves context, freshness and read-only discovery', t => {
  const root = fixture(t); mixedRecipes(root);
  const scoped = startRun(root, { goal: 'billing', playbook: 'verify', allowedPaths: ['src'] });
  const goalOnly = startRun(root, { goal: 'billing', playbook: 'verify' });
  const before = treeBytes(root);
  for (const [options, args, ids] of [
    [{ paths: ['src'], goal: 'billing' }, ['--path', 'src', '--goal', 'billing'], ['orders', 'orders-inspect']],
    [{ paths: ['src', 'billing'] }, ['--path', 'src', 'billing'], ['orders', 'orders-inspect', 'billing', 'billing-inspect']],
    [{ goal: 'billing' }, ['--goal', 'billing'], ['billing', 'billing-inspect']],
    [{ run: scoped.runId }, ['--run', scoped.runId], ['orders', 'orders-inspect']],
    [{ run: goalOnly.runId }, ['--run', goalOnly.runId], ['billing', 'billing-inspect']],
    [{ run: scoped.runId, paths: ['billing'] }, ['--run', scoped.runId, '--path', 'billing'], ['billing', 'billing-inspect']],
    [{ run: goalOnly.runId, goal: 'orders' }, ['--run', goalOnly.runId, '--goal', 'orders'], ['orders', 'orders-inspect']],
    [{ paths: ['unmatched'] }, ['--path', 'unmatched'], []]
  ]) {
    const unfiltered = investigateProject(root, options);
    assert.deepEqual(unfiltered.recipes.map(r => r.id), ids);
    assert.deepEqual(investigateProject(root, { ...options, kind: undefined }), unfiltered);
    const plain = cli(root, ['investigate', ...args]);
    assert.equal(plain.status, 0); assert.deepEqual(plain.data, unfiltered);
    for (const kind of ['investigation', 'verification']) {
      const recipes = unfiltered.recipes.filter(r => r.kind === kind);
      const expected = { ...unfiltered, recipes, totalRecipeMatches: recipes.length, recipesTruncated: false };
      assert.deepEqual(investigateProject(root, { ...options, kind }), expected);
      const filtered = cli(root, ['investigate', ...args, '--kind', kind]);
      assert.equal(filtered.status, 0, JSON.stringify(filtered.data));
      assert.deepEqual(filtered.data, expected);
    }
  }
  assert.deepEqual(treeBytes(root), before);
  put(root, 'billing/new.txt', 'changed after run start');
  const changed = treeBytes(root);
  const result = cli(root, ['investigate', '--run', scoped.runId, '--kind', 'investigation']);
  assert.equal(result.status, 0); assert.deepEqual(result.data.paths, ['billing/new.txt']);
  assert.deepEqual(result.data.recipes.map(r => r.id), ['billing-inspect']);
  assert.deepEqual(investigateProject(root, { run: scoped.runId, kind: 'investigation' }), result.data);
  assert.deepEqual(treeBytes(root), changed);
});

test('investigate kind filters before recipe limits without changing context limits or drift checks', t => {
  const root = fixture(t); mixedRecipes(root);
  const index = readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8');
  put(root, 'docs/context/INDEX.md', index + '| More orders | src/** | [Orders](orders.md) | [Evidence](orders.evidence.json) |\n| malformed |\n');
  for (const drift of [false, true]) {
    if (drift) put(root, 'src/rules.json', '{"mode":2}');
    const before = treeBytes(root);
    const options = { paths: ['src', 'billing'], limit: 1 };
    const unfiltered = investigateProject(root, options);
    assert.equal(unfiltered.totalContextMatches, 3); assert.equal(unfiltered.truncated, true);
    assert.equal(unfiltered.contexts[0].evidence[0].check.status, drift ? 'drift' : 'unchanged');
    assert.equal(unfiltered.totalRecipeMatches, 4); assert.equal(unfiltered.recipesTruncated, true);
    for (const kind of ['investigation', 'verification']) {
      const filtered = investigateProject(root, { ...options, kind });
      assert.deepEqual(filtered.recipes.map(r => r.id), [kind === 'investigation' ? 'orders-inspect' : 'orders']);
      assert.equal(filtered.totalRecipeMatches, 2); assert.equal(filtered.recipesTruncated, true);
      assert.deepEqual(filtered, { ...unfiltered, recipes: filtered.recipes, totalRecipeMatches: 2 });
      const command = cli(root, ['investigate', '--path', 'src', 'billing', '--limit', '1', '--kind', kind]);
      assert.equal(command.status, 0); assert.deepEqual(command.data, filtered);
    }
    assert.deepEqual(treeBytes(root), before);
  }
  const limited = investigateProject(root, { paths: ['src'], limit: 1, kind: 'investigation' });
  assert.deepEqual(limited.recipes.map(r => r.id), ['orders-inspect']);
  assert.equal(limited.totalRecipeMatches, 1); assert.equal(limited.recipesTruncated, false);
  register(root);
  const unfiltered = investigateProject(root, { paths: ['src'], limit: 1 });
  assert.deepEqual(investigateProject(root, { paths: ['src'], limit: 1, kind: 'investigation' }), {
    ...unfiltered, recipes: [], totalRecipeMatches: 0, recipesTruncated: false
  });
});

test('investigate kind rejects unsupported values and validates excluded registry entries', t => {
  const root = fixture(t); mixedRecipes(root);
  const before = treeBytes(root);
  for (const kind of ['unsupported', 'Verification', 'all', '', null, false, 0, [], {}]) {
    assert.throws(() => investigateProject(root, { paths: ['src'], kind }), /kind.*investigation.*verification/i);
  }
  for (const kind of ['unsupported', 'Verification', 'all']) {
    const result = cli(root, ['investigate', '--path', 'src', '--kind', kind]);
    assert.notEqual(result.status, 0); assert.match(result.data.error, /kind.*investigation.*verification/i);
  }
  for (const args of [['--kind'], ['--kind', '--path', 'src']]) {
    const result = cli(root, ['investigate', ...args]);
    assert.notEqual(result.status, 0); assert.match(result.data.error, /--kind needs a value/);
  }
  const help = spawnSync(process.execPath, [resolve('bin/cyc.mjs'), 'help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /cyc investigate[^\n]*\[--kind investigation\|verification\]/);
  assert.deepEqual(treeBytes(root), before);
  register(root, [recipe(), recipe({ id: 'invalid', kind: 'unsupported' })]);
  assert.throws(() => investigateProject(root, { paths: ['src'], kind: 'verification' }), /Each recipe needs/);
  rmSync(join(root, 'docs/context/recipes.json'));
  const missing = investigateProject(root, { paths: ['src'], kind: 'verification' });
  assert.equal(missing.recipeRegistryAvailable, false); assert.deepEqual(missing.recipes, []);
  assert.equal(missing.contexts[0].evidence[0].check.status, 'unchanged');
  assert.throws(() => investigateProject(root, { paths: ['src'], kind: 'unsupported' }), /kind.*investigation.*verification/i);
  const invalid = cli(root, ['investigate', '--path', 'src', '--kind', 'unsupported']);
  assert.notEqual(invalid.status, 0); assert.match(invalid.data.error, /kind.*investigation.*verification/i);
});

test('investigation selects component and dependency context without executing recipes', t => {
  const root = fixture(t);
  register(root, [recipe({ args: ['-e', "require('node:fs').writeFileSync('executed.txt','yes')"] })]);
  const report = investigateProject(root, { paths: ['src/orders/new.mjs'] });
  assert.deepEqual(report.contexts.map(r => r.area), ['Orders']);
  assert.deepEqual(report.contexts[0].records, [{ path: 'docs/context/orders.md', exists: true }]);
  assert.equal(report.contexts[0].evidence[0].check.status, 'unchanged');
  assert.equal(report.contexts[0].evidence[0].check.checkedFiles, 2);
  assert.deepEqual(report.contexts[0].evidence[0].check.files, []);
  assert.equal(report.recipes[0].id, 'orders');
  assert.equal(report.recipes[0].receipt.status, 'unverified');
  assert.equal(existsSync(join(root, 'executed.txt')), false);
  assert.equal(existsSync(join(root, '.cyc/runtime')), false);
  put(root, 'src/rules.json', '{"mode":2}');
  const drift = investigateProject(root, { paths: ['src/rules.json'] });
  assert.equal(drift.contexts[0].evidence[0].check.status, 'drift');
  assert.deepEqual(drift.contexts[0].evidence[0].check.files, [{ path: 'src/rules.json', status: 'changed' }]);
  assert.equal(drift.contexts[0].evidence[0].check.checkedFiles, 2);
});

test('directory scopes, optional glob directories, goals, limits and missing registries work', t => {
  const root = fixture(t);
  register(root, [recipe(), recipe({ id: 'root-tests', covers: ['**/*.test.mjs'] })]);
  assert.equal(listRecipes(root, { paths: ['example.test.mjs'] }).recipes[0].id, 'root-tests');
  assert.equal(listRecipes(root, { paths: ['src'] }).recipes[0].id, 'orders');
  assert.equal(investigateProject(root, { goal: 'orders' }).contexts[0].area, 'Orders');
  const source = readFileSync(join(root, 'docs/context/INDEX.md'), 'utf8');
  put(root, 'docs/context/INDEX.md', source + '| Other orders | src/** | [Order](orders.md) | no manifest |\n');
  const bounded = investigateProject(root, { paths: ['src/order.txt'], limit: 1 });
  assert.equal(bounded.contexts.length, 1); assert.equal(bounded.totalContextMatches, 2); assert.equal(bounded.truncated, true);
  rmSync(join(root, 'docs/context/orders.md'));
  assert.equal(investigateProject(root, { paths: ['src/order.txt'] }).contexts[0].records[0].exists, false);
  rmSync(join(root, 'docs/context/recipes.json')); rmSync(join(root, 'docs/context/INDEX.md'));
  const missing = investigateProject(root, { paths: ['src/order.txt'] });
  assert.equal(missing.index.exists, false); assert.equal(missing.recipeRegistryAvailable, false); assert.deepEqual(missing.contexts, []);
});

test('identical required commands are identified using the captured run configuration', t => {
  const root = fixture(t), command = recipe();
  const config = { schemaVersion: 1, verification: { commands: [{ id: 'required-order', command: command.command, args: command.args }] } };
  put(root, '.cyc/config.json', config);
  assert.deepEqual(listRecipes(root, { all: true }).recipes[0].configuredCommandIds, ['required-order']);
  const run = startRun(root, { goal: 'Verify orders', playbook: 'verify', allowedPaths: ['src'] });
  config.verification.commands[0].args = ['-e', 'process.exit(1)']; put(root, '.cyc/config.json', config);
  assert.deepEqual(listRecipes(root, { run: run.runId, paths: ['src'] }).recipes[0].configuredCommandIds, ['required-order']);
  assert.deepEqual(listRecipes(root, { run: run.runId, paths: ['src'], kind: 'verification' }).recipes[0].configuredCommandIds, ['required-order']);
  assert.deepEqual(listRecipes(root, { all: true }).recipes[0].configuredCommandIds, []);
});

test('recipes retain failures, expose stale receipts, and never replace required controller checks', t => {
  const root = fixture(t);
  const run = startRun(root, { goal: 'Verify orders', playbook: 'verify', allowedPaths: ['src'] });
  assert.ok(nextRun(root, run.runId).toolHints.some(h => h.command === `investigate --run ${run.runId}`));
  assert.deepEqual(investigateProject(root, { run: run.runId }).paths, ['src']);
  const passed = runRecipe(root, 'orders', { run: run.runId });
  assert.equal(passed.passed, true); assert.equal(passed.runId, run.runId); assert.equal(existsSync(join(root, passed.receiptPath)), true);
  assert.equal(readRun(root, run.runId).verification, null);
  assert.equal(listRecipes(root, { all: true }).recipes[0].receipt.status, 'passed');
  assert.deepEqual(listRecipes(root, { all: true, kind: 'verification' }), listRecipes(root, { all: true }));
  quickHandoff(root, run.runId, { summary: 'Inspected order contract and its configured checks.', passedEvidence: 'The bounded order contract recipe passed; required project check remains to run.' });
  assert.ok(nextRun(root, run.runId).toolHints.some(h => h.command.startsWith('recipe list')));
  assert.equal(verifyRun(root, run.runId).passed, false);
  assert.notEqual(readRun(root, run.runId).status, 'complete');
  put(root, 'src/order.txt', 'broken');
  assert.equal(listRecipes(root, { all: true }).recipes[0].receipt.status, 'stale');
  assert.deepEqual(listRecipes(root, { all: true, kind: 'verification' }), listRecipes(root, { all: true }));
  const failed = runRecipe(root, 'orders');
  assert.equal(failed.passed, false); assert.equal(listRecipes(root, { all: true }).recipes[0].receipt.status, 'failed');
  assert.deepEqual(listRecipes(root, { all: true, kind: 'verification' }), listRecipes(root, { all: true }));
  assert.equal(readdirSync(join(root, '.cyc/runtime/recipes/orders')).length, 2);
});

test('source, registry and invalid-config mutations cannot produce passing recipe evidence', t => {
  for (const [script, field] of [
    ["require('node:fs').writeFileSync('src/order.txt','changed')", 'sourceStable'],
    ["require('node:fs').writeFileSync('docs/context/recipes.json','{bad')", 'definitionStable'],
    ["require('node:fs').writeFileSync('.cyc/config.json','{bad')", 'configStable']
  ]) {
    const root = fixture(t); register(root, [recipe({ args: ['-e', script] })]);
    const result = runRecipe(root, 'orders');
    assert.equal(result.passed, false); assert.equal(result[field], false); assert.equal(existsSync(join(root, result.receiptPath)), true);
  }
});

test('timeout and executable failures stay failed and latest invalid receipts are not skipped', t => {
  const root = fixture(t); register(root, [recipe({ args: ['-e', 'setTimeout(()=>{},2000)'], timeoutMs: 40 })]);
  const timeout = runRecipe(root, 'orders'); assert.equal(timeout.passed, false); assert.equal(timeout.results[0].errorCode, 'ETIMEDOUT');
  register(root, [recipe({ command: 'cyc-nonexistent-executable' })]);
  assert.equal(runRecipe(root, 'orders').passed, false);
  const files = readdirSync(join(root, '.cyc/runtime/recipes/orders')).sort();
  put(root, `.cyc/runtime/recipes/orders/${files.at(-1)}`, '{invalid');
  assert.equal(listRecipes(root, { all: true }).recipes[0].receipt.status, 'invalid');
});

test('bad recipes, duplicate IDs, unsupported paths and unknown IDs reject before execution', t => {
  const root = fixture(t);
  for (const recipes of [[recipe(), recipe()], [recipe({ args: 'shell text' })], [recipe({ args: ['\0'] })], [recipe({ timeoutMs: 0 })], [recipe({ timeoutMs: Number.MAX_SAFE_INTEGER })], [recipe({ covers: ['../outside'] })], [recipe({ references: ['../outside'] })], [recipe({ expected: '' })], [recipe({ covers: ['src/{a,b}'] })]]) {
    register(root, recipes); assert.throws(() => listRecipes(root, { all: true }));
  }
  register(root); assert.throws(() => runRecipe(root, 'absent'), /Unknown recipe/);
  for (const path of ['../outside', '/absolute', 'C:/outside', 'src/**']) assert.throws(() => investigateProject(root, { paths: [path] }));
  assert.throws(() => investigateProject(root, { paths: ['src'], limit: 0 }));
});

test('linked context and receipt directories cannot escape or run project commands', t => {
  const root = fixture(t), outside = fixture(t);
  symlinkSync(outside, join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
  put(root, 'docs/context/INDEX.md', '| Area | Covers | Doc |\n| --- | --- | --- |\n| Orders | src/** | [Outside](../../outside/src/order.txt) |\n');
  const context = investigateProject(root, { paths: ['src/order.txt'] });
  assert.equal(context.contexts.length, 0); assert.ok(context.warnings.length);
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  symlinkSync(outside, join(root, '.cyc/runtime/recipes'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => runRecipe(root, 'orders'), /Linked path/);
});

test('installed CLI discovers and runs project recipes; inspection and dry-run never execute', t => {
  const root = fixture(t);
  const config = readFileSync(join(root, '.cyc/config.json'));
  rmSync(join(root, '.cyc/config.json'));
  const installed = installProject(root, { hosts: ['codex'] });
  assert.equal(installed.ok, true, JSON.stringify(installed));
  writeFileSync(join(root, '.cyc/config.json'), config);
  const executable = join(root, '.cyc/engine/bin/cyc.mjs');
  const inspected = cli(root, ['investigate', '--path', 'src/order.txt'], executable);
  assert.equal(inspected.status, 0); assert.equal(inspected.data.contexts[0].area, 'Orders');
  assert.equal(cli(root, ['recipe', 'list'], executable).data.recipes[0].id, 'orders');
  const filtered = cli(root, ['recipe', 'list', '--kind', 'verification', '--path', 'src'], executable);
  assert.equal(filtered.status, 0); assert.deepEqual(filtered.data.recipes.map(r => r.id), ['orders']);
  const empty = cli(root, ['recipe', 'list', '--kind', 'investigation'], executable);
  assert.equal(empty.status, 0); assert.deepEqual(empty.data.recipes, []);
  assert.notEqual(cli(root, ['recipe', 'list', '--kind', 'unsupported'], executable).status, 0);
  const investigation = cli(root, ['investigate', '--path', 'src/order.txt', '--kind', 'verification'], executable);
  assert.equal(investigation.status, 0); assert.deepEqual(investigation.data, inspected.data);
  const contextOnly = cli(root, ['investigate', '--path', 'src/order.txt', '--kind', 'investigation'], executable);
  assert.equal(contextOnly.status, 0);
  assert.deepEqual(contextOnly.data, { ...inspected.data, recipes: [], totalRecipeMatches: 0 });
  assert.notEqual(cli(root, ['investigate', '--path', 'src', '--kind', 'unsupported'], executable).status, 0);
  const nested = spawnSync(process.execPath, [executable, 'investigate', '--path', 'src/order.txt'], { cwd: join(root, 'src'), encoding: 'utf8' });
  assert.equal(nested.status, 0); assert.equal(JSON.parse(nested.stdout).projectRoot, root);
  assert.notEqual(cli(root, ['recipe', 'run', '--recipe', 'orders', '--dry-run'], executable).status, 0);
  assert.equal(existsSync(join(root, '.cyc/runtime/recipes')), false);
  assert.equal(cli(root, ['recipe', 'run', '--recipe', 'orders'], executable).data.passed, true);
  const run = startRun(root, { goal: 'Review orders', playbook: 'review' }); controlRun(root, run.runId, 'pause');
  assert.throws(() => runRecipe(root, 'orders', { run: run.runId }), /running/);
});
