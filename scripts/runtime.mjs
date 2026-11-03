import { randomUUID } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hostname, tmpdir } from 'node:os';
import { digest } from './response-gate.mjs';
import { getPlaybook, routeTask } from './catalog.mjs';
import { forgetDisproved, inspectSource as inspectSourceFiles, saveCache, sourcePolicy } from './source-snapshot.mjs';
import { assessmentRequirements, assessmentTemplate, derivedAssessment, renderReview, reviewPath, validateAssessment } from './work-review.mjs';
import { recoveryGuidance } from './recovery.mjs';
import { cutOff, outputLimit, stable, summarizeTests, testsOf } from './test-output.mjs';
import { runPacketDigest, writeRunPacket } from './packet.mjs';
export { sourceSnapshot } from './source-snapshot.mjs';

const text = value => typeof value === 'string' && value.trim().length > 0;
const terminal = new Set(['complete', 'exhausted', 'halted', 'stopped']);
// Long tasks may take long. The loop is bounded by failed attempts and repeated no-progress,
// not by a clock; a project can still opt into maxDurationMs.
const defaults = { maxAttempts: 3, maxNoProgress: 2 };
const limitKeys = ['maxAttempts', 'maxDurationMs', 'maxNoProgress'];
// A byte-order mark from Windows editors is not part of the JSON.
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const engineVersion = json(fileURLToPath(new URL('../package.json', import.meta.url))).version;
const slash = path => path.split(sep).join('/');
// Snapshots taken while this process holds the workspace lock collect updates to the shared hash
// cache in the operation's stage, stored only when the operation returns, so a refused or failed
// operation adds no hashes; it only removes entries it proved wrong. Read-only commands such as
// recover use the cache without writing.
let cacheStage = null;
// The operation lock this process holds, so a running check can record how long it may last.
let activeOwnership = null;
const inspectSource = (root, options) => inspectSourceFiles(root, { ...options, writeCache: cacheStage ?? false });
const sourceSnapshot = (root, options) => inspectSource(root, options).snapshot;
// Views between checks reuse cached hashes. Snapshots that record evidence, at run start, around
// proof, after verification, baseline and recipe commands and at completion, hash every file (see
// source-snapshot.mjs).
const cachedSnapshot = root => sourceSnapshot(root, { useCache: true });

export function atomicJSON(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(temp, path);
}

// Resolve an existing ancestor and keep any missing suffix, so prospective files
// under a junction have the same storage identity as their actual destination.
function physicalPath(absolute) {
  let ancestor = absolute;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  return resolve(realpathSync(ancestor), relative(ancestor, absolute));
}

export function projectFile(root, path) {
  if (!text(path) || isAbsolute(path)) throw new Error('Use a nonempty project-relative path.');
  const realRoot = realpathSync(root);
  const absolute = resolve(realRoot, path);
  const rel = relative(realRoot, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path leaves project: ${path}`);
  // Check existing ancestors too, including a symlink leading to a missing file.
  const actual = relative(realRoot, physicalPath(absolute));
  if (actual === '..' || actual.startsWith(`..${sep}`) || isAbsolute(actual)) throw new Error(`Symlink leaves project: ${path}`);
  return absolute;
}


// Agents on Windows write backslashes and absolute paths; both can name the same project file.
// A path outside the project is left as written, so projectFile still refuses it.
export function inputPath(root, path) {
  if (typeof path !== 'string') return path;
  // In JSON, "tests\test.py" is valid and means a tab: a control character is never a real path.
  if ([...path].some(character => character.charCodeAt(0) < 32)) throw new Error(`Path ${JSON.stringify(path)} contains a control character, which a JSON backslash before t, n, r, b, or f produces. Use forward slashes in paths.`);
  let value = path.replaceAll('\\', '/');
  if (isAbsolute(value)) {
    const rel = relative(realpathSync(root), resolve(value));
    if (rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) value = slash(rel);
  }
  return value.replace(/^\.\//, '');
}

// Assessment paths get the same leniency as other path input; the assessment is updated in place.
function assessmentPaths(root, assessment) {
  if (!assessment || typeof assessment !== 'object') return assessment;
  for (const [key, field] of [['context', 'sources'], ['learning', 'artifacts'], ['errorHistory', 'artifacts']]) {
    const entry = assessment[key];
    if (entry && Array.isArray(entry[field])) entry[field] = entry[field].map(path => inputPath(root, path));
  }
  return assessment;
}

function normalizePaths(root, paths, label) {
  if (!Array.isArray(paths) || paths.some(path => !text(path))) throw new Error(`${label} must be an array of project-relative paths.`);
  return paths.map(path => inputPath(root, path)).map(path => {
    projectFile(root, path);
    const normalized = diskCasing(realpathSync(root), slash(relative(realpathSync(root), resolve(root, path))).replace(/\/$/, ''));
    if (!normalized) throw new Error(`Use a specific ${label} entry; omit scope to allow the whole project.`);
    let prefix = root;
    for (const component of normalized.split('/')) {
      prefix = resolve(prefix, component);
      if (!/[*?]/.test(component)) continue;
      try { lstatSync(prefix); } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
        throw new Error(`${label} entries must be literal file or directory paths. Unsupported wildcard path: ${path}. Name the permitted files or directory prefixes explicitly.`);
      }
    }
    return normalized;
  });
}

// Windows file systems ignore case; Git's listing and the scope guard do not. An entry is stored
// with the casing the file system reports for its existing components, so `Src` names the same
// scope as `src` and an edit under it is in scope. Links are not resolved here.
function diskCasing(root, normalized) {
  if (process.platform !== 'win32' || !normalized) return normalized;
  const parts = normalized.split('/');
  let directory = root;
  for (let index = 0; index < parts.length; index++) {
    let entries;
    try { entries = readdirSync(directory); } catch { break; }
    const actual = entries.find(name => name === parts[index]) ?? entries.find(name => name.toLowerCase() === parts[index].toLowerCase());
    if (actual === undefined) break;
    parts[index] = actual;
    directory = resolve(directory, actual);
  }
  return parts.join('/');
}

function protectedSnapshot(root, paths) {
  const result = {};
  function visit(path, key) {
    let stat;
    try { stat = lstatSync(path); } catch (error) {
      if (error.code === 'ENOENT') { result[key] = 'absent'; return; }
      throw error;
    }
    if (stat.isSymbolicLink()) { result[key] = `symlink:${readlinkSync(path)}`; return; }
    if (stat.isFile()) { result[key] = digest(readFileSync(path)); return; }
    if (stat.isDirectory()) {
      result[key] = 'directory';
      for (const entry of readdirSync(path).sort()) visit(resolve(path, entry), `${key}/${entry}`);
    }
  }
  for (const path of paths) visit(projectFile(root, path), path);
  return result;
}

export function configuration(root) {
  const path = resolve(root, '.cyc/config.json');
  const config = existsSync(path) ? json(path) : {};
  if (config.schemaVersion !== undefined && config.schemaVersion !== 1) throw new Error('Unsupported CYC config version.');
  sourcePolicy(root, config.source ?? {});
  const limits = { ...defaults, ...config.limits };
  if (limits.maxDurationMs === null) delete limits.maxDurationMs;
  for (const [key, value] of Object.entries(limits)) {
    if (!limitKeys.includes(key) || !Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid run limit: ${key}`);
  }
  const commands = config.verification?.commands ?? [];
  if (!Array.isArray(commands)) throw new Error('verification.commands must be an array.');
  const ids = new Set();
  for (const command of commands) {
    if (!command || !text(command.id) || ids.has(command.id) || !text(command.command) || !Array.isArray(command.args) || command.args.some(arg => typeof arg !== 'string')) throw new Error('Every verification command needs a unique id, the executable as command, and string args, for example {"id": "test", "command": "npm", "args": ["test"]}.');
    if (command.timeoutMs !== undefined && (!Number.isSafeInteger(command.timeoutMs) || command.timeoutMs <= 0)) throw new Error('Command timeoutMs must be positive.');
    ids.add(command.id);
  }
  if (config.verification?.baseline !== undefined && typeof config.verification.baseline !== 'boolean') throw new Error('verification.baseline must be true or false.');
  const ledgerPath = normalizePaths(root, [config.context?.ledgerPath ?? (existsSync(resolve(root, 'INCIDENT-LEDGER.md')) ? 'INCIDENT-LEDGER.md' : 'docs/context/error-ledger.md')], 'context.ledgerPath')[0];
  return { limits, commands, ledgerPath, baseline: config.verification?.baseline === true, protectedPaths: normalizePaths(root, ['.cyc/config.json', ...(config.protectedPaths ?? [])], 'protectedPaths') };
}

function runPath(root, id) {
  if (!/^[a-z0-9-]{1,80}$/.test(id ?? '')) throw new Error('A valid --run ID is required.');
  return projectFile(root, `.cyc/runs/${id}/state.json`);
}
export function readRun(root, id) { return json(runPath(root, id)); }

// The calling conversation, when known: an explicit CYC_SESSION, or the host's native session ID
// (Claude Code, Codex), which gateSession maps to the gate's key for this project.
export const callerSession = (env = process.env) => [env.CYC_SESSION, env.CLAUDE_CODE_SESSION_ID, env.CODEX_THREAD_ID].find(value => /^[A-Za-z0-9_-]{4,80}$/.test(value ?? ''));

// Commands may omit --run: shell state does not survive between an agent's tool calls, so the
// controller finds the one run still in progress here. A known caller only ever gets its own run
// or an unowned one, never another conversation's.
export function activeRun(root, session = callerSession()) {
  const directory = projectFile(root, '.cyc/runs');
  const runs = (existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : [])
    .filter(entry => entry.isDirectory() && /^[a-z0-9-]{1,80}$/.test(entry.name))
    .map(entry => { try { return json(resolve(directory, entry.name, 'state.json')); } catch { return null; } })
    .filter(run => run && ['running', 'paused', 'blocked'].includes(run.status));
  const key = session === undefined ? undefined : gateSession(root, session);
  const candidates = key === undefined ? runs : runs.filter(run => run.session === key || !run.session);
  if (candidates.length === 1) return candidates[0].id;
  if (!candidates.length) throw new Error(key === undefined || !runs.length ? 'No active CYC run in this project. Start one with run start, or pass --run ID for a finished run.' : `No active run for session ${key}; other conversations' runs are not selected implicitly. Pass --run ID.`);
  throw new Error(`Several runs are active: ${candidates.map(run => `${run.id} (${run.status}: ${run.goal.slice(0, 60)})`).join('; ')}. Pass --run ID or --session.`);
}
const current = state => state.stages[state.stageIndex] ?? null;
function log(state, type, detail) { state.history.push({ time: new Date().toISOString(), type, ...detail }); }

function readLock(path) {
  if (!existsSync(path)) return null;
  let raw;
  try { raw = readFileSync(path, 'utf8'); return { ...JSON.parse(raw.replace(/^﻿/, '')), path, raw }; }
  catch { return { operation: 'unknown controller operation', path, raw }; }
}
function workspaceOperation(root) {
  const path = projectFile(root, '.cyc/runs/workspace.lock');
  const owner = readLock(path);
  const guard = owner && readLock(`${path}.reclaim`);
  return owner && guard ? { ...owner, reclaimGuard: { path: guard.path, pid: guard.pid ?? null, alive: Number.isSafeInteger(guard.pid) ? processAlive(guard.pid) : null } } : owner;
}

// Where a lock's process ID means something: the same machine, operating system and process ID
// namespace. A container or WSL can share the host name and the project folder while its process IDs
// are invisible here, so all three are recorded and compared.
let pidNamespace;
export function lockIdentity() {
  if (pidNamespace === undefined) { try { pidNamespace = process.platform === 'linux' ? readlinkSync('/proc/self/ns/pid') : null; } catch { pidNamespace = null; } }
  return { hostname: hostname(), platform: process.platform, pidNamespace };
}
// Only "no such process" means ended; a process this user may not signal is alive. A process ID the
// system has given to another program also reads as alive, which only ever keeps a lock.
const processAlive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };
// A lock is reclaimed only from an owner known to be idle when it ended: none of a commit under way, a
// proof with swapped source files (its backup is the only safe copy of the candidate), a halted
// proof or a failed publication. Phases are an allow-list, so a state this engine does not know is
// kept. A lock from an older engine records no identity and is left for the operator.
export function lockAbandoned(owner) {
  if (!owner || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.pid === process.pid) return false;
  const here = lockIdentity();
  if (owner.hostname !== here.hostname || owner.platform !== here.platform || (owner.pidNamespace ?? null) !== here.pidNamespace) return false;
  if (owner.committing || owner.publicationFailure || ![undefined, 'restored'].includes(owner.phase)) return false;
  // A check started through cmd or another program can outlive a controller killed by force; the
  // lock waits until that check's own time limit has passed.
  if (Number.isFinite(owner.checkUntil) && Date.now() < owner.checkUntil) return false;
  return !processAlive(owner.pid);
}
// Reclaimers first take an exclusive guard file, then confirm the lock still holds exactly the owner
// judged abandoned before removing it. Meanwhile nothing else can change that lock: its owner has
// ended, other reclaimers are kept out by the guard, and no operation creates a lock over an existing
// one. Moving the lock aside instead would let a third process slip in while it is away. A guard
// left by a crashed reclaimer only stops automatic reclaim, and the busy error names it.
export function reclaimLock(root, path, owner, kind) {
  const guard = `${path}.reclaim`;
  let fd, removed = false;
  try { fd = openSync(guard, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, ...lockIdentity(), createdAt: new Date().toISOString() }));
    let current;
    try { current = readFileSync(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return true; throw error; }
    if (current !== owner.raw) return false;
    unlinkSync(path);
    removed = true;
  } finally {
    closeSync(fd);
    // A scanner holding the guard open must not turn a completed reclaim into a failure.
    try { rmSync(guard, { force: true, maxRetries: 5, retryDelay: 50 }); } catch (error) { if (!removed) throw error; }
  }
  const { raw, path: _, ...recorded } = owner;
  // A run-start measurement whose worker ended never writes its result; record that it failed, so
  // the run does not wait for it forever.
  const measured = kind === 'workspace' && /^baseline run ([0-9a-f-]{36})$/.exec(owner.operation ?? '');
  if (measured && existsSync(projectFile(root, `.cyc/runs/${measured[1]}`)) && !existsSync(baselineFile(root, measured[1]))) {
    try { atomicJSON(baselineFile(root, measured[1]), { status: 'error', reason: 'The run-start measurement ended before it finished (its process stopped). Pre-existing failures cannot be accepted for this run.', checkedAt: new Date().toISOString() }); } catch { /* the run then keeps reporting that it is measuring */ }
  }
  try { appendFileSync(projectFile(root, '.cyc/runs/lock-reclaims.jsonl'), JSON.stringify({ lock: kind, path: slash(relative(realpathSync(root), path)), owner: recorded, reclaimedAt: new Date().toISOString(), by: { pid: process.pid, ...lockIdentity() } }) + '\n'); }
  catch { /* the record is diagnostic; the reclaim itself is complete */ }
  return true;
}
// Why a lock was not reclaimed, for the busy error.
function lockKept(owner) {
  const here = lockIdentity();
  const guard = owner && readLock(`${owner.path}.reclaim`);
  if (guard) return ` A reclaim guard ${guard.path}${Number.isSafeInteger(guard.pid) ? ` from PID ${guard.pid} (${processAlive(guard.pid) ? 'still running' : 'no longer running'})` : ''} blocks automatic reclaim; once no CYC process is running in this project, remove it.`;
  if (!owner || !Number.isSafeInteger(owner.pid)) return ' Its owner record is empty or unreadable: an operation may be starting, or one ended while writing it. It is not reclaimed automatically; if no CYC process is running in this project, remove it.';
  if (owner.backupPath && owner.phase !== 'restored') return ` It guards a test proof whose source files may still be swapped; candidate versions are in ${owner.backupPath}. Run run recover before anything else.`;
  if (owner.publicationFailure || owner.committing) return ' It records a commit that may not have completed; run run recover to inspect it before removing it.';
  if (owner.hostname === undefined) return ' It was written by an older CYC engine, which records no host, so it is not reclaimed automatically; if that process has ended, remove it after checking run recover.';
  if (owner.hostname !== here.hostname || owner.platform !== here.platform || (owner.pidNamespace ?? null) !== here.pidNamespace) return ` It was taken on ${owner.hostname}${owner.platform && owner.platform !== here.platform ? ` (${owner.platform})` : ''}${(owner.pidNamespace ?? null) !== here.pidNamespace ? ' in another process namespace, such as a container or WSL' : ''}, where this process cannot see whether its owner still runs.`;
  if (![undefined, 'restored'].includes(owner.phase)) return ` Its owner stopped in phase ${owner.phase}; run run recover to inspect it.`;
  if (Number.isFinite(owner.checkUntil) && Date.now() < owner.checkUntil) return ` A check it started may still be running until ${new Date(owner.checkUntil).toISOString()}; after that the lock is reclaimed if its process has ended.`;
  return ' A lock is reclaimed automatically once its process has ended on this machine.';
}
// Takes a lock file, reclaiming it once from an abandoned owner. The owner named in a refusal is read
// again, so it is the one holding the lock now, not one judged earlier.
function takeLock(root, path, kind, refuse) {
  for (let attempt = 0; ; attempt += 1) {
    try { return openSync(path, 'wx', 0o600); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = readLock(path);
      if (attempt < 3 && (owner === null || (lockAbandoned(owner) && reclaimLock(root, path, owner, kind)))) continue;
      throw refuse(readLock(path) ?? owner);
    }
  }
}

