import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { atomicJSON, configuration, readRun, runCommands, sourceSnapshot } from './runtime.mjs';

const registryName = 'docs/context/recipes.json';
const indexName = 'docs/context/INDEX.md';
const hash = value => createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const helper = fileURLToPath(new URL('../methods/cyc-context/scripts/evidence.mjs', import.meta.url));
const idPattern = /^[a-z][a-z0-9-]{0,63}$/;
const recipeKinds = ['investigation', 'verification'];

function canonical(path, patterns = false) {
  if (!text(path) || /[\\:\0]/.test(path) || (!patterns && /[*?\[\]{}]/.test(path)) || /[\[\]{}]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error(`Use canonical project-relative ${patterns ? 'patterns' : 'paths'}: ${path}`);
  return path;
}

// Reject linked ancestors even inside the project: receipts must remain excluded
// runtime files, and discovery must never follow context links to outside data.
function local(root, path) {
  canonical(path);
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw Error(`Linked path is not supported: ${path}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
}

function matches(pattern, path) {
  canonical(pattern, true); canonical(path);
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

function selection(root, { paths = [], goal = '', run } = {}) {
  if (!Array.isArray(paths)) throw Error('Paths must be an array.');
  if (run) {
    const state = readRun(root, run);
    goal ||= state.goal;
    if (!paths.length) {
      const now = sourceSnapshot(root).files;
      const before = state.initialSource?.files ?? {};
      paths = [...new Set([...Object.keys(before), ...Object.keys(now)])].filter(p => before[p] !== now[p]);
      if (!paths.length) paths = state.allowedPaths ?? [];
    }
  }
  paths = [...new Set(paths.map(p => canonical(p)))];
  const words = String(goal).toLowerCase().match(/[a-z0-9-]{3,}/g)?.filter(w => !['the', 'and', 'for', 'with', 'this', 'that', 'add', 'fix', 'change'].includes(w)) ?? [];
  return { paths, goal, relevant: (covers, description) => paths.length ? covers.some(p => paths.some(path => matches(p, path))) : words.some(w => description.toLowerCase().includes(w)) };
}

function registry(root) {
  const path = local(root, registryName);
  if (!existsSync(path)) return { present: false, recipes: [], hash: null };
  const bytes = readFileSync(path), document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (document?.schemaVersion !== 1 || !Array.isArray(document.recipes)) throw Error('Recipe registry needs schemaVersion 1 and a recipes array.');
  const ids = new Set();
  for (const recipe of document.recipes) {
    if (!recipe || !idPattern.test(recipe.id ?? '') || ids.has(recipe.id) || !recipeKinds.includes(recipe.kind) || !text(recipe.description) || !text(recipe.expected) || !text(recipe.effects) || !text(recipe.command) || !Array.isArray(recipe.args) || recipe.args.some(a => typeof a !== 'string') || !Array.isArray(recipe.covers) || !recipe.covers.length || !Array.isArray(recipe.references) || !recipe.references.length || !Array.isArray(recipe.prerequisites) || recipe.prerequisites.some(p => !text(p))) throw Error('Each recipe needs a unique id, kind, description, covers, command/args, expected result, effects, prerequisites, and existing references.');
    ids.add(recipe.id);
    if (recipe.command.includes('\0') || recipe.args.some(arg => arg.includes('\0'))) throw Error('Recipe command/args cannot contain null bytes.');
    recipe.covers.forEach(p => canonical(p, true));
    for (const name of recipe.references) if (!lstatSync(local(root, name)).isFile()) throw Error(`Recipe reference is not a regular file: ${name}`);
    if (recipe.timeoutMs !== undefined && (!Number.isSafeInteger(recipe.timeoutMs) || recipe.timeoutMs <= 0 || recipe.timeoutMs > 2147483647)) throw Error('Recipe timeoutMs must be between 1 and 2147483647.');
  }
  return { present: true, recipes: document.recipes, hash: hash(bytes) };
}

function receiptStatus(root, recipe, loaded, environment) {
  const folder = local(root, `.cyc/runtime/recipes/${recipe.id}`);
  if (!existsSync(folder)) return { status: 'unverified' };
  const names = readdirSync(folder).filter(p => /^\d+-[a-f0-9-]+\.json$/.test(p)).sort();
  if (!names.length) return { status: 'unverified' };
  const receiptPath = `.cyc/runtime/recipes/${recipe.id}/${names.at(-1)}`;
  try {
    const receipt = JSON.parse(readFileSync(local(root, receiptPath), 'utf8'));
    const result = receipt.results?.[0];
    const current = environment();
    if (receipt.schemaVersion !== 1 || receipt.recipeHash !== hash(JSON.stringify(recipe)) || receipt.registryHash !== loaded.hash || receipt.sourceHash !== current.sourceHash || receipt.configHash !== current.configHash) return { status: 'stale', receiptPath };
    const passed = receipt.passed === true && receipt.sourceStable === true && receipt.definitionStable === true && receipt.configStable === true && receipt.results.length === 1 && result.id === recipe.id && result.command === recipe.command && JSON.stringify(result.args) === JSON.stringify(recipe.args) && result.passed === true && result.exitCode === 0 && !result.error;
    return { status: passed ? 'passed' : 'failed', receiptPath, checkedAt: receipt.checkedAt };
  } catch { return { status: 'invalid', receiptPath }; }
}

function configHash(root) {
  const path = local(root, '.cyc/config.json');
  return existsSync(path) ? hash(readFileSync(path)) : null;
}

function recipesFor(root, options, selected, kind) {
  const loaded = registry(root);
  const state = options.run ? readRun(root, options.run) : null;
  const required = state ? (state.requiresChecks ? state.commands : []) : configuration(root).commands;
  let current;
  const environment = () => current ??= { sourceHash: sourceSnapshot(root).hash, configHash: configHash(root) };
  return { ok: true, registry: registryName, available: loaded.present, paths: selected.paths,
    recipes: loaded.recipes.filter(r => (kind === undefined || r.kind === kind) && (options.all || selected.relevant(r.covers, `${r.id} ${r.description}`))).map(recipe => ({ ...recipe, configuredCommandIds: required.filter(c => c.command === recipe.command && JSON.stringify(c.args) === JSON.stringify(recipe.args)).map(c => c.id), receipt: receiptStatus(root, recipe, loaded, environment) })),
    note: 'Discovery executes no project commands. Receipts are local diagnostic history, not task completion or current external-service proof.' };
}

function validateRecipeKind(kind) {
  if (kind !== undefined && !recipeKinds.includes(kind)) throw Error('Recipe kind must be investigation or verification.');
}

export function listRecipes(target, options = {}) {
  validateRecipeKind(options.kind);
  const root = realpathSync(target);
  return recipesFor(root, options, selection(root, options), options.kind);
}

// Discovery and context measurement must interpret the same local document links.
export function contextLinks(cell) {
  return [...cell.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(match => {
    const link = match[1].split('#')[0];
    return !link || /^[a-z]+:/i.test(link) ? null : decodeURIComponent(link);
  }).filter(Boolean);
}

export function investigateProject(target, options = {}) {
  validateRecipeKind(options.kind);
  const root = realpathSync(target), selected = selection(root, options), limit = options.limit ?? 8;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw Error('Limit must be between 1 and 50.');
  if (!selected.paths.length && !text(selected.goal)) throw Error('Provide affected --path values, a --goal, or a --run.');
  const index = local(root, indexName), warnings = [], found = [];
  const links = cell => contextLinks(cell).map(link => {
    const name = relative(root, resolve(dirname(index), link)).replaceAll('\\', '/');
    return { path: name, exists: existsSync(local(root, name)) };
  });
  if (existsSync(index)) {
    let header;
    for (const line of readFileSync(index, 'utf8').split(/\r?\n/)) {
      if (!/^\s*\|/.test(line)) { header = undefined; continue; }
      const cells = line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replaceAll('\\|', '|'));
      if (cells.some(c => c.toLowerCase() === 'covers')) { header = cells.map(c => c.toLowerCase()); continue; }
      if (!header || cells.every(c => /^:?-+:?$/.test(c))) continue;
      if (cells.length !== header.length) { warnings.push('Skipped a malformed index row.'); continue; }
      const covers = cells[header.indexOf('covers')].replaceAll('`', '').split(',').map(p => p.trim());
      try {
        covers.forEach(p => canonical(p === 'all' ? '**' : p, true));
        if (!selected.relevant(covers.map(p => p === 'all' ? '**' : p), cells.join(' '))) continue;
        found.push({ area: cells[0], covers, records: links(cells[header.indexOf('record') >= 0 ? header.indexOf('record') : header.indexOf('doc')]), evidence: header.includes('evidence') ? links(cells[header.indexOf('evidence')]) : [] });
      } catch (error) { warnings.push(error.message); }
    }
  }
  const evidenceChecks = new Map();
  const contexts = found.slice(0, limit).map(entry => ({ ...entry, evidence: entry.evidence.map(e => {
    if (!e.exists || !e.path.endsWith('.json')) return e;
    if (!evidenceChecks.has(e.path)) {
      const checked = spawnSync(process.execPath, [helper, 'check', '--project', root, '--manifest', e.path], { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
      try {
        const result = JSON.parse(checked.stdout);
        const drift = result.files?.filter(file => file.status !== 'unchanged');
        evidenceChecks.set(e.path, drift ? { ...result, checkedFiles: result.files.length, files: drift.slice(0, limit), driftCount: drift.length, truncated: drift.length > limit } : result);
      } catch { evidenceChecks.set(e.path, { status: 'invalid', error: checked.error?.message ?? 'Evidence helper returned no usable result.' }); }
    }
    return { ...e, check: evidenceChecks.get(e.path) };
  }) }));
  const recipes = recipesFor(root, options, selected, options.kind);
  return { ok: true, projectRoot: root, paths: selected.paths, selection: selected.paths.length ? 'declared path matches' : 'goal words; confirm relevance', index: { path: indexName, exists: existsSync(index) }, contexts, totalContextMatches: found.length, truncated: found.length > limit, recipes: recipes.recipes.slice(0, limit), totalRecipeMatches: recipes.recipes.length, recipesTruncated: recipes.recipes.length > limit, recipeRegistryAvailable: recipes.available, warnings,
    note: 'Paths and records are leads, not an exhaustive dependency map. Read matched records and inspect current consumers. Matching bytes do not establish semantic correctness. Project commands were not executed.' };
}

export function runRecipe(target, id, { run } = {}) {
  const root = realpathSync(target), loaded = registry(root), recipe = loaded.recipes.find(r => r.id === id);
  if (!recipe) throw Error(`Unknown recipe: ${id}`);
  if (run && readRun(root, run).status !== 'running') throw Error('Recipe execution associated with a run needs that run to be running.');
  local(root, `.cyc/runtime/recipes/${id}`); // Validate receipt ancestors before execution.
  const before = sourceSnapshot(root), configBefore = configHash(root);
  if (before.skipped.length) throw Error('Recipe verification cannot cover linked source; inspect the links first.');
  const results = runCommands(root, [recipe]);
  let after, inspectionError, configAfter;
  try { configAfter = configHash(root); after = sourceSnapshot(root); }
  catch (error) { inspectionError = error.message; }
  let definitionStable = false;
  try { definitionStable = registry(root).hash === loaded.hash; } catch { /* preserve a failed receipt */ }
  const configStable = !inspectionError && configAfter === configBefore;
  const sourceStable = !!after && before.hash === after.hash && !after.skipped.length;
  const receipt = { schemaVersion: 1, recipe: id, kind: recipe.kind, runId: run ?? null, checkedAt: new Date().toISOString(), registryHash: loaded.hash, recipeHash: hash(JSON.stringify(recipe)), sourceHash: after?.hash ?? null, configHash: configAfter ?? null, inspectionError, sourceStable, definitionStable, configStable,
    passed: sourceStable && definitionStable && configStable && results.length === 1 && results.every(r => r.passed), results };
  const receiptPath = `.cyc/runtime/recipes/${id}/${Date.now()}-${randomUUID()}.json`;
  atomicJSON(local(root, receiptPath), receipt);
  return { ok: receipt.passed, ...receipt, receiptPath, expected: recipe.expected,
    note: 'Command results and source stability are diagnostic evidence. Interpret the expected behavior; run required controller verification and test proof separately.' };
}
