<script>
  import { onDestroy } from 'svelte';
  import { db, saveProduct } from './store.svelte.js';
  import { searchGeneric, searchOnline, isBarcode } from './api.js';
  import ProductForm from './ProductForm.svelte';
  import ProductIcon from './ProductIcon.svelte';
  import Icon from './Icon.svelte';

  // onpick(product): called with an API result, a saved product, or a newly entered custom product.
  let { onpick, onrecipe = null, includeRecipes = true } = $props();

  let tab = $state('search');
  let query = $state('');
  let generic = $state([]); // bundled CIQUAL foods, updated as you type
  let results = $state([]); // Open Food Facts, only on request
  let status = $state('idle'); // idle | loading | done | error
  let errorMsg = $state('');
  let ctrl;
  let scrolled = $state(false); // hides the recipe button once the results are scrolled

  onDestroy(() => ctrl?.abort());

  $effect(() => {
    const q = query.trim();
    ctrl?.abort(); // online results belong to the query they were fetched for
    results = [];
    status = 'idle';
    if (!q || isBarcode(q)) {
      generic = [];
      return;
    }
    let stale = false;
    searchGeneric(q).then((found) => {
      if (!stale) generic = found;
    });
    return () => (stale = true);
  });

  async function searchWeb(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    ctrl?.abort();
    const mine = (ctrl = new AbortController());
    status = 'loading';
    try {
      const found = await searchOnline(q, mine.signal);
      if (mine !== ctrl) return;
      results = found;
      status = 'done';
    } catch (err) {
      if (mine !== ctrl || err.name === 'AbortError') return;
      errorMsg = err.message || 'Network error';
      results = [];
      status = 'error';
    }
  }

  function fromCustom(p, save) {
    onpick(save ? saveProduct(p) : p);
  }

  let filter = $state('');
  const pool = $derived(db.products.filter((p) => includeRecipes || p.source !== 'recipe'));
  const filteredSaved = $derived(
    pool.filter((p) => !filter.trim() || `${p.name} ${p.brand} ${p.barcode}`.toLowerCase().includes(filter.trim().toLowerCase())),
  );

  function onscroll(e) {
    const el = e.currentTarget;
    // some browsers stop a fraction of a pixel short of 0 (or bounce below it) when scrolling back up
    if (el.scrollTop < 4) scrolled = false;
    // only when there's enough to scroll, or collapsing the button would snap back to the top and flicker
    else if (el.scrollHeight - el.clientHeight > 80) scrolled = true;
  }

  const tabs = $derived([
    ['search', 'Search'],
    ['saved', 'My products'],
    ['custom', 'Custom'],
  ]);
</script>

<!-- In a fill Modal only the results scroll, so nothing can show above the controls.
     Elsewhere (inside the recipe builder) the controls fall back to sticking to the top. -->
<div class="flex min-h-0 flex-col gap-3">
  <div class="sticky top-0 z-10 -mx-5 grid shrink-0 bg-white px-5 dark:bg-stone-900">
    {#if onrecipe}
      <div class="grid transition-[grid-template-rows] duration-200 {scrolled ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}">
        <div class="overflow-hidden">
          <div class="pb-3">
            <button class="btn btn-dashed w-full" tabindex={scrolled ? -1 : 0} onclick={onrecipe}><Icon name="recipe" /> Create a recipe from ingredients</button>
          </div>
        </div>
      </div>
    {/if}
    <div class="grid gap-3">
      <div class="grid grid-cols-3 gap-1.5" role="tablist">
        {#each tabs as [id, label]}
          <button
            role="tab"
            aria-selected={tab === id}
            class="btn px-2 text-sm {tab === id ? 'btn-primary' : ''}"
            onclick={() => ((tab = id), (scrolled = false))}>{label}</button
          >
        {/each}
      </div>
      {#if tab === 'search'}
        <form class="flex gap-2" onsubmit={searchWeb}>
          <input class="field" type="search" bind:value={query} placeholder="Generic food, product or barcode" aria-label="Generic food, product or barcode" />
          <button class="btn btn-primary shrink-0" disabled={status === 'loading' || !query.trim()}>{isBarcode(query) ? 'Look up' : 'Look online'}</button>
        </form>
      {:else if tab === 'saved'}
        <input class="field" type="search" bind:value={filter} placeholder="Filter saved products" aria-label="Filter saved products" />
      {/if}
    </div>
  </div>

  <div class="-mx-5 grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain px-5 pt-0.5" {onscroll}>
  {#if tab === 'search'}
    {#snippet list(items)}
      <ul class="grid gap-1.5">
        {#each items as p}
          <li>
            <button class="btn flex w-full justify-start gap-3 px-4 py-2.5 text-left" onclick={() => onpick(p)}>
              <ProductIcon item={p} />
              <span class="grid min-w-0 justify-items-start">
                <strong class="font-semibold break-words">{p.name}</strong>
                <span class="muted">{p.brand}{p.brand && p.barcode ? ' · ' : ''}{p.barcode}</span>
                <span class="text-sm text-emerald-700 dark:text-emerald-400">{p.kcal} kcal/100g</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/snippet}
    {#if generic.length}
      <h3 class="text-sm font-semibold">Generic foods</h3>
      {@render list(generic)}
    {:else if query.trim() && !isBarcode(query)}
      <p class="muted">No generic foods match.</p>
    {/if}
    {#if status === 'loading'}
      <p class="muted" role="status">Searching Open Food Facts…</p>
    {:else if status === 'error'}
      <p class="text-red-600 dark:text-red-400" role="alert">{errorMsg}. You can still add the food manually.</p>
      <button class="btn" onclick={() => (tab = 'custom')}>Add custom product</button>
    {:else if status === 'done'}
      {#if results.length}
        <h3 class="text-sm font-semibold">Online (Open Food Facts)</h3>
        {@render list(results)}
      {:else}
        <p class="muted">Nothing found online (or no nutrition data).</p>
        <button class="btn" onclick={() => (tab = 'custom')}>Add it as a custom product</button>
      {/if}
    {/if}
  {:else if tab === 'saved'}
    {#if !filteredSaved.length}<p class="muted">{pool.length ? 'No matches.' : 'No saved products yet.'}</p>{/if}
    <ul class="grid gap-1.5">
      {#each filteredSaved as p (p.id)}
        <li>
          <button class="btn flex w-full justify-start gap-3 px-4 py-2.5 text-left" onclick={() => onpick(p)}>
            <ProductIcon item={p} />
            <span class="grid min-w-0 justify-items-start">
              <strong class="font-semibold break-words">{p.name}</strong>
              {#if p.brand}<span class="muted">{p.brand}</span>{/if}
              <span class="text-sm text-emerald-700 dark:text-emerald-400">{p.kcal} kcal/100g</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <ProductForm onsubmit={fromCustom} />
  {/if}
  </div>
</div>
