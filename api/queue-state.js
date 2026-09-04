import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();
const PASSWORD = 'Ath3na-W0rk5h0p!';
const QUEUE_KEY = 'athena-queue-state';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-athena-password',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.headers['x-athena-password'] !== PASSWORD) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (req.method === 'GET') {
    const data = await redis.get(QUEUE_KEY);
    return res.status(200).json(data || {});
  }
  if (req.method === 'POST') {
    const incoming = req.body || {};

    // Guard against Queue.jsx's own debounced autosave (and comms-portal's
    // equivalent proxy) silently deleting an order pushed in by
    // leads-portal-sync.js/zoho-sync.js while a staff member's tab was
    // already open — both of those endpoints do a real read-merge-write, but
    // this endpoint historically just did a blind `redis.set(body)`: a
    // client whose in-memory simpleOrders/complexOrders/financeOrders
    // pre-dates an external push would overwrite Redis with its own stale,
    // shorter arrays the moment any of its own tracked state next changed.
    //
    // qCount only ever increases — every order-adding code path (this app's
    // own "+ order" forms, leads-portal-sync.js, zoho-sync.js) increments it
    // exactly once per new order and nothing ever decrements it — so an
    // incoming qCount lower than what's already stored is a reliable signal
    // that at least one order was added elsewhere since this client last
    // loaded. Only in that case, union back in any order (by id) present in
    // the current stored arrays but missing from the incoming payload,
    // rather than trusting the stale snapshot's arrays outright. This can't
    // reconstruct a genuine conflicting edit to the same order (an accepted,
    // pre-existing risk at this app's single-Redis-blob, small-team scale —
    // see leads-portal's own "no optimistic-concurrency check" precedent)
    // but it does stop a real, freshly-synced order from silently vanishing.
    const current = (await redis.get(QUEUE_KEY)) || {};
    const currentQCount = current.qCount || 0;
    const incomingQCount = incoming.qCount || 0;

    let simpleOrders = Array.isArray(incoming.simpleOrders) ? [...incoming.simpleOrders] : [];
    let complexOrders = Array.isArray(incoming.complexOrders) ? [...incoming.complexOrders] : [];
    let financeOrders = Array.isArray(incoming.financeOrders) ? [...incoming.financeOrders] : [];

    if (incomingQCount < currentQCount) {
      const knownIds = new Set([...simpleOrders, ...complexOrders, ...financeOrders].map(o => o.id));
      const streams = [
        { key: 'simpleOrders', arr: current.simpleOrders },
        { key: 'complexOrders', arr: current.complexOrders },
        { key: 'financeOrders', arr: current.financeOrders },
      ];
      for (const { key, arr } of streams) {
        for (const order of arr || []) {
          if (knownIds.has(order.id)) continue;
          knownIds.add(order.id);
          if (key === 'simpleOrders') simpleOrders.push(order);
          else if (key === 'complexOrders') complexOrders.push(order);
          else financeOrders.push(order);
        }
      }
    }

    const qCount = Math.max(incomingQCount, currentQCount);
    await redis.set(QUEUE_KEY, { ...incoming, simpleOrders, complexOrders, financeOrders, qCount });
    return res.status(200).json({ ok: true, recoveredFromConflict: incomingQCount < currentQCount });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
