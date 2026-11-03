import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import * as runtime from '../scripts/runtime.mjs';
const { completeRun, controlRun, lockAbandoned, lockIdentity, nextRun, proveRun, quickHandoff, readRun, reclaimLock, retryRun, runCheckProcess, runCommands, startRun, verifyRun } = runtime;
const defaultCheckTimeoutMs = runtime.defaultCheckTimeoutMs;
import * as snapshots from '../scripts/source-snapshot.mjs';
const { inspectSource, saveCache, sourceLimits } = snapshots;
import { outputLimit } from '../scripts/test-output.mjs';

// The October 23 audit found four limits that stop CYC on large repositories: a 60-second default
// check timeout, a 1 MB output buffer that fails passing suites, locks that never clear after a
// crash, and a 20,000-file source cap. These tests pin the fixes and the cases that must stay refused.

process.env.CYC_BASELINE_MODE = 'off';
const dead = 2147483647; // never a live process ID
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function project(t, { commands = [{ id: 'ok', command: process.execPath, args: ['-e', 'process.exit(0)'] }], source } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-limits-'));
  t.after(() => { assert.ok(root.includes('cyc-limits-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  mkdirSync(join(root, '.cyc')); mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/app.mjs'), 'export const app = 1;\n');
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands }, ...(source ? { source } : {}) }));
  return root;
}
const start = root => startRun(root, { goal: 'Check the limits.', playbook: 'verify', criteria: [{ id: 'c1', description: 'works' }] }).runId;
// Other test files run checks at the same time, so a test that counts temporary folders gets its own.
function tempFolder(t, folder = mkdtempSync(join(tmpdir(), 'cyc-limits-temp-'))) {
  const saved = ['TMP', 'TEMP', 'TMPDIR'].map(key => [key, process.env[key]]);
  for (const [key] of saved) process.env[key] = folder;
  t.after(() => { for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } rmSync(folder, { recursive: true, force: true }); });
  return folder;
}

// ---------- timeout ----------

test('timeout: a check without timeoutMs gets a 30-minute default, recorded with its result', t => {
  assert.equal(defaultCheckTimeoutMs, 30 * 60 * 1000);
  const [result] = runCommands(project(t), [{ id: 'ok', command: process.execPath, args: ['-e', 'process.exit(0)'] }]);
  assert.equal(result.passed, true);
  assert.equal(result.timeoutMs, defaultCheckTimeoutMs);
});

test('timeout: a check that runs out of time fails with its limit and how to raise it', t => {
  const [result] = runCommands(project(t), [{ id: 'slow', command: process.execPath, args: ['-e', 'setTimeout(() => {}, 20000)'], timeoutMs: 500 }]);
  assert.equal(result.passed, false);
  assert.equal(result.errorCode, 'ETIMEDOUT');
  assert.match(result.error, /timed out after 500 ms/);
  assert.match(result.error, /timeoutMs/);
  // Cut short by the run's deadline instead, it names the budget, not its own timeout.
  const [cut] = runCommands(project(t), [{ id: 'slow', command: process.execPath, args: ['-e', 'setTimeout(() => {}, 20000)'] }], () => 500);
  assert.equal(cut.errorCode, 'ETIMEDOUT');
  assert.match(cut.error, /time budget \(limits\.maxDurationMs\)/);
  assert.doesNotMatch(cut.error, /timeoutMs/);
});

test('timeout: a timed-out check is stopped with the processes it started', t => {
  const root = project(t);
  const marker = join(root, 'grandchild-ran.txt');
  // The check starts a grandchild that shares its output and would write the marker after 2.5 s, then
  // waits forever. On Windows, Node ends its own children with it, so the grandchild is detached there
  // to stand for one started through cmd or another program; on POSIX it stays in the check's group.
  const grandchild = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran'), 2500)`;
  const check = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'inherit', detached: process.platform === 'win32' }); setTimeout(() => {}, 60000);`;
  const [result] = runCommands(root, [{ id: 'tree', command: process.execPath, args: ['-e', check], timeoutMs: 800 }]);
  assert.equal(result.errorCode, 'ETIMEDOUT');
  pause(3500);
  assert.ok(!existsSync(marker), 'the grandchild was stopped with the check');
});

// A detached process that shares the check's output for a minute and records its process ID, so the
// test can end it afterwards.
function outputHolder(t, root) {
  const pidFile = join(root, 'holder.pid');
  t.after(() => { try { process.kill(Number(readFileSync(pidFile, 'utf8'))); } catch { /* already ended */ } pause(300); });
  return `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 60000)`)}], { stdio: 'inherit', detached: true, cwd: require('node:os').tmpdir() }).unref();`;
}

