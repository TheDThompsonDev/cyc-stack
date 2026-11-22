import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { completeRun, controlRun, finishRun, queueCommand, quickHandoff, readRun, recordBoardReview, sourceSnapshot, startRun } from '../scripts/runtime.mjs';
import { changeFingerprint, checkRuns } from '../scripts/run-gate.mjs';
import { digest } from '../scripts/response-gate.mjs';

// The queue board and the review seat: agents on a queue, and the person, exchange questions,
// findings and answers that the controller records and enforces. These tests drive the real
// controller in temporary projects with investigation units, which need no checks or proof;
// test/queue-board-journey.test.mjs runs a feature unit with a reviewer, a receipt and real proof.
// The cases from "a seat belongs to the conversation that took it" on were each demonstrated
// against the first candidate by an independent review.
process.env.CYC_BASELINE_MODE = 'off';
// In-process calls are the person's unless a case says who speaks, whatever host runs the suite.
process.env.CYC_SESSION = 'person';
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/cyc.mjs');
const put = (root, name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content)); return path; };
const read = (root, name) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const boardFile = queue => `.cyc/queues/${queue}/board.json`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-board-'));
  t.after(() => { assert.ok(root.includes('cyc-board-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', { schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'checks', command: process.execPath, args: ['-e', 'process.exit(0)'], timeoutMs: 5000 }] } });
  put(root, 'src/orders/list.txt', 'orders');
  put(root, 'src/export/csv.txt', 'csv');
  return root;
}
const unit = (id, extra = {}) => ({ id, outcome: `The ${id} behavior is explained.`, playbook: 'investigation', criteria: [{ id: 'explained', description: `The ${id} behavior is explained from the code.` }], paths: [`src/${id}`], dependsOn: [], ...extra });
const create = (root, units = [unit('orders'), unit('export', { dependsOn: ['orders'] })]) => queueCommand(root, 'create', { version: 1, goal: 'Explain how orders are exported.', requirements: 'Explain the order list, then the export.', units }).queueId;
// Every command runs as one conversation. The CLI reads it from the environment, as a host sets it.
const envOf = session => ({ ...process.env, CYC_SESSION: session, CLAUDE_CODE_SESSION_ID: '', CODEX_THREAD_ID: '' });
function cyc(root, session, args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8', env: envOf(session) });
  let data; try { data = JSON.parse(result.stdout || result.stderr); } catch { data = { raw: result.stdout + result.stderr }; }
  return { status: result.status, data };
}
const as = (session, work) => { const before = process.env.CYC_SESSION; process.env.CYC_SESSION = session; try { return work(); } finally { process.env.CYC_SESSION = before; } };
// A bound run started through the CLI by the named conversation, from the start file as queue next
// writes it. That file records no execution; `mode` adds one.
function begin(root, queue, session = 'builder', mode) {
  const next = cyc(root, session, ['queue', 'next', '--queue', queue]);
  assert.equal(next.status, 0, JSON.stringify(next.data));
  const file = join(root, next.data.startTemplate);
  if (mode) writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), executionMode: mode }));
  const started = cyc(root, session, ['run', 'start', '--file', file]);
  assert.equal(started.status, 0, JSON.stringify(started.data));
  return { run: started.data.runId, unit: next.data.unit.id, started: started.data, next: next.data };
}
// A post by whoever the author is: the builder for a run, the reviewer for a seat, else the person.
// A case that names another conversation with `as` keeps it.
const post = (root, queue, message, author = {}) => {
  const send = () => queueCommand(root, 'post', { queue, message: { version: 1, ...message }, ...author });
  return process.env.CYC_SESSION !== 'person' ? send() : as(author.seat !== undefined ? 'reviewer' : author.run !== undefined ? 'builder' : 'person', send);
};
const signOff = (root, queue, seat, text = 'Nothing more.') => post(root, queue, { kind: 'notice', topic: 'review-done', sourceHash: sourceSnapshot(root).hash, text }, { seat });
const refused = (work, pattern) => assert.throws(work, error => { assert.match(error.message, pattern); return true; });
const handoffs = (root, run, session = 'builder') => as(session, () => { quickHandoff(root, run, { summary: 'Read the code for this unit.' }); quickHandoff(root, run, { summary: 'Explained the behavior from the code.', passedEvidence: 'Read the file this unit names.' }); });
const complete = (root, run, session = 'builder') => as(session, () => completeRun(root, run));
const finishUnit = (root, run, session = 'builder') => { handoffs(root, run, session); return complete(root, run, session); };
const seatOf = (root, queue, session = 'reviewer') => { const taken = cyc(root, session, ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', session]); assert.equal(taken.status, 0, JSON.stringify(taken.data)); return taken.data; };
const states = (root, queue) => queueCommand(root, 'board', { queue }).seats.map(item => item.state);
// Moves a seat, and everything said so far, a number of minutes into the past.
function age(root, queue, minutes) {
  const board = read(root, boardFile(queue)), earlier = new Date(Date.now() - minutes * 60000).toISOString();
  for (const seat of board.seats) { seat.takenAt = earlier; if (seat.seenAt) seat.seenAt = earlier; }
  for (const message of board.messages) message.at = earlier;
  put(root, boardFile(queue), board);
}

test('a message is stored with its author filled in by the controller: a bound run, a review seat, or the person', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  const fromRun = post(root, queue, { kind: 'question', to: 'person', text: 'May the export include cancelled orders?', about: ['src/orders/list.txt'] }, { run });
  assert.deepEqual([fromRun.posted.id, fromRun.posted.from, fromRun.posted.to, fromRun.posted.kind], [1, 'unit orders', 'person', 'question']);
  const seat = seatOf(root, queue).seat;
  const fromSeat = post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });
  assert.equal(fromSeat.posted.from, `reviewer of orders (seat ${seat})`);
  assert.equal(fromSeat.posted.sourceHash, sourceSnapshot(root).hash, 'a reviewer\'s message carries the source as it stood');
  const fromPerson = post(root, queue, { kind: 'notice', to: 'all', text: 'The deadline moved to Friday.' });
  assert.equal(fromPerson.posted.from, 'person');
  assert.deepEqual(read(root, boardFile(queue)).messages.map(message => message.from), [{ unit: 'orders', runId: run }, { unit: 'orders', seat, runId: run }, { person: true }]);
  // The CLI: --run posts for the run's unit, and is never the person's.
  const file = put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'export', text: 'The list is one order per line.' });
  const viaCli = cyc(root, 'builder', ['queue', 'post', '--run', run, '--file', file]);
  assert.deepEqual([viaCli.status, viaCli.data.posted.from, viaCli.data.posted.to], [0, 'unit orders', 'export']);
  assert.equal(read(root, boardFile(queue)).messages.length, 4);
});

test('a run is spoken for by its own conversation alone, with or without an execution record', t => {
  for (const mode of [undefined, 'standalone']) {
    const root = fixture(t), queue = create(root), { run } = begin(root, queue, 'builder', mode);
    assert.equal(!!readRun(root, run).execution, !!mode);
    post(root, queue, { kind: 'notice', to: 'orders', text: 'For the builder.' });
    const file = put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'export', text: 'x' });
    // Not another conversation, and not one that cannot say who it is: neither posts, waits, nor
    // uses up the run's messages.
    for (const session of ['someone-else', '']) {
      for (const args of [['queue', 'post', '--run', run, '--file', file], ['queue', 'wait', '--run', run, '--wait-ms', '0']]) {
        const foreign = cyc(root, session, args);
        assert.equal(foreign.status, 1, `${mode ?? 'no execution'}, ${session || 'no session'}: ${args[1]}`);
        assert.match(foreign.data.error, /belongs to conversation builder/);
      }
      assert.deepEqual(cyc(root, session, ['run', 'next', '--run', run]).data.board.new.map(message => message.id), [1]);
    }
    // A host that reports a session is believed over what --session says.
    assert.match(cyc(root, 'someone-else', ['queue', 'post', '--run', run, '--session', 'builder', '--file', file]).data.error, /belongs to conversation builder/);
    assert.equal(read(root, boardFile(queue)).messages.length, 1);
    assert.deepEqual(cyc(root, 'builder', ['run', 'next', '--run', run]).data.board.new.map(message => message.id), [1], 'the owner is still shown it');
    assert.equal(cyc(root, 'builder', ['queue', 'post', '--run', run, '--file', file]).status, 0);
  }
  // A run started under a label of its own is still its starter's: the host's session at start counts.
  {
    const root = fixture(t), queue = create(root), next = cyc(root, 'agent-a', ['queue', 'next', '--queue', queue]).data, start = join(root, next.startTemplate);
    writeFileSync(start, JSON.stringify({ ...JSON.parse(readFileSync(start, 'utf8')), session: 'work-1' }));
    const run = cyc(root, 'agent-a', ['run', 'start', '--file', start]).data.runId;
    assert.deepEqual([readRun(root, run).session, read(root, `.cyc/queues/${queue}/queue.json`).started[0].by], ['work-1', 'agent-a']);
    post(root, queue, { kind: 'notice', to: 'orders', text: 'For the builder.' });
    const note = put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'export', text: 'x' });
    assert.equal(cyc(root, 'agent-a', ['queue', 'post', '--run', run, '--file', note]).status, 0);
    assert.equal(cyc(root, 'agent-a', ['run', 'next', '--run', run]).data.board, undefined, 'its messages were marked shown by its own post');
    assert.match(cyc(root, 'agent-b', ['queue', 'post', '--run', run, '--file', note]).data.error, /belongs to conversation work-1/);
  }
  // A host that reports no session: the conversation names itself on each command.
  const root = fixture(t), queue = create(root), started = cyc(root, '', ['run', 'start', '--file', (() => { const next = cyc(root, '', ['queue', 'next', '--queue', queue]).data, file = join(root, next.startTemplate); writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), session: 'work-1' })); return file; })()]);
  assert.equal(started.status, 0, JSON.stringify(started.data));
  const file = put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'export', text: 'x' });
  assert.match(cyc(root, '', ['queue', 'post', '--run', started.data.runId, '--file', file]).data.error, /belongs to conversation work-1/);
  assert.equal(cyc(root, '', ['queue', 'post', '--run', started.data.runId, '--session', 'work-1', '--file', file]).data.posted.from, 'unit orders');
});

