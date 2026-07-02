import { useState, useEffect, useRef, memo } from 'react';
import { ROLE_DEFS, QTYS, UNIT_TYPES, genClientTasks } from './data.js';

const QUEUE_PASSWORD = 'TPCLeadtime!';
const API_PASSWORD = 'Ath3na-W0rk5h0p!';

// ── Portal helpers ────────────────────────────────────────────────────────────
const PORTAL_STAGES = [
  { value: 'booked',    label: 'Booked in'            },
  { value: 'confirmed', label: 'Order confirmed'       },
  { value: 'materials', label: 'Materials ordered'     },
  { value: 'nurture1',  label: 'Nurture 1 — Workshop'  },
  { value: 'nurture2',  label: 'Nurture 2 — Space'     },
  { value: 'nurture3',  label: 'Nurture 3 — Dog prep'  },
  { value: 'building',  label: 'In build'              },
  { value: 'painting',  label: 'Paint shop'            },
  { value: 'finishing', label: 'Finishing'             },
  { value: 'invoice',   label: 'Invoice due'           },
  { value: 'delivery',  label: 'Ready'                 },
  { value: 'delivered', label: 'Delivered'             },
]

const TOUCHPOINTS = [
  { key: 'portalShared', label: '🔗 Portal link shared'    },
  { key: 'flowers',      label: '🌸 Flowers & treats sent' },
  { key: 'postcard',     label: '📬 Week 5 postcard sent'  },
  { key: 'finishPhoto',  label: '🖼 Finishing photo sent'  },
  { key: 'dogPhoto',     label: '🐾 Dog photo received'    },
  { key: 'gift',         label: '🎁 Personalised gift sent'},
]

function generateToken() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map(b => chars[b % chars.length])
    .join('')
}

