export const ROLE_DEFS = [
  { key:'manager',   label:'Manager',         color:'#7F77DD', stdDay:7.5 },
  { key:'maker1',    label:'Cabinet maker',   color:'#1D9E75', stdDay:7   },
  { key:'maker2',    label:'Cabinet maker 2', color:'#0F6E56', stdDay:7   },
  { key:'painter',   label:'Painter',         color:'#D85A30', stdDay:7   },
  { key:'assistant', label:'Assistant (PT)',  color:'#BA7517', stdDay:7, daysPerWeek:3 },
];

export const QTYS = [
  ['carc','Carcasses'],['draw','Drawers'],['hdoor','Hinged doors'],
  ['sdoor','Sliding doors'],['udoor','Up & over doors'],['shaker','Shaker doors (fit)'],
  ['wt','Worktops'],['shelf','Shelves'],['bar','Bar sets'],
  ['pdiv','Panel divides'],['ddogdiv','Dog divides'],['ddiv','Drawer divides'],
  ['paint','Units to paint'],['curtain','Curtains'],
];

// Unit types — drives which PROD_TASKS array is used per client order
export const UNIT_TYPES = [
  { key:'painted', label:'Painted' },
  { key:'waxed',   label:'Waxed finish' },
  { key:'egger',   label:'Egger / face frame' },
];

export const MGMT_TASKS = [
  { n:'Morning team meeting',                   m:15   },
  { n:'Order materials',                        m:null },
  { n:'Order consumables',                      m:null },
  { n:'Order shaker doors & panelling',         m:null },
  { n:'Confirm designs & work out bespoke',     m:null },
  { n:'Schedule builds & generate cut lists',   m:null },
  { n:'Directors meeting',                      m:null },
  { n:'Track holidays, lateness & absence',     m:null },
  { n:'H&S refresher',                          m:null },
  { n:'Accident & near miss reporting',         m:null },
  { n:'Weekly fire test',                       m:15   },
  { n:'R&D',                                    m:null },
  { n:'Stocktake & track materials',            m:null },
  { n:'Training',                               m:null },
  { n:'Performance reviews',                    m:null },
];

export const WORKSHOP_TASKS = [
  { section:'Daily — all team',    n:'Fill glue pots',                            m:10,  role:'assistant' },
  { section:'Daily — all team',    n:'Clean kitchen',                             m:15,  role:'assistant' },
  { section:'Daily — MDF priming', n:'Prime MDF sheets',                          m:20,  role:'assistant', hasQty:true },
  { section:'Maintenance',         n:'Clean table saw & planer',                  m:30,  role:'maker1'    },
  { section:'Maintenance',         n:'Replace extraction bags / clean extraction', m:60, role:'assistant' },
  { section:'Weekly — facilities', n:'Vacuum workshop floor',                     m:60,  role:'assistant' },
  { section:'Weekly — facilities', n:'Clean bathroom & mop floors',               m:30,  role:'assistant' },
  { section:'Weekly — production', n:'Split 44mm, plane & sand edges',            m:60,  role:'maker1'    },
  { section:'Support',             n:'Assist with build',                         m:60,  role:'assistant' },
  { section:'Support',             n:'Assist with deliveries',                    m:60,  role:'assistant' },
  { section:'Support',             n:'Restock consumables & tidy off-cuts',       m:30,  role:'assistant' },
];

