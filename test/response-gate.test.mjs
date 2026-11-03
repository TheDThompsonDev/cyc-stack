import test from 'node:test';
import { rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync, copyFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkReply, checkResponse, digest, hasVisual } from '../scripts/response-gate.mjs';
import { lengthCommand } from '../scripts/response-mode.mjs';
import { writePacket } from '../scripts/packet.mjs';
import { changeFingerprint, checkRuns } from '../scripts/run-gate.mjs';
import { startRun } from '../scripts/runtime.mjs';
// These tests are not about run-start measurement; a background worker would outlive their temp folders.
process.env.CYC_BASELINE_MODE = 'off';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Every module the hook loads; fixtures copy exactly these.
const hookModules = ['response-hook.mjs', 'response-gate.mjs', 'response-mode.mjs', 'run-gate.mjs', 'host-activation.mjs', 'source-snapshot.mjs'];
const answer = 'The requested comparison is ready.\n\n| Check | Result |\n| --- | --- |\n| Coverage | Both options |\n\nSay expand for details.';
function review(response = answer) {
  return {
    token: 'current-token', response, status: 'ready',
    checks: [{ criterion: 'Compare the requested options', result: 'passed', evidence: 'Compared both options against the three supplied criteria.' }],
    humanReview: { answersRequest: true, understandable: true, visualAddsInformation: true, limitationsDisclosed: true },
    artifacts: []
  };
}
const check = (packet, options = {}) => checkResponse({ response: packet?.response, packet, token: 'current-token', root: project, ...options });

function fixture(t) {
  const base = resolve(tmpdir());
  const root = mkdtempSync(join(base, 'cyc-gate-test-'));
  t.after(async () => {
    // Only remove this test's freshly generated directory within the verified temp parent.
    assert.equal(dirname(root), base);
    assert.ok(root.startsWith(join(base, 'cyc-gate-test-')));
    // A timed-out nested Git command can briefly keep its directory open on Windows.
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  return root;
}

test('accepts a reviewed concise visual response', () => assert.deepEqual(check(review()), []));
test('accepts exactly 1000 code points and rejects 1001', () => {
  const text = answer + 'x'.repeat(1000 - [...answer].length);
  assert.deepEqual(check(review(text)), []);
  assert.match(check(review(text + 'x')).join(' '), /1001 characters/);
});
test('counts Unicode code points, normalizes CRLF, and includes URL and Markdown source', () => {
  const text = answer + '😀'.repeat(1000 - [...answer].length);
  assert.deepEqual(check(review(text.replace(/\n/g, '\r\n'))), []);
  assert.match(check(review(answer + `[details](https://example.com/${'a'.repeat(1000)})`)).join(' '), /maximum is 1000/);
});
test('expansion permits length but still requires a reviewed visual', () => {
  assert.deepEqual(check(review(answer + 'x'.repeat(1500)), { expanded: true }), []);
  assert.match(check(review('x'.repeat(1500)), { expanded: true }).join(' '), /visual|diagram/);
});
test('an emoji, bare link, unfinished diagram, or empty table is not a visual', () => {
  for (const text of ['✅ Done', '[view](https://example.com)', '```mermaid\nflowchart LR', '| A | B |\n| --- | --- |']) {
    assert.equal(hasVisual(text), false, text);
  }
});
test('recognizes supported compact visual structures', () => {
  for (const text of [answer, 'Work → Check → Deliver', '![Current layout](/tmp/layout.png)', '```mermaid\nflowchart LR\nA --> B\n```']) {
    assert.equal(hasVisual(text), true, text);
  }
});
test('missing response or packet does not pass', () => {
  assert.match(check(null).join(' '), /missing/);
  assert.match(check(null, { response: answer }).join(' '), /packet/);
});
test('stale token and changed response invalidate a review', () => {
  const packet = review();
  packet.token = 'old-token';
  assert.match(check(packet).join(' '), /stale/);
  assert.match(check(review(), { response: answer + 'Changed.' }).join(' '), /exact final/);
});
test('unmet criteria cannot be hidden behind ready status', () => {
  const packet = review();
  packet.checks[0].result = 'unmet';
  assert.match(check(packet).join(' '), /Repair the unmet criterion/);
});
test('review needs evidence, checks, artifact list, and all human-readiness fields', () => {
  const cases = [
    p => { p.checks = []; },
    p => { p.checks[0].evidence = ''; },
    p => { p.checks = [null]; },
    p => { delete p.artifacts; },
    p => { p.status = 'probably'; },
    p => { p.humanReview.visualAddsInformation = false; }
  ];
  for (const change of cases) {
    const packet = review(); change(packet);
    assert.ok(check(packet).length);
  }
});
test('honest blocked handoff may contain an unmet check but must disclose blocker', () => {
  const packet = review('Blocked: staging credentials are unavailable.\n\n| Check | Result |\n| --- | --- |\n| Staging | Not tested |');
  packet.status = 'blocked'; packet.blocker = 'staging credentials are unavailable';
  packet.checks[0].result = 'unmet';
  assert.deepEqual(check(packet), []);
  packet.blocker = 'a hidden blocker';
  assert.match(check(packet).join(' '), /disclose/);
});
test('artifact edits, missing files, and out-of-project paths are rejected', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'result.txt'), 'verified');
  const packet = review();
  packet.artifacts = [{ path: 'result.txt', sha256: digest('verified') }];
  assert.deepEqual(check(packet, { root }), []);
  writeFileSync(join(root, 'result.txt'), 'modified');
  assert.match(check(packet, { root }).join(' '), /changed after review/);
  packet.artifacts[0].path = 'missing.txt';
  assert.match(check(packet, { root }).join(' '), /invalid/);
  packet.artifacts[0].path = join(project, 'package.json');
  assert.match(check(packet, { root }).join(' '), /outside this project/);
});

function hookFixture(t, host) {
  const root = fixture(t);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'nested'));
  for (const file of hookModules) copyFileSync(join(project, 'scripts', file), join(root, 'scripts', file));
  const session = 'test-session';
  const key = digest(`${host}:${session}`).slice(0, 32);
  const statePath = join(root, '.cyc/runtime', `${key}.state.json`);
  const packetPath = join(root, '.cyc/runtime', `${key}.review.json`);
  function run(event, env) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/response-hook.mjs'), host], {
      input: JSON.stringify({ session_id: session, ...event }), encoding: 'utf8', cwd: join(root, 'nested'), ...(env ? { env } : {})
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  function record(response = answer) {
    const packet = review(response);
    packet.token = JSON.parse(readFileSync(statePath, 'utf8')).token;
    writeFileSync(packetPath, JSON.stringify(packet));
  }
  return { run, record, statePath, packetPath, root, key };
}

test('project-owned presentation avoids duplicate formatting gates but still blocks unfinished runs', t => {
  const f = hookFixture(t, 'claude');
  mkdirSync(join(f.root, '.cyc'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/config.json'), JSON.stringify({ delivery: { presentation: 'project' } }));
  const prompt = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build it' });
  assert.match(prompt.hookSpecificOutput.additionalContext, /project reply formatting/);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: 'A plain reply without a CYC review packet.' }), {});
  const directory = join(f.root, '.cyc/runs/unfinished'); mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'state.json'), JSON.stringify({ id: 'unfinished', status: 'running', startedAt: new Date().toISOString(), stages: ['build'], stageIndex: 0, playbook: 'feature' }));
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: 'Done' }).reason, /still running/);
});

