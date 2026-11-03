import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const candidateArgument = process.argv[2];
if (!candidateArgument) {
  console.error('Usage: node evals/homework/evaluate.mjs PATH_TO_CANDIDATE');
  process.exit(2);
}

const candidateRoot = path.resolve(candidateArgument);
const { createTracker } = await import(pathToFileURL(path.join(candidateRoot, 'src', 'tracker.mjs')));
const checks = [];

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function check(name, fn) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, detail: error.message }); }
}

check('completion: only the requested item becomes finished', () => {
  const tracker = createTracker();
  const algebra = tracker.add('Algebra');
  const english = tracker.add('English');
  assert.equal(algebra.finished, false);
  assert.equal(typeof tracker.markFinished, 'function');
  tracker.markFinished(english.id);
  const all = tracker.list();
  assert.deepEqual(all.map(item => item.id), [algebra.id, english.id]);
  assert.deepEqual(all.map(item => item.finished), [false, true]);
  tracker.markFinished(english.id);
  assert.deepEqual(tracker.list(), all);
  assert.throws(() => tracker.markFinished('missing-assignment'));
  assert.deepEqual(tracker.list(), all);
});

check('views: active assignments and remaining count agree', () => {
  const tracker = createTracker();
  const first = tracker.add('First');
  const middle = tracker.add('Middle');
  const last = tracker.add('Last');
  tracker.markFinished(middle.id);
  assert.deepEqual(tracker.activeList().map(item => item.id), [first.id, last.id]);
  assert.ok(tracker.activeList().every(item => item.finished === false));
  assert.equal(tracker.remainingCount(), 2);
  tracker.markFinished(first.id);
  tracker.markFinished(last.id);
  assert.deepEqual(tracker.activeList(), []);
  assert.equal(tracker.remainingCount(), 0);
  assert.equal(tracker.list().length, 3);
});

check('persistence: a fresh tracker restores status and derived views', () => {
  const adapter = storage();
  const original = createTracker({ storage: adapter });
  const finished = original.add('Completed reading');
  const unfinished = original.add('Lab report');
  original.markFinished(finished.id);
  original.save();
  const reloaded = createTracker({ storage: adapter });
  reloaded.load();
  assert.deepEqual(reloaded.list(), original.list());
  assert.deepEqual(reloaded.activeList().map(item => item.id), [unfinished.id]);
  assert.equal(reloaded.remainingCount(), 1);
  const added = reloaded.add('Next assignment');
  assert.equal(added.finished, false);
  assert.ok(![finished.id, unfinished.id].includes(added.id));
  reloaded.save();
  const again = createTracker({ storage: adapter });
  again.load();
  assert.deepEqual(again.list(), reloaded.list());
});

check('compatibility: existing records default to unfinished and remain writable', () => {
  const adapter = storage();
  adapter.setItem('homework.v1', JSON.stringify({
    version: 1, nextId: 3,
    assignments: [{ id: '1', title: 'Legacy math' }, { id: '2', title: 'Legacy art' }],
  }));
  const tracker = createTracker({ storage: adapter });
  tracker.load();
  assert.deepEqual(tracker.list().map(item => item.finished), [false, false]);
  assert.equal(tracker.remainingCount(), 2);
  tracker.markFinished('1');
  assert.equal(tracker.add('New homework').id, '3');
  tracker.save();
  const reloaded = createTracker({ storage: adapter });
  reloaded.load();
  assert.deepEqual(reloaded.list().map(item => item.finished), [true, false, false]);
  assert.equal(reloaded.remainingCount(), 2);
});

check('regression: validation, snapshots, order, and explicit save still work', () => {
  const adapter = storage();
  const tracker = createTracker({ storage: adapter });
  assert.throws(() => tracker.add('  '), /title/i);
  assert.throws(() => tracker.add(null), /title/i);
  const added = tracker.add('  Science  ');
  assert.equal(added.id, '1');
  assert.equal(added.title, 'Science');
  added.finished = true;
  tracker.list()[0].finished = true;
  tracker.activeList()[0].title = 'Unexpected mutation';
  assert.equal(tracker.list()[0].title, 'Science');
  assert.equal(tracker.list()[0].finished, false);
  const beforeSave = createTracker({ storage: adapter });
  beforeSave.load();
  assert.deepEqual(beforeSave.list(), []);
  tracker.add('Geography');
  tracker.save();
  beforeSave.load();
  assert.deepEqual(beforeSave.list().map(item => item.title), ['Science', 'Geography']);
});

console.log(JSON.stringify({ candidate: candidateRoot, checks, passed: checks.every(item => item.passed) }, null, 2));
process.exitCode = checks.every(item => item.passed) ? 0 : 1;
