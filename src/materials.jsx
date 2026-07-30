import { useState } from 'react';

// ── Sheet sizes ───────────────────────────────────────────────────────────────
const MDF18_W = 1220, MDF18_H = 2440; // mm
const MDF9_W  = 1220, MDF9_H  = 2440;
const OAK18_W = 1220, OAK18_H = 2440;
const OAK9_W  = 1220, OAK9_H  = 2440;
const WORKTOP_L = 3000, WORKTOP_D = 636; // mm

// ── Stripwood lengths ─────────────────────────────────────────────────────────
const STRIP_L = 2400; // mm

// ── Component hardware rules ──────────────────────────────────────────────────
// Each component auto-includes certain hardware
const COMPONENT_HARDWARE = {
  drawer:           { runner: 1 },
  waxedDrawer:      { runner: 1 },
  hingedDoor:       { doorHinge: 1 },
  waxedHingedDoor:  { doorHinge: 1 },
  slidingDoor:      { handle: 1 },
  waxedSlidingDoor: { handle: 1 },
  upOverDoor:       { jwlLatch: 2, boltLatch: 2 },
  waxedUpOverDoor:  { jwlLatch: 2, boltLatch: 2 },
  shakerDoor:       { handle: 1, shakerHinge: 1 },
  waxedShakerDoor:  { handle: 1, shakerHinge: 1 },
  dogDivide:        { boltLatch: 1 },
  waxedDogDivide:   { boltLatch: 1 },
};

// ── Qty keys that map to component types ─────────────────────────────────────
const QTY_TO_COMPONENT = {
  carc: null, // handled via dimensions
  drawer: 'drawer',
  waxedDrawer: 'waxedDrawer',
  hingedDoor: 'hingedDoor',
  waxedHingedDoor: 'waxedHingedDoor',
  slidingDoor: 'slidingDoor',
  waxedSlidingDoor: 'waxedSlidingDoor',
  upOverDoor: 'upOverDoor',
  waxedUpOverDoor: 'waxedUpOverDoor',
  shakerDoor: 'shakerDoor',
  waxedShakerDoor: 'waxedShakerDoor',
  shelf: 'shelf',
  bar: 'bars',
  panelDivide: 'panelDivide',
  waxedPanelDivide: 'waxedPanelDivide',
  dogDivide: 'dogDivide',
  waxedDogDivide: 'waxedDogDivide',
};

