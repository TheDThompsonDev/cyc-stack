import { randomUUID } from 'node:crypto';
import { digest } from './response-gate.mjs';
import { getPlaybook } from './catalog.mjs';
import { stopReason } from './run-gate.mjs';
import { strictObject, text } from './task-context.mjs';

// A work queue is an ordered set of units, each an ordinary run. The queue file holds the frozen
// units, the recorded decisions and a note of each run it admitted. How a unit ended is never
// stored: it is read from the runs bound to it. A note gives the order of admission and stands in
// for a run only when its record cannot be read. `io` comes from the controller (scripts/runtime.mjs).
// Reasoning and limits: docs/context/work-queue.md.
export const queueFolder = '.cyc/queues';
export function queuePath(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw Error('A valid --queue ID is required.');
  return `${queueFolder}/${id}/queue.json`;
}
const unitName = /^[a-z0-9][a-z0-9-]{0,39}$/, criterionName = /^[a-zA-Z0-9_-]+$/;
const named = (pattern, value) => typeof value === 'string' && pattern.test(value);
const within = (path, parent) => path === parent || path.startsWith(`${parent}/`);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// Statuses that end a run short of complete. `missing`: an admitted run whose record cannot be read.
const ended = ['halted', 'exhausted', 'stopped', 'missing'], open = ['running', 'paused', 'blocked'];
const clean = (items, label) => {
  if (!Array.isArray(items) || !items.length || new Set(items.map(item => item?.id)).size !== items.length || items.some(item => !named(criterionName, item?.id) || !text(item.description))) throw Error(`${label} must be a nonempty array of unique {id, description} records.`);
  return items.map(item => ({ id: item.id, description: item.description, ...(item.clauses === undefined ? {} : { clauses: clean(item.clauses, `${label} ${item.id} clauses`) }) }));
};
// Field order in a file is not part of what was agreed.
const sameCriteria = (a, b) => { try { return digest(JSON.stringify(clean(a, 'criteria'))) === digest(JSON.stringify(clean(b, 'criteria'))); } catch { return false; } };

export function queueDefinition(input, io) {
  strictObject(input, ['version', 'goal', 'requirements', 'units'], 'queue');
  if (input.version !== 1 || !text(input.goal) || !text(input.requirements)) throw Error('A queue needs version 1, a goal and the original requirements text.');
  if (!Array.isArray(input.units) || !input.units.length || input.units.length > 50) throw Error('A queue needs 1 to 50 units.');
  const seen = new Set();
  const units = input.units.map(unit => {
    strictObject(unit, ['id', 'outcome', 'playbook', 'criteria', 'paths', 'dependsOn'], 'queue unit');
    if (!named(unitName, unit.id) || seen.has(unit.id)) throw Error(`Unit ids must be unique lowercase names of letters, digits and dashes: ${JSON.stringify(unit.id)}`);
    if (['person', 'all'].includes(unit.id)) throw Error(`A unit cannot be named ${unit.id}: the queue board uses that name for who a message is for.`);
    seen.add(unit.id);
    if (!text(unit.outcome)) throw Error(`Unit ${unit.id} needs an outcome: what is true when it is done.`);
    if (!Array.isArray(unit.paths) || !unit.paths.length) throw Error(`Unit ${unit.id} needs paths: the files or folders its run may change.`);
    const dependsOn = unit.dependsOn ?? [];
    if (!Array.isArray(dependsOn) || dependsOn.some(id => typeof id !== 'string') || new Set(dependsOn).size !== dependsOn.length) throw Error(`Unit ${unit.id} dependsOn must list unique unit ids.`);
    return { id: unit.id, outcome: unit.outcome, playbook: getPlaybook(unit.playbook).id, criteria: clean(unit.criteria, `Unit ${unit.id} criteria`), paths: io.normalize(unit.paths), dependsOn };
  });
  for (const unit of units) for (const id of unit.dependsOn) if (!seen.has(id) || id === unit.id) throw Error(`Unit ${unit.id} depends on ${id === unit.id ? 'itself' : `${id}, which is not a unit of this queue`}.`);
  // A cycle would leave its units waiting on each other forever.
  const state = new Map();
  const visit = (unit, trail) => {
    if (state.get(unit.id) === 'done') return;
    if (state.get(unit.id) === 'open') throw Error(`Units depend on each other in a cycle: ${[...trail.slice(trail.indexOf(unit.id)), unit.id].join(' -> ')}.`);
    state.set(unit.id, 'open');
    for (const id of unit.dependsOn) visit(units.find(item => item.id === id), [...trail, unit.id]);
    state.set(unit.id, 'done');
  };
  for (const unit of units) visit(unit, []);
  return { goal: input.goal, requirements: input.requirements, units };
}

