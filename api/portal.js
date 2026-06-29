import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const QUEUE_KEY = 'athena-queue-state'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { token } = req.query
  if (!token || token.length < 8) return res.status(400).json({ error: 'Missing token' })

  const state = await redis.get(QUEUE_KEY)
  if (!state) return res.status(404).json({ error: 'No data' })

  const allOrders = [
    ...(state.simpleOrders || []),
    ...(state.complexOrders || []),
    ...(state.financeOrders || []),
  ]
  const order = allOrders.find(o => o.portalToken === token)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  return res.status(200).json({
    firstName:     (order.name || '').split(' ')[0] || 'there',
    fullName:      order.name || '',
    unitType:      order.unitType || 'painted',
    portalStage:   order.portalStage || 'preparing',
    portalMessage: order.portalMessage || '',
    targetDate:    order.targetDate || '',
    colour:        order.portalColour || '',
    finish:        order.portalFinish || '',
    pct:           order.portalPct || 0,
  })
}
