// Measures a run's baseline in the background so the agent can start read-only work immediately.
// Usage: node baseline-worker.mjs <projectRoot> <runId>
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { measureBaseline } from './runtime.mjs';

const [root, id] = process.argv.slice(2);
if (root && id && existsSync(resolve(root, '.cyc/runs', id, 'state.json'))) {
  try { measureBaseline(root, id); } catch { /* measureBaseline records its own errors when it can */ }
}
