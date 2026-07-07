// api/last-email.js
//
// Returns the most recent email logged against a Zoho CRM record (Deal, Contact, etc.)
// so the comms dashboard can show a "last email" preview without leaving the page.
//
// Usage:  GET /api/last-email?url=<the full Zoho CRM record URL, e.g. https://crm.zoho.eu/crm/org.../tab/Deals/349824000058395237>
// Header: x-athena-password: <same shared password used by /api/queue-state>
//
// Required environment variables (set these in the Vercel project settings):
//   ZOHO_CLIENT_ID
//   ZOHO_CLIENT_SECRET
//   ZOHO_REFRESH_TOKEN
//   ZOHO_DC              e.g. "eu"  (matches crm.zoho.eu — change if your org is on a different data centre)
//   ATHENA_PASSWORD      same value as API_PASSWORD in comms.html / Athena
//
// If you already have a Zoho self-client set up for the configurator's Cloudflare Worker,
// the same client ID/secret/refresh token (with the ZohoCRM.modules.emails.READ and
// ZohoCRM.modules.ALL or .deals.READ scopes) can be reused here — no need to create a new one.

let cachedToken = null // { access_token, expires_at } — cached per warm serverless instance

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expires_at > now + 60_000) {
    return cachedToken.access_token
  }

  const dc = process.env.ZOHO_DC || 'eu'
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })

  const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`)
  }

  cachedToken = {
    access_token: data.access_token,
    expires_at: now + (data.expires_in || 3600) * 1000,
  }
  return cachedToken.access_token
}

// Pulls the module ("Deals", "Contacts", ...) and record ID out of a pasted
// Zoho CRM record URL, e.g. https://crm.zoho.eu/crm/org20077310723/tab/Deals/349824000058395237
function parseZohoUrl(url) {
  const m = url.match(/\/tab\/([A-Za-z_]+)\/(\d+)/)
  if (!m) return null
  return { module: m[1], recordId: m[2] }
}

export default async function handler(req, res) {
  // CORS — mirrors the existing queue-state API so comms.html can call this cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-athena-password')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.headers['x-athena-password'] !== process.env.ATHENA_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'Missing url parameter' })

  const parsed = parseZohoUrl(url)
  if (!parsed) return res.status(400).json({ error: 'Could not parse a Zoho record from that URL' })

  try {
    const accessToken = await getAccessToken()
    const dc = process.env.ZOHO_DC || 'eu'

    const emailRes = await fetch(
      `https://www.zohoapis.${dc}/crm/v8/${parsed.module}/${parsed.recordId}/Emails` +
        `?fields=subject,from,to,time,sent&per_page=1&sort_by=id&sort_order=desc`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    )

    if (emailRes.status === 204) {
      return res.status(200).json({ found: false })
    }

    const emailData = await emailRes.json()
    if (!emailData.Emails || !emailData.Emails.length) {
      return res.status(200).json({ found: false })
    }

    const e = emailData.Emails[0]
    return res.status(200).json({
      found: true,
      subject: e.subject || '(no subject)',
      direction: e.sent ? 'sent' : 'received',
      from: e.from?.email || null,
      to: (e.to || []).map(t => t.email).join(', ') || null,
      time: e.time || null,
    })
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) })
  }
}
