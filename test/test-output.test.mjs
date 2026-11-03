import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readJest, readMocha, readTap, readTestOutput, stable, summarizeTests, testsOf, cutOff } from '../scripts/test-output.mjs';

// node:test's TAP as it prints on Windows: failures carry location, error, and stack in YAML.
const node = [
  'TAP version 13',
  '# Subtest: returns null',
  'not ok 1 - returns null',
  '  ---',
  '  duration_ms: 0.7',
  "  location: 'C:\\\\proj\\\\test\\\\a.test.mjs:4:1'",
  "  error: 'a'",
  '  stack: |-',
  '    TestContext.<anonymous> (file:///C:/proj/test/a.test.mjs:4:35)',
  '  ...',
  '# Subtest: slug',
  '    # Subtest: keeps accented letters',
  '    not ok 1 - keeps accented letters',
  '      ---',
  "      location: 'C:\\\\proj\\\\test\\\\a.test.mjs:5:26'",
  '      error: |-',
  '        Expected values to be equal:',
  "        'é' !== 'e'",
  '      stack: |-',
  '        slug (file:///C:/proj/src/calc.mjs:1:35)',
  '      ...',
  '    1..1',
  'not ok 2 - slug',
  '  ---',
  "  type: 'suite'",
  "  error: '1 subtest failed'",
  '  ...',
  '# Subtest: skipped group',
  '    # Subtest: later',
  '    ok 1 - later # SKIP',
  '    1..1',
  'ok 3 - skipped group',
  '  ---',
  "  type: 'suite'",
  '  ...',
  '# Subtest: returns null',
  'not ok 4 - returns null',
  '  ---',
  "  location: 'C:\\\\proj\\\\test\\\\b.test.mjs:3:1'",
  "  error: 'b'",
  '  ...',
  '# Subtest: passes',
  'ok 5 - passes',
  '---',
  'not ok 6 - after a stray separator',
  'coverage: lines 100%',
  '1..6',
  '# fail 3'
].join('\n');

test('failing tests are keyed by file and name, with their error and stack; suites and skips are not tests', () => {
  const { failing, passingCount, other } = readTap(node);
  assert.deepEqual([...failing.keys()], [
    'C:/proj/test/a.test.mjs::returns null',
    'C:/proj/test/a.test.mjs::slug > keeps accented letters',
    'C:/proj/test/b.test.mjs::returns null',
    '::after a stray separator'
  ]);
  const slug = failing.get('C:/proj/test/a.test.mjs::slug > keeps accented letters');
  assert.equal(slug.leaf, 'keeps accented letters');
  assert.equal(slug.error, "Expected values to be equal:\n'é' !== 'e'");
  assert.ok(slug.details.some(line => line.includes('src/calc.mjs')));
  // The skipped test and both suites are neither passing nor failing tests.
  assert.equal(passingCount, 1);
  // A --- that does not follow a result is output, and the failure after it is still read.
  assert.deepEqual([...other.values()], ['---', 'coverage: lines 100%']);
});

test('duplicates count, tap buffered subtests nest, numbering and timings do not matter; other output is null', () => {
  const twice = readTap('not ok 1 - flaky\nnot ok 2 - flaky');
  assert.equal(twice.failing.get('::flaky').count, 2);
  const buffered = readTap('ok 1 - test/a.js {\n    not ok 1 - inner\n}\nok 2 - test/b.js {\n    not ok 1 - inner\n}');
  // tap's reporter gives no location, so the file is the subtest named after a test file.
  assert.deepEqual([...buffered.failing.keys()], ['test/a.js::test/a.js > inner', 'test/b.js::test/b.js > inner']);
  const before = readTap('ok 1 - a\nnot ok 2 - keeps accented letters # time=12ms');
  const after = readTap('ok 1 - a\nok 2 - new test\nnot ok 3 - keeps accented letters # time=40ms');
  assert.deepEqual([...after.failing.keys()], [...before.failing.keys()]);
  assert.equal(readTap('  2 passing\n  1 failing\n  1) suite title'), null);
  assert.equal(readTap(''), null);
  assert.equal(stable('done in 12.5ms at 2026-10-24T06:08:41.315Z'), 'done in <duration> at <time>');
});

