import { randomBytes } from 'node:crypto';
import { strictObject, text } from './task-context.mjs';

// The queue board: where the agents on a queue, and the person, ask, answer and report. An item
// (question or finding) is open until an answer names it; who it is for is read from the unit's
// status each time. Reasoning and limits: docs/context/work-queue.md.
export const seatLapseMs = 30 * 60 * 1000;
const limits = { text: 2000, items: 500, about: 20, shown: 20 };
const kinds = ['question', 'finding', 'answer', 'notice'], topics = ['ready-for-review', 'review-done'];
const openRun = ['running', 'paused', 'blocked'], gone = ['done', 'skipped', 'cancelled'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const item = message => message.kind === 'question' || message.kind === 'finding';
const builder = from => !!from.unit && !from.seat;
const time = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));

function load(io, id) {
  const board = io.readBoard(id) ?? { schemaVersion: 1, queueId: id, messages: [], seats: [], seen: {} };
  const list = (value, check) => Array.isArray(value) && value.every((entry, index) => record(entry) && check(entry, value[index - 1]));
  if (!record(board) || board.schemaVersion !== 1 || board.queueId !== id || !record(board.seen)
    || !list(board.messages, (entry, before) => Number.isInteger(entry.id) && entry.id > (before?.id ?? 0) && kinds.includes(entry.kind) && record(entry.from) && typeof entry.to === 'string' && typeof entry.text === 'string' && time(entry.at))
    || !list(board.seats, entry => typeof entry.id === 'string' && typeof entry.runId === 'string' && typeof entry.unit === 'string' && Array.isArray(entry.keys) && time(entry.takenAt) && (entry.seenAt === undefined || time(entry.seenAt)))) throw Error(`The board of queue ${id} is not a version 1 board record.`);
  return board;
}
const answers = (board, message) => board.messages.filter(entry => entry.kind === 'answer' && entry.replyTo === message.id);
const closing = (board, message) => answers(board, message)[0];
// A question its asker closed with an assumption still takes the answer it was waiting for, once:
// a person often answers after an agent has gone on. It holds no unit meanwhile.
const awaitsLate = (board, message) => { const given = answers(board, message); return message.kind === 'question' && given.length === 1 && given[0].disposition === 'assumed'; };
const lateAnswer = (board, message) => { const given = answers(board, message); return given[0]?.disposition === 'assumed' ? given[1] : undefined; };
const isOpen = (board, message) => item(message) && !closing(board, message);
const unitNamed = (view, id) => ['person', 'all'].includes(id) ? undefined : view.units.find(entry => entry.id === id);
// Nobody answers for a unit that is done, skipped or cancelled: the person does.
function forWhom(message, view) {
  const unit = unitNamed(view, message.to);
  return unit && gone.includes(unit.status) ? 'person' : message.to;
}
const label = from => from.person ? `person${from.relayedBy ? `, relayed by ${from.relayedBy}` : ''}` : from.seat ? `reviewer of ${from.unit} (seat ${from.seat})` : `unit ${from.unit}`;
const brief = (message, board) => {
  const answer = board && item(message) ? closing(board, message) : null;
  return { id: message.id, kind: message.kind, from: label(message.from), to: message.to, text: message.text,
    ...Object.fromEntries(['about', 'replyTo', 'disposition', 'topic', 'sourceHash', 'at'].filter(key => message[key] !== undefined).map(key => [key, message[key]])),
    ...(answer ? { closed: { by: label(answer.from), text: answer.text, ...(answer.disposition ? { disposition: answer.disposition } : {}) } } : {}),
    ...(answer && lateAnswer(board, message) ? { answeredLater: { by: label(lateAnswer(board, message).from), text: lateAnswer(board, message).text } } : {}) };
};

