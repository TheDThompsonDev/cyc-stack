import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inspectSource, readJobs, shareJobs } from '../scripts/source-snapshot.mjs';

// Full-content snapshots read files on worker threads. These tests force workers on small projects and
// hold every result to a snapshot read on one thread: the same files, hashes, order, errors and cache.

const scripts = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function folder(t, prefix = 'cyc-hashing-') {
  const path = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => { assert.ok(path.includes(prefix)); rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  return path;
}
function put(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function project(t, files, source) {
  const root = folder(t);
  put(root, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, verification: { commands: [] }, ...(source ? { source } : {}) }));
  for (const [path, content] of Object.entries(files)) put(root, path, content);
  return root;
}
const git = (root, ...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
// Returns the error a snapshot throws, so serial and parallel failures can be compared whole.
function failure(run) {
  try { run(); } catch (error) { return error; }
  assert.fail('the snapshot should have failed');
}
// Denies reading a file's bytes while leaving its attributes readable, so lstat succeeds and open fails.
function unreadable(t, file) {
  if (process.platform === 'win32') {
    const user = process.env.USERNAME;
    if (spawnSync('icacls', [file, '/deny', `${user}:(RD)`]).status !== 0) return false;
    t.after(() => { if (existsSync(file)) spawnSync('icacls', [file, '/remove:d', user]); });
  } else {
    if (process.getuid?.() === 0) return false;
    chmodSync(file, 0);
    t.after(() => { if (existsSync(file)) chmodSync(file, 0o644); });
  }
  try { readFileSync(file); return false; } catch { return true; }
}

test('parallel reads match a serial snapshot file for file: links, directories, vanished files, large files and key order', t => {
  const big = Buffer.alloc(2.5 * 1024 * 1024 + 7);
  for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) % 251;
  const root = project(t, {
    'src/app.mjs': 'export const app = 1;\n', 'src/empty.txt': '', 'big.bin': big, '123': 'integer-like name', ['__proto__']: 'proto',
    'name with spaces.txt': 'spaces', 'ünïcödé ✓.txt': 'unicode', 'deep/x/y/z.txt': 'deep', 'gone.txt': 'deleted later', module: 'a file, then a folder',
    '.gitignore': 'generated/\n', 'generated/api.d.ts': 'export type Api = 1;\n', 'generated/cache.bin': 'ignored'
  }, { include: ['generated/api.d.ts'], exclude: ['vendor'] });
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  put(root, 'vendor/lib.js', 'untracked and excluded');
  // A tracked file deleted from disk, and a tracked file replaced by a folder (as a submodule appears).
  rmSync(join(root, 'gone.txt'));
  rmSync(join(root, 'module'));
  put(root, 'module/inner.txt', 'inside the folder');
  const outside = folder(t, 'cyc-hashing-outside-');
  put(outside, 'secret.txt', 'never read');
  let linked = true, fileLinked = true;
  try { symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code !== 'EPERM') throw error; linked = false; }
  // A link to a file outside the project: a worker that followed it would hash the target's bytes.
  // Windows refuses file links without developer mode, so this part runs where links are allowed.
  try { symlinkSync(join(outside, 'secret.txt'), join(root, 'file-link.txt'), 'file'); }
  catch (error) { if (error.code !== 'EPERM') throw error; fileLinked = false; }

  const serial = inspectSource(root, { workers: 0 });
  const parallel = inspectSource(root, { workers: 3 });
  assert.deepEqual(parallel.snapshot, serial.snapshot);
  assert.equal(parallel.snapshot.hash, serial.snapshot.hash);
  assert.deepEqual(Object.keys(parallel.snapshot.files), Object.keys(serial.snapshot.files), 'the same key order, which the hash depends on');
  assert.deepEqual(serial.hashing, { workers: 0, readByWorkers: 0 });

  // Every regular file was read and hashed by a worker, and each hash is the SHA-256 of the bytes on disk.
  const special = new Set(serial.snapshot.skipped.map(entry => entry.path));
  const regular = Object.keys(serial.snapshot.files).filter(path => !special.has(path));
  assert.equal(parallel.hashing.workers, 3);
  assert.equal(parallel.hashing.readByWorkers, regular.length);
  for (const path of regular) assert.equal(parallel.snapshot.files[path], sha(readFileSync(join(root, path))), path);

  const { files, skipped } = parallel.snapshot;
  assert.equal(files['big.bin'], sha(big), 'a file larger than one read chunk');
  for (const name of ['__proto__', '123', 'ünïcödé ✓.txt']) assert.ok(Object.hasOwn(files, name), `${name} in ${Object.keys(files)}`);
  assert.equal(files['gone.txt'], undefined, 'a vanished tracked file is left out');
  assert.equal(files.module, sha('directory-entry'));
  assert.ok(files['module/inner.txt']);
  assert.ok(files['generated/api.d.ts'] && !files['generated/cache.bin'] && !files['vendor/lib.js']);
  if (linked) {
    assert.ok(skipped.some(entry => entry.path === 'linked'), 'the link is recorded, not followed');
    assert.ok(!Object.keys(files).some(path => path.startsWith('linked/')));
  }
  if (fileLinked) {
    const target = join(outside, 'secret.txt');
    assert.equal(files['file-link.txt'], sha(`symlink:${target}`), 'a file link is recorded by its target, not read');
    assert.ok(skipped.some(entry => entry.path === 'file-link.txt' && entry.target === target));
  }
});