test('timeout: a check is stopped on time even when something it started escapes the kill and holds its output', t => {
  // The check starts a short-lived process that starts the holder, then exits, so the holder is out of
  // reach of the process tree. The runner stops waiting for its output after a grace period.
  const root = project(t);
  const check = `require('node:child_process').spawnSync(process.execPath, ['-e', ${JSON.stringify(outputHolder(t, root))}], { stdio: 'inherit' }); setTimeout(() => {}, 60000);`;
  const started = Date.now();
  const [result] = runCommands(root, [{ id: 'escape', command: process.execPath, args: ['-e', check], timeoutMs: 500 }]);
  assert.equal(result.errorCode, 'ETIMEDOUT');
  assert.ok(Date.now() - started < 15000, 'the runner did not wait for the escaped process');
});

test('timeout: a check that exits while something it started still holds its output passes', t => {
  const root = project(t);
  const check = `${outputHolder(t, root)} console.log('done');`;
  const started = Date.now();
  const [result] = runCommands(root, [{ id: 'daemon', command: process.execPath, args: ['-e', check], timeoutMs: 30000 }]);
  assert.equal(result.passed, true, result.error ?? '');
  assert.match(result.stdout, /done/);
  assert.ok(Date.now() - started < 8000, 'the result came soon after the check exited');
});

test('timeout: the kill does not depend on PATH', t => {
  const saved = process.env.PATH;
  process.env.PATH = '';
  t.after(() => { process.env.PATH = saved; });
  const started = Date.now();
  const [result] = runCommands(project(t), [{ id: 'slow', command: process.execPath, args: ['-e', 'setTimeout(() => {}, 15000)'], timeoutMs: 1000 }]);
  assert.equal(result.errorCode, 'ETIMEDOUT');
  assert.ok(Date.now() - started < 9000, 'stopped near its limit, not after 15 s');
});

// ---------- output ----------

test('output: a passing check that prints several MB on each stream passes and keeps its tail', t => {
  const root = project(t), temp = tempFolder(t);
  const print = "const line = 'x'.repeat(99) + '\\n'; for (let i = 0; i < 30000; i++) { process.stdout.write(line); process.stderr.write(line); } process.stdout.write('stdout end\\n'); process.stderr.write('stderr end\\n');";
  const [result] = runCommands(root, [{ id: 'loud', command: process.execPath, args: ['-e', print] }]);
  assert.equal(result.passed, true, result.error ?? '');
  assert.equal(result.error, null);
  assert.equal(result.stdout.length, outputLimit);
  assert.ok(result.stdout.endsWith('stdout end\n'));
  assert.ok(result.stderr.endsWith('stderr end\n'));
  assert.deepEqual(readdirSync(temp), [], 'the temporary output files are removed');
});

test('output: test results are read from the whole output, so a failure early in a long run is still named', t => {
  const tap = "let out = 'TAP version 13\\n'; out += 'not ok 1 - early failure\\n'; for (let i = 2; i < 40000; i++) out += 'ok ' + i + ' - filler ' + i + '\\n'; out += '1..39999\\n'; process.stdout.write(out); process.exitCode = 1;";
  const [result] = runCommands(project(t), [{ id: 'unit', command: process.execPath, args: ['-e', tap] }]);
  assert.equal(result.passed, false);
  assert.ok(result.tests?.complete, 'the summary covers the whole output');
  assert.ok(result.tests.failing.some(([, entry]) => entry.leaf === 'early failure'));
});

