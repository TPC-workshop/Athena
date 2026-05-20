import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const PASSWORD = 'Ath3na-W0rk5h0p!';
const QUEUE_KEY = 'athena-queue-state';

export default async function handler(req, res) {
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
