const FORMATS = ['text', 'csv', 'json'];

function compareRows(a, b) {
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// The repeated preparation in these branches has made adding formats expensive.
export function renderReport(entries, options = {}) {
  const format = options.format ?? 'text';
  if (!FORMATS.includes(format)) throw new RangeError(`Unknown format: ${format}`);
  if (options.enabledFormats && !options.enabledFormats.includes(format)) {
    throw new RangeError(`Disabled format: ${format}`);
  }
  if (format === 'text') {
    let rows = entries.filter(row => options.includeVoided || row.status !== 'void');
    rows = rows.filter(row => row.amountCents >= (options.minimumCents ?? 0));
    if (options.sort === 'label') rows.sort(compareRows);
    const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const body = rows.map(row => `${row.id}: ${row.label} = ${row.amountCents}`).join('\n');
    return { format, count: rows.length, totalCents, body };
  }
  if (format === 'csv') {
    let rows = entries.filter(row => options.includeVoided || row.status !== 'void');
    rows = rows.filter(row => row.amountCents >= (options.minimumCents ?? 0));
    if (options.sort === 'label') rows.sort(compareRows);
    const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const body = ['id,label,amountCents', ...rows.map(row =>
      [row.id, row.label, row.amountCents].map(csvCell).join(','))].join('\r\n');
    return { format, count: rows.length, totalCents, body };
  }
  if (format === 'json') {
    let rows = entries.filter(row => options.includeVoided || row.status !== 'void');
    rows = rows.filter(row => row.amountCents >= (options.minimumCents ?? 0));
    if (options.sort === 'label') rows.sort(compareRows);
    const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const body = JSON.stringify(rows.map(row => ({ id: row.id, label: row.label, amountCents: row.amountCents })));
    return { format, count: rows.length, totalCents, body };
  }
}
