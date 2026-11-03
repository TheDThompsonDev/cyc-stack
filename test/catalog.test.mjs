import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { catalog, getPlaybook, routeTask } from '../scripts/catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playbookDirectory = join(root, 'skills', 'cyc', 'references', 'playbooks');
const releasePlaybooks = [
  'investigation', 'explore', 'plan', 'feature', 'bug-fix', 'refactor',
  'performance', 'review', 'verify', 'experience', 'teach', 'handoff',
  'resume', 'reflect', 'evaluate',
];

test('release package supports explicit npm installation and ships the agent install guide', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.notEqual(manifest.private, true, 'release package must permit an authorized npm publication');
  assert.equal(manifest.publishConfig.access, 'public');
  assert.equal(manifest.publishConfig.registry, 'https://registry.npmjs.org/');
  assert.equal(manifest.bin['cyc-stack'], 'bin/cyc.mjs');
  assert.ok(manifest.files.includes('INSTALL.md'), 'agent guide must survive packing and project installation');
  assert.ok(readFileSync(join(root, 'INSTALL.md'), 'utf8').trim());
  for (const hook of ['preinstall', 'install', 'postinstall']) assert.equal(manifest.scripts[hook], undefined, `${hook} must not modify a project merely by downloading CYC`);
});

test('plugin skill discovery has exactly one public CYC entry', () => {
  assert.deepEqual(readdirSync(join(root, 'skills')), ['cyc']);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(manifest.files.includes('methods'), 'npm distribution must include internal methods');
  for (const host of ['codex', 'cursor']) {
    const plugin = JSON.parse(readFileSync(join(root, `.${host}-plugin/plugin.json`), 'utf8'));
    assert.equal(plugin.skills, './skills/');
  }
});

test('every advertised playbook has exactly one catalog entry and readable procedure', () => {
  assert.equal(catalog.schemaVersion, 1);
  const ids = catalog.playbooks.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs make playbook selection ambiguous');
  assert.deepEqual([...ids].sort(), [...releasePlaybooks].sort());
  const documents = readdirSync(playbookDirectory).filter(name => name.endsWith('.md'));
  assert.deepEqual(documents.sort(), ids.map(id => `${id}.md`).sort(), 'catalog and shipped procedures must stay in sync');
  for (const playbook of catalog.playbooks) {
    assert.match(playbook.id, /^[a-z][a-z-]*$/);
    assert.ok(playbook.description.trim(), `${playbook.id}: missing selection description`);
    assert.equal(typeof playbook.requiresChecks, 'boolean');
    assert.ok(readFileSync(join(playbookDirectory, `${playbook.id}.md`), 'utf8').trim());
    assert.deepEqual(getPlaybook(playbook.id), playbook);
  }
  assert.throws(() => getPlaybook('not-a-playbook'), /Unknown playbook/);
});

test('every runtime stage resolves to its named callable skill and delivery is terminal', () => {
  for (const playbook of catalog.playbooks) {
    assert.ok(Array.isArray(playbook.stages) && playbook.stages.length > 0);
    assert.equal(new Set(playbook.stages).size, playbook.stages.length, `${playbook.id}: stage names must identify an unambiguous recovery point`);
    assert.equal(playbook.stages.at(-1), 'deliver');
    for (const stage of playbook.stages) {
      assert.match(stage, /^[a-z][a-z-]*$/);
      const skill = join(root, 'methods', `cyc-${stage}`, 'SKILL.md');
      assert.ok(existsSync(skill), `${playbook.id}: unresolved skill ${stage}`);
      const content = readFileSync(skill, 'utf8');
      assert.match(content, new RegExp(`^---\\r?\\nname: cyc-${stage}\\r?\\n`));
    }
  }
});