test('a message that could not be acted on as written is refused, and nothing is stored', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  const builder = { run }, reviewer = { seat }, hash = sourceSnapshot(root).hash;
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is the list sorted?' });          // 1, from the person
  post(root, queue, { kind: 'finding', to: 'orders', text: 'No empty-list case.' }, reviewer);  // 2
  post(root, queue, { kind: 'answer', replyTo: 1, text: 'No, it keeps file order.' }, builder); // 3 closes 1
  post(root, queue, { kind: 'question', to: 'person', text: 'May it be sorted?' }, builder);    // 4
  const cases = [
    ['an unknown field', {}, { kind: 'notice', to: 'all', text: 'x', urgent: true }, /Unknown board message field: urgent/],
    ['an unknown kind', {}, { kind: 'shout', to: 'all', text: 'x' }, /kind: question, finding, answer, notice/],
    ['a wrong version', {}, { version: 2, kind: 'notice', to: 'all', text: 'x' }, /version 1/],
    ['no text', {}, { kind: 'notice', to: 'all', text: ' ' }, /at most 2000 characters/],
    ['text over the limit', {}, { kind: 'notice', to: 'all', text: 'x'.repeat(2001) }, /at most 2000 characters/],
    ['a question to everyone', builder, { kind: 'question', to: 'all', text: 'Anyone?' }, /one addressee/],
    ['a question to an unknown unit', builder, { kind: 'question', to: 'billing', text: 'x' }, /one addressee/],
    ['a unit asking itself', builder, { kind: 'question', to: 'orders', text: 'x' }, /does not ask itself/],
    ['a finding from a builder', builder, { kind: 'finding', to: 'export', text: 'x' }, /comes from a review seat or from the person/],
    ['a finding to everyone', {}, { kind: 'finding', to: 'all', text: 'x' }, /addressed to one unit/],
    ['a reviewer\'s finding on another unit', reviewer, { kind: 'finding', to: 'export', text: 'x' }, /reviews unit orders/],
    ['a question with a disposition', builder, { kind: 'question', to: 'person', text: 'x', disposition: 'fixed' }, /does not take disposition/],
    ['a source hash on a message that is not a sign-off', reviewer, { kind: 'finding', to: 'orders', text: 'x', sourceHash: hash }, /does not take sourceHash/],
    ['a notice with an unknown topic', {}, { kind: 'notice', to: 'all', text: 'x', topic: 'lunch' }, /topic is ready-for-review or review-done/],
    ['review-done from a builder', builder, { kind: 'notice', to: 'orders', text: 'x', topic: 'review-done', sourceHash: hash }, /Only a review seat posts review-done/],
    ['ready-for-review from a reviewer', reviewer, { kind: 'notice', text: 'x', topic: 'ready-for-review' }, /Only the unit's builder posts ready-for-review/],
    ['an answer to an unknown message', builder, { kind: 'answer', replyTo: 99, text: 'x' }, /Message 99 is not an open question or finding/],
    ['an answer to an item already closed', builder, { kind: 'answer', replyTo: 1, text: 'again' }, /Message 1 is not an open question or finding/],
    ['an answer to an answer', builder, { kind: 'answer', replyTo: 3, text: 'x' }, /Message 3 is not an open question or finding/],
    ['an answer with an addressee', builder, { kind: 'answer', replyTo: 2, to: 'person', disposition: 'fixed', text: 'x' }, /does not take to/],
    ['an answer to a finding with no disposition', builder, { kind: 'answer', replyTo: 2, text: 'ok' }, /needs disposition fixed or declined/],
    ['an answer to a finding that claims an assumption', builder, { kind: 'answer', replyTo: 2, disposition: 'assumed', text: 'ok' }, /needs disposition fixed or declined/],
    ['a reviewer closing its own finding as fixed', reviewer, { kind: 'answer', replyTo: 2, disposition: 'fixed', text: 'ok' }, /Closing your own finding needs disposition withdrawn/],
    ['a reviewer closing its own finding without saying how', reviewer, { kind: 'answer', replyTo: 2, text: 'x' }, /Closing your own finding/],
    ['a builder answering an item that is for the person', builder, { kind: 'answer', replyTo: 4, text: 'Yes.' }, /Closing your own question needs disposition assumed or withdrawn/],
    ['a post through an unknown seat', { seat: 'ffffffff' }, { kind: 'notice', to: 'all', text: 'x' }, /has no seat "ffffffff"/],
    ['a run and a seat at once', { run, seat }, { kind: 'notice', to: 'all', text: 'x' }, /--run or --seat, not both/]
  ];
  for (const [label, author, message, pattern] of cases) refused(() => post(root, queue, message, author), pattern, label);
  assert.equal(read(root, boardFile(queue)).messages.length, 4, 'no refused message was stored');
  // A question's answer takes no disposition; the person may answer any open item.
  post(root, queue, { kind: 'question', to: 'orders', text: 'Second question.' }); // 5
  refused(() => post(root, queue, { kind: 'answer', replyTo: 5, disposition: 'fixed', text: 'x' }, builder), /answer to a question takes no disposition/);
  assert.equal(post(root, queue, { kind: 'answer', replyTo: 2, disposition: 'declined', text: 'An empty list is out of scope here.' }).posted.to, `seat:${seat}`);
  // Only the unit an item is for, the person, or its author may close it: not a reviewer, and not
  // the builder of another unit.
  refused(() => post(root, queue, { kind: 'answer', replyTo: 5, text: 'x' }, reviewer), /Message 5 is for unit orders/);
  post(root, queue, { kind: 'question', to: 'export', text: 'For the later unit.' }); // 7
  refused(() => post(root, queue, { kind: 'answer', replyTo: 7, text: 'x' }, builder), /Message 7 is for unit export/);
});

test('a run that has ended, or is bound to another queue, does not post', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  finishUnit(root, run);
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'late' }, { run }), /is complete; only a run that has not ended posts/);
  const other = create(root, [unit('orders'), unit('export')]);
  const second = begin(root, other);
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'x' }, { run: second.run }), new RegExp(`bound to queue ${other}, not ${queue}`));
  const unbound = as('builder', () => startRun(root, { goal: 'Explain something else.', playbook: 'investigation', criteria: [{ id: 'explained', description: 'It is explained.' }], allowedPaths: ['src/export'] })).runId;
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'x' }, { run: unbound }), /is not bound to a queue, so it has no board/);
});