// The reviewer's sign-off stands until the builder asks for another look.
function signedOff(board, seat) {
  const signed = board.messages.findLast(entry => entry.from.seat === seat.id && entry.topic === 'review-done'), asked = board.messages.findLast(entry => entry.topic === 'ready-for-review' && entry.to === `seat:${seat.id}`);
  return { signed: signed && (!asked || signed.id > asked.id) ? signed : null, asked };
}
// Active until the reviewer signs off, gives it up, goes quiet for 30 minutes, or the run ends.
function seatState(board, seat, view, now) {
  if (seat.releasedAt) return { state: 'released' };
  const run = view.runs.find(entry => entry.id === seat.runId);
  if (!run || !openRun.includes(run.status)) return { state: 'ended' };
  const { signed, asked } = signedOff(board, seat);
  if (signed) return { state: 'done' };
  const last = Math.max(Date.parse(seat.takenAt), Date.parse(seat.seenAt ?? seat.takenAt), ...board.messages.filter(entry => entry.from.seat === seat.id).map(entry => Date.parse(entry.at)), asked ? Date.parse(asked.at) : 0);
  return now - last > seatLapseMs ? { state: 'lapsed' } : { state: 'active', lapsesAt: new Date(last + seatLapseMs).toISOString() };
}
const heldSeat = (board, runId, view, now) => board.seats.findLast(seat => seat.runId === runId && ['active', 'done'].includes(seatState(board, seat, view, now).state));
// Who is calling: the session the host reports, or --session when the host reports none.
export const callerKeys = io => io.session ? io.keysOf(io.session) : io.given ? io.keysOf(io.given) : [];
const ownersOf = run => [run.session, run.execution?.conversationId, run.execution?.gateSession].filter(Boolean);
// A seat belongs to the conversation that took it.
function seatOf(io, board, queue, id) {
  const seat = board.seats.find(entry => entry.id === id);
  if (!seat) throw Error(`Queue ${queue.id} has no seat ${JSON.stringify(id)}.`);
  if (!callerKeys(io).some(key => seat.keys.includes(key))) throw Error(`Seat ${seat.id} belongs to conversation ${seat.session}; only it uses the seat.`);
  return seat;
}

// With neither run nor seat it is the person; a conversation working here is marked as relaying.
function authorOf(io, board, queue, view, author, now) {
  if (author.run) {
    const run = author.run;
    if (run.queue?.id !== queue.id) throw Error(`Run ${run.id} is not bound to queue ${queue.id}.`);
    if (!openRun.includes(run.status)) throw Error(`Run ${run.id} is ${run.status}; only a run that has not ended posts for its unit.`);
    return { unit: run.queue.unit, runId: run.id };
  }
  if (author.seat !== undefined) {
    const seat = seatOf(io, board, queue, author.seat), { state } = seatState(board, seat, view, now);
    if (!['active', 'done'].includes(state)) throw Error(`Seat ${seat.id} is ${state}; take a new one with queue next --seat review.`);
    return { unit: seat.unit, seat: seat.id, runId: seat.runId };
  }
  const keys = callerKeys(io), mine = list => list.some(key => keys.includes(key));
  const run = view.runs.find(entry => openRun.includes(entry.status) && mine(ownersOf(entry))), seat = board.seats.find(entry => mine(entry.keys) && ['active', 'done'].includes(seatState(board, entry, view, now).state));
  return { person: true, ...(run ? { relayedBy: `unit ${run.queue.unit}` } : seat ? { relayedBy: `reviewer of ${seat.unit}` } : {}) };
}
// Whether a unit builds on another, directly or through other units.
const buildsOn = (view, id, other, seen = new Set()) => { const unit = view.units.find(entry => entry.id === id); return !!unit && !seen.has(id) && (seen.add(id), unit.dependsOn.some(next => next === other || buildsOn(view, next, other, seen))); };
// An answer given after an assumption, when the unit that assumed is no longer running: the units
// that build on that unit's work are the ones who need it.
const lateForGone = (board, view, message) => { const question = message.kind === 'answer' && board.messages.find(entry => entry.id === message.replyTo); return !!question && lateAnswer(board, question) === message && forWhom(message, view) === 'person' && message.to !== 'person'; };
const sameAuthor = (a, b) => a.person ? !!b.person : a.seat ? a.seat === b.seat : builder(b) && a.unit === b.unit;