test('output: output past the reading bound marks the results cut off; the exit code still decides the check', t => {
  const tap = "let out = 'TAP version 13\\nnot ok 1 - early failure\\n'; for (let i = 2; i < 40000; i++) out += 'ok ' + i + ' - filler ' + i + '\\n'; out += 'last line\\n'; process.stdout.write(out); process.exitCode = 0;";
  const [result] = runCommands(project(t), [{ id: 'unit', command: process.execPath, args: ['-e', tap] }], undefined, { readLimit: 64 * 1024 });
  assert.equal(result.passed, true);
  assert.equal(result.tests?.complete, false);
  assert.ok(result.stdout.endsWith('last line\n'), 'the tail past the bound is still kept');
});

test('output: a check that prints without end stores no more than the bound on disk', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'cyc-limits-runner-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const print = "const line = 'y'.repeat(1023) + '\\n'; for (let i = 0; i < 3000; i++) process.stdout.write(line); process.stdout.write('the end\\n');";
  const limit = 64 * 1024;
  const run = await runCheckProcess({ command: process.execPath, args: ['-e', print], cwd: folder, timeoutMs: 30000, limit, tailBytes: 4096, stdout: join(folder, 'stdout'), stderr: join(folder, 'stderr') }, { ...childProcess, ...fs });
  assert.equal(run.status, 0);
  assert.ok(run.bytes.stdout > 3000000, 'the check printed about 3 MB');
  assert.equal(statSync(join(folder, 'stdout')).size, limit, 'only the bound reached the disk');
  assert.ok(statSync(join(folder, 'stdout.tail')).size <= 4096);
  assert.ok(run.tailPeak.stdout <= 4096 + 64 * 1024, 'the tail kept in memory stays bounded');
  assert.ok(readFileSync(join(folder, 'stdout.tail'), 'utf8').endsWith('the end\n'));
});

test('output: a command that cannot start and a timed-out one fail cleanly and leave no temporary files', t => {
  const root = project(t), temp = tempFolder(t);
  const [missing, slow] = runCommands(root, [
    { id: 'missing', command: join(root, 'no-such-program'), args: [] },
    { id: 'slow', command: process.execPath, args: ['-e', 'setTimeout(() => {}, 20000)'], timeoutMs: 300 }
  ]);
  assert.equal(missing.passed, false);
  assert.equal(missing.errorCode, 'ENOENT');
  assert.equal(slow.errorCode, 'ETIMEDOUT');
  assert.deepEqual(readdirSync(temp), []);
});

test('output: a tail never starts with half of a character', t => {
  const print = "process.stdout.write('\\u{1F600}'.repeat(40000) + 'x')";
  for (const options of [undefined, { readLimit: 64 * 1024 }]) {
    const [result] = runCommands(project(t), [{ id: 'emoji', command: process.execPath, args: ['-e', print] }], undefined, options);
    assert.equal(result.passed, true);
    assert.ok(result.stdout.endsWith('x'));
    assert.doesNotMatch(result.stdout, /^[\uDC00-\uDFFF]/);
    assert.ok(result.stdout.length >= outputLimit - 1);
  }
});

test('output: without a usable system temp folder, output is kept in .cyc/runtime and removed', t => {
  const root = project(t);
  tempFolder(t, join(root, 'missing-temp-folder'));
  const [result] = runCommands(root, [{ id: 'ok', command: process.execPath, args: ['-e', "console.log('hello')"] }]);
  assert.equal(result.passed, true, result.error ?? '');
  assert.match(result.stdout, /hello/);
  assert.deepEqual(readdirSync(join(root, '.cyc/runtime/checks')), []);
});

