import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finishRun, nextRun, readRun, recordHandoff, startRun } from '../test-support/historical-runtime.test.fixture.mjs';

// One-call finish with test runner output: long output, mocha and jest, top-level testProof, and
// runs that halt during finish. The fixtures are those of prove-red.test.mjs; these tests have their
// own file so the test runner runs them beside it rather than after it.
process.env.CYC_BASELINE_MODE = 'off';
const unitCheck = { id: 'unit', command: process.execPath, args: ['-e', "delete process.env.NODE_TEST_CONTEXT; const r = require('node:child_process').spawnSync(process.execPath, ['--test'], { stdio: 'inherit' }); process.exit(r.status ?? 1);"], timeoutMs: 60000 };
const buggy = 'export const add = (a, b) => a - b;\n';
const fixed = 'export const add = (a, b) => a + b;\n';
const smoke = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('add exists', () => assert.equal(typeof add, 'function'));\n";
const catching = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../src/calc.mjs';\ntest('adds', () => assert.equal(add(2, 3), 5));\n";

function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-prove-'));
  t.after(() => { assert.ok(root.includes('cyc-prove-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  const git = (...args) => { const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git('init', '-q'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T'); git('config', 'core.autocrlf', 'false');
  for (const dir of ['src', 'test', '.cyc', 'docs/context']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'src/calc.mjs'), buggy);
  writeFileSync(join(root, 'test/smoke.test.mjs'), smoke);
  writeFileSync(join(root, 'docs/context/error-ledger.md'), '# Error ledger\n');
  writeFileSync(join(root, '.gitignore'), '.cyc/runs/\n.cyc/runtime/\n');
  writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [unitCheck] } }));
  git('add', '-A'); git('commit', '-qm', 'init');
  return { root, git };
}
function build(root, id) {
  const next = nextRun(root, id);
  recordHandoff(root, { runId: id, stage: 'build', attempt: next.attempt, status: 'passed', summary: 'Built.', evidence: [{ kind: 'observation', detail: 'fixture' }], artifacts: [], criteria: [{ id: 'c1', result: 'unverified', evidence: 'later' }] });
}
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

test('output longer than the kept 32,000 characters still names the new failing test and compares test by test', t => {
  // Like semver: its suite prints more than the kept tail, and one older test already fails.
  const H = "import test, { describe, it } from 'node:test';\nimport assert from 'node:assert/strict';\n";
  const pad = 'x'.repeat(70);
  const legacy = H + "describe('legacy', () => {\n  for (let i = 0; i < 150; i++) it('passing ' + i + ' " + pad + "', () => {});\n  it('keeps accented letters', () => assert.fail('owned by another team'));\n});\n";
  const setup = () => {
    const { root, git } = repo(t);
    writeFileSync(join(root, 'test/a-legacy.test.mjs'), legacy); git('add', '-A'); git('commit', '-qm', 'legacy');
    const { runId } = startOneCall(root);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    return { root, runId };
  };
  const accept = [{ check: 'unit', reason: 'keeps accented letters fails before this task (owned by another team).' }];
  const { root, runId } = setup();
  const done = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures: accept });
  assert.equal(done.finished, true, JSON.stringify(done));
  assert.equal(done.proofClaim, 'These new tests fail on the original code: adds (check unit).');
  // The receipt keeps the tail and a complete summary; the run state keeps only the tail.
  const state = readRun(root, runId);
  const receipt = JSON.parse(readFileSync(join(root, state.history.findLast(item => item.type === 'verification').receipt), 'utf8'));
  const unit = receipt.results.find(item => item.id === 'unit');
  assert.ok(unit.stdout.length === 32000 && unit.tests.complete, 'the tail is kept, with a complete summary');
  assert.equal('tests' in state.verification.results.find(item => item.id === 'unit'), false);
  // A new failure early in long output, outside the kept tail, is still found.
  const other = setup();
  writeFileSync(join(other.root, 'test/a-early.test.mjs'), H + "test('still broken', () => assert.fail('new'));\n");
  const refused = finishRun(other.root, other.runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures: accept });
  assert.equal(refused.failedAt, 'verify');
  assert.match(refused.acceptedFailuresThatChanged[0].newFailingTests.join(' '), /still broken/);
});

