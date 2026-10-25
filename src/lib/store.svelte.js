import { foodIcon } from './foodIcon.js';

const KEY = 'calorie-counter:v1';
export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
// Indexed like Date.getDay() (0 = Sunday); WEEK_ORDER is the order shown to the user, Monday first.
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

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

// "Supplements" holds every daily checkbox item. `group` tells them apart: 'supplement' or 'activity' (steps, workouts).
// The field names stay as they were so existing saved data and exports keep working.
const defaultActivities = () => [
  { id: 'steps', name: 'Daily step goal', group: 'activity', schedule: { type: 'daily' } },
  { id: 'strength', name: 'Strength workout', group: 'activity', schedule: { type: 'weekdays', days: [1, 3, 5] } }, // Mon, Wed, Fri
];

const defaultSupplements = () => [
  { id: 'creatine', name: 'Creatine', group: 'supplement', schedule: { type: 'daily' } },
  { id: 'citrulline', name: 'Citrulline', group: 'supplement', schedule: { type: 'daily' } },
  { id: 'd3', name: 'D3', group: 'supplement', schedule: { type: 'daily' } },
  { id: 'b12', name: 'B12', group: 'supplement', schedule: { type: 'daily' } },
  { id: 'zinc', name: 'Zinc', group: 'supplement', schedule: { type: 'weekday', day: 1 } }, // Mondays
  { id: 'magnesium', name: 'Magnesium', group: 'supplement', schedule: { type: 'interval', every: 2, anchor: todayStr() } },
  ...defaultActivities(),
];

