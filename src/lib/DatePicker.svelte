<script>
  import { db, comboDays } from './store.svelte.js';
  import Modal from './Modal.svelte';
  import Icon from './Icon.svelte';

  let { date, today, onpick, onclose } = $props();

  const pad = (n) => String(n).padStart(2, '0');
  // svelte-ignore state_referenced_locally
  let year = $state(+date.slice(0, 4));
  // svelte-ignore state_referenced_locally
  let month = $state(+date.slice(5, 7) - 1); // 0-based

  const title = $derived(new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' })); // Monday first
  const lead = $derived((new Date(year, month, 1).getDay() + 6) % 7);
  const days = $derived(Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`));
  const logged = $derived(new Set(db.entries.filter((e) => !e.planned).map((e) => e.date)));
  // 'combo' = all daily goals met, 'forgiven' = missed day covered by the grace period
  const marks = $derived(comboDays(days[0], days[days.length - 1], today));

  function step(n) {
    const d = new Date(year, month + n, 1);
    year = d.getFullYear();
    month = d.getMonth();
  }
</script>

<Modal title="Pick a date" {onclose}>
  <div class="flex items-center justify-between">
    <button class="btn-icon" onclick={() => step(-1)} aria-label="Previous month"><Icon name="chevron-left" class="size-6" /></button>
    <strong class="capitalize">{title}</strong>
    <button class="btn-icon" onclick={() => step(1)} aria-label="Next month"><Icon name="chevron-right" class="size-6" /></button>
  </div>

  <div class="grid grid-cols-7 gap-1 text-center">
    {#each weekdays as w}<span class="muted py-1">{w}</span>{/each}
    {#each { length: lead }}<span></span>{/each}
    {#each days as d}
      <button
        class="flex aspect-square flex-col items-center justify-center rounded-lg text-base tabular-nums transition-colors
          {d === date ? 'bg-emerald-600 font-semibold text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}
          {d === today && d !== date ? 'ring-2 ring-emerald-600 ring-inset' : ''}"
        onclick={() => onpick(d)}
        aria-label="{d}{marks.get(d) === 'combo' ? ', combo day' : marks.get(d) === 'forgiven' ? ', forgiven day' : ''}"
        aria-current={d === date ? 'date' : undefined}
      >
        <span class="leading-none">{+d.slice(8)}</span>
        <!-- fixed-height row so every date sits at the same height whether or not it has a marker -->
        <span class="mt-0.5 flex h-3 items-center justify-center">
          {#if marks.get(d) === 'combo'}
            <Icon name="flame" class="size-3 {d === date ? 'text-white' : 'text-orange-500'}" />
          {:else if marks.get(d) === 'forgiven'}
            <Icon name="snowflake" class="size-3 {d === date ? 'text-white' : 'text-sky-500'}" />
          {:else if logged.has(d)}
            <span class="size-1 rounded-full {d === date ? 'bg-white' : 'bg-stone-400'}"></span>
          {/if}
        </span>
      </button>
    {/each}
  </div>

  <p class="muted flex flex-wrap items-center gap-x-4 gap-y-1">
    <span class="inline-flex items-center gap-1"><Icon name="flame" class="text-orange-500" /> combo day</span>
    <span class="inline-flex items-center gap-1"><Icon name="snowflake" class="text-sky-500" /> forgiven day</span>
    <span class="inline-flex items-center gap-1"><span class="size-1.5 rounded-full bg-stone-400"></span> food logged</span>
  </p>

  <div class="grid grid-cols-2 gap-2">
    <button class="btn" onclick={onclose}>Cancel</button>
    <button class="btn btn-primary" onclick={() => onpick(today)}>Today</button>
  </div>
</Modal>
