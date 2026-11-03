import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPacket,checkResponse,digest,normalize} from './response-gate.mjs';

const engine=dirname(fileURLToPath(import.meta.url));
const declarations={codex:'.codex/hooks.json',claude:'.claude/settings.json',cursor:'.cursor/hooks.json'};
function local(root,name){let path=root;for(const part of name.split('/')){path=resolve(path,part);try{if(lstatSync(path).isSymbolicLink())throw Error('Linked hook evidence is not supported.');}catch(error){if(error.code!=='ENOENT')throw error;}}return path;}
const fileHash=path=>existsSync(path)?digest(readFileSync(path)):null;

// Bind observations to the implementation actually executing, without claiming
// that editable local files are tamper-proof or a host trust attestation.
export function activationBinding(root,host){
 const projectRoot=realpathSync(root);
 const hookHash=digest(['host-activation.mjs','response-hook.mjs','response-gate.mjs','response-mode.mjs','run-gate.mjs','source-snapshot.mjs'].map(name=>`${name}\0${digest(readFileSync(resolve(engine,name)))}`).join('\0'));
 return {schemaVersion:1,host,projectRoot,hookHash,configurationHash:fileHash(local(projectRoot,'.cyc/config.json')),declarationHash:fileHash(local(projectRoot,declarations[host]))};
}

