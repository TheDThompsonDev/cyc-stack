// The hub's one page. Self-contained: no font, script, image or request leaves this machine. Its
// script builds every element with textContent, so what an agent writes is shown, never run.
// Design decisions: docs/maintainers/hub-design.md.
export const hubPage = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CYC hub</title>
<style>
:root{--paper:#F4F1EA;--surface:#FFFDF8;--ink:#1C1B18;--soft:#5A554C;--rule:#D9D2C3;--signal:#B4420F;--signal-wash:#FBE9DD;--builder:#0B5C63;--reviewer:#5A3E9B;--done:#1E6B41;
--display:"Bahnschrift","DIN Alternate","Avenir Next Condensed","Franklin Gothic Medium","Arial Narrow",sans-serif;--body:"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",sans-serif;--mono:ui-monospace,"Cascadia Mono",Consolas,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--paper:#151410;--surface:#1F1D18;--ink:#F1EDE3;--soft:#B3AC9D;--rule:#3A362D;--signal:#F59E5B;--signal-wash:#3A2415;--builder:#62CDD3;--reviewer:#BDA8F2;--done:#74DDA6}}
*{box-sizing:border-box}
html{background:var(--paper);color:var(--ink);font:16px/1.55 var(--body);-webkit-text-size-adjust:100%}
body{margin:0}
h1,h2,h3,p,ol{margin:0;padding:0}
ol{list-style:none}
a{color:inherit}
:focus-visible{outline:3px solid var(--signal);outline-offset:2px;border-radius:2px}
.skip{position:absolute;left:-999px;top:8px;background:var(--surface);padding:8px 12px;border:1px solid var(--rule)}
.skip:focus{left:8px;z-index:5}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.top{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:center;justify-content:space-between;padding:14px clamp(16px,4vw,40px);border-bottom:1px solid var(--rule)}
.brand{display:flex;align-items:baseline;gap:12px;min-width:0}
.name{font:600 15px/1 var(--display);letter-spacing:.12em;text-transform:uppercase}
.project{color:var(--soft);font:14px var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tools{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.tools label{font-size:14px;color:var(--soft)}
select{font:14px var(--body);color:var(--ink);background:var(--surface);border:1px solid var(--rule);border-radius:4px;padding:6px 8px;max-width:min(60vw,320px)}
.live{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--soft)}
.dot{width:9px;height:9px;border-radius:50%;background:var(--done)}
.live.lost{color:var(--signal)}
.live.lost .dot{background:var(--signal)}
main{padding:clamp(20px,4vw,40px);max-width:1280px;margin:0 auto}
.line{margin-bottom:clamp(24px,4vw,40px)}
#goal{font:600 clamp(26px,4.2vw,44px)/1.08 var(--display);letter-spacing:-.01em;max-width:22ch;text-wrap:balance;overflow-wrap:anywhere}
#line-state{margin-top:10px;color:var(--soft);font-size:15px}
#line-state b{color:var(--ink);font-weight:600}
.track{display:flex;margin-top:28px;overflow-x:auto;padding:6px 2px 10px}
.stop{flex:1 0 150px;position:relative;padding:34px 16px 0 0;min-width:0}
.stop::before{content:"";position:absolute;left:0;right:0;top:12px;height:2px;background:var(--rule)}
.stop:last-child::before{right:auto;width:26px}
.pin{position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:var(--paper);border:2px solid var(--rule);display:grid;place-items:center;font:600 13px/1 var(--display);color:var(--soft)}
.stop.done .pin{background:var(--done);border-color:var(--done);color:var(--paper)}
.stop.done::before{background:var(--done)}
.stop.now .pin{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.stop.now .pin::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:2px solid var(--ink);opacity:.35;animation:pulse 1.8s ease-out infinite}
.stop.halt .pin{background:var(--signal);border-color:var(--signal);color:var(--paper)}
.stop.still .pin::after{display:none}
@keyframes pulse{from{transform:scale(.8);opacity:.5}to{transform:scale(1.25);opacity:0}}
.stop h3{font:600 17px/1.2 var(--display);letter-spacing:.01em;overflow-wrap:anywhere}
.stop .what{font-size:14px;color:var(--soft);margin-top:2px}
.stop.now .what,.stop.halt .what{color:var(--ink)}
.stop .more{font-size:13px;color:var(--soft);margin-top:2px}
.stop.halt .more{color:var(--signal)}
.floor{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,340px);grid-template-areas:"talk you" "talk log";grid-template-rows:auto 1fr;gap:32px clamp(24px,4vw,48px);align-items:start}
.talk{grid-area:talk}.you{grid-area:you}.log{grid-area:log}
h2{font:600 13px/1 var(--display);letter-spacing:.14em;text-transform:uppercase;color:var(--soft);padding-bottom:10px;border-bottom:1px solid var(--rule);margin-bottom:6px}
.talk{outline:none}
.msg{padding:16px 0 16px 16px;border-bottom:1px solid var(--rule);border-left:3px solid var(--rule);margin-left:1px;transition:background-color 1.6s}
.msg.builder{border-left-color:var(--builder)}
.msg.reviewer{border-left-color:var(--reviewer)}
.msg.person{border-left-color:var(--signal)}
.msg.fresh{background:var(--signal-wash)}
.who{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;font-size:14px;color:var(--soft)}
.who strong{font:600 14px/1.2 var(--display);letter-spacing:.08em;text-transform:uppercase}
.builder .who strong{color:var(--builder)}
.reviewer .who strong{color:var(--reviewer)}
.person .who strong{color:var(--signal)}
.who time,.who .num{font:13px var(--mono);color:var(--soft)}
.who .num{margin-left:auto}
.re{margin-top:6px;font-size:14px;color:var(--soft);border-left:2px solid var(--rule);padding-left:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.text{margin-top:8px;max-width:72ch;overflow-wrap:anywhere;white-space:pre-wrap}
.text code,.card code{font:.9em var(--mono);background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:0 4px}
.foot{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:10px}
.chip{font:600 12px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:3px;border:1px solid var(--rule);color:var(--soft)}
.chip.open{border-color:var(--signal);color:var(--signal);background:var(--signal-wash)}
.chip.ok{border-color:var(--done);color:var(--done)}
.closed{font-size:14px;color:var(--soft)}
button{font:14px var(--body);color:var(--ink);background:none;border:1px solid var(--rule);border-radius:4px;padding:6px 10px;min-height:32px;cursor:pointer}
button:hover{border-color:var(--soft)}
.empty{padding:20px 0;color:var(--soft);max-width:52ch}
.card{padding:14px 0;border-bottom:1px solid var(--rule)}
.card .ask{font-weight:600}
.card .by{font-size:14px;color:var(--soft);margin-top:4px}
.card .by a{display:inline-block;min-width:24px;padding:3px 6px;margin:-3px 0;text-align:center}
.you.has h2{color:var(--signal);border-bottom-color:var(--signal)}
.how{font-size:14px;color:var(--soft);margin-top:12px}
#activity li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;padding:9px 0;border-bottom:1px solid var(--rule);font-size:14px}
#activity time{font:13px var(--mono);color:var(--soft);padding-top:1px}
#activity b{font:600 13px/1.2 var(--display);letter-spacing:.06em;text-transform:uppercase}
.jump{position:sticky;bottom:16px;margin:16px auto 0;display:none;background:var(--ink);color:var(--paper);border-color:var(--ink)}
.jump.show{display:block}
.problem{margin-top:16px;padding:14px 16px;border:1px solid var(--signal);border-radius:4px;color:var(--signal);background:var(--signal-wash);max-width:72ch}
@media (max-width:860px){.floor{grid-template-columns:minmax(0,1fr);grid-template-areas:"you" "talk" "log";grid-template-rows:auto}.stop{flex-basis:132px}}
@media (prefers-reduced-motion:reduce){.stop.now .pin::after{animation:none}.msg{transition:none}}
</style>
</head>
<body>
<a class="skip" href="#talk">Skip to the conversation</a>
<header class="top">
  <div class="brand"><span class="name">CYC hub</span><span class="project" id="project"></span></div>
  <div class="tools">
    <span id="picker" hidden><label for="queue">Queue</label> <select id="queue"></select></span>
    <div class="live" id="live" role="status"><span class="dot" aria-hidden="true"></span><span id="live-text">Connecting</span></div>
  </div>
</header>
<main>
  <section class="line" aria-labelledby="goal">
    <h1 id="goal">Opening the hub</h1>
    <p id="line-state"></p>
    <div id="problem" class="problem" hidden></div>
    <ol id="units" class="track" aria-label="The line: each unit of work in order"></ol>
  </section>
  <div class="floor" id="floor" hidden>
    <section class="you" id="you-box" aria-labelledby="you-h"><h2 id="you-h">Waiting on you</h2><div id="you"></div><p id="say" class="vh" role="status"></p></section>
    <section id="talk" class="talk" aria-labelledby="talk-h" tabindex="-1">
      <h2 id="talk-h">Conversation</h2>
      <div id="messages" aria-live="polite" aria-relevant="additions"></div>
      <button class="jump" id="jump" type="button">New messages below</button>
    </section>
    <section class="log" aria-labelledby="log-h"><h2 id="log-h">Activity</h2><ol id="activity"></ol></section>
  </div>
</main>
<script>
(function () {
  var byId = function (id) { return document.getElementById(id); };
  // Characters that reverse or re-order the text around them are dropped: what is shown reads as written.
  var plain = function (text) { return String(text).replace(/[\u202A-\u202E\u2066-\u2069]/g, ''); };
  var el = function (tag, cls, text) { var node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = plain(text); return node; };
  var clock = function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); };
  // Words between a pair of backticks are shown as code, and one left without a partner is shown
  // as it is. Everything is set as text, never as markup.
  var mark = String.fromCharCode(96);
  var prose = function (node, text) {
    var parts = plain(text).split(mark); if (parts.length % 2 === 0) parts.push(parts.splice(-2).join(mark));
    parts.forEach(function (part, i) { if (!part) return; node.appendChild(i % 2 ? el('code', '', part) : document.createTextNode(part)); }); return node;
  };
  var speaker = function (who) { return who.role === 'person' ? 'You' : who.role === 'reviewer' ? 'Reviewer' : 'Builder'; };
  var listener = function (to) { return to.role === 'person' ? 'you' : to.role === 'all' ? 'everyone' : to.role === 'reviewer' ? 'the reviewer' : 'the builder of ' + to.unit; };
  var said = function (m) {
    var s = m.from.role === 'person' ? '' : 's';
    if (m.kind === 'question') return 'ask' + s + ' ' + listener(m.to);
    if (m.kind === 'finding') return 'found a problem, for ' + listener(m.to);
    if (m.kind === 'notice') return m.topic === 'ready-for-review' ? 'asks for a review' : m.topic === 'review-done' ? 'signs off the review' : 'tell' + s + ' ' + listener(m.to);
    return { fixed: 'fixed it', declined: 'declined it', assumed: 'went on with an assumption', withdrawn: 'took it back' }[m.disposition] || 'answer' + s + ' ' + listener(m.to);
  };
  var how = { fixed: 'Fixed', declined: 'Declined', assumed: 'Went on with an assumption', withdrawn: 'Taken back' };
  var words = { done: 'Done', 'in-progress': 'In progress', ready: 'Next up', waiting: 'Waiting', halted: 'Halted: needs you', skipped: 'Skipped', cancelled: 'Cancelled' };
  var lines = { ready: 'Ready for the next unit', 'in-progress': 'Work in progress', halted: 'Halted: a unit needs your decision', complete: 'Complete', ended: 'Nothing more can start', cancelled: 'Cancelled' };
  var drawn = {}, shown = {}, keys = {}, first = true, lastSeen = 0, current = null, waited = 0, tag = '';
  // A section is redrawn only when what it shows changed, so focus and a selection in it are kept.
  var changed = function (name, data) { var key = JSON.stringify(data); if (keys[name] === key) return false; keys[name] = key; return true; };

  function unitsOf(state) {
    if (!changed('units', state.units)) return;
    var list = byId('units'); list.textContent = '';
    state.units.forEach(function (unit, index) {
      var cls = unit.status === 'done' ? 'done' : unit.status === 'in-progress' ? (unit.paused ? 'now still' : 'now') : unit.status === 'halted' ? 'halt' : '';
      var item = el('li', 'stop ' + cls);
      var pin = el('span', 'pin', unit.status === 'done' ? '✓' : unit.status === 'halted' ? '!' : String(index + 1)); pin.setAttribute('aria-hidden', 'true');
      item.appendChild(pin); item.appendChild(el('h3', '', unit.id));
      item.appendChild(el('p', 'what', unit.paused ? 'Paused' + (unit.doing ? ' while ' + unit.doing : '') : unit.status === 'in-progress' && unit.doing ? 'In progress: ' + unit.doing : words[unit.status] || unit.status));
      var more = unit.reason || (unit.waitsOn ? 'After ' + unit.waitsOn.join(', ') : unit.reviewer ? 'Reviewer ' + unit.reviewer : unit.attempts > 1 ? 'Attempt ' + unit.attempts : '');
      if (more) item.appendChild(el('p', 'more', more));
      if (unit.outcome) item.title = unit.outcome;
      list.appendChild(item);
    });
  }
  function footOf(m, node, waits) {
    var foot = node.querySelector('.foot') || node.appendChild(el('div', 'foot'));
    var long = node.querySelector('button'); foot.textContent = '';
    if (m.open !== undefined) foot.appendChild(el('span', 'chip ' + (m.open ? 'open' : 'ok'), m.open ? (waits ? 'Open: waits on you' : 'Open') : (m.closed && how[m.closed.disposition]) || 'Answered'));
    if (m.closed) foot.appendChild(el('span', 'closed', 'by ' + m.closed.by));
    if (m.answeredLater) foot.appendChild(el('span', 'closed', 'Answered later by ' + m.answeredLater.by + ': ' + m.answeredLater.text));
    if (long) foot.appendChild(long);
    if (!foot.childNodes.length) foot.remove();
  }
  function messageOf(m, all) {
    var node = el('article', 'msg ' + m.from.role); node.id = 'm' + m.id;
    var who = el('p', 'who'); who.appendChild(el('strong', '', speaker(m.from) + (m.from.unit ? ' · ' + m.from.unit : '')));
    who.appendChild(el('span', '', said(m) + (m.from.relayedBy ? ' (relayed by ' + m.from.relayedBy + ')' : '')));
    var time = el('time', '', clock(m.at)); time.dateTime = m.at; who.appendChild(time); who.appendChild(el('span', 'num', '#' + m.id));
    node.appendChild(who);
    if (m.replyTo) { var about = all.filter(function (x) { return x.id === m.replyTo; })[0]; if (about) node.appendChild(el('p', 're', 'On #' + about.id + ': ' + about.text)); }
    // Cut by whole characters, so a character stored as a pair is never split.
    var limit = 420, chars = Array.from(m.text), long = chars.length > limit, open = false, text = el('p', 'text');
    var draw = function () { text.textContent = ''; prose(text, long && !open ? chars.slice(0, limit).join('').replace(/\s+\S*$/, '') + ' …' : m.text); };
    draw(); node.appendChild(text);
    var foot = el('div', 'foot'); node.appendChild(foot);
    if (long) { var more = el('button', '', 'Show all'); more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.addEventListener('click', function () { open = !open; draw(); more.textContent = open ? 'Show less' : 'Show all'; more.setAttribute('aria-expanded', String(open)); }); foot.appendChild(more); }
    return node;
  }
  function talkOf(state) {
    var box = byId('messages'), near = window.innerHeight + window.scrollY > document.body.scrollHeight - 240, added = 0;
    if (!state.messages.length) { if (!box.querySelector('.empty')) { box.textContent = ''; drawn = {}; box.appendChild(el('p', 'empty', 'No messages yet. Agents post here when they ask something, find a problem or answer one.')); } return; }
    var none = box.querySelector('.empty'); if (none) none.remove();
    state.messages.forEach(function (m) {
      var waits = state.waitingOnYou.indexOf(m.id) >= 0, key = JSON.stringify([m.open, m.closed, m.answeredLater, waits]);
      if (!drawn[m.id]) { var node = messageOf(m, state.messages); box.appendChild(node); drawn[m.id] = node; added++; if (!first) { node.classList.add('fresh'); setTimeout(function () { node.classList.remove('fresh'); }, 2400); } }
      if (shown[m.id] !== key) { footOf(m, drawn[m.id], waits); shown[m.id] = key; }
    });
    if (added && !first) { if (near) drawn[state.messages[state.messages.length - 1].id].scrollIntoView({ block: 'end', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); else byId('jump').classList.add('show'); }
  }
  function youOf(state) {
    var waiting = state.messages.filter(function (m) { return state.waitingOnYou.indexOf(m.id) >= 0; });
    if (!changed('you', waiting)) return;
    var box = byId('you'); box.textContent = '';
    if (!first && waiting.length > waited) byId('say').textContent = waiting.length === 1 ? 'One item now waits on you.' : waiting.length + ' items now wait on you.';
    waited = waiting.length;
    byId('you-box').classList.toggle('has', waiting.length > 0);
    if (!waiting.length) { box.appendChild(el('p', 'empty', 'Nothing is waiting on you.')); return; }
    waiting.forEach(function (m) {
      var card = el('div', 'card'); prose(card.appendChild(el('p', 'ask')), m.text);
      var by = el('p', 'by'); var link = el('a', '', '#' + m.id); link.href = '#m' + m.id; by.appendChild(document.createTextNode((m.kind === 'finding' ? 'A problem found by ' : 'Asked by ') + speaker(m.from).toLowerCase() + (m.from.unit ? ' of ' + m.from.unit : '') + ', ')); by.appendChild(link);
      card.appendChild(by); box.appendChild(card);
    });
    box.appendChild(el('p', 'how', 'To answer, tell your agent what you decided. It posts your answer here.'));
  }
  function logOf(state) {
    var recent = state.activity.slice(0, 14);
    if (!changed('log', recent)) return;
    var list = byId('activity'); list.textContent = '';
    if (!recent.length) { list.appendChild(el('li', 'empty', 'No run has started yet.')); return; }
    recent.forEach(function (a) { var item = el('li'); var time = el('time', '', clock(a.at)); time.dateTime = a.at; item.appendChild(time); var what = el('span'); what.appendChild(el('b', '', a.unit)); what.appendChild(document.createTextNode(' ' + a.text)); item.appendChild(what); list.appendChild(item); });
  }
  function pickerOf(state) {
    var picker = byId('picker'), select = byId('queue');
    picker.hidden = state.queues.length < 2;
    if (changed('queues', state.queues)) { select.textContent = ''; state.queues.slice().reverse().forEach(function (q) { var option = el('option', '', q.goal + (q.cancelled ? ' (cancelled)' : '')); option.value = q.id; select.appendChild(option); }); }
    if (state.queue) select.value = state.queue.id;
  }
  function show(state) {
    byId('project').textContent = state.project;
    pickerOf(state);
    var problem = byId('problem'), queue = state.queue;
    problem.hidden = true;
    if ((queue ? queue.id : null) !== current) { current = queue ? queue.id : null; byId('messages').textContent = ''; drawn = {}; shown = {}; keys = {}; first = true; waited = 0; byId('jump').classList.remove('show'); }
    if (!queue) { byId('goal').textContent = 'No work queue yet'; byId('line-state').textContent = 'When your agent plans work as a queue, each unit and everything the agents say to each other appears here.'; byId('units').textContent = ''; byId('floor').hidden = true; return; }
    byId('goal').textContent = plain(queue.goal || 'Work queue');
    if (queue.error) { byId('line-state').textContent = ''; problem.hidden = false; problem.textContent = 'This queue cannot be read: ' + queue.error; byId('units').textContent = ''; byId('floor').hidden = true; return; }
    var status = byId('line-state'); status.textContent = ''; status.appendChild(el('b', '', lines[queue.line] || queue.line)); status.appendChild(document.createTextNode(' · ' + queue.done + ' of ' + queue.total + ' units done'));
    if (queue.boardError) { problem.hidden = false; problem.textContent = 'The conversation cannot be read: ' + queue.boardError; }
    byId('floor').hidden = false;
    unitsOf(state); talkOf(state); youOf(state); logOf(state);
    document.title = (state.waitingOnYou.length ? '(' + state.waitingOnYou.length + ') ' : '') + 'CYC hub · ' + state.project;
    first = false;
  }
  function live(ok, text) { var box = byId('live'); box.classList.toggle('lost', !ok); if (byId('live-text').textContent !== text) byId('live-text').textContent = text; }
  function tick() {
    // The hub answers "unchanged" to the tag of what is already shown, so a quiet queue costs nothing to watch.
    var options = { cache: 'no-store', headers: tag ? { 'If-None-Match': tag } : {} };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) options.signal = AbortSignal.timeout(8000);
    fetch('/api/state' + location.search, options).then(function (reply) {
      if (reply.status === 304) return null;
      return reply.json().then(function (state) { if (!reply.ok) { var fault = new Error(state.error || 'The hub could not read the project.'); fault.served = true; throw fault; } tag = reply.headers.get('ETag') || ''; return state; });
    }).then(function (state) { lastSeen = Date.now(); live(true, 'Live'); if (state) show(state); })
      .catch(function (error) {
        tag = '';
        // The hub answered and named a fault: it is running, and the project is what it cannot read.
        if (error && error.served) { live(false, 'The hub is running but cannot read this project'); byId('problem').hidden = false; byId('problem').textContent = plain(error.message); return; }
        live(false, Date.now() - lastSeen > 4000 || !lastSeen ? 'Lost contact with the hub. Is cyc hub still running?' : 'Reconnecting');
      })
      .then(function () { setTimeout(tick, document.hidden ? 5000 : 1500); });
  }
  byId('queue').addEventListener('change', function () { location.search = '?queue=' + encodeURIComponent(byId('queue').value); });
  byId('jump').addEventListener('click', function () { byId('jump').classList.remove('show'); var last = byId('messages').lastElementChild; if (last) last.scrollIntoView({ block: 'end' }); });
  window.addEventListener('scroll', function () { if (window.innerHeight + window.scrollY > document.body.scrollHeight - 240) byId('jump').classList.remove('show'); }, { passive: true });
  tick();
})();
</script>
</body>
</html>
`;
