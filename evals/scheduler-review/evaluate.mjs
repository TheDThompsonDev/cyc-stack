import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const checks = [];
async function check(name, fn) {
  try { await fn(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, detail: error.message }); }
}
const [candidateArg, findingsArg] = process.argv.slice(2);
if (!candidateArg || !findingsArg) { console.log(JSON.stringify({ pass: false, checks: [{ name: 'candidate and findings arguments', pass: false }] })); process.exit(1); }
const candidate = path.resolve(candidateArg), findingsPath = path.resolve(findingsArg);
let selectDueJobs, document;
await check('findings outside candidate', async () => {
  const relative = path.relative(await fs.realpath(candidate), await fs.realpath(findingsPath));
  assert(relative.startsWith('..' + path.sep) || path.isAbsolute(relative), 'findings must be outside candidate');
});
await check('candidate unchanged', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('./candidate-manifest.json', import.meta.url), 'utf8'));
  const actual = {};
  async function walk(dir, prefix = '') {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const key = prefix + entry.name;
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), key + '/');
      else { assert(entry.isFile(), 'candidate must contain regular files only'); actual[key] = crypto.createHash('sha256').update(await fs.readFile(path.join(dir, entry.name))).digest('hex'); }
    }
  }
  await walk(candidate);
  assert.deepEqual(actual, manifest);
});
await check('load candidate and findings', async () => {
  ({ selectDueJobs } = await import(pathToFileURL(path.join(candidate, 'src/scheduler.mjs')).href));
  document = JSON.parse(await fs.readFile(findingsPath, 'utf8'));
  assert(Array.isArray(document.findings), 'findings must be an array');
  assert(document.findings.length > 0, 'at least one supported finding is required');
});

function reference(jobs, { now, limit = 10, runningQueues = [] }) {
  return jobs.map((job, index) => ({ job, index }))
    .filter(({ job }) => job.status === 'pending' && job.enabled !== false && job.runAt <= now && !runningQueues.includes(job.queue))
    .sort((a, b) => b.job.priority - a.job.priority || a.job.runAt - b.job.runAt || a.index - b.index)
    .slice(0, limit).map(({ job }) => job.id);
}
if (selectDueJobs && Array.isArray(document?.findings)) {
  for (const [index, finding] of document.findings.entries()) await check(`finding ${index + 1} supported regression`, () => {
    assert.equal(finding.file.replaceAll('\\', '/').replace(/^\.\//, ''), 'src/scheduler.mjs');
    assert.equal(finding.symbol, 'selectDueJobs');
    assert.equal(typeof finding.explanation, 'string');
    assert(finding.explanation.trim().length > 0, 'explanation is required');
    const { jobs, options } = finding.input;
    assert(Array.isArray(jobs));
    assert.equal(new Set(jobs.map(job => job.id)).size, jobs.length, 'IDs must be unique');
    for (const job of jobs) {
      for (const key of ['id', 'queue', 'status']) assert.equal(typeof job[key], 'string');
      for (const key of ['priority', 'runAt']) assert(Number.isFinite(job[key]));
      assert(job.enabled === undefined || typeof job.enabled === 'boolean');
    }
    assert(Number.isFinite(options.now));
    assert(options.limit === undefined || Number.isInteger(options.limit) && options.limit >= 0);
    assert(options.runningQueues === undefined || Array.isArray(options.runningQueues) && options.runningQueues.every(q => typeof q === 'string'));
    assert(Array.isArray(finding.expected) && Array.isArray(finding.actual));
    const expected = reference(jobs, options);
    const actual = selectDueJobs(structuredClone(jobs), structuredClone(options));
    assert.deepEqual(finding.expected, expected, 'claimed expected output must follow the contract');
    assert.deepEqual(finding.actual, actual, 'claimed actual output must reproduce');
    assert.notDeepEqual(actual, expected, 'input must demonstrate a behavioral regression');
  });
}
const pass = checks.every(check => check.pass);
console.log(JSON.stringify({ pass, checks }, null, 2));
process.exitCode = pass ? 0 : 1;
