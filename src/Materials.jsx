import { useState } from 'react';

const WORKTOP_D = 636;
const WORKTOP_L = 3000;
const STRIP_L = 2400;

// ── Maps actual QTYS keys from data.js to component/hardware rules ────────────
const QTY_HARDWARE = {
  draw:    { component: 'drawer',      hardware: { runner: 1, handle: 1 } },
  hdoor:   { component: 'hingedDoor',  hardware: { doorHinge: 1, jwlLatch: 1 } },
  sdoor:   { component: 'slidingDoor', hardware: { handle: 1 } },
  udoor:   { component: 'upOverDoor',  hardware: { jwlLatch: 2, boltLatch: 2 } },
  shaker:  { component: 'shakerDoor',  hardware: { handle: 1, shakerHinge: 1 } },
  ddogdiv: { component: 'dogDivide',   hardware: { boltLatch: 1 } },
  shelf:   { component: 'shelf',       hardware: {} },
  bar:     { component: 'bars',        hardware: {} },
  pdiv:    { component: 'panelDivide', hardware: {} },
};

const QTY_LABELS = {
  draw:'Drawers', hdoor:'Hinged doors', sdoor:'Sliding doors',
  udoor:'Up & over doors', shaker:'Shaker doors', ddogdiv:'Dog divides',
  shelf:'Shelves', bar:'Bar sets', pdiv:'Panel divides',
};