// The stored record, checked for shape only. Enough to cancel a queue whose units were edited.
function stored(io, id) {
  let queue;
  try { queue = io.read(id); } catch (error) { throw Error(error.code === 'ENOENT' ? `No queue ${id} in this project.` : `Queue ${id} cannot be read: ${error.message}`); }
  const entries = (list, check) => Array.isArray(list) && list.every(item => record(item) && check(item));
  if (!record(queue) || queue.schemaVersion !== 1 || queue.id !== id || !['open', 'cancelled'].includes(queue.status) || !record(queue.definition) || !Array.isArray(queue.definition.units)
    || !entries(queue.decisions, item => ['retry', 'skip', 'cancel'].includes(item.action)) || !entries(queue.started ?? [], item => typeof item.unit === 'string' && typeof item.runId === 'string')) throw Error(`Queue ${id} is not a version 1 queue record.`);
  return queue;
}
const editedNote = 'Its units no longer match what was agreed; criteria are not changed in place. Cancel it with queue decide --queue ID and create a new queue.';
const edited = (queue, detail = '') => Error(`Queue ${queue.id} was edited after it was created${detail}. ${queue.status === 'cancelled' ? 'It is cancelled and kept only as a record.' : editedNote}`);
function load(io, id) {
  const queue = stored(io, id);
  if (digest(JSON.stringify(queue.definition)) !== queue.definitionHash) throw edited(queue);
  return queue;
}

// Why a unit's run stopped. A run stopped after it was blocked or halted keeps that reason; a
// resume clears it.
function endReason(run) {
  if (run.status === 'missing') return `The record of run ${run.id} is missing or unreadable, so how it ended is unknown.`;
  const direct = stopReason(run);
  if (direct) return direct;
  const history = Array.isArray(run.history) ? run.history : [], stop = history.findLastIndex(item => item?.type === 'stop');
  for (let index = stop - 1; index >= 0 && history[index]?.type !== 'resume'; index--) {
    const earlier = ['blocked', 'guard-halt', 'exhausted'].includes(history[index]?.type) ? stopReason({ history: history.slice(0, index + 1) }) : null;
    if (earlier) return `Stopped after: ${earlier}`;
  }
  return `Run ${run.id} ended ${run.status}.`;
}