test('output: NODE_OPTIONS reach the check but not the runner', t => {
  const root = project(t);
  const preload = join(root, 'preload.cjs'), loaded = join(root, 'loaded.txt');
  // The preload records each process it runs in and prints, as `-r dotenv/config` does.
  writeFileSync(preload, `require('node:fs').appendFileSync(${JSON.stringify(loaded)}, (process.argv[1] ?? '-e') + '\\n'); process.stdout.write('preloaded\\n'); process.env.PRELOADED = 'yes';`);
  const saved = process.env.NODE_OPTIONS;
  // Inside quotes NODE_OPTIONS treats a backslash as an escape, so the path uses forward slashes.
  process.env.NODE_OPTIONS = `--require "${preload.split('\\').join('/')}"`;
  t.after(() => { if (saved === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = saved; });
  const [result] = runCommands(root, [{ id: 'env', command: process.execPath, args: ['-e', "console.log('check sees ' + process.env.PRELOADED)"] }]);
  assert.equal(result.passed, true, result.error ?? '');
  assert.match(result.stdout, /preloaded\ncheck sees yes/);
  const processes = readFileSync(loaded, 'utf8').trim().split('\n');
  assert.deepEqual(processes, ['-e'], 'only the check loaded the preload, not the runner');
});

// ---------- locks ----------

const here = lockIdentity();
const ownerLock = root => join(root, '.cyc/runs/workspace.lock');
function plantWorkspaceLock(root, owner) {
  mkdirSync(join(root, '.cyc/runs'), { recursive: true });
  writeFileSync(ownerLock(root), typeof owner === 'string' ? owner : JSON.stringify({ operation: 'update run crashed', createdAt: new Date(Date.now() - 60000).toISOString(), ...owner }));
}
const reclaims = root => existsSync(join(root, '.cyc/runs/lock-reclaims.jsonl')) ? readFileSync(join(root, '.cyc/runs/lock-reclaims.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];

test('locks: a workspace lock left by a process that no longer runs on this machine is reclaimed and recorded', t => {
  const root = project(t);
  plantWorkspaceLock(root, { pid: dead, ...here });
  pause(2100); // so the project's files are settled enough to cache
  const id = start(root);
  assert.equal(readRun(root, id).status, 'running');
  assert.ok(existsSync(join(root, '.cyc/runs/source-cache.json')), 'an operation holding the lock updates the hash cache');
  assert.ok(!existsSync(ownerLock(root)), 'the lock is released after the operation');
  assert.ok(!existsSync(`${ownerLock(root)}.reclaim`), 'the reclaim guard is removed');
  const record = reclaims(root);
  assert.equal(record.length, 1);
  assert.equal(record[0].lock, 'workspace');
  assert.equal(record[0].owner.pid, dead);
});

test('locks: a lock whose process is still running is kept; once that process ends it is reclaimed', async t => {
  const root = project(t);
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  t.after(() => child.kill());
  await new Promise(done => child.once('spawn', done));
  plantWorkspaceLock(root, { pid: child.pid, ...here });
  assert.throws(() => start(root), /another CYC operation/);
  assert.equal(reclaims(root).length, 0);
  child.kill();
  await new Promise(done => child.once('exit', done));
  pause(200);
  assert.equal(readRun(root, start(root)).status, 'running');
  assert.equal(reclaims(root)[0].owner.pid, child.pid);
});

test('locks: a lock is never reclaimed when its owner may still matter or cannot be judged', t => {
  for (const [label, owner, why] of [
    ['owner is this process', { pid: process.pid, ...here }, /reclaimed automatically once/],
    ['another host', { pid: dead, ...here, hostname: `${hostname()}-elsewhere` }, /taken on .*-elsewhere/],
    ['another operating system', { pid: dead, ...here, platform: here.platform === 'win32' ? 'linux' : 'win32' }, /cannot see whether/],
    ['another process namespace', { pid: dead, ...here, pidNamespace: 'pid:[1]' }, /another process namespace/],
    ['older engine (no host)', { pid: dead }, /older CYC engine/],
    ['proof with swapped source', { pid: dead, ...here, backupPath: join(tmpdir(), 'cyc-prove-x'), phase: 'prepared' }, /test proof/],
    ['halted proof', { pid: dead, ...here, backupPath: join(tmpdir(), 'cyc-prove-x'), phase: 'halted' }, /test proof/],
    ['phase this engine does not know', { pid: dead, ...here, phase: 'future-phase' }, /phase future-phase/],
    ['commit under way', { pid: dead, ...here, committing: true }, /commit that may not have completed/],
    ['failed publication', { pid: dead, ...here, publicationFailure: { stateCommitted: false, reason: 'EACCES' } }, /commit that may not have completed/],
    ['empty record', '', /empty or unreadable/],
    ['partly written record', '{"operation":"update run x","pid":12', /empty or unreadable/]
  ]) {
    const root = project(t);
    plantWorkspaceLock(root, owner);
    const before = readFileSync(ownerLock(root), 'utf8');
    assert.throws(() => start(root), error => /another CYC operation/.test(error.message) && why.test(error.message), label);
    assert.equal(readFileSync(ownerLock(root), 'utf8'), before, `${label}: the lock is untouched`);
    assert.equal(reclaims(root).length, 0, `${label}: nothing reclaimed`);
  }
});

test('locks: only the holder of the reclaim guard may remove a lock, and a leftover guard is named', t => {
  for (const [label, guardPid, state] of [['another reclaimer is working', process.pid, 'still running'], ['a reclaimer crashed', dead, 'no longer running']]) {
    const root = project(t);
    plantWorkspaceLock(root, { pid: dead, ...here });
    writeFileSync(`${ownerLock(root)}.reclaim`, JSON.stringify({ pid: guardPid, ...here }));
    const before = readFileSync(ownerLock(root), 'utf8');
    assert.throws(() => start(root), new RegExp(`reclaim guard .* from PID ${guardPid} \\(${state}\\)`), label);
    assert.equal(readFileSync(ownerLock(root), 'utf8'), before, label);
  }
});

test('locks: a reclaim removes the lock only if it still holds the owner that was judged', t => {
  const root = project(t);
  plantWorkspaceLock(root, { pid: dead, ...here });
  const path = ownerLock(root), raw = readFileSync(path, 'utf8');
  const judged = { ...JSON.parse(raw), path, raw };
  assert.equal(lockAbandoned(judged), true);
  // Another operation took the lock after the judgement: its record differs, so it stays.
  assert.equal(reclaimLock(root, path, { ...judged, raw: raw.replace('crashed', 'newer') }, 'workspace'), false);
  assert.equal(readFileSync(path, 'utf8'), raw);
  assert.ok(!existsSync(`${path}.reclaim`));
  assert.equal(reclaimLock(root, path, judged, 'workspace'), true);
  assert.ok(!existsSync(path));
  assert.equal(reclaims(root).length, 1);
});

test('locks: a run lock left by a dead process on this machine is reclaimed; an older empty one is not', t => {
  const root = project(t);
  const id = start(root);
  const runLock = join(root, `.cyc/runs/${id}/state.json.lock`);
  writeFileSync(runLock, JSON.stringify({ pid: dead, ...here, createdAt: new Date().toISOString() }));
  assert.equal(controlRun(root, id, 'pause').status, 'paused');
  assert.ok(!existsSync(runLock));
  writeFileSync(runLock, '');
  assert.throws(() => controlRun(root, id, 'resume'), /already being updated.*empty or unreadable/);
  assert.ok(existsSync(runLock), 'an empty lock from an older engine is left for the operator');
});

test('locks: while a check runs, the operation lock says until when, and a lock is not reclaimed before then', t => {
  const root = project(t, { commands: [{ id: 'peek', command: process.execPath, args: ['-e', "process.stdout.write(require('node:fs').readFileSync('.cyc/runs/workspace.lock', 'utf8'))"], timeoutMs: 60000 }] });
  const id = start(root);
  // A verify-playbook run checks under the lock; the check reads the lock it runs under.
  quickHandoff(root, id, { summary: 'Located the check.' });
  verifyRun(root, id);
  const lockSeen = JSON.parse(readRun(root, id).verification.results[0].stdout);
  assert.ok(lockSeen.checkUntil > Date.now(), 'the lock recorded how long the check may run');
  assert.ok(!existsSync(ownerLock(root)));
  const other = project(t);
  plantWorkspaceLock(other, { pid: dead, ...here, checkUntil: Date.now() + 600000 });
  assert.throws(() => start(other), /may still be running until/);
  plantWorkspaceLock(other, { pid: dead, ...here, checkUntil: Date.now() - 1000 });
  assert.equal(readRun(other, start(other)).status, 'running');
});

test('locks: reclaiming a lock left by a run-start measurement records that the measurement failed', t => {
  const root = project(t);
  const id = start(root);
  const statePath = join(root, `.cyc/runs/${id}/state.json`);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.baseline = { status: 'pending', cacheKey: 'k', sourceHash: state.initialSource.hash, requestedAt: new Date().toISOString() };
  writeFileSync(statePath, JSON.stringify(state));
  assert.equal(nextRun(root, id).baseline, 'measuring');
  plantWorkspaceLock(root, { operation: `baseline run ${id}`, pid: dead, ...here });
  controlRun(root, id, 'pause');
  assert.equal(nextRun(root, id).baseline, 'error');
});

test('locks: both locks record a commit before it starts, so a failed commit is never reclaimed as abandoned', t => {
  const root = project(t);
  const id = start(root);
  const runLock = join(root, `.cyc/runs/${id}/state.json.lock`);
  // The generated review cannot be published over a directory, so the commit fails after state is saved.
  rmSync(join(root, `.cyc/runs/${id}/review.md`));
  mkdirSync(join(root, `.cyc/runs/${id}/review.md`));
  assert.throws(() => controlRun(root, id, 'pause'), /publication failed/);
  for (const path of [ownerLock(root), runLock]) {
    const owner = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(owner.committing, true, path);
    // As if the process had crashed and its failure record had not been written: still kept.
    delete owner.publicationFailure;
    writeFileSync(path, JSON.stringify({ ...owner, pid: dead }));
  }
  rmSync(join(root, `.cyc/runs/${id}/review.md`), { recursive: true });
  assert.throws(() => controlRun(root, id, 'resume'), /commit that may not have completed/);
  assert.ok(existsSync(ownerLock(root)) && existsSync(runLock));
  assert.equal(reclaims(root).length, 0);
});

// ---------- size ----------

test('size: the default limits allow large repositories and can be set in source', t => {
  assert.equal(sourceLimits.maxFiles, 200000);
  assert.equal(sourceLimits.maxBytes, 2 * 1024 * 1024 * 1024);
  const root = project(t, { source: { maxFiles: 3 } });
  for (let i = 0; i < 4; i++) writeFileSync(join(root, `src/f${i}.mjs`), `export const v = ${i};\n`);
  assert.throws(() => inspectSource(root), /more than 3 files.*source\.maxFiles/s);
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, verification: { commands: [] }, source: { maxFiles: 0 } }));
  assert.throws(() => inspectSource(root), /source\.maxFiles must be a positive integer/);
});