// Proof temporarily substitutes shared source. Other controller operations must
// not capture, check or record those bytes as another run's candidate.
function withWorkspaceLock(root, operation, protectedPaths, work) {
  const path = projectFile(root, '.cyc/runs/workspace.lock');
  if (protectedPathMatcher(root, protectedPaths)('.cyc/runs/workspace.lock')) throw new Error('Project operation lock is protected; no controller operation was started.');
  mkdirSync(dirname(path), { recursive: true });
  let fd = takeLock(root, path, 'workspace', owner => {
    const busy = new Error(`This project has another CYC operation (${owner?.operation ?? 'unknown'}${owner?.pid ? `; PID ${owner.pid}` : ''}). Wait for it to finish.${lockKept(owner)}`);
    busy.code = 'CYC_WORKSPACE_BUSY';
    return busy;
  });
  let retained = false;
  try {
    let owner = { operation, pid: process.pid, ...lockIdentity(), createdAt: new Date().toISOString() };
    writeFileSync(fd, JSON.stringify(owner) + '\n');
    closeSync(fd); fd = undefined;
    const ownership = {
      update(detail) { owner = { ...owner, ...detail }; atomicJSON(path, owner); },
      retain(failure) {
        retained = true;
        try { this.update({ publicationFailure: failure }); }
        catch { /* The prior durable owner/backup pointer remains; never remove it. */ }
      },
      get retained() { return retained; },
      get inFlightBackup() { return owner.phase !== 'restored' ? owner.backupPath : null; }
    };
    const outer = [cacheStage, activeOwnership];
    const stage = protectedPathMatcher(root, protectedPaths)('.cyc/runs/source-cache.json') ? null : {};
    [cacheStage, activeOwnership] = [stage, ownership];
    // The cache is written while the lock is still held.
    try {
      const result = work(ownership);
      saveCache(root, stage);
      return result;
    } catch (error) {
      forgetDisproved(root, stage);
      throw error;
    } finally { [cacheStage, activeOwnership] = outer; }
  } finally { if (fd !== undefined) closeSync(fd); if (!retained) unlinkSync(path); }
}

function transact(root, id, work) {
  const path = runPath(root, id);
  return withWorkspaceLock(root, `update run ${id}`, json(path).protectedPaths, ownership => {
    const lock = `${path}.lock`;
    // The run lock is taken only while holding the workspace lock, so one left behind belongs to an
    // operation that ended; it is reclaimed under the same rules as the workspace lock.
    const fd = takeLock(root, lock, 'run', owner => new Error(`This run is already being updated${owner?.pid ? ` (PID ${owner.pid})` : ''}.${lockKept(owner)}`));
    const lockOwner = { pid: process.pid, ...lockIdentity(), createdAt: new Date().toISOString() };
    writeFileSync(fd, JSON.stringify(lockOwner));
    let committing = false, committed = false;
    try {
      const state = json(path);
      const result = work(state, ownership);
      // Both locks say a commit is under way before it starts, so a crash, or a failed publication
      // whose record cannot be written, leaves locks that are never reclaimed as merely abandoned. If
      // these markers cannot be written, the commit does not start.
      ownership.update({ committing: true });
      writeFileSync(lock, JSON.stringify({ ...lockOwner, committing: true }));
      committing = true;
      atomicJSON(path, state);
      committed = true;
      writeReview(root, state);
      return result ?? state;
    } catch (error) {
      if (committing || ownership.inFlightBackup) {
        ownership.retain({ stateCommitted: committed, reason: error.message });
        // The retained run lock adds why to what it already records, so it is never reclaimed as
        // merely abandoned.
        try { writeFileSync(lock, JSON.stringify({ ...JSON.parse(readFileSync(lock, 'utf8')), publicationFailure: { stateCommitted: committed, reason: error.message } })); } catch { /* the committing marker still blocks */ }
        const failure = new Error(`${error.message} Controller outcome publication failed; operation and run locks are retained. Use run recover --run ${id} to inspect the owner/backup before deliberate operator recovery.`, { cause: error });
        failure.code = error.code;
        throw failure;
      }
      throw error;
    } finally { closeSync(fd); if (!ownership.retained) unlinkSync(lock); }
  });
}

function requireActive(state) {
  if (state.status !== 'running') throw new Error(`Run is ${state.status}; it cannot advance.`);
  if (state.engineVersion && state.engineVersion !== engineVersion) throw new Error(`Run started with CYC ${state.engineVersion}, current engine is ${engineVersion}. Stop this run, reload host skills, and explicitly start a new run; previous evidence is retained.`);
}
function budget(state) {
  if (!state.limits.maxDurationMs || Date.now() - Date.parse(state.startedAt) < state.limits.maxDurationMs) return true;
  state.status = 'exhausted';
  log(state, 'exhausted', { reason: 'Wall-clock budget reached; pausing does not reset it.' });
  return false;
}
function isWithin(path, prefix) { return path === prefix || path.startsWith(`${prefix}/`); }
function protectedPathMatcher(root, paths) {
  const location = path => {
    const physical = slash(physicalPath(projectFile(root, path)));
    return process.platform === 'win32' ? physical.toLowerCase() : physical;
  };
  const protectedLocations = paths.map(location);
  return path => {
    const target = location(path);
    return protectedLocations.some(prefix => isWithin(target, prefix) || isWithin(prefix, target));
  };
}
function selectLedger(root, id, config, allowedPaths, protectedPath) {
  const projectLedgerPath = normalizePaths(root, [config.ledgerPath], 'context.ledgerPath')[0];
  const protectedLedger = protectedPath(projectLedgerPath);
  const outsideScope = allowedPaths.length && !allowedPaths.some(prefix => isWithin(projectLedgerPath, prefix));
  if (!protectedLedger && !outsideScope) return { ledgerPath: projectLedgerPath, projectLedgerPath };
  const ledgerPath = normalizePaths(root, [`.cyc/runs/${id}/error-history.md`], 'error history')[0];
  if (protectedPath(ledgerPath)) throw new Error('Run-local error history is protected; resolve the project evidence policy before starting.');
  return { ledgerPath, projectLedgerPath, ledgerNote: `Project ledger ${protectedLedger ? 'is protected' : 'is outside allowedPaths'}. Retain history in this run; shared-ledger promotion needs authorized scope. Existing project policies still apply.` };
}
function guardChanges(root, state, snapshot) {
  const all = new Set([...Object.keys(state.initialSource.files), ...Object.keys(snapshot.files)]);
  const changes = [...all].filter(path => state.initialSource.files[path] !== snapshot.files[path]);
  const protectedChanges = changes.filter(path => state.protectedPaths.some(prefix => isWithin(path, prefix)));
  const protectedNow = protectedSnapshot(root, state.protectedPaths);
  for (const path of new Set([...Object.keys(state.protectedFiles), ...Object.keys(protectedNow)])) {
    if (state.protectedFiles[path] !== protectedNow[path] && !protectedChanges.includes(path)) protectedChanges.push(path);
  }
  const outOfScope = state.allowedPaths.length ? changes.filter(path => !state.allowedPaths.some(prefix => isWithin(path, prefix))) : [];
  return { protectedChanges, outOfScope };
}
function guard(root, state, snapshot = cachedSnapshot(root)) {
  const { protectedChanges, outOfScope } = guardChanges(root, state, snapshot);
  if (protectedChanges.length || outOfScope.length) {
    state.status = 'halted';
    log(state, 'guard-halt', { protectedChanges, outOfScope, reason: 'Changes preserved for review; no automatic rollback.' });
    return false;
  }
  return true;
}
function failedAttempt(state, reason, signature) {
  state.failures += 1;
  state.attempt += 1;
  state.noProgress = state.lastFailureSignature === signature ? state.noProgress + 1 : 1;
  state.lastFailureSignature = signature;
  state.verification = null;
  log(state, 'attempt-failed', { stage: current(state), reason, failures: state.failures });
  if (state.failures >= state.limits.maxAttempts || state.noProgress >= state.limits.maxNoProgress) {
    state.status = 'exhausted';
    log(state, 'exhausted', { reason: state.noProgress >= state.limits.maxNoProgress ? 'Repeated unchanged failure.' : 'Shared failure budget reached.' });
  }
}

// A check without its own timeoutMs may run this long: long enough for a large suite, short enough
// that a hung check cannot hold the controller forever.
export const defaultCheckTimeoutMs = 30 * 60 * 1000;
// Each stream is kept whole up to this many bytes, for its test results; past it only a rolling tail
// is kept, the results count as cut off, and the exit code still decides the check.
const outputReadLimit = 64 * 1024 * 1024;
// A UTF-8 character is at most four bytes, so this many bytes always hold the kept tail.
const tailBytes = outputLimit * 4;

// Runs one check from a helper process. Output is copied to files only up to `limit` bytes per
// stream, with a rolling tail kept past that, so a check that prints without end cannot fill the
// disk. A check that runs out of time, or whose controller has gone, is stopped with its whole
// process tree. A check that exits while something it started still holds its output is finished
// two seconds later. The helper runs this function from a generated file, so it uses nothing from
// this module: `io` brings the Node functions it needs.
export function runCheckProcess(spec, io) {
  return new Promise(finish => {
    const streams = {};
    let child, timedOut = false, failure = null, done = false, grace, drain, watch;
    const stop = () => {
      if (!child?.pid) return;
      if (process.platform === 'win32') {
        // By full path, so a PATH without System32 cannot leave the tree running.
        const killed = io.spawnSync(`${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\taskkill.exe`, ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        if (killed.error || killed.status !== 0) { try { child.kill(); } catch { /* already ended */ } }
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* already ended */ } } }
    };
    const end = status => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(grace); clearTimeout(drain); clearInterval(watch);
      const bytes = {}, stored = {}, tailPeak = {};
      for (const [name, stream] of Object.entries(streams)) {
        io.closeSync(stream.fd);
        io.writeFileSync(`${spec[name]}.tail`, Buffer.concat(stream.tail).subarray(-spec.tailBytes));
        bytes[name] = stream.bytes; stored[name] = stream.stored; tailPeak[name] = stream.tailPeak;
      }
      finish({ status: timedOut ? null : status, timedOut, error: failure, bytes, stored, tailPeak });
    };
    // A process that ignores the kill and keeps its output open must not hold the controller.
    const timer = setTimeout(() => { timedOut = true; stop(); grace = setTimeout(() => end(null), 5000); }, spec.timeoutMs);
    if (spec.parentPid) {
      watch = setInterval(() => {
        try { process.kill(spec.parentPid, 0); } catch (error) { if (error.code === 'ESRCH') { stop(); failure = { code: 'CYC_CONTROLLER_ENDED', message: 'The controller ended while the check ran.' }; end(null); } }
      }, 500);
    }
    if (spec.forwardSignals) for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { stop(); process.exit(1); });
    for (const name of ['stdout', 'stderr']) streams[name] = { fd: io.openSync(spec[name], 'w'), bytes: 0, stored: 0, tail: [], tailLength: 0, tailPeak: 0 };
    const env = { ...process.env };
    if (spec.nodeOptions === null) delete env.NODE_OPTIONS; else if (spec.nodeOptions !== undefined) env.NODE_OPTIONS = spec.nodeOptions;
    try { child = io.spawn(spec.command, spec.args, { cwd: spec.cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' }); }
    catch (error) { failure = { code: error.code ?? null, message: error.message }; end(null); return; }
    for (const name of ['stdout', 'stderr']) {
      const stream = streams[name];
      child[name].on('data', chunk => {
        if (done) return;
        if (stream.stored === stream.bytes && stream.stored < spec.limit) {
          // A write that fails (a full disk) stops storing; the stream then counts as cut off.
          try { stream.stored += io.writeSync(stream.fd, chunk, 0, Math.min(chunk.length, spec.limit - stream.stored)); } catch { /* stored stays short of bytes */ }
        }
        stream.bytes += chunk.length;
        stream.tail.push(chunk); stream.tailLength += chunk.length;
        while (stream.tailLength - stream.tail[0].length >= spec.tailBytes) stream.tailLength -= stream.tail.shift().length;
        stream.tailPeak = Math.max(stream.tailPeak, stream.tailLength);
      });
    }
    child.on('error', error => { failure = { code: error.code ?? null, message: error.message }; if (!child.pid) end(null); });
    // Once the check has exited it can no longer time out; its exit code stands.
    child.on('exit', code => { if (timedOut) return; clearTimeout(timer); drain = setTimeout(() => end(code), 2000); });
    child.on('close', end);
  });
}
// The helper program, written next to each check's output. A .cjs file is CommonJS whatever the
// project or NODE_OPTIONS say, and it takes no space on the check's command line. The header keeps a
// project linter that reads .cyc/runtime, where the output may fall back to, off this generated file;
// it is split so this module itself still carries the installer's single lint header.
const checkRunnerSource = `${'/* eslint'}-disable */
'use strict';
const fs = require('node:fs');
const [specPath, resultPath] = process.argv.slice(2);
(${runCheckProcess})(JSON.parse(fs.readFileSync(specPath, 'utf8')), { ...require('node:child_process'), ...fs })
  // Exit at once: a process the check left behind may still hold its output open.
  .then(result => { fs.writeFileSync(resultPath, JSON.stringify(result)); process.exit(0); }, error => { fs.writeFileSync(resultPath, JSON.stringify({ crashed: String(error && error.stack || error) })); process.exit(70); });
`;