export function postMessage(io, { queue, view }, input, author = {}) {
  strictObject(input, ['version', 'to', 'kind', 'text', 'about', 'replyTo', 'disposition', 'topic', 'sourceHash'], 'board message');
  if (input.version !== 1 || !kinds.includes(input.kind)) throw Error(`A message needs version 1 and a kind: ${kinds.join(', ')}.`);
  if (!text(input.text) || input.text.length > limits.text) throw Error(`A message needs text of at most ${limits.text} characters. Point to a file for more.`);
  if (input.about !== undefined && (!Array.isArray(input.about) || input.about.length > limits.about || input.about.some(path => !text(path)))) throw Error(`about lists up to ${limits.about} file paths.`);
  const absent = (...keys) => { const extra = keys.filter(key => input[key] !== undefined); if (extra.length) throw Error(`A ${input.kind}${input.topic ? ` (${input.topic})` : ''} does not take ${extra.join(' or ')}.`); };
  const unitOf = id => unitNamed(view, id);
  const sourceHash = author.seat !== undefined || input.topic ? io.sourceHash() : undefined;
  return io.lockBoard(queue.id, () => {
    const board = load(io, queue.id), now = io.now(), from = authorOf(io, board, queue, view, author, now);
    let to = input.to;
    if (input.topic !== 'review-done') absent('sourceHash');
    if (from.relayedBy && input.kind !== 'answer') throw Error(`This conversation works on this queue as ${from.relayedBy}. Post with --run or --seat.`);
    if (input.kind === 'question') {
      absent('replyTo', 'disposition', 'topic');
      if (to !== 'person' && !unitOf(to)) throw Error('A question needs one addressee: a unit of this queue, or person.');
      if (builder(from) && to === from.unit) throw Error('A unit does not ask itself. Address another unit or person.');
    } else if (input.kind === 'finding') {
      absent('replyTo', 'disposition', 'topic');
      if (builder(from)) throw Error('A finding comes from a review seat or from the person. A builder asks a question or posts a notice.');
      if (!unitOf(to) || from.seat && to !== from.unit) throw Error(from.seat ? `Seat ${from.seat} reviews unit ${from.unit}; its findings are addressed to that unit.` : 'A finding is addressed to one unit of this queue.');
    } else if (input.kind === 'notice') {
      absent('replyTo', 'disposition');
      if (input.topic !== undefined && !topics.includes(input.topic)) throw Error(`A notice's topic is ${topics.join(' or ')}, or left out.`);
      if (input.topic === 'review-done') {
        if (!from.seat) throw Error('Only a review seat posts review-done.');
        if (input.sourceHash !== sourceHash) throw Error(`review-done needs sourceHash: the source you read. ${input.sourceHash ? 'It changed since then' : 'It is missing'}; the source is now ${sourceHash}.`);
        to = from.unit;
      } else if (input.topic === 'ready-for-review') {
        const seat = builder(from) ? heldSeat(board, from.runId, view, now) : null;
        if (!seat) throw Error(builder(from) ? 'No reviewer holds a seat on this unit. A second session takes one with queue next --seat review.' : 'Only the unit\'s builder posts ready-for-review.');
        to = `seat:${seat.id}`;
      } else if (!['person', 'all'].includes(to) && !unitOf(to)) throw Error('A notice is addressed to a unit of this queue, person, or all.');
    } else {
      absent('topic', 'to');
      const target = board.messages.find(entry => entry.id === input.replyTo);
      const late = !!target && awaitsLate(board, target);
      if (!target || !isOpen(board, target) && !late) throw Error(`Message ${JSON.stringify(input.replyTo)} is not an open question or finding of this queue.`);
      const owner = forWhom(target, view);
      if (late && (sameAuthor(target.from, from) || from.relayedBy === `unit ${target.from.unit}`)) throw Error(`You closed question ${target.id} with an assumption. Whoever it was for may still answer it; you cannot close it again, or answer it for them. If the person told you their answer, say so in a notice.`);
      if (from.relayedBy && (target.kind !== 'question' || owner !== 'person')) throw Error(`This conversation works on this queue as ${from.relayedBy}. As the person it may only relay their answer to a question that waits for them; message ${target.id} is not one.`);
      if (sameAuthor(target.from, from)) {
        const allowed = target.kind === 'question' ? ['assumed', 'withdrawn'] : ['withdrawn'];
        if (!allowed.includes(input.disposition)) throw Error(`Closing your own ${target.kind} needs disposition ${allowed.join(' or ')}.`);
      } else if (from.person || builder(from) && owner === from.unit) {
        if (target.kind === 'finding' ? !['fixed', 'declined'].includes(input.disposition) : input.disposition !== undefined) throw Error(target.kind === 'finding' ? 'An answer to a finding needs disposition fixed or declined.' : 'An answer to a question takes no disposition.');
      } else throw Error(`Message ${target.id} is for ${owner === 'person' ? 'the person' : `unit ${owner}`}. Only they, or whoever posted it, may close it.`);
      to = target.from.person ? 'person' : target.from.seat ? `seat:${target.from.seat}` : target.from.unit;
    }
    // A full board still takes answers and the two review notices.
    if (input.kind !== 'answer' && !input.topic && board.messages.filter(entry => entry.kind !== 'answer').length >= limits.items) throw Error(`This board holds ${limits.items} messages. Answers are still accepted; new questions, findings and notices are not.`);
    const message = { id: (board.messages.at(-1)?.id ?? 0) + 1, at: new Date(now).toISOString(), from, to, kind: input.kind, text: input.text,
      ...Object.fromEntries(['about', 'replyTo', 'disposition', 'topic'].filter(key => input[key] !== undefined).map(key => [key, input[key]])), ...(sourceHash ? { sourceHash } : {}) };
    board.messages.push(message);
    io.writeBoard(queue.id, board);
    const owner = forWhom(message, view);
    return { queueId: queue.id, posted: brief(message), ...(owner !== message.to ? { note: lateForGone(board, view, message) ? `Unit ${message.to} is ${unitOf(message.to).status}. This answer is shown to the units that build on it, and on the board.` : `Unit ${message.to} is ${unitOf(message.to).status}, so this is for the person. It shows in queue status.` } : {}) };
  });
}

