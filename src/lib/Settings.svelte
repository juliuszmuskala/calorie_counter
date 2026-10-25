<script>
  import Icon from './Icon.svelte';
  import {
    db, exportJson, importJson, removeProduct, saveProduct, saveSupplement, removeSupplement, describeSchedule, todayStr, isDateStr, resetAll, WEEKDAYS, WEEK_ORDER,
  } from './store.svelte.js';
  import Modal from './Modal.svelte';
  import RecipeBuilder from './RecipeBuilder.svelte';
  import ProductDetails from './ProductDetails.svelte';
  import ProductIcon from './ProductIcon.svelte';
  import QrExport from './QrExport.svelte';
  import { getUsdaKey, setUsdaKey } from './api.js';

  let { onclose } = $props();
  let mode = $state('merge');
  let msg = $state('');
  let fileInput = $state();
  let editing = $state(null); // recipe being edited
  let showQr = $state(false);
  let usdaKey = $state(getUsdaKey());
  let viewingId = $state(null); // product whose nutrition is shown
  const viewing = $derived(db.products.find((p) => p.id === viewingId));

  // add/edit form for supplements and activities
  const blankItem = () => ({ id: undefined, name: '', group: 'supplement', type: 'daily', days: [1], every: 2, anchor: todayStr() });
  let item = $state(blankItem());

  function editItem(s) {
    const r = s.schedule;
    item = {
      ...blankItem(),
      id: s.id,
      name: s.name,
      group: s.group ?? 'supplement',
      type: r.type === 'weekday' ? 'weekdays' : r.type,
      days: r.type === 'weekday' ? [r.day] : r.type === 'weekdays' ? [...r.days] : [1],
      every: r.every ?? 2,
      anchor: r.anchor ?? todayStr(),
    };
  }

  function toggleDay(d) {
    item.days = item.days.includes(d) ? item.days.filter((x) => x !== d) : [...item.days, d].sort((a, b) => a - b);
  }

  const itemValid = $derived(item.name.trim() && (item.type !== 'weekdays' || item.days.length > 0));

  function submitItem(e) {
    e.preventDefault();
    if (!itemValid) return;
    const { id, name, group, type, days, every, anchor } = item;
    const schedule =
      type === 'weekdays'
        ? { type, days: [...days] }
        : type === 'interval'
          ? { type, every: Math.max(2, Math.round(Number(every)) || 2), anchor: isDateStr(anchor) ? anchor : todayStr() }
          : { type: 'daily' };
    saveSupplement({ id, name: name.trim(), group, schedule });
    item = blankItem();
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

<Modal title={editing ? 'Edit recipe' : viewing ? 'Product' : showQr ? 'Transfer via QR code' : 'Settings'} {onclose} confirmClose={editing ? 'Discard changes to this recipe?' : null}>
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
  {:else if showQr}
    <QrExport onback={() => (showQr = false)} />
  {:else if viewing}
    <ProductDetails product={viewing} onback={() => (viewingId = null)} onedit={viewing.source === 'recipe' ? () => (editing = viewing) : null} />
  {:else}
    <section class="grid gap-2">
      <h3 class="font-semibold">Daily goals</h3>
      <div class="grid grid-cols-2 gap-2">
        <label class="label">Calories<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.kcal} onchange={(e) => setGoal('kcal', e)} /></label>
        <label class="label">Calorie margin ± kcal<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.kcalTolerance} onchange={(e) => setGoal('kcalTolerance', e)} /></label>
        <label class="label">Protein g<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.protein} onchange={(e) => setGoal('protein', e)} /></label>
        <label class="label">Fiber g<input class="field" type="number" min="0" inputmode="numeric" value={db.goals.fiber} onchange={(e) => setGoal('fiber', e)} /></label>
      </div>

      <h4 class="mt-1 text-sm font-semibold">Daily combo</h4>
      <div class="grid grid-cols-2 gap-2">
        <label class="label">Forgiven missed days<input class="field" type="number" min="0" step="1" inputmode="numeric" value={db.goals.comboGraceDays} onchange={(e) => setGoal('comboGraceDays', e)} /></label>
        <label class="label">Grace cooldown (days)<input class="field" type="number" min="0" step="1" inputmode="numeric" value={db.goals.comboGraceCooldown} onchange={(e) => setGoal('comboGraceCooldown', e)} /></label>
      </div>
      <label class="flex items-start gap-2">
        <input class="mt-0.5 size-5 shrink-0 accent-emerald-600" type="checkbox" bind:checked={db.goals.comboActivities} />
        Activities count towards the combo
      </label>
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Supplements and activities</h3>
      <ul class="divided">
        {#each db.supplements as s (s.id)}
          <li class="flex items-center justify-between gap-2">
            <span class="min-w-0">
              <span class="break-words">{s.name}</span>
              <span class="muted block">{s.group === 'activity' ? 'Activity' : 'Supplement'} · {describeSchedule(s.schedule)}</span>
            </span>
            <span class="flex shrink-0">
              <button class="btn-icon" aria-label="Edit {s.name}" onclick={() => editItem(s)}><Icon name="pencil" /></button>
              <button class="btn-icon" aria-label="Delete {s.name}" onclick={() => removeSupplement(s.id)}><Icon name="trash" /></button>
            </span>
          </li>
        {:else}
          <li class="muted">Nothing here yet.</li>
        {/each}
      </ul>
      <form class="grid gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-950" onsubmit={submitItem}>
        <strong class="text-sm">{item.id ? 'Edit item' : 'Add item'}</strong>
        <label class="label">Name<input class="field" required bind:value={item.name} placeholder="e.g. Mobility, Omega-3" /></label>
        <div class="grid grid-cols-[11fr_10fr] gap-2">
          <label class="label">Type
            <select class="field" bind:value={item.group}>
              <option value="supplement">Supplement</option>
              <option value="activity">Activity</option>
            </select>
          </label>
          <label class="label">Schedule
            <select class="field" bind:value={item.type}>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="interval">Interval</option>
            </select>
          </label>
        </div>
        {#if item.type === 'weekdays'}
          <div class="grid grid-cols-7 gap-1" role="group" aria-label="Weekdays">
            {#each WEEK_ORDER as i}
              <button
                type="button"
                class="btn min-h-9 px-0 py-1 text-sm {item.days.includes(i) ? 'btn-primary' : ''}"
                aria-pressed={item.days.includes(i)}
                onclick={() => toggleDay(i)}>{WEEKDAYS[i].slice(0, 3)}</button
              >
            {/each}
          </div>
        {:else if item.type === 'interval'}
          <div class="grid grid-cols-2 gap-2">
            <label class="label">Every (days)<input class="field" type="number" min="2" inputmode="numeric" bind:value={item.every} /></label>
            <label class="label">Counting from<input class="field" type="date" bind:value={item.anchor} /></label>
          </div>
        {/if}
        <div class="grid grid-flow-col auto-cols-fr gap-2">
          {#if item.id}<button type="button" class="btn" onclick={() => (item = blankItem())}>Cancel</button>{/if}
          <button class="btn" disabled={!itemValid}>{item.id ? 'Save changes' : 'Add'}</button>
        </div>
      </form>
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Food search</h3>
      <label class="label">USDA FoodData Central API key
        <input class="field" type="text" autocomplete="off" spellcheck="false" placeholder="Optional (shared demo key is used)" bind:value={usdaKey} onchange={() => setUsdaKey(usdaKey)} />
      </label>
      <p class="muted">Without a key the shared demo key is used, which allows only a few searches per hour. Get a free key at <a class="underline" href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noopener">fdc.nal.usda.gov</a>. It stays in this browser and isn't included in backups.</p>
    </section>

    <section class="grid gap-2">
      <h3 class="font-semibold">Backup</h3>
      <p class="muted">Data lives only in this browser. Export a JSON file to back it up or move it to another device.</p>
      <button class="btn" onclick={exportJson}>Export JSON</button>
      <button class="btn" onclick={() => (showQr = true)}>Transfer via QR code…</button>
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