// Every unit's status, derived from the runs bound to it and the recorded decisions.
export function queueView(queue, runs) {
  const time = value => Date.parse(value) || 0;
  const mine = runs.filter(run => run.queue?.id === queue.id);
  const foreign = mine.find(run => run.queue.definitionHash !== queue.definitionHash);
  if (foreign) throw edited(queue, `: run ${foreign.id} was admitted under different units`);
  // The order of admission, from notes written under the project lock: it holds when the clock
  // steps back.
  const noted = new Map((queue.started ?? []).map((entry, index) => [entry.runId, index]));
  const seq = run => noted.get(run.id) ?? Number.MAX_SAFE_INTEGER;
  const admitted = (a, b) => seq(a) - seq(b) || time(a.startedAt) - time(b.startedAt);
  // A noted run whose record is gone still holds its place.
  for (const entry of queue.started ?? []) if (!mine.some(run => run.id === entry.runId)) mine.push({ id: entry.runId, status: 'missing', startedAt: entry.time, queue: { id: queue.id, unit: entry.unit, attempt: entry.attempt, definitionHash: queue.definitionHash } });
  mine.sort(admitted);
  const units = queue.definition.units.map(unit => {
    const attempts = mine.filter(run => run.queue.unit === unit.id).sort((a, b) => (a.queue.attempt ?? 0) - (b.queue.attempt ?? 0) || admitted(a, b));
    // A run that has not ended decides the unit, whichever attempt it is.
    const latest = attempts.findLast(run => open.includes(run.status)) ?? attempts.at(-1);
    // A decision speaks for a run as it stood, not for one that reads differently now.
    const decision = latest ? queue.decisions.findLast(item => item.unit === unit.id && item.afterRun === latest.id && item.afterStatus === latest.status) : undefined;
    let status = 'pending', reason;
    if (latest?.status === 'complete') status = 'done';
    else if (latest && ['running', 'paused'].includes(latest.status)) status = 'in-progress';
    else if (decision?.action === 'skip') status = 'skipped';
    else if (latest && decision?.action !== 'retry') { status = 'halted'; reason = endReason(latest); }
    return { id: unit.id, outcome: unit.outcome, playbook: unit.playbook, dependsOn: unit.dependsOn, status, ...(reason ? { reason } : {}), ...(decision ? { decision: { action: decision.action, reason: decision.reason } } : {}), latest: latest?.id ?? null,
      runs: attempts.map(run => ({ runId: run.id, status: run.status, stage: run.stages?.[run.stageIndex] ?? null, startedAt: run.startedAt ?? null })) };
  });
  for (const unit of units) {
    if (queue.status === 'cancelled' && unit.status !== 'done') { unit.status = 'cancelled'; continue; }
    if (unit.status !== 'pending') continue;
    const waitsOn = unit.dependsOn.filter(id => units.find(item => item.id === id).status !== 'done');
    unit.status = waitsOn.length ? 'waiting' : 'ready';
    if (waitsOn.length) unit.waitsOn = waitsOn;
  }
  const has = status => units.some(unit => unit.status === status);
  const line = queue.status === 'cancelled' ? 'cancelled' : has('halted') ? 'halted' : has('in-progress') ? 'in-progress' : units.every(unit => unit.status === 'done') ? 'complete' : has('ready') ? 'ready' : 'ended';
  // Where the line last stood: the unit that completed last, or where its first run started.
  const last = mine.findLast(run => run.status === 'complete' && record(run.queue.completed?.files)) ?? null;
  const first = last ? null : mine.find(run => record(run.initialSource?.files)) ?? null;
  const from = last ?? first;
  return { line, units, next: line === 'ready' ? units.find(unit => unit.status === 'ready').id : null, runs: mine,
    position: from ? { run: from.id, unit: from.queue.unit, event: last ? 'completed' : 'started', ...(last ? last.queue.completed : { hash: from.initialSource.hash, files: from.initialSource.files }) } : null,
    since: from ? mine.slice(mine.indexOf(from)).filter(run => run.status !== 'complete') : mine.filter(run => run.status !== 'complete'),
    lost: last ? [] : mine.slice(0, first ? mine.indexOf(first) : mine.length).filter(run => run.status === 'missing') };
}

// Files that differ from where the line last stood: left by an attempt that ended short of
// complete, or edited outside the line. A retry starts from them, so they are named.
function drift(view, source, paths) {
  const from = view.position;
  if ((!from || from.hash === source.hash) && !view.lost.length) return null;
  const changed = from ? [...new Set([...Object.keys(from.files), ...Object.keys(source.files)])].filter(path => from.files[path] !== source.files[path]).sort() : [];
  const outside = changed.filter(path => !paths.some(prefix => within(path, prefix)));
  return { sinceRun: from?.run ?? null, sinceUnit: from?.unit ?? null, since: from?.event ?? 'unknown', changed: changed.slice(0, 50), total: changed.length, outsideUnit: outside.slice(0, 50), outsideTotal: outside.length,
    unfinishedAttempts: view.since.map(run => ({ runId: run.id, unit: run.queue.unit, status: run.status })),
    ...(view.lost.length ? { lostRuns: view.lost.map(run => run.id), note: 'The record of an earlier run is missing, so where the line started is unknown and files that run changed may not be listed.' } : {}) };
}