// Records in the operation lock until when the running check may last. A scanner briefly holding the
// lock file must not fail the check or halt a proof, so the write is retried and then given up; the
// lock then only lacks this extra protection.
function markCheck(until) {
  for (let attempt = 0; activeOwnership && attempt < 4; attempt += 1) {
    try { activeOwnership.update({ checkUntil: until }); return; } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50); }
  }
}

function checkFolder(root) {
  try { return mkdtempSync(resolve(tmpdir(), 'cyc-check-')); } catch (error) {
    // Without a usable system temp folder, output stays in controller bookkeeping inside the project.
    try { const base = projectFile(root, '.cyc/runtime/checks'); mkdirSync(base, { recursive: true }); return mkdtempSync(resolve(base, 'cyc-check-')); }
    catch { throw new Error(`Cannot create a folder for check output in ${tmpdir()} (${error.code ?? error.message}) or in .cyc/runtime. Free space or fix permissions, then retry.`); }
  }
}
// Slicing can split a surrogate pair; a lone low surrogate at the start is dropped.
const keepTail = text => { const tail = text.slice(-outputLimit); return /^[\uDC00-\uDFFF]/.test(tail) ? tail.slice(1) : tail; };
function readOutput(path, bytes, stored, limit) {
  if (stored === bytes && bytes <= limit) { const whole = readFileSync(path, 'utf8'); return { whole, tail: keepTail(whole) }; }
  return { whole: null, tail: keepTail(readFileSync(`${path}.tail`).toString('utf8')) };
}

