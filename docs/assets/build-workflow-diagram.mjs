// Editable source for the connected diagram. Run: npm run build:workflow (after npm install).
// Render first, then refresh the SVG, HTML and PNG together. Requires the dev dependency sharp.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

function compactSvg(svg) {
  const styles=new Map();
  const body=svg.replace(/<text\b([^>]*)>/g,(tag,attrs)=>{
    const pairs=[...attrs.matchAll(/ (font-size|fill|font-weight|text-anchor)="([^"]*)"/g)];
    if(!pairs.length)return tag;
    const style=pairs.map(m=>m[1]+':'+m[2]+(m[1]==='font-size'?'px':'')).join(';');
    if(!styles.has(style))styles.set(style,'t'+styles.size);
    return '<text'+attrs.replace(/ (font-size|fill|font-weight|text-anchor)="[^"]*"/g,'')+' class="'+styles.get(style)+'">';
  });
  let result=styles.size?body.replace(/(<svg\b[^>]*>)/,'$1<style>'+[...styles].map(([s,c])=>'.'+c+'{'+s+'}').join('')+'</style>'):body;
  const shapes=new Map();
  result=result.replace(/<(rect|path)\b([^>]*)\/>/g,(tag,name,attrs)=>{
    const pairs=[...attrs.matchAll(/ (fill|stroke|stroke-width|stroke-dasharray|stroke-linecap|stroke-linejoin|opacity)="([^"]*)"/g)];
    if(pairs.length<2)return tag;
    const style=pairs.map(m=>m[1]+':'+m[2]).join(';');if(!shapes.has(style))shapes.set(style,'s'+shapes.size);
    return '<'+name+attrs.replace(/ (fill|stroke|stroke-width|stroke-dasharray|stroke-linecap|stroke-linejoin|opacity)="[^"]*"/g,'')+' class="'+shapes.get(style)+'"/>';
  });
  if(shapes.size)result=result.replace(/(<svg\b[^>]*>)/,'$1<style>'+[...shapes].map(([s,c])=>'.'+c+'{'+s+'}').join('')+'</style>');
  return result.replace(/(<text\b[^>]*>)<tspan x="[^"]+" dy="0">([^<]*)<\/tspan>/g,'$1$2').replaceAll(';font-weight:400','').replaceAll(';text-anchor:start','').replaceAll(' rx="0"','').replace(/>\s+</g,'><');
}

const directory = dirname(fileURLToPath(import.meta.url));
const W = 2020, H = 3440;
const c = { ink:'#16225a', text:'#334362', teal:'#197f70', tealFill:'#e6f5ef', amber:'#b86b0a', amberFill:'#fff0d6', purple:'#7044b4', purpleFill:'#f5effc', blue:'#2b69b0', blueFill:'#eaf3ff', red:'#b72d4f', redFill:'#ffedf2', line:'#ced9e5' };
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const layers = { background:[], edges:[], nodes:[], labels:[] };
const geometry = [];
function text(x,y,lines,{size=18,color=c.text,weight=400,anchor='start',gap=25,layer='nodes'}={}) {
  layers[layer].push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${lines.map((s,i)=>`<tspan x="${x}" dy="${i?gap:0}">${esc(s)}</tspan>`).join('')}</text>`);
}
function rect(x,y,w,h,fill,stroke,{radius=12,layer='nodes',width=2,dash=''}={}) {
  layers[layer].push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash?` stroke-dasharray="${dash}"`:''}/>`);
}
function box(id,x,y,w,h,title,lines,{fill=c.tealFill,stroke=c.teal,titleSize=23,bodySize=18,link=null,skillLabel=null}={}) {
  geometry.push({id,x,y,w,h});
  layers.nodes.push(`<g id="flow-${id}" data-node="${id}">`);
  if(link) layers.nodes.push(`<a href="${link}" aria-label="${esc(title)} — read the step explanation">`);
  rect(x,y,w,h,fill,stroke);
  text(x+22,y+(skillLabel?26:34),[title],{size:titleSize,color:c.ink,weight:700});
  text(x+22,y+(skillLabel?50:64),lines,{size:bodySize,gap:skillLabel?22:25});
  if(skillLabel) text(x+22,y+h-7,[`Skills: ${skillLabel}`],{size:15,color:c.blue,weight:600});
  if(link) layers.nodes.push('</a>');
  layers.nodes.push('</g>');
}
function decision(id,x,y,lines,{hw=140,hh=43}={}) {
  geometry.push({id,x:x-hw,y:y-hh,w:hw*2,h:hh*2,diamond:true});
  layers.nodes.push(`<g id="flow-${id}" data-node="${id}"><polygon points="${x},${y-hh} ${x+hw},${y} ${x},${y+hh} ${x-hw},${y}" fill="${c.amberFill}" stroke="${c.amber}" stroke-width="2.5"/></g>`);
  text(x,y-(lines.length-1)*11+6,lines,{size:18,color:c.ink,weight:700,anchor:'middle',gap:23});
}
function label(x,y,value,color=c.text,{size=17,anchor='middle',rotate=0,padding=16}={}) {
  const w=value.length*size*.55+padding;
  const left=anchor==='middle'?x-w/2:x-8;
  if(rotate) layers.labels.push(`<g transform="rotate(${rotate} ${x} ${y})">`);
  rect(left,y-size-3,w,size+10,'white','none',{radius:4,layer:'labels'});
  text(x,y,[value],{size,color,weight:600,anchor,layer:'labels'});
  if(rotate) layers.labels.push('</g>');
}
function edge(from,to,points,{kind='work',caption=null,lx=0,ly=0,dashed=false,rotate=0,size=17,padding=16}={}) {
  const color={work:c.teal,recovery:c.amber,decision:c.blue,knowledge:c.purple,blocked:c.red}[kind];
  const p=points.map(a=>a.join(',')).join(' ');
  layers.edges.push(`<polyline data-from="${from}" data-to="${to}" data-kind="${kind}" points="${p}" fill="none" stroke="white" stroke-width="8" stroke-linejoin="round"/>`);
  layers.edges.push(`<polyline data-edge="true" data-from="${from}" data-to="${to}" data-kind="${kind}" points="${p}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"${dashed?' stroke-dasharray="8 6"':''} marker-end="url(#arrow-${kind})"/>`);
  if(caption) label(lx,ly,caption,color,{rotate,size,padding});
}
function group(x,y,w,h,title,sub) {
  rect(x,y,w,h,'#f7fbfa','#bfded6',{layer:'background',dash:'8 6',width:2});
  text(x+18,y+30,[title],{size:18,color:c.teal,weight:700,layer:'background'});
  text(x+w-18,y+30,[sub],{size:16,color:c.teal,anchor:'end',layer:'background'});
}

