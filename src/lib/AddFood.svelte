<script>
  import { addEntry, saveProduct, findSaved, MEALS } from './store.svelte.js';
  import Modal from './Modal.svelte';
  import ProductPicker from './ProductPicker.svelte';
  import RecipeBuilder from './RecipeBuilder.svelte';

  let { date, meal: initialMeal, onclose } = $props();

  let mode = $state('pick'); // pick | recipe
  // svelte-ignore state_referenced_locally
  let meal = $state(initialMeal); // user can change it; the prop is only the starting value
  let selected = $state(null);
  let grams = $state(100);

  function pick(p) {
    selected = p;
    grams = p.servingGrams || 100;
  }

  function add() {
    // products found online are kept in the library automatically
    if (selected.source === 'api' && !findSaved(selected)) saveProduct(selected);
    addEntry({ date, meal, product: selected, grams: Number(grams) });
    onclose();
  }

  function saveRecipe(p, save) {
    mode = 'pick';
    pick(save ? saveProduct(p) : p); // one-time recipes are only logged, never stored in the library
  }

  const factor = $derived((Number(grams) || 0) / 100);
  // a serving label that just repeats the weight ("40 g") adds nothing
  const servingNote = $derived.by(() => {
    const label = selected?.servingLabel?.trim();
    const plain = (t) => t.toLowerCase().replace(/\s|g$/g, '');
    return label && plain(label) !== String(selected.servingGrams) ? `, ${label}` : '';
  });
  const title = $derived(selected ? 'How much?' : mode === 'recipe' ? 'New recipe' : 'Add food');
</script>

<Modal {title} {onclose} fill={!selected && mode !== 'recipe'} confirmClose={mode === 'recipe' && !selected ? 'Discard this recipe?' : null}>
  {#if selected}
    <div class="grid gap-3">
      <div class="grid gap-0.5 break-words">
        <strong class="text-lg">{selected.name}</strong>
        {#if selected.brand}<span class="muted">{selected.brand}</span>{/if}
        <span class="muted">
          per 100 g: {selected.kcal} kcal · P {selected.protein} · C {selected.carbs} · F {selected.fat} · Fiber {selected.fiber ?? 0} · Salt {selected.salt ?? 0}
        </span>
      </div>
      <label class="label">Meal
        <select class="field" bind:value={meal}>{#each MEALS as m}<option>{m}</option>{/each}</select>
      </label>
      <label class="label">Amount (g)
        <input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={grams} />
      </label>
      <div class="flex flex-wrap gap-2">
        {#if selected.servingGrams}
          <button class="btn text-sm" onclick={() => (grams = selected.servingGrams)}>
            1 serving ({selected.servingGrams} g{servingNote})
          </button>
        {/if}
        <button class="btn text-sm" onclick={() => (grams = 100)}>100 g</button>
      </div>
      <p class="text-3xl font-bold" aria-live="polite">
        {Math.round(selected.kcal * factor)} kcal
        <span class="muted font-normal">
          · P {Math.round(selected.protein * factor)} g · Fiber {Math.round((selected.fiber ?? 0) * factor)} g
        </span>
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn" onclick={() => (selected = null)}>Back</button>
        <button class="btn btn-primary" disabled={!(Number(grams) > 0)} onclick={add}>Add to {meal}</button>
      </div>
    </div>
  {:else if mode === 'recipe'}
    <RecipeBuilder submitLabel="Save & add" allowOneTime onsave={saveRecipe} oncancel={() => (mode = 'pick')} />
  {/if}

  <!-- stays mounted so search results survive going Back from the amount step -->
  <div class={selected || mode === 'recipe' ? 'hidden' : 'flex min-h-0 flex-col'}>
    <ProductPicker onpick={pick} onrecipe={() => (mode = 'recipe')} />
  </div>
</Modal>