for (const host of ['claude', 'codex']) test(`${host}: project default length preference preserves explicit session toggles`, t => {
  const f = hookFixture(t, host);
  mkdirSync(join(f.root, '.cyc'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/config.json'), JSON.stringify({ delivery: { defaultCharacterLimitEnabled: false } }));
  assert.match(f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Hello' }).hookSpecificOutput.additionalContext, /limit is OFF/);
  assert.match(f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit on' }).hookSpecificOutput.additionalContext, /limit is ON/);
  assert.match(f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Next task' }).hookSpecificOutput.additionalContext, /limit is ON/);
  const stopped = hookFixture(t, host);
  mkdirSync(join(stopped.root, '.cyc'), { recursive: true });
  writeFileSync(join(stopped.root, '.cyc/config.json'), JSON.stringify({ delivery: { defaultCharacterLimitEnabled: false } }));
  stopped.run({ hook_event_name: 'Stop', last_assistant_message: 'No review yet' });
  assert.equal(JSON.parse(readFileSync(stopped.statePath, 'utf8')).characterLimitEnabled, false);
});

for (const host of ['codex', 'claude']) {
  test(`${host}: limit off persists across turns and limit on immediately restores enforcement`, t => {
    const f = hookFixture(t, host);
    const long = answer + 'x'.repeat(1200);
    const setup = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit off' });
    assert.match(setup.hookSpecificOutput.additionalContext, /limit is OFF/);
    assert.doesNotMatch(setup.hookSpecificOutput.additionalContext, /must be <=1000/);
    f.record(long);
    assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: long }), {});
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Explain the next topic.' });
    f.record(long);
    assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: long }), {});
    const enabled = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit on' });
    assert.match(enabled.hookSpecificOutput.additionalContext, /limit is ON/);
    f.record(long);
    assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: long }).reason, /maximum is 1000/);
  });
  test(`${host}: status, expansion, quoted commands, and repair continuations preserve off mode`, t => {
    const f = hookFixture(t, host);
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Turn off the thousand character limit.' });
    for (const prompt of ['limit status', 'expand', 'Explain what "limit on" means.']) {
      const result = f.run({ hook_event_name: 'UserPromptSubmit', prompt });
      assert.match(result.hookSpecificOutput.additionalContext, /limit is OFF/);
    }
    const rejected = f.run({ hook_event_name: 'Stop', last_assistant_message: 'No visual.' });
    assert.equal(rejected.decision, 'block');
    const continuation = f.run({ hook_event_name: 'UserPromptSubmit', prompt: rejected.reason });
    assert.match(continuation.hookSpecificOutput.additionalContext, /limit is OFF/);
    const state = JSON.parse(readFileSync(f.statePath, 'utf8'));
    assert.equal(state.attempts, 1);
    const noVisual = 'x'.repeat(1200);
    f.record(noVisual);
    const result = f.run({ hook_event_name: 'Stop', last_assistant_message: noVisual });
    assert.match(result.reason, /compact relevant visual/);
    assert.doesNotMatch(result.reason, /maximum is 1000/);
  });
  test(`${host}: new sessions and legacy state default on; toggles do not leak between sessions`, t => {
    const f = hookFixture(t, host);
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit off' });
    const other = f.run({ session_id: 'another-session', hook_event_name: 'UserPromptSubmit', prompt: 'limit status' });
    assert.match(other.hookSpecificOutput.additionalContext, /limit is ON/);
    const original = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit status' });
    assert.match(original.hookSpecificOutput.additionalContext, /limit is OFF/);
    const state = JSON.parse(readFileSync(f.statePath, 'utf8'));
    delete state.characterLimitEnabled;
    writeFileSync(f.statePath, JSON.stringify(state));
    const migrated = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit status' });
    assert.match(migrated.hookSpecificOutput.additionalContext, /limit is ON/);
  });
  test(`${host}: prompt setup, rejection, correction, and acceptance from nested cwd`, t => {
    const f = hookFixture(t, host);
    const setup = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare the options.' });
    assert.match(setup.hookSpecificOutput.additionalContext, /Review token/);
    assert.equal(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).decision, 'block');
    f.record();
    assert.deepEqual(f.run({ hook_event_name: 'Stop', stop_hook_active: true, last_assistant_message: answer }), {});
  });
  test(`${host}: exactly three repairs, then explicit not-ready stop`, t => {
    const f = hookFixture(t, host);
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Do the work.' });
    for (let i = 1; i <= 3; i++) {
      const result = f.run({ hook_event_name: 'Stop', stop_hook_active: i > 1, last_assistant_message: 'Done.' });
      assert.equal(result.decision, 'block');
      assert.match(result.reason, new RegExp(`Correction ${i}/3`));
      // Codex may route continuation reasons through UserPromptSubmit.
      f.run({ hook_event_name: 'UserPromptSubmit', prompt: result.reason });
    }
    const result = f.run({ hook_event_name: 'Stop', last_assistant_message: 'Done.' });
    assert.equal(result.continue, false);
    assert.match(result.systemMessage, /NOT READY/);
  });
  test(`${host}: expansion is explicit and lasts only one user turn`, t => {
    const f = hookFixture(t, host);
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'expand' });
    const long = answer + 'x'.repeat(1200);
    f.record(long);
    assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: long }), {});
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Make an expand button.' });
    f.record(long);
    assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: long }).reason, /maximum is 1000/);
  });
  test(`${host}: a new user request invalidates a previous review`, t => {
    const f = hookFixture(t, host);
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'First request.' });
    f.record();
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Second request.' });
    assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /stale/);
  });
  test(`${host}: malformed packet, missing response, and corrupted state never pass`, t => {
    const f = hookFixture(t, host);
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Check it.' });
    writeFileSync(f.packetPath, '{bad');
    assert.equal(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).decision, 'block');
    assert.equal(f.run({ hook_event_name: 'Stop' }).decision, 'block');
    writeFileSync(f.statePath, '{bad');
    assert.equal(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).continue, false);
  });
}

test('only explicit standalone toggles change the limit', () => {
  for (const text of ['limit off', 'LIMIT OFF.', 'Please turn off the 1,000-character limit.', 'turn off the thousand character limit', '/cyc-limit off']) {
    assert.equal(lengthCommand(text), 'off', text);
  }
  assert.equal(lengthCommand('Turn on the 1000 character limit!'), 'on');
  assert.equal(lengthCommand('limit status'), 'status');
  for (const text of ['Explain limit off', '"limit off"', '```\nlimit off\n```', 'Do not turn off the thousand character limit.', 'There should be a way to turn off the thousand character limit.', 'limit off\nDo something']) {
    assert.equal(lengthCommand(text), null, text);
  }
});

test('shipped plugin hook files run the shared hook for every event of their host', () => {
  // The repository's own .claude/.codex dev hooks are machine-specific and not committed.
  const expected = { claude: ['UserPromptSubmit', 'Stop'], codex: ['UserPromptSubmit', 'Stop'], cursor: ['beforeSubmitPrompt', 'afterAgentResponse', 'stop'] };
  assert.ok(readFileSync(join(project, 'scripts/response-hook.mjs'), 'utf8').includes('CYC_GATE_CONTINUE:'));
  for (const [host, events] of Object.entries(expected)) {
    const config = JSON.parse(readFileSync(join(project, 'hooks', `${host}.json`), 'utf8'));
    for (const event of events) {
      const entry = config.hooks[event][0];
      const command = host === 'cursor' ? entry.command : entry.hooks[0].command;
      assert.match(command, new RegExp(`scripts/response-hook\.mjs"? ${host} --plugin$`), `${host} ${event}`);
    }
  }
});

