import { useState, useEffect, useRef, memo } from 'react';
import { ROLE_DEFS, QTYS, UNIT_TYPES, genClientTasks } from './data.js';

const QUEUE_PASSWORD = 'TPCLeadtime!';
const API_PASSWORD = 'Ath3na-W0rk5h0p!';

function getAccrualPerDay(rd) {
  const workingDaysPerYear = 260 * (rd.daysPerWeek || 5) / 5;
  return (28 * rd.stdDay) / workingDaysPerYear;
}

// Load Plan state (team, holiday etc.) — read only from Queue
async function apiLoadPlan() {
  const r = await fetch('/api/state', { headers: { 'x-athena-password': API_PASSWORD } });
  if (!r.ok) throw new Error('Plan load failed');
  return r.json();
}
// Queue state is stored under a separate key so Plan saves never overwrite it
async function apiLoadQueue() {
  const r = await fetch('/api/queue-state', { headers: { 'x-athena-password': API_PASSWORD } });
  if (!r.ok) return {}; // empty on first load is fine
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

function calcOrderMins(order) {
  if (!order.qtys) return (order.estimatedHours || 0) * 60;
  // genClientTasks includes both production tasks and bespoke items
  const tasks = genClientTasks({
    ...order,
    id: 'tmp',
    bespoke: (order.bespoke || []).filter(b => b.desc && b.mins > 0),
    unitType: order.unitType || 'painted',
  });
  return tasks.reduce((a, t) => a + (t.m || 0), 0);
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

// ── Add order form — lifted outside main component to prevent remount ────────
const AddOrderForm = memo(function AddOrderForm({ stream, color, onAdd, onCancel, complexThreshold }) {
  const [name, setName] = useState('');
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={lbl}>Client name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Client name" />
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
      {/* Hours estimate + complexity flag */}
      <div style={{ padding: '8px 10px', borderRadius: 4, marginBottom: 10, background: wrongStream ? '#fef2f2' : isOverThreshold ? '#fdf4ff' : '#f0fdf4', border: `0.5px solid ${wrongStream ? '#fca5a5' : isOverThreshold ? '#e9d5ff' : '#bbf7d0'}` }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: wrongStream ? '#b91c1c' : isOverThreshold ? '#7F77DD' : '#166534' }}>
          {hrs > 0 ? `${hrs.toFixed(1)} hours` : 'Enter quantities above'}
          {hrs >= threshold && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 'normal' }}>— complex build ({threshold}h+ threshold)</span>}
          {hrs > 0 && hrs < threshold && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 'normal' }}>— simple build (under {threshold}h threshold)</span>}
        </div>
        {wrongStream && stream === 'simple' && (
          <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3 }}>⚠ This order is over {threshold}h — consider adding to the Complex queue instead.</div>
        )}
        {wrongStream && stream === 'complex' && (
          <div style={{ fontSize: 11, color: '#92400e', marginTop: 3 }}>⚠ This order is under {threshold}h — consider adding to the Simple queue instead.</div>
        )}
      </div>
      {/* Bespoke items */}
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
        <button onClick={() => onAdd({ name, unitType, qtys: { ...qtys }, bespoke: bespoke.filter(b => b.desc && b.mins) })}
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

