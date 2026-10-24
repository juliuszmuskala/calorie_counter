<script>
  import ProductIcon from './ProductIcon.svelte';
  // Nutrition facts for a saved product; shown inside the Settings dialog.
  let { product: p, onback, onedit = null } = $props();

  const rows = [
    ['Calories', 'kcal', 'kcal'],
    ['Protein', 'protein', 'g'],
    ['Carbs', 'carbs', 'g'],
    ['Fat', 'fat', 'g'],
    ['Fiber', 'fiber', 'g'],
    ['Salt', 'salt', 'g'],
  ];
  const fmt = (n, key) => (key === 'salt' ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10).toString();
  const perServing = $derived(p.servingGrams > 0 ? p.servingGrams : null);
</script>

<div class="grid gap-3">
  <div class="flex items-center gap-3">
    <ProductIcon item={p} class="size-12" />
    <div class="grid min-w-0 gap-0.5">
      <strong class="text-lg">{p.name}</strong>
      {#if p.brand}<span class="muted">{p.brand}</span>{/if}
      {#if p.barcode}<span class="muted">Barcode {p.barcode}</span>{/if}
    </div>
  </div>

  <table class="w-full text-left">
    <thead class="muted">
      <tr>
        <th class="py-1 font-normal"></th>
        <th class="py-1 text-right font-normal">Per 100 g</th>
        {#if perServing}<th class="py-1 text-right font-normal">Per serving ({perServing} g)</th>{/if}
      </tr>
    </thead>
    <tbody class="tabular-nums">
      {#each rows as [label, key, unit]}
        <tr class="border-t border-stone-200 dark:border-stone-800">
          <th class="py-2 font-normal">{label}</th>
          <td class="py-2 text-right font-semibold">{fmt(p[key] ?? 0, key)} {unit}</td>
          {#if perServing}<td class="py-2 text-right text-stone-500 dark:text-stone-400">{fmt(((p[key] ?? 0) * perServing) / 100, key)} {unit}</td>{/if}
        </tr>
      {/each}
    </tbody>
  </table>

  {#if p.source === 'recipe'}
    <section class="grid gap-1">
      <h3 class="font-semibold">Ingredients ({p.recipe.servings} {p.recipe.servings === 1 ? 'serving' : 'servings'})</h3>
      <ul class="divided">
        {#each p.recipe.ingredients as ing}
          <li class="flex justify-between gap-2"><span>{ing.name}</span><span class="muted tabular-nums">{ing.grams} g</span></li>
        {/each}
      </ul>
    </section>
  {/if}

  <div class="grid grid-flow-col auto-cols-fr gap-2">
    <button class="btn" onclick={onback}>Back</button>
    {#if onedit}<button class="btn btn-primary" onclick={onedit}>Edit recipe</button>{/if}
  </div>
</div>
