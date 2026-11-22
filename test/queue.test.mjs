import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { completeRun, controlRun, nextRun, queueCommand, quickHandoff, readRun, sourceSnapshot, startRun } from '../scripts/runtime.mjs';
import { changeFingerprint } from '../scripts/run-gate.mjs';

// The work queue: ordered units, each an ordinary run. These tests drive the real controller in
// temporary projects. Units here use the investigation playbook, which needs no checks or proof, so
// each case is about the queue's own rules; test/queue-journey.test.mjs runs feature units with
// real original-code proof.
process.env.CYC_BASELINE_MODE = 'off';
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/cyc.mjs');
const put = (root, name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content)); return path; };
const read = (root, name) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const runCount = root => existsSync(join(root, '.cyc/runs')) ? readdirSync(join(root, '.cyc/runs'), { withFileTypes: true }).filter(entry => entry.isDirectory()).length : 0;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-queue-'));
  t.after(() => { assert.ok(root.includes('cyc-queue-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', { schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'checks', command: process.execPath, args: ['-e', 'process.exit(0)'], timeoutMs: 5000 }] } });
  put(root, 'src/orders/list.txt', 'orders');
  put(root, 'src/export/csv.txt', 'csv');
  put(root, 'src/notes/readme.txt', 'notes');
  return root;
}
const unit = (id, extra = {}) => ({ id, outcome: `The ${id} behavior is explained.`, playbook: 'investigation', criteria: [{ id: 'explained', description: `The ${id} behavior is explained from the code.` }], paths: [`src/${id}`], dependsOn: [], ...extra });
// orders, then export (which needs orders), and notes, which depends on nothing.
const definition = (units = [unit('orders'), unit('export', { dependsOn: ['orders'] }), unit('notes')]) => ({ version: 1, goal: 'Explain how orders are exported.', requirements: 'Explain the order list, then the export, and the notes.', units });
const create = (root, input = definition()) => queueCommand(root, 'create', input);
const statuses = (root, queue) => Object.fromEntries(queueCommand(root, 'status', { queue }).units.map(item => [item.id, item.status]));
// What a bound start needs from the unit, as queue next writes it.
const startInput = (root, queue, id, extra = {}) => { const defined = read(root, `.cyc/queues/${queue}/queue.json`).definition.units.find(item => item.id === id); return { goal: defined.outcome, playbook: defined.playbook, criteria: defined.criteria, allowedPaths: defined.paths, queue: { id: queue, unit: id }, ...extra }; };
const begin = (root, queue, id, extra) => startRun(root, startInput(root, queue, id, extra)).runId;
function finishUnit(root, run) {
  quickHandoff(root, run, { summary: 'Read the code for this unit.' });
  quickHandoff(root, run, { summary: 'Explained the behavior from the code.', passedEvidence: 'Read the file this unit names.' });
  assert.equal(completeRun(root, run).status, 'complete');
}
function cyc(root, args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8' });
  return { status: result.status, data: JSON.parse(result.stdout || result.stderr) };
}

test('queue create stores the agreed units, and status shows which unit is ready and which waits', t => {
  const root = fixture(t);
  const file = put(root, '.cyc/runtime/QUEUE.json', definition());
  const created = cyc(root, ['queue', 'create', '--file', file]);
  assert.equal(created.status, 0, JSON.stringify(created.data));
  assert.equal(created.data.line, 'ready');
  assert.equal(created.data.next, 'orders');
  assert.deepEqual(created.data.units.map(item => [item.id, item.status, item.waitsOn ?? null]), [['orders', 'ready', null], ['export', 'waiting', ['orders']], ['notes', 'ready', null]]);
  const stored = read(root, `.cyc/queues/${created.data.queueId}/queue.json`);
  assert.deepEqual(stored.definition.units.map(item => item.id), ['orders', 'export', 'notes']);
  assert.equal(stored.status, 'open');
  assert.equal(readFileSync(join(root, '.cyc/queues/.gitignore'), 'utf8'), '*\n', 'queues stay local: the folder ignores itself');
  // With one open queue the ID may be left out; an unknown one is refused.
  assert.equal(cyc(root, ['queue', 'status']).data.queueId, created.data.queueId);
  assert.match(cyc(root, ['queue', 'status', '--queue', '00000000-0000-4000-8000-000000000000']).data.error, /No queue 00000000/);
  assert.match(cyc(root, ['queue', 'status', '--queue', '../../etc']).data.error, /valid --queue ID/);
});

test('queue create rejects what could never run as agreed, and writes nothing', t => {
  const root = fixture(t);
  const cases = [
    ['an unknown queue field', { ...definition(), owner: 'me' }, /Unknown queue field: owner/],
    ['an unknown unit field', definition([{ ...unit('orders'), priority: 1 }]), /Unknown queue unit field: priority/],
    ['a duplicate unit id', definition([unit('orders'), unit('orders')]), /unique lowercase names/],
    ['a unit id that is not a plain name', definition([unit('orders'), { ...unit('notes'), id: '../Notes' }]), /unique lowercase names/],
    ['a dependency on a missing unit', definition([unit('orders', { dependsOn: ['billing'] })]), /depends on billing, which is not a unit/],
    ['a unit that depends on itself', definition([unit('orders', { dependsOn: ['orders'] })]), /depends on itself/],
    ['a dependency cycle', definition([unit('orders', { dependsOn: ['notes'] }), unit('export', { dependsOn: ['orders'] }), unit('notes', { dependsOn: ['export'] })]), /cycle: orders -> notes -> export -> orders/],
    ['an unknown playbook', definition([unit('orders', { playbook: 'ship-it' })]), /Unknown playbook: ship-it/],
    ['a unit without paths', definition([unit('orders', { paths: [] })]), /needs paths/],
    ['a path that leaves the project', definition([unit('orders', { paths: ['../elsewhere'] })]), /leaves project/],
    ['criteria without a description', definition([unit('orders', { criteria: [{ id: 'explained' }] })]), /criteria must be a nonempty array/],
    ['no original requirements', { ...definition(), requirements: ' ' }, /original requirements text/],
    ['another version', { ...definition(), version: 2 }, /version 1/],
    ['no units', definition([]), /1 to 50 units/]
  ];
  for (const [label, input, expected] of cases) assert.throws(() => create(root, input), expected, label);
  assert.equal(existsSync(join(root, '.cyc/queues')), false, 'a refused queue leaves no file');
});

test('a queue whose units were edited after it was created is refused everywhere', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const path = `.cyc/queues/${queueId}/queue.json`, stored = read(root, path);
  stored.definition.units[0].criteria[0].description = 'Anything at all.';
  put(root, path, stored);
  for (const action of ['status', 'next']) assert.throws(() => queueCommand(root, action, { queue: queueId }), /edited after it was created/, action);
  for (const action of ['retry', 'skip']) assert.throws(() => queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action, reason: 'Move on.' }), /edited after it was created/, action);
  assert.throws(() => startRun(root, { ...startInput(root, queueId, 'orders'), criteria: stored.definition.units[0].criteria }), /edited after it was created/);
  assert.equal(runCount(root), 0);
});

