import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let root = engineRoot;
const host = process.argv[2];
const prefix = 'CYC_GATE_CONTINUE:';
const emit = object => console.log(JSON.stringify(object));
const bullets = items => items.map(item => `- ${item}`).join('\n');
// Every conversation leaves a state and a review file; a project that runs for months collects
// hundreds. At each prompt the gate removes its own files older than 14 days, never the current
// conversation's, and nothing else under .cyc/runtime: drafts, FINISH.json and check output stay.
const gateFile = /^(?:[a-f0-9]{32}\.(?:state|review)\.json|[a-f0-9]{32}\.state\.json\.corrupt-[^/\\]+|cursor(?:-[a-z0-9-]{4,40})?\.review\.json|[^/\\]+\.tmp)$/;
function pruneGateFiles(runtime, key) {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let names;
  try { names = readdirSync(runtime); } catch { return; }
  for (const name of names) {
    if (name.startsWith(key) || !gateFile.test(name)) continue;
    const path = resolve(runtime, name);
    try { const info = lstatSync(path); if (info.isFile() && info.mtimeMs < cutoff) unlinkSync(path); } catch { /* another process may hold or have removed it; the next prompt tries again */ }
  }
}
// Windows editors may save JSON with a byte-order mark; it is not part of the document.
const load = path => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : null;
function save(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(temporary, path);
}

// Host adapters translate each host's hook protocol into three events:
// prompt (a user request starts), response (final text observed), and stop.
const adapters = {
  claude: {
    event: { UserPromptSubmit: 'prompt', Stop: 'stop' },
    session: input => input.session_id,
    cwd: input => input.cwd,
    context: text => ({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }),
    block: reason => ({ decision: 'block', reason }),
    halt: message => ({ continue: false, stopReason: message, systemMessage: message })
  },
  // Cursor cannot inject prompt context and its stop event omits the final text,
  // so the text comes from afterAgentResponse and instructions come from a rule file.
  cursor: {
    event: { beforeSubmitPrompt: 'prompt', afterAgentResponse: 'response', stop: 'stop' },
    session: input => input.conversation_id,
    cwd: input => (Array.isArray(input.workspace_roots) && input.workspace_roots[0]) || process.env.CURSOR_PROJECT_DIR || input.cwd,
    context: () => ({ continue: true }),
    block: reason => ({ followup_message: reason }),
    halt: message => ({ followup_message: `${message} Tell the user this response was not certified by the CYC gate.` })
  }
};
adapters.codex = adapters.claude;
const adapter = adapters[host];