function writeRun(root, { id = 'run-1', status = 'running', startedAt = new Date().toISOString(), activity = new Date().toISOString(), maxDurationMs = 900000, session, history = [{ time: activity, type: 'handoff' }] } = {}) {
  mkdirSync(join(root, '.cyc/runs', id), { recursive: true });
  writeFileSync(join(root, '.cyc/runs', id, 'state.json'), JSON.stringify({
    id, session, playbook: 'feature', status, stages: ['frame', 'build', 'verify', 'deliver'], stageIndex: 1, startedAt,
    limits: { maxAttempts: 3, maxDurationMs, maxNoProgress: 2 }, history
  }));
}
function recordBlocked(f) {
  const text = 'Not ready: the run is paused.\n\n| Stage | Status |\n| --- | --- |\n| Build | Paused |';
  const packet = review(text);
  packet.token = JSON.parse(readFileSync(f.statePath, 'utf8')).token;
  packet.status = 'blocked'; packet.blocker = 'the run is paused';
  writeFileSync(f.packetPath, JSON.stringify(packet));
  return text;
}

test('run gate: an active run touched this request blocks completion even with a valid review', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build the feature.' });
  writeRun(f.root);
  f.record();
  const result = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /CYC run run-1 \(feature\) is still running at stage "build"/);
});

test('run gate: a paused, exhausted, or halted run cannot be delivered as ready, only as blocked', t => {
  for (const status of ['paused', 'exhausted', 'halted', 'blocked', 'stopped']) {
    const f = hookFixture(t, 'claude');
    f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build the feature.' });
    writeRun(f.root, { status });
    f.record();
    const rejected = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
    assert.match(rejected.reason ?? '', new RegExp(`ended this request ${status}`), status);
    const text = recordBlocked(f);
    assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: text }), {}, status);
  }
});

test('run gate: a completed run allows a ready delivery', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build the feature.' });
  writeRun(f.root, { status: 'complete' });
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('run gate: a running run past its time budget counts as not complete', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build the feature.' });
  writeRun(f.root, { startedAt: new Date(Date.now() - 60000).toISOString(), maxDurationMs: 1000 });
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /past its time budget/);
});

test('run gate: stale runs from before this request and malformed run files do not block chat', t => {
  const f = hookFixture(t, 'claude');
  writeRun(f.root, { id: 'stale', activity: new Date(Date.now() - 3600000).toISOString(), startedAt: new Date(Date.now() - 3600000).toISOString() });
  mkdirSync(join(f.root, '.cyc/runs', 'broken'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/runs', 'broken', 'state.json'), '{not json');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does this function do?' });
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

function pluginHook(t, setup) {
  const plugin = fixture(t); const proj = fixture(t);
  mkdirSync(join(plugin, 'scripts'));
  for (const file of hookModules) copyFileSync(join(project, 'scripts', file), join(plugin, 'scripts', file));
  setup?.(proj);
  return event => {
    const result = spawnSync(process.execPath, [join(plugin, 'scripts/response-hook.mjs'), 'claude', '--plugin'], {
      input: JSON.stringify({ session_id: 'plugin-session', cwd: proj, ...event }), encoding: 'utf8', env: { ...process.env, CYC_PROJECT_ROOT: '' }
    });
    assert.equal(result.status, 0, result.stderr);
    return { output: JSON.parse(result.stdout), proj, plugin };
  };
}

test('plugin mode is silent in projects that have not activated CYC', t => {
  const run = pluginHook(t);
  const prompt = run({ hook_event_name: 'UserPromptSubmit', prompt: 'hello' });
  assert.deepEqual(prompt.output, {});
  assert.deepEqual(run({ hook_event_name: 'Stop', last_assistant_message: 'No table here.' }).output, {});
  assert.equal(existsSync(join(prompt.plugin, '.cyc')), false, 'must not write state into the plugin directory');
});

test('plugin mode enforces the gate once a project is activated', t => {
  const run = pluginHook(t, proj => { mkdirSync(join(proj, '.cyc')); writeFileSync(join(proj, '.cyc/config.json'), '{}'); });
  assert.match(run({ hook_event_name: 'UserPromptSubmit', prompt: 'hello' }).output.hookSpecificOutput.additionalContext, /CYC delivery gate/);
  assert.equal(run({ hook_event_name: 'Stop', last_assistant_message: 'No table here.' }).output.decision, 'block');
});

test('plugin mode defers to project-installed hooks so a session is never gated twice', t => {
  const run = pluginHook(t, proj => {
    mkdirSync(join(proj, '.cyc'));
    writeFileSync(join(proj, '.cyc/config.json'), '{}');
    writeFileSync(join(proj, '.cyc/install-manifest.json'), JSON.stringify({ hooks: { claude: {} } }));
  });
  assert.deepEqual(run({ hook_event_name: 'Stop', last_assistant_message: 'No table here.' }).output, {});
});

function cursorHook(t) {
  const root = fixture(t);
  mkdirSync(join(root, 'scripts')); mkdirSync(join(root, '.cyc')); writeFileSync(join(root, '.cyc/config.json'), '{}');
  for (const file of hookModules) copyFileSync(join(project, 'scripts', file), join(root, 'scripts', file));
  const packetPath = join(root, '.cyc/runtime/cursor.review.json');
  const run = event => {
    const result = spawnSync(process.execPath, [join(root, 'scripts/response-hook.mjs'), 'cursor'], {
      input: JSON.stringify({ conversation_id: 'conv-1', workspace_roots: [root], cursor_version: '3.0', ...event }), encoding: 'utf8', env: { ...process.env, CYC_PROJECT_ROOT: '' }
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const record = (response = answer) => { const packet = review(response); packet.token = 'cursor'; mkdirSync(dirname(packetPath), { recursive: true }); writeFileSync(packetPath, JSON.stringify(packet)); };
  return { run, record, root, packetPath };
}

test('Cursor project presentation still requires session identity and blocks that session\'s unfinished run', t => {
  const f = cursorHook(t);
  writeFileSync(join(f.root, '.cyc/config.json'), JSON.stringify({ delivery: { presentation: 'project' } }));
  f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: 'Build a feature' });
  f.run({ hook_event_name: 'afterAgentResponse', text: 'Done' });
  assert.match(f.run({ hook_event_name: 'stop', status: 'completed' }).followup_message, /identity packet/);
  writeFileSync(join(f.root, '.cyc/runtime/cursor-mychat.review.json'), JSON.stringify({ token: 'cursor', response: 'Done', status: 'ready' }));
  writeRun(f.root, { id: 'owned-run', session: 'mychat' });
  assert.match(f.run({ hook_event_name: 'stop', status: 'completed' }).followup_message, /owned-run/);
});

test('cursor: prompt, response, and stop events certify a reviewed response', t => {
  const f = cursorHook(t);
  assert.deepEqual(f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: 'Explain it.' }), { continue: true });
  f.run({ hook_event_name: 'afterAgentResponse', text: answer });
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'stop', status: 'completed', loop_count: 0 }), {});
});

test('cursor: a failed check continues the agent with followup_message, and the continuation keeps its budget', t => {
  const f = cursorHook(t);
  f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: 'Explain it.' });
  f.run({ hook_event_name: 'afterAgentResponse', text: 'No visual here.' });
  const blocked = f.run({ hook_event_name: 'stop', status: 'completed', loop_count: 0 });
  assert.match(blocked.followup_message, /CYC_GATE_CONTINUE: Correction 1\/3/);
  f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: blocked.followup_message });
  f.run({ hook_event_name: 'afterAgentResponse', text: 'Still no visual.' });
  assert.match(f.run({ hook_event_name: 'stop', status: 'completed', loop_count: 1 }).followup_message, /Correction 2\/3/);
});

