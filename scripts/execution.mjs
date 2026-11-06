import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { relative, resolve, isAbsolute, sep } from 'node:path';
import { digest } from './response-gate.mjs';

export const executionModes = ['native-codex', 'native-claude', 'cursor', 'standalone'];
export const conversationIdentity = (env = process.env) => [env.CYC_SESSION, env.CLAUDE_CODE_SESSION_ID, env.CODEX_THREAD_ID].find(v => /^[A-Za-z0-9_-]{4,80}$/.test(v ?? ''));
function setup(message) {
  const error = new Error(message);
  error.setup = { action: 'select-execution', modes: executionModes, instruction: 'Supply executionMode (CLI --mode) and the real conversationId when known; standalone is explicit no-hook work and cannot downgrade a live native request.' };
  throw error;
}
export function resolveExecution(root, { executionMode, conversationId, session } = {}, env = process.env) {
  if (executionMode !== undefined && !executionModes.includes(executionMode)) setup(`Unknown executionMode ${executionMode}.`);
  const caller = conversationIdentity(env);
  for (const value of [conversationId, session]) if (value !== undefined && !/^[A-Za-z0-9_-]{4,80}$/.test(value)) setup('Session must be 4-80 letters, digits, underscores or dashes; conversationId uses the same safe identity shape.');
  const native = id => {
    if (!id) return null;
    for (const host of ['codex', 'claude', 'cursor']) {
      const key = /^[a-f0-9]{32}$/.test(id) ? id : digest(`${host}:${id}`).slice(0, 32);
      const path = resolve(root, '.cyc/runtime', `${key}.state.json`);
      if (existsSync(path)) {
        const state = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
        const observedHost = state.host ?? state.activation?.host;
        if (observedHost && observedHost !== host) continue;
        return { mode: host === 'cursor' ? 'cursor' : `native-${host}`, gateSession: key };
      }
    }
    return null;
  };
  const active = native(caller);
  if (active && executionMode && executionMode !== active.mode) setup(`Active ${active.mode} request cannot use ${executionMode}.`);
  if (active && conversationId && conversationId !== caller && native(conversationId)?.gateSession !== active.gateSession) setup('conversationId does not identify the active native request.');
  const identity = conversationId ?? caller;
  const observed = active ?? native(conversationId) ?? native(session) ?? native(caller);
  if (observed && executionMode === 'standalone') setup(`Active ${observed.mode} context cannot use standalone.`);
  const mode = executionMode ?? observed?.mode;
  if (!mode) setup(/^[a-f0-9]{32}$/.test(session ?? '') ? `No hook state for session ${session}. Provide the current native context or choose an explicitly authorized execution mode.` : 'Execution capability is unknown; choose --mode standalone for explicitly authorized no-hook work, or provide the current native context.');
  if (mode.startsWith('native-') && (!observed || observed.mode !== mode)) setup(`${mode} needs current native hook state for the supplied conversationId/session. Reload the host and use its injected context.`);
  return { mode, conversationId: identity ?? null, workflowSession: session ?? null, gateSession: observed?.gateSession ?? null, hookActivation: 'unverified' };
}
export function artifactFiles(root, paths, label = 'Artifact') {
  return paths.map(path => {
    if (typeof path !== 'string' || !path) throw new Error(`${label} needs a regular-file path.`);
    const absolute = resolve(root, path), realRoot = realpathSync(root);
    const inside = target => { const rel = relative(realRoot, target); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); };
    if (!inside(absolute)) throw new Error(`${label} leaves project: ${path}`);
    const info = lstatSync(absolute);
    if (!info.isFile() || !inside(realpathSync(absolute))) throw new Error(`${label} ${path} must be a regular file; directories are not expanded. List concrete files individually.`);
    return { path, sha256: digest(readFileSync(absolute)) };
  });
}