function resolve(io, id) {
  if (id !== undefined) return load(io, id);
  const live = [], broken = [], finished = [];
  for (const item of io.list()) {
    try {
      if (stored(io, item).status === 'cancelled') continue;
      const queue = load(io, item);
      (queueView(queue, io.runs()).line === 'complete' ? finished : live).push(queue);
    } catch (error) { broken.push(`${item}: ${error.message}`); }
  }
  if (live.length === 1 && !broken.length) return live[0];
  const last = finished.sort((a, b) => a.createdAt < b.createdAt ? -1 : 1).at(-1);
  if (!live.length && !broken.length) throw Error(`No open queue in this project.${last ? ` The last one, ${last.id} (${last.definition.goal.slice(0, 60)}), is complete: add --queue ${last.id} to read it.` : ''} Create one with queue create --file QUEUE.json, or pass --queue ID for a finished one.`);
  throw Error(`${live.length > 1 ? `Several queues are open: ${live.map(queue => `${queue.id} (${queue.definition.goal.slice(0, 60)})`).join('; ')}. ` : ''}${broken.length ? `Unreadable: ${broken.join('; ')}. ` : ''}Pass --queue ID.`);
}

export function lineOf(io, id) {
  const queue = resolve(io, id);
  return { queue, view: queueView(queue, io.runs()) };
}

const summary = (queue, view) => ({ queueId: queue.id, goal: queue.definition.goal, line: view.line, done: view.units.filter(unit => unit.status === 'done').length, total: view.units.length });

export function createQueue(io, input) {
  const definition = queueDefinition(input, io);
  const queue = { schemaVersion: 1, id: randomUUID(), engineVersion: io.engineVersion, createdAt: new Date().toISOString(), createdBy: io.session ?? null, status: 'open', definition, definitionHash: digest(JSON.stringify(definition)), decisions: [], started: [] };
  io.write(queue.id, queue);
  return { ...statusOf(queue, io), created: true, nextAction: { action: 'next', command: `queue next --queue ${queue.id}` } };
}

function statusOf(queue, io) {
  const view = queueView(queue, io.runs());
  return { ...summary(queue, view), next: view.next, units: view.units.map(({ latest, ...unit }) => unit), decisions: queue.decisions,
    note: 'Status is read from each unit\'s runs. A done unit means its run completed; it does not certify the product, and nothing here was committed or published.' };
}
export const queueStatus = (io, { queue: id } = {}) => statusOf(resolve(io, id), io);