test('a bound run is shown its messages first in the result of its commands, once, and only its owner moves the mark', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is the list sorted?' });
  post(root, queue, { kind: 'notice', to: 'all', text: 'The deadline moved to Friday.' });
  post(root, queue, { kind: 'notice', to: 'export', text: 'Not for orders.' });
  // Neither another conversation nor one that cannot say who it is consumes the run's messages, and
  // the owner's own read-only status does not either.
  for (const session of ['someone-else', '']) assert.deepEqual(cyc(root, session, ['run', 'next', '--run', run]).data.board.new.map(message => message.id), [1, 2]);
  assert.deepEqual(cyc(root, 'builder', ['run', 'status', '--run', run]).data.board.new.map(message => message.id), [1, 2]);
  const first = cyc(root, 'builder', ['run', 'next', '--run', run]);
  assert.equal(Object.keys(first.data)[0], 'board', 'agents act on the head of a result, so the board comes first');
  assert.deepEqual(first.data.board.new.map(message => [message.id, message.from, message.text]), [[1, 'person', 'Is the list sorted?'], [2, 'person', 'The deadline moved to Friday.']]);
  assert.deepEqual(first.data.board.hold.map(item => item.message), [1]);
  const second = cyc(root, 'builder', ['run', 'next', '--run', run]);
  assert.equal(second.data.board.new, undefined, 'a message is shown once');
  assert.deepEqual(second.data.board.hold.map(item => item.message), [1], 'what holds the unit is shown until it is cleared');
  // The answer to what the run asked comes back the same way, on another command; its own posts do not.
  post(root, queue, { kind: 'answer', replyTo: 1, text: 'No.' }, { run });
  post(root, queue, { kind: 'question', to: 'person', text: 'May I sort it?' }, { run });
  post(root, queue, { kind: 'answer', replyTo: 5, text: 'Yes, by date.' });
  const recorded = cyc(root, 'builder', ['run', 'record', '--run', run, '--summary', 'Read the code for this unit.']);
  assert.equal(recorded.status, 0, JSON.stringify(recorded.data));
  assert.deepEqual(recorded.data.board.new.map(message => [message.id, message.kind, message.replyTo]), [[6, 'answer', 5]]);
  assert.equal(recorded.data.board.hold, undefined);
  assert.equal(cyc(root, 'builder', ['run', 'next', '--run', run]).data.board, undefined, 'a quiet board adds nothing');
});

test('a unit that starts later is shown what was left for it, and an unbound run is never shown a board', t => {
  const root = fixture(t), queue = create(root), first = begin(root, queue);
  post(root, queue, { kind: 'notice', to: 'export', text: 'The list is one order per line, oldest first.' }, { run: first.run });
  post(root, queue, { kind: 'question', to: 'export', text: 'Should the export have a header row?' });
  // One that the person settled before the unit started is shown with how it was closed.
  post(root, queue, { kind: 'question', to: 'export', text: 'Comma or semicolon?' });
  post(root, queue, { kind: 'answer', replyTo: 3, disposition: 'withdrawn', text: 'Comma; decided elsewhere.' });
  finishUnit(root, first.run);
  const later = begin(root, queue, 'builder-two');
  assert.equal(later.unit, 'export');
  assert.equal(Object.keys(later.started)[0], 'board');
  assert.deepEqual(later.started.board.new.map(message => [message.from, message.text, message.closed?.text ?? null]),
    [['unit orders', 'The list is one order per line, oldest first.', null], ['person', 'Should the export have a header row?', null], ['person', 'Comma or semicolon?', 'Comma; decided elsewhere.']]);
  // A later attempt of the unit is not shown what an earlier attempt of it already answered.
  as('builder-two', () => post(root, queue, { kind: 'answer', replyTo: 2, text: 'Yes.' }, { run: later.run }));
  post(root, queue, { kind: 'question', to: 'export', text: 'Still open at the retry.' });
  as('builder-two', () => post(root, queue, { kind: 'notice', to: 'all', text: 'From the first attempt, to everyone.' }, { run: later.run }));
  as('builder-two', () => controlRun(root, later.run, 'stop'));
  queueCommand(root, 'decide', { queue, version: 1, unit: 'export', action: 'retry', reason: 'Try again.' });
  const retry = begin(root, queue, 'builder-two');
  assert.deepEqual(retry.started.board.new.map(message => message.text), ['The list is one order per line, oldest first.', 'Comma or semicolon?', 'Still open at the retry.']);
  // An unbound run in the same project: same result with or without a board beside it.
  const unbound = as('builder', () => startRun(root, { goal: 'Explain something else.', playbook: 'investigation', criteria: [{ id: 'explained', description: 'It is explained.' }], allowedPaths: ['src/orders'], session: 'builder' })).runId;
  const result = cyc(root, 'builder', ['run', 'next', '--run', unbound]);
  assert.equal(result.status, 0);
  assert.equal('board' in result.data, false);
  assert.equal('queue' in result.data, false);
});

test('a unit cannot complete while an item for it is open, or a question of its own, and each has a way to clear', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  handoffs(root, run);
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is the list sorted?' });                                   // 1
  post(root, queue, { kind: 'question', to: 'person', text: 'May the list drop cancelled orders?' }, { run });          // 2
  post(root, queue, { kind: 'question', to: 'export', text: 'Does the export need the order date?' }, { run });         // 3
  refused(() => complete(root, run), /The queue board holds this unit: question 1 from person; question 2 from this unit; question 3 from this unit/);
  assert.equal(readRun(root, run).status, 'running');
  // run finish says so before it checks anything, and records nothing.
  const asked = as('builder', () => finishRun(root, run, { summary: 'Explained.', passedEvidence: 'Read it.' }));
  assert.deepEqual([asked.status, asked.finished, asked.steps], ['needs-answer', false, []]);
  assert.deepEqual(asked.board.hold.map(item => [item.message, item.from]), [[1, 'person'], [2, 'this unit'], [3, 'this unit']]);
  assert.match(asked.nextAction.command, new RegExp(`queue post --queue ${queue} --run ${run}`));
  const viaCli = cyc(root, 'builder', ['run', 'finish', '--run', run, '--summary', 'Explained.', '--criteria-passed', 'Read it.']);
  assert.equal(viaCli.data.status, 'needs-answer');
  assert.equal(Object.keys(viaCli.data)[0], 'board');
  assert.deepEqual(viaCli.data.board.hold.map(item => item.message), [1, 2, 3]);
  assert.equal(viaCli.data.guidance, undefined, 'nothing was checked, so there is no advice about a failed check');
  const waited = cyc(root, 'builder', ['run', 'finish', '--run', run, '--summary', 'Explained.', '--criteria-passed', 'Read it.', '--wait-ms', '20000']);
  assert.deepEqual([(waited.data.result ?? waited.data).status, waited.data.guidance], ['needs-answer', undefined]);
  // Only a running run is asked: a paused one gets the controller's own refusal, not a list to answer.
  as('builder', () => controlRun(root, run, 'pause'));
  refused(() => as('builder', () => finishRun(root, run, { summary: 'Explained.', passedEvidence: 'Read it.' })), /Finish starts at build, verify, or deliver/);
  as('builder', () => controlRun(root, run, 'resume'));
  // An answer clears the item for the unit. Its own questions are closed by going on with an assumption.
  post(root, queue, { kind: 'answer', replyTo: 1, text: 'No, file order.' }, { run });
  refused(() => complete(root, run), /holds this unit: question 2 from this unit; question 3 from this unit\./);
  refused(() => post(root, queue, { kind: 'answer', replyTo: 2, text: 'I will keep them.' }, { run }), /Closing your own question needs disposition assumed or withdrawn/);
  post(root, queue, { kind: 'answer', replyTo: 2, disposition: 'assumed', text: 'Cancelled orders stay in the list.' }, { run });
  post(root, queue, { kind: 'answer', replyTo: 3, disposition: 'withdrawn', text: 'Not needed after all.' }, { run });
  assert.equal(complete(root, run).status, 'complete');
  // The person is shown what was assumed on their question, and the unit that depends on it is told.
  assert.deepEqual(queueCommand(root, 'status', { queue }).board.latestForPerson.map(message => [message.id, message.disposition ?? null]), [[4, null], [5, 'assumed']], 'the answer to their question, and the assumption made on the one they did not answer');
  const next = cyc(root, 'builder', ['queue', 'next', '--queue', queue]).data;
  assert.equal(next.unit.id, 'export');
  assert.deepEqual(next.assumed, [{ unit: 'orders', question: 'May the list drop cancelled orders?', assumed: 'Cancelled orders stay in the list.' }]);
});

