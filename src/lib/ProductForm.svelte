<script>
  let { submitLabel = 'Continue', onsubmit } = $props();

  let f = $state({ name: '', brand: '', barcode: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '', salt: '', servingGrams: '', servingLabel: '' });
  let save = $state(true);

  const n = (v) => (v === '' || v == null ? 0 : Number(v));

  function submit(e) {
    e.preventDefault();
    onsubmit(
      {
        name: f.name.trim(),
        brand: f.brand.trim(),
        barcode: f.barcode.trim(),
        kcal: n(f.kcal),
        protein: n(f.protein),
        carbs: n(f.carbs),
        fat: n(f.fat),
        fiber: n(f.fiber),
        salt: n(f.salt),
        servingGrams: n(f.servingGrams) > 0 ? n(f.servingGrams) : null,
        servingLabel: f.servingLabel.trim(),
        source: 'custom',
      },
      save,
    );
  }
</script>

<form onsubmit={submit} class="grid gap-3">
  <label class="label">Name *<input class="field" required bind:value={f.name} placeholder="e.g. Grandma's lasagne" /></label>
  <div class="grid grid-cols-2 gap-2">
    <label class="label">Brand<input class="field" bind:value={f.brand} /></label>
    <label class="label">Barcode<input class="field" bind:value={f.barcode} inputmode="numeric" /></label>
  </div>
  <p class="muted">Nutrition per <strong>100 g</strong></p>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <label class="label">Calories *<input class="field" required type="number" min="0" step="any" inputmode="decimal" bind:value={f.kcal} /></label>
    <label class="label">Protein g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.protein} /></label>
    <label class="label">Carbs g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.carbs} /></label>
    <label class="label">Fat g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.fat} /></label>
    <label class="label">Fiber g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.fiber} /></label>
    <label class="label">Salt g<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.salt} /></label>
  </div>
  <div class="grid grid-cols-2 gap-2">
    <label class="label">Serving size (g)<input class="field" type="number" min="0" step="any" inputmode="decimal" bind:value={f.servingGrams} /></label>
    <label class="label">Serving label<input class="field" bind:value={f.servingLabel} placeholder="1 slice" /></label>
  </div>
  <label class="flex items-center gap-2"><input class="size-5 accent-emerald-600" type="checkbox" bind:checked={save} /> Save to my products</label>
  <button class="btn btn-primary">{submitLabel}</button>
</form>