export function queueNext(io, { queue: id } = {}) {
  const queue = resolve(io, id), view = queueView(queue, io.runs()), head = summary(queue, view);
  const decide = `queue decide --queue ${queue.id} --file DECISION.json`;
  const paths = unit => io.normalize(queue.definition.units.find(item => item.id === unit).paths);
  if (view.line === 'halted') {
    const unit = view.units.find(item => item.status === 'halted'), run = unit.runs.find(item => item.runId === unit.latest);
    // What a retry would start from is shown before the decision.
    let changed;
    try { changed = drift(view, io.source(), paths(unit.id)); } catch (error) { changed = { error: error.message }; }
    return { ...head, halted: { unit: unit.id, runId: run.runId, status: run.status, reason: unit.reason }, drift: changed,
      nextAction: open.includes(run.status)
        ? { action: 'recover', command: `run recover --run ${run.runId}`, instruction: `Run ${run.runId} is ${run.status}, not ended. Resume and finish it, or stop it; a stopped run then needs a recorded decision. No other unit starts meanwhile.` }
        : { action: 'decide', command: decide, input: { version: 1, unit: unit.id, action: 'retry | skip', reason: '<why>' }, instruction: 'The line is halted. A person decides: retry starts this unit again from the files as they are now and keeps the earlier run listed; skip leaves units that depend on it waiting; {"version":1,"action":"cancel","reason":"..."} closes the queue. Show the user the reason and the files under drift, above all drift.outsideUnit, before they choose. Do not record a decision the user has not made.' } };
  }
  if (view.line === 'in-progress') { const unit = view.units.find(item => item.status === 'in-progress'); return { ...head, inProgress: { unit: unit.id, runId: unit.latest }, nextAction: { action: 'next', command: `run next --run ${unit.latest}` } }; }
  if (view.line !== 'ready') return { ...head, unfinished: view.units.filter(unit => unit.status !== 'done').map(unit => ({ unit: unit.id, status: unit.status, ...(unit.waitsOn ? { waitsOn: unit.waitsOn } : {}) })),
    nextAction: view.line === 'ended' ? { action: 'decide', command: decide, input: { version: 1, action: 'cancel', reason: '<why>' }, instruction: 'Nothing more can start: what remains was skipped or waits on a skipped unit. When the user agrees, cancel this queue and create a new one for what is left.' } : null };
  const unit = queue.definition.units.find(item => item.id === view.next), attempt = view.units.find(item => item.id === unit.id).runs.length + 1;
  const stages = getPlaybook(unit.playbook).stages;
  const template = `${queueFolder}/${queue.id}/start-${unit.id}-${attempt}.json`;
  // Written once: the agent adds Scout to it, so a later call must not replace its work.
  if (!io.exists(template)) io.put(template, { goal: unit.outcome, playbook: unit.playbook, ...(stages.includes('build') ? { evidenceVersion: 1, reviewPolicy: 'self-allowed', requirements: `${queue.definition.requirements}\n\nUnit ${unit.id}: ${unit.outcome}` } : {}), criteria: unit.criteria, allowedPaths: unit.paths, queue: { id: queue.id, unit: unit.id } });
  const records = unit.dependsOn.map(id => { const run = view.runs.findLast(item => item.queue.unit === id && item.status === 'complete'); return { unit: id, runId: run.id, changeRecord: run.changeRecord?.path ?? null }; });
  const first = stages[0] === 'scout'
    ? 'Scout this unit first: read the dependency change records and recheck every drifted file. Add scout and plan (and contextRetention for a playbook that builds) to the start file, narrow allowedPaths if less is needed, then start.'
    : `Read the dependency change records and recheck every drifted file. The ${unit.playbook} playbook starts with ${stages[0]}, not Scout: start the file as written, then record ${stages[0]} with run record.`;
  return { ...head, unit: { ...unit, position: queue.definition.units.indexOf(unit) + 1, attempt }, dependencies: records, drift: drift(view, io.source(), paths(unit.id)), startTemplate: template,
    nextAction: { action: 'start', command: `run start --file ${template}`, instruction: `${first} Criteria, playbook and the queue field stay as written; paths outside this unit need a new queue. Files under drift.outsideUnit changed outside this unit's paths: tell the user about them before building on them.` } };
}

// The start rules, checked before a run record exists.
export function bindUnit(io, binding, { playbook, criteria, inferredCriteria, allowedPaths }) {
  strictObject(binding, ['id', 'unit'], 'queue binding');
  const queue = load(io, binding.id), view = queueView(queue, io.runs());
  const unit = queue.definition.units.find(item => item.id === binding.unit), current = view.units.find(item => item.id === binding.unit);
  if (!unit) throw Error(`Queue ${queue.id} has no unit ${JSON.stringify(binding.unit)}.`);
  if (view.line === 'cancelled') throw Error(`Queue ${queue.id} was cancelled; its units no longer start.`);
  const busy = view.units.find(item => item.id !== unit.id && ['in-progress', 'halted'].includes(item.status));
  if (busy) throw Error(`Unit ${busy.id} is ${busy.status} (run ${busy.latest}). One unit runs at a time, and a halted unit needs a recorded decision before the line moves. See queue next --queue ${queue.id}.`);
  if (current.status !== 'ready') throw Error({ waiting: `Unit ${unit.id} waits on ${current.waitsOn?.join(', ')}; a unit starts only after every unit it depends on is done.`, 'in-progress': `Unit ${unit.id} already has run ${current.latest} in progress.`, done: `Unit ${unit.id} is done.`, skipped: `Unit ${unit.id} was skipped.`, halted: `Unit ${unit.id} is halted (run ${current.latest}: ${current.reason}). It starts again only after a recorded retry decision: queue decide --queue ${queue.id}.` }[current.status]);
  if (playbook !== unit.playbook) throw Error(`Unit ${unit.id} was agreed as a ${unit.playbook} run, not ${playbook}.`);
  if (inferredCriteria || !sameCriteria(criteria, unit.criteria)) throw Error(`The criteria differ from the ones agreed for unit ${unit.id}. Copy them from queue next; criteria are not changed in place.`);
  const ceiling = io.normalize(unit.paths), outside = allowedPaths.filter(path => !ceiling.some(prefix => within(path, prefix)));
  if (!allowedPaths.length || outside.length) throw Error(`Unit ${unit.id} may change only ${ceiling.join(', ')}. ${allowedPaths.length ? `Outside that: ${outside.join(', ')}.` : 'Name allowedPaths inside it.'} Paths beyond the unit need a new queue.`);
  return { binding: { id: queue.id, unit: unit.id, definitionHash: queue.definitionHash, attempt: current.runs.length + 1 }, drift: source => drift(view, source, ceiling) };
}