test('what waits for the person is shown in queue status and next, including items for a unit that is no longer running', t => {
  const root = fixture(t), queue = create(root, [unit('orders'), unit('export', { dependsOn: ['orders'] }), unit('notes')]), { run } = begin(root, queue);
  assert.equal(queueCommand(root, 'status', { queue }).board, undefined, 'a queue with no board says nothing about one');
  post(root, queue, { kind: 'question', to: 'person', text: 'May the export include cancelled orders?' }, { run });
  const status = queueCommand(root, 'status', { queue });
  assert.deepEqual([status.board.open, status.board.forPerson.map(message => message.id)], [1, [1]]);
  assert.match(status.board.note, /Do not answer for them/);
  // The person answers through a post with no run and no seat.
  const file = put(root, '.cyc/runtime/a.json', { version: 1, kind: 'answer', replyTo: 1, text: 'Yes, marked as cancelled.' });
  const answered = cyc(root, 'person', ['queue', 'post', '--queue', queue, '--file', file]);
  assert.deepEqual([answered.status, answered.data.posted.from, answered.data.posted.to], [0, 'person', 'orders']);
  // What a unit says to the person stays visible: there is no read mark for a person.
  post(root, queue, { kind: 'notice', to: 'person', text: 'The export will be large.' }, { run });
  finishUnit(root, run);
  // An item for a unit that is done has nobody to answer it: it is the person's now, and says so.
  const late = post(root, queue, { kind: 'finding', to: 'orders', text: 'The list misses refunds.' });
  assert.match(late.note, /Unit orders is done, so this is for the person/);
  assert.match(post(root, queue, { kind: 'notice', to: 'orders', text: 'Thanks.' }).note, /so this is for the person/);
  const after = cyc(root, 'person', ['queue', 'next', '--queue', queue]).data;
  assert.deepEqual(after.board.forPerson.map(message => [message.id, message.to]), [[4, 'orders']]);
  assert.deepEqual(after.board.latestForPerson.map(message => message.text), ['The export will be large.', 'Thanks.'], 'the answer went to the unit, not the person');
  const all = queueCommand(root, 'board', { queue });
  assert.deepEqual(all.messages.map(message => [message.id, message.open ?? null, message.for ?? null]), [[1, false, null], [2, null, null], [3, null, null], [4, true, 'person'], [5, null, null]]);
  assert.deepEqual(queueCommand(root, 'board', { queue, open: true }).messages.map(message => message.id), [4]);
  assert.deepEqual(queueCommand(root, 'board', { queue, unit: 'export' }).messages, []);
  refused(() => queueCommand(root, 'board', { queue, unit: 'billing' }), /has no unit "billing"/);
  // The same holds for a unit that was skipped: its open items are the person's.
  const notes = begin(root, queue);
  assert.equal(notes.unit, 'export');
  post(root, queue, { kind: 'question', to: 'export', text: 'Header row?' });
  as('builder', () => controlRun(root, notes.run, 'stop'));
  assert.deepEqual(queueCommand(root, 'status', { queue }).board.forPerson.map(message => message.id), [4], 'a halted unit may still be retried, so its item waits for it');
  queueCommand(root, 'decide', { queue, version: 1, unit: 'export', action: 'skip', reason: 'Not needed.' });
  assert.deepEqual(queueCommand(root, 'status', { queue }).board.forPerson.map(message => message.id), [4, 6]);
});

test('a second conversation takes the review seat on the unit in progress, and no one else can', t => {
  const root = fixture(t), queue = create(root);
  const none = cyc(root, 'reviewer', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'reviewer']);
  assert.match(none.data.error, /No unit of queue .* is in progress, so there is nothing to review/);
  // A reviewer that arrives early may wait for a unit, for a bounded time.
  const early = Date.now(), waited = cyc(root, 'reviewer', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'reviewer', '--wait-ms', '700']);
  assert.match(waited.data.error, /nothing to review/);
  assert.ok(Date.now() - early >= 600, 'it waited before giving up');
  assert.match(cyc(root, 'reviewer', ['queue', 'next', '--queue', queue, '--wait-ms', '700']).data.error, /--wait-ms goes with queue wait, or with queue next --seat review/);
  const { run } = begin(root, queue);
  put(root, 'src/orders/list.txt', 'orders, sorted');
  const taken = seatOf(root, queue);
  assert.deepEqual([taken.unit.id, taken.runId, taken.changed, taken.sourceHash], ['orders', run, ['src/orders/list.txt'], sourceSnapshot(root).hash]);
  assert.deepEqual(taken.unit.criteria.map(item => item.id), ['explained']);
  assert.match(taken.instruction, /Change no file and start no run/);
  assert.equal(readRun(root, run).status, 'running');
  // Asking again from the same conversation returns the same seat.
  assert.equal(seatOf(root, queue).seat, taken.seat);
  const refusals = [
    [['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'builder'], 'builder', /This session builds unit orders/],
    // The session the host reports counts too, whatever --session says.
    [['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'someone'], 'builder', /This session builds unit orders/],
    [['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'third'], 'third', /The review seat on unit orders is held .* or goes quiet for 30 minutes, or the run ends/],
    [['queue', 'next', '--queue', queue, '--seat', 'audit', '--session', 'third'], 'third', /The only seat is review/],
    [['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'x'], 'third', /--session is 4 to 80 letters/],
    [['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'third', '--wait-ms', '0x10'], 'third', /--wait-ms is a whole number/]
  ];
  for (const [args, session, pattern] of refusals) { const result = cyc(root, session, args); assert.equal(result.status, 1); assert.match(result.data.error, pattern); }
  // Without any session the reviewer cannot be told from the builder.
  assert.match(cyc(root, '', ['queue', 'next', '--queue', queue, '--seat', 'review']).data.error, /A seat needs the conversation's session/);
  assert.equal(read(root, boardFile(queue)).seats.length, 1);
  // Once the reviewer has signed off the seat no longer lapses, and the refusal does not say it will.
  signOff(root, queue, taken.seat);
  const held = cyc(root, 'third', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'third']).data.error;
  assert.match(held, /It frees when its reviewer gives it up, or the run ends/);
});

test('a builder known to the host by its gate key cannot take its own unit\'s seat under its session ID', t => {
  const root = fixture(t), queue = create(root), conversation = '0f0e0d0c-1111-4222-8333-444455556666', key = digest(`claude:${conversation}`).slice(0, 32);
  // A native host: the hook wrote this conversation's state file, and its run records the gate key.
  put(root, `.cyc/runtime/${key}.state.json`, { host: 'claude', updatedAt: new Date().toISOString() });
  const native = args => spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8', env: { ...process.env, CYC_SESSION: '', CLAUDE_CODE_SESSION_ID: conversation, CODEX_THREAD_ID: '' } });
  const next = JSON.parse(native(['queue', 'next', '--queue', queue]).stdout);
  const started = native(['run', 'start', '--file', join(root, next.startTemplate)]);
  assert.equal(started.status, 0, started.stdout + started.stderr);
  assert.equal(readRun(root, JSON.parse(started.stdout).runId).session, key);
  assert.match(JSON.parse(native(['queue', 'next', '--queue', queue, '--seat', 'review']).stderr).error, /This session builds unit orders/);
  const note = native(['queue', 'post', '--run', JSON.parse(started.stdout).runId, '--file', put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'export', text: 'From the native builder.' })]);
  assert.equal(note.status, 0, note.stdout + note.stderr);
  assert.equal(JSON.parse(note.stdout).posted.from, 'unit orders');
  assert.equal(seatOf(root, queue).unit.id, 'orders', 'another conversation takes it');
});

test('a held review seat keeps the unit from completing until the reviewer signs off, gives it up or goes quiet', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  handoffs(root, run);
  refused(() => complete(root, run), new RegExp(`holds this unit: review seat ${seat}\\.`));
  // The reviewer signs off: only its open finding still holds the unit.
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });
  signOff(root, queue, seat, 'One finding, nothing else.');
  refused(() => complete(root, run), /holds this unit: finding 1 from reviewer of orders/);
  post(root, queue, { kind: 'answer', replyTo: 1, disposition: 'declined', text: 'Order is the file\'s; sorting is the export\'s job.' }, { run });
  // The builder asks for another look: the seat holds again, and the clock starts from the request.
  age(root, queue, 31);
  const asked = post(root, queue, { kind: 'notice', topic: 'ready-for-review', text: 'Please look again.' }, { run });
  assert.deepEqual([asked.posted.to, asked.posted.sourceHash], [`seat:${seat}`, sourceSnapshot(root).hash]);
  assert.deepEqual(states(root, queue), ['active']);
  refused(() => complete(root, run), /review seat/);
  // Thirty minutes without a word from the reviewer: the seat lapses and the unit is free.
  age(root, queue, 31);
  assert.deepEqual(states(root, queue), ['lapsed']);
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'still here' }, { seat }), /Seat .* is lapsed; take a new one/);
  assert.equal(complete(root, run).status, 'complete');
  assert.deepEqual(states(root, queue), ['ended'], 'a seat ends with its run');
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'after the run' }, { seat }), /Seat .* is ended/);
});

test('a reviewer who reads or waits is still there, and is told when its seat no longer holds', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  // Twenty-nine quiet minutes, then a wait: the seat is still held, and the wait says so.
  age(root, queue, 29);
  const waited = cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', '0']);
  assert.deepEqual([waited.data.seat.state, waited.data.seat.sourceHash], ['active', sourceSnapshot(root).hash]);
  const board = read(root, boardFile(queue));
  board.seats[0].takenAt = new Date(Date.now() - 40 * 60000).toISOString();
  put(root, boardFile(queue), board);
  assert.deepEqual(states(root, queue), ['active'], 'the wait counted as the reviewer being there');
  assert.equal(cyc(root, 'reviewer', ['queue', 'board', '--queue', queue, '--seat', seat]).data.seat.state, 'active');
  // A reviewer that was gone is told: its seat lapsed.
  age(root, queue, 31);
  const gone = cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', '2000']);
  assert.equal(gone.data.seat.state, 'lapsed');
  assert.ok(gone.data.waited < 1500, 'a seat that no longer holds does not wait out its limit');
  // ... and when the run has ended.
  const again = seatOf(root, queue).seat;
  as('builder', () => controlRun(root, run, 'stop'));
  assert.equal(cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', again, '--wait-ms', '2000']).data.seat.state, 'ended');
});

