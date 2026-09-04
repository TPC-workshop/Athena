// api/leads-portal-sync.js
// Server-to-server endpoint for the leads-portal CRM ("The Workbench") to push a
// newly-won order into the Athena queue. Safe read-merge-write, same pattern as
// api/zoho-sync.js — never overwrites calendarMonths/overtimePool/complexThreshold/
// queueTeam/mgmtOverhead/wsOverhead, which live in the same Redis blob.

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const QUEUE_KEY = 'athena-queue-state';

// Mirrors QTYS keys in src/data.js — kept as a literal here rather than importing
// from src/, matching how api/zoho-sync.js already builds its qtys object inline.
const QTY_KEYS = [
  'carc', 'draw', 'hdoor', 'sdoor', 'udoor', 'shaker',
  'wt', 'shelf', 'bar', 'pdiv', 'ddogdiv', 'ddiv', 'paint', 'curtain',
];

function emptyQtys() {
  return Object.fromEntries(QTY_KEYS.map(k => [k, 0]));
}

function findByLeadsPortalId(streams, leadsPortalId) {
  for (const arr of streams) {
    const idx = arr.findIndex(o => o.leadsPortalId === leadsPortalId);
    if (idx >= 0) return { arr, idx };
  }
  return null;
}

// The Workbench sends dims in millimetres as {width, height, depth} only once
// every axis is actually known (see its own api/athena/sync.js) — never a
// partial object. Mirrors that same all-or-nothing check here rather than
// trusting a truthy check, since a real 0 shouldn't be treated as "missing".
function hasDims(d) {
  return !!d && d.width != null && d.height != null && d.depth != null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.LEADS_PORTAL_SYNC_SECRET;
  if (!secret) return res.status(500).json({ error: 'LEADS_PORTAL_SYNC_SECRET is not configured' });
  if (req.headers['x-leads-portal-secret'] !== secret) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};
  const { leadsPortalId, name } = body;
  if (!leadsPortalId || !name) {
    return res.status(400).json({ error: 'leadsPortalId and name are required' });
  }

  try {
    const current = (await redis.get(QUEUE_KEY)) || {};
    const simpleOrders = [...(current.simpleOrders || [])];
    const complexOrders = [...(current.complexOrders || [])];
    const financeOrders = [...(current.financeOrders || [])];
    let qCount = current.qCount || 0;

    const existing = findByLeadsPortalId([simpleOrders, complexOrders, financeOrders], leadsPortalId);

    let created = false;
    let orderId;

    if (existing) {
      const { arr, idx } = existing;
      const prev = arr[idx];
      // Identity/value fields AND the production-detail fields a sales rep
      // reviews at Won (unitType/dims/petName/targetDate/notes/designFileUrl)
      // are refreshed from leads-portal on every push, including a re-push
      // from a reopen-and-reconfirm cycle — these are all plain scalar
      // overwrites, safe to trust from the CRM every time. qtys/bespoke/
      // pctDone/portalToken/portalStage/stream stay untouched here — those
      // are owned by Athena once the order exists, since a human may already
      // be mid-build against them and a resync must never reset that work.
      arr[idx] = {
        ...prev,
        name,
        salePrice: body.salePrice !== undefined ? (parseFloat(body.salePrice) || 0) : prev.salePrice,
        saleIncVat: body.saleIncVat !== undefined ? !!body.saleIncVat : prev.saleIncVat,
        orderDate: body.orderDate !== undefined ? body.orderDate : prev.orderDate,
        unitType: body.unitType !== undefined ? body.unitType : prev.unitType,
        petName: body.petName !== undefined ? body.petName : prev.petName,
        targetDate: body.targetDate !== undefined ? body.targetDate : prev.targetDate,
        dims: hasDims(body.dims) ? body.dims : prev.dims,
        notes: body.notes !== undefined ? body.notes : prev.notes,
        designFileUrl: body.designFileUrl !== undefined ? body.designFileUrl : prev.designFileUrl,
      };
      orderId = prev.id;
    } else {
      const bespoke = Array.isArray(body.bespoke) ? [...body.bespoke] : [];

      orderId = `q${qCount}`;
      qCount++;
      created = true;
      simpleOrders.push({
        id: orderId,
        name,
        orderDate: body.orderDate || '',
        unitType: body.unitType || 'painted',
        qtys: emptyQtys(),
        bespoke,
        salePrice: parseFloat(body.salePrice) || 0,
        saleIncVat: body.saleIncVat !== undefined ? !!body.saleIncVat : true,
        portalStage: 'booked',
        portalStageUpdated: new Date().toISOString(),
        pctDone: 0,
        inMaterialsForecast: false,
        stream: 'simple',
        leadsPortalId,
        // Production/portal detail a sales rep confirmed at Won — see
        // leads-portal's own api/athena/sync.js for exactly what's sent and
        // why. petName/targetDate double as real fields the customer portal
        // (api/portal.js) already reads; dims/notes/designFileUrl are
        // staff-facing only. All optional: an older push (or one from a lead
        // with a field left blank) simply omits the key, same as every
        // other field here defaults to blank rather than guessed at.
        petName: body.petName || '',
        targetDate: body.targetDate || '',
        dims: hasDims(body.dims) ? body.dims : undefined,
        notes: body.notes || '',
        designFileUrl: body.designFileUrl || undefined,
      });
    }

    await redis.set(QUEUE_KEY, { ...current, simpleOrders, complexOrders, financeOrders, qCount });

    return res.status(200).json({ ok: true, created, orderId });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
