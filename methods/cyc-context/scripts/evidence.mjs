import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

// File-byte evidence for a selected context claim, not a semantic freshness verdict.
try {
  const [action, ...args] = process.argv.slice(2);
  if (!['capture', 'check'].includes(action)) throw Error('Use capture --project ROOT --file PATH... or check --project ROOT --manifest PATH. Paths are project-relative files.');
  let project = process.cwd(), manifest;
  const selected = [];
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--project', '--file', '--manifest'].includes(flag) || !value || value.startsWith('--')) throw Error('Expected --project, --file or --manifest with a value.');
    if (flag !== '--file' && seen.has(flag)) throw Error(`Duplicate ${flag}.`);
    seen.add(flag);
    if (flag === '--project') project = value;
    if (flag === '--file') selected.push(value);
    if (flag === '--manifest') manifest = value;
  }
  const root = realpathSync(resolve(project));
  const canonical = name => {
    if (typeof name !== 'string' || !name || isAbsolute(name) || /[\\:*?\[\]{}\0]/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Use literal canonical project-relative file paths; globs and parent paths are not supported.');
    return name;
  };
  const read = name => {
    canonical(name);
    let path = root;
    for (const part of name.split('/')) {
      path = join(path, part);
      if (lstatSync(path).isSymbolicLink()) throw Error(`Symlink/junction is not covered: ${name}`);
    }
    if (!lstatSync(path).isFile()) throw Error(`Expected a regular file: ${name}`);
    return readFileSync(path);
  };
  const hash = name => createHash('sha256').update(read(name)).digest('hex');
  if (action === 'capture') {
    if (manifest || !selected.length || new Set(selected).size !== selected.length) throw Error('Capture needs unique --file paths and no --manifest.');
    const files = Object.fromEntries([...selected].sort().map(name => [canonical(name), hash(name)]));
    console.log(JSON.stringify({ schemaVersion: 1, files }, null, 2));
  } else {
    if (!manifest || selected.length) throw Error('Check needs --manifest and no --file.');
    const evidence = JSON.parse(read(manifest).toString('utf8').replace(/^\uFEFF/, ''));
    if (evidence?.schemaVersion !== 1 || !evidence.files || typeof evidence.files !== 'object' || Array.isArray(evidence.files) || !Object.keys(evidence.files).length) throw Error('Manifest needs schemaVersion 1 and a nonempty files object.');
    const entries = Object.entries(evidence.files);
    for (const [name, expected] of entries) {
      canonical(name);
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw Error(`Invalid SHA-256 for ${name}.`);
    }
    const files = entries.map(([path, expected]) => {
      try { return { path, status: hash(path) === expected ? 'unchanged' : 'changed' }; }
      catch (error) { if (error.code === 'ENOENT') return { path, status: 'missing' }; throw error; }
    });
    const unchanged = files.every(file => file.status === 'unchanged');
    console.log(JSON.stringify({ status: unchanged ? 'unchanged' : 'drift', files, scope: 'Selected file bytes only; unlisted dependencies and semantic correctness are not checked.' }, null, 2));
    process.exitCode = unchanged ? 0 : 1;
  }
} catch (error) {
  console.log(JSON.stringify({ status: 'invalid', error: error.message }, null, 2));
  process.exitCode = 2;
}
