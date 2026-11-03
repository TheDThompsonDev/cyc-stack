import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, unlinkSync, rmdirSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version, files: releaseFiles } = JSON.parse(readFileSync(resolve(sourceRoot, 'package.json'), 'utf8'));
// Share npm's literal release selection; development directories never enter a project copy.
const engineFolders = new Set(['bin', 'scripts', 'skills', 'methods', 'catalog', 'docs', 'rules']);
const engineFiles = releaseFiles.filter(name => engineFolders.has(name.split('/')[0]));
const manifestPath = '.cyc/install-manifest.json';
const hostSpecs = {
  codex: { path: '.codex/hooks.json', events: ['UserPromptSubmit', 'Stop'], skills: '.agents/skills' },
  claude: { path: '.claude/settings.json', events: ['UserPromptSubmit', 'Stop'], skills: '.claude/skills', files: { 'scripts/claude-hooks/cyc.mjs': 'scripts/claude-project-hook.mjs' } },
  // Cursor reads .agents/skills; its hooks need the response event to see the final text.
  cursor: { path: '.cursor/hooks.json', events: ['beforeSubmitPrompt', 'afterAgentResponse', 'stop'], skills: '.agents/skills', files: { '.cursor/rules/cyc-delivery.mdc': 'rules/cyc-delivery.mdc' } }
};
const hostPaths = Object.fromEntries(Object.entries(hostSpecs).map(([host, spec]) => [host, spec.path]));
const digest = value => createHash('sha256').update(value).digest('hex');
// A project's linter can reach CYC's files: ESLint flat config lints dot-folders such as
// .cyc/engine, and the Claude launcher sits in the project's scripts/. CYC's style is not the
// project's, so each installed script turns lint rules off for itself (after any shebang).
// An installed engine can install CYC elsewhere; its files already carry the header.
const lintExempt = (name, bytes) => {
  if (!/\.(?:mjs|cjs|js)$/.test(name)) return bytes;
  const source = bytes.toString('utf8');
  const shebang = source.startsWith('#!') ? source.slice(0, source.indexOf('\n') + 1) : '';
  const body = source.slice(shebang.length);
  return body.startsWith('/* eslint-disable */\n') ? bytes : Buffer.from(`${shebang}/* eslint-disable */\n${body}`);
};
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const defaults = { schemaVersion: 1, verification: { commands: [] }, limits: { maxAttempts: 3, maxNoProgress: 2 } };
const noChecksWarning = 'No verification commands are configured. Code playbooks (feature, bug-fix, refactor, performance, verify, experience) refuse to start until .cyc/config.json lists the project\'s real checks; /cyc runs Setup to add them before the first run.';

function project(target) {
  const path = resolve(target);
  if (!existsSync(path) || !lstatSync(path).isDirectory()) throw new Error('Target must be an existing project directory.');
  return realpathSync(path);
}

