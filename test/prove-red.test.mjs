import test from 'node:test';
import assert from 'node:assert/strict';
import mutableFS from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { acceptFailure, finishRun, nextRun, proveRun, readRun, recordHandoff, startRun, quickHandoff, recoverRun, verifyRun } from '../scripts/runtime.mjs';
import { sourceSnapshot } from '../scripts/source-snapshot.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

process.env.CYC_BASELINE_MODE = 'off';
// The fixture check runs node --test itself. It drops the inherited test-runner context so the
// nested run exits non-zero on failure instead of reporting to this process.
const unitCheck = { id: 'unit', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"], timeoutMs: 60000 };

const buggy = 'export const add = (a, b) => a - b;\n';
const fixed = 'export const add = (a, b) => a + b;\n';
const smoke = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('add exists', () => assert.equal(typeof add, 'function'));\n";
const catching = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('adds', () => assert.equal(add(2, 3), 5));\n";
const weak = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('returns a number', () => assert.equal(typeof add(2, 3), 'number'));\n";

function repo(t, { source = buggy, crlf = false, gitMode = 'committed', subdir = '' } = {}) {
  const repository = mkdtempSync(join(tmpdir(), 'cyc-prove-'));
  const root = subdir ? join(repository, subdir) : repository;
  mkdirSync(root, { recursive: true });
  t.after(() => { assert.ok(repository.includes('cyc-prove-')); rmSync(repository, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const git = (...args) => { const r = spawnSync('git', ['-C', repository, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  if (gitMode !== 'none') {
    git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T'); git('config', 'core.autocrlf', crlf ? 'true' : 'false');
  }
  mkdirSync(join(root, 'src')); mkdirSync(join(root, 'test')); mkdirSync(join(root, '.cyc'));
  const eol = text => crlf ? text.replaceAll('\n', '\r\n') : text;
  writeFileSync(join(root, 'src/calc.mjs'), eol(source));
  writeFileSync(join(root, 'test/smoke.test.mjs'), eol(smoke));
  mkdirSync(join(root, 'docs/context'), { recursive: true });
  writeFileSync(join(root, 'docs/context/error-ledger.md'), '# Error ledger\n');
  writeFileSync(join(root, '.gitignore'), '.cyc/runs/\n.cyc/runtime/\n');
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [unitCheck] } }));
  if (gitMode === 'committed') { git('add', '-A'); git('commit', '-qm', 'init'); }
  return { root, git, eol };
}
function run(root, playbook) {
  const id = startRun(root, { goal: 'Fix add.', playbook, criteria: [{ id: 'c1', description: 'add works' }] }).runId;
  const next = nextRun(root, id);
  recordHandoff(root, { runId: id, stage: next.stage, attempt: next.attempt, status: 'passed', summary: 'Scouted.', evidence: [{ kind: 'observation', detail: 'fixture' }], artifacts: [], assessment: fixtureAssessment(readRun(root, id)), criteria: [{ id: 'c1', result: 'unverified', evidence: 'later' }] });
  return id;
}
function build(root, id) {
  const next = nextRun(root, id);
  recordHandoff(root, { runId: id, stage: 'build', attempt: next.attempt, status: 'passed', summary: 'Built.', evidence: [{ kind: 'observation', detail: 'fixture' }], artifacts: [], criteria: [{ id: 'c1', result: 'unverified', evidence: 'later' }] });
}
const final = (root, id, extra = {}) => ({ ...fixtureAssessment(readRun(root, id), 'verify'), ...fixtureAssessment(readRun(root, id), 'deliver'), ...extra });
const finish = (root, id, extra) => finishRun(root, id, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: final(root, id, extra) });

test('a test that fails on the run-start code proves the fix, and the project is restored byte for byte', t => {
  const { root } = repo(t); const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  writeFileSync(join(root, 'src/new-helper.mjs'), 'export const x = 1;\n');
  const before = sourceSnapshot(root).hash;
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.equal(proof.mode, 'red');
  // The verdict is repeated by agents, so it must not overstate a check-level result.
  assert.match(proof.verdict, /these tests fail on the run-start code: adds \(check unit\)/);
  assert.doesNotMatch(proof.verdict, /^The new tests fail/);
  assert.deepEqual(proof.testFiles, ['test/add.test.mjs']);
  assert.equal(sourceSnapshot(root).hash, before, 'every file, including the new helper, is restored');
  assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), fixed);
  assert.ok(!existsSync(join(root, `.cyc/runs/${id}/prove-backup`)), 'backup removed after an exact restore');
  assert.equal(nextRun(root, id).testProof.status, 'proven');
  build(root, id);
  const reviewed = final(root, id); reviewed.semanticReview.reviewer = 'unknown';
  assert.throws(() => finishRun(root, id, { summary: 'x', passedEvidence: 'y', assessment: reviewed }), /reviewer/);
  reviewed.semanticReview.reviewer = 'fresh-context';
  const result = finishRun(root, id, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: reviewed });
  assert.equal(result.finished, true);
  const review = readFileSync(join(root, result.reviewPath), 'utf8');
  assert.match(review, /Test proof \(must fail on the original code\): proven\./);
  assert.match(review, /reviewer: fresh-context/);
});

test('the proof backup stays outside the project, where test discovery cannot see it', t => {
  const { root, git } = repo(t);
  // Mimics a runner such as tap that collects every test-looking file under the project.
  const discovery = { id: 'discovery', command: process.execPath, args: ['-e', "const fs=require('fs'),p=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.name==='.git'?[]:e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);process.exit(walk('.').some(f=>/prove-backup|cyc-prove-/.test(f))?1:0);"] };
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8')); config.verification.commands.push(discovery);
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config)); git('commit', '-qam', 'discovery check');
  const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.deepEqual(proof.treatment.find(r => r.id === 'discovery'), { id: 'discovery', passed: true, exitCode: 0 });
});

test('a test that passes on the buggy code is rejected as unable to catch the change', t => {
  const { root } = repo(t); const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), weak);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const proof = proveRun(root, id);
  assert.equal(proof.passed, false);
  assert.match(proof.verdict, /would not catch/);
  build(root, id);
  assert.throws(() => finish(root, id), /Show the new tests catch this change.*would not catch/);
  assert.equal(readRun(root, id).failures, 0, 'the refusal happens before any verification run');
});

test('when the run-start code already fails the checks, TAP names attribute the new failing test; other output stays inconclusive', t => {
  const broken = 'export const add = undefined;\n'; // fails the existing smoke test
  const { root } = repo(t, { source: broken }); const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.equal(proof.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  assert.match(proof.verdict, /Check unit already failed there for other tests, which still fail and are not attributed to this change/);
  // The dot reporter prints no test names, so a check-level proof cannot attribute the failure.
  const dots = repo(t, { source: broken }).root;
  const config = JSON.parse(readFileSync(join(dots, '.cyc/config.json'), 'utf8'));
  config.verification.commands = [{ ...unitCheck, args: [unitCheck.args[0], unitCheck.args[1].replace("['--test']", "['--test', '--test-reporter=dot']")] }];
  writeFileSync(join(dots, '.cyc/config.json'), JSON.stringify(config));
  const dotId = run(dots, 'bug-fix');
  writeFileSync(join(dots, 'test/add.test.mjs'), catching);
  writeFileSync(join(dots, 'src/calc.mjs'), fixed);
  const unattributed = proveRun(dots, dotId);
  assert.equal(unattributed.passed, false);
  assert.match(unattributed.verdict, /Inconclusive/);
});

test('refactor tests must pass on the run-start code', t => {
  const { root } = repo(t, { source: fixed }); const id = run(root, 'refactor');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), 'export function add(a, b) { return a + b; }\n');
  const pinned = proveRun(root, id);
  assert.equal(pinned.passed, true, pinned.verdict);
  assert.equal(pinned.mode, 'green');
  writeFileSync(join(root, 'test/add.test.mjs'), catching.replace('5)', '6)'));
  assert.equal(nextRun(root, id).testProof.status, 'stale', 'editing a proven test invalidates the proof');
  const changed = proveRun(root, id);
  assert.equal(changed.passed, false);
  assert.match(changed.verdict, /assert new behavior/);
});

