import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as runtime from '../scripts/runtime.mjs';
const {startRun,delegateRun,taskContext,readRun,controlRun}=runtime;
const fixtureServer=fileURLToPath(new URL('../test-support/codex-server.fixture.mjs',import.meta.url));
test('host runtime takes precedence over a stale PATH CLI',async t=>{
  const {codexCommand}=await import('../scripts/codex-host.mjs'),root=mkdtempSync(join(tmpdir(),'cyc-runtime-choice-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const host=join(root,'host-runtime.exe'),fallback=join(root,process.platform==='win32'?'codex.exe':'codex');writeFileSync(host,'host fixture');writeFileSync(fallback,'PATH fixture');
  assert.deepEqual(codexCommand({PATH:root,CODEX_APP_RUNTIME_CLI_PATH:host}),{command:host,args:[]});
  assert.deepEqual(codexCommand({PATH:root}),{command:fallback,args:[]});
});
test('invalid host runtime refuses fallback to a different CLI',async t=>{
  const {codexCommand}=await import('../scripts/codex-host.mjs'),root=mkdtempSync(join(tmpdir(),'cyc-runtime-invalid-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  writeFileSync(join(root,process.platform==='win32'?'codex.exe':'codex'),'PATH fixture');
  for(const host of [join(root,'missing.exe'),root,'relative.exe'])assert.throws(()=>codexCommand({PATH:root,CODEX_APP_RUNTIME_CLI_PATH:host}),/Host Codex runtime/);
});
function fixture(t,{mode='auto',root=mkdtempSync(join(tmpdir(),'cyc-auto-'))}={}) {
  t.after(()=>rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const old=process.env.CYC_SESSION;process.env.CYC_SESSION='host-lead';t.after(()=>old===undefined?delete process.env.CYC_SESSION:process.env.CYC_SESSION=old);
  writeFileSync(join(root,'value.txt'),'original');writeFileSync(join(root,'secret.txt'),'out of scope');
  const id=startRun(root,{goal:'Inspect value.',playbook:'investigation',session:'host-lead',allowedPaths:['value.txt'],criteria:[{id:'value',description:'Determine current value.'}],delegation:{version:1,mode,budgetTokens:10000,reserveTokens:1000,maxWorkers:1,maxAssignments:3}}).runId;
  delegateRun(root,id,'decide',{version:1,objective:'time',facts:{independent:true,sharedState:false,evidence:'Independent text inspection.'},capabilities:{dispatch:true,evidence:'Synthetic Codex protocol fixture.'}});
  const v=taskContext(root,id,'task');taskContext(root,id,'ack',{version:1,revision:v.revision,hash:v.hash,receipt:v.receipt,application:'Use current context for bounded source inspection.'});
  const a=delegateRun(root,id,'assign',{version:1,id:'scan',objective:'Inspect value.txt.',criteria:['value'],paths:['value.txt'],writePaths:[],dependencies:[],contextRevision:v.revision,contextHash:v.hash,tokenBudget:800,stoppingRule:'Return after source inspection.'}).assignment;
  return{root,id,a};
}
async function execute(f,mode='complete',input={}) {
  const {executeCodex}=await import('../scripts/codex-host.mjs');
  return executeCodex(f.root,f.id,{version:1,assignmentId:f.a.id,timeoutMs:10000,...input},{launch:{command:process.execPath,args:[fixtureServer,'--scenario='+mode]},pollMs:10,interruptGraceMs:200});
}
async function bound(f) {for(let n=0;n<300;n++){if(readRun(f.root,f.id).delegation.assignments[0].host?.turnId)return;await new Promise(r=>setTimeout(r,10));}throw Error('Worker did not bind.');}

test('auto Codex dispatch imports only correlated terminal findings and lead merges one acknowledged context',async t=>{
  const f=fixture(t);const result=await execute(f);assert.equal(result.status,'needs-reconciliation',JSON.stringify(result));
  const a=readRun(f.root,f.id).delegation.assignments[0];assert.equal(a.host.terminalStatus,'completed');assert.equal(a.result.usage.inputTokens,40);assert.equal(a.result.usage.cachedInputTokens,5);
  assert.equal(readRun(f.root,f.id).delegation.accountedTokens,50);
  const v=taskContext(f.root,f.id,'task');
  delegateRun(f.root,f.id,'reconcile',{version:1,expectedRevision:v.revision,summary:'Lead checked the stored value.',nextAction:'Deliver explanation.',findings:[{...a.result.findings[0],status:'observed',origins:['scan']}],conflicts:[],failedApproaches:[],dispositions:[{assignmentId:'scan',status:'accepted',reason:'Lead independently checked value.txt.',findingIds:['stored']}]});
  const merged=taskContext(f.root,f.id,'task');assert.match(merged.document,/Stored value is original/);
  taskContext(f.root,f.id,'ack',{version:1,revision:merged.revision,hash:merged.hash,receipt:merged.receipt,application:'Use reconciled value in parent delivery.'});
  const files=readdirSync(join(f.root,'.cyc/runs',f.id),{recursive:true});assert.deepEqual(files.filter(p=>p.endsWith('context.md')),['context.md']);
  assert.equal(readRun(f.root,f.id).taskContext.acknowledgment.hash,merged.hash);
});
test('auto dispatch claims once and cancellation keeps capacity until matching terminal acknowledgment',async t=>{
  const f=fixture(t),pending=execute(f,'cancel');await bound(f);
  await assert.rejects(execute(f),/unclaimed/i);
  delegateRun(f.root,f.id,'cancel',{version:1,assignmentId:'scan',reason:'No longer needed.'});
  assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);
  const result=await pending;assert.equal(result.host.terminalStatus,'interrupted');assert.equal(readRun(f.root,f.id).delegation.assignments[0].result.status,'cancelled');
});
test('parent stop interrupts Codex and accepts terminal cleanup without reopening or advancing the run',async t=>{
  const f=fixture(t),pending=execute(f,'stop');await bound(f);const before=readRun(f.root,f.id);
  controlRun(f.root,f.id,'stop');const result=await pending;assert.equal(result.host.terminalStatus,'interrupted');
  const state=readRun(f.root,f.id);assert.equal(state.status,'stopped');assert.equal(state.stageIndex,before.stageIndex);assert.equal(state.delegation.assignments[0].result.status,'cancelled');
});
test('lost Codex transport retains reservation and rejects automatic redispatch',async t=>{
  const f=fixture(t);const result=await execute(f,'death');assert.equal(result.status,'needs-host-recovery');assert.equal(result.capacityReserved,true);assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);await assert.rejects(execute(f),/unclaimed/);
});
test('interrupt request response without terminal acknowledgment cannot release worker capacity',async t=>{
  const f=fixture(t),pending=execute(f,'noack');await bound(f);delegateRun(f.root,f.id,'cancel',{version:1,assignmentId:'scan',reason:'Explicit cancellation; acknowledge termination.'});const result=await pending;assert.equal(result.status,'needs-host-recovery');assert.equal(result.capacityReserved,true);assert.match(result.error,/terminal acknowledgment/);assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);
});
test('matching terminal acknowledgment wins when Codex exits without replying to interrupt',async t=>{
  const f=fixture(t),pending=execute(f,'terminal-no-reply');await bound(f);delegateRun(f.root,f.id,'cancel',{version:1,assignmentId:'scan',reason:'Explicit cancellation.'});const result=await pending;assert.equal(result.host.terminalStatus,'interrupted');assert.equal(readRun(f.root,f.id).delegation.assignments[0].result.status,'cancelled');
});
test('contradictory canonical turn ID cannot release capacity despite matching direct turnId',async t=>{
  const f=fixture(t),pending=execute(f,'foreign-terminal');await bound(f);await new Promise(r=>setTimeout(r,100));assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);delegateRun(f.root,f.id,'cancel',{version:1,assignmentId:'scan',reason:'Explicit cancellation after foreign terminal refusal.'});const result=await pending;assert.equal(result.host.terminalStatus,'interrupted');assert.equal(readRun(f.root,f.id).delegation.assignments[0].result.status,'cancelled');
});
test('terminal envelope replay cannot alter status or timestamp while replaying the same result',async t=>{
  const f=fixture(t),r=await execute(f,'invalid'),receipt=JSON.parse(readFileSync(join(f.root,r.host.receiptPath)));const before=readRun(f.root,f.id).delegation.assignments[0].host;
  assert.equal(runtime.workerHost(f.root,f.id,'record',receipt).duplicate,true);
  assert.deepEqual(readRun(f.root,f.id).delegation.assignments[0].host,before);
  assert.throws(()=>runtime.workerHost(f.root,f.id,'record',{...receipt,terminalStatus:'failed'}),/envelope replay/);
});
test('parent stop during asynchronous setup prevents a model turn and still records terminal cleanup',async t=>{
  const f=fixture(t),pending=execute(f,'slow-setup');for(let i=0;i<300&&!readRun(f.root,f.id).delegation.assignments[0].host;i++)await new Promise(r=>setTimeout(r,10));controlRun(f.root,f.id,'stop');const result=await pending;assert.equal(result.host.terminalStatus,'not-started');const s=readRun(f.root,f.id);assert.equal(s.status,'stopped');assert.equal(s.delegation.assignments[0].result.status,'cancelled');
});
test('Codex refuses non-auto policy and changed source before spawn',async t=>{
  const f=fixture(t,{mode:'recommend'});await assert.rejects(execute(f),/Auto dispatch/);
  const g=fixture(t);writeFileSync(join(g.root,'value.txt'),'changed');await assert.rejects(execute(g),/source changed/);
});
test('Codex rejects foreign owner and foreign thread receipts even with unchanged cached identity',async t=>{
  const f=fixture(t);process.env.CYC_SESSION='different';await assert.rejects(execute(f),/owner|another|parent/i);process.env.CYC_SESSION='host-lead';
  const {workerHost}=runtime;workerHost(f.root,f.id,'claim',{version:1,assignmentId:'scan',hostId:'attempt'});workerHost(f.root,f.id,'bind',{version:1,assignmentId:'scan',hostId:'attempt',threadId:'captured',turnId:'captured-turn'});
  assert.throws(()=>workerHost(f.root,f.id,'record',{version:1,assignmentId:'scan',hostId:'attempt',threadId:'foreign',turnId:'captured-turn',terminalStatus:'completed',result:{}}),/Correlated/);
  assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);
});
test('ordinary record cannot release a host-claimed cancelling worker without correlated termination',async t=>{
  const f=fixture(t),{workerHost}=runtime;workerHost(f.root,f.id,'claim',{version:1,assignmentId:'scan',hostId:'attempt'});workerHost(f.root,f.id,'bind',{version:1,assignmentId:'scan',hostId:'attempt',threadId:'thread',turnId:'turn'});
  delegateRun(f.root,f.id,'cancel',{version:1,assignmentId:'scan',reason:'Cancel pending work.'});
  assert.throws(()=>delegateRun(f.root,f.id,'record',{version:1,assignmentId:'scan',resultId:'forged',status:'cancelled',contextRevision:f.a.contextRevision,contextHash:f.a.contextHash,basisHash:f.a.basisHash,summary:'Uncorrelated stop assertion.',findings:[],failedApproaches:[],questions:[],hostStopped:true}),/correlated host receipt/);
  assert.equal(readRun(f.root,f.id).delegation.assignments[0].status,'cancelling');assert.equal(readRun(f.root,f.id).delegation.assignments[0].result,undefined);
});
test('refused dispatch persists the existing scope guard halt without spawning a worker',async t=>{
  const f=fixture(t);writeFileSync(join(f.root,'secret.txt'),'unauthorized change');const result=await execute(f);assert.equal(result.status,'halted');assert.equal(readRun(f.root,f.id).status,'halted');assert.equal(readRun(f.root,f.id).delegation.assignments[0].host,undefined);
});
test('unexpected unified-context edits refuse dispatch before a host claim or model request',async t=>{
  const f=fixture(t),path=join(f.root,'.cyc/runs',f.id,'context.md');writeFileSync(path,readFileSync(path,'utf8')+'\nUnexpected edit.\n');await assert.rejects(execute(f),/needs-context-sync/);assert.equal(readRun(f.root,f.id).delegation.assignments[0].host,undefined);assert.match(readFileSync(path,'utf8'),/Unexpected edit/);
});
test('reported token usage above a legacy allowance does not interrupt a running worker',async t=>{
  const f=fixture(t),result=await execute(f,'budget');assert.equal(result.host.terminalStatus,'completed',JSON.stringify(result));const a=readRun(f.root,f.id).delegation.assignments[0];assert.equal(a.result.status,'passed');assert.equal(a.result.usage.inputTokens,900);assert.equal(a.result.usage.outputTokens,10);assert.equal(a.overBudget,undefined);
});
test('unexpected worker tool activity still interrupts independently of token usage',async t=>{
  const f=fixture(t),result=await execute(f,'tool');assert.equal(result.host.terminalStatus,'interrupted');assert.equal(readRun(f.root,f.id).delegation.assignments[0].result.status,'cancelled');
});
test('Codex fails closed on unsafe policy, malformed findings and evidence outside the assignment',async t=>{
  for(const mode of ['unsafe','invalid','foreign-evidence']) {const f=fixture(t),result=await execute(f,mode);if(mode!=='foreign-evidence'){assert.equal(result.status,'needs-reconciliation');assert.equal(readRun(f.root,f.id).delegation.assignments[0].result.status,'failed');if(mode==='unsafe')assert.equal(result.host.terminalStatus,'not-started');}else{assert.equal(result.status,'needs-host-recovery');assert.equal(result.capacityReserved,true);}}
});
test('copied CLI automatically dispatches through its installed Codex adapter and imports terminal findings',async t=>{
  const {installProject}=await import('../scripts/install.mjs');
  const root=mkdtempSync(join(tmpdir(),'cyc-installed-auto-'));writeFileSync(join(root,'value.txt'),'original');await installProject(root,{hosts:['codex']});
  const f=fixture(t,{root});
  assert.ok(existsSync(join(root,'.cyc/engine/scripts/codex-host.mjs')));
  const shim=join(root,'.cyc/runtime/shim'),entry=join(shim,'node_modules/@openai/codex/bin/codex.js');mkdirSync(dirname(entry),{recursive:true});
  writeFileSync(join(shim,'node_modules/@openai/codex/package.json'),'{"type":"module"}');writeFileSync(entry,readFileSync(fixtureServer));
  if(process.platform!=='win32'){writeFileSync(join(shim,'codex'),'#!/usr/bin/env node\n'+readFileSync(fixtureServer,'utf8'),{mode:0o755});}
  const input=join(root,'.cyc/runtime/execute.json');writeFileSync(input,JSON.stringify({version:1,assignmentId:'scan',timeoutMs:10000}));
  const r=spawnSync(process.execPath,[join(root,'.cyc/engine/bin/cyc.mjs'),'delegate','execute','--run',f.id,'--file',input,'--project',root],{encoding:'utf8',env:{...process.env,CODEX_APP_RUNTIME_CLI_PATH:'',PATH:shim+ (process.platform==='win32'?';':':')+process.env.PATH},timeout:30000,windowsHide:true});
  assert.equal(r.status,0,r.stdout+r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.host.terminalStatus,'completed',r.stdout);assert.equal(readRun(root,f.id).delegation.assignments[0].result.findings[0].id,'stored');
});