// ─── Painted (standard) production tasks ────────────────────────────────────
export const PROD_TASKS = [
  { phase:'Panel & structural cutting', n:'Cut panels & face frames (check type & label, tidy off-cuts)', m:45, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Cut worktops & shelves (check type & label, tidy off-cuts)',   m:15, q:'wt_shelf', role:'maker1' },
  { phase:'Panel & structural cutting', n:'Pocket panels, take off edges incl. grain ends & vacuum area', m:30, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Build face frames & clean joints',                             m:30, q:'carc',    role:'maker1' },
  { phase:'Carcass construction',       n:'Build carcass & attach face frame',   m:60, q:'carc',    role:'maker1' },
  { phase:'Carcass construction',       n:'Panel divide',                        m:15, q:'pdiv',    role:'maker1' },
  { phase:'Carcass construction',       n:'Dog divide',                          m:45, q:'ddogdiv', role:'maker1' },
  { phase:'Drawer construction',        n:'Cut drawer components, sand edges, build', m:45, q:'draw', role:'maker1' },
  { phase:'Drawer construction',        n:'Fit drawer divide',                   m:20, q:'ddiv',    role:'maker1' },
  { phase:'Drawer construction',        n:'Fit drawer front',                    m:15, q:'dfront',  role:'maker1' },
  { phase:'Door construction',          n:'Hinged door, sand edges',             m:90,  q:'hdoor',  role:'maker1' },
  { phase:'Door construction',          n:'Sliding door, sand edges',            m:90,  q:'sdoor',  role:'maker1' },
  { phase:'Door construction',          n:'Up & over door, sand edges',          m:120, q:'udoor',  role:'maker1' },
  { phase:'Door construction',          n:'Shaker door — fit pre-ordered',       m:30,  q:'shaker', role:'maker1' },
  { phase:'Bars & components',          n:'Cut bars, sand, label & clean area',  m:45, q:'bar',     role:'maker1' },
  { phase:'Bars & components',          n:'Add bar bits',                        m:40, q:'bar',     role:'maker1' },
  { phase:'Worktops & shelves',         n:'Sand, wax & store worktop',           m:60, q:'wt',      role:'maker1' },
  { phase:'Worktops & shelves',         n:'Sand, wax & store shelf',             m:20, q:'shelf',   role:'maker1' },
  { phase:'Unit prep for painting',     n:'Quality checklist',                   m:10, q:'carc',    role:'painter' },
  { phase:'Unit prep for painting',     n:'Attach paint timbers',                m:20, q:'carc',    role:'painter' },
  { phase:'Unit prep for painting',     n:'Apply filler',                        m:20, q:'carc',    role:'painter' },
  { phase:'Unit prep for painting',     n:'Sand panels & filler',                m:30, q:'carc',    role:'painter' },
  { phase:'Unit prep for painting',     n:'Vacuum unit',                         m:10, q:'carc',    role:'painter' },
  { phase:'Unit prep for painting',     n:'Caulk if needed',                     m:20, q:'carc',    role:'painter' },
  { phase:'Unit prep for painting',     n:'Prime bare sections & wash out brush', m:15, q:'carc',   role:'painter' },
  { phase:'Paint process',              n:'Mix paint',                           m:20, q:'paint',   role:'painter' },
  { phase:'Paint process',              n:'First top coat (incl. drawers & doors)',  m:45, q:'paint', role:'painter' },
  { phase:'Paint process',              n:'Denib & vacuum',                      m:30, q:'paint',   role:'painter' },
  { phase:'Paint process',              n:'Second top coat (incl. drawers & doors)', m:45, q:'paint', role:'painter' },
  { phase:'Paint process',              n:'Clean paint gun',                     m:20, q:null,      role:'painter' },
  { phase:'Paint process',              n:'Spray bars',                          m:30, q:'spraybar', role:'painter' },
  { phase:'Final assembly',             n:'Gather items & remove paint timbers', m:15, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Install worktop',                     m:20, q:'wt',      role:'manager' },
  { phase:'Final assembly',             n:'Fit doors & drawers',                 m:45, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Install ironmongery & bars',          m:60, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Drill & fit shelves',                 m:10, q:'shelf',   role:'manager' },
  { phase:'Final assembly',             n:'Vacuum & final check',                m:5,  q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Touch ups',                           m:20, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Record content / video',              m:20, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Fit curtains if needed',              m:10, q:'curtain', role:'manager' },
  { phase:'Packing & storage',          n:'Package & store finished items',      m:45, q:'carc',    role:'assistant' },
];

// ─── Waxed finish production tasks ──────────────────────────────────────────
export const PROD_TASKS_WAXED = [
  { phase:'Panel & structural cutting', n:'Cut laminate panels (check type & label, tidy off-cuts)',    m:45, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Cut worktops & shelves (check type & label, tidy off-cuts)', m:15, q:'wt_shelf', role:'maker1' },
  { phase:'Panel & structural cutting', n:'Pocket panels, take off edges & vacuum area',                m:30, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Cut oak lengths — plain & pocket',                           m:60, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Sand oak lengths & panels',                                  m:60, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Wax oak lengths and panels',                                 m:45, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Build face frames & clean joints',                           m:30, q:'carc',    role:'maker1' },
  { phase:'Carcass construction',       n:'Build carcass & attach face frame',   m:60, q:'carc',    role:'maker1' },
  { phase:'Carcass construction',       n:'Panel divide',                        m:15, q:'pdiv',    role:'maker1' },
  { phase:'Carcass construction',       n:'Dog divide',                          m:45, q:'ddogdiv', role:'maker1' },
  { phase:'Drawer construction',        n:'Cut drawer components, sand edges, wax, build', m:60, q:'draw', role:'maker1' },
  { phase:'Drawer construction',        n:'Fit drawer divide',                   m:20, q:'ddiv',    role:'maker1' },
  { phase:'Drawer construction',        n:'Fit drawer front',                    m:15, q:'dfront',  role:'maker1' },
  { phase:'Door construction',          n:'Hinged door, sand edges',             m:90,  q:'hdoor',  role:'maker1' },
  { phase:'Door construction',          n:'Sliding door, sand edges',            m:90,  q:'sdoor',  role:'maker1' },
  { phase:'Door construction',          n:'Up & over door, sand edges',          m:120, q:'udoor',  role:'maker1' },
  { phase:'Door construction',          n:'Shaker door — fit pre-ordered',       m:30,  q:'shaker', role:'maker1' },
  { phase:'Bars & components',          n:'Cut bars, sand, label & clean area',  m:45, q:'bar',     role:'maker1' },
  { phase:'Bars & components',          n:'Add bar bits',                        m:40, q:'bar',     role:'maker1' },
  { phase:'Worktops & shelves',         n:'Sand, wax & store worktop',           m:60, q:'wt',      role:'maker1' },
  { phase:'Worktops & shelves',         n:'Sand, wax & store shelf',             m:20, q:'shelf',   role:'maker1' },
  { phase:'Final assembly',             n:'Quality checklist',                   m:10, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Install worktop',                     m:20, q:'wt',      role:'manager' },
  { phase:'Final assembly',             n:'Fit doors & drawers',                 m:45, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Install ironmongery & bars',          m:60, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Drill & fit shelves',                 m:10, q:'shelf',   role:'manager' },
  { phase:'Final assembly',             n:'Vacuum & final check',                m:5,  q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Record content / video',              m:20, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Fit curtains if needed',              m:10, q:'curtain', role:'manager' },
  { phase:'Packing & storage',          n:'Package & store finished items',      m:45, q:'carc',    role:'assistant' },
];

// ─── Egger / face frame production tasks ────────────────────────────────────
export const PROD_TASKS_EGGER = [
  { phase:'Panel & structural cutting', n:'Cut worktops & shelves (check type & label, tidy off-cuts)', m:15, q:'wt_shelf', role:'maker1' },
  { phase:'Panel & structural cutting', n:'Pocket panels',                                              m:30, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Cut lengths — plain & pocket',                               m:60, q:'carc',    role:'maker1' },
  { phase:'Panel & structural cutting', n:'Build face frames & clean joints',                           m:30, q:'carc',    role:'maker1' },
  { phase:'Face frame paint prep',      n:'Apply and sand filler',               m:20, q:'carc',    role:'painter' },
  { phase:'Face frame paint prep',      n:'Mix paint',                           m:20, q:'carc',    role:'painter' },
  { phase:'Face frame paint prep',      n:'First top coat (incl. drawers & doors)',  m:20, q:'carc', role:'painter' },
  { phase:'Face frame paint prep',      n:'Denib & vacuum',                      m:15, q:'carc',    role:'painter' },
  { phase:'Face frame paint prep',      n:'Second top coat (incl. drawers & doors)', m:20, q:'carc', role:'painter' },
  { phase:'Face frame paint prep',      n:'Clean paint gun',                     m:20, q:null,      role:'painter' },
  { phase:'Carcass construction',       n:'Build carcass & attach face frame',   m:60, q:'carc',    role:'maker1' },
  { phase:'Carcass construction',       n:'Panel divide',                        m:15, q:'pdiv',    role:'maker1' },
  { phase:'Carcass construction',       n:'Dog divide',                          m:45, q:'ddogdiv', role:'maker1' },
  { phase:'Drawer construction',        n:'Cut drawer components, sand edges, build', m:60, q:'draw', role:'maker1' },
  { phase:'Drawer construction',        n:'Fit drawer divide',                   m:20, q:'ddiv',    role:'maker1' },
  { phase:'Drawer construction',        n:'Fit drawer front',                    m:15, q:'dfront',  role:'maker1' },
  { phase:'Door construction',          n:'Hinged door, sand edges',             m:90,  q:'hdoor',  role:'maker1' },
  { phase:'Door construction',          n:'Sliding door, sand edges',            m:90,  q:'sdoor',  role:'maker1' },
  { phase:'Door construction',          n:'Up & over door, sand edges',          m:120, q:'udoor',  role:'maker1' },
  { phase:'Door construction',          n:'Shaker door — fit pre-ordered',       m:30,  q:'shaker', role:'maker1' },
  { phase:'Bars & components',          n:'Cut bars, sand, label & clean area',  m:45, q:'bar',     role:'maker1' },
  { phase:'Bars & components',          n:'Add bar bits',                        m:40, q:'bar',     role:'maker1' },
  { phase:'Worktops & shelves',         n:'Sand, wax & store worktop',           m:60, q:'wt',      role:'maker1' },
  { phase:'Worktops & shelves',         n:'Sand, wax & store shelf',             m:20, q:'shelf',   role:'maker1' },
  { phase:'Final assembly',             n:'Quality checklist',                   m:10, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Install worktop',                     m:20, q:'wt',      role:'manager' },
  { phase:'Final assembly',             n:'Fit doors & drawers',                 m:45, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Install ironmongery & bars',          m:60, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Drill & fit shelves',                 m:10, q:'shelf',   role:'manager' },
  { phase:'Final assembly',             n:'Vacuum & final check',                m:5,  q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Record content / video',              m:20, q:'carc',    role:'manager' },
  { phase:'Final assembly',             n:'Fit curtains if needed',              m:10, q:'curtain', role:'manager' },
  { phase:'Packing & storage',          n:'Package & store finished items',      m:45, q:'carc',    role:'assistant' },
];

export const WORKSHOP_MONTH = 48 * 60;

export function getQty(qtys, q) {
  if (!q) return 1;
  if (q === 'wt_shelf') return Math.max(parseInt(qtys.wt)||0, parseInt(qtys.shelf)||0);
  return parseInt(qtys[q]) || 0;
}

export function rColor(k) { return ROLE_DEFS.find(r=>r.key===k)?.color || '#888'; }
export function rLabel(k) { return ROLE_DEFS.find(r=>r.key===k)?.label || k; }

// Pick the right task array based on unit type
function getProdTasks(unitType) {
  if (unitType === 'waxed') return PROD_TASKS_WAXED;
  if (unitType === 'egger') return PROD_TASKS_EGGER;
  return PROD_TASKS;
}

export function genClientTasks(cl) {
  const tasks = [];
  const dq = { ...cl.qtys, dfront: parseInt(cl.qtys.draw)||0, spraybar: parseInt(cl.qtys.bar)||0 };
  const prodTasks = getProdTasks(cl.unitType);
  for (const t of prodTasks) {
    let qty = 1;
    if (t.q) { qty = getQty(dq, t.q); if (!qty) continue; }
    tasks.push({
      id: `${cl.id}|${t.phase}|${t.n}`,
      n: qty > 1 ? `${t.n} ×${qty}` : t.n,
      m: t.m * (t.q ? qty : 1),
      phase: t.phase,
      sugRole: t.role,
      assignedRole: null,
      done: false,
    });
  }
  for (const b of (cl.bespoke||[])) {
    if (!b.desc || !b.mins) continue;
    tasks.push({ id:`${cl.id}|bespoke|${b.desc}`, n:b.desc, m:b.mins, phase:'Bespoke', sugRole:'manager', assignedRole:null, done:false });
  }
  return tasks;
}

export function genMgmtTasks() {
  return MGMT_TASKS.map(t=>({
    id: `mgmt|${t.n}`,
    n: t.n,
    m: t.m,
    phase: 'Management',
    sugRole: 'manager',
    assignedRole: null,
    done: false,
    needsTime: t.m === null,
  }));
}

export function genWsTasks() {
  return WORKSHOP_TASKS.map(t=>({
    id: `ws|${t.n}`,
    n: t.n,
    m: t.m,
    baseM: t.m,   // always the per-sheet/per-unit rate — never overwritten
    phase: t.section,
    sugRole: t.role,
    assignedRole: null,
    done: false,
    hasQty: t.hasQty || false,
    qty: t.hasQty ? 1 : undefined,
  }));
}