test('an edited test after a proof is proved again before verify', t => {
  const { root } = repo(t); const id = run(root, 'feature');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  assert.equal(proveRun(root, id).passed, true);
  writeFileSync(join(root, 'test/add.test.mjs'), catching + '\n');
  build(root, id);
  assert.equal(nextRun(root, id).testProof.status, 'stale');
  const result = finish(root, id);
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.ok(result.steps.includes('prove-red'), 'the stale proof was redone, not trusted');
  assert.equal(readRun(root, id).testProof.testFiles['test/add.test.mjs'], sourceSnapshot(root).files['test/add.test.mjs']);
});

test('an explicit exemption with a real reason is accepted; a placeholder is not', t => {
  const { root } = repo(t); const id = run(root, 'feature');
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  build(root, id);
  assert.throws(() => finish(root, id, { testProof: { status: 'exempt', reason: '<why>' } }), /placeholder at assessment\.testProof\.reason/);
  assert.throws(() => finish(root, id, { testProof: { status: 'skipped', reason: 'No reason worth recording.' } }), /testProof must be/);
  const result = finish(root, id, { testProof: { status: 'exempt', reason: 'Fixture: covered by an existing end-to-end suite outside this repository.' } });
  assert.equal(result.finished, true);
});

test('an untracked original is captured before edits and participates in actual proof with exact restoration', t => {
  const { root } = repo(t);
  writeFileSync(join(root, 'src/scratch.mjs'), 'export const y = 1;\n');
  const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'src/scratch.mjs'), 'export const y = 2;\n');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const before = sourceSnapshot(root).hash;
  assert.equal(proveRun(root, id).passed, true);
  assert.equal(sourceSnapshot(root).hash, before);
  assert.equal(readFileSync(join(root, 'src/scratch.mjs'), 'utf8'), 'export const y = 2;\n');
});

test('uncommitted edits present at run start are part of the run-start code', t => {
  const { root } = repo(t);
  writeFileSync(join(root, 'src/calc.mjs'), 'export const add = (a, b) => a * b;\n');
  const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), fixed);
});

test('CRLF checkouts with autocrlf recover the exact run-start bytes', t => {
  const { root, eol } = repo(t, { crlf: true }); const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), eol(catching));
  writeFileSync(join(root, 'src/calc.mjs'), eol(fixed));
  const before = sourceSnapshot(root).hash;
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.equal(sourceSnapshot(root).hash, before);
});

test('LF files committed under autocrlf, never re-checked-out, are recovered from the raw blob', t => {
  const { root } = repo(t, { crlf: true });
  // repo() wrote CRLF; rewrite as LF and recommit without checkout, as an editor or generator would.
  writeFileSync(join(root, 'src/calc.mjs'), buggy);
  spawnSync('git', ['-C', root, 'commit', '-qam', 'lf'], { encoding: 'utf8' });
  const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const before = sourceSnapshot(root).hash;
  const proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.equal(sourceSnapshot(root).hash, before);
});

test('proof refuses changes with no test or only tests', t => {
  const { root } = repo(t); const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  assert.throws(() => proveRun(root, id), /No new or changed test files/);
  const other = repo(t); const onlyTests = run(other.root, 'bug-fix');
  writeFileSync(join(other.root, 'test/add.test.mjs'), catching);
  assert.throws(() => proveRun(other.root, onlyTests), /Only test files changed/);
});