export function calcOrderMaterials(order, prices) {
  const p = prices || {};
  const qtys = order.qtys || {};
  const isWaxed = (order.unitType || 'painted') === 'waxed';
  const dims = order.dims || {};
  const W = parseFloat(dims.width) || 0;
  const H = parseFloat(dims.height) || 0;
  const D = parseFloat(dims.depth) || 0;
  const items = [];

  // ── Sheet goods from dimensions ───────────────────────────────────────────
  if (W > 0 && H > 0 && D > 0) {
    if (isWaxed) {
      const oakArea = (2 * H * D) + (W * D);
      const oakSheets = Math.ceil(oakArea / (1220 * 2440));
      if (oakSheets > 0) items.push({ label: `18mm Oak laminate ×${oakSheets}`, cost: oakSheets * (p.oak18||0) });
      const oak9Sheets = Math.ceil((W * H) / (1220 * 2440));
      if (oak9Sheets > 0) items.push({ label: `9mm Oak laminate back ×${oak9Sheets}`, cost: oak9Sheets * (p.oak9||0) });
      const wtCost = D > WORKTOP_D ? (p.worktop||0) + (p.worktop||0)/3 : (p.worktop||0);
      items.push({ label: `Oak worktop surface${D > WORKTOP_D?' (+⅓)':''}`, cost: wtCost });
      const ffWorktops = Math.max(H, W) > WORKTOP_L ? 2 : 1;
      items.push({ label: `Oak worktop face frame ×${ffWorktops}`, cost: ffWorktops * (p.worktop||0) });
    } else {
      const mdfArea = (2 * H * D) + (W * D);
      const mdf18Sheets = Math.ceil(mdfArea / (1220 * 2440));
      if (mdf18Sheets > 0) items.push({ label: `18mm MDF ×${mdf18Sheets}`, cost: mdf18Sheets * (p.mdf18||0) });
      const mdf9Sheets = Math.ceil((W * H) / (1220 * 2440));
      if (mdf9Sheets > 0) items.push({ label: `9mm MDF back ×${mdf9Sheets}`, cost: mdf9Sheets * (p.mdf9||0) });
      const wtCost = D > WORKTOP_D ? (p.worktop||0) + (p.worktop||0)/3 : (p.worktop||0);
      items.push({ label: `Oak worktop${D > WORKTOP_D?' (+⅓)':''}`, cost: wtCost });
      const strip36 = Math.ceil((2 * W + 4 * H) / STRIP_L);
      const strip70 = Math.ceil(W / STRIP_L);
      if (strip36 > 0) items.push({ label: `36×18 stripwood ×${strip36}`, cost: strip36 * (p.strip36||0) });
      if (strip70 > 0) items.push({ label: `70×18 stripwood ×${strip70}`, cost: strip70 * (p.strip70||0) });
    }
  }

  // ── Paint by width ────────────────────────────────────────────────────────
  if (!isWaxed && W > 0) {
    if (W <= 1000) items.push({ label: 'Paint 1L', cost: p.paint1L||0 });
    else if (W <= 3000) items.push({ label: 'Paint 2.5L', cost: p.paint2_5L||0 });
    else items.push({ label: 'Paint 5L', cost: p.paint5L||0 });
  }

  // ── Per unit always ───────────────────────────────────────────────────────
  items.push({ label: 'Bars (2.7 lengths)', cost: 2.7 * (p.bar6000||0) });
  items.push({ label: 'Hammerite', cost: p.hammerite||0 });
  items.push({ label: 'Consumables', cost: p.consumables||0 });

  // ── Components and auto hardware from actual qty keys ─────────────────────
  const hardwareTotals = {};
  for (const [qKey, rules] of Object.entries(QTY_HARDWARE)) {
    const qty = parseInt(qtys[qKey]) || 0;
    if (!qty) continue;
    const compCost = p[rules.component] || 0;
    items.push({ label: `${QTY_LABELS[qKey]||qKey} ×${qty}`, cost: qty * compCost });
    for (const [hk, hqty] of Object.entries(rules.hardware)) {
      hardwareTotals[hk] = (hardwareTotals[hk]||0) + hqty * qty;
    }
  }

  // ── Auto hardware items ───────────────────────────────────────────────────
  const hwLabels = { runner:'Drawer runner', doorHinge:'Door hinge', handle:'Handle', jwlLatch:'JWL latch', boltLatch:'Bolt latch', shakerHinge:'Shaker hinge' };
  for (const [hk, hqty] of Object.entries(hardwareTotals)) {
    if (hqty > 0) items.push({ label: `${hwLabels[hk]||hk} ×${hqty} (auto)`, cost: hqty * (p[hk]||0), auto: true });
  }

  // ── Drawer fronts from draw qty ───────────────────────────────────────────
  const drawQty = parseInt(qtys.draw) || 0;
  if (drawQty > 0) {
    const frontLengths = Math.ceil((drawQty * 300) / STRIP_L);
    items.push({ label: `94×18 drawer fronts ×${frontLengths}`, cost: frontLengths * (p.strip94||0) });
  }

  // ── Bespoke materials ─────────────────────────────────────────────────────
  for (const b of (order.bespoke || [])) {
    if (b.desc && (parseFloat(b.cost)||0) > 0) items.push({ label: b.desc + ' (bespoke)', cost: parseFloat(b.cost)||0, bespoke: true });
  }
  for (const b of (order.bespokeMaterials || [])) {
    if (b.desc && (parseFloat(b.cost)||0) > 0) items.push({ label: b.desc, cost: parseFloat(b.cost)||0, bespoke: true });
  }

  const total = items.reduce((a, i) => a + (i.cost||0), 0);
  return { items, total };
}

// ── Price group component ─────────────────────────────────────────────────────
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
                onChange={e => onChange(key, parseFloat(e.target.value)||0)} style={inp}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Materials component ──────────────────────────────────────────────────
