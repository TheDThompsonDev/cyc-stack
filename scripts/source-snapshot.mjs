import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

const hash = value => createHash('sha256').update(value).digest('hex');
// Defaults for the selected source; a project can set its own in source.maxFiles and source.maxBytes.
export const sourceLimits = Object.freeze({ maxFiles: 200000, maxBytes: 2 * 1024 * 1024 * 1024 });
const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
const internal = ['.cyc/runtime', '.cyc/runs', '.cyc/engine'];
const within = (path, parent) => path === parent || path.startsWith(`${parent}/`);
// Controller bookkeeping inside the project, never project source.
export const controllerPath = path => internal.some(p => within(path, p));
const secret = path => /(^|\/)\.env(?:$|\.)/.test(path) && !/\.(example|sample|template)$/.test(path);
function paths(root, value, label) {
  if (!Array.isArray(value) || value.some(p => typeof p !== 'string' || !p || isAbsolute(p) || p.includes('\\') || p.split('/').some(x => !x || x === '.' || x === '..'))) throw new Error(`source.${label} must contain literal project-relative paths, not globs.`);
  for (const path of value) {
    if (!/[*?]/.test(path)) continue;
    const parts = path.split('/');
    let prefix = root;
    for (let i = 0; i < parts.length; i += 1) {
      prefix = resolve(prefix, parts[i]);
      let stat;
      try { stat = lstatSync(prefix); } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      }
      if (stat && !stat.isSymbolicLink()) continue;
      // Do not follow links to establish wildcard-looking names in their targets.
      if (parts.slice(stat ? i + 1 : i).some(part => /[*?]/.test(part))) throw new Error('source.' + label + ' entries must be literal file or directory paths. Unsupported wildcard path: ' + path + '. Name the inputs or directory prefixes explicitly.');
      break;
    }
  }
  return value;
}

function limit(policy, key) {
  const value = policy[key] ?? sourceLimits[key];
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`source.${key} must be a positive integer.`);
  return value;
}

export function sourcePolicy(root, policy = {}) {
  return { include: paths(root, policy.include ?? [], 'include'), exclude: paths(root, policy.exclude ?? [], 'exclude'), maxFiles: limit(policy, 'maxFiles'), maxBytes: limit(policy, 'maxBytes') };
}

// A snapshot taken with useCache reuses a content hash only for a file whose size, modification time,
// change time and file ID all match an entry recorded after the file had been still for settleMs; the
// settle rule covers a write within the file system's timestamp resolution, as Git does for its index.
// Ordinary writes move the change time, but not every write does: a write through a memory-mapped view
// on Windows leaves all of them unchanged, Windows tools can set the change time back, and FAT has
// none. So the cache serves only views between checks; snapshots that record evidence hash every file,
// and in doing so refresh the cache.
const cacheFile = '.cyc/runs/source-cache.json';
const settleMs = 2000;
const identity = stat => [stat.size, stat.mtimeMs, stat.ctimeMs, stat.ino];
const sameIdentity = (entry, id) => entry[0] === id[0] && entry[1] === id[1] && entry[2] === id[2] && entry[5] === id[3];
function readCache(root) {
  try {
    const cache = JSON.parse(readFileSync(resolve(root, cacheFile), 'utf8'));
    if (cache?.version === 1 && cache.entries && typeof cache.entries === 'object' && !Array.isArray(cache.entries)) return cache.entries;
  } catch { /* a missing or unreadable cache only means hashing every file */ }
  return {};
}
function storeCache(root, entries) {
  const path = resolve(root, cacheFile), temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try { mkdirSync(dirname(path), { recursive: true }); writeFileSync(temporary, JSON.stringify({ version: 1, entries }), { mode: 0o600 }); renameSync(temporary, path); }
  catch { rmSync(temporary, { force: true }); /* the cache is an optimization; a failed write costs only time */ }
}
// Removes the entries a stage's full reads proved wrong (see keep in inspectSource), matched by their
// wrong hash so a corrected entry stays; returns whether any was removed.
function dropDisproved(entries, stage) {
  let removed = false;
  for (const [path, wrong] of stage.disproved ?? []) if (Object.hasOwn(entries, path) && entries[path]?.[3] === wrong) { delete entries[path]; removed = true; }
  return removed;
}
// Stores the cache updates snapshots collected in a stage (see inspectSource), without any entry they
// proved wrong: a snapshot that threw after disproving one never staged its correction.
export function saveCache(project, stage) {
  if (!stage?.changed && !stage?.disproved?.size) return;
  try {
    const root = realpathSync(project), entries = stage.changed ? stage.entries : readCache(root);
    if (dropDisproved(entries, stage) || stage.changed) storeCache(root, entries);
  } catch { /* as in storeCache, a failed write costs only time */ }
}
// For an operation that refuses: stores none of the stage's new hashes, but removes the stored entries
// its full reads proved wrong, so the cache does not go on hiding a change from the next operation.
export function forgetDisproved(project, stage) {
  if (!stage?.disproved?.size) return;
  try {
    const root = realpathSync(project), entries = readCache(root);
    if (dropDisproved(entries, stage)) storeCache(root, entries);
  } catch { /* as in storeCache, a failed write costs only time */ }
}