// ── Calculate material cost for a single order ────────────────────────────────
function calcOrderMaterials(order, prices) {
  const p = prices;
  const qtys = order.qtys || {};
  const unitType = order.unitType || 'painted';
  const isWaxed = unitType === 'waxed';
  const dims = order.dims || {};
  const W = parseFloat(dims.width) || 0;   // mm
  const H = parseFloat(dims.height) || 0;  // mm
  const D = parseFloat(dims.depth) || 0;   // mm

  const items = [];

  // ── Sheet goods from dimensions ───────────────────────────────────────────
  if (W > 0 && H > 0 && D > 0) {
    if (isWaxed) {
      // 18mm oak laminate: 2 sides + bottom
      const oakArea = (2 * H * D) + (W * D); // mm²
      const oakSheets = Math.ceil(oakArea / (OAK18_W * OAK18_H));
      if (oakSheets > 0) items.push({ label: `18mm Oak laminate (${oakSheets} sheet${oakSheets>1?'s':''})`, cost: oakSheets * (p.oak18||0) });

      // 9mm oak laminate back
      const oak9Sheets = Math.ceil((W * H) / (OAK9_W * OAK9_H));
      if (oak9Sheets > 0) items.push({ label: `9mm Oak laminate back (${oak9Sheets} sheet${oak9Sheets>1?'s':''})`, cost: oak9Sheets * (p.oak9||0) });

      // Oak worktop surface
      const worktopCount = D > WORKTOP_D ? 1 + 1/3 : 1;
      items.push({ label: `Oak worktop surface${D > WORKTOP_D ? ' (×1 + ⅓ for depth)' : ''}`, cost: Math.ceil(worktopCount) === 1 ? (p.worktop||0) : (p.worktop||0) + (p.worktop||0)/3 });

      // Oak worktop for face frame (cut down to stripwood)
      // Longest piece = max(H, W) — needs one worktop if < 3000mm
      const longestPiece = Math.max(H, W);
      const faceFrameWorktops = longestPiece > WORKTOP_L ? 2 : 1;
      items.push({ label: `Oak worktop for face frame (${faceFrameWorktops} length${faceFrameWorktops>1?'s':''})`, cost: faceFrameWorktops * (p.worktop||0) });

    } else {
      // Painted: 18mm MDF sides + bottom
      const mdfArea = (2 * H * D) + (W * D); // mm²
      const mdf18Sheets = Math.ceil(mdfArea / (MDF18_W * MDF18_H));
      if (mdf18Sheets > 0) items.push({ label: `18mm MDF (${mdf18Sheets} sheet${mdf18Sheets>1?'s':''})`, cost: mdf18Sheets * (p.mdf18||0) });

      // 9mm MDF back
      const mdf9Sheets = Math.ceil((W * H) / (MDF9_W * MDF9_H));
      if (mdf9Sheets > 0) items.push({ label: `9mm MDF back (${mdf9Sheets} sheet${mdf9Sheets>1?'s':''})`, cost: mdf9Sheets * (p.mdf9||0) });

      // Oak worktop surface
      const worktopCost = D > WORKTOP_D
        ? (p.worktop||0) + (p.worktop||0) / 3
        : (p.worktop||0);
      items.push({ label: `Oak worktop${D > WORKTOP_D ? ' (×1 + ⅓ for depth)' : ''}`, cost: worktopCost });

      // Face frame stripwood: 2 rails (W) + 4 stiles (H) × 36×18, 1 top rail (W) × 70×18
      // Calculate lengths needed, divide by STRIP_L to get pieces needed
      const stripRails36 = Math.ceil((2 * W) / STRIP_L);  // 2 horizontal rails
      const stripStiles36 = Math.ceil((4 * H) / STRIP_L); // 4 stiles
      const strip36Total = stripRails36 + stripStiles36;
      const strip70Total = Math.ceil(W / STRIP_L); // 1 top rail

      if (strip36Total > 0) items.push({ label: `36×18 stripwood (${strip36Total} length${strip36Total>1?'s':''})`, cost: strip36Total * (p.strip36||0) });
      if (strip70Total > 0) items.push({ label: `70×18 stripwood (${strip70Total} length${strip70Total>1?'s':''})`, cost: strip70Total * (p.strip70||0) });
    }
  }

  // ── Paint (selected by unit width) ────────────────────────────────────────
  if (!isWaxed && W > 0) {
    if (W <= 1000) {
      items.push({ label: 'Paint 1L', cost: p.paint1L||0 });
    } else if (W <= 3000) {
      items.push({ label: 'Paint 2.5L', cost: p.paint2_5L||0 });
    } else {
      items.push({ label: 'Paint 5L', cost: p.paint5L||0 });
    }
  }

  // ── Per-unit always ───────────────────────────────────────────────────────
  items.push({ label: 'Bars (2.7 × 6000mm)', cost: 2.7 * (p.bar6000||0) });
  items.push({ label: 'Hammerite', cost: p.hammerite||0 });
  items.push({ label: 'Consumables', cost: p.consumables||0 });

  // ── Components from quantities ────────────────────────────────────────────
  // Accumulate hardware
  const hardwareTotals = {};
  function addHardware(hw) {
    for (const [k, qty] of Object.entries(hw)) {
      hardwareTotals[k] = (hardwareTotals[k] || 0) + qty;
    }
  }

  for (const [qKey, compKey] of Object.entries(QTY_TO_COMPONENT)) {
    const qty = parseInt(qtys[qKey]) || 0;
    if (!qty || !compKey) continue;
    const compPrice = p[compKey] || 0;
    items.push({ label: `${qKey.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())} ×${qty}`, cost: qty * compPrice });
    // Auto hardware
    const hw = COMPONENT_HARDWARE[compKey];
    if (hw) {
      for (const [hk, hqty] of Object.entries(hw)) {
        addHardware({ [hk]: hqty * qty });
      }
    }
  }

  // Add accumulated hardware items
  const hwLabels = {
    runner: 'Drawer runner', doorHinge: 'Door hinge', handle: 'Handle',
    jwlLatch: 'JWL latch', boltLatch: 'Bolt latch', shakerHinge: 'Shaker hinge',
  };
  for (const [hk, hqty] of Object.entries(hardwareTotals)) {
    if (hqty > 0) {
      items.push({ label: `${hwLabels[hk]||hk} ×${hqty} (auto)`, cost: hqty * (p[hk]||0), auto: true });
    }
  }

  // ── Drawer fronts (94×18 from quantities) ────────────────────────────────
  const drawers = (parseInt(qtys.drawer)||0) + (parseInt(qtys.waxedDrawer)||0);
  if (drawers > 0) {
    const frontLengths = Math.ceil((drawers * 300) / STRIP_L); // ~300mm per front estimate
    items.push({ label: `94×18 drawer fronts (${frontLengths} length${frontLengths>1?'s':''})`, cost: frontLengths * (p.strip94||0) });
  }

  // ── Bespoke material items ────────────────────────────────────────────────
  for (const b of (order.bespokeMaterials || [])) {
    if (b.desc && (parseFloat(b.cost)||0) > 0) {
      items.push({ label: b.desc, cost: parseFloat(b.cost)||0, bespoke: true });
    }
  }

  const total = items.reduce((a, i) => a + (i.cost||0), 0);
  return { items, total };
}