export function inspectHostActivation(target,{host='auto',session,token,env=process.env}={}){
 const result={status:'unverified',reason:'host-required',host:null,promptObserved:false,completionObserved:false,canStartTask:false,
  detail:'No host identity is available; local checks do not establish hook activation.',action:'Run onboard in the target host with --host and its native --session, using the request token supplied by the CYC gate.'};
 try{
  if(host==='auto')host=env.CODEX_THREAD_ID||env.CODEX_SESSION_ID?'codex':env.CLAUDE_SESSION_ID?'claude':null;
  if(host!==null&&!Object.hasOwn(declarations,host))throw Error('Host must be auto, codex, claude, or cursor.');
  result.host=host;if(!host)return result;
  // Cursor uses a constant token and a separate response/tag correlation. Do not
  // mistake that token for the rotating request identity used by these hosts.
  if(host==='cursor')return {...result,reason:'cursor-correlation-required',detail:'Cursor activation needs its current conversation/tag and actual response/Stop observations; its constant token cannot establish this request.',action:'Use the Cursor rule and inspect the current conversation hook log; do not substitute a Codex session or invented tag.'};
  session??=host==='codex'?env.CODEX_THREAD_ID??env.CODEX_SESSION_ID:env.CLAUDE_SESSION_ID;
  if(typeof session!=='string'||!/^[A-Za-z0-9_-]{4,200}$/.test(session))return {...result,reason:'session-required',detail:'The current host session could not be identified.',action:'Use --session from the CYC gate context or the native host session ID. Do not choose a previous session file.'};
  const key=/^[a-f0-9]{32}$/.test(session)?session:digest(`${host}:${session}`).slice(0,32);
  const root=realpathSync(target),path=local(root,`.cyc/runtime/${key}.state.json`);
  result.session=key;result.evidencePath=`.cyc/runtime/${key}.state.json`;
  const declaration=local(root,declarations[host]);
  result.projectDeclaration=existsSync(declaration)?'present':'not-found';
  if(existsSync(declaration)){
   const document=JSON.parse(readFileSync(declaration,'utf8'));
   const events=['UserPromptSubmit','Stop'];
   const declared=events.filter(event=>Array.isArray(document.hooks?.[event])&&document.hooks[event].some(group=>Array.isArray(group.hooks)&&group.hooks.some(handler=>typeof handler.command==='string'&&/(?:response-hook\.mjs|claude-hooks[\\/]cyc\.mjs)/.test(handler.command))));
   // Unrelated project hooks may coexist with plugin hooks. Only diagnose a
   // partial known project CYC integration; absent plugin sources stay unknown.
   if(declared.length&&declared.length!==events.length)return {...result,status:'missing',reason:'hook-definition-missing',missingEvents:events.filter(event=>!declared.includes(event)),detail:'The project declares only part of the CYC hook pair.',action:'Restore both CYC prompt and Stop definitions, review/trust the exact updated hooks, and open a fresh session.'};
  }
  if(!existsSync(path))return {...result,status:'missing',reason:'prompt-not-observed',detail:'No CYC prompt-hook state exists for this host session. Hook files and successful commands are not activation evidence.',action:'Inspect this project’s exact hooks and host trust/settings, then open a fresh desktop session or reload the host. Expect a new CYC gate token; do not manually invoke the hook or invent a Cursor tag.'};
  const state=JSON.parse(readFileSync(path,'utf8')),binding=activationBinding(root,host);
  if(!state||!state.activation||Object.entries(binding).some(([k,v])=>state.activation[k]!==v)||!Number.isFinite(Date.parse(state.promptAt))||state.promptAt!==state.updatedAt||typeof state.token!=='string'||!state.token)return {...result,status:'stale',reason:'binding-mismatch',detail:'Hook state is legacy, belongs to another project/implementation, or predates changed configuration/hooks.',action:'Open a fresh session after inspecting and trusting the current hook definitions. Preserve the old evidence.'};
  result.promptAt=state.promptAt;
  if(typeof token!=='string'||!token)return {...result,reason:'request-token-required',detail:'Session history exists, but the current request token was not supplied. An older accepted turn cannot prove this prompt hook ran.',action:'Pass --token from this request’s injected CYC gate context. If that context is absent, report missing activation and reload; do not obtain a token from an old state/packet.'};
  if(state.token!==token)return {...result,status:'stale',reason:'request-changed',detail:'The supplied request token does not match this session’s current prompt.',action:'Use the current injected gate context; never reuse another request’s token.'};
  Object.assign(result,{promptObserved:true,canStartTask:true,status:'pending',reason:'completion-pending',detail:'This request’s prompt hook was observed; its completion hook has not accepted a response yet.',action:'Continue the authorized first task and write its exact review packet. Observe Stop after the turn ends; do not wait for your own completion before starting work.'});
  if(state.lastDecision==='retry')return {...result,reason:'stop-rejected',completionObserved:true,decision:'retry',detail:'The completion hook rejected the previous draft. Repair its recorded issues without resetting the request or retry budget.'};
  if(!state.lastDecision)return result;
  if(state.stopToken!==state.token||!Number.isFinite(Date.parse(state.stoppedAt))||Date.parse(state.stoppedAt)<Date.parse(state.promptAt)||!/^[a-f0-9]{64}$/.test(state.stopResponseHash??''))return {...result,status:'stale',reason:'stop-identity-mismatch',canStartTask:false,detail:'A completion decision lacks matching request/response evidence.'};
  if(state.lastDecision!=='ready')return {...result,status:'failed',reason:'completion-not-ready',completionObserved:true,decision:state.lastDecision,canStartTask:false,detail:'The hook ended with a blocked or not-ready handoff; do not report setup ready.'};
  const config=existsSync(local(root,'.cyc/config.json'))?JSON.parse(readFileSync(local(root,'.cyc/config.json'),'utf8')):{};
  if(config.delivery?.presentation!=='project'){
   const packet=JSON.parse(readFileSync(local(root,`.cyc/runtime/${key}.review.json`),'utf8'));
   // A packet without a copied reply is bound by the packet bytes the accepting Stop recorded.
   const copied=packet.response!==undefined;
   const bound=copied?typeof packet.response==='string'&&digest(normalize(packet.response))===state.stopResponseHash:typeof state.stopPacketHash==='string'&&state.stopPacketHash===digest(readFileSync(local(root,`.cyc/runtime/${key}.review.json`)));
   const issues=copied?checkResponse({response:packet.response,packet,token,expanded:state.characterLimitEnabled===false||state.expanded===true,root}):checkPacket({packet,token,root});
   if(!bound||packet.status!=='ready'||issues.length)return {...result,status:'stale',reason:'packet-changed',canStartTask:false,detail:'The current review/response/artifacts no longer match the accepted completion.'};
  }
  return {...result,status:'passed',reason:'completion-accepted',completionObserved:true,decision:'ready',stoppedAt:state.stoppedAt,detail:'Matching prompt and accepted Stop observations exist for this request and current hook/configuration bytes. This is local trace evidence, not independent certification.',action:'Continue with the user’s task. A new request must supply its own prompt token; other hosts/sessions remain unverified.'};
 }catch(error){return {...result,status:'failed',reason:'invalid-evidence',detail:`Hook evidence could not be inspected: ${error.message}`,action:'Repair the reported evidence/configuration path and recheck in a fresh host session; do not replace it with fabricated state.'};}
}
