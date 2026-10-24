<script>
  import Icon from './Icon.svelte';
  // Native <dialog>: gives us focus trapping, inert background and Escape handling.
  let { title, onclose, confirmClose = null, children } = $props();

  let el;
  let pressedOnBackdrop = false;

  $effect(() => {
    el.showModal();
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  });

  function tryClose() {
    if (confirmClose && !confirm(confirmClose)) return;
    onclose();
  }
</script>

<dialog
  bind:this={el}
  aria-label={title}
  oncancel={(e) => {
    e.preventDefault();
    tryClose();
  }}
  onclose={() => onclose()}
  onmousedown={(e) => (pressedOnBackdrop = e.target === el)}
  onclick={(e) => e.target === el && pressedOnBackdrop && tryClose()}
  class="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/50 dark:bg-stone-900 dark:text-stone-100"
>
  <div class="grid content-start gap-3 p-4">
    <header class="flex items-center justify-between gap-2">
      <h2 class="min-w-0 text-lg font-semibold break-words">{title}</h2>
      <button class="btn-icon" onclick={tryClose} aria-label="Close"><Icon name="x" /></button>
    </header>
    {@render children()}
  </div>
</dialog>
