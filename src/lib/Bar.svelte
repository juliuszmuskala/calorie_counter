<script>
  let { value, goal, small = false, ghost = 0 } = $props();
  const pct = $derived(goal > 0 ? Math.min(100, (value / goal) * 100) : 0);
  const ghostPct = $derived(goal > 0 ? Math.max(0, Math.min(100, ((value + ghost) / goal) * 100) - pct) : 0);
  const over = $derived(goal > 0 && value > goal);
</script>

<div
  class="flex overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800 {small ? 'h-1.5' : 'h-2.5'}"
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax={goal}
  aria-valuenow={Math.round(value)}
>
  <div class="h-full shrink-0 rounded-full transition-[width] {over ? 'bg-amber-500' : 'bg-emerald-500'}" style:width="{pct}%"></div>
  {#if ghostPct > 0}
    <div class="h-full shrink-0 bg-emerald-500/30 transition-[width]" style:width="{ghostPct}%"></div>
  {/if}
</div>
