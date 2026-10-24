<script>
  import Icon from './lib/Icon.svelte';
  import {
    db, ui, MEALS, todayStr, addDays, removeEntry, scale, totals, startPersisting, isDue, isTaken, toggleSupplement,
  } from './lib/store.svelte.js';
  import AddFood from './lib/AddFood.svelte';
  import Settings from './lib/Settings.svelte';
  import DatePicker from './lib/DatePicker.svelte';
  import EntryDetails from './lib/EntryDetails.svelte';
  import IncomingTransfer from './lib/IncomingTransfer.svelte';
  import { readIncoming } from './lib/qr.js';
  import Bar from './lib/Bar.svelte';
  import ProductIcon from './lib/ProductIcon.svelte';

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
  const dueSupplements = $derived(db.supplements.filter((s) => isDue(s, date)));

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

  <div class="relative flex items-center justify-center gap-1">
    <button class="btn-icon" onclick={() => (date = addDays(date, -1))} aria-label="Previous day"><Icon name="chevron-left" class="size-6" /></button>
    <button class="min-w-40 rounded-lg px-3 py-1.5 text-center text-lg font-semibold hover:bg-stone-200 dark:hover:bg-stone-800" onclick={() => (picking = true)}>
      {label}
    </button>
    <button class="btn-icon" onclick={() => (date = addDays(date, 1))} aria-label="Next day"><Icon name="chevron-right" class="size-6" /></button>
    {#if date !== today}
      <!-- absolutely placed so it never shifts the centered date controls -->
      <button class="btn absolute right-0 min-h-8 px-2.5 py-1 text-sm" onclick={() => (date = today)}>Today</button>
    {/if}
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

  {#if dueSupplements.length}
    <section class="card" aria-label="Supplements">
      <h2 class="font-semibold">Supplements</h2>
      <ul class="divided">
        {#each dueSupplements as s (s.id)}
          {@const taken = isTaken(s.id, date)}
          <li>
            <label class="flex cursor-pointer items-center gap-3">
              <input class="size-5 accent-emerald-600" type="checkbox" checked={taken} onchange={() => toggleSupplement(s.id, date)} />
              <span class={taken ? 'text-stone-400 line-through dark:text-stone-500' : ''}>{s.name}</span>
            </label>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#each MEALS as m}
    <section class="card" aria-label={m}>
      <div class="flex items-baseline justify-between">
        <h2 class="font-semibold">{m}</h2>
        <span class="muted">{mealKcal(m)} kcal</span>
      </div>
      <ul class="divided">
        {#each mealEntries(m) as e (e.id)}
          <li class="flex items-center justify-between gap-2">
            <button class="-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800" onclick={() => (viewing = e.id)} aria-label="Nutrition details for {e.name}">
              <ProductIcon item={e} />
              <span class="min-w-0">
                <span class="block truncate">{e.name}</span>
                {#if e.brand}<span class="muted block truncate">{e.brand}</span>{/if}
              </span>
            </button>
            <span class="flex shrink-0 items-center gap-1">
              <input
                class="field w-20 px-2 py-1"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                value={e.grams}
                onchange={(ev) => setAmount(e, ev)}
                aria-label="Grams of {e.name}"
              />
              <span class="muted">g</span>
              <span class="w-20 text-right text-sm font-medium tabular-nums">{Math.round(scale(e, 'kcal'))} kcal</span>
              <button class="btn-icon" aria-label="Remove {e.name}" onclick={() => removeEntry(e.id)}><Icon name="x" /></button>
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
