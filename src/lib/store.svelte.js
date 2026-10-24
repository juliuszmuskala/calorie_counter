import { foodIcon } from './foodIcon.js';

const KEY = 'calorie-counter:v1';
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---- dates (always local calendar days, as 'YYYY-MM-DD')

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const uid = () => crypto.randomUUID();
export const todayStr = () => fmt(new Date());
export const isDateStr = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
export function addDays(date, n) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmt(d);
}
const dayNumber = (date) => Math.round(Date.parse(date + 'T00:00:00Z') / 86400000);

// ---- defaults & validation

const defaultSupplements = () => [
  { id: 'creatine', name: 'Creatine', schedule: { type: 'daily' } },
  { id: 'citrulline', name: 'Citrulline', schedule: { type: 'daily' } },
  { id: 'd3', name: 'D3', schedule: { type: 'daily' } },
  { id: 'b12', name: 'B12', schedule: { type: 'daily' } },
  { id: 'zinc', name: 'Zinc', schedule: { type: 'weekday', day: 1 } }, // Mondays
  { id: 'magnesium', name: 'Magnesium', schedule: { type: 'interval', every: 2, anchor: todayStr() } },
];

const defaults = () => ({
  version: 1,
  goals: { kcal: 2100, protein: 120, fiber: 40 },
  supplements: defaultSupplements(),
  supplementLog: {}, // { 'YYYY-MM-DD': [supplementId, ...] }
  products: [], // saved/custom products and recipes, nutrition per 100 g
  entries: [], // log entries; carry a product snapshot so they stay valid if the library changes
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v) => (isNum(v) && v >= 0 ? v : 0);
const str = (v) => (typeof v === 'string' ? v : '');

function cleanProduct(p) {
  if (!p || typeof p !== 'object' || !str(p.name).trim() || !isNum(p.kcal)) return null;
  const out = {
    ...p,
    id: str(p.id) || uid(),
    name: p.name.trim(),
    brand: str(p.brand),
    barcode: str(p.barcode),
    kcal: nonNeg(p.kcal),
    protein: nonNeg(p.protein),
    carbs: nonNeg(p.carbs),
    fat: nonNeg(p.fat),
    fiber: nonNeg(p.fiber),
    salt: nonNeg(p.salt),
    servingGrams: isNum(p.servingGrams) && p.servingGrams > 0 ? p.servingGrams : null,
    servingLabel: str(p.servingLabel),
  };
  if (out.source === 'recipe' && !Array.isArray(out.recipe?.ingredients)) out.source = 'custom';
  return out;
}

function cleanEntry(e) {
  if (!e || typeof e !== 'object' || !isDateStr(e.date) || !isNum(e.grams) || e.grams <= 0) return null;
  if (!str(e.name) || !isNum(e.kcal)) return null;
  return {
    id: str(e.id) || uid(),
    date: e.date,
    meal: MEALS.includes(e.meal) ? e.meal : 'Snacks',
    grams: e.grams,
    name: e.name,
    brand: str(e.brand),
    kcal: nonNeg(e.kcal),
    protein: nonNeg(e.protein),
    carbs: nonNeg(e.carbs),
    fat: nonNeg(e.fat),
    fiber: nonNeg(e.fiber),
    salt: nonNeg(e.salt),
    icon: str(e.icon) || undefined,
  };
}

// The default supplement was renamed D2 -> D3; carry old saved data and exports over.
const renameId = (id) => (id === 'd2' ? 'd3' : id);

function cleanSupplement(s) {
  if (!s || typeof s !== 'object' || !str(s.name).trim()) return null;
  if (s.id === 'd2' && s.name.trim() === 'D2') s = { ...s, id: 'd3', name: 'D3' };
  const r = s.schedule ?? {};
  let schedule = { type: 'daily' };
  if (r.type === 'weekday' && Number.isInteger(r.day) && r.day >= 0 && r.day <= 6) schedule = { type: 'weekday', day: r.day };
  if (r.type === 'interval') {
    const every = Number.isInteger(r.every) && r.every >= 2 ? r.every : 2;
    schedule = { type: 'interval', every, anchor: isDateStr(r.anchor) ? r.anchor : todayStr() };
  }
  return { id: str(s.id) || uid(), name: s.name.trim(), schedule };
}

const clean = (list, fn) => (Array.isArray(list) ? list.map(fn).filter(Boolean) : []);

function sanitize(d) {
  const base = defaults();
  const log = {};
  if (d?.supplementLog && typeof d.supplementLog === 'object') {
    for (const [day, ids] of Object.entries(d.supplementLog)) {
      if (isDateStr(day) && Array.isArray(ids) && ids.length) log[day] = ids.filter((x) => typeof x === 'string').map(renameId);
    }
  }
  const g = d?.goals;
  return {
    version: 1,
    // data saved before fiber goals existed carries the old default goals; drop them
    goals: g && 'fiber' in g
      ? { kcal: nonNeg(g.kcal) || base.goals.kcal, protein: nonNeg(g.protein), fiber: nonNeg(g.fiber) }
      : base.goals,
    supplements: Array.isArray(d?.supplements) ? clean(d.supplements, cleanSupplement) : base.supplements,
    supplementLog: log,
    products: clean(d?.products, cleanProduct),
    entries: clean(d?.entries, cleanEntry),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {}
  return defaults();
}

// ---- state & persistence

export const db = $state(load());
export const ui = $state({ saveError: '' });

function replaceAll(next) {
  db.goals = next.goals;
  db.supplements = next.supplements;
  db.supplementLog = next.supplementLog;
  db.products = next.products;
  db.entries = next.entries;
}

export function startPersisting() {
  const onStorage = (e) => {
    // another tab changed the data: pick it up rather than overwrite it later
    if (e.key !== KEY || !e.newValue) return;
    try {
      replaceAll(sanitize(JSON.parse(e.newValue)));
    } catch {}
  };
  window.addEventListener('storage', onStorage);

  const stop = $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify($state.snapshot(db));
      try {
        localStorage.setItem(KEY, json);
        ui.saveError = '';
      } catch (err) {
        ui.saveError = 'Could not save to this browser (storage full or blocked). Export a backup now.';
        console.error(err);
      }
    });
  });
  return () => {
    stop();
    window.removeEventListener('storage', onStorage);
  };
}