// ── Individual order card ────────────────────────────────────────────────────
const OrderCard = memo(function OrderCard({ order, stream, idx, projectedMonth, spansMonth, color, onMoveUp, onMoveDown, onComplete, onRemove }) {
  const mins = calcOrderMins(order);
  const bumpBtn = { padding: '3px 8px', border: '0.5px solid #ddd', borderRadius: 3, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 11, cursor: 'pointer', color: '#555' };
  const btn = { padding: '8px 16px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 13, cursor: 'pointer' };

  return (
    <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Priority bumps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={onMoveUp} style={bumpBtn}>▲</button>
          <button onClick={onMoveDown} style={bumpBtn}>▼</button>
        </div>
        <span style={{ fontSize: 12, color: '#aaa', minWidth: 22, textAlign: 'center' }}>#{idx + 1}</span>

        {/* Client name */}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 'bold', minWidth: 120 }}>{order.name || 'Unnamed'}</span>

        {/* Unit type */}
        <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{UNIT_TYPES.find(u => u.key === (order.unitType || 'painted'))?.label || 'Painted'}</span>

        {/* Hours */}
        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#f5f4f0', color: '#555', border: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' }}>
          {(mins / 60).toFixed(1)}h
        </span>

        {/* Expected completion — prominent */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 100 }}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color, whiteSpace: 'nowrap' }}>{projectedMonth || '—'}</span>
          <span style={{ fontSize: 10, color: '#aaa' }}>est. completion{spansMonth ? ' · spans months' : ''}</span>
        </div>

        <button onClick={onComplete}
          style={{ ...btn, padding: '4px 12px', fontSize: 11, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
          ✓ Complete
        </button>
        <button onClick={onRemove}
          style={{ ...btn, padding: '4px 8px', fontSize: 11, color: '#b91c1c', borderColor: '#fca5a5' }}>×</button>
      </div>
    </div>
  );
});

