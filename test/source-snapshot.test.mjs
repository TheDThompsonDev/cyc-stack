import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync, symlinkSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourceSnapshot, startRun, quickHandoff, verifyRun, nextRun, readRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

function fixture(t, git = true) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-source-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); rmSync(root, { recursive: true, force: true }); });
  if (git) assert.equal(spawnSync('git', ['init', root], { windowsHide: true }).status, 0);
  return root;
}
function put(root, name, content) { mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), content); }

test('Git selection skips huge ignored output, caches and untracked secrets but covers changed source', t => {
  const root = fixture(t);
  put(root, '.gitignore', 'output/\n.eslintcache\nnext-env.d.ts\n');
  put(root, 'output/large.bin', Buffer.alloc(129 * 1024 * 1024));
  put(root, '.eslintcache', 'old'); put(root, '.env.local', 'private'); put(root, 'src/app.js', 'before');
  const before = sourceSnapshot(root);
  assert.equal(before.selection, 'git');
  assert.equal(before.files['output/large.bin'], undefined);
  assert.equal(before.files['.env.local'], undefined);
  put(root, '.eslintcache', 'new'); put(root, 'next-env.d.ts', 'generated');
  assert.equal(sourceSnapshot(root).hash, before.hash);
  put(root, 'src/app.js', 'after');
  assert.notEqual(sourceSnapshot(root).hash, before.hash);
});

test('tracked ignored files cannot be excluded and deletion changes the fingerprint', t => {
  const root = fixture(t);
  put(root, 'output/tracked.js', 'input');
  assert.equal(spawnSync('git', ['-C', root, 'add', 'output/tracked.js']).status, 0);
  put(root, '.gitignore', 'output/\n');
  put(root, '.cyc/config.json', JSON.stringify({ source: { exclude: ['output'] } }));
  const before = sourceSnapshot(root); assert.ok(before.files['output/tracked.js']);
  renameSync(join(root, 'output/tracked.js'), join(root, 'output/untracked.js'));
  assert.notEqual(sourceSnapshot(root).hash, before.hash);
});

test('explicit generated inputs are covered and non-Git excludes remain available', t => {
  for (const git of [true, false]) {
    const root = fixture(t, git);
    put(root, '.gitignore', 'generated/\n');
    put(root, '.cyc/config.json', JSON.stringify({ source: { include: ['generated/input.js'], exclude: ['output'] } }));
    put(root, 'generated/input.js', 'one'); put(root, 'output/cache', 'ignored');
    const before = sourceSnapshot(root); assert.ok(before.files['generated/input.js']); assert.equal(before.files['output/cache'], undefined);
    put(root, 'generated/input.js', 'two'); assert.notEqual(sourceSnapshot(root).hash, before.hash);
  }
});