test('a seat belongs to the conversation that took it: no one else posts, reads, waits or gives it up for it', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  handoffs(root, run);
  const done = put(root, '.cyc/runtime/done.json', { version: 1, kind: 'notice', topic: 'review-done', sourceHash: sourceSnapshot(root).hash, text: 'Fine.' });
  for (const session of ['builder', 'third', '']) {
    for (const args of [['queue', 'post', '--queue', queue, '--seat', seat, '--file', done], ['queue', 'release', '--queue', queue, '--seat', seat], ['queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', '0'], ['queue', 'board', '--queue', queue, '--seat', seat]]) {
      const result = cyc(root, session, args);
      assert.equal(result.status, 1, `${session || 'no session'}: ${args.slice(0, 2).join(' ')}`);
      assert.match(result.data.error, new RegExp(`Seat ${seat} belongs to conversation reviewer`));
    }
  }
  assert.deepEqual([read(root, boardFile(queue)).messages.length, states(root, queue)], [0, ['active']]);
  refused(() => complete(root, run), /review seat/);
});

test('a reviewer whose host reports no session names itself on each command, and a host that does is believed', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  const taken = cyc(root, '', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'reviewer-1']);
  assert.equal(taken.status, 0, JSON.stringify(taken.data));
  const seat = taken.data.seat, finding = put(root, '.cyc/runtime/f.json', { version: 1, kind: 'finding', to: 'orders', text: 'The list is never sorted.' });
  assert.match(cyc(root, '', ['queue', 'post', '--queue', queue, '--seat', seat, '--file', finding]).data.error, /belongs to conversation reviewer-1/);
  assert.match(taken.data.post, /--seat \w+ --session reviewer-1 --file/, 'the commands it is given name it, since its host does not');
  assert.match(taken.data.wait, /--session reviewer-1$/);
  assert.equal(cyc(root, '', ['queue', 'post', '--queue', queue, '--seat', seat, '--session', 'reviewer-1', '--file', finding]).data.posted.id, 1);
  assert.equal(cyc(root, '', ['queue', 'wait', '--queue', queue, '--seat', seat, '--session', 'reviewer-1', '--wait-ms', '0']).data.seat.state, 'active');
  assert.equal(cyc(root, '', ['queue', 'board', '--queue', queue, '--seat', seat, '--session', 'reviewer-1']).data.seat.state, 'active');
  // Naming the reviewer does not help a conversation the host knows as someone else.
  assert.match(cyc(root, 'builder', ['queue', 'release', '--queue', queue, '--seat', seat, '--session', 'reviewer-1']).data.error, /belongs to conversation reviewer-1/);
  assert.equal(cyc(root, '', ['queue', 'release', '--queue', queue, '--seat', seat, '--session', 'reviewer-1']).data.released, true);
  assert.equal(readRun(root, run).status, 'running');
});

test('a wait that ends with nothing new says what holds the unit now, not when the wait began', async t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  const waiting = new Promise(done => {
    const child = spawn(process.execPath, [cli, 'queue', 'wait', '--run', run, '--wait-ms', '2500', '--project', root], { env: envOf('builder') });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; });
    child.on('close', () => done(JSON.parse(out)));
  });
  await new Promise(done => setTimeout(done, 700));
  assert.equal(cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', seat]).status, 0);
  const ended = await waiting;
  assert.deepEqual([ended.board, ended.waited], [null, 2500], 'the seat was given up while it waited, so nothing holds the unit');
});

test('a conversation that builds or reviews does not speak as the person, except to relay their answer', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });              // 1
  post(root, queue, { kind: 'question', to: 'person', text: 'May the list drop cancelled orders?' }, { run });      // 2
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is the list sorted?' });                              // 3, from the person
  const file = (name, body) => put(root, `.cyc/runtime/${name}.json`, { version: 1, ...body });
  // Without --run or --seat the builder's and the reviewer's conversations would be the person.
  const asPerson = [
    ['builder', file('n', { kind: 'notice', to: 'all', text: 'Ship it.' }), /works on this queue as unit orders\. Post with --run or --seat/],
    ['builder', file('d', { kind: 'answer', replyTo: 1, disposition: 'declined', text: 'Not needed.' }), /as unit orders\. As the person it may only relay their answer .* message 1 is not one/],
    ['builder', file('q', { kind: 'answer', replyTo: 3, text: 'Yes.' }), /message 3 is not one/],
    ['reviewer', file('f', { kind: 'finding', to: 'orders', text: 'As the person.' }), /works on this queue as reviewer of orders/],
    ['reviewer', file('w', { kind: 'answer', replyTo: 1, disposition: 'fixed', text: 'Fine.' }), /as reviewer of orders\. As the person it may only relay/]
  ];
  for (const [session, path, pattern] of asPerson) { const result = cyc(root, session, ['queue', 'post', '--queue', queue, '--file', path]); assert.equal(result.status, 1); assert.match(result.data.error, pattern); }
  assert.equal(read(root, boardFile(queue)).messages.length, 3);
  // The one thing it may do: pass on what the person answered to a question that waits for them.
  const relayed = cyc(root, 'builder', ['queue', 'post', '--queue', queue, '--file', file('r', { kind: 'answer', replyTo: 2, text: 'The user said: keep them.' })]);
  assert.deepEqual([relayed.status, relayed.data.posted.from], [0, 'person, relayed by unit orders']);
  assert.deepEqual(read(root, boardFile(queue)).messages.at(-1).from, { person: true, relayedBy: 'unit orders' });
  // A conversation with no part in the queue, or a terminal, is simply the person.
  assert.equal(cyc(root, '', ['queue', 'post', '--queue', queue, '--file', file('p', { kind: 'answer', replyTo: 1, disposition: 'declined', text: 'Out of scope.' })]).data.posted.from, 'person');
});

test('a reviewer who gives the seat up frees the unit, and the seat can be taken again', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  handoffs(root, run);
  const released = cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', seat]);
  assert.deepEqual([released.status, released.data.released], [0, true]);
  assert.match(cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', seat]).data.error, /already given up/);
  assert.match(cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', 'ffffffff']).data.error, /has no seat/);
  refused(() => post(root, queue, { kind: 'notice', topic: 'ready-for-review', text: 'Ready.' }, { run }), /No reviewer holds a seat on this unit/);
  const again = seatOf(root, queue, 'third');
  assert.notEqual(again.seat, seat);
  cyc(root, 'third', ['queue', 'release', '--queue', queue, '--seat', again.seat]);
  assert.equal(complete(root, run).status, 'complete');
});

test('a sign-off names the source the reviewer read, and is refused for any other', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), taken = seatOf(root, queue), seat = taken.seat;
  // The builder edits after the reviewer read.
  put(root, 'src/orders/list.txt', 'orders, sorted');
  refused(() => post(root, queue, { kind: 'notice', topic: 'review-done', text: 'Fine.' }, { seat }), /review-done needs sourceHash: the source you read\. It is missing/);
  refused(() => post(root, queue, { kind: 'notice', topic: 'review-done', sourceHash: taken.sourceHash, text: 'Fine.' }, { seat }), /It changed since then; the source is now/);
  assert.deepEqual(states(root, queue), ['active']);
  // Every read tells the reviewer the source as it stands; signing that is accepted.
  const now = cyc(root, 'reviewer', ['queue', 'board', '--queue', queue, '--seat', seat]).data.seat.sourceHash;
  assert.equal(now, sourceSnapshot(root).hash);
  assert.equal(post(root, queue, { kind: 'notice', topic: 'review-done', sourceHash: now, text: 'Read the sorted list.' }, { seat }).posted.sourceHash, now);
  assert.deepEqual(states(root, queue), ['done']);
  assert.equal(readRun(root, run).status, 'running');
});