test('queue files are controller bookkeeping: a queue write changes neither the source hash nor the Stop change check', t => {
  const root = fixture(t);
  const git = args => assert.equal(spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'F', GIT_AUTHOR_EMAIL: 'f@example.com', GIT_COMMITTER_NAME: 'F', GIT_COMMITTER_EMAIL: 'f@example.com' } }).status, 0);
  put(root, '.gitignore', '.cyc/runs/\n.cyc/runtime/\n');
  git(['init', '-q', '-b', 'main']); git(['add', '.']); git(['commit', '-q', '-m', 'Base']);
  const source = sourceSnapshot(root).hash, fingerprint = JSON.stringify(changeFingerprint(root));
  const { queueId } = create(root);
  queueCommand(root, 'next', { queue: queueId });
  const run = begin(root, queueId, 'orders');
  controlRun(root, run, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'skip', reason: 'Covered elsewhere.' });
  assert.ok(existsSync(join(root, `.cyc/queues/${queueId}/start-orders-1.json`)), 'the queue did write its files');
  assert.equal(sourceSnapshot(root).hash, source, 'queue files are not project source');
  assert.equal(JSON.stringify(changeFingerprint(root)), fingerprint, 'the Stop gate sees no project change');
  // The same comparison does notice a file that is project source.
  put(root, 'src/orders/new.txt', 'new');
  assert.notEqual(sourceSnapshot(root).hash, source);
  assert.notEqual(JSON.stringify(changeFingerprint(root)), fingerprint);
});

test('a bound run starts only for a ready unit, with the agreed playbook, criteria and paths', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const input = (id, extra) => startInput(root, queueId, id, extra);
  const refused = [
    ['a unit that waits on another', input('export'), /Unit export waits on orders/],
    ['a unit the queue does not have', input('orders', { queue: { id: queueId, unit: 'billing' } }), /has no unit "billing"/],
    ['a queue that does not exist', input('orders', { queue: { id: '00000000-0000-4000-8000-000000000000', unit: 'orders' } }), /No queue 00000000/],
    ['an unknown binding field', input('orders', { queue: { id: queueId, unit: 'orders', force: true } }), /Unknown queue binding field: force/],
    ['another playbook', input('orders', { playbook: 'review' }), /agreed as a investigation run, not review/],
    ['changed criteria', input('orders', { criteria: [{ id: 'explained', description: 'Something easier.' }] }), /criteria differ from the ones agreed/],
    ['an added criterion', input('orders', { criteria: [...input('orders').criteria, { id: 'extra', description: 'More.' }] }), /criteria differ from the ones agreed/],
    ['criteria left to be inferred', input('orders', { criteria: undefined }), /criteria differ from the ones agreed/],
    ['a path outside the unit', input('orders', { allowedPaths: ['src/orders', 'src/export'] }), /may change only src\/orders\. Outside that: src\/export/],
    ['a broader path than the unit', input('orders', { allowedPaths: ['src'] }), /may change only src\/orders/],
    ['no paths, which would allow the whole project', input('orders', { allowedPaths: [] }), /Name allowedPaths inside it/]
  ];
  for (const [label, start, expected] of refused) assert.throws(() => startRun(root, start), expected, label);
  assert.equal(runCount(root), 0, 'a refused start leaves no run record');

  // Accepted: a narrower path, and the same criteria written with their fields in another order.
  put(root, 'src/orders/deep/a.txt', 'a');
  const run = startRun(root, input('orders', { allowedPaths: ['src/orders/deep'], criteria: [{ description: 'The orders behavior is explained from the code.', id: 'explained' }] })).runId;
  assert.deepEqual(readRun(root, run).queue, { id: queueId, unit: 'orders', definitionHash: read(root, `.cyc/queues/${queueId}/queue.json`).definitionHash, attempt: 1, drift: null });
  assert.equal(statuses(root, queueId).orders, 'in-progress');
  // One unit at a time: notes depends on nothing, and still waits for the line.
  assert.throws(() => startRun(root, input('notes')), /Unit orders is in-progress \(run [a-f0-9-]+\)\. One unit runs at a time/);
  assert.throws(() => startRun(root, input('orders')), /already has run [a-f0-9-]+ in progress/);
  assert.equal(runCount(root), 1);
  finishUnit(root, run);
  assert.deepEqual(statuses(root, queueId), { orders: 'done', export: 'ready', notes: 'ready' });
  assert.throws(() => startRun(root, input('orders')), /Unit orders is done/);
});

test('a start without a queue binding is the same run as before', t => {
  const root = fixture(t);
  create(root);
  const id = startRun(root, { goal: 'Explain the notes.', playbook: 'investigation', criteria: [{ id: 'c1', description: 'Explained.' }], allowedPaths: ['src/notes'] }).runId;
  assert.equal('queue' in readRun(root, id), false);
  // An unbound run is not a unit: the line does not see it, and it carries no queue advice.
  assert.equal(queueCommand(root, 'status').line, 'ready');
  const next = cyc(root, ['run', 'next', '--run', id]);
  assert.equal(next.status, 0, JSON.stringify(next.data));
  assert.equal('queue' in next.data, false);
  finishUnit(root, id);
  assert.equal('queue' in readRun(root, id), false);
  assert.match(cyc(root, ['run', 'next', '--run', id, '--queue', 'x']).data.error, /--queue is only supported by the queue command/);
});

