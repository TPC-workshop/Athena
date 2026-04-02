import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const KEY = 'athena_state'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const data = await redis.get(KEY)
  return res.status(200).json(data || {})
}
