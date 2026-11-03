import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, lstatSync, symlinkSync, rmSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { Script } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { installProject, uninstallProject, doctorProject, activateProject, detectHosts } from '../scripts/install.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc install with spaces '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function put(root, path, value) { const absolute = join(root, path); mkdirSync(resolve(absolute, '..'), { recursive: true }); writeFileSync(absolute, typeof value === 'string' ? value : JSON.stringify(value)); }
function get(root, path) { return JSON.parse(readFileSync(join(root, path), 'utf8')); }
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
function runHook(command, host, root, options) {
  const settings = { ...options, env: { ...process.env, ...options.env, CLAUDE_PROJECT_DIR: root } };
  return host === 'claude'
    ? spawnSync(bash, ['-c', command], settings)
    : spawnSync(command, { ...settings, shell: true });
}

test('Claude launcher satisfies the audited script contract and still rejects an unreviewed Stop', t => {
  const root = fixture(t); assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  const settings = get(root, '.claude/settings.json');
  for (const groups of Object.values(settings.hooks)) for (const group of groups) for (const hook of group.hooks) {
    assert.equal(hook.type, 'command');
    const match = hook.command.match(/scripts\/claude-hooks\/([a-z-]+\.mjs)/);
    assert.ok(match); assert.ok(existsSync(join(root, 'scripts/claude-hooks', match[1])));
    assert.ok(hook.command.includes('$CLAUDE_PROJECT_DIR'));
    // The Stop path allows up to 17 s of git calls plus hashing; a host-killed hook skips the gate.
    assert.ok(hook.timeout >= 60 && hook.timeout <= 300, `timeout ${hook.timeout}`);
  }
  const command = settings.hooks.Stop[0].hooks[0].command;
  const event = { hook_event_name: 'UserPromptSubmit', session_id: 'contract', prompt: 'build it', cwd: root };
  const invoke = value => runHook(command, 'claude', root, { cwd: root, input: JSON.stringify(value), encoding: 'utf8' });
  assert.equal(invoke(event).status, 0);
  const stop = invoke({ ...event, hook_event_name: 'Stop', last_assistant_message: 'Done.' });
  assert.equal(JSON.parse(stop.stdout).decision, 'block', stop.stdout);
  rmSync(join(root, '.cyc/engine/scripts/response-hook.mjs'));
  assert.notEqual(invoke(event).status, 0, 'missing engine must fail closed');
});

