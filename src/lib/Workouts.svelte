<script>
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import DemoVideo from './DemoVideo.svelte';
  import { db, WEEKDAYS, WEEK_ORDER, sessionsOn } from './store.svelte.js';
  import {
    planState, importPlan, removePlan, exportPlan, planDay, planAreas, disabledReason, toggleArea, setOverride, nextWorkout, startSession, removeSession,
    previousSets, progress, sessionLabel,
  } from './workout.svelte.js';

  let { date, openId = null, onclose } = $props();

  const plan = $derived(planState.plan);
  let msg = $state('');
  let fileInput = $state();
  let picked = $state(); // session opened from inside the dialog; until then the one the dialog was opened with
  const current = $derived(picked === undefined ? openId : picked);
  const session = $derived(db.workouts.find((w) => w.id === current));

  // start picker, defaulting to the next workout that is still to do
  const next = $derived(plan ? nextWorkout(plan) : null);
  let pickWeek = $state(null);
  let pickDay = $state(null);
  const week = $derived(pickWeek ?? next?.week ?? 1);
  const dayId = $derived(pickDay ?? next?.day ?? plan?.days[0].id);
  const pickedDay = $derived(plan && planDay(plan, week, dayId));

  const onDate = $derived(sessionsOn(date));
  const history = $derived(db.workouts.filter((w) => w.done).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8));
  const areas = $derived(plan ? planAreas(plan) : []);
  const injury = $derived(db.workout.injury);

  // every distinct exercise in the plan, for the per-exercise injury switches
  const exercises = $derived.by(() => {
    const seen = new Map();
    for (const w of plan?.weeks ?? []) for (const d of w.days) for (const e of d.exercises) if (!seen.has(e.id)) seen.set(e.id, e);
    return [...seen.values()];
  });

  async function onFile(e) {
    const input = e.currentTarget;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const p = await importPlan(file);
      msg = `Imported ${p.name}: ${p.weeks.length} weeks.`;
    } catch (err) {
      msg = `Import failed: ${err.message}`;
    }
  }

  function start() {
    const s = startSession(plan, date, week, dayId);
    if (s) picked = s.id;
  }

  const dateLabel = $derived(new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));

  // ---- one session

  const prog = $derived(session ? progress(session) : null);
  const planEx = (item) => (session && plan ? planDay(plan, session.week, session.day)?.exercises.find((e) => e.id === item.id) : null);

  function finish() {
    const left = prog.sets - prog.done;
    if (left > 0 && !confirm(`${left} planned ${left === 1 ? 'set is' : 'sets are'} not logged yet. Finish anyway?`)) return;
    session.done = true;
    picked = null;
  }

  function toggleSkip(item) {
    item.skipped = item.skipped ? undefined : true;
    delete item.reason;
  }

  // "Done as" picker: log the exercise under a substitution instead
  function swap(item, ex, name) {
    const sub = ex.substitutions.find((s) => s.name === name);
    item.name = sub ? sub.name : ex.name;
    item.video = (sub ? sub.video : ex.video) || undefined;
  }

  function numField(set, key, e) {
    const v = e.currentTarget.valueAsNumber;
    set[key] = v >= 0 ? v : null;
  }

  function toggleSet(item, i) {
    const s = item.sets[i];
    if (!s.done) {
      // fill empty fields from last time so a repeat is one tap
      const prev = previousSets(item.id, session.id);
      if (s.load == null && prev) s.load = (prev[i] ?? prev[prev.length - 1]).load;
      if (s.reps == null && prev) s.reps = (prev[i] ?? prev[prev.length - 1]).reps;
    }
    s.done = !s.done;
  }

  const overrideLabel = { undefined: 'Auto', off: 'Off', on: 'On' };
  const nextOverride = { undefined: 'off', off: 'on', on: undefined };
</script>