test('implementation routes investigate impact before edits and verify before delivery', () => {
  for (const playbook of catalog.playbooks) {
    const build = playbook.stages.indexOf('build');
    const verify = playbook.stages.indexOf('verify');
    if (build !== -1) {
      // Scout folds impact analysis into one fast pass; either must precede the first edit.
      const impact = Math.max(playbook.stages.indexOf('impact'), playbook.stages.indexOf('scout'));
      assert.ok(impact !== -1 && impact < build, `${playbook.id}: implementation needs an earlier scout or impact stage`);
      assert.ok(verify > build, `${playbook.id}: implementation needs subsequent verification`);
      assert.equal(playbook.requiresChecks, true, `${playbook.id}: code execution needs machine checks`);
    }
    if (playbook.requiresChecks) {
      assert.ok(verify !== -1 && verify < playbook.stages.length - 1, `${playbook.id}: configured checks need a verification stage`);
    }
  }
  for (const id of ['investigation', 'explore', 'plan', 'review', 'teach', 'reflect']) {
    assert.ok(!getPlaybook(id).stages.includes('build'), `${id}: advisory/read-only work must not automatically implement changes`);
  }
});

test('orchestrator exposes every catalog procedure and all skill links resolve', () => {
  const orchestrator = readFileSync(join(root, 'skills', 'cyc', 'SKILL.md'), 'utf8');
  const linked = [...orchestrator.matchAll(/\]\(references\/playbooks\/([a-z-]+)\.md\)/g)].map(match => match[1]);
  assert.deepEqual([...linked].sort(), [...releasePlaybooks].sort());

  function markdownFiles(directory) {
    return readdirSync(directory).flatMap(name => {
      const entry = join(directory, name);
      return statSync(entry).isDirectory() ? markdownFiles(entry) : name.endsWith('.md') ? [entry] : [];
    });
  }
  for (const file of [...markdownFiles(join(root, 'skills')), ...markdownFiles(join(root, 'methods'))]) {
    const source = readFileSync(file, 'utf8');
    for (const [, target] of source.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const pathname = target.split('#')[0];
      assert.ok(existsSync(resolve(dirname(file), pathname)), `${file}: broken reference ${target}`);
    }
  }
});

// An agent reads only the playbook it selected, so the page must name and link the
// method for each stage the controller will ask for, in the controller's order.
function playbookProblems(source, stages) {
  const problems = [];
  const line = /^Use .*?Stages: (.+)\.$/m.exec(source);
  if (!line) return ['missing a "Stages:" line'];
  const linked = [...line[1].matchAll(/\[([a-z-]+)\]\(\.\.\/\.\.\/\.\.\/\.\.\/methods\/cyc-([a-z-]+)\/SKILL\.md\)/g)];
  if (linked.some(([, label, target]) => label !== target)) problems.push('stage label does not match its linked method');
  if (JSON.stringify(linked.map(([, label]) => label)) !== JSON.stringify(stages)) problems.push(`stages ${linked.map(([, label]) => label).join(',')} differ from catalog ${stages.join(',')}`);
  if (!/^\*\*Acceptance:\*\* \S/m.test(source)) problems.push('missing an "**Acceptance:**" statement');
  return problems;
}

test('every playbook links its catalog stages in order and states acceptance', () => {
  for (const playbook of catalog.playbooks) {
    const source = readFileSync(join(playbookDirectory, `${playbook.id}.md`), 'utf8');
    assert.deepEqual(playbookProblems(source, playbook.stages), [], playbook.id);
  }
  const M = '../../../../methods';
  const good = `Use it. Stages: [scout](${M}/cyc-scout/SKILL.md) → [deliver](${M}/cyc-deliver/SKILL.md).\n\n**Acceptance:** done.`;
  assert.deepEqual(playbookProblems(good, ['scout', 'deliver']), []);
  assert.match(playbookProblems('Use it. No stages here.\n\n**Acceptance:** done.', ['scout'])[0], /missing a "Stages:"/);
  assert.match(playbookProblems(good, ['deliver', 'scout']).join(), /differ from catalog/, 'reordered stages must be rejected');
  assert.match(playbookProblems(good, ['scout', 'build', 'deliver']).join(), /differ from catalog/, 'a missing stage must be rejected');
  assert.match(playbookProblems(good.replace('[scout]', '[build]'), ['build', 'deliver']).join(), /label does not match/);
  assert.match(playbookProblems(good.replace('**Acceptance:** done.', ''), ['scout', 'deliver']).join(), /Acceptance/);
});

