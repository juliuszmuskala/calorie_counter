<script>
  import { db, MEALS, scale, removeEntry, markEaten } from './store.svelte.js';
  import Modal from './Modal.svelte';
  import ProductIcon from './ProductIcon.svelte';

  let { id, onclose } = $props();

  const e = $derived(db.entries.find((x) => x.id === id));
  const rows = [
    ['Calories', 'kcal', 'kcal'],
    ['Protein', 'protein', 'g'],
    ['Carbs', 'carbs', 'g'],
    ['Fat', 'fat', 'g'],
    ['Fiber', 'fiber', 'g'],
    ['Salt', 'salt', 'g'],
  ];
  const fmt = (n, key) => (key === 'salt' ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10).toString();

  // ingredient weights are stored for the whole recipe; show them for the portion in this entry
  const ingredients = $derived.by(() => {
    const list = e?.ingredients ?? [];
    const total = list.reduce((s, i) => s + i.grams, 0);
    return total > 0 ? list.map((i) => ({ name: i.name, grams: Math.round(((i.grams * e.grams) / total) * 10) / 10 })) : [];
  });

  function setGrams(ev) {
    const v = ev.currentTarget.valueAsNumber;
    if (v > 0) e.grams = e.whole ? v * 100 : v;
    else ev.currentTarget.value = e.whole ? e.grams / 100 : e.grams;
  }
</script>

{#if e}
  <Modal title={e.name} {onclose}>
    <div class="flex items-center gap-3">
      <ProductIcon item={e} class="size-12" />
      <span class="muted">{e.planned ? 'Planned, not eaten yet' : e.brand || 'Logged food'}</span>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <label class="label">{e.whole ? 'Quantity' : 'Amount (g)'}
        <input class="field" type="number" min="0" step="any" inputmode="decimal" value={e.whole ? e.grams / 100 : e.grams} onchange={setGrams} />
      </label>
      <label class="label">Meal
        <select class="field" bind:value={e.meal}>{#each MEALS as m}<option>{m}</option>{/each}</select>
      </label>
    </div>

    <table class="w-full text-left">
      <thead class="muted">
        <tr><th class="py-1 font-normal"></th><th class="py-1 text-right font-normal">This portion</th><th class="py-1 text-right font-normal">{e.whole ? 'Per item' : 'Per 100 g'}</th></tr>
      </thead>
      <tbody class="tabular-nums">
        {#each rows as [label, key, unit]}
          <tr class="border-t border-stone-200 dark:border-stone-800">
            <th class="py-2 font-normal">{label}</th>
            <td class="py-2 text-right font-semibold">{fmt(scale(e, key), key)} {unit}</td>
            <td class="py-2 text-right text-stone-500 dark:text-stone-400">{fmt(e[key] ?? 0, key)} {unit}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if ingredients.length}
      <section class="grid gap-1">
        <h3 class="font-semibold">Ingredients for this portion</h3>
        <ul class="divided">
          {#each ingredients as ing}
            <li class="flex justify-between gap-2"><span class="min-w-0 break-words">{ing.name}</span><span class="muted tabular-nums">{ing.grams} g</span></li>
          {/each}
        </ul>
      </section>
    {/if}

    <p class="muted">Sodium in this portion: {Math.round((scale(e, 'salt') / 2.5) * 1000)} mg</p>

    {#if e.planned}
      <button class="btn btn-primary" onclick={() => { markEaten(e.id); onclose(); }}>Mark as eaten</button>
    {/if}
    <div class="grid grid-cols-2 gap-2">
      <button class="btn btn-danger" onclick={() => { removeEntry(e.id); onclose(); }}>Remove</button>
      <button class="btn btn-primary" onclick={onclose}>Done</button>
    </div>
  </Modal>
{/if}