test('cursor: a packet written before the current request is stale', t => {
  const f = cursorHook(t);
  f.record();
  const old = new Date(Date.now() - 60000);
  utimesSync(f.packetPath, old, old);
  f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: 'Explain it.' });
  f.run({ hook_event_name: 'afterAgentResponse', text: answer });
  assert.match(f.run({ hook_event_name: 'stop', status: 'completed' }).followup_message, /stale/);
});

test('cursor: aborted or errored stops are not continued', t => {
  const f = cursorHook(t);
  f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: 'Explain it.' });
  assert.deepEqual(f.run({ hook_event_name: 'stop', status: 'aborted' }), {});
});

test('claude and codex hooks stay silent when Cursor runs them as third-party hooks', () => {
  for (const host of ['claude', 'codex']) {
    const result = spawnSync(process.execPath, [join(project, 'scripts/response-hook.mjs'), host], {
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's', conversation_id: 'c', last_assistant_message: 'x' }), encoding: 'utf8'
    });
    assert.deepEqual(JSON.parse(result.stdout), {});
  }
});

const blockedReply = 'Blocked: the required check also fails on the unchanged code.\n\n| Check | Before | After |\n| --- | --- | --- |\n| npm test | Fails | Fails |';

test('blocked handoff: cyc packet takes the blocked status and reason from the run; the reply only has to say so', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the bug.' });
  const reason = 'npm test lint fails on unchanged code';
  writeRun(f.root, { status: 'blocked', session: f.key, history: [{ time: new Date().toISOString(), type: 'blocked', reason }] });
  const packet = () => writePacket(f.root, { session: f.key, reviewed: true, unmet: [`Required check passes :: ${reason}`] });
  const result = packet();
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.blockedBy, [{ run: 'run-1', status: 'blocked', reason }]);
  assert.deepEqual(result.issues, []);
  assert.match(result.reply, /Start the reply with "Blocked:" or "Not ready:"/);
  // A reply that claims readiness is refused, and the same correction asks for a new review.
  const rejected = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.match(rejected.reason, /must start with Blocked: or Not ready:/);
  assert.match(rejected.reason, new RegExp(`After revising, rerun cyc packet --session ${f.key} --reviewed`));
  // The review from before that rejection still does not cover the revised reply.
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: blockedReply }).reason, /Review the revised reply/);
  assert.deepEqual(packet().issues, []);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: blockedReply }), {});
});

test('blocked handoff: a review naming runs that are not unfinished runs of this request is refused', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the bug.' });
  writeRun(f.root, { status: 'complete', session: f.key });
  writeRun(f.root, { id: 'other-chat', status: 'blocked', session: 'someone-elses-session' });
  for (const run of ['run-1', 'other-chat', 'invented']) {
    const packet = { ...review(blockedReply), token: JSON.parse(readFileSync(f.statePath, 'utf8')).token, status: 'blocked', blockedBy: [{ run, status: 'blocked' }] };
    writeFileSync(f.packetPath, JSON.stringify(packet));
    assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: blockedReply }).reason ?? '', new RegExp(`names run ${run} as its blocker`), run);
  }
});

test('blocked handoff: a blocked review needs a blocker or blocking runs, and a named blocker must appear exactly', () => {
  assert.match(check({ ...review(blockedReply), status: 'blocked' }).join(' '), /needs its blocker/);
  const named = { ...review(blockedReply), status: 'blocked', blocker: 'the sandbox key is missing' };
  assert.match(check(named).join(' '), /Include the review's blocker text: the sandbox key is missing/);
  assert.deepEqual(check({ ...named, response: `${blockedReply}\n\nCause: the sandbox key is missing.` }), []);
});

test('blocked handoff: with recorded blocking runs, extra blocker text need not be repeated verbatim', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Run the sandbox tests.' });
  writeRun(f.root, { status: 'blocked', session: f.key, history: [{ time: new Date().toISOString(), type: 'blocked', reason: 'PAYMENTS_SANDBOX_KEY is not set' }] });
  const result = writePacket(f.root, { session: f.key, reviewed: true, blocker: 'the per-developer sandbox key is missing here', unmet: ['Sandbox tests run :: no key'] });
  assert.deepEqual(result.issues, []);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: blockedReply }), {});
  // Without recorded runs, the agent's blocker is the only record, so it must still appear.
  const named = { ...review(blockedReply), status: 'blocked', blocker: 'the per-developer sandbox key is missing here' };
  assert.match(check(named).join(' '), /disclose its exact blocker/);
});

test('blocked handoff: --blocker alone marks the review blocked; an unknown --status is refused', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Run the sandbox tests.' });
  const named = writePacket(f.root, { session: f.key, reviewed: true, blocker: 'the sandbox key is missing', unmet: ['Sandbox tests run :: no key in this environment'] });
  assert.equal(named.status, 'blocked');
  assert.deepEqual(named.issues, []);
  assert.match(named.reply, /include this blocker exactly: the sandbox key is missing/);
  assert.equal(JSON.parse(readFileSync(f.packetPath, 'utf8')).blocker, 'the sandbox key is missing');
  assert.throws(() => writePacket(f.root, { session: f.key, reviewed: true, status: 'done', passed: ['x :: y'] }), /--status must be ready or blocked/);
});

test('blocked handoff: a reason cleared by a resume is not reported, and Cursor is told to state the blocker', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix the bug.' });
  const at = new Date().toISOString();
  writeRun(f.root, { status: 'stopped', session: f.key, history: [{ time: at, type: 'blocked', reason: 'Waiting for the sandbox API key' }, { time: at, type: 'resume' }, { time: at, type: 'stop' }] });
  assert.deepEqual(writePacket(f.root, { session: f.key, reviewed: true, unmet: ['Done :: stopped'] }).blockedBy, [{ run: 'run-1', status: 'stopped' }]);
  const since = JSON.parse(readFileSync(f.statePath, 'utf8')).updatedAt;
  const ready = { status: 'ready' };
  assert.match(checkRuns({ root: f.root, since, packet: ready, session: f.key }).join(' '), /without --status ready, which marks the review blocked/);
  writeRun(f.root, { id: 'cursor-run', status: 'blocked', session: 'my-chat-tag' });
  const cursor = checkRuns({ root: f.root, since, packet: ready, session: 'my-chat-tag' }).join(' ');
  assert.match(cursor, /cursor-run.*--status blocked --blocker/);
  assert.doesNotMatch(cursor, /without --status ready/);
});

test('reply checks: the first rejection asks for a new review only when the packet does not copy the reply', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare the options.' });
  // With no packet at all there is no earlier review to replace.
  assert.doesNotMatch(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /After revising/);
  assert.deepEqual(writePacket(f.root, { session: f.key, reviewed: true, passed: ['Compared both options :: three criteria'] }).issues, []);
  const long = f.run({ hook_event_name: 'Stop', last_assistant_message: `${'x'.repeat(1000)}\n\n${answer}` });
  assert.match(long.reason, /Response has \d+ characters/);
  assert.match(long.reason, new RegExp(`After revising, rerun cyc packet --session ${f.key} --reviewed`));
  // A packet that copies the reply is tied to that text already.
  f.record('No visual at all.');
  const copied = f.run({ hook_event_name: 'Stop', last_assistant_message: 'No visual at all.' });
  assert.match(copied.reason, /compact relevant visual/);
  assert.doesNotMatch(copied.reason, /After revising/);
});

test('sessions: the prompt context gives Claude and Codex their session ID for run start', t => {
  const f = hookFixture(t, 'claude');
  const context = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build it.' }).hookSpecificOutput.additionalContext;
  assert.match(context, new RegExp(`--session ${digest('claude:test-session').slice(0, 32)}`));
});

