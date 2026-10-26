<script>
  import { db } from './store.svelte.js';
  import { youtubeId } from './workout.svelte.js';

  let { url, title = 'Exercise demo' } = $props();

  const id = $derived(youtubeId(url));
  const HOST = 'https://www.youtube-nocookie.com';
  let open = $state(false);
  let sound = $state(false);
  let frame = $state();

  // Muted, inline playback never takes over the phone's audio, so music or podcasts on headphones keep playing.
  // Sound is only switched on by tapping the button (or if the setting says so), and that is what may interrupt them.
  const src = $derived(`${HOST}/embed/${id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${id}&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`);

  function command(func) {
    frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: '' }), HOST);
  }

  function setSound(on) {
    sound = on;
    command(on ? 'unMute' : 'mute');
  }

  function loaded() {
    if (db.workout.videoSound) setSound(true);
  }
</script>

{#if url}
  {#if open && id}
    <div class="grid gap-1.5">
      <div class="aspect-video overflow-hidden rounded-xl bg-black">
        <iframe
          bind:this={frame}
          class="size-full"
          {src}
          {title}
          allow="autoplay; encrypted-media"
          referrerpolicy="strict-origin-when-cross-origin"
          onload={loaded}
        ></iframe>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <button class="btn min-h-9 px-3 py-1 text-sm" aria-pressed={sound} onclick={() => setSound(!sound)}>
          {sound ? 'Sound on' : 'Muted'}
        </button>
        <button class="btn min-h-9 px-3 py-1 text-sm" onclick={() => ((open = false), (sound = false))}>Hide</button>
        <a class="muted ml-auto underline" href={url} target="_blank" rel="noopener noreferrer">Open in YouTube</a>
      </div>
      {#if sound}<p class="muted">Sound may pause music playing on your headphones.</p>{/if}
    </div>
  {:else if id}
    <button class="btn min-h-9 justify-self-start px-3 py-1 text-sm" onclick={() => (open = true)}>▶ Demo (muted)</button>
  {:else}
    <a class="muted justify-self-start underline" href={url} target="_blank" rel="noopener noreferrer">Demo video</a>
  {/if}
{/if}
