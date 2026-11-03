// Reads test runner output (TAP from node --test and tap, mocha, jest) so a suite that already had
// a failing test can still show what the new tests did. Each reader returns the failing tests keyed
// by file and title, each with its error and diagnostics, how many tests passed, and the lines that
// are not test results. Unrecognized output returns null, and callers keep comparing whole outputs.

const backslash = String.fromCharCode(92);
const slashes = value => value.split(backslash).join('/');
const plain = value => value.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '');
// Kept output is the last 32,000 characters of each stream; longer output keeps a parsed summary.
export const outputLimit = 32000;

// Only what changes between identical runs is ignored: timestamps, clock times, durations, and the
// process ID in node's warnings, "(node:12316) [DEP0040] DeprecationWarning: ...".
export const stable = line => line
  .replace(/\(node:\d+\)/g, '(node:<pid>)')
  .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, '<time>')
  .replace(/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g, '<time>')
  .replace(/\b\d+(?:\.\d+)?\s?(?:ms|s|sec|seconds|m|min)\b/g, '<duration>')
  .replace(/\b(time|duration(?:_ms)?)[=:]\s?\d+(?:\.\d+)?/g, '$1=<duration>');

// One shape for every reader: failures keyed by file and title, counted when they repeat.
function collector() {
  const failing = new Map();
  let passingCount = 0;
  const other = new Map();
  return {
    fail(entry) {
      const key = `${entry.file ?? ''}::${entry.path.join(' > ')}`;
      const known = failing.get(key);
      if (known) known.count += 1; else failing.set(key, { ...entry, count: 1 });
    },
    pass(count = 1) { passingCount += count; },
    note(line) { const text = slashes(line.trim()); if (text) other.set(stable(text), text); },
    done: () => ({ failing, passingCount, other })
  };
}
const fileLike = segment => /\.(?:[cm]?[jt]sx?)$/.test(segment);

