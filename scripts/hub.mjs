import { createServer } from 'node:http';
import { connect } from 'node:net';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { queueCommand, readRun } from './runtime.mjs';
import { hubPage } from './hub-page.mjs';

// The hub: a page on this machine where a person watches a work queue being worked. It reads what
// the controller already records (queue status, the board, run histories) each time it is asked,
// through commands that take no lock, and writes nothing. Reasoning and limits:
// docs/context/work-queue.md.

// A run's history in words a person follows. Events with no entry here are bookkeeping.
const events = {
  started: () => 'started work',
  handoff: event => event.status === 'passed' ? `finished ${{ scout: 'planning', build: 'building', verify: 'checking', deliver: 'the handoff' }[event.stage] ?? event.stage}` : `stopped at ${event.stage}: ${event.status}`,
  'test-proof': event => event.passed ? 'proved its new tests fail on the old code' : 'could not prove its new tests',
  verification: event => `ran the project's checks: ${event.passed ? 'passed' : 'failed'}`,
  'review-recorded': event => `recorded a ${event.reviewer === 'peer' ? 'review by another agent' : 'review'}`,
  'guard-halt': event => `halted: files outside its area changed${event.outOfScope?.length ? ` (${event.outOfScope.slice(0, 3).join(', ')})` : ''}`,
  'attempt-failed': event => `an attempt failed${event.stage ? ` at ${event.stage}` : ''}`,
  exhausted: () => 'ran out of attempts',
  blocked: () => 'is blocked and needs a person',
  retry: event => `went back to ${event.stage}`,
  pause: () => 'was paused', resume: () => 'was resumed', stop: () => 'was stopped',
  complete: () => 'completed'
};
const stages = { scout: 'planning', build: 'building', verify: 'checking', deliver: 'handing off' };
const queueId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/, runId = /\brun [a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\b/g;

// The queues this project holds: a folder named by a queue ID whose record carries the same ID.
function queuesIn(root) {
  const folder = resolve(root, '.cyc/queues');
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory() && queueId.test(entry.name)).flatMap(entry => {
    try {
      const queue = JSON.parse(readFileSync(resolve(folder, entry.name, 'queue.json'), 'utf8'));
      return queue.id === entry.name ? [{ id: queue.id, goal: String(queue.definition.goal), createdAt: String(queue.createdAt), cancelled: queue.status === 'cancelled' }] : [];
    } catch { return []; }
  }).sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
}
// With no queue named: the open one. When several are open or one cannot be read, the one being
// worked, then a halted one, then a ready one; otherwise the last one created.
function chosen(root, queues) {
  try { return queueCommand(root, 'status', {}).queueId; } catch { /* none open, several open, or one unreadable */ }
  const lines = queues.filter(queue => !queue.cancelled).map(queue => { try { return [queue.id, queueCommand(root, 'status', { queue: queue.id }).line]; } catch { return [queue.id, null]; } });
  for (const line of ['in-progress', 'halted', 'ready']) { const hit = lines.findLast(item => item[1] === line); if (hit) return hit[0]; }
  return (queues.findLast(queue => !queue.cancelled) ?? queues.at(-1)).id;
}
// Who a board label names. The board prints these labels; the hub turns them back into a speaker.
function speaker(label) {
  const reviewer = /^reviewer of (\S+)/.exec(label), unit = /^unit (\S+)/.exec(label), relayed = /relayed by (.+)$/.exec(label);
  return reviewer ? { role: 'reviewer', unit: reviewer[1] } : unit ? { role: 'builder', unit: unit[1] } : { role: 'person', ...(relayed ? { relayedBy: relayed[1] } : {}) };
}