test('queue next hands over the ready unit with its start file, its dependencies\' records and what changed outside the line', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const first = cyc(root, ['queue', 'next']);
  assert.equal(first.status, 0, JSON.stringify(first.data));
  assert.deepEqual([first.data.unit.id, first.data.unit.position, first.data.unit.attempt, first.data.total], ['orders', 1, 1, 3]);
  assert.deepEqual(first.data.dependencies, []);
  assert.equal(first.data.drift, null);
  assert.equal(first.data.startTemplate, `.cyc/queues/${queueId}/start-orders-1.json`);
  assert.equal(first.data.nextAction.command, `run start --file .cyc/queues/${queueId}/start-orders-1.json`);
  assert.deepEqual(read(root, first.data.startTemplate), { goal: 'The orders behavior is explained.', playbook: 'investigation', criteria: [{ id: 'explained', description: 'The orders behavior is explained from the code.' }], allowedPaths: ['src/orders'], queue: { id: queueId, unit: 'orders' } });
  // The agent adds to the start file; asking again must not replace its work.
  put(root, first.data.startTemplate, { ...read(root, first.data.startTemplate), plan: 'Read the list first.' });
  cyc(root, ['queue', 'next']);
  assert.equal(read(root, first.data.startTemplate).plan, 'Read the list first.');
  // The written start file is accepted by run start as it stands.
  const started = cyc(root, ['run', 'start', '--file', join(root, first.data.startTemplate)]);
  assert.equal(started.status, 0, JSON.stringify(started.data));
  assert.equal(started.data.queue.unit, 'orders');
  assert.deepEqual(cyc(root, ['queue', 'next']).data.inProgress, { unit: 'orders', runId: started.data.runId });
  finishUnit(root, started.data.runId);

  // Someone edits the project between units: the next unit is told which files moved.
  put(root, 'src/export/csv.txt', 'csv, edited by hand');
  put(root, 'src/export/added.txt', 'new');
  put(root, 'src/notes/readme.txt', 'notes, edited by hand');
  const second = queueCommand(root, 'next', { queue: queueId });
  assert.equal(second.unit.id, 'export');
  assert.deepEqual(second.dependencies, [{ unit: 'orders', runId: started.data.runId, changeRecord: null }]);
  // Every changed file is named, and the ones this unit's own run may not change are named apart.
  assert.deepEqual(second.drift, { sinceRun: started.data.runId, sinceUnit: 'orders', since: 'completed', changed: ['src/export/added.txt', 'src/export/csv.txt', 'src/notes/readme.txt'], total: 3, outsideUnit: ['src/notes/readme.txt'], outsideTotal: 1, unfinishedAttempts: [] });
  const run = begin(root, queueId, 'export');
  assert.deepEqual(readRun(root, run).queue.drift, second.drift, 'the run records the drift it started with');
  finishUnit(root, run);
  // With nothing edited in between, there is no drift to report.
  assert.equal(queueCommand(root, 'next', { queue: queueId }).drift, null);
  finishUnit(root, begin(root, queueId, 'notes'));
  const done = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([done.line, done.done, done.total, done.nextAction], ['complete', 3, 3, null]);
  assert.match(cyc(root, ['queue', 'next']).data.error, /No open queue/, 'a finished queue is no longer the open one');
  assert.equal(cyc(root, ['queue', 'status', '--queue', queueId]).data.line, 'complete');
});

test('a unit whose run ended short of complete halts the line until a person decides', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  // The run changes a file outside its unit: the controller's own scope guard halts it.
  put(root, 'src/notes/readme.txt', 'changed by the orders run');
  quickHandoff(root, run, { summary: 'Read the code for this unit.' });
  assert.equal(readRun(root, run).status, 'halted');
  const next = queueCommand(root, 'next', { queue: queueId });
  assert.equal(next.line, 'halted');
  assert.deepEqual([next.halted.unit, next.halted.runId, next.halted.status], ['orders', run, 'halted']);
  assert.match(next.halted.reason, /Files: src\/notes\/readme\.txt/, 'the reason is the one the run recorded');
  assert.equal(next.nextAction.action, 'decide');
  assert.equal('unit' in next, false, 'no unit is offered while the line is halted');
  // notes depends on nothing and is still refused; so is starting the halted unit again.
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is halted \(run [a-f0-9-]+\)\. One unit runs at a time, and a halted unit needs a recorded decision/);
  assert.throws(() => begin(root, queueId, 'orders'), /Unit orders is halted .* only after a recorded retry decision/);
  assert.equal(runCount(root), 1);
});

test('a blocked run halts the line too, and takes no decision until it has ended', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  quickHandoff(root, run, { status: 'blocked', summary: 'The order list needs credentials I do not have.' });
  const next = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([next.line, next.halted.status, next.nextAction.action], ['halted', 'blocked', 'recover']);
  assert.match(next.halted.reason, /credentials I do not have/);
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is halted/);
  for (const action of ['retry', 'skip']) assert.throws(() => queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action, reason: 'Move on.' }), /is blocked, not ended\. Resume and finish it, or stop it/, action);
  assert.throws(() => queueCommand(root, 'decide', { queue: queueId, version: 1, action: 'cancel', reason: 'Stop the line.' }), /is blocked\. Finish or stop it before cancelling/);
  // Resumed and finished, the same run completes its unit and the line moves on by itself.
  controlRun(root, run, 'resume');
  finishUnit(root, run);
  assert.deepEqual(statuses(root, queueId), { orders: 'done', export: 'ready', notes: 'ready' });
});