test('new plain and no-commit projects require actual proof and can complete without an exemption', t => {
  for (const gitMode of ['none', 'initial']) {
    const { root } = repo(t, { gitMode }), id = run(root, 'bug-fix');
    assert.equal(nextRun(root, id).testProof.status, 'missing');
    assert.equal(nextRun(root, id).testProof.required, true);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    build(root, id);
    const assessment = final(root, id); delete assessment.testProof;
    // Without an exemption, finish proves the new tests itself on the run-start code.
    const before = sourceSnapshot(root).hash;
    const result = finishRun(root, id, { summary: 'Actual original-code proof.', passedEvidence: 'Configured proof and current suite pass.', assessment });
    assert.equal(result.finished, true, JSON.stringify(result));
    assert.ok(result.steps.includes('prove-red'), gitMode);
    assert.equal(readRun(root, id).testProof.passed, true);
    assert.equal(sourceSnapshot(root).hash, before, 'the candidate is restored after the proof');
    assert.match(readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8'), /Test proof \(must fail on the original code\): proven\./);
  }
});

test('scoped capture reuses tracked originals in a nested project and excludes secrets and unrelated source', t => {
  const { root } = repo(t, { subdir: 'module Ω space' });
  writeFileSync(join(root, 'src/scratch.mjs'), 'export const y = 1;\n');
  writeFileSync(join(root, 'src/.env.local'), 'PRIVATE-CAPTURE-CONTROL');
  mkdirSync(join(root, 'src/generated')); writeFileSync(join(root, 'src/generated/input.txt'), 'input');
  writeFileSync(join(root, '.gitignore'), '.cyc/runs/\n.cyc/runtime/\nsrc/generated/\n');
  mkdirSync(join(root, 'notes')); writeFileSync(join(root, 'notes/unrelated.txt'), 'Do not capture this outside scope.');
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
  config.source = { include: ['src/generated/input.txt', 'src/.env.local'] };
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
  const id = startRun(root, { goal: 'Capture permitted originals.', playbook: 'bug-fix', allowedPaths: ['src', 'test/add.test.mjs'] }).runId;
  const state = readRun(root, id);
  assert.deepEqual([...state.sourceCapture.files].sort(), ['src/generated/input.txt', 'src/scratch.mjs']);
  assert.equal(state.sourceCapture.bytes, Buffer.byteLength('input') + Buffer.byteLength('export const y = 1;\n'));
  const blobs = readdirSync(join(root, `.cyc/runs/${id}/original-source`));
  assert.equal(blobs.length, 2); assert(blobs.every(name => /^[a-f0-9]{64}$/.test(name)));
  assert(blobs.every(name => !readFileSync(join(root, `.cyc/runs/${id}/original-source`, name), 'utf8').includes('PRIVATE-CAPTURE-CONTROL')));
});

test('missing or corrupted captured originals refuse proof before commands or source changes', t => {
  for (const damage of ['missing', 'corrupt']) {
    const { root } = repo(t, { gitMode: 'none' });
    const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
    config.verification.commands.unshift({ id: 'called', command: process.execPath, args: ['-e', "require('fs').mkdirSync('.cyc/runtime',{recursive:true});require('fs').writeFileSync('.cyc/runtime/check-called','called')"] });
    writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
    const id = run(root, 'bug-fix'), state = readRun(root, id);
    const original = join(root, `.cyc/runs/${id}/original-source/${state.initialSource.files['src/calc.mjs']}`);
    assert.equal(existsSync(original), true);
    writeFileSync(join(root, 'src/calc.mjs'), fixed); writeFileSync(join(root, 'test/add.test.mjs'), catching);
    if (damage === 'missing') unlinkSync(original); else writeFileSync(original, 'Wrong original bytes.');
    const before = sourceSnapshot(root).hash;
    assert.throws(() => proveRun(root, id));
    assert.equal(sourceSnapshot(root).hash, before);
    assert.equal(existsSync(join(root, '.cyc/runtime/check-called')), false);
    assert.equal(readRun(root, id).testProof, null);
  }
});

test('original capture refuses protected metadata even when shared history is writable', t => {
  for (const alias of process.platform === 'win32' ? ['junction', 'case'] : ['junction']) {
    const { root } = repo(t);
    const storage = join(root, 'protected-storage'); mkdirSync(storage);
    if (alias === 'junction') symlinkSync(storage, join(root, '.cyc/runs'), 'junction');
    const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
    config.protectedPaths = [alias === 'junction' ? 'protected-storage' : '.CYC/runs'];
    writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
    assert.throws(() => startRun(root, { goal: 'No protected metadata writes.', playbook: 'feature' }), /protected/i);
    assert.deepEqual(readdirSync(storage), []);
    if (alias === 'case') assert.equal(existsSync(join(root, '.cyc/runs')), false);
  }
});

test('serialized null-base runs without capture retain their original proof contract', t => {
  const { root } = repo(t, { gitMode: 'none' }), id = run(root, 'feature');
  const state = readRun(root, id); delete state.sourceCapture;
  // Explicit serialized legacy fixture, not a supported production state edit.
  writeFileSync(join(root, `.cyc/runs/${id}/state.json`), JSON.stringify(state));
  assert.equal(nextRun(root, id).testProof.status, 'unavailable');
  assert.equal(nextRun(root, id).testProof.required, false);
  writeFileSync(join(root, 'notes.md'), 'A note built by the legacy fixture; its source and tests are unchanged.\n');
  build(root, id);
  const assessment = final(root, id); delete assessment.testProof;
  assert.equal(finishRun(root, id, { summary: 'Legacy fixture unchanged.', passedEvidence: 'Original fixture contract.', assessment }).finished, true);
});

test('capture-backed proof preserves weak-test failing-control and refactor semantics without Git', t => {
  for (const scenario of [
    { source: buggy, tests: weak, mode: 'bug-fix', passed: false, verdict: /would not catch/ },
    // The existing smoke test already fails there; TAP names show the new test 'adds' fails too.
    { source: 'export const add = undefined;\n', tests: catching, mode: 'bug-fix', passed: true, verdict: /these tests fail on the run-start code: adds \(check unit\)\. Check unit already failed there for other tests/ },
    { source: fixed, tests: catching, mode: 'refactor', passed: true, verdict: /pin behavior/ }
  ]) {
    const { root } = repo(t, { gitMode: 'none', source: scenario.source }), id = run(root, scenario.mode);
    writeFileSync(join(root, 'src/calc.mjs'), scenario.mode === 'refactor' ? 'export function add(a, b) { return a + b; }\n' : fixed);
    writeFileSync(join(root, 'test/add.test.mjs'), scenario.tests);
    const before = sourceSnapshot(root).hash, proof = proveRun(root, id);
    assert.equal(proof.passed, scenario.passed, proof.verdict); assert.match(proof.verdict, scenario.verdict);
    assert.equal(sourceSnapshot(root).hash, before);
    if (!scenario.passed) {
      build(root, id); const assessment = final(root, id); delete assessment.testProof;
      assert.throws(() => finishRun(root, id, { summary: 'Reject invalid proof.', passedEvidence: 'Fixture.', assessment }), /Show the new tests catch/);
    }
  }
});

test('captured test originals do not become extra executable tests under recursive discovery', t => {
  const { root } = repo(t, { gitMode: 'none' });
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8'));
  const discovery = "delete process.env.NODE_TEST_CONTEXT;const fs=require('fs'),p=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);const tests=walk('.').filter(f=>f.endsWith('.test.mjs'));const r=require('child_process').spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});process.exit(r.status??1);";
  config.verification.commands = [{ id: 'recursive', command: process.execPath, args: ['-e', discovery], timeoutMs: 60000 }];
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
  const id = run(root, 'bug-fix');
  writeFileSync(join(root, 'src/calc.mjs'), fixed); writeFileSync(join(root, 'test/add.test.mjs'), catching);
  const before = sourceSnapshot(root).hash, proof = proveRun(root, id);
  assert.equal(proof.passed, true, proof.verdict);
  assert.equal(sourceSnapshot(root).hash, before);
  build(root, id); const assessment = final(root, id); delete assessment.testProof;
  assert.equal(finishRun(root, id, { summary: 'Recursive discovery preserves actual test set.', passedEvidence: 'Current recursive suite and proof pass.', assessment }).finished, true);
});

test('a failed Git working-tree snapshot captures scoped tracked originals instead of trusting HEAD', t => {
  const { root, git } = repo(t), branch = git('branch', '--show-current').trim();
  git('checkout', '-qb', 'fixture-side');
  writeFileSync(join(root, 'src/calc.mjs'), 'export const add = (a, b) => a * b;\n'); git('commit', '-qam', 'side');
  git('checkout', '-q', branch);
  writeFileSync(join(root, 'src/calc.mjs'), 'export const add = (a, b) => a / b;\n'); git('commit', '-qam', 'main');
  const merge = spawnSync('git', ['-C', root, 'merge', '--no-edit', 'fixture-side'], { encoding: 'utf8', windowsHide: true });
  assert.equal(merge.status, 1, 'fixture has a real unresolved merge');
  const original = readFileSync(join(root, 'src/calc.mjs'));
  const id = startRun(root, { goal: 'Retain actual conflicted original.', playbook: 'feature', allowedPaths: ['src'] }).runId;
  const state = readRun(root, id);
  assert.equal(state.base.trackedSnapshot, false);
  assert.deepEqual(state.sourceCapture.files, ['src/calc.mjs']);
  assert.deepEqual(readFileSync(join(root, `.cyc/runs/${id}/original-source/${state.initialSource.files['src/calc.mjs']}`)), original);
});

for (const flag of ['--assume-unchanged', '--skip-worktree']) {
  test(`tracked originals ignored by Git flags are captured and prove against actual run-start bytes: ${flag}`, t => {
    const { root, git } = repo(t, { source: fixed });
    git('update-index', flag, '--', 'src/calc.mjs');
    writeFileSync(join(root, 'src/calc.mjs'), buggy);
    const id = run(root, 'bug-fix'), state = readRun(root, id);
    assert.equal(state.base.trackedSnapshot, true, 'Git reports a successful working-tree snapshot');
    assert.deepEqual(state.sourceCapture.files, ['src/calc.mjs'], flag);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    const before = sourceSnapshot(root).hash, proof = proveRun(root, id);
    assert.equal(proof.passed, true, proof.verdict);
    assert.equal(sourceSnapshot(root).hash, before);
  });
}

async function interleavedProof(t, { phase = 'treatment', target = 'src/calc.mjs', action = 'edit', otherRun = false, previousProof = false } = {}) {
  const { root } = repo(t, { gitMode: 'none' });
  const command = `delete process.env.NODE_TEST_CONTEXT;const f=require('fs');const phase=f.existsSync('test/add.test.mjs')?'treatment':'control';const r=require('child_process').spawnSync(process.execPath,['--test'],{stdio:'inherit'});if(f.existsSync('.cyc/runtime/armed')&&phase===${JSON.stringify(phase)}&&!f.existsSync('.cyc/runtime/other-invocation')){f.writeFileSync('.cyc/runtime/ready','ready');const end=Date.now()+10000;while(!f.existsSync('.cyc/runtime/writer-done')){if(Date.now()>end)process.exit(22);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}process.exit(r.status??1);`;
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json')));
  config.verification.commands = [{ id: 'unit', command: process.execPath, args: ['-e', command], timeoutMs: 20000 }];
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
  const id = run(root, 'bug-fix');
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  // With an existing test file edited too, the proof still needs its control run, which is the
  // phase this variant interrupts.
  if (phase === 'control') writeFileSync(join(root, 'test/smoke.test.mjs'), `${smoke}// touched by this change\n`);
  if (target === 'src/new-helper.mjs') writeFileSync(join(root, target), 'export const value = 1;\n');
  if (previousProof) { assert.equal(proveRun(root, id).passed, true); build(root, id); assert.equal(verifyRun(root, id).passed, true); }
  let otherId;
  if (otherRun) { otherId = startRun(root, { goal: 'Verify the repaired candidate.', playbook: 'verify' }).runId; quickHandoff(root, otherId, { summary: 'Located candidate and checks.' }); }
  const otherBefore = otherId ? readFileSync(join(root, `.cyc/runs/${otherId}/state.json`), 'utf8') : null;
  const unexpected = target.startsWith('test/') ? catching + '// independent test edit\n' : fixed + '// independent source edit\n';
  const writer = `const f=require('fs'),p=require('path'),root=process.argv[1],target=p.join(root,process.argv[2]),end=Date.now()+15000;while(!f.existsSync(p.join(root,'.cyc/runtime/ready'))){if(Date.now()>end)process.exit(23);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}const finish=result=>{f.writeFileSync(p.join(root,'.cyc/runtime/writer-result.json'),JSON.stringify(result));f.writeFileSync(p.join(root,'.cyc/runtime/writer-done'),'done');};if(process.argv[4]){f.writeFileSync(p.join(root,'.cyc/runtime/other-invocation'),'true');import(require('url').pathToFileURL(process.argv[5])).then(r=>{let result,error;try{result=r.verifyRun(root,process.argv[4]);}catch(e){error=e.message;}finish({result,error});});}else{const action=process.argv[6];if(action==='manifest'){f.writeFileSync(target,process.argv[3]);const owner=JSON.parse(f.readFileSync(p.join(root,'.cyc/runs/workspace.lock'),'utf8')),manifest=p.join(owner.backupPath,'manifest.json');f.unlinkSync(manifest);f.mkdirSync(manifest);}else if(action==='delete')f.unlinkSync(target);else if(action==='directory'){f.unlinkSync(target);f.mkdirSync(target);f.writeFileSync(p.join(target,'keep.txt'),'independent directory');}else f.writeFileSync(target,process.argv[3]);finish({action});}`;
  writeFileSync(join(root, '.cyc/runtime/armed'), 'true');
  const child = spawn(process.execPath, ['-e', writer, root, target, unexpected, otherId ?? '', fileURLToPath(new URL('../scripts/runtime.mjs', import.meta.url)), action], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', data => { stderr += data; });
  t.after(() => child.kill());
  const closed = once(child, 'close');
  const result = proveRun(root, id);
  const [exitCode] = await closed;
  assert.equal(exitCode, 0, stderr);
  return { root, id, result, target, unexpected, otherId, otherBefore, writerResult: JSON.parse(readFileSync(join(root, '.cyc/runtime/writer-result.json'), 'utf8')) };
}

for (const phase of ['treatment', 'control']) {
  test(`proof preserves an independent source edit during ${phase} and retains safe recovery`, async t => {
    const { root, id, result, unexpected } = await interleavedProof(t, { phase, previousProof: true });
    assert.equal(result.passed, false);
    assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), unexpected);
    const state = readRun(root, id);
    assert.equal(state.status, 'halted'); assert.equal(state.testProof, null); assert.equal(state.verification, null);
    assert.deepEqual(state.proofRecovery.conflicts.map(item => item.path), ['src/calc.mjs']);
    const backup = state.proofRecovery.backupPath;
    assert.equal(readFileSync(join(backup, 'src/calc.mjs'), 'utf8'), fixed);
    const before = readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8');
    const recovery = recoverRun(root, id);
    assert.equal(recovery.nextAction.kind, 'inspect-proof-restore');
    assert.ok(recovery.nextAction.instruction.includes(backup));
    assert.match(recovery.nextAction.instruction, /compare|merge/i);
    assert.equal(recovery.verification.status, 'unverified');
    const review = readFileSync(join(root, `.cyc/runs/${id}/review.md`), 'utf8');
    assert.match(review, /Test proof: halted/); assert.ok(review.includes('Proof conflict src/calc.mjs'));
    assert.equal(readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8'), before);
    assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), unexpected);
    assert.ok(backup.startsWith(tmpdir()) && backup.includes('cyc-prove-'));
    rmSync(backup, { recursive: true, force: true });
  });
}

