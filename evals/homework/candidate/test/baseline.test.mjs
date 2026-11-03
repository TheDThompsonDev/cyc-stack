import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker } from '../src/tracker.mjs';
import { createMemoryStorage, storageKey } from '../src/storage.mjs';

test('adds assignments in order and derives existing views', () => {
  const tracker = createTracker();
  const first = tracker.add('  Algebra  ');
  const second = tracker.add('English');
  assert.equal(first.title, 'Algebra');
  assert.notEqual(first.id, second.id);
  assert.deepEqual(tracker.list().map(item => item.title), ['Algebra', 'English']);
  assert.deepEqual(tracker.activeList(), tracker.list());
  assert.equal(tracker.remainingCount(), 2);
});

test('save and load preserve assignments and the next identifier', () => {
  const storage = createMemoryStorage();
  const first = createTracker({ storage });
  first.add('Biology');
  first.save();
  const second = createTracker({ storage });
  second.load();
  assert.deepEqual(second.list(), first.list());
  assert.equal(second.add('History').id, '2');
});

test('returned assignments cannot mutate internal state', () => {
  const tracker = createTracker();
  const assignment = tracker.add('Chemistry');
  assignment.title = 'Changed';
  tracker.list()[0].title = 'Also changed';
  tracker.activeList().pop();
  assert.equal(tracker.list()[0].title, 'Chemistry');
  assert.equal(tracker.remainingCount(), 1);
});

test('empty data and invalid titles retain existing behavior', () => {
  const tracker = createTracker();
  tracker.load();
  assert.deepEqual(tracker.list(), []);
  assert.equal(tracker.remainingCount(), 0);
  assert.throws(() => tracker.add('  '), /title/i);
  assert.throws(() => tracker.add(null), /title/i);
  assert.equal(tracker.add('Art').id, '1');
});

test('unsupported stored versions are rejected', () => {
  const storage = createMemoryStorage();
  storage.setItem(storageKey, JSON.stringify({ version: 99, assignments: [] }));
  assert.throws(() => createTracker({ storage }).load(), /Unsupported/);
});