test('size: cached hashes serve only snapshots that ask for them; evidence snapshots hash every file and repair the cache', t => {
  const root = project(t);
  const file = join(root, 'src/app.mjs');
  const old = new Date(Date.now() - 60000);
  utimesSync(file, old, old);
  // Setting the times moved the change time to now; the file is cached only once both times are two
  // seconds old.
  pause(2100);
  const cachePath = join(root, '.cyc/runs/source-cache.json');
  inspectSource(root, { useCache: true });
  assert.ok(!existsSync(cachePath), 'a read-only snapshot never writes the cache');
  const real = inspectSource(root, { writeCache: true }).snapshot.files['src/app.mjs'];
  const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  assert.ok(cache.entries['src/app.mjs'], 'a settled file is cached');
  // A wrong hash for an unchanged file, as a write that moved no timestamp would leave: snapshots that
  // use the cache return it, the default snapshot reads the file, and a writing one repairs the entry.
  cache.entries['src/app.mjs'][3] = 'f'.repeat(64);
  writeFileSync(cachePath, JSON.stringify(cache));
  assert.equal(inspectSource(root, { useCache: true }).snapshot.files['src/app.mjs'], 'f'.repeat(64));
  assert.equal(inspectSource(root).snapshot.files['src/app.mjs'], real);
  inspectSource(root, { writeCache: true });
  assert.equal(JSON.parse(readFileSync(cachePath, 'utf8')).entries['src/app.mjs'][3], real);
  // Same size, same modification time, different bytes: the change time moves, so it is hashed again.
  writeFileSync(file, 'export const app = 2;\n');
  utimesSync(file, old, old);
  const changed = inspectSource(root, { useCache: true }).snapshot.files['src/app.mjs'];
  assert.notEqual(changed, real);
  // The file ID and the re-check after reading guard against a file replaced or changed mid-read;
  // neither can be staged deterministically here, so they rest on review.
});