test('a review receipt from the board is refused until the reviewer has signed off on the source as it stands', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  refused(() => as('builder', () => recordBoardReview(root, run)), /No reviewer has signed off run/);
  const seat = seatOf(root, queue).seat;
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });      // 1
  post(root, queue, { kind: 'finding', to: 'orders', text: 'No empty-list case.' }, { seat });            // 2
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The file name is odd.' }, { seat });          // 3
  refused(() => as('builder', () => recordBoardReview(root, run)), /A reviewer holds the seat on this unit .* and has not signed off/);
  signOff(root, queue, seat, 'Three findings.');                                                           // 4
  refused(() => as('builder', () => recordBoardReview(root, run)), /Findings 1, 2, 3 have no answer/);
  put(root, 'src/orders/list.txt', 'orders, sorted');
  post(root, queue, { kind: 'answer', replyTo: 1, disposition: 'fixed', text: 'Sorted by date.' }, { run });
  post(root, queue, { kind: 'answer', replyTo: 2, disposition: 'declined', text: 'Out of scope, the person says.' });
  post(root, queue, { kind: 'answer', replyTo: 3, disposition: 'withdrawn', text: 'Fine as it is.' }, { seat });
  refused(() => as('builder', () => recordBoardReview(root, run)), /The source changed after the reviewer posted review-done \(message 4\)/);
  assert.deepEqual((readRun(root, run).reviewReceipts ?? []).filter(item => item.status === 'recorded'), [], 'nothing is recorded by a refused call');
  // Asked to look again, the earlier sign-off no longer stands; the new one does, and the receipt is recorded once.
  post(root, queue, { kind: 'notice', topic: 'ready-for-review', text: 'Sorted now.' }, { run });          // 8
  refused(() => as('builder', () => recordBoardReview(root, run)), /A reviewer holds the seat on this unit .* and has not signed off/);
  signOff(root, queue, seat, 'Confirmed sorted.');                                                         // 9
  // A seat given up after its sign-off still counts: the review happened.
  cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', seat]);
  // A later reviewer still at work comes first: the earlier one's receipt waits for it.
  const later = seatOf(root, queue, 'third').seat;
  assert.match(cyc(root, 'builder', ['run', 'review-record', '--run', run, '--from-board']).data.error, new RegExp(`A reviewer holds the seat on this unit \\(seat ${later}\\)`));
  cyc(root, 'third', ['queue', 'release', '--queue', queue, '--seat', later]);
  const receipt = cyc(root, 'builder', ['run', 'review-record', '--run', run, '--from-board']);
  assert.equal(receipt.status, 0, JSON.stringify(receipt.data));
  assert.deepEqual([receipt.data.reviewer, receipt.data.status, receipt.data.sourceHash], ['peer', 'recorded', sourceSnapshot(root).hash]);
  // Each finding says how it was closed and by whom: fixed is resolved, anything else dismissed.
  assert.deepEqual(receipt.data.findings.map(item => [item.id, item.status]), [['board-1', 'resolved'], ['board-2', 'dismissed'], ['board-3', 'dismissed']]);
  assert.match(receipt.data.findings[0].evidence, /fixed by unit orders: Sorted by date\./);
  assert.match(receipt.data.findings[1].evidence, /declined by person: Out of scope/);
  assert.match(receipt.data.findings[2].evidence, new RegExp(`withdrawn by reviewer of orders \\(seat ${seat}\\)`));
  assert.deepEqual(receipt.data.led, { by: 'queue-board', queue, seat, session: 'reviewer', signedOff: 9, findings: [1, 2, 3] });
  assert.match(receipt.data.identity, new RegExp(`review seat ${seat}, session reviewer`));
  // One sign-off, one receipt.
  assert.match(cyc(root, 'builder', ['run', 'review-record', '--run', run, '--from-board']).data.error, /signed off as message 9 is already recorded/);
  assert.equal(readRun(root, run).reviewReceipts.filter(item => item.status === 'recorded').length, 1);
  // The option belongs to this one command, and another conversation cannot record for the run.
  assert.match(cyc(root, 'builder', ['run', 'next', '--run', run, '--from-board']).data.error, /--from-board is only supported by run review-record/);
  assert.match(cyc(root, 'reviewer', ['run', 'review-record', '--run', run, '--from-board']).data.error, /belongs to conversation builder/);
});

test('a seat that lapsed or was given up without a sign-off yields no receipt, and a halted run is named as halted', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  const first = seatOf(root, queue).seat;
  cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', first]);
  refused(() => as('builder', () => recordBoardReview(root, run)), /No reviewer has signed off run/);
  seatOf(root, queue, 'third');
  age(root, queue, 31);
  assert.deepEqual(states(root, queue), ['released', 'lapsed']);
  refused(() => as('builder', () => recordBoardReview(root, run)), /No reviewer has signed off run/);
  // A file outside the unit's paths, which the reviewer signs with the rest: the scope guard halts
  // the capture, and the error says so instead of blaming a source change.
  const seat = seatOf(root, queue).seat;
  put(root, 'src/export/csv.txt', 'changed outside the unit');
  signOff(root, queue, seat);
  refused(() => as('builder', () => recordBoardReview(root, run)), /is halted; the review was not captured/);
  assert.equal(readRun(root, run).status, 'halted');
});

test('a post does not wait for the project lock, two posts at once are both stored, and a board lock left behind is reclaimed', async t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  // The project lock held by a live process, as a long check holds it.
  put(root, '.cyc/runs/workspace.lock', { pid: process.pid, operation: 'a long check', startedAt: new Date().toISOString() });
  const busy = cyc(root, 'person', ['queue', 'decide', '--queue', queue, '--file', put(root, '.cyc/runtime/d.json', { version: 1, action: 'cancel', reason: 'x' })]);
  assert.match(busy.data.error, /another CYC operation \(a long check/, 'the project lock is really held');
  const file = put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'all', text: 'Posted while a check runs.' });
  const posted = cyc(root, 'person', ['queue', 'post', '--queue', queue, '--file', file]);
  assert.deepEqual([posted.status, posted.data.posted.id], [0, 1]);
  assert.equal(cyc(root, 'person', ['queue', 'status', '--queue', queue]).data.board.messages, 1);
  rmSync(join(root, '.cyc/runs/workspace.lock'));
  // Eight posts at the same moment from eight processes.
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => new Promise(done => {
    const child = spawn(process.execPath, [cli, 'queue', 'post', '--queue', queue, '--file', put(root, `.cyc/runtime/c${index}.json`, { version: 1, kind: 'notice', to: 'all', text: `Concurrent ${index}.` }), '--project', root], { env: envOf(`poster-${index}`) });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { out += chunk; });
    child.on('close', code => done({ code, out }));
  })));
  assert.deepEqual(results.map(item => item.code), Array(8).fill(0), results.map(item => item.out).join('\n'));
  const stored = read(root, boardFile(queue)).messages;
  assert.deepEqual(stored.map(message => message.id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(stored.slice(1).map(message => message.text).sort(), Array.from({ length: 8 }, (_, index) => `Concurrent ${index}.`));
  // A lock a dead process left is old and is claimed, whatever it is; a fresh one is respected, and
  // a caller gives up instead of waiting forever.
  const lock = join(root, `.cyc/queues/${queue}/board.lock`), old = new Date(Date.now() - 60000);
  writeFileSync(lock, '');
  utimesSync(lock, old, old);
  assert.equal(post(root, queue, { kind: 'notice', to: 'all', text: 'After a crash.' }).posted.id, 10);
  assert.equal(existsSync(lock), false);
  mkdirSync(lock);
  utimesSync(lock, old, old);
  assert.equal(post(root, queue, { kind: 'notice', to: 'all', text: 'After something odd.' }).posted.id, 11);
  writeFileSync(lock, 'someone else');
  const started = Date.now();
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'x' }), /The queue board is busy/);
  assert.ok(Date.now() - started < 9000, 'it gave up');
  assert.equal(readFileSync(lock, 'utf8'), 'someone else', 'a caller that gave up leaves the holder\'s lock alone');
  rmSync(lock);
  // Board files are controller bookkeeping: a post changes no source hash, and the unit still completes.
  const before = sourceSnapshot(root).hash;
  post(root, queue, { kind: 'notice', to: 'all', text: 'One more.' });
  assert.equal(sourceSnapshot(root).hash, before);
  assert.equal(finishUnit(root, run).status, 'complete');
});

