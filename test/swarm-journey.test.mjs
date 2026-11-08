import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as runtime from '../scripts/runtime.mjs';
import { digest } from '../scripts/response-gate.mjs';

const server = fileURLToPath(new URL('../test-support/swarm-server.fixture.mjs', import.meta.url));
const put = (root, path, content) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };

test('swarm journey can load the automatic execution interface', async t => {
  const { executeSwarm } = await import('../scripts/swarm.mjs');
  assert.equal(typeof executeSwarm, 'function');
  const { installProject } = await import('../scripts/install.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'cyc-swarm-install-'));
  const root = join(directory, 'project'), trace = join(directory, 'transport');
  mkdirSync(root); mkdirSync(trace);
  t.after(() => {
    assert.ok(directory.startsWith(join(tmpdir(), 'cyc-swarm-install-')));
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const old = process.env.CYC_SESSION;
  process.env.CYC_SESSION = 'swarm-installed-lead';
  t.after(() => old === undefined ? delete process.env.CYC_SESSION : process.env.CYC_SESSION = old);
  put(root, 'left.txt', 'left value'); put(root, 'right.txt', 'right value'); put(root, 'secret.txt', 'outside assignment authority');
  await installProject(root, { hosts: ['codex'] });
  assert.equal(typeof (await import(pathToFileURL(join(root, '.cyc/engine/scripts/swarm.mjs')).href)).executeSwarm, 'function');
  const id = runtime.startRun(root, {
    goal: 'Inspect both source slices automatically and merge their evidence.', playbook: 'investigation', session: 'swarm-installed-lead',
    allowedPaths: ['left.txt', 'right.txt'], criteria: [{ id: 'value', description: 'Retain both supported source observations.' }],
    delegation: { version: 1, mode: 'auto', maxWorkers: 2, maxAssignments: 4 }
  }).runId;
  const shim = join(root, '.cyc/runtime/shim');
  const source = 'globalThis.CYC_SWARM_FIXTURE = ' + JSON.stringify({ traceDir: trace, scenario: 'complete' }) + ';\n' + readFileSync(server, 'utf8');
  put(shim, 'node_modules/@openai/codex/package.json', '{"type":"module"}');
  put(shim, 'node_modules/@openai/codex/bin/codex.js', source);
  if (process.platform !== 'win32') writeFileSync(join(shim, 'codex'), '#!/usr/bin/env node\n' + source, { mode: 0o755 });
  const input = '.cyc/runtime/swarm-input.json';
  put(root, input, JSON.stringify({ version: 1, objective: 'time', timeoutMs: 15000 }));
  const result = spawnSync(process.execPath, [join(root, '.cyc/engine/bin/cyc.mjs'), 'delegate', 'swarm', '--run', id, '--file', input, '--project', root], {
    cwd: root, encoding: 'utf8', timeout: 60000, windowsHide: true,
    env: { ...process.env, CODEX_APP_RUNTIME_CLI_PATH: '', PATH: shim + delimiter + process.env.PATH }
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'merged', result.stdout);
  const state = runtime.readRun(root, id);
  assert.equal(state.delegation.assignments.length, 2);
  assert.ok(state.delegation.assignments.every(a => a.disposition === 'accepted' && a.host.terminalStatus === 'completed'));
  assert.equal(state.taskContext.findings.length, 2);
  const contextPath = join(root, '.cyc/runs', id, 'context.md');
  assert.equal(state.taskContext.acknowledgment.hash, digest(readFileSync(contextPath)));
  assert.equal(readdirSync(join(root, '.cyc/runs', id), { recursive: true }).filter(path => path.endsWith('context.md')).length, 1);
  assert.equal(state.handoffs.length, 0);
  assert.notEqual(state.status, 'complete');
  const events = readFileSync(join(trace, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(events.filter(e => e.event === 'turn-requested' && e.role === 'plan').length, 1);
  assert.equal(events.filter(e => e.event === 'work-start').length, 2);
  assert.equal(events.filter(e => e.event === 'turn-requested' && e.role === 'merge').length, 1);
});
