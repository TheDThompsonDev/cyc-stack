#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { resolveExecution, artifactFiles } from '../scripts/execution.mjs';
import { isDeepStrictEqual } from 'node:util';
import { catalog, routeTask } from '../scripts/catalog.mjs';
import { acceptFailure, activeRun, callerSession, inputPath, completeRun, controlRun, finishRun, nextRun, projectFile, proveRun, quickHandoff, readRun, recordHandoff, recoverRun, retryRun, reviewRun, startRun, verifyRun, captureReview, recordReview, startOperation, waitOperation, prepareRunContext } from '../scripts/runtime.mjs';

const args = process.argv.slice(2);
const positionals = [];
const options = {};
const flags = new Set(['dry-run', 'help', 'verbose', 'verify', 'reviewed', 'write', 'all', 'expanded', 'json']);
try {
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) { positionals.push(args[i]); continue; }
    const name = args[i].slice(2);
    if (flags.has(name)) { options[name] = true; continue; }
    if (['mode', 'conversation', 'wait-ms', 'operation'].includes(name)) { const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value.`); options[name] = value; continue; }
    if (!['project', 'hosts', 'host', 'token', 'goal', 'playbook', 'criteria', 'run', 'file', 'scope', 'stage', 'reason', 'session', 'since', 'check', 'status', 'summary', 'artifact', 'criteria-passed', 'criterion-evidence', 'next', 'criterion', 'verbose', 'assessment', 'response', 'blocker', 'advisory', 'passed', 'unmet', 'tests', 'path', 'limit', 'recipe', 'kind', 'plan', 'scout', 'new', 'doc', 'update-run'].includes(name)) throw new Error(`Unknown option --${name}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value.`);
    if (['scope', 'artifact', 'criterion', 'passed', 'unmet', 'tests', 'path'].includes(name)) {
      (options[name] ??= []).push(value);
      // Lists take every following value until the next flag.
      if (!['criterion', 'passed', 'unmet'].includes(name)) while (args[i + 1] && !args[i + 1].startsWith('--')) options[name].push(args[++i]);
    } else options[name] = value;
  }
  const [command, action] = positionals;
  if ((options.host !== undefined || options.token !== undefined) && command !== 'onboard') throw new Error('--host and --token are only supported by onboard.');
  if (options.kind !== undefined && command !== 'investigate' && (command !== 'recipe' || action !== 'list')) throw new Error('--kind is only supported by recipe list and investigate.');
  if (options.since !== undefined && command !== 'readiness' && command !== 'context') throw new Error('--since is only supported by readiness and context review.');
  if (options['update-run'] !== undefined && (command !== 'context' || action !== 'review' || !options.write)) throw new Error('--update-run is only supported by context review --write.');
  if ((options.write || options.all || options.new !== undefined || options.doc !== undefined) && command !== 'context') throw new Error('--write, --all, --new and --doc are only supported by context.');
  if (options.verify && command !== 'onboard') throw new Error('--verify is only supported by onboard. Use run verify for task verification.');
  if (options.verify && options['dry-run']) throw new Error('Do not combine --verify with --dry-run. Plain onboard performs read-only inspection.');
  if (!command || command === 'help' || options.help) {
    console.log(`CYC Stack — portable skill chaining and evidence-based delivery

Setup (project-local; no publication or global installation):
  cyc init [--project PATH] [--hosts auto|claude,codex,cursor] [--dry-run]   (default: auto-detect)
  cyc activate [--project PATH] [--dry-run]   (plugin installs: opt this project in)
  cyc doctor --project PATH
  cyc onboard [--project PATH] [--verify] [--host auto|codex|claude|cursor] [--session ID] [--token TOKEN]
      (inspect setup and this request's hooks; --verify executes configured checks)
  cyc uninstall --project PATH [--dry-run]

Discover:
  cyc playbooks
  cyc route --goal "What you want to accomplish"   (advisory suggestion)
  cyc investigate [--path PATH...] [--goal TEXT] [--run ID] [--limit 8] [--kind investigation|verification]
      (read-only matching context, file evidence and project recipes)
  cyc recipe list [--path PATH...] [--goal TEXT] [--run ID] [--kind investigation|verification]
  cyc recipe run --recipe ID [--run ID]
      (execute an applicable authorized recipe; retain diagnostic evidence)

Component context docs (docs/context/):
  cyc context prepare --run ID [--file CONTEXT.json]
  cyc context review [--run ID | --since YYYY-MM-DD | --all] [--write --update-run UPDATE_ID] [--new NAME]
      (map completed runs' changed files to component docs and propose the doc entry from each run's
       record: what changed, what was learned, the decisive check, files with hashes, date and run ID.
       Read-only without --write; --write appends the entries and refreshes INDEX.md)
  cyc context lint [--doc PATH]
      (check the doc layout rules and the index rows, including freshness against Git)
  cyc context measure --path PATH... [--run ID]
      (characters and estimated tokens of INDEX.md plus the matched docs, against every doc and the run records)

Execute through your existing AI host:
  cyc run start --goal TEXT --playbook feature [--criterion "done when..."]... [--scope PATH] [--session ID] [--scout FILE --plan TEXT]
  cyc run start --file START.json   (goal, playbook, criteria, allowedPaths, session, and optionally scout + plan to record Scout in the same call)
      (no verification.commands? start uses the project's declared test command and says which)
  Later run commands find the single active run themselves; pass --run ID (or --session) when several are active.
  cyc run next --run ID
  cyc run record --run ID --summary "What this stage established" [--assessment FILE] [--artifact PATH]... [--criteria-passed "evidence" | --criterion-evidence JSON] [--status failed|blocked]
  cyc run record --file HANDOFF.json   (full form)
  cyc run verify --run ID
  cyc run prove-red --run ID [--tests PATH...]
      (bug-fix/feature: new tests must fail on the run-start code; refactor: they must pass on it)
  cyc run finish --run ID --summary "Result and limits" --assessment FILE --criterion-evidence JSON [--artifact PATH]...
      (from build or verify: record build, prove new tests, verify, record verify and deliver, and complete;
       artifacts default to the files this run changed; run next gives the assessment template)
  cyc run finish --file FINISH.json   (summary, assessment, criterionEvidence; optional runId and artifacts)
      (versioned input uses canonical scenarioEvidence; needs-proof-review returns its bound continuation file)
  cyc run wait --run ID --operation ID --wait-ms 30000   (bounded progress; finish/verify/prove-red also accept --wait-ms)
  Start JSON: executionMode native-codex|native-claude|cursor|standalone, real conversationId, separate session label; optional frozen proofCommands.
  cyc run retry --run ID --stage build --reason "What changed in the approach"
  cyc run accept-failure --run ID --check CHECK_ID --reason "Why this pre-existing failure is unrelated"
  cyc run complete --run ID
  cyc run status --run ID
  cyc run recover --run ID   (read-only diagnosis and next action; preserves work and budgets)
  cyc run review --run ID   (refresh the shared developer/PR review artifact)
  cyc run review-capture --run ID --file CAPTURE.json   (reviewer, optional scope)
  cyc run review-record --run ID --file REVIEW.json   (reviewId, evidence, identity or null, findings)
  cyc run pause|resume|stop --run ID

Deliver the reply:
  cyc check-reply FILE [--session ID | --expanded]
      (the Stop gate's reply checks on a draft: character count, how much to cut, visual; reads nothing else and writes nothing.
       --session applies that conversation's limit off or expand state)
  cyc readiness --session ID [--since ISO_TIMESTAMP]
      (read-only controller status; uses hook request window, or an explicit diagnostic window)
  cyc packet --session ID --passed "criterion :: evidence"... [--unmet "criterion :: evidence"]... [--artifact PATH]... [--status blocked --blocker TEXT] [--advisory "why no controller run applies"] [--response FILE] --reviewed
      (writes the review packet and runs the delivery gate's checks; the Stop gate checks your final reply itself.
       Cursor needs --response, the exact reply, to find its session's packet)

Interactive init/install shows a short summary. Use --json for the complete structured result.
Piped output and --verbose retain JSON for automation and diagnostics.

All commands accept --project PATH. Criteria file: [{"id":"saved","description":"Survives reload"}].
Store handoff files under .cyc/runs/ID/ to avoid changing the source being verified.
New implementation runs require Scout, Verify, and Deliver assessments; run next lists required fields.
See docs/work-assessments.md for the compact JSON contract and knowledge lifecycle.
The host agent reads and executes the returned skill; CYC does not launch paid model calls.
Configure verification.commands in .cyc/config.json; without them, executable runs use the project's declared test command or are refused.
Hook activation/trust must be checked in your host; doctor does not certify it.`);
    process.exit(0);
  }
  let root = resolve(options.project ?? process.cwd());
  if (!options.project) {
    let cursor = root;
    while (true) {
      if (existsSync(resolve(cursor, '.cyc/config.json'))) { root = cursor; break; }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  // A missing --run means the single active run here; a record or finish file may name its run.
  if (command === 'run' && action !== 'start' && options.run === undefined && !(['record', 'finish'].includes(action) && options.file)) options.run = activeRun(root, options.session);
  let result;
  if (command === 'investigate' || command === 'recipe') {
    const tools = await import('../scripts/project-tools.mjs');
    const selection = { paths: options.path ?? [], goal: options.goal, run: options.run, ...(options.limit ? { limit: Number(options.limit) } : {}) };
    if (command === 'investigate') result = tools.investigateProject(root, { ...selection, kind: options.kind });
    else if (action === 'list') result = tools.listRecipes(root, { ...selection, all: !options.path && !options.goal && !options.run, kind: options.kind });
    else if (action === 'run') {
      if (options['dry-run']) throw new Error('Use recipe list to inspect without execution; recipe run does not accept --dry-run.');
      if (!options.recipe) throw new Error('--recipe is required.');
      result = await tools.runRecipe(root, options.recipe, { run: options.run });
      if (!options.verbose && result.results) result.results = result.results.map(({ id, command, args, passed, exitCode, error, errorCode, stdout, stderr }) => ({ id, command, args, passed, exitCode, error, errorCode, outputTail: `${stdout ?? ''}${stderr ?? ''}`.trim().split('\n').slice(-15).join('\n') }));
    } else throw new Error('Use recipe list or recipe run.');
  } else if (command === 'context') {
    const context = await import('../scripts/context-review.mjs');
    if (action === 'review') result = context.reviewContext(root, { run: options.run, since: options.since, all: !!options.all, write: !!options.write, newDoc: options.new, updateRun: options['update-run'] });
    else if (action === 'prepare') {
      if (!options.run) throw new Error('context prepare needs the exact --run ID.');
      result = prepareRunContext(root, options.run, options.file ? inputObject(options.file, ['records', 'summary', 'reason']) : {});
    }
    else if (action === 'lint') result = context.lintContext(root, { doc: options.doc });
    else if (action === 'measure') result = context.measureContext(root, { paths: options.path ?? [], run: options.run });
    else throw new Error('Use context prepare, context review, context lint, or context measure.');
  } else if (command === 'onboard') {
    result = (await import('../scripts/onboarding.mjs')).onboardProject(root, { verify: !!options.verify, host: options.host, session: options.session, token: options.token });
  } else if (['init', 'install', 'uninstall', 'doctor', 'activate'].includes(command)) {
    const installer = await import('../scripts/install.mjs');
    if (command === 'activate') result = await installer.activateProject(root, { dryRun: !!options['dry-run'] });
    else if (command === 'doctor') result = await installer.doctorProject(root);
    else if (command === 'uninstall') result = await installer.uninstallProject(root, { dryRun: !!options['dry-run'] });
    else result = await installer.installProject(root, { hosts: !options.hosts || options.hosts === 'auto' ? installer.detectHosts(root) : options.hosts.split(','), dryRun: !!options['dry-run'] });
  } else if (command === 'check-reply') {
    if (!action) throw new Error('check-reply needs the draft file: cyc check-reply .cyc/runtime/reply.md');
    const { checkReply } = await import('../scripts/response-gate.mjs');
    const { allowsLongResponse } = await import('../scripts/response-mode.mjs');
    let expanded = !!options.expanded;
    const execution = options.mode ? resolveExecution(root, { executionMode: options.mode, conversationId: options.conversation, session: options.session }) : null;
    if (options.session && execution?.mode !== 'standalone') {
      // The conversation's own setting decides the cap, as it does at Stop.
      const statePath = resolve(root, '.cyc/runtime', `${execution?.gateSession ?? options.session}.state.json`);
      if (!existsSync(statePath)) throw new Error(`No hook state for session ${options.session} at ${statePath}.`);
      expanded = allowsLongResponse(JSON.parse(readFileSync(statePath, 'utf8').replace(/^﻿/, '')));
    }
    const report = checkReply(readFileSync(resolve(root, action), 'utf8'), { expanded });
    result = { ok: report.issues.length === 0, file: action, ...report, ...(report.issues.length ? {} : { send: 'Send this text unchanged; the Stop gate counts the same way.' }) };
  } else if (command === 'readiness') {
    result = (await import('../scripts/run-gate.mjs')).sessionReadiness({ root, session: options.session, since: options.since });
  } else if (command === 'packet') {
    result = (await import('../scripts/packet.mjs')).writePacket(root, { session: options.session, executionMode: options.mode, conversationId: options.conversation, responseFile: options.response, status: options.status, blocker: options.blocker, advisory: options.advisory, passed: options.passed ?? [], unmet: options.unmet ?? [], artifacts: options.artifact ?? [], reviewed: !!options.reviewed });
  } else if (command === 'playbooks') result = catalog;
  else if (command === 'route') {
    if (!options.goal) throw new Error('--goal is required.');
    result = routeTask(options.goal);
  } else if (command === 'run') {
    switch (action) {
      case 'start': {
        let input;
        if (options.file) {
          fileOnly(options, ['file', 'project', 'verbose']);
          input = inputObject(options.file, ['goal', 'playbook', 'criteria', 'allowedPaths', 'session', 'scout', 'plan', 'evidenceVersion', 'requirements', 'reviewPolicy', 'executionMode', 'conversationId', 'proofCommands', 'contextRetention']);
          for (const key of ['goal', 'playbook', 'session', 'plan']) if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error(`${key} must be a string.`);
          if (input.scout !== undefined && !object(input.scout)) throw new Error('scout must be the Scout assessment object (run start without it returns the template).');
          if (input.criteria !== undefined && (!Array.isArray(input.criteria) || !input.criteria.length || input.criteria.some(item => !object(item) || typeof item.id !== 'string' || typeof item.description !== 'string'))) throw new Error('criteria must be a nonempty array of {id, description} string records.');
          if (input.allowedPaths !== undefined && (!Array.isArray(input.allowedPaths) || input.allowedPaths.some(p => typeof p !== 'string'))) throw new Error('allowedPaths must be an array of paths.');
        } else input = { goal: options.goal, playbook: options.playbook, criteria: options.criteria ? readJSON(options.criteria) : options.criterion ? options.criterion.map((description, index) => ({ id: `c${index + 1}`, description })) : undefined, allowedPaths: options.scope ?? [], session: options.session, scout: options.scout ? readJSON(options.scout) : undefined, plan: options.plan };
        // Without an explicit session, the run belongs to the calling conversation when the host names it.
        if (!options.file) { input.executionMode = options.mode; input.conversationId = options.conversation; }
        input.session ??= callerSession();
        result = startRun(root, input); break;
      }
      case 'next': result = nextRun(root, options.run); break;
      case 'status': result = readRun(root, options.run); break;
      case 'recover': result = recoverRun(root, options.run); break;
      case 'record': {
        if (!options.file && options.summary) {
          result = quickHandoff(root, options.run, { status: options.status, summary: options.summary, artifacts: options.artifact ?? [], passedEvidence: options['criteria-passed'], criterionEvidence: options['criterion-evidence'] ? parseJSON(options['criterion-evidence'], '--criterion-evidence') : undefined, nextAction: options.next, assessment: options.assessment ? readJSON(options.assessment) : undefined });
          break;
        }
        if (!options.file) throw new Error('Use --summary TEXT (quick form) or --file HANDOFF.json.');
        const packet = readJSON(options.file);
        if (options.run && packet.runId !== options.run) throw new Error('--run and handoff runId differ.');
        result = recordHandoff(root, packet); break;
      }
      case 'verify': result = options['wait-ms'] === undefined ? verifyRun(root, options.run) : startOperation(root, options.run, { action: 'verify', waitMs: Number(options['wait-ms']) }); break;
      case 'prove-red': result = options['wait-ms'] === undefined ? proveRun(root, options.run, { tests: options.tests }) : startOperation(root, options.run, { action: 'prove-red', input: { tests: options.tests }, waitMs: Number(options['wait-ms']) }); break;
      case 'wait': if (!options.operation) throw new Error('run wait needs --operation ID from the returned handle.'); result = waitOperation(root, options.run, options.operation, Number(options['wait-ms'] ?? 30000)); break;
      case 'finish': {
        let input;
        if (options.file) {
          fileOnly(options, ['file', 'project', 'verbose', 'run', 'session', 'wait-ms']);
          input = inputObject(options.file, ['runId', 'summary', 'artifacts', 'passedEvidence', 'criterionEvidence', 'assessment', 'acceptFailures', 'testProof', 'scenarioEvidence', 'continuation']);
          // A test proof exemption belongs to the verify assessment; agents also put it at the top
          // level, so it is moved there unless the assessment already has a different one.
          if ('testProof' in input) {
            if (input.assessment !== undefined && !object(input.assessment)) throw new Error('assessment must be an object.');
            if (input.assessment && 'testProof' in input.assessment && !isDeepStrictEqual(input.assessment.testProof, input.testProof)) throw new Error('testProof is given twice, at the top level and in assessment, with different values. Keep one.');
            input.assessment = { ...input.assessment, testProof: input.testProof };
            delete input.testProof;
          }
          if ((input.runId !== undefined && (typeof input.runId !== 'string' || !input.runId)) || typeof input.summary !== 'string' || !input.summary.trim()) throw new Error('Finish JSON needs a nonempty summary string (runId is optional when one run is active).');
          if (options.run && input.runId && options.run !== input.runId) throw new Error('--run and finish runId differ.');
          if (input.artifacts !== undefined && (!Array.isArray(input.artifacts) || input.artifacts.some(p => typeof p !== 'string' || !p))) throw new Error('artifacts must be an array of paths.');
          if (!object(input.assessment)) throw new Error('assessment must be an object.');
          if (input.criterionEvidence !== undefined && (!object(input.criterionEvidence) || Object.values(input.criterionEvidence).some(v => typeof v !== 'string' || !v.trim()))) throw new Error('criterionEvidence must map criterion IDs to evidence strings.');
          if (input.passedEvidence !== undefined && (typeof input.passedEvidence !== 'string' || !input.passedEvidence.trim())) throw new Error('passedEvidence must be a nonempty string.');
          artifactFiles(root, (input.artifacts ?? []).map(path => inputPath(root, path)));
          // finishRun checks evidence and assessments against the run before any test runs.
          options.run = options.run ?? input.runId ?? activeRun(root, options.session);
        } else input = { summary: options.summary, artifacts: options.artifact, passedEvidence: options['criteria-passed'], criterionEvidence: options['criterion-evidence'] ? parseJSON(options['criterion-evidence'], '--criterion-evidence') : undefined, assessment: options.assessment ? readJSON(options.assessment) : {} };
        result = options['wait-ms'] === undefined ? finishRun(root, options.run, input) : startOperation(root, options.run, { action: 'finish', input, waitMs: Number(options['wait-ms']) }); break;
      }
      case 'retry': result = retryRun(root, options.run, { stage: options.stage, reason: options.reason }); break;
      case 'accept-failure': result = acceptFailure(root, options.run, { check: options.check, reason: options.reason }); break;
      case 'complete': result = completeRun(root, options.run); break;
      case 'review': result = reviewRun(root, options.run); break;
      case 'review-capture':
        if (!options.file) throw new Error('review-capture needs --file JSON with reviewer and optional scope.');
        result = captureReview(root, options.run, inputObject(options.file, ['reviewer', 'scope', 'contextPaths', 'contextEvidence'])); break;
      case 'review-record':
        if (!options.file) throw new Error('review-record needs --file JSON with reviewId, evidence, identity and findings.');
        result = recordReview(root, options.run, inputObject(options.file, ['reviewId', 'evidence', 'identity', 'findings'])); break;
      case 'pause': case 'resume': case 'stop': result = controlRun(root, options.run, action); break;
      default: throw new Error('Unknown run action. Use cyc help.');
    }
  } else throw new Error(`Unknown command ${command}. Use cyc help.`);
  if (command === 'run' && !options.verbose) result = compact(action, result, root, options);
  console.log(humanInstallOutput(command) ? formatInstall(result) : JSON.stringify(result, null, 2));
  if (result?.ok === false || ['halted', 'exhausted', 'blocked'].includes(result?.status) || result?.passed === false || result?.result?.passed === false || ['halted', 'exhausted', 'blocked'].includes(result?.result?.status)) process.exitCode = 1;
} catch (error) {
  const result = { ok: false, error: error.message, ...(error.setup ? { setup: error.setup } : {}), ...(error.field ? { field: error.field, repairTemplate: error.repairTemplate } : {}) };
  console.error(humanInstallOutput(positionals[0]) ? formatInstall(result) : JSON.stringify(result));
  process.exitCode = 1;
}

function humanInstallOutput(command) {
  return process.stdout.isTTY && ['init', 'install'].includes(command) && !args.includes('--json') && !args.includes('--verbose');
}

function formatInstall(result) {
  // JSON escaped terminal controls in paths and diagnostics; keep them visible here too.
  const text = value => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const changes = result.changes ?? [];
  const counts = Object.fromEntries(['create', 'update', 'remove'].map(action => [action, changes.filter(c => c.action === action).length]));
  const title = !result.ok ? 'Installation stopped' : result.dryRun ? `CYC Stack ${version} — installation preview` : !changes.length ? `CYC Stack ${version} is up to date` : `CYC Stack ${version} installed`;
  const lines = [title, ''];
  if (result.projectRoot) lines.push(`Project: ${text(result.projectRoot)}`);
  if (result.hosts?.length) {
    const names = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' };
    lines.push(`Hosts: ${result.hosts.map(host => names[host] ?? text(host)).join(', ')}`);
  }
  if (result.ok) {
    if (result.dryRun) lines.push(counts.create || counts.update || counts.remove ? `Would create ${counts.create} files, update ${counts.update}, remove ${counts.remove}.` : 'No file changes planned.', 'No files changed.');
    else lines.push(changes.length ? `Files: ${[['create', 'created'], ['update', 'updated'], ['remove', 'removed']].filter(([action]) => counts[action]).map(([action, label]) => `${counts[action]} ${label}`).join(', ')}` : 'No file changes.');
  }
  if (result.error) lines.push('', text(result.error));
  if (result.conflicts?.length) lines.push('', 'Conflicts:', ...result.conflicts.map(c => `  - ${text(c.path)}: ${text(c.reason)}`));
  if (result.warnings?.length) {
    const heading = !result.ok ? 'Installer notes (changes described below are not confirmed):' : result.dryRun ? 'Preview notes (changes described below are planned only):' : 'Setup notes:';
    lines.push('', heading);
    const width = Math.max(40, Math.min(process.stdout.columns ?? 78, 100));
    for (const warning of result.warnings) {
      let line = '  -';
      for (const word of text(warning).split(/\s+/)) {
        if (line.length + word.length + 1 > width && line !== '  -') { lines.push(line); line = '   '; }
        line += ` ${word}`;
      }
      lines.push(line);
    }
  }
  if (result.ok) lines.push('', 'Next:', ...(result.dryRun ? ['  Rerun without --dry-run to apply this plan.'] : ['  Reload your AI host and review any hook-trust prompt.', '  In your AI chat, run:', '    /cyc Set up CYC for this project.']));
  return lines.join('\n');
}

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
// Hand-written JSON on Windows often has single backslashes in paths (C:\work), which JSON
// rejects. Retry once with only the invalid escapes doubled; valid escapes are left alone.
function parseJSON(source, label) {
  if (source.charCodeAt(0) === 0xFEFF) source = source.slice(1);
  try { return JSON.parse(source); } catch (error) {
    try { return JSON.parse(source.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\')); }
    catch { throw new Error(`${label}: ${error.message}`); }
  }
}
function readJSON(path) { return parseJSON(readFileSync(resolve(path), 'utf8'), path); }
function inputObject(path, keys) {
  const value = readJSON(path);
  if (!object(value)) throw new Error('Input JSON must be an object.');
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Unknown input field: ${key}`);
  return value;
}
function fileOnly(options, allowed) {
  const extra = Object.keys(options).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(`Do not mix --file with field arguments: ${extra.map(key => `--${key}`).join(', ')}.`);
}

// A check that also failed before the run is the agent's call: name it and the one way to accept
// it, rather than a generic retry that repeats the same failure until the run is exhausted.
function preexistingHint(ids) {
  return `${ids.join(', ')} also failed on the run-start code. If ${ids.length > 1 ? 'they are' : 'it is'} unrelated to this change, add "acceptFailures": [${ids.map(id => `{"check": "${id}", "reason": "<why it is unrelated>"}`).join(', ')}] to FINISH.json and run finish again; an accepted check is excused only while it fails as it did then. If this change caused it, fix it instead.`;
}

function compact(action, result, root, options) {
  if (!result || typeof result !== 'object' || ['status', 'recover'].includes(action)) return result;
  if (result.operationId) return result;
  const id = result.runId ?? result.id ?? options.run;
  if (['review-capture', 'review-record'].includes(action)) { const { files, ...receipt } = result; return receipt; }
  if (action === 'prove-red') return result;
  if (action === 'finish') return result.failedAt === 'verify' && 'verificationStatus' in result ? { ...compact('verify', result, root, options), finished: false, failedAt: 'verify' } : result;
  if (action === 'verify') {
    const recovery = result.passed ? null : recoverRun(root, id);
    return { runId: id, status: result.status, passed: result.passed, sourceStable: result.sourceStable, changedPaths: result.changedPaths, verificationStatus: result.verificationStatus, acceptedPreexistingFailures: result.acceptedPreexistingFailures, ...(result.acceptedFailuresThatChanged ? { acceptedFailuresThatChanged: result.acceptedFailuresThatChanged } : {}), ...(result.failedAtRunStart ? { failedAtRunStart: result.failedAtRunStart } : {}), ...(result.awaitingAcceptance ? { awaitingAcceptance: true } : {}),
      results: (result.results ?? []).map(item => ({ id: item.id, passed: item.passed, exitCode: item.exitCode, error: item.error, outputTail: `${item.stdout ?? ''}${item.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n') })),
      receiptPath: result.receiptPath, ...(recovery ? { recovery } : {}), hint: result.passed ? 'Record verify with --criterion-evidence (or --criteria-passed for a single criterion).'
        : result.awaitingAcceptance && result.status === 'running' ? preexistingHint(result.failedAtRunStart)
        : result.failedAtRunStart?.length && result.status === 'running' ? `${recovery.nextAction.instruction} Separately, ${result.failedAtRunStart.join(', ')} also failed on the run-start code; accept only if unrelated.`
        : recovery.nextAction.instruction };
  }
  if (!id) return result;
  const next = nextRun(root, id);
  const { previousHandoff, criteria, limits, assessmentRequired, assessmentTemplate, ...rest } = next;
  // Agents often read only the first lines (| head -40), so what they act on comes first and the
  // long fill-in template last.
  const lead = Object.fromEntries(['runId', 'status', 'stage', 'attempt', 'finishTemplate', 'verificationSource', 'verificationCommands', 'baseline', 'baselineFailures', 'testProof', 'finishWith', 'ledgerPath', 'feedback'].filter(key => key in rest).map(key => [key, rest[key]]));
  return { ...lead, criteria: criteria.map(item => item.id), previous: previousHandoff ? { stage: previousHandoff.stage, status: previousHandoff.status, summary: previousHandoff.summary } : null, ...rest, ...(result.acceptedFailures ? { acceptedFailures: result.acceptedFailures } : {}), ...(['paused', 'blocked', 'halted', 'exhausted', 'stopped'].includes(next.status) ? { recovery: recoverRun(root, id) } : {}), assessmentRequired, ...(rest.finishTemplate ? {} : { assessmentTemplate }) };
}
