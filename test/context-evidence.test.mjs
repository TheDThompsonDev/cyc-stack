import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { installProject } from '../scripts/install.mjs';

const source = resolve('methods/cyc-context/scripts/evidence.mjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc context evidence '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/component.mjs'), 'export const value = 1;\n');
  writeFileSync(join(root, 'src/dependency.json'), '{"mode":"one"}\n');
  return root;
}
function run(root, args, script = source) {
  const result = spawnSync(process.execPath, [script, ...args, '--project', root], { encoding: 'utf8', windowsHide: true });
  return { exit: result.status, data: JSON.parse(result.stdout) };
}
function capture(root) {
  const result = run(root, ['capture', '--file', 'src/component.mjs', '--file', 'src/dependency.json']);
  assert.equal(result.exit, 0);
  writeFileSync(join(root, 'evidence.json'), JSON.stringify(result.data));
  return result.data;
}

test('capture and check work on exact current bytes without a Git commit or a clean checkout', t => {
  const root = fixture(t);
  const before = readFileSync(join(root, 'src/component.mjs'));
  const evidence = capture(root);
  assert.equal(evidence.schemaVersion, 1);
  assert.deepEqual(Object.keys(evidence.files), ['src/component.mjs', 'src/dependency.json']);
  const checked = run(root, ['check', '--manifest', 'evidence.json']);
  assert.equal(checked.exit, 0);
  assert.equal(checked.data.status, 'unchanged');
  assert.ok(checked.data.files.every(file => file.status === 'unchanged'));
  assert.deepEqual(readFileSync(join(root, 'src/component.mjs')), before);
});

test('a changed dependency is detected while the main component remains unchanged', t => {
  const root = fixture(t); capture(root);
  writeFileSync(join(root, 'src/dependency.json'), '{"mode":"two"}\n');
  const checked = run(root, ['check', '--manifest', 'evidence.json']);
  assert.equal(checked.exit, 1);
  assert.equal(checked.data.status, 'drift');
  assert.deepEqual(checked.data.files, [{ path: 'src/component.mjs', status: 'unchanged' }, { path: 'src/dependency.json', status: 'changed' }]);
});

test('newline conversion and missing files are retained as drift', t => {
  const root = fixture(t); capture(root);
  writeFileSync(join(root, 'src/component.mjs'), 'export const value = 1;\r\n');
  unlinkSync(join(root, 'src/dependency.json'));
  const checked = run(root, ['check', '--manifest', 'evidence.json']);
  assert.equal(checked.exit, 1);
  assert.deepEqual(checked.data.files.map(file => file.status), ['changed', 'missing']);
});

test('invalid or empty manifests, bad digests and paths outside the project are rejected', t => {
  const root = fixture(t);
  for (const evidence of [{}, { schemaVersion: 1, files: {} }, { schemaVersion: 2, files: { 'src/component.mjs': 'a'.repeat(64) } }, { schemaVersion: 1, files: { 'src/component.mjs': 'not-a-digest' } }, { schemaVersion: 1, files: { '../outside': 'a'.repeat(64) } }, { schemaVersion: 1, files: { '/absolute': 'a'.repeat(64) } }]) {
    writeFileSync(join(root, 'evidence.json'), JSON.stringify(evidence));
    const checked = run(root, ['check', '--manifest', 'evidence.json']);
    assert.equal(checked.exit, 2); assert.equal(checked.data.status, 'invalid');
  }
  for (const args of [['capture'], ['capture', '--file', '../outside'], ['capture', '--file', 'src/**'], ['capture', '--file', 'src/component.mjs', '--file', 'src/component.mjs'], ['check', '--manifest', '../outside'], ['unknown'], ['capture', '--oops', 'value']]) assert.equal(run(root, args).exit, 2);
});

test('a directory junction or symlink cannot extend the covered project', t => {
  const root = fixture(t);
  const outside = mkdtempSync(join(tmpdir(), 'cyc outside context '));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, 'outside.txt'), 'external');
  symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(run(root, ['capture', '--file', 'linked/outside.txt']).exit, 2);
  writeFileSync(join(root, 'evidence.json'), JSON.stringify({ schemaVersion: 1, files: { 'linked/outside.txt': 'a'.repeat(64) } }));
  assert.equal(run(root, ['check', '--manifest', 'evidence.json']).exit, 2);
});

test('the copied installed method executes with only Node and project-relative evidence', t => {
  const root = fixture(t);
  assert.equal(installProject(root, { hosts: ['codex'] }).ok, true);
  const script = join(root, '.cyc/engine/methods/cyc-context/scripts/evidence.mjs');
  const captured = run(root, ['capture', '--file', 'src/component.mjs'], script);
  assert.equal(captured.exit, 0);
  writeFileSync(join(root, 'evidence.json'), JSON.stringify(captured.data));
  assert.equal(run(root, ['check', '--manifest', 'evidence.json'], script).exit, 0);
});
