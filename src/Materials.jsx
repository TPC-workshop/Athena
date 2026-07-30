import { useState } from 'react';

const WORKTOP_D = 636;
const WORKTOP_L = 3000;
const STRIP_L = 2400;

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

const QTY_TO_COMPONENT = {
  drawer: 'drawer', waxedDrawer: 'waxedDrawer',
  hingedDoor: 'hingedDoor', waxedHingedDoor: 'waxedHingedDoor',
  slidingDoor: 'slidingDoor', waxedSlidingDoor: 'waxedSlidingDoor',
  upOverDoor: 'upOverDoor', waxedUpOverDoor: 'waxedUpOverDoor',
  shakerDoor: 'shakerDoor', waxedShakerDoor: 'waxedShakerDoor',
  shelf: 'shelf', bar: 'bars',
  panelDivide: 'panelDivide', waxedPanelDivide: 'waxedPanelDivide',
  dogDivide: 'dogDivide', waxedDogDivide: 'waxedDogDivide',
};

export function calcOrderMaterials(order, prices) {
  const p = prices;
  const qtys = order.qtys || {};
  const isWaxed = (order.unitType || 'painted') === 'waxed';
  const dims = order.dims || {};
  const W = parseFloat(dims.width) || 0;
  const H = parseFloat(dims.height) || 0;
  const D = parseFloat(dims.depth) || 0;
  const items = [];

  if (W > 0 && H > 0 && D > 0) {
    if (isWaxed) {
      const oakArea = (2 * H * D) + (W * D);
      const oakSheets = Math.ceil(oakArea / (1220 * 2440));
      if (oakSheets > 0) items.push({ label: `18mm Oak laminate (×${oakSheets})`, cost: oakSheets * (p.oak18||0) });
      const oak9Sheets = Math.ceil((W * H) / (1220 * 2440));
      if (oak9Sheets > 0) items.push({ label: `9mm Oak laminate back (×${oak9Sheets})`, cost: oak9Sheets * (p.oak9||0) });
      const wtCost = D > WORKTOP_D ? (p.worktop||0) + (p.worktop||0)/3 : (p.worktop||0);
      items.push({ label: `Oak worktop surface${D > WORKTOP_D?' (+⅓)':''}`, cost: wtCost });
      const longestPiece = Math.max(H, W);
      const ffWorktops = longestPiece > WORKTOP_L ? 2 : 1;
      items.push({ label: `Oak worktop for face frame (×${ffWorktops})`, cost: ffWorktops * (p.worktop||0) });
    } else {
      const mdfArea = (2 * H * D) + (W * D);
      const mdf18Sheets = Math.ceil(mdfArea / (1220 * 2440));
      if (mdf18Sheets > 0) items.push({ label: `18mm MDF (×${mdf18Sheets})`, cost: mdf18Sheets * (p.mdf18||0) });
      const mdf9Sheets = Math.ceil((W * H) / (1220 * 2440));
      if (mdf9Sheets > 0) items.push({ label: `9mm MDF back (×${mdf9Sheets})`, cost: mdf9Sheets * (p.mdf9||0) });
      const wtCost = D > WORKTOP_D ? (p.worktop||0) + (p.worktop||0)/3 : (p.worktop||0);
      items.push({ label: `Oak worktop${D > WORKTOP_D?' (+⅓)':''}`, cost: wtCost });
      const strip36 = Math.ceil((2 * W + 4 * H) / STRIP_L);
      const strip70 = Math.ceil(W / STRIP_L);
      if (strip36 > 0) items.push({ label: `36×18 stripwood (×${strip36})`, cost: strip36 * (p.strip36||0) });
      if (strip70 > 0) items.push({ label: `70×18 stripwood (×${strip70})`, cost: strip70 * (p.strip70||0) });
    }
  }

  if (!isWaxed && W > 0) {
    if (W <= 1000) items.push({ label: 'Paint 1L', cost: p.paint1L||0 });
    else if (W <= 3000) items.push({ label: 'Paint 2.5L', cost: p.paint2_5L||0 });
    else items.push({ label: 'Paint 5L', cost: p.paint5L||0 });
  }

  items.push({ label: 'Bars (2.7 lengths)', cost: 2.7 * (p.bar6000||0) });
  items.push({ label: 'Hammerite', cost: p.hammerite||0 });
  items.push({ label: 'Consumables', cost: p.consumables||0 });

  const hardwareTotals = {};
  for (const [qKey, compKey] of Object.entries(QTY_TO_COMPONENT)) {
    const qty = parseInt(qtys[qKey]) || 0;
    if (!qty || !compKey) continue;
    items.push({ label: `${qKey.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())} ×${qty}`, cost: qty * (p[compKey]||0) });
    const hw = COMPONENT_HARDWARE[compKey];
    if (hw) for (const [hk, hqty] of Object.entries(hw)) hardwareTotals[hk] = (hardwareTotals[hk]||0) + hqty * qty;
  }

  const hwLabels = { runner:'Drawer runner', doorHinge:'Door hinge', handle:'Handle', jwlLatch:'JWL latch', boltLatch:'Bolt latch', shakerHinge:'Shaker hinge' };
  for (const [hk, hqty] of Object.entries(hardwareTotals)) {
    if (hqty > 0) items.push({ label: `${hwLabels[hk]||hk} ×${hqty} (auto)`, cost: hqty * (p[hk]||0), auto: true });
  }

  const drawers = (parseInt(qtys.drawer)||0) + (parseInt(qtys.waxedDrawer)||0);
  if (drawers > 0) {
    const frontLengths = Math.ceil((drawers * 300) / STRIP_L);
    items.push({ label: `94×18 drawer fronts (×${frontLengths})`, cost: frontLengths * (p.strip94||0) });
  }

  for (const b of (order.bespokeMaterials || [])) {
    if (b.desc && (parseFloat(b.cost)||0) > 0) items.push({ label: b.desc, cost: parseFloat(b.cost)||0, bespoke: true });
  }

  const total = items.reduce((a, i) => a + (i.cost||0), 0);
  return { items, total };
}

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

