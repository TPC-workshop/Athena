import { useState, useEffect, useRef } from 'react';
import { ROLE_DEFS, QTYS, UNIT_TYPES, getQty, genClientTasks } from './data.js';

const QUEUE_PASSWORD = 'TPCLeadtime!';
const API_PASSWORD = 'Ath3na-W0rk5h0p!';

// Holiday accrual per working day per role (28 days statutory)
function getAccrualPerDay(rd) {
  const annualDays = 28;
  const workingDaysPerYear = 260 * (rd.daysPerWeek || 5) / 5;
  return (annualDays * rd.stdDay) / workingDaysPerYear;
}

async function apiLoad() {
  const r = await fetch('/api/state', { headers: { 'x-athena-password': API_PASSWORD } });
  if (!r.ok) throw new Error('Load failed');
  return r.json();
}
async function apiSave(data) {
  await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-athena-password': API_PASSWORD },
    body: JSON.stringify(data),
  });
}

function Dot({ c, s = 9 }) {
  return <span style={{ width: s, height: s, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />;
}

function QueueLogin({ onAuth }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const check = () => {
    if (pw === QUEUE_PASSWORD) { onAuth(); }
    else { setErr(true); setPw(''); }
  };
  return (
    <div style={{ fontFamily: 'Georgia,serif', minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontSize: 22, letterSpacing: '0.06em', marginBottom: 4 }}>ATHENA</div>
        <div style={{ fontSize: 10, color: '#aaa', fontStyle: 'italic', marginBottom: 6 }}>Lead Time Queue</div>
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 24 }}>Sales team access</div>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="Password" autoFocus
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${err ? '#dc2626' : '#ccc'}`, borderRadius: 6, fontFamily: 'Georgia,serif', fontSize: 16, marginBottom: 8, outline: 'none' }} />
        {err && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>Incorrect password</div>}
        <button onClick={check}
          style={{ width: '100%', padding: '10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, fontFamily: 'Georgia,serif', fontSize: 14, cursor: 'pointer' }}>
          Enter
        </button>
      </div>
    </div>
  );
}

// Calculate total production minutes for an order from its quantities
function calcOrderMins(order) {
  if (!order.qtys) return order.estimatedHours ? order.estimatedHours * 60 : 0;
  const tasks = genClientTasks({ ...order, id: 'tmp', bespoke: order.bespoke || [], unitType: order.unitType || 'painted' });
  return tasks.reduce((a, t) => a + (t.m || 0), 0);
}

export default function Queue({ activeKeys: propActiveKeys, workingDays: propWorkingDays, holiday: propHoliday, mgmtOverheadBudget: propMgmt, wsOverheadBudget: propWs }) {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const saveTimer = useRef(null);

  // Queue-specific state
  const [simpleOrders, setSimpleOrders] = useState([]);
  const [complexOrders, setComplexOrders] = useState([]);
  const [financeOrders, setFinanceOrders] = useState([]);
  const [qCount, setQCount] = useState(0);
  const [calendarMonths, setCalendarMonths] = useState([]);
  const [overtimePool, setOvertimePool] = useState(0);

  // Team state — loaded from shared Athena state
  const [activeKeys, setActiveKeys] = useState(propActiveKeys || ['manager', 'maker1', 'assistant']);
  const [workingDaysDefault, setWorkingDaysDefault] = useState(propWorkingDays || 21);
  const [mgmtOverhead, setMgmtOverhead] = useState(propMgmt || 20);
  const [wsOverhead, setWsOverhead] = useState(propWs || 28);

  // Add order UI state
  const [addingTo, setAddingTo] = useState(null); // 'simple'|'complex'|'finance'
  const [newOrder, setNewOrder] = useState({ name: '', unitType: 'painted', qtys: Object.fromEntries(QTYS.map(([q]) => [q, 0])), bespoke: [], isFinance: false });

  const [expandedMonths, setExpandedMonths] = useState(false);

  useEffect(() => {
    if (!authed) return;
    apiLoad().then(s => {
      if (s.activeKeys) setActiveKeys(s.activeKeys);
      if (s.workingDays) setWorkingDaysDefault(s.workingDays);
      if (s.mgmtOverheadBudget !== undefined) setMgmtOverhead(s.mgmtOverheadBudget);
      if (s.wsOverheadBudget !== undefined) setWsOverhead(s.wsOverheadBudget);
      if (s.simpleOrders) setSimpleOrders(s.simpleOrders);
      if (s.complexOrders) setComplexOrders(s.complexOrders);
      if (s.financeOrders) setFinanceOrders(s.financeOrders);
      if (s.qCount) setQCount(s.qCount);
      if (s.calendarMonths) setCalendarMonths(s.calendarMonths);
      if (s.overtimePool !== undefined) setOvertimePool(s.overtimePool);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authed]);

  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = prev => ({
      ...prev,
      simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool,
    });
  });

  const triggerSave = () => {
    clearTimeout(saveTimer.current);
    setSaveMsg('Saving…');
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      // Load current state, merge queue fields, save back
      const current = await apiLoad();
      await apiSave({
        ...current,
        simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool,
      });
      setSaving(false);
      setSaveMsg('✓ Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }, 1500);
  };

  useEffect(() => {
    if (!authed || loading) return;
    triggerSave();
  }, [simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool]);

  // ── Calendar helpers ──────────────────────────────────────────────────────

  function getMonthProductionMins(month) {
    // Available hours per active role, minus accrued holiday
    let totalMins = 0;
    for (const key of activeKeys) {
      const rd = ROLE_DEFS.find(r => r.key === key);
      if (!rd) continue;
      const dpw = rd.daysPerWeek || 5;
      const wd = month.workingDays || workingDaysDefault;
      const grossHrs = rd.stdDay * (wd * dpw / 5);
      const accrual = getAccrualPerDay(rd) * wd;
      // If month has a manual holiday override for this role, use that instead of accrual
      const holidayHrs = (month.holiday && month.holiday[key] !== undefined)
        ? parseFloat(month.holiday[key])
        : accrual;
      const netHrs = Math.max(0, grossHrs - holidayHrs);
      totalMins += netHrs * 60;
    }
    // Subtract overhead
    const overheadMins = ((parseFloat(mgmtOverhead) || 0) + (parseFloat(wsOverhead) || 0)) * 60;
    return Math.max(0, totalMins - overheadMins);
  }

  // Generate next N month labels from today
  function generateMonthLabel(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function ensureMonths(n = 18) {
    const needed = [];
    for (let i = 0; i < n; i++) {
      const label = generateMonthLabel(i);
      const existing = calendarMonths.find(m => m.label === label);
      if (!existing) {
        needed.push({ label, workingDays: 21, holiday: {} });
      }
    }
    if (needed.length > 0) {
      setCalendarMonths(p => {
        const merged = [...p];
        for (const m of needed) {
          if (!merged.find(x => x.label === m.label)) merged.push(m);
        }
        return merged;
      });
    }
  }

  useEffect(() => {
    if (authed && !loading) ensureMonths(18);
  }, [authed, loading]);

  // Sort calendar months chronologically
  function sortedMonths() {
    return [...calendarMonths].sort((a, b) => {
      const da = new Date(a.label);
      const db = new Date(b.label);
      return da - db;
    });
  }

  // ── Lead time calculation ─────────────────────────────────────────────────

  function calcStream(orders) {
    const months = sortedMonths();
    if (!months.length) return orders.map(o => ({ ...o, projectedMonth: 'No calendar set', weekOffset: 0 }));

    let remaining = [...orders];
    const result = [];
    let monthIdx = 0;
    let usedMins = 0;

    for (const order of remaining) {
      const orderMins = calcOrderMins(order);
      let allocated = false;

      while (monthIdx < months.length) {
        const cap = getMonthProductionMins(months[monthIdx]);
        const available = cap - usedMins;

        if (available >= orderMins) {
          usedMins += orderMins;
          result.push({ ...order, projectedMonth: months[monthIdx].label, minsUsed: orderMins });
          allocated = true;
          break;
        } else if (available > 0 && orderMins > cap * 0.8) {
          // Large order — spans into next month, assign to current
          result.push({ ...order, projectedMonth: months[monthIdx].label, minsUsed: orderMins, spansMonth: true });
          allocated = true;
          monthIdx++;
          usedMins = Math.max(0, orderMins - available);
          break;
        } else {
          monthIdx++;
          usedMins = 0;
        }
      }

      if (!allocated) {
        result.push({ ...order, projectedMonth: 'Beyond calendar', minsUsed: orderMins });
      }
    }

    return result;
  }

  function calcLeadTimeWeeks(orders) {
    if (!orders.length) return 0;
    const scheduled = calcStream(orders);
    const last = scheduled[scheduled.length - 1];
    if (!last.projectedMonth || last.projectedMonth === 'No calendar set' || last.projectedMonth === 'Beyond calendar') return null;
    const now = new Date();
    const endMonth = new Date(last.projectedMonth);
    const weeks = Math.round((endMonth - now) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, weeks);
  }

  const scheduledSimple = calcStream(simpleOrders);
  const scheduledComplex = calcStream(complexOrders);
  const simpleLead = calcLeadTimeWeeks(simpleOrders);
  const complexLead = calcLeadTimeWeeks(complexOrders);

  // Finance overtime
  const financeTotal = financeOrders.reduce((a, o) => a + calcOrderMins(o), 0);
  const overtimeMins = (parseFloat(overtimePool) || 0) * 60;
  const financeCovers = overtimeMins > 0 ? Math.floor(overtimeMins / (financeTotal / Math.max(1, financeOrders.length))) : 0;

  // ── Order management ──────────────────────────────────────────────────────

  function addOrder(stream) {
    const id = `q${qCount}`;
    const order = { ...newOrder, id, qtys: { ...newOrder.qtys } };
    if (stream === 'simple') setSimpleOrders(p => [...p, order]);
    else if (stream === 'complex') setComplexOrders(p => [...p, order]);
    else setFinanceOrders(p => [...p, order]);
    setQCount(p => p + 1);
    setNewOrder({ name: '', unitType: 'painted', qtys: Object.fromEntries(QTYS.map(([q]) => [q, 0])), bespoke: [] });
    setAddingTo(null);
  }

  function removeOrder(stream, id) {
    if (stream === 'simple') setSimpleOrders(p => p.filter(o => o.id !== id));
    else if (stream === 'complex') setComplexOrders(p => p.filter(o => o.id !== id));
    else setFinanceOrders(p => p.filter(o => o.id !== id));
  }

  function moveUp(stream, idx) {
    const setter = stream === 'simple' ? setSimpleOrders : stream === 'complex' ? setComplexOrders : setFinanceOrders;
    setter(p => {
      if (idx === 0) return p;
      const n = [...p];
      [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
      return n;
    });
  }

  function moveDown(stream, idx) {
    const setter = stream === 'simple' ? setSimpleOrders : stream === 'complex' ? setComplexOrders : setFinanceOrders;
    setter(p => {
      if (idx === p.length - 1) return p;
      const n = [...p];
      [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
      return n;
    });
  }

  function markComplete(stream, id) {
    removeOrder(stream, id);
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const C = { fontFamily: 'Georgia,serif', fontSize: 13, background: '#f5f4f0', minHeight: '100vh', color: '#1a1a1a' };
  const card = { background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem' };
  const H = { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 8 };
  const inp = { width: '100%', padding: '6px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16, background: '#fff' };
  const btn = { padding: '8px 16px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' };
  const btnP = { padding: '10px 22px', border: 'none', borderRadius: 4, background: '#1a1a1a', color: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' };
  const lbl = { fontSize: 11, color: '#888', display: 'block', marginBottom: 3 };
  const bumpBtn = { padding: '3px 8px', border: '0.5px solid #ddd', borderRadius: 3, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 12, cursor: 'pointer' };

  if (!authed) return <QueueLogin onAuth={() => setAuthed(true)} />;
  if (loading) return <div style={{ fontFamily: 'Georgia,serif', textAlign: 'center', padding: '3rem', color: '#aaa' }}>Loading queue…</div>;

  const STREAM_COLORS = { simple: '#1D9E75', complex: '#7F77DD', finance: '#BA7517' };

  function OrderCard({ order, stream, idx, scheduled }) {
    const mins = calcOrderMins(order);
    const sc = scheduled.find(s => s.id === order.id);
    const projMonth = sc?.projectedMonth || '—';
    const col = STREAM_COLORS[stream];
    return (
      <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: 8, borderLeft: `3px solid ${col}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
            <button onClick={() => moveUp(stream, idx)} style={{ ...bumpBtn, fontSize: 10 }}>▲</button>
            <button onClick={() => moveDown(stream, idx)} style={{ ...bumpBtn, fontSize: 10 }}>▼</button>
          </div>
          <span style={{ fontSize: 12, color: '#aaa', minWidth: 24, textAlign: 'center' }}>#{idx + 1}</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 'bold', minWidth: 120 }}>{order.name || 'Unnamed'}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{order.unitType || 'painted'}</span>
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#f5f4f0', color: '#555', border: '0.5px solid #e5e7eb' }}>
            {(mins / 60).toFixed(1)}h
          </span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: col + '18', color: col, border: `0.5px solid ${col}44`, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {projMonth}
          </span>
          {sc?.spansMonth && <span style={{ fontSize: 10, color: '#92400e' }}>spans months</span>}
          <button onClick={() => markComplete(stream, order.id)}
            style={{ ...btn, padding: '3px 10px', fontSize: 11, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
            ✓ Done
          </button>
          <button onClick={() => removeOrder(stream, order.id)}
            style={{ ...btn, padding: '3px 8px', fontSize: 11, color: '#b91c1c', borderColor: '#fca5a5' }}>×</button>
        </div>
        {order.date && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4, paddingLeft: 80 }}>Requested: {order.date}</div>}
      </div>
    );
  }

  function AddOrderForm({ stream }) {
    const col = STREAM_COLORS[stream];
    return (
      <div style={{ background: '#fafaf8', border: `0.5px solid ${col}44`, borderRadius: 6, padding: '0.75rem 1rem', marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: col, marginBottom: 10 }}>
          New {stream} order
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div><label style={lbl}>Client name</label><input value={newOrder.name} onChange={e => setNewOrder(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="Client name" /></div>
          <div><label style={lbl}>Requested date</label><input value={newOrder.date || ''} onChange={e => setNewOrder(p => ({ ...p, date: e.target.value }))} style={inp} placeholder="e.g. Aug 2026" /></div>
          <div><label style={lbl}>Unit type</label>
            <select value={newOrder.unitType || 'painted'} onChange={e => setNewOrder(p => ({ ...p, unitType: e.target.value }))}
              style={{ ...inp, fontSize: 14 }}>
              {UNIT_TYPES.map(ut => <option key={ut.key} value={ut.key}>{ut.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 6, marginBottom: 10 }}>
          {QTYS.map(([q, l]) => (
            <div key={q}><label style={lbl}>{l}</label>
              <input type="number" value={newOrder.qtys[q] || 0} min="0"
                style={{ ...inp, fontSize: 14 }}
                onChange={e => setNewOrder(p => ({ ...p, qtys: { ...p.qtys, [q]: parseInt(e.target.value) || 0 } }))} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
          Estimated: <strong>{(calcOrderMins(newOrder) / 60).toFixed(1)}h</strong>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => addOrder(stream)} style={btnP}>Add to {stream} queue</button>
          <button onClick={() => setAddingTo(null)} style={btn}>Cancel</button>
        </div>
      </div>
    );
  }

  function StreamSection({ title, color, stream, orders, scheduled, lead }) {
    const totalMins = orders.reduce((a, o) => a + calcOrderMins(o), 0);
    return (
      <div style={{ ...card, borderTop: `3px solid ${color}`, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot c={color} s={10} />
              <span style={{ fontSize: 15, fontWeight: 'bold' }}>{title}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>{orders.length} orders · {(totalMins / 60).toFixed(1)}h</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lead !== null && lead !== undefined && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color }}>{lead}w</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>lead time</div>
                </div>
              )}
              <button onClick={() => setAddingTo(addingTo === stream ? null : stream)}
                style={{ ...btn, padding: '5px 14px', fontSize: 12, background: color + '18', borderColor: color + '44', color }}>
                + Add order
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          {orders.length === 0 && <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic', padding: '0.5rem 0' }}>No orders in this stream.</div>}
          {orders.map((o, idx) => (
            <OrderCard key={o.id} order={o} stream={stream} idx={idx} scheduled={scheduled} />
          ))}
          {addingTo === stream && <AddOrderForm stream={stream} />}
        </div>
      </div>
    );
  }

  return (
    <div style={C}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

        <div style={{ textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 20, fontWeight: 'normal', letterSpacing: '0.06em' }}>ATHENA</div>
          <div style={{ fontSize: 9, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Lead Time Queue</div>
          <div style={{ fontSize: 11, color: saving ? '#888' : saveMsg.startsWith('✓') ? '#166534' : '#bbb', marginTop: 6 }}>
            {saveMsg || 'Auto-saves to cloud'}
          </div>
        </div>

        {/* Lead time summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: '1rem' }}>
          {[
            ['Simple lead time', simpleLead !== null ? `${simpleLead}w` : '—', '#1D9E75', `${simpleOrders.length} orders`],
            ['Complex lead time', complexLead !== null ? `${complexLead}w` : '—', '#7F77DD', `${complexOrders.length} orders`],
            ['Finance overtime', financeOrders.length ? `${financeOrders.length} orders` : '—', '#BA7517', `${(financeTotal / 60).toFixed(1)}h total`],
          ].map(([l, v, c, sub]) => (
            <div key={l} style={{ background: '#fff', border: `0.5px solid ${c}44`, borderRadius: 8, padding: '0.85rem 1rem', borderTop: `3px solid ${c}` }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Team capacity summary */}
        <div style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={H}>Team capacity (from workshop settings)</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeKeys.map(k => {
              const rd = ROLE_DEFS.find(r => r.key === k);
              if (!rd) return null;
              return (
                <span key={k} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: rd.color + '18', color: rd.color, border: `0.5px solid ${rd.color}44` }}>
                  {rd.label}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
            Holiday estimated by accrual ({(1 / 260 * 28 * 100).toFixed(1)}% per working day per role) · adjust per month in calendar below
          </div>
        </div>

        {/* Calendar months */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={H}>Working calendar</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setExpandedMonths(p => !p)} style={{ ...btn, padding: '3px 10px', fontSize: 12 }}>
                {expandedMonths ? 'Collapse' : 'Edit months'}
              </button>
              <button onClick={() => ensureMonths(calendarMonths.length + 6)} style={{ ...btn, padding: '3px 10px', fontSize: 12 }}>+ 6 months</button>
            </div>
          </div>
          {!expandedMonths ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {sortedMonths().slice(0, 12).map(m => {
                const cap = getMonthProductionMins(m);
                return (
                  <div key={m.label} style={{ background: '#f5f4f0', borderRadius: 4, padding: '4px 8px', fontSize: 11, textAlign: 'center' }}>
                    <div style={{ color: '#555', whiteSpace: 'nowrap' }}>{m.label}</div>
                    <div style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{(cap / 60).toFixed(0)}h</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
              {sortedMonths().map(m => {
                const cap = getMonthProductionMins(m);
                return (
                  <div key={m.label} style={{ background: '#fafaf8', border: '0.5px solid #eee', borderRadius: 6, padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 'bold' }}>{m.label}</span>
                      <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 'bold' }}>{(cap / 60).toFixed(1)}h prod</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>Working days:</label>
                      <input type="number" value={m.workingDays} min="0" max="31"
                        style={{ width: 58, padding: '3px 6px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 14 }}
                        onChange={e => setCalendarMonths(p => p.map(x => x.label === m.label ? { ...x, workingDays: parseInt(e.target.value) || 0 } : x))} />
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Holiday overrides (hrs — leave blank to use accrual estimate):</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {activeKeys.map(k => {
                        const rd = ROLE_DEFS.find(r => r.key === k);
                        if (!rd) return null;
                        const accrual = getAccrualPerDay(rd) * (m.workingDays || workingDaysDefault);
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Dot c={rd.color} s={7} />
                            <span style={{ fontSize: 11, color: '#888', minWidth: 65, fontSize: 10 }}>{rd.label.split(' ')[0]}</span>
                            <input type="number" placeholder={accrual.toFixed(1)}
                              value={m.holiday?.[k] !== undefined ? m.holiday[k] : ''}
                              min="0" step="0.5"
                              style={{ width: 52, padding: '2px 4px', border: '0.5px solid #ccc', borderRadius: 3, fontFamily: 'Georgia,serif', fontSize: 12 }}
                              onChange={e => setCalendarMonths(p => p.map(x => x.label === m.label ? {
                                ...x, holiday: { ...x.holiday, [k]: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 }
                              } : x))} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simple stream */}
        <StreamSection
          title="Simple builds"
          color="#1D9E75"
          stream="simple"
          orders={simpleOrders}
          scheduled={scheduledSimple}
          lead={simpleLead}
        />

        {/* Complex stream */}
        <StreamSection
          title="Complex builds"
          color="#7F77DD"
          stream="complex"
          orders={complexOrders}
          scheduled={scheduledComplex}
          lead={complexLead}
        />

        {/* Finance overtime section */}
        <div style={{ ...card, borderTop: '3px solid #BA7517', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '0.5px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Dot c="#BA7517" s={10} />
                <span style={{ fontSize: 15, fontWeight: 'bold' }}>Finance orders — overtime</span>
                <span style={{ fontSize: 11, color: '#aaa' }}>{financeOrders.length} orders · {(financeTotal / 60).toFixed(1)}h</span>
              </div>
              <button onClick={() => setAddingTo(addingTo === 'finance' ? null : 'finance')}
                style={{ ...btn, padding: '5px 14px', fontSize: 12, background: '#BA751718', borderColor: '#BA751744', color: '#BA7517' }}>
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
                <span style={{ fontSize: 12, color: '#BA7517', fontWeight: 'bold' }}>
                  {(overtimeMins / 60).toFixed(1)}h available · {(financeTotal / 60).toFixed(1)}h needed
                  {overtimeMins >= financeTotal
                    ? ' · ✓ covered this month'
                    : ` · ${((financeTotal - overtimeMins) / 60).toFixed(1)}h short`}
                </span>
              )}
            </div>
            {financeOrders.length === 0 && <div style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>No finance orders queued.</div>}
            {financeOrders.map((o, idx) => (
              <OrderCard key={o.id} order={o} stream="finance" idx={idx} scheduled={[]} />
            ))}
            {addingTo === 'finance' && <AddOrderForm stream="finance" />}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#ccc', fontSize: 10, marginTop: '2rem', paddingTop: '1rem', borderTop: '0.5px solid #eee', letterSpacing: '0.05em' }}>
          Discipline in the process. Excellence is Athena's reward.
        </div>
      </div>
    </div>
  );
}