test('size: snapshots given a stage collect cache updates and reuse them; only saving the stage writes the cache', t => {
  const root = project(t);
  pause(2100);
  const cachePath = join(root, '.cyc/runs/source-cache.json');
  const stage = {};
  const real = inspectSource(root, { writeCache: stage }).snapshot.files['src/app.mjs'];
  assert.ok(!existsSync(cachePath), 'a staged update is not written');
  assert.equal(stage.entries['src/app.mjs'][3], real);
  // A later snapshot of the same operation uses the staged hash, as it would one stored on disk.
  stage.entries['src/app.mjs'][3] = 'f'.repeat(64);
  assert.equal(inspectSource(root, { useCache: true, writeCache: stage }).snapshot.files['src/app.mjs'], 'f'.repeat(64));
  inspectSource(root, { writeCache: stage });
  assert.equal(stage.entries['src/app.mjs'][3], real, 'a full snapshot repairs the staged entry');
  saveCache(root, stage);
  assert.equal(JSON.parse(readFileSync(cachePath, 'utf8')).entries['src/app.mjs'][3], real);
});

test('size: saving a stage drops an entry a snapshot proved wrong before it threw', t => {
  const root = project(t);
  const cachedHash = inspectSource(root).snapshot.files['src/app.mjs'];
  writeFileSync(join(root, 'src/app.mjs'), 'export const app = 9;\n');
  staleCacheEntry(root, 'src/app.mjs', cachedHash);
  // A later file goes over the byte limit, so the snapshot throws after reading src/app.mjs.
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, verification: { commands: [] }, source: { maxBytes: 100 } }));
  writeFileSync(join(root, 'src/zz.mjs'), 'x'.repeat(200));
  const stage = {};
  assert.throws(() => inspectSource(root, { writeCache: stage }), /larger than 100 bytes/);
  saveCache(root, stage);
  const entry = JSON.parse(readFileSync(join(root, '.cyc/runs/source-cache.json'), 'utf8')).entries['src/app.mjs'];
  assert.notEqual(entry?.[3], cachedHash, 'an operation that caught the error and returned does not keep the wrong hash');
});

