import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { ROLE_DEFS, QTYS, UNIT_TYPES, getQty, rColor, rLabel, genClientTasks, genMgmtTasks, genWsTasks } from './data.js';
import Progress from './Progress.jsx';

const COLORS = ['#1D9E75','#7F77DD','#D85A30','#378ADD','#D4537E','#BA7517','#639922','#E24B4A','#0F6E56'];
const PASSWORD = 'Ath3na-W0rk5h0p!';

function Dot({ c, s=9 }) {
  return <span style={{width:s,height:s,borderRadius:'50%',background:c,display:'inline-block',flexShrink:0}}/>;
}

async function apiLoad() {
  const r = await fetch('/api/state', { headers: { 'x-athena-password': PASSWORD } });
  if (!r.ok) throw new Error('Auth failed');
  return r.json();
}
async function apiSave(data) {
  await fetch('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-athena-password': PASSWORD },
    body: JSON.stringify(data),
  });
}

// Ad hoc task row — checkbox, goes grey when done
const AdHocRow = memo(function AdHocRow({ t, src, activeRoles, onSet, budgets, assignedMins, onDelete }) {
  const isDone = t.done, isAssigned = !!t.assignedRole;
  const sc = rColor(t.sugRole), ac = rColor(t.assignedRole);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 0',borderBottom:'0.4px solid #f0f0f0',opacity:isDone?0.4:1,flexWrap:'wrap'}}>
      <input type="checkbox" checked={!!isDone} onChange={()=>onSet(src,t.id,{done:!isDone,assignedRole:isDone?t.assignedRole:null})}
        style={{width:18,height:18,cursor:'pointer',flexShrink:0}}/>
      <span style={{flex:1,fontSize:13,textDecoration:isDone?'line-through':'none',minWidth:100}}>{t.n}</span>
      <span style={{fontSize:11,color:'#bbb',minWidth:34,textAlign:'right'}}>{t.m}m</span>
      {!isAssigned&&!isDone&&<span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:sc+'18',color:sc,border:`0.5px solid ${sc}44`,whiteSpace:'nowrap'}}>{rLabel(t.sugRole)}</span>}
      {!isDone&&(isAssigned ? (
        <button onClick={()=>onSet(src,t.id,{assignedRole:null})}
          style={{fontSize:11,padding:'3px 10px',border:`1.5px solid ${ac}`,borderRadius:4,background:ac,color:'#fff',cursor:'pointer',fontFamily:'Georgia,serif',whiteSpace:'nowrap'}}>
          {rLabel(t.assignedRole)} ✓
        </button>
      ) : (
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {activeRoles.map(rd=>{
            const budget=budgets?.[rd.key]||0, used=assignedMins?.[rd.key]||0, atCap=budget>0&&used>=budget-5;
            return (
              <button key={rd.key} onClick={()=>onSet(src,t.id,{assignedRole:rd.key})}
                style={{fontSize:11,padding:'3px 9px',borderRadius:4,border:atCap?'1.5px solid #dc2626':'0.5px solid '+rd.color+'66',background:atCap?'#fef2f2':rd.key===t.sugRole?rd.color+'22':'transparent',color:atCap?'#b91c1c':rd.color,cursor:'pointer',fontFamily:'Georgia,serif',whiteSpace:'nowrap',fontWeight:atCap?'bold':'normal'}}>
                {rLabel(rd.key)}{atCap?' ⚠':''}
              </button>
            );
          })}
        </div>
      ))}
      <button onClick={onDelete} style={{fontSize:11,padding:'3px 8px',border:'0.5px solid #fca5a5',borderRadius:4,background:'#fff',color:'#b91c1c',cursor:'pointer',fontFamily:'Georgia,serif',flexShrink:0}}>×</button>
    </div>
  );
});