test('installed scripts stay out of the project lint: launcher parses as a script, engine opts out', async t => {
  const root = fixture(t); assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  // A linter configured for classic scripts must be able to parse the launcher in the project's scripts/.
  const launcher = readFileSync(join(root, 'scripts/claude-hooks/cyc.mjs'), 'utf8');
  assert.doesNotThrow(() => new Script(launcher), 'launcher must parse as a classic script');
  assert.match(launcher, /^\/\* eslint-disable \*\/\n/);
  const scripts = Object.keys(get(root, '.cyc/install-manifest.json').files).filter(name => name.startsWith('.cyc/engine/') && /\.(?:mjs|cjs|js)$/.test(name));
  assert.ok(scripts.length > 10);
  for (const name of scripts) assert.match(readFileSync(join(root, name), 'utf8'), /^(?:#![^\n]*\n)?\/\* eslint-disable \*\/\n/, name);
  assert.match(readFileSync(join(root, '.cyc/engine/bin/cyc.mjs'), 'utf8'), /^#!\/usr\/bin\/env node\n\/\* eslint-disable \*\/\n/, 'a shebang stays first');
  for (const name of ['.cyc/engine/README.md', '.cyc/engine/package.json', '.claude/skills/cyc/SKILL.md']) assert.doesNotMatch(readFileSync(join(root, name), 'utf8'), /eslint-disable/, name);
  const { default: config } = await import(pathToFileURL(join(root, '.cyc/engine/eslint.config.mjs')).href);
  assert.deepEqual(config, [{ ignores: ['**/*'] }]);
  assert.equal(doctorProject(root).ok, true);
  // An installed engine installs elsewhere without stacking a second header.
  const other = fixture(t);
  const installed = spawnSync(process.execPath, [join(root, '.cyc/engine/bin/cyc.mjs'), 'init', '--project', other, '--hosts', 'claude'], { encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  for (const name of ['.cyc/engine/scripts/runtime.mjs', '.cyc/engine/bin/cyc.mjs', 'scripts/claude-hooks/cyc.mjs']) {
    assert.equal(readFileSync(join(other, name), 'utf8').split('/* eslint-disable */').length - 1, 1, name);
    assert.equal(readFileSync(join(other, name), 'utf8'), readFileSync(join(root, name), 'utf8'), name);
  }
});

test('Claude launcher collisions and modified launchers block updates atomically', t => {
  const root = fixture(t); put(root, 'scripts/claude-hooks/cyc.mjs', '// user file');
  const before = snapshot(root); assert.equal(installProject(root).ok, false); assert.deepEqual(snapshot(root), before);
  rmSync(join(root, 'scripts/claude-hooks/cyc.mjs'));
  assert.equal(installProject(root).ok, true);
  put(root, 'scripts/claude-hooks/cyc.mjs', '// customized');
  const customized = snapshot(root); assert.equal(installProject(root).ok, false); assert.deepEqual(snapshot(root), customized);
});

test('upgrade replaces an owned inline Claude command without duplicate hooks', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const record = get(root, '.cyc/install-manifest.json');
  const settings = get(root, '.claude/settings.json');
  const legacy = { hooks: [{ type: 'command', command: 'node -e "/* legacy .cyc/engine bootstrap */"', timeout: 10 }] };
  for (const event of ['Stop', 'UserPromptSubmit']) settings.hooks[event] = [legacy];
  record.hooks.claude.entry = legacy;
  delete record.files['scripts/claude-hooks/cyc.mjs']; rmSync(join(root, 'scripts/claude-hooks/cyc.mjs'));
  put(root, '.claude/settings.json', settings); put(root, '.cyc/install-manifest.json', record);
  assert.equal(installProject(root).ok, true);
  for (const event of ['Stop', 'UserPromptSubmit']) {
    const entries = get(root, '.claude/settings.json').hooks[event]; assert.equal(entries.length, 1);
    assert.match(entries[0].hooks[0].command, /scripts\/claude-hooks\/cyc\.mjs/);
  }
  assert.equal(doctorProject(root).ok, true);
});
function snapshot(root, prefix = '') {
  return Object.fromEntries(readdirSync(join(root, prefix)).sort().flatMap(name => {
    const path = `${prefix}${name}`;
    return lstatSync(join(root, path)).isDirectory() ? Object.entries(snapshot(root, `${path}/`)) : [[path, readFileSync(join(root, path), 'utf8')]];
  }));
}

test('install merges both hosts, preserves user files, updates idempotently, and uninstalls only owned entries', t => {
  const root = fixture(t);
  const existing = { hooks: { Stop: [{ matcher: 'user', hooks: [{ type: 'command', command: 'echo user-hook' }] }], SessionStart: [] }, userPreference: true };
  put(root, '.claude/settings.json', existing);
  put(root, '.codex/hooks.json', { hooks: { Stop: [] }, custom: 7 });
  put(root, 'AGENTS.md', 'User instructions'); put(root, 'CLAUDE.md', 'Other instructions'); put(root, 'package.json', '{"name":"student-app"}');
  const installed = installProject(root);
  assert.equal(installed.ok, true, installed.error ?? JSON.stringify(installed.conflicts));
  assert.equal(get(root, '.claude/settings.json').hooks.Stop.length, 2);
  assert.deepEqual(get(root, '.claude/settings.json').hooks.Stop[0], existing.hooks.Stop[0]);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), 'User instructions');
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), '{"name":"student-app"}');
  const repeated = installProject(root);
  assert.equal(repeated.ok, true); assert.deepEqual(repeated.changes, []);
  assert.equal(doctorProject(root).ok, true);
  assert.equal(doctorProject(root).activation.codex, 'unverified');
  assert.ok(existsSync(join(root, '.cyc/engine/bin/cyc.mjs')));
  assert.ok(existsSync(join(root, '.agents/skills/cyc/SKILL.md')));
  assert.ok(existsSync(join(root, '.claude/skills/cyc/SKILL.md')));
  assert.equal(existsSync(join(root, '.cyc/engine/test')), false);
  assert.equal(readFileSync(join(root, '.cyc/.gitignore'), 'utf8'), 'runtime/\nruns/\n');
  const removed = uninstallProject(root); assert.equal(removed.ok, true, removed.error);
  assert.deepEqual(get(root, '.claude/settings.json'), existing);
  assert.deepEqual(get(root, '.codex/hooks.json'), { hooks: { Stop: [] }, custom: 7 });
  assert.equal(existsSync(join(root, '.cyc/engine/scripts/response-hook.mjs')), false);
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), 'Other instructions');
});

