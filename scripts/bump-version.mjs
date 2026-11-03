#!/usr/bin/env node
// Bump every version number CYC ships in one step, and open a changelog section for it.
// Usage: node scripts/bump-version.mjs 0.4.0
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('Usage: node scripts/bump-version.mjs <major.minor.patch>');
  process.exit(1);
}

export const versionFiles = ['package.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json'];
for (const file of versionFiles) {
  const path = resolve(root, file);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  value.version = version;
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
const marketplacePath = resolve(root, '.claude-plugin/marketplace.json');
const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
for (const plugin of marketplace.plugins) if (plugin.name === 'cycstack' && Object.hasOwn(plugin, 'version')) plugin.version = version;
writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

const changelogPath = resolve(root, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
if (!changelog.includes(`## ${version}`)) {
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(changelogPath, changelog.replace('\n## ', `\n## ${version} (${today})\n\n- Describe the changes in this release.\n\n## `));
}
console.log(`Bumped to ${version}. Edit CHANGELOG.md, commit, then: git tag v${version} && git push --follow-tags`);