export default function Materials({ prices, onPricesChange, selectedOrders }) {
  const [tab, setTab] = useState('orders');

  function setPrice(key, val) { onPricesChange(p => ({ ...p, [key]: val })); }

  const forecastTotal = (selectedOrders||[]).reduce((a, o) => a + calcOrderMaterials(o, prices).total, 0);
  const forecastLabour = (selectedOrders||[]).reduce((a, o) => {
    const hrs = (o.totalHrs || 0);
    return a + hrs * (parseFloat(prices.labourRate)||0);
  }, 0);
  const forecastSales = (selectedOrders||[]).reduce((a, o) => {
    const raw = parseFloat(o.salePrice)||0;
    return a + (o.saleIncVat ? raw / 1.2 : raw);
  }, 0);
  const forecastGP = forecastSales - forecastTotal - forecastLabour;

  const card = { background:'#fff', border:'0.5px solid #ddd', borderRadius:8, padding:'1rem 1.25rem', marginBottom:'1rem' };
  const btn = { padding:'8px 16px', border:'0.5px solid #999', borderRadius:4, background:'#fff', fontFamily:'Georgia,serif', fontSize:13, cursor:'pointer' };

  return (
    <div style={{ fontFamily:'Georgia,serif', fontSize:13, color:'#1a1a1a' }}>
      <div style={{ ...card, borderTop:'3px solid #BA7517' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:6 }}>Material forecast — selected orders</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:8 }}>
              {[
                ['Materials', `£${forecastTotal.toFixed(2)}`, '#BA7517'],
                ['Labour est.', forecastLabour > 0 ? `£${forecastLabour.toFixed(2)}` : '—', '#7F77DD'],
                ['Sales', forecastSales > 0 ? `£${forecastSales.toFixed(2)}` : '—', '#1D9E75'],
                ['Gross profit', forecastSales > 0 ? `£${forecastGP.toFixed(2)}` : '—', forecastGP >= 0 ? '#166534' : '#b91c1c'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background:'#f5f4f0', borderRadius:6, padding:'7px 10px' }}>
                  <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:16, fontWeight:'bold', color:c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'#aaa', marginTop:6 }}>{(selectedOrders||[]).length} order{(selectedOrders||[]).length!==1?'s':''} selected · toggle £ on queue cards to include</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setTab('orders')} style={{ ...btn, background:tab==='orders'?'#1a1a1a':'#fff', color:tab==='orders'?'#fff':'#888', border:'none' }}>Orders</button>
            <button onClick={()=>setTab('prices')} style={{ ...btn, background:tab==='prices'?'#1a1a1a':'#fff', color:tab==='prices'?'#fff':'#888', border:'none' }}>Price library</button>
          </div>
        </div>
      </div>

      {tab==='orders' && (
        <div>
          {(selectedOrders||[]).length === 0 && (
            <div style={{ ...card, textAlign:'center', color:'#bbb', fontStyle:'italic', padding:'2rem' }}>
              No orders selected. Toggle the £ button on queue order cards to include them here.
            </div>
          )}
          {(selectedOrders||[]).map(order => {
            const { items, total } = calcOrderMaterials(order, prices);
            const labour = (order.totalHrs||0) * (parseFloat(prices.labourRate)||0);
            const saleRaw = parseFloat(order.salePrice)||0;
            const sale = order.saleIncVat ? saleRaw / 1.2 : saleRaw;
            const gp = sale - total - labour;
            return (
              <div key={order.id} style={{ ...card, borderLeft:`3px solid ${order.col||'#888'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:'bold' }}>{order.name||'Unnamed'}</div>
                    <div style={{ fontSize:11, color:'#888' }}>
                      {order.unitType||'painted'}
                      {order.dims?.width ? ` · ${order.dims.width}×${order.dims.height}×${order.dims.depth}mm` : ' · no dimensions'}
                      {order.totalHrs ? ` · ${order.totalHrs.toFixed(1)}h` : ''}
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:6, minWidth:280 }}>
                    {[
                      ['Materials', `£${total.toFixed(2)}`, '#BA7517'],
                      ['Labour', labour > 0 ? `£${labour.toFixed(2)}` : '—', '#7F77DD'],
                      ['Sale', sale > 0 ? `£${sale.toFixed(2)}` : '—', '#1D9E75'],
                      ['GP', sale > 0 ? `£${gp.toFixed(2)}` : '—', gp >= 0 ? '#166534' : '#b91c1c'],
                    ].map(([l,v,c]) => (
                      <div key={l} style={{ background:'#f5f4f0', borderRadius:4, padding:'4px 8px' }}>
                        <div style={{ fontSize:9, color:'#aaa', textTransform:'uppercase' }}>{l}</div>
                        <div style={{ fontSize:13, fontWeight:'bold', color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {items.length > 0 && (
                  <div style={{ background:'#f5f4f0', borderRadius:5, padding:'8px 10px' }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:item.auto?'#aaa':item.bespoke?'#7F77DD':'#555', marginBottom:2 }}>
                        <span>{item.label}</span>
                        <span>£{(item.cost||0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:'bold', color:'#1a1a1a', marginTop:5, paddingTop:5, borderTop:'0.5px solid #ddd' }}>
                      <span>Total materials</span><span>£{total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(selectedOrders||[]).length > 1 && (
            <div style={{ ...card, background:'#f5f4f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, color:'#888' }}>Combined forecast</span>
              <div style={{ display:'flex', gap:16 }}>
                {[['Materials',`£${forecastTotal.toFixed(2)}`,'#BA7517'],['Sales',`£${forecastSales.toFixed(2)}`,'#1D9E75'],['GP',`£${forecastGP.toFixed(2)}`,forecastGP>=0?'#166534':'#b91c1c']].map(([l,v,c])=>(
                  <div key={l} style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#aaa' }}>{l}</div>
                    <div style={{ fontSize:15, fontWeight:'bold', color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='prices' && (
        <div style={card}>
          <PriceGroup title="Labour" prices={prices} onChange={setPrice} fields={[
            ['labourRate','Labour rate (£/hr)'],
          ]}/>
          <PriceGroup title="Sheet materials" prices={prices} onChange={setPrice} fields={[
            ['mdf18','18mm MDF sheet'],['mdf9','9mm MDF sheet'],
            ['oak18','18mm Oak laminate'],['oak9','9mm Oak laminate'],
            ['worktop','Oak worktop (3000×636)'],
          ]}/>
          <PriceGroup title="Stripwood (per 2400mm length)" prices={prices} onChange={setPrice} fields={[
            ['strip36','36×18'],['strip44','44×18'],['strip70','70×18'],['strip94','94×18'],
          ]}/>
          <PriceGroup title="Hardware" prices={prices} onChange={setPrice} fields={[
            ['bar6000','6000mm bar'],['jwlLatch','JWL latch'],['boltLatch','Bolt latch'],
            ['shakerHinge','Shaker hinge'],['doorHinge','Door hinge'],['handle','Handle (avg)'],
            ['runner','Drawer runner'],['hammerite','Hammerite'],['consumables','Consumables'],
          ]}/>
          <PriceGroup title="Paint" prices={prices} onChange={setPrice} fields={[
            ['paint1L','1L (≤1000mm)'],['paint2_5L','2.5L (≤3000mm)'],['paint5L','5L (>3000mm)'],
          ]}/>
          <PriceGroup title="Components (average cost per item)" prices={prices} onChange={setPrice} fields={[
            ['drawer','Drawer'],['hingedDoor','Hinged door'],['slidingDoor','Sliding door'],
            ['upOverDoor','Up & over door'],['shakerDoor','Shaker door'],
            ['shelf','Shelf'],['bars','Bars (average)'],['panelDivide','Panel divide'],
            ['dogDivide','Dog divide'],
          ]}/>
          <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic', marginTop:4 }}>
            Prices save automatically. Every unit gets 2.7 bars + Hammerite + consumables. Hardware auto-added: drawer→runner+handle, hinged door→door hinge+JWL latch, sliding door→handle, up&amp;over→2×JWL+2×bolt, shaker→handle+shaker hinge, dog divide→bolt latch.
          </div>
        </div>
      )}
    </div>
  );
}