let event;
let statePath = null;
try {
  if (!adapter) throw new Error('Unknown host identifier.');
  const input = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  event = adapter.event[input.hook_event_name];
  if (!event) throw new Error('Unsupported hook event.');
  // Imported here rather than statically: a missing module must reach the handler below.
  // A crashed hook is a non-blocking error to the host, which would silently skip the gate.
  const [{ checkResponse, digest, normalize }, { allowsLongResponse, lengthCommand }, { changeFingerprint, checkRuns }, { activationBinding }] = await Promise.all(
    ['./response-gate.mjs', './response-mode.mjs', './run-gate.mjs', './host-activation.mjs'].map(module => import(module)));
  // Cursor also runs Claude Code hooks from .claude/settings.json. Let the Cursor adapter own Cursor sessions.
  if (host !== 'cursor' && (process.env.CURSOR_PROJECT_DIR || input.cursor_version || input.conversation_id)) { emit({}); process.exit(0); }
  const session = adapter.session(input);
  if (typeof session !== 'string' || !session) throw new Error('Missing session identifier.');
  const projectIndex = process.argv.indexOf('--project');
  const cwd = adapter.cwd(input);
  if (projectIndex >= 0) {
    if (!process.argv[projectIndex + 1]) throw new Error('--project needs a path.');
    root = resolve(process.argv[projectIndex + 1]);
  } else if (process.env.CYC_PROJECT_ROOT) root = resolve(process.env.CYC_PROJECT_ROOT);
  else if (typeof cwd === 'string') {
    let cursor = resolve(cwd);
    while (true) {
      if (existsSync(resolve(cursor, '.cyc/config.json'))) { root = cursor; break; }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  // Plugin installs are user-wide. Stay silent unless this project activated CYC,
  // and defer to project-installed hooks so a session is never gated twice.
  if (process.argv.includes('--plugin')) {
    const manifest = resolve(root, '.cyc/install-manifest.json');
    const projectHooks = existsSync(manifest) && (() => { try { return Boolean(JSON.parse(readFileSync(manifest, 'utf8')).hooks?.[host]); } catch { return false; } })();
    if (root === engineRoot || !existsSync(resolve(root, '.cyc/config.json')) || projectHooks) { emit({}); process.exit(0); }
  }
  root = realpathSync(root);
  const config = load(resolve(root, '.cyc/config.json')) ?? {};
  const presentation = config.delivery?.presentation ?? 'cyc';
  if (!['cyc', 'project'].includes(presentation)) throw new Error('delivery.presentation must be cyc or project.');
  const defaultCharacterLimitEnabled = config.delivery?.defaultCharacterLimitEnabled ?? true;
  if (typeof defaultCharacterLimitEnabled !== 'boolean') throw new Error('delivery.defaultCharacterLimitEnabled must be a boolean.');
  const runtime = resolve(root, '.cyc/runtime');
  for (const path of [resolve(root, '.cyc'), runtime]) {
    try { if (lstatSync(path).isSymbolicLink()) throw new Error('CYC runtime cannot be a symlink or junction.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  mkdirSync(runtime, { recursive: true });
  const key = digest(`${host}:${session}`).slice(0, 32);
  statePath = resolve(runtime, `${key}.state.json`);
  // Cursor agents cannot learn their conversation ID. Each picks its own session tag and writes
  // .cyc/runtime/cursor-<tag>.review.json; the hook finds its packet by freshness and exact text.
  let packetPath = resolve(runtime, host === 'cursor' ? 'cursor-<your-session-tag>.review.json' : `${key}.review.json`);
  for (const path of [statePath, packetPath]) {
    try { if (lstatSync(path).isSymbolicLink()) throw new Error('CYC state/review files cannot be symlinks.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let state;
  try { state = load(statePath); } catch (error) {
    // A state file that cannot be parsed (a partial write, a stray edit) must not wedge the session:
    // the next prompt sets it aside and starts a fresh request. Stop stays strict and names the file.
    if (event !== 'prompt') throw new Error(`${error.message} in ${statePath}`);
    renameSync(statePath, `${statePath}.corrupt-${randomUUID()}`);
    state = null;
  }

  const context = () => presentation === 'project' ? `CYC uses project reply formatting. Follow the existing project response rules; no CYC length, visual or review-packet requirement applies. CYC session ID: ${key}. Pass --session ${key} to run start. Controller runs must complete or end with an honest Blocked: or Not ready: handoff. Project ledger lookup: ${config.context?.ledgerPath ?? "use the existing project ledger, otherwise docs/context/error-ledger.md"}. Use run next ledgerPath for authorized failure recording.` : `CYC delivery gate: persistent 1000-character limit is ${state.characterLimitEnabled === false ? 'OFF' : 'ON'} for this conversation. ${allowsLongResponse(state) ? 'No character cap for this response; use as much detail as useful.' : 'Final response must be <=1000 characters including Markdown.'} One-turn expansion: ${state.expanded}. A meaningful visual and all readiness checks remain required. Standalone user commands: limit on, limit off, limit status. Confirm the setting when the user requests a toggle or status. Read ${resolve(engineRoot, 'docs/response-standard.md')}. ${host === 'cursor' ? `Before finishing, write the evidence-backed review to ${packetPath}, including the exact response. Review token: ${state.token}.` : `Before finishing, the evidence-backed review must be at ${packetPath}: a completed \`run finish\` writes it for you. Without one (no run, a blocked handoff, or files changed after finish), \`node "${resolve(engineRoot, 'bin/cyc.mjs')}" packet --session ${key} --passed "criterion :: evidence" --reviewed\` writes it and runs this gate's checks. Review token: ${state.token}. The Stop gate checks your final reply itself: draft it in .cyc/runtime/reply.md, run \`node "${resolve(engineRoot, 'bin/cyc.mjs')}" check-reply .cyc/runtime/reply.md --session ${key}\` to see its character count and visual, and send it unchanged.`}${host === 'cursor' ? '' : ` CYC session ID: ${key}. Pass --session ${key} to \`cyc run start\` so parallel conversations stay independent.`} Fix unmet criteria in the work, not just its description. A blocked handoff must disclose the blocker and cannot claim completion.`;

  if (event === 'prompt') {
    if (typeof input.prompt !== 'string') throw new Error('Missing user prompt.');
    // Codex and Cursor submit a Stop continuation as another user prompt. Preserve its budget.
    const continuation = state?.pendingReason && input.prompt === state.pendingReason;
    if (!continuation) {
      const command = lengthCommand(input.prompt);
      const characterLimitEnabled = command === 'off' ? false : command === 'on' ? true : state?.characterLimitEnabled ?? defaultCharacterLimitEnabled;
      state = {
        activation: activationBinding(root, host),
        promptAt: new Date().toISOString(),
        token: host === 'cursor' ? 'cursor' : randomUUID(),
        characterLimitEnabled,
        expanded: /^(?:expand[.!]?|\/cyc-expand(?:\s+[\s\S]*)?)$/i.test(input.prompt.trim()),
        attempts: 0,
        pendingReason: null,
        updatedAt: null,
        sourceFingerprint: changeFingerprint(root)
      };
      state.updatedAt = state.promptAt;
      save(statePath, state);
    }
    pruneGateFiles(runtime, key);
    emit(adapter.context(context()));
  } else if (event === 'response') {
    if (state && typeof input.text === 'string') { state.lastResponse = input.text; save(statePath, state); }
    emit({});
  } else {
    // A Cursor stop after an abort or error cannot continue; nothing to certify.
    if (host === 'cursor' && input.status && input.status !== 'completed') { emit({}); process.exit(0); }
    // Also supports a session whose initial prompt preceded installation.
    if (!state) {
      state = { token: host === 'cursor' ? 'cursor' : randomUUID(), characterLimitEnabled: defaultCharacterLimitEnabled, expanded: false, attempts: 0, pendingReason: null };
    }
    const response = host === 'cursor' ? state.lastResponse : input.last_assistant_message;
    let packet = null;
    if (host === 'cursor') {
      // Prefer the fresh packet whose text matches this conversation's reply; otherwise report on the newest.
      const since = Date.parse(state.updatedAt ?? '') || 0;
      const candidates = readdirSync(runtime).filter(name => /^cursor(?:-[a-z0-9-]{4,40})?\.review\.json$/.test(name))
        .map(name => ({ name, path: resolve(runtime, name), mtime: statSync(resolve(runtime, name)).mtimeMs }))
        .filter(item => !lstatSync(item.path).isSymbolicLink())
        .sort((a, b) => b.mtime - a.mtime)
        .map(item => { try { return { ...item, packet: JSON.parse(readFileSync(item.path, 'utf8')) }; } catch { return null; } })
        .filter(Boolean);
      const match = candidates.find(item => item.mtime >= since && typeof response === 'string' && typeof item.packet?.response === 'string' && normalize(item.packet.response) === normalize(response));
      const chosen = match ?? candidates[0];
      if (chosen) {
        packetPath = chosen.path;
        packet = chosen.mtime >= since ? chosen.packet : { ...chosen.packet, token: 'stale' };
        const tag = /^cursor-([a-z0-9-]{4,40})\.review\.json$/.exec(chosen.name)?.[1];
        if (match && tag) state.sessionTag = tag;
      }
    } else {
      try { packet = load(packetPath); } catch { packet = null; }
    }
    // A packet that does not copy the reply is tied to the reply by when it was written: after a
    // rejected Stop, the revised reply needs a review written after the rejection.
    const packetHash = host !== 'cursor' && existsSync(packetPath) ? digest(readFileSync(packetPath)) : null;
    // A packet run finish wrote says nothing about the reply's text, so a revision needs no new one.
    const reviewedAgain = presentation === 'project' || packet?.response !== undefined || packet?.writtenBy === 'run finish' || !packetHash || packetHash !== state.rejectedPacketHash;
    if (presentation === 'project') packet = {
      status: typeof response === 'string' && /^(Blocked:|Not ready:)/i.test(response.trim()) ? 'blocked' : 'ready',
      ...(packet?.token === state.token && typeof packet.advisory === 'string' ? { advisory: packet.advisory } : {})
    };
    const issues = [
      ...(presentation === 'project' && host === 'cursor' && !state.sessionTag ? ['Write the Cursor session identity packet with the exact response and your run session tag.'] : []),
      ...(presentation === 'project' ? [] : checkResponse({ response, packet, token: state.token, expanded: allowsLongResponse(state), root, exactResponse: host === 'cursor' })),
      ...checkRuns({ root, since: state.updatedAt, packet, session: host === 'cursor' ? state.sessionTag : key, fingerprint: state.sourceFingerprint }),
      ...(reviewedAgain ? [] : ['Review the revised reply: run cyc packet --reviewed again after rereading it. A review written before the rejected reply does not cover the new one.'])
    ];
    state.stoppedAt = new Date().toISOString();
    state.stopToken = state.token;
    state.stopResponseHash = typeof response === 'string' ? digest(normalize(response)) : null;
    if (!issues.length) {
      state.pendingReason = null;
      state.lastDecision = packet.status;
      state.stopPacketHash = packetHash;
      save(statePath, state);
      emit({});
    } else if (state.attempts >= 3) {
      state.lastDecision = 'not-ready';
      state.pendingReason = null;
      save(statePath, state);
      emit(adapter.halt(`CYC NOT READY: three correction passes exhausted. No completion certification was issued. Remaining issues:\n${bullets(issues)}`));
    } else {
      state.lastDecision = 'retry';
      state.rejectedPacketHash = packetHash;
      state.attempts += 1;
      // Say now that the revision needs a new review, rather than on the next Stop: a packet that
      // does not copy the reply covers a revised reply only if it is rewritten after this rejection.
      const rereview = presentation !== 'project' && host !== 'cursor' && packet && packet.response === undefined && packet.writtenBy !== 'run finish' && reviewedAgain
        ? [`After revising, rerun cyc packet --session ${key} --reviewed before you stop: the review written before this rejection does not cover the revised reply.`] : [];
      // The prompt already carried the full instructions this request; a correction repeats only
      // what the revision needs. Round 8 paid a model turn per correction on a 1.8 KB message.
      const pointer = presentation === 'project' ? [] : [`Draft the revised reply in .cyc/runtime/reply.md and check it with node "${resolve(engineRoot, 'bin/cyc.mjs')}" check-reply .cyc/runtime/reply.md --session ${key} before sending it unchanged. Packet: ${packetPath}; token ${state.token}.`];
      state.pendingReason = `${prefix} Correction ${state.attempts}/3. Revise the reply:\n${bullets([...issues, ...rereview, ...pointer])}\nIf an external constraint prevents completion, produce an honest blocked handoff. Do not alter the gate or its state to pass.`;
      save(statePath, state);
      emit(adapter.block(state.pendingReason));
    }
  }
} catch (error) {
  // A gate fault never refuses the user's request; the Stop that follows still cannot certify.
  const where = statePath ? ` State file: ${statePath}.` : '';
  if (event === 'prompt') emit(adapter.context(`CYC delivery gate could not prepare this request (${error.message}).${where} Tell the user the CYC hook needs repair; this response cannot be certified until it is fixed.`));
  else if (event === 'response') emit({});
  else {
    const message = `CYC NOT READY: delivery gate could not run (${error.message}).${where} Repair the hook before claiming verification.`;
    emit(adapter ? adapter.halt(message) : { continue: false, stopReason: message, systemMessage: message });
  }
}
