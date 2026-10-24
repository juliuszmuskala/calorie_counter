<script>
  import {
    db, ui, MEALS, todayStr, addDays, removeEntry, scale, totals, startPersisting, isDue, isTaken, toggleSupplement, comboStatus, comboStreak,
  } from './lib/store.svelte.js';
  import AddFood from './lib/AddFood.svelte';
  import Settings from './lib/Settings.svelte';
  import DatePicker from './lib/DatePicker.svelte';
  import EntryDetails from './lib/EntryDetails.svelte';
  import IncomingTransfer from './lib/IncomingTransfer.svelte';
  import { readIncoming } from './lib/qr.js';
  import Bar from './lib/Bar.svelte';
  import ProductIcon from './lib/ProductIcon.svelte';
  import Icon from './lib/Icon.svelte';

  $effect(startPersisting);

  let date = $state(todayStr());
  let today = $state(todayStr());
  let adding = $state(null); // meal name while the add dialog is open
  let settings = $state(false);
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
  const sum = $derived(totals(dayEntries));
  const remaining = $derived(db.goals.kcal - sum.kcal);
  const dueSupplements = $derived(db.supplements.filter((s) => s.group !== 'activity' && isDue(s, date)));
  const dueActivities = $derived(db.supplements.filter((s) => s.group === 'activity' && isDue(s, date)));

  const combo = $derived(comboStatus(date));
  const streakInfo = $derived(comboStreak(date, today));
  const streak = $derived(streakInfo.count);

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
  const mealKcal = (m) => Math.round(totals(mealEntries(m)).kcal);

  function setAmount(e, ev) {
    const v = ev.currentTarget.valueAsNumber;
    if (v > 0) e.grams = v;
  }
</script>

<main class="mx-auto grid max-w-2xl gap-3 px-4 py-4 pb-16">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-bold">Calorie Counter</h1>
    <button class="btn-icon" onclick={() => (settings = true)} aria-label="Settings"><Icon name="settings" class="size-[1.3rem]" /></button>
  </header>

  {#if ui.saveError}
    <p class="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">
      {ui.saveError}
    </p>
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
    <Bar value={sum.kcal} goal={db.goals.kcal} />
    <div class="grid grid-cols-2 gap-4 text-sm">
      {#each [['Protein', 'protein'], ['Fiber', 'fiber']] as [name, k]}
        <div class="grid gap-1">
          <div class="flex justify-between gap-2">
            <span>{name}</span><span class="muted">{Math.round(sum[k])} / {db.goals[k]} g</span>
          </div>
          <Bar value={sum[k]} goal={db.goals[k]} small />
        </div>
      {/each}
    </div>
    <p class="muted">Carbs {Math.round(sum.carbs)} g · Fat {Math.round(sum.fat)} g · Salt {Math.round(sum.salt * 10) / 10} g</p>
  </section>

  <section class="card" aria-label="Daily combo">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-semibold">Daily combo</h2>
      <span
        class="inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-sm font-medium {badgeColour} {badgeRing}"
        aria-label="Combo streak: {streak} {streak === 1 ? 'day' : 'days'}{streakInfo.risk === 'lost' ? ', ends today unless completed' : ''}"
      >
        <Icon name="flame" />{streak} {streak === 1 ? 'day' : 'days'}
      </span>
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
      <p class="rounded-xl bg-emerald-50 px-3 py-2 text-center font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" role="status">
        Combo complete!
      </p>
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

  {#each MEALS as m}
    <section class="card" aria-label={m}>
      <div class="flex items-baseline justify-between">
        <h2 class="font-semibold">{m}</h2>
        <span class="muted">{mealKcal(m)} kcal</span>
      </div>
      <ul class="divided">
        {#each mealEntries(m) as e (e.id)}
          <!-- phones: name on top, controls underneath; wider screens: one line -->
          <li class="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-2">
            <button class="-mx-2 flex min-w-0 items-center gap-3 rounded-lg sm:flex-1 px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800" onclick={() => (viewing = e.id)} aria-label="Nutrition details for {e.name}">
              <ProductIcon item={e} />
              <span class="min-w-0">
                <span class="line-clamp-2 break-words">{e.name}</span>
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
                value={e.grams}
                onchange={(ev) => setAmount(e, ev)}
                aria-label="Grams of {e.name}"
              />
              <span class="muted">g</span>
              <span class="ml-auto min-w-[4.25rem] text-right text-sm font-medium whitespace-nowrap tabular-nums sm:ml-0">{Math.round(scale(e, 'kcal'))} kcal</span>
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
