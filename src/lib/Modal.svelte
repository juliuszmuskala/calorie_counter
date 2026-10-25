<script>
  import Icon from './Icon.svelte';
  // Native <dialog>: gives us focus trapping, inert background and Escape handling.
  // fill: the body doesn't scroll; the content manages its own scrolling (e.g. a fixed toolbar above a scrolling list)
  let { title, onclose, confirmClose = null, fill = false, children } = $props();

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
  class="mx-auto mt-[6dvh] mb-auto max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-lg flex-col overflow-hidden open:flex rounded-2xl bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/50 dark:bg-stone-900 dark:text-stone-100"
>
  <header class="flex shrink-0 items-center justify-between gap-2 px-5 pt-5 pb-3">
    <h2 class="min-w-0 text-lg font-semibold break-words">{title}</h2>
    <button class="btn-icon" onclick={tryClose} aria-label="Close"><Icon name="x" /></button>
  </header>
  <!-- only this part scrolls, so the header stays put -->
  <div class="min-h-0 px-5 pb-5 {fill ? 'flex flex-col' : 'grid content-start gap-3 overflow-y-auto overscroll-contain'}">
    {@render children()}
  </div>
</dialog>
