import { useState, useEffect, useRef, memo } from 'react';
import { ROLE_DEFS, QTYS, UNIT_TYPES, genClientTasks } from './data.js';

const QUEUE_PASSWORD = 'TPCLeadtime!';
const API_PASSWORD = 'Ath3na-W0rk5h0p!';

function getAccrualPerDay(rd) {
  // Pro-rate the 28 day entitlement by contracted days per week
  // e.g. 1d/wk = 28 × (1/5) = 5.6 days entitlement per year
  const dpw = rd.daysPerWeek || 5;
  const proRatedDays = 28 * (dpw / 5);
  const workingDaysPerYear = 260 * dpw / 5;
  return (proRatedDays * rd.stdDay) / workingDaysPerYear;
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
  // Calculate production task minutes via genClientTasks (without bespoke to avoid string concat bug)
  const prodTasks = genClientTasks({
    ...order,
    id: 'tmp',
    bespoke: [], // exclude bespoke here, add separately below
    unitType: order.unitType || 'painted',
  });
  const prodMins = prodTasks.reduce((a, t) => a + (parseInt(t.m) || 0), 0);
  // Add bespoke minutes explicitly with safe parseInt
  const bespokeMins = (order.bespoke || []).reduce((a, b) => {
    const m = parseInt(b.mins) || 0;
    return b.desc && m > 0 ? a + m : a;
  }, 0);
  return prodMins + bespokeMins;
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
        <button onClick={() => onAdd({ name, orderDate, unitType, qtys: { ...qtys }, bespoke: bespoke.filter(b => b.desc && parseInt(b.mins) > 0).map(b => ({...b, mins: parseInt(b.mins)||0})) })}
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
      {order.orderDate && (()=>{
        const ordered = new Date(order.orderDate);
        const elapsed = Math.round((new Date() - ordered) / (1000*60*60*24));
        return (
          <div style={{ fontSize: 11, color: elapsed > 60 ? '#b91c1c' : '#aaa', marginTop: 5, paddingLeft: 4, fontWeight: elapsed > 60 ? 'bold' : 'normal' }}>
            Ordered {ordered.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} · {elapsed} day{elapsed!==1?'s':''} ago{elapsed>60?' ⚠':''}
          </div>
        );
      })()}
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
  const [addingTo, setAddingTo] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(false);

  const [activeKeys, setActiveKeys] = useState(propActiveKeys || ['manager', 'maker1', 'assistant']);
  const [extraRoles, setExtraRoles] = useState([]);
  const [roleStreams, setRoleStreams] = useState({manager:'complex',maker1:'simple',maker2:'simple',painter:'overhead',assistant:'simple'});
  const [roleHours, setRoleHours] = useState({});
  const [planHoliday, setPlanHoliday] = useState({});
  const [planMonthName, setPlanMonthName] = useState('');
  const [workingDaysDefault, setWorkingDaysDefault] = useState(propWorkingDays || 21);
  const [mgmtOverhead, setMgmtOverhead] = useState(propMgmt || 20);
  const [wsOverhead, setWsOverhead] = useState(propWs || 28);

  useEffect(() => {
    if (!authed) return;
    Promise.all([apiLoadPlan(), apiLoadQueue()]).then(([plan, queue]) => {
      // Plan data — team config only
      if (plan.activeKeys) setActiveKeys(plan.activeKeys);
      if (plan.extraRoles) setExtraRoles(plan.extraRoles);
      if (plan.holiday) setPlanHoliday(plan.holiday);
      if (plan.monthName) setPlanMonthName(plan.monthName);
      if (plan.workingDays) setWorkingDaysDefault(plan.workingDays);
      if (plan.mgmtOverheadBudget !== undefined) setMgmtOverhead(plan.mgmtOverheadBudget);
      if (plan.wsOverheadBudget !== undefined) setWsOverhead(plan.wsOverheadBudget);
      if (plan.roleStreams) setRoleStreams(plan.roleStreams);
      if (plan.roleHours) setRoleHours(plan.roleHours);
      // Queue data — orders and settings only
      if (queue.simpleOrders) setSimpleOrders(queue.simpleOrders);
      if (queue.complexOrders) setComplexOrders(queue.complexOrders);
      if (queue.financeOrders) setFinanceOrders(queue.financeOrders);
      if (queue.qCount) setQCount(queue.qCount);
      if (queue.calendarMonths) setCalendarMonths(queue.calendarMonths);
      if (queue.overtimePool !== undefined) setOvertimePool(queue.overtimePool);
      if (queue.complexThreshold !== undefined) setComplexThreshold(queue.complexThreshold);
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
      await apiSaveQueue({ simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexThreshold });
      setSaving(false);
      setSaveMsg('✓ Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }, 1500);
  };

  useEffect(() => {
    if (!authed || loading) return;
    triggerSave.current();
  }, [simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexThreshold]);

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
  // Simple and complex streams are fully independent — each has its own capacity pool.
  // Simple capacity = simple team members (maker + assistant).
  // Complex capacity = complex team members (manager + Harry).
  // Overhead pool members add to total but are distributed proportionally.
  // No ratio — streams don't share capacity.

  // Helper: get hours for a standard role using roleHours overrides from Plan
  function getRoleHrs(key, wd) {
    const rd = ROLE_DEFS.find(r => r.key === key);
    if (!rd) return 0;
    const rh = roleHours && roleHours[key];
    const stdDay = rh ? (parseFloat(rh.stdDay) || rd.stdDay) : rd.stdDay;
    const dpw = rh ? (parseFloat(rh.daysPerWeek) || rd.daysPerWeek || 5) : (rd.daysPerWeek || 5);
    return stdDay * (wd * dpw / 5);
  }

  // Helper: get accrual for a role using actual h/day and d/wk
  function getRoleAccrual(key, wd) {
    const rd = ROLE_DEFS.find(r => r.key === key);
    if (!rd) return 0;
    const rh = roleHours && roleHours[key];
    const stdDay = rh ? (parseFloat(rh.stdDay) || rd.stdDay) : rd.stdDay;
    const dpw = rh ? (parseFloat(rh.daysPerWeek) || rd.daysPerWeek || 5) : (rd.daysPerWeek || 5);
    const proRatedDays = 28 * (dpw / 5);
    const workingDaysPerYear = 260 * dpw / 5;
    const accrualPerDay = (proRatedDays * stdDay) / workingDaysPerYear;
    return accrualPerDay * wd;
  }

  // Helper: get holiday deduction for a role in a given month
  function getHolidayDeduction(key, month, wd) {
    // Priority: 1) calendar month override, 2) plan holiday if same month, 3) accrual
    if (month.holiday && month.holiday[key] !== undefined) return parseFloat(month.holiday[key]);
    if (isPlanMonth(month.label) && planHoliday[key] !== undefined) return parseFloat(planHoliday[key]);
    return getRoleAccrual(key, wd);
  }

  // Calculate raw mins for a stream (before overhead deduction)
  function streamRawMins(stream, month) {
    const wd = month.workingDays || workingDaysDefault;
    let mins = 0;
    // Standard roles
    for (const key of activeKeys) {
      if ((roleStreams && roleStreams[key]) !== stream) continue;
      const gross = getRoleHrs(key, wd);
      const holiday = getHolidayDeduction(key, month, wd);
      mins += Math.max(0, gross - holiday) * 60;
    }
    // Extra roles (from Plan — Harry etc.)
    for (const er of extraRoles) {
      if ((er.stream || 'complex') !== stream) continue;
      const dpw = parseFloat(er.daysPerWeek) || 5;
      const stdDay = parseFloat(er.stdDay) || 7;
      const gross = stdDay * (wd * dpw / 5);
      const proRatedDays = 28 * (dpw / 5);
      const workingDaysPerYear = 260 * dpw / 5;
      const accrualPerDay = (proRatedDays * stdDay) / workingDaysPerYear;
      const holiday = (month.holiday && month.holiday[er.key] !== undefined)
        ? parseFloat(month.holiday[er.key])
        : accrualPerDay * wd;
      mins += Math.max(0, gross - holiday) * 60;
    }
    return mins;
  }

  // Overhead pool — proportional split based on actual stream raw hours
  function getOverheadForStream(stream, month) {
    const wd = month.workingDays || workingDaysDefault;
    const simpleMins = streamRawMins('simple', month);
    const complexMins = streamRawMins('complex', month);
    const total = simpleMins + complexMins;
    if (total === 0) return 0;
    const frac = stream === 'simple' ? simpleMins / total : complexMins / total;
    // Overhead pool members split proportionally
    let poolMins = 0;
    for (const key of activeKeys) {
      if ((roleStreams && roleStreams[key]) !== 'overhead') continue;
      const gross = getRoleHrs(key, wd);
      const holiday = getHolidayDeduction(key, month, wd);
      poolMins += Math.max(0, gross - holiday) * 60;
    }
    // Fixed overhead budgets also split proportionally
    const fixedOverhead = ((parseFloat(mgmtOverhead) || 0) + (parseFloat(wsOverhead) || 0)) * 60;
    return (fixedOverhead - poolMins * frac) * frac;
  }

  function getMonthSimpleMins(month) {
    const raw = streamRawMins('simple', month);
    const overhead = getOverheadForStream('simple', month);
    return Math.max(0, raw - overhead);
  }

  function getMonthComplexMins(month) {
    const raw = streamRawMins('complex', month);
    const overhead = getOverheadForStream('complex', month);
    return Math.max(0, raw - overhead);
  }

  function calcStream(orders, getCapFn) {
    const months = sortedMonths();
    if (!months.length) return orders.map(o => ({ ...o, projectedMonth: 'No calendar set' }));
    const result = [];
    const queue = [...orders];
    let monthIdx = 0;
    let usedMins = 0;

    for (const order of queue) {
      const orderMins = calcOrderMins(order);
      let allocated = false;
      while (monthIdx < months.length) {
        const cap = getCapFn(months[monthIdx]);
        const available = cap - usedMins;
        if (available >= orderMins) {
          usedMins += orderMins;
          result.push({ ...order, projectedMonth: months[monthIdx].label });
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
    // Parse "June 2026" style labels safely across all browsers including mobile Safari
    const parts = last.projectedMonth.split(' ');
    if (parts.length < 2) return null;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthIdx = months.indexOf(parts[0]);
    const year = parseInt(parts[1]);
    if (monthIdx === -1 || isNaN(year)) return null;
    const endMonth = new Date(year, monthIdx + 1, 0); // last day of that month
    const weeks = Math.round((endMonth - new Date()) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, weeks);
  }

  const scheduledSimple = calcStream(simpleOrders, getMonthSimpleMins);
  const scheduledComplex = calcStream(complexOrders, getMonthComplexMins);
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
    const data = { simpleOrders, complexOrders, financeOrders, qCount, calendarMonths, overtimePool, complexRatio, complexThreshold, exportedAt: new Date().toISOString() };
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
                      {[
                        // Standard roles
                        ...activeKeys.map(k => {
                          const rd = ROLE_DEFS.find(r => r.key === k);
                          if (!rd) return null;
                          const rh = roleHours && roleHours[k];
                          const stdDay = rh ? (parseFloat(rh.stdDay) || rd.stdDay) : rd.stdDay;
                          const dpw = rh ? (parseFloat(rh.daysPerWeek) || rd.daysPerWeek || 5) : (rd.daysPerWeek || 5);
                          const proRatedDays = 28 * (dpw / 5);
                          const workingDaysPerYear = 260 * dpw / 5;
                          const accrualPerDay = (proRatedDays * stdDay) / workingDaysPerYear;
                          const accrual = accrualPerDay * (m.workingDays || workingDaysDefault);
                          return { key: k, color: rd.color, label: rd.label, accrual };
                        }),
                        // Extra roles (Harry, Oscar, Theo etc.)
                        ...extraRoles.map(er => {
                          const dpw = parseFloat(er.daysPerWeek) || 5;
                          const stdDay = parseFloat(er.stdDay) || 7;
                          const proRatedDays = 28 * (dpw / 5);
                          const workingDaysPerYear = 260 * dpw / 5;
                          const accrualPerDay = (proRatedDays * stdDay) / workingDaysPerYear;
                          const accrual = accrualPerDay * (m.workingDays || workingDaysDefault);
                          return { key: er.key, color: er.color, label: er.label, accrual };
                        }),
                      ].filter(Boolean).map(({ key: k, color, label, accrual }) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Dot c={color} s={6} />
                          <span style={{ fontSize: 10, color: '#888', minWidth: 60 }}>{label.split(' ')[0]}</span>
                          <input type="number" placeholder={accrual.toFixed(1)}
                            value={m.holiday?.[k] !== undefined ? m.holiday[k] : ''}
                            min="0" step="0.5"
                            style={{ width: 50, padding: '2px 4px', border: '0.5px solid #ccc', borderRadius: 3, fontFamily: 'Georgia,serif', fontSize: 12 }}
                            onChange={e => setCalendarMonths(p => p.map(x => x.label === m.label ? {
                              ...x, holiday: { ...x.holiday, [k]: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 }
                            } : x))} />
                        </div>
                      ))}
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
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>Simple and complex streams run independently — each uses its own team capacity from Plan settings.</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