rect(0,0,W,H,'white','none',{radius:0,layer:'background'});
text(W/2,75,['CYC Stack'],{size:64,color:c.ink,weight:800,anchor:'middle'});
text(W/2,120,['Engineering, knowledge & evidence flow'],{size:31,color:c.ink,weight:700,anchor:'middle'});
text(W/2,157,['Common implementation route · 12 responsibilities inside 4 recorded stages'],{size:20,anchor:'middle'});

group(450,190,640,910,'SCOUT','recorded stage');
group(450,1120,640,440,'BUILD','recorded stage');
group(450,1590,640,520,'VERIFY','recorded stage');
group(450,2140,640,320,'DELIVER','recorded stage');

const steps = [
  [1,230,90,'Define observable success',['Record the outcome, constraints and acceptance criteria.']],
  [2,340,90,'Select route & risk',['Choose the playbook, checks and review depth.']],
  [3,450,100,'Retrieve matched history',['Find component decisions and prior failed approaches.','Carry the relevant constraints into the plan.']],
  [4,570,100,'Revalidate that history',['Compare recorded claims with current code and changes.','Replace stale assumptions before relying on them.']],
  [5,690,100,'Trace impact & choose design',['Follow writers, readers, state and interface contracts.','Name affected consumers and a check for each.']],
  [6,810,100,'Explain & settle decisions',['Connect present behavior to the proposed mechanism.','Resolve decisions that could change the solution.']],
  [7,965,100,'Plan evaluable slices',['Give each slice an observable outcome and check.','High risk: challenge the plan; otherwise proceed.']],
  [8,1170,100,'Build in tested slices',['Reproduce or pin behavior, implement, inspect the diff.','Explain the effect on dependent components.']],
  [9,1420,130,'Retain useful project knowledge',['Update component docs and index when learning is useful.','Keep verified facts; label undecided proposals as pending.','Finalize authorized context and ledger edits before checks.']],
  [10,1640,100,'Prove tests & verify behavior',['Original-code proof where required; run configured checks.','Exercise affected consumers against stable covered files.']],
  [11,1880,100,'Review intent & code quality',['Inspect intent, consumers and project conventions.','Resolve or dismiss findings with recorded evidence.']],
  [12,2190,100,'Account for outcome & learning',['Record criteria, limits, learning and ledger disposition.','Reuse the shared review and explain maintenance.']]
];
// Illustrative placements of existing methods, not an automatic dispatch table.
// One source feeds the visible labels and the linked worked examples.
const skillExamples = [
  {label:'Scout · Frame when the goal is unclear', methods:['scout','frame'],
    trigger:'Scout establishes the target. Frame helps when the request leaves success, scope or constraints unclear.',
    example:'“Export filtered results” could mean the visible page or every matching record. Define success as all matching, authorized records across pages, with excluded records absent.',
    output:'Observable criteria and explicit scope that Build and Verify can use.'},
  {label:'Scout · Challenge for high-risk work', methods:['scout','challenge'],
    trigger:'Scout chooses the playbook and review depth. Select a focused Challenge pass when the plan crosses a consequential boundary.',
    example:'An export that changes permission filtering needs deeper review than changing its button label. Flag authorization as a risk and plan checks for records the user cannot access.',
    output:'The selected route, risk rationale and required review/checks; the plan is challenged at step 7.'},
  {label:'Context · Error Ledger', methods:['context','error-ledger'],
    trigger:'Context retrieves history matched to touched paths. Error Ledger searches prior symptoms, attempted fixes and confirmed causes.',
    example:'Read the export component notes and an earlier “CSV contains only the first page” incident. Carry forward why exporting the UI’s loaded rows failed.',
    output:'Relevant decisions and failure evidence, or an explicit statement that no matching history exists.'},
  {label:'Context · Understand when evidence conflicts', methods:['context','understand'],
    trigger:'Context checks whether retained claims still describe the current files. Understand traces current behavior when the history conflicts with the implementation.',
    example:'The notes describe client-side pagination, but the endpoint now paginates on the server. Trace the current request and query before reusing the old fix.',
    output:'A freshness assessment and evidence-backed current behavior; stale history is a lead, not a premise.'},
  {label:'Impact · Design · Understand as needed', methods:['impact','design','understand'],
    trigger:'Impact traces the affected data and consumers. Design shapes the change and its trade-offs; Understand supplies missing evidence about existing behavior.',
    example:'Trace filter state → export endpoint → authorized query → CSV. Compare reusing the server query with exporting loaded UI rows, and identify any counts or other consumers sharing that query.',
    output:'An impact map, the chosen design and a check for each affected behavior.'},
  {label:'Scout · Teach only for a requested lesson', methods:['scout','teach'],
    trigger:'Scout explains the engineering choice and resolves consequential uncertainty. Teach adds a lesson or practice only when the engineer requests it.',
    example:'Explain why UI rows represent one page while the server query represents all authorized matches. If the engineer asks how pagination works, Teach can walk through that mechanism.',
    output:'The explanation and any resolved decision. Silence does not establish understanding or approval.'},
  {label:'Scout · Challenge for high-risk plans', methods:['scout','challenge'],
    trigger:'Scout plans evaluable slices. Challenge tests the consequential assumptions of a high-risk plan before implementation.',
    example:'Separate query reuse, permission preservation and CSV output into checkable slices. Challenge whether the proposed export could bypass a filter or expose another user’s records.',
    output:'A slice plan with checks and resolved risks, or a clearly recorded blocker.'},
  {label:'Build · Error Ledger when attempts fail', methods:['build','error-ledger'],
    trigger:'Build implements and checks one meaningful slice. Error Ledger records failed attempts immediately so recovery can use the actual evidence.',
    example:'Reproduce a multi-page export that loses rows, then change the retrieval path. If a paging fix duplicates records, log its hypothesis, change and failing result before the next attempt.',
    output:'A scoped change and slice evidence; failed attempts retain their signatures and outcomes.'},
  {label:'Context · Error Ledger for failure history', methods:['context','error-ledger'],
    trigger:'Context retains useful verified facts with evidence and limits. Mark a decision adopted only with actual acceptance; keep undecided proposals pending. Error Ledger retains failure history.',
    example:'Record the observed permission and pagination constraints, the failed UI-row approach, covered paths and evidence. Identify an adopted query decision only when acceptance is established. Update the index when useful knowledge was retained.',
    output:'Useful component knowledge and its index entry, pending proposals, or no reusable learning with a reason. Finalize authorized context and ledger edits before final verification.'},
  {label:'Verify', methods:['verify'],
    trigger:'Verify proves applicable changed tests against the original code, runs configured checks and inspects the relevant user journey. A recorded exemption states its actual limit.',
    example:'Show that the new multi-page export regression fails on the original bug, then passes on the repaired code. Check membership, duplicates, unauthorized records and the CSV consumer.',
    output:'Original-code proof where required, configured check receipts and consumer evidence on current covered files, with exemptions and limits disclosed.'},
  {label:'Verify · Challenge for consequential review', methods:['verify','challenge'],
    trigger:'Verify assesses intent, consumers and conventions. A focused Challenge pass can test a consequential claim or requested review beyond a green check.',
    example:'A download test passes, but it only checks that a file exists. Challenge the claim that this proves complete, authorized results; inspect the query and ask for membership evidence.',
    output:'Review findings and their resolution evidence, or a diagnosis that routes work back to the affected responsibility.'},
  {label:'Deliver · Context for retained learning', methods:['deliver','context'],
    trigger:'Deliver accounts for criteria, evidence and limitations. Context supplies the durable or pending learning disposition.',
    example:'Explain the change from visible-page rows to the authorized filtered query, show which checks ran, and point the engineer to the component notes and any pending finding.',
    output:'A shared review artifact and honest handoff; completion alone does not establish human acceptance or permission to publish.'}
];
for(const [n,y,h,title,lines] of steps) box(`step-${n}`,470,y,600,h,`${n}. ${title}`,lines,{link:`#step-${n}`,titleSize:22,skillLabel:skillExamples[n-1].label,...(n===9?{fill:c.purpleFill,stroke:c.purple}:{})});
for(const [from,to,sy,ty] of [[1,2,320,340],[2,3,430,450],[3,4,550,570],[4,5,670,690],[5,6,790,810]]) edge(`step-${from}`,`step-${to}`,[[770,sy],[770,ty]]);