for (const scenario of [{ target: 'test/add.test.mjs', action: 'edit' }, { target: 'src/calc.mjs', action: 'delete' }, { target: 'src/new-helper.mjs', action: 'edit' }, { target: 'src/calc.mjs', action: 'directory' }, { target: 'src/calc.mjs', action: 'manifest' }]) {
  test(`proof keeps an unexpected ${scenario.action} at ${scenario.target} instead of overwriting it`, async t => {
    const { root, id, result, target, unexpected } = await interleavedProof(t, scenario);
    assert.equal(result.passed, false);
    const state = readRun(root, id); assert.equal(state.status, 'halted');
    assert.ok(state.proofRecovery.conflicts.some(item => item.path === target));
    if (scenario.action === 'delete') assert.equal(existsSync(join(root, target)), false);
    else if (scenario.action === 'directory') assert.equal(readFileSync(join(root, target, 'keep.txt'), 'utf8'), 'independent directory');
    else assert.equal(readFileSync(join(root, target), 'utf8'), unexpected);
    if (target !== 'src/calc.mjs') assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), fixed);
    if (scenario.action === 'manifest') {
      assert.match(state.proofRecovery.preservationError, /Could not update backup manifest/);
      assert.match(recoverRun(root, id).nextAction.instruction, /Could not update backup manifest/);
    }
    const backup = state.proofRecovery.backupPath;
    assert.ok(backup.startsWith(tmpdir()) && backup.includes('cyc-prove-'));
    rmSync(backup, { recursive: true, force: true });
  });
}

