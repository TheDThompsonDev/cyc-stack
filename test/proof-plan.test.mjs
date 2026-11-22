import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
const put = (root, path, data) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), data); };
function folder(t) { const root = mkdtempSync(join(tmpdir(), 'cyc-plan-')); t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-plan-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }); return root; }
const nodeTests = paths => ['-e', `delete process.env.NODE_TEST_CONTEXT; const r=require('node:child_process').spawnSync(process.execPath,${JSON.stringify(['--test', '--test-reporter=tap', ...paths])},{stdio:'inherit'});process.exit(r.status??1)`];
test('focused proof is frozen and role-distinct; broad original evidence is measured before excusing a broad failure', t => {
  const root = folder(t);
  put(root, 'feature.mjs', 'export const feature=()=>0;');
  put(root, 'test/original.test.mjs', "import test from 'node:test';import assert from 'node:assert/strict';import {feature} from '../feature.mjs';test('existing numeric result',()=>assert.equal(typeof feature(),'number'));");
  const lint = { id: 'lint', command: process.execPath, args: ['-e', "const f=require('node:fs');f.mkdirSync('.cyc/runtime',{recursive:true});f.appendFileSync('.cyc/runtime/lint-count','x');console.error('known unrelated lint failure');process.exit(1)"] };
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'tests', command: process.execPath, args: nodeTests([]) }, lint] } }));
  const plan = [{ id: 'regression', command: process.execPath, args: nodeTests(['test/new.test.mjs']) }];
  const id = runtime.startRun(root, { goal: 'Focused proof, broad final coverage.', playbook: 'feature', proofCommands: plan }).runId;
  plan[0].args = ['-e', 'process.exit(0)'];
  assert.notDeepEqual(runtime.readRun(root, id).proofCommands, plan, 'run-start command plan is copied, not a caller reference');
  runtime.quickHandoff(root, id, { summary: 'Trace public feature.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') });
  put(root, 'feature.mjs', 'export const feature=()=>1;');
  put(root, 'test/new.test.mjs', "import test from 'node:test';import assert from 'node:assert/strict';import {feature} from '../feature.mjs';test('feature returns one',()=>assert.equal(feature(),1));");
  runtime.quickHandoff(root, id, { summary: 'Built feature.', artifacts: ['feature.mjs', 'test/new.test.mjs'] });
  const first = runtime.proveRun(root, id); assert.equal(first.passed, true);
  const firstReceipt = JSON.parse(readFileSync(join(root, first.receiptPath)));
  assert.equal(firstReceipt.focused, true); assert.equal(firstReceipt.treatment.length, 1); assert.equal(firstReceipt.roles.treatment, 'original-plus-new-tests');
  assert.equal(existsSync(join(root, '.cyc/runtime/lint-count')), false, 'broad lint did not execute as red proof');
  assert.throws(() => runtime.acceptFailure(root, id, { check: 'lint', reason: 'Known fixture failure.' }), /no measurement|measure|baseline/i);
  const measured = runtime.proveRun(root, id, { measureOriginal: true });
  const measuredReceipt = JSON.parse(readFileSync(join(root, measured.receiptPath)));
  assert.equal(measuredReceipt.reusedTreatmentFrom, first.receiptPath);
  assert.equal(measuredReceipt.roles.broadControl, 'original-only-broad'); assert.equal(measuredReceipt.broadControl.length, 2);
  runtime.acceptFailure(root, id, { check: 'lint', reason: 'Unchanged unrelated fixture lint failure, measured on originals.' });
  const candidate = runtime.verifyRun(root, id);
  assert.equal(candidate.passed, true, JSON.stringify(candidate)); assert.equal(candidate.role, 'candidate'); assert.equal(candidate.results.length, 2);
  assert.equal(readFileSync(join(root, '.cyc/runtime/lint-count'), 'utf8'), 'xx', 'one broad original and one broad candidate; no omitted final check');
});
test('only explicitly deterministic compatible candidate receipts reuse; source, dependency and environment changes invalidate', t => {
  const root = folder(t); put(root, 'dependency.txt', 'dependency-v1');
  const command = { id: 'local', command: process.execPath, args: ['-e', "require('node:assert/strict').equal(process.env.CODEX_TOOL_CALL_ID,undefined);const f=require('node:fs');f.mkdirSync('.cyc/runtime',{recursive:true});f.appendFileSync('.cyc/runtime/count','x')"], reuse: { kind: 'local-deterministic', inputs: ['dependency.txt'] } };
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [command] } }));
  const id = runtime.startRun(root, { goal: 'Check candidate receipt freshness.', playbook: 'verify' }).runId;
  runtime.quickHandoff(root, id, { summary: 'Known local deterministic check and dependencies.' });
  const first = runtime.verifyRun(root, id); assert.equal(first.reusable, true);
  const savedTransport = process.env.CODEX_TOOL_CALL_ID; process.env.CODEX_TOOL_CALL_ID = 'new-tool-invocation';
  try { assert.equal(runtime.verifyRun(root, id).reused, true); } finally { if (savedTransport === undefined) delete process.env.CODEX_TOOL_CALL_ID; else process.env.CODEX_TOOL_CALL_ID = savedTransport; }
  const savedEnv = process.env.CYC_INPUT_DRIFT; process.env.CYC_INPUT_DRIFT = 'changed-after-verification';
  try { assert.throws(() => runtime.quickHandoff(root, id, { summary: 'Stale environment cannot complete.', passedEvidence: 'Observed', assessment: fixtureAssessment(runtime.readRun(root, id), 'verify') }), /inputs changed/); }
  finally { if (savedEnv === undefined) delete process.env.CYC_INPUT_DRIFT; else process.env.CYC_INPUT_DRIFT = savedEnv; }
  assert.equal(runtime.verifyRun(root, id).reused, true); assert.equal(readFileSync(join(root, '.cyc/runtime/count'), 'utf8'), 'x');
  put(root, 'dependency.txt', 'dependency-v2'); assert.notEqual(runtime.verifyRun(root, id).reused, true);
  put(root, 'test/new.test.mjs', '// new relevant test input'); assert.notEqual(runtime.verifyRun(root, id).reused, true);
  const previous = process.env.CYC_REUSE_FIXTURE; process.env.CYC_REUSE_FIXTURE = 'changed';
  try { assert.notEqual(runtime.verifyRun(root, id).reused, true); } finally { if (previous === undefined) delete process.env.CYC_REUSE_FIXTURE; else process.env.CYC_REUSE_FIXTURE = previous; }
  assert.equal(readFileSync(join(root, '.cyc/runtime/count'), 'utf8'), 'xxxx');
  const state = runtime.readRun(root, id); state.verification.role = 'original-only'; runtime.atomicJSON(join(root, '.cyc/runs', id, 'state.json'), state);
  assert.throws(() => runtime.quickHandoff(root, id, { summary: 'Reject foreign measurement role.', passedEvidence: 'Observed', assessment: fixtureAssessment(state, 'verify') }), /candidate verification receipt/);
});