test('retry, skip and cancel are recorded with a reason, and nothing else moves a halted line', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const decide = input => queueCommand(root, 'decide', { queue: queueId, version: 1, ...input });
  assert.throws(() => decide({ unit: 'orders', action: 'retry', reason: 'Try again.' }), /Unit orders is ready; only a halted unit takes a retry decision/);
  const first = begin(root, queueId, 'orders');
  assert.throws(() => decide({ unit: 'orders', action: 'skip', reason: 'Skip it.' }), /Unit orders is in-progress; only a halted unit/);
  controlRun(root, first, 'stop');
  assert.equal(queueCommand(root, 'next', { queue: queueId }).halted.reason, `Run ${first} ended stopped.`);
  for (const [label, input, expected] of [
    ['no reason', { unit: 'orders', action: 'retry' }, /needs a reason/],
    ['an empty reason', { unit: 'orders', action: 'skip', reason: '  ' }, /needs a reason/],
    ['an unknown action', { unit: 'orders', action: 'force', reason: 'Go.' }, /action retry, skip or cancel/],
    ['an unknown field', { unit: 'orders', action: 'retry', reason: 'Go.', afterRun: first }, /Unknown queue decision field: afterRun/],
    ['a unit the queue does not have', { unit: 'billing', action: 'retry', reason: 'Go.' }, /has no unit "billing"/],
    ['a unit that is not halted', { unit: 'notes', action: 'skip', reason: 'Go.' }, /Unit notes is ready; only a halted unit/],
    ['cancel with a unit', { unit: 'orders', action: 'cancel', reason: 'Go.' }, /cancel closes the whole queue/]
  ]) assert.throws(() => decide(input), expected, label);
  assert.deepEqual(read(root, `.cyc/queues/${queueId}/queue.json`).decisions, [], 'a refused decision is not recorded');

  // Retry: the unit may start again, and the stopped run stays listed under it.
  const file = put(root, '.cyc/runtime/DECISION.json', { version: 1, unit: 'orders', action: 'retry', reason: 'The stop was a mistake.' });
  const retried = cyc(root, ['queue', 'decide', '--queue', queueId, '--file', file]);
  assert.equal(retried.status, 0, JSON.stringify(retried.data));
  assert.deepEqual([retried.data.recorded.action, retried.data.recorded.unit, retried.data.recorded.afterRun, retried.data.recorded.reason], ['retry', 'orders', first, 'The stop was a mistake.']);
  assert.equal(retried.data.line, 'ready');
  const offered = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([offered.unit.id, offered.unit.attempt, offered.startTemplate], ['orders', 2, `.cyc/queues/${queueId}/start-orders-2.json`]);
  const second = begin(root, queueId, 'orders');
  assert.equal(readRun(root, second).queue.attempt, 2);
  assert.deepEqual(queueCommand(root, 'status', { queue: queueId }).units[0].runs.map(item => [item.runId, item.status]), [[first, 'stopped'], [second, 'running']]);
  assert.equal(readRun(root, first).status, 'stopped', 'the earlier run is untouched');
  // The retry decision belonged to the first run; it does not excuse the second.
  controlRun(root, second, 'stop');
  assert.equal(statuses(root, queueId).orders, 'halted');
  assert.throws(() => begin(root, queueId, 'orders'), /only after a recorded retry decision/);

  // Skip: the unit is passed over, and what depends on it keeps waiting.
  const skipped = decide({ unit: 'orders', action: 'skip', reason: 'The order list is being replaced.' });
  assert.deepEqual(Object.fromEntries(skipped.units.map(item => [item.id, item.status])), { orders: 'skipped', export: 'waiting', notes: 'ready' });
  assert.throws(() => begin(root, queueId, 'export'), /Unit export waits on orders/);
  finishUnit(root, begin(root, queueId, 'notes'));
  const ended = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([ended.line, ended.unfinished], ['ended', [{ unit: 'orders', status: 'skipped' }, { unit: 'export', status: 'waiting', waitsOn: ['orders'] }]]);
  // Nothing more can start, so the only move left is offered: cancel, once the user agrees.
  assert.deepEqual([ended.nextAction.action, ended.nextAction.input], ['decide', { version: 1, action: 'cancel', reason: '<why>' }]);

  // Cancel: the queue is closed, and nothing starts or is decided afterwards.
  const cancelled = decide({ action: 'cancel', reason: 'Replanning the export.' });
  assert.deepEqual(Object.fromEntries(cancelled.units.map(item => [item.id, item.status])), { orders: 'cancelled', export: 'cancelled', notes: 'done' });
  assert.throws(() => begin(root, queueId, 'export'), /was cancelled; its units no longer start/);
  assert.throws(() => decide({ action: 'cancel', reason: 'Again.' }), /already cancelled/);
  assert.deepEqual(read(root, `.cyc/queues/${queueId}/queue.json`).decisions.map(item => [item.action, item.unit ?? null, item.afterRun ?? null]), [['retry', 'orders', first], ['skip', 'orders', second], ['cancel', null, null]]);
});

test('a bound run says where the line stands, without changing its own result', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  const next = cyc(root, ['run', 'next', '--run', run]);
  assert.equal(next.status, 0, JSON.stringify(next.data));
  assert.deepEqual(next.data.queue, { queueId, goal: 'Explain how orders are exported.', line: 'in-progress', done: 0, total: 3, unit: 'orders', unitStatus: 'in-progress', next: null, command: `queue next --queue ${queueId}` });
  // The advice is added to the same result an unbound run would give.
  const { queue, ...rest } = next.data;
  const plain = nextRun(root, run);
  assert.deepEqual([rest.runId, rest.status, rest.stage, rest.nextAction], [plain.runId, plain.status, plain.stage, plain.nextAction]);
  quickHandoff(root, run, { summary: 'Read the code for this unit.' });
  quickHandoff(root, run, { summary: 'Explained the behavior from the code.', passedEvidence: 'Read the file this unit names.' });
  const completed = cyc(root, ['run', 'complete', '--run', run]);
  assert.equal(completed.status, 0, JSON.stringify(completed.data));
  assert.deepEqual([completed.data.status, completed.data.queue.unitStatus, completed.data.queue.done, completed.data.queue.line, completed.data.queue.next], ['complete', 'done', 1, 'ready', 'export']);
  // A queue that can no longer be read costs the run only its advice.
  rmSync(join(root, `.cyc/queues/${queueId}/queue.json`));
  const orphan = cyc(root, ['run', 'next', '--run', run]);
  assert.equal(orphan.status, 0, JSON.stringify(orphan.data));
  assert.deepEqual([orphan.data.status, orphan.data.queue.unit], ['complete', 'orders']);
  assert.match(orphan.data.queue.error, /No queue/);
});

test('the queue command takes strict input', t => {
  const root = fixture(t);
  const file = put(root, '.cyc/runtime/QUEUE.json', definition());
  assert.match(cyc(root, ['queue', 'create']).data.error, /queue create needs --file JSON/);
  assert.match(cyc(root, ['queue', 'status', '--file', file]).data.error, /queue status takes no --file/);
  assert.match(cyc(root, ['queue', 'create', '--file', file, '--queue', 'x']).data.error, /assigns the queue ID/);
  assert.match(cyc(root, ['queue', 'run']).data.error, /Use queue create, status, next or decide/);
  assert.match(cyc(root, ['queue', 'next', '--reason', 'x']).data.error, /Do not mix --file with field arguments: --reason/);
  const { queueId } = cyc(root, ['queue', 'create', '--file', file]).data;
  const decision = put(root, '.cyc/runtime/DECISION.json', { version: 1, action: 'cancel', reason: 'Not needed.', queue: queueId });
  assert.match(cyc(root, ['queue', 'decide', '--file', decision]).data.error, /Unknown input field: queue/);
  // Two open queues: the ID is required, and each is named.
  cyc(root, ['queue', 'create', '--file', file]);
  assert.match(cyc(root, ['queue', 'next']).data.error, /Several queues are open: .*Pass --queue ID/);
  assert.equal(cyc(root, ['queue', 'next', '--queue', queueId]).data.unit.id, 'orders');
});

// The cases below were each demonstrated against the first candidate by an independent review.

test('a unit\'s latest attempt is decided by its attempt number, not by the clock', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const first = begin(root, queueId, 'orders');
  controlRun(root, first, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'Try again.' });
  const second = begin(root, queueId, 'orders');
  // The clock stepped back before the second attempt started: it now looks older than the first.
  const path = `.cyc/runs/${second}/state.json`, state = read(root, path);
  put(root, path, { ...state, startedAt: new Date(Date.parse(read(root, `.cyc/runs/${first}/state.json`).startedAt) - 600000).toISOString() });
  assert.equal(statuses(root, queueId).orders, 'in-progress', 'the running second attempt decides the unit');
  assert.deepEqual(queueCommand(root, 'next', { queue: queueId }).inProgress, { unit: 'orders', runId: second });
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is in-progress/);
  assert.throws(() => begin(root, queueId, 'orders'), /already has run [a-f0-9-]+ in progress/);
});