test('a limit stops a parallel snapshot with the serial error, and errors keep their place in path order', t => {
  const files = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`f${i}.txt`, 'x'.repeat(10 + i)]));
  // Byte limits: one below .cyc/config.json alone (raised before any worker read), and one that
  // .cyc/config.json, f0 and f1 fit but f2 passes, each file within it (raised on a worker's read).
  const configBytes = source => JSON.stringify({ schemaVersion: 1, verification: { commands: [] }, source }).length;
  const cumulative = configBytes({ maxBytes: 100 }) + 25;
  assert.equal(configBytes({ maxBytes: cumulative }), cumulative - 25);
  for (const source of [{ maxFiles: 3 }, { maxBytes: 25 }, { maxBytes: cumulative }]) {
    const root = project(t, files, source);
    const serial = failure(() => inspectSource(root, { workers: 0 }));
    const parallel = failure(() => inspectSource(root, { workers: 3 }));
    assert.match(serial.message, source.maxFiles ? /more than 3 files.*source\.maxFiles/s : new RegExp(`larger than ${source.maxBytes} bytes.*source\\.maxBytes`, 's'));
    assert.equal(parallel.message, serial.message);
  }
  // An unreadable file before the limit fails the snapshot with its read error; one after it, with the limit.
  for (const [name, expected] of [['a-locked.txt', 'read'], ['z-locked.txt', 'limit']]) {
    const root = project(t, { ...files, [name]: 'locked' }, { maxFiles: 3 });
    if (!unreadable(t, join(root, name))) return t.skip('Cannot make a file unreadable here');
    const serial = failure(() => inspectSource(root, { workers: 0 }));
    const parallel = failure(() => inspectSource(root, { workers: 3 }));
    if (expected === 'read') assert.ok(['EPERM', 'EACCES'].includes(serial.code), serial.message);
    else assert.match(serial.message, /more than 3 files/);
    assert.equal(parallel.message, serial.message, name);
    assert.equal(parallel.code, serial.code, name);
  }
});