// ---------- a focused proof command that names test files this change adds ----------

// Literal test-file arguments, as an agent writes them in proofCommands. The fixture reaches
// node --test through -e only to drop the inherited test-runner context.
const runner = (paths, reporter = 'tap') => ['-e', `delete process.env.NODE_TEST_CONTEXT; const r=require('node:child_process').spawnSync(process.execPath,['--test','--test-reporter=${reporter}',...process.argv.slice(1)],{stdio:'inherit'});process.exit(r.status??1)`, ...paths];
const head = "import test from 'node:test';import assert from 'node:assert/strict';";
const existingTest = `${head}import {feature} from '../feature.mjs';test('existing numeric result',()=>assert.equal(typeof feature(),'number'));`;
const returnsOne = `${head}import {feature} from '../feature.mjs';test('feature returns one',()=>assert.equal(feature(),1));`;
function focused(t, plan, { source = 'export const feature=()=>0;', files = {} } = {}) {
  const root = folder(t);
  put(root, 'feature.mjs', source);
  put(root, 'test/original.test.mjs', existingTest);
  for (const [path, data] of Object.entries(files)) put(root, path, data);
  put(root, '.cyc/config.json', JSON.stringify({ verification: { commands: [{ id: 'tests', command: process.execPath, args: nodeTests([]) }] } }));
  const id = runtime.startRun(root, { goal: 'Focused proof that names test files.', playbook: 'feature', proofCommands: plan }).runId;
  runtime.quickHandoff(root, id, { summary: 'Trace public feature.', assessment: fixtureAssessment(runtime.readRun(root, id), 'scout') });
  return { root, id };
}
const receiptOf = (root, proof) => JSON.parse(readFileSync(join(root, proof.receiptPath)));
// A wrapper that runs the test files it is given, and decides by its first argument what to do
// when one of them does not exist: exit 1 with a message, exit 0 in silence, wait, or print more
// than the controller keeps. In every case it prints no test results then.
const gate = "const fs=require('node:fs'),[mode,...files]=process.argv.slice(2);if(files.some(file=>!fs.existsSync(file))){if(mode==='hang')Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);if(mode==='flood')console.log('x'.repeat(40000));if(mode!=='quiet')console.error('missing test file');process.exit(mode==='quiet'?0:1)}delete process.env.NODE_TEST_CONTEXT;const r=require('node:child_process').spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{stdio:'inherit'});process.exit(r.status??1)";
function finishWithProof(root, id) {
  runtime.quickHandoff(root, id, { summary: 'Built feature.' });
  const state = runtime.readRun(root, id), assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  delete assessment.testProof; // finish must prove the new tests itself, not accept an exemption
  return runtime.finishRun(root, id, { summary: 'Feature built.', passedEvidence: 'Focused proof and the configured suite.', assessment });
}