test('an exhausted run halts the line, a paused run keeps its unit in progress, and a stopped run keeps the reason it was blocked for', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  controlRun(root, run, 'pause');
  assert.equal(statuses(root, queueId).orders, 'in-progress');
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is in-progress/);
  controlRun(root, run, 'resume');
  for (let attempt = 0; attempt < 5 && readRun(root, run).status === 'running'; attempt++) quickHandoff(root, run, { status: 'failed', summary: 'The order list could not be read.' });
  assert.equal(readRun(root, run).status, 'exhausted');
  const halted = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([halted.line, halted.halted.unit, halted.halted.status, halted.nextAction.action], ['halted', 'orders', 'exhausted', 'decide']);
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is halted/);

  const other = fixture(t);
  const queue = create(other).queueId, blocked = begin(other, queue, 'orders');
  quickHandoff(other, blocked, { status: 'blocked', summary: 'The order list needs credentials I do not have.' });
  controlRun(other, blocked, 'stop');
  assert.equal(queueCommand(other, 'next', { queue }).halted.reason, 'Stopped after: The order list needs credentials I do not have.');
});

test('paths are compared whole, clauses are part of the criteria, and ids must be plain strings', t => {
  const root = fixture(t);
  put(root, 'src/orders-extra/a.txt', 'a');
  const clauses = [{ id: 'explained', description: 'The orders behavior is explained from the code.', clauses: [{ id: 'paging', description: 'Paging is covered.' }] }];
  const { queueId } = create(root, definition([unit('orders', { criteria: clauses }), unit('notes')]));
  const input = extra => startInput(root, queueId, 'orders', extra);
  assert.throws(() => startRun(root, input({ allowedPaths: ['src/orders-extra'] })), /may change only src\/orders\. Outside that: src\/orders-extra/);
  assert.throws(() => startRun(root, input({ criteria: [{ ...clauses[0], clauses: [{ id: 'paging', description: 'Paging is optional.' }] }] })), /criteria differ from the ones agreed/);
  assert.throws(() => startRun(root, input({ criteria: [{ id: 'explained', description: clauses[0].description }] })), /criteria differ from the ones agreed/);
  assert.equal(runCount(root), 0);
  assert.equal(readRun(root, startRun(root, input()).runId).queue.unit, 'orders');

  for (const [label, units, expected] of [
    ['an array as a unit id', [{ ...unit('orders'), id: ['orders'] }, { ...unit('notes'), id: ['orders'] }], /unique lowercase names/],
    ['a number as a unit id', [{ ...unit('orders'), id: 5 }], /unique lowercase names/],
    ['a number as a criterion id', [unit('orders', { criteria: [{ id: 1, description: 'Explained.' }] })], /criteria must be a nonempty array/],
    ['a number as a clause id', [unit('orders', { criteria: [{ id: 'c', description: 'Explained.', clauses: [{ id: 2, description: 'Part.' }] }] })], /clauses must be a nonempty array/],
    ['fifty-one units', Array.from({ length: 51 }, (_, index) => unit(`u${index}`, { paths: ['src/orders'] })), /1 to 50 units/]
  ]) assert.throws(() => create(root, definition(units)), expected, label);
  assert.equal(create(root, definition(Array.from({ length: 50 }, (_, index) => unit(`u${index}`, { paths: ['src/orders'] })))).total, 50);
});

test('a bound run whose record is lost still holds its unit, and a run without the queue\'s note is still found', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  const queuePath = `.cyc/queues/${queueId}/queue.json`;
  assert.deepEqual(read(root, queuePath).started.map(item => [item.unit, item.runId, item.attempt]), [['orders', run, 1]]);
  // The run's own state is the authority: with the queue's note of it gone, the run is still seen.
  put(root, queuePath, { ...read(root, queuePath), started: [] });
  assert.equal(statuses(root, queueId).orders, 'in-progress');
  put(root, queuePath, { ...read(root, queuePath), started: [{ unit: 'orders', runId: run, attempt: 1, time: new Date().toISOString() }] });
  controlRun(root, run, 'stop');
  assert.equal(statuses(root, queueId).orders, 'halted');
  // The halted run's record becomes unreadable, then disappears: the unit must not turn ready.
  for (const lose of [() => writeFileSync(join(root, `.cyc/runs/${run}/state.json`), '{"status":'), () => rmSync(join(root, `.cyc/runs/${run}`), { recursive: true, force: true })]) {
    lose();
    const next = queueCommand(root, 'next', { queue: queueId });
    assert.deepEqual([next.line, next.halted.unit, next.halted.runId, next.halted.status], ['halted', 'orders', run, 'missing']);
    assert.match(next.halted.reason, /missing or unreadable, so how it ended is unknown/);
    assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is halted/);
  }
  // A person can still decide about it, and the decision names the lost run.
  const decided = queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'skip', reason: 'Its record was lost.' });
  assert.deepEqual([decided.recorded.afterRun, decided.units[0].status], [run, 'skipped']);
});

test('a queue file that is not a queue record is named as such, never dropped or crashed on', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  const path = `.cyc/queues/${queueId}/queue.json`, stored = read(root, path);
  for (const [label, broken] of [['no definition', (({ definition, ...rest }) => rest)(stored)], ['a decision that is not a record', { ...stored, decisions: [null] }], ['an unknown status', { ...stored, status: 'paused' }], ['an array', []]]) {
    put(root, path, broken);
    assert.throws(() => queueCommand(root, 'status', { queue: queueId }), /is not a version 1 queue record/, label);
    assert.throws(() => queueCommand(root, 'status'), new RegExp(`Unreadable: ${queueId}: .*not a version 1 queue record.*Pass --queue ID`), `${label}: named when no ID is given`);
    assert.match(cyc(root, ['run', 'next', '--run', run]).data.queue.error, /not a version 1 queue record/, `${label}: the run keeps its result`);
  }
  // Units and their hash rewritten together: the run admitted under the old units gives it away.
  const units = structuredClone(stored.definition);
  units.units[1].criteria[0].description = 'Anything at all.';
  put(root, path, { ...stored, definition: units, definitionHash: createHash('sha256').update(JSON.stringify(units)).digest('hex') });
  assert.throws(() => queueCommand(root, 'status', { queue: queueId }), new RegExp(`edited after it was created: run ${run} was admitted under different units`));
  put(root, path, stored);
  assert.equal(statuses(root, queueId).orders, 'in-progress');
});

test('a retry starts from what the halted attempt left, and says so', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const first = begin(root, queueId, 'orders');
  put(root, 'src/notes/readme.txt', 'changed by the orders run');
  put(root, 'src/orders/list.txt', 'half-finished');
  quickHandoff(root, first, { summary: 'Read the code for this unit.' });
  assert.equal(readRun(root, first).status, 'halted');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'The notes edit is wanted.' });
  const expected = { sinceRun: first, sinceUnit: 'orders', since: 'started', changed: ['src/notes/readme.txt', 'src/orders/list.txt'], total: 2, outsideUnit: ['src/notes/readme.txt'], outsideTotal: 1, unfinishedAttempts: [{ runId: first, unit: 'orders', status: 'halted' }] };
  const next = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual(next.drift, expected, 'the file outside the unit is named before the retry starts');
  assert.match(next.nextAction.instruction, /drift\.outsideUnit .* tell the user about them/);
  const second = begin(root, queueId, 'orders');
  assert.deepEqual(readRun(root, second).queue.drift, expected, 'and the retry records what it started from');
});