function inbox(board, view, who) {
  const key = who.seat ? `seat:${who.seat}` : `run:${who.runId}`, seen = board.seen[key] ?? 0;
  const own = from => who.seat ? from.seat === who.seat : builder(from) && from.unit === who.unit;
  const mine = message => !own(message.from) && (message.to === 'all' || (who.seat ? message.to === key : forWhom(message, view) === who.unit || lateForGone(board, view, message) && buildsOn(view, who.unit, message.to)));
  const fresh = board.messages.filter(message => message.id > seen && mine(message) && !(item(message) && closing(board, message) && own(closing(board, message).from)));
  return { key, fresh, last: board.messages.at(-1)?.id ?? 0 };
}
// `mark` moves the read mark; without it nothing is written.
export function deliver(io, { queue, view }, who, { mark = false, run } = {}) {
  const read = board => {
    const { key, fresh, last } = inbox(board, view, who);
    const hold = run && openRun.includes(run.status) ? holds(board, view, run, io.now()) : [];
    return { key, last, moved: (board.seen[key] ?? 0) !== last, result: fresh.length || hold.length ? {
      ...(fresh.length ? { new: fresh.slice(-limits.shown).map(message => brief(message, board)), ...(fresh.length > limits.shown ? { earlier: fresh.length - limits.shown } : {}) } : {}),
      ...(hold.length ? { hold } : {}),
      note: `${fresh.length ? 'Read these before going on. ' : ''}${hold.length ? 'This unit cannot complete until each hold is cleared. ' : ''}Answer with queue post --queue ${queue.id} ${who.seat ? `--seat ${who.seat}` : `--run ${who.runId}`} --file MESSAGE.json.` } : null };
  };
  const first = read(load(io, queue.id));
  if (!mark || !first.moved && !who.seat) return first.result;
  return io.lockBoard(queue.id, () => {
    const board = load(io, queue.id), again = read(board);
    board.seen[again.key] = again.last;
    // Reading keeps a held seat; it does not bring back a lapsed one.
    const seat = who.seat && board.seats.find(entry => entry.id === who.seat);
    if (seat && seatState(board, seat, view, io.now()).state === 'active') seat.seenAt = new Date(io.now()).toISOString();
    io.writeBoard(queue.id, board);
    return again.result;
  });
}

// What keeps a bound run from completing.
export function holds(board, view, run, now) {
  const unit = run.queue.unit, out = [];
  for (const message of board.messages) {
    if (!isOpen(board, message)) continue;
    const own = builder(message.from) && message.from.unit === unit;
    if (!own && forWhom(message, view) === unit) out.push({ message: message.id, kind: message.kind, from: label(message.from), text: message.text, clear: `Post {"version":1,"kind":"answer","replyTo":${message.id},${message.kind === 'finding' ? '"disposition":"fixed" or "declined",' : ''}"text":"..."}` });
    else if (own && message.kind === 'question') out.push({ message: message.id, kind: 'question', from: 'this unit', text: message.text, clear: `Wait for the answer with queue wait, or go on: post {"version":1,"kind":"answer","replyTo":${message.id},"disposition":"assumed","text":"what you assumed"}. An answer given later still reaches you.` });
  }
  for (const seat of board.seats) {
    if (seat.runId !== run.id) continue;
    const { state, lapsesAt } = seatState(board, seat, view, now);
    if (state === 'active') out.push({ seat: seat.id, from: `reviewer of ${unit}`, text: 'A reviewer holds the review seat and has not posted review-done.', lapsesAt, clear: 'When the work is ready, post {"version":1,"kind":"notice","topic":"ready-for-review","text":"..."}, then queue wait. The seat also clears on release or after 30 quiet minutes.' });
  }
  return out;
}
export const boardHolds = (io, { queue, view }, run) => holds(load(io, queue.id), view, run, io.now());
export const hasBoard = (io, id) => io.readBoard(id) !== null;

