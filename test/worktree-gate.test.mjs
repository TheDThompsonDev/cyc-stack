import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkRuns } from '../scripts/run-gate.mjs';

test('the gate finds this session in a registered worktree without adopting other sessions or legacy runs', t => {
  const base = mkdtempSync(join(tmpdir(), 'cyc-worktree-test-'));
  t.after(() => { assert.equal(dirname(base), resolve(tmpdir())); rmSync(base, { recursive: true, force: true }); });
  const root = join(base, 'main'); const other = join(base, 'isolated'); mkdirSync(root);
  const git = (...args) => { const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(result.status, 0, result.stderr); };
  git('init'); git('-c', 'user.name=CYC Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'fixture');
  git('worktree', 'add', '--detach', other);
  const put = (id, session) => {
    const directory = join(other, '.cyc/runs', id); mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'state.json'), JSON.stringify({ id, session, startedAt: new Date().toISOString(), status: 'running', stages: ['build'], stageIndex: 0, playbook: 'feature' }));
  };
  put('own', 'session-a'); put('other', 'session-b'); put('legacy', null);
  const issues = checkRuns({ root, since: new Date(Date.now() - 60000).toISOString(), session: 'session-a', packet: { status: 'ready' } });
  assert.equal(issues.length, 1); assert.match(issues[0], /run own/);
});

test('readiness CLI reports request-scoped run issues without mutating records or claiming host activation', t => {
  const root = mkdtempSync(join(tmpdir(), 'cyc-ready-test-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); rmSync(root, { recursive: true, force: true }); });
  const key = 'ready-session';
  const since = '2026-01-01T00:00:00.000Z';
  const state = { id: 'stopped', session: key, status: 'stopped', startedAt: since, stages: ['build'], stageIndex: 0, playbook: 'feature' };
  const dir = join(root, '.cyc/runs/stopped'); mkdirSync(dir, { recursive: true });
  const path = join(dir,'state.json'); writeFileSync(path, JSON.stringify(state));
  const before = readFileSync(path,'utf8');
  const cli = (...args) => spawnSync(process.execPath, [resolve('bin/cyc.mjs'), 'readiness', '--project', root, '--session', key, ...args], { encoding:'utf8' });
  const output = cli('--since',since);
  assert.equal(output.status, 1, output.stderr);
  const report = JSON.parse(output.stdout);
  assert.equal(report.ok,false);
  assert.equal(report.scope,'controller-status-only');
  assert.equal(report.requestWindow,'explicit');
  assert.equal(report.hostActivation,'unverified');
  assert.deepEqual(report.runs.map(r=>r.id),['stopped']);
  assert.match(report.issues[0],/stopped/);
  assert.equal(readFileSync(path,'utf8'),before);
  assert.equal(JSON.parse(cli('--since','2024-02-29T00:00:00+00:00').stdout).runs[0].id,'stopped','valid leap dates and explicit offsets remain supported');
  assert.equal(cli().status,1,'unknown request window must not imply readiness');
  assert.equal(cli('--since','not-a-date').status,1);
  assert.equal(cli('--since','2026-02-30T00:00:00.000Z').status,1,'calendar normalization cannot silently move the window');
  assert.equal(cli('--since','2999-01-01T00:00:00.000Z').status,1);
  mkdirSync(join(root,'.cyc/runtime'),{recursive:true});
  writeFileSync(join(root,'.cyc/runtime',`${key}.state.json`),JSON.stringify({updatedAt:since}));
  const automatic=JSON.parse(cli().stdout);
  assert.equal(automatic.requestWindow,'hook-state');
  assert.equal(automatic.ok,false);
  assert.equal(cli('--since','2026-02-01T00:00:00.000Z').status,1,'explicit time cannot override an existing hook window');
});