decision('decision',1540,860,['Decision','unresolved?'],{hw:100,hh:53});
box('ask',1730,810,200,100,'Get input',['Ask the engineer','or investigate.'],{fill:c.blueFill,stroke:c.blue,titleSize:22,bodySize:18});
edge('step-6','decision',[[1070,860],[1440,860]]);
edge('decision','ask',[[1640,860],[1730,860]],{kind:'decision',caption:'Yes',lx:1685,ly:843});
edge('decision','step-7',[[1540,913],[1540,1015],[1070,1015]],{caption:'No',lx:1560,ly:957});
edge('ask','step-5',[[1830,810],[1830,740],[1070,740]],{kind:'decision',caption:'Resolved: revisit the approach',lx:1620,ly:721});
edge('ask','record-blocked',[[1930,860],[1955,860],[1955,2420],[1930,2420]],{kind:'blocked',caption:'Required input unavailable',lx:1948,ly:1260,rotate:-90,size:16});
// Annotation, not a runtime step: a leader attaches the condition to Record Scout.
layers.edges.push('<polyline points="770,1110 1468,1110" fill="none" stroke="#8caaa3" stroke-width="1.5" stroke-dasharray="3 5"/>');
text(1480,1098,['NOTE · SCOUT HANDOFF'],{size:19,color:c.teal,weight:700});
text(1480,1128,['Settled alignment and named consumers','with checks are required to pass.'],{size:18});
edge('step-7','step-8',[[770,1065],[770,1170]],{caption:'Record Scout',lx:865,ly:1147});

decision('focused-check',770,1332,['Slice check','passes?']);
edge('step-8','focused-check',[[770,1270],[770,1289]]);
edge('focused-check','step-9',[[770,1375],[770,1420]],{caption:'Yes · finish planned slices',lx:770,ly:1402});
edge('step-9','step-10',[[770,1550],[770,1640]],{caption:'Record Build',lx:860,ly:1581});