export default function Materials({ prices, onPricesChange, selectedOrders }) {
  const [tab, setTab] = useState('orders');

  function setPrice(key, val) { onPricesChange(p => ({ ...p, [key]: val })); }

  const forecastTotal = (selectedOrders||[]).reduce((a, o) => {
    const { total } = calcOrderMaterials(o, prices);
    return a + total;
  }, 0);

  const card = { background:'#fff', border:'0.5px solid #ddd', borderRadius:8, padding:'1rem 1.25rem', marginBottom:'1rem' };
  const btn = { padding:'8px 16px', border:'0.5px solid #999', borderRadius:4, background:'#fff', fontFamily:'Georgia,serif', fontSize:13, cursor:'pointer' };

  return (
    <div style={{ fontFamily:'Georgia,serif', fontSize:13, color:'#1a1a1a' }}>
      <div style={{ ...card, borderTop:'3px solid #BA7517' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:4 }}>Material forecast — selected orders</div>
            <div style={{ fontSize:26, fontWeight:'bold', color:'#BA7517' }}>£{forecastTotal.toFixed(2)}</div>
            <div style={{ fontSize:11, color:'#aaa' }}>{(selectedOrders||[]).length} order{(selectedOrders||[]).length!==1?'s':''} selected in queue</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setTab('orders')} style={{ ...btn, background:tab==='orders'?'#1a1a1a':'#fff', color:tab==='orders'?'#fff':'#888', border:'none' }}>Selected orders</button>
            <button onClick={()=>setTab('prices')} style={{ ...btn, background:tab==='prices'?'#1a1a1a':'#fff', color:tab==='prices'?'#fff':'#888', border:'none' }}>Price library</button>
          </div>
        </div>
      </div>

      {tab==='orders' && (
        <div>
          {(selectedOrders||[]).length === 0 && (
            <div style={{ ...card, textAlign:'center', color:'#bbb', fontStyle:'italic', padding:'2rem' }}>
              No orders selected. Toggle the £ button on orders in the Queue page to include them in the forecast.
            </div>
          )}
          {(selectedOrders||[]).map(order => {
            const { items, total } = calcOrderMaterials(order, prices);
            return (
              <div key={order.id} style={{ ...card, borderLeft:`3px solid ${order.col||'#888'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:'bold' }}>{order.name||'Unnamed'}</div>
                    <div style={{ fontSize:11, color:'#888' }}>{order.unitType||'painted'}{order.dims?.width ? ` · ${order.dims.width}×${order.dims.height}×${order.dims.depth}mm` : ' · no dimensions'}</div>
                  </div>
                  <div style={{ fontSize:18, fontWeight:'bold', color:'#BA7517' }}>£{total.toFixed(2)}</div>
                </div>
                {items.length > 0 && (
                  <div style={{ background:'#f5f4f0', borderRadius:5, padding:'8px 10px' }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:item.auto?'#aaa':item.bespoke?'#7F77DD':'#555', marginBottom:2 }}>
                        <span>{item.label}</span>
                        <span>£{(item.cost||0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:'bold', color:'#1a1a1a', marginTop:6, paddingTop:6, borderTop:'0.5px solid #ddd' }}>
                      <span>Total</span><span>£{total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(selectedOrders||[]).length > 0 && (
            <div style={{ ...card, background:'#f5f4f0', textAlign:'right' }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>Combined material estimate</div>
              <div style={{ fontSize:22, fontWeight:'bold', color:'#1a1a1a' }}>£{forecastTotal.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {tab==='prices' && (
        <div style={card}>
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
            ['drawer','Drawer'],['waxedDrawer','Waxed drawer'],
            ['hingedDoor','Hinged door'],['waxedHingedDoor','Waxed hinged door'],
            ['slidingDoor','Sliding door'],['waxedSlidingDoor','Waxed sliding door'],
            ['upOverDoor','Up & over door'],['waxedUpOverDoor','Waxed up & over door'],
            ['shakerDoor','Shaker door'],['waxedShakerDoor','Waxed shaker door'],
            ['shelf','Shelf'],['bars','Bars (average)'],
            ['panelDivide','Panel divide'],['waxedPanelDivide','Waxed panel divide'],
            ['dogDivide','Dog divide'],['waxedDogDivide','Waxed dog divide'],
          ]}/>
          <div style={{ fontSize:11, color:'#aaa', fontStyle:'italic', marginTop:4 }}>
            Prices save automatically. Every unit gets 2.7 bars + Hammerite + consumables automatically.
          </div>
        </div>
      )}
    </div>
  );
}
