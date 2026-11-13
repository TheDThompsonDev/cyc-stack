import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { digest } from './response-gate.mjs';
import { controllerPath, recordMatcher, sourceSnapshot } from './source-snapshot.mjs';

// Connects the delivery gate to controller runs. A run counts only if this session owns it
// (or it is an unowned legacy run) and it was touched during the current request, so parallel
// conversations in one folder never block each other.
const lastActivity = run => Math.max(Date.parse(run.startedAt) || 0, ...(run.history ?? []).map(item => Date.parse(item.time) || 0));

function gitTop(root) {
  let ancestor = resolve(root);
  while (!existsSync(resolve(ancestor, '.git')) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  return existsSync(resolve(ancestor, '.git')) ? ancestor : null;
}

export function touchedRuns(root, since, session, others) {
  const roots = new Set([resolve(root)]);
  // Git provides registered checkout locations; never crawl arbitrary sibling directories.
  // Without that listing, still check this checkout's runs rather than refusing every Stop.
  if (session && gitTop(root)) {
    const result = spawnSync('git', ['-C', root, 'worktree', 'list', '--porcelain', '-z'], { encoding: 'utf8', windowsHide: true, timeout: 2000, maxBuffer: 1024 * 1024 });
    if (result.status === 0) {
      for (const field of result.stdout.split('\0')) if (field.startsWith('worktree ')) roots.add(resolve(field.slice(9)));
    }
  }
  return [...roots].flatMap(location => localRuns(location, since, session, location === resolve(root), location === resolve(root) ? others : undefined));
}

// Untracked files beyond this count (unignored dependencies or build output) are compared as one
// digest of their paths, which keeps the hook fast and its state small.
const untrackedLimit = 5000;
// Without optional locks Git never rewrites .git/index, so a concurrent git add or commit is safe.
const git = (root, args, timeout = 5000) => spawnSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024 });
const projectPath = (root, top, path) => relative(resolve(root), resolve(top, path)).split(sep).join('/');

function signature(path, tracked, deadline = Date.now() + changeCheckDeadlineMs) {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return digest(`symlink:${readlinkSync(path)}`);
    // A submodule or nested repository: what changed inside it, read with what remains of the
    // budget. A reading it could not finish is passed up as 'unavailable', never hashed as content.
    if (stat.isDirectory()) {
      if (!existsSync(resolve(path, '.git'))) return 'directory';
      const nested = changeFingerprint(path, { deadlineMs: Math.max(1, deadline - Date.now()) });
      return nested?.unavailable ? 'unavailable' : digest(JSON.stringify(nested));
    }
    if (!stat.isFile()) return 'not-a-file';
    // Tracked edits are few and compared by content. Untracked files can be numerous, so size
    // and modification time are enough to notice that one changed.
    return tracked && stat.size <= 8 * 1024 * 1024 ? digest(readFileSync(path)) : `stat:${stat.size}:${stat.mtimeMs}`;
  } catch (error) { return error.code === 'ENOENT' ? 'deleted' : `unreadable:${error.code}`; }
}

