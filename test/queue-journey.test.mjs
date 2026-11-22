import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRun } from '../scripts/runtime.mjs';
import { fixtureAssessment } from '../test-support/assessments.mjs';

// A queue of two feature units, run back to back through the CLI with real original-code proof and
// no commit between them. The second unit must start from the first unit's finished files and prove
// its own new test fails on them. Nothing here simulates a host.
process.env.CYC_BASELINE_MODE = 'off';
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/cyc.mjs');
const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const put = (root, name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); return path; };
const prose = ['Math helpers are plain functions exported from src/math/math.mjs; every caller imports them from that one module.', 'Each helper takes no arguments and returns a constant, so there is no shared state to coordinate.', 'The tests in test/math import the module directly and assert each return value.', 'Limit: nothing here checks performance.'];
const view = (...more) => [...prose, ...more].join('\n');
// The fixture's own test suite, started as a project would start it. This file runs under node --test,
// whose marker a nested run must not inherit.
const unitCheck = { id: 'tests', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"], timeoutMs: 60000 };

function cyc(root, args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8' });
  const data = JSON.parse(result.stdout || result.stderr);
  assert.equal(result.status, 0, JSON.stringify(data));
  return data;
}
const git = (root, args) => { const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'f@example.com', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'f@example.com' } }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };

