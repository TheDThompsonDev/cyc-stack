import { existsSync, lstatSync, statSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readRun } from './runtime.mjs';
import { contextLinks } from './project-tools.mjs';
import { changeFile } from './source-snapshot.mjs';

// Project context under docs/context/. A component doc says what is true now (Covers, Current view,
// Lessons); the index is its table of contents; a change record says what one completed run did
// and how its checks ended, published after verification and so never verified source.

export const contextFolder = 'docs/context';
export const indexName = `${contextFolder}/INDEX.md`;
const reservedDocs = new Set(['INDEX.md', 'error-ledger.md', 'verify-recipe.md']);
const docFileName = /^[a-z][a-z0-9-]*\.md$/;
const dateText = /\d{4}-\d{2}-\d{2}/;
const runIdText = /[A-Za-z0-9][A-Za-z0-9._-]{3,}/;
const hashText = /(?:sha256:)?[0-9a-f]{7,64}/;
const lastChangeLine = new RegExp(`^Last changed by AI: (?:none recorded|(${dateText.source}) · run (${runIdText.source}) · files: (.+))$`);
const historyHeading = new RegExp(`^### (${dateText.source}) · run (${runIdText.source})(?: · (.*))?$`);
const changeHeading = new RegExp(`^# (${dateText.source}) · run (${runIdText.source})(?: · (.*))?$`);
const lessonLine = new RegExp(`^- (${dateText.source}) · ([^:]+): (.+)$`);
const fileItem = new RegExp(`^\`?([^\`@\\s]+)\`?@(${hashText.source})$`);
const conflictMarker = /^(?:<{7} |={7}$|>{7} |\|{7} )/;
const recordItem = new RegExp(`^(.+)@(${hashText.source}|deleted)$`);
const newestFirst = (a, b) => { const when = entry => entry.fields.completed ?? entry.date; return when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : a.run < b.run ? -1 : 1; };
const noNote = 'no component note recorded';
const sectionOrder = ['Current view', 'Lessons'];
export const maxDocLines = 300;

// Each rule is named in a lint issue so the fix is clear. Structure only: a doc can pass every one
// and still be wrong. "Earlier layout" still has a Last-changed line and History; migrate converts it.
export const rules = {
  name: `The file name is kebab-case (${docFileName.source}); INDEX.md, error-ledger.md and verify-recipe.md are not component docs.`,
  title: 'The first non-empty line is the only H1, naming the one component the doc covers.',
  covers: 'A "Covers:" line lists one or more project-relative path patterns (comma-separated, forward slashes, no parent segments).',
  sections: 'The H2 sections are exactly "## Current view" then "## Lessons"; the earlier layout ends with "## History".',
  'current-view': 'Current view has prose and no <placeholder> left from the template.',
  'lesson-dated': 'Every line under Lessons is a bullet "- <YYYY-MM-DD> · <source>: <lesson>".',
  size: `The doc has at most ${maxDocLines} lines.`,
  'last-change': 'Earlier layout: the "Last changed by AI:" line reads "none recorded" or "<YYYY-MM-DD> · run <id> · files: <paths>".',
  'history-entry': 'Earlier layout: every History entry heads with "### <YYYY-MM-DD> · run <id>", newest first, and nothing else appears under History.',
  evidence: 'Earlier layout: every History entry has a "**Files:**" line listing each file as path@<sha256 or commit>.',
  'last-change-current': 'Earlier layout: the "Last changed by AI" line names the newest History entry.',
  'toc-columns': 'The index table has Component (or Area), Covers and Doc (or Record) columns, and no per-run columns (Last AI change, Lessons).',
  'toc-link': 'Every index Doc link resolves to an existing file.',
  'toc-unindexed': 'Every component doc in docs/context/ has exactly one index row.',
  'toc-covers': 'An index row\'s Covers equals its doc\'s Covers line.',
  'toc-conflict': 'The index has no merge conflict markers; cyc context index --write keeps both sides\' rows.',
  'stale-against-git': 'A covered path was committed after the doc and the change records that name it, so the doc may describe code that has changed.',
  'change-name': 'The changes folder holds only records named <YYYY-MM-DD>-<run>.md and digests named <YYYY-MM>.md.',
  'change-entry': 'A change entry heads with "# <YYYY-MM-DD> · run <id> · <goal>", has a "Result:" line and lists files as "- path@<hash>"; a record holds the one entry its name gives, a digest its month\'s.',
  'change-duplicate': 'A run has one change entry.'
};

const text = value => typeof value === 'string' && value.trim().length > 0;
const oneLine = (value, max = 160) => {
  const line = String(value ?? '').replace(/\s+/g, ' ').replaceAll('|', '\\|').trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};
const shortRun = id => String(id).slice(0, 8);
const day = iso => String(iso ?? '').slice(0, 10);
const fileName = path => path.split('/').at(-1);
export const isComponentDoc = (path, folder = contextFolder) => !!path && dirname(path) === folder && docFileName.test(fileName(path)) && !reservedDocs.has(fileName(path));

export function contextLocation(root) {
  const config = existsSync(join(root, '.cyc/config.json')) ? JSON.parse(readFileSync(join(root, '.cyc/config.json'), 'utf8').replace(/^\uFEFF/, '')) : {};
  const folder = canonicalPattern(config.context?.directory ?? contextFolder, { patterns: false });
  if (folder === '.cyc' || folder.startsWith('.cyc/')) throw Error('Target context must not use engine or runtime storage.');
  const path = local(root, folder);
  if (existsSync(path) && !statSync(path).isDirectory()) throw Error(`Target context directory is a file: ${folder}. Choose a project-owned directory before start.`);
  return { folder, index: `${folder}/INDEX.md` };
}

export function canonicalPattern(pattern, { patterns = true } = {}) {
  const value = String(pattern ?? '').trim().replaceAll('`', '');
  if (!value || /[\\:\0]/.test(value) || (!patterns && /[*?]/.test(value)) || /[{}]/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..')) throw Error(`Use canonical project-relative ${patterns ? 'patterns' : 'paths'}: ${value || pattern}`);
  return value;
}

// The same pattern language as cyc investigate (project-tools.mjs): literal paths and directories,
// *, ** and ?; "all" covers everything. Kept compatible so the index means one thing to both.
export function matches(pattern, path) {
  if (pattern === 'all') pattern = '**';
  canonicalPattern(pattern); canonicalPattern(path, { patterns: false });
  let regex = '';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') { i++; if (pattern[i + 1] === '/') { i++; regex += '(?:.*/)?'; } else regex += '.*'; }
    else if (pattern[i] === '*') regex += '[^/]*';
    else if (pattern[i] === '?') regex += '[^/]';
    else regex += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const prefix = pattern.split(/[?*]/)[0].replace(/\/$/, '');
  return new RegExp(`^${regex}$`).test(path) || (prefix && (prefix === path || prefix.startsWith(path + '/'))) || (!/[?*]/.test(pattern) && path.startsWith(pattern + '/'));
}
const covered = (covers, path) => covers.some(pattern => { try { return matches(pattern, path); } catch { return false; } });
const sha = value => createHash('sha256').update(value).digest('hex');
const catchAll = pattern => {
  const parts = pattern.split('/');
  if (parts[0] === 'src') parts.shift();
  return pattern === 'all' || parts.every(part => !part.replace(/[*.?]/g, ''));
};
const testPath = path => /(^|\/)(tests?|test-support|__tests__)\/|[._-](test|spec)\./.test(path);
const sourceEntrypoint = path => !testPath(path) && (/\.(?:[cm]?[jt]sx?|py|go|rs|rb|php|java|cs|swift|vue|svelte|sql|json|ya?ml|toml|sh|ps1)$/.test(path) || /(?:^|\/)SKILL\.md$/.test(path));

function local(root, path) {
  canonicalPattern(path, { patterns: false });
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw Error(`Linked path is not supported: ${path}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}
const read = (root, path) => readFileSync(local(root, path), 'utf8').replace(/^﻿/, '').replaceAll('\r\n', '\n');
function atomicWrite(path, content, staging) {
  if (staging) mkdirSync(staging, { recursive: true });
  const temporary = staging ? join(staging, `${randomUUID()}.context`) : `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, content, { flag: 'wx' }); renameSync(temporary, path); }
  finally { try { if (existsSync(temporary)) unlinkSync(temporary); } catch { /* retained staging is not source or successful evidence */ } }
}

