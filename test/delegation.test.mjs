import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as runtime from '../scripts/runtime.mjs';
const { startRun,readRun,taskContext,delegateRun,quickHandoff } = runtime;
import { digest } from '../scripts/response-gate.mjs';

const policy = extra => ({version:1,mode:'recommend',maxWorkers:1,maxAssignments:4,budgetTokens:1000,reserveTokens:200,...extra});
const facts = extra => ({version:1,objective:'tokens',facts:{independent:true,sharedState:false,evidence:'Fixture branches are independent.'},capabilities:{dispatch:true,evidence:'Simulated host dispatch, not live qualification.'},...extra});
function fixture(t, extra={}, maxBytes) {
  const root=mkdtempSync(join(tmpdir(),'cyc-delegate-')); t.after(()=>rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const previous=process.env.CYC_SESSION;process.env.CYC_SESSION='delegation-lead';t.after(()=>previous===undefined?delete process.env.CYC_SESSION:process.env.CYC_SESSION=previous);
  mkdirSync(join(root,'.cyc'));writeFileSync(join(root,'.cyc/config.json'),'{}');writeFileSync(join(root,'value.txt'),'original');
  const id=startRun(root,{goal:'Inspect value.',playbook:'investigation',session:'delegation-lead',allowedPaths:['value.txt'],criteria:[{id:'value',description:'Inspect current value.'}],...(maxBytes ? {taskContext:{version:1,maxBytes}} : {}),delegation:policy(extra)}).runId;
  delegateRun(root,id,'decide',facts({objective:'time'}));
  return {root,id};
}
function current(f) { const v=taskContext(f.root,f.id,'task'); taskContext(f.root,f.id,'ack',{version:1,revision:v.revision,hash:v.hash,receipt:v.receipt,application:'Use the integrated current evidence.'});return v; }
function assign(f,id='scan',extra={}) {
  const v=current(f);
  return delegateRun(f.root,f.id,'assign',{version:1,id,objective:'Read stored value.',criteria:['value'],paths:['value.txt'],writePaths:[],dependencies:[],contextRevision:v.revision,contextHash:v.hash,tokenBudget:300,stoppingRule:'Return after inspecting value.txt.',...extra}).assignment;
}
function result(a,extra={}) { return {version:1,assignmentId:a.id,resultId:'result-'+a.id,status:'passed',contextRevision:a.contextRevision,contextHash:a.contextHash,basisHash:a.basisHash,summary:'Read the value; simulated host result.',hostStopped:true,findings:[{id:'value',text:'Stored value is original.',evidence:[{path:'value.txt',sha256:digest('original')}]}],failedApproaches:[],questions:[],...extra}; }
function merge(f,a,extra={}) {
  const v=taskContext(f.root,f.id,'task');
  return delegateRun(f.root,f.id,'reconcile',{version:1,expectedRevision:v.revision,summary:'Stored value was inspected.',nextAction:'Continue parent investigation.',findings:[{id:'stored',status:'observed',text:'Stored value is original.',evidence:[{path:'value.txt',sha256:digest('original')}],origins:[a.id]}],conflicts:[],failedApproaches:[],dispositions:[{assignmentId:a.id,status:'accepted',reason:'Lead checked source.',findingIds:['stored']}],...extra});
}

test('economic routing favors solo for unknown/overlapping cost and shared state',async()=>{
  const {delegationPolicy,initializeDelegation,decideDelegation}=await import('../scripts/delegation.mjs');
  const state={delegation:initializeDelegation(delegationPolicy(policy()))};
  assert.equal(decideDelegation(state,facts()).route,'solo');
  assert.equal(decideDelegation(state,facts({estimates:{solo:{min:500,max:800},delegated:{min:400,max:600},evidence:'Agent estimate including integration.'}})).route,'solo');
  assert.equal(decideDelegation(state,facts({estimates:{solo:{min:700,max:900},delegated:{min:300,max:500},evidence:'Agent estimate including checking.'}})).route,'delegate');
  assert.equal(decideDelegation(state,facts({objective:'time',facts:{independent:true,sharedState:true,evidence:'Shared mutable decision.'}})).route,'solo');
  assert.equal(decideDelegation(state,facts({capabilities:{dispatch:false,evidence:'Unavailable.'}})).route,'solo');
  assert.equal(delegationPolicy(policy({mode:'auto'})).mode,'auto');
  assert.throws(()=>delegationPolicy(policy({mode:'unknown'})),/mode/i);
  assert.throws(()=>decideDelegation(state,facts({hidden:true})),/Unknown/i);
});

test('read-only assignments reject widened scope, writes, dependencies and malformed metadata without state changes',t=>{
  const f=fixture(t);const v=current(f);const prior=JSON.stringify(readRun(f.root,f.id));
  const base={version:1,id:'scan',objective:'Inspect.',criteria:['value'],paths:['value.txt'],writePaths:[],dependencies:[],contextRevision:v.revision,contextHash:v.hash,tokenBudget:300,stoppingRule:'Stop after reading.'};
  for(const extra of [{paths:['outside.txt']},{writePaths:['value.txt']},{dependencies:['scan']},{tokenBudget:-1},{contextRevision:0}]) assert.throws(()=>delegateRun(f.root,f.id,'assign',{...base,...extra}),/scope|authority|read-only|Dependencies|metadata|budget|revision/i);
  assert.equal(JSON.stringify(readRun(f.root,f.id)),prior);
});

test('cancellation retains capacity until a terminal host acknowledgment and never resets assignment totals',t=>{
  const f=fixture(t,{maxAssignments:2});const a=assign(f);
  delegateRun(f.root,f.id,'cancel',{version:1,assignmentId:a.id,reason:'No longer needed.'});
  assert.throws(()=>assign(f,'second'),/Active worker/i);
  assert.throws(()=>delegateRun(f.root,f.id,'record',result(a,{status:'cancelled',hostStopped:false})),/terminal/i);
  delegateRun(f.root,f.id,'record',result(a,{status:'cancelled',findings:[]}));
  const v=taskContext(f.root,f.id,'task');
  delegateRun(f.root,f.id,'reconcile',{version:1,expectedRevision:v.revision,summary:'Cancelled unneeded branch.',nextAction:'Continue.',findings:[],conflicts:[],failedApproaches:[],dispositions:[{assignmentId:a.id,status:'rejected',reason:'Cancelled branch; no findings promoted.',findingIds:[]}]});
  assign(f,'second'); assert.equal(readRun(f.root,f.id).delegation.assignments.length,2);
});

test('worker result replay is idempotent and changed replay is rejected without extra charge',t=>{
  const f=fixture(t);const a=assign(f);const r=result(a);
  delegateRun(f.root,f.id,'record',r);const before=readRun(f.root,f.id);
  assert.equal(delegateRun(f.root,f.id,'record',r).duplicate,true);
  assert.equal(readRun(f.root,f.id).taskContext.revision,before.taskContext.revision);
  assert.equal(readRun(f.root,f.id).delegation.accountedTokens,0);
  assert.equal(readRun(f.root,f.id).delegation.usageUnknown,true);
  assert.throws(()=>delegateRun(f.root,f.id,'record',{...r,summary:'Altered replay.'}),/replay/i);
});

test('worker success cannot advance parent handoffs before reconciliation and current acknowledgment',t=>{
  const f=fixture(t);const a=assign(f);delegateRun(f.root,f.id,'record',result(a));current(f);
  assert.throws(()=>quickHandoff(f.root,f.id,{summary:'Worker passed.'}),/Pending|reconcil/i);
  merge(f,a);
  assert.throws(()=>quickHandoff(f.root,f.id,{summary:'Still unread.'}),/acknowledg/i);
  current(f);quickHandoff(f.root,f.id,{summary:'Lead reconciled source evidence.'});
  assert.equal(readRun(f.root,f.id).handoffs.length,1);
});

test('source drift requires explicit lead revalidation and current evidence before accepting a result',t=>{
  const f=fixture(t);const a=assign(f);writeFileSync(join(f.root,'value.txt'),'changed');
  assert.equal(delegateRun(f.root,f.id,'record',result(a)).stale,true);
  assert.throws(()=>merge(f,a),/revalidation/i);
  merge(f,a,{findings:[{id:'stored',status:'observed',text:'Now changed.',evidence:[{path:'value.txt',sha256:digest('changed')}],origins:[a.id]}],dispositions:[{assignmentId:a.id,status:'accepted',reason:'Lead re-read changed source.',findingIds:['stored'],revalidation:'Current source now says changed; earlier observation is historical.'}]});
  current(f);
});

test('reported token usage cannot refuse further work even beyond legacy allowances; cached input is a subset',t=>{
  const f=fixture(t);const a=assign(f);
  const returned=delegateRun(f.root,f.id,'record',result(a,{usage:{receiptId:'host-observation',inputTokens:800,cachedInputTokens:700,outputTokens:100,model:'fixture',origin:'host-reported'}}));
  assert.equal(readRun(f.root,f.id).delegation.accountedTokens,900);
  merge(f,a);assert.equal(assign(f,'more',{tokenBudget:900000}).id,'more');
  assert.equal(returned.overBudget,undefined);
});

test('delegation and assignments need no token amounts and discard obsolete cap inputs',t=>{
  const f=fixture(t,{budgetTokens:undefined,reserveTokens:undefined});const a=assign(f,'scan',{tokenBudget:undefined});
  assert.equal('tokenBudget' in a,false);assert.equal('budgetTokens' in readRun(f.root,f.id).delegation.policy,false);
  const g=fixture(t,{budgetTokens:1,reserveTokens:999});const b=assign(g,'scan',{tokenBudget:999999});assert.equal('tokenBudget' in b,false);
});

test('missing and estimated usage never creates a synthetic token reservation charge',t=>{
  const f=fixture(t);const a=assign(f);delegateRun(f.root,f.id,'record',result(a));merge(f,a);
  assert.equal(readRun(f.root,f.id).delegation.accountedTokens,0);
  const b=assign(f,'estimate');delegateRun(f.root,f.id,'record',result(b,{usage:{receiptId:'estimate-only',inputTokens:1,outputTokens:1,model:'fixture',origin:'agent-estimated'}}));
  const d=readRun(f.root,f.id).delegation;assert.equal(d.accountedTokens,2);assert.equal(d.observedTokens,0);assert.equal(d.usageUnknown,true);
});

test('failed worker consumes the shared failure budget and cannot be hidden by a fresh assignment',t=>{
  const f=fixture(t);const a=assign(f);
  delegateRun(f.root,f.id,'record',result(a,{status:'failed',summary:'The bounded question remains unproven.'}));
  assert.equal(readRun(f.root,f.id).failures,1);
  assert.equal(readRun(f.root,f.id).attempt,2);
});

test('canonical evidence paths cannot cross worker scope or another run through traversal',t=>{
  const f=fixture(t);const a=assign(f);
  const foreign=join(f.root,'.cyc/runs/foreign');mkdirSync(foreign,{recursive:true});writeFileSync(join(foreign,'secret.txt'),'secret');
  const escaped=result(a,{findings:[{id:'escaped',text:'Foreign run secret.',evidence:[{path:'.cyc/runs/'+f.id+'/../foreign/secret.txt',sha256:digest('secret')}]}]});
  assert.throws(()=>delegateRun(f.root,f.id,'record',escaped),/another run|scope|protected/i);
  assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);
});

