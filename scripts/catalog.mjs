import { readFileSync } from 'node:fs';

export const catalog = JSON.parse(readFileSync(new URL('../catalog/playbooks.json', import.meta.url), 'utf8'));
export function getPlaybook(id) {
  const playbook = catalog.playbooks.find(item => item.id === id);
  if (!playbook) throw new Error(`Unknown playbook: ${id}. Use cyc playbooks to list choices.`);
  return playbook;
}

export function routeTask(goal) {
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
  return { playbook: match?.[0] ?? 'feature', basis: match ? 'Keyword suggestion; the orchestrator must confirm intent.' : 'Default suggestion; select a playbook explicitly when uncertain.', advisory: true };
}
