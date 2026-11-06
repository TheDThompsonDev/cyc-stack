import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acceptFailure, finishRun, nextRun, readRun, startRun } from '../test-support/historical-runtime.test.fixture.mjs';
import { checkPacket, digest } from '../scripts/response-gate.mjs';
import { writePacket } from '../scripts/packet.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

// The round 6 profile measured three per-task costs: the agent writing the review packet after
// finish, assessment fields the controller could state itself, and finish running the suite three
// times one after another. These tests pin the cuts, and the relaxations each cut must not allow.
// An earlier version measured the run-start code in an isolated copy with linked dependencies; a
// fresh review showed links let it read the agent's code and write into the project, so it is gone.

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hookModules = ['response-hook.mjs', 'response-gate.mjs', 'response-mode.mjs', 'run-gate.mjs', 'host-activation.mjs', 'source-snapshot.mjs'];
const answer = 'The feature works.\n\n| Check | Result |\n| --- | --- |\n| Behavior | Passed |';

const buggy = 'export const add = (a, b) => a - b;\n';
const fixed = 'export const add = (a, b) => a + b;\n';
const smoke = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('add exists', () => assert.equal(typeof add, 'function'));\n";
const catching = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('adds', () => assert.equal(add(2, 3), 5));\n";

function scratch(t, prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => { assert.ok(path.includes(prefix)); rmSync(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  return path;
}

// Each suite execution appends its working directory to a log outside the project, so a test can
// count the runs in the project, and confirm that none ran anywhere else (a cyc-baseline- copy).
function counted(log, { before = '', id = 'unit' } = {}) {
  return { id, command: process.execPath, timeoutMs: 60000, args: ['-e', `require('fs').appendFileSync(${JSON.stringify(log)}, process.cwd() + '\\n');${before} delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { stdio: 'inherit' }); process.exit(r.status ?? 1);`] };
}
const runsIn = log => {
  const lines = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { copy: lines.filter(line => /cyc-baseline-/.test(line)).length, place: lines.filter(line => !/cyc-baseline-/.test(line)).length };
};

function repo(t, { commands, verification = {}, ledger = true, extra = () => {} } = {}) {
  const root = scratch(t, 'cyc-cuts-');
  const git = (...args) => { const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T'); git('config', 'core.autocrlf', 'false');
  mkdirSync(join(root, 'src')); mkdirSync(join(root, 'test')); mkdirSync(join(root, '.cyc'));
  writeFileSync(join(root, 'src/calc.mjs'), buggy);
  writeFileSync(join(root, 'test/smoke.test.mjs'), smoke);
  if (ledger) { mkdirSync(join(root, 'docs/context'), { recursive: true }); writeFileSync(join(root, 'docs/context/error-ledger.md'), '# Error ledger\n'); }
  writeFileSync(join(root, '.gitignore'), '.cyc/runs/\n.cyc/runtime/\nnode_modules/\n*.local\n');
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { ...verification, commands } }));
  extra(root);
  git('add', '-A'); git('commit', '-qm', 'init');
  return { root, git };
}

const criteria = [{ id: 'c1', description: 'add returns the sum' }];
function start(root, { playbook = 'bug-fix', session, scout } = {}) {
  const state = { workContractVersion: 1, playbook, stages: ['scout'], stageIndex: 0 };
  return startRun(root, { goal: 'Fix add.', playbook, criteria, session, plan: 'Fix the operator and add a regression test.', scout: scout ?? fixtureAssessment(state, 'scout') }).runId;
}
const final = (root, id, extra = {}) => ({ ...fixtureAssessment(readRun(root, id), 'verify'), ...fixtureAssessment(readRun(root, id), 'deliver'), ...extra });
const fix = root => { writeFileSync(join(root, 'test/add.test.mjs'), catching); writeFileSync(join(root, 'src/calc.mjs'), fixed); };

function withMode(t, mode) {
  const previous = process.env.CYC_BASELINE_MODE;
  process.env.CYC_BASELINE_MODE = mode;
  t.after(() => { if (previous === undefined) delete process.env.CYC_BASELINE_MODE; else process.env.CYC_BASELINE_MODE = previous; });
}

// ---------- packet: run finish writes the review packet ----------