test('an evidence snapshot on workers reads past a stale cache entry and refreshes the cache by the serial rules', t => {
  const root = project(t, { 'src/app.mjs': 'export const app = 1;\n', 'src/other.mjs': 'export const other = 2;\n' });
  const old = new Date(Date.now() - 60000);
  for (const path of ['src/app.mjs', 'src/other.mjs']) utimesSync(join(root, path), old, old);
  pause(2100); // settled, so the files may be cached
  const cachePath = join(root, '.cyc/runs/source-cache.json');
  const entries = () => JSON.parse(readFileSync(cachePath, 'utf8')).entries;
  const withoutTime = list => Object.fromEntries(Object.entries(list).map(([path, entry]) => [path, entry.filter((_, i) => i !== 4)]));
  inspectSource(root, { writeCache: true, workers: 0 });
  const serialEntries = withoutTime(entries());
  rmSync(cachePath);
  const real = inspectSource(root, { writeCache: true, workers: 2 });
  assert.equal(real.hashing.readByWorkers, 3, 'the two files and .cyc/config.json');
  assert.deepEqual(withoutTime(entries()), serialEntries, 'workers cache the same entries');

  // A wrong hash for an unchanged file, as a memory-mapped write leaves behind.
  const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  cache.entries['src/app.mjs'][3] = 'f'.repeat(64);
  writeFileSync(cachePath, JSON.stringify(cache));
  const view = inspectSource(root, { useCache: true, workers: 4 });
  assert.equal(view.snapshot.files['src/app.mjs'], 'f'.repeat(64), 'a cached view still uses the cache');
  assert.deepEqual(view.hashing, { workers: 0, readByWorkers: 0 }, 'and is not read on workers');
  assert.deepEqual(inspectSource(root, { signatures: 'stat', workers: 4 }).hashing, { workers: 0, readByWorkers: 0 });
  const evidence = inspectSource(root, { writeCache: true, workers: 2 });
  assert.equal(evidence.snapshot.files['src/app.mjs'], real.snapshot.files['src/app.mjs'], 'the evidence snapshot reads the file');
  assert.equal(entries()['src/app.mjs'][3], real.snapshot.files['src/app.mjs'], 'and repairs the entry');

  // A file written moments ago is read but never cached.
  writeFileSync(join(root, 'src/app.mjs'), 'export const app = 3;\n');
  const fresh = inspectSource(root, { writeCache: true, workers: 2 });
  assert.equal(fresh.snapshot.files['src/app.mjs'], sha('export const app = 3;\n'));
  assert.equal(entries()['src/app.mjs'], undefined);
});

test('workers start by default from 1,000 files, with the same result', t => {
  const files = {};
  for (let i = 0; i < 998; i++) files[`pkg${i % 10}/f${i}.txt`] = `file ${i}\n`;
  const root = project(t, files);
  assert.equal(inspectSource(root).hashing.workers, 0, '998 files and .cyc/config.json stay on one thread');
  put(root, 'pkg0/one-more.txt', 'one more');
  const automatic = inspectSource(root);
  assert.ok(automatic.hashing.workers >= 2);
  assert.equal(automatic.hashing.readByWorkers, 1000);
  assert.deepEqual(automatic.snapshot, inspectSource(root, { workers: 0 }).snapshot);
});

test('a worker leaves to the main thread a file over the byte limit, and any job it claims after a stop', t => {
  const root = project(t, { 'small.txt': 'small', 'large.txt': 'x'.repeat(100) });
  // Slot states: 1 read and hashed by the worker, 2 handed back unread, 0 never claimed.
  function read(maxBytes, stopped) {
    const shared = shareJobs(root, ['small.txt', 'large.txt'], maxBytes);
    if (stopped) Atomics.store(shared.control, 2, 1);
    readJobs(shared);
    return { slots: Array.from(shared.slots), first: Buffer.from(shared.digests.buffer, 0, 32).toString('hex') };
  }
  const all = read(1000, false);
  assert.deepEqual(all.slots, [1, 1]);
  assert.equal(all.first, sha('small'));
  assert.deepEqual(read(50, false).slots, [1, 2], 'the file over the limit is not read');
  assert.deepEqual(read(1000, true).slots, [2, 0], 'after a stop, the claimed job is handed back unread and no other is claimed');
});

