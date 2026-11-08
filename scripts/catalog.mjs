import { readFileSync } from 'node:fs';

export const catalog = JSON.parse(readFileSync(new URL('../catalog/playbooks.json', import.meta.url), 'utf8'));
export function getPlaybook(id) {
  const playbook = catalog.playbooks.find(item => item.id === id);
  if (!playbook) throw new Error(`Unknown playbook: ${id}. Use cyc playbooks to list choices.`);
  return playbook;
}

export function routeTask(goal, {paths=[]}={}) {
  if(!Array.isArray(paths)||paths.some(p=>typeof p!=='string'))throw Error('Route paths must be an array of strings.');
  const rules = [
    ['teach', /\b(teach|learn|lesson|explain.*(?:to me|student))\b/i],
    ['reflect', /\b(reflect|lessons learned)\b/i],
    ['resume', /\b(resume|pick up|continue where)\b/i],
    ['evaluate', /\b(benchmark|evaluate.*(?:skill|workflow)|compare.*baseline)\b/i],
    ['bug-fix', /\b(bug|broken|crash|fails?|regression|fix)\b/i],
    ['performance', /\b(slow|latency|performance|speed up)\b/i],
    ['refactor', /\b(refactor|rename|restructure)\b/i],
    ['review', /\b(review|audit)\b/i],
    ['verify', /\b(verify|test whether|does .* work)\b/i],
    ['plan', /\b(plan|roadmap|phases)\b/i],
    ['explore', /\b(explore|prototype|alternatives|brainstorm)\b/i],
    ['handoff', /\b(handoff|pull request|prepare.*review)\b/i],
    ['experience', /\b(redesign|user journey|cohesion|layout)\b/i],
    ['investigation', /\b(how does|why does|investigate|understand)\b/i]
  ];
  const match = rules.find(([, pattern]) => pattern.test(goal));
  const consequential=/\b(auth(?:orization|entication)?|permissions?|privacy|identity|payments?|migrat(?:e|ion)|delet(?:e|ion)|restor(?:e|ation)|concurren\w*|public (?:api|interface)|stored (?:data|records?))\b/i.test([goal,...paths].join(' '));
  const routine=!consequential&&/\b(wording|typo|spelling|documentation)\b/i.test(goal)&&paths.length>0&&paths.every(p=>/\.md$/i.test(p)&&!p.includes('..')&&!/[*?]/.test(p));
  const impact=consequential?'consequential':routine?'routine':'unknown';
  return { playbook: match?.[0] ?? 'feature', basis: match ? 'Keyword suggestion; the orchestrator must confirm intent.' : 'Default suggestion; select a playbook explicitly when uncertain.', advisory: true,
    guidance:{impact,basis:consequential?'Description/scope signals a consequential contract; inspect actual writers and consumers.':routine?'Wording-only description and Markdown scope; confirm unchanged behavior.':'Description and paths do not bound downstream impact.',
      next:impact==='unknown'?'Investigate affected state, interfaces and indirect consumers before choosing effort.':'Confirm impact against code and original requirements in Scout.',review:consequential?'Focused challenge and fresh review under existing high-risk policy.':'Follow existing review policy; unknown dependency impact retains broader coverage.',
      checks:'Preserve original criteria, required final checks, proof, ownership and freshness. Reuse only compatible existing evidence.',canWaiveRequiredChecks:false}};
}
