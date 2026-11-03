import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const checks = [];
async function check(name, fn) {
  try { await fn(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, detail: error.message }); }
}
const candidate = process.argv[2];
if (!candidate) { console.log(JSON.stringify({ pass: false, checks: [{ name: 'candidate argument', pass: false }] })); process.exit(1); }
let api;
await check('public modules load', async () => {
  const load = file => import(pathToFileURL(path.resolve(candidate, 'src', file)).href);
  api = { ...await load('report.mjs'), ...await load('mail.mjs'), ...await load('archive.mjs') };
  for (const key of ['renderReport', 'makeSummaryEmail', 'makeArchive']) assert.equal(typeof api[key], 'function');
});

const source = [
  { id: 'z', label: 'Zulu', amountCents: 250, status: 'posted', privateNote: 'omit' },
  { id: 'q,"', label: 'Alpha\r\n"quoted",cell', amountCents: 0, status: 'posted' },
  { id: 'n', label: 'Alpha', amountCents: -25, status: 'posted' },
  { id: 'v', label: 'Beta', amountCents: 500, status: 'void' },
  { id: 'e', label: 'Zulu', amountCents: 250, status: 'posted' },
];
function reference(entries, options = {}) {
  const format = options.format ?? 'text';
  const rows = [];
  for (const r of entries) if ((options.includeVoided || r.status !== 'void') && r.amountCents >= (options.minimumCents ?? 0)) rows.push(r);
  if (options.sort === 'label') rows.sort((a, b) => a.label < b.label ? -1 : +(a.label > b.label));
  const projected = rows.map(({ id, label, amountCents }) => ({ id, label, amountCents }));
  const cell = value => { const s = String(value); return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s; };
  const body = format === 'json' ? JSON.stringify(projected) : format === 'csv'
    ? ['id,label,amountCents', ...projected.map(r => Object.values(r).map(cell).join(','))].join('\r\n')
    : projected.map(r => r.id + ': ' + r.label + ' = ' + r.amountCents).join('\n');
  return { format, count: rows.length, totalCents: rows.reduce((n, r) => n + r.amountCents, 0), body };
}
if (api) {
  await check('default and null options', () => {
    assert.deepEqual(api.renderReport(source), reference(source));
    assert.deepEqual(api.renderReport(source, { format: null, minimumCents: null }), reference(source));
  });
  await check('format/filter/order matrix', () => {
    for (const format of ['text', 'csv', 'json']) for (const includeVoided of [false, true, 'yes'])
      for (const minimumCents of [-100, 0, 250, 251, 999]) for (const sort of ['input', 'label']) {
        const opts = { format, includeVoided, minimumCents, sort };
        assert.deepEqual(api.renderReport(source, opts), reference(source, opts));
      }
  });
  await check('empty output contracts', () => {
    for (const format of ['text', 'csv', 'json']) assert.deepEqual(api.renderReport([], { format }), reference([], { format }));
  });
  await check('frozen inputs and options remain unchanged', () => {
    const entries = Object.freeze(source.map(r => Object.freeze({ ...r })));
    const options = Object.freeze({ format: 'json', sort: 'label', enabledFormats: Object.freeze(['json']) });
    assert.deepEqual(api.renderReport(entries, options), reference(entries, options));
  });
  await check('unknown/disabled format errors and precedence', () => {
    for (const format of ['xml', '', 'toString', '__proto__']) assert.throws(() => api.renderReport(source, { format, enabledFormats: [] }), { name: 'RangeError', message: `Unknown format: ${format}` });
    for (const format of ['text', 'csv', 'json']) {
      assert.throws(() => api.renderReport(source, { format, enabledFormats: [] }), { name: 'RangeError', message: `Disabled format: ${format}` });
      assert.deepEqual(api.renderReport(source, { format, enabledFormats: [format] }), reference(source, { format }));
    }
  });
  await check('email consumer overrides and empty fallback', () => {
    const config = { format: 'json', sort: 'label', minimumCents: -100, includeVoided: true };
    const result = reference(source, { ...config, format: 'text' });
    assert.deepEqual(api.makeSummaryEmail(source, config), { subject: `${result.count} entries / ${result.totalCents} cents`, message: result.body });
    assert.deepEqual(api.makeSummaryEmail([]), { subject: '0 entries / 0 cents', message: '(no entries)' });
    assert.throws(() => api.makeSummaryEmail(source, { enabledFormats: ['json'] }), { name: 'RangeError', message: 'Disabled format: text' });
  });
  await check('archive consumer dispatch and configuration', () => {
    for (const archiveFormat of [undefined, null, 'text', 'csv', 'json']) {
      const format = archiveFormat ?? 'csv';
      const config = { archiveFormat, format: 'bogus', minimumCents: -100, includeVoided: true, sort: 'label' };
      const r = reference(source, { ...config, format });
      assert.deepEqual(api.makeArchive(source, config), { filename: `report.${format}`, contentType: { text: 'text/plain', csv: 'text/csv', json: 'application/json' }[format], content: r.body, totalCents: r.totalCents });
    }
    assert.throws(() => api.makeArchive(source, { enabledFormats: ['text'] }), { name: 'RangeError', message: 'Disabled format: csv' });
  });
}
const pass = checks.every(c => c.pass);
console.log(JSON.stringify({ pass, scope: 'behavioral preservation only', behaviorPass: pass, structuralGoal: { status: 'requires semantic review', criteria: ['single shared filtering/ordering/aggregation path', 'format rendering dispatched through a collection of handlers'] }, taskComplete: null, checks }, null, 2));
process.exitCode = pass ? 0 : 1;