export function boardSummary(io, { queue, view }) {
  const board = load(io, queue.id), now = io.now();
  if (!board.messages.length && !board.seats.length) return null;
  const open = board.messages.filter(message => isOpen(board, message)), theirs = message => forWhom(message, view) === 'person';
  const seats = board.seats.map(seat => ({ seat: seat.id, unit: seat.unit, runId: seat.runId, takenAt: seat.takenAt, ...seatState(board, seat, view, now) })).filter(seat => ['active', 'done'].includes(seat.state));
  const said = board.messages.filter(message => message.kind === 'notice' && theirs(message) || message.kind === 'answer' && !message.from.person && (theirs(message) && message.to !== message.from.unit || message.disposition === 'assumed' && theirs(board.messages.find(entry => entry.id === message.replyTo)))).slice(-5).map(message => brief(message));
  return { messages: board.messages.length, open: open.length, forPerson: open.filter(theirs).map(message => brief(message)), ...(said.length ? { latestForPerson: said } : {}), ...(seats.length ? { seats } : {}),
    ...(open.some(theirs) ? { note: 'These wait for the person. Show them to the user and post only their answer. Do not answer for them.' } : {}) };
}

export function assumptions(io, { queue }, units) {
  const board = load(io, queue.id);
  return board.messages.filter(message => message.disposition === 'assumed' && builder(message.from) && units.includes(message.from.unit))
    .map(message => { const question = board.messages.find(entry => entry.id === message.replyTo), later = question && lateAnswer(board, question); return { unit: message.from.unit, question: question?.text ?? null, assumed: message.text, ...(later ? { answeredLater: { by: label(later.from), text: later.text } } : {}) }; });
}

export function readBoard(io, { queue, view }, { unit, open = false } = {}) {
  if (unit !== undefined && !view.units.some(entry => entry.id === unit)) throw Error(`Queue ${queue.id} has no unit ${JSON.stringify(unit)}.`);
  const board = load(io, queue.id), now = io.now();
  const about = message => unit === undefined || message.to === unit || message.from.unit === unit;
  const shown = board.messages.filter(message => about(message) && (!open || isOpen(board, message)));
  return { queueId: queue.id, messages: shown.map(message => ({ ...brief(message, board), ...(item(message) ? { open: isOpen(board, message), ...(isOpen(board, message) && forWhom(message, view) !== message.to ? { for: forWhom(message, view) } : {}) } : {}) })),
    seats: board.seats.map(seat => ({ seat: seat.id, unit: seat.unit, runId: seat.runId, takenAt: seat.takenAt, ...seatState(board, seat, view, now) })) };
}
export function seatView(io, { queue, view }, id) {
  const board = load(io, queue.id), seat = seatOf(io, board, queue, id);
  return { who: { seat: seat.id, unit: seat.unit }, seat: { id: seat.id, unit: seat.unit, ...seatState(board, seat, view, io.now()), sourceHash: io.sourceHash() } };
}

