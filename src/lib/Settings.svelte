<script>
  import Icon from './Icon.svelte';
  import {
    db, exportJson, importJson, removeProduct, saveProduct, removeSupplement, describeSchedule, uid, todayStr, isDateStr, resetAll, WEEKDAYS,
  } from './store.svelte.js';
  import Modal from './Modal.svelte';
  import RecipeBuilder from './RecipeBuilder.svelte';
  import ProductDetails from './ProductDetails.svelte';
  import ProductIcon from './ProductIcon.svelte';

  let { onclose } = $props();
  let mode = $state('merge');
  let msg = $state('');
  let fileInput = $state();
  let editing = $state(null); // recipe being edited
  let viewingId = $state(null); // product whose nutrition is shown
  const viewing = $derived(db.products.find((p) => p.id === viewingId));

  let newSupp = $state({ name: '', type: 'daily', day: 1, every: 2, anchor: todayStr() });
  function addSupplement(e) {
    e.preventDefault();
    const { name, type, day, every, anchor } = newSupp;
    const schedule =
      type === 'weekday'
        ? { type, day: Number(day) }
        : type === 'interval'
          ? { type, every: Math.max(2, Math.round(Number(every)) || 2), anchor: isDateStr(anchor) ? anchor : todayStr() }
          : { type };
    db.supplements.push({ id: uid(), name: name.trim(), schedule });
    newSupp.name = '';
  }

  async function onFile(e) {
    const input = e.currentTarget;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (mode === 'replace' && !confirm('Replace ALL current data with the contents of this file?')) return;
    try {
      msg = await importJson(file, mode);
    } catch (err) {
      msg = `Import failed: ${err.message}`;
    }
  }

  function wipe() {
    if (confirm('Delete all entries, products, supplements and goals, and reset to defaults? Export first if unsure.')) {
      resetAll();
      msg = 'All data deleted.';
    }
  }

  // commit on change so clearing a field while typing doesn't snap it to 0
  function setGoal(k, e) {
    const v = e.currentTarget.valueAsNumber;
    if (v >= 0) db.goals[k] = v;
    else e.currentTarget.value = db.goals[k];
  }
</script>

<Modal title={editing ? 'Edit recipe' : viewing ? 'Product' : 'Settings'} {onclose} confirmClose={editing ? 'Discard changes to this recipe?' : null}>
  {#if editing}
    <RecipeBuilder
      initial={editing}
      submitLabel="Save changes"
      onsave={(p) => {
        saveProduct(p);
        editing = null;
      }}
      oncancel={() => (editing = null)}
    />
  {:else if viewing}
    <ProductDetails product={viewing} onback={() => (viewingId = null)} onedit={viewing.source === 'recipe' ? () => (editing = viewing) : null} />
  {:else}
    <section class="grid gap-2">
      <h3 class="font-semibold">Daily goals</h3>
      <div class="grid grid-cols-3 gap-2">
        <label class="label">Calories<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.kcal} onchange={(e) => setGoal('kcal', e)} /></label>
        <label class="label">Protein g<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.protein} onchange={(e) => setGoal('protein', e)} /></label>
        <label class="label">Fiber g<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.fiber} onchange={(e) => setGoal('fiber', e)} /></label>
      </div>
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Supplements</h3>
      <ul class="divided">
        {#each db.supplements as s (s.id)}
          <li class="flex items-center justify-between gap-2">
            <span>{s.name} <span class="muted">{describeSchedule(s.schedule)}</span></span>
            <button class="btn-icon" aria-label="Delete {s.name}" onclick={() => removeSupplement(s.id)}><Icon name="trash" /></button>
          </li>
        {:else}
          <li class="muted">No supplements.</li>
        {/each}
      </ul>
      <form class="grid gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-950" onsubmit={addSupplement}>
        <div class="grid grid-cols-2 gap-2">
          <label class="label">Name<input class="field" required bind:value={newSupp.name} /></label>
          <label class="label">Schedule
            <select class="field" bind:value={newSupp.type}>
              <option value="daily">Daily</option>
              <option value="weekday">Weekly on a day</option>
              <option value="interval">Every N days</option>
            </select>
          </label>
        </div>
        {#if newSupp.type === 'weekday'}
          <label class="label">Day
            <select class="field" bind:value={newSupp.day}>{#each WEEKDAYS as d, i}<option value={i}>{d}</option>{/each}</select>
          </label>
        {:else if newSupp.type === 'interval'}
          <div class="grid grid-cols-2 gap-2">
            <label class="label">Every (days)<input class="field" type="number" min="2" inputmode="numeric" bind:value={newSupp.every} /></label>
            <label class="label">Counting from<input class="field" type="date" bind:value={newSupp.anchor} /></label>
          </div>
        {/if}
        <button class="btn">Add supplement</button>
      </form>
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Backup</h3>
      <p class="muted">Data lives only in this browser. Export a JSON file to back it up or move it to another device.</p>
      <button class="btn" onclick={exportJson}>Export JSON</button>
      <label class="label">On import
        <select class="field" bind:value={mode}>
          <option value="merge">Merge with existing data</option>
          <option value="replace">Replace existing data</option>
        </select>
      </label>
      <button class="btn" onclick={() => fileInput.click()}>Import JSON…</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} />
      {#if msg}<p class="muted" role="status">{msg}</p>{/if}
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">My products ({db.products.length})</h3>
      <ul class="divided">
        {#each db.products as p (p.id)}
          <li class="flex items-center justify-between gap-2">
            <button class="-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-stone-100 dark:hover:bg-stone-800" onclick={() => (viewingId = p.id)} aria-label="Nutrition details for {p.name}">
              <ProductIcon item={p} />
              <span class="min-w-0">
                <span class="block truncate">{p.name}</span>
                <span class="muted">{p.kcal} kcal/100g</span>
              </span>
            </button>
            <span class="flex shrink-0">
              {#if p.source === 'recipe'}<button class="btn-icon" aria-label="Edit {p.name}" onclick={() => (editing = p)}><Icon name="pencil" /></button>{/if}
              <button
                class="btn-icon"
                aria-label="Delete {p.name}"
                onclick={() => confirm(`Delete "${p.name}"? Past log entries are not affected.`) && removeProduct(p.id)}><Icon name="trash" /></button
              >
            </span>
          </li>
        {:else}
          <li class="muted">Nothing saved yet.</li>
        {/each}
      </ul>
    </section>

    <button class="btn btn-danger" onclick={wipe}>Delete all data</button>
  {/if}
</Modal>
