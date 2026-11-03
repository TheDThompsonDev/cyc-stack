import { renderReport } from './report.mjs';

export function makeSummaryEmail(entries, config = {}) {
  const report = renderReport(entries, { ...config, format: 'text' });
  return {
    subject: `${report.count} entries / ${report.totalCents} cents`,
    message: report.body || '(no entries)',
  };
}
