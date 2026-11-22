import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRun } from '../scripts/runtime.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

// One feature unit worked by two conversations through the CLI: a builder and a reviewer in the
// review seat. The reviewer's finding holds the unit, the builder answers it, the reviewer signs
// off, the builder records one peer receipt from the board, and the unit completes with real
// original-code proof. Nothing here simulates a host; the two conversations are two session IDs.
process.env.CYC_BASELINE_MODE = 'off';
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/cyc.mjs');
const put = (root, name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content)); return path; };
const prose = ['Math helpers are plain functions exported from src/math/math.mjs; every caller imports them from that one module.', 'Each helper takes no arguments and returns a constant, so there is no shared state to coordinate.', 'The tests in test/math import the module directly and assert each return value.', 'Limit: nothing here checks performance.'];
const view = (...more) => [...prose, ...more].join('\n');
// The fixture's own test suite, started as a project would start it. This file runs under node --test,
// whose marker a nested run must not inherit.
const unitCheck = { id: 'tests', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"], timeoutMs: 60000 };

function cyc(root, session, args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8', env: { ...process.env, CYC_SESSION: session, CLAUDE_CODE_SESSION_ID: '', CODEX_THREAD_ID: '' } });
  let data; try { data = JSON.parse(result.stdout || result.stderr); } catch { data = { raw: result.stdout + result.stderr }; }
  if (expected !== null) assert.equal(result.status, expected, JSON.stringify(data).slice(0, 2500));
  return data;
}

test('a builder and a reviewer work one feature unit through the board: the finding holds it, the answer and the sign-off release it, and the receipt comes from the board', { timeout: 300000 }, t => {
  const root = mkdtempSync(join(tmpdir(), 'cyc-seat-'));
  t.after(() => { assert.ok(root.includes('cyc-seat-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', { schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [unitCheck] } });
  put(root, 'package.json', { name: 'fixture', type: 'module' });
  put(root, 'src/math/math.mjs', 'export const one = () => 1;\n');
  put(root, 'test/math/one.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { one } from '../../src/math/math.mjs';\ntest('one returns 1', () => assert.equal(one(), 1));\n");
  put(root, 'docs/context/math.md', `# Math\n\nCovers: src/math/**, test/math/**\n\n## Current view\n\n${view()}\n\n## Lessons\n`);
  put(root, 'docs/context/INDEX.md', '# Context index\n\nRead the index first.\n\n| Component | Covers | Doc |\n| --- | --- | --- |\n| Math | src/math/**, test/math/** | [Math](math.md) |\n');
  const message = (name, body) => put(root, `.cyc/runtime/${name}.json`, { version: 1, ...body });

  const queue = cyc(root, 'builder', ['queue', 'create', '--file', put(root, '.cyc/runtime/QUEUE.json', { version: 1, goal: 'Add the alpha helper.', requirements: 'Add alpha, returning its own name.',
    units: [{ id: 'alpha', outcome: 'math.alpha() returns "alpha".', playbook: 'feature', criteria: [{ id: 'returns', description: 'alpha() returns its own name.' }], paths: ['src/math', 'test/math'], dependsOn: [] }] })]).queueId;

  // The builder starts the unit and writes the helper with its test.
  const next = cyc(root, 'builder', ['queue', 'next', '--queue', queue]);
  const start = JSON.parse(readFileSync(join(root, next.startTemplate), 'utf8'));
  writeFileSync(join(root, next.startTemplate), JSON.stringify({ ...start, executionMode: 'standalone', plan: 'Add the helper beside the others, with one test.',
    contextRetention: { version: 1, disposition: 'required', features: [{ id: 'math', doc: 'docs/context/math.md', paths: ['src/math/math.mjs'] }] },
    scout: { context: { status: 'used', sources: ['docs/context/math.md'], evidence: 'Read the math record.', freshness: 'Compared it with src/math/math.mjs as it is now.' }, approach: { kind: 'extend', evidence: 'The helper is added to the one module every caller imports.' }, alignment: { status: 'clear', evidence: 'The unit names the helper and its return value.' }, consumers: [{ id: 'behavior', description: 'Callers of the math module.', check: 'The unit\'s test.' }] } }));
  const run = cyc(root, 'builder', ['run', 'start', '--file', join(root, next.startTemplate)]).runId;
  writeFileSync(join(root, 'src/math/math.mjs'), `${readFileSync(join(root, 'src/math/math.mjs'), 'utf8')}export const alpha = () => 'alpha';\n`);
  put(root, 'test/math/alpha.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport * as math from '../../src/math/math.mjs';\ntest('alpha returns its name', () => assert.equal(math.alpha(), 'alpha'));\n");

  // A second conversation takes the review seat and reads what changed.
  const seat = cyc(root, 'reviewer', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'reviewer']);
  assert.deepEqual([seat.unit.id, seat.runId, seat.changed], ['alpha', run, ['src/math/math.mjs', 'test/math/alpha.test.mjs']]);
  const finding = cyc(root, 'reviewer', ['queue', 'post', '--queue', queue, '--seat', seat.seat, '--file', message('finding', { kind: 'finding', to: 'alpha', text: 'The record docs/context/math.md does not list alpha among the helpers.', about: ['docs/context/math.md'] })]);
  assert.equal(finding.posted.id, 1);

  // The builder's next command shows the finding first, and finish refuses before it checks anything.
  const shown = cyc(root, 'builder', ['run', 'next', '--run', run]);
  assert.equal(Object.keys(shown)[0], 'board');
  assert.deepEqual(shown.board.new.map(item => [item.id, item.kind]), [[1, 'finding']]);
  const state = readRun(root, run);
  const assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  delete assessment.testProof; // no exemption: the proof runs
  assessment.semanticReview = { ...assessment.semanticReview, reviewer: 'peer' };
  assessment.learning = { status: 'recorded', reason: 'Keep the helper list current.', artifacts: ['docs/context/math.md'] };
  const scenarioEvidence = [{ id: 'returns', scenario: 'alpha returns its name', check: 'tests', receipt: 'current-verification', result: 'passed', origin: 'agent-reported', evidence: 'test/math/alpha.test.mjs asserts the return value.', consumers: ['behavior'] }];
  const finishFile = put(root, '.cyc/runtime/finish.json', { summary: 'Added alpha.', scenarioEvidence, assessment });
  const held = cyc(root, 'builder', ['run', 'finish', '--run', run, '--file', finishFile], null);
  assert.deepEqual([held.status, held.finished, held.steps], ['needs-answer', false, []]);
  assert.deepEqual(held.board.hold.map(item => item.message ?? `seat ${item.seat}`), [1, `seat ${seat.seat}`]);
  assert.equal(readRun(root, run).verification ?? null, null, 'no check was spent on a unit the board holds');
  assert.equal(readRun(root, run).stages[readRun(root, run).stageIndex], 'build', 'nothing was recorded');

  // The builder acts on the finding, answers it, settles the record and asks for another look.
  const prepared = cyc(root, 'builder', ['context', 'prepare', '--run', run, '--file', put(root, '.cyc/runtime/context.json', { records: [{ id: 'math', currentView: view('Helpers: one and alpha.'), changed: 'Added alpha.' }] })]);
  assert.equal(prepared.ok, true, JSON.stringify(prepared).slice(0, 1500));
  cyc(root, 'builder', ['queue', 'post', '--run', run, '--file', message('answer', { kind: 'answer', replyTo: 1, disposition: 'fixed', text: 'The record now lists one and alpha.' })]);
  const asked = cyc(root, 'builder', ['queue', 'post', '--run', run, '--file', message('ready', { kind: 'notice', topic: 'ready-for-review', text: 'Record updated; please look again.' })]);
  assert.equal(asked.posted.to, `seat:${seat.seat}`);

  // The reviewer is told at its next wait, checks the answer, and signs off on the source as it stands.
  const told = cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', seat.seat, '--wait-ms', '2000']);
  assert.deepEqual(told.board.new.map(item => [item.kind, item.disposition ?? item.topic]), [['answer', 'fixed'], ['notice', 'ready-for-review']]);
  assert.match(readFileSync(join(root, 'docs/context/math.md'), 'utf8'), /Helpers: one and alpha\./);
  // The source the reviewer first read is no longer the source: that sign-off is refused, the current one accepted.
  assert.notEqual(told.seat.sourceHash, seat.sourceHash);
  assert.match(cyc(root, 'reviewer', ['queue', 'post', '--queue', queue, '--seat', seat.seat, '--file', message('stale', { kind: 'notice', topic: 'review-done', sourceHash: seat.sourceHash, text: 'Too early.' })], 1).error, /It changed since then/);
  cyc(root, 'reviewer', ['queue', 'post', '--queue', queue, '--seat', seat.seat, '--file', message('done', { kind: 'notice', topic: 'review-done', sourceHash: told.seat.sourceHash, text: 'The record lists alpha. Nothing more.' })]);

  // One peer receipt, built from the board, and the unit completes with it.
  const receipt = cyc(root, 'builder', ['run', 'review-record', '--run', run, '--from-board']);
  assert.deepEqual([receipt.reviewer, receipt.status, receipt.led.seat, receipt.findings.map(item => item.status)], ['peer', 'recorded', seat.seat, ['resolved']]);
  let result = cyc(root, 'builder', ['run', 'finish', '--run', run, '--file', finishFile], null);
  if (result.status === 'needs-proof-review') {
    const input = JSON.parse(readFileSync(join(root, result.nextAction.inputTemplate), 'utf8'));
    for (const item of input.assessment.proofReview.cases) Object.assign(item, { category: 'new-interface', reason: 'math.alpha does not exist on the run-start code, so the new test fails there.' });
    result = cyc(root, 'builder', ['run', 'finish', '--run', run, '--file', put(root, '.cyc/runtime/finish-proof.json', input)], null);
  }
  assert.equal(result.finished, true, JSON.stringify(result).slice(0, 2500));
  const done = readRun(root, run);
  assert.equal(done.status, 'complete');
  assert.equal(done.testProof.passed, true);
  assert.deepEqual(done.evidence.reviews, [receipt.id], 'the completed evidence names the receipt the board produced');
  assert.equal(done.reviewReceipts.find(item => item.id === receipt.id).led.by, 'queue-board');
  const status = cyc(root, 'reviewer', ['queue', 'status', '--queue', queue]);
  assert.deepEqual([status.line, status.board.open, status.board.seats ?? null], ['complete', 0, null]);
  // What was said stays on the board as the record of the review.
  assert.deepEqual(cyc(root, 'reviewer', ['queue', 'board', '--queue', queue]).messages.map(item => [item.id, item.kind, item.disposition ?? item.topic ?? null]),
    [[1, 'finding', null], [2, 'answer', 'fixed'], [3, 'notice', 'ready-for-review'], [4, 'notice', 'review-done']]);
});