// Files are read in chunks, so a large file costs a bounded buffer rather than its size in memory.
// Like readFileSync, a read stops at the size the open file reports, or at its end when it reports
// none, so a file that grows while it is read hashes as it did; unlike it, a file over 2 GiB is hashed
// rather than refused with ERR_FS_FILE_TOO_LARGE. `beat` marks progress through a large file.
const chunkBytes = 1024 * 1024;
function digestFile(absolute, buffer, beat) {
  const digest = createHash('sha256'), fd = openSync(absolute, 'r');
  try {
    const stat = fstatSync(fd), size = stat.isFile() ? stat.size : 0;
    for (let total = 0; ;) {
      const length = size ? Math.min(buffer.length, size - total) : buffer.length;
      const read = length ? readSync(fd, buffer, 0, length, null) : 0;
      if (!read) break;
      digest.update(buffer.subarray(0, read));
      total += read;
      beat?.();
    }
  } finally { closeSync(fd); }
  return digest.digest();
}

// A full-content snapshot reads its files on worker threads. Opening a file dominates the time, and
// on Windows file system filters make each open cost about 0.4 ms: one thread took 29 s for 60,000
// files, eight took 7 s, and more did not help. Small snapshots stay on this thread, as workers take
// about 25 ms to start. Workers only read and hash regular files no larger than the byte limit; this
// thread applies the results in path order, so limits, links, cache updates and the order of `files`
// are exactly as a serial read. Anything else (a link, a directory, a vanished file, a file the limit
// stops before it is read, any error) is handed back and inspected here in order, so an error
// surfaces exactly as a serial snapshot raises it.
const parallelFrom = 1000;
const maxWorkers = 8;
// No worker started after startupMs, or no read moved for stallMs: this thread reads the files it
// is waiting for itself. A worker reports each chunk it reads, so a long read is not a stall.
const startupMs = 2000;
const stallMs = 5000;
const workerFile = new URL('./source-hash-worker.mjs', import.meta.url);
const [PENDING, FILE, DEFER] = [0, 1, 2];
const [NEXT, DONE, STOP, STARTED, BEAT] = [0, 1, 2, 3, 4];
const jobPath = (shared, i) => Buffer.from(shared.names.buffer, shared.offsets[i], shared.offsets[i + 1] - shared.offsets[i]).toString();

// The jobs as memory every thread shares: paths, a claim counter and progress, and per job a state,
// the identity before and after reading (8 numbers) and the SHA-256 (32 bytes).
export function shareJobs(root, paths, maxBytes) {
  const n = paths.length;
  const encoded = paths.map(path => Buffer.from(path));
  const offsets = new Float64Array(new SharedArrayBuffer(8 * (n + 1)));
  for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + encoded[i].length;
  const names = new Uint8Array(new SharedArrayBuffer(Math.max(1, offsets[n])));
  encoded.forEach((bytes, i) => names.set(bytes, offsets[i]));
  return { root, maxBytes, names, offsets, control: new Int32Array(new SharedArrayBuffer(20)), slots: new Int32Array(new SharedArrayBuffer(4 * n)), numbers: new Float64Array(new SharedArrayBuffer(64 * n)), digests: new Uint8Array(new SharedArrayBuffer(32 * n)) };
}

function readJob(shared, i, buffer) {
  let state = DEFER;
  try {
    const absolute = resolve(shared.root, jobPath(shared, i));
    const stat = lstatSync(absolute);
    // A file over the byte limit on its own fails the snapshot; the main thread raises that unread.
    if (stat.isFile() && stat.size <= shared.maxBytes) {
      const digest = digestFile(absolute, buffer, () => Atomics.add(shared.control, BEAT, 1));
      shared.numbers.set([...identity(stat), ...identity(lstatSync(absolute))], i * 8);
      shared.digests.set(digest, i * 32);
      state = FILE;
    }
  } catch { /* read again on the main thread, in order, where the error is raised */ }
  Atomics.store(shared.slots, i, state);
  Atomics.add(shared.control, DONE, 1);
  Atomics.notify(shared.control, DONE);
}