test('another controller cannot verify temporary proof source or spend its failure budget', async t => {
  const { root, id, result, otherId, otherBefore, writerResult } = await interleavedProof(t, { otherRun: true });
  assert.equal(result.passed, true, result.verdict);
  assert.match(writerResult.error, /project.*operation|workspace.*busy/i);
  assert.equal(readFileSync(join(root, `.cyc/runs/${otherId}/state.json`), 'utf8'), otherBefore);
  assert.equal(readRun(root, otherId).failures, 0);
  assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), fixed);
  assert.equal(readRun(root, id).testProof.passed, true);
});


test('a killed proof process leaves a durable candidate backup pointer and read-only recovery', async t => {
  const { root } = repo(t, { gitMode: 'none' });
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  const script = "const f=require('fs');f.writeFileSync('.cyc/runtime/crash-ready','ready');const end=Date.now()+15000;while(!f.existsSync('.cyc/runtime/crash-release')){if(Date.now()>end)process.exit(22);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}f.writeFileSync('.cyc/runtime/check-exited','done');process.exit(1);";
  const config = JSON.parse(readFileSync(join(root, '.cyc/config.json')));
  config.verification.commands = [{ id: 'blocked-check', command: process.execPath, args: ['-e', script], timeoutMs: 20000 }];
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
  const id = run(root, 'bug-fix'); writeFileSync(join(root, 'src/calc.mjs'), fixed); writeFileSync(join(root, 'test/add.test.mjs'), catching);
  const before = readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8');
  const code = "import{pathToFileURL}from'node:url';const r=await import(pathToFileURL(process.argv[1]));r.proveRun(process.argv[2],process.argv[3]);";
  const child = spawn(process.execPath, ['--input-type=module', '-e', code, fileURLToPath(new URL('../scripts/runtime.mjs', import.meta.url)), root, id], { windowsHide: true, stdio: 'ignore' });
  const closed = once(child, 'close');
  let backup;
  const cleanup = async () => {
    child.kill('SIGKILL');
    if (existsSync(root)) writeFileSync(join(root, '.cyc/runtime/crash-release'), 'release');
    const deadline = Date.now() + 3000;
    while (existsSync(join(root, '.cyc/runtime/crash-ready')) && !existsSync(join(root, '.cyc/runtime/check-exited')) && Date.now() < deadline) await new Promise(done => setTimeout(done, 20));
    if (backup) { assert.ok(backup.startsWith(tmpdir()) && backup.includes('cyc-prove-')); rmSync(backup, { recursive: true, force: true }); }
  };
  try {
    const deadline = Date.now() + 10000;
    while (!existsSync(join(root, '.cyc/runtime/crash-ready')) && child.exitCode === null && Date.now() < deadline) await new Promise(done => setTimeout(done, 20));
    assert.equal(existsSync(join(root, '.cyc/runtime/crash-ready')), true, 'proof reached its configured check');
    const owner = JSON.parse(readFileSync(join(root, '.cyc/runs/workspace.lock'), 'utf8')); backup = owner.backupPath;
    assert.equal(owner.runId, id); assert.equal(owner.phase, 'prepared');
    assert.equal(readFileSync(join(backup, 'src/calc.mjs'), 'utf8'), fixed);
    assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), buggy);
    child.kill('SIGKILL'); await closed;
    const lockBefore = readFileSync(join(root, '.cyc/runs/workspace.lock'), 'utf8');
    const recovery = recoverRun(root, id);
    assert.equal(recovery.nextAction.kind, 'wait-workspace'); assert.equal(recovery.verification.status, 'unverified');
    assert.equal(recovery.workspaceOperation.backupPath, backup);
    assert.ok(recovery.nextAction.instruction.includes(backup)); assert.match(recovery.nextAction.instruction, /compare and merge/);
    assert.equal(readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8'), before);
    assert.equal(readFileSync(join(root, '.cyc/runs/workspace.lock'), 'utf8'), lockBefore);
    assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), buggy, 'inspection performs no implicit rollback');
  } finally { await cleanup(); }
});


for (const publication of ['state', 'review']) {
  test(`failed proof ${publication} publication retains both locks and a discoverable backup`, t => {
    const { root } = repo(t, { gitMode: 'none' });
    mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
    const script = "const f=require('fs');const treatment=f.existsSync('test/add.test.mjs')&&f.readFileSync('src/calc.mjs','utf8').includes('a - b');if(treatment&&f.existsSync('.cyc/runtime/armed')){if(f.existsSync('.cyc/runs/workspace.lock'))f.writeFileSync('.cyc/runtime/owner.json',f.readFileSync('.cyc/runs/workspace.lock'));f.writeFileSync('src/calc.mjs',process.argv[1]);}process.exit(treatment?1:0);";
    const unexpected = fixed + '// independent edit before failed publication\n';
    const config = JSON.parse(readFileSync(join(root, '.cyc/config.json')));
    config.verification.commands = [{ id: 'check', command: process.execPath, args: ['-e', script, unexpected], timeoutMs: 10000 }];
    writeFileSync(join(root, '.cyc/config.json'), JSON.stringify(config));
    const id = run(root, 'bug-fix'); writeFileSync(join(root, 'src/calc.mjs'), fixed); writeFileSync(join(root, 'test/add.test.mjs'), catching);
    assert.equal(proveRun(root, id).passed, true); build(root, id); assert.equal(verifyRun(root, id).passed, true);
    writeFileSync(join(root, '.cyc/runtime/armed'), 'true');
    const originalRename = mutableFS.renameSync; let injected = false, thrown;
    const destination = join(root, `.cyc/runs/${id}/${publication === 'state' ? 'state.json' : 'review.md'}`);
    try {
      mutableFS.renameSync = (from, to) => {
        if (to === destination && !injected) { injected = true; const error = new Error(`Injected ${publication} publication EACCES`); error.code = 'EACCES'; throw error; }
        return originalRename(from, to);
      };
      syncBuiltinESMExports();
      try { proveRun(root, id); } catch (error) { thrown = error; }
    } finally { mutableFS.renameSync = originalRename; syncBuiltinESMExports(); }
    let backup;
    try {
      assert.equal(injected, true); assert.equal(thrown?.code, 'EACCES'); assert.match(thrown.message, /locks are retained/);
      assert.equal(existsSync(join(root, `.cyc/runs/${id}/state.json.lock`)), true);
      const owner = JSON.parse(readFileSync(join(root, '.cyc/runs/workspace.lock'), 'utf8')); backup = owner.backupPath;
      assert.equal(owner.publicationFailure.stateCommitted, publication === 'review');
      assert.equal(readFileSync(join(root, 'src/calc.mjs'), 'utf8'), unexpected);
      assert.equal(readFileSync(join(backup, 'src/calc.mjs'), 'utf8'), fixed);
      const state = readRun(root, id);
      assert.equal(state.status, publication === 'state' ? 'running' : 'halted');
      const before = readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8');
      const recovery = recoverRun(root, id);
      assert.equal(recovery.verification.status, 'unverified'); assert.equal(recovery.nextAction.kind, 'inspect-operation-commit');
      assert.ok(recovery.nextAction.instruction.includes(backup)); assert.match(recovery.nextAction.instruction, /old review/);
      assert.equal(readFileSync(join(root, `.cyc/runs/${id}/state.json`), 'utf8'), before);
      assert.throws(() => finish(root, id), /project.*CYC operation/);
    } finally {
      if (!backup && existsSync(join(root, '.cyc/runtime/owner.json'))) backup = JSON.parse(readFileSync(join(root, '.cyc/runtime/owner.json'), 'utf8')).backupPath;
      if (backup) { assert.ok(backup.startsWith(tmpdir()) && backup.includes('cyc-prove-')); rmSync(backup, { recursive: true, force: true }); }
    }
  });
}