test('dry run makes no writes and reports the exact intended operations', t => {
  const root = fixture(t); put(root, 'README.md', 'my project');
  const before = snapshot(root); const planned = installProject(root, { dryRun: true });
  assert.equal(planned.ok, true, planned.error); assert.ok(planned.changes.length); assert.deepEqual(snapshot(root), before);
  const actual = installProject(root); assert.deepEqual(actual.changes, planned.changes);
  const installed = snapshot(root); assert.equal(uninstallProject(root, { dryRun: true }).ok, true); assert.deepEqual(snapshot(root), installed);
});

test('standard install excludes development payload and engine documentation links stay usable', t => {
  const root = fixture(t);
  const installed = installProject(root);
  assert.equal(installed.ok, true, installed.error);
  const engine = join(root, '.cyc/engine');
  for (const name of ['evals', 'test', 'scripts/bump-version.mjs', 'docs/assets/build-workflow-diagram.mjs', 'docs/assets/cyc-workflow.png', 'docs/assets/cyc-workflow-v2.png', 'docs/assets/cyc-workflow-diagram.png', 'docs/assets/cyc-method-library.png', 'docs/assets/cyc-workflow.html', 'docs/context', 'docs/quality-guidance-2026-10-21.md']) {
    assert.equal(existsSync(join(engine, name)), false, `development-only payload shipped: ${name}`);
  }
  for (const name of ['LICENSE', 'bin/cyc.mjs', 'scripts/runtime.mjs', 'scripts/baseline-worker.mjs', 'scripts/response-hook.mjs', 'scripts/recovery.mjs', 'scripts/source-snapshot.mjs', 'scripts/source-hash-worker.mjs', 'methods/cyc-context/scripts/evidence.mjs', 'docs/engineering/domain-design.md', 'docs/engineering/failure-handling.md']) assert.ok(existsSync(join(engine, name)), `missing operational file: ${name}`);
  const bytes = directory => readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    const location = join(directory, entry.name);
    return sum + (entry.isDirectory() ? bytes(location) : lstatSync(location).size);
  }, 0);
  assert.ok(bytes(engine) < 1024 * 1024, 'standard engine must stay below the 1-MiB release budget');
  assert.equal(doctorProject(root).ok, true);

  function markdownFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const location = join(directory, entry.name);
      return entry.isDirectory() ? markdownFiles(location) : entry.name.endsWith('.md') ? [location] : [];
    });
  }
  const documents = [join(engine, 'README.md'), ...markdownFiles(join(engine, 'docs'))];
  for (const document of documents) {
    for (const [, target] of readFileSync(document, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      assert.ok(existsSync(resolve(dirname(document), target.split('#')[0])), `${document}: broken installed reference ${target}`);
    }
  }
});

test('lean update removes only unchanged obsolete payload and preserves custom files and records', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const manifest = get(root, '.cyc/install-manifest.json');
  const obsolete = '.cyc/engine/docs/assets/cyc-workflow.png';
  const customized = '.cyc/engine/evals/results/comparison-2026-10-20.json';
  put(root, obsolete, 'old owned bitmap');
  manifest.files[obsolete] = createHash('sha256').update('old owned bitmap').digest('hex');
  put(root, customized, 'user customization');
  manifest.files[customized] = createHash('sha256').update('old owned result').digest('hex');
  put(root, '.cyc/install-manifest.json', manifest);
  put(root, '.cyc/runtime/user.json', { retained: true });
  put(root, '.cyc/runs/history/state.json', { status: 'complete' });
  const config = get(root, '.cyc/config.json'); config.limits.maxAttempts = 7; put(root, '.cyc/config.json', config);
  const before = snapshot(root), preview = installProject(root, { dryRun: true });
  assert.equal(preview.ok, true, preview.error ?? JSON.stringify(preview.conflicts));
  assert.deepEqual(snapshot(root), before);
  assert.ok(preview.changes.some(c => c.path === obsolete && c.action === 'remove'));
  assert.ok(preview.warnings.some(w => w.includes(customized)));
  const actual = installProject(root); assert.equal(actual.ok, true);
  assert.equal(existsSync(join(root, obsolete)), false);
  assert.equal(readFileSync(join(root, customized), 'utf8'), 'user customization');
  assert.deepEqual(get(root, '.cyc/config.json'), config);
  assert.deepEqual(get(root, '.cyc/runtime/user.json'), { retained: true });
  assert.equal(get(root, '.cyc/runs/history/state.json').status, 'complete');
});

