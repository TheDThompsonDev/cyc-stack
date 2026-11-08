import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

// A private server process per phase/worker. Files synchronize the independent
// processes, so overlap assertions never depend on an elapsed-time comparison.
const setting = globalThis.CYC_SWARM_FIXTURE ?? {};
const argument = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const scenario = argument('scenario') ?? setting.scenario ?? 'complete';
const traceDir = argument('trace-dir') ?? setting.traceDir;
if (process.argv.includes('mcp')) { console.log('[]'); process.exit(0); }
if (!traceDir) throw Error('Swarm fixture needs an isolated trace directory.');
mkdirSync(traceDir, { recursive: true });
const trace = entry => appendFileSync(join(traceDir, 'events.jsonl'), JSON.stringify({ pid: process.pid, ...entry }) + '\n');
const mark = name => writeFileSync(join(traceDir, name), 'observed');
const waitFor = async names => {
  const deadline = Date.now() + 8000;
  while (!names.every(name => existsSync(join(traceDir, name)))) {
    if (Date.now() >= deadline) throw Error('Fixture barrier did not complete: ' + names.join(', '));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const send = message => process.stdout.write(JSON.stringify(message) + '\n');
const notify = (method, params) => send({ method, params });
const threadId = 'swarm-thread-' + process.pid;
const turnId = 'swarm-turn-' + process.pid;
let packet, role, label, emittedSchema, interrupted = false;
const finish = (status = 'completed') => {
  trace({ event: 'terminal', role, label, threadId, turnId, status });
  notify('turn/completed', { threadId, turn: { id: turnId, status } });
};
const output = value => {
  notify('item/completed', { threadId, turnId, item: { type: 'agentMessage', text: JSON.stringify(value) } });
  finish();
};
function plan() {
  const paths = packet.files.map(f => f.path);
  if (packet.files.some(f => typeof f.bytes !== 'number' || 'content' in f) || paths.includes('secret.txt')) throw Error('Planner packet leaked source content or out-of-scope metadata.');
  const tasks = ['left', 'right'].map(id => ({
    id, objective: 'Independently inspect ' + id + '.txt.', criteria: ['value'],
    paths: [id + '.txt'], stoppingRule: 'Return the supported source observation.'
  }));
  if (scenario === 'invalid-scope') tasks[1].paths = ['secret.txt'];
  if (scenario === 'invalid-plan') tasks[1].id = tasks[0].id;
  if (scenario === 'schema-constrained') {
    const taskSchema = emittedSchema?.properties?.tasks?.items;
    const criterionIds = taskSchema?.properties?.criteria?.items?.enum;
    trace({ event: 'planner-schema', criterionIds, paths: taskSchema?.properties?.paths?.items?.enum, idPattern: taskSchema?.properties?.id?.pattern, maxTasks: emittedSchema?.properties?.tasks?.maxItems });
    if (!criterionIds?.includes('value')) for (const task of tasks) task.criteria = ['Retain supported observations for both source files.'];
  }
  const estimates = scenario === 'economic-win'
    ? { solo: { min: 900, max: 1200 }, delegated: { min: 300, max: 500 }, evidence: 'Fixture full-route estimate includes planner and merger.' }
    : scenario === 'overlap'
      ? { solo: { min: 300, max: 600 }, delegated: { min: 400, max: 700 }, evidence: 'Fixture ranges overlap.' }
      : null;
  return { reason: 'Two independent source inspections.', independent: scenario !== 'dependent', sharedState: scenario === 'shared', tasks, estimates };
}
async function runTurn() {
  if (!['plan', 'work', 'merge'].includes(role)) throw Error('Unknown packet role: ' + role);
  trace({ event: 'turn-requested', role, label, threadId, turnId });
  notify('item/started', { threadId, turnId, item: { type: 'userMessage' } });
  // Other actors and contradictory canonical IDs cannot finish this operation.
  notify('turn/completed', { threadId: 'foreign-thread', turn: { id: turnId, status: 'completed' } });
  notify('turn/completed', { threadId, turnId, turn: { id: 'foreign-turn', status: 'completed' } });
  if (role === 'plan') {
    trace({ event: 'plan-ready', maxWorkers: packet.maxWorkers, paths: packet.files.map(f => f.path) });
    if (scenario === 'lost-plan') {
      trace({ event: 'transport-loss', role, label });
      process.exit(1);
    }
    if (scenario.startsWith('stale-plan-')) await waitFor(['release-plan']);
    if (!interrupted) output(plan());
    return;
  }
  if (role === 'work') {
    const a = packet.assignment;
    if (!a || a.writePaths?.length || 'tokenBudget' in a) throw Error('Worker authority/token metadata leaked.');
    const batch = 'batch-' + a.contextHash + '-';
    if (createHash('sha256').update(packet.context).digest('hex') !== a.contextHash) throw Error('Worker context differs from its acknowledged basis.');
    if (packet.files.some(f => typeof f.content !== 'string' || f.path === 'secret.txt')) throw Error('Invalid worker source packet.');
    trace({ event: 'work-start', id: a.id, label, paths: packet.files.map(f => f.path), contextHash: a.contextHash });
    mark(batch + 'started-' + label);
    await waitFor([batch + 'started-left', batch + 'started-right']);
    if (interrupted) return;
    if (scenario === 'lost-transport' && label === 'left') {
      trace({ event: 'transport-loss', role, label });
      process.exit(1);
    }
    if (scenario === 'worker-failed' && label === 'left') {
      finish('failed');
      return;
    }
    if (['cancel', 'stop', 'noack'].includes(scenario)) return;
    // Force the right result to precede the left after both starts are observed.
    if (label === 'left') await waitFor([batch + 'returned-right']);
    if (interrupted) return;
    const source = packet.files[0];
    const result = {
      summary: 'Read ' + source.path + '.',
      findings: [{ id: 'stored', text: 'Observed ' + source.content.trim() + '.', evidence: [{ path: source.path, sha256: source.sha256 }] }],
      failedApproaches: scenario === 'questions' && label === 'left' ? ['A cached explanation did not establish the source value.'] : [],
      questions: scenario === 'questions' && label === 'left' ? ['Why do these source observations disagree?'] : []
    };
    notify('thread/tokenUsage/updated', { threadId, turnId, tokenUsage: { total: { inputTokens: 900000, outputTokens: 1000, cachedInputTokens: 50 } } });
    trace({ event: 'usage-reported', role, label, inputTokens: 900000, outputTokens: 1000 });
    await new Promise(resolve => setTimeout(resolve, 100));
    if (interrupted) return;
    trace({ event: 'work-output', id: a.id, label, contextHash: a.contextHash });
    output(result);
    mark(batch + 'returned-' + label);
    return;
  }
  trace({ event: 'merge-ready', ids: packet.contributions.map(c => c.id) });
  trace({ event: 'merge-schema', assignmentIds: emittedSchema?.properties?.reviews?.items?.properties?.assignmentId?.enum });
  if (packet.files.some(f => typeof f.content !== 'string')) throw Error('Merger needs scoped source text.');
  if (scenario.startsWith('stale-merge-')) await waitFor(['release-merge']);
  if (interrupted) return;
  const result = {
    summary: 'The independent source observations were compared.', nextAction: 'Use the consolidated evidence.',
    reviews: packet.contributions.map((c, index) => ({ assignmentId: c.id, status: scenario === 'uncertain' && index === 1 ? 'uncertain' : 'supported', reason: 'Compared the returned observation to supplied current source.' })),
    conflicts: []
  };
  if (scenario === 'invalid-merge') result.authority = { allowedPaths: ['secret.txt'] };
  output(result);
}
createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  const reply = result => send({ id: message.id, result });
  if (message.method === 'initialize') return reply({});
  if (message.method === 'model/list') return reply({ data: [{ model: 'swarm-fixture-model', isDefault: true }] });
  if (message.method === 'thread/start') {
    if (message.params.approvalPolicy !== 'never' || message.params.sandbox !== 'read-only' || process.env.CYC_SESSION || process.env.CODEX_THREAD_ID) throw Error('Parent authority or unsafe policy reached the worker.');
    return reply({ thread: { id: threadId }, model: 'swarm-fixture-model', approvalPolicy: 'never', sandbox: { type: 'readOnly' } });
  }
  if (message.method === 'turn/start') {
    packet = JSON.parse(message.params.input[0].text);
    emittedSchema = message.params.outputSchema;
    role = packet.role;
    label = role === 'work' ? (packet.files.some(f => f.path === 'left.txt') ? 'left' : 'right') : role;
    reply({ turn: { id: turnId, status: 'inProgress' } });
    runTurn().catch(error => { trace({ event: 'fixture-error', role, label, message: error.message }); process.stderr.write(error.stack); process.exitCode = 1; process.stdin.destroy(); });
    return;
  }
  if (message.method === 'turn/interrupt') {
    interrupted = true;
    trace({ event: 'interrupt-requested', role, label, threadId, turnId });
    reply({});
    if (scenario !== 'noack') setTimeout(() => finish('interrupted'), 30);
    return;
  }
  send({ id: message.id, error: { code: -32601, message: 'Unexpected swarm fixture method.' } });
});
