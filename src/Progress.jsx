import { useState, useEffect } from 'react';

const PASSWORD = 'Ath3na-W0rk5h0p!';

async function apiLoad() {
  const r = await fetch('/api/state', { headers: { 'x-athena-password': PASSWORD } });
  if (!r.ok) throw new Error('Auth failed');
  return r.json();
}

function Dot({ c, s=9 }) {
  return <span style={{width:s,height:s,borderRadius:'50%',background:c,display:'inline-block',flexShrink:0}}/>;
}

// Progress can be used in two modes:
// 1. Standalone (no props) — fetches its own state from API (public /progress page)
// 2. Embedded (with props from App.jsx) — uses passed data directly

export default function Progress({ clients: propClients, clientTasks: propClientTasks, monthName: propMonthName, getOrderStatus: propGetOrderStatus, getOrderPct: propGetOrderPct }) {
  const isEmbedded = !!propClients;

  const [clients, setClients] = useState(propClients || []);
  const [clientTasks, setClientTasks] = useState(propClientTasks || {});
  const [monthName, setMonthName] = useState(propMonthName || '');
  const [loading, setLoading] = useState(!isEmbedded);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Track which orders are manually expanded (overriding auto-minimise)
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (isEmbedded) return;
    function load() {
      apiLoad().then(s => {
        if (s.clients) setClients(s.clients);
        if (s.clientTasks) setClientTasks(s.clientTasks);
        if (s.monthName) setMonthName(s.monthName);
        setLastUpdated(new Date());
        setLoading(false);
      }).catch(() => setLoading(false));
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [isEmbedded]);

  // When embedded, sync props
  useEffect(() => {
    if (isEmbedded) {
      setClients(propClients);
      setClientTasks(propClientTasks);
      setMonthName(propMonthName);
    }
  }, [propClients, propClientTasks, propMonthName, isEmbedded]);

  function getOrderPct(clId) {
    if (propGetOrderPct) return propGetOrderPct(clId);
    const tasks = clientTasks[clId] || [];
    if (!tasks.length) return 0;
    return Math.round(tasks.filter(t => t.done).length / tasks.length * 100);
  }

  function getOrderStatus(cl) {
    if (propGetOrderStatus) return propGetOrderStatus(cl);
    if (!cl.targetDate) return null;
    const target = new Date(cl.targetDate);
    if (isNaN(target)) return null;
    const today = new Date();
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const daysInMonth = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
    const daysElapsed = Math.max(0, Math.min(daysInMonth, Math.round((today - monthStart)/(1000*60*60*24))));
    const totalDays = Math.round((target - monthStart)/(1000*60*60*24));
    if (totalDays <= 0) return null;
    const expectedPct = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
    const actualPct = getOrderPct(cl.id);
    const diff = actualPct - expectedPct;
    const daysToTarget = Math.max(0, Math.round((target - today)/(1000*60*60*24)));
    if (actualPct >= 100) return { label:'Complete', color:'#166534', bg:'#f0fdf4', icon:'✓', diff:0 };
    if (diff >= 10) return { label:'Ahead', color:'#166534', bg:'#f0fdf4', icon:'▲', diff:Math.abs(diff) };
    if (diff <= -10) return { label:'Behind', color:'#b91c1c', bg:'#fef2f2', icon:'▼', diff:Math.abs(diff), daysToTarget };
    return { label:'On track', color:'#92400e', bg:'#fffbeb', icon:'→', diff:Math.abs(diff) };
  }

  const s = {
    page: { fontFamily:'Georgia,serif', minHeight:'100vh', background:'#f5f4f0', color:'#1a1a1a', padding:'1.5rem 1rem 4rem' },
    card: { background:'#fff', border:'0.5px solid #ddd', borderRadius:8, padding:'1rem 1.25rem', marginBottom:'1rem' },
    H: { fontSize:9, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:8 },
  };

  if (loading) return (
    <div style={{...s.page, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', color:'#aaa', fontStyle:'italic'}}>Loading progress…</div>
    </div>
  );

  const totalClients = clients.length;
  const completeClients = clients.filter(cl => getOrderPct(cl.id) >= 100).length;
  const overallPct = totalClients > 0
    ? Math.round(clients.reduce((a, cl) => a + getOrderPct(cl.id), 0) / totalClients)
    : 0;

  return (
    <div style={s.page}>
      <div style={{maxWidth:700, margin:'0 auto'}}>
        {/* Header */}
        <div style={{textAlign:'center', borderBottom:'1px solid #ccc', paddingBottom:'1rem', marginBottom:'1.5rem'}}>
          <div style={{fontSize:20, fontWeight:'normal', letterSpacing:'0.06em'}}>ATHENA</div>
          <div style={{fontSize:9, color:'#888', fontStyle:'italic', marginTop:3}}>
            {monthName ? `${monthName} · Progress` : 'Order Progress'}
          </div>
          {lastUpdated && (
            <div style={{fontSize:10, color:'#bbb', marginTop:4}}>
              Updated {lastUpdated.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}
            </div>
          )}
        </div>

        {/* Summary */}
        {totalClients > 0 && (
          <div style={{...s.card, marginBottom:'1.5rem'}}>
            <div style={s.H}>Month overview</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12}}>
              {[
                ['Orders', totalClients, '#1a1a1a'],
                ['Complete', completeClients, '#166534'],
                ['Overall', `${overallPct}%`, overallPct >= 85 ? '#166534' : overallPct >= 50 ? '#92400e' : '#b91c1c'],
              ].map(([l,v,c]) => (
                <div key={l} style={{background:'#f5f4f0', borderRadius:6, padding:'8px 10px', textAlign:'center'}}>
                  <div style={{fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3}}>{l}</div>
                  <div style={{fontSize:20, fontWeight:'bold', color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{height:10, background:'#eee', borderRadius:5, overflow:'hidden'}}>
              <div style={{height:'100%', width:`${overallPct}%`, background: overallPct>=85?'#1D9E75': overallPct>=50?'#d97706':'#dc2626', borderRadius:5, transition:'width 0.4s'}}/>
            </div>
          </div>
        )}

        {/* Client order cards */}
        {clients.length === 0 ? (
          <div style={{...s.card, textAlign:'center', color:'#aaa', fontStyle:'italic', padding:'3rem'}}>
            No client orders this month
          </div>
        ) : clients.map(cl => {
          const tasks = clientTasks[cl.id] || [];
          const totalTasks = tasks.length;
          const doneTasks = tasks.filter(t => t.done).length;
          const pct = getOrderPct(cl.id);
          const isComplete = pct >= 100 && totalTasks > 0;
          const status = getOrderStatus(cl);

          // Phases breakdown
          const phases = {};
          tasks.forEach(t => {
            const ph = t.phase || 'Other';
            if (!phases[ph]) phases[ph] = { total:0, done:0 };
            phases[ph].total++;
            if (t.done) phases[ph].done++;
          });

          // Auto-minimise if complete, unless manually expanded
          const isOpen = expanded[cl.id] !== undefined ? expanded[cl.id] : !isComplete;

          return (
            <div key={cl.id} style={{
              background:'#fff',
              border:'0.5px solid #ddd',
              borderRadius:8,
              marginBottom:'1rem',
              borderLeft:`3px solid ${cl.col}`,
              overflow:'hidden',
              opacity: isComplete ? 0.85 : 1,
            }}>
              {/* Card header — always visible, click to expand/collapse */}
              <div
                style={{padding:'0.85rem 1rem', cursor:'pointer', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}
                onClick={() => setExpanded(p => ({...p, [cl.id]: !isOpen}))}
              >
                <Dot c={cl.col} s={10}/>
                <span style={{fontSize:15, fontWeight:'bold', flex:1, minWidth:120}}>{cl.name || 'Unnamed'}</span>

                {/* Status badge */}
                {status && (
                  <span style={{
                    fontSize:11, padding:'3px 9px', borderRadius:4,
                    background:status.bg, color:status.color,
                    border:`0.5px solid ${status.color}44`,
                    fontWeight:'bold', whiteSpace:'nowrap'
                  }}>
                    {status.icon} {status.label}
                    {status.diff > 0 && status.label !== 'Complete' ? ` (${status.diff}%)` : ''}
                  </span>
                )}

                {/* Progress pill */}
                <div style={{display:'flex', alignItems:'center', gap:8, minWidth:160}}>
                  <div style={{flex:1, height:8, background:'#eee', borderRadius:4, overflow:'hidden', minWidth:80}}>
                    <div style={{
                      height:'100%',
                      width:`${pct}%`,
                      background: isComplete ? '#1D9E75' : status?.color === '#b91c1c' ? '#dc2626' : cl.col,
                      borderRadius:4,
                      transition:'width 0.4s'
                    }}/>
                  </div>
                  <span style={{fontSize:13, fontWeight:'bold', color: isComplete?'#166534':'#1a1a1a', minWidth:36, textAlign:'right'}}>
                    {pct}%
                  </span>
                </div>

                <span style={{fontSize:10, color:'#bbb'}}>{isOpen?'▲':'▼'}</span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{padding:'0 1rem 1rem'}}>
                  {/* Task count + due date */}
                  <div style={{fontSize:11, color:'#aaa', marginBottom:10, display:'flex', gap:12, flexWrap:'wrap'}}>
                    <span>{doneTasks} / {totalTasks} tasks done</span>
                    {cl.date && <span>Due: {cl.date}</span>}
                    {cl.targetDate && (
                      <span>Target: {new Date(cl.targetDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                    )}
                    {status?.daysToTarget !== undefined && (
                      <span style={{color: status.color, fontWeight:'bold'}}>
                        {status.daysToTarget} day{status.daysToTarget!==1?'s':''} to deadline
                      </span>
                    )}
                  </div>

                  {/* Phase breakdown */}
                  <div style={{display:'flex', flexDirection:'column', gap:5}}>
                    {Object.entries(phases).map(([ph, {total, done}]) => {
                      const phPct = total > 0 ? Math.round(done/total*100) : 0;
                      const phDone = phPct >= 100;
                      return (
                        <div key={ph} style={{display:'flex', alignItems:'center', gap:8}}>
                          <span style={{
                            fontSize:11, minWidth:160, color: phDone ? '#166534' : '#555',
                            textDecoration: phDone ? 'none' : 'none',
                            opacity: phDone ? 0.7 : 1,
                          }}>
                            {phDone ? '✓ ' : ''}{ph}
                          </span>
                          <div style={{flex:1, height:5, background:'#eee', borderRadius:3, overflow:'hidden'}}>
                            <div style={{height:'100%', width:`${phPct}%`, background: phDone ? '#1D9E75' : cl.col, borderRadius:3, transition:'width 0.3s', opacity: phDone ? 0.6 : 1}}/>
                          </div>
                          <span style={{fontSize:10, color:'#aaa', minWidth:50, textAlign:'right'}}>{done}/{total}</span>
                        </div>
                      );
                    })}
                  </div>

                  {isComplete && (
                    <div style={{marginTop:10, padding:'6px 10px', background:'#f0fdf4', borderRadius:4, border:'0.5px solid #bbf7d0', fontSize:11, color:'#166534', fontWeight:'bold', textAlign:'center'}}>
                      ✓ All tasks complete
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div style={{textAlign:'center', fontStyle:'italic', color:'#ccc', fontSize:10, marginTop:'2rem', paddingTop:'1rem', borderTop:'0.5px solid #eee', letterSpacing:'0.05em'}}>
          Discipline in the process. Excellence is Athena's reward.
        </div>
      </div>
    </div>
  );
}
