import { kv } from '@vercel/kv';

const PASSWORD = process.env.APP_PASSWORD;
const KEY = 'athena_state';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-athena-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pwd = req.headers['x-athena-password'];
  if (pwd !== PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const data = await kv.get(KEY);
    return res.status(200).json(data || {});
  }

  if (req.method === 'POST') {
    await kv.set(KEY, req.body);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