test('queue next tells a unit how its own playbook starts', t => {
  const root = fixture(t);
  const { queueId } = create(root, definition([unit('orders', { playbook: 'plan' }), unit('notes')]));
  const planned = queueCommand(root, 'next', { queue: queueId });
  assert.match(planned.nextAction.instruction, /The plan playbook starts with frame, not Scout: start the file as written, then record frame with run record/);
  assert.doesNotMatch(planned.nextAction.instruction, /Add scout and plan/);
  const started = cyc(root, ['run', 'start', '--file', join(root, planned.startTemplate)]);
  assert.deepEqual([started.status, started.data.stage, started.data.queue.unit], [0, 'frame', 'orders']);
  controlRun(root, started.data.runId, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'skip', reason: 'Planned elsewhere.' });
  assert.match(queueCommand(root, 'next', { queue: queueId }).nextAction.instruction, /Scout this unit first: .* Add scout and plan/);
});

test('the guide, the entry skill and the plan playbook name what the code does', () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const text = name => readFileSync(join(repo, name), 'utf8');
  const guide = text('docs/work-queue.md');
  for (const command of ['queue create', 'queue status', 'queue next', 'queue decide']) assert.ok(guide.includes(`cyc ${command}`), `guide documents ${command}`);
  // Every unit status and line state the view can report is explained in the guide.
  for (const word of ['waiting', 'ready', 'in-progress', 'done', 'halted', 'skipped', 'cancelled', 'complete', 'ended', 'missing']) assert.ok(guide.includes(`\`${word}\``), `guide explains ${word}`);
  for (const action of ['retry', 'skip', 'cancel']) assert.ok(guide.includes(`\`${action}\``), `guide explains ${action}`);
  const skill = text('skills/cyc/SKILL.md');
  for (const phrase of ['../../docs/work-queue.md', 'queue next', 'queue decide', 'only after they choose', 'unbound run']) assert.ok(skill.includes(phrase), `entry skill: ${phrase}`);
  const plan = text('skills/cyc/references/playbooks/plan.md');
  for (const phrase of ['docs/work-queue.md', 'queue create', 'not how to build it']) assert.ok(plan.includes(phrase), `plan playbook: ${phrase}`);
});

// The cases below were each demonstrated against the second candidate by a second independent review.

// As if the clock had stepped back before this run started: every time it recorded moves earlier.
function backdate(root, run, ms) {
  const path = `.cyc/runs/${run}/state.json`, state = read(root, path), earlier = value => new Date(Date.parse(value) - ms).toISOString();
  put(root, path, { ...state, startedAt: earlier(state.startedAt), history: state.history.map(item => ({ ...item, time: earlier(item.time) })) });
}

test('attempt order holds when both attempts have ended, and a run that has not ended decides its unit', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const first = begin(root, queueId, 'orders');
  controlRun(root, first, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'Try again.' });
  const second = begin(root, queueId, 'orders');
  controlRun(root, second, 'stop');
  backdate(root, second, 600000);
  // By the clock the first attempt, with its retry decision, now looks latest. It is not.
  assert.equal(statuses(root, queueId).orders, 'halted');
  assert.deepEqual(queueCommand(root, 'status', { queue: queueId }).units[0].runs.map(item => item.runId), [first, second]);
  assert.equal(queueCommand(root, 'next', { queue: queueId }).halted.runId, second);
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is halted/);
  // An earlier attempt that has not ended (here, its record edited back to running) decides the unit.
  put(root, `.cyc/runs/${first}/state.json`, { ...read(root, `.cyc/runs/${first}/state.json`), status: 'running' });
  assert.equal(statuses(root, queueId).orders, 'in-progress');
  assert.deepEqual(queueCommand(root, 'next', { queue: queueId }).inProgress, { unit: 'orders', runId: first });
});

test('a decision speaks for the run as it stood: it does not pass a run whose record comes back', t => {
  for (const [label, returned, expected] of [['halted', state => state, 'halted'], ['blocked', state => ({ ...state, status: 'blocked' }), 'halted'], ['complete', state => ({ ...state, status: 'complete' }), 'done']]) {
    for (const action of ['retry', 'skip']) {
      const root = fixture(t);
      const { queueId } = create(root);
      const run = begin(root, queueId, 'orders');
      put(root, 'src/notes/readme.txt', 'changed by the orders run');
      quickHandoff(root, run, { summary: 'Read the code for this unit.' });
      const path = `.cyc/runs/${run}/state.json`, state = read(root, path);
      assert.equal(state.status, 'halted');
      writeFileSync(join(root, path), '{"status":');
      const decided = queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action, reason: 'Its record was unreadable.' });
      assert.deepEqual([decided.recorded.afterRun, decided.recorded.afterStatus, decided.units[0].status], [run, 'missing', action === 'retry' ? 'ready' : 'skipped']);
      // The record is readable again. The decision was about a missing run, not about this one.
      put(root, path, returned(state));
      assert.equal(statuses(root, queueId).orders, expected, `${action} on a missing run, record back as ${label}`);
      if (expected === 'halted') assert.throws(() => begin(root, queueId, action === 'retry' ? 'orders' : 'notes'), /Unit orders is halted/, `${action}/${label}`);
    }
  }
});

test('a halted line shows what a retry would start from before anyone decides', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  finishUnit(root, begin(root, queueId, 'orders'));
  const run = begin(root, queueId, 'export');
  // The export attempt edits the finished orders unit and is stopped: no scope guard ran to name the file.
  put(root, 'src/orders/list.txt', 'rewritten by the export run');
  put(root, 'src/export/csv.txt', 'half-finished');
  controlRun(root, run, 'stop');
  const halted = queueCommand(root, 'next', { queue: queueId });
  assert.equal(halted.halted.reason, `Run ${run} ended stopped.`);
  assert.deepEqual([halted.drift.changed, halted.drift.outsideUnit, halted.drift.unfinishedAttempts], [['src/export/csv.txt', 'src/orders/list.txt'], ['src/orders/list.txt'], [{ runId: run, unit: 'export', status: 'stopped' }]]);
  assert.match(halted.nextAction.instruction, /Show the user the reason and the files under drift, above all drift\.outsideUnit, before they choose/);
});