// A run is noted before its record is written, so a lost record still holds its unit's place. A
// start that fails takes the note back; if that fails too, the unit reads halted.
export function noteStart(io, binding, runId) {
  const queue = load(io, binding.id);
  (queue.started ??= []).push({ unit: binding.unit, runId, attempt: binding.attempt, time: new Date().toISOString(), by: io.session ?? null });
  io.write(queue.id, queue);
}
export function dropStart(io, binding, runId) {
  const queue = load(io, binding.id);
  queue.started = (queue.started ?? []).filter(entry => entry.runId !== runId);
  io.write(queue.id, queue);
}

export function decideQueue(io, { queue: id, ...input }) {
  strictObject(input, ['version', 'unit', 'action', 'reason'], 'queue decision');
  if (input.version !== 1 || !['retry', 'skip', 'cancel'].includes(input.action)) throw Error('A decision needs version 1 and action retry, skip or cancel.');
  if (!text(input.reason)) throw Error('A decision needs a reason.');
  const entry = { action: input.action, reason: input.reason, time: new Date().toISOString(), session: io.session ?? null };
  if (input.action === 'cancel') {
    if (input.unit !== undefined) throw Error('cancel closes the whole queue; it takes no unit.');
    // Cancel by ID works for an edited queue: it is the remedy.
    const queue = id === undefined ? resolve(io, id) : stored(io, id);
    if (queue.status === 'cancelled') throw Error(`Queue ${queue.id} is already cancelled.`);
    const active = io.runs().find(run => run.queue?.id === queue.id && open.includes(run.status));
    if (active) throw Error(`Run ${active.id} (unit ${active.queue.unit}) is ${active.status}. Finish or stop it before cancelling the queue.`);
    queue.status = 'cancelled';
    queue.decisions.push(entry);
    io.write(queue.id, queue);
    try { return { ...statusOf(load(io, queue.id), io), recorded: entry }; } catch { return { queueId: queue.id, line: 'cancelled', recorded: entry }; }
  }
  const queue = resolve(io, id), view = queueView(queue, io.runs());
  if (queue.status === 'cancelled') throw Error(`Queue ${queue.id} is already cancelled.`);
  const unit = view.units.find(item => item.id === input.unit), run = unit?.runs.find(item => item.runId === unit.latest);
  if (!unit) throw Error(`Queue ${queue.id} has no unit ${JSON.stringify(input.unit)}.`);
  if (unit.status !== 'halted') throw Error(`Unit ${unit.id} is ${unit.status}; only a halted unit takes a ${input.action} decision.`);
  if (!ended.includes(run.status)) throw Error(`Run ${run.runId} is ${run.status}, not ended. Resume and finish it, or stop it, before deciding.`);
  // The decision is about this run as it stands now.
  Object.assign(entry, { unit: unit.id, afterRun: run.runId, afterStatus: run.status });
  queue.decisions.push(entry);
  io.write(queue.id, queue);
  return { ...statusOf(queue, io), recorded: entry };
}

// For a bound run's results: where the line stands.
export function queueAdvice(io, binding) {
  try {
    const queue = load(io, binding.id), view = queueView(queue, io.runs()), unit = view.units.find(item => item.id === binding.unit);
    return { ...summary(queue, view), unit: binding.unit, unitStatus: unit?.status ?? 'unknown', next: view.next, command: `queue next --queue ${queue.id}` };
  } catch (error) { return { queueId: binding?.id, unit: binding?.unit, error: error.message }; }
}
