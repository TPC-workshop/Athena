// api/zoho-sync.js
// Pulls all deals from the "Workshop Process" pipeline in Zoho CRM
// and merges any new ones into the Athena queue safely (read-merge-write)

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const PASSWORD = 'Ath3na-W0rk5h0p!';
const QUEUE_KEY = 'athena-queue-state';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-athena-password',
};

let cachedToken = null;

async function getZohoToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at > now + 60000) return cachedToken.access_token;
  const dc = process.env.ZOHO_DC || 'eu';
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Zoho token failed: ${JSON.stringify(data)}`);
  cachedToken = { access_token: data.access_token, expires_at: now + (data.expires_in || 3600) * 1000 };
  return cachedToken.access_token;
}

function extractToken(progressLink) {
  if (!progressLink) return '';
  return progressLink.toString().replace('https://order.thepetcarpenter.co.uk/', '').trim();
}

function mapDealToOrder(deal, qCount) {
  const unitTypeRaw = deal['Unit_type'] || '';
  const unitType = unitTypeRaw.toLowerCase().includes('wax') ? 'waxed' : 'painted';
  const qtys = {
    carc:    parseInt(deal['Carcasses'])      || 0,
    draw:    parseInt(deal['Drawers'])        || 0,
    hdoor:   parseInt(deal['Hinged_Doors'])   || 0,
    sdoor:   parseInt(deal['Sliding_doors'])  || 0,
    udoor:   parseInt(deal['Up_Over_doors'])  || 0,
    shaker:  parseInt(deal['Shaker_doors'])   || 0,
    wt:      parseInt(deal['Worktops'])       || 0,
    shelf:   parseInt(deal['Shelves'])        || 0,
    bar:     parseInt(deal['Bar_sets'])       || 0,
    pdiv:    parseInt(deal['Panel_divides'])  || 0,
    ddogdiv: parseInt(deal['Dog_divides'])    || 0,
    ddiv:    parseInt(deal['Drawer_divides']) || 0,
    paint:   parseInt(deal['Units_to_paint']) || 0,
    curtain: 0,
  };
  const bespokeHours = parseFloat(deal['Bespoke_hours']) || 0;
  const stream = bespokeHours >= 30 ? 'complex' : 'simple';
  const orderDate = deal['Deposit_Paid_Date'] || (deal['Created_Time'] || '').split('T')[0] || '';
  const portalToken = extractToken(deal['Progress_link']);
  return {
    id: `q${qCount}`,
    name: deal['Deal_Name'] || '',
    orderDate,
    unitType,
    qtys,
    bespoke: [],
    salePrice: parseFloat(deal['Amount']) || 0,
    saleIncVat: true,
    portalToken,
    portalStage: 'confirmed',
    portalStageUpdated: new Date().toISOString(),
    pctDone: 0,
    inMaterialsForecast: false,
    stream,
    zohoStage: deal['Stage'] || '',
    zohoDealId: deal.id,
    zohoDealUrl: `https://crmplus.zoho.eu/crm/org20077310723/tab/Potentials/${deal.id}`,
  };
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.headers['x-athena-password'] !== PASSWORD) return res.status(403).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const token = await getZohoToken();
    const dc = process.env.ZOHO_DC || 'eu';

    const fields = [
      'id','Deal_Name','Stage','Amount','Deposit_Paid_Date','Created_Time',
      'Unit_type','Carcasses','Drawers','Hinged_Doors','Sliding_doors',
      'Up_Over_doors','Shaker_doors','Worktops','Shelves','Bar_sets',
      'Panel_divides','Dog_divides','Drawer_divides','Units_to_paint',
      'Bespoke_hours','Progress_link','Pipeline',
    ].join(',');

    const zohoRes = await fetch(
      `https://www.zohoapis.${dc}/crm/v8/Deals?fields=${fields}&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const zohoData = await zohoRes.json();
    if (!zohoData.data) return res.status(200).json({ ok: true, added: 0, skipped: 0, total: 0, addedNames: [], message: 'No deals returned from Zoho' });

    // Filter to Workshop Process pipeline
    const workshopDeals = zohoData.data.filter(d => {
      const pipeline = d['Pipeline'];
      if (!pipeline) return false;
      if (typeof pipeline === 'string') return pipeline === 'Workshop Process';
      if (typeof pipeline === 'object') return pipeline.name === 'Workshop Process';
      return false;
    });

    // Read current queue state
    const current = await redis.get(QUEUE_KEY) || {};
    const simpleOrders = [...(current.simpleOrders || [])];
    const complexOrders = [...(current.complexOrders || [])];
    const financeOrders = current.financeOrders || [];
    let qCount = current.qCount || 0;

    const existingZohoIds = new Set([
      ...simpleOrders.map(o => o.zohoDealId).filter(Boolean),
      ...complexOrders.map(o => o.zohoDealId).filter(Boolean),
    ]);
    const existingTokens = new Set([
      ...simpleOrders.map(o => o.portalToken).filter(Boolean),
      ...complexOrders.map(o => o.portalToken).filter(Boolean),
    ]);

    let added = 0;
    let skipped = 0;
    const addedNames = [];

    for (const deal of workshopDeals) {
      const portalToken = extractToken(deal['Progress_link']);
      // Skip if already in queue by Zoho deal ID or portal token
      if (existingZohoIds.has(deal.id) || (portalToken && existingTokens.has(portalToken))) {
        skipped++;
        continue;
      }
      const newOrder = mapDealToOrder(deal, qCount);
      qCount++;
      if (newOrder.stream === 'complex') {
        complexOrders.push(newOrder);
      } else {
        simpleOrders.push(newOrder);
      }
      existingZohoIds.add(deal.id);
      if (portalToken) existingTokens.add(portalToken);
      added++;
      addedNames.push(newOrder.name);
    }

    await redis.set(QUEUE_KEY, { ...current, simpleOrders, complexOrders, financeOrders, qCount });

    return res.status(200).json({ ok: true, added, skipped, total: workshopDeals.length, addedNames });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