test('drift follows the order runs were admitted in, not their clocks', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const orders = begin(root, queueId, 'orders');
  finishUnit(root, orders);
  put(root, 'src/notes/readme.txt', 'edited by hand before export');
  const stopped = begin(root, queueId, 'export');
  put(root, 'src/export/csv.txt', 'half-finished');
  controlRun(root, stopped, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'export', action: 'retry', reason: 'Try again.' });
  backdate(root, stopped, 3600000);
  // The stopped attempt now looks older than the orders run it followed; it is still listed.
  const retry = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([retry.drift.sinceRun, retry.drift.changed, retry.drift.unfinishedAttempts], [orders, ['src/export/csv.txt', 'src/notes/readme.txt'], [{ runId: stopped, unit: 'export', status: 'stopped' }]]);
  const exported = begin(root, queueId, 'export');
  finishUnit(root, exported);
  backdate(root, exported, 7200000);
  // Export completed last, whatever its clock says: its files are the baseline, the hand edit is absorbed,
  // and the stopped attempt before it is no longer listed.
  assert.equal(queueCommand(root, 'next', { queue: queueId }).drift, null);
  put(root, 'src/export-extra/new.txt', 'beside the export folder');
  const notes = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([notes.unit.id, notes.drift.sinceRun, notes.drift.sinceUnit, notes.drift.unfinishedAttempts], ['notes', exported, 'export', []]);
  // A folder that only shares a prefix with a unit's path is outside it.
  const other = fixture(t), queue = create(other, definition([unit('orders'), unit('export')])).queueId;
  finishUnit(other, begin(other, queue, 'orders'));
  put(other, 'src/export-extra/new.txt', 'beside the export folder');
  put(other, 'src/export/inside.txt', 'inside');
  assert.deepEqual(queueCommand(other, 'next', { queue }).drift.outsideUnit, ['src/export-extra/new.txt']);
});

test('drift lists at most fifty files and says how many there are', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  finishUnit(root, begin(root, queueId, 'orders'));
  for (let index = 0; index < 60; index++) put(root, `src/other/f${String(index).padStart(2, '0')}.txt`, 'x');
  put(root, 'src/export/one.txt', 'x');
  const { drift } = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([drift.changed.length, drift.total, drift.outsideUnit.length, drift.outsideTotal], [50, 61, 50, 60]);
});

test('when a run record is lost before the line has a known point, drift says so instead of reporting nothing', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  put(root, 'src/notes/readme.txt', 'changed by the orders run');
  quickHandoff(root, run, { summary: 'Read the code for this unit.' });
  rmSync(join(root, `.cyc/runs/${run}`), { recursive: true, force: true });
  const halted = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([halted.halted.status, halted.drift.since, halted.drift.lostRuns, halted.drift.changed], ['missing', 'unknown', [run], []]);
  assert.match(halted.drift.note, /where the line started is unknown and files that run changed may not be listed/);
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'Its record was lost.' });
  const retry = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([retry.unit.attempt, retry.drift.since, retry.drift.lostRuns], [2, 'unknown', [run]]);
  const second = begin(root, queueId, 'orders');
  assert.deepEqual(readRun(root, second).queue.drift.lostRuns, [run]);
  // Once a unit completes, the line has a known point again and nothing is unknown.
  finishUnit(root, second);
  assert.equal(queueCommand(root, 'next', { queue: queueId }).drift, null);
});

test('a start the queue noted but whose record never appeared holds its unit until it is taken back', async t => {
  const { noteStart, dropStart, queueView } = await import('../scripts/queue.mjs');
  const root = fixture(t);
  const { queueId } = create(root);
  const path = `.cyc/queues/${queueId}/queue.json`;
  const io = { read: () => read(root, path), write: (id, queue) => put(root, path, queue) };
  const binding = { id: queueId, unit: 'orders', attempt: 1 };
  noteStart(io, binding, 'never-written');
  assert.deepEqual(read(root, path).started.map(item => [item.unit, item.runId, item.attempt]), [['orders', 'never-written', 1]]);
  assert.equal(queueView(read(root, path), []).units[0].status, 'halted', 'a noted start with no record fails closed');
  assert.throws(() => begin(root, queueId, 'notes'), /Unit orders is halted \(run never-written\)/);
  dropStart(io, binding, 'never-written');
  assert.deepEqual(read(root, path).started, []);
  assert.equal(statuses(root, queueId).orders, 'ready');
});

test('a queue whose units were edited can still be cancelled by its ID, which is the remedy its refusal names', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const path = `.cyc/queues/${queueId}/queue.json`, stored = read(root, path);
  stored.definition.units[0].criteria[0].description = 'Anything at all.';
  put(root, path, stored);
  assert.match(cyc(root, ['queue', 'status']).data.error, new RegExp(`Unreadable: ${queueId}: .*Cancel it with queue decide --queue ID`));
  const file = put(root, '.cyc/runtime/CANCEL.json', { version: 1, action: 'cancel', reason: 'Its units were edited.' });
  assert.match(cyc(root, ['queue', 'decide', '--file', file]).data.error, /Unreadable: .*Pass --queue ID/, 'without its ID an edited queue is not picked');
  const cancelled = cyc(root, ['queue', 'decide', '--queue', queueId, '--file', file]);
  assert.deepEqual([cancelled.status, cancelled.data.line, cancelled.data.recorded.action], [0, 'cancelled', 'cancel']);
  assert.equal(read(root, path).status, 'cancelled');
  // A cancelled queue no longer stands in the way of the next one.
  assert.match(cyc(root, ['queue', 'status']).data.error, /No open queue/);
  const replacement = create(root).queueId;
  assert.equal(cyc(root, ['queue', 'next']).data.queueId, replacement);
});

test('a stopped run does not keep a reason that a resume cleared, and odd records do not break the line', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  quickHandoff(root, run, { status: 'blocked', summary: 'The order list needs credentials I do not have.' });
  controlRun(root, run, 'resume');
  controlRun(root, run, 'stop');
  assert.equal(queueCommand(root, 'next', { queue: queueId }).halted.reason, `Run ${run} ended stopped.`);
  // A note that is not a record makes the file unreadable as a queue; it is never skipped over.
  const path = `.cyc/queues/${queueId}/queue.json`, stored = read(root, path);
  put(root, path, { ...stored, started: [null] });
  assert.throws(() => queueCommand(root, 'status', { queue: queueId }), /is not a version 1 queue record/);
  put(root, path, stored);
  // A completed run whose stored files were removed by hand cannot serve as the line's point; nothing throws.
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'Try again.' });
  const second = begin(root, queueId, 'orders');
  finishUnit(root, second);
  const state = read(root, `.cyc/runs/${second}/state.json`);
  put(root, `.cyc/runs/${second}/state.json`, { ...state, queue: { ...state.queue, completed: { hash: state.queue.completed.hash } } });
  put(root, 'src/export/csv.txt', 'edited by hand');
  const next = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([next.unit.id, next.drift.since, next.drift.sinceRun], ['export', 'started', run]);
});