test('mocha and jest output name the new failing tests in the proof and are compared by test at verify', t => {
  // A stand-in runner prints the shape mocha 10 and jest 29 print (see fixtures/runner-output):
  // the legacy test always fails, and adds fails while src/calc.mjs still subtracts.
  const runner = [
    "const fs = require('fs');",
    'const format = process.argv[2];',
    "const failures = [['slug', 'keeps accented letters', 'test/slug.test.js', 'Error: owned by another team']];",
    "if (fs.existsSync('test/add.test.mjs') && !fs.readFileSync('src/calc.mjs', 'utf8').includes('a + b')) failures.push(['add', 'adds', 'test/add.test.mjs', 'AssertionError: -1 == 5']);",
    "if (fs.existsSync('test/extra.test.mjs')) failures.push(['extra', 'still broken', 'test/extra.test.mjs', 'Error: new']);",
    "const passing = fs.existsSync('test/add.test.mjs') ? 3 : 2;",
    "const nl = String.fromCharCode(10);",
    "let out = '';",
    "if (format === 'mocha') {",
    "  out = nl + nl + '  ' + passing + ' passing (3ms)' + nl + '  ' + failures.length + ' failing' + nl + nl;",
    "  failures.forEach(([suite, name, file, error], i) => { out += '  ' + (i + 1) + ') ' + suite + nl + '       ' + name + ':' + nl + '     ' + error + nl + '      at Context.<anonymous> (' + file + ':3:9)' + nl + nl; });",
    '} else {',
    "  for (const [suite, name, file, error] of failures) out += 'FAIL ' + file + nl + '  ● ' + suite + ' › ' + name + nl + nl + '    ' + error + nl + nl + '      at Object.<anonymous> (' + file + ':3:9)' + nl + nl;",
    "  out += 'Tests:       ' + failures.length + ' failed, ' + passing + ' passed, ' + (failures.length + passing) + ' total' + nl + 'Time:        0.88 s' + nl;",
    '}',
    'process.stdout.write(out);',
    'process.exit(failures.length ? 1 : 0);',
    ''
  ].join('\n');
  for (const format of ['mocha', 'jest']) {
    const setup = () => {
      const { root, git } = repo(t);
      writeFileSync(join(root, 'runner.cjs'), runner);
      writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'unit', command: process.execPath, args: ['runner.cjs', format] }] } }));
      git('add', '-A'); git('commit', '-qm', 'runner');
      const { runId } = startOneCall(root);
      writeFileSync(join(root, 'test/add.test.mjs'), catching);
      writeFileSync(join(root, 'src/calc.mjs'), fixed);
      return { root, runId };
    };
    const accept = [{ check: 'unit', reason: 'keeps accented letters fails before this task.' }];
    const { root, runId } = setup();
    const done = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures: accept });
    assert.equal(done.finished, true, `${format}: ${JSON.stringify(done)}`);
    assert.equal(done.proofClaim, 'These new tests fail on the original code: add > adds (check unit).', format);
    const other = setup();
    writeFileSync(join(other.root, 'test/extra.test.mjs'), '// a new test file that fails\n');
    const refused = finishRun(other.root, other.runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures: accept });
    assert.equal(refused.failedAt, 'verify', format);
    assert.deepEqual(refused.acceptedFailuresThatChanged[0].newFailingTests, ['extra > still broken'], format);
  }
});

test('finish takes testProof at the top level of its file, and refuses two different ones', t => {
  const { root } = repo(t);
  const { runId } = startOneCall(root);
  writeFileSync(join(root, 'src/calc.mjs'), fixed);
  mkdirSync(join(root, '.cyc/runtime'), { recursive: true });
  const file = join(root, '.cyc/runtime/finish.json');
  const exempt = { status: 'exempt', reason: 'The fixture checks the CLI input shape, not a behavior.' };
  const finish = input => {
    writeFileSync(file, JSON.stringify({ runId, summary: 'add fixed.', passedEvidence: 'unit tests pass', ...input }));
    const ran = spawnSync(process.execPath, [join(fileURLToPath(new URL('..', import.meta.url)), 'bin/cyc.mjs'), 'run', 'finish', '--file', file], { cwd: root, encoding: 'utf8' });
    return JSON.parse(ran.stdout || ran.stderr);
  };
  const twice = finish({ assessment: { ...oneCallFinal(), testProof: { ...exempt, reason: 'Another reason.' } }, testProof: exempt });
  assert.equal(twice.ok, false);
  assert.match(twice.error, /testProof is given twice/);
  const done = finish({ assessment: oneCallFinal(), testProof: exempt });
  assert.equal(done.finished, true, JSON.stringify(done));
  assert.deepEqual(readRun(root, runId).handoffs.find(item => item.stage === 'verify').assessment.testProof, exempt);
  // The same exemption in both places, its keys in another order, is one exemption.
  const other = repo(t).root;
  const second = startOneCall(other).runId;
  writeFileSync(join(other, 'src/calc.mjs'), fixed);
  mkdirSync(join(other, '.cyc/runtime'), { recursive: true });
  const both = join(other, '.cyc/runtime/finish.json');
  writeFileSync(both, JSON.stringify({ runId: second, summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: { ...oneCallFinal(), testProof: { reason: exempt.reason, status: 'exempt' } }, testProof: exempt }));
  const ran = spawnSync(process.execPath, [join(fileURLToPath(new URL('..', import.meta.url)), 'bin/cyc.mjs'), 'run', 'finish', '--file', both], { cwd: other, encoding: 'utf8' });
  assert.equal(JSON.parse(ran.stdout || ran.stderr).finished, true, ran.stdout || ran.stderr);
});

