// Workout tracking. The plan itself is never bundled with the app: it is imported from a JSON file ("workout-plan" format)
// and kept in this browser only. Logged sessions live in `db.workouts` (see store.svelte.js) so they back up and count towards goals.
import { db, uid, planInfo } from './store.svelte.js';

const PLAN_KEY = 'calorie-counter:workout-plan:v1';

const str = (v) => (typeof v === 'string' ? v : '');
const posInt = (v, fallback) => (Number.isInteger(v) && v > 0 ? v : fallback);

// ---- plan: validation, storage, export

function cleanExercise(e) {
  if (!e || typeof e !== 'object' || !str(e.name).trim()) return null;
  return {
    id: str(e.id) || str(e.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: e.name.trim(),
    optional: e.optional === true,
    muscles: (Array.isArray(e.muscles) ? e.muscles : []).filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim().toLowerCase()),
    warmupSets: str(e.warmupSets),
    sets: posInt(e.sets, 1),
    timed: e.timed === true, // a hold measured in seconds instead of reps
    reps: str(e.reps),
    rir: (Array.isArray(e.rir) ? e.rir : []).filter((n) => Number.isInteger(n)),
    rest: str(e.rest),
    technique: str(e.technique),
    notes: str(e.notes),
    video: str(e.video),
    substitutions: (Array.isArray(e.substitutions) ? e.substitutions : [])
      .filter((s) => s && str(s.name).trim())
      .map((s) => ({ name: s.name.trim(), video: str(s.video) })),
  };
}

export function parsePlan(data) {
  if (!data || data.format !== 'workout-plan' || !Array.isArray(data.days) || !Array.isArray(data.weeks)) {
    throw new Error('This is not a workout plan file.');
  }
  const days = data.days.filter((d) => d && str(d.id) && str(d.name)).map((d) => ({ id: d.id, name: d.name }));
  const weeks = data.weeks
    .map((w, i) => ({
      week: posInt(w?.week, i + 1),
      label: str(w?.label),
      days: (Array.isArray(w?.days) ? w.days : [])
        .filter((d) => days.some((x) => x.id === d?.day))
        .map((d) => ({ day: d.day, exercises: (Array.isArray(d.exercises) ? d.exercises : []).map(cleanExercise).filter(Boolean) })),
    }))
    .filter((w) => w.days.length)
    .sort((a, b) => a.week - b.week);
  if (!days.length || !weeks.length) throw new Error('The plan has no workouts.');
  return { format: 'workout-plan', version: 1, name: str(data.name) || 'Workout plan', description: str(data.description), days, weeks };
}

function loadPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) return parsePlan(JSON.parse(raw));
  } catch {}
  return null;
}

export const planState = $state({ plan: loadPlan(), error: '' });
planInfo.loaded = !!planState.plan;

function savePlan(plan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    planState.error = '';
  } catch (err) {
    planState.error = 'Could not store the plan in this browser (storage full or blocked).';
    console.error(err);
  }
}

export async function importPlan(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const plan = parsePlan(data);
  planState.plan = plan;
  planInfo.loaded = true;
  savePlan(plan);
  // first plan: due on four weekdays out of the box, so tracked workouts count towards the combo
  if (!db.workout.schedule.length) db.workout.schedule = [1, 2, 4, 5].slice(0, plan.days.length);
  return plan;
}

export function removePlan() {
  planState.plan = null;
  planInfo.loaded = false;
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {}
}

export function exportPlan() {
  const blob = new Blob([JSON.stringify($state.snapshot(planState.plan), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'workout-plan.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const planDay = (plan, week, dayId) => plan.weeks.find((w) => w.week === week)?.days.find((d) => d.day === dayId);
export const dayName = (plan, dayId) => plan.days.find((d) => d.id === dayId)?.name ?? 'Workout';

// ---- injury mode

// Every area the plan's exercises mention, for the injury picker.
export function planAreas(plan) {
  const all = new Set();
  for (const w of plan.weeks) for (const d of w.days) for (const e of d.exercises) for (const m of e.muscles) all.add(m);
  return [...all].sort();
}

// Why an exercise is off: 'injury' (it loads an injured area), 'manual' (switched off by hand) or null when it is on.
// A manual "on"/"off" always beats the automatic rule.
export function disabledReason(ex, injury = db.workout.injury) {
  const o = injury.overrides[ex.id];
  if (o === 'off') return 'manual';
  if (o === 'on') return null;
  return injury.on && ex.muscles.some((m) => injury.areas.includes(m)) ? 'injury' : null;
}

export function toggleArea(area) {
  const a = db.workout.injury.areas;
  db.workout.injury.areas = a.includes(area) ? a.filter((x) => x !== area) : [...a, area];
}

// Cycles one exercise between "follow injury mode", forced off and forced on.
export function setOverride(id, value) {
  if (value) db.workout.injury.overrides[id] = value;
  else delete db.workout.injury.overrides[id];
}

// ---- sessions

export const finishedSessions = () => db.workouts.filter((w) => w.done);

// The first workout in plan order that hasn't been finished yet (or the last one when everything is done).
export function nextWorkout(plan) {
  const done = new Set(finishedSessions().map((w) => `${w.week}/${w.day}`));
  let last = null;
  for (const w of plan.weeks) {
    for (const d of w.days) {
      last = { week: w.week, day: d.day };
      if (!done.has(`${w.week}/${d.day}`)) return last;
    }
  }
  return last;
}

export function startSession(plan, date, week, dayId) {
  const day = planDay(plan, week, dayId);
  if (!day) return null;
  const items = day.exercises.map((e) => {
    const reason = disabledReason(e);
    return {
      id: e.id,
      name: e.name,
      sets: Array.from({ length: e.sets }, () => ({ load: null, reps: null, done: false })),
      skipped: !!reason || undefined,
      ...(reason === 'injury' && { reason: 'injury' }),
      ...(e.video && { video: e.video }),
    };
  });
  const session = { id: uid(), date, week, day: dayId, dayName: dayName(plan, dayId), done: false, items };
  db.workouts.push(session);
  return db.workouts[db.workouts.length - 1];
}

export const removeSession = (id) => {
  const i = db.workouts.findIndex((w) => w.id === id);
  if (i >= 0) db.workouts.splice(i, 1);
};

// What was done last time for this exercise: the sets of the most recent earlier session that logged any.
export function previousSets(exId, beforeId) {
  const sessions = db.workouts.filter((w) => w.id !== beforeId).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const w of sessions) {
    const item = w.items.find((i) => i.id === exId);
    const sets = item?.sets.filter((s) => s.done && s.load != null && s.reps != null);
    if (sets?.length) return sets;
  }
  return null;
}

export function progress(session) {
  const active = session.items.filter((i) => !i.skipped);
  const sets = active.reduce((n, i) => n + i.sets.length, 0);
  const done = active.reduce((n, i) => n + i.sets.filter((s) => s.done).length, 0);
  return { sets, done, exercises: active.length, skipped: session.items.length - active.length };
}

export const sessionLabel = (w) => `Week ${w.week} · ${w.dayName}`;

// ---- demo videos

// Only YouTube links can be embedded; anything else is shown as a plain link.
export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/) ?? [])[1];
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