// ---------------------------------------------------------------- component docs

export function parseDoc(source, name = 'doc.md') {
  const lines = source.replace(/^﻿/, '').replaceAll('\r\n', '\n').split('\n');
  const issues = [];
  const issue = (rule, message, line) => issues.push({ rule, message, ...(line !== undefined ? { line: line + 1 } : {}) });
  if (!docFileName.test(name) || reservedDocs.has(name)) issue('name', `${name} is not a component doc name.`);
  const h1 = lines.map((line, index) => [line, index]).filter(([line]) => /^# /.test(line));
  const firstText = lines.findIndex(line => line.trim());
  if (h1.length !== 1 || h1[0][1] !== firstText) issue('title', h1.length === 1 ? 'The H1 must be the first non-empty line.' : `Expected one H1, found ${h1.length}.`, h1[0]?.[1]);
  const title = h1.length ? h1[0][0].slice(2).trim() : null;
  const coversIndex = lines.findIndex(line => /^Covers:/.test(line));
  let covers = [];
  if (coversIndex === -1) issue('covers', 'Missing "Covers:" line.');
  else {
    try {
      covers = lines[coversIndex].slice('Covers:'.length).split(',').map(p => canonicalPattern(p));
      if (!covers.length) throw Error('Covers lists no pattern.');
    } catch (error) { issue('covers', error.message, coversIndex); covers = []; }
  }
  const lastIndex = lines.findIndex(line => /^Last changed by AI:/.test(line));
  // The earlier layout kept its history in the doc; it still parses, and migrate converts it.
  const legacy = lastIndex !== -1 || lines.includes('## History');
  let lastChange = null;
  if (legacy && lastIndex === -1) issue('last-change', 'Missing "Last changed by AI:" line.');
  else if (legacy) {
    const match = lines[lastIndex].match(lastChangeLine);
    if (!match) issue('last-change', `Unreadable line: ${lines[lastIndex]}`, lastIndex);
    else lastChange = match[1] ? { date: match[1], run: match[2], files: match[3].split(',').map(p => p.trim().replaceAll('`', '')).filter(Boolean) } : 'none recorded';
  }
  const h2 = lines.map((line, index) => [line, index]).filter(([line]) => /^## /.test(line));
  const names = h2.map(([line]) => line.slice(3));
  if (names.join('\n') !== [...sectionOrder, ...(legacy ? ['History'] : [])].join('\n')) issue('sections', `Found sections: ${names.map(n => `"## ${n}"`).join(', ') || 'none'}.`);
  const section = name => {
    const at = h2.findIndex(([line]) => line.slice(3) === name);
    if (at === -1) return null;
    const start = h2[at][1] + 1, end = at + 1 < h2.length ? h2[at + 1][1] : lines.length;
    return { start, lines: lines.slice(start, end) };
  };
  const view = section('Current view');
  if (view) {
    if (!view.lines.some(line => line.trim())) issue('current-view', 'Current view is empty.', view.start);
    const placeholder = view.lines.findIndex(line => /<(?:write|describe|fill|replace|actual|placeholder|todo|what|feature details)\b[^>]*>/i.test(line));
    if (placeholder !== -1) issue('current-view', 'Current view still has a template placeholder.', view.start + placeholder);
  }
  const lessons = [];
  const lessonSection = section('Lessons');
  for (const [offset, line] of (lessonSection?.lines ?? []).entries()) {
    if (!line.trim()) continue;
    const match = line.match(lessonLine);
    if (!match) { issue('lesson-dated', `Not a dated lesson bullet: ${oneLine(line, 80)}`, lessonSection.start + offset); continue; }
    lessons.push({ date: match[1], source: match[2], text: match[3], line: lessonSection.start + offset + 1 });
  }
  const history = [];
  const historySection = section('History');
  if (historySection) {
    let entry = null;
    for (const [offset, line] of historySection.lines.entries()) {
      const at = historySection.start + offset;
      if (/^### /.test(line)) {
        const match = line.match(historyHeading);
        if (!match) { issue('history-entry', `Unreadable entry heading: ${oneLine(line, 80)}`, at); entry = null; continue; }
        entry = { date: match[1], run: match[2], title: match[3] ?? '', line: at + 1, files: [], hasFiles: false };
        history.push(entry);
        continue;
      }
      if (!entry) { if (line.trim()) issue('history-entry', 'Text under History outside an entry.', at); continue; }
      const field = line.match(/^\*\*(Changed|Learned|Decisive check):\*\*\s*(.*)$/);
      if (field) entry[field[1] === 'Decisive check' ? 'proof' : field[1].toLowerCase()] = field[2];
      if (!field && line.trim() && !/^\*\*Files:\*\*/.test(line)) (entry.extra ??= []).push(line.trim());
      if (/^\*\*Files:\*\*/.test(line)) {
        entry.hasFiles = true;
        for (const item of line.slice('**Files:**'.length).split(',').map(s => s.trim()).filter(Boolean)) {
          const match = item.match(fileItem);
          if (!match) { issue('evidence', `File item needs path@hash: ${oneLine(item, 80)}`, at); continue; }
          entry.files.push({ path: match[1], hash: match[2] });
        }
      }
    }
    for (const item of history) if (!item.hasFiles || !item.files.length) issue('evidence', `Entry ${item.date} · run ${item.run} lists no files.`, item.line - 1);
    for (let i = 1; i < history.length; i++) if (history[i].date > history[i - 1].date) { issue('history-entry', 'Entries are not newest first.', history[i].line - 1); break; }
    if (history.length && lastChange !== null) {
      const newest = history[0];
      if (lastChange === 'none recorded' || lastChange.run !== newest.run || lastChange.date !== newest.date) issue('last-change-current', `Newest entry is ${newest.date} · run ${newest.run}.`, lastIndex);
    } else if (lastChange && lastChange !== 'none recorded') issue('last-change-current', 'Last changed names a run with no History entry.', lastIndex);
  }
  if (lines.length > maxDocLines) issue('size', `${lines.length} lines.`);
  return { name, title, covers, layout: legacy ? 'earlier' : 'current', lastChange, lessons, history, currentView: view?.lines.join('\n').trim() ?? '', lines: lines.length, issues };
}

export function listDocs(root) {
  const { folder: contextFolder } = contextLocation(root);
  const folder = local(root, contextFolder);
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter(name => name.endsWith('.md') && !reservedDocs.has(name) && lstatSync(join(folder, name)).isFile()).sort();
}

export function lintDoc(root, path) {
  const parsed = parseDoc(read(root, path), fileName(path));
  return { path, ok: !parsed.issues.length, ...parsed };
}

// ---------------------------------------------------------------- the index (table of contents)

const columnAliases = { component: ['component', 'area'], covers: ['covers'], doc: ['doc', 'record'], lastChange: ['last ai change'], lessons: ['lessons'] };

export function parseIndex(source) {
  const lines = source.replace(/^﻿/, '').replaceAll('\r\n', '\n').split('\n');
  const table = { header: null, headerLine: -1, separatorLine: -1, columns: {}, rows: [], markers: [], lines };
  let side = null, base = false;
  for (const [index, line] of lines.entries()) {
    // Conflict markers inside the table are not rows: both sides' rows are read, and a side with its
    // own header (the earlier five-column index) is read by column name. A conflict that opens on
    // anything but a table row belongs to the prose below the table.
    if (table.header && conflictMarker.test(line)) {
      if (line[0] === '<' && !/^\s*\|/.test(lines[index + 1] ?? '')) break;
      // In a three-way conflict the rows between "|||||||" and "=======" are the base, not a side.
      base = line[0] === '|';
      if (line[0] === '>') side = null;
      table.markers.push(index); continue;
    }
    if (!/^\s*\|/.test(line)) { if (table.header && (table.rows.length || table.separatorLine >= 0)) break; table.header = null; continue; }
    let cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
    if (!table.header) {
      if (!cells.some(c => c.toLowerCase() === 'covers')) continue;
      table.header = cells; table.headerLine = index;
      for (const [key, aliases] of Object.entries(columnAliases)) table.columns[key] = cells.findIndex(c => aliases.includes(c.toLowerCase()));
      continue;
    }
    if (cells.every(c => /^:?-+:?$/.test(c))) { if (table.separatorLine < 0) { table.separatorLine = index; table.separator = cells; } continue; }
    if (base) continue;
    // A header inside the table is the other side of a conflict only when its separator row follows.
    if (cells.some(c => c.toLowerCase() === 'covers') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? '')) { side = cells.map(c => c.toLowerCase()); continue; }
    if (side) cells = table.header.map(name => cells[side.indexOf(name.toLowerCase())] ?? '');
    if (cells.length !== table.header.length) { table.rows.push({ line: index, malformed: true, cells }); continue; }
    const cell = key => table.columns[key] >= 0 ? cells[table.columns[key]] : '';
    const links = contextLinks(cell('doc'));
    const link = cell('doc').match(/\[[^\]]+\]\(([^)#]+)[^)]*\)/);
    table.rows.push({ line: index, cells, component: cell('component'), covers: cell('covers').replaceAll('`', '').split(',').map(p => p.trim()).filter(Boolean), docText: cell('doc'), links, link: link ? decodeURIComponent(link[1]) : null });
  }
  return table;
}

function resolveLink(root, link) {
  const { index: indexName } = contextLocation(root);
  if (!link || /^[a-z]+:/i.test(link)) return null;
  return relative(root, resolve(dirname(local(root, indexName)), link)).replaceAll('\\', '/');
}

const git = (root, args, timeout = 5000) => spawnSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 });

function gitAvailable(root) {
  const result = git(root, ['rev-parse', '--is-inside-work-tree']);
  return result.status === 0 && result.stdout.trim() === 'true';
}
const pathspec = pattern => pattern === 'all' ? '.' : /[?*]/.test(pattern) ? `:(glob)${pattern}` : pattern;

// Freshness against Git: the doc's last commit against the last commit touching a covered path.
// A run that revalidates a doc without rewording it leaves the bytes it verified in its change
// record, so a later covered commit makes the doc stale unless every covered file it moved is, as
// committed, what a record made after the doc's last commit verified. `records` are the committed
// entries naming the doc. Uncommitted covered edits are dirty, never stale: they have no commit yet.
export function docFreshness(root, docPath, covers, records = []) {
  if (!gitAvailable(root)) return { status: 'unknown', reason: 'Not a Git checkout; freshness was not compared.' };
  const last = args => { const r = git(root, ['log', '-1', '--format=%H%x09%cI%x09%s', ...args]); if (r.status !== 0) throw Error(r.stderr.trim() || 'git log failed'); const [commit, date, subject] = r.stdout.trim().split('\t'); return commit ? { commit, date, subject } : null; };
  let doc, coveredCommit;
  try {
    doc = last(['--', docPath]);
    coveredCommit = covers.length ? last(['--', ...covers.map(pathspec)]) : null;
  } catch (error) { return { status: 'unknown', reason: error.message }; }
  const dirty = covers.length ? git(root, ['status', '--porcelain', '--', ...covers.map(pathspec)]) : { status: 0, stdout: '' };
  const dirtyPaths = dirty.status === 0 ? dirty.stdout.split('\n').filter(Boolean).map(line => line.slice(3).trim()) : [];
  if (!doc) return { status: 'uncommitted', reason: 'The doc has no commit yet.', coveredCommit, dirtyPaths };
  if (!coveredCommit) return { status: 'fresh', docCommit: doc, coveredCommit: null, dirtyPaths };
  // The doc's commit being an ancestor of the covered commit is decisive; dates only break a tie
  // across branches, and two commits in the same second compare equal by date.
  const later = coveredCommit.commit !== doc.commit && (git(root, ['merge-base', '--is-ancestor', doc.commit, coveredCommit.commit]).status === 0 || coveredCommit.date > doc.date);
  if (later) {
    const bound = new Map();
    for (const entry of records) if (Date.parse(entry.fields.completed ?? `${entry.date}T23:59:59Z`) >= Date.parse(doc.date)) for (const file of entry.files) if (!bound.has(file.path)) bound.set(file.path, file.hash);
    const committed = path => { const shown = spawnSync('git', ['-C', root, 'show', `${coveredCommit.commit}:./${path}`], { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 * 1024 }); return shown.status === 0 ? `sha256:${sha(shown.stdout)}` : 'deleted'; };
    const moved = git(root, ['diff', '--relative', '--name-only', '-z', doc.commit, coveredCommit.commit, '--', ...covers.map(pathspec)]);
    if (moved.status !== 0 || moved.stdout.split('\0').filter(Boolean).some(path => bound.get(path) !== committed(path))) return { status: 'stale', docCommit: doc, coveredCommit, dirtyPaths };
  }
  return { status: dirtyPaths.length ? 'dirty' : 'fresh', docCommit: doc, coveredCommit, dirtyPaths };
}

export function lintIndex(root, { git: checkGit = true, docs: selectedDocs } = {}) {
  const { folder: contextFolder, index: indexName } = contextLocation(root);
  const issues = [];
  const issue = (rule, message, line) => issues.push({ rule, message, ...(line !== undefined ? { line: line + 1 } : {}) });
  const exists = existsSync(local(root, indexName));
  const docs = listDocs(root);
  const freshness = [];
  if (!exists) {
    if (docs.length) issue('toc-unindexed', `${indexName} is missing; ${docs.length} component doc(s) have no row.`);
    return { path: indexName, exists, ok: !issues.length, rows: [], issues, freshness };
  }
  const table = parseIndex(read(root, indexName));
  if (!table.header) { issue('toc-columns', 'No table with a Covers column.'); return { path: indexName, exists, ok: false, rows: [], issues, freshness }; }
  for (const key of ['component', 'covers', 'doc']) if (table.columns[key] === -1) issue('toc-columns', `Missing column ${columnAliases[key].join(' or ')}.`, table.headerLine);
  if (table.columns.lastChange >= 0 || table.columns.lessons >= 0) issue('toc-columns', 'Per-run columns (Last AI change, Lessons) are no longer kept; cyc context index --write drops them.', table.headerLine);
  if (table.lines.some(line => conflictMarker.test(line))) issue('toc-conflict', 'Merge conflict markers remain; cyc context index --write keeps both sides\' rows.');
  // Only committed records can vouch for a doc against Git; one written or edited since is not history yet.
  const named = new Map();
  if (checkGit) {
    const changes = readChanges(root), loose = new Set(git(root, ['ls-files', '-z', '-m', '-o', '--', changes.folder]).stdout?.split('\0'));
    for (const entry of changes.entries) if (!loose.has(entry.file)) for (const { doc } of entry.components) named.set(doc, [...(named.get(doc) ?? []), entry]);
  }
  const seen = new Map();
  const rows = [];
  for (const row of table.rows) {
    if (row.malformed) { issue('toc-columns', 'Malformed row (cell count differs from the header).', row.line); continue; }
    const docPath = resolveLink(root, row.link);
    const entry = { line: row.line + 1, component: row.component, covers: row.covers, doc: docPath, componentDoc: false };
    rows.push(entry);
    if (!docPath) { if (row.docText && !row.link) issue('toc-link', `No link in the Doc cell: ${oneLine(row.docText, 60)}`, row.line); continue; }
    if (!existsSync(local(root, docPath))) { issue('toc-link', `${docPath} does not exist.`, row.line); continue; }
    if (!isComponentDoc(docPath, contextFolder)) continue;
    entry.componentDoc = true;
    if (seen.has(docPath)) issue('toc-unindexed', `${docPath} has more than one row (first at line ${seen.get(docPath) + 1}).`, row.line);
    seen.set(docPath, row.line);
    if (selectedDocs && !selectedDocs.includes(docPath)) continue;
    const parsed = lintDoc(root, docPath);
    entry.docIssues = parsed.issues.length;
    if ([...parsed.covers].sort().join(',') !== [...row.covers].sort().join(',')) issue('toc-covers', `Row covers [${row.covers.join(', ')}] but ${docPath} covers [${parsed.covers.join(', ')}].`, row.line);
    if (checkGit) {
      const fresh = docFreshness(root, docPath, parsed.covers, named.get(docPath));
      freshness.push({ doc: docPath, ...fresh });
      if (fresh.status === 'stale') issue('stale-against-git', `${docPath}: ${fresh.coveredCommit.commit.slice(0, 7)} (${day(fresh.coveredCommit.date)}, ${oneLine(fresh.coveredCommit.subject, 60)}) touched covered paths after the doc's last commit ${fresh.docCommit.commit.slice(0, 7)} (${day(fresh.docCommit.date)}).`, row.line);
    }
  }
  for (const name of docs) if (!seen.has(`${contextFolder}/${name}`)) issue('toc-unindexed', `${contextFolder}/${name} has no index row.`);
  return { path: indexName, exists, ok: !issues.length, rows, issues, freshness };
}

const docSummary = result => ({ path: result.path, ok: result.ok, layout: result.layout, issues: result.issues, lines: result.lines, lessons: result.lessons.length, history: result.history.length });

export function lintContext(root, { doc, git: checkGit = true } = {}) {
  root = realpathSync(root);
  const { folder: contextFolder } = contextLocation(root);
  if (doc) {
    const result = lintDoc(root, doc.replaceAll('\\', '/'));
    return { ok: result.ok, docs: [docSummary(result)], rules, note: 'Structure rules only: a passing doc can still be wrong about its component.' };
  }
  const docs = listDocs(root).map(name => docSummary(lintDoc(root, `${contextFolder}/${name}`)));
  const index = lintIndex(root, { git: checkGit }), changes = readChanges(root);
  return { ok: docs.every(d => d.ok) && index.ok && !changes.issues.length, index: { path: index.path, exists: index.exists, ok: index.ok, issues: index.issues, freshness: index.freshness }, docs, changes: { path: changes.folder, entries: changes.entries.length, issues: changes.issues }, rules, note: 'Structure and freshness rules only: a passing doc can still be wrong about its component, and a fresh doc is one whose covered paths have no later commit, not one that is correct.' };
}

// A current start plans records before scope freezes. Old stored runs without this
// contract remain legacy; spelling an old start envelope does not disable the default.
export function planRetention(root, { goal, build, allowedPaths = [], explicit } = {}) {
  if (explicit?.version !== undefined && explicit.version !== 1) throw Error('Unsupported feature-retention version; use version 1.');
  const { folder, index } = contextLocation(root);
  const disposition = explicit?.disposition ?? (build ? 'required' : 'unnecessary');
  if (!['required', 'unnecessary', 'restricted'].includes(disposition)) throw Error('context.retention.disposition must be required, unnecessary or restricted.');
  if (disposition !== 'required' && !text(explicit?.reason) && (build || disposition === 'restricted')) throw Error('A nonrequired retention disposition needs its actual reason.');
  let features = explicit?.features;
  if (features === undefined && disposition === 'required') {
    const existing = componentsOf(root).components.filter(c => c.inFolder && !c.covers.some(catchAll) && allowedPaths.some(p => covered(c.covers, p)));
    features = [...new Map(existing.map(c => [c.doc, { id: fileName(c.doc).slice(0, -3), doc: c.doc, paths: allowedPaths.filter(p => covered(c.covers, p)) }])).values()];
    if (!features.length) {
      const id = String(goal).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'feature';
      features = [{ id, doc: `${folder}/${id}.md`, paths: allowedPaths.filter(p => !p.startsWith('docs/') && !p.startsWith('.cyc/')) }];
    }
  }
  features ??= [];
  if (!Array.isArray(features) || features.length > 32 || new Set(features.map(f => f?.id)).size !== features.length || new Set(features.map(f => f?.doc)).size !== features.length || disposition === 'required' && !features.length) throw Error('Retention needs unique feature ids and canonical records (at most 32).');
  features = structuredClone(features);
  for (const f of features) {
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(f?.id ?? '') || !isComponentDoc(f.doc, folder) || !Array.isArray(f.paths)) throw Error('Each retention feature needs {id, doc: canonical feature path, paths: representative entrypoints}.');
    local(root, f.doc);
    for (const path of f.paths) { canonicalPattern(path, { patterns: false }); if (path.startsWith('.cyc/')) throw Error('Engine/runtime evidence is not a feature entrypoint.'); }
    if (existsSync(local(root, f.doc))) f.baselineViewHash = sha(parseDoc(read(root, f.doc), fileName(f.doc)).currentView);
  }
  return { version: 1, disposition, routine: explicit?.routine === true, reason: explicit?.reason ?? (build ? 'Feature knowledge is required.' : 'Read-only/nonfeature route; implementation changes still require retention.'), folder, index, features: structuredClone(features) };
}