function hookProject(t, host = 'claude') {
  const { root } = repo(t, { commands: [{ id: 'unit', command: process.execPath, timeoutMs: 60000, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"] }] });
  mkdirSync(join(root, 'scripts'));
  for (const file of hookModules) copyFileSync(join(project, 'scripts', file), join(root, 'scripts', file));
  const key = digest(`${host}:test-session`).slice(0, 32);
  const statePath = join(root, '.cyc/runtime', `${key}.state.json`);
  const packetPath = join(root, '.cyc/runtime', `${key}.review.json`);
  const hook = event => {
    const result = spawnSync(process.execPath, [join(root, 'scripts/response-hook.mjs'), host], { input: JSON.stringify({ session_id: 'test-session', ...event }), encoding: 'utf8', cwd: root });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  return { root, key, statePath, packetPath, hook };
}

test('packet: a completed run finish writes this request\'s review packet, and the Stop gate accepts it with no cyc packet call', t => {
  withMode(t, 'off');
  const f = hookProject(t);
  f.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add.' });
  const id = start(f.root, { session: f.key });
  fix(f.root);
  const result = finishRun(f.root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(f.root, id) });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.equal(result.packet?.written, true, 'finish reports the packet it wrote');
  const packet = JSON.parse(readFileSync(f.packetPath, 'utf8'));
  assert.equal(packet.token, JSON.parse(readFileSync(f.statePath, 'utf8')).token);
  assert.equal(packet.writtenBy, 'run finish');
  assert.equal(packet.runId, id);
  assert.equal(packet.status, 'ready');
  assert.deepEqual(packet.checks, [{ criterion: 'add returns the sum', result: 'passed', evidence: 'adds test passes' }]);
  assert.deepEqual(packet.artifacts.map(item => item.path).sort(), readRun(f.root, id).handoffs.at(-1).artifacts.map(item => item.path).sort(), 'delivery projection retains the canonical handoff artifacts, including error history');
  assert.equal(packet.artifacts.find(item => item.path === 'src/calc.mjs').sha256, digest(readFileSync(join(f.root, 'src/calc.mjs'))));
  assert.equal(packet.humanReview, undefined, 'the controller does not claim the agent reread its reply');
  assert.deepEqual(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
});

test('packet: the Stop gate still checks the reply itself, and a revised reply needs no packet rerun', t => {
  withMode(t, 'off');
  const f = hookProject(t);
  f.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add.' });
  const id = start(f.root, { session: f.key });
  fix(f.root);
  assert.equal(finishRun(f.root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(f.root, id) }).finished, true);
  const rejected = f.hook({ hook_event_name: 'Stop', last_assistant_message: 'Done, no visual.' });
  assert.match(rejected.reason, /compact relevant visual/);
  assert.doesNotMatch(rejected.reason, /rerun cyc packet/, 'nothing in a finish-written packet depends on the reply text');
  assert.deepEqual(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  const long = f.hook({ hook_event_name: 'Stop', last_assistant_message: `${answer}\n${'x'.repeat(1000)}` });
  assert.match(long.reason ?? '', /characters; maximum is 1000/);
});

test('packet: an agent-written packet still needs the reread affirmation, and a finish packet must name a run completed in this request', t => {
  withMode(t, 'off');
  const f = hookProject(t);
  f.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Answer a question.' });
  const token = JSON.parse(readFileSync(f.statePath, 'utf8')).token;
  const base = { token, status: 'ready', checks: [{ criterion: 'Answered', result: 'passed', evidence: 'read the code' }], artifacts: [] };
  assert.ok(checkPacket({ packet: base, token, root: f.root }).some(issue => /human-readiness review: answersRequest/.test(issue)), 'a hand-written packet without the affirmation is refused');
  writeFileSync(f.packetPath, JSON.stringify({ ...base, writtenBy: 'run finish', runId: 'no-such-run' }));
  assert.match(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, /run finish wrote it, but run no-such-run is not a run of this request that completed/);
  // A real run that is still in progress cannot vouch for a finish packet either.
  const id = start(f.root, { session: f.key });
  writeFileSync(f.packetPath, JSON.stringify({ ...base, writtenBy: 'run finish', runId: id }));
  const stopped = f.hook({ hook_event_name: 'Stop', last_assistant_message: answer });
  assert.match(stopped.reason, new RegExp(`run ${id} is not a run of this request that completed`));
});

test('packet: a hand-written packet that claims run finish wrote it is refused even when it names a run that completed', t => {
  withMode(t, 'off');
  const f = hookProject(t);
  f.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add.' });
  const id = start(f.root, { session: f.key });
  fix(f.root);
  assert.equal(finishRun(f.root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(f.root, id) }).finished, true);
  const genuine = JSON.parse(readFileSync(f.packetPath, 'utf8'));
  writeFileSync(f.packetPath, JSON.stringify({ ...genuine, checks: [{ criterion: 'add returns the sum', result: 'passed', evidence: 'trust me' }], artifacts: [] }, null, 2));
  assert.match(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, new RegExp(`does not match what run ${id} recorded`));
  writeFileSync(f.packetPath, JSON.stringify(genuine, null, 2));
  assert.deepEqual(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }), {}, 'the packet finish wrote still passes');
});

test('packet: a finish packet must name its writer, carry only recorded checks, and be the latest one written', t => {
  withMode(t, 'off');
  const f = hookProject(t);
  f.hook({ hook_event_name: 'UserPromptSubmit', prompt: 'Fix add, then add sub.' });
  const token = JSON.parse(readFileSync(f.statePath, 'utf8')).token;
  // A packet planted before the finish claims run finish wrote a security review; finish must not keep it.
  writeFileSync(f.packetPath, JSON.stringify({ token, status: 'ready', writtenBy: 'run finish', runId: 'planted', runIds: ['planted'], checks: [{ criterion: 'Security review of the auth module', result: 'passed', evidence: 'done' }], artifacts: [] }, null, 2));
  const first = start(f.root, { session: f.key });
  fix(f.root);
  assert.equal(finishRun(f.root, first, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(f.root, first) }).finished, true);
  const one = JSON.parse(readFileSync(f.packetPath, 'utf8'));
  assert.deepEqual(one.checks.map(item => item.criterion), ['add returns the sum'], 'the planted check was not merged');
  assert.deepEqual(one.runIds, [first]);
  // A forged packet naming the completed run only in runIds, or a writer that is not a run, is refused.
  for (const forged of [{ ...one, runId: undefined }, { ...one, runId: 'not-a-run' }]) {
    writeFileSync(f.packetPath, JSON.stringify(forged, null, 2));
    assert.ok(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, JSON.stringify(forged.runId));
  }
  writeFileSync(f.packetPath, JSON.stringify(one, null, 2));
  // A second run in the same request merges the first run's recorded checks.
  const second = startRun(f.root, { goal: 'Add sub.', playbook: 'feature', criteria: [{ id: 'c2', description: 'sub returns the difference' }], session: f.key, plan: 'Add sub with a test.', scout: fixtureAssessment({ workContractVersion: 1, playbook: 'feature', stages: ['scout'], stageIndex: 0 }, 'scout') }).runId;
  writeFileSync(join(f.root, 'src/sub.mjs'), 'export const sub = (a, b) => a - b;\n');
  writeFileSync(join(f.root, 'test/sub.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { sub } from '../src/sub.mjs';\ntest('subtracts', () => assert.equal(sub(5, 3), 2));\n");
  assert.equal(finishRun(f.root, second, { summary: 'sub added.', criterionEvidence: { c2: 'subtracts passes' }, assessment: final(f.root, second) }).finished, true);
  const two = JSON.parse(readFileSync(f.packetPath, 'utf8'));
  assert.deepEqual(two.runIds, [first, second]);
  assert.deepEqual(two.checks.map(item => item.criterion), ['add returns the sum', 'sub returns the difference']);
  assert.deepEqual(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }), {});
  // Restoring the first run's genuine packet would drop the second run's files from review.
  writeFileSync(f.packetPath, JSON.stringify(one, null, 2));
  assert.match(f.hook({ hook_event_name: 'Stop', last_assistant_message: answer }).reason, new RegExp(`run ${second} finished later and wrote its own`));
});

test('packet: without hook state (Cursor, or no gate) finish writes nothing, and cyc packet still works afterwards', t => {
  withMode(t, 'off');
  const { root } = repo(t, { commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  const id = start(root, { session: 'cursor-chat-tag' });
  fix(root);
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(root, id) });
  assert.equal(result.finished, true);
  assert.equal(result.packet?.written, false);
  assert.ok(!existsSync(join(root, '.cyc/runtime/cursor-cursor-chat-tag.review.json')), 'Cursor still writes its own packet with the exact reply');
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  writeFileSync(join(root, '.cyc/runtime/reply.md'), answer);
  assert.equal(writePacket(root, { executionMode: 'cursor', session: 'cursor-chat-tag', responseFile: '.cyc/runtime/reply.md', passed: ['Fixed :: tests'], reviewed: true }).status, 'ready');
});

// ---------- defaults: fields the controller can state truthfully ----------

test('defaults: a feature run without a failed attempt may omit learning and errorHistory; the review records what the controller can state', t => {
  withMode(t, 'off');
  const { root } = repo(t, { commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  const id = start(root, { playbook: 'feature' });
  const template = JSON.parse(readFileSync(join(root, nextRun(root, id).finishTemplate), 'utf8'));
  assert.deepEqual(Object.keys(template.assessment), ['semanticReview', 'consumerChecks'], 'the template asks only for what the agent must judge');
  fix(root);
  const assessment = final(root, id); delete assessment.learning; delete assessment.errorHistory;
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment });
  assert.equal(result.finished, true, JSON.stringify(result));
  const deliver = readRun(root, id).handoffs.findLast(item => item.stage === 'deliver').assessment;
  assert.equal(deliver.learning.status, 'none');
  assert.match(deliver.learning.reason, /no reusable learning was recorded/i);
  assert.equal(deliver.errorHistory.status, 'none');
  assert.match(deliver.errorHistory.reason, /no failed attempt/i);
});

test('defaults: a bug fix still needs its error history, and so does any run with a failed attempt', t => {
  withMode(t, 'off');
  const { root } = repo(t, { commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  const id = start(root, { playbook: 'bug-fix' });
  assert.ok('errorHistory' in JSON.parse(readFileSync(join(root, nextRun(root, id).finishTemplate), 'utf8')).assessment, 'a bug-fix template keeps errorHistory');
  fix(root);
  const assessment = final(root, id); delete assessment.errorHistory;
  assert.throws(() => finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'x' }, assessment }), /missing errorHistory/);
  // A feature run whose first finish failed has a recorded failure, so its history is the agent's to write.
  const other = repo(t, { commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  const feature = start(other.root, { playbook: 'feature' });
  writeFileSync(join(other.root, 'test/add.test.mjs'), catching);
  writeFileSync(join(other.root, 'src/calc.mjs'), 'export const add = (a, b) => a * b;\n');
  const failed = finishRun(other.root, feature, { summary: 'first try.', criterionEvidence: { c1: 'x' }, assessment: final(other.root, feature) });
  assert.equal(failed.finished, false);
  writeFileSync(join(other.root, 'src/calc.mjs'), fixed);
  const after = final(other.root, feature); delete after.errorHistory;
  assert.throws(() => finishRun(other.root, feature, { summary: 'fixed.', criterionEvidence: { c1: 'x' }, assessment: after }), /missing errorHistory/);
});

test('defaults: scout may omit context only when the project keeps no context index and no ledger', t => {
  withMode(t, 'off');
  const plain = repo(t, { ledger: false, commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  const scout = fixtureAssessment({ workContractVersion: 1, playbook: 'feature', stages: ['scout'], stageIndex: 0 }, 'scout'); delete scout.context;
  const id = start(plain.root, { playbook: 'feature', scout: { ...scout } });
  const recorded = readRun(plain.root, id).handoffs.find(item => item.stage === 'scout').assessment.context;
  assert.equal(recorded.status, 'none');
  assert.match(recorded.evidence, /no docs\/context\/INDEX\.md and no ledger/);
  const withHistory = repo(t, { ledger: true, commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  assert.throws(() => start(withHistory.root, { playbook: 'feature', scout: { ...scout } }), /missing context/);
  assert.equal(readdirSync(join(withHistory.root, '.cyc')).includes('runs') ? readdirSync(join(withHistory.root, '.cyc/runs')).length : 0, 0, 'a refused scout creates no run');
});

// ---------- control: the proof skips its control run only when it cannot matter ----------

const proofReceipt = (root, id) => JSON.parse(readFileSync(join(root, readRun(root, id).testProof.receiptPath), 'utf8'));

test('control: when the change only adds a test file and every failure is in it, finish runs the suite twice: treatment and verify', t => {
  withMode(t, 'off');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  const { root } = repo(t, { commands: [counted(log)] });
  const id = start(root);
  fix(root);
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(root, id) });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.equal(result.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  assert.equal(proofReceipt(root, id).controlSource, 'not needed: every failure is in a test file this change added');
  assert.equal(proofReceipt(root, id).control, null);
  assert.deepEqual(runsIn(log), { copy: 0, place: 2 });
});

test('control: a weak test that passes everything on the original code is refused without a control run', t => {
  withMode(t, 'off');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  const { root } = repo(t, { commands: [counted(log)] });
  const id = start(root);
  writeFileSync(join(root, 'test/add.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('returns a number', () => assert.equal(typeof add(2, 3), 'number'));\n");
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const result = finishRun(root, id, { summary: 'x', criterionEvidence: { c1: 'x' }, assessment: final(root, id) });
  assert.equal(result.failedAt, 'prove-red');
  assert.match(result.verdict, /would not catch/);
  assert.deepEqual(runsIn(log), { copy: 0, place: 1 }, 'only the treatment ran');
});

test('control: a test added to an existing test file, or beside a deleted one, still gets the control run', t => {
  withMode(t, 'off');
  const cases = [
    // An edited test file can hide a data-driven or renamed old failure behind any title, quoted in
    // a comment or not, so only the control run can say what failed at run start.
    ['a literal title in an existing file', root => writeFileSync(join(root, 'test/smoke.test.mjs'), `${smoke}test('adds', () => assert.equal(add(2, 3), 5));\n`)],
    ['a title built at run time in an existing file', root => writeFileSync(join(root, 'test/smoke.test.mjs'), `${smoke}const a = 2, b = 3; test(\`adds \${a}+\${b}\`, () => assert.equal(add(a, b), 5));\n`)],
    // A moved or deleted test file is missing from the treatment but ran at run start.
    ['a new file beside a deleted one', root => { unlinkSync(join(root, 'test/smoke.test.mjs')); writeFileSync(join(root, 'test/add.test.mjs'), catching); }]
  ];
  for (const [label, edit] of cases) {
    const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
    const { root } = repo(t, { commands: [counted(log)] });
    const id = start(root);
    edit(root);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'x' }, assessment: final(root, id) });
    assert.equal(result.finished, true, `${label}: ${JSON.stringify(result)}`);
    assert.equal(proofReceipt(root, id).controlSource, 'in place', label);
    assert.deepEqual(runsIn(log), { copy: 0, place: 3 }, `${label}: treatment, control, verify`);
  }
});

test('control: a check that prints anything besides test results still gets the control run', t => {
  withMode(t, 'off');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  // Like a coverage threshold: a line that is not a test result, which may fail the check at run start too.
  const { root } = repo(t, { commands: [counted(log, { before: " process.on('exit', () => console.log('# coverage: 92% of lines'));" })] });
  const id = start(root);
  fix(root);
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(root, id) });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.equal(proofReceipt(root, id).controlSource, 'in place');
  assert.deepEqual(runsIn(log), { copy: 0, place: 3 });
});

test('control: an old failure in a file whose path ends like a new test file\'s still gets the control run', t => {
  withMode(t, 'off');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  // legacy/test/calc.test.mjs already fails; the new file test/calc.test.mjs shares its path's ending.
  const { root } = repo(t, { commands: [counted(log)], extra: root => {
    mkdirSync(join(root, 'legacy/test'), { recursive: true });
    writeFileSync(join(root, 'legacy/test/calc.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('formats big', () => assert.equal('1e6', '1,000,000'));\n");
  } });
  const id = start(root);
  writeFileSync(join(root, 'test/calc.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(root, id), acceptFailures: [{ check: 'unit', reason: 'formats big in legacy/ failed before this task; untouched.' }] });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.equal(proofReceipt(root, id).controlSource, 'in place');
  assert.equal(result.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  assert.deepEqual(result.acceptedPreexistingFailures.map(item => item.check), ['unit']);
});

test('control: after a skipped control, a direct accept-failure is refused as a regression', t => {
  withMode(t, 'off');
  const { root } = repo(t, { commands: [counted(join(scratch(t, 'cyc-cuts-log-'), 'runs.log'))] });
  const id = start(root);
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), 'export const add = (a, b) => a * b;\n');
  const result = finishRun(root, id, { summary: 'x', criterionEvidence: { c1: 'x' }, assessment: final(root, id) });
  assert.equal(result.failedAt, 'verify');
  assert.throws(() => acceptFailure(root, id, { check: 'unit', reason: 'Calling it pre-existing.' }), /passed on the run-start code apart from the tests this change added/);
});

// ---------- red: checks that already fail before the change ----------

function redProject(t, log, verification = {}) {
  // posttest fails the same way before and after any change, like a template or lint check.
  return repo(t, { verification, commands: [counted(log), { id: 'posttest', command: process.execPath, args: ['-e', "console.log('template drift: .github/settings.yml'); process.exit(1)"], timeoutMs: 10000 }] });
}

test('red: with a run-start baseline, a failing check is listed in the finish template, and a placeholder reason is refused before anything runs', t => {
  withMode(t, 'sync');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  const { root } = redProject(t, log, { baseline: true });
  const id = start(root);
  const template = JSON.parse(readFileSync(join(root, nextRun(root, id).finishTemplate), 'utf8'));
  assert.equal(template.acceptFailures.length, 1);
  assert.equal(template.acceptFailures[0].check, 'posttest');
  assert.match(template.acceptFailures[0].reason, /^<.*>$/);
  fix(root);
  const before = runsIn(log);
  assert.throws(() => finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'x' }, assessment: final(root, id), acceptFailures: template.acceptFailures }), /placeholder/i);
  assert.deepEqual(runsIn(log), before, 'nothing ran for input that could not pass');
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(root, id), acceptFailures: [{ check: 'posttest', reason: 'Template drift in .github, which this fix does not touch.' }] });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.deepEqual(result.acceptedPreexistingFailures.map(item => item.check), ['posttest']);
});