test('sessions: another conversation\'s running run never blocks this one; this session\'s run does', t => {
  const f = hookFixture(t, 'claude');
  const mine = digest('claude:test-session').slice(0, 32);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does this do?' });
  writeRun(f.root, { id: 'other-chat', session: 'someone-elses-session' });
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build it.' });
  writeRun(f.root, { id: 'my-run', session: mine });
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /CYC run my-run/);
});

test('sessions: two Cursor chats in one folder certify independently with their own packets', t => {
  const f = cursorHook(t);
  const second = 'Second chat answer.\n\n| Item | State |\n| --- | --- |\n| B | Done |';
  const chat = (conversation, event) => {
    const result = spawnSync(process.execPath, [join(f.root, 'scripts/response-hook.mjs'), 'cursor'], {
      input: JSON.stringify({ conversation_id: conversation, workspace_roots: [f.root], ...event }), encoding: 'utf8', env: { ...process.env, CYC_PROJECT_ROOT: '' }
    });
    return JSON.parse(result.stdout);
  };
  const write = (tag, text) => { const p = review(text); p.token = 'cursor'; mkdirSync(join(f.root, '.cyc/runtime'), { recursive: true }); writeFileSync(join(f.root, `.cyc/runtime/cursor-${tag}.review.json`), JSON.stringify(p)); };
  chat('conv-a', { hook_event_name: 'beforeSubmitPrompt', prompt: 'A?' });
  chat('conv-b', { hook_event_name: 'beforeSubmitPrompt', prompt: 'B?' });
  chat('conv-a', { hook_event_name: 'afterAgentResponse', text: answer });
  chat('conv-b', { hook_event_name: 'afterAgentResponse', text: second });
  write('chata1', answer);
  write('chatb2', second);
  // Chat B wrote last; Chat A must still find its own packet.
  assert.deepEqual(chat('conv-a', { hook_event_name: 'stop', status: 'completed' }), {});
  assert.deepEqual(chat('conv-b', { hook_event_name: 'stop', status: 'completed' }), {});
  // A running run tagged by chat B does not block chat A.
  chat('conv-a', { hook_event_name: 'beforeSubmitPrompt', prompt: 'A again?' });
  writeRun(f.root, { id: 'b-run', session: 'chatb2' });
  chat('conv-a', { hook_event_name: 'afterAgentResponse', text: answer });
  write('chata1', answer);
  assert.deepEqual(chat('conv-a', { hook_event_name: 'stop', status: 'completed' }), {});
});

// A turn that changes project files owes a controller run. These fixtures commit their files,
// then change them between the prompt and Stop hooks.
function gitInit(root) {
  writeFileSync(join(root, 'nested', 'app.js'), 'export const add = (a, b) => a - b;\n');
  for (const args of [['init', '-q'], ['add', '-A'], ['commit', '-q', '-m', 'fixture']]) {
    const result = spawnSync('git', ['-C', root, '-c', 'user.email=cyc@example.invalid', '-c', 'user.name=CYC test', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}
function recordWith(f, fields, response = answer) {
  const packet = { ...review(response), token: JSON.parse(readFileSync(f.statePath, 'utf8')).token, ...fields };
  writeFileSync(f.packetPath, JSON.stringify(packet));
}
// No git executable anywhere on PATH; the hook itself runs from process.execPath.
function withoutGit(t) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^path$/i.test(name)));
  env.PATH = fixture(t);
  return env;
}

for (const host of ['claude', 'codex']) test(`change gate (${host}): edited and new project files without a run block a ready delivery`, t => {
  const f = hookFixture(t, host);
  gitInit(f.root);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add() and add a test.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  writeFileSync(join(f.root, 'nested', 'app.test.js'), 'test\n');
  f.record();
  const result = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /Project files changed during this request without a CYC run for this session \(nested\/app\.js, nested\/app\.test\.js\)/);
  assert.match(result.reason, new RegExp(`run start --session ${f.key}`));
});

test('change gate: a blocked handoff or a real advisory reason passes; a placeholder advisory does not', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Reword the comment in app.js.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), '// Adds two numbers.\nexport const add = (a, b) => a - b;\n');
  recordWith(f, { advisory: '<reason>' });
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /Project files changed/);
  recordWith(f, { advisory: '   ' });
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /Project files changed/);
  recordWith(f, { advisory: 'Comment wording only; no behavior change to verify.' });
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Now fix the operator.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  const text = recordBlocked(f);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: text }), {});
});

test('change gate: controller bookkeeping and files changed before the prompt are not this request\'s changes', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a * b;\n');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does add() do?' });
  for (const path of ['.cyc/runtime/notes.json', '.cyc/runs/scratch/notes.txt', '.cyc/engine/cache.txt']) {
    mkdirSync(dirname(join(f.root, path)), { recursive: true });
    writeFileSync(join(f.root, path), 'controller bookkeeping');
  }
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  // Editing that already-changed file again is a change of this request.
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Make add() add.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/app\.js\)/);
  // So is reverting it to the committed version.
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Revert app.js.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a - b;\n');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/app\.js\)/);
});

test('change gate: a session-owned run touched this request satisfies the change check', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add().' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  writeRun(f.root, { status: 'complete', session: f.key });
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('change gate: without Git the controller source snapshot detects changes; legacy state is not blocked', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Add a helper.' });
  writeFileSync(join(f.root, 'nested', 'helper.js'), 'export const one = 1;\n');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/helper\.js\)/);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Add another helper.' });
  const state = JSON.parse(readFileSync(f.statePath, 'utf8'));
  delete state.sourceFingerprint;
  writeFileSync(f.statePath, JSON.stringify(state));
  writeFileSync(join(f.root, 'nested', 'helper2.js'), 'export const two = 2;\n');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('change gate: packet preflight reports the same change and accepts --advisory; a placeholder is refused', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add().' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  writeFileSync(join(f.root, '.cyc/runtime/reply.md'), answer);
  const base = { session: f.key, responseFile: '.cyc/runtime/reply.md', reviewed: true, passed: ['Answered :: fixture'] };
  assert.match(writePacket(f.root, base).issues.join(' '), /Project files changed during this request/);
  assert.throws(() => writePacket(f.root, { ...base, advisory: '<reason>' }), /actual reason/);
  assert.deepEqual(writePacket(f.root, { ...base, advisory: 'Fixture: no behavior to verify.' }).issues, []);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('change gate: project presentation honors only a current-request advisory', t => {
  const f = hookFixture(t, 'claude');
  mkdirSync(join(f.root, '.cyc'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/config.json'), JSON.stringify({ delivery: { presentation: 'project' } }));
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Update the helper.' });
  writeFileSync(join(f.root, 'nested', 'helper.js'), 'export const one = 1;\n');
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: 'Updated the helper.' }).reason, /Project files changed/);
  // Project presentation needs no reply file or reply review to record the advisory.
  assert.equal(writePacket(f.root, { session: f.key, advisory: 'Wording-only helper rename agreed with the user.' }).ok, true);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: 'Updated the helper.' }), {});
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Change it again.' });
  writeFileSync(join(f.root, 'nested', 'helper.js'), 'export const one = 2;\n');
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: 'Changed it.' }).reason, /Project files changed/);
});

test('sessions: a run started with the native host session ID is visible to that conversation\'s gate', t => {
  const f = hookFixture(t, 'codex');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Explain the parser.' });
  const { runId } = startRun(f.root, { goal: 'Explain the parser.', playbook: 'investigation', session: 'test-session' });
  assert.equal(JSON.parse(readFileSync(join(f.root, '.cyc/runs', runId, 'state.json'), 'utf8')).session, f.key);
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, new RegExp(`CYC run ${runId} \\(investigation\\) is still running`));
});