export const retentionOf = state => state.contextRetention ?? state.handoffs?.find(h => h.stage === 'scout' && h.status === 'passed')?.assessment?.context?.retention;
const support = (path, folder) => path.startsWith('.cyc/') || path === `${folder}/INDEX.md` || path.startsWith(`${folder}/`) || /(?:^|\/)(?:error-ledger\.md|verify-recipe\.md)$/.test(path);
function featureFiles(root, state, feature, files) {
  const folder = retentionOf(state).folder;
  const changed = Object.keys(files).filter(p => files[p] !== state.initialSource.files[p] && !support(p, folder));
  const recordCovers = existsSync(local(root, feature.doc)) ? parseDoc(read(root, feature.doc), fileName(feature.doc)).covers : [];
  // Context-only upkeep still describes an implementation. Reuse its focused
  // owner, never the record/index itself or an unrelated workspace sample.
  const maintenance = !changed.length && feature.paths.every(p => support(p, folder));
  const anchors = maintenance ? recordCovers.filter(p => !support(p, folder) && !catchAll(p)) : [];
  const paths = feature.paths.length ? feature.paths : maintenance ? anchors : changed;
  const selected = changed.filter(p => covered([...paths, ...recordCovers], p));
  for (const path of [...paths, ...anchors]) {
    const sample = files[path] && !support(path, folder) ? path : selected.find(p => covered([path], p)) ?? Object.keys(files).find(p => covered([path], p) && !support(p, folder));
    if (sample && !selected.includes(sample)) selected.push(sample);
  }
  return { paths, files: selected.slice(0, 32).map(path => ({ path, sha256: files[path] })) };
}