test('source changes after result recording require revalidation at reconciliation',t=>{
  const f=fixture(t);const a=assign(f);delegateRun(f.root,f.id,'record',result(a));
  writeFileSync(join(f.root,'value.txt'),'changed');
  const findings=[{id:'stored',status:'observed',text:'Current source is changed.',evidence:[{path:'value.txt',sha256:digest('changed')}],origins:[a.id]}];
  assert.throws(()=>merge(f,a,{findings}),/revalidation/i);
  merge(f,a,{findings,dispositions:[{assignmentId:a.id,status:'accepted',reason:'Lead inspected new source.',findingIds:['stored'],revalidation:'Re-read after result recording; earlier value is historical.'}]});
  current(f);
});

test('result IDs cannot be reused across assignments',t=>{
  const f=fixture(t);const a=assign(f);const r=result(a);delegateRun(f.root,f.id,'record',r);merge(f,a);
  const b=assign(f,'second');
  assert.throws(()=>delegateRun(f.root,f.id,'record',result(b,{resultId:r.resultId})),/Result ID|already bound/i);
});


test('the final reconciled document including dispositions must fit its byte limit',async t=>{
  const {renderContext}=await import('../scripts/task-context.mjs');
  const f=fixture(t,{},4096);const a=assign(f);delegateRun(f.root,f.id,'record',result(a));
  const before=taskContext(f.root,f.id,'task');
  const staged=structuredClone(readRun(f.root,f.id));
  Object.assign(staged.taskContext,{revision:staged.taskContext.revision+1,summary:'',nextAction:'Continue parent investigation.',findings:[{id:'stored',status:'observed',text:'Stored value is original.',evidence:[{path:'value.txt',sha256:digest('original')}],origins:[a.id]}],conflicts:[],failedApproaches:[]});
  const remaining=4096-Buffer.byteLength(renderContext(staged));assert.ok(remaining>0);
  assert.throws(()=>merge(f,a,{summary:'x'.repeat(remaining)}),/size|bytes|large/i);
  assert.equal(taskContext(f.root,f.id,'task').hash,before.hash);
});

test('a terminal worker can retain deleted-source observations from its frozen assignment basis',t=>{
  const f=fixture(t);const a=assign(f);rmSync(join(f.root,'value.txt'));
  assert.equal(delegateRun(f.root,f.id,'record',result(a)).stale,true);
  const v=taskContext(f.root,f.id,'task');
  delegateRun(f.root,f.id,'reconcile',{version:1,expectedRevision:v.revision,summary:'The source was deleted after dispatch.',nextAction:'Continue without promoting the historical result.',findings:[],conflicts:[],failedApproaches:[],dispositions:[{assignmentId:a.id,status:'rejected',reason:'The known assignment-basis observation is historical after deletion.',findingIds:[]}]});
  current(f);
});