// Real output from mocha 10.8.2 (spec and dot reporters) and jest 29.7.0 on one fixture: test/a
// has a failure thrown from src/calc.js and a nested failing assertion, test/b one failure; one
// test passes and one is skipped.
const sample = name => readFileSync(new URL(`./fixtures/runner-output/${name}`, import.meta.url), 'utf8');
const fixtureFailures = ['test/a.test.js::slug > keeps accented letters', 'test/a.test.js::slug > nested > returns null', 'test/b.test.js::other > returns null'];

test('mocha: failures keyed by the test file and suite path, with the error; the result list is not other output', () => {
  for (const reporter of ['mocha-spec.txt', 'mocha-dot.txt']) {
    const { failing, passingCount, other } = readMocha(sample(reporter));
    assert.deepEqual([...failing.keys()], fixtureFailures, reporter);
    assert.equal(passingCount, 1, reporter);
    assert.equal(failing.get(fixtureFailures[0]).error, 'TypeError: boom in calc');
    assert.equal(failing.get(fixtureFailures[0]).leaf, 'keeps accented letters');
    assert.ok(failing.get(fixtureFailures[0]).details.some(line => line.includes('src/calc.js')));
    assert.deepEqual([...other.values()], [], reporter);
  }
  // A warning before the results and a coverage table after the failures are other output, not a
  // failure's details; a mocha summary is not mistaken for TAP or jest.
  const extra = readMocha(`Warning: experimental loader\n${sample('mocha-spec.txt')}\n----------|---------|\nFile      | % Stmts |\n`);
  assert.deepEqual([...extra.other.values()], ['Warning: experimental loader', '----------|---------|', 'File      | % Stmts |']);
  assert.equal(readTestOutput(sample('mocha-spec.txt')).failing.size, 3);
  assert.equal(readTap(sample('mocha-spec.txt')), null);
  assert.equal(readJest(sample('mocha-spec.txt')), null);
});

test('jest: failures keyed by the FAIL file and the › path; "● Console" is output, not a failing test', () => {
  const { failing, passingCount, other } = readJest(sample('jest.txt'));
  assert.deepEqual([...failing.keys()].sort(), [...fixtureFailures].sort());
  assert.equal(passingCount, 1);
  assert.equal(failing.get(fixtureFailures[0]).error, 'TypeError: boom in calc');
  assert.equal(other.size, 0);
  const logged = readJest(` PASS  test/c.test.js\n  ● Console\n\n    console.log\n      hello from c\n\n      at Object.log (test/c.test.js:2:11)\n\n  suite\n    ✓ works (2 ms)\n\n${sample('jest.txt')}`);
  assert.equal([...logged.failing.keys()].some(key => key.includes('Console')), false);
  assert.deepEqual([...logged.other.values()], ['console.log', 'hello from c']);
  // Past 20 suites jest repeats each failure in a summary; a failure is still counted once.
  const body = sample('jest.txt');
  const cut = body.indexOf('Test Suites:');
  const repeated = readJest(`${body.slice(0, cut)}Summary of all failing tests\n${body.slice(0, cut)}${body.slice(cut)}`);
  assert.deepEqual([...repeated.failing.values()].map(entry => entry.count), [1, 1, 1]);
  assert.equal(repeated.other.size, 0);
  assert.equal(readMocha(sample('jest.txt')), null);
  // Not a recognized runner: node's dot reporter prints no test names.
  assert.equal(readTestOutput('..X.\n\nFailed tests:\n\n✖ adds (1ms)\n'), null);
});