const resultLine = /^(\s*)(not ok|ok)\b(?:\s+\d+)?(?:\s+-)?\s*(.*)$/;
const subtestLine = /^(\s*)# Subtest: (.*)$/;
const bookkeeping = /^\s*(?:TAP version \d+|\d+\.\.\d+(?:\s+#.*)?|# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms|time)\b.*|Bail out!.*)$/;

// A YAML value as node:test writes it: 'single quoted' (with '' for a quote), or bare.
const yamlValue = raw => { const value = raw.trim(); return value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1).replace(/''/g, "'") : value; };

// TAP: returns null unless the output contains TAP test results.
export function readTap(output) {
  const lines = (output ?? '').split(/\r?\n/);
  if (!lines.some(line => resultLine.test(line))) return null;
  const out = collector();
  const open = [];
  const pending = [];
  let last = null;
  let yaml = null;
  const record = entry => {
    if (!entry || entry.group || entry.skipped) return;
    // tap's own reporter has no location; its subtests are named after the test file.
    entry.file ??= entry.path.slice(0, -1).map(slashes).find(fileLike);
    if (entry.failed) out.fail(entry); else out.pass();
  };
  const settle = () => { while (pending.length) record(pending.shift()); };
  for (const line of lines) {
    if (yaml) {
      // A failed test's diagnostics belong to that test: its file, error, and stack.
      if (new RegExp(`^ {${yaml.indent}}\\.\\.\\.\\s*$`).test(line)) { settle(); yaml = null; continue; }
      const indent = /^\s*/.exec(line)[0].length;
      // A block value (error: |-) continues on the lines indented under its key.
      if (yaml.block !== undefined && indent > yaml.block) { yaml.entry.error += `${yaml.entry.error ? '\n' : ''}${line.trim()}`; yaml.entry.details.push(slashes(line.trim())); continue; }
      yaml.block = undefined;
      const field = /^\s*(location|type|error):\s*(.*)$/.exec(line);
      if (field?.[1] === 'location') yaml.entry.file = slashes(yamlValue(field[2]).split(backslash + backslash).join(backslash)).replace(/:\d+(?::\d+)?$/, '');
      else if (field?.[1] === 'type' && yamlValue(field[2]) === 'suite') yaml.entry.group = true;
      else if (field?.[1] === 'error' && yaml.entry.error === undefined) {
        if (/^[|>][-+]?$/.test(field[2].trim())) { yaml.entry.error = ''; yaml.block = indent; }
        else yaml.entry.error = yamlValue(field[2]);
      }
      yaml.entry.details.push(slashes(line.trim()));
      continue;
    }
    // Diagnostics start only directly under a test result; a stray --- elsewhere is ordinary output.
    const start = /^(\s*)---\s*$/.exec(line);
    if (start && last && start[1].length > last.indent) { yaml = { indent: start[1].length, entry: last.entry }; last = null; continue; }
    settle();
    last = null;
    const header = subtestLine.exec(line);
    if (header) { open.push({ indent: header[1].length, name: header[2].trim(), children: false }); continue; }
    if (/^\s*}\s*$/.test(line) && open.at(-1)?.buffered) { open.pop(); continue; }
    const test = resultLine.exec(line);
    if (test) {
      const indent = test[1].length;
      let [name, directive = ''] = test[3].split(/\s+#\s+/);
      while (open.length && open.at(-1).indent > indent) open.pop();
      const closes = open.at(-1)?.indent === indent && !open.at(-1).buffered ? open.pop() : null;
      for (const parent of open) parent.children = true;
      // tap's buffered subtests: "ok 1 - name {" opens a group closed by "}".
      const buffered = /\s\{$/.test(name);
      if (buffered) name = name.replace(/\s*\{$/, '');
      const entry = { path: [...open.map(item => item.name), name.trim()], leaf: name.trim(), failed: test[2] === 'not ok', skipped: /^(?:todo|skip)\b/i.test(directive.trim()), group: Boolean(closes?.children) || buffered, details: [] };
      if (buffered) open.push({ indent, name: name.trim(), children: false, buffered: true });
      pending.push(entry);
      last = { indent, entry };
      continue;
    }
    if (bookkeeping.test(line) || !line.trim()) continue;
    out.note(line);
  }
  settle();
  return out.done();
}

// The file of a failure: the frame that ran the test (mocha's Context, jest's Object), else the
// first frame outside node internals and dependencies.
const frameFile = (lines, preferred) => {
  const frames = lines.map(line => /\(?((?:file:\/\/\/)?[^\s()]+?):\d+:\d+\)?\s*$/.exec(line.trim().replace(/^at\s+/, ''))?.[1]).filter(Boolean)
    .map(path => slashes(path.replace(/^file:\/\/\//, ''))).filter(path => !/^node:|\/node_modules\//.test(path));
  const chosen = lines.findIndex(line => preferred.test(line));
  const fromPreferred = chosen >= 0 ? /\(?((?:file:\/\/\/)?[^\s()]+?):\d+:\d+\)?\s*$/.exec(lines[chosen].trim())?.[1] : null;
  return fromPreferred ? slashes(fromPreferred.replace(/^file:\/\/\//, '')) : frames[0];
};

const indentOf = line => /^\s*/.exec(line)[0].length;
// A suite title in a reporter's test list: indented, with the next nonblank line indented further.
const suiteTitle = (lines, index) => {
  const next = lines.slice(index + 1).find(line => line.trim());
  return indentOf(lines[index]) >= 2 && next !== undefined && indentOf(next) > indentOf(lines[index]);
};

// mocha: every reporter prints "N passing" and then numbers each failure, its title on one line
// per suite level, the last ending with ":", followed by the error and stack.
export function readMocha(output) {
  const lines = plain(output ?? '').split(/\r?\n/);
  const summary = lines.findIndex(line => /^\s*\d+ passing\b/.test(line));
  if (summary < 0) return null;
  const out = collector();
  out.pass(Number(/(\d+) passing/.exec(lines[summary])[1]));
  // Before the summary: the reporter's list of results and suite titles, and any other output,
  // such as a warning or a console line, which is kept.
  const listed = lines.slice(0, summary);
  listed.forEach((line, index) => {
    if (!line.trim() || /^\s*(?:[✔✓√]|\d+\)|-)\s/.test(line) || /^[\s.,!․]+$/.test(line) || suiteTitle(listed, index)) return;
    out.note(line);
  });
  let current = null;
  // The title's parts, one per line: part k (after the first) is indented 5 + 2k spaces, and mocha
  // appends ":" to the last part only, so a suite title that itself ends with ":" stays whole.
  const closeTitle = () => { if (current?.open) { current.open = false; current.title[current.title.length - 1] = current.title.at(-1).replace(/:$/, ''); } };
  const finish = () => {
    if (!current) return;
    closeTitle();
    const errorLines = current.body.slice(0, Math.max(0, current.body.findIndex(line => /^\s*at\s/.test(line)))).map(line => line.trim()).filter(Boolean);
    out.fail({ path: current.title, leaf: current.title.at(-1), file: frameFile(current.body, /Context\.<anonymous>/), error: errorLines.join('\n'), details: current.body.map(line => slashes(line.trim())).filter(Boolean) });
    current = null;
  };
  let afterFailures = false;
  for (const line of lines.slice(summary + 1)) {
    const header = /^ {2}\d+\) (.*)$/.exec(line);
    if (header) { finish(); current = { title: [header[1].trim()], body: [], open: true }; continue; }
    if (current?.open) {
      if (line.trim() && indentOf(line) === 5 + 2 * current.title.length) { current.title.push(line.trim()); continue; }
      closeTitle();
    }
    // A coverage report or another tool's output after mocha's own is not part of a failure.
    if (/^(?:-{3,}|={3,}|ERROR:|File\s+\||All files|npm (?:ERR!|error))/.test(line)) { finish(); afterFailures = true; }
    if (current && !afterFailures) { current.body.push(line); continue; }
    if (/^\s*\d+ (?:pending|failing)\b/.test(line)) continue;
    if (afterFailures || !current) out.note(line);
  }
  finish();
  return out.done();
}

// jest: "FAIL <file>" heads each failing file; each failure is "● Suite › test", then the message,
// a code frame, and the stack. "Tests: … N passed" counts the passing tests. "● Console" is not a
// test: it heads the console output of a file, which is kept as other output.
export function readJest(output) {
  const lines = plain(output ?? '').split(/\r?\n/);
  const totals = lines.find(line => /^\s*Tests:\s+/.test(line));
  if (!totals || !lines.some(line => /^\s*(?:PASS|FAIL)\s+\S/.test(line))) return null;
  const out = collector();
  out.pass(Number(/(\d+) passed/.exec(totals)?.[1] ?? 0));
  let file = null;
  let current = null;
  let inConsole = false;
  let repeated = false;
  const finish = () => {
    if (!current) return;
    const message = [];
    for (const line of current.body) { if (/^\s*(?:>?\s*\d+\s*\||\|)|^\s*at\s/.test(line)) break; if (line.trim()) message.push(line.trim()); }
    out.fail({ path: current.title, leaf: current.title.at(-1), file, error: message.join('\n'), details: current.body.map(line => slashes(line.trim())).filter(Boolean) });
    current = null;
  };
  lines.forEach((line, index) => {
    // With more than 20 suites, jest prints every failure again under this heading; read it once.
    if (/^\s*Summary of all failing tests\s*$/.test(line)) { finish(); repeated = true; return; }
    if (repeated && !/^\s*Test Suites:\s/.test(line)) return;
    repeated = false;
    // A console block's lines are indented under its heading; its stack frames move with edits.
    if (inConsole && (!line.trim() || indentOf(line) >= 4)) { if (!/^\s*at\s/.test(line)) out.note(line); return; }
    inConsole = false;
    // "FAIL <file>", or "FAIL <project> <file>" with projects; a slow file ends with "(5.2 s)".
    const head = /^\s*(PASS|FAIL)\s+(.+?)\s*$/.exec(line);
    if (head) {
      finish();
      const words = head[2].replace(/\s+\([^)]*\)$/, '').split(/\s+/);
      file = slashes(words.findLast(fileLike) ?? words.at(-1));
      return;
    }
    if (/^\s*● Console\s*$/.test(line)) { finish(); inConsole = true; return; }
    const failure = /^\s*● (.+)$/.exec(line);
    if (failure) { finish(); current = { title: failure[1].split(' › ').map(part => part.trim()), body: [] }; return; }
    if (/^\s*(?:Test Suites|Tests|Snapshots|Time):\s|^\s*Ran all test suites/.test(line)) { finish(); return; }
    if (current) { current.body.push(line); return; }
    if (/^\s*[✓✕○√×]\s/.test(line) || suiteTitle(lines, index)) return;
    out.note(line);
  });
  finish();
  return out.done();
}

// Readers from the most to the least distinctive report. mocha and jest have their own summaries,
// while any line starting with "ok" looks like TAP, so TAP comes first only when it declares its version.
const declaredTap = output => /^TAP version \d+/m.test(output ?? '') ? readTap(output) : null;
const readers = [declaredTap, readJest, readMocha, readTap];

// A runner writes its report to one stream (jest to stderr, the others to stdout). Each reader
// tries both streams before a weaker one does; the other stream is kept whole as other output,
// so a warning there is never read as part of a failure.
export function readTestOutput(stdout, stderr = '') {
  for (const reader of readers) {
    for (const [report, rest] of [[stdout, stderr], [stderr, stdout]]) {
      const tests = reader(report);
      if (!tests) continue;
      for (const line of plain(rest ?? '').split(/\r?\n/)) { const text = slashes(line.trim()); if (text) tests.other.set(stable(text), text); }
      return tests;
    }
  }
  return null;
}

// What runCommands keeps for output longer than its tail: the parsed results, whole. runCommands
// reads at most 64 MB of each stream for this, so a summary is bounded by its output; one that would
// still exceed summaryLimit characters keeps only counts, is marked incomplete, and counts as cut off.
export const summaryLimit = 4_000_000;
export function summarizeTests(stdout, stderr = '', limit = summaryLimit) {
  const tests = readTestOutput(stdout, stderr);
  if (!tests) return null;
  const summary = { failing: [...tests.failing], passingCount: tests.passingCount, other: [...tests.other], complete: true };
  return JSON.stringify(summary).length <= limit ? summary : { failing: [], passingCount: tests.passingCount, other: [], failingCount: tests.failing.size, complete: false };
}

// The parsed results of one check: its stored summary, or its kept output when it was not cut off.
export function testsOf(result) {
  if (result?.tests) return result.tests.complete ? { failing: new Map(result.tests.failing), passingCount: result.tests.passingCount, other: new Map(result.tests.other) } : null;
  return readTestOutput(result?.stdout ?? '', result?.stderr ?? '');
}

// Output whose earlier lines were dropped, with no complete summary to stand in for them.
export const cutOff = result => result?.tests ? !result.tests.complete : [result?.stdout, result?.stderr].some(stream => (stream ?? '').length >= outputLimit);
