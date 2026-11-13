#!/usr/bin/env node
// Build the same reviewed archive for npm and native plugin distribution. Never publishes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDistribution } from './check-distribution.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
try {
  if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1])) throw new Error('Usage: npm run pack:release -- [--output DIRECTORY]');
  const preflight = checkDistribution(root);
  if (!preflight.ok) throw new Error(preflight.issues.join('\n'));
  // npm supplies its own executable path on every supported OS, avoiding shell quoting.
  if (!process.env.npm_execpath) throw new Error('Run through npm run pack:release so the active npm executable is available.');
  const destination = resolve(args[1] ?? resolve(root, 'release-assets'));
  mkdirSync(destination, { recursive: true });
  // Never leave a checksum from an earlier successful build beside a rejected candidate.
  rmSync(resolve(destination, 'SHA256SUMS'), { force: true });
  const [packed] = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts', '--pack-destination', destination], { cwd: root, encoding: 'utf8', windowsHide: true }));
  const files = new Set(packed.files.map(file => file.path));
  for (const path of ['package.json', 'plugin.json', 'LICENSE', 'INSTALL.md', 'bin/cyc.mjs', 'scripts/install.mjs', 'scripts/response-hook.mjs', 'skills/cyc/SKILL.md', 'methods/cyc-setup/SKILL.md', 'hooks/codex.json', 'hooks/claude.json', 'hooks/cursor.json', 'rules/cyc-delivery.mdc', '.codex-plugin/plugin.json', '.claude-plugin/plugin.json', '.cursor-plugin/plugin.json', '.agents/plugins/marketplace.json']) {
    if (!files.has(path)) throw new Error(`Archive is missing ${path}.`);
  }
  // Raised from 1 MiB by the owner on 2026-11-11, when change records needed about 7.5 KB more.
  if (packed.unpackedSize >= 1.1 * 1024 * 1024) throw new Error('Archive exceeds the 1.1 MiB unpacked release budget.');
  for (const path of files) {
    if (/^(?:test(?:-support)?\/|evals\/|docs\/(?:context|maintainers)\/|\.cyc\/|node_modules\/|release-assets\/)/.test(path)) throw new Error(`Development-only file in archive: ${path}.`);
  }
  const archive = resolve(destination, packed.filename);
  const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(resolve(destination, 'SHA256SUMS'), `${sha256}  ${packed.filename}\n`);
  console.log(JSON.stringify({ ...packed, sha256 }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
