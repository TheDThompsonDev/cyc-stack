// Test-only ordering barrier; this wraps, rather than replaces, the real worker.
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [gate, worker, ...args] = process.argv.slice(2);
if (!gate || !worker || args.length !== 2) throw Error('This fixture needs its owned seed gate, baseline worker, temporary project and run ID.');
writeFileSync(`${gate}.started`, String(process.pid));
const deadline = Date.now() + 15000;
while (!existsSync(gate)) {
  if (Date.now() >= deadline) throw Error('Historical fixture state was not seeded; baseline measurement was not started.');
  await setTimeout(10);
}
unlinkSync(gate); unlinkSync(`${gate}.started`);
process.argv = [process.execPath, worker, ...args];
await import(pathToFileURL(worker).href);
