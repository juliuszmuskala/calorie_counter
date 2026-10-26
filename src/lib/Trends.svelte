<script>
  import Modal from './Modal.svelte';
  import Bar from './Bar.svelte';
  import { db, totals, comboDays, addDays, todayStr, setWeight, removeWeight, WEEK_ORDER } from './store.svelte.js';

  let { onclose } = $props();

  const today = todayStr();
  let range = $state(30);
  // start on the most recent day with something logged, so the detail line has numbers in it
  let selected = $state(db.entries.reduce((m, e) => (!e.planned && e.date <= today && e.date > m ? e.date : m), '') || today);

  const dateObj = (d) => new Date(d + 'T12:00:00');
  const shortDate = (d) => dateObj(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const longDate = (d) => dateObj(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const r0 = (n) => Math.round(n);

  const byDate = $derived.by(() => {
    const m = new Map();
    for (const e of db.entries) {
      if (e.planned) continue;
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date).push(e);
    }
    return m;
  });
  const totalFor = (d) => (byDate.has(d) ? totals(byDate.get(d)) : null);

  // ---- calorie chart
  const days = $derived(Array.from({ length: range }, (_, i) => addDays(today, i - (range - 1))));
  const series = $derived(days.map((date) => ({ date, t: totalFor(date) })));
  const { kcal: goal, kcalTolerance: tol } = $derived(db.goals);
  const top = $derived.by(() => {
    const max = Math.max(goal + tol, ...series.map((s) => s.t?.kcal ?? 0));
    const step = max > 3000 ? 1000 : 500;
    return Math.ceil((max * 1.05) / step) * step;
  });
  const ticks = $derived([0, top / 2, top]);

  const W = 360, H = 170, L = 34, R = 6, T = 8, B = 22;
  const plotW = W - L - R, plotH = H - T - B;
  const y = (v) => T + plotH - (v / top) * plotH;
  const slot = $derived(plotW / range);
  const gap = $derived(range <= 30 ? 2 : 1);
  const barW = $derived(Math.min(24, Math.max(1.5, slot - gap)));
  const x = (i) => L + i * slot + (slot - barW) / 2;
  const inBand = (k) => Math.abs(k - goal) <= tol;
  const barPath = (i, k) => {
    // 4px rounded data end, square at the baseline
    const r = Math.min(4, barW / 2, y(k) < y(0) ? y(0) - y(k) : 0);
    const x0 = x(i), x1 = x0 + barW, y0 = y(0), y1 = y(k);
    return `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x1 - r}Q${x1},${y1} ${x1},${y1 + r}V${y0}Z`;
  };

  // ---- weight
  const target = $derived(db.goals.targetWeight);
  const weightByDate = $derived(new Map(db.weights.map((w) => [w.date, w.kg])));
  const fmtKg = (v) => (Math.round(v * 10) / 10).toString();
  // trend: mean of the weigh-ins in the 7 days up to each one, which smooths out water-weight noise
  const trendAt = (date) => {
    const from = addDays(date, -6);
    const near = db.weights.filter((w) => w.date >= from && w.date <= date);
    return near.reduce((a, w) => a + w.kg, 0) / near.length;
  };
  const wPoints = $derived(
    days.flatMap((date, i) => (weightByDate.has(date) ? [{ date, i, kg: weightByDate.get(date), trend: trendAt(date) }] : [])),
  );
  const wRange = $derived.by(() => {
    const vals = [...wPoints.flatMap((p) => [p.kg, p.trend]), ...(target > 0 ? [target] : [])];
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.floor((Math.min(...vals) - 0.5) * 2) / 2;
    const hi = Math.ceil((Math.max(...vals) + 0.5) * 2) / 2;
    return { lo, hi: hi > lo ? hi : lo + 1 };
  });
  const wy = (v) => T + plotH - ((v - wRange.lo) / (wRange.hi - wRange.lo)) * plotH;
  const wx = (i) => L + i * slot + slot / 2;
  const wTicks = $derived([wRange.lo, (wRange.lo + wRange.hi) / 2, wRange.hi]);
  const linePath = (key) => wPoints.map((p, n) => `${n ? 'L' : 'M'}${wx(p.i)},${wy(p[key])}`).join('');
  const latest = $derived(db.weights.at(-1) ?? null);
  const change = $derived(wPoints.length > 1 ? wPoints.at(-1).trend - wPoints[0].trend : null);

  let wDate = $state(today);
  let wValue = $state('');
  // show what is already logged for the chosen day
  $effect(() => {
    wValue = weightByDate.has(wDate) ? String(weightByDate.get(wDate)) : '';
  });
  function saveWeight(e) {
    e.preventDefault();
    const kg = Number(wValue.replace(',', '.'));
    if (kg > 0 && kg < 1000) setWeight(wDate, kg);
  }

  // ---- averages over logged days (today is still in progress, so it only counts when it is all there is)
  const logged = $derived.by(() => {
    const l = series.filter((s) => s.t && s.date !== today);
    return l.length ? l : series.filter((s) => s.t);
  });
  const avg = (key) => (logged.length ? logged.reduce((a, s) => a + s.t[key], 0) / logged.length : null);
  const onTarget = $derived(logged.filter((s) => inBand(s.t.kcal)).length);

  // ---- streak calendar: the last 12 weeks, Monday first, columns are weeks
  const WEEKS = 12;
  const grid = $derived.by(() => {
    const monday = (d) => addDays(d, -((dateObj(d).getDay() + 6) % 7));
    const start = addDays(monday(today), -(WEEKS - 1) * 7);
    const marks = comboDays(start, today, today);
    return Array.from({ length: WEEKS }, (_, w) =>
      WEEK_ORDER.map((_, d) => {
        const date = addDays(start, w * 7 + d);
        return date > today ? null : { date, mark: marks.get(date) ?? (byDate.has(date) ? 'logged' : 'empty') };
      }),
    );
  });
  const cellClass = {
    combo: 'bg-emerald-500 dark:bg-emerald-400',
    forgiven: 'bg-amber-400 dark:bg-amber-500',
    logged: 'bg-stone-300 dark:bg-stone-600',
    empty: 'bg-stone-100 dark:bg-stone-800',
  };
  const markLabel = { combo: 'all goals met', forgiven: 'missed, forgiven', logged: 'logged, goals missed', empty: 'nothing logged' };
  const markOf = (d) => grid.flat().find((c) => c?.date === d)?.mark;

  const sel = $derived(totalFor(selected));
</script>

<Modal title="Trends" {onclose}>
  <div class="grid grid-cols-3 gap-1.5" role="group" aria-label="Range">
    {#each [7, 30, 90] as n}
      <button class="btn px-2 text-sm {range === n ? 'btn-primary' : ''}" aria-pressed={range === n} onclick={() => (range = n)}>{n} days</button>
    {/each}
  </div>

  <section class="grid gap-2">
    <h3 class="font-semibold">Calories per day</h3>
    <svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Calories per day for the last {range} days against a goal of {goal} kilocalories">
      <!-- target band and goal line -->
      <rect x={L} y={y(goal + tol)} width={plotW} height={y(goal - tol) - y(goal + tol)} class="fill-emerald-500/10" />
      {#each ticks as t}
        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="stroke-stone-200 dark:stroke-stone-800" stroke-width="1" />
        <text x={L - 4} y={y(t) + 3} text-anchor="end" class="fill-stone-500 text-[9px] dark:fill-stone-400">{t >= 1000 ? `${t / 1000}K` : t}</text>
      {/each}
      <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} class="stroke-stone-500 dark:stroke-stone-400" stroke-width="1" />

      {#each series as s, i (s.date)}
        {#if s.t && s.t.kcal > 0}
          <path d={barPath(i, s.t.kcal)} class={inBand(s.t.kcal) ? 'fill-emerald-500 dark:fill-emerald-400' : 'fill-stone-400 dark:fill-stone-500'} opacity={selected === s.date ? 1 : 0.85} />
        {/if}
        {#if selected === s.date}
          <rect x={L + i * slot} y={T} width={slot} height={plotH} class="fill-stone-900/5 dark:fill-white/10" />
        {/if}
        <!-- the whole column is the hit target -->
        <rect
          x={L + i * slot} y={T} width={slot} height={plotH} fill="transparent" role="button" tabindex="0" aria-label="{longDate(s.date)}: {s.t ? r0(s.t.kcal) : 0} kcal"
          onclick={() => (selected = s.date)} onpointerenter={(e) => e.pointerType === 'mouse' && (selected = s.date)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (selected = s.date))}
        />
      {/each}
      <text x={L} y={H - 6} class="fill-stone-500 text-[9px] dark:fill-stone-400">{shortDate(days[0])}</text>
      <text x={W - R} y={H - 6} text-anchor="end" class="fill-stone-500 text-[9px] dark:fill-stone-400">{shortDate(days[range - 1])}</text>
    </svg>
    <div class="muted flex flex-wrap gap-x-4 gap-y-1">
      <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400"></span>Within ±{tol} kcal</span>
      <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-sm bg-stone-400 dark:bg-stone-500"></span>Outside the margin</span>
      <span class="flex items-center gap-1.5"><span class="inline-block h-px w-3 bg-stone-500 dark:bg-stone-400"></span>Goal {goal} kcal</span>
    </div>
    <p class="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-950" role="status">
      <strong>{longDate(selected)}</strong>
      {#if sel}
        · {r0(sel.kcal)} kcal · protein {r0(sel.protein)} g · fiber {r0(sel.fiber)} g
      {:else}
        · nothing logged
      {/if}
      {#if markOf(selected) && markOf(selected) !== 'empty' && markOf(selected) !== 'logged'}<span class="muted block">{markLabel[markOf(selected)]}</span>{/if}
    </p>
  </section>

  <section class="grid gap-2">
    <h3 class="font-semibold">Weight</h3>
    <form class="grid gap-2" onsubmit={saveWeight}>
      <label class="label">Date<input class="field" type="date" max={today} required bind:value={wDate} /></label>
      <label class="label">Weight kg<input class="field" type="text" inputmode="decimal" required placeholder="e.g. 82.4" bind:value={wValue} /></label>
      <button class="btn btn-primary">Save weight</button>
    </form>
    {#if weightByDate.has(wDate)}
      <button class="muted justify-self-start underline" onclick={() => removeWeight(wDate)}>Delete the weight for {longDate(wDate)}</button>
    {/if}

    {#if latest}
      <p class="text-sm">
        <strong>{fmtKg(latest.kg)} kg</strong> <span class="muted">on {shortDate(latest.date)}</span>
        {#if target > 0}
          · {#if Math.abs(latest.kg - target) < 0.05}at your target of {fmtKg(target)} kg{:else}{fmtKg(Math.abs(latest.kg - target))} kg {latest.kg > target ? 'above' : 'below'} your target of {fmtKg(target)} kg{/if}
        {:else}
          <span class="muted">· set a target weight in Settings</span>
        {/if}
        {#if change !== null}<span class="muted block">Trend over this period: {change > 0 ? '+' : ''}{fmtKg(change)} kg</span>{/if}
      </p>
    {:else}
      <p class="muted">No weight logged yet.</p>
    {/if}

    {#if wPoints.length}
      <svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Body weight over the last {range} days">
        {#each wTicks as t}
          <line x1={L} x2={W - R} y1={wy(t)} y2={wy(t)} class="stroke-stone-200 dark:stroke-stone-800" stroke-width="1" />
          <text x={L - 4} y={wy(t) + 3} text-anchor="end" class="fill-stone-500 text-[9px] dark:fill-stone-400">{fmtKg(t)}</text>
        {/each}
        {#if target > 0}
          <line x1={L} x2={W - R} y1={wy(target)} y2={wy(target)} class="stroke-stone-500 dark:stroke-stone-400" stroke-width="1" />
        {/if}
        {#if wPoints.length > 1}
          <path d={linePath('trend')} fill="none" class="stroke-emerald-500 dark:stroke-emerald-400" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {/if}
        {#each wPoints as p (p.date)}
          <circle cx={wx(p.i)} cy={wy(p.kg)} r="4" class="fill-stone-400 stroke-white stroke-2 dark:fill-stone-500 dark:stroke-stone-900" />
        {/each}
        {#each days as date, i (date)}
          {#if selected === date}<rect x={L + i * slot} y={T} width={slot} height={plotH} class="fill-stone-900/5 dark:fill-white/10" />{/if}
          <rect x={L + i * slot} y={T} width={slot} height={plotH} fill="transparent" role="button" tabindex="0" aria-label="{longDate(date)}"
            onclick={() => ((selected = date), (wDate = date))} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (selected = date), (wDate = date))}
          />
        {/each}
        <text x={L} y={H - 6} class="fill-stone-500 text-[9px] dark:fill-stone-400">{shortDate(days[0])}</text>
        <text x={W - R} y={H - 6} text-anchor="end" class="fill-stone-500 text-[9px] dark:fill-stone-400">{shortDate(days[range - 1])}</text>
      </svg>
      <div class="muted flex flex-wrap gap-x-4 gap-y-1">
        <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-full bg-stone-400 dark:bg-stone-500"></span>Weigh-in</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-3 bg-emerald-500 dark:bg-emerald-400"></span>7-day trend</span>
        {#if target > 0}<span class="flex items-center gap-1.5"><span class="inline-block h-px w-3 bg-stone-500 dark:bg-stone-400"></span>Target {fmtKg(target)} kg</span>{/if}
      </div>
    {:else if latest}
      <p class="muted">No weigh-ins in the last {range} days. Pick a longer range to see the chart.</p>
    {/if}
  </section>

  <section class="grid gap-2">
    <h3 class="font-semibold">Averages</h3>
    {#if logged.length}
      <p class="muted">Over {logged.length} logged {logged.length === 1 ? 'day' : 'days'}, not counting today unless it's the only one. {onTarget} on calorie target.</p>
      <div class="grid gap-3">
        {#each [['Calories', 'kcal', goal, 'kcal'], ['Protein', 'protein', db.goals.protein, 'g'], ['Fiber', 'fiber', db.goals.fiber, 'g']] as [label, key, g, unit]}
          <div class="grid gap-1">
            <div class="flex justify-between text-sm">
              <span>{label}</span><span class="tabular-nums"><strong>{r0(avg(key))}</strong> <span class="muted">/ {g} {unit}</span></span>
            </div>
            <!-- calories aim for a target rather than a minimum, so a bar that turns amber past the goal would mislead -->
            {#if key !== 'kcal'}<Bar value={avg(key)} goal={g} small />{/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">Nothing logged in this period yet.</p>
    {/if}
  </section>

  <section class="grid gap-2">
    <h3 class="font-semibold">Last {WEEKS} weeks</h3>
    <div class="flex justify-center gap-1">
      <div class="muted grid grid-rows-7 gap-1 pr-1 text-[10px] leading-none">
        {#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as d}<span class="flex items-center">{d}</span>{/each}
      </div>
      {#each grid as week}
        <div class="grid grid-rows-7 gap-1">
          {#each week as c}
            {#if c}
              <button
                class="size-5 rounded-[4px] sm:size-6 {cellClass[c.mark]} {selected === c.date ? 'outline-2 outline-offset-1 outline-stone-900 dark:outline-white' : ''}"
                aria-label="{longDate(c.date)}: {markLabel[c.mark]}" title="{longDate(c.date)}: {markLabel[c.mark]}" onclick={() => (selected = c.date)}
              ></button>
            {:else}
              <span class="size-5 sm:size-6"></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <div class="muted flex flex-wrap justify-center gap-x-4 gap-y-1">
      {#each ['combo', 'forgiven', 'logged', 'empty'] as k}
        <span class="flex items-center gap-1.5"><span class="inline-block size-2.5 rounded-sm {cellClass[k]}"></span>{markLabel[k][0].toUpperCase() + markLabel[k].slice(1)}</span>
      {/each}
    </div>
  </section>
</Modal>