export function takeSeat(io, { queue, view }, { seat, session }) {
  if (seat !== 'review') throw Error('The only seat is review: queue next --seat review.');
  if (session !== undefined && !/^[A-Za-z0-9_-]{4,80}$/.test(session)) throw Error('--session is 4 to 80 letters, digits, underscores or dashes.');
  const sessions = [...new Set([session, io.session].filter(Boolean))];
  if (!sessions.length) throw Error('A seat needs the conversation\'s session: pass --session ID.');
  const unit = view.units.find(entry => entry.status === 'in-progress');
  if (!unit) throw Object.assign(Error(`No unit of queue ${queue.id} is in progress, so there is nothing to review. --wait-ms N waits for one.`), { code: 'CYC_NO_UNIT' });
  const run = view.runs.find(entry => entry.id === unit.latest), keys = callerKeys({ ...io, given: session });
  if (sessions.flatMap(io.keysOf).some(key => ownersOf(run).includes(key))) throw Error(`This session builds unit ${unit.id}. Its review seat is for another session.`);
  const source = io.source(), started = run.initialSource?.files ?? {};
  const changed = [...new Set([...Object.keys(started), ...Object.keys(source.files)])].filter(path => started[path] !== source.files[path]).sort();
  const taken = io.lockBoard(queue.id, () => {
    const board = load(io, queue.id), now = io.now(), held = heldSeat(board, run.id, view, now);
    if (held) {
      if (keys.some(key => held.keys.includes(key))) return held;
      throw Error(`The review seat on unit ${unit.id} is held (seat ${held.id}, taken ${held.takenAt}). It frees when its reviewer gives it up${seatState(board, held, view, now).state === 'done' ? '' : ' or goes quiet for 30 minutes'}, or the run ends.`);
    }
    const entry = { id: randomBytes(4).toString('hex'), seat: 'review', unit: unit.id, runId: run.id, session: io.session ?? session, keys, takenAt: new Date(now).toISOString() };
    board.seats.push(entry);
    io.writeBoard(queue.id, board);
    return entry;
  });
  const definition = queue.definition.units.find(entry => entry.id === unit.id);
  return { queueId: queue.id, seat: taken.id, unit: { id: unit.id, outcome: definition.outcome, criteria: definition.criteria, paths: definition.paths }, runId: run.id, sourceHash: source.hash, changed: changed.slice(0, 200), changedTotal: changed.length,
    post: `queue post --queue ${queue.id} --seat ${taken.id}${io.session ? '' : ` --session ${session}`} --file MESSAGE.json`, wait: `queue wait --queue ${queue.id} --seat ${taken.id}${io.session ? '' : ` --session ${session}`}`,
    instruction: `You review unit ${unit.id} while another session builds it. Read the changed files against the criteria. Change no file and start no run. Post each defect as {"version":1,"kind":"finding","to":"${unit.id}","text":"..."}; read answers with queue wait. End with {"version":1,"kind":"notice","topic":"review-done","sourceHash":"<the one you last read>","text":"..."}. To stop early: queue release.` };
}

export function releaseSeat(io, { queue }, { seat: id }) {
  return io.lockBoard(queue.id, () => {
    const board = load(io, queue.id), seat = seatOf(io, board, queue, id);
    if (seat.releasedAt) throw Error(`Seat ${seat.id} was already given up.`);
    seat.releasedAt = new Date(io.now()).toISOString();
    io.writeBoard(queue.id, board);
    return { queueId: queue.id, seat: seat.id, unit: seat.unit, released: true };
  });
}

// The input of one peer receipt for the review a seat led.
export function boardReview(io, { queue, view }, run, sourceHash) {
  const board = load(io, queue.id), busy = board.seats.find(entry => entry.runId === run.id && seatState(board, entry, view, io.now()).state === 'active');
  if (busy) throw Error(`A reviewer holds the seat on this unit (seat ${busy.id}) and has not signed off. Record the review after its review-done.`);
  const seat = board.seats.findLast(entry => entry.runId === run.id && signedOff(board, entry).signed);
  if (!seat) throw Error(`No reviewer has signed off run ${run.id}. A reviewer ends with a review-done notice; a later ready-for-review needs a new one.`);
  const { signed } = signedOff(board, seat);
  const findings = board.messages.filter(message => message.kind === 'finding' && message.from.seat === seat.id), unanswered = findings.filter(message => isOpen(board, message));
  if (unanswered.length) throw Error(`Findings ${unanswered.map(message => message.id).join(', ')} have no answer. Answer each with disposition fixed or declined first.`);
  if (signed.sourceHash !== sourceHash) throw Error(`The source changed after the reviewer posted review-done (message ${signed.id}). Post ready-for-review and wait for a new review-done.`);
  return { evidence: `Peer review led through the queue board by seat ${seat.id} (session ${seat.session}): ${findings.length} finding${findings.length === 1 ? '' : 's'}, each closed on the board as listed; the reviewer signed off as message ${signed.id} on source ${sourceHash.slice(0, 12)}: ${signed.text}`.slice(0, 4000),
    identity: `review seat ${seat.id}, session ${seat.session}`,
    findings: findings.map(message => { const answer = closing(board, message); return { id: `board-${message.id}`, status: answer.disposition === 'fixed' ? 'resolved' : 'dismissed', evidence: `Finding: ${message.text} | ${answer.disposition} by ${label(answer.from)}: ${answer.text}`.slice(0, 4000) }; }),
    led: { by: 'queue-board', queue: queue.id, seat: seat.id, session: seat.session, signedOff: signed.id, findings: findings.map(message => message.id) } };
}
