<script>
  import { parseExport, summarize, applyImport } from './store.svelte.js';
  import Modal from './Modal.svelte';

  // transfer: result of readIncoming() (partial/ready) or { status: 'error', message }
  let { transfer, onclose } = $props();

  let mode = $state('merge');
  let confirming = $state(false); // replace needs a second, in-dialog confirmation (native confirm() is unreliable on phones)
  let result = $state('');
  let failure = $state('');

  const parsed = $derived.by(() => {
    if (transfer.status !== 'ready') return { data: null, error: '' };
    try {
      return { data: parseExport(transfer.data), error: '' };
    } catch (e) {
      return { data: null, error: e.message };
    }
  });

  function doImport() {
    if (mode === 'replace' && !confirming) {
      confirming = true;
      return;
    }
    try {
      result = applyImport(parsed.data, mode);
    } catch (e) {
      failure = `Import failed: ${e.message}`;
      confirming = false;
    }
  }
</script>

<Modal title="Data transfer" {onclose}>
  {#if transfer.status === 'error' || parsed.error}
    <p class="text-red-600 dark:text-red-400" role="alert">{transfer.message ?? parsed.error}</p>
    <button class="btn" onclick={onclose}>Close</button>
  {:else if transfer.status === 'partial'}
    <p>Received code <strong>{transfer.received} of {transfer.total}</strong>.</p>
    <p class="muted">
      Scan the remaining codes (any order) with the camera. Missing:
      {Array.from({ length: transfer.total }, (_, i) => i + 1).filter((i) => !transfer.have.includes(i)).join(', ')}.
    </p>
    <button class="btn" onclick={onclose}>Close</button>
  {:else if result}
    <p role="status">{result}</p>
    {#if result.startsWith('Merged 0 new entries and 0 new products')}
      <p class="muted">Everything in this transfer was already on this device.</p>
    {/if}
    <button class="btn btn-primary" onclick={onclose}>Done</button>
  {:else if parsed.data}
    {@const c = summarize(parsed.data)}
    <p>This transfer contains <strong>{c.entries}</strong> log entries, <strong>{c.products}</strong> products and <strong>{c.supplements}</strong> supplements.</p>
    <label class="label">How to import
      <select class="field" bind:value={mode} onchange={() => (confirming = false)}>
        <option value="merge">Merge with data on this device</option>
        <option value="replace">Replace data on this device</option>
      </select>
    </label>
    {#if confirming}
      <p class="text-amber-700 dark:text-amber-400" role="alert">This deletes everything currently on this device and replaces it with the transfer.</p>
    {/if}
    {#if failure}<p class="text-red-600 dark:text-red-400" role="alert">{failure}</p>{/if}
    <div class="flex gap-2">
      <button class="btn" onclick={() => (confirming ? (confirming = false) : onclose())}>{confirming ? 'Back' : 'Cancel'}</button>
      <button class="btn btn-primary flex-1 whitespace-nowrap {confirming ? 'bg-red-600! border-red-600!' : ''}" onclick={doImport}>
        {confirming ? 'Yes, replace everything' : 'Import'}
      </button>
    </div>
  {/if}
</Modal>