// ── Stream section ───────────────────────────────────────────────────────────
function StreamSection({ title, color, stream, orders, scheduled, lead, addingTo, setAddingTo, onAdd, onMoveUp, onMoveDown, onComplete, onRemove, complexThreshold }) {
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
              projectedMonth={sc?.projectedMonth} spansMonth={sc?.spansMonth}
              color={color}
              onMoveUp={() => onMoveUp(stream, idx)}
              onMoveDown={() => onMoveDown(stream, idx)}
              onComplete={() => onComplete(stream, o.id)}
              onRemove={() => onRemove(stream, o.id)} />
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

// ── Main Queue component ─────────────────────────────────────────────────────
export default function Queue({ activeKeys: propActiveKeys, workingDays: propWorkingDays, mgmtOverheadBudget: propMgmt, wsOverheadBudget: propWs }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('queueAuthed') === '1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const saveTimer = useRef(null);

  const [simpleOrders, setSimpleOrders] = useState([]);
  const [complexOrders, setComplexOrders] = useState([]);
  const [financeOrders, setFinanceOrders] = useState([]);
  const [qCount, setQCount] = useState(0);
  const [calendarMonths, setCalendarMonths] = useState([]);
  const [overtimePool, setOvertimePool] = useState(0);
  const [complexRatio, setComplexRatio] = useState(6);
  const [complexThreshold, setComplexThreshold] = useState(30);
  const [extraTeam, setExtraTeam] = useState([]); // [{name, hrsPerWeek}]
  const [addingTo, setAddingTo] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(false);

  const [activeKeys, setActiveKeys] = useState(propActiveKeys || ['manager', 'maker1', 'assistant']);
  const [extraRoles, setExtraRoles] = useState([]);
  const [planHoliday, setPlanHoliday] = useState({});
  const [planMonthName, setPlanMonthName] = useState('');
  const [workingDaysDefault, setWorkingDaysDefault] = useState(propWorkingDays || 21);
  const [mgmtOverhead, setMgmtOverhead] = useState(propMgmt || 20);
  const [wsOverhead, setWsOverhead] = useState(propWs || 28);

  useEffect(() => {
    if (!authed) return;
    apiLoad().then(s => {
      if (s.activeKeys) setActiveKeys(s.activeKeys);
      if (s.extraRoles) setExtraRoles(s.extraRoles);
      if (s.workingDays) setWorkingDaysDefault(s.workingDays);
      if (s.mgmtOverheadBudget !== undefined) setMgmtOverhead(s.mgmtOverheadBudget);
      if (s.wsOverheadBudget !== undefined) setWsOverhead(s.wsOverheadBudget);
      if (s.simpleOrders) setSimpleOrders(s.simpleOrders);
      if (s.complexOrders) setComplexOrders(s.complexOrders);
      if (s.financeOrders) setFinanceOrders(s.financeOrders);
      if (s.qCount) setQCount(s.qCount);
      if (s.calendarMonths) setCalendarMonths(s.calendarMonths);
      if (s.overtimePool !== undefined) setOvertimePool(s.overtimePool);
      if (s.complexRatio !== undefined) setComplexRatio(s.complexRatio);
      if (s.complexThreshold !== undefined) setComplexThreshold(s.complexThreshold);
      if (s.extraTeam) setExtraTeam(s.extraTeam);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authed]);

  const triggerSave = useRef(null);
  triggerSave.current = async () => {
    clearTimeout(saveTimer.current);
    setSaveMsg('Saving…');
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      // Save ONLY queue data — never touches Plan state
      await apiSaveQueue({ simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexRatio, complexThreshold, extraTeam });
      setSaving(false);
      setSaveMsg('✓ Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }, 1500);
  };

  useEffect(() => {
    if (!authed || loading) return;
    triggerSave.current();
  }, [simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexRatio, complexThreshold, extraTeam]);

  // ── Calendar ───────────────────────────────────────────────────────────────

  // Is this calendar month the same as the current Plan month?
  function isPlanMonth(monthLabel) {
    if (!planMonthName) return false;
    return monthLabel.trim().toLowerCase() === planMonthName.trim().toLowerCase();
  }

  function getMonthProductionMins(month) {
    let totalMins = 0;
    const wd = month.workingDays || workingDaysDefault;
    const usePlanHoliday = isPlanMonth(month.label);

    for (const key of activeKeys) {
      const rd = ROLE_DEFS.find(r => r.key === key);
      if (!rd) continue;
      const dpw = rd.daysPerWeek || 5;
      const grossHrs = rd.stdDay * (wd * dpw / 5);
      const accrual = getAccrualPerDay(rd) * wd;
      // Priority: 1) calendar month override, 2) Plan holiday if same month, 3) accrual estimate
      let holidayHrs;
      if (month.holiday && month.holiday[key] !== undefined) {
        holidayHrs = parseFloat(month.holiday[key]); // calendar override
      } else if (usePlanHoliday && planHoliday[key] !== undefined) {
        holidayHrs = parseFloat(planHoliday[key]);   // actual from Plan
      } else {
        holidayHrs = accrual;                         // accrual estimate
      }
      totalMins += Math.max(0, grossHrs - holidayHrs) * 60;
    }
    // Extra roles from Plan (e.g. Harry) — use their holiday field directly
    for (const er of extraRoles) {
      const dpw = parseFloat(er.daysPerWeek) || 5;
      const grossHrs = (parseFloat(er.stdDay)||7) * (wd * dpw / 5);
      const accrual = getAccrualPerDay({stdDay: parseFloat(er.stdDay)||7, daysPerWeek: dpw}) * wd;
      const holidayHrs = (month.holiday && month.holiday[er.key] !== undefined)
        ? parseFloat(month.holiday[er.key])
        : (parseFloat(er.holiday) || accrual);
      totalMins += Math.max(0, grossHrs - holidayHrs) * 60;
    }
    // Queue-only extra team members
    for (const m of extraTeam) {
      const hpw = parseFloat(m.hrsPerWeek) || 0;
      if (hpw > 0) totalMins += hpw * (wd / 5) * 60;
    }
    const overheadMins = ((parseFloat(mgmtOverhead) || 0) + (parseFloat(wsOverhead) || 0)) * 60;
    return Math.max(0, totalMins - overheadMins);
  }

  function generateMonthLabel(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function ensureMonths(n = 18) {
    setCalendarMonths(p => {
      const merged = [...p];
      for (let i = 0; i < n; i++) {
        const label = generateMonthLabel(i);
        if (!merged.find(x => x.label === label)) merged.push({ label, workingDays: 21, holiday: {} });
      }
      return merged;
    });
  }

  useEffect(() => { if (authed && !loading) ensureMonths(18); }, [authed, loading]);

  function sortedMonths() {
    return [...calendarMonths].sort((a, b) => new Date(a.label) - new Date(b.label));
  }

  // ── Scheduling ─────────────────────────────────────────────────────────────
  // Shared capacity pool with configurable simple:complex ratio.
  // Both streams draw from the same monthly production hours.
  // Per month: complex slots = floor(capacity / (ratio+1)), simple slots = remainder.
  // If one stream is empty, all capacity goes to the other.

  function calcBothStreams() {
    const months = sortedMonths();
    const noCalendar = { simple: simpleOrders.map(o => ({ ...o, projectedMonth: 'No calendar set' })), complex: complexOrders.map(o => ({ ...o, projectedMonth: 'No calendar set' })) };
    if (!months.length) return noCalendar;

    const ratio = Math.max(1, parseInt(complexRatio) || 6);
    const simpleQ = [...simpleOrders];
    const complexQ = [...complexOrders];
    const simpleResult = [];
    const complexResult = [];

    for (const month of months) {
      const totalCap = getMonthProductionMins(month);
      const hasComplex = complexQ.length > 0;
      const hasSimple = simpleQ.length > 0;
      if (!hasSimple && !hasComplex) continue;

      // Split capacity: if both streams have orders, reserve a fraction for complex
      // complex fraction = 1 / (ratio + 1), simple fraction = ratio / (ratio + 1)
      // If only one stream has orders, it gets all capacity
      let simpleCap = totalCap;
      let complexCap = 0;
      if (hasSimple && hasComplex) {
        complexCap = Math.floor(totalCap / (ratio + 1));
        simpleCap = totalCap - complexCap;
      } else if (hasComplex && !hasSimple) {
        complexCap = totalCap;
        simpleCap = 0;
      }

      // Fill simple slots for this month
      let simpleUsed = 0;
      while (simpleQ.length > 0) {
        const orderMins = calcOrderMins(simpleQ[0]);
        if (simpleUsed + orderMins <= simpleCap) {
          simpleUsed += orderMins;
          simpleResult.push({ ...simpleQ.shift(), projectedMonth: month.label });
        } else {
          // Remaining simple capacity might fit in complex overflow if complex is done
          break;
        }
      }

      // Fill complex slots for this month
      let complexUsed = 0;
      while (complexQ.length > 0) {
        const orderMins = calcOrderMins(complexQ[0]);
        if (complexUsed + orderMins <= complexCap) {
          complexUsed += orderMins;
          complexResult.push({ ...complexQ.shift(), projectedMonth: month.label });
        } else {
          break;
        }
      }

      // If simple finished early, overflow unused simple capacity to complex
      const simpleOverflow = simpleCap - simpleUsed;
      if (simpleOverflow > 0 && complexQ.length > 0) {
        while (complexQ.length > 0) {
          const orderMins = calcOrderMins(complexQ[0]);
          if (complexUsed + orderMins <= complexCap + simpleOverflow) {
            complexUsed += orderMins;
            complexResult.push({ ...complexQ.shift(), projectedMonth: month.label });
          } else break;
        }
      }
    }

    // Anything left over is beyond calendar
    simpleQ.forEach(o => simpleResult.push({ ...o, projectedMonth: 'Beyond calendar' }));
    complexQ.forEach(o => complexResult.push({ ...o, projectedMonth: 'Beyond calendar' }));

    return { simple: simpleResult, complex: complexResult };
  }

  function calcLeadTimeWeeks(scheduled) {
    if (!scheduled.length) return null;
    const last = scheduled[scheduled.length - 1];
    if (!last.projectedMonth || last.projectedMonth === 'No calendar set' || last.projectedMonth === 'Beyond calendar') return null;
    const endMonth = new Date(last.projectedMonth);
    const weeks = Math.round((endMonth - new Date()) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, weeks);
  }

  const { simple: scheduledSimple, complex: scheduledComplex } = calcBothStreams();
  const simpleLead = calcLeadTimeWeeks(scheduledSimple);
  const complexLead = calcLeadTimeWeeks(scheduledComplex);
  const financeTotal = financeOrders.reduce((a, o) => a + calcOrderMins(o), 0);
  const overtimeMins = (parseFloat(overtimePool) || 0) * 60;

  // ── Order actions ──────────────────────────────────────────────────────────

  function addOrder(stream, order) {
    const id = `q${qCount}`;
    const full = { ...order, id };
    if (stream === 'simple') setSimpleOrders(p => [...p, full]);
    else if (stream === 'complex') setComplexOrders(p => [...p, full]);
    else setFinanceOrders(p => [...p, full]);
    setQCount(p => p + 1);
    setAddingTo(null);
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

  // ── Styles ─────────────────────────────────────────────────────────────────

  // ── Backup / restore ─────────────────────────────────────────────────────
  function exportBackup() {
    const data = { simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexRatio, complexThreshold, extraTeam, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athena-queue-backup-${new Date().toISOString().slice(0,10)}.json`;
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
        if (data.complexRatio !== undefined) setComplexRatio(data.complexRatio);
        if (data.complexThreshold !== undefined) setComplexThreshold(data.complexThreshold);
        if (data.extraTeam) setExtraTeam(data.extraTeam);
        alert('Queue restored successfully from backup.');
      } catch { alert('Could not read backup file — make sure it is a valid Athena queue backup.'); }
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

  if (!authed) return <QueueLogin onAuth={() => { sessionStorage.setItem('queueAuthed','1'); setAuthed(true); }} />;
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

        {/* Lead time summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: '1rem' }}>
          {[
            ['Simple lead time', simpleLead !== null ? `${simpleLead}w` : '—', '#1D9E75', `${simpleOrders.length} order${simpleOrders.length !== 1 ? 's' : ''} in queue`],
            ['Complex lead time', complexLead !== null ? `${complexLead}w` : '—', '#7F77DD', `${complexOrders.length} order${complexOrders.length !== 1 ? 's' : ''} in queue`],
            ['Finance overtime', financeOrders.length ? `${financeOrders.length} order${financeOrders.length !== 1 ? 's' : ''}` : '—', '#BA7517', `${(financeTotal / 60).toFixed(1)}h total`],
          ].map(([l, v, c, sub]) => (
            <div key={l} style={{ background: '#fff', border: `0.5px solid ${c}44`, borderRadius: 8, padding: '0.85rem 1rem', borderTop: `3px solid ${c}` }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Team capacity */}
        <div style={card}>
          <div style={H}>Active team — capacity feeds from workshop settings</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {activeKeys.map(k => {
              const rd = ROLE_DEFS.find(r => r.key === k);
              if (!rd) return null;
              return (
                <span key={k} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: rd.color + '18', color: rd.color, border: `0.5px solid ${rd.color}44` }}>
                  <Dot c={rd.color} s={7} /> {rd.label}
                </span>
              );
            })}
            {extraRoles.map(er => (
              <span key={er.key} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: er.color + '18', color: er.color, border: `0.5px solid ${er.color}44` }}>
                <Dot c={er.color} s={7} /> {er.label} <span style={{fontSize:10,opacity:0.7}}>(added in Plan)</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            {planMonthName ? <span>Holiday for <strong>{planMonthName}</strong> uses actual figures from Plan · future months use statutory accrual estimate · override any month in calendar below</span> : 'Holiday uses statutory accrual estimate · set month in Plan to use actual figures · override per month in calendar below'}
          </div>
        </div>

        {/* Calendar */}
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
                const cap = getMonthProductionMins(m);
                return (
                  <div key={m.label} style={{ background: '#f5f4f0', borderRadius: 4, padding: '5px 10px', fontSize: 11, textAlign: 'center', minWidth: 80 }}>
                    <div style={{ color: '#555', whiteSpace: 'nowrap', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{(cap / 60).toFixed(0)}h</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
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
                        style={{ width: 56, padding: '3px 6px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 14 }}
                        onChange={e => setCalendarMonths(p => p.map(x => x.label === m.label ? { ...x, workingDays: parseInt(e.target.value) || 0 } : x))} />
                    </div>
                    <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>Holiday overrides — leave blank to use accrual estimate:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {activeKeys.map(k => {
                        const rd = ROLE_DEFS.find(r => r.key === k);
                        if (!rd) return null;
                        const accrual = getAccrualPerDay(rd) * (m.workingDays || workingDaysDefault);
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Dot c={rd.color} s={6} />
                            <span style={{ fontSize: 10, color: '#888', minWidth: 60 }}>{rd.label.split(' ')[0]}</span>
                            <input type="number" placeholder={accrual.toFixed(1)}
                              value={m.holiday?.[k] !== undefined ? m.holiday[k] : ''}
                              min="0" step="0.5"
                              style={{ width: 50, padding: '2px 4px', border: '0.5px solid #ccc', borderRadius: 3, fontFamily: 'Georgia,serif', fontSize: 12 }}
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

        {/* Queue settings */}
        <div style={{ background: '#fff', border: '0.5px solid #ddd', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 10 }}>Queue settings</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Simple : complex ratio</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" value={complexRatio} min="1" max="20" step="1"
                  style={{ width: 58, padding: '4px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                  onChange={e => setComplexRatio(Math.max(1, parseInt(e.target.value) || 6))} />
                <span style={{ fontSize: 12, color: '#888' }}>simple orders per complex</span>
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>Capacity split per month: {Math.round(complexRatio/(complexRatio+1)*100)}% simple · {Math.round(1/(complexRatio+1)*100)}% complex</div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Complexity threshold (hrs)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" value={complexThreshold} min="5" max="200" step="1"
                  style={{ width: 58, padding: '4px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }}
                  onChange={e => setComplexThreshold(Math.max(1, parseFloat(e.target.value) || 30))} />
                <span style={{ fontSize: 12, color: '#888' }}>hours — orders above this are flagged complex</span>
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>Currently: under {complexThreshold}h = simple · {complexThreshold}h+ = complex</div>
            </div>
          </div>
          {/* Extra team members for queue capacity only */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #eee' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
              Additional capacity <span style={{ color: '#bbb' }}>— queue only, does not affect monthly dispatch (e.g. Harry 7h/week)</span>
            </div>
            {extraTeam.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input placeholder="Name" value={m.name || ''} onChange={e => setExtraTeam(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  style={{ flex: 1, minWidth: 120, padding: '4px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }} />
                <input type="number" value={m.hrsPerWeek || ''} min="0" step="0.5" placeholder="hrs/wk"
                  onChange={e => setExtraTeam(p => p.map((x, j) => j === i ? { ...x, hrsPerWeek: parseFloat(e.target.value) || 0 } : x))}
                  style={{ width: 72, padding: '4px 8px', border: '0.5px solid #ccc', borderRadius: 4, fontFamily: 'Georgia,serif', fontSize: 16 }} />
                <span style={{ fontSize: 11, color: '#888' }}>hrs/week</span>
                <button onClick={() => setExtraTeam(p => p.filter((_, j) => j !== i))}
                  style={{ padding: '4px 8px', border: '0.5px solid #fca5a5', borderRadius: 4, background: '#fff', color: '#b91c1c', cursor: 'pointer', fontFamily: 'Georgia,serif', fontSize: 12 }}>×</button>
              </div>
            ))}
            <button onClick={() => setExtraTeam(p => [...p, { name: '', hrsPerWeek: 7 }])}
              style={{ padding: '4px 12px', border: '0.5px solid #999', borderRadius: 4, background: '#fff', fontFamily: 'Georgia,serif', fontSize: 12, cursor: 'pointer' }}>
              + Add person
            </button>
          </div>
        </div>

        {/* Simple stream */}
        <StreamSection title="Simple builds" color="#1D9E75" stream="simple"
          orders={simpleOrders} scheduled={scheduledSimple} lead={simpleLead}
          addingTo={addingTo} setAddingTo={setAddingTo}
          onAdd={addOrder} onMoveUp={moveUp} onMoveDown={moveDown}
          onComplete={removeOrder} onRemove={removeOrder} complexThreshold={complexThreshold}/>

        {/* Complex stream */}
        <StreamSection title="Complex builds" color="#7F77DD" stream="complex"
          orders={complexOrders} scheduled={scheduledComplex} lead={complexLead}
          addingTo={addingTo} setAddingTo={setAddingTo}
          onAdd={addOrder} onMoveUp={moveUp} onMoveDown={moveDown}
          onComplete={removeOrder} onRemove={removeOrder} complexThreshold={complexThreshold}/>

        {/* Finance overtime */}
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
                onRemove={() => removeOrder('finance', o.id)} />
            ))}
            {addingTo === 'finance' && (
              <AddOrderForm stream="finance" color="#BA7517"
                onAdd={order => addOrder('finance', order)}
                onCancel={() => setAddingTo(null)} complexThreshold={complexThreshold}/>
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
