#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export function checkPublishingContext({ tag, ref, sha, head, channel }) {
  const issues = [];
  if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag) || ref !== `refs/tags/${tag}`) issues.push('Dispatch the workflow on the same release tag as the tag input, not a branch.');
  if (typeof sha !== 'string' || !sha || head !== sha) issues.push('Checkout HEAD must match the workflow event SHA for accurate npm provenance.');
  if (!['next', 'latest'].includes(channel)) issues.push('Choose the next or latest publication channel.');
  return issues;
}

// Offline release preflight. This does not publish, change host settings or prove activation.
export function checkDistribution(root, { tag } = {}) {
  const issues = [];
  const read = name => {
    try { return JSON.parse(readFileSync(resolve(root, name), 'utf8')); }
    catch (error) { issues.push(`${name}: ${error.message}`); return null; }
  };
  const pkg = read('package.json');
  if (!pkg) return { ok: false, issues };
  const require = (condition, message) => { if (!condition) issues.push(message); };
  const https = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  require(typeof pkg.name === 'string' && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(pkg.name), 'Package needs a valid npm identity; registry ownership must be confirmed separately.');
  require(typeof pkg.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version), 'Package needs a release version.');
  if (tag !== undefined) require(tag === `v${pkg.version}`, `Release tag ${tag} does not match v${pkg.version}.`);
  require(pkg.private === false || pkg.private === undefined, 'package.json private:true or a non-boolean private value prevents a public release.');
  require(pkg.publishConfig?.access === 'public' && pkg.publishConfig?.registry === 'https://registry.npmjs.org/', 'Public release must explicitly select the public npm registry and access.');
  require(pkg.repository?.type === 'git' && typeof pkg.repository.url === 'string' && https(pkg.repository.url.replace(/^git\+/, '')), 'Package needs an HTTPS Git repository URL without credentials.');
  require(https(pkg.homepage) && https(pkg.bugs?.url), 'Package needs HTTPS homepage and issue links without credentials.');
  require(pkg.license === 'MIT' && existsSync(resolve(root, 'LICENSE')), 'Release must carry its declared MIT license.');
  require(pkg.bin?.['cyc-stack'] === 'bin/cyc.mjs' && pkg.bin?.cyc === 'bin/cyc.mjs', 'Both public CLI names must point to bin/cyc.mjs.');
  for (const hook of ['preinstall', 'install', 'postinstall']) require(!pkg.scripts?.[hook], `Remove ${hook}: downloading the package must not install project integration.`);
  for (const path of ['INSTALL.md', 'bin', 'scripts/install.mjs', 'skills', 'methods', 'catalog', 'docs/installation.md', '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.agents']) {
    require(Array.isArray(pkg.files) && pkg.files.includes(path), `Release file selection must include ${path}.`);
    require(existsSync(resolve(root, path)), `Missing release resource: ${path}.`);
  }
  try { require(JSON.stringify(readdirSync(resolve(root, 'skills')).sort()) === JSON.stringify(['cyc']), 'Expose exactly one public cyc skill; keep supporting methods internal.'); }
  catch (error) { issues.push(`skills: ${error.message}`); }
  for (const host of ['claude', 'codex', 'cursor']) {
    const path = `.${host}-plugin/plugin.json`;
    const plugin = read(path);
    if (!plugin) continue;
    require(plugin.name === 'cycstack', `${path}: keep the stable cycstack plugin identity.`);
    require(plugin.version === pkg.version, `${path}: version must match ${pkg.version}.`);
    require(plugin.hooks === `./hooks/${host}.json`, `${path}: use the ${host} hook adapter.`);
    const hooks = read(`hooks/${host}.json`);
    require(hooks?.hooks && typeof hooks.hooks === 'object', `hooks/${host}.json needs a hook definition; native schema validation remains separate.`);
  }
  for (const path of ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const marketplace = read(path);
    const entries = Array.isArray(marketplace?.plugins) ? marketplace.plugins.filter(plugin => plugin?.name === 'cycstack') : [];
    require(entries?.length === 1, `${path}: list cycstack exactly once.`);
    if (path === '.claude-plugin/marketplace.json' && entries?.[0]) require(!Object.hasOwn(entries[0], 'version'), 'Claude marketplace must use the plugin manifest version instead of duplicating it.');
  }
  let changelog = '';
  try { changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'); }
  catch (error) { issues.push(`CHANGELOG.md: ${error.message}`); }
  require(changelog.split(/\r?\n/).some(line => line === `## ${pkg.version}` || line.startsWith(`## ${pkg.version} (`)), `CHANGELOG.md needs release notes for ${pkg.version}.`);
  return { ok: issues.length === 0, package: pkg.name, version: pkg.version, tag: tag ?? null, issues,
    limits: ['Registry ownership/authentication and native host activation are separate checks.', 'Lifecycle-hook plugins are not eligible for the OpenAI public directory.'] };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [tag, mode, ...extra] = process.argv.slice(2);
  const result = checkDistribution(root, { tag });
  if (extra.length || (mode && mode !== '--publish-context')) result.issues.push('Usage: check-distribution.mjs [vVERSION [--publish-context]]');
  if (mode === '--publish-context') {
    let head;
    try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); }
    catch { result.issues.push('Cannot determine checkout HEAD for publication.'); }
    result.issues.push(...checkPublishingContext({ tag, ref: process.env.GITHUB_REF, sha: process.env.GITHUB_SHA, head, channel: process.env.RELEASE_CHANNEL }));
  }
  result.ok = result.issues.length === 0;
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
