import { createMemoryStorage, loadAssignments, saveAssignments } from './storage.mjs';
import { selectView } from './views.mjs';

export function createTracker({ storage = createMemoryStorage() } = {}) {
  let assignments = [];
  let nextId = 1;

  return {
    add(title) {
      if (typeof title !== 'string' || !title.trim()) throw new Error('A title is required');
      const assignment = { id: String(nextId++), title: title.trim() };
      assignments.push(assignment);
      return { ...assignment };
    },
    list() { return selectView('assignment-list', assignments); },
    activeList() { return selectView('active-list', assignments); },
    remainingCount() { return selectView('remaining-count', assignments); },
    save() { saveAssignments(storage, assignments, nextId); },
    load() {
      const snapshot = loadAssignments(storage);
      assignments = snapshot.assignments;
      nextId = snapshot.nextId;
    },
  };
}
