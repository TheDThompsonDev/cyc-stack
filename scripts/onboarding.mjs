import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { doctorProject } from './install.mjs';
import { atomicJSON, configuration, projectFile, runCommands, sourceSnapshot } from './runtime.mjs';
import { digest } from './response-gate.mjs';
import { inspectHostActivation } from './host-activation.mjs';
import { responseGuidance } from './response-mode.mjs';

const receiptName = '.cyc/runtime/onboarding-checks.json';
const configName = '.cyc/config.json';

// Locate evidence for the host agent to interpret. Never infer, configure or execute
// a command merely because its name looks like a test.
function evidenceSources(root) {
  const names = ['.gitlab-ci.yml', 'package.json', 'Makefile', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'README.md', 'docs/context/INDEX.md', 'docs/context/recipes.json', 'docs/context/verify-recipe.md'];
  const workflows = projectFile(root, '.github/workflows');
  if (existsSync(workflows)) {
    for (const entry of readdirSync(workflows, { withFileTypes: true })) {
      if (entry.isFile() && /\.ya?ml$/.test(entry.name)) names.unshift(`.github/workflows/${entry.name}`);
    }
  }
  return names.filter(name => existsSync(projectFile(root, name))).sort();
}

function inspectChecks(root, config, verify) {
  const configPath = projectFile(root, configName);
  const path = projectFile(root, receiptName);
  const configHash = digest(readFileSync(configPath));
  const before = sourceSnapshot(root);
  let receipt;
  if (verify) {
    if (before.skipped.length) throw new Error('Setup verification cannot cover linked source. Inspect the project links before running checks.');
    const results = runCommands(root, config.commands);
    const after = sourceSnapshot(root);
    const configStable = digest(readFileSync(configPath)) === configHash;
    receipt = { schemaVersion: 1, checkedAt: new Date().toISOString(), configHash, sourceHash: after.hash,
      sourceStable: before.hash === after.hash, configStable,
      passed: configStable && before.hash === after.hash && !after.skipped.length && results.every(item => item.passed), results };
    atomicJSON(path, receipt);
  } else {
    try { receipt = JSON.parse(readFileSync(path, 'utf8')); } catch { /* absent or malformed is unverified */ }
  }
  if (!receipt || receipt.schemaVersion !== 1 || typeof receipt.checkedAt !== 'string'
    || !Array.isArray(receipt.results) || receipt.results.length !== config.commands.length
    || !config.commands.every((command, index) => {
      const result = receipt.results[index];
      return result?.id === command.id && result.command === command.command
        && JSON.stringify(result.args) === JSON.stringify(command.args) && typeof result.passed === 'boolean';
    })) return { status: 'unverified', detail: 'Configured checks have no usable setup receipt. Review their purpose and side effects, then run onboard --verify.' };
  const now = verify ? sourceSnapshot(root) : before;
  const status = receipt.configHash !== digest(readFileSync(configPath)) || receipt.sourceHash !== now.hash || now.skipped.length ? 'stale'
    : receipt.passed === true && receipt.sourceStable === true && receipt.configStable === true
      && receipt.results.every(item => item.passed && item.exitCode === 0 && !item.error) ? 'passed' : 'failed';
  return { status, receiptPath: receiptName, checkedAt: receipt.checkedAt,
    detail: status === 'passed' ? 'Configured commands passed on this covered source. This does not establish task completion or host activation.'
      : status === 'stale' ? 'The project or configuration changed since setup checks. Run onboard --verify again after reviewing the commands.'
        : 'Setup checks failed or changed project files/configuration. Inspect the receipt; do not weaken checks to finish setup.',
    results: receipt.results.map(({ id, passed, exitCode, error, errorCode }) => ({ id, passed, exitCode, error, errorCode })) };
}

