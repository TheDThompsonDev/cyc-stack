// Development entrypoints adapted from the frozen event-chat audit's public contracts.
// These are executable examples, not the meetup application or held-out model evidence.
export const equal = (attribute, value) => JSON.stringify({ method: 'equal', attribute, values: [value] });
export function storageFixture(rsvps) {
  const rows = structuredClone(rsvps), messages = [], calls = [];
  return { rows, messages, calls,
    async getDocument(_db, collection, id) { calls.push(['get', collection, id]); if (collection === 'events' && id === 'event-a') return { $id: id }; throw new Error('not found'); },
    async listDocuments(_db, collection, encoded = []) {
      calls.push(['list', collection, encoded]); let selected = [...(collection === 'rsvps' ? rows : messages)];
      for (const query of encoded.map(JSON.parse)) {
        if (query.method === 'equal') selected = selected.filter(row => query.values.includes(row[query.attribute]));
        else if (query.method === 'orderDesc') selected.sort((a, b) => String(b[query.attribute]).localeCompare(String(a[query.attribute])));
        else if (query.method === 'limit') selected = selected.slice(0, query.values[0]);
        else throw new Error(`Unsupported isolated query: ${query.method}`);
      }
      return { total: selected.length, documents: structuredClone(selected) };
    },
    async updateDocument(_db, collection, id, patch) { calls.push(['update', collection, id]); const row = rows.find(r => r.$id === id); if (!row || collection !== 'rsvps') throw new Error('not found'); Object.assign(row, patch, { $updatedAt: '2026-11-05T00:00:00Z' }); return structuredClone(row); },
    async createDocument(_db, collection, id, data) { calls.push(['create', collection, id]); if (collection !== 'messages') throw new Error('wrong collection'); const row = { ...data, $id: id }; messages.push(row); return structuredClone(row); }
  };
}
export function membershipHandlers(db, session, { inconsistent = false } = {}) {
  const response = (body, status = 200) => Response.json(body, { status });
  // Cancellation/status use canonical aliases before supported legacy aliases.
  const records = async (actor, event) => {
    const query = async (user, resource) => (await db.listDocuments('db', 'rsvps', [equal(user, actor), equal(resource, event)])).documents;
    return [await query('userID', 'eventID'), await query('userId', 'eventId')];
  };
  const authoritative = async (actor, event) => { const [canonical, legacy] = await records(actor, event); return canonical[0] ?? legacy[0]; };
  const membership = async (actor, event) => inconsistent
    ? (await records(actor, event)).flat().sort((a, b) => b.$updatedAt.localeCompare(a.$updatedAt))[0]
    : authoritative(actor, event);
  const protectedActor = async event => {
    const actor = await session(); if (!actor) return { denied: response({ error: 'unauthenticated' }, 401) };
    try { await db.getDocument('db', 'events', event); } catch { return { denied: response({ error: 'event' }, 404) }; }
    const rsvp = await membership(actor.$id, event);
    return rsvp?.status === 'going' ? { actor } : { denied: response({ error: 'membership' }, 403) };
  };
  return {
    async cancel(request) {
      const actor = await session(); if (!actor) return response({}, 401);
      const event = new URL(request.url).searchParams.get('eventId');
      const row = await authoritative(actor.$id, event); if (!row) return response({}, 404);
      if (row.status !== 'cancelled') await db.updateDocument('db', 'rsvps', row.$id, { status: 'cancelled' });
      return response({ success: true });
    },
    async status(_request, event) { const actor = await session(); return actor ? response({ rsvp: await authoritative(actor.$id, event) }) : response({}, 401); },
    async history(_request, event) { const access = await protectedActor(event); return access.denied ?? response({ currentUserId: access.actor.$id, eventId: event, messages: (await db.listDocuments('db', 'messages', [equal('eventId', event)])).documents }); },
    async send(request, event) {
      const access = await protectedActor(event); if (access.denied) return access.denied;
      const input = await request.json();
      // This is a server precondition, separate from client response rejection.
      if (input.expectedActorId !== undefined && input.expectedActorId !== access.actor.$id) return response({ error: 'session changed' }, 409);
      return response(await db.createDocument('db', 'messages', input.requestId, { authorId: access.actor.$id, eventId: event, body: input.body }));
    }
  };
}
export async function cancellationJourney(handlers, event = 'event-a') {
  const cancelled = await handlers.cancel(new Request(`https://fixture.test/rsvp?eventId=${event}`, { method: 'DELETE' }));
  const status = await handlers.status(new Request('https://fixture.test/status'), event);
  const read = await handlers.history(new Request('https://fixture.test/chat'), event);
  const send = await handlers.send(new Request('https://fixture.test/chat', { method: 'POST', body: JSON.stringify({ requestId: 'new-message', body: 'Must be denied' }) }), event);
  return { cancelled: cancelled.status, status: (await status.json()).rsvp?.status, history: read.status, send: send.status };
}

export function conversationFixture(actorId, eventId, { validateSend = true } = {}) {
  const state = { actorId, eventId, generation: 0, sequence: 0, lastRead: 0, pendingSend: 0, messages: [], draft: '', feedback: null, loaded: false, retired: false };
  const begin = kind => { const operation = { kind, actorId: state.actorId, eventId: state.eventId, generation: state.generation, sequence: ++state.sequence, draft: state.draft }; if (kind === 'send') state.pendingSend = operation.sequence; return operation; };
  const merge = messages => { const byId = new Map(state.messages.map(m => [m.id, m])); for (const m of messages) byId.set(m.id, m); state.messages = [...byId.values()]; };
  const accept = (operation, payload) => {
    if (operation.generation !== state.generation || operation.actorId !== state.actorId || operation.eventId !== state.eventId) return false;
    if (operation.kind === 'send' ? operation.sequence !== state.pendingSend : operation.sequence < state.lastRead) return false;
    const actor = operation.kind === 'send' ? payload.authorId : payload.currentUserId;
    if ((operation.kind !== 'send' || validateSend) && (actor !== operation.actorId || payload.eventId !== operation.eventId)) {
      state.generation++; state.retired = true; state.messages = []; state.loaded = false; state.feedback = null; return false;
    }
    if (operation.kind === 'send') {
      merge([payload]); if (state.draft === operation.draft) state.draft = ''; state.feedback = 'sent';
    } else {
      if (operation.sequence < state.lastRead) return false;
      state.lastRead = operation.sequence; merge(payload.messages); state.loaded = true;
    }
    return true;
  };
  const switchContext = (actor, event) => { state.actorId = actor; state.eventId = event; state.generation++; state.messages = []; state.feedback = null; state.loaded = false; };
  return { state, begin, accept, switchContext };
}