const defaults = () => ({
  version: 2,
  goals: { kcal: 2100, kcalTolerance: 100, protein: 120, fiber: 40, comboActivities: true, comboGraceDays: 1, comboGraceCooldown: 7, targetWeight: 0 },
  supplements: defaultSupplements(),
  supplementLog: {}, // { 'YYYY-MM-DD': [supplementId, ...] }
  products: [], // saved/custom products and recipes, nutrition per 100 g
  weights: [], // body weight in kg, one per day: { date, kg }, sorted by date
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

function cleanWeights(list) {
  const byDay = new Map();
  for (const w of Array.isArray(list) ? list : []) {
    if (w && isDateStr(w.date) && isNum(w.kg) && w.kg > 0 && w.kg < 1000) byDay.set(w.date, { date: w.date, kg: w.kg });
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
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
  if (r.type === 'weekdays' && Array.isArray(r.days)) {
    const days = [...new Set(r.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
    if (days.length) schedule = { type: 'weekdays', days };
  }
  if (r.type === 'interval') {
    const every = Number.isInteger(r.every) && r.every >= 2 ? r.every : 2;
    schedule = { type: 'interval', every, anchor: isDateStr(r.anchor) ? r.anchor : todayStr() };
  }
  return { id: str(s.id) || uid(), name: s.name.trim(), group: s.group === 'activity' ? 'activity' : 'supplement', schedule };
}

const clean = (list, fn) => (Array.isArray(list) ? list.map(fn).filter(Boolean) : []);

// Data from before activities existed (version 1) gets the default activity items once.
function withDefaultActivities(d, items) {
  if ((d?.version ?? 1) >= 2) return items;
  const have = new Set(items.map((s) => s.id));
  return [...items, ...defaultActivities().filter((a) => !have.has(a.id))];
}

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
    version: 2,
    // data saved before fiber goals existed carries the old default goals; drop them
    goals: g && 'fiber' in g
      ? {
          kcal: nonNeg(g.kcal) || base.goals.kcal,
          kcalTolerance: 'kcalTolerance' in g ? nonNeg(g.kcalTolerance) : base.goals.kcalTolerance,
          protein: nonNeg(g.protein),
          fiber: nonNeg(g.fiber),
          comboActivities: g.comboActivities !== false,
          comboGraceDays: 'comboGraceDays' in g ? Math.floor(nonNeg(g.comboGraceDays)) : base.goals.comboGraceDays,
          comboGraceCooldown: 'comboGraceCooldown' in g ? Math.floor(nonNeg(g.comboGraceCooldown)) : base.goals.comboGraceCooldown,
          targetWeight: nonNeg(g.targetWeight),
        }
      : base.goals,
    supplements: Array.isArray(d?.supplements) ? withDefaultActivities(d, clean(d.supplements, cleanSupplement)) : base.supplements,
    supplementLog: log,
    products: clean(d?.products, cleanProduct),
    weights: cleanWeights(d?.weights),
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
  db.weights = next.weights;
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

// ---- body weight

// Sets the weight for a day (one per day, replaces an earlier one).
export function setWeight(date, kg) {
  db.weights = cleanWeights([...db.weights.filter((w) => w.date !== date), { date, kg }]);
}

export const removeWeight = (date) => {
  db.weights = db.weights.filter((w) => w.date !== date);
};

export const scale = (e, key) => ((e[key] ?? 0) * e.grams) / 100;

export function totals(entries) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 };
  for (const e of entries) for (const k in t) t[k] += scale(e, k);
  return t;
}

// ---- backup

const BACKUP_KEY = 'calorie-counter:lastBackup';
const readTime = () => {
  try {
    return Number(localStorage.getItem(BACKUP_KEY)) || 0;
  } catch {
    return 0;
  }
};

// When data was last saved to a file (manual export or auto-backup), ms since epoch; 0 = never.
export const backupMeta = $state({ last: readTime() });

export function markBackup() {
  backupMeta.last = Date.now();
  try {
    localStorage.setItem(BACKUP_KEY, String(backupMeta.last));
  } catch {}
}

export const backupJson = () => JSON.stringify($state.snapshot(db), null, 2);

export function exportJson() {
  markBackup();
  const blob = new Blob([backupJson()], { type: 'application/json' });
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
    throw new Error('This does not look like a sudo upgrade export.');
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
  const have = new Set(db.weights.map((w) => w.date));
  db.weights = cleanWeights([...db.weights, ...next.weights.filter((w) => !have.has(w.date))]);
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
    weights: snap.weights.filter((w) => inRange(w.date)),
  };
}

// ---- supplements

export function isDue(s, date) {
  const r = s.schedule ?? { type: 'daily' };
  if (r.type === 'weekday') return new Date(date + 'T12:00:00').getDay() === r.day;
  if (r.type === 'weekdays') return r.days.includes(new Date(date + 'T12:00:00').getDay());
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
  if (r.type === 'weekdays') return WEEK_ORDER.filter((d) => r.days.includes(d)).map((d) => WEEKDAYS[d].slice(0, 3)).join(', ');
  if (r.type === 'interval') return r.every === 2 ? 'every second day' : `every ${r.every} days`;
  return 'daily';
}

// Adds a new item or updates the one with the same id.
export function saveSupplement(item) {
  const existing = db.supplements.find((s) => s.id === item.id);
  if (existing) Object.assign(existing, item);
  else db.supplements.push({ ...item, id: item.id ?? uid() });
}

// ---- daily combo: supplements all taken + activities done + protein & fiber reached + calories within tolerance

function dayStatus(date, t) {
  const due = db.supplements.filter((s) => s.group !== 'activity' && isDue(s, date));
  const taken = due.filter((s) => isTaken(s.id, date)).length;
  const { kcal, kcalTolerance, protein, fiber, comboActivities } = db.goals;
  const supplements = { done: taken, total: due.length, ok: taken === due.length };
  const dueActivities = db.supplements.filter((s) => s.group === 'activity' && isDue(s, date));
  const doneActivities = dueActivities.filter((s) => isTaken(s.id, date)).length;
  // a rest day (nothing due) counts as done; when the option is off activities never block the combo
  const activities = { done: doneActivities, total: dueActivities.length, ok: !comboActivities || doneActivities === dueActivities.length };
  const proteinFiber = { ok: t.protein >= protein && t.fiber >= fiber };
  const calories = { ok: t.kcal > 0 && Math.abs(t.kcal - kcal) <= kcalTolerance };
  return { supplements, activities, proteinFiber, calories, all: supplements.ok && activities.ok && proteinFiber.ok && calories.ok };
}

export function comboStatus(date) {
  return dayStatus(date, totals(db.entries.filter((e) => e.date === date)));
}

const EMPTY_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 };

function groupByDate() {
  const byDate = new Map();
  for (const e of db.entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  return byDate;
}

const isComboDay = (d, byDate) => dayStatus(d, byDate.has(d) ? totals(byDate.get(d)) : EMPTY_TOTALS).all;

// Replays the days up to `upTo` in order to work out the streak.
//  - A combo day extends it.
//  - A missed day is forgiven (the streak survives, the day just doesn't count) when a grace day is available:
//    at most `comboGraceDays` missed days in a row, and a new forgiven stretch only starts if no day was forgiven in the
//    previous `comboGraceCooldown` days. Otherwise the streak is over.
//  - Today, while unfinished, is neither a combo day nor a miss.
// Returns the streak, the forgiven stretch it currently ends in, per-day marks for the calendar and what would happen if
// today ended incomplete.
function simulate(upTo, today) {
  const { comboGraceDays: grace = 0, comboGraceCooldown: cooldown = 0 } = db.goals;
  const byDate = groupByDate();
  const first = db.entries.reduce((min, e) => (e.date < min ? e.date : min), upTo);
  const start = first > addDays(upTo, -400) ? first : addDays(upTo, -400);
  const marks = new Map();
  let count = 0;
  let run = []; // forgiven days at the end of the streak so far
  let lastForgiven = null;
  let pending = false;

  const mayStartGrace = (d) => grace >= 1 && (cooldown === 0 || lastForgiven === null || dayNumber(d) - dayNumber(lastForgiven) > cooldown);

  for (let d = start; d <= upTo && d <= today; d = addDays(d, 1)) {
    if (isComboDay(d, byDate)) {
      marks.set(d, 'combo');
      count++;
      run = [];
    } else if (d === today) {
      pending = d === upTo;
    } else if (count > 0) {
      if (run.length ? run.length < grace : mayStartGrace(d)) {
        run.push(d);
        lastForgiven = d;
        marks.set(d, 'forgiven');
      } else {
        // out of grace: the streak ends, and the days forgiven on the way were forgiven for nothing
        for (const x of run) marks.delete(x);
        count = 0;
        run = [];
        lastForgiven = null;
      }
    }
  }
  const risk = count > 0 && pending ? ((run.length ? run.length < grace : mayStartGrace(upTo)) ? 'grace' : 'lost') : null;

  // A comeback is a combo day right after a day that wasn't one, once there has been a combo day before:
  // 'saved' when that missed day was forgiven (the streak lives on), 'restart' when the streak had ended.
  let comeback = null;
  if (marks.get(upTo) === 'combo') {
    const prev = marks.get(addDays(upTo, -1));
    const earlier = [...marks].some(([d, m]) => m === 'combo' && d < addDays(upTo, -1));
    if (prev === 'forgiven') comeback = 'saved';
    else if (prev !== 'combo' && earlier) comeback = 'restart';
  }
  return { count, graceUsed: run.length, risk, comeback, marks };
}

// Streak of combo days ending at `date`: { count, graceUsed, risk, comeback }.
// risk is only set while today is unfinished: 'lost' if ending the day incomplete ends the streak, 'grace' if it would
// use a grace day instead.
export function comboStreak(date, today = todayStr()) {
  const { count, graceUsed, risk, comeback } = simulate(date, today);
  return { count, graceUsed, risk, comeback };
}

// Marks days from..to for the calendar: 'combo' (all goals met) or 'forgiven' (a missed day the grace rules covered).
// Everything else is left out of the map.
export function comboDays(from, to, today = todayStr()) {
  const { marks } = simulate(to, today);
  return new Map([...marks].filter(([d]) => d >= from && d <= to));
}
