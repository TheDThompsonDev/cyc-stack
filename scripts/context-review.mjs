import { existsSync, lstatSync, statSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readRun, contextUpdate } from './runtime.mjs';
import { contextLinks } from './project-tools.mjs';

// Component context docs under docs/context/ and their quality check. A doc is for one component,
// in a fixed AI-readable layout, and the index (the table of contents) carries enough per component
// that a task can read the index plus the matched docs instead of every doc. `review` proposes
// doc updates from completed controller runs and `--write` applies them; `lint` checks the rules
// below and the index's freshness against Git; `measure` counts what the index path costs to read.

export const contextFolder = 'docs/context';
export const indexName = `${contextFolder}/INDEX.md`;
const reservedDocs = new Set(['INDEX.md', 'error-ledger.md', 'verify-recipe.md']);
const docFileName = /^[a-z][a-z0-9-]*\.md$/;
const dateText = /\d{4}-\d{2}-\d{2}/;
const runIdText = /[A-Za-z0-9][A-Za-z0-9._-]{3,}/;
const hashText = /(?:sha256:)?[0-9a-f]{7,64}/;
const lastChangeLine = new RegExp(`^Last changed by AI: (?:none recorded|(${dateText.source}) · run (${runIdText.source}) · files: (.+))$`);
const historyHeading = new RegExp(`^### (${dateText.source}) · run (${runIdText.source})(?: · (.*))?$`);
const lessonLine = new RegExp(`^- (${dateText.source}) · ([^:]+): (.+)$`);
const fileItem = new RegExp(`^\`?([^\`@\\s]+)\`?@(${hashText.source})$`);
const sectionOrder = ['Current view', 'Lessons', 'History'];
export const maxDocLines = 300;

