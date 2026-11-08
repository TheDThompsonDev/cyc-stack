import { digest } from './response-gate.mjs';
import { strictObject, text, identifier, strings, contextHash, renderContext, requireContextReady, touchContext, validateEvidence } from './task-context.mjs';

const finite = n => Number.isFinite(n) && n >= 0;
const positive = n => Number.isSafeInteger(n) && n > 0;
const within = (path, prefix) => path === prefix || path.startsWith(prefix + '/');
const sourceBasis = (source, paths) => Object.fromEntries(Object.entries(source).filter(([path]) => paths.some(prefix => within(path,prefix))).sort(([a],[b]) => a.localeCompare(b)));
const sourceDrift = (assignment, source) => digest(JSON.stringify(sourceBasis(source,assignment.paths))) !== assignment.basisHash;
export function delegationPolicy(input) {
  strictObject(input, ['version','mode','maxWorkers','maxAssignments','budgetTokens','reserveTokens','maxResultBytes'], 'delegation');
  if (input.version !== 1 || !['off','recommend','auto'].includes(input.mode ?? 'recommend')) throw Error('Delegation needs version 1 and off, recommend or auto mode.');
  for (const key of ['budgetTokens','reserveTokens']) if (input[key] !== undefined && !positive(input[key])) throw Error('Invalid legacy token metadata.');
  const { budgetTokens, reserveTokens, ...settings } = input;
  const p = { version: 1, mode: 'recommend', maxWorkers: input.mode === 'auto' ? 2 : 1, maxAssignments: 4, maxResultBytes: 32768, ...settings };
  if (!positive(p.maxWorkers) || p.maxWorkers > 8 || !positive(p.maxAssignments) || p.maxAssignments > 100 || !positive(p.maxResultBytes) || p.maxResultBytes > 262144) throw Error('Invalid delegation worker/result limits.');
  return p;
}
export function initializeDelegation(policy) {
  return { version: 1, policy, decision: null, assignments: [], accountedTokens: 0, usageReceipts: [], observedTokens: 0, usageUnknown: false };
}
function ledger(state) {
  if (!state.delegation) throw Error('Delegation policy must be frozen at run start.');
  return state.delegation;
}
export function decideDelegation(state, input) {
  strictObject(input, ['version','objective','facts','capabilities','estimates'], 'delegation decision');
  strictObject(input.facts, ['independent','sharedState','evidence'], 'task facts');
  strictObject(input.capabilities, ['dispatch','evidence'], 'capabilities');
  if (input.version !== 1 || !['tokens','spend','time'].includes(input.objective) || typeof input.facts.independent !== 'boolean' || typeof input.facts.sharedState !== 'boolean' || !text(input.facts.evidence) || typeof input.capabilities.dispatch !== 'boolean' || !text(input.capabilities.evidence)) throw Error('Decision needs explicit objective, dependency facts and capability evidence.');
  if (input.estimates !== undefined) {
    strictObject(input.estimates, ['solo','delegated','evidence'], 'estimates');
    for (const k of ['solo','delegated']) {
      strictObject(input.estimates[k], ['min','max'], 'estimate range');
      if (!finite(input.estimates[k].min) || !finite(input.estimates[k].max) || input.estimates[k].max < input.estimates[k].min) throw Error('Invalid estimate range.');
    }
    if (!text(input.estimates.evidence)) throw Error('Estimate provenance is required.');
  }
  const d = ledger(state);
  let route = 'solo', reason = 'Economic advantage is unknown or estimate ranges overlap.';
  if (d.policy.mode === 'off') reason = 'Optional delegation is disabled; required review is unaffected.';
  else if (!input.capabilities.dispatch) reason = 'Host dispatch is unavailable or not observed.';
  else if (!input.facts.independent || input.facts.sharedState) reason = 'Shared or dependent decisions favor one owner.';
  else if (input.objective === 'time') { route = 'delegate'; reason = 'Independent work can be delegated for time; token savings are not established.'; }
  else if (input.estimates && input.estimates.delegated.max < input.estimates.solo.min) { route = 'delegate'; reason = 'Agent-reported full-route estimate ranges favor bounded delegation.'; }
  d.decision = { version: 1, route, reason, ...structuredClone(input), origin: 'agent-reported; not host capability attestation or measured savings' };
  return { route, reason, policy: d.policy, estimates: input.estimates ?? null, origin: d.decision.origin };
}
export function assignWorker(state, input, io) {
  strictObject(input, ['version','id','objective','criteria','paths','writePaths','dependencies','contextRevision','contextHash','tokenBudget','stoppingRule','hostReference'], 'assignment');
  const d = ledger(state); requireContextReady(state, io, { allowPending: true });
  if (d.policy.mode === 'off' || d.decision?.route !== 'delegate') throw Error('A current bounded delegation decision is required.');
  if (input.version !== 1 || !identifier(input.id) || !text(input.objective) || !text(input.stoppingRule) || input.tokenBudget !== undefined && !positive(input.tokenBudget)) throw Error('Invalid assignment identity/objective/stopping rule or legacy token metadata.');
  for (const k of ['criteria','paths','writePaths','dependencies']) strings(input[k], k);
  if (input.writePaths.length) throw Error('Initial delegation is read-only; worker writePaths must be empty.');
  if (!input.paths.length || !input.criteria.length || input.criteria.some(id => !state.criteria.some(c => c.id === id))) throw Error('Assignment must cover declared criteria and a bounded source scope.');
  if (input.contextRevision !== state.taskContext.revision || input.contextHash !== contextHash(state)) throw Error('Assignment needs the current acknowledged context revision/hash.');
  if (input.hostReference !== undefined && !text(input.hostReference)) throw Error('Host reference must be observed nonempty text.');
  if (d.assignments.some(a => a.id === input.id)) throw Error('Assignment IDs cannot be reused.');
  if (d.assignments.length >= d.policy.maxAssignments) throw Error('Total assignment budget exhausted.');
  const active = d.assignments.filter(a => ['active','cancelling'].includes(a.status));
  if (active.length >= d.policy.maxWorkers) throw Error('Active worker limit reached; cancellation needs host acknowledgment.');
  if (input.dependencies.some(id => id === input.id || !d.assignments.some(a => a.id === id && a.disposition === 'accepted'))) throw Error('Dependencies must be existing accepted assignments; cyclic/unknown dependencies are rejected.');
  const paths = io.normalize(input.paths);
  if (paths.some(path => state.allowedPaths.length && !state.allowedPaths.some(prefix => within(path, prefix)))) throw Error('Assignment scope exceeds parent authority.');
  for (const path of paths) io.file(path);
  const snapshot = io.source();
  const basis = sourceBasis(snapshot,paths);
  if (!Object.keys(basis).length || paths.some(p => !Object.keys(basis).some(file => within(file,p)))) throw Error('Each read scope needs current regular source files.');
  const hash = contextHash(state);
  const { tokenBudget, ...details } = input;
  const assignment = { ...structuredClone(details), paths, basis, basisHash: digest(JSON.stringify(basis)), ...(d.policy.mode==='auto'?{contextDocument:renderContext(state)}:{}), status: 'active', stage: state.stages[state.stageIndex], attempt: state.attempt };
  d.assignments.push(assignment); touchContext(state, hash);
  return { runId: state.id, assignment: structuredClone(assignment), enforcement: 'Worker concurrency/scope limits; token usage is reporting only.' };
}
export function recordWorker(state, input, io) {
  strictObject(input, ['version','assignmentId','resultId','status','contextRevision','contextHash','basisHash','summary','findings','failedApproaches','questions','checks','usage','hostStopped'], 'worker result');
  const d = ledger(state), a = d.assignments.find(a => a.id === input.assignmentId);
  if (!a) throw Error('Unknown assignment.');
  if (Buffer.byteLength(JSON.stringify(input)) > d.policy.maxResultBytes) throw Error('Worker result exceeds maxResultBytes.');
  const resultHash = digest(JSON.stringify(input));
  if (a.result) {
    if (a.resultHash === resultHash) return { runId: state.id, assignmentId: a.id, duplicate: true };
    throw Error('Worker result replay differs from the recorded result.');
  }
  if (d.assignments.some(other => other.id !== a.id && other.result?.resultId === input.resultId)) throw Error('Result ID is already bound to another assignment.');
  if (input.version !== 1 || !identifier(input.resultId) || !['passed','failed','cancelled'].includes(input.status) || input.hostStopped !== true || !text(input.summary)) throw Error('Result needs a terminal host acknowledgment, valid status and summary.');
  if (input.contextRevision !== a.contextRevision || input.contextHash !== a.contextHash || input.basisHash !== a.basisHash) throw Error('Worker result has a foreign/stale assignment basis.');
  if (!Array.isArray(input.findings) || new Set(input.findings.map(f=>f?.id)).size !== input.findings.length) throw Error('Worker findings need unique IDs.');
  strings(input.failedApproaches, 'failedApproaches'); strings(input.questions, 'questions');
  for (const f of input.findings) {
    strictObject(f, ['id','text','evidence'], 'worker finding');
    if (!identifier(f.id) || !text(f.text)) throw Error('Invalid worker finding.');
    validateEvidence(state,f.evidence,io,{current:false});
    if (f.evidence.some(e => { const path=io.normalize([e.path])[0]; return !a.paths.some(p => within(path,p)); })) throw Error('Worker evidence exceeds assignment scope.');
  }
  if (input.checks !== undefined) {
    if (!Array.isArray(input.checks)) throw Error('checks needs an array.');
    for (const c of input.checks) { strictObject(c,['command','result','evidence'],'reported check'); if (!text(c.command)||!['passed','failed','unverified'].includes(c.result)||!text(c.evidence)) throw Error('Invalid agent-reported check.'); }
  }
  const hash = contextHash(state);
  recordUsage(d,input.usage);
  const now = io.source();
  a.result = structuredClone(input); a.resultHash = resultHash; a.status = 'returned';
  a.stale = sourceDrift(a,now);
  touchContext(state,hash);
  return { runId: state.id, assignmentId: a.id, status: 'needs-reconciliation', stale: a.stale, accountedTokens: d.accountedTokens };
}
export function recordUsage(d,usage) {
  let charge = 0;
  if (usage !== undefined) {
    strictObject(usage, ['receiptId','inputTokens','outputTokens','cachedInputTokens','model','origin'], 'usage');
    const u = usage;
    if (!identifier(u.receiptId) || !['host-reported','agent-estimated'].includes(u.origin) || !text(u.model) || !Number.isSafeInteger(u.inputTokens) || u.inputTokens < 0 || !Number.isSafeInteger(u.outputTokens) || u.outputTokens < 0 || u.cachedInputTokens !== undefined && (!Number.isSafeInteger(u.cachedInputTokens)||u.cachedInputTokens<0||u.cachedInputTokens>u.inputTokens)) throw Error('Invalid usage observation.');
    if (d.usageReceipts.includes(u.receiptId)) throw Error('Usage receipt was already accounted.');
    charge = u.inputTokens + u.outputTokens;
    if (!Number.isSafeInteger(charge) || !Number.isSafeInteger(d.accountedTokens + charge)) throw Error('Usage exceeds safe integer accounting.');
    if (u.origin === 'host-reported') d.observedTokens += charge;
    else d.usageUnknown = true;
    d.usageReceipts.push(u.receiptId);
  } else d.usageUnknown = true;
  d.accountedTokens += charge;
}
export function assignBatch(state,tasks,io) {
  if (!Array.isArray(tasks)||!tasks.length||new Set(tasks.map(t=>t.id)).size!==tasks.length) throw Error('Batch needs unique assignments.');
  const d=ledger(state), active=d.assignments.filter(a=>['active','cancelling'].includes(a.status)).length;
  if(active+tasks.length>d.policy.maxWorkers||d.assignments.length+tasks.length>d.policy.maxAssignments)throw Error('Batch exceeds frozen worker/assignment limits.');
  const source=JSON.stringify(io.source()),hash=contextHash(state);
  const assignments=tasks.map(t=>assignWorker(structuredClone(state),t,io).assignment);
  if(JSON.stringify(io.source())!==source)throw Error('Batch source changed during validation.');
  d.assignments.push(...assignments);touchContext(state,hash);
  return {assignments:structuredClone(assignments)};
}
export function cancelWorker(state, input) {
  strictObject(input,['version','assignmentId','reason'],'cancellation');
  const a = ledger(state).assignments.find(a=>a.id===input.assignmentId);
  if (input.version!==1 || !a || a.status!=='active' || !text(input.reason)) throw Error('Cancellation needs an active assignment and reason.');
  const hash=contextHash(state); a.status='cancelling'; a.cancelReason=input.reason; touchContext(state,hash);
  return { runId:state.id,assignmentId:a.id,status:'cancelling',nextAction:'Cancel in the host, then record its terminal acknowledgment; capacity remains reserved.' };
}
export function reconcileWorkers(state, input, io) {
  if (!Array.isArray(input.dispositions)) throw Error('Reconciliation needs contribution dispositions.');
  const d=state.delegation;
  if (!d && input.dispositions.length) throw Error('No worker contributions exist.');
  const seen=new Set();
  for (const item of input.dispositions) {
    strictObject(item,['assignmentId','status','reason','findingIds','revalidation'],'worker disposition');
    const a=d?.assignments.find(a=>a.id===item.assignmentId);
    if (!a?.result || a.disposition || seen.has(a.id) || !['accepted','rejected'].includes(item.status) || !text(item.reason)) throw Error('Disposition needs an undisposed terminal result and evidence/reason.');
    a.stale ||= sourceDrift(a,io.source());
    strings(item.findingIds,'disposition findingIds');
    if (item.status==='accepted' && (!item.findingIds.length || a.stale&&!text(item.revalidation) || item.findingIds.some(id=>!input.findings?.some(f=>f.id===id && f.origins?.includes(a.id) && !['stale','superseded'].includes(f.status))))) throw Error('Accepted results need retained findings with origin and explicit stale-source revalidation.');
    for (const failure of a.result.failedApproaches) if (!input.failedApproaches?.includes(failure)) throw Error('Retain worker failed approaches as negative evidence.');
    if (a.result.questions.length && !text(item.revalidation) && !input.conflicts?.length) throw Error('Resolve worker questions explicitly or retain an unresolved conflict.');
    a.disposition=item.status; a.dispositionReason=item.reason; seen.add(a.id);
  }
}