export function onboardProject(target, { verify = false, host = 'auto', session, token, env = process.env } = {}) {
  const root = resolve(target);
  const report = { ok: true, projectRoot: root, environment: { node: process.version, platform: process.platform, arch: process.arch }, installation: 'missing', steps: [], evidenceSources: [], commands: [] };
  const add = (id, status, detail, action, extra = {}) => {
    report.steps.push({ id, status, detail, action, ...extra });
    if (['missing', 'failed'].includes(status)) report.ok = false;
  };
  let phase = 'installation';
  try {
    report.evidenceSources = evidenceSources(root);
    const configPath = projectFile(root, configName);
    if (existsSync(projectFile(root, '.cyc/install-manifest.json'))) {
      report.installation = 'project';
      const diagnostics = doctorProject(root);
      add('installation', diagnostics.ok ? 'passed' : 'failed', diagnostics.ok ? 'Project installation files and configuration are intact.' : 'Project installation needs attention.',
        'Inspect doctor findings and resolve owned-file conflicts without overwriting customized files.', { diagnostics });
    } else if (existsSync(configPath)) {
      report.installation = 'config-only';
      add('installation', 'passed', 'Project configuration exists; no project installation manifest. Plugin availability still needs confirmation in the host.', 'Use the connected CYC plugin or install a project copy.');
    } else {
      add('installation', 'missing', 'This project has no CYC configuration.', 'Use /cyc Set up CYC for this project. Preview init for a project install, or activate when the host already supplies the plugin.');
    }
    phase = 'configuration';
    if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('CYC requires Node.js 20 or later.');
    const config = configuration(root);
    report.commands = config.commands;
    add('configuration', config.commands.length ? 'passed' : 'missing', config.commands.length ? 'Verification commands are configured; their relevance needs project review.' : 'No project verification commands are configured.',
      'Read the discovered CI and project files, recommend the relevant existing checks with reasons, and configure approved commands. If no checks exist, explain the gap and propose one bounded behavior check.');
    phase = 'checks';
    if (config.commands.length && report.steps.every(step => step.status === 'passed')) {
      const { status, detail, ...evidence } = inspectChecks(root, config, verify);
      add('checks', status, detail, 'Inspect command results; after addressing the cause or prerequisite, run onboard --verify. Existing failures remain failures.', evidence);
    } else add('checks', 'unverified', 'Checks cannot run until installation and configuration are usable.', 'Resolve the preceding setup step first.');
  } catch (error) {
    add(phase, 'failed', error.message, phase === 'configuration' ? 'Repair project configuration before running checks. Preserve any active run and do not change its captured configuration.' : 'Inspect the reported path or error; preserve existing project files.');
  }
  const activation = inspectHostActivation(root, { host, session, token, env });
  const { status, detail, action, ...evidence } = activation;
  add('host', status, detail, action, evidence);
  // Exit 0 must never be mistaken for successful setup while hooks are missing
  // or only historical. Prompt-only evidence can still permit the first task.
  report.ready = report.steps.every(step => step.status === 'passed');
  report.canStartTask = report.steps.filter(step => step.id !== 'host').every(step => step.status === 'passed') && activation.canStartTask;
  report.ok &&= report.ready;
  add('first-task', 'pending', 'Setup checks are not a completed feature or evidence of user understanding.',
    'Use the user’s requested bounded task, or recommend one from inspected project evidence. Explain success criteria and use the normal Scout → Build → Verify → Deliver flow. Ask before selecting unrelated product changes.');
  const next = report.steps.find(step => step.status !== 'passed');
  report.nextAction = { step: next.id, instruction: next.action };
  report.guidance = { outcome: report.ready ? 'setup-checked' : report.canStartTask ? 'task-can-start' : 'setup-needed',
    summary: report.ready ? 'Setup has matching local checks and current host observations. Continue the authorized task; its outcome still needs verification.' : report.canStartTask ? 'This prompt hook was observed. Continue the authorized task and observe completion after the turn ends.' : next.detail,
    nextAction: report.nextAction };
  report.identity = {engineVersion:JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version,hostVersion:null,hostVersionSource:'Unavailable; a CLI on PATH is not the running host.'};
  let preference={},presentation;
  if(activation.canStartTask && activation.evidencePath) try { preference=JSON.parse(readFileSync(projectFile(root,activation.evidencePath),'utf8')); } catch { /* unknown, never synthesize state */ }
  try { presentation=JSON.parse(readFileSync(projectFile(root,configName),'utf8')).delivery?.presentation; } catch { /* the configuration step already reports the error */ }
  report.experience={purpose:'Use relevant project knowledge, check the change and retain consequential decisions for the next chat.',
    before:'Explain the requested outcome and the existing behavior to preserve; continue an authorized task, otherwise suggest one from inspected project evidence.',
    during:'Connect a discovered rule to the decision it changes and its check. Report actual failures and uncertainty, not routine command counts.',
    after:'Link actual checks, remaining limits and the target project context saved for the next chat. A stage pass does not prove understanding or usefulness.',understanding:'unverified'};
  report.responseChoices=responseGuidance({...preference,presentation});
  report.note = 'Inspection is read-only. --verify explicitly executes configured commands, which may have project-defined side effects, and saves a diagnostic receipt. The host agent recommends checks and confirms actual live observations.';
  return report;
}
