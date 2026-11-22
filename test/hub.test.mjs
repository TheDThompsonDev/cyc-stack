import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer as listener } from 'node:net';
import { Script, createContext } from 'node:vm';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { completeRun, controlRun, queueCommand, quickHandoff, sourceSnapshot } from '../scripts/runtime.mjs';
import { hubState, startHub } from '../scripts/hub.mjs';
import { hubPage } from '../scripts/hub-page.mjs';

// The hub: a page on this machine where a person watches a queue being worked. These tests drive
// the real server and the real controller in temporary projects. What the page looks like is
// judged by rendering it, which no test here does; they fix what it is given and what it may not do.
process.env.CYC_BASELINE_MODE = 'off';
process.env.CYC_SESSION = 'person';
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/cyc.mjs');
const put = (root, name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content)); return path; };
const envOf = session => ({ ...process.env, CYC_SESSION: session, CLAUDE_CODE_SESSION_ID: '', CODEX_THREAD_ID: '' });
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-hub-'));
  t.after(() => { assert.ok(root.includes('cyc-hub-')); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  put(root, '.cyc/config.json', { schemaVersion: 1, limits: { maxAttempts: 3, maxNoProgress: 2 }, verification: { commands: [{ id: 'checks', command: process.execPath, args: ['-e', 'process.exit(0)'], timeoutMs: 5000 }] } });
  put(root, 'src/orders/list.txt', 'orders');
  put(root, 'src/export/csv.txt', 'csv');
  return root;
}
const unit = (id, extra = {}) => ({ id, outcome: `The ${id} behavior is explained.`, playbook: 'investigation', criteria: [{ id: 'explained', description: `The ${id} behavior is explained from the code.` }], paths: [`src/${id}`], dependsOn: [], ...extra });
const create = (root, goal = 'Explain how orders are exported.') => queueCommand(root, 'create', { version: 1, goal, requirements: 'Explain the order list, then the export.', units: [unit('orders'), unit('export', { dependsOn: ['orders'] })] }).queueId;
function cyc(root, session, args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--project', root], { encoding: 'utf8', env: envOf(session) });
  let data; try { data = JSON.parse(result.stdout || result.stderr); } catch { data = { raw: result.stdout + result.stderr }; }
  return { status: result.status, data };
}
const as = (session, work) => { const before = process.env.CYC_SESSION; process.env.CYC_SESSION = session; try { return work(); } finally { process.env.CYC_SESSION = before; } };
function begin(root, queue, session = 'builder') {
  const next = cyc(root, session, ['queue', 'next', '--queue', queue]);
  const started = cyc(root, session, ['run', 'start', '--file', join(root, next.data.startTemplate)]);
  assert.equal(started.status, 0, JSON.stringify(started.data));
  return started.data.runId;
}
const post = (root, queue, message, author = {}) => as(author.seat !== undefined ? 'reviewer' : author.run !== undefined ? 'builder' : 'person', () => queueCommand(root, 'post', { queue, message: { version: 1, ...message }, ...author }));
const finish = (root, run) => as('builder', () => { quickHandoff(root, run, { summary: 'Read the code for this unit.' }); quickHandoff(root, run, { summary: 'Explained the behavior from the code.', passedEvidence: 'Read the file this unit names.' }); return completeRun(root, run); });
// One request, with whatever Host and method the case needs.
const ask = (port, path, { host, method = 'GET', headers = {} } = {}) => new Promise((done, fail) => {
  const call = request({ host: '127.0.0.1', port, path, method, headers: { ...(host ? { Host: host } : {}), ...headers } }, reply => { let body = ''; reply.setEncoding('utf8'); reply.on('data', chunk => { body += chunk; }); reply.on('end', () => done({ status: reply.statusCode, headers: reply.headers, body })); });
  call.on('error', fail); call.end();
});
const files = folder => readdirSync(folder, { withFileTypes: true, recursive: true }).filter(entry => entry.isFile()).map(entry => { const path = join(entry.parentPath ?? entry.path, entry.name); return `${path}:${statSync(path).size}:${statSync(path).mtimeMs}`; }).sort();

test('the hub serves its page and the state on this machine only, and nothing else', async t => {
  const root = fixture(t), hub = await startHub(root, { port: 0 });
  t.after(() => hub.close());
  assert.match(hub.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.equal(hub.host, '127.0.0.1', 'bound to this machine only, not to every address');
  const page = await ask(hub.port, '/');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.equal(page.body, hubPage);
  const state = await ask(hub.port, '/api/state');
  // Every header the hub sets, exactly: nothing that lets another site read it or loosens what the page may load.
  const sent = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
  const own = reply => Object.fromEntries(Object.entries(reply.headers).filter(([name]) => !['date', 'connection', 'keep-alive', 'transfer-encoding', 'content-length'].includes(name)));
  assert.deepEqual(own(page), { 'content-type': 'text/html; charset=utf-8', ...sent });
  assert.deepEqual(own(state), { 'content-type': 'application/json; charset=utf-8', ...sent, etag: state.headers.etag });
  assert.equal(state.status, 200);
  assert.match(state.headers['content-type'], /^application\/json/);
  assert.equal(JSON.parse(state.body).queue, null);
  // Reached under any other name, it refuses: a page elsewhere cannot aim a browser at it.
  for (const host of ['evil.example', `evil.example:${hub.port}`, `127.0.0.1:${hub.port + 1}`, '']) {
    const foreign = await ask(hub.port, '/api/state', { host: host || ' ' });
    assert.equal(foreign.status, 403, `Host ${JSON.stringify(host)}`);
    assert.doesNotMatch(foreign.body, /queue/);
  }
  assert.equal((await ask(hub.port, '/api/state', { host: `localhost:${hub.port}` })).status, 200);
  // It only answers reads, and only its two addresses.
  for (const method of ['POST', 'PUT', 'DELETE']) { const refused = await ask(hub.port, '/api/state', { method }); assert.deepEqual([refused.status, refused.headers.allow], [405, 'GET, HEAD']); }
  for (const path of ['/api', '/api/state/x', '/api/state/', '/API/STATE', '/index.html', '/hub-page.mjs', '/../package.json', '/.cyc/config.json']) assert.equal((await ask(hub.port, path)).status, 404, path);
  // An address that is no address is refused, and the hub is still there afterwards.
  for (const path of ['//', '//a:99999999/', '//[', 'http://', '//evil.example/api/state']) {
    assert.ok([400, 404].includes((await ask(hub.port, path)).status), path);
    assert.equal((await ask(hub.port, '/api/state')).status, 200, `still answering after ${path}`);
  }
  // A page that already holds what would be sent is told so; once something changes it is sent again.
  const same = await ask(hub.port, '/api/state', { headers: { 'If-None-Match': state.headers.etag } });
  assert.deepEqual([same.status, same.body, same.headers.etag], [304, '', state.headers.etag]);
  create(root);
  const later = await ask(hub.port, '/api/state', { headers: { 'If-None-Match': state.headers.etag } });
  assert.deepEqual([later.status, later.headers.etag === state.headers.etag, JSON.parse(later.body).queue.total], [200, false, 2]);
});

test('a port that was asked for and is taken is an error, and a port must be a port', async t => {
  const root = fixture(t), first = await startHub(root, { port: 0 });
  t.after(() => first.close());
  await assert.rejects(() => startHub(root, { port: first.port }), new RegExp(`Port ${first.port} is in use`));
  for (const port of [-1, 70000, 1.5, NaN]) assert.throws(() => startHub(root, { port }), /--port is a whole number from 0 to 65535/);
  // Something that answers on the machine's other local address holds the port too.
  const held = (port, host) => new Promise(done => { const other = listener(); other.once('error', () => done(null)); other.listen(port, host, () => done(other)); });
  const six = await held(0, '::1');
  if (six) {
    t.after(() => six.close());
    await assert.rejects(() => startHub(root, { port: six.address().port }), new RegExp(`Port ${six.address().port} is in use`));
  }
  // With no port it takes a free one from 4780 to 4799, and says so when none is left.
  const found = await startHub(root);
  t.after(() => found.close());
  assert.ok(found.port >= 4780 && found.port <= 4799, `took ${found.port}`);
  const another = await startHub(root);
  t.after(() => another.close());
  assert.ok(another.port >= 4780 && another.port <= 4799 && another.port !== found.port, `took ${another.port} next`);
  for (let port = 4780; port <= 4799; port++) { const taken = await held(port, '127.0.0.1'); if (taken) t.after(() => taken.close()); }
  await assert.rejects(() => startHub(root), /Ports 4780 to 4799 are all in use on this machine\. Pass a free one with --port/);
  // The command prints its address and stays up until it is stopped.
  const child = spawn(process.execPath, [cli, 'hub', '--project', root, '--port', '0'], { env: envOf('person') });
  t.after(() => child.kill());
  const printed = await new Promise((done, fail) => { let out = ''; child.stdout.on('data', chunk => { out += chunk; try { done(JSON.parse(out)); } catch { /* more to come */ } }); child.on('exit', code => fail(new Error(`hub exited ${code}: ${out}`))); });
  assert.equal(printed.ok, true);
  assert.match(printed.note, /this machine only and changes nothing/);
  const port = Number(new URL(printed.url).port);
  assert.equal((await ask(port, '/api/state')).status, 200);
  assert.equal(child.exitCode, null, 'it is still running');
  assert.match(cyc(root, 'person', ['hub', '--port', 'abc']).data.error, /--port is a whole number/);
  assert.match(cyc(root, 'person', ['hub', 'status']).data.error, /cyc hub takes only --project and --port, not status/);
  assert.match(cyc(root, 'person', ['hub', '--session', 'x', '--port', '0']).data.error, /cyc hub takes only --project and --port, not --session/);
  assert.match(cyc(root, 'person', ['queue', 'status', '--port', '4780']).data.error, /--port is only supported by hub/);
});

test('the state holds the line, what the agents said and to whom, what waits on the person, and what the runs did', t => {
  const root = fixture(t);
  assert.deepEqual([hubState(root).queue, hubState(root).queues], [null, []]);
  const queue = create(root);
  let state = hubState(root);
  assert.deepEqual([state.project.startsWith('cyc-hub-'), state.queue.goal, state.queue.line, state.queue.done, state.queue.total], [true, 'Explain how orders are exported.', 'ready', 0, 2]);
  assert.deepEqual(state.units.map(item => [item.id, item.status, item.waitsOn ?? null, item.attempts]), [['orders', 'ready', null, 0], ['export', 'waiting', ['orders'], 0]]);
  assert.deepEqual([state.messages, state.waitingOnYou, state.activity], [[], [], []]);
  const run = begin(root, queue);
  post(root, queue, { kind: 'question', to: 'person', text: 'May the list drop `cancelled` orders?' }, { run });   // 1
  post(root, queue, { kind: 'question', to: 'orders', text: 'Is the list sorted?' });                              // 2
  const seat = cyc(root, 'reviewer', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'reviewer']).data.seat;
  post(root, queue, { kind: 'finding', to: 'orders', text: 'The list is never sorted.' }, { seat });               // 3
  post(root, queue, { kind: 'answer', replyTo: 3, disposition: 'fixed', text: 'Sorted by date.' }, { run });       // 4
  state = hubState(root);
  assert.deepEqual(state.units[0], { id: 'orders', outcome: 'The orders behavior is explained.', status: 'in-progress', doing: 'planning', attempts: 1, reviewer: 'reviewing' });
  assert.deepEqual(state.messages.map(item => [item.id, item.from, item.to, item.kind, item.open ?? null]), [
    [1, { role: 'builder', unit: 'orders' }, { role: 'person' }, 'question', true],
    [2, { role: 'person' }, { role: 'builder', unit: 'orders' }, 'question', true],
    [3, { role: 'reviewer', unit: 'orders' }, { role: 'builder', unit: 'orders' }, 'finding', false],
    [4, { role: 'builder', unit: 'orders' }, { role: 'reviewer', unit: 'orders' }, 'answer', null]]);
  assert.deepEqual([state.messages[2].closed, state.messages[3].replyTo, state.messages[3].disposition], [{ by: 'unit orders', text: 'Sorted by date.', disposition: 'fixed' }, 3, 'fixed']);
  assert.equal(state.messages[0].text, 'May the list drop `cancelled` orders?', 'what an agent wrote is passed on as written');
  assert.deepEqual(state.waitingOnYou, [1], 'the question for the person, and not the one the person asked');
  assert.deepEqual(state.activity.map(item => [item.unit, item.text]), [['orders', 'started work']]);
  // What happens next is in the next read, with nothing restarted. The person's answer is relayed by the builder.
  assert.equal(cyc(root, 'builder', ['queue', 'post', '--queue', queue, '--file', put(root, '.cyc/runtime/relay.json', { version: 1, kind: 'answer', replyTo: 1, text: 'The user said: no, keep them.' })]).status, 0);
  post(root, queue, { kind: 'answer', replyTo: 2, text: 'By date now.' }, { run });
  post(root, queue, { kind: 'notice', topic: 'review-done', sourceHash: sourceSnapshot(root).hash, text: 'Nothing more.' }, { seat });
  state = hubState(root);
  assert.deepEqual([state.messages.length, state.waitingOnYou, state.units[0].reviewer, state.messages[0].open], [7, [], 'signed off', false]);
  assert.deepEqual([state.messages[4].from, state.messages[4].to], [{ role: 'person', relayedBy: 'unit orders' }, { role: 'builder', unit: 'orders' }], 'a relayed answer is the person speaking, and says who carried it');
  // The stage moves with the run, and a paused run is not shown as working.
  as('builder', () => quickHandoff(root, run, { summary: 'Read the code for this unit.' }));
  assert.notEqual(hubState(root).units[0].doing, 'planning');
  as('builder', () => controlRun(root, run, 'pause'));
  assert.deepEqual([hubState(root).units[0].status, hubState(root).units[0].paused], ['in-progress', true]);
  as('builder', () => controlRun(root, run, 'resume'));
  assert.equal(hubState(root).units[0].paused, undefined);
  as('builder', () => { quickHandoff(root, run, { summary: 'Explained the behavior from the code.', passedEvidence: 'Read the file this unit names.' }); completeRun(root, run); });
  state = hubState(root);
  assert.deepEqual(state.units.map(item => [item.id, item.status, item.reviewer ?? null]), [['orders', 'done', null], ['export', 'ready', null]]);
  assert.deepEqual([state.activity[0].text, state.activity.at(-1).text, state.activity.filter(item => !/paused|resumed/.test(item.text)).length], ['completed', 'started work', 4]);
  assert.ok(state.activity.every((item, index, all) => !index || item.at <= all[index - 1].at), 'newest first');
  // A unit that halts says why.
  const second = begin(root, queue);
  post(root, queue, { kind: 'question', to: 'person', text: 'Asked before this unit halts.' }, { run: second });   // 8
  post(root, queue, { kind: 'question', to: 'export', text: 'Asked by the person before this unit halts.' });       // 9
  as('builder', () => controlRun(root, second, 'stop'));
  state = hubState(root);
  assert.deepEqual([state.messages[8].from, state.messages[8].open, state.waitingOnYou], [{ role: 'person' }, true, [8]]);
  assert.deepEqual([state.queue.line, state.units[1].status, typeof state.units[1].reason, state.units[1].attempts], ['halted', 'halted', 'string', 1]);
  assert.ok(state.activity.some(item => item.unit === 'export' && item.text === 'was stopped'));
  // A run whose record is gone: the reason is given without an ID nobody can act on.
  rmSync(join(root, '.cyc/runs', second), { recursive: true, force: true });
  state = hubState(root);
  assert.equal(state.units[1].reason, 'The record of its run is missing or unreadable, so how it ended is unknown.');
  // Nothing waits on the person in a cancelled queue.
  // Once the unit is skipped, nobody is left to answer the person's own question. The controller
  // lists it for the person; on the page it is not theirs to answer.
  queueCommand(root, 'decide', { queue, version: 1, unit: 'export', action: 'skip', reason: 'Its record was lost.' });
  assert.deepEqual(queueCommand(root, 'status', { queue }).board.forPerson.map(item => item.id), [8, 9]);
  assert.deepEqual(hubState(root).waitingOnYou, [8]);
  queueCommand(root, 'decide', { queue, version: 1, action: 'cancel', reason: 'Stop the line.' });
  state = hubState(root, queue);
  assert.deepEqual([state.queue.line, state.waitingOnYou], ['cancelled', []]);
});

test('with no open queue the hub shows the last one, a named queue can be picked, and what cannot be read is named', t => {
  const root = fixture(t), first = create(root, 'First goal.');
  const run = begin(root, first);
  post(root, first, { kind: 'notice', to: 'all', text: 'From the first queue.' }, { run });
  finish(root, run); finish(root, begin(root, first));
  assert.deepEqual([hubState(root).queue.id, hubState(root).queue.line], [first, 'complete'], 'a finished queue is still shown');
  const second = create(root, 'Second goal.');
  assert.deepEqual([hubState(root).queue.goal, hubState(root).queues.map(item => item.goal)], ['Second goal.', ['First goal.', 'Second goal.']]);
  // With several open, the one being worked is shown, not the one created last.
  const third = create(root, 'Third goal.');
  assert.equal(hubState(root).queue.goal, 'Third goal.', 'none is being worked: the last one created');
  const working = begin(root, second);
  assert.equal(hubState(root).queue.goal, 'Second goal.', 'the one in progress');
  as('builder', () => controlRun(root, working, 'stop'));
  assert.equal(hubState(root).queue.goal, 'Second goal.', 'the halted one, before one that is only ready');
  queueCommand(root, 'decide', { queue: second, version: 1, unit: 'orders', action: 'retry', reason: 'Start it again.' });
  queueCommand(root, 'decide', { queue: third, version: 1, action: 'cancel', reason: 'Not needed.' });
  assert.deepEqual([hubState(root).queue.goal, hubState(root).queues.at(-1).cancelled], ['Second goal.', true]);
  // A folder that is not a queue, or holds another queue's record, is not listed.
  put(root, '.cyc/queues/notes/queue.json', JSON.parse(readFileSync(join(root, `.cyc/queues/${second}/queue.json`), 'utf8')));
  put(root, '.cyc/queues/11111111-1111-4111-8111-111111111111/queue.json', JSON.parse(readFileSync(join(root, `.cyc/queues/${second}/queue.json`), 'utf8')));
  assert.deepEqual(hubState(root).queues.map(item => item.goal), ['First goal.', 'Second goal.', 'Third goal.']);
  assert.deepEqual([hubState(root, first).queue.goal, hubState(root, first).messages.length, hubState(root, first).messages[0].to], ['First goal.', 1, { role: 'all' }]);
  // A board that is not a board: the line is still shown, and the fault is named.
  put(root, `.cyc/queues/${second}/board.json`, { messages: 'none' });
  const broken = hubState(root, second);
  assert.match(broken.queue.boardError, /is not a version 1 board record/);
  assert.deepEqual([broken.units.length, broken.messages], [2, []]);
  // A queue that cannot be read at all, and one that does not exist.
  const file = `.cyc/queues/${second}/queue.json`, stored = JSON.parse(readFileSync(join(root, file), 'utf8'));
  put(root, file, { ...stored, definition: { ...stored.definition, goal: 'Edited.' } });
  assert.match(hubState(root, second).queue.error, /was edited after it was created/);
  assert.match(hubState(root, '00000000-0000-4000-8000-000000000000').queue.error, /No queue 00000000/);
  assert.match(hubState(root, '../../etc').queue.error, /valid --queue ID/);
});

test('watching changes nothing: no file is written, the source is the same, and no read mark moves', async t => {
  const root = fixture(t), queue = create(root), run = begin(root, queue);
  post(root, queue, { kind: 'notice', to: 'orders', text: 'For the builder, not yet shown to it.' });
  const seat = cyc(root, 'reviewer', ['queue', 'next', '--queue', queue, '--seat', 'review', '--session', 'reviewer']).data.seat;
  post(root, queue, { kind: 'question', to: 'orders', text: 'For the builder too.' }, { seat });
  const hub = await startHub(root, { port: 0 });
  t.after(() => hub.close());
  const before = { files: files(root), source: sourceSnapshot(root).hash, board: readFileSync(join(root, `.cyc/queues/${queue}/board.json`), 'utf8') };
  for (let read = 0; read < 12; read++) { assert.equal((await ask(hub.port, '/api/state')).status, 200); assert.equal((await ask(hub.port, '/')).status, 200); hubState(root, queue); }
  assert.deepEqual(files(root), before.files, 'no file was created, removed or rewritten');
  assert.equal(sourceSnapshot(root).hash, before.source);
  assert.equal(readFileSync(join(root, `.cyc/queues/${queue}/board.json`), 'utf8'), before.board);
  // The builder is still shown both messages: the hub read them and used up nothing.
  assert.deepEqual(cyc(root, 'builder', ['run', 'next', '--run', run]).data.board.new.map(item => item.id), [1, 2]);
});

test('the page is one self-contained document that shows what agents wrote as text', () => {
  // Nothing is fetched from anywhere but the hub itself.
  assert.doesNotMatch(hubPage, /https?:\/\/|<link\b|<script[^>]+src|@import|url\(|<img\b|<iframe\b/i);
  assert.match(hubPage, /fetch\('\/api\/state'/);
  // What agents write is set as text, never parsed as markup or run.
  assert.doesNotMatch(hubPage, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/);
  // The parts a person and a screen reader rely on.
  for (const part of ['<html lang="en">', 'name="viewport"', 'Skip to the conversation', 'aria-live="polite"', 'role="status"', 'prefers-color-scheme:dark', 'prefers-reduced-motion:reduce', ':focus-visible', 'Waiting on you', 'Lost contact with the hub']) assert.ok(hubPage.includes(part), `the page has ${part}`);
  assert.equal(hubPage.split('<h1').length - 1, 1, 'one main heading');
  // The page is held in a template: a backtick inside it would end the page early.
  assert.equal(hubPage.includes(String.fromCharCode(96)), false);
  assert.ok(hubPage.trimEnd().endsWith('</html>'));
});

// A browser small enough to read. The page's own script runs in it against replies the test
// supplies, so what the script does with a state is checked, not only what the page's text holds.
function browser(replies) {
  const made = [], timers = [], asked = [];
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.own = ''; this.className = ''; this.attrs = {}; this.on = {}; this.hidden = false; this.parent = null; }
    set textContent(value) { for (const child of this.children) child.parent = null; this.children = []; this.own = String(value); }
    get textContent() { return this.own + this.children.map(child => child.textContent).join(''); }
    set innerHTML(value) { throw new Error('the page parsed text as markup'); }
    set outerHTML(value) { throw new Error('the page parsed text as markup'); }
    appendChild(child) { child.remove(); child.parent = this; this.children.push(child); return child; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); this.parent = null; }
    get childNodes() { return this.children; }
    get lastElementChild() { return this.children.findLast(child => child.tag !== '#text') ?? null; }
    get classList() {
      const names = () => this.className.split(/\s+/).filter(Boolean), put = list => { this.className = [...new Set(list)].join(' '); };
      return { add: name => put([...names(), name]), remove: name => put(names().filter(item => item !== name)), toggle: (name, on) => put(on ? [...names(), name] : names().filter(item => item !== name)) };
    }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    addEventListener(type, handler) { this.on[type] = handler; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    querySelector(selector) { return this.all().find(node => selector.startsWith('.') ? node.className.split(/\s+/).includes(selector.slice(1)) : node.tag === selector) ?? null; }
    scrollIntoView() {}
  }
  // Only the elements the page's own markup declares exist: a script that names another gets nothing.
  const ids = Object.fromEntries([...hubPage.matchAll(/<(\w+)[^>]* id="([^"]+)"/g)].map(([, tag, id]) => [id, Object.assign(new Node(tag), { id })]));
  const document = { hidden: false, title: '', body: { scrollHeight: 0 }, getElementById: id => ids[id] ?? null,
    createElement: tag => { const node = new Node(tag); made.push(node); return node; }, createTextNode: text => Object.assign(new Node('#text'), { own: String(text) }) };
  const fetch = (address, options) => {
    asked.push({ address, options });
    const reply = replies.shift();
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve({ ok: reply.status === 200, status: reply.status, headers: { get: () => reply.tag ?? null }, json: () => Promise.resolve(reply.body) });
  };
  const settle = () => new Promise(done => setImmediate(done));
  new Script(/<script>([\s\S]*)<\/script>/.exec(hubPage)[1]).runInContext(createContext({ document, fetch, window: { innerHeight: 800, scrollY: 0, addEventListener() {} }, location: { search: '' }, matchMedia: () => ({ matches: true }), setTimeout: (run, ms) => { timers.push({ run, ms }); } }));
  // The next poll: the timer the page set for itself, run now.
  const poll = async () => { const next = timers.findLast(timer => timer.ms === 1500 || timer.ms === 5000); assert.ok(next, 'the page asked to be run again'); timers.length = 0; next.run(); await settle(); await settle(); };
  return { ids, made, asked, settle, poll, document };
}

test('the page shows hostile text as text, redraws only what changed, starts again for another queue, and keeps asking', async () => {
  const at = '2026-11-20T10:00:00.000Z', builder = { role: 'builder', unit: 'orders' }, script = '</script><script>alert(2)</script>';
  const first = { project: 'shop', queues: [{ id: 'q1', goal: 'One', createdAt: at, cancelled: false }], queue: { id: 'q1', goal: 'Ship \u202Eit', line: 'in-progress', done: 0, total: 2 },
    units: [{ id: 'orders', outcome: 'x', status: 'in-progress', doing: 'building', attempts: 1 }, { id: 'export', outcome: 'y', status: 'in-progress', doing: 'planning', paused: true, attempts: 1 }],
    messages: [
      { id: 1, at, from: builder, to: { role: 'person' }, kind: 'question', text: '<img src=x onerror=alert(1)> May `a` go, with one ` left?', open: true },
      { id: 2, at, from: { role: 'person' }, to: builder, kind: 'question', text: script, open: true },
      { id: 3, at, from: { role: 'person', relayedBy: 'unit orders' }, to: builder, kind: 'answer', replyTo: 2, text: 'a' + '😀'.repeat(500) }],
    waitingOnYou: [1], activity: [{ at, unit: 'orders', text: 'started work' }] };
  const more = { ...first, messages: [...first.messages, { id: 4, at, from: { role: 'reviewer', unit: 'orders' }, to: { role: 'person' }, kind: 'finding', text: 'The list is never sorted.', open: true }], waitingOnYou: [1, 4] };
  const other = { ...first, queue: { ...first.queue, id: 'q2', goal: 'Two' }, units: [], messages: [{ id: 1, at, from: builder, to: { role: 'all' }, kind: 'notice', text: 'From the other queue.' }], waitingOnYou: [], activity: [] };
  const page = browser([{ status: 200, tag: '"one"', body: first }, { status: 304 }, { status: 200, tag: '"two"', body: more }, { status: 200, tag: '"three"', body: other }, { status: 500, body: { error: 'The project folder is gone.' } }, new Error('refused'), { status: 200, tag: '"three"', body: other }]);
  await page.settle(); await page.settle();
  const { ids } = page, shown = id => ids[id].textContent, said = index => ids.messages.children[index].textContent;
  // What an agent wrote is on the page as written, and no element was made from it.
  assert.ok(shown('messages').includes('<img src=x onerror=alert(1)>') && shown('messages').includes(script));
  assert.deepEqual([...new Set(page.made.map(node => node.tag))].filter(tag => !['a', 'article', 'b', 'button', 'code', 'div', 'h3', 'li', 'option', 'p', 'span', 'strong', 'time'].includes(tag)), []);
  // A pair of backticks marks code, one without a partner is left alone, and a long text is cut between characters.
  assert.deepEqual(ids.messages.all().filter(node => node.tag === 'code').map(node => node.textContent), ['a']);
  assert.ok(said(0).includes('go, with one ` left?'));
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(said(2)), false, 'no half of a character');
  const all = ids.messages.children[2].querySelector('button');
  all.on.click();
  assert.deepEqual([all.textContent, all.attrs['aria-expanded'], said(2).includes('😀'.repeat(500))], ['Show less', 'true', true]);
  // Who speaks to whom, in words that read right for the person too.
  assert.match(said(0), /^Builder · ordersasks you/);
  assert.match(said(1), /^Youask the builder of orders/);
  assert.match(said(2), /^Youanswer the builder of orders \(relayed by unit orders\)/);
  assert.deepEqual([said(0).includes('Open: waits on you'), said(1).includes('waits on you'), said(1).includes('Open')], [true, false, true], 'only what an agent asked the person waits on them');
  assert.deepEqual([shown('goal'), shown('project'), page.document.title], ['Ship it', 'shop', '(1) CYC hub · shop'], 'a character that reverses the text after it is dropped');
  assert.deepEqual(ids.units.children.map(node => [node.className.trim(), node.querySelector('.what').textContent]), [['stop now', 'In progress: building'], ['stop now still', 'Paused while planning']]);
  assert.deepEqual([shown('you').includes('May a go'), shown('say'), shown('live-text'), ids.floor.hidden], [true, '', 'Live', false]);
  // It asks again by itself, names what it already holds, and redraws nothing when told that is current.
  const kept = { unit: ids.units.children[0], card: ids.you.children[0], entry: ids.activity.children[0], message: ids.messages.children[0] };
  await page.poll();
  assert.deepEqual([page.asked.length, page.asked[0].address, page.asked[0].options.headers['If-None-Match'], page.asked[1].options.headers['If-None-Match']], [2, '/api/state', undefined, '"one"']);
  assert.deepEqual([ids.units.children[0] === kept.unit, ids.you.children[0] === kept.card, ids.messages.children.length], [true, true, 3]);
  // One new message: it is added, the person is told something new waits, and the parts that did not change are the same elements.
  await page.poll();
  assert.deepEqual([ids.messages.children.length, ids.messages.children[0] === kept.message, ids.units.children[0] === kept.unit, ids.activity.children[0] === kept.entry, ids.you.children[0] === kept.card], [4, true, true, true, false]);
  assert.deepEqual([shown('say'), page.document.title, ids.messages.children[3].className.includes('fresh')], ['2 items now wait on you.', '(2) CYC hub · shop', true]);
  // Another queue: nothing of the first one's conversation stays.
  await page.poll();
  assert.deepEqual([ids.messages.children.length, shown('messages').includes('From the other queue.'), shown('messages').includes('<img'), shown('goal'), ids.units.children.length], [1, true, false, 'Two', 0]);
  assert.match(said(0), /tells everyone/);
  // The hub answers but cannot read the project: that is said, and is not "lost contact".
  await page.poll();
  assert.deepEqual([shown('live-text'), shown('problem'), ids.problem.hidden, ids.live.className.includes('lost')], ['The hub is running but cannot read this project', 'The project folder is gone.', false, true]);
  // The hub does not answer at all: the page says so and keeps asking; when it is back the fault is cleared.
  await page.poll();
  assert.equal(shown('live-text'), 'Reconnecting');
  await page.poll();
  assert.deepEqual([shown('live-text'), ids.problem.hidden, page.asked.at(-1).options.headers['If-None-Match'], page.asked.length], ['Live', true, undefined, 7]);
});

test('the guide, the entry skill and the help say how to open the hub', () => {
  const source = fileURLToPath(new URL('..', import.meta.url));
  const guide = readFileSync(join(source, 'docs/work-queue.md'), 'utf8'), skill = readFileSync(join(source, 'skills/cyc/SKILL.md'), 'utf8');
  for (const phrase of ['## The hub', 'cyc hub', 'this machine', 'read-only', 'Waiting on you']) assert.ok(guide.includes(phrase), `the guide names ${phrase}`);
  assert.ok(skill.includes('cyc hub'), 'the entry skill names the hub');
  assert.match(spawnSync(process.execPath, [cli, 'help'], { encoding: 'utf8' }).stdout, /cyc hub \[--project PATH\] \[--port N\]/);
});
