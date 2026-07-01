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
    await redis.set(QUEUE_KEY, req.body);
    return res.status(200).json({ ok: true });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