test('red: a background baseline adds the failing check to a template the agent has not touched, and never to one it edited', t => {
  withMode(t, 'background');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  const untouched = redProject(t, log, { baseline: true });
  const id = start(untouched.root);
  const templatePath = join(untouched.root, nextRun(untouched.root, id).finishTemplate);
  const baselinePath = join(untouched.root, `.cyc/runs/${id}/baseline.json`);
  const deadline = Date.now() + 30000;
  while (!existsSync(baselinePath) && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  assert.deepEqual(JSON.parse(readFileSync(templatePath, 'utf8')).acceptFailures.map(item => item.check), ['posttest']);
  const edited = redProject(t, log, { baseline: true });
  const other = start(edited.root);
  const otherTemplate = join(edited.root, nextRun(edited.root, other).finishTemplate);
  writeFileSync(otherTemplate, readFileSync(otherTemplate, 'utf8').replace('<result and limits>', 'agent is filling this in'));
  const otherBaseline = join(edited.root, `.cyc/runs/${other}/baseline.json`);
  while (!existsSync(otherBaseline) && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  assert.deepEqual(JSON.parse(readFileSync(otherTemplate, 'utf8')).acceptFailures, [], 'an edited template is left alone');
  assert.match(readFileSync(otherTemplate, 'utf8'), /agent is filling this in/);
});

test('red: an acceptFailures entry for a check that passed at run start is dropped with a note, not refused', t => {
  withMode(t, 'off');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  const { root } = repo(t, { commands: [counted(log)] });
  const id = start(root);
  fix(root);
  const result = finishRun(root, id, { summary: 'add fixed.', criterionEvidence: { c1: 'adds test passes' }, assessment: final(root, id), acceptFailures: [{ check: 'unit', reason: 'I thought it was red.' }] });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.deepEqual(result.droppedAcceptFailures, [{ check: 'unit', reason: 'passed on the run-start code, so there was nothing to accept' }]);
  assert.deepEqual(readRun(root, id).acceptedFailures, []);
});

test('red: dropping that entry cannot excuse a regression: a check that passed at run start and fails now still fails verify', t => {
  withMode(t, 'off');
  const log = join(scratch(t, 'cyc-cuts-log-'), 'runs.log');
  const { root } = repo(t, { commands: [counted(log)] });
  const id = start(root);
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), 'export const add = (a, b) => a * b;\n');
  const result = finishRun(root, id, { summary: 'add changed.', criterionEvidence: { c1: 'x' }, assessment: final(root, id), acceptFailures: [{ check: 'unit', reason: 'Calling it pre-existing.' }] });
  assert.equal(result.finished, false);
  assert.equal(result.failedAt, 'verify');
  assert.deepEqual(readRun(root, id).acceptedFailures, [], 'the regression was never accepted');
});
