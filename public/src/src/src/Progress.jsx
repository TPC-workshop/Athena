import { useState, useEffect } from 'react';
import { rColor, rLabel } from './data.js';

function Dot({ c, s=9 }) {
  return <span style={{width:s,height:s,borderRadius:'50%',background:c,display:'inline-block',flexShrink:0}}/>;
}

function StatusBadge({ t }) {
  if (t.done) return <span style={{fontSize:11,padding:'2px 8px',borderRadius:12,background:'#dcfce7',color:'#166534',fontWeight:'bold',whiteSpace:'nowrap'}}>✓ Done</span>;
  if (t.assignedRole) {
    const c = rColor(t.assignedRole);
    return <span style={{fontSize:11,padding:'2px 8px',borderRadius:12,background:c+'18',color:c,border:`0.5px solid ${c}44`,whiteSpace:'nowrap'}}>{rLabel(t.assignedRole)}</span>;
  }
  return <span style={{fontSize:11,padding:'2px 8px',borderRadius:12,background:'#f5f4f0',color:'#aaa',border:'0.5px solid #ddd',whiteSpace:'nowrap'}}>Unassigned</span>;
}

export default function Progress() {
  const [data, setData] = useState(null);
  const [openClients, setOpenClients] = useState({});
  const toggle = id => setOpenClients(p=>({...p,[id]:!p[id]}));

  useEffect(() => {
    fetch('/api/progress')
      .then(r=>r.json())
      .then(setData)
      .catch(()=>setData({}));

    const t = setInterval(() => {
      fetch('/api/progress').then(r=>r.json()).then(setData).catch(()=>{});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div style={{fontFamily:'Georgia,serif',textAlign:'center',padding:'3rem',color:'#aaa'}}>Loading…</div>;

  const { clients=[], clientTasks={}, extraTasks=[], monthName='' } = data;
  const allTasks = [...clients.flatMap(cl=>clientTasks[cl.id]||[]), ...extraTasks];
  const done = allTasks.filter(t=>t.done).length;
  const pct = allTasks.length>0 ? Math.round(done/allTasks.length*100) : 0;
  const barCol = pct>=100?'#1D9E75':pct>=60?'#7F77DD':'#D85A30';

  return (
    <div style={{fontFamily:'Georgia,serif',fontSize:13,background:'#f5f4f0',minHeight:'100vh',color:'#1a1a1a'}}>
      <div style={{maxWidth:860,margin:'0 auto',padding:'1.5rem 1rem 4rem'}}>
        <div style={{textAlign:'center',borderBottom:'1px solid #ccc',paddingBottom:'1rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:20,fontWeight:'normal',letterSpacing:'0.06em'}}>ATHENA</div>
          <div style={{fontSize:9,color:'#888',fontStyle:'italic',marginTop:3}}>Month Progress{monthName?` — ${monthName}`:''}</div>
        </div>

        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'1rem 1.25rem',marginBottom:'1.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:'bold'}}>Overall progress</span>
            <span style={{fontSize:16,fontWeight:'bold',color:barCol}}>{pct}%</span>
          </div>
          <div style={{height:16,background:'#eee',borderRadius:8,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:`${pct}%`,background:barCol,borderRadius:8,transition:'width 0.4s'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8,marginTop:10}}>
            {clients.map(cl=>{
              const ts = clientTasks[cl.id]||[];
              const d = ts.filter(t=>t.done).length;
              const p = ts.length>0?Math.round(d/ts.length*100):0;
              return (
                <div key={cl.id} style={{background:'#f5f4f0',borderRadius:6,padding:'6px 10px',borderLeft:`2px solid ${cl.col}`}}>
                  <div style={{fontSize:10,color:'#888',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cl.name||'Unnamed'}</div>
                  <div style={{fontSize:15,fontWeight:'bold',color:p===100?'#166534':cl.col}}>{p}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {clients.length===0&&extraTasks.length===0&&(
          <div style={{textAlign:'center',color:'#aaa',fontStyle:'italic',padding:'3rem'}}>No work in progress yet.</div>
        )}

        {clients.map(cl => {
          const tasks = clientTasks[cl.id]||[];
          const d = tasks.filter(t=>t.done).length;
          const p = tasks.length>0?Math.round(d/tasks.length*100):0;
          const isOpen = openClients[cl.id] !== false;
          const phases = [...new Set(tasks.map(t=>t.phase))];
          return (
            <div key={cl.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:'0.75rem',borderLeft:`3px solid ${cl.col}`,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>toggle(cl.id)}>
                <Dot c={cl.col} s={10}/>
                <span style={{fontSize:15,fontWeight:'bold',flex:1}}>{cl.name||'Unnamed'}</span>
                {cl.date&&<span style={{fontSize:11,color:'#aaa'}}>Due: {cl.date}</span>}
                <span style={{fontSize:12,fontWeight:'bold',color:p===100?'#166534':'#888',minWidth:40,textAlign:'right'}}>{p}%</span>
                <div style={{width:80,height:6,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${p}%`,background:p===100?'#1D9E75':cl.col,borderRadius:3}}/>
                </div>
                <span style={{fontSize:11,color:'#888',minWidth:60,textAlign:'right'}}>{d}/{tasks.length} done</span>
                <span style={{fontSize:11,color:'#aaa'}}>{isOpen?'▲':'▼'}</span>
              </div>
              {isOpen&&<div style={{padding:'0 1rem 0.75rem'}}>
                {phases.map(phase=>{
                  const pts = tasks.filter(t=>t.phase===phase);
                  const pd = pts.filter(t=>t.done).length;
                  return (
                    <div key={phase} style={{marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:'bold',textTransform:'uppercase',letterSpacing:'0.06em',color:'#aaa',marginBottom:4,paddingBottom:3,borderBottom:'0.5px solid #f0f0f0',display:'flex',justifyContent:'space-between'}}>
                        <span>{phase}</span><span>{pd}/{pts.length}</span>
                      </div>
                      {pts.map(t=>(
                        <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.4px solid #f9f9f9',opacity:t.done?0.5:1}}>
                          <span style={{fontSize:12,flex:1,textDecoration:t.done?'line-through':'none',color:t.done?'#aaa':'#1a1a1a'}}>{t.n}</span>
                          <span style={{fontSize:11,color:'#ccc',minWidth:34,textAlign:'right'}}>{t.m}m</span>
                          <StatusBadge t={t}/>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>}
            </div>
          );
        })}

        {extraTasks.length>0&&(()=>{
          const isOpen = openClients['__adhoc'] !== false;
          const d = extraTasks.filter(t=>t.done).length;
          return (
            <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:'0.75rem',borderLeft:'3px solid #888',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>toggle('__adhoc')}>
                <Dot c="#888" s={10}/>
                <span style={{fontSize:15,fontWeight:'bold',flex:1}}>Ad hoc tasks</span>
                <span style={{fontSize:12,fontWeight:'bold',color:'#888',minWidth:40,textAlign:'right'}}>{extraTasks.length>0?Math.round(d/extraTasks.length*100):0}%</span>
                <div style={{width:80,height:6,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${extraTasks.length>0?Math.round(d/extraTasks.length*100):0}%`,background:'#888',borderRadius:3}}/>
                </div>
                <span style={{fontSize:11,color:'#888',minWidth:60,textAlign:'right'}}>{d}/{extraTasks.length} done</span>
                <span style={{fontSize:11,color:'#aaa'}}>{isOpen?'▲':'▼'}</span>
              </div>
              {isOpen&&<div style={{padding:'0 1rem 0.75rem'}}>
                {extraTasks.map(t=>(
                  <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.4px solid #f9f9f9',opacity:t.done?0.5:1}}>
                    <span style={{fontSize:12,flex:1,textDecoration:t.done?'line-through':'none',color:t.done?'#aaa':'#1a1a1a'}}>{t.n}</span>
                    <span style={{fontSize:11,color:'#ccc',minWidth:34,textAlign:'right'}}>{t.m}m</span>
                    <StatusBadge t={t}/>
                  </div>
                ))}
              </div>}
            </div>
          );
        })()}

        <div style={{textAlign:'center',fontStyle:'italic',color:'#ccc',fontSize:10,marginTop:'2rem',paddingTop:'1rem',borderTop:'0.5px solid #eee',letterSpacing:'0.05em'}}>
          Discipline in the process. Excellence is Athena's reward.
        </div>
      </div>
    </div>
  );
}