test('a run that halts during finish says where and why, and does not claim verify was recorded', t => {
  for (const [path, key] of [['docs/notes.md', 'outOfScope'], ['.cyc/config.json', 'protectedChanges']]) {
    const { root } = repo(t);
    const { runId } = startOneCall(root);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    // Like recipe-metric in round 5: an edit outside the run's scope, or to the protected check config.
    if (path === '.cyc/config.json') writeFileSync(join(root, path), readFileSync(join(root, path), 'utf8').replace('"maxAttempts":3', '"maxAttempts":4'));
    else writeFileSync(join(root, path), 'notes\n');
    const result = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal() });
    assert.equal(result.finished, false);
    assert.equal(result.status, 'halted');
    assert.equal(result.failedAt, 'record build');
    assert.deepEqual(result.steps, []);
    assert.deepEqual(result[key], [path]);
    assert.ok(result.reason.startsWith(`The run halted at record build, so verify was not recorded: these files changed, ${path}`), result.reason);
    assert.doesNotMatch(result.reason, /verify is recorded/);
    assert.equal(readRun(root, runId).handoffs.some(item => item.stage === 'verify'), false);
  }
});

// The fresh-context review of these readers found each of these accepted as a pass.
test('review cases: long output without old failing tests, stderr after mocha failures, and long failure details are refused', t => {
  const project = runner => {
    const { root, git } = repo(t);
    writeFileSync(join(root, 'runner.cjs'), runner);
    writeFileSync(join(root, '.cyc/config.json'), JSON.stringify({ schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'unit', command: process.execPath, args: ['runner.cjs'] }] } }));
    git('add', '-A'); git('commit', '-qm', 'runner');
    const { runId } = startOneCall(root);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    return { root, runId };
  };
  const attempt = ({ root, runId }, source) => {
    writeFileSync(join(root, 'src/calc.mjs'), source);
    return finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment: oneCallFinal(), acceptFailures: [{ check: 'unit', reason: 'fails before this task, unrelated.' }] });
  };
  const broken = fixed.replace('\n', ' // BREAK\n');
  const head = "const fs = require('fs'); const nl = String.fromCharCode(10); const calc = fs.readFileSync('src/calc.mjs', 'utf8');\n";
  // R1: long TAP whose run-start failure is a coverage threshold, not a test: the kept tail alone
  // cannot show that a test early in the output now fails, so it is refused, as before this change.
  const coverage = head + [
    "let out = 'TAP version 13' + nl, n = 0;",
    "for (let i = 0; i < 300; i++) { n++; out += (i === 5 && calc.includes('BREAK') ? 'not ok ' : 'ok ') + n + ' - legacy ' + i + nl; }",
    "if (fs.existsSync('test/add.test.mjs')) { n++; out += (calc.includes('a + b') ? 'ok ' : 'not ok ') + n + ' - adds' + nl + '  ---' + nl + \"  location: 'test/add.test.mjs:1:1'\" + nl + '  ...' + nl; }",
    "out += '1..' + n + nl;",
    "for (let i = 0; i < 700; i++) out += '#  module' + String(i).padStart(4, '0') + '.mjs | 80.00 | 75.00 | 90.00 | 12-14 30-31' + nl;",
    "out += '# Error: 79.00% line coverage does not meet threshold of 80%' + nl;",
    'process.stdout.write(out); process.exit(1);'
  ].join('\n');
  const r1 = attempt(project(coverage), broken);
  assert.equal(r1.failedAt, 'verify');
  assert.match(r1.acceptedFailuresThatChanged[0].reason, /too long to compare line by line/);
  // R2: mocha writes its report to stdout; an error on stderr is new output, not part of a failure.
  // The deprecation warning on every run names a different process, and is the same line.
  const mocha = head + [
    "process.stderr.write('(node:' + process.pid + ') [DEP0040] DeprecationWarning: The punycode module is deprecated.' + nl);",
    "const failures = [['slug', 'keeps accented letters', 'test/slug.test.js', 'Error: owned by another team']];",
    "if (fs.existsSync('test/add.test.mjs') && !calc.includes('a + b')) failures.push(['add', 'adds', 'test/add.test.mjs', 'AssertionError: -1 == 5']);",
    "let out = nl + '  3 passing (3ms)' + nl + '  ' + failures.length + ' failing' + nl + nl;",
    "failures.forEach(([s, name, file, e], i) => { out += '  ' + (i + 1) + ') ' + s + nl + '       ' + name + ':' + nl + '     ' + e + nl + '      at Context.<anonymous> (' + file + ':3:9)' + nl + nl; });",
    'process.stdout.write(out);',
    "if (calc.includes('BREAK')) process.stderr.write('Error: connect ECONNREFUSED 127.0.0.1:5432' + nl);",
    'process.exit(1);'
  ].join('\n');
  assert.equal(attempt(project(mocha), fixed).finished, true);
  const r2 = attempt(project(mocha), broken);
  assert.equal(r2.failedAt, 'verify');
  assert.deepEqual(r2.acceptedFailuresThatChanged[0].newLines, ['Error: connect ECONNREFUSED 127.0.0.1:5432']);
  // R3: in long output, an old failure with an 80-line diff whose stack now runs through changed source.
  const diff = head + [
    "let out = 'TAP version 13' + nl, n = 0;",
    "for (let i = 0; i < 400; i++) { n++; out += 'ok ' + n + ' - passing ' + i + ' ' + 'x'.repeat(60) + nl; }",
    "if (fs.existsSync('test/add.test.mjs')) { n++; const ok = calc.includes('a + b'); out += (ok ? 'ok ' : 'not ok ') + n + ' - adds' + nl + (ok ? '' : '  ---' + nl + \"  location: 'test/add.test.mjs:1:1'\" + nl + '  ...' + nl); }",
    "n++; out += 'not ok ' + n + ' - legacy deep compare' + nl + '  ---' + nl + \"  location: 'test/legacy.test.mjs:3:1'\" + nl + '  error: |-' + nl + '    Expected values to be strictly deep-equal:' + nl;",
    "for (let i = 0; i < 80; i++) out += '    +   field' + i + ': ' + i + nl;",
    "out += '  stack: |-' + nl + '    normalize (file:///proj/' + (calc.includes('BREAK') ? 'src/calc.mjs' : 'lib/vendor.mjs') + ':9:1)' + nl + '  ...' + nl;",
    "out += '1..' + n + nl; process.stdout.write(out); process.exit(1);"
  ].join('\n');
  assert.equal(attempt(project(diff), fixed).finished, true);
  const r3 = attempt(project(diff), broken);
  assert.equal(r3.failedAt, 'verify');
  assert.deepEqual(r3.acceptedFailuresThatChanged[0].files, ['src/calc.mjs']);
});

test('a halt inside the proof or the checks is reported as a stop, not as the run state', t => {
  for (const exempt of [false, true]) {
    const { root } = repo(t);
    const { runId } = startOneCall(root);
    writeFileSync(join(root, 'test/add.test.mjs'), catching);
    writeFileSync(join(root, 'src/calc.mjs'), fixed);
    build(root, runId);
    writeFileSync(join(root, 'docs/notes.md'), 'notes\n');
    const assessment = { ...oneCallFinal(), ...(exempt ? { testProof: { status: 'exempt', reason: 'The fixture checks where a halt is reported.' } } : {}) };
    const result = finishRun(root, runId, { summary: 'add fixed.', passedEvidence: 'unit tests pass', assessment });
    const at = exempt ? 'verify' : 'prove-red';
    assert.equal(result.failedAt, at);
    assert.equal(result.status, 'halted');
    assert.deepEqual(result.outOfScope, ['docs/notes.md']);
    assert.ok(result.reason.startsWith(`The run halted at ${at}, so verify was not recorded`), result.reason);
    assert.equal('history' in result, false);
  }
});
