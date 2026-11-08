import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installProject } from '../scripts/install.mjs';
import { digest } from '../scripts/response-gate.mjs';
import * as runtime from '../scripts/runtime.mjs';
const { startRun,taskContext,delegateRun,quickHandoff,verifyRun,readRun,proveRun } = runtime;
import { fixtureAssessment } from '../test-support/assessments.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const put=(root,path,data)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),typeof data==='string'?data:JSON.stringify(data));};

test('copied installation routes a bounded worker into one shared context and completes only the reconciled parent',async t=>{
  const root=mkdtempSync(join(tmpdir(),'cyc-delegation-install-'));
  t.after(()=>rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  put(root,'value.txt','original');await installProject(root,{hosts:['codex']});
  assert.ok(existsSync(join(root,'.cyc/engine/scripts/task-context.mjs')));
  assert.ok(existsSync(join(root,'.cyc/engine/scripts/delegation.mjs')));
  const cli=join(root,'.cyc/engine/bin/cyc.mjs');
  function run(args,success=true) {
    const r=spawnSync(process.execPath,[cli,...args,'--project',root],{cwd:root,encoding:'utf8',env:{...process.env,CYC_SESSION:'installed-lead'},timeout:120000});
    if(success) assert.equal(r.status,0,r.stderr+r.stdout); else assert.notEqual(r.status,0);
    return JSON.parse(success?r.stdout:r.stderr);
  }
  let serial=0;
  function file(action,data) {const p='.cyc/runtime/input-'+(++serial)+'.json';put(root,p,data);return run([...action,'--file',p]);}
  const started=file(['run','start'],{goal:'Inspect the source value.',playbook:'investigation',session:'installed-lead',allowedPaths:['value.txt'],criteria:[{id:'value',description:'Determine current value.'}],delegation:{version:1}});
  const id=started.runId;
  const call=(action,data)=>file(['delegate',action,'--run',id],data);
  const read=()=>run(['context','task','--run',id]);
  const ack=()=>{const v=read();file(['context','ack','--run',id],{version:1,revision:v.revision,hash:v.hash,receipt:v.receipt,application:'Apply the current reconciled value to the parent answer.'});return v;};
  assert.equal(call('decide',{version:1,objective:'time',facts:{independent:true,sharedState:false,evidence:'A separate source inspection is bounded.'},capabilities:{dispatch:true,evidence:'Synthetic host fixture; real activation is unverified.'}}).route,'delegate');
  const v=ack();
  const a=call('assign',{version:1,id:'inspect',objective:'Read value.txt.',criteria:['value'],paths:['value.txt'],writePaths:[],dependencies:[],contextRevision:v.revision,contextHash:v.hash,stoppingRule:'Return after reading the source.'}).assignment;
  call('record',{version:1,assignmentId:a.id,resultId:'inspect-result',status:'passed',contextRevision:a.contextRevision,contextHash:a.contextHash,basisHash:a.basisHash,summary:'Observed original in value.txt.',hostStopped:true,findings:[{id:'stored',text:'The current value is original.',evidence:[{path:'value.txt',sha256:digest('original')}]}],failedApproaches:[],questions:[]});
  const pending=read();
  call('reconcile',{version:1,expectedRevision:pending.revision,summary:'The lead checked that the value is original.',nextAction:'Deliver the supported explanation.',findings:[{id:'stored',status:'observed',text:'The current value is original.',evidence:[{path:'value.txt',sha256:digest('original')}],origins:['inspect']}],conflicts:[],failedApproaches:[],dispositions:[{assignmentId:'inspect',status:'accepted',reason:'Lead re-read the source.',findingIds:['stored']}]});
  const final=ack();assert.match(final.document,/value is original/);
  let state=run(['run','status','--run',id,'--verbose']);
  while(state.stageIndex<state.stages.length) {
    run(['run','record','--run',id,'--summary','Parent used reconciled source evidence.','--criteria-passed','value.txt contains original; the source and unified context agree.']);
    state=run(['run','status','--run',id,'--verbose']);
  }
  run(['run','complete','--run',id]);
  state=run(['run','status','--run',id,'--verbose']);
  assert.equal(state.status,'complete');
  assert.equal(state.handoffs.at(-1).taskContext.hash,final.hash);
  assert.equal(state.delegation.assignments[0].disposition,'accepted');
  run(['delegate','decide','--run',id,'--file','.cyc/runtime/input-1.json'],false);
});

test('new material context after successful verification requires retry and source checks remain binding',t=>{
  const root=mkdtempSync(join(tmpdir(),'cyc-context-verify-'));
  t.after(()=>rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const old=process.env.CYC_SESSION;process.env.CYC_SESSION='verification-lead';t.after(()=>old===undefined?delete process.env.CYC_SESSION:process.env.CYC_SESSION=old);
  put(root,'value.txt','original');
  put(root,'.cyc/config.json',{verification:{commands:[{id:'behavior',command:process.execPath,args:['-e',"if(require('fs').readFileSync('value.txt','utf8')!=='original')process.exit(1)"]}]}});
  const id=startRun(root,{goal:'Review unchanged source.',playbook:'verify',session:'verification-lead',criteria:[{id:'value',description:'Current source matches.'}]}).runId;
  let state=readRun(root,id);
  // Advisory verification has no feature-retention contract; stage checks still run real code.
  while(state.stages[state.stageIndex]!=='verify') {quickHandoff(root,id,{summary:'Inspected current source.',assessment:fixtureAssessment(state)});state=readRun(root,id);}
  const v=taskContext(root,id,'task');taskContext(root,id,'ack',{version:1,revision:v.revision,hash:v.hash,receipt:v.receipt,application:'Run the source check with this current task context.'});
  assert.equal(verifyRun(root,id).passed,true);
  assert.equal(readRun(root,id).verification.taskContext.hash,v.hash);
  assert.throws(()=>delegateRun(root,id,'reconcile',{version:1}),/after verification|retry/i);
});

test('original proof recovers a mixed final newline only when it matches the recorded hash',t=>{
  const root=mkdtempSync(join(tmpdir(),'cyc-original-ending-'));t.after(()=>rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const old=process.env.CYC_SESSION;process.env.CYC_SESSION='ending-lead';t.after(()=>old===undefined?delete process.env.CYC_SESSION:process.env.CYC_SESSION=old);
  const git=args=>{const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
  put(root,'value.txt','before\nlast\r\n');put(root,'.gitattributes','*.txt text eol=lf\n');
  git(['init','-q']);git(['add','value.txt','.gitattributes']);git(['-c','user.name=CYC fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture source']);
  put(root,'.cyc/config.json',{verification:{commands:[{id:'behavior',command:process.execPath,args:['-e',"delete process.env.NODE_TEST_CONTEXT;const r=require('child_process').spawnSync(process.execPath,['--test','--test-reporter=tap'],{stdio:'inherit'});process.exit(r.status??1)"]}]}});
  const id=startRun(root,{goal:'Extend the stored value.',playbook:'feature',session:'ending-lead',allowedPaths:['value.txt','test']}).runId;
  quickHandoff(root,id,{summary:'Inspected fixture source.',assessment:fixtureAssessment(readRun(root,id),'scout')});
  put(root,'value.txt','after\nlast\r\n');
  put(root,'test/value.test.mjs',"import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';test('new stored value',()=>assert.match(readFileSync('value.txt','utf8'),/^after/));");
  assert.equal(proveRun(root,id,{}).passed,true);
  assert.equal(readFileSync(join(root,'value.txt'),'utf8'),'after\nlast\r\n');
});
