<script>
  let { value, goal, small = false } = $props();
  const pct = $derived(goal > 0 ? Math.min(100, (value / goal) * 100) : 0);
  const over = $derived(goal > 0 && value > goal);
</script>

<div
  class="overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800 {small ? 'h-1.5' : 'h-2.5'}"
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax={goal}
  aria-valuenow={Math.round(value)}
>
  <div class="h-full rounded-full transition-[width] {over ? 'bg-amber-500' : 'bg-emerald-500'}" style:width="{pct}%"></div>
</div>
