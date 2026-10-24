<script>
  import { db } from './store.svelte.js';
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
  const logged = $derived(new Set(db.entries.map((e) => e.date)));

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
        class="relative aspect-square rounded-lg text-base tabular-nums transition-colors
          {d === date ? 'bg-emerald-600 font-semibold text-white' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}
          {d === today && d !== date ? 'ring-2 ring-emerald-600 ring-inset' : ''}"
        onclick={() => onpick(d)}
        aria-label={d}
        aria-current={d === date ? 'date' : undefined}
      >
        {+d.slice(8)}
        {#if logged.has(d)}<span class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full {d === date ? 'bg-white' : 'bg-emerald-500'}"></span>{/if}
      </button>
    {/each}
  </div>

  <div class="grid grid-cols-2 gap-2">
    <button class="btn" onclick={onclose}>Cancel</button>
    <button class="btn btn-primary" onclick={() => onpick(today)}>Today</button>
  </div>
</Modal>
