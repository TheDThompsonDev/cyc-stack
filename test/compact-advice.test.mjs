import test from 'node:test';
import assert from 'node:assert/strict';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join,resolve,dirname}from'node:path';
import{spawnSync}from'node:child_process';
import{readRun,controlRun}from'../scripts/runtime.mjs';
import{fixtureAssessment}from'../test-support/assessments.mjs';

test('compact record status keeps the3000-character budget while explicit next retains workflow advice',t=>{
 const root=mkdtempSync(join(tmpdir(),'cyc-compact-advice-'));let id;
 t.after(()=>{if(id&&readRun(root,id).status==='running')controlRun(root,id,'stop');assert.equal(dirname(root),resolve(tmpdir()));rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 mkdirSync(join(root,'.cyc'));writeFileSync(join(root,'.cyc/config.json'),JSON.stringify({schemaVersion:1,limits:{maxAttempts:3,maxNoProgress:2},verification:{commands:[{id:'unit',command:process.execPath,args:['-e','process.exit(0)']}]}}));
 writeFileSync(join(root,'feature.txt'),'value');writeFileSync(join(root,'second.txt'),'two');
 const cli=(...args)=>{const r=spawnSync(process.execPath,[resolve('bin/cyc.mjs'),...args],{cwd:root,env:{...process.env,CYC_BASELINE_MODE:'off'},encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(r.status,0,r.error?.message||r.stderr||r.stdout);return r;};
 id=JSON.parse(cli('run','start','--mode','standalone','--goal','Finish homework','--playbook','feature','--criterion','Finished leaves the active list','--criterion','Survives reload').stdout).runId;
 const path=join(root,'.cyc/runs',id,'scout.json');writeFileSync(path,JSON.stringify(fixtureAssessment(readRun(root,id),'scout')));
 cli('run','record','--run',id,'--summary','Plan: two files.','--assessment',path);
 const built=cli('run','record','--run',id,'--summary','Built.','--artifact','feature.txt','second.txt');
 assert(built.stdout.length<3000,'record status must remain compact; actual characters='+built.stdout.length);
 assert.equal(JSON.parse(built.stdout).stage,'verify');assert.deepEqual(readRun(root,id).handoffs.at(-1).artifacts.map(a=>a.path),['feature.txt','second.txt']);
 const next=JSON.parse(cli('run','next','--run',id).stdout);assert.equal(next.workflowAdvice.canWaiveRequiredChecks,false);assert.equal(next.stage,'verify');
});