<Modal title={session ? sessionLabel(session) : 'Workouts'} {onclose}>
  {#if session}
    <button class="btn justify-self-start px-3 py-1 text-sm" onclick={() => (picked = null)}>← Back</button>
    <p class="muted">
      {new Date(session.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} ·
      {prog.done}/{prog.sets} sets{prog.skipped ? ` · ${prog.skipped} skipped` : ''}{session.done ? ' · finished' : ''}
    </p>

    <ul class="grid gap-3">
      {#each session.items as item (item.id)}
        {@const ex = planEx(item)}
        <li class="grid gap-2 rounded-xl border border-stone-200 p-3 dark:border-stone-800 {item.skipped ? 'opacity-60' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-medium break-words {item.skipped ? 'line-through' : ''}">{item.name}</div>
              {#if item.reason === 'injury'}
                <div class="text-sm text-amber-700 dark:text-amber-400">Skipped: injury mode</div>
              {/if}
              {#if ex}
                <div class="muted">
                  {ex.sets} × {ex.timed ? 'hold' : ex.reps}{ex.rir.length ? ` · RIR ${ex.rir.join(' / ')}` : ''} · rest {ex.rest}{ex.warmupSets ? ` · warm-up ${ex.warmupSets}` : ''}
                </div>
                {#if ex.technique}<div class="text-sm font-medium text-emerald-700 dark:text-emerald-400">Last set: {ex.technique}</div>{/if}
              {/if}
            </div>
            <button class="btn min-h-9 shrink-0 px-3 py-1 text-sm" onclick={() => toggleSkip(item)}>{item.skipped ? 'Include' : 'Skip'}</button>
          </div>

          {#if !item.skipped}
            {#if ex?.notes}<p class="muted">{ex.notes}</p>{/if}
            {#if ex?.substitutions.length}
              <label class="label">Done as
                <select class="field" value={ex.substitutions.some((s) => s.name === item.name) ? item.name : ex.name} onchange={(e) => swap(item, ex, e.currentTarget.value)}>
                  <option value={ex.name}>{ex.name}</option>
                  {#each ex.substitutions as s}<option value={s.name}>{s.name}</option>{/each}
                </select>
              </label>
            {/if}
            <DemoVideo url={item.video ?? ex?.video} title="{item.name} demo" />

            {@const prev = previousSets(item.id, session.id)}
            <ul class="grid gap-1.5">
              {#each item.sets as set, i}
                <li class="grid grid-cols-[1.25rem_1fr_1fr_auto] items-center gap-2">
                  <span class="muted text-center">{i + 1}</span>
                  <input
                    class="field px-2 py-1"
                    type="number"
                    min="0"
                    step="any"
                    inputmode="decimal"
                    value={set.load}
                    placeholder={prev ? String((prev[i] ?? prev[prev.length - 1]).load) : 'kg'}
                    aria-label="Set {i + 1} load in kg"
                    onchange={(e) => numField(set, 'load', e)}
                  />
                  <input
                    class="field px-2 py-1"
                    type="number"
                    min="0"
                    step="1"
                    inputmode="numeric"
                    value={set.reps}
                    placeholder={prev ? String((prev[i] ?? prev[prev.length - 1]).reps) : ex?.timed ? 'sec' : 'reps'}
                    aria-label="Set {i + 1} {ex?.timed ? 'seconds' : 'reps'}"
                    onchange={(e) => numField(set, 'reps', e)}
                  />
                  <button
                    class="inline-flex size-9 items-center justify-center rounded-full border-2 {set.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 dark:border-stone-700'}"
                    aria-pressed={set.done}
                    aria-label="Set {i + 1} done"
                    onclick={() => toggleSet(item, i)}
                  >
                    {#if set.done}<Icon name="check" class="size-4" />{/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="grid grid-flow-col auto-cols-fr gap-2">
      <button class="btn btn-danger" onclick={() => confirm('Delete this workout and its logged sets?') && (removeSession(session.id), (picked = null))}>Delete</button>
      {#if session.done}
        <button class="btn" onclick={() => (session.done = false)}>Reopen</button>
      {:else}
        <button class="btn btn-primary" disabled={prog.done === 0} onclick={finish}>Finish workout</button>
      {/if}
    </div>
    {#if !session.done && prog.done === 0}<p class="muted">Log at least one set to finish.</p>{/if}
  {:else if !plan}
    <p class="muted">
      No workout plan loaded. Import a plan file (JSON, "workout-plan" format). Plans are kept only in this browser and are not part of the app or its backups.
    </p>
    <button class="btn btn-primary" onclick={() => fileInput.click()}>Import plan JSON…</button>
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
    {#if msg}<p class="muted" role="status">{msg}</p>{/if}
  {:else}
    <section class="grid gap-2">
      <h3 class="font-semibold">{dateLabel}</h3>
      {#each onDate as w (w.id)}
        <button class="btn justify-between" onclick={() => (picked = w.id)}>
          <span>{sessionLabel(w)}</span>
          <span class="muted">{w.done ? 'finished' : `${progress(w).done}/${progress(w).sets} sets`}</span>
        </button>
      {/each}
      {#if !onDate.some((w) => !w.done)}
        <div class="grid grid-cols-2 gap-2">
          <label class="label">Week
            <select class="field" value={week} onchange={(e) => (pickWeek = Number(e.currentTarget.value))}>
              {#each plan.weeks as w}<option value={w.week}>{w.week}{w.label ? ` · ${w.label.replace(/^Block \d · /, '')}` : ''}</option>{/each}
            </select>
          </label>
          <label class="label">Workout
            <select class="field" value={dayId} onchange={(e) => (pickDay = e.currentTarget.value)}>
              {#each plan.days as d}<option value={d.id}>{d.name}</option>{/each}
            </select>
          </label>
        </div>
        <button class="btn btn-primary" disabled={!pickedDay} onclick={start}>Start workout</button>
        {#if pickedDay}
          {@const off = pickedDay.exercises.filter((e) => disabledReason(e)).length}
          <p class="muted">{pickedDay.exercises.length} exercises{off ? `, ${off} skipped (injury mode or switched off)` : ''}</p>
        {/if}
      {/if}
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Injury mode</h3>
      <label class="flex items-start gap-2">
        <input class="mt-0.5 size-5 shrink-0 accent-emerald-600" type="checkbox" bind:checked={db.workout.injury.on} />
        Skip exercises that load injured areas
      </label>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Injured areas">
        {#each areas as a}
          <button class="btn min-h-8 px-2.5 py-1 text-sm {injury.areas.includes(a) ? 'btn-primary' : ''}" aria-pressed={injury.areas.includes(a)} onclick={() => toggleArea(a)}>{a}</button>
        {/each}
      </div>
      <details>
        <summary class="muted">Exercises ({exercises.filter((e) => disabledReason(e)).length} off)</summary>
        <ul class="divided mt-1">
          {#each exercises as e (e.id)}
            {@const reason = disabledReason(e)}
            <li class="flex items-center justify-between gap-2">
              <span class="min-w-0">
                <span class="block break-words {reason ? 'text-stone-400 line-through dark:text-stone-500' : ''}">{e.name}</span>
                <span class="muted block">{e.muscles.join(', ')}</span>
              </span>
              <button
                class="btn min-h-8 shrink-0 px-2.5 py-1 text-sm"
                aria-label="{e.name}: {overrideLabel[injury.overrides[e.id]]}. Change"
                onclick={() => setOverride(e.id, nextOverride[injury.overrides[e.id]])}
              >
                {overrideLabel[injury.overrides[e.id]]}
              </button>
            </li>
          {/each}
        </ul>
        <p class="muted mt-1">Auto follows injury mode, Off always skips, On always keeps. Takes effect for workouts you start from now on.</p>
      </details>
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Goals and settings</h3>
      <p class="muted">A workout counts once you've logged a set and finished it. The daily combo requires one on the days below; leave all days off to track without requiring it. While a plan is loaded, the plain "Strength workout" checkbox is hidden.</p>
      <div class="grid grid-cols-7 gap-1" role="group" aria-label="Workout days">
        {#each WEEK_ORDER as i}
          {@const on = db.workout.schedule.includes(i)}
          <button
            class="btn min-h-9 px-0 py-1 text-sm {on ? 'btn-primary' : ''}"
            aria-pressed={on}
            onclick={() => (db.workout.schedule = on ? db.workout.schedule.filter((d) => d !== i) : [...db.workout.schedule, i].sort((a, b) => a - b))}
          >{WEEKDAYS[i].slice(0, 3)}</button>
        {/each}
      </div>
      <label class="flex items-start gap-2">
        <input class="mt-0.5 size-5 shrink-0 accent-emerald-600" type="checkbox" bind:checked={db.workout.videoSound} />
        <span>Start demo videos with sound<span class="muted block">Off by default: muted videos don't interrupt music on your headphones.</span></span>
      </label>
    </section>

    {#if history.length}
      <section class="grid gap-2">
        <h3 class="font-semibold">Recent workouts</h3>
        <ul class="divided">
          {#each history as w (w.id)}
            <li>
              <button class="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800" onclick={() => (picked = w.id)}>
                <span>{sessionLabel(w)}</span>
                <span class="muted">{new Date(w.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="grid gap-2">
      <h3 class="font-semibold">Plan: {plan.name}</h3>
      <div class="grid grid-flow-col auto-cols-fr gap-2">
        <button class="btn" onclick={exportPlan}>Export</button>
        <button class="btn" onclick={() => fileInput.click()}>Replace…</button>
        <button class="btn btn-danger" onclick={() => confirm('Remove the plan from this browser? Logged workouts are kept.') && removePlan()}>Remove</button>
      </div>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
      {#if msg}<p class="muted" role="status">{msg}</p>{/if}
      {#if planState.error}<p class="text-red-600 dark:text-red-400" role="alert">{planState.error}</p>{/if}
    </section>
  {/if}
</Modal>