// A copy of the module beside a stand-in worker file, or with none, as an incomplete engine copy would be.
function copiedModule(t, worker) {
  const copy = folder(t, 'cyc-hashing-copy-');
  copyFileSync(join(scripts, 'source-snapshot.mjs'), join(copy, 'source-snapshot.mjs'));
  if (worker !== undefined) writeFileSync(join(copy, 'source-hash-worker.mjs'), worker);
  return pathToFileURL(join(copy, 'source-snapshot.mjs')).href;
}
// Runs a snapshot in a child process, so one that hangs fails the test instead of the whole suite.
// `after` runs in the child as soon as the snapshot returns or throws, while a worker could still
// hold a file open; it sets `afterResult`, or the error code it throws is reported instead.
function snapshotWith(t, module, root, options, { nodeArgs = [], env = {}, after = '' } = {}) {
  const script = join(folder(t, 'cyc-hashing-child-'), 'snapshot.mjs');
  writeFileSync(script, [
    "import { renameSync } from 'node:fs';",
    `const { inspectSource } = await import(${JSON.stringify(module)});`,
    `const root = ${JSON.stringify(root)}, started = Date.now();`,
    'let result, error, afterResult;',
    `try { result = inspectSource(root, ${JSON.stringify(options)}); } catch (e) { error = e.message; }`,
    'const elapsed = Date.now() - started;',
    `try { ${after} } catch (e) { afterResult = e.code ?? e.message; }`,
    'console.log(JSON.stringify({ ...result, recoverableTracked: undefined, error, elapsed, after: afterResult }));'
  ].join('\n'));
  const child = spawnSync(process.execPath, [...nodeArgs, script], { encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env } });
  assert.equal(child.status, 0, child.error?.message ?? child.stderr);
  return JSON.parse(child.stdout.trim().split('\n').at(-1));
}
// Renames the folder holding the file a stand-in worker keeps open, and back: Windows refuses while it is open.
const renameHeld = "renameSync(root + '/held', root + '/held-moved'); renameSync(root + '/held-moved', root + '/held'); afterResult = 'renamed';";
// Stand-in workers speak the shared-memory protocol in source-snapshot.mjs: control[0] is the next job
// to claim, [1] jobs finished, [3] workers started; a slot set to 2 hands its job back unread.
const standIn = body => [
  "import { workerData as s } from 'node:worker_threads';",
  "import { closeSync, openSync } from 'node:fs';",
  "import { resolve } from 'node:path';",
  'const path = i => Buffer.from(s.names.buffer, s.offsets[i], s.offsets[i + 1] - s.offsets[i]).toString();',
  'const handBack = i => { Atomics.store(s.slots, i, 2); Atomics.add(s.control, 1, 1); Atomics.notify(s.control, 1); };',
  'const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);',
  'const jobs = [];',
  'Atomics.add(s.control, 3, 1);',
  'for (let i; (i = Atomics.add(s.control, 0, 1)) < s.slots.length;) jobs.push(i);',
  'const held = jobs.find(i => path(i).startsWith("held/"));',
  body
].join('\n');

test('hash workers load no preload, from NODE_OPTIONS or the command line', t => {
  const root = project(t, { 'a.txt': 'a', 'b.txt': 'b' });
  const scratch = folder(t, 'cyc-hashing-preload-');
  const log = join(scratch, 'loaded.txt'), preload = join(scratch, 'preload.cjs');
  writeFileSync(preload, `require('node:fs').appendFileSync(${JSON.stringify(log)}, (require('node:worker_threads').isMainThread ? 'main' : 'worker') + '\\n');`);
  const module = pathToFileURL(join(scripts, 'source-snapshot.mjs')).href;
  // Inside quotes NODE_OPTIONS treats a backslash as an escape, so the path uses forward slashes.
  for (const [label, extras] of [['NODE_OPTIONS', { env: { NODE_OPTIONS: `--require "${preload.split('\\').join('/')}"` } }], ['--require', { nodeArgs: ['--require', preload] }]]) {
    rmSync(log, { force: true });
    const result = snapshotWith(t, module, root, { workers: 2 }, extras);
    assert.equal(result.hashing.readByWorkers, 3, label);
    assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['main'], `${label}: only the main thread ran the preload`);
  }
});