// Everything the page shows, read fresh. `wanted` picks a queue.
export function hubState(root, wanted) {
  root = realpathSync(root);
  const queues = queuesIn(root), base = { project: basename(root), at: new Date().toISOString(), queues };
  if (!queues.length) return { ...base, queue: null };
  const id = wanted ?? chosen(root, queues), known = queues.find(queue => queue.id === id);
  let status;
  try { status = queueCommand(root, 'status', { queue: id }); } catch (error) { return { ...base, queue: { id, goal: known?.goal ?? null, error: error.message } }; }
  let board = { messages: [], seats: [] }, boardError = status.board?.error ?? null;
  if (!boardError) try { board = queueCommand(root, 'board', { queue: id }); } catch (error) { boardError = error.message; }
  const seats = board.seats.filter(seat => ['active', 'done'].includes(seat.state));
  const addressee = to => to === 'person' ? { role: 'person' } : to === 'all' ? { role: 'all' } : to.startsWith('seat:') ? { role: 'reviewer', unit: board.seats.find(seat => seat.seat === to.slice(5))?.unit ?? null } : { role: 'builder', unit: to };
  const activity = [];
  const units = status.units.map(unit => {
    // The run that decides the unit: one that has not ended, whichever attempt it is.
    const run = unit.runs.find(attempt => attempt.runId === unit.latest) ?? unit.runs.at(-1), seat = seats.find(entry => entry.unit === unit.id), working = unit.status === 'in-progress';
    for (const attempt of unit.runs) {
      try { for (const event of readRun(root, attempt.runId).history ?? []) if (events[event.type]) activity.push({ at: event.time, unit: unit.id, text: events[event.type](event) }); }
      catch { /* a run whose record cannot be read shows as missing in its unit's status */ }
    }
    return { id: unit.id, outcome: unit.outcome, status: unit.status, ...(unit.reason ? { reason: unit.reason.replace(runId, 'its run') } : {}), ...(unit.waitsOn ? { waitsOn: unit.waitsOn } : {}),
      ...(working && run?.stage ? { doing: stages[run.stage] ?? run.stage } : {}), ...(working && run?.status === 'paused' ? { paused: true } : {}), attempts: unit.runs.length, ...(seat ? { reviewer: seat.state === 'done' ? 'signed off' : 'reviewing' } : {}) };
  });
  const messages = board.messages.map(message => ({ id: message.id, at: message.at, from: speaker(message.from), to: addressee(message.to), kind: message.kind, text: message.text,
    ...Object.fromEntries(['replyTo', 'disposition', 'topic', 'about', 'closed', 'answeredLater'].filter(key => message[key] !== undefined).map(key => [key, message[key]])),
    ...(message.open !== undefined ? { open: message.open, ...(message.for ? { for: message.for } : {}) } : {}) }));
  // What agents wait on the person for. The person's own question, left open because its unit is
  // gone, is not theirs to answer; nothing waits in a cancelled queue.
  const own = new Set(messages.filter(message => message.from.role === 'person').map(message => message.id));
  return { ...base,
    queue: { id, goal: status.goal, line: status.line, done: status.done, total: status.total, ...(boardError ? { boardError } : {}) },
    units, messages,
    waitingOnYou: status.line === 'cancelled' ? [] : (status.board?.forPerson ?? []).map(message => message.id).filter(item => !own.has(item)),
    activity: activity.sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 40) };
}

const headers = type => ({ 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
// Whether something on this machine already answers on the port under a local address. On Windows
// a listener on every address does not stop a second one on 127.0.0.1, which would then take the
// first one's local traffic. A closed port can take seconds to refuse there, so silence is free.
const answers = (port, host) => new Promise(done => {
  const socket = connect({ port, host }), end = taken => { socket.destroy(); done(taken); };
  socket.setTimeout(250, () => end(false)); socket.once('connect', () => end(true)); socket.once('error', () => end(false));
});

// Serves the page and its state on this machine only. Without a port it takes the first free one
// from 4780 to 4799; a port that was asked for and is taken is an error.
export function startHub(root, { port } = {}) {
  root = realpathSync(root);
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) throw new Error('--port is a whole number from 0 to 65535.');
  const text = 'text/plain; charset=utf-8', json = 'application/json; charset=utf-8';
  const server = createServer((request, response) => {
    const send = (code, type, body, more = {}) => { response.writeHead(code, { ...headers(type), ...more }); response.end(body); };
    try {
      // Only this machine's own address: a page elsewhere cannot point a browser's name lookup at the hub.
      const local = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`];
      if (!local.includes(request.headers.host ?? '')) return send(403, text, 'The hub answers only on this machine.');
      if (request.method !== 'GET' && request.method !== 'HEAD') return send(405, text, 'The hub is read-only.', { Allow: 'GET, HEAD' });
      // The address is compared as it was sent and never parsed as a URL: anything else is not found.
      const mark = request.url.indexOf('?'), path = mark < 0 ? request.url : request.url.slice(0, mark);
      if (path === '/') return send(200, 'text/html; charset=utf-8', hubPage);
      if (path !== '/api/state') return send(404, text, 'Not found.');
      const { at, ...state } = hubState(root, (mark < 0 ? null : new URLSearchParams(request.url.slice(mark + 1)).get('queue')) ?? undefined);
      // The tag names what is shown, not when it was read, so a page that already has it is told so.
      const body = JSON.stringify(state), tag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;
      if (request.headers['if-none-match'] === tag) return send(304, json, '', { ETag: tag });
      return send(200, json, `{"at":${JSON.stringify(at)},${body.slice(1)}`, { ETag: tag });
    } catch (error) {
      if (response.headersSent) return response.destroy();
      return send(500, json, JSON.stringify({ error: error.message }));
    }
  });
  return new Promise((done, fail) => {
    const listen = async (candidate, last) => {
      const next = () => candidate < last ? listen(candidate + 1, last) : fail(new Error(port === undefined ? 'Ports 4780 to 4799 are all in use on this machine. Pass a free one with --port.' : `Port ${candidate} is in use. Pass another --port, or leave it out to take a free one.`));
      if (candidate && (await Promise.all(['127.0.0.1', '::1'].map(host => answers(candidate, host)))).some(Boolean)) return next();
      server.once('error', error => error.code === 'EADDRINUSE' ? next() : fail(error));
      server.listen(candidate, '127.0.0.1', () => { server.removeAllListeners('error'); const { address, port: bound } = server.address(); done({ url: `http://127.0.0.1:${bound}/`, host: address, port: bound, project: root, close: () => new Promise(closed => server.close(closed)) }); });
    };
    port === undefined ? listen(4780, 4799) : listen(port, port);
  });
}