function fixture(t, withGit) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-line-'));
  t.after(() => { assert.ok(root.includes('cyc-line-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [unitCheck] } }));
  put(root, 'package.json', JSON.stringify({ name: 'fixture', type: 'module' }));
  put(root, 'src/math/math.mjs', 'export const one = () => 1;\n');
  put(root, 'test/math/one.test.mjs', "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { one } from '../../src/math/math.mjs';\ntest('one returns 1', () => assert.equal(one(), 1));\n");
  put(root, 'docs/context/math.md', `# Math\n\nCovers: src/math/**, test/math/**\n\n## Current view\n\n${view()}\n\n## Lessons\n`);
  put(root, 'docs/context/INDEX.md', '# Context index\n\nRead the index first.\n\n| Component | Covers | Doc |\n| --- | --- | --- |\n| Math | src/math/**, test/math/** | [Math](math.md) |\n');
  if (withGit) {
    put(root, '.gitignore', '.cyc/runs/\n.cyc/runtime/\n');
    git(root, ['init', '-q', '-b', 'main']); git(root, ['config', 'core.autocrlf', 'false']); git(root, ['add', '.']); git(root, ['commit', '-q', '-m', 'Base']);
  }
  return root;
}
const unit = (name, dependsOn = []) => ({ id: name, outcome: `math.${name}() returns "${name}".`, playbook: 'feature', criteria: [{ id: 'returns', description: `${name}() returns its own name.` }], paths: ['src/math', 'test/math'], dependsOn });

// One unit as an agent works it: ask the line, add Scout to the start file, start, build, finish.
function work(root, queueId, name, helpers) {
  const next = cyc(root, ['queue', 'next', '--queue', queueId]);
  assert.equal(next.unit.id, name);
  const start = JSON.parse(readFileSync(join(root, next.startTemplate), 'utf8'));
  writeFileSync(join(root, next.startTemplate), JSON.stringify({ ...start, executionMode: 'standalone', plan: 'Add the helper beside the others, with one test.',
    contextRetention: { version: 1, disposition: 'required', features: [{ id: 'math', doc: 'docs/context/math.md', paths: ['src/math/math.mjs'] }] },
    scout: { context: { status: 'used', sources: ['docs/context/math.md'], evidence: 'Read the math record.', freshness: 'Compared it with src/math/math.mjs as it is now.' }, approach: { kind: 'extend', evidence: 'The helper is added to the one module every caller imports.' }, alignment: { status: 'clear', evidence: 'The unit names the helper and its return value.' }, consumers: [{ id: 'behavior', description: 'Callers of the math module.', check: 'The unit\'s test.' }] } }));
  const started = cyc(root, ['run', 'start', '--file', join(root, next.startTemplate)]);
  assert.deepEqual([started.stage, started.queue.unit, started.queue.unitStatus], ['build', name, 'in-progress']);
  const id = started.runId;
  writeFileSync(join(root, 'src/math/math.mjs'), `${readFileSync(join(root, 'src/math/math.mjs'), 'utf8')}export const ${name} = () => '${name}';\n`);
  put(root, `test/math/${name}.test.mjs`, `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport * as math from '../../src/math/math.mjs';\ntest('${name} returns its name', () => assert.equal(math.${name}(), '${name}'));\n`);
  const state = readRun(root, id);
  const assessment = { ...fixtureAssessment(state, 'verify'), ...fixtureAssessment(state, 'deliver') };
  delete assessment.testProof; // no exemption: the proof runs
  assessment.learning = { status: 'recorded', reason: 'Keep the helper list current.', artifacts: ['docs/context/math.md'], context: [{ id: 'math', currentView: view(`Helpers: ${helpers}.`), changed: `Added ${name}.` }] };
  const scenarioEvidence = [{ id: 'returns', scenario: `${name} returns its name`, check: 'tests', receipt: 'current-verification', result: 'passed', origin: 'agent-reported', evidence: `test/math/${name}.test.mjs asserts the return value.`, consumers: ['behavior'] }];
  // Finished through the CLI, as an agent finishes it: the result is what the agent reads next.
  let result = cyc(root, ['run', 'finish', '--run', id, '--file', put(root, `.cyc/runtime/finish-${name}.json`, JSON.stringify({ summary: `Added ${name}.`, scenarioEvidence, assessment }))]);
  if (result.status === 'needs-proof-review') {
    const input = JSON.parse(readFileSync(join(root, result.nextAction.inputTemplate), 'utf8'));
    for (const item of input.assessment.proofReview.cases) Object.assign(item, { category: 'new-interface', reason: `math.${name} does not exist on the run-start code, so the new test fails there.` });
    result = cyc(root, ['run', 'finish', '--run', id, '--file', put(root, `.cyc/runtime/finish-${name}-proof.json`, JSON.stringify(input))]);
  }
  assert.equal(result.finished, true, JSON.stringify(result).slice(0, 2000));
  return { next, finished: result, run: readRun(root, id) };
}

for (const withGit of [false, true]) {
  test(`two feature units run back to back ${withGit ? 'in an uncommitted Git checkout' : 'in a project without Git'}: the second proves its test against the first's result`, { skip: withGit && !hasGit && 'git is not installed', timeout: 300000 }, t => {
    const root = fixture(t, withGit);
    const file = put(root, '.cyc/runtime/QUEUE.json', JSON.stringify({ version: 1, goal: 'Add the alpha and beta helpers.', requirements: 'Add alpha, then beta, each returning its own name.', units: [unit('alpha'), unit('beta', ['alpha'])] }));
    const { queueId } = cyc(root, ['queue', 'create', '--file', file]);

    const alpha = work(root, queueId, 'alpha', 'one and alpha');
    assert.equal(alpha.run.status, 'complete');
    assert.equal(alpha.run.testProof.passed, true);
    // run finish itself says the unit is done and which unit is next, beside its unchanged result.
    assert.deepEqual([alpha.finished.status, alpha.finished.guidance.outcome], ['complete', 'complete']);
    assert.deepEqual([alpha.finished.queue.unit, alpha.finished.queue.unitStatus, alpha.finished.queue.done, alpha.finished.queue.line, alpha.finished.queue.next], ['alpha', 'done', 1, 'ready', 'beta']);
    // The controller added the unit's context docs to its scope; the unit asked only for its own paths.
    assert.ok(alpha.run.allowedPaths.includes('docs/context/math.md') && alpha.run.allowedPaths.includes('src/math'));
    if (withGit) {
      assert.equal(git(root, ['rev-list', '--count', 'HEAD']), '1');
      assert.match(git(root, ['status', '--porcelain']), /src\/math\/math\.mjs/, 'the first unit\'s work is uncommitted when the second starts');
    }

    const beta = work(root, queueId, 'beta', 'one, alpha and beta');
    // The line handed over the first unit's record and saw no edit outside the line.
    assert.deepEqual(beta.next.dependencies, [{ unit: 'alpha', runId: alpha.run.id, changeRecord: alpha.run.changeRecord.path }]);
    assert.ok(existsSync(join(root, alpha.run.changeRecord.path)));
    assert.equal(beta.next.drift, null);
    assert.equal(beta.run.queue.drift, null);
    // The second unit started exactly where the first ended ...
    assert.equal(beta.run.initialSource.hash, alpha.run.queue.completed.hash);
    assert.ok(Object.hasOwn(beta.run.initialSource.files, 'test/math/alpha.test.mjs'));
    // ... and on that code only its own new test fails: alpha's test passes on the second unit's originals.
    assert.equal(beta.run.status, 'complete');
    assert.equal(beta.run.testProof.passed, true);
    assert.deepEqual(Object.keys(beta.run.testProof.testFiles), ['test/math/beta.test.mjs']);
    assert.deepEqual(beta.run.testProof.failures.map(item => item.name), ['beta returns its name']);
    if (withGit) assert.equal(git(root, ['rev-list', '--count', 'HEAD']), '1', 'no commit was needed between the units');
    assert.deepEqual([beta.finished.queue.unitStatus, beta.finished.queue.line, beta.finished.queue.next], ['done', 'complete', null]);

    const status = cyc(root, ['queue', 'status', '--queue', queueId]);
    assert.deepEqual([status.line, status.done, status.total], ['complete', 2, 2]);
    assert.deepEqual(status.units.map(item => item.runs.map(run => run.status)), [['complete'], ['complete']]);
    const advice = cyc(root, ['run', 'next', '--run', beta.run.id]).queue;
    assert.deepEqual([advice.line, advice.unitStatus, advice.next], ['complete', 'done', null]);
  });
}