// The cases below close what a third independent review showed no test could fail on.

// Runs `work` with every rename (how the controller commits a file) observed, and refused when `refuse` says so.
function withRenames(refuse, work) {
  const rename = fs.renameSync, seen = [];
  fs.renameSync = (from, to) => {
    const name = String(to).replaceAll('\\', '/');
    const kind = name.endsWith('/queue.json') ? 'queue' : name.endsWith('/state.json') ? 'run' : null;
    if (kind) seen.push(kind);
    if (kind && refuse(kind, seen)) { seen.push(`${kind} refused`); throw Object.assign(new Error(`EIO: write refused, rename ${name.split('/').slice(-2).join('/')}`), { code: 'EIO' }); }
    return rename(from, to);
  }; syncBuiltinESMExports();
  try { return { result: work(), seen }; } catch (error) { return { error, seen }; }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
}

test('a bound start notes the run in the queue before the run record exists, and a failed write leaves the unit as it was', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const notes = () => read(root, `.cyc/queues/${queueId}/queue.json`).started.map(item => item.unit);
  // The queue's note cannot be written: the start is refused and no run record appears.
  const noNote = withRenames(kind => kind === 'queue', () => begin(root, queueId, 'orders'));
  assert.match(noNote.error?.message ?? '', /write refused, rename .*queue\.json/);
  assert.deepEqual([noNote.seen, runCount(root), notes(), statuses(root, queueId).orders], [['queue', 'queue refused'], 0, [], 'ready']);
  // The run record cannot be written: the note is taken back, so the unit is ready, not halted.
  const noRecord = withRenames(kind => kind === 'run', () => begin(root, queueId, 'orders'));
  assert.match(noRecord.error?.message ?? '', /write refused, rename .*state\.json/);
  assert.deepEqual([noRecord.seen, notes(), statuses(root, queueId).orders], [['queue', 'run', 'run refused', 'queue'], [], 'ready']);
  assert.doesNotMatch(noRecord.error.message, /could not be removed/);
  // The record and then the take-back both fail: the error says so, and the unit fails closed.
  const neither = withRenames((kind, seen) => kind === 'run' || seen.filter(item => item === 'queue').length > 1, () => begin(root, queueId, 'orders'));
  assert.match(neither.error?.message ?? '', /state\.json.* The queue's note of this start could not be removed either, so unit orders reads halted with a missing run; a retry decision lets it start again\./);
  assert.deepEqual([notes(), statuses(root, queueId).orders], [['orders'], 'halted']);
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'That start never wrote its record.' });
  // An ordinary start: the note first, then the run record, and the unit is in progress.
  const started = withRenames(() => false, () => begin(root, queueId, 'orders'));
  assert.deepEqual([started.seen.slice(0, 2), notes(), statuses(root, queueId).orders], [['queue', 'run'], ['orders', 'orders'], 'in-progress']);
  assert.equal(readRun(root, started.result).queue.attempt, 2);
});

test('a lost later attempt still counts as the latest, and a run lost after a readable one hides no starting point', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const first = begin(root, queueId, 'orders');
  controlRun(root, first, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'Try again.' });
  const second = begin(root, queueId, 'orders');
  put(root, 'src/orders/list.txt', 'half-finished');
  rmSync(join(root, `.cyc/runs/${second}`), { recursive: true, force: true });
  // The first attempt holds a retry decision; the lost second attempt, not the first, decides the unit.
  const halted = queueCommand(root, 'next', { queue: queueId });
  assert.deepEqual([halted.halted.runId, halted.halted.status], [second, 'missing']);
  assert.deepEqual(queueCommand(root, 'status', { queue: queueId }).units[0].runs.map(item => [item.runId, item.status]), [[first, 'stopped'], [second, 'missing']]);
  assert.throws(() => begin(root, queueId, 'orders'), /Unit orders is halted/);
  // The line's starting point is the readable first run, so nothing about it is unknown.
  assert.deepEqual([halted.drift.since, halted.drift.sinceRun, halted.drift.changed, 'lostRuns' in halted.drift, halted.drift.unfinishedAttempts.map(item => item.status)], ['started', first, ['src/orders/list.txt'], false, ['stopped', 'missing']]);
});

test('attempts without the queue\'s notes are still ordered by their attempt number', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const first = begin(root, queueId, 'orders');
  controlRun(root, first, 'stop');
  queueCommand(root, 'decide', { queue: queueId, version: 1, unit: 'orders', action: 'retry', reason: 'Try again.' });
  const second = begin(root, queueId, 'orders');
  controlRun(root, second, 'stop');
  backdate(root, second, 600000);
  const path = `.cyc/queues/${queueId}/queue.json`;
  put(root, path, { ...read(root, path), started: [] });
  assert.deepEqual(queueCommand(root, 'status', { queue: queueId }).units[0].runs.map(item => item.runId), [first, second]);
  assert.equal(statuses(root, queueId).orders, 'halted');
});

test('a halted line is still reported when its drift cannot be worked out, and a cancelled edited queue says it is cancelled', t => {
  const root = fixture(t);
  const { queueId } = create(root);
  const run = begin(root, queueId, 'orders');
  controlRun(root, run, 'stop');
  const path = `.cyc/queues/${queueId}/queue.json`, stored = read(root, path);
  stored.definition.units[0].criteria[0].description = 'Anything at all.';
  put(root, path, stored);
  assert.throws(() => queueCommand(root, 'status', { queue: queueId }), /edited after it was created\. Its units no longer match .* Cancel it with queue decide --queue ID/);
  queueCommand(root, 'decide', { queue: queueId, version: 1, action: 'cancel', reason: 'Its units were edited.' });
  assert.throws(() => queueCommand(root, 'status', { queue: queueId }), /edited after it was created\. It is cancelled and kept only as a record\./);
  assert.match(cyc(root, ['run', 'next', '--run', run]).data.queue.error, /It is cancelled and kept only as a record/);

  // The halted unit's folder is replaced by a link that leaves the project, so its paths can no
  // longer be resolved. Status and next must still say the line is halted and why.
  const other = fixture(t), queue = create(other).queueId, stopped = begin(other, queue, 'orders');
  controlRun(other, stopped, 'stop');
  const outside = mkdtempSync(join(tmpdir(), 'cyc-queue-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  rmSync(join(other, 'src/orders'), { recursive: true, force: true });
  fs.symlinkSync(outside, join(other, 'src/orders'), 'junction');
  assert.equal(queueCommand(other, 'status', { queue }).line, 'halted');
  const halted = queueCommand(other, 'next', { queue });
  assert.deepEqual([halted.line, halted.halted.runId, halted.nextAction.action], ['halted', stopped, 'decide']);
  assert.match(halted.drift.error, /leaves project/);
  fs.unlinkSync(join(other, 'src/orders'));
});
