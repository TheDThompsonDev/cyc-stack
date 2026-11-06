import test from 'node:test';
import assert from 'node:assert/strict';
import { storageFixture, membershipHandlers, cancellationJourney, conversationFixture } from '../test-support/contract-journeys.mjs';
import { validateAssessment } from '../scripts/work-review.mjs';
const canonical = { $id: 'canonical', userID: 'attendee', eventID: 'event-a', status: 'cancelled', $updatedAt: '2026-11-03' };
const legacy = { $id: 'legacy', userId: 'attendee', eventId: 'event-a', status: 'going', $updatedAt: '2026-11-04' };
const actor = { $id: 'attendee' };
test('authoritative cancel/status followed by protected history/send catches conflicting legacy membership', async () => {
  const expected = { cancelled: 200, status: 'cancelled', history: 403, send: 403 };
  const broken = storageFixture([canonical, legacy]);
  assert.notDeepEqual(await cancellationJourney(membershipHandlers(broken, async () => actor, { inconsistent: true })), expected);
  const coherent = storageFixture([canonical, legacy]);
  assert.deepEqual(await cancellationJourney(membershipHandlers(coherent, async () => actor)), expected);
  assert.equal(coherent.messages.length, 0); assert(coherent.calls.some(([op]) => op === 'list'));
});
test('canonical-only, legacy-only and Going cancellation use the actual writer and preserve access controls', async () => {
  for (const rows of [[canonical], [legacy], [{ ...canonical, status: 'going' }]]) {
    const db = storageFixture(rows), handlers = membershipHandlers(db, async () => actor);
    assert.deepEqual(await cancellationJourney(handlers), { cancelled: 200, status: 'cancelled', history: 403, send: 403 });
    if (rows[0].status === 'going') assert(db.calls.some(([op]) => op === 'update'));
  }
  const db = storageFixture([{ ...canonical, status: 'going' }]);
  const eligible = membershipHandlers(db, async () => actor);
  assert.equal((await eligible.history(new Request('https://fixture.test/chat'), 'event-a')).status, 200);
  assert.equal((await eligible.history(new Request('https://fixture.test/chat'), 'other-event')).status, 404);
  assert.equal((await membershipHandlers(db, async () => null).history(new Request('https://fixture.test/chat'), 'event-a')).status, 401);
  const request = () => new Request('https://fixture.test/chat', { method: 'POST', body: JSON.stringify({ body: 'hello', requestId: 'unauthorized' }) });
  assert.equal((await eligible.send(request(), 'other-event')).status, 404);
  assert.equal((await membershipHandlers(db, async () => null).send(request(), 'event-a')).status, 401);
  assert.equal(db.messages.length, 0, 'denied reads and writes make no unauthorized write');
  const send = expectedActorId => eligible.send(new Request('https://fixture.test/chat', { method: 'POST', body: JSON.stringify({ body: 'hello', requestId: 'request', expectedActorId }) }), 'event-a');
  assert.equal((await send('other-actor')).status, 409); assert.equal(db.messages.length, 0);
  assert.equal((await send('attendee')).status, 200); assert.equal(db.messages.length, 1);
});
const message = (extra = {}) => ({ id: 'message', authorId: 'actor-a', eventId: 'event-a', body: 'confirmed', ...extra });
test('unchanged cached identity cannot acknowledge a mismatched send; client rejection does not prove server prevention', () => {
  const c = conversationFixture('actor-a', 'event-a'); c.state.messages = [message()]; c.state.draft = 'draft';
  const op = c.begin('send');
  assert.equal(c.accept(op, message({ authorId: 'actor-b' })), false);
  assert.equal(c.state.actorId, 'actor-a'); assert.equal(c.state.retired, true); assert.deepEqual(c.state.messages, []);
  assert.equal(c.state.draft, 'draft'); assert.equal(c.state.feedback, null);
  const broken = conversationFixture('actor-a', 'event-a', { validateSend: false });
  assert.equal(broken.accept(broken.begin('send'), message({ authorId: 'actor-b' })), true, 'negative demonstration: an omitted write guard falsely acknowledges');
});
test('read/resource/prior-operation mismatch is rejected while a matching send survives delayed empty polling', () => {
  for (const payload of [{ currentUserId: 'actor-b', eventId: 'event-a', messages: [] }, { currentUserId: 'actor-a', eventId: 'other-event', messages: [] }]) {
    const c = conversationFixture('actor-a', 'event-a'); assert.equal(c.accept(c.begin('read'), payload), false); assert(c.state.retired);
  }
  const c = conversationFixture('actor-a', 'event-a'); const old = c.begin('read'); c.switchContext('actor-b', 'event-b');
  assert.equal(c.accept(old, { currentUserId: 'actor-a', eventId: 'event-a', messages: [message()] }), false); assert.equal(c.state.retired, false);
  c.switchContext('actor-a', 'event-a'); const empty = c.begin('read'); c.state.draft = 'draft';
  assert.equal(c.accept(c.begin('send'), message()), true);
  assert.equal(c.accept(empty, { currentUserId: 'actor-a', eventId: 'event-a', messages: [] }), true);
  assert.deepEqual(c.state.messages, [message()]); assert.equal(c.state.feedback, 'sent'); assert.equal(c.state.draft, '');
});
test('prior read/send operations cannot merge into a newer operation, and mismatched send resource retires context', () => {
  const c = conversationFixture('actor-a', 'event-a'), oldRead = c.begin('read'), newRead = c.begin('read');
  assert(c.accept(newRead, { currentUserId: 'actor-a', eventId: 'event-a', messages: [message()] }));
  assert.equal(c.accept(oldRead, { currentUserId: 'other-actor', eventId: 'event-a', messages: [] }), false); assert.equal(c.state.retired, false);
  const oldSend = c.begin('send'), newSend = c.begin('send'); assert.equal(c.accept(oldSend, message({ id: 'stale-send' })), false);
  assert.equal(c.accept(newSend, message({ eventId: 'wrong-event' })), false); assert(c.state.retired); assert.equal(c.state.feedback, null);
});
test('a declared protected journey cannot pass as generic prose, an unavailable result, or machine-observed suite coverage', () => {
  const consumer = { id: 'access', journey: { name: 'cancel-status-history-send', writer: 'existing cancel entrypoint', operations: ['status', 'history', 'send'] } };
  const state = { workContractVersion: 1, evidenceVersion: 1, criteria: [{ id: 'privacy', description: 'Cancelled access is denied.' }], commands: [{ id: 'tests' }], handoffs: [{ stage: 'scout', status: 'passed', assessment: { consumers: [consumer] } }] };
  const row = { id: 'privacy', scenario: 'cancel-status-history-send', consumers: ['access'], check: 'tests', receipt: 'current-verification', result: 'passed', origin: 'agent-reported', evidence: 'Actual cancellation/status/history/send fixture returned cancelled/denied.' };
  const assessment = { semanticReview: { reviewer: 'self', intent: 'Fixture review.', consumers: 'Actual journey.', conventions: 'Fixture style.', findings: [] }, consumerChecks: [{ id: 'access', result: 'passed', evidence: 'Actual journey observation.' }], criterionChecks: [row] };
  assert.doesNotThrow(() => validateAssessment(state, { stage: 'verify', status: 'passed', assessment: structuredClone(assessment) }, () => ({})));
  for (const patch of [{ scenario: '100 tests passed' }, { result: 'unverified' }, { origin: 'machine-observed' }]) {
    const invalid = structuredClone(assessment); Object.assign(invalid.criterionChecks[0], patch);
    assert.throws(() => validateAssessment(state, { stage: 'verify', status: 'passed', assessment: invalid }, () => ({})), /unverified|agent-reported/);
  }
});