// ── Price library section ─────────────────────────────────────────────────────
function PriceGroup({ title, fields, prices, onChange }) {
  const inp = { width:'100%', padding:'5px 7px', border:'0.5px solid #ccc', borderRadius:4, fontFamily:'Georgia,serif', fontSize:15, background:'#fff' };
  const lbl = { fontSize:11, color:'#888', display:'block', marginBottom:3 };
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:9, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:8 }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
        {fields.map(([key, label]) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:13, color:'#888' }}>£</span>
              <input type="number" value={prices[key]||''} min="0" step="0.01" placeholder="0.00"
                onChange={e => onChange(key, parseFloat(e.target.value)||0)}
                style={inp}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Order material card ───────────────────────────────────────────────────────
function OrderMaterialCard({ order, prices, onUpdate }) {
  const [open, setOpen] = useState(false);
  const dims = order.dims || {};
  const { items, total } = calcOrderMaterials(order, prices);
  const inp = { padding:'4px 6px', border:'0.5px solid #ccc', borderRadius:4, fontFamily:'Georgia,serif', fontSize:14, background:'#fff' };
  const hasDims = dims.width && dims.height && dims.depth;

  return (
    <div style={{ background:'#fff', border:'0.5px solid #ddd', borderRadius:6, marginBottom:8, borderLeft:`3px solid ${order.col||'#888'}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.6rem 0.9rem', cursor:'pointer', flexWrap:'wrap' }}
        onClick={() => setOpen(p=>!p)}>
        <span style={{ flex:1, fontSize:13, fontWeight:'bold' }}>{order.name||'Unnamed'}</span>
        <span style={{ fontSize:11, color:'#888' }}>{order.unitType||'painted'}</span>
        {!hasDims && <span style={{ fontSize:10, color:'#d97706', background:'#fffbeb', border:'0.5px solid #fcd34d', borderRadius:3, padding:'1px 6px' }}>⚠ No dimensions</span>}
        <span style={{ fontSize:13, fontWeight:'bold', color: total > 0 ? '#1a1a1a' : '#bbb' }}>
          {total > 0 ? `£${total.toFixed(2)}` : '—'}
        </span>
        <span style={{ fontSize:11, color:'#aaa' }}>{open?'▲':'▼'}</span>
      </div>

      {open && (
        <div style={{ padding:'0 0.9rem 0.9rem' }}>
          {/* Dimensions */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'#888', whiteSpace:'nowrap' }}>Dimensions (mm):</span>
            {[['width','W'],['height','H'],['depth','D']].map(([k,l])=>(
              <div key={k} style={{ display:'flex', alignItems:'center', gap:3 }}>
                <label style={{ fontSize:11, color:'#aaa' }}>{l}</label>
                <input type="number" value={dims[k]||''} min="0" placeholder="0"
                  onChange={e => onUpdate(order.id, { dims: { ...dims, [k]: parseInt(e.target.value)||0 } })}
                  style={{ ...inp, width:72 }}/>
              </div>
            ))}
          </div>

          {/* Bespoke material items */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:5 }}>Bespoke materials <span style={{ color:'#bbb' }}>— glass doors, specialist items etc.</span></div>
            {(order.bespokeMaterials||[]).map((b,i)=>(
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 90px auto', gap:5, marginBottom:4, alignItems:'center' }}>
                <input placeholder="Description" value={b.desc||''} style={{ ...inp, fontSize:13 }}
                  onChange={e => onUpdate(order.id, { bespokeMaterials: (order.bespokeMaterials||[]).map((x,j)=>j===i?{...x,desc:e.target.value}:x) })}/>
                <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <span style={{ fontSize:12, color:'#888' }}>£</span>
                  <input type="number" value={b.cost||''} min="0" step="0.01" placeholder="0.00" style={{ ...inp, width:68 }}
                    onChange={e => onUpdate(order.id, { bespokeMaterials: (order.bespokeMaterials||[]).map((x,j)=>j===i?{...x,cost:parseFloat(e.target.value)||0}:x) })}/>
                </div>
                <button onClick={() => onUpdate(order.id, { bespokeMaterials: (order.bespokeMaterials||[]).filter((_,j)=>j!==i) })}
                  style={{ padding:'3px 7px', border:'0.5px solid #fca5a5', borderRadius:3, background:'#fff', color:'#b91c1c', cursor:'pointer', fontFamily:'Georgia,serif', fontSize:12 }}>×</button>
              </div>
            ))}
            <button onClick={() => onUpdate(order.id, { bespokeMaterials: [...(order.bespokeMaterials||[]), { desc:'', cost:0 }] })}
              style={{ padding:'3px 10px', border:'0.5px solid #999', borderRadius:3, background:'#fff', fontFamily:'Georgia,serif', fontSize:11, cursor:'pointer' }}>
              + Add bespoke material
            </button>
          </div>

          {/* Cost breakdown */}
          {items.length > 0 && (
            <div style={{ background:'#f5f4f0', borderRadius:5, padding:'8px 10px' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color: item.auto ? '#aaa' : item.bespoke ? '#7F77DD' : '#555', marginBottom:2 }}>
                  <span>{item.label}</span>
                  <span style={{ fontWeight: item.bespoke ? 'bold' : 'normal' }}>£{(item.cost||0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:'bold', color:'#1a1a1a', marginTop:6, paddingTop:6, borderTop:'0.5px solid #ddd' }}>
                <span>Total estimated materials</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Materials component ──────────────────────────────────────────────────
export default function Materials({ prices, onPricesChange, clients, onUpdateOrder }) {
  const [tab, setTab] = useState('orders'); // 'orders' | 'prices'

  function setPrice(key, val) {
    onPricesChange(p => ({ ...p, [key]: val }));
  }

  // Orders that have build details — both simple and complex from Plan
  // clients passed from App.jsx
  const ordersWithDetails = clients || [];

  // Monthly material total across all orders
  const monthlyTotal = ordersWithDetails.reduce((a, o) => {
    const { total } = calcOrderMaterials(o, prices);
    return a + total;
  }, 0);

  const C = { fontFamily:'Georgia,serif', fontSize:13, color:'#1a1a1a' };
  const card = { background:'#fff', border:'0.5px solid #ddd', borderRadius:8, padding:'1rem 1.25rem', marginBottom:'1rem' };
  const btn = { padding:'8px 16px', border:'0.5px solid #999', borderRadius:4, background:'#fff', fontFamily:'Georgia,serif', fontSize:13, cursor:'pointer' };

  return (
    <div style={C}>
      {/* Summary bar */}
      <div style={{ ...card, borderTop:'3px solid #BA7517' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:4 }}>Estimated materials this month</div>
            <div style={{ fontSize:26, fontWeight:'bold', color:'#BA7517' }}>£{monthlyTotal.toFixed(2)}</div>
            <div style={{ fontSize:11, color:'#aaa' }}>{ordersWithDetails.length} orders · based on current price library</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setTab('orders')} style={{ ...btn, background: tab==='orders'?'#1a1a1a':'#fff', color: tab==='orders'?'#fff':'#888', border:'none' }}>Orders</button>
            <button onClick={()=>setTab('prices')} style={{ ...btn, background: tab==='prices'?'#1a1a1a':'#fff', color: tab==='prices'?'#fff':'#888', border:'none' }}>Price library</button>
          </div>
        </div>
      </div>

      {tab==='orders' && (
        <div>
          {ordersWithDetails.length === 0 && (
            <div style={{ ...card, textAlign:'center', color:'#bbb', fontStyle:'italic' }}>
              No orders in Plan yet. Add orders in the Plan tab to see material costs.
            </div>
          )}
          {ordersWithDetails.map(order => (
            <OrderMaterialCard key={order.id} order={order} prices={prices}
              onUpdate={onUpdateOrder} />
          ))}
          {ordersWithDetails.length > 0 && (
            <div style={{ ...card, background:'#f5f4f0', textAlign:'right' }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>Combined material estimate</div>
              <div style={{ fontSize:20, fontWeight:'bold', color:'#1a1a1a' }}>£{monthlyTotal.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {tab==='prices' && (
        <div style={card}>
          <PriceGroup title="Sheet materials" prices={prices} onChange={setPrice} fields={[
            ['mdf18',  '18mm MDF sheet'],
            ['mdf9',   '9mm MDF sheet'],
            ['oak18',  '18mm Oak laminate'],
            ['oak9',   '9mm Oak laminate'],
            ['worktop','Oak worktop (3000×636)'],
          ]}/>
          <PriceGroup title="Stripwood (per 2400mm length)" prices={prices} onChange={setPrice} fields={[
            ['strip36','36×18'],
            ['strip44','44×18'],
            ['strip70','70×18'],
            ['strip94','94×18 (drawer fronts)'],
          ]}/>
          <PriceGroup title="Hardware" prices={prices} onChange={setPrice} fields={[
            ['bar6000',    '6000mm bar'],
            ['jwlLatch',   'JWL latch'],
            ['boltLatch',  'Bolt latch'],
            ['shakerHinge','Shaker hinge'],
            ['doorHinge',  'Door hinge'],
            ['handle',     'Handle (average)'],
            ['runner',     'Drawer runner'],
            ['hammerite',  'Hammerite'],
            ['consumables','Consumables (per unit)'],
          ]}/>
          <PriceGroup title="Paint" prices={prices} onChange={setPrice} fields={[
            ['paint1L',  'Paint 1L (≤1000mm wide)'],
            ['paint2_5L','Paint 2.5L (≤3000mm wide)'],
            ['paint5L',  'Paint 5L (>3000mm wide)'],
          ]}/>
          <PriceGroup title="Components (average cost per item)" prices={prices} onChange={setPrice} fields={[
            ['drawer',          'Drawer'],
            ['waxedDrawer',     'Waxed drawer'],
            ['hingedDoor',      'Hinged door'],
            ['waxedHingedDoor', 'Waxed hinged door'],
            ['slidingDoor',     'Sliding door'],
            ['waxedSlidingDoor','Waxed sliding door'],
            ['upOverDoor',      'Up & over door'],
            ['waxedUpOverDoor', 'Waxed up & over door'],
            ['shakerDoor',      'Shaker door'],
            ['waxedShakerDoor', 'Waxed shaker door'],
            ['shelf',           'Shelf'],
            ['bars',            'Bars (average)'],
            ['panelDivide',     'Panel divide'],
            ['waxedPanelDivide','Waxed panel divide'],
            ['dogDivide',       'Dog divide'],
            ['waxedDogDivide',  'Waxed dog divide'],
          ]}/>
          <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic', marginTop:4 }}>
            Prices save automatically. Hardware rules: drawer → runner, hinged door → door hinge, sliding door → handle, up &amp; over door → 2× JWL + 2× bolt latch, shaker door → handle + shaker hinge, dog divide → bolt latch. Every unit gets 2.7 bars + Hammerite + consumables.
          </div>
        </div>
      )}
    </div>
  );
}