test('installed engine retains its release selection and can install into another project', t => {
  const root = fixture(t), target = fixture(t);
  assert.equal(installProject(root, { hosts: ['codex'] }).ok, true);
  const metadata = get(root, '.cyc/engine/package.json');
  assert.ok(Array.isArray(metadata.files), 'installed distribution must retain its copy selection');
  const result = spawnSync(process.execPath, [join(root, '.cyc/engine/bin/cyc.mjs'), 'init', '--project', target, '--hosts', 'codex'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(doctorProject(target).ok, true);
  assert.equal(existsSync(join(target, '.cyc/engine/evals')), false);
  assert.deepEqual(get(target, '.cyc/engine/package.json').files, metadata.files);
});

test('unowned skill collision causes no partial writes', t => {
  const root = fixture(t); put(root, '.agents/skills/cyc/SKILL.md', 'An existing user skill'); const before = snapshot(root);
  const result = installProject(root);
  assert.equal(result.ok, false); assert.ok(result.conflicts.some(c => c.path === '.agents/skills/cyc/SKILL.md')); assert.deepEqual(snapshot(root), before);
});

test('modified owned skill blocks updates and is preserved during uninstall', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  put(root, '.agents/skills/cyc/SKILL.md', 'My customized CYC skill'); const before = snapshot(root);
  const result = installProject(root); assert.equal(result.ok, false); assert.deepEqual(snapshot(root), before);
  assert.equal(doctorProject(root).ok, false);
  assert.equal(uninstallProject(root).ok, true);
  assert.equal(readFileSync(join(root, '.agents/skills/cyc/SKILL.md'), 'utf8'), 'My customized CYC skill');
});

test('editable config and runtime are preserved across update and uninstall', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const config = get(root, '.cyc/config.json'); config.limits.maxAttempts = 5; put(root, '.cyc/config.json', config);
  put(root, '.cyc/runtime/session.json', '{"keep":true}');
  put(root, '.cyc/runs/task/state.json', '{"projectData":"retained"}');
  assert.equal(installProject(root).ok, true); assert.deepEqual(get(root, '.cyc/config.json'), config);
  assert.equal(doctorProject(root).ok, true);
  assert.equal(uninstallProject(root).ok, true); assert.deepEqual(get(root, '.cyc/config.json'), config); assert.deepEqual(get(root, '.cyc/runtime/session.json'), { keep: true });
  assert.deepEqual(get(root, '.cyc/runs/task/state.json'), { projectData: 'retained' });
  assert.equal(readFileSync(join(root, '.cyc/.gitignore'), 'utf8'), 'runtime/\nruns/\n');
});

test('corrupt host configuration or project configuration rejects before writing', t => {
  const root = fixture(t); put(root, '.claude/settings.json', '{broken'); const before = snapshot(root);
  assert.equal(installProject(root).ok, false); assert.deepEqual(snapshot(root), before);
  put(root, '.claude/settings.json', { hooks: { Stop: {} } }); const second = snapshot(root);
  assert.equal(installProject(root).ok, false); assert.deepEqual(snapshot(root), second);
  put(root, '.claude/settings.json', {}); put(root, '.cyc/config.json', { schemaVersion: 1 }); const third = snapshot(root);
  assert.equal(installProject(root).ok, false); assert.deepEqual(snapshot(root), third); assert.equal(doctorProject(root).ok, false);
});

test('single host installation can add another host without losing either', t => {
  const root = fixture(t); assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  assert.equal(existsSync(join(root, '.codex/hooks.json')), false);
  assert.equal(installProject(root, { hosts: ['codex'] }).ok, true);
  assert.equal(get(root, '.claude/settings.json').hooks.Stop.length, 1);
  assert.equal(get(root, '.codex/hooks.json').hooks.Stop.length, 1);
});

test('manifest path escape is rejected without touching external files', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const record = get(root, '.cyc/install-manifest.json'); record.files['../outside.txt'] = 'a'.repeat(64); put(root, '.cyc/install-manifest.json', record);
  const before = snapshot(root); assert.equal(uninstallProject(root).ok, false); assert.deepEqual(snapshot(root), before);
});

