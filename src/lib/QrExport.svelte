<script>
  import { exportPayload, summarize } from './store.svelte.js';
  import { buildLinks, qrSvg } from './qr.js';

  let { onback } = $props();

  let range = $state('none'); // 'all' | '30' | '7' | 'none'
  let links = $state([]);
  let page = $state(0);
  let copied = $state(false);
  let error = $state('');

  const counts = $derived.by(() => ({ range, ...summarize(exportPayload(range)) }));

  $effect(() => {
    const payload = exportPayload(range);
    let stale = false;
    buildLinks(payload).then(
      (l) => {
        if (stale) return;
        links = l;
        page = 0;
        error = '';
      },
      (e) => !stale && (error = e.message || 'Could not build the QR code'),
    );
    return () => (stale = true);
  });

  async function copy() {
    try {
      // a single link containing everything, for pasting into a chat
      await navigator.clipboard.writeText(links.length === 1 ? links[0] : links.join('\n'));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      error = 'Could not copy to the clipboard.';
    }
  }
</script>

<div class="grid gap-3">
  <p class="muted">
    Scan with the phone's camera: it opens the app and offers to import. Each code holds a small slice of the data, so a long food log
    needs many codes, and products and recipes alone usually fit in a few. Scan all of them, in any order.
  </p>

  <label class="label">Include food log
    <select class="field" bind:value={range}>
      <option value="none">None: products, recipes, supplements, goals</option>
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="all">Everything</option>
    </select>
  </label>
  <p class="muted">{counts.entries} log entries · {counts.products} products · {counts.supplements} supplements</p>

  {#if error}
    <p class="text-red-600 dark:text-red-400" role="alert">{error}</p>
  {:else if links.length}
    <div class="mx-auto w-full max-w-sm rounded-2xl bg-white p-1 shadow-xs ring-1 ring-stone-200">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated locally by uqr from our own data -->
      {@html qrSvg(links[page])}
    </div>
    <p class="muted">Turn the screen brightness up and hold the phone about 20 cm away.</p>
    {#if links.length > 1}
      <div class="flex items-center justify-between gap-2">
        <button class="btn" disabled={page === 0} onclick={() => page--}>Previous</button>
        <strong aria-live="polite">Code {page + 1} of {links.length}</strong>
        <button class="btn" disabled={page === links.length - 1} onclick={() => page++}>Next</button>
      </div>
      {#if links.length > 10}
        <p class="muted">That is a lot of codes. Exporting a JSON file or limiting the food log is easier.</p>
      {/if}
    {/if}
    <button class="btn" onclick={copy}>{copied ? 'Copied' : links.length > 1 ? 'Copy all links' : 'Copy link'}</button>
  {:else}
    <p class="muted" role="status">Preparing…</p>
  {/if}

  <button class="btn" onclick={onback}>Back</button>
</div>
