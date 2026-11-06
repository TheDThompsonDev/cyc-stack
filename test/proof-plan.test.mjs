import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import * as runtime from '../test-support/historical-runtime.test.fixture.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';
const put = (root, path, data) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), data); };
function folder(t) { const root = mkdtempSync(join(tmpdir(), 'cyc-plan-')); t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-plan-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }); return root; }
const nodeTests = paths => ['-e', `delete process.env.NODE_TEST_CONTEXT; const r=require('node:child_process').spawnSync(process.execPath,${JSON.stringify(['--test', ...paths])},{stdio:'inherit'});process.exit(r.status??1)`];
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