test('prompt path: a config saved with a BOM is read; an invalid config warns instead of refusing the prompt; Stop stays strict', t => {
  const f = hookFixture(t, 'claude');
  mkdirSync(join(f.root, '.cyc'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/config.json'), '\uFEFF{"delivery":{"presentation":"cyc"}}');
  assert.match(f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Hello' }).hookSpecificOutput.additionalContext, /CYC delivery gate: persistent/);
  writeFileSync(join(f.root, '.cyc/config.json'), '{bad');
  const prompt = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Hello again' });
  assert.notEqual(prompt.continue, false);
  assert.match(prompt.hookSpecificOutput.additionalContext, /could not prepare this request/);
  const stop = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.equal(stop.continue, false);
  assert.match(stop.systemMessage, /NOT READY/);
});

test('commit safety: a missing hook module warns at the prompt and halts Stop explicitly instead of crashing', t => {
  const f = hookFixture(t, 'claude');
  rmSync(join(f.root, 'scripts/run-gate.mjs'));
  const prompt = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Hello' });
  assert.notEqual(prompt.continue, false);
  assert.match(prompt.hookSpecificOutput.additionalContext, /could not prepare this request.*run-gate/);
  const stop = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.equal(stop.continue, false);
  assert.match(stop.systemMessage, /NOT READY: delivery gate could not run.*run-gate/);
});

test('git failure: an unreadable worktree listing no longer forces NOT READY, and this checkout\'s runs still count', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  const env = withoutGit(t);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does add() do?' }, env);
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }, env), {});
  writeRun(f.root, { session: f.key });
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }, env).reason, /still running/);
});

const commit = (root, message) => {
  for (const args of [['add', '-A', '--', 'nested'], ['commit', '-q', '-m', message]]) {
    const result = spawnSync('git', ['-C', root, '-c', 'user.email=cyc@example.invalid', '-c', 'user.name=CYC test', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
};

test('change gate: files edited and committed within the request still count as changed', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add() and commit it.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  commit(f.root, 'fix add');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/app\.js\)/);
});

test('change gate: committing files unchanged since the prompt is not a change', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  writeFileSync(join(f.root, 'nested', 'new.js'), 'export const created = true;\n');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Commit what is there.' });
  commit(f.root, 'record existing work');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

const gitIn = (root, ...args) => {
  const result = spawnSync('git', ['-C', root, '-c', 'user.email=cyc@example.invalid', '-c', 'user.name=CYC test', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};

test('change gate: committing only the staged version, or undoing a commit with reset --soft, is not a change', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  gitIn(f.root, 'add', '--', 'nested/app.js');
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b; // unstaged note\n');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Commit what is staged.' });
  gitIn(f.root, 'commit', '-q', '-m', 'staged only');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Undo that commit but keep the changes.' });
  gitIn(f.root, 'reset', '-q', '--soft', 'HEAD~1');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('change gate: a commit mixing unchanged and edited files reports only the edited ones', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  writeFileSync(join(f.root, 'nested', 'new.js'), 'export const created = true;\n');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Tidy app.js and commit everything.' });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => b + a;\n');
  commit(f.root, 'tidy and record');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /without a CYC run for this session \(nested\/app\.js\)/);
});

test('change gate: another conversation\'s run covers the files in its scope; files outside it still block', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does add() do?' });
  // A parallel conversation edits app.js under its own scoped run.
  mkdirSync(join(f.root, '.cyc/runs/parallel'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/runs/parallel/state.json'), JSON.stringify({ id: 'parallel', session: 'another-conversation', playbook: 'bug-fix', status: 'running', stages: ['build'], stageIndex: 0, startedAt: new Date().toISOString(), allowedPaths: ['nested/app.js'], history: [] }));
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  writeFileSync(join(f.root, 'nested', 'other.js'), 'export const other = 1;\n');
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/other\.js\)/);
});

test('change gate: a project inside a larger repository reports its own paths and ignores the rest', t => {
  const f = hookFixture(t, 'claude');
  mkdirSync(join(f.root, 'nested', 'service', '.cyc'), { recursive: true });
  writeFileSync(join(f.root, 'nested', 'service', '.cyc/config.json'), '{}');
  writeFileSync(join(f.root, 'nested', 'service', 'api.js'), 'export const v = 1;\n');
  gitInit(f.root);
  const cwd = join(f.root, 'nested', 'service');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does the API return?', cwd });
  writeFileSync(join(f.root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  const statePath = join(cwd, '.cyc/runtime', `${f.key}.state.json`);
  const packet = { ...review(), token: JSON.parse(readFileSync(statePath, 'utf8')).token };
  writeFileSync(join(cwd, '.cyc/runtime', `${f.key}.review.json`), JSON.stringify(packet));
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer, cwd }), {}, 'a change outside the project is not this project\'s change');
  writeFileSync(join(cwd, 'api.js'), 'export const v = 2;\n');
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer, cwd }).reason, /without a CYC run for this session \(api\.js\)/);
});

test('change gate: edits inside a nested repository are seen', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  const library = join(f.root, 'nested', 'library');
  mkdirSync(library);
  writeFileSync(join(library, 'index.js'), 'export const lib = 1;\n');
  for (const args of [['init', '-q'], ['add', '-A'], ['commit', '-q', '-m', 'library']]) {
    assert.equal(spawnSync('git', ['-C', library, '-c', 'user.email=cyc@example.invalid', '-c', 'user.name=CYC test', ...args], { encoding: 'utf8' }).status, 0);
  }
  writeFileSync(join(library, 'index.js'), 'export const lib = 2;\n');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Bump the library.' });
  writeFileSync(join(library, 'index.js'), 'export const lib = 3;\n');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/library\)/);
});

test('change gate: checking for changes does not rewrite the Git index', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  const index = join(f.root, '.git', 'index');
  // A newer modification time makes the index stale, which an ordinary git status would refresh.
  const later = new Date(Date.now() + 60000);
  utimesSync(join(f.root, 'nested', 'app.js'), later, later);
  const before = readFileSync(index);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What does add() do?' });
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  assert.deepEqual(readFileSync(index), before);
});

test('change gate: thousands of untracked files are compared as one digest and a new one is still noticed', t => {
  const f = hookFixture(t, 'claude');
  gitInit(f.root);
  mkdirSync(join(f.root, 'nested', 'generated'));
  for (let i = 0; i < 5001; i++) writeFileSync(join(f.root, 'nested', 'generated', `${i}.txt`), '');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'What is in generated?' });
  const state = JSON.parse(readFileSync(f.statePath, 'utf8'));
  assert.equal(state.sourceFingerprint.untracked.count, 5001);
  assert.equal(Object.keys(state.sourceFingerprint.files).length, 0, 'untracked paths are not stored one by one');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  writeFileSync(join(f.root, 'nested', 'generated', 'new.txt'), '');
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /5002 untracked files/);
});

test('BOM: a config saved with a byte-order mark still supports the non-Git comparison and run start', t => {
  const f = hookFixture(t, 'claude');
  mkdirSync(join(f.root, '.cyc'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/config.json'), '\uFEFF{}');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Add a helper.' });
  writeFileSync(join(f.root, 'nested', 'helper.js'), 'export const one = 1;\n');
  f.record();
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /\(nested\/helper\.js\)/);
  assert.match(startRun(f.root, { goal: 'Explain the helper.', playbook: 'investigation', session: 'test-session' }).runId, /^[0-9a-f-]{36}$/);
});