export function runCommands(root, commands, remaining = () => Infinity, { readLimit = outputReadLimit } = {}) {
  const results = [];
  for (const command of commands) {
    const left = remaining();
    if (left <= 0) break;
    const timeoutMs = Math.min(command.timeoutMs ?? defaultCheckTimeoutMs, left);
    const folder = checkFolder(root);
    let run, stdout = '', stderr = '', tests = null;
    try {
      const file = name => resolve(folder, name);
      // The runner gets no NODE_OPTIONS, so a preload cannot break it; the check still gets them.
      const spec = { command: command.command, args: command.args ?? [], cwd: root, timeoutMs, limit: readLimit, tailBytes, stdout: file('stdout'), stderr: file('stderr'), parentPid: process.pid, forwardSignals: true, nodeOptions: process.env.NODE_OPTIONS ?? null };
      writeFileSync(file('runner.cjs'), checkRunnerSource);
      writeFileSync(file('spec.json'), JSON.stringify(spec));
      const { NODE_OPTIONS, ...env } = process.env;
      // While the check runs, the operation lock says until when, so a lock left by a controller
      // that was killed is not reclaimed while a check it started may still be running.
      markCheck(Date.now() + timeoutMs + 65000);
      // The runner stops the check itself; this outer limit only catches a runner that hangs.
      const helper = spawnSync(process.execPath, [file('runner.cjs'), file('spec.json'), file('result.json')], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', timeout: timeoutMs + 60000, maxBuffer: 1024 * 1024 });
      markCheck(null); // if this cannot be written, the lock only waits longer before reclaim
      try { run = JSON.parse(readFileSync(file('result.json'), 'utf8')); if (run.crashed) throw new Error(run.crashed); }
      catch (error) { run = { status: null, timedOut: false, bytes: null, error: { code: helper.error?.code ?? 'CYC_CHECK_RUNNER', message: `The check runner failed: ${helper.error?.message ?? (run?.crashed ? error.message : (helper.stderr?.trim().slice(-2000) || `exit ${helper.status}`))}` } }; }
      if (run.bytes) {
        const streams = ['stdout', 'stderr'].map(name => readOutput(file(name), run.bytes[name], run.stored[name], readLimit));
        [stdout, stderr] = streams.map(stream => stream.tail);
        // Only the tail of long output is kept, so test results are first read from all of it.
        if (streams.some(stream => stream.whole === null)) tests = { failing: [], passingCount: 0, other: [], complete: false };
        else if (streams.some(stream => stream.whole.length > outputLimit)) tests = summarizeTests(streams[0].whole, streams[1].whole);
      }
    } finally {
      // A scanner can still hold the files open on Windows; a folder left in the temp directory
      // must not decide the check.
      try { rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* left for the system's temp cleanup */ }
    }
    // A check cut short by the run's own deadline needs a longer budget, not a longer timeout.
    const error = !run.timedOut ? run.error?.message ?? null
      : left < (command.timeoutMs ?? defaultCheckTimeoutMs) ? `Check stopped after ${timeoutMs} ms, when the run's time budget (limits.maxDurationMs) ran out.`
      : `Check timed out after ${timeoutMs} ms. If it needs longer, give it a larger timeoutMs; a check without one gets ${defaultCheckTimeoutMs / 60000} minutes.`;
    results.push({ id: command.id, command: command.command, args: command.args, exitCode: run.status,
      passed: run.status === 0 && !run.error && !run.timedOut, stdout, stderr, ...(tests ? { tests } : {}), error, errorCode: run.timedOut ? 'ETIMEDOUT' : run.error?.code ?? null, timeoutMs });
  }
  return results;
}

const baselineCachePath = root => resolve(root, '.cyc/runs/baseline-cache.json');
function readBaselineCache(root) {
  try { return json(baselineCachePath(root)); } catch { return {}; }
}
const baselineFile = (root, id) => projectFile(root, `.cyc/runs/${id}/baseline.json`);

const measuredResult = ({ id: check, passed, exitCode, error, stdout, stderr, tests }) => ({ id: check, passed, exitCode, error, stdout, stderr, ...(tests ? { tests } : {}) });

// A clean measurement is reused by a later run of the same source and checks.
function cacheBaseline(root, record) {
  const cache = readBaselineCache(root);
  cache[record.cacheKey] = { checkedAt: record.checkedAt, results: record.results };
  const keys = Object.keys(cache);
  for (const key of keys.slice(0, Math.max(0, keys.length - 20))) delete cache[key];
  atomicJSON(baselineCachePath(root), cache);
}

// Runs in the background worker (or inline in sync mode). Writes only the cache, the untouched
// finish template, and baseline.json, never state.json, so it cannot collide with the agent's
// controller commands. baseline.json comes last: once it appears, the worker has no writes left.
export function measureBaseline(root, id) {
  const path = baselineFile(root, id);
  let state;
  try { state = readRun(root, id); } catch (error) {
    // A record that cannot be read still gets a result, so the run never waits for one.
    const record = { status: 'error', startedAt: new Date().toISOString(), reason: `The run record could not be read: ${error.message}` };
    try { atomicJSON(path, record); } catch { /* the run may have been removed */ }
    return record;
  }
  const base = { cacheKey: state.baseline.cacheKey, sourceHash: state.baseline.sourceHash, startedAt: new Date().toISOString() };
  let record;
  try {
    // The agent's first command and this measurement both take the operation lock. The measurement
    // yields and tries again for a short while, so losing that race does not cost the baseline.
    record = retryWhileBusy(() => withWorkspaceLock(root, `baseline run ${id}`, state.protectedPaths, () => {
      const before = cachedSnapshot(root);
      // Output tails, and the test summary of longer output, are kept so an accepted failure can be
      // shown to fail the same way at verification.
      const results = runCommands(root, state.commands).map(measuredResult);
      const after = sourceSnapshot(root);
      // Edits by the agent, another session, or a file-writing check make the measurement unreliable.
      const clean = before.hash === state.baseline.sourceHash && after.hash === state.baseline.sourceHash;
      return clean
        ? { ...base, status: 'complete', checkedAt: new Date().toISOString(), results }
        : { ...base, status: 'invalid', checkedAt: new Date().toISOString(), results, reason: 'Project files changed while the baseline was measured (an edit started before it finished, another session edited the folder, or a configured check writes files). Pre-existing failures cannot be accepted for this run.' };
    }));
    if (record.status === 'complete') cacheBaseline(root, record);
  } catch (error) {
    record = { ...base, status: 'error', reason: error.message };
  }
  try { if (record.status === 'complete') hintFinishTemplate(root, state, record); } catch { /* the hint is optional; finish still reports the check */ }
  try { atomicJSON(path, record); } catch { /* the run may have been removed */ }
  return record;
}

// Up to ten seconds of short waits while another controller operation holds the lock; a lock still
// held after that is reported as before.
function retryWhileBusy(work, { attempts = 40, delayMs = 250 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return work(); } catch (error) {
      if (error.code !== 'CYC_WORKSPACE_BUSY' || attempt >= attempts) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
  }
}

// The background worker's process, recorded at start so a worker that ended without writing its
// result is noticed, instead of leaving the baseline pending for the rest of the run.
const baselineWorkerFile = (root, id) => projectFile(root, `.cyc/runs/${id}/baseline-worker.json`);
function baselineWorker(root, id) {
  try { const path = baselineWorkerFile(root, id); return existsSync(path) ? json(path) : null; } catch { return null; }
}
function currentBaseline(root, state) {
  if (!state.baseline || state.baseline.status !== 'pending') return state.baseline ?? null;
  const path = baselineFile(root, state.id);
  if (existsSync(path)) return { ...state.baseline, ...json(path) };
  const worker = baselineWorker(root, state.id);
  const ended = worker && (worker.pid === null || (Number.isSafeInteger(worker.pid) && worker.pid > 0 && !processAlive(worker.pid)));
  if (ended) {
    const what = worker.pid === null ? 'did not start' : `(pid ${worker.pid}) ended before writing its result`;
    return { ...state.baseline, status: 'error', reason: `The baseline measurement process ${what}. Pre-existing failures cannot be accepted for this run; the proof's control run measures the run-start code instead.` };
  }
  return state.baseline;
}

// The commit that reproduces the files as they were at run start. `git stash create` captures
// uncommitted tracked edits as a commit without touching the index, tree, or stash list.
function gitBase(root) {
  const git = args => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  if (git(['rev-parse', '--is-inside-work-tree']).stdout?.trim() !== 'true') return null;
  const head = git(['rev-parse', '--verify', 'HEAD']);
  if (head.status !== 0) return null;
  const stash = git(['stash', 'create']);
  return { commit: (stash.status === 0 && stash.stdout.trim()) || head.stdout.trim(), prefix: git(['rev-parse', '--show-prefix']).stdout.trim(), trackedSnapshot: stash.status === 0 && !stash.error };
}

// Reuse tracked originals when Git captured its working tree successfully.
// Otherwise retain permitted selected bytes; never reclassify excluded inputs.
// Capture holds the originals in memory until the run exists, so it keeps limits of its own,
// well below the selected-source limits a snapshot can hash.
const captureLimits = Object.freeze({ maxFiles: 20000, maxBytes: 128 * 1024 * 1024 });
function captureOriginals(root, snapshot, recoverableTracked, allowedPaths, protectedPath) {
  const skipped = new Set(snapshot.skipped.map(item => item.path));
  let files = Object.keys(snapshot.files).filter(path => !skipped.has(path) && (!allowedPaths.length || allowedPaths.some(prefix => isWithin(path, prefix))));
  if (recoverableTracked) files = files.filter(path => !recoverableTracked.has(path));
  files = files.filter(path => !protectedPath(path));
  if (files.length > captureLimits.maxFiles) throw new Error(`Original-source capture would copy ${files.length} files, more than ${captureLimits.maxFiles}. Narrow allowedPaths to the task, or commit so Git keeps the originals.`);
  const blobs = new Map();
  let bytes = 0;
  for (const path of files) {
    const absolute = projectFile(root, path), stat = lstatSync(absolute);
    if (!stat.isFile() || stat.size > captureLimits.maxBytes) throw new Error(`Cannot capture a regular original within the capture size limit: ${path}`);
    const content = readFileSync(absolute), expected = snapshot.files[path];
    if (digest(content) !== expected) throw new Error(`Source changed while capturing originals: ${path}. Inspect concurrent edits before starting.`);
    if (!blobs.has(expected)) {
      bytes += content.length;
      if (bytes > captureLimits.maxBytes) throw new Error(`Original-source capture exceeds ${captureLimits.maxBytes} bytes. Narrow allowedPaths to the task, or commit so Git keeps the originals.`);
      blobs.set(expected, content);
    }
  }
  return { metadata: { version: 1, files, bytes }, blobs };
}

function storeOriginals(root, id, capture) {
  for (const [hash, content] of capture.blobs) {
    const path = projectFile(root, `.cyc/runs/${id}/original-source/${hash}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, { flag: 'wx' });
  }
}

// Original bytes of a path at run start, or null if it did not exist then. Refuses rather than
// guessing: recovered bytes must match the hash recorded when the run started.
function originalContent(root, state, path) {
  const expected = state.initialSource.files[path];
  if (expected === undefined) return null;
  const now = existsSync(projectFile(root, path)) ? readFileSync(projectFile(root, path)) : null;
  if (now && digest(now) === expected) return now;
  if (state.sourceCapture?.version === 1 && state.sourceCapture.files.includes(path)) {
    if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Invalid captured original hash: ${path}`);
    const captured = projectFile(root, `.cyc/runs/${state.id}/original-source/${expected}`);
    if (!existsSync(captured)) throw new Error(`Captured original is missing: ${path}. Proof cannot reconstruct the original from changed files.`);
    const content = readFileSync(captured);
    if (digest(content) !== expected) throw new Error(`Captured original has changed: ${path}. Proof refused before changing source.`);
    return content;
  }
  // A checkout applies line-ending and other filters, but a file written directly may hold the
  // unfiltered bytes. Accept whichever form matches the recorded hash exactly.
  for (const mode of state.base ? ['--filters', '-p'] : []) {
    const shown = spawnSync('git', ['-C', root, 'cat-file', mode, `${state.base.commit}:${state.base.prefix}${path}`], { windowsHide: true, timeout: 15000, maxBuffer: 64 * 1024 * 1024 });
    if (shown.status !== 0) continue;
    if (digest(shown.stdout) === expected) return shown.stdout;
    // A manually written CRLF file can disagree with Git's current eol attributes.
    // Latin-1 preserves every byte; only an exact original hash permits this candidate.
    const crlf = Buffer.from(shown.stdout.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1');
    if (digest(crlf) === expected) return crlf;
  }
  throw new Error(`Cannot recover the run-start version of ${path} (untracked when the run started, or changed outside Git). Record a testProof exemption with this reason instead.`);
}

export const testPattern = /(^|\/)(tests?|__tests__|specs?)\/|[._-](test|spec)s?\.[^/]+$|(^|\/)test_[^/]+\.py$|_test\.(go|py|rb|exs?)$/i;
const proofPlaybooks = ['bug-fix', 'feature', 'refactor'];
const hasOriginals = state => !!state.base || state.sourceCapture?.version === 1;
const provable = state => hasOriginals(state) && state.workContractVersion === 1 && proofPlaybooks.includes(state.playbook);

function testProofStatus(root, state, snapshot = null) {
  if (state.workContractVersion !== 1 || !proofPlaybooks.includes(state.playbook) || state.base === undefined) return null;
  const mode = state.playbook === 'refactor' ? 'green' : 'red';
  if (!hasOriginals(state)) return { required: false, mode, status: 'unavailable', reason: 'This older run has neither a Git base nor a run-start source capture.' };
  const proof = state.testProof;
  if (!proof?.passed) return { required: true, mode, status: proof ? 'failed' : 'missing', command: `run prove-red --run ${state.id}`, ...(proof ? { verdict: proof.verdict } : {}) };
  const files = (snapshot ?? cachedSnapshot(root)).files;
  const stale = Object.entries(proof.testFiles).filter(([path, hash]) => files[path] !== hash).map(([path]) => path);
  return stale.length ? { required: true, mode, status: 'stale', stale, command: `run prove-red --run ${state.id}` } : { required: true, mode, status: 'proven', testFiles: Object.keys(proof.testFiles) };
}

// Prove the new or changed tests can see the change: run the configured checks with the new tests
// against the run-start source. Bug fixes and features must go red there, and the run-start
// project must pass, so the failure comes from the new tests. Refactors must stay green, which
// shows the tests pin behavior the original code already had. Files are restored afterwards; a
// backup stays until the restored tree matches the pre-proof snapshot exactly.
export function proveRun(root, id, { tests } = {}) {
  return transact(root, id, (state, ownership) => {
    requireActive(state);
    if (!budget(state) || !guard(root, state)) return state;
    if (!proofPlaybooks.includes(state.playbook) || !state.commands.length) throw new Error('Test proof applies to bug-fix, feature, and refactor runs with configured checks.');
    if (!['build', 'verify'].includes(current(state))) throw new Error('Prove the tests after writing them, during build or verify.');
    if (!hasOriginals(state)) throw new Error('Test proof needs a recorded Git base or run-start source capture. Existing runs cannot gain originals after edits; retain the actual limitation.');
    const baseline = currentBaseline(root, state);
    if (baseline?.status === 'pending') throw new Error('The baseline is still measuring in the background. Try again when run next shows it complete.');
    const mode = state.playbook === 'refactor' ? 'green' : 'red';
    const before = sourceSnapshot(root);
    const initial = state.initialSource.files;
    const changed = [...new Set([...Object.keys(initial), ...Object.keys(before.files)])].filter(path => initial[path] !== before.files[path]);
    const testFiles = tests?.length ? tests.map(path => inputPath(root, path)) : changed.filter(path => testPattern.test(path));
    if (!testFiles.length) throw new Error('No new or changed test files found. Write the test first (or name it with --tests), or record a testProof exemption explaining why this change has no testable behavior.');
    for (const path of testFiles) if (!changed.includes(path)) throw new Error(`${path} is unchanged since the run started; prove the tests you wrote or changed.`);
    const sourceFiles = changed.filter(path => !testFiles.includes(path));
    if (mode === 'red' && !sourceFiles.length) throw new Error('Only test files changed, so there is no code change for the tests to catch.');
    const originals = new Map(changed.map(path => [path, originalContent(root, state, path)]));
    const currentBytes = new Map(changed.map(path => [path, existsSync(projectFile(root, path)) ? readFileSync(projectFile(root, path)) : null]));
    // The backup lives outside the project: a copy inside it would be found by test runners and
    // file watchers and change what the proof measures.
    const backup = mkdtempSync(resolve(tmpdir(), `cyc-prove-${id.slice(0, 8)}-`));
    for (const [path, bytes] of currentBytes) if (bytes) { const target = resolve(backup, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes); }
    const manifest = { project: root, note: 'Candidate versions saved before test proof. Compare with current files if restoration halts; never copy over unexpected edits blindly.', files: [...currentBytes].map(([path, bytes]) => ({ path, existed: bytes !== null, sha256: bytes === null ? null : digest(bytes) })) };
    atomicJSON(resolve(backup, 'manifest.json'), manifest);
    // Publish the durable backup before the first source swap. An interrupted
    // process leaves this owner record and both locks for read-only recovery.
    ownership.update({ operation: `test proof run ${id}`, runId: id, backupPath: backup, candidateSourceHash: before.hash, phase: 'prepared' });
    const expected = new Map(currentBytes), conflicts = new Map();
    const same = (left, right) => left === null || right === null ? left === right : left.equals(right);
    const observe = path => {
      if (conflicts.has(path)) return false;
      try {
        const target = projectFile(root, path);
        let bytes = null;
        try {
          if (!lstatSync(target).isFile()) throw new Error('Path is no longer a regular file.');
          bytes = readFileSync(target);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (same(bytes, expected.get(path))) return true;
        const conflict = { path, reason: 'File changed after CYC placed its temporary version.', observedHash: bytes === null ? null : digest(bytes) };
        conflicts.set(path, conflict);
        if (bytes !== null) {
          const saved = resolve(backup, 'conflicts', conflict.observedHash);
          try { mkdirSync(dirname(saved), { recursive: true }); writeFileSync(saved, bytes); conflict.savedUnexpected = saved; }
          catch (error) { conflict.preservationError = error.message; }
        }
      } catch (error) { conflicts.set(path, { path, reason: error.message }); }
      return false;
    };
    const inspect = () => { for (const path of changed) observe(path); };
    const apply = (paths, source) => {
      for (const path of paths) {
        if (!observe(path)) continue;
        const target = projectFile(root, path); const bytes = source.get(path);
        if (same(bytes, expected.get(path))) continue;
        if (bytes === null) { if (existsSync(target)) unlinkSync(target); }
        else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: expected.get(path) === null ? 'wx' : 'w' }); }
        expected.set(path, bytes);
      }
    };
    // When this change only adds new test files (no test file existed at run start under those
    // paths, and no test file was edited or deleted), the treatment is the run-start suite plus the
    // new files, on the same source. If every failure there is in a new file, and the runner printed
    // nothing but test results, the control run (the suite without the new files) can only pass, so
    // it cannot change the verdict. Returns the failing new tests by check in that case, and null
    // whenever the control is needed: an existing test file changed, moved or deleted; output without
    // test names, or cut short; a failure outside the new files; or any line besides test results
    // (a coverage threshold, a lint error, a warning), which may fail the check on the run-start code.
    const testsDeleted = changed.some(path => testPattern.test(path) && before.files[path] === undefined);
    const onlyNewTestFiles = !testsDeleted && testFiles.every(path => originals.get(path) === null);
    // A failure's file as an exact project-relative path. Runners report absolute paths (node --test)
    // or paths relative to the project (tap, jest); a suffix match would let an old failure in
    // legacy/test/x.test.mjs pass for a new test/x.test.mjs. Anything outside the project is null.
    const realRoot = realpathSync(root);
    const projectRelative = file => {
      if (!text(file)) return null;
      const value = file.replace(/^file:\/\/\/?/, '').split(String.fromCharCode(92)).join('/');
      const path = isAbsolute(value) || /^[A-Za-z]:\//.test(value) ? slash(relative(realRoot, resolve(value))) : value.replace(/^\.\//, '');
      return !path || path === '..' || path.startsWith('../') || isAbsolute(path) ? null : path;
    };
    const failuresInNewTestFiles = results => {
      if (!onlyNewTestFiles) return null;
      const added = {};
      for (const result of results) {
        if (result.passed) continue;
        const tests = cutOff(result) ? null : testsOf(result);
        if (!tests?.failing.size || tests.other.size) return null;
        const names = [];
        for (const entry of tests.failing.values()) {
          if (!testFiles.includes(projectRelative(entry.file))) return null;
          names.push(entry.path.join(' > '));
        }
        added[result.id] = names;
      }
      return added;
    };
    let treatment; let control = null; let controlSource = null; let added = null; let failure;
    try {
      apply(sourceFiles, originals);
      if (!conflicts.size) treatment = runCommands(root, state.commands);
      inspect();
      if (!conflicts.size && mode === 'red') {
        // The control run measures the run-start code, to tell a failure the new tests cause from
        // one that was already there. It cannot change the verdict when the treatment passes every
        // check (the new tests would not catch the change), or when every failure is in a new file.
        added = treatment.every(result => result.passed) ? {} : failuresInNewTestFiles(treatment);
        if (added) controlSource = Object.keys(added).length ? 'not needed: every failure is in a test file this change added' : 'not needed: every check passed with the new tests';
        else if (baseline?.status === 'complete' && baseline.sourceHash === state.initialSource.hash) { control = baseline.results; controlSource = 'baseline at run start'; }
        else { apply(testFiles, originals); if (!conflicts.size) { control = runCommands(root, state.commands); controlSource = 'in place'; } }
      }
    } catch (error) { failure = error.message; }
    finally {
      inspect();
      // Restore owned paths independently: one I/O failure must not abandon the
      // remaining candidate files, and an unexpected version is never replaced.
      for (const path of changed) {
        try { apply([path], currentBytes); }
        catch (error) { conflicts.set(path, { path, reason: `Candidate restoration failed: ${error.message}` }); }
      }
    }
    let restored;
    try { restored = sourceSnapshot(root); } catch (error) { failure = failure ?? `Restoration inspection failed: ${error.message}`; }
    if (!failure && !conflicts.size && restored?.hash === before.hash) {
      try { ownership.update({ phase: 'restored' }); }
      catch (error) { failure = `Could not record completed restoration: ${error.message}`; }
    }
    if (failure || conflicts.size || restored?.hash !== before.hash) {
      const changedPaths = restored ? [...new Set([...Object.keys(before.files), ...Object.keys(restored.files)])].filter(path => before.files[path] !== restored.files[path]) : [];
      state.proofRecovery = { backupPath: backup, conflicts: [...conflicts.values()], changedPaths, error: failure ?? null, checkedAt: new Date().toISOString() };
      state.testProof = null;
      state.verification = null;
      state.status = 'halted';
      try { ownership.update({ phase: 'halted' }); }
      catch (error) { state.proofRecovery.preservationError = `Could not update operation ownership: ${error.message}`; }
      try { atomicJSON(resolve(backup, 'manifest.json'), { ...manifest, recovery: state.proofRecovery }); }
      catch (error) { state.proofRecovery.preservationError = [state.proofRecovery.preservationError, `Could not update backup manifest: ${error.message}`].filter(Boolean).join(' '); }
      log(state, 'guard-halt', { reason: `Test proof detected a source conflict or restoration failure. Unexpected files were preserved; candidate versions are saved in ${backup}. Compare and merge manually; this run cannot resume.` });
      return { runId: id, status: state.status, passed: false, error: `Proof halted. Preserve current files and compare them with candidate versions in ${backup}; do not overwrite either blindly.`, recovery: state.proofRecovery };
    }
    rmSync(backup, { recursive: true, force: true });
    const summary = results => results?.map(({ id: check, passed, exitCode }) => ({ id: check, passed, exitCode })) ?? null;
    // With test runner output (TAP, mocha, jest) the proof sees test names: treatment and control
    // differ only by the new tests, so a failing test that the control run did not have is one of
    // the new tests failing. That also works when the check already failed on the run-start code
    // for an older test. A name counts only for a test in a changed test file that is not an old
    // failure renamed or wrapped in place, and never from cut-off output with no complete summary.
    const inChangedTests = file => Boolean(file) && testFiles.some(path => file === path || file.endsWith(`/${path}`));
    const newlyFailing = result => {
      const before = control?.find(item => item.id === result.id);
      if (result.passed || !before || cutOff(result) || cutOff(before)) return [];
      const now = testsOf(result);
      const then = before.passed ? { failing: new Map() } : testsOf(before);
      if (!now || !then) return [];
      const old = [...then.failing.values()];
      return [...now.failing].filter(([key, entry]) => entry.count > (then.failing.get(key)?.count ?? 0) && inChangedTests(entry.file)
        && !old.some(item => item.file === entry.file && item.leaf === entry.leaf)).map(([, entry]) => entry.path.join(' > '));
    };
    const named = mode === 'red' ? added ?? Object.fromEntries(treatment.map(result => [result.id, newlyFailing(result)]).filter(([, names]) => names.length)) : {};
    const caught = mode === 'red' ? added ? Object.keys(added) : treatment.filter(result => !result.passed && (control.find(item => item.id === result.id)?.passed || named[result.id])).map(result => result.id) : [];
    const passed = mode === 'red' ? caught.length > 0 : treatment.every(result => result.passed);
    const alreadyFailing = mode === 'red' && treatment.some(result => !result.passed) && !caught.length;
    const failingNames = caught.flatMap(check => named[check] ?? []);
    const listed = failingNames.length ? `${failingNames.slice(0, 5).join('; ')}${failingNames.length > 5 ? `; and ${failingNames.length - 5} more` : ''}` : null;
    const preexisting = added ? [] : caught.filter(check => !control.find(item => item.id === check)?.passed);
    const verdict = mode === 'red'
      // State only what the proof shows. Agents repeat this sentence; "the new tests fail" was
      // reported as "every new test fails", which a check-level result cannot establish.
      ? (passed ? listed ? `With the new tests added, these tests fail on the run-start code: ${listed} (check ${caught.join(', ')}).${preexisting.length ? ` Check ${preexisting.join(', ')} already failed there for other tests, which still fail and are not attributed to this change.` : ''} Other new tests pass there; they may guard existing behavior.`
        : `With the new tests added, check ${caught.join(', ')} fails on the run-start code, which otherwise passes it, so at least one new test catches this change. This does not show that every new test fails there; some may guard existing behavior. Report it as "at least one new test fails without the fix" unless you ran the tests individually.`
        : alreadyFailing ? `Inconclusive: the run-start code already fails ${treatment.filter(result => !result.passed).map(result => result.id).join(', ')}, so the failure cannot be attributed to the new tests. The proof needs a check that passes on the run-start code, such as the test runner on its own.`
        : 'The new tests pass on the run-start code, so they would not catch a regression of this change. Strengthen them.')
      : (passed ? 'The tests pass on the run-start code, so they pin behavior the original already had.'
        : 'The tests fail on the run-start code, so they assert new behavior. A refactor must preserve behavior; fix the tests or reclassify the work.');
    // The sentence a reply may quote: what this check-level proof shows, and what it does not.
    const claim = !passed ? null : mode !== 'red' ? 'The new tests pass on the original code, so they pin its behavior.'
      : listed ? `These new tests fail on the original code: ${listed} (check ${caught.join(', ')}).`
      : `At least one new test fails on the original code (check ${caught.join(', ')}); the cases were not run one by one.`;
    const receiptPath = `.cyc/runs/${id}/checks/proof-${randomUUID()}.json`;
    atomicJSON(projectFile(root, receiptPath), { mode, passed, verdict, claim, base: state.base?.commit ?? null, originalSourceHash: state.initialSource.hash, testFiles, sourceFiles, treatment, control, ...(controlSource ? { controlSource } : {}), checkedAt: new Date().toISOString() });
    state.testProof = { mode, passed, verdict, claim, testFiles: Object.fromEntries(testFiles.map(path => [path, before.files[path]])), sourceFiles, receiptPath, checkedAt: new Date().toISOString() };
    log(state, 'test-proof', { mode, passed, receipt: receiptPath });
    return { runId: id, mode, passed, verdict, ...(claim ? { proofClaim: claim } : {}), testFiles, sourceFiles, treatment: summary(treatment), control: summary(control), receiptPath };
  });
}

function requireTestProof(root, state, exemption) {
  if (exemption !== undefined) {
    if (exemption?.status !== 'exempt' || !text(exemption.reason) || /^<[\s\S]*>$/.test(exemption.reason.trim())) throw new Error('assessment.testProof must be {"status":"exempt","reason":"why this change has no testable behavior"}.');
    return;
  }
  const status = testProofStatus(root, state);
  if (status.status === 'stale') throw new Error(`Tests changed after their proof (${status.stale.join(', ')}). Run ${status.command} again.`);
  if (status.status !== 'proven') throw new Error(`Show the new tests catch this change: ${status.command}${status.verdict ? ` (last proof: ${status.verdict})` : ''}. If the change has no testable behavior, add assessment.testProof {"status":"exempt","reason":"..."}.`);
}

// The Stop gate names a conversation by a key derived from the host's native session ID
// (response-hook.mjs). Store that key when an agent passes the native ID, so its gate sees the run.
function gateSession(root, session) {
  if (session === undefined || /^[a-f0-9]{32}$/.test(session)) return session;
  for (const host of ['claude', 'codex']) {
    const key = digest(`${host}:${session}`).slice(0, 32);
    if (existsSync(projectFile(root, `.cyc/runtime/${key}.state.json`))) return key;
  }
  return session;
}

// The project's own declared test entry point, for a run when .cyc/config.json names no checks.
// Exactly one must be declared: with several, any one could miss the tests that matter, so the
// run is refused and the candidates named. The run records the source; the config is unchanged.
function declaredChecks(root) {
  const read = name => { try { return readFileSync(resolve(root, name), 'utf8'); } catch { return null; } };
  const npm = line => process.platform === 'win32' ? { command: 'cmd', args: ['/d', '/s', '/c', `npm ${line}`] } : { command: 'npm', args: line.split(' ') };
  // npm runs pretest and posttest around the test script. A posttest such as lint or a template
  // check can fail before any change, which leaves no check passing on the run-start code for the
  // proof to compare with. With those hooks, each runs as its own check, in npm's order; the test
  // script runs alone (--ignore-scripts skips the hooks but still runs the named script).
  const npmChecks = scripts => {
    if (!text(scripts?.test) || /no test specified/.test(scripts.test)) return null;
    if (!text(scripts.pretest) && !text(scripts.posttest)) return [{ id: 'test', ...npm('test') }];
    // --ignore-scripts also reaches the npm scripts the test script runs and skips their own hooks.
    // Split only when none of them has hooks, and not through script runners this cannot trace.
    const reachable = (name, seen = new Set()) => {
      if (seen.has(name) || !text(scripts[name])) return seen;
      seen.add(name);
      for (const [, next] of scripts[name].matchAll(/\bnpm\s+(?:run(?:-script)?|rum|urn)\s+([\w:.@/-]+)/g)) reachable(next, seen);
      return seen;
    };
    const nested = [...reachable('test')].filter(name => name !== 'test');
    if (/\b(?:run-s|run-p|npm-run-all2?|concurrently|wireit|turbo|nx|lerna)\b/.test([...reachable('test')].map(name => scripts[name]).join('\n'))
      || nested.some(name => text(scripts[`pre${name}`]) || text(scripts[`post${name}`]))) return [{ id: 'test', ...npm('test') }];
    return [
      ...(text(scripts.pretest) ? [{ id: 'pretest', ...npm('run pretest') }] : []),
      { id: 'test', ...npm('test --ignore-scripts') },
      ...(text(scripts.posttest) ? [{ id: 'posttest', ...npm('run posttest') }] : [])
    ];
  };
  const candidates = [
    ['package.json scripts.test', () => npmChecks(existsSync(resolve(root, 'package.json')) ? json(resolve(root, 'package.json')).scripts : null)],
    ['the Makefile test target', () => /^test\s*:/m.test(read('Makefile') ?? '') ? { command: 'make', args: ['test'] } : null],
    ['pytest configuration', () => read('pytest.ini') !== null || /\[tool\.pytest/.test(read('pyproject.toml') ?? '') || /\[tool:pytest\]/.test(read('setup.cfg') ?? '') || /\[pytest\]/.test(read('tox.ini') ?? '')
      ? { command: process.platform === 'win32' ? 'python' : 'python3', args: ['-m', 'pytest'] } : null],
    ['go.mod', () => read('go.mod') !== null ? { command: 'go', args: ['test', './...'] } : null],
    ['Cargo.toml', () => read('Cargo.toml') !== null ? { command: 'cargo', args: ['test'] } : null]
  ];
  const found = candidates.map(([source, detect]) => {
    try { const command = detect(); return command ? { source, command } : null; } catch { return null; /* An unreadable manifest declares nothing. */ }
  }).filter(Boolean);
  if (found.length > 1) throw new Error(`.cyc/config.json has no verification.commands, and the project declares several test entry points (${found.map(item => item.source).join(', ')}). Configure the ones that cover this change in verification.commands before starting; follow the CYC Setup method (methods/cyc-setup/SKILL.md, steps 3-7).`);
  if (!found.length) return null;
  // Declared checks take the default timeout, like configured ones without timeoutMs.
  const commands = Array.isArray(found[0].command) ? found[0].command : [{ id: 'test', ...found[0].command }];
  return { source: commands.length > 1 ? `${found[0].source}, run as ${commands.map(command => command.id).join(', ')}` : found[0].source, commands };
}

export function startRun(root, { goal, playbook, criteria, allowedPaths = [], session, scout, plan, baselineMode = 'background' }) {
  root = realpathSync(root);
  if (!text(goal)) throw new Error('A nonempty goal is required.');
  const selected = getPlaybook(playbook ?? routeTask(goal).playbook);
  const config = configuration(root);
  const declared = selected.requiresChecks && !config.commands.length ? declaredChecks(root) : null;
  const commands = declared?.commands ?? config.commands;
  // Checks are frozen into the run and the config is protected while it runs, so a run that
  // starts without them can never verify. Refuse before any run record exists.
  if (selected.requiresChecks && !commands.length) throw new Error(`The ${selected.id} playbook needs project checks, but .cyc/config.json has no verification.commands and the project declares no test command (package.json scripts.test, a Makefile test target, pytest configuration, go.mod, or Cargo.toml). Configure them before starting: follow the CYC Setup method (methods/cyc-setup/SKILL.md, steps 3-7) and add only commands the project already defines, running each once. Editing .cyc/config.json after a run starts halts that run. Advisory playbooks (investigation, explore, plan, review) start without checks.`);
  const inferredCriteria = criteria === undefined;
  criteria ??= [{ id: 'goal', description: goal }];
  if (!Array.isArray(criteria) || !criteria.length || criteria.some(item => !item || !/^[a-zA-Z0-9_-]+$/.test(item.id ?? '') || !text(item.description)) || new Set(criteria.map(item => item.id)).size !== criteria.length) throw new Error('Criteria must be a nonempty array of unique {id, description} records.');
  if (session !== undefined && !/^[A-Za-z0-9_-]{4,80}$/.test(session)) throw new Error('--session must be 4-80 letters, digits, dashes, or underscores.');
  session = gateSession(root, session);
  const id = randomUUID();
  // Scout can be recorded with the start. Check it before any run exists, so a bad assessment
  // creates nothing and the agent fixes one file instead of repairing a half-started run.
  const workContractVersion = selected.stages.includes('build') ? 1 : null;
  if (scout !== undefined) {
    if (selected.stages[0] !== 'scout') throw new Error(`The ${selected.id} playbook starts with ${selected.stages[0]}, not Scout; record it with run record.`);
    if (!text(plan)) throw new Error('A scout assessment at start needs plan: one or two sentences on the approach.');
    const draft = { id, playbook: selected.id, workContractVersion, handoffs: [] };
    fillDerived(root, draft, 'scout', scout);
    validateAssessment(draft, { stage: 'scout', status: 'passed', assessment: assessmentPaths(root, scout) }, path => readFileSync(projectFile(root, path)));
  }
  allowedPaths = normalizePaths(root, allowedPaths, 'allowedPaths');
  const protectedPath = protectedPathMatcher(root, config.protectedPaths);
  if (protectedPath(`.cyc/runs/${id}`)) throw new Error('Run storage is protected; error history and original-source capture cannot be written.');
  const mode = process.env.CYC_BASELINE_MODE ?? baselineMode;
  const state = withWorkspaceLock(root, `start run ${id}`, config.protectedPaths, () => {
    const ledger = selectLedger(root, id, config, allowedPaths, protectedPath);
    const { snapshot: initialSource, recoverableTracked } = inspectSource(root);
    const base = gitBase(root);
    const capture = proofPlaybooks.includes(selected.id) ? captureOriginals(root, initialSource, base?.trackedSnapshot ? recoverableTracked : null, allowedPaths, protectedPath) : null;
    // Optionally record which checks already fail for diagnostic context. Failed commands
    // still prevent completion. Reuse a matching earlier measurement; otherwise measure in the
    // background while the agent does read-only work.
    const wanted = selected.requiresChecks && commands.length && config.baseline && mode !== 'off';
    const cacheKey = wanted ? digest(`${initialSource.hash}:${JSON.stringify(commands)}`) : null;
    const cached = wanted ? readBaselineCache(root)[cacheKey] : null;
    const baseline = !wanted ? null
      : cached ? { status: 'complete', reused: true, cacheKey, sourceHash: initialSource.hash, checkedAt: cached.checkedAt, results: cached.results }
      : { status: 'pending', cacheKey, sourceHash: initialSource.hash, requestedAt: new Date().toISOString() };
    const state = {
      schemaVersion: 1, engineVersion, id, goal, playbook: selected.id, stages: selected.stages, requiresChecks: selected.requiresChecks,
      workContractVersion, ...ledger,
      criteria, inferredCriteria, session: session ?? null, status: 'running', stageIndex: 0, attempt: 1, failures: 0, noProgress: 0,
      startedAt: new Date().toISOString(), limits: config.limits, commands, ...(declared ? { verificationSource: `declared by ${declared.source}` } : {}),
      protectedPaths: config.protectedPaths, protectedFiles: protectedSnapshot(root, config.protectedPaths), allowedPaths,
      initialSource, base, ...(capture ? { sourceCapture: capture.metadata } : {}), testProof: null, baseline, acceptedFailures: [], handoffs: [], verification: null, history: []
    };
    log(state, 'started', { playbook: selected.id, inferredCriteria, session: state.session, baseline: baseline ? (baseline.reused ? 'reused' : 'measuring') : 'none', ...(declared ? { verificationSource: state.verificationSource } : {}) });
    if (capture) storeOriginals(root, id, capture);
    atomicJSON(runPath(root, id), state);
    writeReview(root, state);
    return state;
  });
  // Record Scout before the background baseline starts: both take the project operation lock.
  if (scout !== undefined) quickHandoff(root, id, { summary: plan, assessment: scout });
  if (state.baseline?.status === 'pending') {
    if (mode === 'sync') measureBaseline(root, id);
    else {
      const worker = spawn(process.execPath, [fileURLToPath(new URL('./baseline-worker.mjs', import.meta.url)), root, id], { cwd: tmpdir(), detached: true, stdio: 'ignore', windowsHide: true });
      // A worker that never started has no PID; the record below then reads as ended.
      worker.on('error', () => {});
      try { atomicJSON(baselineWorkerFile(root, id), { pid: worker.pid ?? null, startedAt: new Date().toISOString() }); } catch { /* the worker still writes its result */ }
      worker.unref();
    }
  }
  return nextRun(root, id);
}

// Build, Verify, and Deliver at the end of a playbook can be finished in one call with one
// assessment file, from Build or from Verify.
const finishing = state => state.stages.slice(-2).join() === 'verify,deliver'
  && (current(state) === 'verify' || (current(state) === 'build' && state.stages[state.stageIndex + 1] === 'verify'));

// Fields the agent must write at finish: the controller fills the rest from its own record.
function finishAssessmentTemplate(root, state) {
  const omit = stage => Object.keys(derivedAssessment(state, stage, { contextHistory: hasContextHistory(root, state) }));
  const pick = (stage, template) => Object.fromEntries(Object.entries(template ?? {}).filter(([key]) => !omit(stage).includes(key)));
  return { ...pick('verify', assessmentTemplate(state, 'verify')), ...pick('deliver', assessmentTemplate(state, 'deliver')) };
}

// What the agent writes for the current stage: the contract's fields minus those the controller fills.
function stageTemplate(root, state) {
  if (finishing(state)) return finishAssessmentTemplate(root, state);
  const stage = current(state);
  const template = assessmentTemplate(state, stage);
  if (!template) return null;
  const omit = Object.keys(derivedAssessment(state, stage, { contextHistory: hasContextHistory(root, state) }));
  return Object.fromEntries(Object.entries(template).filter(([key]) => !omit.includes(key)));
}

// A check that failed on the run-start code, listed so the agent decides before finishing: give the
// reason it is unrelated, or delete the entry and fix the check. The placeholder cannot pass.
const failureHints = baseline => (baseline?.status === 'complete' ? baseline.results : []).filter(result => !result.passed)
  .map(result => ({ check: result.id, reason: `<why ${result.id}, which already failed on the run-start code, is unrelated to this change; or delete this entry and fix it>` }));
const finishTemplateContent = (root, state, acceptFailures) => JSON.stringify({ runId: state.id, summary: '<result and limits>', criterionEvidence: Object.fromEntries(state.criteria.map(item => [item.id, '<evidence>'])), assessment: finishAssessmentTemplate(root, state), acceptFailures }, null, 2) + '\n';
const finishTemplatePath = state => `.cyc/runs/${state.id}/finish-template.json`;

// The finish input, written once next to the run so the agent copies a file instead of asking
// run next again for a template it cut off. Never overwritten: the agent may be filling it in.
function writeFinishTemplate(root, state) {
  const path = finishTemplatePath(state);
  try {
    const file = projectFile(root, path);
    if (!existsSync(file)) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, finishTemplateContent(root, state, failureHints(currentBaseline(root, state)))); }
    return path;
  } catch { return null; }
}

