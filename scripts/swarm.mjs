import {randomUUID} from 'node:crypto';
import {digest} from './response-gate.mjs';
import {strictObject,text,identifier,strings,contextHash,renderContext,requireContextReady,touchContext,validateEvidence,reconcileContext,checkContextSize} from './task-context.mjs';
import {decideDelegation,assignBatch,reconcileWorkers,recordUsage,cancelWorker} from './delegation.mjs';

const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const str={type:'string'}, list=items=>({type:'array',items});
const range=object({min:{type:'number'},max:{type:'number'}});
export const swarmSchemas={
  plan:object({reason:str,independent:{type:'boolean'},sharedState:{type:'boolean'},tasks:list(object({id:str,objective:str,criteria:list(str),paths:list(str),stoppingRule:str})),estimates:{anyOf:[{type:'null'},object({solo:range,delegated:range,evidence:str})]}}),
  merge:object({summary:str,nextAction:str,reviews:list(object({assignmentId:str,status:{type:'string',enum:['supported','uncertain','rejected']},reason:str})),conflicts:list(object({id:str,detail:str}))})
};
const within=(p,s)=>p===s||p.startsWith(s+'/');
const signature=value=>digest(JSON.stringify(value));
const source=(state,io)=>Object.fromEntries(Object.entries(io.source()).filter(([p])=>!state.allowedPaths.length||state.allowedPaths.some(s=>within(p,s))).sort(([a],[b])=>a.localeCompare(b)));
const cycle=state=>{const s=state.delegation?.swarm;if(!s)throw Error('No automatic swarm operation exists.');return s;};
const tasksOf=(state,s)=>s.assignmentIds.map(id=>state.delegation.assignments.find(a=>a.id===id));
const resultSet=(state,s)=>signature(tasksOf(state,s).map(a=>({id:a.id,resultHash:a.resultHash,status:a.status,disposition:a.disposition??null})));
function current(state,s,job,io) {
  if(s.status==='cancelling'||job?.staleContext||job?.readyHash!==contextHash(state)||signature(source(state,io))!==s.basisHash)throw Error('Stale swarm source/context; preserve receipts and reconcile deliberately.');
}
export function startSwarm(state,input,io) {
  strictObject(input,['version','objective','retry'],'swarm start');
  const objective=input.objective===undefined?'time':input.objective;
  if(input.version!==1||!['time','tokens','spend'].includes(objective))throw Error('Invalid swarm objective.');
  if(state.delegation?.policy.mode!=='auto')throw Error('Automatic swarm needs frozen auto mode.');
  const prior=state.delegation.swarm;
  if(prior&&(!input.retry||Object.values(prior.jobs).some(j=>!j.result)||tasksOf(state,prior).some(a=>!a.result||!a.disposition)))throw Error('Swarm already started or has uncertain claims; inspect receipts, do not redispatch.');
  if(input.retry!==undefined&&typeof input.retry!=='boolean')throw Error('retry must be an explicit boolean.');
  if(prior&&state.delegation.assignments.some(a=>!a.disposition))throw Error('Pending worker contributions prevent another swarm.');
  requireContextReady(state,io,{allowPending:!!prior});
  const basis=source(state,io);if(!Object.keys(basis).length)throw Error('Swarm needs scoped source files.');
  const s={id:randomUUID(),status:'planning',objective,basis,basisHash:signature(basis),jobs:{},assignmentIds:[]};
  if(prior)(state.delegation.swarmHistory??=[]).push(prior);
  state.delegation.swarm=s;
  if(state.delegation.policy.maxWorkers<2||state.delegation.policy.maxAssignments-state.delegation.assignments.length<2) {
    const previous=contextHash(state);s.status='solo';s.decision=decideDelegation(state,{version:1,objective:s.objective,facts:{independent:false,sharedState:false,evidence:'Frozen policy has fewer than two available worker slots/assignments.'},capabilities:{dispatch:true,evidence:'Automatic route respects the frozen policy; no model turn is needed.'}});state.taskContext.summary=s.decision.reason;touchContext(state,previous);
  }
  return {runId:state.id,swarmId:s.id,status:s.status,...(s.decision?{decision:s.decision}:{})};
}
export function swarmPhase(state,action,input,io) {
  strictObject(input,['version','swarmId','phase','hostId','threadId','turnId','terminalStatus','result'],'swarm host receipt');
  const s=[state.delegation?.swarm,...(state.delegation?.swarmHistory??[])].find(s=>s?.id===input.swarmId);if(input.version!==1||!s||!['plan','merge'].includes(input.phase)||!text(input.hostId))throw Error('Foreign swarm operation.');
  if(s!==state.delegation.swarm&&action!=='record')throw Error('Archived swarm phases cannot be dispatched.');
  let job=s.jobs[input.phase];
  if(action==='claim') {
    requireContextReady(state,io,{allowPending:true});
    if(job||state.delegation.policy.mode!=='auto'||s.status!==(input.phase==='plan'?'planning':'working'))throw Error('Swarm phase needs an unclaimed current operation.');
    if(signature(source(state,io))!==s.basisHash)throw Error('Swarm source changed before dispatch.');
    const assignments=tasksOf(state,s);
    if(input.phase==='merge'&&(!assignments.length||assignments.some(a=>!a.result||a.disposition)))throw Error('Merge needs every undisposed terminal result.');
    const basis=input.phase==='plan'?s.basis:Object.fromEntries(Object.entries(s.basis).filter(([p])=>assignments.some(a=>a.paths.some(q=>within(p,q)))));
    const payload=input.phase==='plan'?{task:{goal:state.goal,criteria:state.criteria,objective:s.objective},maxWorkers:Math.min(state.delegation.policy.maxWorkers,state.delegation.policy.maxAssignments-state.delegation.assignments.length)}:{contributions:assignments.map(a=>({id:a.id,result:a.result}))};
    job={id:s.id+'-'+input.phase,role:input.phase,status:'active',basis,basisHash:signature(basis),contextDocument:renderContext(state),contextHash:contextHash(state),contextRevision:state.taskContext.revision,payload,host:{id:input.hostId,claimedAt:new Date().toISOString()},...(input.phase==='merge'?{resultSet:resultSet(state,s)}:{})};s.jobs[input.phase]=job;
  } else {
    if(job?.host.id!==input.hostId)throw Error('Foreign swarm host attempt.');
    if(action==='bind') {
      if(!text(input.threadId)||!text(input.turnId)||job.host.turnId&&(job.host.turnId!==input.turnId||job.host.threadId!==input.threadId))throw Error('Swarm thread/turn binding mismatch.');
      Object.assign(job.host,{threadId:input.threadId,turnId:input.turnId});
    } else if(action==='record') {
      const notStarted=input.terminalStatus==='not-started'&&!job.host.turnId&&!input.turnId;
      if(!notStarted&&(!job.host.turnId||input.threadId!==job.host.threadId||input.turnId!==job.host.turnId||!['completed','interrupted','failed'].includes(input.terminalStatus)))throw Error('Correlated swarm terminal acknowledgment required.');
      const expected=notStarted?['failed','cancelled']:input.terminalStatus==='completed'?['passed','failed']:[input.terminalStatus==='interrupted'?'cancelled':'failed'];
      strictObject(input.result,['status','summary','data','usage'],'swarm phase result');
      if(!expected.includes(input.result.status)||!text(input.result.summary)||Buffer.byteLength(JSON.stringify(input.result))>state.delegation.policy.maxResultBytes)throw Error('Invalid swarm terminal result.');
      const hash=signature(input.result);
      if(job.result){if(job.resultHash===hash&&job.host.terminalStatus===input.terminalStatus)return {runId:state.id,duplicate:true};throw Error('Swarm terminal envelope replay differs.');}
      const previous=contextHash(state);job.staleContext=previous!==job.contextHash;
      recordUsage(state.delegation,input.result.usage);job.result=structuredClone(input.result);job.resultHash=hash;job.status='returned';if(input.result.status!=='passed'&&s.status!=='cancelling')s.status='needs-reconciliation';Object.assign(job.host,{terminalStatus:input.terminalStatus,stoppedAt:new Date().toISOString()});touchContext(state,previous);job.readyHash=contextHash(state);
      return {runId:state.id,status:'needs-'+input.phase,result:structuredClone(job.result)};
    } else throw Error('Unknown swarm host action.');
  }
  return {runId:state.id,assignment:structuredClone(job)};
}
export function applySwarmPlan(state,input,io) {
  strictObject(input,['version','swarmId'],'swarm plan');const s=cycle(state),job=s.jobs.plan;
  if(input.version!==1||input.swarmId!==s.id||s.status!=='planning'||job?.result?.status!=='passed')throw Error('No successful current swarm plan.');
  current(state,s,job,io);const p=job.result.data;
  strictObject(p,['reason','independent','sharedState','tasks','estimates'],'planner output');
  if(!text(p.reason)||typeof p.independent!=='boolean'||typeof p.sharedState!=='boolean'||!Array.isArray(p.tasks))throw Error('Invalid planner independence evidence.');
  const limit=Math.min(state.delegation.policy.maxWorkers,state.delegation.policy.maxAssignments-state.delegation.assignments.length);
  if(p.tasks.length>limit||new Set(p.tasks.map(t=>t?.id)).size!==p.tasks.length||new Set(p.tasks.map(t=>t?.objective?.trim())).size!==p.tasks.length)throw Error('Plan exceeds frozen worker limits or repeats tasks.');
  for(const t of p.tasks){strictObject(t,['id','objective','criteria','paths','stoppingRule'],'planned task');strings(t.paths,'task paths');strings(t.criteria,'task criteria');if(!identifier(t.id)||t.id.length>32||!text(t.objective)||!text(t.stoppingRule)||!t.paths.length||!t.criteria.length||t.criteria.some(id=>!state.criteria.some(c=>c.id===id)))throw Error('Invalid planned task/criteria.');const paths=io.normalize(t.paths);if(paths.some(path=>!Object.keys(s.basis).some(p=>within(p,path))||state.allowedPaths.length&&!state.allowedPaths.some(q=>within(path,q))))throw Error('Planned scope exceeds parent authority.');}
  const decision=decideDelegation(state,{version:1,objective:s.objective,facts:{independent:p.independent&&p.tasks.length>=2&&limit>=2,sharedState:p.sharedState,evidence:p.reason},capabilities:{dispatch:true,evidence:'Planner completed a correlated read-only Codex turn.'},...(p.estimates===null?{}:{estimates:p.estimates})});
  const previous=contextHash(state);s.plan=structuredClone(p);s.decision=decision;s.status=decision.route==='delegate'?'planned':'solo';state.taskContext.summary=(s.status==='solo'?'Continue with the lead. ':'Independent swarm proposed. ')+p.reason;touchContext(state,previous);
  return {runId:state.id,swarmId:s.id,status:s.status,decision};
}
export function assignSwarm(state,input,io) {
  strictObject(input,['version','swarmId'],'swarm batch');const s=cycle(state);
  if(input.version!==1||input.swarmId!==s.id||s.status!=='planned'||signature(source(state,io))!==s.basisHash)throw Error('Swarm batch needs a current plan.');
  const revision=state.taskContext.revision,hash=contextHash(state);
  const tasks=s.plan.tasks.map(t=>({version:1,...t,id:s.id+'-'+t.id,writePaths:[],dependencies:[],contextRevision:revision,contextHash:hash}));
  const result=assignBatch(state,tasks,io);s.assignmentIds=result.assignments.map(a=>a.id);s.status='working';return {runId:state.id,swarmId:s.id,...result};
}
export function commitSwarm(state,input,io) {
  strictObject(input,['version','swarmId'],'swarm merge');const s=cycle(state),job=s.jobs.merge;
  if(input.version!==1||input.swarmId!==s.id||s.status!=='working'||job?.result?.status!=='passed')throw Error('No successful current swarm merge.');
  current(state,s,job,io);if(job.resultSet!==resultSet(state,s))throw Error('Stale swarm result set.');
  const p=job.result.data;strictObject(p,['summary','nextAction','reviews','conflicts'],'merge proposal');
  const tasks=tasksOf(state,s);if(!text(p.summary)||!text(p.nextAction)||!Array.isArray(p.reviews)||p.reviews.length!==tasks.length||new Set(p.reviews.map(r=>r.assignmentId)).size!==tasks.length||!Array.isArray(p.conflicts))throw Error('Merge must review every result exactly once.');
  for(const r of p.reviews){strictObject(r,['assignmentId','status','reason'],'finding review');if(!tasks.some(a=>a.id===r.assignmentId)||!['supported','uncertain','rejected'].includes(r.status)||!text(r.reason))throw Error('Foreign/invalid merge review.');}
  for(const c of p.conflicts){strictObject(c,['id','detail'],'merge conflict');if(!identifier(c.id)||!text(c.detail))throw Error('Invalid merge conflict.');}
  const findings=structuredClone(state.taskContext.findings),conflicts=structuredClone(state.taskContext.conflicts),failedApproaches=[...state.taskContext.failedApproaches],dispositions=[];
  const issue=detail=>conflicts.push({id:'swarm-'+s.id+'-'+conflicts.length,detail});
  for(const c of p.conflicts)issue(c.detail);
  for(const a of tasks){const review=p.reviews.find(r=>r.assignmentId===a.id),supported=a.result.status==='passed'&&review.status==='supported'&&a.result.findings.length>0;const ids=[];
    for(const f of a.result.findings){validateEvidence(state,f.evidence,io,{current:true});const id='finding-'+signature([s.id,a.id,f.id]).slice(0,32);if(findings.some(x=>x.id===id))throw Error('Swarm finding identity collision.');findings.push({...structuredClone(f),id,status:supported?'judgment':'hypothesis',origins:[a.id]});ids.push(id);}
    for(const failure of a.result.failedApproaches)if(!failedApproaches.includes(failure))failedApproaches.push(failure);
    for(const q of a.result.questions)issue(a.id+': '+q);
    if(!supported)issue(a.id+': '+review.status+'; '+review.reason);
    dispositions.push({assignmentId:a.id,status:supported&&ids.length?'accepted':'rejected',reason:review.reason,findingIds:supported?ids:[]});
  }
  const data={version:1,expectedRevision:state.taskContext.revision,summary:p.summary,nextAction:p.nextAction,findings,conflicts,failedApproaches,dispositions};
  const draft=structuredClone(state);reconcileWorkers(draft,data,io);reconcileContext(state,data,io);state.delegation=draft.delegation;state.delegation.swarm.status=conflicts.length?'needs-reconciliation':'merged';checkContextSize(state);state.delegation.swarm.committedContext={revision:state.taskContext.revision,hash:contextHash(state)};
  return {runId:state.id,swarmId:s.id,status:state.delegation.swarm.status};
}
export function cancelSwarm(state,input) {
  strictObject(input,['version','reason'],'swarm cancellation');const s=cycle(state);if(input.version!==1||!text(input.reason)||['merged','solo','needs-reconciliation'].includes(s.status))throw Error('Cancellation needs an active swarm and reason.');
  s.status='cancelling';s.cancelReason=input.reason;for(const j of Object.values(s.jobs))if(j.status==='active'){j.status='cancelling';j.cancelReason=input.reason;}
  for(const a of tasksOf(state,s))if(a.status==='active')cancelWorker(state,{version:1,assignmentId:a.id,reason:input.reason});return {runId:state.id,status:'cancelling'};
}