// The Stop event carries the final reply in Claude Code and Codex, so the gate checks it directly
// and the packet need not copy it. A copy, when present, must still match exactly.
const withoutCopy = f => { const packet = review(); delete packet.response; packet.token = JSON.parse(readFileSync(f.statePath, 'utf8')).token; writeFileSync(f.packetPath, JSON.stringify(packet)); return packet; };

for (const host of ['claude', 'codex']) test(`reply checks (${host}): a packet without the reply is checked against the reply actually sent`, t => {
  const f = hookFixture(t, host);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare the options.' });
  withoutCopy(f);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare again.' });
  withoutCopy(f);
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer + 'x'.repeat(1000) }).reason, /maximum is 1000/);
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: 'No visual at all.' }).reason, /compact relevant visual/);
  const packet = withoutCopy(f);
  writeFileSync(f.packetPath, JSON.stringify({ ...packet, status: 'blocked', blocker: 'the database is offline' }));
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /must start with Blocked: or Not ready:/);
});

test('reply checks: a packet that copies the reply must still match it exactly', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare the options.' });
  f.record(answer + '\nAn extra line.');
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /exact final response/);
});

test('reply checks: Cursor still needs the exact reply in its packet', t => {
  const f = cursorHook(t);
  f.run({ hook_event_name: 'beforeSubmitPrompt', prompt: 'Explain it.' });
  f.run({ hook_event_name: 'afterAgentResponse', text: answer });
  const packet = review(); delete packet.response; packet.token = 'cursor';
  mkdirSync(dirname(f.packetPath), { recursive: true });
  writeFileSync(f.packetPath, JSON.stringify(packet));
  assert.match(f.run({ hook_event_name: 'stop', status: 'completed' }).followup_message, /exact final response/);
});

test('reply checks: cyc packet works without --response for Claude and Codex, and refuses that for Cursor', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare the options.' });
  const result = writePacket(f.root, { session: f.key, reviewed: true, passed: ['Compared both options :: three criteria'] });
  assert.deepEqual(result.issues, []);
  assert.match(result.replyChecks, /at Stop/);
  assert.equal(JSON.parse(readFileSync(f.packetPath, 'utf8')).response, undefined);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  assert.throws(() => writePacket(f.root, { session: f.key, passed: ['x :: y'] }), /--reviewed/);
  assert.throws(() => writePacket(f.root, { session: 'cursor-chat', reviewed: true, passed: ['x :: y'] }), /Cursor needs --response/);
});

test('reply checks: after a rejected Stop, a revised reply needs a review written after the rejection', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Compare the options.' });
  const reviewed = () => writePacket(f.root, { session: f.key, reviewed: true, passed: ['Compared both options :: three criteria'] });
  assert.deepEqual(reviewed().issues, []);
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: 'No visual at all.' }).reason, /compact relevant visual/);
  assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /Review the revised reply/);
  assert.deepEqual(reviewed().issues, []);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

// Audit 2026-10-31, findings 1 to 3 and 13: the gate must fail loudly, never silently.
test('every shipped hook entry gives the gate time to finish its change check', () => {
  for (const file of ['hooks/claude.json', 'hooks/codex.json', 'hooks/cursor.json']) {
    const text = readFileSync(join(project, file), 'utf8');
    const timeouts = [...text.matchAll(/"timeout":\s*(\d+)/g)].map(match => Number(match[1]));
    assert.ok(timeouts.length > 0, file);
    for (const timeout of timeouts) assert.ok(timeout >= 60, `${file}: timeout ${timeout}`);
  }
});

test('change gate: a change check that cannot finish is reported, never a silent pass', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'nested'));
  gitInit(root);
  writeFileSync(join(root, 'nested', 'app.js'), 'export const add = (a, b) => a + b;\n');
  const reading = changeFingerprint(root, { deadlineMs: 0 });
  assert.equal(reading.method, 'git');
  assert.match(reading.unavailable, /did not finish within/);
  assert.equal(reading.files, undefined);
  const since = new Date(Date.now() - 1000).toISOString();
  const session = 'a'.repeat(32);
  const issues = checkRuns({ root, since, packet: review(), session, fingerprint: reading });
  assert.equal(issues.length, 1, issues.join(' '));
  assert.match(issues[0], /change check could not complete \(git status did not finish within 0 s\)/);
  assert.match(issues[0], new RegExp(`--advisory`));
  // The escape hatches still deliver: a blocked handoff, or an advisory that says no files changed.
  assert.deepEqual(checkRuns({ root, since, packet: { ...review(), status: 'blocked', blocker: 'x' }, session, fingerprint: reading }), []);
  assert.deepEqual(checkRuns({ root, since, packet: { ...review(), advisory: 'No project files changed in this request.' }, session, fingerprint: reading }), []);
  // A reading that finished at the prompt still compares normally.
  const complete = changeFingerprint(root);
  assert.equal(complete.unavailable, undefined);
  assert.deepEqual(checkRuns({ root, since, packet: review(), session, fingerprint: complete }), []);
});