test('symlinked target directory is rejected before copying outside the project', t => {
  const root = fixture(t); const outside = fixture(t);
  try { symlinkSync(outside, join(root, '.agents'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') return t.skip('OS does not permit test junction creation'); throw error; }
  const result = installProject(root); assert.equal(result.ok, false); assert.deepEqual(readdirSync(outside), []);
});

test('modified engine hook blocks update and uninstall atomically until its dependency is removed', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const value = get(root, '.claude/settings.json'); value.hooks.Stop[0].hooks[0].timeout = 30;
  value.hooks.Stop.push({ hooks: [{ type: 'command', command: 'echo other' }] }); put(root, '.claude/settings.json', value);
  const before = snapshot(root); assert.equal(installProject(root).ok, false); assert.deepEqual(snapshot(root), before);
  for (const dryRun of [true, false]) {
    const result = uninstallProject(root, { dryRun });
    assert.equal(result.ok, false); assert.ok(result.conflicts.some(c => c.path === '.claude/settings.json' && /preserved hook/.test(c.reason)));
    assert.deepEqual(result.changes, []); assert.deepEqual(snapshot(root), before);
    assert.equal(existsSync(join(root, '.cyc/engine/scripts/response-hook.mjs')), true);
  }
  value.hooks.Stop.shift(); put(root, '.claude/settings.json', value);
  assert.equal(uninstallProject(root).ok, true);
  assert.deepEqual(get(root, '.claude/settings.json').hooks.Stop, value.hooks.Stop);
  assert.equal(existsSync(join(root, '.cyc/engine/scripts/response-hook.mjs')), false);
});

test('an old unmodified managed version can be updated and skill links resolve in the target project', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const name = '.cyc/engine/scripts/check-response.mjs'; const oldVersion = '// previous release'; put(root, name, oldVersion);
  const record = get(root, '.cyc/install-manifest.json'); record.files[name] = createHash('sha256').update(oldVersion).digest('hex'); put(root, '.cyc/install-manifest.json', record);
  const updated = installProject(root); assert.equal(updated.ok, true); assert.ok(updated.changes.some(c => c.path === name));
  // Playbooks are read after selection, so every installed page must resolve, not just the entry.
  const pages = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? pages(join(dir, entry.name)) : entry.name.endsWith('.md') ? [join(dir, entry.name)] : []);
  const installed = pages(join(root, '.agents/skills/cyc'));
  assert.ok(installed.some(page => /playbooks[\\/]evaluate\.md$/.test(page)), 'playbooks must be installed with the entry skill');
  let checked = 0;
  for (const page of installed) for (const [, link] of readFileSync(page, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:[a-z]+:|#)/i.test(link)) continue;
    checked += 1;
    assert.equal(existsSync(resolve(dirname(page), link.split('#')[0])), true, `Broken installed skill link in ${page}: ${link}`);
  }
  assert.ok(checked > 50, `expected the playbooks' method links to be checked, saw ${checked}`);
});

test('uninstall refuses to orphan an identical separately added engine hook', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const value = get(root, '.claude/settings.json'); value.hooks.Stop.unshift(structuredClone(value.hooks.Stop[0])); put(root, '.claude/settings.json', value);
  assert.equal(installProject(root).ok, true); assert.equal(get(root, '.claude/settings.json').hooks.Stop.length, 2);
  const before = snapshot(root);
  assert.equal(uninstallProject(root).ok, false); assert.deepEqual(snapshot(root), before);
  assert.equal(existsSync(join(root, '.cyc/engine/scripts/response-hook.mjs')), true);
});

test('a customized hook with no remaining engine dependency can be preserved during uninstall', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const value = get(root, '.claude/settings.json');
  value.hooks.Stop[0].hooks[0].command = 'echo my independent hook'; put(root, '.claude/settings.json', value);
  assert.equal(uninstallProject(root).ok, true);
  assert.equal(get(root, '.claude/settings.json').hooks.Stop[0].hooks[0].command, 'echo my independent hook');
  assert.equal(existsSync(join(root, '.cyc/engine/scripts/response-hook.mjs')), false);
});

test('a relative engine dependency in another event prevents uninstall from orphaning that hook', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const value = get(root, '.claude/settings.json');
  value.hooks.SessionStart = [{ hooks: [{ type: 'command', command: 'node ".cyc/engine/scripts/response-hook.mjs" claude' }] }];
  put(root, '.claude/settings.json', value); const before = snapshot(root);
  assert.equal(uninstallProject(root).ok, false); assert.deepEqual(snapshot(root), before);
});