test('explicit inclusion never follows a junction into an external directory', t => {
  const root = fixture(t); const outside = fixture(t, false);
  put(outside, 'private.txt', 'do not read');
  try { symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (e) { if (e.code === 'EPERM') return t.skip('Symlinks unavailable'); throw e; }
  put(root, '.gitignore', 'linked/\n');
  put(root, '.cyc/config.json', JSON.stringify({ source: { include: ['linked/private.txt'] } }));
  const result = sourceSnapshot(root); assert.equal(result.files['linked/private.txt'], undefined); assert.equal(result.skipped[0].path, 'linked');
});

test('cache-writing checks keep a valid baseline and do not spend a repair attempt', t => {
  const root = fixture(t);
  put(root, '.gitignore', '.eslintcache\nnext-env.d.ts\n');
  put(root, '.cyc/config.json', JSON.stringify({ verification: { baseline: true, commands: [{ id: 'generated-check', command: process.execPath, args: ['-e', "const fs=require('node:fs');fs.writeFileSync('.eslintcache',String(Date.now()));fs.writeFileSync('next-env.d.ts','generated');"] }] } }));
  const id = startRun(root, { goal: 'Check generated artifacts', playbook: 'feature', baselineMode: 'sync' }).runId;
  assert.equal(nextRun(root, id).baseline, 'complete');
  quickHandoff(root, id, { summary: 'Plan recorded', assessment: fixtureAssessment(readRun(root, id)) });
  // Nothing changes in this fixture; the Build lists the file it stands for.
  quickHandoff(root, id, { summary: 'Candidate ready', artifacts: ['.gitignore'] });
  const result = verifyRun(root, id);
  assert.equal(result.passed, true); assert.deepEqual(result.changedPaths, []);
  assert.equal(readRun(root, id).failures, 0);
});

function policyInventory(root) {
  const entries = {};
  function visit(name) {
    const path = join(root, name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) { entries[name] = ['link', readlinkSync(path)]; return; }
    if (stat.isFile()) { entries[name] = ['file', readFileSync(path).toString('hex')]; return; }
    entries[name] = ['directory'];
    for (const child of readdirSync(path).sort()) visit(name ? name + '/' + child : child);
  }
  visit('');
  return entries;
}
function policyFixture(t, git = false) {
  const root = fixture(t, git);
  put(root, 'src/input.js', 'original');
  const config = { verification: { baseline: true, commands: [{ id: 'check', command: process.execPath, args: ['-e', "require('node:fs').writeFileSync('check-ran','yes')"] }] } };
  put(root, '.cyc/config.json', JSON.stringify(config));
  return { root, config };
}
for (const field of ['include', 'exclude']) for (const pattern of ['build/*.json', 'build/inpu?.json']) {
  test('literal source policy snapshot rejects ' + field + ' ' + pattern, t => {
    for (const git of [true, false]) {
      const { root, config } = policyFixture(t, git);
      put(root, 'build/input.json', 'one');
      config.source = { [field]: [pattern] };
      put(root, '.cyc/config.json', JSON.stringify(config));
      const before = policyInventory(root);
      assert.throws(() => sourceSnapshot(root), /source\.(include|exclude).*literal.*(file|directory)/i);
      assert.deepEqual(policyInventory(root), before);
    }
  });
  test('literal source policy startup rejects ' + field + ' ' + pattern + ' before effects', t => {
    const { root, config } = policyFixture(t);
    const existing = startRun(root, { goal: 'Retained advisory', playbook: 'investigation' }).runId;
    config.source = { [field]: [pattern] };
    put(root, '.cyc/config.json', JSON.stringify(config));
    const before = policyInventory(root), state = readRun(root, existing);
    assert.throws(() => startRun(root, { goal: 'Reject invalid coverage', playbook: 'bug-fix', baselineMode: 'sync' }), /source\.(include|exclude).*literal.*(file|directory)/i);
    assert.deepEqual(policyInventory(root), before);
    assert.deepEqual(readRun(root, existing), state);
  });
}
for (const field of ['include', 'exclude']) for (const input of ['json', 'flags']) {
  test('literal source policy public ' + input + ' startup rejects ' + field + ' before effects', t => {
    const { root, config } = policyFixture(t);
    config.source = { [field]: ['build/*.json'] };
    put(root, '.cyc/config.json', JSON.stringify(config));
    const cli = resolve('bin/cyc.mjs');
    let args = ['run', 'start', '--goal', 'Reject invalid source policy', '--playbook', 'bug-fix'];
    if (input === 'json') {
      put(root, '.cyc/runtime/start.json', JSON.stringify({ goal: 'Reject invalid source policy', playbook: 'bug-fix', allowedPaths: ['src/input.js'] }));
      args = ['run', 'start', '--file', join(root, '.cyc/runtime/start.json')];
    }
    const before = policyInventory(root);
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, CYC_BASELINE_MODE: 'sync' } });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /source\.(include|exclude).*literal.*(file|directory)/i);
    assert.deepEqual(policyInventory(root), before);
  });
}
test('literal source policy malformed arrays reject before creating run storage', t => {
  for (const field of ['include', 'exclude']) {
    const { root, config } = policyFixture(t);
    config.source = { [field]: 'build/input.json' };
    put(root, '.cyc/config.json', JSON.stringify(config));
    const before = policyInventory(root);
    assert.throws(() => startRun(root, { goal: 'Reject invalid coverage', playbook: 'bug-fix' }), /source\.(include|exclude).*literal/i);
    assert.deepEqual(policyInventory(root), before);
  }
});
test('literal source policy invalid startup preserves dirty Git objects, index and originals', t => {
  const { root, config } = policyFixture(t, true);
  const git = args => spawnSync('git', ['-C', root, ...args], { windowsHide: true, encoding: 'utf8' });
  assert.equal(git(['add', '.']).status, 0);
  assert.equal(git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture only']).status, 0);
  put(root, 'src/input.js', 'dirty working bytes');
  put(root, 'untracked.js', 'uncommitted original');
  config.source = { include: ['build/*.json'] };
  put(root, '.cyc/config.json', JSON.stringify(config));
  const before = policyInventory(root);
  assert.throws(() => startRun(root, { goal: 'Reject invalid coverage', playbook: 'bug-fix', baselineMode: 'sync' }), /source\.include.*literal/i);
  assert.deepEqual(policyInventory(root), before);
});
test('literal source policy ordinary future, spaced, Unicode and bracket inputs retain exact coverage', t => {
  for (const git of [true, false]) {
    const { root, config } = policyFixture(t, git);
    config.source = { include: ['build/[id]/café input.json', 'build/future.json'], exclude: ['output/[old]'] };
    put(root, '.gitignore', 'build/\noutput/\n');
    put(root, '.cyc/config.json', JSON.stringify(config));
    put(root, 'build/[id]/café input.json', 'one');
    put(root, 'output/[old]/cache', 'ignored');
    const before = sourceSnapshot(root);
    assert.ok(before.files['build/[id]/café input.json']);
    assert.equal(before.files['build/future.json'], undefined);
    assert.equal(before.files['output/[old]/cache'], undefined);
    put(root, 'build/[id]/café input.json', 'two');
    assert.notEqual(sourceSnapshot(root).hash, before.hash);
    put(root, 'build/future.json', 'new input');
    assert.ok(sourceSnapshot(root).files['build/future.json']);
  }
});
test('literal source policy wildcard beyond external junction rejects while ordinary includes stay skipped', t => {
  const { root, config } = policyFixture(t), outside = fixture(t, false);
  put(outside, 'private.json', 'private external bytes');
  try { symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (e) { if (e.code === 'EPERM') return t.skip('Symlinks unavailable'); throw e; }
  for (const field of ['include', 'exclude']) {
    config.source = { [field]: ['linked/*.json'] };
    put(root, '.cyc/config.json', JSON.stringify(config));
    const before = policyInventory(root), outsideBefore = policyInventory(outside);
    assert.throws(() => sourceSnapshot(root), /source\.(include|exclude).*literal/i);
    assert.throws(() => startRun(root, { goal: 'Reject pattern beyond link', playbook: 'bug-fix' }), /source\.(include|exclude).*literal/i);
    assert.deepEqual(policyInventory(root), before);
    assert.deepEqual(policyInventory(outside), outsideBefore);
  }
  config.source = { include: ['linked/private.json'] };
  put(root, '.cyc/config.json', JSON.stringify(config));
  const snapshot = sourceSnapshot(root);
  assert.equal(snapshot.files['linked/private.json'], undefined);
  assert.ok(snapshot.skipped.some(entry => entry.path === 'linked'));
});
test('literal source policy existing POSIX wildcard components remain literal', { skip: process.platform === 'win32' }, t => {
  const { root, config } = policyFixture(t);
  put(root, 'build/literal*/input?.json', 'one');
  config.source = { include: ['build/literal*/input?.json', 'build/literal*/future.json'], exclude: [] };
  put(root, '.cyc/config.json', JSON.stringify(config));
  const before = sourceSnapshot(root);
  assert.ok(before.files['build/literal*/input?.json']);
  put(root, 'build/literal*/input?.json', 'two');
  assert.notEqual(sourceSnapshot(root).hash, before.hash);
  put(root, 'build/literal*/future.json', 'new');
  assert.ok(sourceSnapshot(root).files['build/literal*/future.json']);
});