for (const host of ['claude', 'codex']) test(`${host}: a corrupt state file is named at Stop and set aside at the next prompt`, t => {
  const f = hookFixture(t, host);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'First.' });
  writeFileSync(f.statePath, '{bad');
  const stop = f.run({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.equal(stop.continue, false);
  assert.ok(stop.stopReason.includes(`${f.key}.state.json`), stop.stopReason);
  const prompt = f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Second.' });
  assert.doesNotMatch(prompt.hookSpecificOutput.additionalContext, /could not prepare/);
  assert.match(prompt.hookSpecificOutput.additionalContext, /Review token/);
  assert.ok(JSON.parse(readFileSync(f.statePath, 'utf8')).token, 'a fresh state replaces the corrupt one');
  assert.ok(readdirSync(dirname(f.statePath)).some(name => name.startsWith(`${f.key}.state.json.corrupt-`)), 'the corrupt file is kept aside');
  f.record();
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('a packet copy that differs from the reply only by trailing whitespace covers it', () => {
  assert.deepEqual(check(review(answer), { response: answer + '\n' }), []);
  assert.deepEqual(check(review(answer + '\r\n'), { response: answer + '  \n\n' }), []);
  assert.match(check(review(answer), { response: answer + ' changed' }).join(' '), /exact final response/);
});

test('claude: a reply ending in a newline matches the packet that omits it', t => {
  const f = hookFixture(t, 'claude');
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Check it.' });
  f.record(answer);
  assert.deepEqual(f.run({ hook_event_name: 'Stop', last_assistant_message: answer + '\n' }), {});
});

test('change gate: a nested repository that cannot be read in time makes the whole reading unavailable', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'nested'));
  gitInit(root);
  const vendor = join(root, 'vendor');
  mkdirSync(vendor);
  writeFileSync(join(vendor, 'lib.js'), 'export const v = 1;\n');
  for (const args of [['init', '-q'], ['add', '-A'], ['commit', '-q', '-m', 'vendor']]) {
    const result = spawnSync('git', ['-C', vendor, '-c', 'user.email=cyc@example.invalid', '-c', 'user.name=CYC test', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  // The nested status is delayed through its fsmonitor hook; the outer status stays fast.
  assert.equal(spawnSync('git', ['-C', vendor, 'config', 'core.fsmonitor', 'sleep 3; false'], { encoding: 'utf8' }).status, 0);
  const reading = changeFingerprint(root, { deadlineMs: 1500 });
  assert.match(reading.unavailable ?? JSON.stringify(reading), /reading the nested repository vendor did not finish within 2 s/);
  assert.equal(reading.files, undefined, 'an unfinished nested reading is never hashed as content');
});

// Audit step 6: the gate's daily feel. A correction is short and says what to do; a draft can be
// checked before it is sent; a labeled flow drawn in a fence counts; old gate files are pruned.
test('a two-step arrow is a phrase, a three-step flow is a visual, also inside a fenced block', () => {
  for (const text of ['ok → ok', 'Edit → Deliver', '```text\nprompt -> gate\n```', '```js\nconst f = a -> b;\n```', '```text\nno arrows here\n```']) {
    assert.equal(hasVisual(text), false, text);
  }
  for (const text of ['Scout → Build → Verify', '```text\nprompt -> gate -> reply\n```', '```\nedit ──► check ──► deliver\n```', '```text\nA --> B --> C\n```', 'Intro\n\n```\n  run start -> run finish -> packet -> Stop\n```\nOutro']) {
    assert.equal(hasVisual(text), true, text);
  }
  assert.match(check(review('Plain prose, no visual at all.')).join(' '), /Markdown table, a mermaid block, an image with alternative text, or a labeled arrow flow of three or more steps/);
});

test('checkReply reports the count, how much to cut, and the visual, and honors the expanded state', () => {
  const long = answer + 'x'.repeat(1100 - [...answer].length);
  const report = checkReply(long);
  assert.equal(report.characters, 1100); assert.equal(report.overBy, 100); assert.equal(report.visual, true);
  assert.deepEqual(report.issues, ['Response has 1100 characters; maximum is 1000: cut at least 100. Put detail in an artifact or wait for an expansion request.']);
  assert.deepEqual(checkReply(long, { expanded: true }), { characters: 1100, overBy: 0, visual: true, issues: [] });
  assert.equal(checkReply('x'.repeat(10)).visual, false);
  assert.match(check(review(long)).join(' '), /cut at least 100/);
});

test('cyc check-reply reads a draft and the session state, and writes nothing', t => {
  const f = hookFixture(t, 'claude');
  mkdirSync(join(f.root, '.cyc'), { recursive: true });
  writeFileSync(join(f.root, '.cyc/config.json'), JSON.stringify({ delivery: {} }));
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'limit off' });
  const long = answer + 'x'.repeat(1200);
  writeFileSync(join(f.root, '.cyc/runtime/reply.md'), long);
  const before = readdirSync(join(f.root, '.cyc/runtime')).sort();
  const cli = args => { const r = spawnSync(process.execPath, [join(project, 'bin/cyc.mjs'), 'check-reply', '.cyc/runtime/reply.md', '--project', f.root, ...args], { encoding: 'utf8' }); return { status: r.status, out: JSON.parse(r.stdout) }; };
  const capped = cli([]);
  assert.equal(capped.status, 1); assert.equal(capped.out.ok, false); assert.equal(capped.out.overBy, [...long].length - 1000); assert.match(capped.out.issues[0], new RegExp(`cut at least ${[...long].length - 1000}`));
  const session = cli(['--session', f.key]);
  assert.equal(session.status, 0); assert.deepEqual([session.out.ok, session.out.overBy, session.out.visual], [true, 0, true]); assert.match(session.out.send, /unchanged/);
  assert.equal(cli(['--expanded']).out.ok, true);
  assert.deepEqual(readdirSync(join(f.root, '.cyc/runtime')).sort(), before, 'check-reply writes no packet and no state');
  assert.equal(existsSync(f.packetPath), false);
});

for (const host of ['claude', 'codex']) test(`${host}: a correction lists each issue on its own line, says how much to cut, names check-reply, and repeats no prompt context`, t => {
  const f = hookFixture(t, host);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build it' });
  const long = 'x'.repeat(1112);
  const rejected = f.run({ hook_event_name: 'Stop', last_assistant_message: long });
  const lines = rejected.reason.split('\n');
  assert.equal(lines[0], 'CYC_GATE_CONTINUE: Correction 1/3. Revise the reply:');
  assert.match(lines[1], /^- Response has 1112 characters; maximum is 1000: cut at least 112\./);
  assert.match(lines[2], /^- Include one compact relevant visual: a Markdown table/);
  assert.match(lines[3], /^- Write the session review packet before completion\./);
  assert.match(lines[4], new RegExp(`^- Draft the revised reply in \\.cyc/runtime/reply\\.md and check it with node ".*bin[\\\\/]cyc\\.mjs" check-reply \\.cyc/runtime/reply\\.md --session ${f.key} before sending it unchanged\\. Packet: .*${f.key}\\.review\\.json; token [0-9a-f-]{36}\\.$`));
  assert.equal(lines.at(-1), 'If an external constraint prevents completion, produce an honest blocked handoff. Do not alter the gate or its state to pass.');
  for (const repeated of ['persistent 1000-character limit', 'Standalone user commands', 'response-standard.md', 'Fix unmet criteria']) assert.ok(!rejected.reason.includes(repeated), repeated);
  assert.ok(rejected.reason.length < 1200, `${rejected.reason.length} characters (round 8 corrections were about 1,800)`);
  // The continuation is still recognized as this request's, so its budget is preserved.
  const continuation = f.run({ hook_event_name: 'UserPromptSubmit', prompt: rejected.reason });
  assert.match(continuation.hookSpecificOutput.additionalContext, /check-reply \.cyc\/runtime\/reply\.md --session/);
  assert.equal(JSON.parse(readFileSync(f.statePath, 'utf8')).attempts, 1);
  for (let pass = 2; pass <= 3; pass++) assert.match(f.run({ hook_event_name: 'Stop', last_assistant_message: long }).reason, new RegExp(`Correction ${pass}/3`));
  const halted = f.run({ hook_event_name: 'Stop', last_assistant_message: long });
  assert.match(halted.systemMessage, /NOT READY: three correction passes exhausted\. No completion certification was issued\. Remaining issues:\n- Response has 1112 characters/);
});

test('at the prompt, gate files older than 14 days are pruned and everything else under .cyc/runtime stays', t => {
  const f = hookFixture(t, 'claude');
  const runtime = join(f.root, '.cyc/runtime'); mkdirSync(runtime, { recursive: true });
  const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const other = 'b'.repeat(32); const third = 'c'.repeat(32);
  const files = {
    pruned: [`${other}.state.json`, `${other}.review.json`, `${other}.state.json.corrupt-123e4567-e89b-12d3-a456-426614174000`, 'cursor-mytag.review.json', 'cursor.review.json', `${other}.review.json.abc.tmp`],
    kept: ['FINISH.json', 'reply.md', 'reply-draft.md', 'notes.json', `${third}.state.json`, `${f.key}.state.json`]
  };
  for (const name of [...files.pruned, ...files.kept]) { writeFileSync(join(runtime, name), '{}'); utimesSync(join(runtime, name), old, old); }
  utimesSync(join(runtime, `${third}.state.json`), recent, recent);
  mkdirSync(join(runtime, 'scratch-2026-10-01')); writeFileSync(join(runtime, 'scratch-2026-10-01', `${other}.state.json`), '{}');
  utimesSync(join(runtime, 'scratch-2026-10-01'), old, old);
  f.run({ hook_event_name: 'UserPromptSubmit', prompt: 'Build it' });
  for (const name of files.pruned) assert.equal(existsSync(join(runtime, name)), false, `${name} pruned`);
  for (const name of files.kept) assert.equal(existsSync(join(runtime, name)), true, `${name} kept`);
  assert.equal(existsSync(join(runtime, 'scratch-2026-10-01', `${other}.state.json`)), true, 'folders are not entered');
  assert.equal(JSON.parse(readFileSync(f.statePath, 'utf8')).attempts, 0, 'the current conversation state is the fresh request');
});