test('long output keeps a summary of its test results; a summary that hit its own bounds counts as cut off', () => {
  const long = `TAP version 13\n${Array.from({ length: 1000 }, (_, i) => `ok ${i + 1} - passing test number ${i} with a long name`).join('\n')}\nnot ok 601 - the only failure\n  ---\n  location: 'test/a.test.mjs:1:1'\n  error: 'old'\n  ...\n`;
  assert.ok(long.length > 32000);
  const tests = summarizeTests(long);
  assert.equal(tests.complete, true);
  const stored = { stdout: long.slice(-32000), stderr: '', tests: JSON.parse(JSON.stringify(tests)) };
  assert.equal(cutOff(stored), false);
  assert.deepEqual([...testsOf(stored).failing.keys()], ['test/a.test.mjs::the only failure']);
  assert.equal(testsOf(stored).passingCount, 1000);
  // Kept output alone at the limit is cut off. Every failure keeps all of its details.
  assert.equal(cutOff({ stdout: long.slice(-32000), stderr: '' }), true);
  const detailed = summarizeTests(`TAP version 13\nnot ok 1 - deep\n  ---\n  error: |-\n${Array.from({ length: 80 }, (_, i) => `    + field${i}`).join('\n')}\n  stack: |-\n    at f (src/calc.mjs:1:1)\n  ...\n`);
  assert.ok(detailed.failing[0][1].details.some(line => line.includes('src/calc.mjs')));
  assert.equal(summarizeTests('plain build output'), null);
});

test('review cases: a stray "ok" line, the other stream, suite titles ending in ":", jest projects, and the summary bound', () => {
  // A console line "ok" does not make mocha or jest output TAP; TAP declares its version.
  const mocha = `ok\n${sample('mocha-spec.txt')}`;
  assert.deepEqual([...readTestOutput(mocha).failing.keys()], fixtureFailures);
  assert.equal(readTestOutput(mocha).passingCount, 1);
  assert.equal(readTestOutput(`TAP version 13\nok 1 - a\n  2 passing\n`).passingCount, 1);
  // A stray "ok" on stdout does not hide jest's report on stderr: each reader tries both streams.
  assert.deepEqual([...readTestOutput('ok\n', sample('jest.txt')).failing.keys()].sort(), [...fixtureFailures].sort());
  // node's warnings name the process; the same warning on another run is the same line.
  assert.equal(stable('(node:12316) [DEP0040] DeprecationWarning: The punycode module is deprecated.'), stable('(node:4242) [DEP0040] DeprecationWarning: The punycode module is deprecated.'));
  // The report's stream is parsed; the other stream is kept whole as other output.
  const split = readTestOutput(sample('mocha-spec.txt'), 'Error: connect ECONNREFUSED\n');
  assert.deepEqual([...split.failing.keys()], fixtureFailures);
  assert.deepEqual([...split.other.values()], ['Error: connect ECONNREFUSED']);
  assert.ok(!split.failing.get(fixtureFailures[2]).details.some(line => line.includes('ECONNREFUSED')));
  assert.deepEqual([...readTestOutput('', sample('jest.txt')).failing.keys()].sort(), [...fixtureFailures].sort());
  // mocha appends ":" to the last title part only, so a suite named "parse:" keeps its tests apart.
  const colon = readMocha('\n  0 passing (1ms)\n  2 failing\n\n  1) parse:\n       reads a:\n     Error: a\n      at Context.<anonymous> (test/p.test.js:2:1)\n\n  2) parse:\n       reads b:\n     Error: b\n      at Context.<anonymous> (test/p.test.js:3:1)\n');
  assert.deepEqual([...colon.failing.keys()], ['test/p.test.js::parse: > reads a', 'test/p.test.js::parse: > reads b']);
  assert.equal(colon.failing.get('test/p.test.js::parse: > reads a').error, 'Error: a');
  // jest with projects names the project before the file, and a slow file's duration after it.
  const projects = readJest('FAIL  web  test/a.test.js (5.2 s)\n  ● s › t\n\n    Error: x\n\nTests:       1 failed, 1 total\n');
  assert.deepEqual([...projects.failing.keys()], ['test/a.test.js::s > t']);
  // A summary over its bound keeps counts only and counts as cut off.
  const long = sample('mocha-spec.txt');
  assert.equal(summarizeTests(long, '').complete, true);
  const over = summarizeTests(long, '', 100);
  assert.equal(over.complete, false);
  assert.equal(over.failingCount, 3);
  assert.equal(cutOff({ tests: over }), true);
  assert.equal(testsOf({ tests: over }), null);
});