// One-call flow: Scout recorded with the start, and a finish from Build that proves the new
// tests itself. The proof and the final checks still decide the outcome.
const scoutAssessment = () => ({
  context: { status: 'none', evidence: 'Fixture has no component history.', freshness: 'Nothing matched to revalidate.' },
  approach: { kind: 'repair', evidence: 'src/calc.mjs subtracts instead of adding.' },
  alignment: { status: 'clear', evidence: 'The brief says add returns the sum.' },
  consumers: [{ id: 'behavior', description: 'add(2, 3)', check: 'unit tests' }]
});
const oneCallFinal = () => ({
  semanticReview: { reviewer: 'self', intent: 'Only the operator changes.', consumers: 'add has no other callers.', conventions: 'Matches the module style.', findings: [] },
  consumerChecks: [{ id: 'behavior', result: 'pass', evidence: 'unit tests pass' }],
  learning: { status: 'none', reason: 'One-operator fix; nothing reusable.' },
  errorHistory: { status: 'recorded', reason: 'No failed attempt; the operator was wrong.' }
});
const startOneCall = root => startRun(root, { goal: 'Fix add.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'add works' }], allowedPaths: ['src', 'test'], scout: scoutAssessment(), plan: 'Repair the operator in add.' });

test('one call starts with Scout and one call finishes from Build: proof, checks, changed files, and error history', t => {
  const { root } = repo(t);
  const started = startOneCall(root);
  assert.equal(started.stage, 'build');
  // learning is recorded by the controller when left out; a bug fix's error history is the agent's.
  assert.deepEqual(Object.keys(started.assessmentTemplate), ['semanticReview', 'consumerChecks', 'errorHistory'], 'the finish template comes back with the start');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const result = finishRun(root, started.runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.deepEqual(result.steps, ['record build', 'prove-red', 'verify', 'record verify', 'record deliver', 'complete']);
  const state = readRun(root, started.runId);
  assert.equal(state.testProof.passed, true);
  assert.deepEqual(state.handoffs.find(item => item.stage === 'verify').artifacts.map(item => item.path), ['src/calc.mjs', 'test/add.test.mjs']);
  assert.ok(state.ledgerPath.startsWith(`.cyc/runs/${state.id}/`));
  assert.match(readFileSync(join(root, state.ledgerPath), 'utf8'), /No failed attempt; the operator was wrong\./);
});

test('one-call finish still stops at a test that cannot catch the change, before any verification', t => {
  const { root } = repo(t);
  const { runId } = startOneCall(root);
  writeFileSync(join(root, 'test/add.test.mjs'), weak);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const result = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() });
  assert.equal(result.finished, false);
  assert.equal(result.failedAt, 'prove-red');
  assert.match(result.verdict, /would not catch/);
  const state = readRun(root, runId);
  assert.equal(state.status, 'running');
  assert.equal(state.verification, null);
  assert.equal(nextRun(root, runId).stage, 'verify');
  // The same unchanged test is not proved again; the refusal names the failed proof.
  assert.throws(() => finishRun(root, runId, { summary: 'again', passedEvidence: 'x', assessment: oneCallFinal() }), /Show the new tests catch this change.*would not catch/);
});

test('one-call finish without a new test refuses at the proof instead of skipping it', t => {
  const { root } = repo(t);
  const { runId } = startOneCall(root);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  assert.throws(() => finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() }), /stopped at prove-red: No new or changed test files/);
  assert.notEqual(readRun(root, runId).status, 'complete');
});

test('an invalid scout at start creates no run', t => {
  const { root } = repo(t);
  const placeholder = scoutAssessment(); placeholder.approach.evidence = '<existing code you found>';
  const base = { goal: 'Fix add.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'add works' }] };
  assert.throws(() => startRun(root, { ...base, scout: placeholder, plan: 'Repair it.' }), /placeholder/);
  assert.throws(() => startRun(root, { ...base, scout: scoutAssessment() }), /needs plan/);
  assert.throws(() => startRun(root, { ...base, playbook: 'plan', scout: scoutAssessment(), plan: 'x' }), /not Scout/);
  const runs = existsSync(join(root, '.cyc/runs')) ? readdirSync(join(root, '.cyc/runs'), { withFileTypes: true }).filter(entry => entry.isDirectory()) : [];
  assert.equal(runs.length, 0);
});

test('a project check that fails before any change is accepted in finish; the run completes and discloses it', t => {
  const { root } = repo(t);
  // Like semver's postlint template check: red on the untouched project, unrelated to the task.
  const drift = { id: 'posttest', command: process.execPath, args: ['-e', "console.log('The repo file .github/dependabot.yml needs to be updated');process.exit(1)"] };
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [unitCheck, drift] } }));
  const { runId } = startOneCall(root);
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const history = { status: 'none', reason: 'Cause: add subtracted. Fix: use +. No failed attempts.' };
  const input = acceptFailures => ({ summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: { ...oneCallFinal(), errorHistory: history }, acceptFailures });
  // Refused before anything runs: an unknown check.
  assert.throws(() => finishRun(root, runId, input([{ check: 'nope', reason: 'x' }])), /acceptFailures lists checks/);
  // An entry for the unit check, which passed on the run-start code, is dropped with a note rather than
  // refused; verify still requires it to pass (test/cost-cuts.test.mjs pins both).
  const result = finishRun(root, runId, input([{ check: 'posttest', reason: 'Template drift in .github before this task.' }]));
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.equal(result.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  assert.deepEqual(result.acceptedPreexistingFailures, [{ check: 'posttest', reason: 'Template drift in .github before this task.' }]);
  const state = readRun(root, runId);
  assert.equal(state.verification.verificationStatus, 'passed-with-accepted-failures');
  // A bug fix's "none" with the cause in the reason is recorded in the run's own ledger, word for word.
  assert.equal(state.handoffs.at(-1).assessment.errorHistory.status, 'recorded');
  assert.match(readFileSync(join(root, state.ledgerPath), 'utf8'), /Cause: add subtracted\. Fix: use \+\./);
  assert.match(readFileSync(join(root, `.cyc/runs/${runId}/review.md`), 'utf8'), /posttest: failed, as it did on the run-start code; accepted: Template drift/);
});

