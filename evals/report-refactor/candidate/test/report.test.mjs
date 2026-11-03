import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../src/report.mjs';
import { makeSummaryEmail } from '../src/mail.mjs';
import { makeArchive } from '../src/archive.mjs';

const rows = [{ id: 'a', label: 'Apple', amountCents: 125, status: 'posted' },
  { id: 'v', label: 'Void', amountCents: 50, status: 'void' }];
test('default report', () => assert.deepEqual(renderReport(rows), {
  format: 'text', count: 1, totalCents: 125, body: 'a: Apple = 125',
}));
test('CSV export', () => assert.equal(makeArchive(rows).content, 'id,label,amountCents\r\na,Apple,125'));
test('email consumer', () => assert.deepEqual(makeSummaryEmail(rows), {
  subject: '1 entries / 125 cents', message: 'a: Apple = 125',
}));
test('configuration gate', () => assert.throws(() => renderReport(rows, {
  format: 'csv', enabledFormats: ['text'],
}), { name: 'RangeError', message: 'Disabled format: csv' }));