// Count-based task row — number input for monthly tally, role assignment
const CountTaskRow = memo(function CountTaskRow({ t, src, activeRoles, onSet, budgets, assignedMins }) {
  const isAssigned = !!t.assignedRole;
  const count = t.count || 0;
  const ac = rColor(t.assignedRole), sc = rColor(t.sugRole);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 0',borderBottom:'0.4px solid #f0f0f0',flexWrap:'wrap'}}>
      <span style={{flex:1,fontSize:13,minWidth:120}}>{t.n}</span>
      {t.needsTime ? (
        <input type="number" placeholder="mins" defaultValue="" min="1"
          style={{width:58,padding:'4px 6px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:13}}
          onBlur={e=>{const v=parseInt(e.target.value);if(v>0)onSet(src,t.id,{m:v,needsTime:false});}}/>
      ) : (
        <span style={{fontSize:11,color:'#bbb',minWidth:34,textAlign:'right'}}>{t.m}m</span>
      )}
      <div style={{display:'flex',alignItems:'center',gap:4}}>
        <label style={{fontSize:11,color:'#888',whiteSpace:'nowrap'}}>Done:</label>
        <input type="number" value={count} min="0" max="99"
          style={{width:52,padding:'4px 6px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:13,textAlign:'center'}}
          onChange={e=>onSet(src,t.id,{count:Math.max(0,parseInt(e.target.value)||0)})}/>
        {count>0&&<span style={{fontSize:10,color:'#aaa'}}>{(count*(t.m||0)/60).toFixed(1)}h</span>}
      </div>
      {!isAssigned&&<span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:sc+'18',color:sc,border:`0.5px solid ${sc}44`,whiteSpace:'nowrap'}}>{rLabel(t.sugRole)}</span>}
      {isAssigned ? (
        <button onClick={()=>onSet(src,t.id,{assignedRole:null})}
          style={{fontSize:11,padding:'3px 10px',border:`1.5px solid ${ac}`,borderRadius:4,background:ac,color:'#fff',cursor:'pointer',fontFamily:'Georgia,serif',whiteSpace:'nowrap'}}>
          {rLabel(t.assignedRole)} ✓
        </button>
      ) : (
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {activeRoles.map(rd=>{
            const budget=budgets?.[rd.key]||0, used=assignedMins?.[rd.key]||0, atCap=budget>0&&used>=budget-5;
            return (
              <button key={rd.key} onClick={()=>{if(t.needsTime){alert('Enter time first.');return;}onSet(src,t.id,{assignedRole:rd.key});}}
                style={{fontSize:11,padding:'3px 9px',borderRadius:4,border:atCap?'1.5px solid #dc2626':'0.5px solid '+rd.color+'66',background:atCap?'#fef2f2':rd.key===t.sugRole?rd.color+'22':'transparent',color:atCap?'#b91c1c':rd.color,cursor:'pointer',fontFamily:'Georgia,serif',whiteSpace:'nowrap',fontWeight:atCap?'bold':'normal'}}>
                {rLabel(rd.key)}{atCap?' ⚠':''}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// Count-based collapsible section
const CountSection = memo(function CountSection({ title, color, tasks, src, activeRoles, onSet, budgets, assignedMins, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:'1rem',borderLeft:`3px solid ${color||'#888'}`,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>setOpen(p=>!p)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Dot c={color||'#888'}/><span style={{fontSize:14,fontWeight:'bold'}}>{title}</span>
          <span style={{fontSize:11,color:'#aaa'}}>{tasks.length} tasks</span>
        </div>
        <span style={{fontSize:11,color:'#888'}}>{open?'▲':'▼'}</span>
      </div>
      {open&&<div style={{padding:'0 1rem 0.75rem'}}>
        {tasks.map(t=><CountTaskRow key={t.id} t={t} src={src} activeRoles={activeRoles} onSet={onSet} budgets={budgets} assignedMins={assignedMins}/>)}
        {children}
      </div>}
    </div>
  );
});

// Client task row — checkbox based
const TaskRow = memo(function TaskRow({ t, src, activeRoles, onSet, budgets, assignedMins }) {
  const isDone=t.done, isAssigned=!!t.assignedRole;
  const sc=rColor(t.sugRole), ac=rColor(t.assignedRole);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 0',borderBottom:'0.4px solid #f0f0f0',opacity:isDone?0.4:1,flexWrap:'wrap'}}>
      <input type="checkbox" checked={!!isDone} onChange={()=>onSet(src,t.id,{done:!isDone,assignedRole:isDone?t.assignedRole:null})}
        style={{width:18,height:18,cursor:'pointer',flexShrink:0}}/>
      <span style={{flex:1,fontSize:13,textDecoration:isDone?'line-through':'none',minWidth:100}}>{t.n}</span>
      <span style={{fontSize:11,color:'#bbb',minWidth:34,textAlign:'right'}}>{t.m}m</span>
      {!isAssigned&&!isDone&&<span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:sc+'18',color:sc,border:`0.5px solid ${sc}44`,whiteSpace:'nowrap'}}>{rLabel(t.sugRole)}</span>}
      {!isDone&&(isAssigned ? (
        <button onClick={()=>onSet(src,t.id,{assignedRole:null})}
          style={{fontSize:11,padding:'3px 10px',border:`1.5px solid ${ac}`,borderRadius:4,background:ac,color:'#fff',cursor:'pointer',fontFamily:'Georgia,serif',whiteSpace:'nowrap'}}>
          {rLabel(t.assignedRole)} ✓
        </button>
      ) : (
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {activeRoles.map(rd=>{
            const budget=budgets?.[rd.key]||0, used=assignedMins?.[rd.key]||0, atCap=budget>0&&used>=budget-5;
            return (
              <button key={rd.key} onClick={()=>onSet(src,t.id,{assignedRole:rd.key})}
                style={{fontSize:11,padding:'3px 9px',borderRadius:4,border:atCap?'1.5px solid #dc2626':'0.5px solid '+rd.color+'66',background:atCap?'#fef2f2':rd.key===t.sugRole?rd.color+'22':'transparent',color:atCap?'#b91c1c':rd.color,cursor:'pointer',fontFamily:'Georgia,serif',whiteSpace:'nowrap',fontWeight:atCap?'bold':'normal'}}>
                {rLabel(rd.key)}{atCap?' ⚠':''}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

// Client order collapsible section — auto-minimises when 100% done
const ClientSection = memo(function ClientSection({ title, color, tasks, src, activeRoles, onSet, showDone, budgets, assignedMins, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  const visible = tasks.filter(t=>showDone||!t.done);
  return (
    <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:'1rem',borderLeft:`3px solid ${color||'#888'}`,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>setOpen(p=>!p)}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Dot c={color||'#888'}/><span style={{fontSize:14,fontWeight:'bold'}}>{title}</span>
          <span style={{fontSize:11,color:'#aaa'}}>{visible.length} tasks</span>
        </div>
        <span style={{fontSize:11,color:'#888'}}>{open?'▲':'▼'}</span>
      </div>
      {open&&<div style={{padding:'0 1rem 0.75rem'}}>
        {visible.map(t=><TaskRow key={t.id} t={t} src={src} activeRoles={activeRoles} onSet={onSet} budgets={budgets} assignedMins={assignedMins}/>)}
        {children}
      </div>}
    </div>
  );
});

// Overhead countdown bar component
function OverheadBar({ label, color, budgetHrs, doneMins, adHocMins }) {
  const budgetMins = (parseFloat(budgetHrs)||0) * 60;
  const totalUsed = doneMins + adHocMins;
  const remaining = Math.max(0, budgetMins - totalUsed);
  const pct = budgetMins > 0 ? Math.min(100, Math.round(totalUsed / budgetMins * 100)) : 0;
  const over = budgetMins > 0 && totalUsed > budgetMins;
  return (
    <div style={{background:'#fff',border:`0.5px solid ${over?'#dc2626':'#ddd'}`,borderLeft:`3px solid ${color}`,borderRadius:8,padding:'0.85rem 1rem',marginBottom:'1rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div>
          <div style={{fontSize:9,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.07em',color:'#888',marginBottom:2}}>{label}</div>
          <div style={{fontSize:11,color:'#aaa'}}>
            {(doneMins/60).toFixed(1)}h tasks + {(adHocMins/60).toFixed(1)}h ad hoc = {(totalUsed/60).toFixed(1)}h used
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:20,fontWeight:'bold',color:over?'#b91c1c':pct>=90?'#92400e':'#166534'}}>
            {over ? `-${((totalUsed-budgetMins)/60).toFixed(1)}h` : `${(remaining/60).toFixed(1)}h`}
          </div>
          <div style={{fontSize:10,color:'#aaa'}}>{over?'over budget':'remaining'}</div>
        </div>
      </div>
      <div style={{height:8,background:'#f0f0f0',borderRadius:4,overflow:'hidden',marginBottom:4}}>
        <div style={{height:'100%',width:`${pct}%`,background:over?'#dc2626':pct>=90?'#d97706':color,borderRadius:4,transition:'width 0.4s'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#bbb'}}>
        <span>{pct}% used</span>
        <span>{budgetMins>0?`${(budgetMins/60).toFixed(1)}h budget`:'No budget set'}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [authed] = useState(true);
  const [mode, setMode] = useState('plan');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const saveTimer = useRef(null);

  const [activeKeys, setActiveKeys] = useState(['manager','maker1','assistant']);
  const [monthName, setMonthName] = useState('');
  const [workingDays, setWorkingDays] = useState(21);
  const [holiday, setHoliday] = useState({manager:0,maker1:0,maker2:0,painter:0,assistant:0});
  const [mgmtOverheadBudget, setMgmtOverheadBudget] = useState(0);
  const [wsOverheadBudget, setWsOverheadBudget] = useState(0);
  const [absence, setAbsence] = useState([]);
  const [clients, setClients] = useState([]);
  const [cCount, setCCount] = useState(0);
  const [dayDate, setDayDate] = useState('');
  const [showDone, setShowDone] = useState(true);
  const [dayHrs, setDayHrs] = useState({manager:0,maker1:0,maker2:0,painter:0,assistant:0});
  const [mgmtTasks, setMgmtTasks] = useState(()=>genMgmtTasks());
  const [wsTasks, setWsTasks] = useState(()=>genWsTasks());
  const [clientTasks, setClientTasks] = useState({});
  const [extraTasks, setExtraTasks] = useState([]);       // production ad hoc
  const [newExtra, setNewExtra] = useState({n:'',m:30});
  const [mgmtExtraTasks, setMgmtExtraTasks] = useState([]); // management ad hoc
  const [newMgmtExtra, setNewMgmtExtra] = useState({n:'',m:30});
  const [activeSheet, setActiveSheet] = useState(null);

  const activeRoles = ROLE_DEFS.filter(r=>activeKeys.includes(r.key));

  useEffect(() => {
    apiLoad().then(s => {
      if (s.monthName) setMonthName(s.monthName);
      if (s.workingDays) setWorkingDays(s.workingDays);
      if (s.activeKeys) setActiveKeys(s.activeKeys);
      if (s.holiday) setHoliday(s.holiday);
      if (s.mgmtOverheadBudget !== undefined) setMgmtOverheadBudget(s.mgmtOverheadBudget);
      if (s.wsOverheadBudget !== undefined) setWsOverheadBudget(s.wsOverheadBudget);
      if (s.clients) setClients(s.clients);
      if (s.cCount) setCCount(s.cCount);
      if (s.absence) setAbsence(s.absence);
      if (s.dayDate) setDayDate(s.dayDate);
      if (s.dayHrs) setDayHrs(s.dayHrs);
      if (s.mgmtTasks) setMgmtTasks(s.mgmtTasks);
      if (s.wsTasks) setWsTasks(s.wsTasks);
      if (s.clientTasks) setClientTasks(s.clientTasks);
      if (s.extraTasks) setExtraTasks(s.extraTasks);
      if (s.mgmtExtraTasks) setMgmtExtraTasks(s.mgmtExtraTasks);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { monthName,workingDays,activeKeys,holiday,mgmtOverheadBudget,wsOverheadBudget,clients,cCount,absence,dayDate,dayHrs,mgmtTasks,wsTasks,clientTasks,extraTasks,mgmtExtraTasks };
  });

  const triggerSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    setSaveMsg('Saving…');
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await apiSave(stateRef.current);
      setSaving(false);
      setSaveMsg('✓ Saved');
      setTimeout(()=>setSaveMsg(''),3000);
    }, 1500);
  }, []);

  useEffect(()=>{ if(!loading) triggerSave(); }, [monthName,workingDays,activeKeys,holiday,mgmtOverheadBudget,wsOverheadBudget,clients,cCount,absence,dayDate,dayHrs,mgmtTasks,wsTasks,clientTasks,extraTasks,mgmtExtraTasks]);

  function getMonthHrs(key) {
    const rd = ROLE_DEFS.find(r=>r.key===key); if(!rd) return 0;
    const dpw = rd.daysPerWeek||5;
    return Math.max(0, rd.stdDay*(workingDays*dpw/5) - (parseFloat(holiday[key])||0));
  }

  const totalAvail = activeKeys.reduce((a,k)=>a+getMonthHrs(k)*60,0);
  const absenceMins = absence.reduce((a,u)=>a+(parseFloat(u.hrs)||0)*60,0);
  const mgmtBudgetMins = (parseFloat(mgmtOverheadBudget)||0)*60;
  const wsBudgetMins = (parseFloat(wsOverheadBudget)||0)*60;
  const totalOverheadBudget = mgmtBudgetMins + wsBudgetMins;

  // Overhead consumed: count × task minutes
  const mgmtDoneMins = mgmtTasks.reduce((a,t)=>a+(t.count||0)*(t.m||0),0);
  const wsDoneMins = wsTasks.reduce((a,t)=>a+(t.count||0)*(t.m||0),0);
  const mgmtAdHocMins = mgmtExtraTasks.filter(t=>t.done).reduce((a,t)=>a+(t.m||0),0);
  // Workshop ad hoc (incl. MDF priming) counts against workshop overhead, not production
  const wsAdHocMins = extraTasks.filter(t=>t.done).reduce((a,t)=>a+(t.m||0),0);

  // Production capacity: total minus overhead budgets minus absence only
  const prodAvail = Math.max(0, totalAvail - totalOverheadBudget - absenceMins);

  const totalOrder = clients.reduce((a,cl)=>{
    const tasks = genClientTasks(cl);
    return a + tasks.reduce((s,t)=>s+(t.m||0),0);
  },0);
  const capPct = prodAvail>0 ? Math.round(totalOrder/prodAvail*100) : 0;
  const atCap=capPct>=100, nearCap=capPct>=85;
  const remain = prodAvail-totalOrder;

  function getOrderPct(clId) {
    const tasks = clientTasks[clId]||[];
    if(!tasks.length) return 0;
    return Math.round(tasks.filter(t=>t.done).length / tasks.length * 100);
  }

  function getOrderStatus(cl) {
    if(!cl.targetDate||!monthName) return null;
    const target = new Date(cl.targetDate);
    if(isNaN(target)) return null;
    const today = new Date();
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const daysInMonth = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
    const daysElapsed = Math.max(0, Math.min(daysInMonth, Math.round((today-monthStart)/(1000*60*60*24))));
    const daysToTarget = Math.max(0, Math.round((target-today)/(1000*60*60*24)));
    const totalDays = Math.round((target-monthStart)/(1000*60*60*24));
    if(totalDays<=0) return null;
    const expectedPct = Math.min(100, Math.round((daysElapsed/totalDays)*100));
    const actualPct = getOrderPct(cl.id);
    const diff = actualPct - expectedPct;
    if(actualPct>=100) return {label:'Complete',color:'#166534',bg:'#f0fdf4',icon:'✓'};
    if(diff>=10) return {label:'Ahead',color:'#166534',bg:'#f0fdf4',icon:'▲',diff:Math.abs(diff)};
    if(diff<=-10) return {label:'Behind',color:'#b91c1c',bg:'#fef2f2',icon:'▼',diff:Math.abs(diff),daysToTarget};
    return {label:'On track',color:'#92400e',bg:'#fffbeb',icon:'→',diff:Math.abs(diff)};
  }

  const addClient = ()=>{ if(atCap)return; const col=COLORS[clients.length%COLORS.length]; setClients(p=>[...p,{id:cCount,col,name:'',date:'',targetDate:'',unitType:'painted',qtys:Object.fromEntries(QTYS.map(([q])=>[q,0])),bespoke:[]}]); setCCount(p=>p+1); };
  const uCl=(id,f,v)=>setClients(p=>p.map(c=>c.id===id?{...c,[f]:v}:c));
  const uQty=(id,q,v)=>setClients(p=>p.map(c=>c.id===id?{...c,qtys:{...c.qtys,[q]:parseInt(v)||0}}:c));
  const delCl=(id)=>{ setClients(p=>p.filter(c=>c.id!==id)); setClientTasks(p=>{const n={...p};delete n[id];return n;}); };
  const addB=(id)=>setClients(p=>p.map(c=>c.id===id?{...c,bespoke:[...c.bespoke,{desc:'',mins:60}]}:c));
  const uB=(id,i,f,v)=>setClients(p=>p.map(c=>{if(c.id!==id)return c;const b=[...c.bespoke];b[i]={...b[i],[f]:f==='mins'?parseInt(v)||0:v};return{...c,bespoke:b};}));
  const addAbs=()=>setAbsence(p=>[...p,{desc:'',hrs:0}]);
  const uAbs=(i,f,v)=>setAbsence(p=>p.map((u,j)=>j===i?{...u,[f]:v}:u));
  const delAbs=(i)=>setAbsence(p=>p.filter((_,j)=>j!==i));

  function startDaily() {
    const existM=Object.fromEntries(mgmtTasks.map(t=>[t.id,t]));
    setMgmtTasks(genMgmtTasks().map(t=>existM[t.id]
      ? {...t,m:existM[t.id].m,needsTime:existM[t.id].needsTime,assignedRole:existM[t.id].assignedRole,count:existM[t.id].count||0}
      : t));
    const existW=Object.fromEntries(wsTasks.map(t=>[t.id,t]));
    setWsTasks(genWsTasks().map(t=>existW[t.id]
      ? {...t,assignedRole:existW[t.id].assignedRole,count:existW[t.id].count||0}
      : t));
    const nct={};
    for(const cl of clients){
      const fresh=genClientTasks(cl);
      const exist=Object.fromEntries((clientTasks[cl.id]||[]).map(t=>[t.id,t]));
      nct[cl.id]=fresh.map(t=>exist[t.id]?{...t,assignedRole:exist[t.id].assignedRole,done:exist[t.id].done}:t);
    }
    setClientTasks(nct);
    setMode('daily');
    setActiveSheet(null);
  }

  const setTaskProp = useCallback((src,id,props)=>{
    if(src==='mgmt') setMgmtTasks(p=>p.map(t=>t.id===id?{...t,...props}:t));
    else if(src==='ws') setWsTasks(p=>p.map(t=>t.id===id?{...t,...props}:t));
    else if(src==='extra') setExtraTasks(p=>p.map(t=>t.id===id?{...t,...props}:t));
    else if(src==='mgmtExtra') setMgmtExtraTasks(p=>p.map(t=>t.id===id?{...t,...props}:t));
    else setClientTasks(p=>({...p,[src]:(p[src]||[]).map(t=>t.id===id?{...t,...props}:t)}));
  },[]);

  function getAssignedMins(k) {
    let m=0;
    // Count tasks: assigned to person, 1 unit of their time per task (for daily budget tracking)
    [...mgmtTasks,...wsTasks].filter(t=>t.assignedRole===k).forEach(t=>m+=(t.m||0));
    [...extraTasks,...mgmtExtraTasks].filter(t=>t.assignedRole===k&&!t.done).forEach(t=>m+=t.m||0);
    Object.values(clientTasks).forEach(ts=>ts.filter(t=>t.assignedRole===k&&!t.done).forEach(t=>m+=t.m||0));
    return m;
  }

  function getPersonTasks(k) {
    const tasks=[];
    [...mgmtTasks,...wsTasks].filter(t=>t.assignedRole===k).forEach(t=>tasks.push({...t,clientName:'Workshop / Management',clientCol:'#888'}));
    for(const cl of clients)(clientTasks[cl.id]||[]).filter(t=>t.assignedRole===k&&!t.done).forEach(t=>tasks.push({...t,clientName:cl.name||'Unnamed',clientCol:cl.col}));
    [...extraTasks,...mgmtExtraTasks].filter(t=>t.assignedRole===k&&!t.done).forEach(t=>tasks.push({...t,clientName:'Ad hoc',clientCol:'#888'}));
    return tasks;
  }

  function getPersonText(k) {
    const tasks=getPersonTasks(k); if(!tasks.length)return '';
    const total=tasks.reduce((s,t)=>s+t.m,0);
    let lines=[`ATHENA — Daily Task List`,`${rLabel(k)}${dayDate?' | '+dayDate:''}`,`Total: ${tasks.length} tasks | ${(total/60).toFixed(1)} hrs`,`═════════════════════════════════════════════════`,``];
    let cur='';
    for(const t of tasks){
      if(t.clientName!==cur){if(cur){lines.push('');lines.push('');}lines.push(t.clientName.toUpperCase());lines.push('─────────────────────────────────────────────────');cur=t.clientName;}
      lines.push(`  ☐  ${t.n}  (${t.m} min)`);lines.push('');
    }
    lines.push(`═════════════════════════════════════════════════`);
    lines.push(`Discipline in the process. Excellence is Athena's reward.`);
    return lines.join('\n');
  }

  const budgets = Object.fromEntries(activeRoles.map(rd=>([rd.key,(parseFloat(dayHrs[rd.key])||0)*60])));
  const assignedMins = Object.fromEntries(activeRoles.map(rd=>([rd.key,getAssignedMins(rd.key)])));

  const C={fontFamily:'Georgia,serif',fontSize:13,background:'#f5f4f0',minHeight:'100vh',color:'#1a1a1a'};
  const card={background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'1rem 1.25rem',marginBottom:'1rem'};
  const H={fontSize:9,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.07em',color:'#888',marginBottom:8};
  const inp={width:'100%',padding:'6px 8px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:16,background:'#fff'};
  const btn={padding:'8px 16px',border:'0.5px solid #999',borderRadius:4,background:'#fff',fontFamily:'Georgia,serif',fontSize:13,cursor:'pointer'};
  const btnP={padding:'10px 22px',border:'none',borderRadius:4,background:'#1a1a1a',color:'#fff',fontFamily:'Georgia,serif',fontSize:13,cursor:'pointer'};
  const lbl={fontSize:11,color:'#888',display:'block',marginBottom:3};
  const capCol=atCap?'#b91c1c':nearCap?'#92400e':'#166534';
  const barCol=atCap?'#dc2626':nearCap?'#d97706':'#1D9E75';

  if (loading) return <div style={{fontFamily:'Georgia,serif',textAlign:'center',padding:'3rem',color:'#aaa'}}>Loading Athena…</div>;
  if (mode==='progress') return (
    <div>
      <div style={{position:'fixed',top:0,right:0,zIndex:100,padding:'0.5rem 0.75rem'}}>
        <button onClick={()=>setMode('daily')} style={{...btn,fontSize:11,padding:'4px 12px',background:'#1a1a1a',color:'#fff',border:'none'}}>← Back</button>
      </div>
      <Progress clients={clients} clientTasks={clientTasks} monthName={monthName} getOrderStatus={getOrderStatus} getOrderPct={getOrderPct}/>
    </div>
  );

  return (
    <div style={C}>
    <div style={{maxWidth:940,margin:'0 auto',padding:'1.5rem 1rem 4rem'}}>
      <div style={{textAlign:'center',borderBottom:'1px solid #ccc',paddingBottom:'1rem',marginBottom:'1.5rem'}}>
        <div style={{fontSize:20,fontWeight:'normal',letterSpacing:'0.06em'}}>ATHENA</div>
        <div style={{fontSize:9,color:'#888',fontStyle:'italic',marginTop:3}}>Patron of the Artisan · Work Scheduler</div>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:'1rem',background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:4}}>
        {[['plan','1 · Plan'],['daily','2 · Dispatch'],['sheets','3 · Sheets'],['progress','4 · Progress']].map(([m,l])=>(
          <button key={m} onClick={()=>m==='daily'?startDaily():setMode(m)}
            style={{flex:1,padding:'10px 4px',border:'none',borderRadius:6,background:mode===m?'#1a1a1a':'transparent',color:mode===m?'#fff':'#888',fontFamily:'Georgia,serif',fontSize:12,cursor:'pointer',fontWeight:mode===m?'bold':'normal'}}>{l}</button>
        ))}
      </div>

      <div style={{marginBottom:'1rem'}}>
        <span style={{fontSize:11,color:saving?'#888':saveMsg.startsWith('✓')?'#166534':'#bbb'}}>{saveMsg||'Auto-saves to cloud'}</span>
      </div>

      {mode==='plan'&&<>
        <div style={card}>
          <div style={H}>Month setup</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={lbl}>Month</label><input value={monthName} onChange={e=>setMonthName(e.target.value)} placeholder="e.g. May 2026" style={inp}/></div>
            <div><label style={lbl}>Working days</label><input type="number" value={workingDays} min="1" max="31" onChange={e=>setWorkingDays(parseInt(e.target.value)||0)} style={inp}/></div>
          </div>
        </div>

        <div style={card}>
          <div style={H}>Team this month</div>
          {ROLE_DEFS.map(rd=>{
            const active=activeKeys.includes(rd.key);
            return(
              <div key={rd.key} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:`0.5px solid ${active?'#ddd':'#eee'}`,borderRadius:6,marginBottom:6,background:active?'#fff':'#fafaf8',opacity:active?1:0.5,flexWrap:'wrap'}}>
                <input type="checkbox" checked={active} onChange={e=>setActiveKeys(p=>e.target.checked?[...p,rd.key]:p.filter(k=>k!==rd.key))} style={{width:18,height:18}}/>
                <Dot c={rd.color}/><span style={{fontSize:13,minWidth:150}}>{rd.label}</span>
                <span style={{fontSize:11,color:'#aaa',minWidth:60}}>{rd.stdDay}h/day{rd.daysPerWeek?` · ${rd.daysPerWeek}d/wk`:''}</span>
                {active&&<>
                  <label style={{fontSize:11,color:'#888',whiteSpace:'nowrap'}}>Holiday (hrs):</label>
                  <input type="number" value={holiday[rd.key]} min="0" step="0.5" onChange={e=>setHoliday(p=>({...p,[rd.key]:parseFloat(e.target.value)||0}))}
                    style={{width:60,padding:'4px 6px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:16}}/>
                  <span style={{fontSize:13,fontWeight:'bold',color:'#1a1a1a'}}>{getMonthHrs(rd.key).toFixed(1)}h</span>
                </>}
              </div>
            );
          })}
          <div style={{marginTop:8,fontSize:12,color:'#888',paddingTop:8,borderTop:'0.5px solid #eee'}}>
            Total available: <strong style={{color:'#1a1a1a'}}>{(totalAvail/60).toFixed(1)}h</strong>
          </div>
        </div>

        <div style={card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={H}>Absence</div>
            <button onClick={addAbs} style={{...btn,padding:'3px 10px',fontSize:12}}>+ Add</button>
          </div>
          {absence.length===0&&<div style={{fontSize:12,color:'#bbb',fontStyle:'italic'}}>No absence recorded this month.</div>}
          {absence.map((u,i)=>(
            <div key={i} style={{display:'flex',gap:5,marginBottom:5,alignItems:'center'}}>
              <input placeholder="e.g. Maker off sick" value={u.desc} onChange={e=>uAbs(i,'desc',e.target.value)} style={{...inp,flex:1}}/>
              <input type="number" value={u.hrs} min="0" step="0.5" onChange={e=>uAbs(i,'hrs',e.target.value)} style={{width:52,padding:'4px 5px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:16}}/>
              <span style={{fontSize:11,color:'#888'}}>h</span>
              <button onClick={()=>delAbs(i)} style={{...btn,padding:'3px 8px',fontSize:12,color:'#b91c1c',borderColor:'#fca5a5'}}>×</button>
            </div>
          ))}
          {absence.length>0&&<div style={{fontSize:11,color:'#888',marginTop:4}}>Deducted from capacity: <strong>{(absenceMins/60).toFixed(1)}h</strong></div>}
        </div>

        <div style={card}>
          <div style={H}>Monthly overhead budgets</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
            <div>
              <label style={lbl}>Management overhead (hrs)</label>
              <input type="number" value={mgmtOverheadBudget} min="0" step="0.5"
                onChange={e=>setMgmtOverheadBudget(parseFloat(e.target.value)||0)} style={inp}/>
              <div style={{fontSize:11,color:'#aaa',marginTop:3}}>Covers all management tasks this month</div>
            </div>
            <div>
              <label style={lbl}>Workshop overhead (hrs)</label>
              <input type="number" value={wsOverheadBudget} min="0" step="0.5"
                onChange={e=>setWsOverheadBudget(parseFloat(e.target.value)||0)} style={inp}/>
              <div style={{fontSize:11,color:'#aaa',marginTop:3}}>Covers workshop & maintenance tasks</div>
            </div>
          </div>
          <div style={{fontSize:12,color:'#888',paddingTop:8,borderTop:'0.5px solid #eee'}}>
            Total overhead: <strong style={{color:'#1a1a1a'}}>{(totalOverheadBudget/60).toFixed(1)}h</strong>
            &nbsp;·&nbsp;Deducted from production capacity
          </div>
        </div>

        <OverheadBar label="Management overhead" color="#7F77DD" budgetHrs={mgmtOverheadBudget} doneMins={mgmtDoneMins} adHocMins={mgmtAdHocMins}/>
        <OverheadBar label="Workshop overhead" color="#888" budgetHrs={wsOverheadBudget} doneMins={wsDoneMins} adHocMins={wsAdHocMins}/>

        <div style={{...card,borderColor:atCap?'#dc2626':nearCap?'#d97706':'#ddd',background:atCap?'#fef2f2':nearCap?'#fffbeb':'#fff'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={H}>Production capacity</div>
            <div style={{fontSize:13,fontWeight:'bold',color:capCol}}>{capPct}%</div>
          </div>
          <div style={{height:14,background:'#eee',borderRadius:7,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:`${Math.min(capPct,100)}%`,background:barCol,borderRadius:7,transition:'width 0.3s'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(115px,1fr))',gap:8}}>
            {[['Orders',clients.length,'#1a1a1a'],['Task hours',`${(totalOrder/60).toFixed(1)}h`,'#1a1a1a'],['Capacity',`${(prodAvail/60).toFixed(1)}h`,capCol],[atCap?'Over':'Headroom',`${Math.abs(remain/60).toFixed(1)}h`,capCol]].map(([l,v,c])=>(
              <div key={l} style={{background:'#f5f4f0',borderRadius:6,padding:'7px 10px'}}>
                <div style={{fontSize:10,color:'#888',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>{l}</div>
                <div style={{fontSize:16,fontWeight:'bold',color:c}}>{v}</div>
              </div>
            ))}
          </div>
          {atCap&&<div style={{marginTop:10,fontSize:12,color:'#b91c1c',fontWeight:'bold'}}>⚠ At capacity — no further orders this month.</div>}
        </div>

        {clients.map(cl=>{
          const status=getOrderStatus(cl);
          return (
            <div key={cl.id} style={{...card,borderLeft:`3px solid ${cl.col}`,padding:0}}>
              <div style={{padding:'0.75rem 1rem'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <Dot c={cl.col}/>
                    <input placeholder="Client name" value={cl.name} onChange={e=>uCl(cl.id,'name',e.target.value)} style={{fontSize:16,fontWeight:'bold',border:'none',background:'transparent',width:175,fontFamily:'Georgia,serif',outline:'none'}}/>
                    <input placeholder="Due / week" value={cl.date} onChange={e=>uCl(cl.id,'date',e.target.value)} style={{fontSize:16,border:'none',background:'transparent',color:'#888',width:115,fontFamily:'Georgia,serif',outline:'none'}}/>
                    <select value={cl.unitType||'painted'} onChange={e=>uCl(cl.id,'unitType',e.target.value)}
                      style={{fontSize:12,padding:'3px 7px',border:'0.5px solid #ddd',borderRadius:4,fontFamily:'Georgia,serif',background:'#f9f9f7',color:'#555',outline:'none'}}>
                      {UNIT_TYPES.map(ut=><option key={ut.key} value={ut.key}>{ut.label}</option>)}
                    </select>
                    <input type="date" value={cl.targetDate||''} onChange={e=>uCl(cl.id,'targetDate',e.target.value)}
                      title="Target completion date"
                      style={{fontSize:14,border:'0.5px solid #e5e7eb',background:'#f9f9f7',color:'#555',borderRadius:4,padding:'3px 6px',fontFamily:'Georgia,serif',outline:'none'}}/>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    {status&&(
                      <span style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:status.bg,color:status.color,border:`0.5px solid ${status.color}44`,whiteSpace:'nowrap',fontWeight:'bold'}}>
                        {status.icon} {status.label}
                      </span>
                    )}
                    <button onClick={()=>delCl(cl.id)} style={{...btn,color:'#b91c1c',borderColor:'#fca5a5',padding:'4px 12px',fontSize:12}}>Remove</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(105px,1fr))',gap:7,marginBottom:10}}>
                  {QTYS.map(([q,l])=>(
                    <div key={q}><label style={lbl}>{l}</label><input type="number" value={cl.qtys[q]} min="0" style={inp} onChange={e=>uQty(cl.id,q,e.target.value)}/></div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:11,color:'#888',marginBottom:5}}>Bespoke <span style={{color:'#ccc'}}>— incl. shaker door priming if needed</span></div>
                  {cl.bespoke.map((b,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 60px auto',gap:6,marginBottom:5,alignItems:'center'}}>
                      <input placeholder="e.g. Prime shaker doors" value={b.desc} style={inp} onChange={e=>uB(cl.id,i,'desc',e.target.value)}/>
                      <input type="number" value={b.mins} style={inp} onChange={e=>uB(cl.id,i,'mins',e.target.value)}/>
                      <button onClick={()=>setClients(p=>p.map(c=>c.id===cl.id?{...c,bespoke:c.bespoke.filter((_,j)=>j!==i)}:c))} style={{...btn,padding:'4px 8px',fontSize:12,color:'#b91c1c',borderColor:'#fca5a5'}}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>addB(cl.id)} style={{...btn,padding:'4px 12px',fontSize:12}}>+ Add bespoke</button>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{display:'flex',gap:8,marginTop:'0.5rem',flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={addClient} disabled={atCap} style={{...btn,opacity:atCap?0.4:1}}>{atCap?'⚠ At capacity':'+ Add client order'}</button>
          {clients.length>0&&<button onClick={startDaily} style={btnP}>Go to daily dispatch →</button>}
        </div>
      </>}

      {mode==='daily'&&<>
        <div style={card}>
          <div style={H}>Day setup</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div><label style={lbl}>Date</label><input value={dayDate} onChange={e=>setDayDate(e.target.value)} placeholder="e.g. 01 May 2026" style={inp}/></div>
            <div style={{paddingTop:20}}>
              <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#555',cursor:'pointer'}}>
                <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} style={{width:18,height:18}}/>
                Show completed tasks
              </label>
            </div>
          </div>
          <div style={H}>Hours available today</div>
          <div style={{display:'grid',gap:6}}>
            {activeRoles.map(rd=>{
              const assigned=getAssignedMins(rd.key);
              const budget=(parseFloat(dayHrs[rd.key])||0)*60;
              const pct=budget>0?Math.round(assigned/budget*100):0;
              const over=budget>0&&assigned>budget+5;
              const col=over?'#b91c1c':pct>=90?'#92400e':'#166534';
              return(
                <div key={rd.key} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'#fafaf8',border:`0.5px solid ${rd.color}44`,borderRadius:6,flexWrap:'wrap'}}>
                  <Dot c={rd.color}/><span style={{fontSize:13,minWidth:145}}>{rd.label}</span>
                  <input type="number" value={dayHrs[rd.key]} min="0" max="12" step="0.5" onChange={e=>setDayHrs(p=>({...p,[rd.key]:e.target.value}))}
                    style={{width:62,padding:'4px 6px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:16}}/>
                  <span style={{fontSize:11,color:'#888'}}>hrs</span>
                  {budget>0&&<>
                    <div style={{flex:1,minWidth:80,height:6,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:over?'#dc2626':pct>=90?'#d97706':rd.color,borderRadius:3,transition:'width 0.2s'}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:'bold',color:col,minWidth:90,textAlign:'right'}}>
                      {(assigned/60).toFixed(1)}h / {(budget/60).toFixed(1)}h{over?' ⚠ over':''}
                    </span>
                  </>}
                </div>
              );
            })}
          </div>
        </div>

        <CountSection title="Management tasks" color="#7F77DD" tasks={mgmtTasks} src="mgmt" activeRoles={activeRoles} onSet={setTaskProp} budgets={budgets} assignedMins={assignedMins}>
          <div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #eee'}}>
            <div style={{fontSize:11,color:'#888',marginBottom:6}}>Management ad hoc <span style={{color:'#bbb'}}>— deducted from management overhead</span></div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
              <input placeholder="Task description" value={newMgmtExtra.n} onChange={e=>setNewMgmtExtra(p=>({...p,n:e.target.value}))} style={{...inp,flex:1,minWidth:160}}/>
              <input type="number" placeholder="mins" value={newMgmtExtra.m} min="5" onChange={e=>setNewMgmtExtra(p=>({...p,m:parseInt(e.target.value)||0}))} style={{width:68,padding:'5px 6px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:16}}/>
              <span style={{fontSize:11,color:'#888'}}>min</span>
              <button onClick={()=>{if(!newMgmtExtra.n)return;setMgmtExtraTasks(p=>[...p,{id:`mgmtExtra|${Date.now()}`,n:newMgmtExtra.n,m:newMgmtExtra.m,phase:'Management ad hoc',sugRole:'manager',assignedRole:null,done:false}]);setNewMgmtExtra({n:'',m:30});}}
                style={{...btn,padding:'5px 14px',fontSize:12}}>Add</button>
            </div>
            {mgmtExtraTasks.filter(t=>showDone||!t.done).map(t=>(
              <AdHocRow key={t.id} t={t} src="mgmtExtra" activeRoles={activeRoles} onSet={setTaskProp} budgets={budgets} assignedMins={assignedMins}
                onDelete={()=>setMgmtExtraTasks(p=>p.filter(x=>x.id!==t.id))}/>
            ))}
          </div>
        </CountSection>

        <CountSection title="Workshop & maintenance tasks" color="#888" tasks={wsTasks} src="ws" activeRoles={activeRoles} onSet={setTaskProp} budgets={budgets} assignedMins={assignedMins}>
          <div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #eee'}}>
            <div style={{fontSize:11,color:'#888',marginBottom:6}}>Workshop ad hoc <span style={{color:'#bbb'}}>— deducted from workshop overhead when ticked · incl. MDF priming</span></div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:6}}>
              <input placeholder="e.g. Prime MDF sheets ×10 (200 min)" value={newExtra.n} onChange={e=>setNewExtra(p=>({...p,n:e.target.value}))} style={{...inp,flex:1,minWidth:160}}/>
              <input type="number" placeholder="mins" value={newExtra.m} min="5" onChange={e=>setNewExtra(p=>({...p,m:parseInt(e.target.value)||0}))} style={{width:68,padding:'5px 6px',border:'0.5px solid #ccc',borderRadius:4,fontFamily:'Georgia,serif',fontSize:16}}/>
              <span style={{fontSize:11,color:'#888'}}>min</span>
              <button onClick={()=>{if(!newExtra.n)return;setExtraTasks(p=>[...p,{id:`extra|${Date.now()}`,n:newExtra.n,m:newExtra.m,phase:'Ad hoc',sugRole:'assistant',assignedRole:null,done:false}]);setNewExtra({n:'',m:30});}}
                style={{...btn,padding:'5px 14px',fontSize:12}}>Add</button>
            </div>
            {extraTasks.filter(t=>showDone||!t.done).map(t=>(
              <AdHocRow key={t.id} t={t} src="extra" activeRoles={activeRoles} onSet={setTaskProp} budgets={budgets} assignedMins={assignedMins}
                onDelete={()=>setExtraTasks(p=>p.filter(x=>x.id!==t.id))}/>
            ))}
          </div>
        </CountSection>

        {clients.map(cl=>{
          const tasks=clientTasks[cl.id]||[];
          const totalTasks=tasks.length;
          const doneTasks=tasks.filter(t=>t.done).length;
          const asgn=tasks.filter(t=>t.assignedRole&&!t.done).length;
          const pct=totalTasks>0?Math.round(doneTasks/totalTasks*100):0;
          const isComplete=pct>=100&&totalTasks>0;
          const status=getOrderStatus(cl);
          return(
            <ClientSection key={cl.id} title={cl.name||'Unnamed'} color={cl.col} tasks={tasks} src={cl.id} activeRoles={activeRoles} onSet={setTaskProp} showDone={showDone} budgets={budgets} assignedMins={assignedMins} defaultOpen={!isComplete}>
              <div style={{fontSize:11,color:'#aaa',marginTop:6,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span>{asgn} assigned · {doneTasks}/{totalTasks} done{cl.date?` · due ${cl.date}`:''}</span>
                {status&&(
                  <span style={{padding:'2px 8px',borderRadius:4,background:status.bg,color:status.color,border:`0.5px solid ${status.color}33`,fontWeight:'bold'}}>
                    {status.icon} {status.label}{status.diff!==undefined?` (${status.diff}%)`:''}
                  </span>
                )}
                {isComplete&&<span style={{color:'#166534',fontWeight:'bold'}}>✓ Complete — minimised</span>}
              </div>
            </ClientSection>
          );
        })}

        <div style={{display:'flex',gap:8,marginTop:'1rem',flexWrap:'wrap'}}>
          <button onClick={()=>setMode('sheets')} style={btnP}>Team sheets →</button>
          <button onClick={()=>setMode('progress')} style={{...btnP,background:'#1D9E75'}}>Progress →</button>
          <button onClick={()=>setMode('plan')} style={btn}>← Plan</button>
        </div>
      </>}

      {mode==='sheets'&&<>
        <div style={card}>
          <div style={H}>Team sheets — {dayDate||'today'}</div>
          <p style={{fontSize:12,color:'#888',fontStyle:'italic',marginBottom:10}}>Only assigned tasks. Click box to select all, copy, paste into Google Docs.</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {activeRoles.filter(rd=>getPersonTasks(rd.key).length>0).map(rd=>(
              <button key={rd.key} onClick={()=>setActiveSheet(activeSheet===rd.key?null:rd.key)}
                style={{padding:'8px 16px',border:`0.5px solid ${rd.color}`,borderRadius:4,background:activeSheet===rd.key?rd.color:'#fff',color:activeSheet===rd.key?'#fff':rd.color,fontFamily:'Georgia,serif',fontSize:13,cursor:'pointer'}}>
                {rd.label} ({getPersonTasks(rd.key).length})
              </button>
            ))}
            {activeRoles.every(rd=>getPersonTasks(rd.key).length===0)&&<span style={{fontSize:12,color:'#bbb',fontStyle:'italic'}}>No tasks assigned yet.</span>}
          </div>
        </div>
        {activeSheet&&(()=>{
          const rd=ROLE_DEFS.find(r=>r.key===activeSheet);
          const tasks=getPersonTasks(activeSheet);
          const total=tasks.reduce((s,t)=>s+t.m,0);
          return(
            <div style={{...card,borderTop:`3px solid ${rd.color}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <Dot c={rd.color} s={11}/><span style={{fontSize:15,fontWeight:'bold'}}>{rd.label}</span>
                <span style={{fontSize:11,color:'#888'}}>— {tasks.length} tasks · {(total/60).toFixed(1)}h</span>
              </div>
              <textarea readOnly value={getPersonText(activeSheet)} onClick={e=>e.target.select()}
                style={{width:'100%',height:Math.min(500,tasks.length*28+130),fontFamily:'monospace',fontSize:12,padding:'10px',border:'0.5px solid #ddd',borderRadius:4,background:'#f9f9f7',resize:'vertical',color:'#1a1a1a',lineHeight:1.9}}/>
              <div style={{fontSize:11,color:'#888',marginTop:4,fontStyle:'italic'}}>Click to select all · Cmd+C · Paste into Google Docs to print</div>
            </div>
          );
        })()}
        <button onClick={()=>setMode('daily')} style={{...btn,marginTop:'1rem'}}>← Back to dispatch</button>
      </>}

      <div style={{textAlign:'center',fontStyle:'italic',color:'#ccc',fontSize:10,marginTop:'2rem',paddingTop:'1rem',borderTop:'0.5px solid #eee',letterSpacing:'0.05em'}}>
        Discipline in the process. Excellence is Athena's reward.
      </div>
    </div>
    </div>
  );
}