test('a proof command that names only test files this change adds proves red through finish; its control is read as nothing to run', t => {
  const cases = [
    // The new test imports an export the run-start code lacks, so the runner prints a load error
    // beside its results. That output sends the proof to a control with no file to run.
    ['the new test needs a missing export', ['test/new.test.mjs'], root => {
      put(root, 'feature.mjs', 'export const feature=()=>1;export const extra=()=>2;');
      put(root, 'test/new.test.mjs', `${head}import {extra} from '../feature.mjs';test('extra returns two',()=>assert.equal(extra(),2));`);
    }, /new\.test\.mjs/],
    // An existing test file is edited too, so the change does not only add test files.
    ['an existing test file is also edited', ['./test/new.test.mjs'], root => {
      put(root, 'feature.mjs', 'export const feature=()=>1;');
      put(root, 'test/new.test.mjs', returnsOne);
      put(root, 'test/original.test.mjs', `${existingTest}// reworded by this change`);
    }, /feature returns one/]
  ];
  for (const [label, paths, build, named] of cases) {
    const { root, id } = focused(t, [{ id: 'focused', command: process.execPath, args: runner(paths) }]);
    build(root);
    const result = finishWithProof(root, id);
    assert.equal(result.finished, true, `${label}: ${JSON.stringify(result)}`);
    assert.ok(result.steps.includes('prove-red'), label);
    const proof = runtime.readRun(root, id).testProof, receipt = receiptOf(root, proof);
    assert.equal(proof.passed, true, label);
    assert.match(proof.verdict, named, label);
    assert.match(proof.verdict, /On the run-start code alone, check focused printed no test results, so no test failed there before and its exit is read as nothing to run/, label);
    assert.doesNotMatch(proof.verdict, /already failed there/, label);
    // The control ran and its failed result is kept: nothing about the run-start code is assumed.
    assert.equal(receipt.controlSource, 'in place', label);
    assert.deepEqual(receipt.control.map(({ id: check, passed, exitCode }) => ({ check, passed, exitCode })), [{ check: 'focused', passed: false, exitCode: 1 }], label);
    assert.deepEqual(receipt.controlWithoutTests, { focused: ['test/new.test.mjs'] }, label);
  }
});

