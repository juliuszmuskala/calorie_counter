<script>
  import { onDestroy } from 'svelte';
  import { db, saveProduct } from './store.svelte.js';
  import { searchProducts, isBarcode } from './api.js';
  import ProductForm from './ProductForm.svelte';
  import ProductIcon from './ProductIcon.svelte';

  // onpick(product): called with an API result, a saved product, or a newly entered custom product.
  let { onpick, includeRecipes = true } = $props();

  let tab = $state('search');
  let query = $state('');
  let results = $state([]);
  let status = $state('idle'); // idle | loading | done | error
  let errorMsg = $state('');
  let ctrl;

  onDestroy(() => ctrl?.abort());

  async function search(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    ctrl?.abort();
    const mine = (ctrl = new AbortController());
    status = 'loading';
    try {
      const found = await searchProducts(q, mine.signal);
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

  const tabs = $derived([
    ['search', 'Search online'],
    ['saved', `My products (${pool.length})`],
    ['custom', 'Custom'],
  ]);
</script>

<div class="grid gap-3">
  <div class="grid grid-cols-3 gap-1.5" role="tablist">
    {#each tabs as [id, label]}
      <button
        role="tab"
        aria-selected={tab === id}
        class="btn px-2 text-sm {tab === id ? 'btn-primary' : ''}"
        onclick={() => (tab = id)}>{label}</button
      >
    {/each}
  </div>

  {#if tab === 'search'}
    <form class="flex gap-2" onsubmit={search}>
      <input class="field" type="search" bind:value={query} placeholder="Product name or barcode" aria-label="Product name or barcode" />
      <button class="btn btn-primary shrink-0" disabled={status === 'loading' || !query.trim()}>{isBarcode(query) ? 'Look up' : 'Search'}</button>
    </form>
    {#if status === 'loading'}
      <p class="muted" role="status">Searching…</p>
    {:else if status === 'error'}
      <p class="text-red-600 dark:text-red-400" role="alert">{errorMsg}. You can still add the food manually.</p>
      <button class="btn" onclick={() => (tab = 'custom')}>Add custom product</button>
    {:else if status === 'done' && !results.length}
      <p class="muted">Nothing found (or no nutrition data).</p>
      <button class="btn" onclick={() => (tab = 'custom')}>Add it as a custom product</button>
    {/if}
    <ul class="grid gap-1.5">
      {#each results as p}
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
  {:else if tab === 'saved'}
    <input class="field" type="search" bind:value={filter} placeholder="Filter saved products" aria-label="Filter saved products" />
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