test('queue wait returns as soon as a message arrives, and with nothing after its limit', async t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  const quiet = cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', '300']);
  assert.equal(quiet.status, 0, JSON.stringify(quiet.data));
  assert.deepEqual([quiet.data.board, quiet.data.waited], [null, 300]);
  assert.match(quiet.data.note, /Nothing new arrived/);
  // A message that is already there is returned at once, and marked shown. The reviewer is not
  // shown mail for the unit, only what is for its seat or for all.
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });
  post(root, queue, { kind: 'notice', to: 'orders', text: 'For the builder only.' });
  const ready = cyc(root, 'builder', ['queue', 'wait', '--run', run, '--wait-ms', '5000']);
  assert.deepEqual(ready.data.board.new.map(message => message.id), [1, 2]);
  assert.ok(ready.data.waited < 4000);
  assert.equal(cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', '0']).data.board, null);
  // One that arrives while the reviewer waits ends the wait.
  const started = Date.now();
  const waiting = new Promise(done => {
    const child = spawn(process.execPath, [cli, 'queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', '20000', '--project', root], { env: envOf('reviewer') });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; });
    child.on('close', () => done(JSON.parse(out)));
  });
  await new Promise(done => setTimeout(done, 700));
  post(root, queue, { kind: 'answer', replyTo: 1, disposition: 'fixed', text: 'Sorted by date.' }, { run });
  const woke = await waiting;
  assert.deepEqual(woke.board.new.map(message => [message.id, message.disposition]), [[3, 'fixed']]);
  assert.ok(Date.now() - started < 15000, 'the wait ended on the message, not on its limit');
  assert.equal(cyc(root, 'reviewer', ['queue', 'board', '--queue', queue, '--seat', seat]).data.board, undefined, 'the answer was marked shown');
  // Whose messages to wait for must be said, and the limit is a bounded whole number.
  assert.match(cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue]).data.error, /needs --run or --seat/);
  for (const limit of ['90000', '0x10', '1.5']) assert.match(cyc(root, 'reviewer', ['queue', 'wait', '--queue', queue, '--seat', seat, '--wait-ms', limit]).data.error, /whole number of milliseconds up to 60000/);
});

test('a full board still takes what closes or settles things, and a board file that is not a board is named', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is the list sorted?' });
  const full = read(root, boardFile(queue));
  for (let id = 2; id <= 500; id++) full.messages.push({ id, at: new Date().toISOString(), from: { person: true }, to: 'all', kind: 'notice', text: `Notice ${id}.` });
  put(root, boardFile(queue), full);
  refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'One too many.' }), /holds 500 messages\. Answers are still accepted/);
  // A long first delivery is cut to the newest twenty and says how many came before.
  const shown = cyc(root, 'builder', ['run', 'next', '--run', run]).data.board;
  assert.deepEqual([shown.new.length, shown.earlier, shown.new.at(-1).id], [20, 480, 500]);
  assert.equal(post(root, queue, { kind: 'answer', replyTo: 1, text: 'No.' }, { run }).posted.id, 501, 'an open item can always be closed');
  // ... and the two review notices, or a full board would hold a unit until its seat lapsed.
  assert.equal(post(root, queue, { kind: 'notice', topic: 'ready-for-review', text: 'Ready.' }, { run }).posted.id, 502);
  assert.equal(signOff(root, queue, seat).posted.id, 503);
  // A record with something missing or out of order is refused whole, not read around.
  const good = read(root, boardFile(queue));
  const broken = [
    { ...good, messages: 'none' },
    { ...good, seats: [{ ...good.seats[0], takenAt: undefined }] },
    { ...good, seats: [{ ...good.seats[0], seenAt: 'garbage' }] },
    { ...good, messages: [...good.messages.slice(0, 3), good.messages[1]] },
    { ...good, messages: [{ ...good.messages[0], at: 'yesterday' }] }
  ];
  for (const record of broken) {
    put(root, boardFile(queue), record);
    refused(() => post(root, queue, { kind: 'notice', to: 'all', text: 'x' }), /is not a version 1 board record/);
    assert.match(queueCommand(root, 'status', { queue }).board.error, /is not a version 1 board record/);
  }
  // What a broken board holds is unknown, so the unit does not complete past it.
  handoffs(root, run);
  refused(() => complete(root, run), /is not a version 1 board record/);
});

test('a queue that was edited does not release what its board holds, and a queue with no board holds nothing', t => {
  const edit = (root, queue) => { const file = `.cyc/queues/${queue}/queue.json`, stored = read(root, file); put(root, file, { ...stored, definition: { ...stored.definition, goal: 'Edited.' } }); return () => put(root, file, stored); };
  // No board: an edited queue costs the run nothing, as before the board existed.
  const plain = fixture(t), first = create(plain), free = begin(plain, first);
  handoffs(plain, free.run);
  edit(plain, first);
  assert.equal(complete(plain, free.run).status, 'complete');
  // With a board, what it holds cannot be worked out, so the unit does not complete past it.
  const root = fixture(t), queue = create(root), { run } = begin(root, queue);
  handoffs(root, run);
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' });
  const restore = edit(root, queue);
  refused(() => complete(root, run), /was edited after it was created/);
  refused(() => as('builder', () => finishRun(root, run, { summary: 'x', passedEvidence: 'x' })), /was edited after it was created/);
  assert.equal(readRun(root, run).status, 'running');
  // Put back, the board holds the unit as it should.
  restore();
  refused(() => complete(root, run), /holds this unit: finding 1 from person/);
});

test('a reviewer beside a builder is not blamed at Stop for the builder\'s edits', t => {
  const root = fixture(t), queue = create(root), since = new Date(Date.now() - 1000).toISOString();
  const reading = changeFingerprint(root);
  const { run } = begin(root, queue);
  seatOf(root, queue);
  // The builder edits inside its unit while the reviewer's request is open.
  put(root, 'src/orders/list.txt', 'orders, sorted');
  assert.equal(readRun(root, run).session, 'builder');
  const ready = { status: 'ready' };
  assert.deepEqual(checkRuns({ root, since, packet: ready, session: 'reviewer', fingerprint: reading }), [], 'the builder\'s run accounts for the file');
  // A file outside the builder's unit is nobody's: the reviewer changed it, or someone did.
  put(root, 'src/export/csv.txt', 'changed by the reviewer');
  assert.match(checkRuns({ root, since, packet: ready, session: 'reviewer', fingerprint: reading }).join(' '), /changed during this request without a CYC run for this session \(src\/export\/csv\.txt\)/);
});

test('a question closed with an assumption still takes the answer it was waiting for, once', t => {
  const root = fixture(t), queue = create(root, [unit('orders'), unit('export', { dependsOn: ['orders'] }), unit('notes')]), { run } = begin(root, queue);
  handoffs(root, run);
  post(root, queue, { kind: 'question', to: 'person', text: 'May the list drop cancelled orders?' }, { run });   // 1
  post(root, queue, { kind: 'question', to: 'notes', text: 'Do the notes need the order date?' }, { run });       // 2
  post(root, queue, { kind: 'answer', replyTo: 1, disposition: 'assumed', text: 'Cancelled orders stay.' }, { run });  // 3
  post(root, queue, { kind: 'answer', replyTo: 2, disposition: 'assumed', text: 'No date.' }, { run });               // 4
  // The asker has moved on: it cannot close the question again, or take the one later answer by
  // posting as the person, and nothing holds its unit.
  refused(() => post(root, queue, { kind: 'answer', replyTo: 1, disposition: 'withdrawn', text: 'Never mind.' }, { run }), /You closed question 1 with an assumption/);
  const relay = cyc(root, 'builder', ['queue', 'post', '--queue', queue, '--file', put(root, '.cyc/runtime/relay.json', { version: 1, kind: 'answer', replyTo: 1, text: 'The person agrees.' })]);
  assert.match(relay.data.error, /You closed question 1 with an assumption.*or answer it for them/);
  assert.equal(cyc(root, 'builder', ['run', 'next', '--run', run]).data.board, undefined);
  // The person answers afterwards. The answer is stored and reaches the unit that asked, at its next command.
  const late = post(root, queue, { kind: 'answer', replyTo: 1, text: 'No: drop them.' });
  assert.deepEqual([late.posted.id, late.posted.from, late.posted.to, late.posted.replyTo], [5, 'person', 'orders', 1]);
  assert.deepEqual(cyc(root, 'builder', ['run', 'next', '--run', run]).data.board.new.map(message => [message.id, message.text]), [[5, 'No: drop them.']]);
  assert.equal(cyc(root, 'builder', ['run', 'next', '--run', run]).data.board, undefined, 'a late answer is told once and holds nothing');
  // Once is enough: a second late answer, and one to a question that was withdrawn, are refused.
  refused(() => post(root, queue, { kind: 'answer', replyTo: 1, text: 'Or keep them.' }), /Message 1 is not an open question or finding/);
  post(root, queue, { kind: 'question', to: 'person', text: 'Withdrawn one.' }, { run });                          // 6
  post(root, queue, { kind: 'answer', replyTo: 6, disposition: 'withdrawn', text: 'Not needed.' }, { run });
  refused(() => post(root, queue, { kind: 'answer', replyTo: 6, text: 'Too late.' }), /Message 6 is not an open question or finding/);
  // Only whoever the question was for, or the person, gives the late answer: not a reviewer.
  const seat = seatOf(root, queue).seat;
  refused(() => post(root, queue, { kind: 'answer', replyTo: 2, text: 'I would say yes.' }, { seat }), /Message 2 is for unit notes/);
  cyc(root, 'reviewer', ['queue', 'release', '--queue', queue, '--seat', seat]);
  assert.equal(complete(root, run).status, 'complete');
  // The unit that depends on the asker is told the assumption and what was answered after it.
  const next = cyc(root, 'builder', ['queue', 'next', '--queue', queue]).data;
  assert.deepEqual(next.assumed, [{ unit: 'orders', question: 'May the list drop cancelled orders?', assumed: 'Cancelled orders stay.', answeredLater: { by: 'person', text: 'No: drop them.' } }, { unit: 'orders', question: 'Do the notes need the order date?', assumed: 'No date.' }]);
  // The unit that was asked answers when it runs, although the asker is long done: the answer is then the person's to read.
  const exported = begin(root, queue);
  finishUnit(root, exported.run);
  const notes = begin(root, queue);
  assert.equal(notes.unit, 'notes');
  assert.deepEqual(notes.started.board.new.map(message => [message.id, message.closed?.disposition]), [[2, 'assumed']], 'it is shown the question with the assumption made on it');
  const answered = post(root, queue, { kind: 'answer', replyTo: 2, text: 'Yes, the notes sort by date.' }, { run: notes.run });
  assert.match(answered.note, /Unit orders is done\. This answer is shown to the units that build on it, and on the board/);
  const asked = queueCommand(root, 'board', { queue }).messages.find(message => message.id === 2);
  assert.deepEqual([asked.closed, asked.answeredLater], [{ by: 'unit orders', text: 'No date.', disposition: 'assumed' }, { by: 'unit notes', text: 'Yes, the notes sort by date.' }], 'the board shows the assumption and the answer that came after it');
  assert.ok(queueCommand(root, 'status', { queue }).board.latestForPerson.some(message => message.text === 'Yes, the notes sort by date.'), 'an answer for a unit that is done is shown to the person');
});

