import { renderReport } from './report.mjs';

export function makeArchive(entries, config = {}) {
  const format = config.archiveFormat ?? 'csv';
  const report = renderReport(entries, { ...config, format });
  return {
    filename: `report.${format}`,
    contentType: format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/plain',
    content: report.body,
    totalCents: report.totalCents,
  };
}
