import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Execute only in a disposable, authorized test project. This is behavior evidence,
// not a participant observation, security boundary or workflow-activation check.
export async function evaluate(candidate,phase='first') {
  if(!['first','related'].includes(phase))throw Error('Phase must be first or related; recovery needs actual host/record observations.');
  const root=resolve(candidate),path=join(root,'src','tasks.mjs');
  for(const part of [root,join(root,'src'),path])if(lstatSync(part).isSymbolicLink())throw Error('Linked candidate paths are not supported.');
  if(!lstatSync(path).isFile())throw Error('Candidate entrypoint must be a regular file.');
  const hash=createHash('sha256').update(readFileSync(path)).digest('hex');
  const checks=[];
  const check=(id,fn)=>{try{fn();checks.push({id,result:'passed'});}catch(error){checks.push({id,result:'failed',error:error.message});}};
  let api;
  try{api=await import(pathToFileURL(path).href+'?source='+hash);}catch(error){return {schema_version:1,report_kind:'behavior_probe_not_user_trial',phase,source_hash:hash,passed:false,checks:[{id:'module-load',result:'failed',error:error.message}],limits:['Module load is not a demonstrated behavioral failure.']};}
  const rows=[{id:'a',completed:false,title:'Open',imported:{externalId:'import-a'},permissions:['owner:read'],validExtra:17},{id:'b',completed:true,title:'Done',imported:{externalId:'import-b'}},{id:'c',completed:null,title:'Legacy unknown'}];
  check('all-and-open-contract',()=>{const all=structuredClone(rows),open=structuredClone(rows),unknown=structuredClone(rows);assert.deepEqual(api.visibleTasks(all,'all'),rows);assert.deepEqual(all,rows);assert.deepEqual(api.visibleTasks(open,'open'),[rows[0]]);assert.deepEqual(open,rows);assert.deepEqual(api.visibleTasks([],'open'),[]);assert.throws(()=>api.visibleTasks(unknown,'unknown'));assert.deepEqual(unknown,rows);});
  check('stored-fields-and-input-preserved',()=>{const input=structuredClone(rows),before=structuredClone(input);const selected=api.visibleTasks(input,'open');assert.deepEqual(input,before);assert.deepEqual(selected,[before[0]]);assert.deepEqual(api.visibleTasks(input),before);assert.deepEqual(input,before);});
  if(phase==='related')check('count-uses-same-definition',()=>{for(const input of [rows,[],rows.slice(1)]){const value=structuredClone(input),before=structuredClone(value);assert.equal(api.openTaskCount(value),api.visibleTasks(value,'open').length);assert.deepEqual(value,before);}});
  const stable=createHash('sha256').update(readFileSync(path)).digest('hex')===hash;
  return {schema_version:1,report_kind:'behavior_probe_not_user_trial',phase,source_hash:hash,source_scope:['src/tasks.mjs'],source_stable:stable,passed:stable&&checks.every(c=>c.result==='passed'),checks,limits:['Known exposed development fixture; does not establish unseen-task effectiveness.','Entrypoint hash excludes dependencies; bind a full snapshot externally and use a fresh CLI process per probe.','No host activation, context reading, interruption recovery, participant understanding or effort claim.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{const report=await evaluate(process.argv[2],process.argv[3]);process.stdout.write(JSON.stringify(report,null,2)+'\n');process.exitCode=report.passed?0:1;}
  catch(error){process.stderr.write(JSON.stringify({passed:false,error:error.message})+'\n');process.exitCode=1;}
}