// Calls generate outside transactions; only the parent commits state.
export async function executeSwarm(root,id,input,host={}) {
  strictObject(input,['version','objective','model','timeoutMs','maxInputBytes','retry'],'automatic swarm');
  if(input.version!==1)throw Error('Unsupported automatic swarm version.');
  const {readRun,delegateRun,taskContext}=await import('./runtime.mjs');const {executeCodex,executeSwarmPhase,executionLimits}=await import('./codex-host.mjs');executionLimits(input);
  const ack=()=>{const v=taskContext(root,id,'task');taskContext(root,id,'ack',{version:1,revision:v.revision,hash:v.hash,receipt:v.receipt,application:'Automatic parent applies this current task context; acknowledgment is not proof of comprehension.'});return v;};
  const before=readRun(root,id);if(before.delegation?.policy.mode!=='auto')throw Error('Automatic swarm needs frozen auto mode.');
  if(before.delegation.swarm&&!input.retry)throw Error('Swarm already started; inspect retained receipts, do not redispatch.');
  ack();const started=delegateRun(root,id,'swarm-start',{version:1,...(input.objective!==undefined?{objective:input.objective}:{}),...(input.retry!==undefined?{retry:input.retry}:{})});if(!started.swarmId)return started;
  if(started.status==='solo')return {...started,context:ack()};
  const options={version:1,...Object.fromEntries(['model','timeoutMs','maxInputBytes'].filter(k=>input[k]!==undefined).map(k=>[k,input[k]]))};
  const phase=async name=>executeSwarmPhase(root,id,{...options,swarmId:started.swarmId,phase:name},host);
  const active=()=>{const s=readRun(root,id);return s.status==='running'&&s.delegation.swarm.status!=='cancelling';};
  const stopped=()=>({runId:id,status:readRun(root,id).status==='running'?'needs-reconciliation':readRun(root,id).status,nextAction:'Inspect retained swarm receipts; no automatic redispatch or parent completion.'});
  try {
  let result=await phase('plan');if(result.status==='needs-host-recovery'||!active())return {...stopped(),...result,status:result.status==='needs-host-recovery'?result.status:stopped().status};
  if(readRun(root,id).delegation.swarm.jobs.plan.result?.status!=='passed')return stopped();
  result=delegateRun(root,id,'swarm-plan',{version:1,swarmId:started.swarmId});if(result.status==='solo'){const context=ack();return {...result,context};}if(result.status!=='planned')return result;ack();
  const batch=delegateRun(root,id,'swarm-batch',{version:1,swarmId:started.swarmId});
  if(!batch.assignments)return batch;
  const outcomes=await Promise.allSettled(batch.assignments.map(a=>executeCodex(root,id,{...options,assignmentId:a.id},host)));
  if(!active())return {...stopped(),outcomes};
  if(outcomes.some(r=>r.status==='rejected'||r.value.status==='needs-host-recovery')||tasksOf(readRun(root,id),readRun(root,id).delegation.swarm).some(a=>!a.result))return {runId:id,status:'needs-host-recovery',outcomes,nextAction:'Preserve uncertain claims; inspect terminal receipts before any recovery.'};
  ack();result=await phase('merge');if(result.status==='needs-host-recovery'||!active())return {...stopped(),...result,status:result.status==='needs-host-recovery'?result.status:stopped().status};
  if(readRun(root,id).delegation.swarm.jobs.merge.result?.status!=='passed')return stopped();
  result=delegateRun(root,id,'swarm-commit',{version:1,swarmId:started.swarmId});if(!['merged','needs-reconciliation'].includes(result.status))return result;const context=result.status==='merged'?ack():taskContext(root,id,'task');return {...result,context};
  } catch(error) {
    const state=readRun(root,id),committed=state.delegation.swarm.committedContext;
    if(committed)return {runId:id,swarmId:started.swarmId,status:state.status!=='running'?state.status:state.taskContext.conflicts.length?'needs-reconciliation':'needs-context-ack',committed:true,context:committed,error:error.message,nextAction:'Preserve committed work; do not redispatch. A running parent may read/resolve/ack its current context.'};
    if(active())delegateRun(root,id,'swarm-error',{version:1,swarmId:started.swarmId,reason:error.message});throw error;
  }
}
