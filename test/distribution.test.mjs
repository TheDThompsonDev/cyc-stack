import test from 'node:test';
import assert from 'node:assert/strict';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkDistribution, checkPublishingContext } from '../scripts/check-distribution.mjs';

const source = fileURLToPath(new URL('..', import.meta.url));
const prefix = 'cyc-distribution-';
function fixture(t) {
  const base = resolve(tmpdir());
  const root = mkdtempSync(join(base, prefix));
  t.after(() => {
    assert.equal(dirname(resolve(root)), base);
    assert.ok(basename(root).startsWith(prefix));
    rmSync(root, { recursive: true, force: true });
  });
  for (const path of ['package.json','LICENSE','INSTALL.md','CHANGELOG.md','.claude-plugin','.codex-plugin','.cursor-plugin','.agents/plugins','hooks']) cpSync(join(source, path), join(root, path), { recursive: true });
  for (const path of ['bin','skills/cyc','methods','catalog','scripts','docs']) mkdirSync(join(root, path), { recursive: true });
  for (const path of ['scripts/install.mjs','docs/installation.md']) writeFileSync(join(root, path), 'fixture');
  return root;
}
function edit(root, path, mutation) {
  const value = JSON.parse(readFileSync(join(root, path), 'utf8'));
  mutation(value);
  writeFileSync(join(root, path), JSON.stringify(value));
}

test('distribution preflight accepts the release without writing project files', t => {
  const root = fixture(t);
  const before = readFileSync(join(root, 'package.json'));
  const version = JSON.parse(before).version;
  assert.equal(checkDistribution(root, { tag: `v${version}` }).ok, true);
  assert.deepEqual(readFileSync(join(root, 'package.json')), before);
  assert.equal(existsSync(join(root, '.cyc')), false);
});

test('distribution preflight rejects a tag that would publish the wrong version', t => {
  const report = checkDistribution(fixture(t), { tag: 'v999.0.0' });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.includes('does not match')));
});

test('distribution preflight rejects private publication and credential-bearing metadata', t => {
  const root = fixture(t);
  edit(root, 'package.json', pkg => { pkg.private = true; pkg.repository.url = 'git+https://secret@example.com/repo.git'; });
  const report = checkDistribution(root);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.includes('private:true')));
  assert.ok(report.issues.some(issue => issue.includes('without credentials')));
  assert.equal(JSON.stringify(report).includes('secret@'), false);
});

test('distribution preflight rejects installation side effects without executing them', t => {
  const root = fixture(t);
  edit(root, 'package.json', pkg => { pkg.scripts.postinstall = 'node -e "require(\'node:fs\').writeFileSync(\'unexpected\',\'ran\')"'; });
  const report = checkDistribution(root);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.includes('Remove postinstall')));
  assert.equal(existsSync(join(root, 'unexpected')), false);
});

test('distribution preflight rejects a missing or unpacked agent guide', t => {
  const root = fixture(t);
  edit(root, 'package.json', pkg => { pkg.files = pkg.files.filter(path => path !== 'INSTALL.md'); });
  unlinkSync(join(root, 'INSTALL.md'));
  const report = checkDistribution(root);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.includes('selection must include INSTALL.md')));
  assert.ok(report.issues.some(issue => issue.includes('Missing release resource: INSTALL.md')));
});

test('distribution preflight rejects drift between package and plugin versions', t => {
  const root = fixture(t);
  edit(root, '.codex-plugin/plugin.json', plugin => { plugin.version = '0.0.0'; });
  edit(root, '.claude-plugin/marketplace.json', marketplace => { marketplace.plugins[0].version = '0.0.0'; });
  const report = checkDistribution(root);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some(issue => issue.includes('.codex-plugin/plugin.json: version')));
  assert.ok(report.issues.some(issue => issue.includes('instead of duplicating')));
});

test('distribution preflight reports malformed metadata as a failed release', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'package.json'), '{');
  const report = checkDistribution(root);
  assert.equal(report.ok, false);
  assert.ok(report.issues[0].startsWith('package.json:'));
});

test('distribution CLI exits nonzero for a rejected release', () => {
  const result = spawnSync(process.execPath, [join(source, 'scripts/check-distribution.mjs'), 'v999.0.0'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).ok, false);
});

test('publication requires matching event tag and checkout SHA, not just matching package metadata', () => {
  const valid = { tag: 'v0.6.0', ref: 'refs/tags/v0.6.0', sha: 'abc123', head: 'abc123', channel: 'next' };
  assert.deepEqual(checkPublishingContext(valid), []);
  assert.match(checkPublishingContext({ ...valid, ref: 'refs/heads/main' }).join(' '), /same release tag/);
  assert.match(checkPublishingContext({ ...valid, ref: 'refs/tags/v0.5.0' }).join(' '), /same release tag/);
  assert.match(checkPublishingContext({ ...valid, head: 'different-commit' }).join(' '), /event SHA/);
  assert.match(checkPublishingContext({ ...valid, channel: 'unreviewed' }).join(' '), /channel/);
});

test('publication preflight refuses local invocation without a real workflow context', () => {
  const version = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
  const result = spawnSync(process.execPath, [join(source, 'scripts/check-distribution.mjs'), `v${version}`, '--publish-context'], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, GITHUB_REF: '', GITHUB_SHA: '', RELEASE_CHANNEL: 'next' }
  });
  assert.equal(result.status, 1, result.stderr);
  assert.ok(JSON.parse(result.stdout).issues.some(issue => issue.includes('Dispatch the workflow')));
});