export function resetAll() {
  replaceAll(defaults());
}

// ---- products & entries

// Adds or updates a product in the library and returns the stored (reactive) object.
export function saveProduct(p) {
  const existing = p.id && db.products.find((x) => x.id === p.id);
  if (existing) {
    Object.assign(existing, p);
    return existing;
  }
  db.products.push({ ...p, id: p.id ?? uid() });
  return db.products[db.products.length - 1];
}

export const findSaved = (p) =>
  db.products.find((x) => (p.id && x.id === p.id) || (p.barcode && x.barcode === p.barcode) || (x.name === p.name && x.brand === (p.brand ?? '')));

export function addEntry({ date, meal, product, grams }) {
  db.entries.push({
    id: uid(),
    date,
    meal,
    grams,
    name: product.name,
    brand: product.brand ?? '',
    kcal: product.kcal,
    protein: product.protein,
    carbs: product.carbs,
    fat: product.fat,
    fiber: product.fiber ?? 0,
    salt: product.salt ?? 0,
    icon: foodIcon(product),
  });
}

export const removeEntry = (id) => {
  const i = db.entries.findIndex((e) => e.id === id);
  if (i >= 0) db.entries.splice(i, 1);
};

export const removeProduct = (id) => {
  const i = db.products.findIndex((p) => p.id === id);
  if (i >= 0) db.products.splice(i, 1);
};

export const scale = (e, key) => ((e[key] ?? 0) * e.grams) / 100;

export function totals(entries) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 };
  for (const e of entries) for (const k in t) t[k] += scale(e, k);
  return t;
}

// ---- backup

export function exportJson() {
  const blob = new Blob([JSON.stringify($state.snapshot(db), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `calorie-counter-${todayStr()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// mode: 'replace' overwrites everything; 'merge' adds items whose id isn't already present.
// Returns a short summary for display.
export async function importJson(file, mode) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  return applyImport(parseExport(data), mode);
}

// Validates and cleans exported data (from a file or a QR transfer). Throws if it isn't ours.
export function parseExport(data) {
  if (!data || typeof data !== 'object' || !['entries', 'products', 'supplements'].some((k) => Array.isArray(data[k]))) {
    throw new Error('This does not look like a Calorie Counter export.');
  }
  return sanitize(data);
}

export const summarize = (d) => ({ entries: d.entries.length, products: d.products.length, supplements: d.supplements.length });

export function applyImport(next, mode) {
  if (mode === 'replace') {
    replaceAll(next);
    return `Replaced data: ${next.entries.length} entries, ${next.products.length} products.`;
  }
  const pIds = new Set(db.products.map((p) => p.id));
  const eIds = new Set(db.entries.map((e) => e.id));
  const sIds = new Set(db.supplements.map((s) => s.id));
  const newP = next.products.filter((p) => !pIds.has(p.id));
  const newE = next.entries.filter((e) => !eIds.has(e.id));
  db.products.push(...newP);
  db.entries.push(...newE);
  db.supplements.push(...next.supplements.filter((s) => !sIds.has(s.id)));
  for (const [day, ids] of Object.entries(next.supplementLog)) {
    db.supplementLog[day] = [...new Set([...(db.supplementLog[day] ?? []), ...ids])];
  }
  return `Merged ${newE.length} new entries and ${newP.length} new products.`;
}

// What a QR transfer carries. `log` limits the diary: 'all', a number of recent days, or 'none'.
export function exportPayload(log = 'all') {
  const snap = $state.snapshot(db);
  if (log === 'all') return snap;
  const from = log === 'none' ? null : addDays(todayStr(), -(Number(log) - 1));
  const inRange = (d) => from !== null && d >= from;
  return {
    ...snap,
    entries: snap.entries.filter((e) => inRange(e.date)),
    supplementLog: Object.fromEntries(Object.entries(snap.supplementLog).filter(([d]) => inRange(d))),
  };
}

// ---- supplements

export function isDue(s, date) {
  const r = s.schedule ?? { type: 'daily' };
  if (r.type === 'weekday') return new Date(date + 'T12:00:00').getDay() === r.day;
  if (r.type === 'interval') {
    const every = r.every >= 2 ? r.every : 2;
    return (((dayNumber(date) - dayNumber(r.anchor)) % every) + every) % every === 0;
  }
  return true;
}

export const isTaken = (id, date) => !!db.supplementLog[date]?.includes(id);

export function toggleSupplement(id, date) {
  const list = db.supplementLog[date] ?? [];
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  if (next.length) db.supplementLog[date] = next;
  else delete db.supplementLog[date];
}

export function removeSupplement(id) {
  const i = db.supplements.findIndex((s) => s.id === id);
  if (i >= 0) db.supplements.splice(i, 1);
}

export function describeSchedule(r) {
  if (r.type === 'weekday') return `every ${WEEKDAYS[r.day]}`;
  if (r.type === 'interval') return r.every === 2 ? 'every second day' : `every ${r.every} days`;
  return 'daily';
}