// ── Stage recommendation ──────────────────────────────────────────────────────
function recommendStage(order, projectedMonth, usedFrac) {
  if (!order.orderDate) return null
  const ordered = new Date(order.orderDate)
  const daysWaited = Math.round((new Date() - ordered) / (1000*60*60*24))
  if (daysWaited < 0) return null

  let totalWeeks = null
  if (projectedMonth) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const parts = projectedMonth.split(' ')
    const mIdx = monthNames.indexOf(parts[0])
    const yr = parseInt(parts[1])
    if (!isNaN(mIdx) && !isNaN(yr)) {
      const frac = usedFrac || 0.5
      const daysInMonth = new Date(yr, mIdx + 1, 0).getDate()
      const completionDay = Math.max(1, Math.round(frac * daysInMonth))
      const completionDate = new Date(yr, mIdx, completionDay)
      totalWeeks = Math.round((completionDate - ordered) / (1000*60*60*24*7))
    }
  }

  if (!totalWeeks || totalWeeks <= 0) {
    if (daysWaited <= 7)  return { stage: 'confirmed', reason: `${daysWaited}d waited — week 1` }
    if (daysWaited <= 14) return { stage: 'materials', reason: `${daysWaited}d waited — week 2` }
    if (daysWaited <= 35) return { stage: 'nurture1',  reason: `${daysWaited}d waited — weeks 3–5` }
    if (daysWaited <= 56) return { stage: 'nurture2',  reason: `${daysWaited}d waited — weeks 6–8` }
    if (daysWaited <= 70) return { stage: 'nurture3',  reason: `${daysWaited}d waited — weeks 9–10` }
    return { stage: 'building', reason: `${daysWaited}d waited — week 11+` }
  }

  const weeksWaited = daysWaited / 7
  const pct = weeksWaited / totalWeeks
  let stage, reason
  if (pct < 0.08)      { stage = 'confirmed'; reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.15) { stage = 'materials'; reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.38) { stage = 'nurture1';  reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.55) { stage = 'nurture2';  reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.68) { stage = 'nurture3';  reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.78) { stage = 'building';  reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.88) { stage = 'painting';  reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.94) { stage = 'finishing'; reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else if (pct < 0.98) { stage = 'invoice';   reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  else                 { stage = 'delivery';  reason = `${Math.round(weeksWaited)}w of ${totalWeeks}w (${Math.round(pct*100)}%)` }
  return { stage, reason }
}

function RecSuggestion({ rec, order, onUpdate }) {
  if (!rec) return null
  const currentStage = order.portalStage || 'confirmed'
  const isCurrent = rec.stage === currentStage
  return (
    <div style={{ fontSize: 10, padding: '5px 8px', borderRadius: 4, marginBottom: 6,
      background: isCurrent ? '#f0fdf4' : '#fff8ed',
      border: '0.5px solid ' + (isCurrent ? '#bbf7d0' : '#fcd34d'),
      color: isCurrent ? '#166534' : '#92400e',
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span>
        {isCurrent ? '✓ Stage looks right' : ('💡 Suggested: ' + (PORTAL_STAGES.find(function(s){return s.value===rec.stage}) || {label:rec.stage}).label)}
        {' — ' + rec.reason}
      </span>
      {!isCurrent && (
        <button onClick={function(){ onUpdate(order.id, { portalStage: rec.stage, portalStageUpdated: new Date().toISOString() }) }}
          style={{ fontSize: 10, padding: '2px 8px', border: '0.5px solid #d97706', borderRadius: 3,
            background: '#fff', color: '#92400e', cursor: 'pointer', fontFamily: 'Georgia,serif', flexShrink: 0 }}>
          Apply
        </button>
      )}
    </div>
  )
}

// ── Portal panel ──────────────────────────────────────────────────────────────
const PortalPanel = memo(function PortalPanel({ order, onUpdate, projectedMonth, usedFrac }) {
  const [copied, setCopied] = useState(false)
  const rec = recommendStage(order, projectedMonth, usedFrac)
  const token = order.portalToken || ''
  const portalUrl = token ? `https://order.thepetcarpenter.co.uk/${token}` : ''

  function handleGenerate() {
    onUpdate(order.id, { portalToken: generateToken() })
  }
  function handleCopy() {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const ps = {
    wrap:     { marginTop: 10, borderTop: '0.5px solid #f0f0f0', paddingTop: 10 },
    label:    { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 6 },
    row:      { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 },
    select:   { fontSize: 11, padding: '3px 6px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', background: '#fff' },
    smallInp: { fontSize: 11, padding: '3px 6px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', background: '#fff' },
    textarea: { width: '100%', fontSize: 11, padding: '5px 7px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', resize: 'vertical', minHeight: 44, marginBottom: 6 },
    tokenBox: { fontSize: 10, padding: '3px 8px', background: '#f5f4f0', border: '0.5px solid #ddd', borderRadius: 3, color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 },
    btn:      { fontSize: 11, padding: '3px 10px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', cursor: 'pointer' },
    btnGreen: { fontSize: 11, padding: '3px 10px', border: '0.5px solid #1D9E75', borderRadius: 4, background: '#1D9E75', color: '#fff', fontFamily: 'Georgia,serif', cursor: 'pointer' },
  }

  return (
    <div style={ps.wrap}>
      <div style={ps.label}>Customer portal</div>

      {/* Stage */}
      <div style={ps.row}>
        <span style={{ fontSize: 11, color: '#888' }}>Stage:</span>
        <select style={ps.select} value={order.portalStage || 'confirmed'}
          onChange={e => onUpdate(order.id, { portalStage: e.target.value, portalStageUpdated: new Date().toISOString() })}>
          {PORTAL_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4, fontStyle: 'italic' }}>Progress % is automatic</span>
      </div>

      <RecSuggestion rec={rec} order={order} onUpdate={onUpdate} />

      {/* Last updated */}
      {order.portalStageUpdated && (()=>{
        const d = new Date(order.portalStageUpdated)
        const days = Math.floor((new Date() - d) / (1000*60*60*24))
        const label = days === 0 ? 'Updated today' : days === 1 ? 'Updated yesterday' : `Updated ${days} days ago`
        const stale = days >= 7
        return (
          <div style={{ fontSize: 10, color: stale ? '#b91c1c' : '#aaa', marginBottom: 6, fontStyle: 'italic', ...(stale ? { fontWeight: 'bold' } : {}) }}>
            {stale ? '⚠ ' : ''}{label} — {d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )
      })()}

      {/* Pet name + Colour */}
      <div style={ps.row}>
        <span style={{ fontSize: 11, color: '#888' }}>Pet's name:</span>
        <input style={{ ...ps.smallInp, width: 110 }}
          value={order.petName || ''} placeholder="e.g. Bella"
          onChange={e => onUpdate(order.id, { petName: e.target.value })} />
        <span style={{ fontSize: 11, color: '#888' }}>Colour:</span>
        <input style={{ ...ps.smallInp, width: 130 }}
          value={order.portalColour || ''} placeholder="e.g. Lamp Room Grey"
          onChange={e => onUpdate(order.id, { portalColour: e.target.value })} />
      </div>

      {/* Finish + delivery date */}
      <div style={ps.row}>
        <span style={{ fontSize: 11, color: '#888' }}>Finish:</span>
        <input style={{ ...ps.smallInp, width: 100 }}
          value={order.portalFinish || ''} placeholder="e.g. Oak"
          onChange={e => onUpdate(order.id, { portalFinish: e.target.value })} />
        <span style={{ fontSize: 11, color: '#888' }}>Est. delivery:</span>
        <input type="date" style={ps.smallInp}
          value={order.targetDate || ''}
          onChange={e => onUpdate(order.id, { targetDate: e.target.value })} />
      </div>

      {/* Dog photo URL */}
      <div style={ps.row}>
        <span style={{ fontSize: 11, color: '#888' }}>🐾 Dog photo URL:</span>
        <input style={{ ...ps.smallInp, flex: 1, minWidth: 200 }}
          value={order.dogPhotoUrl || ''} placeholder="Paste Google Drive / Dropbox public link…"
          onChange={e => onUpdate(order.id, { dogPhotoUrl: e.target.value })} />
        {order.dogPhotoUrl && (
          <img src={order.dogPhotoUrl} alt="dog"
            style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '0.5px solid #ddd', flexShrink: 0 }}
            onError={e => e.target.style.display = 'none'} />
        )}
      </div>

      {/* Personal message */}
      <textarea style={ps.textarea}
        value={order.portalMessage || ''} placeholder="Personal message shown to customer — update this as the order progresses…"
        onChange={e => onUpdate(order.id, { portalMessage: e.target.value })} />

      {/* Physical touchpoints checklist */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 6 }}>Physical touchpoints</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TOUCHPOINTS.map(tp => {
            const done = !!(order.touchpoints || {})[tp.key]
            return (
              <button key={tp.key}
                onClick={() => onUpdate(order.id, { touchpoints: { ...(order.touchpoints || {}), [tp.key]: !done } })}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontFamily: 'Georgia,serif',
                  background: done ? '#f0fdf4' : '#fff',
                  border: `0.5px solid ${done ? '#86efac' : '#ddd'}`,
                  color: done ? '#166534' : '#888',
                  textDecoration: done ? 'none' : 'none' }}>
                {done ? '✓ ' : ''}{tp.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Token / portal link */}
      <div style={ps.row}>
        {token ? (
          <>
            <span style={ps.tokenBox} title={portalUrl}>{portalUrl}</span>
            <button style={ps.btn} onClick={handleCopy}>{copied ? '✓ Copied' : 'Copy link'}</button>
            <button style={ps.btn} onClick={handleGenerate} title="Generate new token (old link will stop working)">↺ Regenerate</button>
          </>
        ) : (
          <button style={ps.btnGreen} onClick={handleGenerate}>+ Generate portal link</button>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Everything below is the live version unchanged
// ─────────────────────────────────────────────────────────────────────────────

function getAccrualPerDay(rd) {
  const dpw = rd.daysPerWeek || 5;
  const proRatedDays = 28 * (dpw / 5);
  const workingDaysPerYear = 260 * dpw / 5;
  return (proRatedDays * rd.stdDay) / workingDaysPerYear;
}

async function apiLoadPlan() {
  const r = await fetch('/api/state', { headers: { 'x-athena-password': API_PASSWORD } });
  if (!r.ok) throw new Error('Plan load failed');
  return r.json();
}
async function apiSavePlanOverhead(mgmt, ws) {
  try {
    const current = await apiLoadPlan();
    const merged = { ...current, mgmtOverheadBudget: mgmt, wsOverheadBudget: ws };
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-athena-password': API_PASSWORD },
      body: JSON.stringify(merged),
    });
    return true;
  } catch {
    return false;
  }
}
async function apiLoadQueue() {
  const r = await fetch('/api/queue-state', { headers: { 'x-athena-password': API_PASSWORD } });
  if (!r.ok) return {};
  return r.json();
}
async function apiSaveQueue(data) {
  await fetch('/api/queue-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-athena-password': API_PASSWORD },
    body: JSON.stringify(data),
  });
}

function Dot({ c, s = 9 }) {
  return <span style={{ width: s, height: s, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />;
}

function calcOrderMins(order, useRemaining = false) {
  if (!order.qtys) return (order.estimatedHours || 0) * 60;
  const prodTasks = genClientTasks({
    ...order,
    id: 'tmp',
    bespoke: [],
    unitType: order.unitType || 'painted',
  });
  const prodMins = prodTasks.reduce((a, t) => a + (parseInt(t.m) || 0), 0);
  const bespokeMins = (order.bespoke || []).reduce((a, b) => {
    const m = parseInt(b.mins) || 0;
    return b.desc && m > 0 ? a + m : a;
  }, 0);
  const totalMins = prodMins + bespokeMins;
  if (useRemaining) {
    const pct = Math.min(100, Math.max(0, parseFloat(order.pctDone) || 0));
    return totalMins * (1 - pct / 100);
  }
  return totalMins;
}

function QueueLogin({ onAuth }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const check = () => {
    if (pw === QUEUE_PASSWORD) onAuth();
    else { setErr(true); setPw(''); }
  };
  return (
    <div style={{ fontFamily: 'Georgia,serif', minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontSize: 22, letterSpacing: '0.06em', marginBottom: 4 }}>ATHENA</div>
        <div style={{ fontSize: 10, color: '#aaa', fontStyle: 'italic', marginBottom: 6 }}>Lead Time Queue</div>
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 24 }}>Sales team access</div>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === 'Enter' && check()} placeholder="Password" autoFocus
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${err ? '#dc2626' : '#ccc'}`, borderRadius: 6, fontFamily: 'Georgia,serif', fontSize: 16, marginBottom: 8, outline: 'none' }} />
        {err && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>Incorrect password</div>}
        <button onClick={check} style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'Georgia,serif', fontSize: 14, cursor: 'pointer' }}>Enter</button>
      </div>
    </div>
  );
}

const AddOrderForm = memo(function AddOrderForm({ stream, color, onAdd, onCancel, complexThreshold }) {
  const [name, setName] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [unitType, setUnitType] = useState('painted');
  const [qtys, setQtys] = useState(Object.fromEntries(QTYS.map(([q]) => [q, 0])));
  const [bespoke, setBespoke] = useState([]);

  const order = { name, unitType, qtys, bespoke };
  const mins = calcOrderMins(order);
  const hrs = mins / 60;
  const threshold = parseFloat(complexThreshold) || 30;
  const isOverThreshold = hrs >= threshold;
  const wrongStream = (stream === 'simple' && isOverThreshold) || (stream === 'complex' && hrs > 0 && hrs < threshold);

  const inp = { width: '100%', padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16, background: '#fff' };
  const lbl = { fontSize: 11, color: '#888', display: 'block', marginBottom: 3 };

  return (
    <div style={{ background: '#fafaf8', border: `0.5px solid ${color}44`, borderRadius: 6, padding: '0.85rem 1rem', marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 'bold', color, marginBottom: 10 }}>New {stream} order</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={lbl}>Client name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Client name" />
        </div>
        <div>
          <label style={lbl}>Order date</label>
          <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>Unit type</label>
          <select value={unitType} onChange={e => setUnitType(e.target.value)} style={{ ...inp, fontSize: 14 }}>
            {UNIT_TYPES.map(ut => <option key={ut.key} value={ut.key}>{ut.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 6, marginBottom: 10 }}>
        {QTYS.map(([q, l]) => (
          <div key={q}>
            <label style={lbl}>{l}</label>
            <input type="number" value={qtys[q] || 0} min="0" style={{ ...inp, fontSize: 14 }}
              onChange={e => setQtys(p => ({ ...p, [q]: parseInt(e.target.value) || 0 }))} />
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 10px', borderRadius: 4, marginBottom: 10, background: wrongStream ? '#fef2f2' : isOverThreshold ? '#fdf4ff' : '#f0fdf4', border: `0.5px solid ${wrongStream ? '#fca5a5' : isOverThreshold ? '#e9d5ff' : '#bbf7d0'}` }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: wrongStream ? '#b91c1c' : isOverThreshold ? '#7F77DD' : '#166534' }}>
          {hrs > 0 ? `${hrs.toFixed(1)} hours` : 'Enter quantities above'}
          {hrs >= threshold && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 'normal' }}>— complex build ({threshold}h+ threshold)</span>}
          {hrs > 0 && hrs < threshold && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 'normal' }}>— simple build (under {threshold}h threshold)</span>}
        </div>
        {wrongStream && stream === 'simple' && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3 }}>⚠ This order is over {threshold}h — consider adding to the Complex queue instead.</div>}
        {wrongStream && stream === 'complex' && <div style={{ fontSize: 11, color: '#92400e', marginTop: 3 }}>⚠ This order is under {threshold}h — consider adding to the Simple queue instead.</div>}
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Bespoke <span style={{ color: '#bbb' }}>— add any non-standard tasks with their time</span></div>
        {bespoke.map((b, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 65px auto', gap: 6, marginBottom: 5, alignItems: 'center' }}>
            <input placeholder="e.g. Prime shaker doors" value={b.desc || ''} style={inp}
              onChange={e => setBespoke(p => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
            <input type="number" value={b.mins || 60} style={{ ...inp, fontSize: 14 }}
              onChange={e => setBespoke(p => p.map((x, j) => j === i ? { ...x, mins: parseInt(e.target.value) || 0 } : x))} />
            <button onClick={() => setBespoke(p => p.filter((_, j) => j !== i))}
              style={{ padding: '4px 8px', border: '0.5px solid #fca5a5', borderRadius: 4, background: '#fff', color: '#b91c1c', cursor: 'pointer', fontFamily: 'Georgia,serif', fontSize: 12 }}>×</button>
          </div>
        ))}
        <button onClick={() => setBespoke(p => [...p, { desc: '', mins: 60 }])}
          style={{ padding: '4px 12px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 12, cursor: 'pointer' }}>
          + Add bespoke
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onAdd({ name, orderDate, unitType, qtys: { ...qtys }, bespoke: bespoke.filter(b => b.desc && parseInt(b.mins) > 0).map(b => ({ ...b, mins: parseInt(b.mins) || 0 })) })}
          style={{ padding: '10px 22px', border: 'none', borderRadius: 4, background: '#1a1a1a', color: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' }}>
          Add to queue
        </button>
        <button onClick={onCancel}
          style={{ padding: '8px 16px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
});

const OrderCard = memo(function OrderCard({ order, stream, idx, projectedMonth, spansMonth, usedFrac, color, onMoveUp, onMoveDown, onComplete, onRemove, onUpdate }) {
  const [showPortal, setShowPortal] = useState(false)
  const mins = calcOrderMins(order);
  const bumpBtn = { padding: '3px 8px', border: '0.5px solid #ddd', borderRadius: 3, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 11, cursor: 'pointer', color: '#555' };
  const btn = { padding: '8px 16px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' };

  // Touchpoint completion indicator
  const tp = order.touchpoints || {}
  const tpDone = TOUCHPOINTS.filter(t => tp[t.key]).length
  const tpTotal = TOUCHPOINTS.length

  return (
    <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={onMoveUp} style={bumpBtn}>▲</button>
          <button onClick={onMoveDown} style={bumpBtn}>▼</button>
        </div>
        <span style={{ fontSize: 12, color: '#aaa', minWidth: 22, textAlign: 'center' }}>#{idx + 1}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 'bold', minWidth: 120 }}>{order.name || 'Unnamed'}</span>
        <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{UNIT_TYPES.find(u => u.key === (order.unitType || 'painted'))?.label || 'Painted'}</span>
        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#f5f4f0', color: '#555', border: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>
          {order.pctDone > 0
            ? `${(calcOrderMins(order, true) / 60).toFixed(1)}h left of ${(mins / 60).toFixed(1)}h`
            : `${(mins / 60).toFixed(1)}h`}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 100 }}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color, whiteSpace: 'nowrap' }}>{projectedMonth || '—'}</span>
          <span style={{ fontSize: 10, color: '#aaa' }}>est. completion{spansMonth ? ' · spans months' : ''}</span>
        </div>
        <button onClick={() => setShowPortal(p => !p)}
          style={{ ...btn, padding: '4px 10px', fontSize: 11,
            background: order.portalToken ? '#f0fdf4' : '#f5f4f0',
            color: order.portalToken ? '#166534' : '#888',
            borderColor: order.portalToken ? '#bbf7d0' : '#ddd' }}>
          {order.portalToken ? '🔗 Portal' : 'Portal'}
          {order.portalToken && tpDone < tpTotal && <span style={{ marginLeft: 4, fontSize: 9, color: '#d97706' }}>{tpDone}/{tpTotal}</span>}
        </button>
        <button onClick={onComplete}
          style={{ ...btn, padding: '4px 12px', fontSize: 11, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
          ✓ Complete
        </button>
        <button onClick={onRemove}
          style={{ ...btn, padding: '4px 8px', fontSize: 11, color: '#b91c1c', borderColor: '#fca5a5' }}>×</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 4, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap' }}>Order date:</label>
        <input type="date" value={order.orderDate || ''}
          onChange={e => onUpdate && onUpdate(order.id, { orderDate: e.target.value })}
          style={{ fontSize: 12, padding: '2px 6px', border: '0.5px solid #ddd', borderRadius: 4, fontFamily: 'Georgia,serif', color: '#555', background: '#fafaf8' }} />
        <label style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', marginLeft: 8 }}>% done:</label>
        <input type="number" value={order.pctDone || 0} min="0" max="100" step="5"
          onChange={e => onUpdate && onUpdate(order.id, { pctDone: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })}
          style={{ width: 58, fontSize: 12, padding: '2px 6px', border: '0.5px solid #ddd', borderRadius: 4, fontFamily: 'Georgia,serif', color: '#555', background: '#fafaf8' }} />
        <span style={{ fontSize: 11, color: '#aaa' }}>%</span>
        {(order.pctDone > 0) && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4,
          background: order.pctDone >= 100 ? '#f0fdf4' : '#f5f4f0',
          color: order.pctDone >= 100 ? '#166534' : '#555',
          border: '0.5px solid ' + (order.pctDone >= 100 ? '#bbf7d0' : '#e5e7eb'),
          whiteSpace: 'nowrap' }}>
          {order.pctDone >= 100 ? '✓ Complete' : `${(calcOrderMins(order) * (1 - order.pctDone/100) / 60).toFixed(1)}h remaining`}
        </span>}
        {order.orderDate && projectedMonth && (() => {
          const ordered = new Date(order.orderDate);
          const elapsed = Math.round((new Date() - ordered) / (1000 * 60 * 60 * 24));
          const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const parts = projectedMonth.split(' ');
          const mIdx = monthNames.indexOf(parts[0]);
          const yr = parseInt(parts[1]);
          let totalWeeks = null;
          if (!isNaN(mIdx) && !isNaN(yr)) {
            const frac = usedFrac || 0.5;
            const daysInMonth = new Date(yr, mIdx + 1, 0).getDate();
            const completionDay = Math.max(1, Math.round(frac * daysInMonth));
            const completionDate = new Date(yr, mIdx, completionDay);
            totalWeeks = Math.round((completionDate - ordered) / (1000 * 60 * 60 * 24 * 7));
          }
          return (
            <span style={{ fontSize: 11, color: elapsed > 60 ? '#b91c1c' : '#aaa', fontWeight: elapsed > 60 ? 'bold' : 'normal' }}>
              {elapsed} day{elapsed !== 1 ? 's' : ''} waiting
              {totalWeeks !== null && <> · <strong style={{ color: '#555' }}>{totalWeeks}w total</strong> order to completion</>}
              {elapsed > 60 ? ' ⚠' : ''}
            </span>
          );
        })()}
        {order.orderDate && !projectedMonth && (() => {
          const ordered = new Date(order.orderDate);
          const elapsed = Math.round((new Date() - ordered) / (1000 * 60 * 60 * 24));
          return (
            <span style={{ fontSize: 11, color: elapsed > 60 ? '#b91c1c' : '#aaa', fontWeight: elapsed > 60 ? 'bold' : 'normal' }}>
              {elapsed} day{elapsed !== 1 ? 's' : ''} waiting{elapsed > 60 ? ' ⚠' : ''}
            </span>
          );
        })()}
      </div>

      {showPortal && (
        <PortalPanel order={order} onUpdate={onUpdate} projectedMonth={projectedMonth} usedFrac={usedFrac} />
      )}
    </div>
  );
});

function StreamSection({ title, color, stream, orders, scheduled, lead, addingTo, setAddingTo, onAdd, onMoveUp, onMoveDown, onComplete, onRemove, onUpdate, complexThreshold }) {
  const totalMins = orders.reduce((a, o) => a + calcOrderMins(o), 0);
  const btn = { padding: '8px 16px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' };

  return (
    <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, marginBottom: '1rem', borderTop: `3px solid ${color}`, overflow: 'hidden' }}>
      <div style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Dot c={color} s={10} />
            <span style={{ fontSize: 15, fontWeight: 'bold' }}>{title}</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{orders.length} order{orders.length !== 1 ? 's' : ''} · {(totalMins / 60).toFixed(1)}h</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lead !== null && lead !== undefined && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 'bold', color }}>{lead}w</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>current lead time</div>
              </div>
            )}
            <button onClick={() => setAddingTo(addingTo === stream ? null : stream)}
              style={{ ...btn, padding: '6px 14px', fontSize: 12, background: color + '18', borderColor: color + '44', color }}>
              + Add order
            </button>
          </div>
        </div>
      </div>
      <div style={{ padding: '0.75rem 1rem' }}>
        {orders.length === 0 && <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic', padding: '0.5rem 0' }}>No orders in this stream.</div>}
        {orders.map((o, idx) => {
          const sc = scheduled.find(s => s.id === o.id);
          return (
            <OrderCard key={o.id} order={o} stream={stream} idx={idx}
              projectedMonth={sc?.projectedMonth} spansMonth={sc?.spansMonth} usedFrac={sc?.usedFrac}
              color={color}
              onMoveUp={() => onMoveUp(stream, idx)}
              onMoveDown={() => onMoveDown(stream, idx)}
              onComplete={() => onComplete(stream, o.id)}
              onRemove={() => onRemove(stream, o.id)}
              onUpdate={(id, updates) => onUpdate(stream, id, updates)} />
          );
        })}
        {addingTo === stream && (
          <AddOrderForm stream={stream} color={color} complexThreshold={complexThreshold}
            onAdd={order => onAdd(stream, order)}
            onCancel={() => setAddingTo(null)} />
        )}
      </div>
    </div>
  );
}

export default function Queue({ activeKeys: propActiveKeys, workingDays: propWorkingDays, mgmtOverheadBudget: propMgmt, wsOverheadBudget: propWs }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('queueAuthed') === '1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const saveTimer = useRef(null);
  const initialLoadDone = useRef(false);
  const ensureMonthsRan = useRef(false);

  const [simpleOrders, setSimpleOrders] = useState([]);
  const [complexOrders, setComplexOrders] = useState([]);
  const [financeOrders, setFinanceOrders] = useState([]);
  const [qCount, setQCount] = useState(0);
  const [calendarMonths, setCalendarMonths] = useState([]);
  const [overtimePool, setOvertimePool] = useState(0);
  const [complexThreshold, setComplexThreshold] = useState(30);
  const [addingTo, setAddingTo] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(false);

  const [queueTeam, setQueueTeam] = useState([
    { id: 'qt_manager',   name: 'Manager',       stdDay: 7.5, daysPerWeek: 5, stream: 'complex' },
    { id: 'qt_maker1',    name: 'Cabinet maker',  stdDay: 7,   daysPerWeek: 5, stream: 'simple'  },
    { id: 'qt_assistant', name: 'Assistant',      stdDay: 7,   daysPerWeek: 5, stream: 'simple'  },
  ]);
  const [mgmtOverhead, setMgmtOverhead] = useState(20);
  const [wsOverhead, setWsOverhead] = useState(28);
  const [showOverheadReset, setShowOverheadReset] = useState(false);
  const [mgmtOverheadInput, setMgmtOverheadInput] = useState('');
  const [wsOverheadInput, setWsOverheadInput] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    if (!authed) return;
    apiLoadQueue().then(queue => {
      if (queue.simpleOrders) setSimpleOrders(queue.simpleOrders);
      if (queue.complexOrders) setComplexOrders(queue.complexOrders);
      if (queue.financeOrders) setFinanceOrders(queue.financeOrders);
      if (queue.qCount) setQCount(queue.qCount);
      if (queue.calendarMonths) setCalendarMonths(queue.calendarMonths);
      if (queue.overtimePool !== undefined) setOvertimePool(queue.overtimePool);
      if (queue.complexThreshold !== undefined) setComplexThreshold(queue.complexThreshold);
      if (queue.queueTeam && queue.queueTeam.length) setQueueTeam(queue.queueTeam);
      if (queue.mgmtOverhead !== undefined) setMgmtOverhead(queue.mgmtOverhead);
      if (queue.wsOverhead !== undefined) setWsOverhead(queue.wsOverhead);
      initialLoadDone.current = true;
      setLoading(false);
    }).catch(() => { initialLoadDone.current = true; setLoading(false); });
  }, [authed]);

  const triggerSave = useRef(null);
  triggerSave.current = async () => {
    clearTimeout(saveTimer.current);
    setSaveMsg('Saving…');
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await apiSaveQueue({ simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexThreshold, queueTeam, mgmtOverhead, wsOverhead });
      setSaving(false);
      setSaveMsg('✓ Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }, 1500);
  };

  useEffect(() => {
    if (!authed || loading || !initialLoadDone.current) return;
    if (ensureMonthsRan.current) { ensureMonthsRan.current = false; return; }
    triggerSave.current();
  }, [simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexThreshold, queueTeam, mgmtOverhead, wsOverhead]);

  const calendarInitialised = useRef(false);
  useEffect(() => {
    if (!authed || loading) return;
    if (!calendarInitialised.current) {
      calendarInitialised.current = true;
      ensureMonths(18);
    }
  }, [authed, loading, calendarMonths.length]);

  function generateMonthLabel(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function ensureMonths(n = 18) {
    ensureMonthsRan.current = true;
    setCalendarMonths(p => {
      const merged = [...p];
      for (let i = 0; i < n; i++) {
        const label = generateMonthLabel(i);
        if (!merged.find(x => x.label === label)) {
          merged.push({ label, workingDays: 21, workingWeeks: 4.2 });
        }
      }
      return merged;
    });
  }

  function sortedMonths() {
    return [...calendarMonths].sort((a, b) => {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const [aM, aY] = [months.indexOf(a.label.split(' ')[0]), parseInt(a.label.split(' ')[1])];
      const [bM, bY] = [months.indexOf(b.label.split(' ')[0]), parseInt(b.label.split(' ')[1])];
      return aY !== bY ? aY - bY : aM - bM;
    });
  }

  function getMonthStreamMins(stream, month) {
    const wd = month.workingDays !== undefined ? parseInt(month.workingDays) : 21;
    if (wd === 0) return 0;
    let totalMins = 0;
    const teamInStream = queueTeam.filter(m => m.stream === stream);
    for (const m of teamInStream) {
      const dpw = parseFloat(m.daysPerWeek) || 5;
      const stdDay = parseFloat(m.stdDay) || 7;
      const daysWorked = wd * dpw / 5;
      const gross = stdDay * daysWorked;
      const holiday = gross * 0.1077;
      totalMins += Math.max(0, gross - holiday) * 60;
    }
    const dayFrac = wd / 21;
    if (stream === 'simple') totalMins -= (parseFloat(wsOverhead) || 0) * 60 * dayFrac;
    else totalMins -= (parseFloat(mgmtOverhead) || 0) * 60 * dayFrac;
    return Math.max(0, totalMins);
  }

  function calcStream(orders, getCapFn) {
    const months = sortedMonths();
    if (!months.length) return orders.map(o => ({ ...o, projectedMonth: 'No calendar set' }));
    const result = [];
    const queue = [...orders];
    let monthIdx = 0;
    let usedMins = 0;
    for (const order of queue) {
      const orderMins = calcOrderMins(order, true);
      let allocated = false;
      while (monthIdx < months.length) {
        const cap = getCapFn(months[monthIdx]);
        const available = cap - usedMins;
        if (available >= orderMins) {
          usedMins += orderMins;
          const usedFrac = cap > 0 ? usedMins / cap : 1;
          result.push({ ...order, projectedMonth: months[monthIdx].label, usedFrac });
          allocated = true;
          break;
        } else {
          monthIdx++;
          usedMins = 0;
        }
      }
      if (!allocated) result.push({ ...order, projectedMonth: 'Beyond calendar' });
    }
    return result;
  }

  function calcLeadTimeWeeks(scheduled) {
    if (!scheduled.length) return null;
    const last = scheduled[scheduled.length - 1];
    if (!last.projectedMonth || last.projectedMonth === 'No calendar set' || last.projectedMonth === 'Beyond calendar') return null;
    const months = sortedMonths();
    let totalWeeks = 0;
    let counting = false;
    for (const m of months) {
      const wd = m.workingDays !== undefined ? parseInt(m.workingDays) : 21;
      if (!counting && wd > 0) counting = true;
      if (!counting) continue;
      const mw = m.workingWeeks !== undefined ? parseFloat(m.workingWeeks) : (wd / 5);
      if (m.label === last.projectedMonth) {
        totalWeeks += mw * (last.usedFrac || 0.5);
        break;
      }
      totalWeeks += mw;
    }
    return Math.max(0, Math.round(totalWeeks));
  }

  const scheduledSimple = calcStream(simpleOrders, m => getMonthStreamMins('simple', m));
  const scheduledComplex = calcStream(complexOrders, m => getMonthStreamMins('complex', m));
  const simpleLead = calcLeadTimeWeeks(scheduledSimple);
  const complexLead = calcLeadTimeWeeks(scheduledComplex);
  const financeTotal = financeOrders.reduce((a, o) => a + calcOrderMins(o), 0);
  const overtimeMins = (parseFloat(overtimePool) || 0) * 60;

  function addOrder(stream, order) {
    const id = `q${qCount}`;
    const full = { ...order, id };
    if (stream === 'simple') setSimpleOrders(p => [...p, full]);
    else if (stream === 'complex') setComplexOrders(p => [...p, full]);
    else setFinanceOrders(p => [...p, full]);
    setQCount(p => p + 1);
    setAddingTo(null);
  }

  function updateOrder(stream, id, updates) {
    if (stream === 'simple') setSimpleOrders(p => p.map(o => o.id === id ? { ...o, ...updates } : o));
    else if (stream === 'complex') setComplexOrders(p => p.map(o => o.id === id ? { ...o, ...updates } : o));
    else if (stream === 'finance') setFinanceOrders(p => p.map(o => o.id === id ? { ...o, ...updates } : o));
  }

  function removeOrder(stream, id) {
    if (stream === 'simple') setSimpleOrders(p => p.filter(o => o.id !== id));
    else if (stream === 'complex') setComplexOrders(p => p.filter(o => o.id !== id));
    else setFinanceOrders(p => p.filter(o => o.id !== id));
  }

  function moveUp(stream, idx) {
    const setter = stream === 'simple' ? setSimpleOrders : stream === 'complex' ? setComplexOrders : setFinanceOrders;
    setter(p => { if (idx === 0) return p; const n = [...p]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; });
  }

  function moveDown(stream, idx) {
    const setter = stream === 'simple' ? setSimpleOrders : stream === 'complex' ? setComplexOrders : setFinanceOrders;
    setter(p => { if (idx === p.length - 1) return p; const n = [...p]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n; });
  }

  function exportBackup() {
    const data = { simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexThreshold, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athena-queue-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.simpleOrders) setSimpleOrders(data.simpleOrders);
        if (data.complexOrders) setComplexOrders(data.complexOrders);
        if (data.financeOrders) setFinanceOrders(data.financeOrders);
        if (data.qCount) setQCount(data.qCount);
        if (data.calendarMonths) setCalendarMonths(data.calendarMonths);
        if (data.overtimePool !== undefined) setOvertimePool(data.overtimePool);
        if (data.complexThreshold !== undefined) setComplexThreshold(data.complexThreshold);
        alert('Queue restored successfully from backup.');
      } catch { alert('Could not read backup file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const C = { fontFamily: 'Georgia,serif', fontSize: 13, background: '#f5f4f0', minHeight: '100vh', color: '#1a1a1a' };
  const card = { background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem' };
  const H = { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 8 };
  const inp = { width: '100%', padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16, background: '#fff' };
  const btn = { padding: '8px 16px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' };
  const lbl = { fontSize: 11, color: '#888', display: 'block', marginBottom: 3 };

  if (!authed) return <QueueLogin onAuth={() => { sessionStorage.setItem('queueAuthed', '1'); setAuthed(true); }} />;
  if (loading) return <div style={{ fontFamily: 'Georgia,serif', textAlign: 'center', padding: '3rem', color: '#aaa' }}>Loading queue…</div>;

  return (
    <div style={C}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

        <div style={{ textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 20, fontWeight: 'normal', letterSpacing: '0.06em' }}>ATHENA</div>
          <div style={{ fontSize: 9, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Lead Time Queue</div>
          <div style={{ fontSize: 11, color: saving ? '#888' : saveMsg.startsWith('✓') ? '#166634' : '#bbb', marginTop: 6 }}>
            {saveMsg || 'Auto-saves to cloud'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <button onClick={exportBackup}
              style={{ padding: '5px 14px', border: '0.5px solid #1D9E75', borderRadius: 4, background: '#f0fdf4', color: '#166534', fontFamily: 'Georgia,serif', fontSize: 11, cursor: 'pointer' }}>
              ↓ Export backup
            </button>
            <label style={{ padding: '5px 14px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', color: '#555', fontFamily: 'Georgia,serif', fontSize: 11, cursor: 'pointer' }}>
              ↑ Restore backup
              <input type="file" accept=".json" onChange={importBackup} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' }}>
          {[
            ['Simple', (simpleLead !== null && !isNaN(simpleLead)) ? `${simpleLead}w` : '—', '#1D9E75', `${simpleOrders.length} order${simpleOrders.length !== 1 ? 's' : ''}`],
            ['Complex', (complexLead !== null && !isNaN(complexLead)) ? `${complexLead}w` : '—', '#7F77DD', `${complexOrders.length} order${complexOrders.length !== 1 ? 's' : ''}`],
            ['Finance', financeOrders.length ? `${financeOrders.length}` : '—', '#BA7517', `${(financeTotal / 60).toFixed(1)}h`],
          ].map(([l, v, c, sub]) => (
            <div key={l} style={{ background: '#fff', border: `0.5px solid ${c}44`, borderRadius: 8, padding: '0.75rem', borderTop: `3px solid ${c}`, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: c, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={H}>Queue team</div>
            <button onClick={() => setQueueTeam(p => [...p, { id: `qt_${Date.now()}`, name: 'New member', stdDay: 7, daysPerWeek: 5, stream: 'simple' }])}
              style={{ ...btn, padding: '4px 12px', fontSize: 12 }}>+ Add</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 8 }}>
            {queueTeam.map((m, i) => {
              const streamColors = { simple: '#1D9E75', complex: '#7F77DD', overhead: '#BA7517' };
              const sc = streamColors[m.stream] || '#888';
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: `0.5px solid ${sc}33`, borderRadius: 6, background: '#fafaf8', flexWrap: 'wrap' }}>
                  <Dot c={sc} s={8} />
                  <input value={m.name} onChange={e => setQueueTeam(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    style={{ fontSize: 13, border: 'none', background: 'transparent', width: 110, fontFamily: 'Georgia,serif', outline: 'none', fontWeight: 'bold' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <label style={{ fontSize: 10, color: '#aaa' }}>h/d</label>
                    <input type="number" value={m.stdDay} min="0.5" max="12" step="0.5"
                      onChange={e => setQueueTeam(p => p.map((x, j) => j === i ? { ...x, stdDay: parseFloat(e.target.value) || 7 } : x))}
                      style={{ width: 44, padding: '3px 4px', border: '0.5px solid #ccc', borderRadius: 3, fontFamily: 'Georgia,serif', fontSize: 14 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <label style={{ fontSize: 10, color: '#aaa' }}>d/wk</label>
                    <input type="number" value={m.daysPerWeek} min="0.5" max="7" step="0.5"
                      onChange={e => setQueueTeam(p => p.map((x, j) => j === i ? { ...x, daysPerWeek: parseFloat(e.target.value) || 5 } : x))}
                      style={{ width: 40, padding: '3px 4px', border: '0.5px solid #ccc', borderRadius: 3, fontFamily: 'Georgia,serif', fontSize: 14 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {['simple', 'complex', 'overhead'].map(s => (
                      <button key={s} onClick={() => setQueueTeam(p => p.map((x, j) => j === i ? { ...x, stream: s } : x))}
                        style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, border: `1px solid ${m.stream === s ? streamColors[s] : streamColors[s] + '33'}`, background: m.stream === s ? streamColors[s] : 'transparent', color: m.stream === s ? '#fff' : streamColors[s] + '99', cursor: 'pointer', fontFamily: 'Georgia,serif' }}>
                        {s === 'overhead' ? 'Pool' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setQueueTeam(p => p.filter((_, j) => j !== i))}
                    style={{ ...btn, padding: '2px 6px', fontSize: 11, color: '#b91c1c', borderColor: '#fca5a5', marginLeft: 'auto' }}>×</button>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>
            Holiday estimated by statutory accrual · Simple: <strong style={{ color: '#1D9E75' }}>{queueTeam.filter(m => m.stream === 'simple').map(m => m.name).join(', ') || '—'}</strong>
            &nbsp;· Complex: <strong style={{ color: '#7F77DD' }}>{queueTeam.filter(m => m.stream === 'complex').map(m => m.name).join(', ') || '—'}</strong>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={H}>Working calendar</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setExpandedMonths(p => !p)} style={{ ...btn, padding: '4px 12px', fontSize: 12 }}>
                {expandedMonths ? 'Collapse' : 'Edit months'}
              </button>
              <button onClick={() => ensureMonths(calendarMonths.length + 6)} style={{ ...btn, padding: '4px 12px', fontSize: 12 }}>+ 6 months</button>
            </div>
          </div>
          {!expandedMonths ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {sortedMonths().map(m => {
                const cap = getMonthStreamMins('simple', m) + getMonthStreamMins('complex', m);
                const ww = m.workingWeeks !== undefined ? parseFloat(m.workingWeeks) : (m.workingDays !== undefined ? parseInt(m.workingDays) / 5 : 4.2);
                return (
                  <div key={m.label} style={{ background: '#f5f4f0', borderRadius: 4, padding: '5px 10px', fontSize: 11, textAlign: 'center', minWidth: 80 }}>
                    <div style={{ color: '#555', whiteSpace: 'nowrap', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{(cap / 60).toFixed(0)}h</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>{ww.toFixed(1)}w</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
              {sortedMonths().map(m => {
                const cap = getMonthStreamMins('simple', m) + getMonthStreamMins('complex', m);
                return (
                  <div key={m.label} style={{ background: '#fafaf8', border: '0.5px solid #eee', borderRadius: 6, padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 'bold' }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 'bold' }}>{(cap / 60).toFixed(1)}h prod</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <label style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>Working days:</label>
                      <input type="number" value={m.workingDays !== undefined ? m.workingDays : 21} min="0" max="31" step="1"
                        style={{ width: 52, padding: '3px 6px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                        onChange={e => setCalendarMonths(p => p.map(x => x.label === m.label ? { ...x, workingDays: parseInt(e.target.value) || 0 } : x))} />
                      <label style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', marginLeft: 4 }}>Working weeks:</label>
                      <input type="number" value={m.workingWeeks !== undefined ? m.workingWeeks : 4.2} min="0" max="6" step="0.1"
                        style={{ width: 52, padding: '3px 6px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                        onChange={e => setCalendarMonths(p => p.map(x => x.label === m.label ? { ...x, workingWeeks: parseFloat(e.target.value) || 0 } : x))} />
                      <button onClick={() => setCalendarMonths(p => p.map(x => {
                        if (x.label !== m.label) return x;
                        const newDays = Math.max(0, (parseInt(x.workingDays) || 0) - 1);
                        const newWw = Math.max(0, Math.round(((x.workingWeeks !== undefined ? parseFloat(x.workingWeeks) : 4.2) - 0.2) * 10) / 10);
                        return { ...x, workingDays: newDays, workingWeeks: newWw };
                      }))} style={{ padding: '4px 10px', border: '0.5px solid #ddd', borderRadius: 4, background: '#f5f4f0', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer', color: '#555' }}>
                        − 1 day
                      </button>
                    </div>
                    {(() => {
                      const wd2 = m.workingDays !== undefined ? parseInt(m.workingDays) : 21;
                      let totalAccrual = 0;
                      queueTeam.forEach(tm => {
                        const dpw = parseFloat(tm.daysPerWeek) || 5;
                        const stdDay = parseFloat(tm.stdDay) || 7;
                        const daysWorked = wd2 * dpw / 5;
                        const gross = stdDay * daysWorked;
                        totalAccrual += gross * 0.1077;
                      });
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#f5f4f0', borderRadius: 4 }}>
                          <span style={{ fontSize: 10, color: '#bbb' }}>Holiday accrual (auto-calculated):</span>
                          <span style={{ fontSize: 12, color: '#aaa', fontWeight: 'bold' }}>{totalAccrual.toFixed(1)}h</span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888' }}>Queue settings</div>
            <button onClick={() => { setMgmtOverheadInput(''); setWsOverheadInput(''); setShowOverheadReset(true); setSyncMsg(''); }}
              style={{ ...btn, padding: '4px 12px', fontSize: 11, color: '#92400e', borderColor: '#fcd34d', background: '#fffbeb' }}>
              ↻ Reset for new month
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>Simple and complex streams run independently. Overhead is deducted proportionally from each stream's capacity.</div>

          {showOverheadReset && (
            <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 6, padding: '0.75rem', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#92400e', marginBottom: 8, fontWeight: 'bold' }}>Re-enter overhead hours for this month</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Management (hrs)</label>
                  <input type="number" value={mgmtOverheadInput} min="0" step="0.5"
                    style={{ width: 90, padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                    onChange={e => setMgmtOverheadInput(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Workshop (hrs)</label>
                  <input type="number" value={wsOverheadInput} min="0" step="0.5"
                    style={{ width: 90, padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                    onChange={e => setWsOverheadInput(e.target.value)} />
                </div>
                <button onClick={async () => {
                  const m = parseFloat(mgmtOverheadInput) || 0;
                  const w = parseFloat(wsOverheadInput) || 0;
                  setMgmtOverhead(m);
                  setWsOverhead(w);
                  setShowOverheadReset(false);
                  setSyncMsg('Syncing to Plan…');
                  const ok = await apiSavePlanOverhead(m, w);
                  setSyncMsg(ok ? '✓ Synced to Plan' : '⚠ Could not sync to Plan — update manually');
                  setTimeout(() => setSyncMsg(''), 4000);
                }} style={{ ...btn, padding: '7px 16px', fontSize: 12, background: '#1a1a1a', color: '#fff', border: 'none' }}>
                  Apply &amp; sync to Plan
                </button>
                <button onClick={() => setShowOverheadReset(false)} style={{ ...btn, padding: '7px 16px', fontSize: 12 }}>Cancel</button>
              </div>
              {syncMsg && <div style={{ fontSize: 11, color: syncMsg.startsWith('✓') ? '#166534' : syncMsg.startsWith('⚠') ? '#b91c1c' : '#888', marginTop: 6 }}>{syncMsg}</div>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Management overhead (hrs/month)</label>
              <input type="number" value={mgmtOverhead} min="0" step="0.5"
                style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                onChange={e => setMgmtOverhead(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Workshop overhead (hrs/month)</label>
              <input type="number" value={wsOverhead} min="0" step="0.5"
                style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                onChange={e => setWsOverhead(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Complexity threshold (hrs)</label>
              <input type="number" value={complexThreshold} min="5" max="200" step="1"
                style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                onChange={e => setComplexThreshold(Math.max(1, parseFloat(e.target.value) || 30))} />
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>Under {complexThreshold}h = simple · {complexThreshold}h+ = complex</div>
            </div>
          </div>
        </div>

        <StreamSection title="Simple builds" color="#1D9E75" stream="simple"
          orders={simpleOrders} scheduled={scheduledSimple} lead={simpleLead}
          addingTo={addingTo} setAddingTo={setAddingTo}
          onAdd={addOrder} onMoveUp={moveUp} onMoveDown={moveDown}
          onComplete={removeOrder} onRemove={removeOrder} onUpdate={updateOrder} complexThreshold={complexThreshold} />

        <StreamSection title="Complex builds" color="#7F77DD" stream="complex"
          orders={complexOrders} scheduled={scheduledComplex} lead={complexLead}
          addingTo={addingTo} setAddingTo={setAddingTo}
          onAdd={addOrder} onMoveUp={moveUp} onMoveDown={moveDown}
          onComplete={removeOrder} onRemove={removeOrder} onUpdate={updateOrder} complexThreshold={complexThreshold} />

        <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, marginBottom: '1rem', borderTop: '3px solid #BA7517', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Dot c="#BA7517" s={10} />
                <span style={{ fontSize: 15, fontWeight: 'bold' }}>Finance orders — overtime</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>{financeOrders.length} order{financeOrders.length !== 1 ? 's' : ''} · {(financeTotal / 60).toFixed(1)}h</span>
              </div>
              <button onClick={() => setAddingTo(addingTo === 'finance' ? null : 'finance')}
                style={{ ...btn, padding: '6px 14px', fontSize: 12, background: '#BA751718', borderColor: '#BA751744', color: '#BA7517' }}>
                + Add order
              </button>
            </div>
          </div>
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, color: '#888' }}>Monthly overtime pool (hrs):</label>
              <input type="number" value={overtimePool} min="0" step="0.5"
                style={{ width: 72, padding: '4px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                onChange={e => setOvertimePool(parseFloat(e.target.value) || 0)} />
              {overtimePool > 0 && financeOrders.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 'bold', color: overtimeMins >= financeTotal ? '#166534' : '#b91c1c' }}>
                  {(overtimeMins / 60).toFixed(1)}h available · {(financeTotal / 60).toFixed(1)}h needed
                  {overtimeMins >= financeTotal ? ' · ✓ covered' : ` · ${((financeTotal - overtimeMins) / 60).toFixed(1)}h short`}
                </span>
              )}
            </div>
            {financeOrders.length === 0 && <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No finance orders queued.</div>}
            {financeOrders.map((o, idx) => (
              <OrderCard key={o.id} order={o} stream="finance" idx={idx}
                projectedMonth={null} spansMonth={false} color="#BA7517"
                onMoveUp={() => moveUp('finance', idx)}
                onMoveDown={() => moveDown('finance', idx)}
                onComplete={() => removeOrder('finance', o.id)}
                onRemove={() => removeOrder('finance', o.id)}
                onUpdate={(id, updates) => updateOrder('finance', id, updates)} />
            ))}
            {addingTo === 'finance' && (
              <AddOrderForm stream="finance" color="#BA7517"
                onAdd={order => addOrder('finance', order)}
                onCancel={() => setAddingTo(null)} complexThreshold={complexThreshold} />
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#ccc', fontSize: 10, marginTop: '2rem', paddingTop: '1rem', borderTop: '0.5px solid #eee', letterSpacing: '0.05em' }}>
          Discipline in the process. Excellence is Athena's reward.
        </div>
      </div>
    </div>
  );
}