test('an engine hook copied into an unmanaged host is not orphaned on uninstall', t => {
  const root = fixture(t); assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  put(root, '.codex/hooks.json', { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node ".cyc\\engine\\scripts\\response-hook.mjs" codex' }] }] } });
  const before = snapshot(root); const result = uninstallProject(root);
  assert.equal(result.ok, false); assert.ok(result.conflicts.some(c => c.path === '.codex/hooks.json'));
  assert.deepEqual(snapshot(root), before);
});

test('updating an older owned ignore file adds run record protection', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const legacy = 'runtime/\n'; put(root, '.cyc/.gitignore', legacy);
  const record = get(root, '.cyc/install-manifest.json');
  record.files['.cyc/.gitignore'] = createHash('sha256').update(legacy).digest('hex');
  put(root, '.cyc/install-manifest.json', record);
  assert.equal(installProject(root).ok, true);
  assert.equal(readFileSync(join(root, '.cyc/.gitignore'), 'utf8'), 'runtime/\nruns/\n');
});

test('copied hooks use the target project from nested cwd and isolate host session state', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  const nested = join(root, 'src', 'components'); mkdirSync(nested, { recursive: true });
  const script = join(root, '.cyc/engine/scripts/response-hook.mjs');
  const session = 'portable-hook-test'; const env = { ...process.env }; delete env.CYC_PROJECT_ROOT;
  for (const host of ['codex', 'claude']) {
    // Exercise the actual shell command installed in host configuration, including spaces.
    const command = get(root, host === 'codex' ? '.codex/hooks.json' : '.claude/settings.json').hooks.UserPromptSubmit[0].hooks[0].command;
    const result = runHook(command, host, root, { cwd: nested, input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt: 'limit off', cwd: nested }), encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr); const payload = JSON.parse(result.stdout);
    assert.ok(payload.hookSpecificOutput.additionalContext.includes(join(root, '.cyc/runtime')));
    const key = createHash('sha256').update(`${host}:${session}`).digest('hex').slice(0, 32);
    assert.equal(get(root, `.cyc/runtime/${key}.state.json`).characterLimitEnabled, false);
    // Without an explicit --project, event.cwd must locate the ancestor config.
    const fallback = spawnSync(process.execPath, [script, host], { cwd: nested, input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: `${session}-fallback`, prompt: 'hello', cwd: nested }), encoding: 'utf8', env });
    assert.equal(fallback.status, 0, fallback.stderr);
    assert.equal(existsSync(join(root, '.cyc/engine/.cyc/runtime')), false);
  }
  assert.equal(readdirSync(join(root, '.cyc/runtime')).filter(name => name.endsWith('.state.json')).length, 4);
});

test('hook commands never interpolate project paths into the shell', t => {
  const parent = fixture(t); const root = join(parent, 'project%PATH%'); mkdirSync(root);
  const result = installProject(root); assert.equal(result.ok, true, result.error);
  const command = get(root, '.claude/settings.json').hooks.Stop[0].hooks[0].command;
  assert.equal(command.includes(root), false); assert.equal(command.includes(process.execPath), false);
});

test('cursor host installs flat hooks, the delivery rule, and shared skills, and uninstalls cleanly', t => {
  const root = fixture(t);
  const userHook = { command: 'echo user-stop' };
  put(root, '.cursor/hooks.json', { version: 1, hooks: { stop: [userHook] } });
  const installed = installProject(root, { hosts: ['cursor'] });
  assert.equal(installed.ok, true, installed.error ?? JSON.stringify(installed.conflicts));
  const hooks = get(root, '.cursor/hooks.json');
  assert.equal(hooks.version, 1);
  for (const event of ['beforeSubmitPrompt', 'afterAgentResponse', 'stop']) assert.match(hooks.hooks[event].at(-1).command, /response-hook\.mjs.*cursor/);
  assert.deepEqual(hooks.hooks.stop[0], userHook);
  assert.equal(hooks.hooks.stop.at(-1).loop_limit, 4);
  assert.ok(existsSync(join(root, '.cursor/rules/cyc-delivery.mdc')));
  assert.ok(existsSync(join(root, '.agents/skills/cyc/SKILL.md')));
  assert.equal(existsSync(join(root, '.claude/skills')), false);
  assert.equal(doctorProject(root).ok, true);
  assert.deepEqual(installProject(root, { hosts: ['cursor'] }).changes, []);
  const removed = uninstallProject(root); assert.equal(removed.ok, true, removed.error);
  assert.deepEqual(get(root, '.cursor/hooks.json'), { version: 1, hooks: { stop: [userHook] } });
  assert.equal(existsSync(join(root, '.cursor/rules/cyc-delivery.mdc')), false);
});

test('a fresh cursor install leaves no hooks file behind after uninstall', t => {
  const root = fixture(t);
  assert.equal(installProject(root, { hosts: ['cursor'] }).ok, true);
  assert.equal(uninstallProject(root).ok, true);
  assert.equal(existsSync(join(root, '.cursor/hooks.json')), false);
});