test('a copy of the module without its worker file reads on its own thread at once', t => {
  const root = project(t, { 'a.txt': 'a', 'b.txt': 'b' });
  const result = snapshotWith(t, copiedModule(t), root, { workers: 3 });
  assert.deepEqual(result.hashing, { workers: 0, readByWorkers: 0 });
  assert.ok(result.elapsed < 1500, `no wait for workers that cannot start (${result.elapsed} ms)`);
  assert.deepEqual(result.snapshot, inspectSource(root, { workers: 0 }).snapshot);
});

test('workers that never start leave the files to the main thread after two seconds', t => {
  const root = project(t, { 'a.txt': 'a', 'b.txt': 'b' });
  const result = snapshotWith(t, copiedModule(t, '// starts no work\n'), root, { workers: 2 });
  assert.equal(result.hashing.readByWorkers, 0);
  assert.ok(result.elapsed >= 1900 && result.elapsed < 4500, `read here after the startup wait (${result.elapsed} ms)`);
  assert.deepEqual(result.snapshot, inspectSource(root, { workers: 0 }).snapshot);
});

test('a worker that dies in the middle of a file does not hang the snapshot', t => {
  const root = project(t, { 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' });
  const expected = inspectSource(root, { workers: 0 }).snapshot;
  // It claims every file and exits without finishing any, as a worker that died mid-read would.
  const result = snapshotWith(t, copiedModule(t, standIn('')), root, { workers: 1 });
  assert.ok(result.elapsed >= 9000, `read here after five seconds without progress, then gave up waiting after five more (${result.elapsed} ms)`);
  assert.equal(result.hashing.readByWorkers, 0);
  assert.deepEqual(result.snapshot, expected);
});

test('a slow worker is waited for: no file stays open after the snapshot returns', t => {
  const root = project(t, { 'a.txt': 'a', 'held/file.txt': 'held open' });
  const expected = inspectSource(root, { workers: 0 }).snapshot;
  // It keeps one file open for 6.5 s without reading, as a long scan of that file would, then hands every job back.
  const worker = standIn('const fd = openSync(resolve(s.root, path(held)), "r"); pause(6500); closeSync(fd); for (const i of jobs) handBack(i);');
  const result = snapshotWith(t, copiedModule(t, worker), root, { workers: 1 }, { after: renameHeld });
  assert.deepEqual(result.snapshot, expected, 'the main thread read the waiting files after the stall');
  assert.ok(result.elapsed >= 6000, `and waited for the worker before returning (${result.elapsed} ms)`);
  assert.equal(result.after, 'renamed');
});

test('a snapshot that fails while a worker reads ahead waits for that read before throwing', t => {
  // A byte limit equal to the size of .cyc/config.json, so the next file (a.txt) passes it.
  const configSize = maxBytes => JSON.stringify({ schemaVersion: 1, verification: { commands: [] }, source: { maxBytes } }).length;
  const limit = configSize(10);
  assert.equal(configSize(limit), limit);
  const root = project(t, { 'a.txt': 'a', 'held/file.txt': 'held open' }, { maxBytes: limit });
  // The first two files go back to the main thread at once; it counts them and stops at the byte limit
  // while the worker still holds the third open.
  const worker = standIn('for (const i of jobs) if (i !== held) handBack(i); const fd = openSync(resolve(s.root, path(held)), "r"); pause(1500); closeSync(fd); handBack(held);');
  const result = snapshotWith(t, copiedModule(t, worker), root, { workers: 1 }, { after: renameHeld });
  assert.match(result.error, new RegExp(`larger than ${limit} bytes.*source\\.maxBytes`, 's'));
  assert.ok(result.elapsed >= 1200, `the error waited for the read in progress (${result.elapsed} ms)`);
  assert.equal(result.after, 'renamed');
});
