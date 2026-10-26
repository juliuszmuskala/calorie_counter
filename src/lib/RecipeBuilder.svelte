<script>
  import Icon from './Icon.svelte';
  import ProductPicker from './ProductPicker.svelte';
  import { uid, saveProduct, findSaved } from './store.svelte.js';

  // initial: an existing recipe product (for editing). onsave(product) receives the finished recipe.
  // allowOneTime shows a "save to my products" choice; unchecked means the recipe is only logged, not stored.
  let { initial = null, submitLabel = 'Save recipe', allowOneTime = false, onsave, oncancel } = $props();

  // initial values are read once: the form edits a private copy
  /* svelte-ignore state_referenced_locally */
  const r = initial?.recipe;
  /* svelte-ignore state_referenced_locally */
  let name = $state(initial?.name ?? '');
  let servings = $state(r?.servings ?? 1);
  let cookedGrams = $state(r?.cookedGrams ?? '');
  let ingredients = $state(r ? r.ingredients.map((i) => ({ ...i, key: uid() })) : []);
  let picking = $state(false);
  let save = $state(true);

  const grams = (i) => Math.max(0, Number(i.grams) || 0);
  const sumOf = (k) => ingredients.reduce((s, i) => s + ((i[k] ?? 0) * grams(i)) / 100, 0);
  const rawGrams = $derived(ingredients.reduce((s, i) => s + grams(i), 0));
  const totalGrams = $derived(Number(cookedGrams) > 0 ? Number(cookedGrams) : rawGrams);
  const totalKcal = $derived(sumOf('kcal'));
  const nServ = $derived(Math.max(1, Math.round(Number(servings)) || 1));
  const valid = $derived(name.trim() && ingredients.length > 0 && totalGrams > 0);

  function addIngredient(p) {
    if (p.source === 'api' && !findSaved(p)) saveProduct(p); // online finds go to my products
    ingredients.push({
      key: uid(),
      name: p.name,
      brand: p.brand ?? '',
      grams: p.servingGrams || 100, // a recipe starts at one serving
      kcal: p.kcal,
      protein: p.protein,
      carbs: p.carbs,
      fat: p.fat,
      fiber: p.fiber ?? 0,
      salt: p.salt ?? 0,
    });
    picking = false;
  }

  const round2 = (n) => Math.round(n * 100) / 100;
  const round1 = (n) => Math.round(n * 10) / 10;

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    const per100 = (k) => (k === 'salt' ? round2 : round1)((sumOf(k) / totalGrams) * 100);
    onsave(
      {
      id: initial?.id,
      name: name.trim(),
      brand: '',
      barcode: '',
      kcal: per100('kcal'),
      protein: per100('protein'),
      carbs: per100('carbs'),
      fat: per100('fat'),
      fiber: per100('fiber'),
      salt: per100('salt'),
      servingGrams: round1(totalGrams / nServ),
      servingLabel: nServ > 1 ? '1 serving' : 'whole recipe',
      source: 'recipe',
      recipe: {
        servings: nServ,
        cookedGrams: Number(cookedGrams) > 0 ? Number(cookedGrams) : '',
        ingredients: ingredients.map(({ key, ...i }) => ({ ...i, grams: grams(i) })),
      },
      },
      save,
    );
  }
</script>

{#if picking}
  <div class="grid gap-3">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">Add ingredient</h3>
      <button class="btn" onclick={() => (picking = false)}>Back to recipe</button>
    </div>
    <ProductPicker onpick={addIngredient} excludeId={initial?.id} />
  </div>
{:else}
  <form onsubmit={submit} class="grid gap-3">
    <label class="label">Recipe name *<input class="field" required bind:value={name} placeholder="e.g. Overnight oats" /></label>

    {#if ingredients.length}
      <ul class="divided">
        {#each ingredients as ing, i (ing.key)}
          <li class="flex items-center justify-between gap-2">
            <span class="min-w-0">
              <span class="block truncate">{ing.name}</span>
              <span class="muted">{Math.round(((ing.kcal ?? 0) * grams(ing)) / 100)} kcal</span>
            </span>
            <span class="flex shrink-0 items-center gap-1">
              <input
                class="field w-20 px-2 py-1"
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                bind:value={ing.grams}
                aria-label="Grams of {ing.name}"
              />
              <span class="muted">g</span>
              <button type="button" class="btn-icon" aria-label="Remove {ing.name}" onclick={() => ingredients.splice(i, 1)}><Icon name="x" /></button>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">No ingredients yet.</p>
    {/if}
    <button type="button" class="btn btn-dashed" onclick={() => (picking = true)}>+ Add ingredient</button>

    <div class="grid grid-cols-2 gap-2">
      <label class="label">Servings<input class="field" type="number" min="1" step="1" inputmode="numeric" bind:value={servings} /></label>
      <label class="label"
        >Final weight (g)<input
          class="field"
          type="number"
          min="0"
          step="any"
          inputmode="decimal"
          bind:value={cookedGrams}
          placeholder={String(Math.round(rawGrams))}
        /></label
      >
    </div>
    <p class="muted">Leave final weight empty to use the total of the ingredients. Set it if cooking changes the weight.</p>

    {#if ingredients.length && totalGrams > 0}
      <p class="font-semibold">
        Total {Math.round(totalKcal)} kcal · {Math.round(totalKcal / nServ)} per serving · {Math.round((totalKcal / totalGrams) * 100)} kcal/100 g
      </p>
    {/if}

    {#if allowOneTime}
      <label class="flex items-center gap-2"><input class="size-5 accent-emerald-600" type="checkbox" bind:checked={save} /> Save to my products (uncheck for a one-time recipe)</label>
    {/if}

    <div class="flex gap-2">
      {#if oncancel}<button type="button" class="btn" onclick={oncancel}>Cancel</button>{/if}
      <button class="btn btn-primary flex-1 whitespace-nowrap" disabled={!valid}>{allowOneTime && !save ? 'Add without saving' : submitLabel}</button>
    </div>
  </form>
{/if}