test('host detection follows what the project already uses and falls back to all three', t => {
  const empty = fixture(t);
  assert.deepEqual(detectHosts(empty), ['codex', 'claude', 'cursor']);
  const mixed = fixture(t); put(mixed, 'CLAUDE.md', 'x'); put(mixed, '.cursor/rules/a.mdc', 'x');
  assert.deepEqual(detectHosts(mixed), ['claude', 'cursor']);
  assert.throws(() => installProject(mixed, { hosts: ['vscode'] }).error ? (() => { throw new Error(); })() : null);
});

test('activate opts a project in without copying the engine, and refuses an invalid config', t => {
  const root = fixture(t);
  const planned = activateProject(root, { dryRun: true });
  assert.equal(planned.ok, true); assert.equal(existsSync(join(root, '.cyc')), false);
  assert.equal(activateProject(root).ok, true);
  assert.equal(get(root, '.cyc/config.json').schemaVersion, 1);
  assert.equal(existsSync(join(root, '.cyc/engine')), false);
  assert.deepEqual(activateProject(root).changes, []);
  put(root, '.cyc/config.json', { schemaVersion: 99 });
  assert.equal(activateProject(root).ok, false);
});


test('installed hooks survive relocation without embedding the original machine path', t => {
  const original = fixture(t); const moved = fixture(t);
  assert.equal(installProject(original).ok, true);
  cpSync(original, moved, { recursive: true });
  const manifest = get(moved, '.cyc/install-manifest.json');
  assert.equal(manifest.version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
  assert.equal(doctorProject(moved).ok, true);
  const command = get(moved, '.claude/settings.json').hooks.UserPromptSubmit[0].hooks[0].command;
  assert.equal(command.includes(original), false);
  const result = runHook(command, 'claude', moved, { cwd: moved, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: 'relocated', prompt: 'hello', cwd: moved }) });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).hookSpecificOutput.additionalContext.includes(join(moved, '.cyc/runtime')));
});

test('all hosts expose only cyc while its internal stage instructions remain accessible', t => {
  const root = fixture(t);
  assert.equal(installProject(root, { hosts: ['claude', 'codex', 'cursor'] }).ok, true);
  for (const folder of ['.claude/skills', '.agents/skills']) {
    const discoverable = readdirSync(join(root, folder)).filter(name => existsSync(join(root, folder, name, 'SKILL.md')));
    assert.deepEqual(discoverable, ['cyc']);
    const parent = join(root, folder, 'cyc/SKILL.md');
    for (const [, link] of readFileSync(parent, 'utf8').matchAll(/\]\(([^)]+)\)/g)) assert.ok(existsSync(resolve(dirname(parent), link.split('#')[0])), `Broken orchestrator link ${link}`);
  }
  const started = spawnSync(process.execPath, [join(root, '.cyc/engine/bin/cyc.mjs'), 'run', 'start', '--goal', 'Inspect the flow', '--playbook', 'investigation'], { cwd: root, encoding: 'utf8' });
  assert.equal(started.status, 0, started.stderr);
  const next = JSON.parse(started.stdout);
  assert.equal(next.skill, 'methods/cyc-scout/SKILL.md');
  assert.ok(existsSync(join(root, '.cyc/engine', next.skill)));
  assert.equal(resolve(next.skillFile), resolve(root, '.cyc/engine', next.skill), 'skillFile must point at the installed engine copy');
  assert.equal(existsSync(join(root, next.skill)), false, 'the relative path alone does not resolve from the project root');
});

function legacySupportingSkill(root, customized = false) {
  const manifest = get(root, '.cyc/install-manifest.json');
  for (const host of ['.claude', '.agents']) {
    const path = `${host}/skills/cyc-build/SKILL.md`;
    const original = 'Legacy internal build instructions';
    put(root, path, customized ? `${original}\nUser customization` : original);
    manifest.files[path] = createHash('sha256').update(original).digest('hex');
  }
  put(root, '.cyc/install-manifest.json', manifest);
}

test('updating removes unchanged owned legacy menu entries and preserves unrelated skills', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  legacySupportingSkill(root);
  put(root, '.claude/skills/my-review/SKILL.md', 'User-owned skill');
  const before = snapshot(root);
  const preview = installProject(root, { dryRun: true });
  assert.equal(preview.ok, true); assert.deepEqual(snapshot(root), before);
  assert.ok(preview.changes.some(item => item.path === '.claude/skills/cyc-build/SKILL.md' && item.action === 'remove'));
  assert.equal(installProject(root).ok, true);
  for (const host of ['.claude', '.agents']) assert.equal(existsSync(join(root, host, 'skills/cyc-build/SKILL.md')), false);
  assert.equal(readFileSync(join(root, '.claude/skills/my-review/SKILL.md'), 'utf8'), 'User-owned skill');
  assert.equal(doctorProject(root).ok, true);
  assert.deepEqual(installProject(root).changes, []);
});