test('routing returns a valid advisory suggestion for clear, ambiguous, and unknown requests', () => {
  for (const goal of [
    'Add homework completion that survives reload.',
    'Teach me why this bug happens; do not edit files.',
    'Review the refactor and compare performance.',
    'I need help with something unusual.',
  ]) {
    const result = routeTask(goal);
    assert.equal(result.advisory, true);
    assert.ok(result.basis.trim());
    assert.ok(getPlaybook(result.playbook));
    assert.equal(result.runId, undefined, 'a suggestion is not an authorized task run');
  }
});

test('route CLI cannot create task state or mutate the target project', t => {
  const project = mkdtempSync(join(tmpdir(), 'cyc-route-'));
  t.after(() => {
    assert.equal(dirname(project), resolve(tmpdir()));
    assert.ok(project.startsWith(join(resolve(tmpdir()), 'cyc-route-')));
    rmSync(project, { recursive: true, force: true });
  });
  const result = spawnSync(process.execPath, [join(root, 'bin', 'cyc.mjs'), 'route', '--project', project, '--goal', 'Fix the bug and deploy everything'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const suggestion = JSON.parse(result.stdout);
  assert.equal(suggestion.advisory, true);
  assert.ok(getPlaybook(suggestion.playbook));
  assert.deepEqual(readdirSync(project), [], 'routing must not start execution, install files, or create records');
});

test('plugin manifests, marketplaces, and per-host hook files are valid and point at real files', () => {
  const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
  for (const path of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', '.cursor-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const manifest = read(path);
    assert.equal(manifest.name, 'cycstack', path);
    if (manifest.hooks) assert.ok(existsSync(join(root, manifest.hooks)), `${path}: missing ${manifest.hooks}`);
  }
  const versions = new Set(['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', 'package.json'].map(path => read(path).version));
  assert.equal(versions.size, 1, 'plugin and package versions must match');
  assert.equal(read('.claude-plugin/marketplace.json').plugins[0].version, undefined, 'Claude uses the plugin manifest as its version authority');
  assert.match(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), new RegExp(`^## ${read('package.json').version.replaceAll('.', '\.')}( |$)`, 'm'), 'CHANGELOG.md needs a section for the current version');
  assert.equal(existsSync(join(root, 'hooks/hooks.json')), false, 'a shared hooks/hooks.json would be auto-loaded by every host with the wrong schema');
  for (const [file, variable, host] of [['claude', '${CLAUDE_PLUGIN_ROOT}', 'claude'], ['codex', '$PLUGIN_ROOT', 'codex'], ['cursor', '${CURSOR_PLUGIN_ROOT}', 'cursor']]) {
    const commands = JSON.stringify(read(`hooks/${file}.json`));
    assert.ok(commands.includes(variable) && commands.includes(`response-hook.mjs\\" ${host} --plugin`), `hooks/${file}.json`);
  }
});

test('every skill has valid YAML frontmatter with a name matching its folder and a description', () => {
  // Plain YAML scalars cannot contain ": " or " #", or start with an indicator character.
  // A description like "Run X through CYC: pick..." silently breaks skill loading in hosts.
  const plainOk = value => !/:\s|\s#/.test(value) && !/^[\[\]{}&*!|>'"%@`#,?:-]/.test(value);
  for (const location of ['skills', 'methods']) for (const folder of readdirSync(join(root, location))) {
    const source = readFileSync(join(root, location, folder, 'SKILL.md'), 'utf8');
    const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
    assert.ok(block, `${folder}: missing frontmatter`);
    const fields = {};
    for (const line of block[1].split(/\r?\n/)) {
      const match = /^([a-z-]+): (.*)$/.exec(line);
      assert.ok(match, `${folder}: unparseable frontmatter line: ${line}`);
      const [, key, raw] = match;
      if (raw.startsWith('"')) {
        assert.doesNotThrow(() => { fields[key] = JSON.parse(raw); }, `${folder}: invalid quoted ${key}`);
      } else {
        assert.ok(plainOk(raw), `${folder}: ${key} must be quoted (contains ": ", " #", or a leading indicator)`);
        fields[key] = raw;
      }
    }
    assert.equal(fields.name, folder);
    assert.ok(fields.description?.length > 40, `${folder}: description too short to trigger reliably`);
  }
});