export function checkRetention(root, state, files) {
  const plan = retentionOf(state);
  if (!plan) return { ok: true, status: 'legacy', docs: [], issues: [], note: 'Historical run has no feature-retention contract.' };
  const issues = [], docs = [], ownership = [];
  const issue = (rule, message, doc) => issues.push({ rule, message, ...(doc ? { doc } : {}) });
  const edits = [...new Set([...Object.keys(state.initialSource.files), ...Object.keys(files)])].filter(p => files[p] !== state.initialSource.files[p] && !p.startsWith('.cyc/'));
  const changed = edits.filter(p => !support(p, plan.folder));
  if (plan.disposition === 'restricted') return { ok: false, status: 'pending', docs, issues: [{ rule: 'scope-restriction', message: plan.reason }], note: 'Required context remains incomplete; no documentation permission is inferred.' };
  if (plan.disposition === 'unnecessary') {
    if (state.playbook === 'feature' || edits.length && (!plan.routine || edits.some(p => !state.initialSource.files[p] || !files[p]))) issue('feature-plan', 'Source changes require planned context or an explicit routine disposition; routine work cannot add/delete files or claim feature retention.');
    return { ok: !issues.length, status: issues.length ? 'pending' : 'unnecessary', docs, issues };
  }
  const index = lintIndex(root, { git: false, docs: plan.features.map(f => f.doc) });
  if (!index.exists) issue('toc-link', `Missing target index ${plan.index}.`);
  issues.push(...index.issues, ...readChanges(root).issues);
  for (const feature of plan.features) {
    const doc = feature.doc;
    if (!existsSync(local(root, doc))) { issue('feature-doc', `Missing canonical record for ${feature.id}.`, doc); continue; }
    const parsed = lintDoc(root, doc), selected = featureFiles(root, state, feature, files);
    ownership.push(...parsed.covers);
    issues.push(...parsed.issues.map(i => ({ ...i, doc })));
    if (!parsed.currentView.split('\n').some(line => !/^\s*(?:#|-|\||`)/.test(line) && line.trim().length >= 80)) issue('feature-knowledge', 'Supply proportionate capability, contracts, decisions, checks and limitations as prose; headings/filenames alone are insufficient.', doc);
    if (parsed.covers.some(catchAll)) issue('feature-coverage', 'A catch-all is not focused feature ownership.', doc);
    if (!selected.paths.length || selected.paths.some(path => !covered(parsed.covers, path))) issue('feature-coverage', `Covers must resolve representative feature paths: ${selected.paths.join(', ') || 'none planned'}.`, doc);
    const rows = index.rows.filter(row => row.componentDoc && row.doc === doc);
    if (rows.length !== 1 || selected.paths.some(path => !covered(rows[0]?.covers ?? [], path))) issue('feature-index', 'A canonical resolving index row must map the feature entrypoints.', doc);
    // The run state, not a doc entry, binds the authored view to the bytes it was written against.
    if (!selected.files.length) issue('feature-evidence', 'The record needs actual selected implementation source; supporting files and unrelated hashes cannot stand in.', doc);
    const authored = state.contextPreparation?.authored?.[feature.id];
    if (!authored || authored.viewHash !== sha(parsed.currentView) || authored.sourcesHash !== sha(JSON.stringify(selected.files))) issue('feature-authoring', 'Author or revalidate the focused Current view against this source; a scaffold or an unchanged view after a source change is not retained feature knowledge.', doc);
    if (!files[doc] || !files[plan.index]) issue('feature-source', 'Canonical context/index must be included in verified source, not ignored runtime data.', doc);
    docs.push(doc);
  }
  for (const path of changed) {
    if ((sourceEntrypoint(path) || !state.initialSource.files[path] && !testPath(path)) && !covered(ownership, path)) issue('feature-entrypoint', `Changed implementation path has no planned canonical feature owner: ${path}.`);
    for (const row of index.rows.filter(row => row.componentDoc && covered(row.covers, path))) if (!plan.features.some(f => f.doc === row.doc)) issue('feature-owner', `Plan the affected canonical owner ${row.doc} for ${path} before Build; retention remains pending without broadening this run.`);
  }
  return { ok: !issues.length, status: issues.length ? 'pending' : 'retained', docs, issues, note: 'Layout, mapping, provenance and source checks only; authored semantic truth and user acceptance are not certified.' };
}

// Only the caller's active, scoped runtime transaction may invoke this writer. It writes what is
// true now: the authored Current view and an optional lesson. What the run did is its change record.
const filled = value => text(value) && !/^<[\s\S]*>$/.test(value.trim());
export function prepareRetention(root, state, { records = [] } = {}, files, permit) {
  const plan = retentionOf(state);
  if (!plan || plan.disposition !== 'required') return { paths: [], authored: {} };
  if (!Array.isArray(records) || new Set(records.map(r => r?.id)).size !== records.length || records.some(r => !plan.features.some(f => f.id === r?.id) || !text(r.currentView) || /<(?:write|describe|fill|actual|placeholder|todo)\b/i.test(r.currentView) || ['changed', 'lesson'].some(key => r[key] !== undefined && !filled(r[key])))) throw Error('learning.context needs unique planned ids and actual nonplaceholder currentView text (and changed/lesson when given).');
  const writes = [], authored = {}, notes = { ...state.contextPreparation?.notes };
  const date = state.contextPreparation?.date ?? new Date().toISOString().slice(0, 10);
  for (const feature of plan.features) {
    const exists = existsSync(local(root, feature.doc)), selected = featureFiles(root, state, feature, files);
    let source = exists ? read(root, feature.doc) : newDocSource(feature.id.replaceAll('-', ' '), selected.files.length ? selected.files.map(f => f.path) : selected.paths);
    if (parseDoc(source, fileName(feature.doc)).issues.some(i => ['sections', 'title', 'last-change', 'last-change-current'].includes(i.rule))) throw Error(`Repair existing context metadata/history first: ${feature.doc}. Do not invent an older run entry.`);
    const record = records.find(r => r.id === feature.id);
    if (record) {
      source = source.replace(/(## Current view\n)[\s\S]*?(?=\n## Lessons)/, (_, heading) => `${heading}\n${record.currentView.trim()}\n`);
      if (record.changed) notes[feature.id] = oneLine(record.changed, 300);
      // One lesson per run and component: a repeated preparation replaces it, never adds a second.
      if (record.lesson) {
        const lines = source.split('\n'), at = lines.indexOf('## Lessons'), end = lines.indexOf('## History');
        const kept = lines.filter((line, i) => !(i > at && (end < 0 || i < end) && line.includes(` · run ${shortRun(state.id)}: `)));
        kept.splice(at + 1, 0, '', `- ${date} · run ${shortRun(state.id)}: ${oneLine(record.lesson, 400)}`, '');
        source = `${kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '')}\n`;
      }
    }
    const viewHash = sha(parseDoc(source, fileName(feature.doc)).currentView), sourcesHash = sha(JSON.stringify(selected.files));
    const prior = state.contextPreparation?.authored?.[feature.id];
    if (record || viewHash !== (state.contextPreparation?.views?.[feature.id] ?? feature.baselineViewHash) || prior?.viewHash === viewHash && prior.sourcesHash === sourcesHash) authored[feature.id] = { viewHash, sourcesHash };
    if (!exists || read(root, feature.doc) !== source) writes.push({ path: feature.doc, source });
  }
  for (const path of [...writes.map(w => w.path), plan.index]) { local(root, path); permit(path); }
  const staging = local(root, `.cyc/runs/${state.id}/context-staging`);
  for (const w of writes) { mkdirSync(dirname(local(root, w.path)), { recursive: true }); atomicWrite(local(root, w.path), w.source, staging); }
  if (!existsSync(local(root, plan.index))) { mkdirSync(dirname(local(root, plan.index)), { recursive: true }); atomicWrite(local(root, plan.index), newIndexSource, staging); }
  refreshIndex(root, { staging, docs: plan.features.map(f => f.doc) });
  return { paths: writes.map(w => w.path), date, authored, notes, views: Object.fromEntries(plan.features.map(f => [f.id, sha(parseDoc(read(root, f.doc), fileName(f.doc)).currentView)])) };
}

// ---------------------------------------------------------------- run records

export function completedRuns(root) {
  const folder = local(root, '.cyc/runs');
  if (!existsSync(folder)) return [];
  return readdirSync(folder).filter(name => existsSync(join(folder, name, 'state.json'))).flatMap(id => {
    try { const state = readRun(root, id); return state.status === 'complete' ? [state] : []; }
    catch { return []; }
  });
}

function ledgerEntriesFor(root, state) {
  const entries = [];
  for (const path of new Set([state.projectLedgerPath, state.ledgerPath].filter(Boolean))) {
    let source;
    try { source = read(root, path); } catch { continue; }
    let current = null;
    for (const line of source.split('\n')) {
      const heading = line.match(/^## (\S+)/);
      if (heading) { current = { id: heading[1], title: oneLine(line.slice(3 + heading[1].length).replace(/^\s*\u00B7\s*/, ''), 120), path, mentions: false }; entries.push(current); continue; }
      if (current && line.includes(state.id)) current.mentions = true;
    }
  }
  return entries.filter(e => e.mentions).map(({ id, title, path }) => ({ id, title, path }));
}

// What a change record needs, read from the run's own state: nothing here is invented, and a field
// the run did not record is said to be missing.
export function runRecord(root, state) {
  const { folder: contextFolder } = contextLocation(root);
  const passed = stage => state.handoffs.findLast(h => h.stage === stage && h.status === 'passed');
  const build = state.handoffs.filter(h => h.stage === 'build' && h.status === 'passed');
  const deliver = passed('deliver'), verify = passed('verify');
  const final = deliver ?? verify ?? build.at(-1);
  const complete = state.history.find(h => h.type === 'complete');
  const completedAt = complete?.time ?? final?.recordedAt ?? state.startedAt;
  const date = day(completedAt);
  const files = (final?.artifacts ?? []).map(({ path, sha256 }) => ({ path, sha256 }));
  const learning = deliver?.assessment?.learning, errors = deliver?.assessment?.errorHistory;
  const retries = state.history.filter(h => h.type === 'retry' && text(h.reason)).map(h => h.reason);
  const proof = state.testProof;
  const exemption = verify?.assessment?.testProof;
  const checks = (state.verification?.results ?? []).map(r => `${r.id} ${r.passed ? 'passed' : 'failed'} (exit ${r.exitCode})`);
  const decisiveCheck = exemption?.status === 'exempt' ? `No test proof (exempt): ${oneLine(exemption.reason, 200)}`
    : proof?.claim ? oneLine(proof.claim, 240)
    : proof?.verdict ? oneLine(proof.verdict.split(/(?<=\.)\s/)[0], 240)
    : 'No test proof recorded.';
  const ledger = ledgerEntriesFor(root, state);
  const lessons = [];
  if (learning?.status === 'recorded' && text(learning.reason)) lessons.push(oneLine(learning.reason, 400));
  if (errors?.status === 'recorded' && text(errors.reason)) lessons.push(oneLine(errors.reason, 400));
  for (const reason of retries) lessons.push(`Retry: ${oneLine(reason, 400)}`);
  for (const entry of ledger) lessons.push(`Ledger ${entry.id}: ${entry.title}`);
  const contextDocs = (deliver?.contextDocs ?? files.map(f => f.path)).filter(p => isComponentDoc(p, contextFolder));
  return { runId: state.id, date, completedAt, goal: state.goal, playbook: state.playbook, files, changed: build.map(h => oneLine(h.summary.replace(/^Built: /, ''), 400)), decisiveCheck, checks, lessons: [...new Set(lessons)], contextDocs };
}

// ---------------------------------------------------------------- change records

// <context folder>/changes holds one record per completed run, <date>-<run>.md, and monthly digests,
// <YYYY-MM>.md. Both are entries in one format, so a digest is its records joined.
function changeSource({ date, run, goal, result, completed, proof, changed, learned, components, files, full = false }) {
  // A run's own record is kept short; migrated history is kept whole.
  const line = (value, max = 2000) => oneLine(value, full ? Infinity : max).replaceAll('\\|', '|');
  return [`# ${date} · run ${run} · ${line(goal, 100)}`, '', `Result: ${line(result)}`, ...(completed ? [`Completed: ${completed}`] : []), `Proof: ${line(proof)}`, `Changed: ${line(changed)}`, `Learned: ${line(learned)}`, '',
    'Components:', ...components.map(c => `- ${c.doc}: ${line(c.note || noNote)}`), '', 'Files:', ...files.map(f => `- ${f.path}@${f.hash}`), ''].join('\n');
}

export function parseChanges(source, file) {
  const entries = [];
  let entry = null, list = null;
  for (const line of source.replace(/^﻿/, '').replaceAll('\r\n', '\n').split('\n')) {
    const head = line.match(changeHeading);
    if (head) { entries.push(entry = { file, date: head[1], run: head[2], goal: head[3] ?? '', fields: {}, components: [], files: [], issues: [], lines: [] }); list = null; }
    // Text before the first entry would be lost when records are joined, so it is reported.
    if (!entry) { if (line.trim()) entries.stray = true; continue; }
    entry.lines.push(line);
    if (head || !line.trim()) continue;
    const field = line.match(/^(Result|Completed|Proof|Changed|Learned|Components|Files):\s*(.*)$/);
    const item = line.match(/^- (.+)$/);
    // A path may hold spaces or "@": the hash is what follows the last "@".
    const bound = list === 'Files' && item?.[1].match(recordItem);
    if (field) { list = ['Components', 'Files'].includes(field[1]) ? field[1] : null; if (!list) entry.fields[field[1].toLowerCase()] = field[2]; }
    else if (list === 'Components' && item) { const at = item[1].indexOf(': '); entry.components.push({ doc: at < 0 ? item[1] : item[1].slice(0, at), note: at < 0 || item[1].slice(at + 2) === noNote ? '' : item[1].slice(at + 2) }); }
    else if (bound) entry.files.push({ path: bound[1], hash: bound[2] });
    else entry.issues.push(`Unreadable line: ${oneLine(line, 80)}`);
  }
  for (const item of entries) item.source = `${item.lines.join('\n').replace(/\n*$/, '')}\n`;
  return entries;
}

// Every entry in the changes folder, newest first, with the folder's lint issues.
export function readChanges(root) {
  const folder = `${contextLocation(root).folder}/changes`, path = local(root, folder), entries = [], issues = [], files = [];
  const issue = (rule, message) => issues.push({ rule, message });
  for (const name of existsSync(path) ? readdirSync(path).sort() : []) {
    const file = `${folder}/${name}`;
    if (!changeFile.test(name) || !lstatSync(join(path, name)).isFile()) { issue('change-name', `${file} is not a change record or a monthly digest.`); continue; }
    files.push(name);
    const found = parseChanges(read(root, file), file), digest = name.length === 10;
    if (!found.length || found.stray || (digest ? found.some(e => !e.date.startsWith(name.slice(0, 7))) : found.length !== 1 || found[0].date !== name.slice(0, 10) || !found[0].run.startsWith(name.slice(11, -3)))) issue('change-entry', `${file} does not hold ${digest ? 'only entries of its month' : 'the one entry its name gives'}.`);
    for (const entry of found) {
      if (!entry.fields.result || entry.issues.length) issue('change-entry', `${file}, run ${entry.run}: ${entry.issues[0] ?? 'no "Result:" line.'}`);
      if (entries.some(e => e.run === entry.run)) issue('change-duplicate', `Run ${entry.run} has more than one entry; the second is in ${file}.`);
      entries.push(entry);
    }
  }
  entries.sort(newestFirst);
  return { folder, files, entries, issues };
}

// A completed run's record, from its own state. `files` are the verified bytes at completion; a
// later catch-up has only the delivery handoff's hashes. Only a run that planned a doc names it:
// a record that names a doc says the run verified the doc against these bytes.
export function changeFor(root, state, files) {
  if (state.status !== 'complete') throw Error(`Run ${state.id} is ${state.status}; only a completed run leaves a change record.`);
  const { folder } = contextLocation(root), plan = retentionOf(state), record = runRecord(root, state);
  const planned = plan?.disposition === 'required', source = path => !support(path, folder);
  const bound = planned && files
    ? [...[...new Set([...Object.keys(files).filter(p => files[p] !== state.initialSource.files[p]), ...plan.features.flatMap(f => featureFiles(root, state, f, files).files.map(item => item.path))])].filter(source).map(path => ({ path, hash: `sha256:${files[path]}` })),
      ...Object.keys(state.initialSource.files).filter(p => !(p in files) && source(p)).map(path => ({ path, hash: 'deleted' }))].sort((a, b) => a.path < b.path ? -1 : 1)
    : record.files.filter(f => source(f.path)).map(f => ({ path: f.path, hash: `sha256:${f.sha256}` }));
  const accepted = state.verification?.acceptedPreexistingFailures ?? [];
  const result = !state.requiresChecks ? 'completed · no executable checks, agent-reviewed evidence'
    : `passed${accepted.length ? ` with accepted pre-existing failures (${accepted.join(', ')})` : ''} · ${record.checks.join(', ') || 'check results not recorded'}`;
  return { name: `${record.date}-${shortRun(state.id)}.md`, source: changeSource({ date: record.date, run: state.id, goal: state.goal, result, completed: record.completedAt, proof: record.decisiveCheck, changed: record.changed.join(' ') || 'No Build summary recorded.', learned: record.lessons.join(' ') || 'No reusable learning recorded for this run.',
    components: planned ? plan.features.map(f => ({ doc: f.doc, note: state.contextPreparation?.notes?.[f.id] })) : [], files: bound }) };
}

// Published once per run. Catch-up keeps an entry that is already there; the completing run
// (`files` given) owns its record, so entries it did not write are removed, never adopted.
export function publishChange(root, state, files) {
  const staging = local(root, `.cyc/runs/${state.id}/context-staging`);
  let known = readChanges(root);
  const mine = known.entries.filter(entry => entry.run === state.id);
  if (mine.length && !files) return { path: mine[0].file, created: false };
  const change = changeFor(root, state, files);
  if (mine.length === 1 && mine[0].source === change.source) return { path: mine[0].file, created: false };
  for (const file of new Set(mine.map(entry => entry.file))) {
    const rest = parseChanges(read(root, file)).filter(entry => entry.run !== state.id);
    if (rest.length) atomicWrite(local(root, file), rest.map(entry => entry.source).join('\n'), staging);
    else unlinkSync(local(root, file));
  }
  if (mine.length) known = readChanges(root);
  const name = known.files.includes(change.name) ? `${change.name.slice(0, 11)}${state.id}.md` : change.name;
  if (known.files.includes(name)) throw Error(`${known.folder}/${name} already holds another entry; remove it.`);
  mkdirSync(local(root, known.folder), { recursive: true });
  atomicWrite(local(root, `${known.folder}/${name}`), change.source, staging);
  return { path: `${known.folder}/${name}`, created: true };
}

// ---------------------------------------------------------------- review: propose and publish

function componentsOf(root) {
  const { folder: contextFolder, index: indexName } = contextLocation(root);
  const exists = existsSync(local(root, indexName));
  const table = exists ? parseIndex(read(root, indexName)) : { rows: [] };
  const components = table.rows.filter(row => !row.malformed).flatMap(row => (row.links.length ? row.links : [null]).map(link => {
    const doc = resolveLink(root, link);
    return { component: row.component, covers: row.covers, doc, inFolder: isComponentDoc(doc, contextFolder) };
  }));
  return { exists, components };
}

// Runs that already have a record: a change entry, or a History entry in a doc of the earlier layout.
function recordedRuns(root, docs) {
  const { folder } = contextLocation(root), runs = new Map();
  for (const entry of readChanges(root).entries) runs.set(entry.run, { file: entry.file, docs: new Set() });
  for (const name of docs) for (const entry of parseDoc(read(root, `${folder}/${name}`), name).history) {
    const known = runs.get(entry.run) ?? { file: null, docs: new Set() };
    known.docs.add(`${folder}/${name}`);
    runs.set(entry.run, known);
  }
  return runs;
}

const newIndexSource = '# Context index\n\nRead this index first, then only the docs whose Covers match the paths you are about to change.\n\n| Component | Covers | Doc |\n| --- | --- | --- |\n';
function newDocSource(title, covers) {
  return `# ${title}\n\nCovers: ${covers.join(', ')}\n\n## Current view\n\n<Write what the code cannot tell a reader: the invariant, its writers and readers, the adopted decisions and the known dead ends.>\n\n## Lessons\n`;
}

// Rebuild the index from the docs: Covers follows each doc, the earlier per-run columns are dropped,
// a new doc's row goes in sorted position so two branches seldom add at the same line, and a merge
// conflict keeps both sides' rows, one per doc. Other rows and columns stay as written.
export function refreshIndex(root, { staging, docs, write = true } = {}) {
  const { folder, index } = contextLocation(root);
  const table = parseIndex(read(root, index));
  if (!table.header) throw Error(`${index} has no table with a Covers column.`);
  const dropped = ['lastChange', 'lessons'].map(key => table.columns[key]).filter(at => at >= 0);
  const render = cells => `| ${cells.filter((_, at) => !dropped.includes(at)).map(c => c.replaceAll('|', '\\|')).join(' | ')} |`;
  const rows = [], seen = new Set();
  for (const row of table.rows) {
    if (row.malformed) { rows.push({ text: table.lines[row.line] }); continue; }
    const doc = resolveLink(root, row.link), owned = isComponentDoc(doc, folder) && existsSync(local(root, doc)), cells = [...row.cells];
    if (owned && seen.has(doc)) continue;
    if (owned) {
      seen.add(doc);
      const covers = !docs || docs.includes(doc) ? parseDoc(read(root, doc), fileName(doc)).covers : [];
      if (covers.length) cells[table.columns.covers] = covers.join(', ');
    }
    rows.push({ text: render(cells), doc: owned ? doc : null });
  }
  let addedRows = 0;
  for (const name of listDocs(root)) {
    const doc = `${folder}/${name}`;
    if (seen.has(doc) || docs && !docs.includes(doc)) continue;
    const parsed = parseDoc(read(root, doc), name), cells = table.header.map(() => '');
    if (table.columns.component >= 0) cells[table.columns.component] = parsed.title ?? name;
    cells[table.columns.covers] = parsed.covers.join(', ');
    cells[table.columns.doc] = `[${parsed.title ?? name}](${name})`;
    const owned = rows.flatMap((row, at) => row.doc ? [at] : []);
    rows.splice(owned.find(at => rows[at].doc > doc) ?? (owned.length ? owned.at(-1) + 1 : rows.length), 0, { text: render(cells), doc });
    addedRows++;
  }
  // A conflict that opens just above the header covers the whole table, so its opening marker goes too.
  const opened = /^<{7} /.test(table.lines[table.headerLine - 1] ?? '') ? 1 : 0, count = mark => table.markers.filter(at => table.lines[at][0] === mark).length;
  if (count('<') + opened !== count('=') || count('=') !== count('>')) throw Error(`${index} has a merge conflict that reaches beyond its table; resolve it by hand.`);
  const start = table.headerLine - opened;
  const end = Math.max(table.headerLine, table.separatorLine, ...table.rows.map(row => row.line), ...table.markers);
  const content = `${[...table.lines.slice(0, start), render(table.header), render(table.separator ?? table.header.map(() => '---')), ...rows.map(row => row.text), ...table.lines.slice(end + 1)].join('\n').replace(/\n*$/, '')}\n`;
  const current = read(root, index) === content;
  if (write && !current) atomicWrite(local(root, index), content, staging);
  return { current, addedRows, droppedColumns: dropped.map(at => table.header[at]) };
}

export function indexContext(root, { write = false } = {}) {
  root = realpathSync(root);
  const { index } = contextLocation(root);
  if (!existsSync(local(root, index))) throw Error(`${index} does not exist.`);
  const result = refreshIndex(root, { write });
  const conflict = read(root, index).split('\n').some(line => conflictMarker.test(line));
  return { ok: !conflict && (write || result.current), path: index, ...result, written: write && !result.current, ...(conflict ? { conflict: 'Merge conflict markers remain outside the table rows; resolve them by hand.' } : {}) };
}

// Completed runs that lack a change record. --write publishes them from the runs' own state and
// never edits a doc: a doc that should have changed needs a normal run that plans it.
export function reviewContext(root, { run, since, all = false, write = false } = {}) {
  root = realpathSync(root);
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw Error('--since needs YYYY-MM-DD.');
  const recorded = recordedRuns(root, listDocs(root));
  let states;
  if (run) {
    const state = readRun(root, run);
    if (state.status !== 'complete') throw Error(`Run ${run} is ${state.status}; context proposals come from completed runs.`);
    states = [state];
  } else states = completedRuns(root);
  const pending = [];
  const runs = states.map(state => ({ state, record: runRecord(root, state) })).filter(({ record }) => !since || record.date >= since)
    .sort((a, b) => a.record.completedAt.localeCompare(b.record.completedAt) || a.record.runId.localeCompare(b.record.runId)).flatMap(({ state, record }) => {
      const known = recorded.get(record.runId);
      // Explicit --run/--all also list runs that already have a record.
      if (known && !run && !all) return [];
      if (!known) pending.push(state);
      return [{ runId: record.runId, date: record.date, goal: record.goal, playbook: record.playbook, contextDocsTouched: record.contextDocs, record: known?.file ?? null, earlierDocs: [...(known?.docs ?? [])], ...(known ? {} : { change: changeFor(root, state) }) }];
    });
  const result = { ok: true, runs, written: null, note: `${write ? 'Records were published from the runs\' own state; no doc was edited.' : 'Read-only: --write publishes each missing change record.'} A doc that should have changed needs a normal run that plans it.` };
  if (!write) return result;
  const written = pending.map(state => ({ runId: state.id, ...publishChange(root, state) }));
  const lint = lintContext(root, { git: false });
  return { ...result, written, lint: { ok: lint.ok, index: lint.index.issues, docs: lint.docs.filter(d => !d.ok).map(d => ({ path: d.path, issues: d.issues })), changes: lint.changes.issues } };
}

// A component's history: the entries that name its doc or changed a file it covers, newest first.
export function historyContext(root, { doc } = {}) {
  root = realpathSync(root);
  const { folder } = contextLocation(root), path = !doc ? null : /[\\/]/.test(doc) ? doc.replaceAll('\\', '/') : `${folder}/${doc.replace(/\.md$/, '')}.md`;
  if (path && !(isComponentDoc(path, folder) && existsSync(local(root, path)))) throw Error(`${path} is not a component doc in ${folder}.`);
  const covers = path ? parseDoc(read(root, path), fileName(path)).covers : [], own = file => !path || covered(covers, file.path);
  const entries = readChanges(root).entries.filter(entry => !path || entry.components.some(c => c.doc === path) || entry.files.some(own))
    .map(entry => ({ date: entry.date, run: entry.run, goal: entry.goal, result: entry.fields.result ?? 'not recorded', changed: entry.components.find(c => c.doc === path)?.note || entry.fields.changed, learned: entry.fields.learned, proof: entry.fields.proof, files: entry.files.filter(own).map(f => f.path), record: entry.file }));
  return { ok: true, doc: path, entries, note: 'Each entry is what that run recorded at completion, not the state of the code now.' };
}

// A month's digest holds its entries, newest first. A run already in it is kept as written; a
// record that says something else for that run is a conflict to resolve, not text to drop.
function writeDigest(root, folder, month, entries) {
  const path = `${folder}/${month}.md`, all = new Map();
  for (const entry of [...(existsSync(local(root, path)) ? parseChanges(read(root, path), path) : []), ...entries]) {
    if (!all.has(entry.run)) all.set(entry.run, entry);
    else if (all.get(entry.run).source !== entry.source) throw Error(`Run ${entry.run} has two entries with different text for ${month}; keep one before folding.`);
  }
  mkdirSync(local(root, folder), { recursive: true });
  atomicWrite(local(root, path), [...all.values()].sort(newestFirst).map(entry => entry.source).join('\n'), local(root, '.cyc/runtime/context-staging'));
  if (parseChanges(read(root, path), path).length !== all.size) throw Error(`${path} did not keep every entry; nothing was removed.`);
}

// Fold earlier months' records into their digests. A record is removed only once its digest holds it.
export function rollupContext(root, { before = new Date().toISOString().slice(0, 7), write = false } = {}) {
  root = realpathSync(root);
  if (!/^\d{4}-\d{2}$/.test(before)) throw Error('--before needs YYYY-MM.');
  const known = readChanges(root), blocking = known.issues.find(issue => issue.rule !== 'change-duplicate');
  if (blocking) throw Error(`Repair the changes folder first: ${blocking.message}`);
  const months = new Map();
  for (const name of known.files) if (name.length > 10 && name.slice(0, 7) < before) months.set(name.slice(0, 7), [...(months.get(name.slice(0, 7)) ?? []), `${known.folder}/${name}`]);
  const digests = [...months].sort().map(([month, records]) => ({ path: `${known.folder}/${month}.md`, records }));
  if (write) for (const [month, records] of months) {
    writeDigest(root, known.folder, month, known.entries.filter(entry => records.includes(entry.file)));
    for (const file of records) unlinkSync(local(root, file));
  }
  return { ok: true, before, digests, written: write, note: 'A digest holds the full text of the records it replaces.' };
}

// Convert docs of the earlier layout: History entries become change entries in monthly digests and
// the doc keeps Covers, Current view and Lessons. Nothing is dropped: what one doc said differently
// about a run goes in that doc's line, and a doc that cannot be converted completely stops the
// whole conversion. What an entry did not record stays "not recorded".
export function migrateContext(root, { write = false } = {}) {
  root = realpathSync(root);
  const { folder, index } = contextLocation(root), known = readChanges(root);
  const runs = new Map(), docs = [], skipped = [];
  for (const name of listDocs(root)) {
    const path = `${folder}/${name}`, source = read(root, path), parsed = parseDoc(source, name);
    if (parsed.layout !== 'earlier') continue;
    const blocking = parsed.issues.find(issue => ['sections', 'history-entry', 'evidence', 'last-change', 'last-change-current'].includes(issue.rule));
    const recorded = parsed.history.find(h => known.entries.some(entry => entry.run === h.run && !entry.components.some(c => c.doc === path)));
    if (blocking || recorded) { skipped.push({ path, reason: blocking ? `${blocking.rule}: ${blocking.message}` : `Run ${recorded.run} already has a change entry that does not name this doc.` }); continue; }
    for (const h of parsed.history) {
      const run = runs.get(h.run) ?? { date: h.date, run: h.run, goal: h.title, changed: h.changed, learned: h.learned, proof: h.proof, components: [], files: new Map() };
      const own = [['Date', h.date, run.date], ['Goal', h.title, run.goal], ['Changed', h.changed, run.changed], ['Learned', h.learned, run.learned], ['Proof', h.proof, run.proof]].filter(([, mine, theirs]) => mine && mine !== theirs).map(([label, mine]) => `${label}: ${mine}`);
      run.components.push({ doc: path, note: [...own, ...(h.extra ?? [])].join(' / ') });
      for (const file of h.files) run.files.set(`${file.path}@${file.hash}`, file);
      runs.set(h.run, run);
    }
    const lines = source.split('\n');
    docs.push({ path, entries: parsed.history.length, source: `${lines.slice(0, lines.indexOf('## History')).filter(line => !/^Last changed by AI:/.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '')}\n` });
  }
  const months = new Map(), missing = 'not recorded';
  for (const run of runs.values()) {
    if (known.entries.some(entry => entry.run === run.run)) continue;
    const [entry] = parseChanges(changeSource({ ...run, full: true, result: `${missing} (migrated from the doc History of the earlier layout)`, proof: run.proof ?? missing, changed: run.changed ?? missing, learned: run.learned ?? missing, files: [...run.files.values()] }));
    months.set(run.date.slice(0, 7), [...(months.get(run.date.slice(0, 7)) ?? []), entry]);
  }
  write &&= !skipped.length;
  if (write) {
    const staging = local(root, '.cyc/runtime/context-staging');
    for (const [month, entries] of months) writeDigest(root, known.folder, month, entries);
    for (const doc of docs) atomicWrite(local(root, doc.path), doc.source, staging);
    if (docs.length && existsSync(local(root, index))) refreshIndex(root, { staging });
  }
  return { ok: !skipped.length, docs: docs.map(({ path, entries }) => ({ path, entries })), runs: [...months.values()].flat().length, digests: [...months.keys()].sort().map(month => `${known.folder}/${month}.md`), skipped, written: write,
    note: skipped.length ? 'Nothing was converted: repair the skipped docs first, so no history is dropped.' : 'Docs and the index are verified source. Outcomes the earlier entries did not record stay "not recorded".' };
}

// ---------------------------------------------------------------- measure: what the index path costs

const codePoints = value => [...value].length;
const tokensEstimate = chars => Math.round(chars / 4);

export function measureContext(root, { paths = [], run } = {}) {
  root = realpathSync(root);
  const { folder: contextFolder, index: indexName } = contextLocation(root);
  if (!Array.isArray(paths)) throw Error('Paths must be an array.');
  const { exists, components } = componentsOf(root);
  if (!exists) throw Error(`${indexName} does not exist; nothing to measure.`);
  const size = path => { const source = read(root, path); return { path, bytes: Buffer.byteLength(source), chars: codePoints(source) }; };
  const sum = items => items.reduce((total, item) => ({ bytes: total.bytes + item.bytes, chars: total.chars + item.chars }), { bytes: 0, chars: 0 });
  const folder = local(root, contextFolder);
  const allDocs = readdirSync(folder).filter(name => name.endsWith('.md') && lstatSync(join(folder, name)).isFile()).sort().map(name => size(`${contextFolder}/${name}`));
  if (run) {
    const state = readRun(root, run);
    const final = state.handoffs.findLast(h => ['deliver', 'verify', 'build'].includes(h.stage) && h.status === 'passed');
    paths = [...new Set([...paths, ...(final?.artifacts ?? []).map(a => a.path)])];
  }
  for (const path of paths) canonicalPattern(path, { patterns: false });
  const matchedDocs = new Set(components.filter(c => c.doc && existsSync(local(root, c.doc)) && paths.some(path => covered(c.covers, path))).map(c => c.doc));
  matchedDocs.delete(indexName);
  const tocPathFiles = [size(indexName), ...[...matchedDocs].sort().map(size)];
  const tocPath = sum(tocPathFiles), all = sum(allDocs);
  const runRecords = completedRuns(root).map(state => {
    const files = [`.cyc/runs/${state.id}/state.json`, `.cyc/runs/${state.id}/review.md`].filter(path => existsSync(local(root, path))).map(size);
    return { runId: state.id, ...sum(files) };
  });
  const sorted = [...runRecords].sort((a, b) => a.chars - b.chars);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)].chars : null;
  return { ok: true, paths, tocPath: { files: tocPathFiles, ...tocPath, approxTokens: tokensEstimate(tocPath.chars) }, allDocs: { files: allDocs.length, ...all, approxTokens: tokensEstimate(all.chars) },
    runRecords: { runs: runRecords.length, ...sum(runRecords), approxTokens: tokensEstimate(sum(runRecords).chars), medianChars: median, medianApproxTokens: median === null ? null : tokensEstimate(median) },
    note: 'Characters are Unicode code points; approxTokens divides by 4, a rough estimate, no tokenizer was run. Run records are the controller\'s state.json and review.md, not the chat transcript, which this tool cannot see. A smaller read is not evidence that the next task succeeds with it.' };
}