test('customized legacy supporting skills block migration atomically instead of being deleted', t => {
  const root = fixture(t); assert.equal(installProject(root).ok, true);
  legacySupportingSkill(root, true); const before = snapshot(root);
  const result = installProject(root);
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some(item => /Customized legacy/.test(item.reason)));
  assert.deepEqual(snapshot(root), before);
});

test('update removes the legacy 15-minute limit, keeps other config, and never rewrites config under an active run', t => {
  const root = fixture(t);
  assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  const config = get(root, '.cyc/config.json');
  config.limits.maxDurationMs = 900000;
  config.verification.commands = [{ id: 'tests', command: 'node', args: ['--test'] }];
  put(root, '.cyc/config.json', config);
  put(root, '.cyc/runs/active-run/state.json', { status: 'running' });
  const blocked = installProject(root, { hosts: ['claude'] });
  assert.equal(blocked.ok, true);
  assert.equal(get(root, '.cyc/config.json').limits.maxDurationMs, 900000, 'must not touch config while a run is active');
  assert.ok(blocked.warnings.some(w => /left in place because a CYC run is active/.test(w)));
  put(root, '.cyc/runs/active-run/state.json', { status: 'complete' });
  const updated = installProject(root, { hosts: ['claude'] });
  assert.equal(updated.ok, true, updated.error);
  const after = get(root, '.cyc/config.json');
  assert.equal(after.limits.maxDurationMs, undefined);
  assert.deepEqual(after.verification.commands, config.verification.commands, 'the team\'s checks are preserved');
  assert.ok(updated.warnings.some(w => /Removed the legacy 15-minute run limit/.test(w)));
});

test('a deliberately chosen run limit is preserved on update and reported by doctor', t => {
  const root = fixture(t);
  assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  const config = get(root, '.cyc/config.json'); config.limits.maxDurationMs = 3600000; put(root, '.cyc/config.json', config);
  assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  assert.equal(get(root, '.cyc/config.json').limits.maxDurationMs, 3600000);
  assert.match(doctorProject(root).checks.find(c => c.name === 'run time limit').detail, /60 minutes/);
});

// Audit finding 14: three different repairs, so doctor names which one applies.
test('doctor says whether a hook entry is missing, modified by hand, or out of date', t => {
  const root = fixture(t); assert.equal(installProject(root, { hosts: ['claude'] }).ok, true);
  const hooks = () => doctorProject(root).checks.find(c => c.name === 'claude hooks');
  assert.equal(hooks().ok, true); assert.match(hooks().detail, /^Configuration only/);
  const installed = get(root, '.claude/settings.json');
  // Missing: the Stop entry was removed.
  put(root, '.claude/settings.json', { ...installed, hooks: { ...installed.hooks, Stop: [] } });
  assert.equal(hooks().ok, false); assert.match(hooks().detail, /^missing from \.claude\/settings\.json \(Stop\): rerun init$/);
  // Modified: the entry is still CYC's launcher, but its command was edited.
  const edited = JSON.parse(JSON.stringify(installed));
  edited.hooks.Stop[0].hooks[0].command = edited.hooks.Stop[0].hooks[0].command.replace('node ', 'node --no-warnings ');
  put(root, '.claude/settings.json', edited);
  assert.equal(hooks().ok, false); assert.match(hooks().detail, /^modified by hand in \.claude\/settings\.json \(Stop\): rerun init to restore it, or keep your edit/);
  assert.doesNotMatch(hooks().detail, /missing|out of date/);
  // Out of date: the install recorded an older engine entry, still present and unedited in the host file.
  put(root, '.claude/settings.json', installed);
  const record = get(root, '.cyc/install-manifest.json');
  const stale = JSON.parse(JSON.stringify(record.hooks.claude.entry)); stale.hooks[0].timeout = 10;
  record.hooks.claude.entry = stale; put(root, '.cyc/install-manifest.json', record);
  const settings = get(root, '.claude/settings.json');
  for (const event of ['UserPromptSubmit', 'Stop']) settings.hooks[event] = settings.hooks[event].map(e => (e.hooks?.[0]?.timeout === 60 ? stale : e));
  put(root, '.claude/settings.json', settings);
  assert.equal(hooks().ok, false); assert.match(hooks().detail, /^out of date: the engine's hook entry changed since this install; rerun init$/);
});
