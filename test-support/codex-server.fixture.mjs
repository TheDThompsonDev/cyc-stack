import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
const mode=process.argv.find(a=>a.startsWith('--scenario='))?.slice(11)??'complete';
if(process.argv.includes('mcp')){console.log('[]');process.exit(0);}
const send=m=>process.stdout.write(JSON.stringify(m)+'\n');
const event=(method,params)=>send({method,params});
let packet;
const finish=status=>event('turn/completed',{threadId:'thread-1',turn:{id:'turn-1',status}});
createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line);if(m.id===undefined)return;
  const reply=result=>send({id:m.id,result});
  if(m.method==='initialize')return mode==='slow-setup'?setTimeout(()=>reply({}),300):reply({});
  if(m.method==='model/list')return reply({data:[{model:'fixture-model',isDefault:true}]});
  if(m.method==='thread/start') {
    if(m.params.model!=='fixture-model'||m.params.config.features.shell_tool!==false||m.params.config.features.hooks!==false||m.params.config.web_search!=='disabled'||m.params.ephemeral!==true||process.env.CYC_SESSION||process.env.CODEX_THREAD_ID)throw Error('Worker policy/environment leaked.');
    return reply({thread:{id:'thread-1'},model:'fixture-model',approvalPolicy:'never',sandbox:{type:mode==='unsafe'?'dangerFullAccess':'readOnly'}});
  }
  if(m.method==='turn/start') {
    if(mode==='slow-setup')throw Error('Turn started after parent stopped.');
    packet=JSON.parse(m.params.input[0].text);
    if(createHash('sha256').update(packet.context).digest('hex')!==packet.assignment.contextHash)throw Error('Worker received a different context than its assignment basis.');
    if(packet.files.some(f=>f.path!=='value.txt'))throw Error('Scope leaked.');
    reply({turn:{id:'turn-1',status:'inProgress'}});
    event('item/started',{threadId:'thread-1',turnId:'turn-1',item:{type:'userMessage'}});
    event('turn/completed',{threadId:'another-thread',turn:{id:'turn-1',status:'completed'}});
    event('turn/completed',{threadId:'thread-1',turn:{id:'another-turn',status:'completed'}});
    if(mode==='death')return setTimeout(()=>process.exit(1),30);
    if(['noack','terminal-no-reply'].includes(mode))return;
    if(['cancel','stop'].includes(mode))return;
    if(mode==='tool'){event('item/started',{threadId:'thread-1',turnId:'turn-1',item:{type:'commandExecution'}});return;}
    if(mode==='budget')event('thread/tokenUsage/updated',{threadId:'thread-1',turnId:'turn-1',tokenUsage:{total:{inputTokens:900,outputTokens:0,cachedInputTokens:0}}});
    setTimeout(()=>{
      event('thread/tokenUsage/updated',{threadId:'thread-1',turnId:'turn-1',tokenUsage:{total:{inputTokens:mode==='budget'?900:40,outputTokens:10,cachedInputTokens:5}}});
      const data={summary:'Observed original.',findings:[{id:'stored',text:'Stored value is original.',evidence:[{path:'value.txt',sha256:packet.files[0].sha256}]}],failedApproaches:[],questions:[]};
      if(mode==='foreign-evidence')data.findings[0].evidence[0].path='secret.txt';
      event('item/completed',{threadId:'thread-1',turnId:'turn-1',item:{type:'agentMessage',text:mode==='invalid'?'invalid':JSON.stringify(data)}});
      if(mode==='foreign-terminal'){event('turn/completed',{threadId:'thread-1',turnId:'turn-1',turn:{id:'foreign-turn',status:'completed'}});return;}
      finish('completed');
    },mode==='budget'?350:30);return;
  }
  if(m.method==='turn/interrupt'){if(mode==='terminal-no-reply'){finish('interrupted');setTimeout(()=>process.exit(0),30);return;}reply({});if(mode!=='noack')setTimeout(()=>finish('interrupted'),100);return;}
  send({id:m.id,error:{message:'Unexpected method'}});
});