test('a suite that already has a failing test: the proof names the new tests, and the old failure is accepted, a new one not', t => {
  // Like recipe-metric's RS-142: one test in the same node --test suite fails before any change.
  const legacy = "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('keeps accented letters', () => assert.fail('owned by another team'));\n";
  const setup = () => {
    const { root, git } = repo(t);
    writeFileSync(join(root, 'test/slug.test.mjs'), legacy); git('add', '-A'); git('commit', '-qm', 'slug');
    const { runId } = startOneCall(root);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    return { root, runId };
  };
  const input = acceptFailures => ({ summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures });
  const { root, runId } = setup();
  // Without accepting it, verification stops and names the check that also failed at the run start.
  const stopped = finishRun(root, runId, input([]));
  assert.equal(stopped.failedAt, 'verify');
  assert.deepEqual(stopped.failedAtRunStart, ['unit']);
  // A decision still to make is not a failed fix, the first time; an unchanged retry is counted.
  assert.equal(readRun(root, runId).failures, 0);
  assert.ok(readRun(root, runId).history.some(item => item.type === 'awaiting-acceptance'));
  assert.equal(finishRun(root, runId, input([])).failedAt, 'verify');
  assert.equal(readRun(root, runId).failures, 1);
  const done = finishRun(root, runId, input([{ check: 'unit', reason: 'keeps accented letters fails before this task (owned by another team).' }]));
  assert.equal(done.finished, true, JSON.stringify(done));
  assert.equal(done.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  assert.equal(readRun(root, runId).verification.verificationStatus, 'passed-with-accepted-failures');
  // A new failing test in the same suite is not excused.
  const other = setup();
  writeFileSync(join(other.root, 'test/extra.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('still broken', () => assert.fail('new'));\n");
  const refused = finishRun(other.root, other.runId, input([{ check: 'unit', reason: 'keeps accented letters fails before this task.' }]));
  assert.equal(refused.failedAt, 'verify');
  assert.match(refused.acceptedFailuresThatChanged[0].newFailingTests.join(' '), /still broken/);
});

// The fresh-context review of the first TAP version found each of these accepted as a pass.
test('TAP review cases: collisions, changed causes, renamed old failures, cut-off output, and repeated stops are refused', t => {
  const H = "import test, { describe, it } from 'node:test';\nimport assert from 'node:assert/strict';\n";
  const project = files => {
    const { root, git } = repo(t);
    for (const [path, body] of Object.entries(files)) writeFileSync(join(root, path), body);
    git('add', '-A'); git('commit', '-qm', 'fixture');
    return { root, runId: startOneCall(root).runId };
  };
  const accept = [{ check: 'unit', reason: 'The legacy test fails before this task.' }];
  const input = acceptFailures => ({ summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures });
  // S1: a test elsewhere with the same name as the accepted failure now fails too.
  const s1 = project({ 'src/calc.mjs': buggy + 'export const zero = () => null;\n', 'test/smoke.test.mjs': H + "import { zero } from '../src/calc.mjs';\ntest('returns null', () => assert.equal(zero(), null));\n", 'test/slug.test.mjs': H + "test('returns null', () => assert.fail('owned by another team'));\n" });
  writeFileSync(join(s1.root, 'test/add.test.mjs'), catching);
  writeFileSync(join(s1.root, 'src/calc.mjs'), fixed + 'export const zero = () => 0;\n');
  const r1 = finishRun(s1.root, s1.runId, input(accept));
  assert.equal(r1.failedAt, 'verify');
  assert.match(r1.acceptedFailuresThatChanged[0].newFailingTests.join(' '), /returns null/);
  // S2: the accepted test now fails for a new reason, thrown from changed source.
  const s2 = project({ 'src/calc.mjs': buggy + 'export const slug = s => s;\n', 'test/slug.test.mjs': H + "import { slug } from '../src/calc.mjs';\ntest('keeps accented letters', () => assert.equal(slug('é'), 'e'));\n" });
  writeFileSync(join(s2.root, 'test/add.test.mjs'), catching);
  writeFileSync(join(s2.root, 'src/calc.mjs'), fixed + "export const slug = s => { throw new TypeError('boom in calc'); };\n");
  const r2 = finishRun(s2.root, s2.runId, input(accept));
  assert.equal(r2.failedAt, 'verify');
  assert.deepEqual(r2.acceptedFailuresThatChanged[0].changedErrors, ['keeps accented letters']);
  assert.deepEqual(r2.acceptedFailuresThatChanged[0].files, ['src/calc.mjs']);
  // S5: wrapping the old failing test in describe does not make a weak new test prove the change.
  const legacy = "test('keeps accented letters', () => assert.fail('owned by another team'));\n";
  const s5 = project({ 'test/slug.test.mjs': H + legacy });
  writeFileSync(join(s5.root, 'test/slug.test.mjs'), H + "describe('slug', () => {\n" + legacy.replace('test(', 'it(') + '});\n');
  writeFileSync(join(s5.root, 'test/add.test.mjs'), weak);
  writeFileSync(join(s5.root, 'src/calc.mjs'), fixed);
  const p5 = proveRun(s5.root, s5.runId);
  assert.equal(p5.passed, false, p5.verdict);
  assert.match(p5.verdict, /Inconclusive/);
  // S6: in output longer than the kept tail, an old failure early in it is still seen as old
  // (through the stored summary), so it is not attributed to the new tests.
  const pad = 'x'.repeat(70);
  const s6 = project({ 'test/a-legacy.test.mjs': H + "describe('legacy', () => {\n  for (let i = 0; i < 100; i++) it('passing ' + i + ' " + pad + "', () => {});\n  it('fails', () => assert.fail('old'));\n});\n" });
  writeFileSync(join(s6.root, 'test/z-new.test.mjs'), H + "import { add } from '../src/calc.mjs';\nfor (let i = 0; i < 60; i++) test('returns a number ' + i + ' " + pad + "', () => assert.equal(typeof add(2, 3), 'number'));\n");
  writeFileSync(join(s6.root, 'src/calc.mjs'), fixed);
  assert.equal(proveRun(s6.root, s6.runId).passed, false);
  // S4: only the first stop that awaits acceptance is free, however the source changes between tries.
  const s4 = project({ 'test/slug.test.mjs': H + legacy });
  writeFileSync(join(s4.root, 'test/add.test.mjs'), catching);
  for (let i = 0; i < 3; i++) {
    writeFileSync(join(s4.root, 'src/calc.mjs'), fixed + `// attempt ${i}\n`);
    assert.equal(finishRun(s4.root, s4.runId, input([])).failedAt, 'verify');
  }
  const s4state = readRun(s4.root, s4.runId);
  assert.equal(s4state.history.filter(item => item.type === 'awaiting-acceptance').length, 1);
  assert.equal(s4state.failures, 2);
});

test('the CLI hint names accepting only while it can still help', t => {
  const H = "import test from 'node:test';\nimport assert from 'node:assert/strict';\n";
  const { root, git } = repo(t);
  writeFileSync(join(root, 'test/slug.test.mjs'), H + "test('keeps accented letters', () => assert.fail('owned by another team'));\n"); git('add', '-A'); git('commit', '-qm', 'slug');
  const { runId } = startOneCall(root);
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  const file = join(root, '.cyc/runtime/finish.json');
  writeFileSync(file, JSON.stringify({ runId, summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() }));
  const finish = () => JSON.parse(spawnSync(process.execPath, [join(fileURLToPath(new URL('..', import.meta.url)), 'bin/cyc.mjs'), 'run', 'finish', '--file', file], { cwd: root, encoding: 'utf8' }).stdout);
  const first = finish();
  assert.equal(first.awaitingAcceptance, true);
  assert.match(first.hint, /^unit also failed on the run-start code\. If it is unrelated to this change, add "acceptFailures"/);
  let last = first;
  for (let i = 0; i < 3 && last.status === 'running'; i++) last = finish();
  assert.equal(last.status, 'exhausted');
  assert.doesNotMatch(last.hint, /run finish again/);
});

test('an invalid background baseline does not hide the proof control, and only a current proof is quoted', t => {
  const { root } = repo(t);
  const drift = { id: 'posttest', command: process.execPath, args: ['-e', "console.log('template drift');process.exit(1)"] };
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { baseline: true, commands: [unitCheck, drift] } }));
  process.env.CYC_BASELINE_MODE = 'sync';
  let runId;
  try { ({ runId } = startRun(root, { goal: 'Fix add.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'add works' }], allowedPaths: ['src', 'test'], scout: scoutAssessment(), plan: 'Repair the operator in add.' })); }
  finally { process.env.CYC_BASELINE_MODE = 'off'; }
  // As when an edit starts while the background baseline is still measuring.
  const baselineFile = join(root, `.cyc/runs/${runId}/baseline.json`);
  writeFileSync(baselineFile, JSON.stringify({ ...JSON.parse(readFileSync(baselineFile, 'utf8')), status: 'invalid', reason: 'Project files changed while the baseline was measured.' }));
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const proof = proveRun(root, runId);
  assert.equal(proof.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  const result = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures: [{ check: 'posttest', reason: 'Template drift before this task.' }] });
  assert.equal(result.finished, true, JSON.stringify(result));
  assert.ok(result.proofClaim);
  // A proof whose tests changed afterwards is not quoted.
  const other = repo(t).root;
  const second = startOneCall(other).runId;
  writeFileSync(join(other, 'test/add.test.mjs'), catching);
  writeFileSync(join(other, 'src/calc.mjs'), fixed);
  proveRun(other, second);
  writeFileSync(join(other, 'test/add.test.mjs'), catching.replace('adds', 'adds two numbers'));
  const exempt = finishRun(other, second, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: { ...oneCallFinal(), testProof: { status: 'exempt', reason: 'Renamed the test only; the earlier proof covered the behavior.' } } });
  assert.equal(exempt.finished, true, JSON.stringify(exempt));
  assert.equal(exempt.proofClaim, undefined);
});

test('after a failed attempt, error history "none" is refused even with a run-local ledger', t => {
  const { root } = repo(t);
  const { runId } = startRun(root, { goal: 'Make add correct.', playbook: 'feature', criteria: [{ id: 'c1', description: 'add works' }], allowedPaths: ['src', 'test'], scout: scoutAssessment(), plan: 'Repair the operator in add.' });
  assert.ok(readRun(root, runId).ledgerPath.startsWith(`.cyc/runs/${runId}/`), 'the run keeps its own ledger');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  // The test is proven, but the first change is still wrong: verification fails once.
  writeFileSync(join(root, 'src/calc.mjs'), 'export const add = (a, b) => a * b;\n');
  assert.equal(finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() }).failedAt, 'verify');
  assert.equal(readRun(root, runId).failures, 1);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  assert.throws(() => finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: { ...oneCallFinal(), errorHistory: { status: 'none', reason: 'Nothing went wrong.' } } }),
    /need error-history evidence: set errorHistory\.status to "recorded"/);
});