// Runs on each worker (source-hash-worker.mjs): claim the next job until none are left or the
// snapshot has stopped. A job claimed after the stop is marked unread, so nothing waits on it.
export function readJobs(shared) {
  const { control, slots } = shared, buffer = Buffer.allocUnsafe(chunkBytes);
  Atomics.add(control, STARTED, 1);
  for (let i; (i = Atomics.add(control, NEXT, 1)) < slots.length;) {
    if (Atomics.load(control, STOP)) {
      Atomics.store(slots, i, DEFER); Atomics.add(control, DONE, 1); Atomics.notify(control, DONE);
      return;
    }
    readJob(shared, i, buffer);
  }
}

function parallelReads(root, paths, workers, maxBytes) {
  const shared = shareJobs(root, paths, maxBytes), n = paths.length;
  const { control, slots, numbers, digests } = shared;
  // Like the check runner, the workers get no NODE_OPTIONS preloads, and their output never reaches
  // a command's printed result. A worker that fails to start only leaves more for the others.
  const { NODE_OPTIONS, ...env } = process.env;
  let started = 0;
  for (; started < workers; started++) {
    try { new Worker(workerFile, { workerData: shared, execArgv: [], env, stdout: true, stderr: true }).on('error', () => {}).unref(); }
    catch { break; }
  }
  if (!started) return null;
  const createdAt = Date.now();
  const progress = () => Atomics.load(control, DONE) + Atomics.load(control, BEAT);
  let helping = false, readByWorkers = 0;
  // Waits up to 100 ms for a job to finish (`done` is the count read before the caller checked), and
  // returns the progress seen and when it last moved.
  function wait(done, seen, since) {
    Atomics.wait(control, DONE, done, 100);
    const now = progress();
    return now !== seen ? [now, Date.now()] : [seen, since];
  }
  return {
    workers: started,
    get readByWorkers() { return readByWorkers; },
    // The read for job i, or undefined when this thread must read it in order.
    take(i) {
      if (i >= n) return undefined;
      for (let seen = progress(), since = Date.now(); ;) {
        const done = Atomics.load(control, DONE), state = Atomics.load(slots, i);
        if (state === FILE) {
          readByWorkers++;
          const values = Array.from(numbers.subarray(i * 8, i * 8 + 8));
          return { id: values.slice(0, 4), after: values.slice(4), value: Buffer.from(digests.buffer, i * 32, 32).toString('hex') };
        }
        if (state === DEFER || helping) return undefined;
        if (!Atomics.load(control, STARTED) && Date.now() - createdAt >= startupMs) { helping = true; continue; }
        [seen, since] = wait(done, seen, since);
        if (Date.now() - since >= stallMs) helping = true;
      }
    },
    // Stop handing out jobs and wait for reads in progress, so no worker holds a file open afterwards
    // (on Windows an open file keeps its folder from being renamed or removed until it is closed).
    // A read that makes no progress for stallMs is given up on, so a worker that died cannot hang it.
    finish() {
      Atomics.store(control, STOP, 1);
      const claimed = Math.min(Atomics.load(control, NEXT), n);
      for (let i = 0, seen = progress(), since = Date.now(); i < claimed;) {
        const done = Atomics.load(control, DONE);
        if (Atomics.load(slots, i) !== PENDING) { i++; continue; }
        [seen, since] = wait(done, seen, since);
        if (Date.now() - since >= stallMs) return;
      }
    }
  };
}