// What a request changes, compared between its prompt and its Stop. With Git: the checked-out
// commit and the files Git reports as changed. Without Git: the controller's own source selection.
// Null when neither can be read, which skips the comparison rather than blocking. A reading that
// does not finish within its deadline is `unavailable`: the hook has its own time limit from the
// host, and a hook the host kills never reaches the gate, so a slow reading must be reported, not
// waited for and not skipped.
const changeCheckDeadlineMs = 6000;
export function changeFingerprint(root, { deadlineMs = changeCheckDeadlineMs } = {}) {
  const deadline = Date.now() + deadlineMs;
  const unavailable = what => ({ method: 'git', unavailable: `${what} did not finish within ${Math.ceil(deadlineMs / 1000)} s` });
  const top = gitTop(root);
  if (!top) {
    try { return { method: 'snapshot', files: sourceSnapshot(root, { signatures: 'stat' }).files }; } catch { return null; }
  }
  const result = git(root, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all', '--no-renames', '--', '.'], Math.max(1, Math.min(5000, deadline - Date.now())));
  if (result.error?.code === 'ETIMEDOUT') return unavailable('git status');
  if (result.status !== 0) return null;
  let head = null;
  const tracked = [];
  const untracked = [];
  for (const entry of result.stdout.split('\0')) {
    if (entry.startsWith('# branch.oid ')) head = entry.slice(13);
    else if (entry.startsWith('1 ')) tracked.push(entry.split(' ').slice(8).join(' '));
    else if (entry.startsWith('u ')) tracked.push(entry.split(' ').slice(10).join(' '));
    else if (entry.startsWith('? ')) untracked.push(entry.slice(2));
  }
  // Porcelain paths are relative to the repository root, not to this project. Controller bookkeeping
  // and published change records are not project edits.
  const record = recordMatcher(root);
  const local = paths => paths.map(path => [projectPath(root, top, path), resolve(top, path)]).filter(([path]) => !controllerPath(path) && !record(path));
  const files = {};
  for (const [path, absolute] of local(tracked)) {
    if (Date.now() > deadline) return unavailable('hashing the changed files');
    files[path] = signature(absolute, true, deadline);
    if (files[path] === 'unavailable') return unavailable(`reading the nested repository ${path}`);
  }
  const added = local(untracked);
  if (added.length > untrackedLimit) return { method: 'git', head, files, untracked: { count: added.length, digest: digest(added.map(([path]) => path).sort().join('\0')) } };
  for (const [path, absolute] of added) {
    if (Date.now() > deadline) return unavailable('reading the untracked files');
    files[path] = signature(absolute, false, deadline);
    if (files[path] === 'unavailable') return unavailable(`reading the nested repository ${path}`);
  }
  return { method: 'git', head, files };
}

// A commit made during the request leaves its files clean again; Git still knows what it changed.
function committedPaths(root, from, to) {
  const top = gitTop(root);
  const result = from === '(initial)'
    ? git(root, ['ls-tree', '-r', '-z', '--name-only', '--full-name', to, '--', '.'])
    : git(root, ['diff', '--no-relative', '--name-only', '-z', from, to, '--', '.']);
  if (result.status !== 0) return [`commits ${from.slice(0, 7)}..${to.slice(0, 7)}`];
  const record = recordMatcher(root);
  return result.stdout.split('\0').filter(Boolean).map(path => projectPath(root, top, path)).filter(path => !controllerPath(path) && !record(path));
}

function changedPaths(root, before, after) {
  if (!before?.files || !after?.files || before.method !== after.method) return [];
  const changed = new Set([...Object.keys(before.files), ...Object.keys(after.files)].filter(path => before.files[path] !== after.files[path]));
  if (before.untracked?.digest !== after.untracked?.digest) changed.add(`${(after.untracked ?? before.untracked).count} untracked files`);
  if (before.head && after.head && before.head !== after.head && after.head !== '(initial)') for (const path of committedPaths(root, before.head, after.head)) changed.add(path);
  // Committing, resetting or staging moves files in and out of Git's list without changing them.
  // A path changed only if its working-tree content differs from the prompt: its recorded
  // signature, or, for a path clean then, its blob in the commit checked out at the prompt.
  const same = before.method === 'git' ? sameAsCommit(root, before.head, [...changed].filter(path => before.files[path] === undefined)) : new Set();
  const unchanged = path => before.files[path] === undefined ? same.has(path)
    : (after.files[path] ?? signature(resolve(root, path), !before.files[path].startsWith('stat:'))) === before.files[path];
  return [...changed].filter(path => !unchanged(path)).sort();
}

// Paths whose working-tree blob equals their blob in `head`, in two batched Git calls.
function sameAsCommit(root, head, paths) {
  const files = paths.filter(path => { try { return lstatSync(resolve(root, path)).isFile(); } catch { return false; } });
  if (!head || head === '(initial)' || !files.length) return new Set();
  const top = gitTop(root);
  const run = (args, input) => spawnSync('git', ['--no-optional-locks', '-C', root, ...args], { input, encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 16 * 1024 * 1024 });
  const current = run(['hash-object', '--stdin-paths'], files.join('\n') + '\n');
  const recorded = run(['cat-file', '--batch-check=%(objectname)'], files.map(path => `${head}:${relative(top, resolve(root, path)).split(sep).join('/')}`).join('\n') + '\n');
  if (current.status !== 0 || recorded.status !== 0) return new Set();
  const now = current.stdout.trim().split('\n');
  const then = recorded.stdout.trim().split('\n');
  return new Set(files.filter((path, index) => now[index] && now[index] === then[index]));
}

export const advisoryReason = packet => typeof packet?.advisory === 'string' && packet.advisory.trim() && !/^<[\s\S]*>$/.test(packet.advisory.trim()) ? packet.advisory.trim() : null;

// A request that changed project files owes a controller run. A blocked handoff claims nothing;
// an advisory reason records why no run applies, such as an explanation, a copy edit, or setup.
// Another conversation's run touched during this request accounts for the files in its scope.
function changeIssues(root, before, runs, others, packet, session) {
  if (!before || runs.length || packet?.status === 'blocked' || advisoryReason(packet)) return [];
  const flag = session ? ` --session ${session}` : '';
  const after = changeFingerprint(root);
  // A reading that could not finish is said so: the gate cannot tell whether files changed, and a
  // silent pass here is what a killed hook would also produce.
  const unavailable = before.unavailable ?? after?.unavailable;
  if (unavailable) return [`The change check could not complete (${unavailable}), so the gate cannot tell whether project files changed during this request. Run code changes through run start${flag} and run finish, deliver an honest blocked handoff, or, when no project files changed or no run applies, record why with cyc packet${flag} --advisory "<reason>".`];
  const covered = path => others.some(run => !run.allowedPaths?.length || run.allowedPaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`)));
  const changed = changedPaths(root, before, after).filter(path => !covered(path));
  if (!changed.length) return [];
  const shown = changed.slice(0, 5).join(', ') + (changed.length > 5 ? ` and ${changed.length - 5} more` : '');
  return [`Project files changed during this request without a CYC run for this session (${shown}). Run code changes through run start${flag} and run finish, deliver an honest blocked handoff, or, when no run applies (an explanation, a copy edit, or setup), record why with cyc packet${flag} --advisory "<reason>". Keep reply drafts under .cyc/runtime/.`];
}

function localRuns(root, since, session, includeLegacy, others) {
  const sinceMs = Date.parse(since ?? '');
  const directory = resolve(root, '.cyc/runs');
  if (!Number.isFinite(sinceMs) || !existsSync(directory) || lstatSync(directory).isSymbolicLink()) return [];
  const runs = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z0-9-]{1,80}$/.test(entry.name)) continue;
    const path = resolve(directory, entry.name, 'state.json');
    if (!existsSync(path) || lstatSync(path).isSymbolicLink()) continue;
    let run;
    try { run = JSON.parse(readFileSync(path, 'utf8')); } catch { continue; }
    if (!run || typeof run.status !== 'string' || !Array.isArray(run.stages) || lastActivity(run) < sinceMs) continue;
    if (run.session ? run.session === session : includeLegacy) runs.push(run);
    else others?.push(run);
  }
  return runs;
}

export function checkRuns({ root, since, packet, session, fingerprint, now = Date.now() }) {
  const others = [];
  const runs = touchedRuns(root, since, session, others);
  return [...runIssues(runs, packet, now, session), ...changeIssues(root, fingerprint, runs, others, packet, session)];
}

const expired = (run, now) => now - Date.parse(run.startedAt) >= (run.limits?.maxDurationMs ?? Infinity);
// Ended short of complete: what a blocked handoff reports. A run still within its budget is not
// a blocker; it has to finish or be recorded blocked first.
const unfinished = (run, now) => run.status !== 'complete' && !(run.status === 'running' && !expired(run, now));
const endedAs = run => run.status === 'running' ? 'past its time budget' : run.status;
// Why a run stopped, in the controller's record: the reason and files logged by the latest status
// change. Pause and stop log no reason, and a resume clears an earlier one.
function stopReason(run) {
  const event = run.history?.findLast(item => ['blocked', 'guard-halt', 'exhausted', 'pause', 'stop', 'resume'].includes(item.type));
  if (!event || event.type === 'resume') return null;
  const files = [...(event?.protectedChanges ?? []), ...(event?.outOfScope ?? [])];
  return [event?.reason, files.length ? `Files: ${files.join(', ')}.` : ''].filter(Boolean).join(' ') || null;
}

// The runs that make this request a blocked handoff, so the agent never retypes the controller's record.
export function blockingRuns({ root, since, session, now = Date.now() }) {
  return touchedRuns(root, since, session).filter(run => unfinished(run, now))
    .map(run => ({ run: run.id, status: endedAs(run), ...(stopReason(run) ? { reason: stopReason(run) } : {}) }));
}

function runIssues(runs, packet, now, session) {
  const issues = [];
  const flag = session ? ` --session ${session}` : '';
  // Claude Code and Codex packets (32-character keys) take the blocked status from the run;
  // Cursor packets have no request window, so they state it.
  const repair = /^[a-f0-9]{32}$/.test(session ?? '') ? `rerun cyc packet${flag} without --status ready, which marks the review blocked from this run,` : `rerun cyc packet${flag} with --status blocked --blocker "<what stops completion>"`;
  for (const run of runs) {
    const label = `CYC run ${run.id} (${run.playbook})`;
    const stage = run.stages[run.stageIndex] ?? 'none';
    if (run.status === 'running' && !expired(run, now)) {
      issues.push(`${label} is still running at stage "${stage}". Continue the loop until verification passes and run complete succeeds, or record it as blocked, paused, or stopped with the controller and deliver an honest blocked handoff.`);
    } else if (run.status !== 'complete' && packet?.status !== 'blocked') {
      issues.push(`${label} ended this request ${endedAs(run)}, not complete. Deliver a blocked handoff: ${repair} and start the reply with "Blocked:" or "Not ready:" saying what stops completion.`);
    }
  }
  // A review run finish wrote vouches only for runs of this request that completed, and the run
  // that wrote it recorded its digest; a packet that only claims run finish wrote it is refused.
  // The writer is named by runId; runIds lists every run whose checks it carries. The writer must be
  // the latest finish in this request to write a packet, so an older genuine packet restored over
  // a newer one is refused too.
  if (packet?.writtenBy === 'run finish') {
    const redo = `Write the review with cyc packet${flag} --reviewed after rereading your reply.`;
    const named = [...new Set([packet.runId, ...(Array.isArray(packet.runIds) ? packet.runIds : [])])];
    for (const id of named) {
      if (runs.find(item => item.id === id)?.status !== 'complete') issues.push(`The review says run finish wrote it, but run ${id ?? '(missing)'} is not a run of this request that completed. ${redo}`);
    }
    const writer = runs.find(item => item.id === packet.runId);
    // Over the packet as parsed, as finish computed it (scripts/packet.mjs runPacketDigest).
    if (writer?.status === 'complete' && writer.reviewPacket?.digest !== digest(JSON.stringify(packet))) issues.push(`The review says run finish wrote it, but it does not match what run ${packet.runId} recorded. ${redo}`);
    const latest = runs.filter(item => item.reviewPacket?.writtenAt).sort((a, b) => Date.parse(a.reviewPacket.writtenAt) - Date.parse(b.reviewPacket.writtenAt)).at(-1);
    if (writer?.status === 'complete' && latest && latest.id !== writer.id) issues.push(`The review is the packet run ${writer.id} wrote, but run ${latest.id} finished later and wrote its own. ${redo}`);
  }
  // A review that names its blocking runs must name unfinished runs of this request.
  for (const entry of Array.isArray(packet?.blockedBy) ? packet.blockedBy : []) {
    const run = runs.find(item => item.id === entry?.run);
    if (!run || !unfinished(run, now)) issues.push(`The review names run ${entry?.run ?? '(missing)'} as its blocker, but that is not an unfinished run of this request. Rerun cyc packet${flag} to record the current runs.`);
  }
  return issues;
}

// Diagnostic only: this inspects controller status, not source freshness or host activation.
export function sessionReadiness({ root, session, since, now = Date.now() }) {
  if (typeof session !== 'string' || !/^[A-Za-z0-9_-]{4,80}$/.test(session)) throw new Error('Use the current --session ID (4-80 letters, digits, dashes or underscores).');
  const statePath = resolve(root, '.cyc/runtime', `${session}.state.json`);
  let requestWindow = 'explicit';
  if (existsSync(statePath)) {
    if (lstatSync(statePath).isSymbolicLink()) throw new Error('CYC state files cannot be symlinks.');
    if (since !== undefined) throw new Error('Do not override an existing hook request window with --since.');
    since = JSON.parse(readFileSync(statePath, 'utf8')).updatedAt;
    requestWindow = 'hook-state';
  }
  validateRequestWindow(since, now);
  const runs = touchedRuns(root, since, session);
  const issues = runIssues(runs, { status: 'ready' }, now, session);
  return { ok: issues.length === 0, scope: 'controller-status-only', session, since, requestWindow, hostActivation: 'unverified', runs: runs.map(run => ({ id: run.id, status: run.status, stage: run.stages[run.stageIndex] ?? null })), issues,
    limitation: 'This read-only diagnostic does not certify source freshness, task quality, hook activation or delivery. An explicit window may omit work if chosen incorrectly; the Stop hook owns its actual request window.' };
}

export function validateRequestWindow(value, now = Date.now()) {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value)) || Date.parse(value) > now || new Date(`${match[1]}T00:00:00.000Z`).toISOString().slice(0, 10) !== match[1]) throw new Error('No valid request window. Use active hook state or --since with a non-future ISO timestamp for an explicit diagnostic.');
  return value;
}