test('a missing file, a mistyped path, unnamed output and a real earlier failure stay inconclusive', t => {
  const edit = root => { put(root, 'feature.mjs', 'export const feature=()=>1;'); put(root, 'test/new.test.mjs', returnsOne); };
  const legacy = `${head}test('legacy rounding',()=>assert.equal(1,2));`;
  // Also edits an existing test file, so the older skip does not apply and the control runs.
  const editBoth = root => { edit(root); put(root, 'test/original.test.mjs', `${existingTest}// reworded by this change`); };
  const cases = [
    // The existing test already fails on the run-start code and the dot reporter names nothing.
    ['a real earlier failure with unnamed output', runner(['test/original.test.mjs', 'test/new.test.mjs'], 'dot'), edit, { source: "export const feature=()=>'zero';" }],
    ['a typo in an existing file\'s path', runner(['test/orignal.test.mjs']), edit],
    ['a named file the change never creates', runner(['test/new.test.mjs']), root => { put(root, 'feature.mjs', 'export const feature=()=>1;'); put(root, 'test/nwe.test.mjs', returnsOne); }],
    // A test file deleted in the same change may have moved: a test that already failed at its old
    // path would look new, so a control without test results cannot stand for nothing to run.
    ['a new file beside a deleted test file', runner(['test/new.test.mjs']), root => { edit(root); rmSync(join(root, 'test/original.test.mjs')); }],
    // The failure names no test, so nothing ties it to a file this change added.
    ['a new-file-only command whose output names no test', runner(['test/new.test.mjs'], 'dot'), edit],
    // The failing test is registered by an existing helper the new file imports. It is not in a file
    // this change added, so it may have failed before through another importer.
    ['a failure located in an existing helper', runner(['test/new.test.mjs']), root => { put(root, 'feature.mjs', 'export const feature=()=>1;'); put(root, 'test/new.test.mjs', `${head}import {shared} from '../checks/shared.mjs';shared();test('feature is numeric',()=>assert.equal(1,1));`); },
      { files: { 'checks/shared.mjs': `${head}export const shared=()=>test('legacy rounding',()=>assert.equal(1,2));` } }],
    // An existing file named beside the new one already fails, and the new test passes at run start.
    // The control ran that file, so its results are compared by name as before and no hint applies.
    ['an earlier failure in an existing file named beside the new one', runner(['test/new.test.mjs', 'checks/legacy.mjs']), root => { put(root, 'feature.mjs', 'export const feature=()=>1;'); put(root, 'test/new.test.mjs', `${head}test('feature is numeric',()=>assert.equal(1,1));`); },
      { files: { 'checks/legacy.mjs': legacy }, hint: false }],
    // The next cases use a command that prints no test results on the run-start code for want of a
    // file, as a strict wrapper does. An earlier failure sits in an existing test file this change
    // edits, beside a failing new test: not every failing test is in an added file.
    ['an earlier failure in an edited test file beside a failing new test', ['tools/gate.cjs', 'strict', 'test/old.test.mjs', 'test/new.test.mjs'], root => { edit(root); put(root, 'test/old.test.mjs', `${legacy}// reworded by this change`); },
      { files: { 'tools/gate.cjs': gate, 'test/old.test.mjs': legacy } }],
    // The earlier failure is in an untouched file whose path only ends like the added file's.
    ['an earlier failure in a file whose path ends like the new file\'s', ['tools/gate.cjs', 'strict', 'legacy/test/new.test.mjs', 'test/new.test.mjs'], root => { put(root, 'feature.mjs', 'export const feature=()=>1;'); put(root, 'test/new.test.mjs', `${head}test('feature is numeric',()=>assert.equal(1,1));`); },
      { files: { 'tools/gate.cjs': gate, 'legacy/test/new.test.mjs': legacy } }],
    // A control that timed out did not finish, and one whose output was cut off may have lost its
    // results: neither shows there was nothing to run. The hint is about readable output, so a
    // timeout does not get it.
    ['a control that timed out', ['tools/gate.cjs', 'hang', 'test/new.test.mjs'], editBoth, { files: { 'tools/gate.cjs': gate }, timeoutMs: 15000, hint: false, control: { id: 'focused', passed: false, exitCode: null } }],
    ['a control whose output was cut off', ['tools/gate.cjs', 'flood', 'test/new.test.mjs'], editBoth, { files: { 'tools/gate.cjs': gate }, hint: false }]
  ];
  for (const [label, args, build, { source, files, timeoutMs, hint = true, control = { id: 'focused', passed: false, exitCode: 1 } } = {}] of cases) {
    const { root, id } = focused(t, [{ id: 'focused', command: process.execPath, args, ...(timeoutMs ? { timeoutMs } : {}) }], { source, files });
    build(root);
    const proof = runtime.proveRun(root, id), receipt = receiptOf(root, proof);
    assert.equal(proof.passed, false, `${label}: ${proof.verdict}`);
    assert.match(proof.verdict, /^Inconclusive: the run-start code already fails focused/, label);
    assert.equal(receipt.controlSource, 'in place', label);
    assert.equal(receipt.controlWithoutTests, undefined, label);
    assert.deepEqual(proof.control, [control], `${label}: the control ran and failed`);
    // The hint appears when the control printed no test results the proof can read.
    assert.equal(/That is read as nothing to run only when every failing test with the new tests added is named and is in a test file this change added, and no test file was deleted or moved/.test(proof.verdict), hint, `${label}: ${proof.verdict}`);
    assert.throws(() => finishWithProof(root, id), /Show the new tests catch this change.*Inconclusive/, label);
    assert.notEqual(runtime.readRun(root, id).status, 'complete', label);
  }
});