// Never follow a destination symlink/junction or a path outside the requested project.
function safePath(root, name) {
  if (typeof name !== 'string' || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`Unsafe managed path: ${name}`);
  const path = resolve(root, name);
  const rel = relative(root, path);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || resolve(name) === name) throw new Error(`Path escapes project: ${name}`);
  let current = root;
  for (const part of rel.split(sep)) {
    current = join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`Refusing symlink/junction: ${name}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return path;
}

function read(root, name) {
  const path = safePath(root, name);
  if (!existsSync(path)) return null;
  if (!lstatSync(path).isFile()) throw new Error(`Expected a file: ${name}`);
  return readFileSync(path);
}

function parse(buffer, name) {
  try { const value = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); if (!object(value)) throw new Error(); return value; }
  catch { throw new Error(`Invalid JSON object: ${name}`); }
}

function validConfig(value) {
  if (value.schemaVersion !== 1 || !object(value.verification) || !Array.isArray(value.verification.commands) || !object(value.limits)) return false;
  return ['maxAttempts', 'maxNoProgress'].every(k => Number.isSafeInteger(value.limits[k]) && value.limits[k] > 0)
    && (value.limits.maxDurationMs === undefined || value.limits.maxDurationMs === null || (Number.isSafeInteger(value.limits.maxDurationMs) && value.limits.maxDurationMs > 0));
}

function manifest(root) {
  const bytes = read(root, manifestPath);
  if (!bytes) return null;
  const value = parse(bytes, manifestPath);
  if (value.schemaVersion !== 1 || value.owner !== 'cycstack' || !object(value.files) || !object(value.hooks)) throw new Error('Invalid CYC installation manifest.');
  for (const [name, hash] of Object.entries(value.files)) {
    if (!(name.startsWith('.cyc/engine/') || /^\.(?:agents|claude)\/skills\/cyc(?:-[a-z0-9-]+)?\//.test(name) || ['.cyc/config.json', '.cyc/.gitignore', '.cursor/rules/cyc-delivery.mdc', 'scripts/claude-hooks/cyc.mjs'].includes(name)) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid managed file in manifest.');
    safePath(root, name);
  }
  for (const [host, info] of Object.entries(value.hooks)) {
    if (!hostPaths[host] || !object(info) || !object(info.entry) || !object(info.original)) throw new Error('Invalid host entry in manifest.');
  }
  return value;
}

function walk(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    if (item.isSymbolicLink()) throw new Error(`Distribution must not contain symlinks: ${item.name}`);
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) return walk(join(directory, item.name), `${name}/`);
    return item.isFile() ? [[name, readFileSync(join(directory, item.name))]] : [];
  });
}


function hookEntry(root, host) {
  // 60 seconds: the Stop path allows up to 17 s of git calls plus hashing, and a hook the host kills
  // never reaches the gate's own fail-closed handler.
  if (host === 'claude') return { hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/scripts/claude-hooks/cyc.mjs"', shell: 'bash', timeout: 60 }] };
  // A fixed bootstrap works in cmd and POSIX shells. Paths come from the host event,
  // never shell interpolation; clones and nested working directories need no reinstall.
  const bootstrap = `const f=require('node:fs'),p=require('node:path');const b=f.readFileSync(0);const i=JSON.parse(b.toString('utf8').replace(/^\\uFEFF/,''));let d=p.resolve(i.cwd||(i.workspace_roots||[])[0]||process.env.CLAUDE_PROJECT_DIR||process.env.CURSOR_PROJECT_DIR||process.cwd());while(!f.existsSync(p.join(d,'.cyc/engine/scripts/response-hook.mjs'))){const n=p.dirname(d);if(n===d)throw Error('CYC engine not found for hook project');d=n;}const r=require('node:child_process').spawnSync(process.execPath,[p.join(d,'.cyc/engine/scripts/response-hook.mjs'),'${host}','--project',d],{input:b,stdio:['pipe','inherit','inherit'],windowsHide:true});process.exit(r.status===null?1:r.status);`;
  const command = `node -e "${bootstrap}"`;
  // Cursor entries are flat; loop_limit allows three corrections plus the NOT READY notice.
  if (host === 'cursor') return { command, timeout: 60, loop_limit: 4 };
  return { hooks: [{ type: 'command', command, timeout: 60 }] };
}

function validateHooks(value, path, events = ['UserPromptSubmit', 'Stop']) {
  if (value.hooks !== undefined && !object(value.hooks)) throw new Error(`Invalid hooks object: ${path}`);
  for (const event of events) if (value.hooks?.[event] !== undefined && !Array.isArray(value.hooks[event])) throw new Error(`Invalid ${event} hook list: ${path}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function removeOwnedEntry(entries, entry) {
  const index = entries.findLastIndex(value => same(value, entry));
  return index < 0 ? entries : entries.filter((_, position) => position !== index);
}

function referencesEngine(value) {
  if (Array.isArray(value)) return value.some(referencesEngine);
  if (!object(value)) return false;
  if (typeof value.command === 'string' && /scripts[\\/]claude-hooks[\\/]cyc\.mjs\b/i.test(value.command)) return true;
  if (typeof value.command === 'string' && /(?:^|[\\/])\.cyc[\\/]engine(?:[\\/]|\b)/i.test(value.command)) return true;
  // Relative commands may begin after a quote or executable, rather than a slash.
  if (typeof value.command === 'string' && /(?:^|[\s"'])\.cyc[\\/]engine(?:[\\/]|\b)/i.test(value.command)) return true;
  return Object.values(value).some(referencesEngine);
}

function commit(root, operations) {
  const originals = new Map();
  const createdDirectories = [];
  const applied = [];
  try {
    for (const op of operations) {
      const path = safePath(root, op.path);
      originals.set(op.path, read(root, op.path));
      let parent = dirname(path);
      const missing = [];
      while (parent !== root && !existsSync(parent)) { missing.push(parent); parent = dirname(parent); }
      for (const dir of missing.reverse()) { mkdirSync(dir); createdDirectories.push(dir); }
      if (op.content === null) unlinkSync(path);
      else {
        const temporary = `${path}.${randomUUID()}.tmp`;
        try { writeFileSync(temporary, op.content); renameSync(temporary, path); }
        finally { if (existsSync(temporary)) unlinkSync(temporary); }
      }
      applied.push(op.path);
    }
  } catch (error) {
    const failures = [];
    for (const name of applied.reverse()) {
      try { const bytes = originals.get(name); const path = safePath(root, name); if (bytes === null) unlinkSync(path); else writeFileSync(path, bytes); }
      catch (failure) { failures.push(`${name}: ${failure.message}`); }
    }
    for (const dir of createdDirectories.reverse()) { try { rmdirSync(dir); } catch { /* nonempty or already removed */ } }
    throw new Error(`${error.message}${failures.length ? `; rollback incomplete: ${failures.join('; ')}` : '; changes rolled back'}`);
  }
}

const legacyDurationMs = 900000;
function activeRuns(root) {
  const directory = join(root, '.cyc', 'runs');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).filter(entry => {
    try { return JSON.parse(readFileSync(join(directory, entry.name, 'state.json'), 'utf8')).status === 'running'; } catch { return false; }
  }).map(entry => entry.name);
}

function result(action, root) { return { ok: true, action, projectRoot: root, hosts: [], changes: [], warnings: [], conflicts: [] }; }

export function installProject(target, { hosts = ['codex', 'claude'], dryRun = false } = {}) {
  let root = resolve(target);
  const out = result('install', root);
  try {
    root = project(target); out.projectRoot = root;
    if (!Array.isArray(hosts) || !hosts.length || hosts.some(h => !hostPaths[h])) throw new Error('hosts must contain codex, claude, and/or cursor.');
    const old = manifest(root);
    const selected = [...new Set([...Object.keys(old?.hooks ?? {}), ...hosts])]; out.hosts = selected;
    const desired = new Map();
    for (const name of engineFiles) {
      const source = resolve(sourceRoot, name);
      const info = lstatSync(source);
      if (info.isSymbolicLink()) throw new Error(`Distribution must not contain symlinks: ${name}`);
      const entries = info.isDirectory() ? walk(source).map(([entry, bytes]) => [`${name}/${entry}`, bytes]) : [[name, readFileSync(source)]];
      for (const [entry, bytes] of entries) desired.set(`.cyc/engine/${entry}`, lintExempt(entry, bytes));
    }
    desired.set('.cyc/engine/README.md', readFileSync(resolve(sourceRoot, 'README.md')));
    // The engine copy is a distributed copy of the code, so it carries the license its README links to.
    // A source without one (an older copy) still installs; the install test asserts this source ships it.
    if (existsSync(resolve(sourceRoot, 'LICENSE'))) desired.set('.cyc/engine/LICENSE', readFileSync(resolve(sourceRoot, 'LICENSE')));
    desired.set('.cyc/engine/package.json', json({ name: 'cyc-local-engine', version, private: true, type: 'module', files: engineFiles }));
    // ESLint 10 reads the config nearest each file, so this keeps a project's lint off the whole
    // engine without the unused-directive warnings the per-file headers can raise.
    desired.set('.cyc/engine/eslint.config.mjs', lintExempt('eslint.config.mjs', Buffer.from("// CYC's engine is not this project's source; the project's lint rules do not apply here.\nexport default [{ ignores: ['**/*'] }];\n")));
    const skills = walk(resolve(sourceRoot, 'skills'));
    if (!skills.some(([name]) => name.endsWith('/SKILL.md'))) throw new Error('Distribution has no skills.');
    for (const host of selected) for (const [name, bytes] of skills) {
      if (!/^cyc(?:-[a-z0-9-]+)?\//.test(name)) throw new Error(`Skill must use the CYC namespace: ${name}`);
      const adjusted = name.endsWith('.md') ? Buffer.from(bytes.toString('utf8').replace(/\.\.\/\.\.\/(docs|catalog|scripts|bin|methods|evals)\//g, '../../../.cyc/engine/$1/')) : bytes;
      desired.set(`${hostSpecs[host].skills}/${name}`, adjusted);
    }
    for (const host of selected) for (const [target, source] of Object.entries(hostSpecs[host].files ?? {})) desired.set(target, lintExempt(target, readFileSync(resolve(sourceRoot, source))));
    const config = read(root, '.cyc/config.json');
    if (config && !validConfig(parse(config, '.cyc/config.json'))) throw new Error('Invalid CYC project config schema.');
    if (!config) desired.set('.cyc/config.json', json(defaults));
    else if (!old) throw new Error('Unowned .cyc/config.json already exists; refusing to adopt or overwrite it.');
    desired.set('.cyc/.gitignore', Buffer.from('runtime/\nruns/\n'));
    const next = { schemaVersion: 1, owner: 'cycstack', version, files: {}, hooks: {} };
    const operations = [];
    for (const [name, content] of desired) {
      const current = read(root, name); const ownedHash = old?.files[name];
      if (current && (!ownedHash || digest(current) !== ownedHash)) out.conflicts.push({ path: name, reason: ownedHash ? 'Installed file was modified; preserve it and resolve before updating.' : 'Existing file is not owned by CYC.' });
      else if (!current || !current.equals(content)) operations.push({ path: name, content });
      next.files[name] = digest(content);
    }
    // Config is user-editable and preserved on update. Keep its original ownership hash.
    if (config && old?.files['.cyc/config.json']) next.files['.cyc/config.json'] = old.files['.cyc/config.json'];
    // Early installers wrote a 15-minute run limit into every new config. CYC no longer uses a
    // clock, so remove that exact legacy value on update. Never rewrite config under an active run:
    // the controller protects it, and changing it would halt the run.
    const parsedConfig = config ? parse(config, '.cyc/config.json') : null;
    if (old && parsedConfig?.limits?.maxDurationMs === legacyDurationMs) {
      if (activeRuns(root).length) out.warnings.push('Legacy 15-minute run limit (limits.maxDurationMs: 900000) left in place because a CYC run is active. Rerun this update after the run ends to remove it.');
      else {
        delete parsedConfig.limits.maxDurationMs;
        operations.push({ path: '.cyc/config.json', content: json(parsedConfig) });
        out.warnings.push('Removed the legacy 15-minute run limit (limits.maxDurationMs: 900000) from .cyc/config.json. Runs are now bounded by failed attempts, not time. Add limits.maxDurationMs back if you want a deadline.');
      }
    }
    for (const [name, hash] of Object.entries(old?.files ?? {})) if (!desired.has(name) && name !== '.cyc/config.json') {
      const current = read(root, name);
      if (current && digest(current) === hash) operations.push({ path: name, content: null });
      else if (current) {
        next.files[name] = hash;
        if (/^\.(?:agents|claude)\/skills\/cyc-[^/]+\//.test(name)) out.conflicts.push({ path: name, reason: 'Customized legacy supporting skill. Preserve and migrate its changes to the internal methods before updating; no files changed.' });
        else out.warnings.push(`Preserved modified obsolete file: ${name}`);
      }
    }
    for (const host of selected) {
      const name = hostPaths[host]; const bytes = read(root, name); const value = bytes ? parse(bytes, name) : {};
      const events = hostSpecs[host].events; validateHooks(value, name, events);
      const prior = old?.hooks[host]; const entry = hookEntry(root, host);
      if ((value.hooks?.[host === 'cursor' ? 'stop' : 'Stop'] ?? []).some(item => !same(item, prior?.entry))) out.warnings.push(`${host}: existing Stop hooks preserved. If another hook owns reply formatting, set delivery.presentation to "project" in .cyc/config.json; CYC still checks controller completion.`);
      const original = prior?.original ?? { existed: Boolean(bytes), hooksExisted: Object.hasOwn(value, 'hooks'), versionExisted: Object.hasOwn(value, 'version'), events: Object.fromEntries(events.map(e => [e, Object.hasOwn(value.hooks ?? {}, e)])) };
      if (host === 'cursor') value.version ??= 1;
      value.hooks ??= {};
      for (const event of events) {
        const entries = value.hooks[event] ?? [];
        if (prior && !entries.some(e => same(e, prior.entry))) out.conflicts.push({ path: name, reason: `${event}: owned hook was removed or modified.` });
        value.hooks[event] = [...(prior ? removeOwnedEntry(entries, prior.entry) : entries), entry];
      }
      const content = json(value); if (!bytes || !bytes.equals(content)) operations.push({ path: name, content });
      next.hooks[host] = { entry, original };
    }
    next.files = Object.fromEntries(Object.entries(next.files).sort(([a], [b]) => a.localeCompare(b)));
    const oldBytes = read(root, manifestPath); const newBytes = json(next);
    if (!oldBytes || !oldBytes.equals(newBytes)) operations.push({ path: manifestPath, content: newBytes });
    out.changes = operations.map(op => ({ path: op.path, action: op.content === null ? 'remove' : read(root, op.path) ? 'update' : 'create' }));
    out.ok = !out.conflicts.length; out.dryRun = dryRun;
    if (!(config ? parse(config, '.cyc/config.json') : defaults).verification.commands.length) out.warnings.push(noChecksWarning);
    out.warnings.push('Host hook trust and session reload are not verified. Restart/reload the host and check a real session.');
    if (out.ok && !dryRun) commit(root, operations);
  } catch (error) { out.ok = false; out.error = error.message; }
  return out;
}

export function uninstallProject(target, { dryRun = false } = {}) {
  let root = resolve(target); const out = result('uninstall', root);
  try {
    root = project(target); out.projectRoot = root; const old = manifest(root);
    if (!old) { out.warnings.push('No CYC installation manifest found; nothing removed.'); return out; }
    const operations = []; out.hosts = Object.keys(old.hooks);
    for (const [host, info] of Object.entries(old.hooks)) {
      const name = hostPaths[host]; const bytes = read(root, name); if (!bytes) continue;
      const value = parse(bytes, name); const events = hostSpecs[host].events; validateHooks(value, name, events);
      for (const event of events) if (Array.isArray(value.hooks?.[event])) {
        const before = value.hooks[event]; value.hooks[event] = removeOwnedEntry(before, info.entry);
        if (before.length === value.hooks[event].length) out.warnings.push(`Preserved missing or modified ${host} ${event} hook.`);
        if (!value.hooks[event].length && !info.original.events[event]) delete value.hooks[event];
      }
      if (value.hooks && !Object.keys(value.hooks).length && !info.original.hooksExisted) delete value.hooks;
      if (host === 'cursor' && !value.hooks && !info.original.versionExisted) delete value.version;
      if (referencesEngine(value.hooks)) out.conflicts.push({ path: name, reason: 'A preserved hook still references the CYC engine or launcher. Remove or adapt that hook before uninstalling; no files were changed.' });
      const content = !Object.keys(value).length && !info.original.existed ? null : json(value);
      if (content === null || !content.equals(bytes)) operations.push({ path: name, content });
    }
    // A user may have copied an engine command into a host CYC did not install.
    for (const [host, name] of Object.entries(hostPaths)) if (!old.hooks[host]) {
      const bytes = read(root, name); if (!bytes) continue;
      const value = parse(bytes, name); validateHooks(value, name, hostSpecs[host].events);
      if (referencesEngine(value.hooks)) out.conflicts.push({ path: name, reason: 'An unmanaged host hook references the CYC engine or launcher. Remove or adapt that hook before uninstalling; no files were changed.' });
    }
    if (out.conflicts.length) {
      out.ok = false; out.dryRun = dryRun;
      return out;
    }
    const retainedRecords = ['.cyc/runtime', '.cyc/runs'].some(name => existsSync(safePath(root, name)));
    for (const [name, hash] of Object.entries(old.files)) {
      const bytes = read(root, name); if (!bytes) continue;
      if (name === '.cyc/.gitignore' && retainedRecords && digest(bytes) === hash) {
        out.warnings.push('Preserved .cyc/.gitignore alongside retained runtime/run records; its existing ignore rules remain in effect.');
        continue;
      }
      if (digest(bytes) === hash) operations.push({ path: name, content: null });
      else out.warnings.push(`Preserved modified file: ${name}`);
    }
    operations.push({ path: manifestPath, content: null });
    out.changes = operations.map(op => ({ path: op.path, action: op.content === null ? 'remove' : 'update' })); out.dryRun = dryRun;
    if (!dryRun) commit(root, operations);
    out.warnings.push('Runtime records and user-modified files are retained. Reload the AI host to stop previously loaded hooks.');
  } catch (error) { out.ok = false; out.error = error.message; }
  return out;
}

export function doctorProject(target) {
  let root = resolve(target);
  const out = { ok: true, projectRoot: root, checks: [], activation: { codex: 'unverified', claude: 'unverified', cursor: 'unverified' } };
  const check = (name, ok, detail) => { out.checks.push({ name, ok, detail }); if (!ok) out.ok = false; };
  try {
    root = project(target); out.projectRoot = root;
    check('node', Number(process.versions.node.split('.')[0]) >= 20, process.versions.node);
    safePath(root, '.cyc/runtime/probe');
    check('runtime location', true, 'Project-local runtime path contains no symlink or junction.');
    const config = read(root, '.cyc/config.json'); check('config', Boolean(config && validConfig(parse(config, '.cyc/config.json'))), '.cyc/config.json');
    const duration = config ? parse(config, '.cyc/config.json').limits?.maxDurationMs : undefined;
    if (duration) out.checks.push({ name: 'run time limit', ok: true, detail: `Runs stop after ${Math.round(duration / 60000)} minutes (limits.maxDurationMs). ${duration === legacyDurationMs ? 'This is the legacy default from an early install; rerun init after active runs finish to remove it.' : 'Remove it for no clock.'}` });
    const installed = manifest(root); check('manifest', Boolean(installed), manifestPath);
    if (installed) {
      out.version = installed.version ?? 'unknown (legacy manifest)';
      for (const [host, info] of Object.entries(installed.hooks)) {
        const bytes = read(root, hostPaths[host]); const value = bytes ? parse(bytes, hostPaths[host]) : {}; validateHooks(value, hostPaths[host], hostSpecs[host].events);
        // Three different repairs, so name which one: an entry absent from an event (reinstall), an
        // entry edited by hand (reinstall or keep the edit), or an installed entry the engine has since
        // changed (rerun init). Each is checked against the manifest's record of what was installed.
        const missing = hostSpecs[host].events.filter(event => !value.hooks?.[event]?.some(e => same(e, info.entry)));
        const edited = missing.filter(event => value.hooks?.[event]?.some(referencesEngine));
        const stale = !same(info.entry, hookEntry(root, host));
        const detail = !missing.length && !stale ? 'Configuration only; host trust and real-session activation are unverified.'
          : [
            ...(edited.length ? [`modified by hand in ${hostPaths[host]} (${edited.join(', ')}): rerun init to restore it, or keep your edit and expect this notice`] : []),
            ...(missing.filter(event => !edited.includes(event)).length ? [`missing from ${hostPaths[host]} (${missing.filter(event => !edited.includes(event)).join(', ')}): rerun init`] : []),
            ...(stale ? ['out of date: the engine\'s hook entry changed since this install; rerun init'] : [])
          ].join('; ');
        check(`${host} hooks`, !missing.length && !stale, detail);
      }
      const changed = Object.entries(installed.files).filter(([name, hash]) => { const bytes = read(root, name); return !bytes || (name !== '.cyc/config.json' && digest(bytes) !== hash); }).map(([name]) => name);
      check('installed files', !changed.length, changed.length ? changed.join(', ') : 'Owned distribution files match their recorded hashes.');
    }
  } catch (error) { check('inspection', false, error.message); }
  return out;
}

// Plugin route: the plugin supplies skills, hooks, and engine; a project only opts in.
export function activateProject(target, { dryRun = false } = {}) {
  const out = result('activate', null);
  try {
    const root = project(target); out.projectRoot = root;
    const operations = [];
    const config = read(root, '.cyc/config.json');
    if (config && !validConfig(parse(config, '.cyc/config.json'))) throw new Error('Invalid CYC project config schema.');
    if (!config) operations.push({ path: '.cyc/config.json', content: json(defaults) });
    if (!read(root, '.cyc/.gitignore')) operations.push({ path: '.cyc/.gitignore', content: Buffer.from('runtime/\nruns/\n') });
    out.changes = operations.map(op => ({ path: op.path, action: 'create' }));
    if (!dryRun) for (const op of operations) { const path = safePath(root, op.path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, op.content); }
    out.dryRun = dryRun;
    out.warnings.push('Activated for plugin hooks.');
    if (!(config ? parse(config, '.cyc/config.json') : defaults).verification.commands.length) out.warnings.push(noChecksWarning);
  } catch (error) { out.ok = false; out.error = error.message; }
  return out;
}

// Pick hosts from what the project already uses; fall back to all three.
export function detectHosts(target) {
  const root = project(target);
  const has = name => existsSync(join(root, name));
  const hosts = [];
  if (has('.claude') || has('CLAUDE.md')) hosts.push('claude');
  if (has('.codex') || has('.agents') || has('AGENTS.md')) hosts.push('codex');
  if (has('.cursor') || has('.cursorrules')) hosts.push('cursor');
  return hosts.length ? hosts : Object.keys(hostSpecs);
}