// Each rule is named in a lint issue so the fix is clear. They are structure rules only: a doc can
// pass every one and still be wrong about the component.
export const rules = {
  name: `The file name is kebab-case (${docFileName.source}); INDEX.md, error-ledger.md and verify-recipe.md are not component docs.`,
  title: 'The first non-empty line is the only H1, naming the one component the doc covers.',
  covers: 'A "Covers:" line lists one or more project-relative path patterns (comma-separated, forward slashes, no parent segments).',
  'last-change': 'A "Last changed by AI:" line reads "none recorded" or "<YYYY-MM-DD> · run <id> · files: <paths>".',
  sections: `The H2 sections are exactly ${sectionOrder.map(name => `"## ${name}"`).join(', ')}, once each, in that order.`,
  'current-view': 'Current view has prose and no <placeholder> left from the template.',
  'lesson-dated': 'Every line under Lessons is a bullet "- <YYYY-MM-DD> · <source>: <lesson>".',
  'history-entry': 'Every History entry heads with "### <YYYY-MM-DD> · run <id>", newest first, and nothing but entries appears under History.',
  evidence: 'Every History entry has a "**Files:**" line listing each file as path@<sha256 or commit>.',
  'last-change-current': 'The "Last changed by AI" line names the newest History entry.',
  size: `The doc has at most ${maxDocLines} lines; consolidate older entries past that.`,
  'toc-columns': 'The index table has Component (or Area), Covers, Doc (or Record), Last AI change and Lessons columns.',
  'toc-link': 'Every index Doc link resolves to an existing file.',
  'toc-unindexed': 'Every component doc in docs/context/ has exactly one index row.',
  'toc-covers': 'An index row\'s Covers equals its doc\'s Covers line.',
  'toc-last-change': 'An index row\'s Last AI change starts with the doc\'s last-change date and run.',
  'toc-lessons': 'An index row\'s Lessons cell starts with the doc\'s lesson count.',
  'stale-against-git': 'A covered path was committed after the doc\'s last commit, so the doc may describe code that has changed.'
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
  let lastChange = null;
  if (lastIndex === -1) issue('last-change', 'Missing "Last changed by AI:" line.');
  else {
    const match = lines[lastIndex].match(lastChangeLine);
    if (!match) issue('last-change', `Unreadable line: ${lines[lastIndex]}`, lastIndex);
    else lastChange = match[1] ? { date: match[1], run: match[2], files: match[3].split(',').map(p => p.trim().replaceAll('`', '')).filter(Boolean) } : 'none recorded';
  }
  const h2 = lines.map((line, index) => [line, index]).filter(([line]) => /^## /.test(line));
  const names = h2.map(([line]) => line.slice(3).trim());
  if (names.join('\n') !== sectionOrder.join('\n')) issue('sections', `Found sections: ${names.map(n => `"## ${n}"`).join(', ') || 'none'}.`);
  const section = name => {
    const at = h2.findIndex(([line]) => line.slice(3).trim() === name);
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
  return { name, title, covers, lastChange, lessons, history, currentView: view?.lines.join('\n').trim() ?? '', lines: lines.length, issues };
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
  const table = { header: null, headerLine: -1, separatorLine: -1, columns: {}, rows: [], lines };
  for (const [index, line] of lines.entries()) {
    if (!/^\s*\|/.test(line)) { if (table.header && (table.rows.length || table.separatorLine >= 0)) break; table.header = null; continue; }
    const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
    if (!table.header) {
      if (!cells.some(c => c.toLowerCase() === 'covers')) continue;
      table.header = cells; table.headerLine = index;
      for (const [key, aliases] of Object.entries(columnAliases)) table.columns[key] = cells.findIndex(c => aliases.includes(c.toLowerCase()));
      continue;
    }
    if (cells.every(c => /^:?-+:?$/.test(c))) { table.separatorLine = index; continue; }
    if (cells.length !== table.header.length) { table.rows.push({ line: index, malformed: true, cells }); continue; }
    const cell = key => table.columns[key] >= 0 ? cells[table.columns[key]] : '';
    const links = contextLinks(cell('doc'));
    const link = cell('doc').match(/\[[^\]]+\]\(([^)#]+)[^)]*\)/);
    table.rows.push({ line: index, cells, component: cell('component'), covers: cell('covers').replaceAll('`', '').split(',').map(p => p.trim()).filter(Boolean), docText: cell('doc'), links, link: link ? decodeURIComponent(link[1]) : null, lastChange: cell('lastChange'), lessons: cell('lessons') });
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

// Freshness against Git: the doc's last commit against the last commit that touched a covered path.
// Same commit, or the doc committed later, is fresh. Uncommitted edits to covered paths are reported
// as dirty, never as stale: they have no commit yet, and the doc may be edited in the same change.
export function docFreshness(root, docPath, covers) {
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
  if (later) return { status: 'stale', docCommit: doc, coveredCommit, dirtyPaths };
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
  for (const [key, index] of Object.entries(table.columns)) if (index === -1) issue('toc-columns', `Missing column ${columnAliases[key].join(' or ')}.`, table.headerLine);
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
    const expectLast = parsed.lastChange && parsed.lastChange !== 'none recorded' ? `${parsed.lastChange.date} · run ${shortRun(parsed.lastChange.run)}` : 'none recorded';
    if (table.columns.lastChange >= 0 && !row.lastChange.startsWith(expectLast)) issue('toc-last-change', `Row says "${oneLine(row.lastChange, 60)}", the doc says "${expectLast}".`, row.line);
    const expectLessons = parsed.lessons.length ? String(parsed.lessons.length) : 'none';
    if (table.columns.lessons >= 0 && !(row.lessons === expectLessons || row.lessons.startsWith(`${expectLessons} `))) issue('toc-lessons', `Row says "${oneLine(row.lessons, 60)}", the doc has ${parsed.lessons.length} lesson(s).`, row.line);
    if (checkGit) {
      const fresh = docFreshness(root, docPath, parsed.covers);
      freshness.push({ doc: docPath, ...fresh });
      if (fresh.status === 'stale') issue('stale-against-git', `${docPath}: ${fresh.coveredCommit.commit.slice(0, 7)} (${day(fresh.coveredCommit.date)}, ${oneLine(fresh.coveredCommit.subject, 60)}) touched covered paths after the doc's last commit ${fresh.docCommit.commit.slice(0, 7)} (${day(fresh.docCommit.date)}).`, row.line);
    }
  }
  for (const name of docs) if (!seen.has(`${contextFolder}/${name}`)) issue('toc-unindexed', `${contextFolder}/${name} has no index row.`);
  return { path: indexName, exists, ok: !issues.length, rows, issues, freshness };
}

const docSummary = result => ({ path: result.path, ok: result.ok, issues: result.issues, lines: result.lines, lessons: result.lessons.length, history: result.history.length });

export function lintContext(root, { doc, git: checkGit = true } = {}) {
  root = realpathSync(root);
  const { folder: contextFolder } = contextLocation(root);
  if (doc) {
    const result = lintDoc(root, doc.replaceAll('\\', '/'));
    return { ok: result.ok, docs: [docSummary(result)], rules, note: 'Structure rules only: a passing doc can still be wrong about its component.' };
  }
  const docs = listDocs(root).map(name => docSummary(lintDoc(root, `${contextFolder}/${name}`)));
  const index = lintIndex(root, { git: checkGit });
  return { ok: docs.every(d => d.ok) && index.ok, index: { path: index.path, exists: index.exists, ok: index.ok, issues: index.issues, freshness: index.freshness }, docs, rules, note: 'Structure and freshness rules only: a passing doc can still be wrong about its component, and a fresh doc is one whose covered paths have no later commit, not one that is correct.' };
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
  const paths = feature.paths.length ? feature.paths : changed;
  const recordCovers = existsSync(local(root, feature.doc)) ? parseDoc(read(root, feature.doc), fileName(feature.doc)).covers : [];
  const selected = changed.filter(p => covered([...paths, ...recordCovers], p));
  for (const path of paths) {
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
  issues.push(...index.issues);
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
    const latest = parsed.history[0];
    if (parsed.history.filter(h => h.run === state.id).length !== 1) issue('feature-history', 'Keep exactly one entry for the current run.', doc);
    if (latest?.run !== state.id) issue('feature-history', 'Current feature work needs its own dated History entry before verification.', doc);
    if (!latest?.files.length) issue('feature-evidence', 'Current History needs actual selected source evidence.', doc);
    for (const item of latest?.files ?? []) {
      try {
        const path = canonicalPattern(item.path, { patterns: false });
        if (support(path, plan.folder) || !files[path] || !files[path].startsWith(item.hash.replace(/^sha256:/, ''))) issue('feature-evidence', `Missing/stale current source evidence: ${path}.`, doc);
      } catch (error) { issue('feature-evidence', error.message, doc); }
    }
    for (const item of selected.files) if (!latest?.files.some(f => f.path === item.path)) issue('feature-evidence', `No current source evidence for ${item.path}.`, doc);
    const authored = state.contextPreparation?.authored?.[feature.id];
    if (!authored || authored.viewHash !== sha(parsed.currentView) || authored.sourcesHash !== sha(JSON.stringify(selected.files))) issue('feature-authoring', 'Author or revalidate the focused Current view against this source; generated History alone is not retained feature knowledge.', doc);
    if (!files[doc] || !files[plan.index]) issue('feature-source', 'Canonical context/index must be included in verified source, not ignored runtime data.', doc);
    docs.push(doc);
  }
  for (const path of changed) {
    if ((sourceEntrypoint(path) || !state.initialSource.files[path] && !testPath(path)) && !covered(ownership, path)) issue('feature-entrypoint', `Changed implementation path has no planned canonical feature owner: ${path}.`);
    for (const row of index.rows.filter(row => row.componentDoc && covered(row.covers, path))) if (!plan.features.some(f => f.doc === row.doc)) issue('feature-owner', `Plan the affected canonical owner ${row.doc} for ${path} before Build; retention remains pending without broadening this run.`);
  }
  return { ok: !issues.length, status: issues.length ? 'pending' : 'retained', docs, issues, note: 'Layout, mapping, provenance and source checks only; authored semantic truth and user acceptance are not certified.' };
}

// Only the caller's active, scoped runtime transaction may invoke this writer.
// It uses observations available now; final receipts stay outside covered source.
export function prepareRetention(root, state, { records = [], summary = '', reason = '' } = {}, files, permit) {
  const plan = retentionOf(state);
  if (!plan || plan.disposition !== 'required') return { paths: [], authored: {} };
  if (!Array.isArray(records) || new Set(records.map(r => r?.id)).size !== records.length || records.some(r => !plan.features.some(f => f.id === r?.id) || !text(r.currentView) || /<(?:write|describe|fill|actual|placeholder|todo)\b/i.test(r.currentView))) throw Error('learning.context needs unique planned ids and actual nonplaceholder currentView text.');
  const writes = [], authored = {};
  const date = state.contextPreparation?.date ?? new Date().toISOString().slice(0, 10);
  for (const feature of plan.features) {
    const exists = existsSync(local(root, feature.doc)), selected = featureFiles(root, state, feature, files);
    let source = exists ? read(root, feature.doc) : newDocSource(feature.id.replaceAll('-', ' '), selected.files.length ? selected.files.map(f => f.path) : selected.paths);
    let parsed = parseDoc(source, fileName(feature.doc));
    if (parsed.issues.some(i => ['sections', 'title', 'last-change'].includes(i.rule)) || parsed.issues.some(i => i.rule === 'last-change-current') && parsed.lastChange?.run !== state.id) throw Error(`Repair existing context metadata/history first: ${feature.doc}. Do not invent an older run entry.`);
    const record = records.find(r => r.id === feature.id);
    if (record) source = source.replace(/(## Current view\n)[\s\S]*?(?=\n## Lessons)/, (_, heading) => `${heading}\n${record.currentView.trim()}\n`);
    parsed = parseDoc(source, fileName(feature.doc));
    const viewHash = sha(parsed.currentView), sourcesHash = sha(JSON.stringify(selected.files));
    const prior = state.contextPreparation?.authored?.[feature.id];
    if (record || viewHash !== (state.contextPreparation?.views?.[feature.id] ?? feature.baselineViewHash) || prior?.viewHash === viewHash && prior.sourcesHash === sourcesHash) authored[feature.id] = { viewHash, sourcesHash };
    // Replace only this still-active run's preparation, preserving completed history.
    const lines = source.split('\n');
    for (const own of parsed.history.filter(h => h.run === state.id).reverse()) {
      const next = parsed.history.find(h => h.line > own.line);
      lines.splice(own.line - 1, (next ? next.line - 1 : source.split('\n').length) - (own.line - 1));
    }
    source = lines.join('\n');
    const entry = [`### ${date} · run ${state.id} · ${oneLine(state.goal, 100)}`, `**Changed:** ${oneLine(summary || state.goal, 400)}`, `**Learned:** ${oneLine(reason || 'See the authored Current view; no user acceptance is inferred.', 400)}`, `**Decisive check:** Planned commands: ${state.commands.map(c => [c.command, ...c.args].join(' ')).join('; ') || 'none'}. Final outcomes are not yet claimed; inspect run ${state.id} command receipts separately. Local receipts may not travel with source.`, `**Files:** ${selected.files.map(f => `${f.path}@sha256:${f.sha256}`).join(', ')}`].join('\n');
    source = applyEntry(source, { entry, lessons: [], lastChange: `Last changed by AI: ${date} · run ${state.id} · files: ${selected.files.map(f => f.path).join(', ')}` });
    if (!exists || read(root, feature.doc) !== source) writes.push({ path: feature.doc, source });
  }
  for (const path of [...writes.map(w => w.path), plan.index]) { local(root, path); permit(path); }
  const staging = local(root, `.cyc/runs/${state.id}/context-staging`);
  for (const w of writes) { mkdirSync(dirname(local(root, w.path)), { recursive: true }); atomicWrite(local(root, w.path), w.source, staging); }
  if (!existsSync(local(root, plan.index))) { mkdirSync(dirname(local(root, plan.index)), { recursive: true }); atomicWrite(local(root, plan.index), '# Feature context\n\n| Component | Covers | Doc | Last AI change | Lessons |\n| --- | --- | --- | --- | --- |\n', staging); }
  refreshIndex(root, { staging, docs: plan.features.map(f => f.doc) });
  return { paths: writes.map(w => w.path), date, authored, views: Object.fromEntries(plan.features.map(f => [f.id, sha(parseDoc(read(root, f.doc), fileName(f.doc)).currentView)])) };
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

// What a component doc entry needs, read from the run's own record: nothing here is invented, and
// a field the run did not record is said to be missing.
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
  const failed = state.handoffs.filter(h => h.status === 'failed').map(h => h.summary);
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
  return { runId: state.id, date, completedAt, goal: state.goal, playbook: state.playbook, status: state.status, session: state.session ?? null, files,
    changed: build.map(h => oneLine(h.summary.replace(/^Built: /, ''), 400)),
    learning: learning ? { status: learning.status, reason: oneLine(learning.reason, 400), artifacts: learning.artifacts ?? [] } : null,
    errorHistory: errors ? { status: errors.status, reason: oneLine(errors.reason, 400), artifacts: errors.artifacts ?? [] } : null,
    retries, failedHandoffs: failed, failures: state.failures ?? 0, ledgerEntries: ledger, decisiveCheck, checks, lessons: [...new Set(lessons)], contextDocs };
}

function entryMarkdown(record, files) {
  const learned = record.lessons.length ? record.lessons.join(' ') : 'No reusable learning recorded for this run.';
  return [
    `### ${record.date} · run ${record.runId} · ${oneLine(record.goal, 100)}`,
    `**Changed:** ${record.changed.join(' ') || 'No Build summary recorded.'}`,
    `**Learned:** ${learned}`,
    `**Decisive check:** ${record.decisiveCheck}${record.checks.length ? ` Checks: ${record.checks.join(', ')}.` : ''}`,
    `**Files:** ${files.map(f => `${f.path}@sha256:${f.sha256.slice(0, 12)}`).join(', ')}`
  ].join('\n');
}
const lessonBullets = record => record.lessons.map(lesson => `- ${record.date} · run ${shortRun(record.runId)}: ${lesson}`);

// ---------------------------------------------------------------- review: propose and write

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

function recordedRuns(root, docs) {
  const { folder: contextFolder } = contextLocation(root);
  const runs = new Map();
  for (const name of docs) {
    const parsed = parseDoc(read(root, `${contextFolder}/${name}`), name);
    for (const entry of parsed.history) runs.set(entry.run, [...(runs.get(entry.run) ?? []), `${contextFolder}/${name}`]);
  }
  return runs;
}

function newDocSource(title, covers) {
  return `# ${title}\n\nCovers: ${covers.join(', ')}\n\nLast changed by AI: none recorded\n\n## Current view\n\n<Write what the code cannot tell a reader: the invariant, its writers and readers, the adopted decisions and the known dead ends.>\n\n## Lessons\n\n## History\n`;
}

// Insert the entry under History and the lessons under Lessons, newest first, and set the
// last-change line. The Current view is the author's; it is never edited here.
export function applyEntry(source, { entry, lessons, lastChange }) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const at = name => lines.findIndex(line => line === `## ${name}`);
  const history = at('History'), lessonsAt = at('Lessons'), last = lines.findIndex(line => /^Last changed by AI:/.test(line));
  if (history === -1 || lessonsAt === -1 || last === -1) throw Error('The doc lacks the fixed layout (Last changed by AI line, ## Lessons, ## History); fix it with cyc context lint before writing to it.');
  const entryDate = entry.split('\n')[0].match(historyHeading)?.[1];
  const existing = lines.flatMap((line, index) => index > history && historyHeading.test(line) ? [{ index, date: line.match(historyHeading)[1] }] : []);
  const insertion = existing.find(item => item.date <= entryDate)?.index ?? (existing.length ? lines.length : history + 1);
  lines.splice(insertion, 0, '', ...entry.split('\n'), '');
  if (lessons.length) {
    const bullets = lines.flatMap((line, index) => index > lessonsAt && index < at('History') && lessonLine.test(line) ? [{ index, date: line.match(lessonLine)[1] }] : []);
    const lessonDate = lessons[0].match(lessonLine)?.[1];
    const first = bullets.find(item => item.date <= lessonDate)?.index ?? (bullets.length ? at('History') : lessonsAt + 1);
    lines.splice(first, 0, '', ...lessons);
  }
  // Catching up an older missing run must not relabel a newer current view.
  if (!existing.length || entryDate >= existing[0].date) lines[last] = lastChange;
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '')}\n`;
}

function indexCells(root, docPath) {
  const parsed = parseDoc(read(root, docPath), fileName(docPath));
  const last = parsed.lastChange && parsed.lastChange !== 'none recorded' ? `${parsed.lastChange.date} · run ${shortRun(parsed.lastChange.run)}${parsed.history[0]?.title ? ` · ${oneLine(parsed.history[0].title, 80)}` : ''}` : 'none recorded';
  const lessons = parsed.lessons.length ? `${parsed.lessons.length} · latest: ${oneLine(parsed.lessons[0].text, 80)}` : 'none';
  return { parsed, last, lessons };
}

export function refreshIndex(root, { staging, docs } = {}) {
  const { folder: contextFolder, index: indexName } = contextLocation(root);
  const table = parseIndex(read(root, indexName));
  if (!table.header) throw Error(`${indexName} has no table with a Covers column.`);
  const lines = table.lines;
  const columns = { ...table.columns };
  const width = table.header.length;
  const added = [];
  for (const [key, label] of [['lastChange', 'Last AI change'], ['lessons', 'Lessons']]) if (columns[key] === -1) { columns[key] = width + added.length; added.push(label); }
  const render = cells => `| ${cells.map(c => c.replaceAll('|', '\\|')).join(' | ')} |`;
  if (added.length) {
    lines[table.headerLine] = render([...table.header, ...added]);
    if (table.separatorLine >= 0) lines[table.separatorLine] = render([...Array(width + added.length)].map(() => '---'));
  }
  const seen = new Set();
  for (const row of table.rows) {
    if (row.malformed) continue;
    const docPath = resolveLink(root, row.link);
    const cells = [...row.cells, ...added.map(() => '')];
    if (isComponentDoc(docPath, contextFolder) && existsSync(local(root, docPath))) {
      seen.add(docPath);
      if (!docs || docs.includes(docPath)) {
        const { parsed, last, lessons } = indexCells(root, docPath);
        if (parsed.covers.length) cells[columns.covers] = parsed.covers.join(', ');
        cells[columns.lastChange] = last; cells[columns.lessons] = lessons;
      }
    }
    lines[row.line] = render(cells);
  }
  const lastRow = table.rows.length ? table.rows.at(-1).line : table.separatorLine;
  const appended = [];
  for (const name of listDocs(root)) {
    const docPath = `${contextFolder}/${name}`;
    if (seen.has(docPath) || docs && !docs.includes(docPath)) continue;
    const { parsed, last, lessons } = indexCells(root, docPath);
    const cells = [...Array(width + added.length)].map(() => '');
    if (columns.component >= 0) cells[columns.component] = parsed.title ?? name;
    cells[columns.covers] = parsed.covers.join(', ');
    cells[columns.doc] = `[${parsed.title ?? name}](${name})`;
    cells[columns.lastChange] = last; cells[columns.lessons] = lessons;
    appended.push(render(cells));
  }
  lines.splice(lastRow + 1, 0, ...appended);
  const content = `${lines.join('\n').replace(/\n*$/, '')}\n`;
  if (read(root, indexName) !== content) atomicWrite(local(root, indexName), content, staging);
  return { addedColumns: added, addedRows: appended.length };
}

export function reviewContext(root, { run, since, all = false, write = false, newDoc, updateRun } = {}) {
  root = realpathSync(root);
  const { folder: contextFolder, index: indexName } = contextLocation(root);
  if (newDoc !== undefined && (!docFileName.test(`${newDoc}.md`) || reservedDocs.has(`${newDoc}.md`))) throw Error(`--new needs a kebab-case component name (${docFileName.source} without .md).`);
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw Error('--since needs YYYY-MM-DD.');
  const { exists, components } = componentsOf(root);
  const docs = listDocs(root);
  const recorded = recordedRuns(root, docs);
  let states;
  if (run) {
    const state = readRun(root, run);
    if (state.status !== 'complete') throw Error(`Run ${run} is ${state.status}; context proposals come from completed runs.`);
    states = [state];
  } else states = completedRuns(root);
  const records = states.map(state => runRecord(root, state)).filter(record => !since || record.date >= since).sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.runId.localeCompare(b.runId));
  const proposals = [];
  const unmappedAll = new Map();
  for (const record of records) {
    const perComponent = new Map();
    const unmapped = [];
    const retained = new Set([...record.contextDocs, ...(record.learning?.artifacts ?? []), ...(record.errorHistory?.artifacts ?? [])]);
    for (const file of record.files) {
      if (file.path.startsWith('.cyc/') || [indexName, `${contextFolder}/error-ledger.md`, `${contextFolder}/verify-recipe.md`, `${contextFolder}/recipes.json`].includes(file.path)) continue;
      let mapped = false;
      for (const component of components) {
        if (!covered(component.covers, file.path)) continue;
        mapped = true;
        const key = component.doc ?? component.component;
        if (!perComponent.has(key)) perComponent.set(key, { ...component, files: [] });
        perComponent.get(key).files.push(file);
      }
      if (!mapped && !retained.has(file.path) && !file.path.startsWith('.cyc/')) unmapped.push(file);
    }
    const proposal = { runId: record.runId, date: record.date, goal: record.goal, playbook: record.playbook, contextDocsTouched: record.contextDocs,
      components: [...perComponent.values()].map(component => {
        const alreadyRecorded = (recorded.get(record.runId) ?? []).includes(component.doc);
        const touched = !!component.doc && (record.contextDocs.includes(component.doc) || (record.learning?.artifacts ?? []).includes(component.doc));
        return { component: component.component, doc: component.doc, writable: component.inFolder, touched, alreadyRecorded, shouldHaveBeenTouched: !touched && component.inFolder, files: component.files, entry: entryMarkdown(record, component.files), lessons: lessonBullets(record) };
      }),
      unmapped, lessons: record.lessons, decisiveCheck: record.decisiveCheck, learning: record.learning, errorHistory: record.errorHistory, ledgerEntries: record.ledgerEntries };
    // A run is caught up only when every writable component has its entry and no changed file
    // remains unmapped. Explicit --run/--all keep the complete diagnostic view.
    if (!run && !all && recorded.has(record.runId) && !unmapped.length && !proposal.components.some(component => component.writable && !component.alreadyRecorded)) continue;
    if (unmapped.length && newDoc) {
      const path = `${contextFolder}/${newDoc}.md`;
      proposal.newDoc = { path, covers: unmapped.map(f => f.path), entry: entryMarkdown(record, unmapped), lessons: lessonBullets(record), exists: existsSync(local(root, path)) };
    }
    for (const file of unmapped) unmappedAll.set(file.path, [...(unmappedAll.get(file.path) ?? []), record.runId]);
    proposals.push(proposal);
  }
  const result = { ok: true, index: { path: indexName, exists, components: components.length, componentDocs: docs.length }, runs: proposals, unmappedFiles: [...unmappedAll].map(([path, runs]) => ({ path, runs })), written: null,
    note: write ? 'Entries were appended from the runs\' own records; the Current view of each doc is yours to update. Review the diff before committing.' : 'Read-only proposal from completed run records: nothing was written. Add --write to append these entries and refresh the index; --new NAME creates a doc for unmapped files.' };
  if (!write) return result;
  if (!updateRun) throw Error('Completed-run catch-up needs a new active scoped update: context review --run SOURCE_ID --write --update-run UPDATE_ID. Use context prepare for current work; a reply packet cannot verify changed context.');
  const writePaths = [...new Set([indexName, ...proposals.flatMap(p => [...p.components.filter(c => c.writable && !c.alreadyRecorded).map(c => c.doc), ...(p.newDoc ? [p.newDoc.path] : [])])])];
  return contextUpdate(root, updateRun, writePaths, state => {
  const retention = retentionOf(state);
  if (!state.requiresChecks || !state.commands.length || retention?.disposition !== 'required' || writePaths.some(path => path !== indexName && !retention.features.some(f => f.doc === path))) throw Error('Catch-up needs a required feature-context plan covering these records and executable final verification. Start an implementation update with those canonical docs before Build; advisory catch-up cannot complete the repair.');
  const staging = local(root, `.cyc/runs/${updateRun}/context-staging`);
  const written = [];
  for (const proposal of proposals) {
    for (const component of proposal.components) {
      if (!component.writable || component.alreadyRecorded) continue;
      const source = read(root, component.doc);
      const parsed = parseDoc(source, fileName(component.doc));
      const blocking = parsed.issues.filter(i => ['sections', 'last-change', 'title'].includes(i.rule));
      if (blocking.length) { written.push({ doc: component.doc, runId: proposal.runId, written: false, reason: `Fix first: ${blocking.map(i => `${i.rule} (${i.message})`).join('; ')}` }); continue; }
      const lastChange = `Last changed by AI: ${proposal.date} · run ${proposal.runId} · files: ${component.files.map(f => f.path).join(', ')}`;
      atomicWrite(local(root, component.doc), applyEntry(source, { entry: component.entry, lessons: component.lessons, lastChange }), staging);
      recorded.set(proposal.runId, [...(recorded.get(proposal.runId) ?? []), component.doc]);
      written.push({ doc: component.doc, runId: proposal.runId, written: true });
    }
    if (proposal.newDoc) {
      const { path, covers, entry, lessons } = proposal.newDoc;
      const title = newDoc.split('-').map((w, i) => i ? w : w[0].toUpperCase() + w.slice(1)).join(' ');
      const source = existsSync(local(root, path)) ? read(root, path) : newDocSource(title, covers);
      if (parseDoc(source, `${newDoc}.md`).history.some(e => e.run === proposal.runId)) continue;
      mkdirSync(dirname(local(root, path)), { recursive: true });
      atomicWrite(local(root, path), applyEntry(source, { entry, lessons, lastChange: `Last changed by AI: ${proposal.date} · run ${proposal.runId} · files: ${covers.join(', ')}` }), staging);
      written.push({ doc: path, runId: proposal.runId, written: true, created: !proposal.newDoc.exists });
    }
  }
  let index = null;
  if (written.some(w => w.written)) {
    if (!existsSync(local(root, indexName))) { mkdirSync(dirname(local(root, indexName)), { recursive: true }); atomicWrite(local(root, indexName), '# Context index\n\nRead the index, then the docs whose Covers match the paths you are about to change.\n\n| Component | Covers | Doc | Last AI change | Lessons |\n| --- | --- | --- | --- | --- |\n', staging); }
    index = refreshIndex(root, { staging });
  }
  const lint = lintContext(root, { git: false });
  return { ...result, written, indexRefreshed: index, lint: { ok: lint.ok, index: lint.index.issues, docs: lint.docs.filter(d => !d.ok).map(d => ({ path: d.path, issues: d.issues })) } };
  });
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
