export const storageKey = 'homework.v1';

export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

export function saveAssignments(storage, assignments, nextId) {
  const snapshot = {
    version: 1,
    nextId,
    assignments: assignments.map(({ id, title }) => ({ id, title })),
  };
  storage.setItem(storageKey, JSON.stringify(snapshot));
}

export function loadAssignments(storage) {
  const raw = storage.getItem(storageKey);
  if (raw === null) return { assignments: [], nextId: 1 };
  const snapshot = JSON.parse(raw);
  if (snapshot.version !== 1 || !Array.isArray(snapshot.assignments)) {
    throw new Error('Unsupported homework data');
  }
  return {
    assignments: snapshot.assignments.map(({ id, title }) => ({ id, title })),
    nextId: snapshot.nextId,
  };
}