decision('checks',770,1800,['Checks pass on','stable source?']);
edge('step-10','checks',[[770,1740],[770,1757]]);
edge('checks','step-11',[[770,1843],[770,1880]],{caption:'Yes',lx:820,ly:1865});
decision('review',770,2040,['No open findings;','consumers checked?']);
edge('step-11','review',[[770,1980],[770,1997]]);
edge('review','step-12',[[770,2083],[770,2190]],{caption:'Yes · record Verify',lx:875,ly:2129});
box('complete',470,2330,600,90,'Record Deliver → run complete',['Require current evidence, criteria and artifact checks.'],{fill:'white'});
edge('step-12','complete',[[770,2290],[770,2330]]);

layers.background.push('<g id="flow-diagnosis" data-node="diagnosis">');
rect(1480,1490,450,770,c.amberFill,c.amber,{layer:'background',width:2.5});
layers.background.push('</g>');
text(1705,1525,['DIAGNOSE & ROUTE'],{size:25,color:c.ink,weight:800,anchor:'middle'});
text(1705,1555,['What does the evidence invalidate?'],{size:19,color:c.amber,weight:600,anchor:'middle'});
const routes = [
  [1600,'R1 · Implementation defect',['Design still valid → repair the code.','Repeat affected checks and current review.']],
  [1730,'R2 · False premise / missed consumer',['Revisit context, impact and design.','Update the plan and consumer checks.']],
  [1860,'R3 · Candidate changed after review',['Old evidence describes different files.','Repeat verification AND semantic review.']],
  [1990,'R4 · Check observes the wrong thing',['Correct an unprotected target or assertion.','Protected check / config → new authorized run.']],
  [2120,'Missing prerequisite / exhausted',['More patches cannot supply missing input.','Preserve findings; do not claim completion.']]
];
const recoverySkills = ['Build · Error Ledger','Understand · Impact · Design','Verify','Frame · Verify'];
for(const [i,[y,title,lines]] of routes.entries()) box(`route-${y}`,1494,y,422,110,title,lines,{fill:'white',stroke:'#d6a45f',titleSize:19,bodySize:17,skillLabel:recoverySkills[i]});
for(const [id,y] of [['focused-check',1332],['checks',1800],['review',2040]]) edge(id,'diagnosis',[[910,y],[1440,y],[1440,1540],[1480,1540]],{kind:'recovery',caption:'No',lx:958,ly:y-14});
for (const y of [1332,1540,1800,2040,2375]) layers.labels.push(`<circle cx="1440" cy="${y}" r="5" fill="${c.amber}"/>`);
edge('complete','diagnosis',[[1070,2375],[1440,2375],[1440,1540],[1480,1540]],{kind:'recovery',caption:'Rejected / stale',lx:1270,ly:2358,size:17});
edge('diagnosis','step-8',[[1494,1655],[1300,1655],[1300,1220],[1070,1220]],{kind:'recovery',caption:'R1 · Repair code',lx:1190,ly:1201,size:17});
edge('diagnosis','step-4',[[1494,1755],[1380,1755],[1380,620],[1070,620]],{kind:'recovery',caption:'R2 · Revisit premise',lx:1225,ly:601,size:17});
edge('diagnosis','step-10',[[1494,1915],[1220,1915],[1220,1690],[1070,1690]],{kind:'recovery',caption:'R3 · Re-verify',lx:1145,ly:1672,size:16});
edge('diagnosis','step-10',[[1494,2065],[1140,2065],[1140,1780],[995,1780],[995,1740]],{kind:'recovery',caption:'R4 · Fix check',lx:1068,ly:1766,size:16});
box('record-blocked',1480,2380,450,90,'Disclose the unfinished outcome',['Blocked, exhausted or halted · retain evidence'],{fill:c.redFill,stroke:c.red,titleSize:22,bodySize:17});
edge('diagnosis','record-blocked',[[1705,2230],[1705,2380]],{kind:'blocked',caption:'Record status + reason',lx:1705,ly:2327});

// Guard checks are controller operations, not a continuous filesystem watcher.
box('guard',1480,240,450,135,'CONTROLLER GUARD CHECK',[
  'At record, verify, retry, resume and complete:',
  'did protected or out-of-scope files change?',
  'No: continue the requested operation.'
],{fill:c.redFill,stroke:c.red,titleSize:22,bodySize:18});
box('halted',1480,425,450,135,'HALTED · terminal run',[
  'Preserve the changed files for review; no rollback.',
  'Resolve scope / authorization before a new run.',
  'The halted run cannot resume.'
],{fill:c.redFill,stroke:c.red,titleSize:22,bodySize:17});
edge('guard','halted',[[1705,375],[1705,425]],{kind:'blocked',caption:'Yes · guard records halt',lx:1705,ly:403});
edge('halted','record-blocked',[[1930,490],[1990,490],[1990,2445],[1930,2445]],{kind:'blocked',caption:'Halt → disclose preserved changes',lx:1983,ly:1800,rotate:-90,size:16});

