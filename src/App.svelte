<script>
  import {
    db, ui, exportJson, MEALS, todayStr, addDays, removeEntry, markEaten, scale, totals, startPersisting, isDue, isTaken, isShortcutHidden, toggleSupplement, sessionsOn, workoutDone, workoutDue, comboStatus, comboStreak,
  } from './lib/store.svelte.js';
  import { backup, startAutoBackup, reminderDue, daysSinceBackup, resumeBackup, snoozeReminder } from './lib/backup.svelte.js';
  import AddFood from './lib/AddFood.svelte';
  import Settings from './lib/Settings.svelte';
  import Trends from './lib/Trends.svelte';
  import Workouts from './lib/Workouts.svelte';
  import { planState, nextWorkout, progress, sessionLabel } from './lib/workout.svelte.js';
  import DatePicker from './lib/DatePicker.svelte';
  import EntryDetails from './lib/EntryDetails.svelte';
  import IncomingTransfer from './lib/IncomingTransfer.svelte';
  import { readIncoming } from './lib/qr.js';
  import { celebrate } from './lib/celebrate.js';
  import Bar from './lib/Bar.svelte';
  import ProductIcon from './lib/ProductIcon.svelte';
  import Icon from './lib/Icon.svelte';

  $effect(startPersisting);
  $effect(startAutoBackup);

  let date = $state(todayStr());
  let today = $state(todayStr());
  let adding = $state(null); // meal name while the add dialog is open
  let settings = $state(false);
  let trends = $state(false);
  let workouts = $state(null); // { openId } while the workout dialog is open
  let viewing = $state(null); // id of the logged entry shown in the details dialog
  let picking = $state(false);
  let incoming = $state(null); // data arriving from a scanned QR code

  async function checkIncoming() {
    try {
      const t = await readIncoming();
      if (t) incoming = t;
    } catch (e) {
      incoming = { status: 'error', message: e.message };
    }
  }
  $effect(() => {
    checkIncoming();
    // scanning the next code while the app is already open only changes the hash
    window.addEventListener('hashchange', checkIncoming);
    return () => window.removeEventListener('hashchange', checkIncoming);
  });

  // keep "Today" correct if the tab stays open past midnight
  $effect(() => {
    const t = setInterval(() => {
      const now = todayStr();
      if (now !== today) {
        if (date === today) date = now;
        today = now;
      }
    }, 30000);
    return () => clearInterval(t);
  });

  const dayEntries = $derived(db.entries.filter((e) => e.date === date));
  const sum = $derived(totals(dayEntries.filter((e) => !e.planned)));
  const plannedSum = $derived(totals(dayEntries.filter((e) => e.planned)));
  const hasPlanned = $derived(dayEntries.some((e) => e.planned));
  const projected = $derived(sum.kcal + plannedSum.kcal);
  const remaining = $derived(db.goals.kcal - sum.kcal);
  const dueSupplements = $derived(db.supplements.filter((s) => s.group !== 'activity' && isDue(s, date)));
  const dueActivities = $derived(db.supplements.filter((s) => s.group === 'activity' && isDue(s, date) && !isShortcutHidden(s)));

  const daySessions = $derived(sessionsOn(date));
  const activeSession = $derived(daySessions.find((w) => !w.done) ?? daySessions[0]);
  const nextUp = $derived(planState.plan ? nextWorkout(planState.plan) : null);

  const combo = $derived(comboStatus(date));
  const streakInfo = $derived(comboStreak(date, today));
  const streak = $derived(streakInfo.count);

  // Celebrate when today's (or the shown day's) combo flips to complete while you watch, not when a finished day is merely opened.
  let seen = { date: null, all: false };
  $effect(() => {
    const all = combo.all;
    const fire = seen.date === date && !seen.all && all;
    seen = { date, all };
    if (fire) celebrate(streakInfo.comeback);
  });

  // Badge colour follows the usual RPG item rarity ladder as the streak grows: grey, green, blue, purple, orange. A solid red outline warns that the streak
  // ends today unless the combo is completed; a dashed outline means today would use up a grace day.
  const tiers = [
    [30, 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'],
    [14, 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'],
    [7, 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'],
    [3, 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'],
    [1, 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200'],
    [0, 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'],
  ];
  const badgeColour = $derived(tiers.find(([min]) => streak >= min)[1]);
  const badgeRing = $derived(
    streakInfo.risk === 'lost'
      ? 'border-red-500 text-red-700! dark:text-red-300!'
      : streakInfo.risk === 'grace'
        ? 'border-dashed border-current'
        : 'border-transparent',
  );
  const r0 = (n) => Math.round(n);
  const comboRows = $derived([
    {
      label: 'All supplements',
      ok: combo.supplements.ok,
      detail: combo.supplements.total ? `${combo.supplements.done} of ${combo.supplements.total} taken` : 'none due today',
    },
    ...(db.goals.comboActivities
      ? [
          {
            label: 'All activities',
            ok: combo.activities.ok,
            detail: combo.activities.total ? `${combo.activities.done} of ${combo.activities.total} done` : 'rest day, nothing due',
          },
        ]
      : []),
    ...(combo.workout.due
      ? [
          {
            label: 'Workout',
            ok: combo.workout.ok,
            detail: combo.workout.ok ? 'finished' : 'log and finish today\'s workout',
          },
        ]
      : []),
    {
      label: 'Protein and fiber',
      ok: combo.proteinFiber.ok,
      detail: `Protein ${r0(sum.protein)}/${db.goals.protein} g · Fiber ${r0(sum.fiber)}/${db.goals.fiber} g`,
    },
    {
      label: 'Calories on target',
      ok: combo.calories.ok,
      detail: `${r0(sum.kcal)} of ${db.goals.kcal} kcal (±${db.goals.kcalTolerance})`,
    },
  ]);

  const label = $derived(
    date === today
      ? 'Today'
      : date === addDays(today, -1)
        ? 'Yesterday'
        : date === addDays(today, 1)
          ? 'Tomorrow'
          : new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  );

  const mealEntries = (m) => dayEntries.filter((e) => e.meal === m);
  const mealKcal = (m) => Math.round(totals(mealEntries(m).filter((e) => !e.planned)).kcal);
  const mealPlanned = (m) => Math.round(totals(mealEntries(m).filter((e) => e.planned)).kcal);

  function setAmount(e, ev) {
    const v = ev.currentTarget.valueAsNumber;
    if (v > 0) e.grams = e.whole ? v * 100 : v;
  }
</script>

<main class="mx-auto grid max-w-2xl gap-3 px-4 py-4 pb-16">
  <header class="flex items-center justify-between">
    <h1 class="font-mono text-xl font-bold [word-spacing:-0.35em]">sudo <span class="text-emerald-600 dark:text-emerald-400">upgrade</span></h1>
    <span class="flex">
      <button class="btn-icon" onclick={() => (workouts = {})} aria-label="Workouts"><Icon name="dumbbell" class="size-[1.3rem]" /></button>
      <button class="btn-icon" onclick={() => (trends = true)} aria-label="Trends"><Icon name="chart" class="size-[1.3rem]" /></button>
      <button class="btn-icon" onclick={() => (settings = true)} aria-label="Settings"><Icon name="settings" class="size-[1.3rem]" /></button>
    </span>
  </header>

  {#if ui.saveError}
    <p class="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">
      {ui.saveError}
    </p>
  {/if}

  {#if backup.needsPermission}
    <div class="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>The browser needs your OK to keep writing {backup.fileName}.</span>
      <button class="btn shrink-0 text-sm" onclick={resumeBackup}>Allow</button>
    </div>
  {:else if reminderDue()}
    <div class="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" role="status">
      <span>{daysSinceBackup() === null ? 'Your data has never been backed up.' : `Last backup was ${daysSinceBackup()} days ago.`}</span>
      <span class="flex shrink-0 gap-1.5">
        <button class="btn text-sm" onclick={() => (exportJson(), snoozeReminder())}>Export</button>
        <button class="btn text-sm" onclick={snoozeReminder}>Later</button>
      </span>
    </div>
  {/if}

  <div class="grid justify-items-center">
    <div class="flex items-center justify-center gap-1">
      <button class="btn-icon" onclick={() => (date = addDays(date, -1))} aria-label="Previous day"><Icon name="chevron-left" class="size-6" /></button>
      <button class="min-w-40 rounded-lg px-3 py-1.5 text-center text-lg font-semibold hover:bg-stone-200 dark:hover:bg-stone-800" onclick={() => (picking = true)}>
        {label}
      </button>
      <button class="btn-icon" onclick={() => (date = addDays(date, 1))} aria-label="Next day"><Icon name="chevron-right" class="size-6" /></button>
    </div>
    <!-- fixed height so showing the button never moves anything -->
    <div class="-mt-1 h-6">
      {#if date !== today}
        <button class="rounded-lg px-2.5 text-sm font-medium text-emerald-700 hover:bg-stone-200 dark:text-emerald-400 dark:hover:bg-stone-800" onclick={() => (date = today)}>Back to today</button>
      {/if}
    </div>
  </div>

  <section class="card gap-3" aria-label="Daily summary">
    <div class="flex items-end justify-between">
      <div>
        <div class="text-3xl leading-none font-bold">{Math.round(sum.kcal)}</div>
        <div class="muted">of {db.goals.kcal} kcal</div>
      </div>
      <div class="text-right {remaining < 0 ? 'text-amber-600 dark:text-amber-400' : ''}">
        <div class="text-3xl leading-none font-bold">{Math.abs(Math.round(remaining))}</div>
        <div class="muted {remaining < 0 ? 'text-amber-600! dark:text-amber-400!' : ''}">{remaining < 0 ? 'over' : 'left'}</div>
      </div>
    </div>
    <Bar value={sum.kcal} goal={db.goals.kcal} ghost={plannedSum.kcal} />
    <div class="grid grid-cols-2 gap-4 text-sm">
      {#each [['Protein', 'protein'], ['Fiber', 'fiber']] as [name, k]}
        <div class="grid gap-1">
          <div class="flex justify-between gap-2">
            <span>{name}</span><span class="muted">{Math.round(sum[k])}{#if plannedSum[k] > 0}<span class="ml-1 italic">(+{Math.round(plannedSum[k])})</span>{/if} / {db.goals[k]} g</span>
          </div>
          <Bar value={sum[k]} goal={db.goals[k]} small ghost={plannedSum[k]} />
        </div>
      {/each}
    </div>
    {#if hasPlanned}
      <p class="muted italic">Planned: +{Math.round(plannedSum.kcal)} kcal, {Math.round(projected)} kcal if all eaten ({Math.round(db.goals.kcal - projected) >= 0 ? `${Math.round(db.goals.kcal - projected)} left` : `${Math.round(projected - db.goals.kcal)} over`})</p>
    {/if}
    <p class="muted">Carbs {Math.round(sum.carbs)} g · Fat {Math.round(sum.fat)} g · Salt {Math.round(sum.salt * 10) / 10} g</p>
  </section>

  <section class="card" aria-label="Daily combo">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-semibold">Daily combo</h2>
      {#key streak}
      <span
        class="inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-sm font-medium motion-safe:animate-pop {badgeColour} {badgeRing}"
        aria-label="Combo streak: {streak} {streak === 1 ? 'day' : 'days'}{streakInfo.risk === 'lost' ? ', ends today unless completed' : ''}"
      >
        <Icon name="flame" />{streak} {streak === 1 ? 'day' : 'days'}
      </span>
      {/key}
    </div>
    <ul class="divided">
      {#each comboRows as row}
        <li class="flex items-center gap-3">
          <span
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2
              {row.ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 dark:border-stone-700'}"
          >
            {#if row.ok}<Icon name="check" class="size-4" />{/if}
          </span>
          <span class="min-w-0">
            <span class="block">{row.label}</span>
            <span class="muted block">{row.detail}</span>
          </span>
        </li>
      {/each}
    </ul>
    {#if streakInfo.risk === 'lost' && !combo.all}
      <p class="text-sm font-medium text-red-700 dark:text-red-400" role="status">
        The streak ends tonight unless you complete today's combo.
        {#if db.goals.comboGraceDays > 0 && streakInfo.graceUsed === 0}
          A grace day isn't available: one was used in the last {db.goals.comboGraceCooldown} days.
        {/if}
      </p>
    {:else if streakInfo.risk === 'grace' && !combo.all}
      <p class="muted">
        If today stays incomplete, a grace day is used and the streak survives.
      </p>
    {:else if streakInfo.graceUsed > 0 && !combo.all}
      <p class="muted">
        {streakInfo.graceUsed === 1 ? 'A missed day is being forgiven' : `${streakInfo.graceUsed} missed days are being forgiven`}.
        Complete the combo to keep the streak going.
      </p>
    {/if}
    {#if combo.all}
      {#if streakInfo.comeback}
        <p
          class="rounded-xl bg-amber-100 px-3 py-2 text-center font-semibold text-amber-900 motion-safe:animate-comeback dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          {streakInfo.comeback === 'saved' ? 'Comeback! Streak saved' : 'Comeback! A new streak begins'}
        </p>
      {:else}
        <p
          class="rounded-xl bg-emerald-50 px-3 py-2 text-center font-semibold text-emerald-800 motion-safe:animate-pop dark:bg-emerald-950 dark:text-emerald-300"
          role="status"
        >
          Combo complete!
        </p>
      {/if}
    {/if}
  </section>

  {#each [['Supplements', dueSupplements], ['Activity', dueActivities]] as [title, items]}
    {#if items.length}
      <section class="card" aria-label={title}>
        <h2 class="font-semibold">{title}</h2>
        <ul class="divided">
          {#each items as s (s.id)}
            {@const taken = isTaken(s.id, date)}
            <li>
              <label class="flex cursor-pointer items-center gap-3">
                <input class="size-5 shrink-0 accent-emerald-600" type="checkbox" checked={taken} onchange={() => toggleSupplement(s.id, date)} />
                <span class={taken ? 'text-stone-400 line-through dark:text-stone-500' : ''}>{s.name}</span>
              </label>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}

  {#if planState.plan}
    <section class="card" aria-label="Workout">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="font-semibold">Workout</h2>
        {#if workoutDue(date)}<span class="muted">{workoutDone(date) ? 'done' : 'due today'}</span>{/if}
      </div>
      {#if activeSession}
        <button class="btn justify-between" onclick={() => (workouts = { openId: activeSession.id })}>
          <span>{sessionLabel(activeSession)}</span>
          <span class="muted">{activeSession.done ? 'finished' : `${progress(activeSession).done}/${progress(activeSession).sets} sets`}</span>
        </button>
      {:else}
        <button class="btn btn-dashed" onclick={() => (workouts = {})}>
          Start Week {nextUp.week} · {planState.plan.days.find((d) => d.id === nextUp.day)?.name}
        </button>
      {/if}
    </section>
  {/if}

  {#each MEALS as m}
    <section class="card" aria-label={m}>
      <div class="flex items-baseline justify-between">
        <h2 class="font-semibold">{m}</h2>
        <span class="muted">{mealKcal(m)} kcal{#if mealPlanned(m)}<span class="ml-1 italic">(+{mealPlanned(m)} planned)</span>{/if}</span>
      </div>
      <ul class="divided">
        {#each mealEntries(m) as e (e.id)}
          <!-- phones: name on top, controls underneath; wider screens: one line -->
          <li class="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-2 {e.planned ? 'opacity-60' : ''}">
            <button class="-mx-2 flex min-w-0 items-center gap-3 rounded-lg sm:flex-1 px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800" onclick={() => (viewing = e.id)} aria-label="Nutrition details for {e.name}">
              <ProductIcon item={e} />
              <span class="min-w-0">
                <span class="line-clamp-2 break-words {e.planned ? 'italic' : ''}">{e.name}</span>
                {#if e.brand}<span class="muted block truncate">{e.brand}</span>{/if}
              </span>
            </button>
            <span class="flex items-center gap-1 pl-[3.25rem] sm:shrink-0 sm:pl-0">
              <input
                class="field w-[4.25rem] px-2 py-1"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                value={e.whole ? e.grams / 100 : e.grams}
                onchange={(ev) => setAmount(e, ev)}
                aria-label="{e.whole ? 'Quantity' : 'Grams'} of {e.name}"
              />
              <span class="muted">{e.whole ? '×' : 'g'}</span>
              <span class="ml-auto min-w-[4.25rem] text-right text-sm font-medium whitespace-nowrap tabular-nums sm:ml-0">{Math.round(scale(e, 'kcal'))} kcal</span>
              {#if e.planned}
                <button class="btn-icon size-8 text-emerald-700 dark:text-emerald-400" aria-label="Mark {e.name} as eaten" title="Mark as eaten" onclick={() => markEaten(e.id)}><Icon name="check" /></button>
              {/if}
              <button class="btn-icon size-8" aria-label="Remove {e.name}" onclick={() => removeEntry(e.id)}><Icon name="x" /></button>
            </span>
          </li>
        {/each}
      </ul>
      <button class="btn btn-dashed" onclick={() => (adding = m)}>+ Add food</button>
    </section>
  {/each}
</main>

{#if adding}<AddFood {date} meal={adding} onclose={() => (adding = null)} />{/if}
{#if incoming}<IncomingTransfer transfer={incoming} onclose={() => (incoming = null)} />{/if}
{#if picking}<DatePicker {date} {today} onpick={(d) => { date = d; picking = false; }} onclose={() => (picking = false)} />{/if}
{#if viewing}<EntryDetails id={viewing} onclose={() => (viewing = null)} />{/if}
{#if settings}<Settings onclose={() => (settings = false)} />{/if}
{#if trends}<Trends onclose={() => (trends = false)} />{/if}
{#if workouts}<Workouts {date} openId={workouts.openId ?? null} onclose={() => (workouts = null)} />{/if}