test('size: a refused operation leaves the hash cache as it was, even when every file has settled', t => {
  const root = project(t);
  const scout = { approach: { kind: 'repair', evidence: 'src/app.mjs holds the value.' }, alignment: { status: 'confirmed', evidence: 'Fixture.' },
    consumers: [{ id: 'app', description: 'the app value', check: 'the ok check' }] };
  const id = startRun(root, { goal: 'Fix the app.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'works' }], scout, plan: 'Write a test, then fix.' }).runId;
  // A file no earlier operation has hashed, so a snapshot of the proof has a settled hash to store.
  writeFileSync(join(root, 'src/extra.mjs'), 'export const extra = 1;\n');
  pause(2100);
  const cachePath = join(root, '.cyc/runs/source-cache.json');
  const cache = () => existsSync(cachePath) ? readFileSync(cachePath) : null;
  const before = cache();
  // The proof takes its first snapshot under the operation lock, then refuses.
  assert.throws(() => proveRun(root, id), /No new or changed test files found/);
  assert.deepEqual(cache(), before, 'the refused proof stored no hashes');
  // That a successful operation stores them is checked by the first lock test.
});

// A wrong hash for a file whose bytes changed, with every timestamp as cached: what a memory-mapped
// write on Windows leaves behind.
function staleCacheEntry(root, path, hash) {
  const cachePath = join(root, '.cyc/runs/source-cache.json');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : { version: 1, entries: {} };
  const stat = statSync(join(root, path));
  cache.entries[path] = [stat.size, stat.mtimeMs, stat.ctimeMs, hash, Date.now(), stat.ino];
  mkdirSync(join(root, '.cyc/runs'), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache));
}

test('size: a verification receipt is bound to the bytes on disk, not to a cached hash', t => {
  const root = project(t);
  const id = start(root);
  quickHandoff(root, id, { summary: 'Located the check.' });
  const real = inspectSource(root).snapshot.hash;
  staleCacheEntry(root, 'src/app.mjs', 'f'.repeat(64));
  verifyRun(root, id);
  const first = readRun(root, id).verification;
  // The stale hash can only make the check look unstable; the snapshot after it reads every file.
  assert.ok(!first?.passed || first.sourceHash === real, 'never a passing receipt for the cached hash');
  verifyRun(root, id);
  const second = readRun(root, id).verification;
  assert.equal(second.passed, true);
  assert.equal(second.sourceHash, real);
});

test('size: completion reads every file, so a change the cache cannot see still stops it', t => {
  const root = project(t);
  const id = start(root);
  quickHandoff(root, id, { summary: 'Located the check.' });
  verifyRun(root, id);
  for (let i = 0; i < 2; i++) quickHandoff(root, id, { summary: 'Checked the behavior.', passedEvidence: 'The configured check passed on current source.' });
  const recorded = readRun(root, id).handoffs.at(-1).sourceHash;
  // The file changes, and the cache is made to claim it did not.
  const cachedHash = inspectSource(root).snapshot.files['src/app.mjs'];
  writeFileSync(join(root, 'src/app.mjs'), 'export const app = 9;\n');
  staleCacheEntry(root, 'src/app.mjs', cachedHash);
  assert.equal(inspectSource(root, { useCache: true }).snapshot.hash, recorded, 'the cache hides the change');
  assert.throws(() => completeRun(root, id), /changed after the delivery review/);
});

test('size: a refused operation still removes a cache entry its full read proved wrong', t => {
  const root = project(t);
  const id = start(root);
  quickHandoff(root, id, { summary: 'Located the check.' });
  verifyRun(root, id);
  for (let i = 0; i < 2; i++) quickHandoff(root, id, { summary: 'Checked the behavior.', passedEvidence: 'The configured check passed on current source.' });
  const cachedHash = inspectSource(root).snapshot.files['src/app.mjs'];
  writeFileSync(join(root, 'src/app.mjs'), 'export const app = 9;\n');
  staleCacheEntry(root, 'src/app.mjs', cachedHash);
  // Completion reads every file and refuses; the entry it disproved must not outlive the refusal.
  assert.throws(() => completeRun(root, id), /changed after the delivery review/);
  const entry = JSON.parse(readFileSync(join(root, '.cyc/runs/source-cache.json'), 'utf8')).entries['src/app.mjs'];
  assert.notEqual(entry?.[3], cachedHash, 'the wrong hash is gone');
  // Otherwise the next verification compares the cached view with the bytes on disk, finds them
  // different, and is charged a failed attempt.
  retryRun(root, id, { stage: 'verify', reason: 'Source changed after the delivery review.' });
  const failures = readRun(root, id).failures;
  verifyRun(root, id);
  assert.equal(readRun(root, id).verification.passed, true);
  assert.equal(readRun(root, id).failures, failures, 'no attempt is lost');
});

test('size: a file modified moments ago is never cached', t => {
  const root = project(t);
  inspectSource(root, { writeCache: true });
  const cachePath = join(root, '.cyc/runs/source-cache.json');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : { entries: {} };
  assert.equal(cache.entries['src/app.mjs'], undefined, 'a file written just now is not cached yet');
});

test('size: a file named __proto__ is part of the snapshot', t => {
  const root = project(t);
  writeFileSync(join(root, '__proto__'), 'one');
  const first = inspectSource(root).snapshot;
  assert.ok(Object.hasOwn(first.files, '__proto__'));
  writeFileSync(join(root, '__proto__'), 'two');
  assert.notEqual(inspectSource(root).snapshot.hash, first.hash);
});

test('size: Git file selection lists every file of a repository with thousands of files', t => {
  const root = project(t);
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-q');
  for (let d = 0; d < 30; d++) { mkdirSync(join(root, `pkg${d}`)); for (let f = 0; f < 100; f++) writeFileSync(join(root, `pkg${d}`, `f${f}.mjs`), `export const v = ${f};\n`); }
  git('add', '-A');
  assert.equal(Object.keys(inspectSource(root).snapshot.files).length, 3000 + 2);
});