box('host-gate',470,2510,1460,140,'HOST DELIVERY GATE · enforced when the hook is active',[
  'Ready: this session’s relevant touched runs are complete and applicable response checks pass.',
  'Blocked: disclose the unfinished outcome with current review evidence and applicable native reply checks.',
  'An actively running unfinished run must continue or be recorded with an appropriate non-running outcome.'
],{fill:'#edf1fa',stroke:c.ink,titleSize:25,bodySize:19});
edge('complete','host-gate',[[770,2420],[770,2510]],{caption:'Completion succeeds',lx:770,ly:2480});
edge('record-blocked','host-gate',[[1705,2470],[1705,2510]],{kind:'blocked'});
box('ready',470,2730,600,100,'READY · reviewable result',['Show the candidate, evidence, reasoning and limits.'],{fill:c.blueFill,stroke:c.blue});
box('blocked',1480,2730,450,130,'BLOCKED · explain what remains',[
  'No completion claim or publication path.',
  'Blocked run: may resume after resolving input.',
  'Exhausted / halted: new run; fresh evidence.'
],{fill:c.redFill,stroke:c.red,titleSize:22,bodySize:17});
edge('host-gate','ready',[[770,2650],[770,2730]],{kind:'decision',caption:'Ready',lx:813,ly:2692});
edge('host-gate','blocked',[[1705,2650],[1705,2730]],{kind:'blocked',caption:'Blocked',lx:1760,ly:2692});
box('team',470,2900,1460,110,'Developer / team review · project-controlled follow-through',[
  'Review the actual change and its evidence. Completion is not human acceptance or permission to publish.',
  'Publication and acceptance of a pending finding are separate decisions.'
],{fill:c.blueFill,stroke:c.blue,titleSize:25,bodySize:19});
edge('ready','team',[[770,2830],[770,2900]],{kind:'decision'});
box('publication',470,3070,600,110,'Authorized PR → review → merge',['Reuse the generated review; satisfy project rules.','Requested revisions after completion use a new run.'],{fill:c.blueFill,stroke:c.blue});
box('promote',1480,3070,450,130,'Promote accepted pending learning',[
  'Only if a pending finding exists and is accepted.',
  'Separately reviewed documentation update.',
  'Merge is not a prerequisite.'
],{fill:c.purpleFill,stroke:c.purple,titleSize:22,bodySize:17});
edge('team','publication',[[770,3010],[770,3070]],{kind:'decision',caption:'When authorized',lx:770,ly:3049});
edge('team','promote',[[1705,3010],[1705,3070]],{kind:'knowledge',caption:'Pending finding accepted',lx:1705,ly:3049});

box('context',40,230,340,330,'COMPONENT CONTEXT DOCS',[
  'docs/context/<area>.md',
  'docs/context/INDEX.md',
  'One document per component or area.',
  'Decisions, dead ends and gotchas',
  'Paths, revision and check evidence',
  'Update at 9 when useful; index by path.',
  'Read at 3; revalidate at 4.',
  'Retain verified technical facts.',
  'Adopt decisions with acceptance.'
],{fill:c.purpleFill,stroke:c.purple,titleSize:20,bodySize:17});
box('ledger',40,620,340,280,'ERROR TRIAGE LEDGER',[
  'Error signatures, attempts and results',
  'Confirmed causes; regression guards',
  '',
  'Read at 3. Record attempts during',
  'implementation AND recovery.',
  'Required at delivery for bug-fix runs',
  'or any run with recorded failures.'
],{fill:c.purpleFill,stroke:c.purple,titleSize:22,bodySize:17});
box('recipes',40,1030,340,230,'PLAYBOOKS & RECIPES',[
  'Choose how to investigate and build.',
  'Exercise the actual user behavior.',
  '',
  'Select the route at 2.',
  'Use the relevant checks at 10.'
],{fill:c.purpleFill,stroke:c.purple,titleSize:22,bodySize:17});
edge('context','step-3',[[380,390],[410,390],[410,480],[470,480]],{kind:'knowledge',dashed:true,caption:'Read',lx:438,ly:469,size:13});
edge('ledger','step-3',[[380,705],[425,705],[425,520],[470,520]],{kind:'knowledge',dashed:true,caption:'Read',lx:442,ly:511,size:13});
edge('recipes','step-2',[[380,1115],[440,1115],[440,385],[470,385]],{kind:'knowledge',dashed:true,caption:'Select',lx:431,ly:372,size:13});
edge('step-8','ledger',[[470,1235],[405,1235],[405,830],[380,830]],{kind:'knowledge',dashed:true,caption:'Log attempts',lx:425,ly:1221,size:12,padding:8});
edge('step-9','context',[[470,1490],[390,1490],[390,535],[380,535]],{kind:'knowledge',dashed:true,caption:'Write + index',lx:415,ly:1476,size:13});
edge('recipes','step-10',[[210,1260],[210,1690],[470,1690]],{kind:'knowledge',dashed:true,caption:'Check recipes',lx:320,ly:1674});
edge('promote','context',[[1930,3135],[1970,3135],[1970,3240],[20,3240],[20,410],[40,410]],{kind:'knowledge',dashed:true,caption:'Next task retrieves and revalidates the retained knowledge',lx:935,ly:3222});

box('budget-note',40,1810,340,320,'WHY THE LOOP IS BOUNDED',[
  'Configurable defaults:',
  '3 recorded failures; stop earlier at',
  '2 consecutive identical signatures.',
  '',
  'A recorded rewind invalidates',
  'dependent later handoffs and',
  'executable verification.',
  'Returning never resets the budget.',
  'Unreported attempts are not visible.'
],{fill:c.amberFill,stroke:c.amber,titleSize:20,bodySize:17});
box('trust-note',40,2210,340,340,'WHAT THE TEAM CAN INSPECT',[
  'Criterion and consumer results',
  'Command receipts and file fingerprints',
  'Review findings and resolution evidence',
  'Retry history and retained reasoning',
  'Local by default; share through review.',
  '',
  'The controller validates records and',
  'current covered files. It cannot prove',
  'that tests are meaningful or an',
  'agent’s judgment is correct.'
],{fill:'#f3f6fa',stroke:c.line,titleSize:20,bodySize:17});