// A background measurement that finds failing checks adds them to the template, but only while
// the file is still exactly what CYC wrote; a template the agent has started editing is left alone.
function hintFinishTemplate(root, state, record) {
  const hints = failureHints(record);
  if (!hints.length) return;
  const file = projectFile(root, finishTemplatePath(state));
  if (!existsSync(file) || readFileSync(file, 'utf8') !== finishTemplateContent(root, state, [])) return;
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, finishTemplateContent(root, state, hints));
  renameSync(temporary, file);
}

// Whether the project keeps history Scout must consult: a context index or the selected ledger.
function hasContextHistory(root, state) {
  const ledger = state.projectLedgerPath ?? state.ledgerPath ?? configuration(root).ledgerPath;
  return ['docs/context/INDEX.md', ledger].some(path => { try { return existsSync(projectFile(root, path)); } catch { return true; } });
}

// Fill in the fields the agent left out that the controller can state from its own record.
function fillDerived(root, state, stage, assessment) {
  if (!assessment || typeof assessment !== 'object') return assessment;
  const derived = derivedAssessment(state, stage, { contextHistory: hasContextHistory(root, state) });
  for (const [key, value] of Object.entries(derived)) if (!(key in assessment)) assessment[key] = structuredClone(value);
  return assessment;
}