test('an answer given after the asker is done reaches the unit that builds on its work, and no other', t => {
  const root = fixture(t), queue = create(root, [unit('orders'), unit('export', { dependsOn: ['orders'] }), unit('notes')]), first = begin(root, queue);
  post(root, queue, { kind: 'question', to: 'person', text: 'May the list drop cancelled orders?' }, { run: first.run });   // 1
  post(root, queue, { kind: 'answer', replyTo: 1, disposition: 'assumed', text: 'Cancelled orders stay.' }, { run: first.run });   // 2
  finishUnit(root, first.run);
  // The unit that builds on it is already running when the person answers.
  const later = begin(root, queue, 'builder-two');
  assert.equal(later.unit, 'export');
  assert.equal(later.started.board, undefined);
  const late = post(root, queue, { kind: 'answer', replyTo: 1, text: 'No: drop them.' });
  assert.match(late.note, /Unit orders is done\. This answer is shown to the units that build on it/);
  assert.deepEqual(cyc(root, 'builder-two', ['run', 'next', '--run', later.run]).data.board.new.map(message => [message.id, message.from, message.text]), [[3, 'person', 'No: drop them.']]);
  assert.equal(cyc(root, 'builder-two', ['run', 'next', '--run', later.run]).data.board, undefined, 'told once');
  // A unit that does not build on the asker is not told.
  finishUnit(root, later.run, 'builder-two');
  const other = begin(root, queue, 'builder-three');
  assert.deepEqual([other.unit, other.started.board], ['notes', undefined]);
});

test('every queue command accepts the conversation naming itself, and a finished queue is named when none is open', t => {
  const root = fixture(t), file = put(root, '.cyc/runtime/Q.json', { version: 1, goal: 'Explain orders.', requirements: 'Explain the order list.', units: [unit('orders')] });
  // The hook tells a conversation to pass --session; a live builder's first command was refused for it.
  const created = cyc(root, 'builder', ['queue', 'create', '--file', file, '--session', 'builder']);
  assert.equal(created.status, 0, JSON.stringify(created.data));
  const queue = created.data.queueId;
  for (const action of ['status', 'next']) assert.deepEqual(cyc(root, 'builder', ['queue', action, '--queue', queue, '--session', 'builder']).data, cyc(root, 'builder', ['queue', action, '--queue', queue]).data, `queue ${action} reads the same with --session`);
  const { run } = begin(root, queue);
  as('builder', () => controlRun(root, run, 'stop'));
  const decided = cyc(root, 'builder', ['queue', 'decide', '--queue', queue, '--session', 'builder', '--file', put(root, '.cyc/runtime/d.json', { version: 1, unit: 'orders', action: 'retry', reason: 'Try again.' })]);
  assert.equal(decided.status, 0, JSON.stringify(decided.data));
  finishUnit(root, begin(root, queue).run);
  // Nothing is open now. The error still says so, and names the queue that just finished.
  for (const action of ['status', 'next']) assert.match(cyc(root, 'builder', ['queue', action]).data.error, new RegExp(`No open queue in this project\\. The last one, ${queue} \\(Explain orders\\.\\), is complete: add --queue ${queue} to read it\\.`));
  assert.equal(cyc(root, 'builder', ['queue', 'status', '--queue', queue]).data.line, 'complete');
  // With no queue at all there is none to name.
  const empty = fixture(t);
  assert.match(cyc(empty, 'builder', ['queue', 'status']).data.error, /^No open queue in this project\. Create one/);
});

test('what holds a unit shows the message that clears it', t => {
  const root = fixture(t), queue = create(root), { run } = begin(root, queue), seat = seatOf(root, queue).seat;
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is it sorted?' });
  post(root, queue, { kind: 'question', to: 'person', text: 'May it be sorted?' }, { run });
  const hold = cyc(root, 'builder', ['run', 'next', '--run', run]).data.board.hold;
  assert.match(hold[0].clear, /\{"version":1,"kind":"answer","replyTo":1,"disposition":"fixed" or "declined","text":"\.\.\."\}/);
  assert.match(hold[1].clear, /\{"version":1,"kind":"answer","replyTo":2,"text":"\.\.\."\}/);
  assert.match(hold[2].clear, /"replyTo":3,"disposition":"assumed".*An answer given later still reaches you/);
  assert.match(hold[3].clear, /"topic":"ready-for-review"/);
  // The message it shows is accepted as written, once its blanks are filled.
  const shown = JSON.parse(hold[1].clear.slice(hold[1].clear.indexOf('{')));
  assert.equal(post(root, queue, { kind: shown.kind, replyTo: shown.replyTo, text: 'No.' }, { run }).posted.replyTo, 2);
});

test('each board command takes only its own options', t => {
  const root = fixture(t), queue = create(root);
  // person and all are who a message can be for, so no unit takes those names.
  for (const name of ['person', 'all']) refused(() => create(root, [unit(name)]), new RegExp(`A unit cannot be named ${name}`));
  const file = put(root, '.cyc/runtime/m.json', { version: 1, kind: 'notice', to: 'all', text: 'x' });
  const cases = [
    [['queue', 'post', '--queue', queue], /queue post needs --file JSON/],
    [['queue', 'board', '--queue', queue, '--file', file], /queue board takes no --file/],
    [['queue', 'board', '--queue', queue, '--run', 'abc'], /queue board does not take --run/],
    [['queue', 'status', '--queue', queue, '--seat', 'abc'], /queue status does not take --seat/],
    [['queue', 'release', '--queue', queue], /queue release needs --seat ID/],
    [['queue', 'shout', '--queue', queue], /the board takes queue post, board, wait and release/],
    [['run', 'list', '--seat', 'abc'], /--seat, --unit and --open are only supported by the queue command/],
    [['queue', 'create', '--file', file, '--queue', queue], /queue create assigns the queue ID/]
  ];
  for (const [args, pattern] of cases) { const result = cyc(root, 'person', args); assert.equal(result.status, 1, args.join(' ')); assert.match(result.data.error, pattern); }
});

test('the guide and the entry skill say what the board does', () => {
  const source = fileURLToPath(new URL('..', import.meta.url));
  const guide = readFileSync(join(source, 'docs/work-queue.md'), 'utf8'), skill = readFileSync(join(source, 'skills/cyc/SKILL.md'), 'utf8');
  for (const phrase of ['queue post', 'queue board', 'queue wait', 'queue next --seat review', 'queue release', 'review-record --from-board', 'needs-answer', 'review-done', 'ready-for-review', 'assumed', 'sourceHash', 'relay']) assert.ok(guide.includes(phrase), `the guide names ${phrase}`);
  for (const phrase of ['queue post', 'queue wait', '--seat review', 'needs-answer']) assert.ok(skill.includes(phrase), `the entry skill names ${phrase}`);
  assert.match(skill, /Never post as the person/);
  const help = spawnSync(process.execPath, [cli, 'help'], { encoding: 'utf8' }).stdout;
  for (const phrase of ['cyc queue post', 'cyc queue board', 'cyc queue wait', '--seat review', 'cyc queue release', '--from-board']) assert.ok(help.includes(phrase), `help names ${phrase}`);
});