text(470,3290,['A completed run is terminal. Later requested revisions start a new scoped run with fresh evidence.'],{size:19,color:c.ink,weight:600});
text(40,3320,['Ordinary path: run start records Scout; run finish batches Build recording, proof, checks, Verify, Deliver and completion.'],{size:17});
text(1110,2450,['R1–R4: match source cards to return arrows.','Dots join paths; other crossings stay separate.'],{size:16,color:c.amber,gap:25});
text(40,3350,['Arrows: teal = forward work · amber = recovery · blue = developer decisions · red = unfinished outcome'],{size:19});
text(40,3383,['Dashed purple = knowledge read / write. The 12 responsibilities are not separate runtime states. Other playbooks have their own sequences.'],{size:18});
text(40,3416,['Skills = CYC methods selected as needed, not automatic dispatch. Click a numbered step for its trigger, worked example and expected evidence.'],{size:18});

const defs=Object.entries({work:c.teal,recovery:c.amber,decision:c.blue,knowledge:c.purple,blocked:c.red}).map(([k,v])=>`<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${v}"/></marker>`).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="diagram-title diagram-desc" font-family="Segoe UI, Arial, sans-serif">\n<title id="diagram-title">CYC connected engineering workflow</title>\n<desc id="diagram-desc">Twelve responsibilities inside Scout, Build, Verify and Deliver. Arrows connect the work, developer decisions, knowledge inputs, diagnostic returns, separate ready and blocked outcomes, and independent publication and accepted-learning branches. Complete text explanations accompany the diagram.</desc>\n<defs>\n${defs}\n</defs>\n${Object.values(layers).flat().join('\n')}\n</svg>\n`;
const htmlPath=join(directory,'cyc-workflow.html');
const html=readFileSync(htmlPath,'utf8');
if(!/<!-- DIAGRAM:START -->[\s\S]*?<!-- DIAGRAM:END -->/.test(html)) throw new Error('HTML diagram markers are missing; no exports were updated.');
let updatedHtml=html.replace(/<!-- DIAGRAM:START -->[\s\S]*?<!-- DIAGRAM:END -->/,`<!-- DIAGRAM:START -->\n${svg}<!-- DIAGRAM:END -->`);
// Keep the diagram and its linked explanation titles on the same source of truth.
for(const [n,,,title] of steps) {
  const pattern=new RegExp(`(<details id="step-${n}"[\\s\\S]*?<summary>[\\s\\S]*?<span class="step-number">[^<]*</span><span>)[^<]*(<span class="detail-stage">)`);
  if(!pattern.test(updatedHtml)) throw new Error(`Step ${n} explanation title is missing; no exports were updated.`);
  updatedHtml=updatedHtml.replace(pattern,(_,before,after)=>before+esc(title)+after);
  const skill=skillExamples[n-1];
  const names={'error-ledger':'Error Ledger'};
  const links=skill.methods.map(name=>`<a href="../../methods/cyc-${name}/SKILL.md">${names[name]??name[0].toUpperCase()+name.slice(1)}</a>`).join(' · ');
  const example=`<!-- SKILL-EXAMPLE:START --><div class="skill-example"><p class="skill-heading">Skills at this step: ${links}</p><p><strong>When they help.</strong> ${esc(skill.trigger)}</p><p><strong>Export example.</strong> ${esc(skill.example)}</p><p><strong>What carries forward.</strong> ${esc(skill.output)}</p></div><!-- SKILL-EXAMPLE:END -->`;
  const body=new RegExp(`(<details id="step-${n}"[\\s\\S]*?<div class="detail-body">)\\s*(?:<!-- SKILL-EXAMPLE:START -->[\\s\\S]*?<!-- SKILL-EXAMPLE:END -->\\s*)?`);
  if(!body.test(updatedHtml)) throw new Error(`Step ${n} explanation body is missing; no exports were updated.`);
  updatedHtml=updatedHtml.replace(body,(_,before)=>`${before}\n          ${example}\n          `);
}
const png=await sharp(Buffer.from(svg),{density:96}).png().toBuffer();
// A companion view exposes the complete library without adding lanes to the
// detailed implementation diagram. Edges mean selection, never execution order.
const methodGroups = [
  {title:'ENTER, RECOVER OR EXPLAIN',condition:'Project setup, task entry, interruption or requested learning',y:190,items:[
    ['setup','Setup','Project needs configuration','→ real checks + activation status','Example: discover CI commands, run them and disclose hook status.'],
    ['scout','Scout','Start a bounded engineering task','→ plan, consumers + checks','Example: locate the export path and the permission checks it must preserve.'],
    ['remember','Remember','Decision, checkpoint or resumption','→ decision log + revalidated next step','Example: recover why a query was chosen; recheck files changed since the checkpoint.'],
    ['teach','Teach','Engineer requests a lesson','→ project-grounded explanation / practice','Example: explain why visible page rows differ from all matching export records.']
  ]},
  {title:'RESOLVE THE ENGINEERING QUESTION',condition:'Unclear goal, behavior, alternatives, impact, design or claim',y:445,items:[
    ['frame','Frame','What counts as success?','→ criteria + scope','Example: all matching rows, not merely a downloaded CSV.'],
    ['understand','Understand','Why does it behave this way?','→ traced cause + evidence','Example: trace pagination from request to query.'],
    ['explore','Explore','Which approach fits?','→ compared options + recommendation','Example: compare paged fetch, streaming and queued export.'],
    ['impact','Impact','What else could this affect?','→ dependencies + checks','Example: find permission and count consumers of the query.'],
    ['design','Design','How should the change work?','→ shape, contracts + trade-offs','Example: define the export/query boundary and errors.'],
    ['challenge','Challenge','Does the plan or claim hold?','→ supported objections + resolution','Example: question whether the export bypasses access filtering.']
  ]},
  {title:'PRODUCE AND ESTABLISH THE RESULT',condition:'Implement, verify or hand off the selected task',y:700,items:[
    ['build','Build','An agreed approach needs implementation','→ tested slices + inspected changes','Example: repair retrieval in small slices; check duplicates before continuing.'],
    ['verify','Verify','A behavior claim needs current evidence','→ checks, consumer results + limits','Example: inspect the full exported membership, permissions and CSV consumer.'],
    ['deliver','Deliver','The result needs a reviewable handoff','→ outcome, evidence + remaining limits','Example: explain the query change, show checks and identify unmeasured scale.']
  ]},
  {title:'PRESERVE KNOWLEDGE AND RESPOND TO FINDINGS',condition:'Relevant history, failed attempts, user correction or reusable lessons',y:955,items:[
    ['context','Context','Before component work; useful findings','→ verified facts / pending proposals','Example: retain observed query constraints with evidence; identify adopted decisions only with actual acceptance.'],
    ['error-ledger','Error Ledger','Before debugging; after failed attempts','→ signatures, attempts + confirmed causes','Example: record that a paging fix duplicated rows and the check that exposed it.'],
    ['correct','Correct','Feedback reveals a missing criterion','→ targeted repair + rechecked criteria','Example: “Not just the visible page” changes the target and its verification.'],
    ['reflect','Reflect','An outcome reveals a reusable improvement','→ evidence-backed proposals to skills/checks','Example: propose a multi-page check after a repeated omission; do not silently adopt rules.']
  ]}
];
const mapParts=[];
const mapText=(x,y,value,size=18,weight=400,color=c.text)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(value)}</text>`;
mapParts.push(mapText(40,54,'CYC · the full method library',40,800,c.ink));
mapParts.push(mapText(40,96,'1 orchestrator selects from 17 methods and 15 playbooks. Four stages describe only the common implementation route.',22));
mapParts.push(mapText(40,134,'Arrows show selection by need. Rows group responsibilities; they are not an execution sequence. Click a method to read its instructions.',19));
mapParts.push(`<g data-method="cyc"><a href="../../skills/cyc/SKILL.md"><rect x="40" y="540" width="250" height="180" rx="12" fill="${c.blueFill}" stroke="${c.blue}" stroke-width="2"/>${mapText(60,578,'/cyc',30,800,c.ink)}${mapText(60,616,'Own the outcome',21,700)}${mapText(60,650,'Choose the playbook',18)}${mapText(60,681,'Load relevant methods',18)}</a></g>`);
for(const group of methodGroups) {
  mapParts.push(`<path d="M290 630 H320 V${group.y+27} H350" fill="none" stroke="${c.blue}" stroke-width="2" marker-end="url(#select-arrow)"/>`);
  mapParts.push(`<rect x="350" y="${group.y}" width="1630" height="230" rx="12" fill="#f7f9fc" stroke="${c.line}"/>`);
  mapParts.push(mapText(370,group.y+29,group.title,21,700,c.ink));
  mapParts.push(mapText(370,group.y+57,group.condition,18));
  const width=(1590-(group.items.length-1)*16)/group.items.length;
  for(const [i,[id,title,trigger,output,example]] of group.items.entries()) {
    const x=370+i*(width+16),y=group.y+78;
    // Word wrapping is based on conservative character widths; font checks
    // and offline inspection cover the final lines before publication.
    const wrap=(value,max)=>{const lines=[];let line='';for(const word of value.split(' ')){if(line&&(line+' '+word).length>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;};
    const max=Math.floor((width-28)/8.6),lines=[...wrap(trigger,max),...wrap(output,max)];
    const body=lines.map((line,j)=>mapText(x+14,y+58+j*21,line,16)).join('');
    mapParts.push(`<g data-method="${id}"><a href="../../methods/cyc-${id}/SKILL.md" aria-label="${esc(title+': '+trigger+'. '+example)}"><title>${esc(example)}</title><rect x="${x}" y="${y}" width="${width}" height="136" rx="8" fill="white" stroke="${c.blue}"/>${mapText(x+14,y+28,title,23,700,c.ink)}${body}</a></g>`);
  }
}
mapParts.push(mapText(40,1230,'The playbook sets the recorded sequence; the agent selects methods and interprets their findings. The controller does not invoke skills.',19));
mapParts.push(`<a href="cyc-workflow.html#overview">${mapText(40,1264,'Continue to the connected implementation flow →',21,700,c.blue)}</a>`);
const methodSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="2020" height="1300" viewBox="0 0 2020 1300" role="img" aria-labelledby="methods-title methods-desc" font-family="Segoe UI, Arial, sans-serif"><title id="methods-title">CYC complete method-selection map</title><desc id="methods-desc">The cyc orchestrator chooses methods by task need. All seventeen supporting methods have a selection condition and output. These are capabilities, not seventeen mandatory steps. Examples are available in each method's accessible description; links open its source instructions.</desc><defs><marker id="select-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${c.blue}"/></marker></defs><rect width="2020" height="1300" fill="white"/>${mapParts.join('\n')}</svg>\n`;
const methodPng=await sharp(Buffer.from(methodSvg),{density:96}).png().toBuffer();

// A readable README entry point. The detailed view above remains the recovery reference.
const overviewParts=[];
const overviewText=(x,y,lines,{size=20,weight=400,color=c.text,gap=28,anchor='start'}={})=>{
  overviewParts.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?gap:0}">${esc(line)}</tspan>`).join('')}</text>`);
};
const overviewRect=(x,y,w,h,fill,stroke=c.line)=>overviewParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
const overviewArrow=(points,kind='forward')=>overviewParts.push(`<polyline points="${points}" fill="none" stroke="${{forward:c.teal,knowledge:c.purple,retry:c.amber}[kind]}" stroke-width="3" stroke-linejoin="round" marker-end="url(#overview-${kind})"/>`);
overviewRect(0,0,1200,1030,'white','none');
overviewText(48,43,['CYC STACK / TEAM WORKFLOW'],{size:16,weight:700,color:c.teal});
overviewText(48,88,['Shared project knowledge. Reviewable AI changes.'],{size:35,weight:800,color:c.ink});
overviewRect(48,116,1104,60,c.blueFill,c.blue);
overviewText(72,154,['Describe the outcome. Your AI assistant selects the relevant methods through /cyc.'],{size:23,weight:600,color:c.ink});

overviewRect(48,202,1104,132,c.purpleFill,c.purple);
overviewText(72,235,['PROJECT KNOWLEDGE IN YOUR REPO'],{size:16,weight:700,color:c.purple});
overviewText(72,268,['Reuse matched decisions, constraints, failed approaches and check recipes.'],{size:23,weight:600,color:c.ink});
overviewText(72,300,['Revalidate current code. Keep useful verified facts; label proposals and record acceptance for adopted decisions.'],{size:20});
overviewArrow('174,334 174,400','knowledge');
overviewText(196,373,['Read + revalidate'],{size:17,weight:600,color:c.purple});
overviewArrow('458,400 458,334','knowledge');
overviewText(478,373,['Retain before final checks'],{size:17,weight:600,color:c.purple});

const overviewStages=[
  {x:48,title:'SCOUT',subtitle:'Understand the change',lines:['Read relevant history.','Trace affected paths.','Set criteria and checks.']},
  {x:332,title:'BUILD',subtitle:'Make a focused change',lines:['Change one useful slice.','Check affected behavior.','Retain useful findings.']},
  {x:616,title:'VERIFY',subtitle:'Establish current evidence',lines:['Original-code proof.*','Your configured checks.','Intent + consumer review.']},
  {x:900,title:'DELIVER',subtitle:'Leave a useful handoff',lines:['Outcome and limits.','A generated review.','Useful context pointers.']}
];
for(const [i,stage] of overviewStages.entries()){
  overviewRect(stage.x,400,252,200,c.tealFill,c.teal);
  overviewText(stage.x+20,439,[`${i+1}. ${stage.title}`],{size:27,weight:800,color:c.ink});
  overviewText(stage.x+20,471,[stage.subtitle],{size:18,weight:600,color:c.teal});
  overviewText(stage.x+20,514,stage.lines,{size:20,gap:29});
  if(i<3)overviewArrow(`${stage.x+252},500 ${stage.x+284},500`);
}
overviewArrow('742,600 742,665 458,665 458,600','retry');
overviewText(600,696,['Failed checks return to repair within the same retry budget.'],{size:19,weight:600,color:c.amber,anchor:'middle'});

overviewText(48,740,['The assistant does the engineering. Code checks the recorded evidence.'],{size:22,weight:700,color:c.ink});
overviewRect(48,765,536,128,'#f3f6fa');
overviewText(72,800,['LOCAL CONTROLLER'],{size:23,weight:700,color:c.ink});
overviewText(72,833,['Scope, current file evidence and retry budgets.','Runs the project’s configured commands.'],{size:19,gap:29});
overviewRect(616,765,536,128,c.blueFill,c.blue);
overviewText(640,800,['ACTIVE HOST HOOK'],{size:23,weight:700,color:c.ink});
overviewText(640,833,['Enforces delivery when the hook is active.','A ready result or an honest blocked handoff.'],{size:19,gap:29});
overviewText(48,927,['* Original-code proof for applicable feature, bug-fix and refactor runs; exemptions are recorded.'],{size:17});
overviewText(48,964,['Your team reviews and shares. Publication requires authorization.'],{size:22,weight:700,color:c.ink});
overviewText(48,995,['Run logs stay local by default. Share useful project docs and review evidence through your normal process.'],{size:18});

const overviewDefs=Object.entries({forward:c.teal,knowledge:c.purple,retry:c.amber}).map(([kind,color])=>`<marker id="overview-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${color}"/></marker>`).join('');
const overviewSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1030" viewBox="0 0 1200 1030" role="img" aria-labelledby="overview-title overview-desc" font-family="Segoe UI, Arial, sans-serif"><title id="overview-title">CYC Stack team workflow</title><desc id="overview-desc">Your AI assistant reuses and revalidates project knowledge, builds a focused change and retains useful findings before final checks, proves applicable tests against original code, runs configured checks and reviews consumers, then delivers evidence and context pointers. The local controller checks records and executes project commands; an active host hook enforces delivery. Failed checks return to repair within the retry budget. Teams share through their existing project review process; run logs are local by default.</desc><defs>${overviewDefs}</defs>${overviewParts.join('\n')}</svg>\n`;
const overviewPng=await sharp(Buffer.from(overviewSvg),{density:96}).png().toBuffer();
writeFileSync(join(directory,'cyc-workflow-diagram.svg'),compactSvg(svg));
writeFileSync(htmlPath,updatedHtml);
writeFileSync(join(directory,'cyc-workflow-diagram.png'),png);
writeFileSync(join(directory,'cyc-method-library.svg'),compactSvg(methodSvg));
writeFileSync(join(directory,'cyc-method-library.png'),methodPng);
writeFileSync(join(directory,'cyc-overview.svg'),compactSvg(overviewSvg));
writeFileSync(join(directory,'cyc-overview.png'),overviewPng);
if(process.argv.includes('--geometry')) console.log(JSON.stringify(geometry,null,2));
else console.log('Updated README overview, connected workflow and method library: HTML, SVG and PNG exports.');