export function nextRun(root, id) {
  const state = readRun(root, id);
  const finishTemplate = finishing(state) && state.status === 'running' ? writeFinishTemplate(root, state) : null;
  return {
    runId: state.id, engineVersion: state.engineVersion ?? 'unknown (legacy run)', status: state.status, goal: state.goal, playbook: state.playbook,
    stage: current(state), attempt: state.attempt, criteria: state.criteria,
    workContractVersion: state.workContractVersion ?? null, assessmentRequired: Object.keys(stageTemplate(root, state) ?? {}),
    assessmentTemplate: stageTemplate(root, state),
    ...(finishTemplate ? { finishTemplate, finishWith: `Copy ${finishTemplate} to FINISH.json, replace every <...> with what you found, list under acceptFailures only a check that already failed before this run and is unrelated, then: run finish --file FINISH.json` } : {}),
    ...(finishing(state) && !finishTemplate ? { finishWith: `run finish --run ${state.id} --summary "<result and limits>" --assessment <file with the template filled in> --criterion-evidence '${JSON.stringify(Object.fromEntries(state.criteria.map(item => [item.id, '<evidence>'])))}' (records Build if needed, proves new tests, verifies, and lists changed files itself)` } : {}),
    ...(state.verificationSource ? { verificationSource: state.verificationSource } : {}),
    ...(state.commands?.length ? { verificationCommands: state.commands.map(item => `${item.id}: ${[item.command, ...item.args].join(' ')}`) } : {}),
    reviewPath: reviewPath(state),
    toolHints: ['scout', 'understand', 'impact'].includes(current(state)) ? [{ command: `investigate --run ${state.id}`, purpose: 'Find relevant context and recipes before repeating investigation.' }]
      : ['build', 'verify'].includes(current(state)) ? [{ command: `recipe list --run ${state.id}`, purpose: 'Select applicable authorized checks; preserve required final verification.' }] : [],
    testProof: testProofStatus(root, state),
    // `skill` is relative to the engine; `skillFile` is the same method as an absolute path the agent can open from any working directory.
    skill: current(state) ? `methods/cyc-${current(state)}/SKILL.md` : null,
    skillFile: current(state) ? fileURLToPath(new URL(`../methods/cyc-${current(state)}/SKILL.md`, import.meta.url)) : null,
    failures: state.failures, limits: state.limits,
    verification: state.verification ? { passed: state.verification.passed, sourceHash: state.verification.sourceHash } : null,
    ...baselineView(root, state),
    ledgerPath: state.ledgerPath ?? configuration(root).ledgerPath,
    projectLedgerPath: state.projectLedgerPath ?? state.ledgerPath ?? configuration(root).ledgerPath,
    ...(state.ledgerNote ? { ledgerNote: state.ledgerNote } : {}),
    acceptedFailures: state.acceptedFailures ?? [],
    previousHandoff: state.handoffs.at(-1) ?? null,
    feedback: state.history.filter(item => ['attempt-failed', 'retry', 'blocked', 'guard-halt', 'exhausted'].includes(item.type)).slice(-3)
  };
}

