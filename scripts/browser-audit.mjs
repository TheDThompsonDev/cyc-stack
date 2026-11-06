import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { artifactFiles } from './execution.mjs';

export function validateBrowserPlan(plan) {
  if (!plan || !Array.isArray(plan.prerequisiteFiles) || !Array.isArray(plan.viewports) || !plan.viewports.length || !Array.isArray(plan.journeys) || !plan.journeys.length) throw new Error('Browser recipe needs prerequisiteFiles, viewports and named state/action/outcome journeys.');
  for (const v of plan.viewports) if (!v.name || !Number.isInteger(v.width) || !Number.isInteger(v.height) || v.width <= 0 || v.height <= 0) throw new Error('Browser viewport needs name and positive width/height.');
  if (new Set(plan.journeys.map(j => j.id)).size !== plan.journeys.length) throw new Error('Browser journeys need unique ids.');
  for (const j of plan.journeys) if (!j.id || !j.state || !Array.isArray(j.actions) || !Array.isArray(j.outcomes) || !j.outcomes.length) throw new Error('Browser journey needs id, initial state, actions and named outcomes.');
}

// Host integration supplies adapters bound to its actual supported API/handles. The runner
// never guesses a browser API, changes app layouts, installs dependencies or rewrites CSS.
export async function runBrowserAudit(root, plan, { driver, scanner, signal } = {}) {
  validateBrowserPlan(plan);
  const missing = plan.prerequisiteFiles.filter(path => !existsSync(resolve(root, path)));
  if (missing.length) return { ok: false, status: 'limited', missing, instruction: 'Inspect the existing preview/CSS/build prerequisites before starting a browser. No application edits were made.' };
  const before = artifactFiles(root, plan.prerequisiteFiles);
  if (!driver || !['open', 'act', 'observe', 'close'].every(name => typeof driver[name] === 'function') || typeof scanner !== 'function') return { ok: false, status: 'limited', missing: ['supported host browser driver/handles and separate scanner harness'], instruction: 'Bind the actual supported browser API and use an external scanner context. Do not instrument the application layout.' };
  const observations = [], scans = [], handles = []; let failure = null;
  const interrupted = () => signal?.aborted;
  try {
    for (const viewport of plan.viewports) {
      if (interrupted()) break;
      for (const journey of plan.journeys) {
        if (interrupted()) break;
        const handle = await driver.open({ viewport, state: journey.state, purpose: 'journey' }); handles.push(handle);
        for (const action of journey.actions) { if (interrupted()) break; await driver.act(handle, action); }
        if (interrupted()) break;
        const observe = async outcome => {
          const observation = await driver.observe(handle, outcome);
          if (typeof observation?.passed !== 'boolean' || typeof observation.evidence !== 'string') throw new Error('Browser observation needs an actual passed/failed result and evidence.');
          return { journey: journey.id, viewport: viewport.name, outcome, ...observation, origin: 'adapter-observed' };
        };
        // Independent observations only, after the actions established the current state.
        if (driver.allowIndependentObservations === true) observations.push(...await Promise.all(journey.outcomes.map(observe)));
        else for (const outcome of journey.outcomes) observations.push(await observe(outcome));
      }
      if (interrupted()) break;
      const handle = await driver.open({ viewport, state: plan.scanState ?? plan.journeys[0].state, purpose: 'external-accessibility-scan' }); handles.push(handle);
      const scan = await scanner(handle);
      if (!Array.isArray(scan?.violations)) throw new Error('External scanner did not supply violations.');
      scans.push({ viewport: viewport.name, violations: scan.violations, origin: 'scanner-observed' });
    }
  } catch (error) {
    failure = error.message;
  } finally { for (const handle of handles.reverse()) { try { await driver.close(handle); } catch (error) { failure ??= error.message; } } }
  let unchanged = false;
  try { unchanged = before.every(file => artifactFiles(root, [file.path])[0].sha256 === file.sha256); } catch { /* removed/replaced prerequisite is a failed preservation check */ }
  const complete = observations.length === plan.viewports.length * plan.journeys.reduce((n, j) => n + j.outcomes.length, 0) && scans.length === plan.viewports.length;
  const ok = !failure && !interrupted() && unchanged && complete && observations.every(o => o.passed) && scans.every(s => s.violations.length === 0);
  return { ok, status: interrupted() ? 'interrupted' : ok ? 'passed' : 'failed', ...(failure ? { error: failure } : {}), applicationPrerequisitesUnchanged: unchanged, observations, scans, limits: 'Only declared journeys and scanner rules were exercised; this does not certify complete accessibility or host activation.' };
}