test('with a project ledger, a bug fix still needs recorded error history, and the refusal says how', t => {
  const { root } = repo(t);
  const { runId } = startRun(root, { goal: 'Fix add.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'add works' }], allowedPaths: ['src', 'test', 'docs/context'], scout: scoutAssessment(), plan: 'Repair the operator in add.' });
  assert.equal(readRun(root, runId).ledgerPath, 'docs/context/error-ledger.md');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  assert.throws(() => finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: { ...oneCallFinal(), errorHistory: { status: 'none', reason: 'No failed attempts.' } } }),
    /set errorHistory\.status to "recorded".*docs\/context\/error-ledger\.md in artifacts/);
});

test('without a background baseline, accept-failure asks for the proof, whose control run is the baseline', t => {
  const { root } = repo(t);
  const { runId } = startOneCall(root);
  assert.throws(() => acceptFailure(root, runId, { check: 'unit', reason: 'x' }), /Run prove-red first/);
});

test('a no-history Scout that lists the files it read keeps "none" and records them as read', t => {
  const { root } = repo(t);
  const base = { goal: 'Fix add.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'add works' }], allowedPaths: ['src', 'test'], plan: 'Repair the operator in add.' };
  const scout = scoutAssessment(); scout.context.sources = ['src/calc.mjs', '.\\test\\add.test.mjs']; scout.context.read = ['src/calc.mjs'];
  const { runId } = startRun(root, { ...base, scout });
  const context = readRun(root, runId).handoffs.find(item => item.stage === 'scout').assessment.context;
  assert.equal(context.status, 'none');
  assert.deepEqual(context.sources, []);
  assert.deepEqual(context.read, ['src/calc.mjs', 'test/add.test.mjs']);
  assert.match(readFileSync(join(root, `.cyc/runs/${runId}/review.md`), 'utf8'), /- Sources: none; read: src\/calc\.mjs, test\/add\.test\.mjs/);
  // Claiming used context still needs its sources, and read files must be paths.
  const other = repo(t).root;
  const used = scoutAssessment(); used.context.status = 'used'; used.context.sources = [];
  assert.throws(() => startRun(other, { ...base, scout: used }), /context\.sources needs at least one/);
  for (const path of ['', '/etc/passwd', '../../other-repo/secret.txt', 'C:\\Windows\\win.ini', 'src/./calc.mjs']) {
    const outside = scoutAssessment(); outside.context.read = [path];
    assert.throws(() => startRun(other, { ...base, scout: outside }), /context\.read needs an array of project-relative paths/, path);
  }
});

test('the generated error history is written only after the finish input passes, and follows the final reason', t => {
  const { root } = repo(t);
  const { runId } = startOneCall(root);
  const ledger = join(root, readRun(root, runId).ledgerPath);
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const draft = oneCallFinal(); draft.errorHistory.reason = 'FIRST DRAFT: guessed cause'; delete draft.learning.reason;
  assert.throws(() => finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: draft }), /learning disposition/);
  assert.equal(existsSync(ledger), false, 'a refused finish writes nothing');
  const result = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() });
  assert.equal(result.finished, true, JSON.stringify(result));
  const written = readFileSync(ledger, 'utf8');
  assert.match(written, /No failed attempt; the operator was wrong\./);
  assert.doesNotMatch(written, /FIRST DRAFT/);
});

test('an agent-written error history is never replaced', t => {
  const { root } = repo(t);
  const { runId } = startOneCall(root);
  const path = readRun(root, runId).ledgerPath;
  writeFileSync(join(root, path), '# My own entry\n\nOperator typo found by reading the diff.\n');
  writeFileSync(join(root, 'test/add.test.mjs'), catching);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  const assessment = oneCallFinal(); assessment.errorHistory.artifacts = [path];
  assert.equal(finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment }).finished, true);
  assert.equal(readFileSync(join(root, path), 'utf8'), '# My own entry\n\nOperator typo found by reading the diff.\n');
});

test('absolute in-project assessment paths are accepted as project-relative', t => {
  const { root } = repo(t);
  const scout = scoutAssessment();
  scout.context = { status: 'used', evidence: 'Read the module.', freshness: 'Current file.', sources: [join(root, 'src', 'calc.mjs')] };
  const { runId } = startRun(root, { goal: 'Fix add.', playbook: 'bug-fix', criteria: [{ id: 'c1', description: 'add works' }], allowedPaths: ['src', 'test'], scout, plan: 'Repair the operator.' });
  assert.deepEqual(readRun(root, runId).handoffs.find(item => item.stage === 'scout').assessment.context.sources, ['src/calc.mjs']);
});