// Read-only diagnosis. Failed attempts deliberately clear state.verification; their
// historical receipts remain available through history and must stay diagnostic.
export function recoverRun(root, id) {
  const state = readRun(root, id);
  let sourceHash, inspectionError, operation;
  let guardIssues = { protectedChanges: [], outOfScope: [] };
  try {
    operation = workspaceOperation(root);
    if (operation) inspectionError = 'Another CYC operation owns the shared working folder; current source inspection is deferred.';
    else {
      const snapshot = cachedSnapshot(root);
      sourceHash = snapshot.hash;
      guardIssues = guardChanges(root, state, snapshot);
      if (snapshot.skipped.length) inspectionError = 'Linked source cannot be covered by executable verification.';
    }
  } catch (error) { inspectionError = error.message; }
  const event = state.history.findLast(item => item.type === 'verification');
  let lastCheck = null;
  if (event) {
    try {
      if (!event.receipt?.startsWith(`.cyc/runs/${id}/checks/`)) throw new Error('Receipt path does not belong to this run.');
      const receipt = json(projectFile(root, event.receipt));
      if (!Array.isArray(receipt.results) || receipt.results.some(item => !item || typeof item.id !== 'string' || typeof item.passed !== 'boolean')) throw new Error('Malformed check receipt.');
      lastCheck = { status: receipt.passed === true ? 'passed' : 'failed', receiptPath: event.receipt, checkedAt: receipt.checkedAt,
        sourceStable: receipt.sourceStable, changedPaths: receipt.changedPaths ?? [],
        sourceMatches: receipt.sourceHash === sourceHash,
        failedChecks: receipt.results.filter(item => !item.passed).map(item => ({ id: item.id, command: item.command, args: item.args, exitCode: item.exitCode, error: item.error, errorCode: item.errorCode ?? null,
          outputTail: `${item.stdout ?? ''}${item.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n') })) };
    } catch (error) { lastCheck = { status: 'unavailable', receiptPath: event.receipt, detail: error.message }; }
  }
  return recoveryGuidance(state, { sourceHash, guardIssues, inspectionError, lastCheck, engineVersion, workspaceOperation: operation });
}

function baselineView(root, state) {
  const baseline = currentBaseline(root, state);
  if (!baseline) return { baseline: 'none', baselineFailures: [] };
  const failing = baseline.results?.filter(item => !item.passed).map(item => item.id) ?? [];
  const view = { baseline: baseline.status === 'pending' ? 'measuring' : baseline.status, baselineReused: Boolean(baseline.reused), baselineFailures: baseline.status === 'complete' ? failing : [] };
  if (baseline.status === 'pending') view.baselineNote = 'Optional baseline is measuring. Do not wait to edit. If source changes, this diagnostic baseline becomes unavailable; final verification is still required.';
  if (['invalid', 'error'].includes(baseline.status)) view.warning = baseline.reason;
  return view;
}

function assertArtifacts(root, artifacts) {
  if (!Array.isArray(artifacts)) throw new Error('artifacts must be an array (empty for no file deliverables).');
  for (const artifact of artifacts) {
    if (!artifact || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) throw new Error('Each artifact needs its current SHA-256.');
    const path = projectFile(root, artifact.path);
    if (digest(readFileSync(path)) !== artifact.sha256) throw new Error(`Artifact changed after review: ${artifact.path}`);
  }
}
function validatePacket(root, state, packet) {
  if (packet.runId !== state.id || packet.stage !== current(state) || packet.attempt !== state.attempt) throw new Error('Handoff does not match the current run, stage, and attempt.');
  if (!['passed', 'failed', 'blocked'].includes(packet.status) || !text(packet.summary)) throw new Error('Handoff needs a valid status and nonempty summary.');
  // Scout recorded at run start, then recorded again as the agent's next command, would land here
  // as the Build handoff: a plan with no changed files, and the run moved on to Verify.
  if (packet.stage === 'build' && packet.assessment && typeof packet.assessment === 'object' && ['context', 'approach', 'alignment', 'consumers'].some(key => key in packet.assessment)) throw new Error('This is a Scout assessment (context, approach, alignment, consumers), but the run is at Build: Scout is already recorded (run start records it when given scout). Record Build with a summary of the change and the files you changed, or run finish.');
  // With nothing listed and no project file changed since the run started, there is nothing for
  // Verify to check, so a plan cannot pass as a Build. run finish lists the changed files itself.
  if (packet.stage === 'build' && packet.status === 'passed' && state.workContractVersion === 1 && !(Array.isArray(packet.artifacts) && packet.artifacts.length) && !changedArtifacts(root, state).length) throw new Error('Nothing to record as built: no artifacts are listed and no project file changed since the run started. Build the change, then record it with the files you changed, or run finish.');
  if (!Array.isArray(packet.evidence) || !packet.evidence.length) throw new Error('Handoff must contain evidence.');
  for (const item of packet.evidence) {
    if (!item || !['file', 'observation'].includes(item.kind) || !text(item.detail)) throw new Error('Evidence needs a file/observation kind and detail.');
    if (item.kind === 'file') assertArtifacts(root, [item]);
  }
  assertArtifacts(root, packet.artifacts);
  if (packet.status === 'passed' && Object.keys(derivedAssessment(state, packet.stage, { contextHistory: hasContextHistory(root, state) })).length) packet.assessment = fillDerived(root, state, packet.stage, packet.assessment ?? {});
  if (!Array.isArray(packet.criteria) || packet.criteria.length !== state.criteria.length || new Set(packet.criteria.map(item => item?.id)).size !== state.criteria.length) throw new Error('Handoff must preserve every acceptance criterion exactly once.');
  for (const criterion of state.criteria) {
    const result = packet.criteria.find(item => item?.id === criterion.id);
    if (!result || !['passed', 'failed', 'unverified'].includes(result.result) || !text(result.evidence)) throw new Error(`Missing or invalid criterion result: ${criterion.id}`);
    if (packet.status === 'passed' && ['verify', 'deliver'].includes(current(state)) && result.result !== 'passed') throw new Error(`Cannot pass ${current(state)} with unmet criterion ${criterion.id}.`);
  }
  const assessmentArtifacts = validateAssessment(state, packet, path => ({ path, sha256: digest(readFileSync(projectFile(root, path))) }));
  packet.artifacts = [...packet.artifacts, ...assessmentArtifacts.filter(item => !packet.artifacts.some(existing => existing.path === item.path))];
}
function requireVerification(root, state) {
  if (!state.requiresChecks) return;
  if (!state.verification?.passed) throw new Error('Run project verification successfully before passing this stage.');
  const snapshot = cachedSnapshot(root);
  if (snapshot.skipped.length) throw new Error('Executable verification cannot cover symlink dependencies; use a project without linked source.');
  if (snapshot.hash !== state.verification.sourceHash) throw new Error('Source changed after verification; run verification again.');
}

// Shorthand for the common case: the agent states the outcome in one line and names changed
// files; the controller fills stage, attempt, criteria, and hashes. Final stages must supply the
// evidence that every criterion passed.
export function quickHandoff(root, id, { status = 'passed', summary, artifacts = [], passedEvidence, criterionEvidence, nextAction, assessment }) {
  const state = readRun(root, id);
  const stage = current(state);
  if (!stage) throw new Error('This run has no remaining stage.');
  const final = ['verify', 'deliver'].includes(stage);
  if (final && status === 'passed' && !text(passedEvidence) && !criterionEvidence) throw new Error(`Passing ${stage} needs --criteria-passed with the evidence that every criterion holds.`);
  if (final && status === 'passed' && state.criteria.length > 1 && !criterionEvidence) throw new Error('Multiple criteria need --criterion-evidence JSON mapping each criterion ID to its evidence.');
  if (criterionEvidence && (Object.keys(criterionEvidence).length !== state.criteria.length || state.criteria.some(c => !text(criterionEvidence[c.id])))) throw new Error('Criterion evidence must cover every criterion exactly once.');
  const packet = {
    runId: id, stage, attempt: state.attempt, status, summary,
    ...(assessment !== undefined ? { assessment: assessmentPaths(root, assessment) } : {}),
    evidence: [{ kind: 'observation', detail: summary }],
    artifacts: artifacts.map(path => inputPath(root, path)).map(path => ({ path, sha256: digest(readFileSync(projectFile(root, path))) })),
    criteria: state.criteria.map(item => criterionEvidence || text(passedEvidence)
      ? { id: item.id, result: 'passed', evidence: criterionEvidence?.[item.id] ?? passedEvidence }
      : { id: item.id, result: 'unverified', evidence: `Not verified yet; checked at verify.` }),
    ...(nextAction ? { nextAction } : {})
  };
  // Deliver records which component context docs this change touched, so the context review can
  // tell a run that updated its component's doc from one that should have.
  if (stage === 'deliver') packet.contextDocs = [...new Set([...packet.artifacts.map(item => item.path), ...(assessment?.learning?.artifacts ?? [])].filter(path => path.startsWith('docs/context/') && path.endsWith('.md') && !path.slice('docs/context/'.length).includes('/')))].sort();
  return recordHandoff(root, packet);
}

export function recordHandoff(root, packet) {
  return transact(root, packet.runId, state => {
    requireActive(state);
    if (!budget(state) || !guard(root, state)) return state;
    validatePacket(root, state, packet);
    if (packet.status === 'passed' && ['verify', 'deliver'].includes(current(state))) requireVerification(root, state);
    if (packet.status === 'passed' && current(state) === 'verify' && provable(state)) requireTestProof(root, state, packet.assessment?.testProof);
    if (packet.status === 'passed' && current(state) === 'deliver' && state.workContractVersion === 1) {
      const reviewed = state.handoffs.findLast(item => item.stage === 'verify' && item.status === 'passed');
      if (!reviewed?.assessment || reviewed.sourceHash !== cachedSnapshot(root).hash) throw new Error('Semantic review is missing or stale. Retry verify and review the current files before delivery.');
    }
    const entry = { ...packet, recordedAt: new Date().toISOString(), sourceHash: cachedSnapshot(root).hash };
    state.handoffs.push(entry);
    log(state, 'handoff', { stage: packet.stage, status: packet.status, summary: packet.summary });
    if (packet.status === 'blocked') { state.status = 'blocked'; log(state, 'blocked', { reason: packet.nextAction ?? packet.summary }); }
    else if (packet.status === 'failed') failedAttempt(state, packet.summary, digest(`${entry.sourceHash}:${packet.stage}:${JSON.stringify(packet.criteria)}`));
    else { state.stageIndex += 1; state.attempt += 1; }
    return state;
  });
}

export function verifyRun(root, id) {
  return transact(root, id, state => {
    requireActive(state);
    if (!budget(state) || !guard(root, state)) return state;
    if (!state.stages.includes('verify')) throw new Error('This playbook has no executable verification stage.');
    if (!['verify', 'deliver'].includes(current(state)) && current(state) !== null) throw new Error('Record prerequisite skill handoffs before running verification.');
    if (!state.commands.length) throw new Error('No project verification commands configured. Add explicit commands before starting a new run; do not invent a passing check.');
    // A stale cached hash here can only make the check look unstable; the full snapshot after it decides.
    const before = cachedSnapshot(root);
    if (before.skipped.length) throw new Error('Executable verification cannot cover symlink dependencies; use a project without linked source.');
    const results = runCommands(root, state.commands, () => state.limits.maxDurationMs ? state.limits.maxDurationMs - (Date.now() - Date.parse(state.startedAt)) : Infinity);
    const after = sourceSnapshot(root);
    // A check that already failed on the run-start code, and was accepted with a reason, does not
    // block completion if it fails exactly as it did then: the same exit code and error, the same
    // output lines (timings and timestamps aside), neither output cut short, and no file this run
    // changed named in it. Anything else, such as a new failing test, a hang, a lost line, or a
    // version number that moved, still fails verification, as does a run where no check passes.
    const accepted = new Set((state.acceptedFailures ?? []).map(item => item.id));
    const reference = runStartResults(root, state) ?? [];
    const runChanged = [...new Set([...Object.keys(state.initialSource.files), ...Object.keys(after.files)])].filter(path => state.initialSource.files[path] !== after.files[path]);
    const slashes = value => value.split(String.fromCharCode(92)).join('/');
    const output = result => slashes(`${result?.stdout ?? ''}\n${result?.stderr ?? ''}`);
    const lines = result => new Map([result?.stdout, result?.stderr].flatMap(stream => slashes(stream ?? '').split(/\r?\n/)).map(line => line.trim()).filter(Boolean).map(line => [stable(line), line]));
    const differences = result => {
      const before = reference.find(item => item.id === result.id);
      const known = before ? lines(before) : new Map();
      if (!known.size && !before?.tests) return { reason: 'no run-start output to compare: the check printed nothing then, or the measurement predates output capture' };
      if (result.exitCode === null || result.exitCode !== before.exitCode || (result.error ?? null) !== (before.error ?? null)) return { reason: `exit ${result.exitCode ?? 'none'}${result.error ? ` (${result.error})` : ''}, but exit ${before.exitCode ?? 'none'} on the run-start code` };
      // A test suite gains passing lines from the new tests, so compare what fails instead: no test
      // may fail that did not fail then, and every line that is not a test result must have been
      // there then too (a coverage error, say, is not a test result but still a new failure).
      // Output longer than the kept tail is compared this way through its stored summary.
      const testsNow = cutOff(result) || cutOff(before) ? null : testsOf(result);
      const testsThen = testsNow ? testsOf(before) : null;
      if (testsNow && testsThen?.failing.size) {
        // Failures are keyed by file and name and counted, so a same-named test elsewhere is new.
        // An old failure must still fail with the same error, and its stack must not run through
        // source this run changed: either means the cause may have changed.
        const newFailing = [], changedCause = [];
        for (const [key, entry] of testsNow.failing) {
          const old = testsThen.failing.get(key);
          if (!old || entry.count > old.count) newFailing.push(entry.path.join(' > '));
          else if (stable(entry.error ?? '') !== stable(old.error ?? '')) changedCause.push(entry.path.join(' > '));
        }
        const newLines = [...testsNow.other].filter(([key]) => !testsThen.other.has(key)).map(([, line]) => line);
        const changedSource = runChanged.filter(path => !testPattern.test(path));
        const files = runChanged.filter(path => (changedSource.includes(path) && [...testsNow.failing.values()].some(entry => entry.details.some(detail => detail.includes(path)))) || newLines.some(line => line.includes(path)));
        return newFailing.length || changedCause.length || newLines.length || files.length ? { ...(newFailing.length ? { newFailingTests: newFailing.slice(0, 5) } : {}), ...(changedCause.length ? { changedErrors: changedCause.slice(0, 5) } : {}), ...(newLines.length ? { newLines: newLines.slice(0, 5) } : {}), ...(files.length ? { files } : {}) } : null;
      }
      // Line by line, only whole output can be compared: a kept tail may have lost earlier lines,
      // even when a complete test summary exists (it is used above only when tests failed then).
      const tailOnly = item => [item?.stdout, item?.stderr].some(stream => (stream ?? '').length >= outputLimit);
      if (tailOnly(result) || tailOnly(before)) return { reason: 'output too long to compare line by line, and no test failed at the run start to compare test by test' };
      const now = lines(result);
      const added = [...now].filter(([key]) => !known.has(key)).map(([, line]) => line);
      const missing = [...known].filter(([key]) => !now.has(key)).map(([, line]) => line);
      const files = runChanged.filter(path => output(result).includes(path));
      return added.length || missing.length || files.length ? { ...(added.length ? { newLines: added.slice(0, 5) } : {}), ...(missing.length ? { missingLines: missing.slice(0, 5) } : {}), ...(files.length ? { files } : {}) } : null;
    };
    const failing = results.filter(result => !result.passed && accepted.has(result.id)).map(result => ({ id: result.id, changed: differences(result) }));
    const changedFailures = failing.filter(item => item.changed);
    const excused = failing.filter(item => !item.changed).map(item => item.id);
    // Something must still be verified: a passing check, or passing tests inside an excused suite.
    const verifiedSomething = results.some(result => result.passed || (excused.includes(result.id) && (testsOf(result)?.passingCount ?? 0) > 0));
    const passed = results.length === state.commands.length && results.every(result => result.passed || excused.includes(result.id)) && verifiedSomething && before.hash === after.hash && after.skipped.length === 0;
    const changedPaths = [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].filter(path => before.files[path] !== after.files[path]);
    // Failing checks that also failed in the run-start measurement and are not accepted yet: the
    // agent decides whether they are unrelated, and says why, instead of retrying unchanged.
    const failedAtRunStart = results.filter(result => !result.passed && !accepted.has(result.id) && reference.find(item => item.id === result.id)?.passed === false).map(result => result.id);
    // Failing only on checks that failed the same way before the run is a decision still to make
    // (accept them or fix them), not a failed fix. Once per run it is not counted against the
    // budget; any later stop is, so the loop stays bounded however the source changes.
    const excusable = result => result.passed || excused.includes(result.id) || (failedAtRunStart.includes(result.id) && !differences(result));
    const awaitingAcceptance = !passed && !state.awaitedAcceptance && failedAtRunStart.length > 0 && results.every(excusable) && before.hash === after.hash
      && results.some(result => result.passed || (testsOf(result)?.passingCount ?? 0) > 0);
    const receipt = { passed, changedPaths, verificationStatus: passed ? (excused.length ? 'passed-with-accepted-failures' : 'passed') : failing.length ? 'unverified' : 'failed', ...(failedAtRunStart.length ? { failedAtRunStart } : {}), ...(awaitingAcceptance ? { awaitingAcceptance } : {}), sourceHash: after.hash, sourceStable: before.hash === after.hash, checkedAt: new Date().toISOString(), results, acceptedPreexistingFailures: excused, ...(changedFailures.length ? { acceptedFailuresThatChanged: changedFailures.map(item => ({ id: item.id, ...item.changed })) } : {}), skippedSymlinks: after.skipped };
    // Every command reads and writes the run state, so test summaries of long output stay in the receipt file.
    state.verification = { ...receipt, results: results.map(({ tests, ...result }) => result) };
    const receiptPath = `.cyc/runs/${id}/checks/${randomUUID()}.json`;
    atomicJSON(projectFile(root, receiptPath), receipt);
    log(state, 'verification', { passed, receipt: receiptPath, sourceHash: after.hash });
    if (!guard(root, state, after) || !budget(state)) return state;
    if (!passed) {
      const signature = digest(`${after.hash}:${JSON.stringify(results.map(result => [result.id, result.exitCode, result.error]))}`);
      if (awaitingAcceptance) {
        state.awaitedAcceptance = true;
        state.lastFailureSignature = signature;
        log(state, 'awaiting-acceptance', { checks: failedAtRunStart, reason: `${failedAtRunStart.join(', ')} failed the same way on the run-start code: accept if unrelated, or fix.` });
      } else failedAttempt(state, 'Project checks failed or changed source. Inspect the recorded receipt and repair the cause.', signature);
    }
    return { runId: id, status: state.status, ...receipt, receiptPath };
  });
}

// Accept a check only if it already failed before this run changed anything. Verification then
// excuses it only while it keeps failing exactly the same way (see verifyRun); the reason is shown
// in the review and the finish result.
// The run-start measurement: a complete background baseline, otherwise the proof's control run,
// which executed every check on the run-start code. An invalid or pending baseline does not
// shadow a proof control that exists.
function runStartMeasurement(root, state) {
  const measured = currentBaseline(root, state);
  return measured?.status === 'complete' ? measured : proofBaseline(root, state) ?? measured;
}
function runStartResults(root, state) {
  const measurement = runStartMeasurement(root, state);
  return measurement?.status === 'complete' ? measurement.results : null;
}

// A proof that did not need its control run showed every check passing on the run-start code
// apart from tests this change added, which did not exist there.
function proofSkippedControl(root, state) {
  const path = state.testProof?.receiptPath;
  if (!path) return false;
  try {
    const receipt = json(projectFile(root, path));
    return receipt.originalSourceHash === state.initialSource.hash && receipt.control === null && /^not needed/.test(receipt.controlSource ?? '');
  } catch { return false; }
}
const passedAtRunStart = (root, state, check) => runStartResults(root, state)?.find(result => result.id === check)?.passed ?? (proofSkippedControl(root, state) ? true : null);

function proofBaseline(root, state) {
  const path = state.testProof?.receiptPath;
  if (!path) return null;
  try {
    const receipt = json(projectFile(root, path));
    return receipt.originalSourceHash === state.initialSource.hash && Array.isArray(receipt.control) ? { status: 'complete', source: 'proof control', results: receipt.control } : null;
  } catch { return null; }
}

export function acceptFailure(root, id, { check, reason }) {
  return transact(root, id, state => {
    requireActive(state);
    if (!text(reason) || /^<[\s\S]*>$/.test(reason.trim())) throw new Error('A reason explaining why this failure is unrelated is required; replace the template placeholder.');
    const baseline = runStartMeasurement(root, state);
    if (!baseline && proofSkippedControl(root, state)) throw new Error(`Check ${check} passed on the run-start code apart from the tests this change added (the proof's run with the new tests showed it), so a failure now is a regression and cannot be accepted.`);
    if (!baseline) throw new Error(provable(state) && state.playbook !== 'refactor'
      ? 'This run has no measurement of the run-start code yet. Run prove-red first: its control run measures each check there. Or list the check under acceptFailures in run finish, which proves first.'
      : 'This run has no measurement of the run-start code: it has no failing-first test proof (a refactor, an exempt proof, or a playbook without one). Accepting a pre-existing failure here needs verification.baseline: true, set before the run starts.');
    if (baseline.status === 'pending') throw new Error('The baseline is still measuring in the background. Check run next and try again when it completes.');
    if (baseline.status !== 'complete') throw new Error(`The baseline is ${baseline.status}: ${baseline.reason} Pre-existing failures cannot be accepted for this run.`);
    const before = baseline.results.find(item => item.id === check);
    if (!before) throw new Error(`Unknown check: ${check}`);
    if (before.passed) throw new Error(`Check ${check} passed before this run started. A new failure is a regression and cannot be accepted.`);
    if (!(state.acceptedFailures ??= []).some(item => item.id === check)) state.acceptedFailures.push({ id: check, reason, acceptedAt: new Date().toISOString() });
    state.verification = null;
    log(state, 'accept-failure', { check, reason });
    return { runId: id, status: state.status, acceptedFailures: state.acceptedFailures };
  });
}

export function retryRun(root, id, { stage, reason }) {
  return transact(root, id, state => {
    requireActive(state);
    if (!text(reason)) throw new Error('A reason explaining the new hypothesis is required.');
    const scoutAlias = ['frame', 'understand', 'impact', 'design'].includes(stage) && !state.stages.includes(stage) && state.stages.includes('scout');
    if (scoutAlias) stage = 'scout';
    const target = state.stages.indexOf(stage);
    if (target < 0 || target > state.stageIndex) throw new Error('Recovery must target an earlier or current stage in this playbook.');
    if (!budget(state) || !guard(root, state)) return state;
    // A return after a recorded failure uses that failure's budget; unsolicited rework consumes one.
    const last = state.history.at(-1);
    if (last?.type !== 'attempt-failed') failedAttempt(state, reason, digest(`${cachedSnapshot(root).hash}:${stage}`));
    if (state.status !== 'running') return state;
    state.stageIndex = target;
    state.attempt += 1;
    state.handoffs = state.handoffs.filter(item => state.stages.indexOf(item.stage) < target);
    state.verification = null;
    log(state, 'retry', { stage, reason });
    return state;
  });
}

export function controlRun(root, id, action) {
  return transact(root, id, state => {
    if (terminal.has(state.status)) throw new Error(`Run is terminal: ${state.status}. Start a new run rather than resetting its budget.`);
    if (action === 'pause') { requireActive(state); state.status = 'paused'; }
    else if (action === 'resume') {
      if (!['paused', 'blocked'].includes(state.status)) throw new Error('Only a paused or blocked run can resume.');
      if (!budget(state) || !guard(root, state)) return state;
      state.status = 'running';
      state.attempt += 1;
      state.verification = null;
    } else if (action === 'stop') state.status = 'stopped';
    else throw new Error('Unknown control action.');
    log(state, action, {});
    return state;
  });
}

export function completeRun(root, id) {
  return transact(root, id, state => {
    requireActive(state);
    if (!budget(state) || !guard(root, state)) return state;
    if (current(state) !== null) throw new Error(`Unfinished stage: ${current(state)}`);
    const delivery = state.handoffs.at(-1);
    if (delivery?.stage !== 'deliver' || delivery.status !== 'passed' || delivery.criteria.some(item => item.result !== 'passed')) throw new Error('A passing delivery handoff covering every criterion is required.');
    assertArtifacts(root, delivery.artifacts);
    // Completion is evidence: every file is read, not taken from the cache.
    if (sourceSnapshot(root).hash !== delivery.sourceHash) throw new Error('Project changed after the delivery review. Retry the affected stage.');
    requireVerification(root, state);
    state.status = 'complete';
    log(state, 'complete', { verification: state.requiresChecks ? 'recorded-command-results-and-agent-review' : 'agent-reviewed-evidence', sourceHash: delivery.sourceHash, acceptedPreexistingFailures: (state.acceptedFailures ?? []).map(item => item.id) });
    return state;
  });
}

// Files that differ from the run-start snapshot and still exist: what this run changed.
function changedArtifacts(root, state) {
  const now = cachedSnapshot(root).files;
  return Object.keys(now).filter(path => now[path] !== state.initialSource.files[path]).sort();
}

// A run-local error history can be written from the agent's own errorHistory.reason; the reason
// is never invented. Only the listing is filled in here, and the file is written by writeRunLedger
// once the finish input has passed its checks. Returns whether the controller writes the file.
const generatedLedger = '<!-- Written by CYC from errorHistory.reason. Replace this file with your own entry to keep it as written. -->';
function claimRunLedger(root, state, assessment) {
  const history = assessment?.errorHistory;
  if (!state.ledgerPath?.startsWith(`.cyc/runs/${state.id}/`) || !text(history?.reason)) return false;
  const path = projectFile(root, state.ledgerPath);
  if (existsSync(path) && !readFileSync(path, 'utf8').includes(generatedLedger)) return false;
  // A bug fix records its cause. Agents give "none" with the cause in the reason when no attempt
  // failed; with a run-local ledger, that reason is the record, kept word for word. After a failed
  // attempt, "none" contradicts the run's own record, so it is still refused.
  if (history.status === 'none' && state.playbook === 'bug-fix' && !state.failures && !(history.artifacts ?? []).length) history.status = 'recorded';
  if (history.status !== 'recorded') return false;
  if (history.artifacts === undefined || (Array.isArray(history.artifacts) && !history.artifacts.length)) history.artifacts = [state.ledgerPath];
  return true;
}
function writeRunLedger(root, state, assessment) {
  writeFileSync(projectFile(root, state.ledgerPath), `# Error history\n\n${generatedLedger}\n\n${assessment.errorHistory.reason.trim()}\n`);
}

// A proof is redone when it is missing, when its tests changed, or when it failed and its tests
// have changed since. A failed proof on unchanged tests would only fail again.
function proofOutdated(root, state) {
  const status = testProofStatus(root, state)?.status;
  if (status === 'missing' || status === 'stale') return true;
  if (status !== 'failed') return false;
  const files = cachedSnapshot(root).files;
  const changed = Object.keys(files).filter(path => testPattern.test(path) && files[path] !== state.initialSource.files[path]);
  return changed.some(path => state.testProof.testFiles[path] !== files[path]) || Object.keys(state.testProof.testFiles).some(path => !changed.includes(path));
}

// From Build or Verify to complete in one call: record Build, prove the new tests, verify, record
// Verify and Deliver, and complete. Each step is its own transaction, so a failure stops at a
// defined point: a failed proof or check is reported as such, a failed check is recorded as a
// normal failed attempt, and a later refusal leaves the run at the stage named in the error.
export function finishRun(root, id, { summary, artifacts, passedEvidence, criterionEvidence, assessment = {}, acceptFailures = [] }) {
  let state = readRun(root, id);
  if (!Array.isArray(acceptFailures) || acceptFailures.some(item => !item || !state.commands.some(command => command.id === item.check) || !text(item.reason))) throw new Error(`acceptFailures lists checks that already failed before this run: [{"check": "${state.commands.map(command => command.id).join('|')}", "reason": "why it is unrelated"}].`);
  let stage = current(state);
  if (!['build', 'verify', 'deliver'].includes(stage)) throw new Error(`Finish starts at build, verify, or deliver; this run is at ${stage ?? 'no remaining stage'}.`);
  if (stage === 'build' && state.stages[state.stageIndex + 1] !== 'verify') throw new Error('Finish from build needs verify next; record build with run record.');
  if (!text(summary)) throw new Error('Finish needs --summary with the result and its limits.');
  const placeholder = value => typeof value === 'string' && /^<[\s\S]*>$/.test(value.trim());
  if (placeholder(summary) || placeholder(passedEvidence) || Object.values(criterionEvidence ?? {}).some(placeholder)) throw new Error('Replace the template placeholders in summary and criterionEvidence with the actual result and evidence.');
  const unexplained = acceptFailures.find(item => placeholder(item.reason));
  if (unexplained) throw new Error(`acceptFailures still has the placeholder reason for ${unexplained.check}: say why that check, which already failed on the run-start code, is unrelated to this change, or delete the entry and fix it.`);
  fillDerived(root, state, 'deliver', assessment);
  const part = name => {
    const keys = assessmentRequirements(state, name);
    const extra = name === 'verify' && 'testProof' in assessment ? ['testProof'] : [];
    return keys.length ? Object.fromEntries([...keys, ...extra].filter(key => key in assessment).map(key => [key, assessment[key]])) : undefined;
  };
  assessmentPaths(root, assessment);
  const generatesLedger = claimRunLedger(root, state, assessment);
  // Refuse bad input before spending test runs on it.
  if (!text(passedEvidence) && !criterionEvidence) throw new Error('Finish needs criterionEvidence (or passedEvidence for a single criterion).');
  if (!criterionEvidence && state.criteria.length > 1) throw new Error('Multiple criteria need criterionEvidence mapping each criterion ID to its evidence.');
  if (criterionEvidence && (Object.keys(criterionEvidence).length !== state.criteria.length || state.criteria.some(item => !text(criterionEvidence[item.id])))) throw new Error(`Criterion evidence must cover every criterion exactly once: ${state.criteria.map(item => item.id).join(', ')}.`);
  for (const name of ['verify', 'deliver'].filter(name => state.stages.indexOf(name) >= state.stageIndex)) {
    validateAssessment(state, { stage: name, status: 'passed', assessment: part(name) }, path => generatesLedger && path === state.ledgerPath ? null : readFileSync(projectFile(root, path)));
  }
  const steps = [];
  const dropped = [];
  // A step can end the run without throwing: the guard halts it, before recording anything, when
  // protected files or files outside allowedPaths changed, and a proof halts it on a source
  // conflict. Finish then stops at that step and says why, rather than returning the run's whole
  // state or going on until a later step refuses because the run is halted.
  const ended = at => {
    const now = readRun(root, id);
    if (now.status === 'running') return null;
    const event = now.history.findLast(item => ['guard-halt', 'exhausted', 'blocked', 'stop'].includes(item.type));
    const changed = [...(event?.protectedChanges ?? []).map(path => `${path} (protected)`), ...(event?.outOfScope ?? []).map(path => `${path} (outside allowedPaths)`)];
    const recorded = steps.includes('record verify') || (state.stages.includes('verify') && stage === 'deliver') ? 'verify is recorded and delivery is not' : 'verify was not recorded';
    return { runId: id, status: now.status, finished: false, failedAt: at, steps,
      ...(event?.protectedChanges?.length ? { protectedChanges: event.protectedChanges } : {}), ...(event?.outOfScope?.length ? { outOfScope: event.outOfScope } : {}),
      ...(now.proofRecovery ? { recovery: now.proofRecovery } : {}),
      reason: changed.length
        ? `The run halted at ${at}, so ${recorded}: these files changed, ${changed.join(', ')}. Nothing was rolled back, and this run cannot continue. Review those changes; finishing the work needs a new run whose scope covers them.`
        : `The run is ${now.status} at ${at}, so ${recorded}${event?.reason ? `: ${event.reason}` : '.'} This run cannot continue.` };
  };
  // A proof or check that halted the run, or returned the run state instead of its own result, is
  // reported as a stop; an ordinary failed proof or check keeps its verdict and receipt.
  const stoppedBy = (at, result) => readRun(root, id).status === 'halted' || 'history' in result ? ended(at) : null;
  if (stage === 'build') {
    try { quickHandoff(root, id, { summary: `Built: ${summary}`, artifacts: artifacts ?? changedArtifacts(root, state) }); }
    catch (error) { throw new Error(`Finish stopped at record build: ${error.message}`); }
    const stop = ended('record build');
    if (stop) return stop;
    steps.push('record build');
    state = readRun(root, id);
    stage = current(state);
  }
  // Listed artifacts win; otherwise the controller names what this run changed.
  artifacts ??= changedArtifacts(root, state);
  if (stage === 'verify') {
    if (provable(state)) {
      const exemption = part('verify')?.testProof;
      // Prove here rather than refuse: a missing or outdated proof is one more step, not a retry.
      if (exemption === undefined && proofOutdated(root, state)) {
        let proof;
        try { proof = proveRun(root, id); }
        catch (error) { throw new Error(`Finish stopped at prove-red: ${error.message}`); }
        const stop = !proof.passed && stoppedBy('prove-red', proof);
        if (stop) return stop;
        steps.push('prove-red');
        if (!proof.passed) return { ...proof, finished: false, steps, failedAt: 'prove-red' };
        state = readRun(root, id);
      }
      requireTestProof(root, state, exemption);
    }
    // The proof's control run has now measured the run-start code, so listed pre-existing failures
    // can be checked against it. A check that passed there has nothing to accept: the entry is
    // dropped with a note, and verify still requires that check to pass.
    for (const item of acceptFailures) {
      if (passedAtRunStart(root, readRun(root, id), item.check) === true) {
        dropped.push({ check: item.check, reason: 'passed on the run-start code, so there was nothing to accept' });
        continue;
      }
      try { acceptFailure(root, id, item); }
      catch (error) { throw new Error(`Finish stopped at accept-failure ${item.check}: ${error.message}`); }
    }
    if (acceptFailures.length > dropped.length) { steps.push('accept-failure'); state = readRun(root, id); }
    if (state.requiresChecks) {
      const verification = verifyRun(root, id);
      const stop = !verification.passed && stoppedBy('verify', verification);
      if (stop) return stop;
      steps.push('verify');
      if (!verification.passed) return { ...verification, finished: false, steps, failedAt: 'verify' };
    }
    const at = 'record verify';
    try { quickHandoff(root, id, { summary: `Verified: ${summary}`, artifacts, passedEvidence, criterionEvidence, assessment: part('verify') }); }
    catch (error) { throw new Error(`Finish stopped at ${at}: ${error.message}`); }
    const stop = ended(at);
    if (stop) return stop;
    steps.push(at);
  }
  if (generatesLedger) writeRunLedger(root, state, assessment);
  try { quickHandoff(root, id, { summary, artifacts, passedEvidence, criterionEvidence, assessment: part('deliver') }); }
  catch (error) { throw new Error(`Finish stopped at record deliver${state.stages.includes('verify') ? ' (verify is recorded)' : ''}: ${error.message}`); }
  const stop = ended('record deliver');
  if (stop) return stop;
  steps.push('record deliver');
  const completed = completeRun(root, id);
  steps.push('complete');
  // The run's own record is the review: each criterion's evidence and the files it changed.
  let packet = null;
  if (completed.status === 'complete') {
    try {
      const recorded = earlier => { try { return readRun(root, earlier.runId).reviewPacket?.digest === runPacketDigest(earlier); } catch { return false; } };
      packet = writeRunPacket(root, { session: completed.session, runId: id, checks: completed.criteria.map(item => ({ criterion: item.description, result: 'passed', evidence: (criterionEvidence?.[item.id] ?? passedEvidence).trim() })), artifacts, recorded });
      // The gate accepts the packet only with this record in the run that wrote it.
      if (packet.written) transact(root, id, state => { state.reviewPacket = { digest: packet.digest, writtenAt: new Date().toISOString() }; log(state, 'review-packet', { digest: packet.digest }); return state; });
    } catch (error) { packet = { written: false, reason: `Could not write the review packet (${error.message}); write it with cyc packet.` }; }
  }
  // What the reply may state: the proof's scope and any pre-existing failure it must disclose.
  return { runId: id, status: completed.status, finished: completed.status === 'complete', steps, reviewPath: reviewPath(completed),
    ...(packet ? { packet } : {}),
    ...(completed.testProof?.claim && testProofStatus(root, completed)?.status === 'proven' ? { proofClaim: completed.testProof.claim } : {}),
    ...(completed.verification?.acceptedPreexistingFailures?.length ? { acceptedPreexistingFailures: (completed.acceptedFailures ?? []).filter(item => completed.verification.acceptedPreexistingFailures.includes(item.id)).map(({ id: check, reason }) => ({ check, reason })) } : {}),
    ...(dropped.length ? { droppedAcceptFailures: dropped } : {}) };
}

function writeReview(root, state) {
  const path = projectFile(root, reviewPath(state));
  const temporary = `${path}.${randomUUID()}.tmp`;
  const final = state.handoffs.findLast(item => ['verify', 'deliver'].includes(item.stage) && item.status === 'passed');
  const artifactIssues = [];
  for (const artifact of final?.artifacts ?? []) {
    try { assertArtifacts(root, [artifact]); }
    catch (error) { artifactIssues.push(`${artifact.path}: ${error.message}`); }
  }
  writeFileSync(temporary, renderReview(state, cachedSnapshot(root).hash, artifactIssues), { mode: 0o600 });
  renameSync(temporary, path);
  return reviewPath(state);
}

export function reviewRun(root, id) {
  return transact(root, id, state => ({ runId: id, status: state.status, reviewPath: reviewPath(state) }));
}
