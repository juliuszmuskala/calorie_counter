<script>
  import Icon from './Icon.svelte';
  import Scanner from './Scanner.svelte';

  // initial: an existing product to edit (keeps its id and source); oncancel adds a Cancel button.
  let { submitLabel = 'Continue', onsubmit, initial = null, oncancel = null } = $props();

  const blank = { name: '', brand: '', barcode: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '', salt: '', servingGrams: '', servingLabel: '' };
  // svelte-ignore state_referenced_locally
  let whole = $state(initial?.whole ?? false);
  // the form is a draft: it starts from `initial` and is not meant to follow later changes to it
  // svelte-ignore state_referenced_locally
  let f = $state(initial ? { ...blank, ...Object.fromEntries(Object.keys(blank).map((k) => [k, initial[k] ?? ''])) } : { ...blank });
  let save = $state(true);
  let scanning = $state(false);

  const n = (v) => (v === '' || v == null ? 0 : Number(v));

  function submit(e) {
    e.preventDefault();
    onsubmit(
      {
        ...(initial && { id: initial.id }),
        name: f.name.trim(),
        brand: f.brand.trim(),
        barcode: f.barcode.trim(),
        kcal: n(f.kcal),
        protein: n(f.protein),
        carbs: n(f.carbs),
        fat: n(f.fat),
        fiber: n(f.fiber),
        salt: n(f.salt),
        // a whole item is stored as 100 g so the per-100 g values are the values for one item
        servingGrams: whole ? 100 : n(f.servingGrams) > 0 ? n(f.servingGrams) : null,
        servingLabel: whole ? '' : f.servingLabel.trim(),
        ...(whole && { whole: true }),
        source: initial?.source ?? 'custom',
      },
      save,
    );
  }
</script>

<form onsubmit={submit} class="grid gap-3">
  <label class="label">Name *<input class="field" required bind:value={f.name} placeholder="e.g. Grandma's lasagne" /></label>
  <label class="label">Brand<input class="field" bind:value={f.brand} /></label>
  <label class="label">Barcode
    <span class="flex gap-1.5">
      <input class="field min-w-0" bind:value={f.barcode} inputmode="numeric" />
      <button type="button" class="btn shrink-0 px-3" aria-label="Scan barcode" onclick={() => (scanning = true)}><Icon name="scan" /></button>
    </span>
  </label>
  <label class="flex items-center gap-2"><input class="size-5 accent-emerald-600" type="checkbox" bind:checked={whole} /> Whole item, no weight (e.g. restaurant meal)</label>
  <p class="muted">Nutrition per <strong>{whole ? 'item' : '100 g'}</strong></p>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <label class="label">Calories *<input class="field" required type="number" min="0" step="any" inputmode="decimal" bind:value={f.kcal} /></label>
    <label class="label">Protein g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.protein} /></label>
    <label class="label">Carbs g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.carbs} /></label>
    <label class="label">Fat g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.fat} /></label>
    <label class="label">Fiber g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.fiber} /></label>
    <label class="label">Salt g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.salt} /></label>
  </div>
  <div class="grid grid-cols-2 gap-2" class:hidden={whole}>
    <label class="label">Serving size (g)<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.servingGrams} /></label>
    <label class="label">Serving label<input class="field" bind:value={f.servingLabel} placeholder="1 slice" /></label>
  </div>
  {#if !initial}
    <label class="flex items-center gap-2"><input class="size-5 accent-emerald-600" type="checkbox" bind:checked={save} /> Save to my products</label>
  {/if}
  <div class="grid grid-flow-col auto-cols-fr gap-2">
    {#if oncancel}<button type="button" class="btn" onclick={oncancel}>Cancel</button>{/if}
    <button class="btn btn-primary">{submitLabel}</button>
  </div>
</form>

{#if scanning}
  <Scanner
    onscan={(code) => {
      f.barcode = code;
      scanning = false;
    }}
    onclose={() => (scanning = false)}
  />
{/if}
