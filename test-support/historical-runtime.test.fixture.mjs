// Existing gate-isolation fixtures represent stored pre-retention runs. Current
// workflow/retention acceptance tests import scripts/runtime.mjs directly.
// No production flag disables retention, and no completed receipt is rewritten.
import * as current from '../scripts/runtime.mjs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export * from '../scripts/runtime.mjs';
const fixtureBase = realpathSync(tmpdir());
export function startRun(root, options) {
  const target = realpathSync(root);
  if (!target.startsWith(fixtureBase + sep)) throw Error('Historical fixture seeding is limited to isolated temporary projects.');
  const gate = resolve(target, `.cyc/runtime/historical-seed-${randomUUID()}.ready`);
  const worker = fileURLToPath(new URL('../scripts/baseline-worker.mjs', import.meta.url));
  const wrapper = fileURLToPath(new URL('./historical-baseline.test.fixture.mjs', import.meta.url));
  const spawn = childProcess.spawn;
  let deferred = false, result;
  // Only this fixture's existing baseline process is delayed. Its real PID,
  // environment and startup errors remain those returned by the real spawn.
  childProcess.spawn = (command, args, options) => {
    if (args?.[0] === worker && args[1] === target) {
      deferred = true; mkdirSync(dirname(gate), { recursive: true });
      return spawn(command, [wrapper, gate, ...args], options);
    }
    return spawn(command, args, options);
  };
  syncBuiltinESMExports();
  try { result = current.startRun(root, { ...structuredClone(options), contextRetention: { version: 1, disposition: 'unnecessary', reason: 'Seed an explicitly historical schema fixture, not a current feature completion.' } }); }
  finally { childProcess.spawn = spawn; syncBuiltinESMExports(); }
  const state = current.readRun(root, result.runId);
  delete state.contextRetention;
  for (const handoff of state.handoffs) if (handoff.assessment?.context) delete handoff.assessment.context.retention;
  current.atomicJSON(resolve(root, `.cyc/runs/${state.id}/state.json`), state);
  if (deferred) writeFileSync(gate, state.id);
  return result;
}