test('in a plan of several commands, each control is read on its own result', t => {
  const plan = [{ id: 'new', command: process.execPath, args: runner(['test/new.test.mjs']) }, { id: 'existing', command: process.execPath, args: runner(['test/original.test.mjs']) }];
  const { root, id } = focused(t, plan);
  put(root, 'feature.mjs', 'export const feature=()=>1;');
  put(root, 'test/new.test.mjs', returnsOne);
  put(root, 'test/original.test.mjs', `${existingTest}test('feature is no longer zero',()=>assert.notEqual(feature(),0));`);
  const proof = runtime.proveRun(root, id), receipt = receiptOf(root, proof);
  assert.equal(proof.passed, true, proof.verdict);
  assert.match(proof.verdict, /feature returns one; feature is no longer zero \(check new, existing\)/);
  assert.doesNotMatch(proof.verdict, /already failed there/);
  assert.deepEqual(proof.control, [{ id: 'new', passed: false, exitCode: 1 }, { id: 'existing', passed: true, exitCode: 0 }]);
  assert.deepEqual(receipt.controlWithoutTests, { new: ['test/new.test.mjs'] });
  // The sentence about added files is about check new only: the other failing test is in an existing file.
  assert.match(proof.verdict, /On the run-start code alone, check new printed no test results/);
  assert.doesNotMatch(proof.verdict, /every failing test named here/);
});

test('a wrapper that also runs existing tests keeps its measured control and the earlier-failure note', t => {
  // Prints a lint error, runs the existing test file plus its arguments, and always exits 1.
  const wrapper = "console.error('lint: 1 problem in feature.mjs');delete process.env.NODE_TEST_CONTEXT;require('node:child_process').spawnSync(process.execPath,['--test','--test-reporter=tap','test/original.test.mjs',...process.argv.slice(2)],{stdio:'inherit'});process.exit(1)";
  const { root, id } = focused(t, [{ id: 'focused', command: process.execPath, args: ['tools/suite.cjs', 'test/new.test.mjs'] }], { files: { 'tools/suite.cjs': wrapper } });
  put(root, 'feature.mjs', 'export const feature=()=>1;');
  put(root, 'test/new.test.mjs', returnsOne);
  put(root, 'test/original.test.mjs', `${existingTest}// reworded by this change`);
  const proof = runtime.proveRun(root, id), receipt = receiptOf(root, proof);
  assert.equal(proof.passed, true, proof.verdict);
  // The control ran an existing test there, so it did have something to run.
  assert.match(proof.verdict, /these tests fail on the run-start code: feature returns one \(check focused\)\. Check focused already failed there for other tests/);
  assert.doesNotMatch(proof.verdict, /read as nothing to run/);
  assert.equal(receipt.controlWithoutTests, undefined);
});

test('a control that passes without printing test results is a passing control, not one with nothing to run', t => {
  const { root, id } = focused(t, [{ id: 'focused', command: process.execPath, args: ['tools/gate.cjs', 'quiet', 'test/new.test.mjs'] }], { files: { 'tools/gate.cjs': gate } });
  put(root, 'feature.mjs', 'export const feature=()=>1;');
  put(root, 'test/new.test.mjs', returnsOne);
  put(root, 'test/original.test.mjs', `${existingTest}// reworded by this change`);
  const proof = runtime.proveRun(root, id), receipt = receiptOf(root, proof);
  assert.equal(proof.passed, true, proof.verdict);
  assert.deepEqual(proof.control, [{ id: 'focused', passed: true, exitCode: 0 }]);
  assert.match(proof.verdict, /these tests fail on the run-start code: feature returns one \(check focused\)\. New tests not named here/);
  assert.doesNotMatch(proof.verdict, /read as nothing to run/);
  assert.equal(receipt.controlWithoutTests, undefined);
});