// The controller can reuse classification without persisting a duplicate path list.
// `signatures: 'stat'` records size and modification time instead of content, for callers
// that only need to notice a change cheaply (the delivery gate's prompt-to-Stop comparison).
// `useCache` reuses settled hashes from the cache instead of reading every file; only `writeCache`
// callers, controller operations that already write run state, update it, so read-only commands
// leave the project untouched. `writeCache: true` stores the update at once. A stage object instead
// collects it: later snapshots given the same stage read the cache from it, and saveCache stores it,
// so the controller stores new hashes only when an operation returns. `workers` sets how many
// threads read a full-content snapshot; by default it follows the number of files. `hashing` reports
// how many files worker threads read.
export function inspectSource(project, { signatures = 'content', useCache = false, writeCache = false, workers } = {}) {
  const root = realpathSync(project);
  const config = resolve(root, '.cyc/config.json');
  const policy = existsSync(config) ? JSON.parse(readFileSync(config, 'utf8').replace(/^\uFEFF/, '')).source ?? {} : {};
  const { include, exclude, maxFiles, maxBytes } = sourcePolicy(root, policy);
  const startedAt = Date.now();
  const content = signatures !== 'stat';
  const stage = typeof writeCache === 'object' && writeCache !== null ? writeCache : null;
  const cached = content && (useCache || writeCache) ? stage?.entries ?? readCache(root) : {};
  const fresh = Object.create(null);
  let cacheChanged = false;
  // Directories are shared by many files; look each one up once per snapshot.
  const ancestors = new Map();
  function ancestorStat(name) {
    if (!ancestors.has(name)) {
      try { ancestors.set(name, { stat: lstatSync(resolve(root, name)) }); } catch (error) { ancestors.set(name, { error }); }
    }
    const found = ancestors.get(name);
    if (found.error) throw found.error;
    return found.stat;
  }
  let buffer;
  function contentHash(path, stat) {
    const id = identity(stat), entry = Object.hasOwn(cached, path) ? cached[path] : undefined;
    if (useCache && Array.isArray(entry) && sameIdentity(entry, id) && typeof entry[3] === 'string') { fresh[path] = entry; return entry[3]; }
    const absolute = resolve(root, path);
    const value = digestFile(absolute, buffer ??= Buffer.allocUnsafe(chunkBytes)).toString('hex');
    return keep(path, id, value, identity(lstatSync(absolute)));
  }
  // Records a hash read from disk, by this thread or a worker, in the cache when the rules allow.
  function keep(path, id, value, after) {
    const entry = Object.hasOwn(cached, path) ? cached[path] : undefined;
    const steady = after.every((part, i) => part === id[i]);
    // An entry with this file's identity but other bytes is one the cache got wrong (see above). A stage
    // remembers it, so an operation that then refuses still removes it (forgetDisproved).
    if (stage && steady && Array.isArray(entry) && sameIdentity(entry, id) && entry[3] !== value) (stage.disproved ??= new Map()).set(path, entry[3]);
    // Cache only bytes read from a file that had already settled and did not change while being read.
    if (startedAt - Math.max(id[1], id[2]) >= settleMs && steady) {
      // An entry that already says the same is kept as it is, so a full snapshot of unchanged files writes nothing.
      fresh[path] = Array.isArray(entry) && sameIdentity(entry, id) && entry[3] === value ? entry : [id[0], id[1], id[2], value, startedAt, id[3]];
      if (fresh[path] !== entry) cacheChanged = true;
    } else if (entry !== undefined) cacheChanged = true;
    return value;
  }
  const files = Object.create(null);
  const skipped = [];
  let bytes = 0;
  let count = 0;
  const candidates = new Set();
  const tracked = new Set();
  const recoverableTracked = new Set();
  // Large repositories list hundreds of thousands of paths; allow for that and for a slow first index read.
  const git = args => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 512 * 1024 * 1024 });
  const probe = git(['rev-parse', '--is-inside-work-tree']);
  const gitAware = probe.status === 0 && probe.stdout.trim() === 'true';
  if (!gitAware && existsSync(resolve(root, '.git'))) throw new Error('Cannot inspect Git file selection; repair Git access before starting CYC.');
  function excluded(path, forced = false) {
    if (controllerPath(path) || path.split('/').includes('.git')) return true;
    if (tracked.has(path)) return false;
    if (secret(path)) return true;
    if (forced) return false;
    return exclude.some(p => within(path, p)) || path.split('/').some(p => ignored.has(p));
  }
  function walk(path, forced = false) {
    if (path && excluded(path, forced)) return;
    const absolute = resolve(root, path);
    let stat;
    try { stat = lstatSync(absolute); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      for (const name of readdirSync(absolute)) walk(path ? `${path}/${name}` : name, forced);
    } else candidates.add(path);
  }
  if (gitAware) {
    for (const [args, isTracked] of [[['ls-files', '-z', '--cached', '-v', '--', '.'], true], [['ls-files', '-z', '--others', '--exclude-standard', '--', '.'], false]]) {
      const result = git(args);
      if (result.status !== 0) throw new Error(`Git file selection failed: ${result.stderr || result.error?.message}`);
      for (const entry of result.stdout.split('\0').filter(Boolean)) {
        const path = isTracked ? entry.slice(2) : entry;
        candidates.add(path);
        if (isTracked) {
          tracked.add(path);
          // A successful stash can still omit assume-unchanged or skip-worktree bytes.
          if (entry.startsWith('H ')) recoverableTracked.add(path);
        }
      }
    }
  } else walk('');
  // Explicit inclusion brings ignored generated inputs into coverage, without following links.
  for (const path of include) {
    let ancestor = '';
    for (const part of path.split('/')) {
      ancestor = ancestor ? `${ancestor}/${part}` : part;
      try { if (lstatSync(resolve(root, ancestor)).isSymbolicLink()) { candidates.add(ancestor); ancestor = null; break; } }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    if (ancestor) walk(path, true);
  }
  // Folders first: a path below a link or a missing folder is never read. Every outcome is then
  // applied in path order, which fixes the order of `files` and so the snapshot hash.
  const steps = [];
  for (const path of [...candidates].sort()) {
    if (excluded(path, include.some(p => within(path, p) || within(p, path)))) continue;
    let name = '', step = { leaf: path };
    for (const part of path.split('/').slice(0, -1)) {
      name = name ? `${name}/${part}` : part;
      let stat;
      try { stat = ancestorStat(name); } catch (error) { step = { error }; break; }
      if (stat.isSymbolicLink()) { step = { link: name }; break; }
    }
    steps.push(step);
  }
  function link(name) {
    if (Object.hasOwn(files, name)) return;
    const target = readlinkSync(resolve(root, name));
    files[name] = hash(`symlink:${target}`);
    skipped.push({ path: name, target });
  }
  // `read` is a worker's read of a regular file; without one, this thread inspects the path itself.
  function addLeaf(path, read) {
    let stat;
    if (!read) {
      try { stat = lstatSync(resolve(root, path)); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
      if (stat.isSymbolicLink()) return link(path);
      if (stat.isDirectory()) {
        files[path] = hash('directory-entry');
        skipped.push({ path, target: 'Git submodule or tracked file replaced by a directory; verify separately.' });
        return;
      }
      if (!stat.isFile()) return;
    }
    bytes += read ? read.id[0] : stat.size;
    if (++count > maxFiles) throw new Error(`Selected source has more than ${maxFiles} files. Exclude generated or vendored folders with source.exclude, or raise source.maxFiles in .cyc/config.json.`);
    if (bytes > maxBytes) throw new Error(`Selected source is larger than ${maxBytes} bytes. Exclude generated or vendored folders with source.exclude, or raise source.maxBytes in .cyc/config.json.`);
    files[path] = !content ? `stat:${stat.size}:${stat.mtimeMs}` : read ? keep(path, read.id, read.value, read.after) : contentHash(path, stat);
  }
  const leaves = steps.flatMap(step => step.leaf ? [step.leaf] : []);
  const threads = !content || useCache ? 0 : workers ?? (leaves.length < parallelFrom ? 0 : Math.min(maxWorkers, Math.max(2, availableParallelism())));
  // A copy of this module without its worker file reads on this thread. Past maxFiles + 1 paths the
  // file limit has usually been reached, so shared memory stops there; any later paths read here.
  const reads = threads > 0 && leaves.length > 0 && existsSync(workerFile) ? parallelReads(root, leaves.slice(0, maxFiles + 1), threads, maxBytes) : null;
  try {
    let job = 0;
    for (const step of steps) {
      if (step.error) { if (step.error.code === 'ENOENT') continue; throw step.error; }
      if (step.link) link(step.link);
      else addLeaf(step.leaf, reads?.take(job++));
    }
  } finally { reads?.finish(); }
  // Entries for files no longer selected drop out, so the cache tracks the current selection.
  if (content && writeCache && (cacheChanged || Object.keys(fresh).length !== Object.keys(cached).length)) {
    if (stage) Object.assign(stage, { entries: fresh, changed: true });
    else storeCache(root, fresh);
  }
  // Collected without a prototype so a file named __proto__ is kept; returned as an ordinary object.
  return { snapshot: { hash: hash(JSON.stringify(files)), files: { ...files }, skipped, selection: gitAware ? 'git' : 'filesystem' }, recoverableTracked, hashing: { workers: reads?.workers ?? 0, readByWorkers: reads?.readByWorkers ?? 0 } };
}

export const sourceSnapshot = (project, options) => inspectSource(project, options).snapshot;
