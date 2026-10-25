<script>
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import { createDetector } from './scan.js';

  // onscan(code): called once with the first barcode found.
  let { onscan, onclose } = $props();

  let video = $state();
  let error = $state('');

  onMount(() => {
    let stream;
    let stopped = false;
    let timer;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs a secure (https) connection.');
        const [detector, media] = await Promise.all([
          createDetector(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
        ]);
        stream = media;
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const [hit] = await detector.detect(video);
            if (hit?.rawValue) return onscan(hit.rawValue);
          } catch {
            // a frame that can't be read is not fatal, try the next one
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (err) {
        error =
          err?.name === 'NotAllowedError' ? 'Camera permission was denied.' : err?.name === 'NotFoundError' ? 'No camera found.' : err?.message || 'Could not start the camera.';
      }
    }
    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  });
</script>

<Modal title="Scan barcode" {onclose}>
  {#if error}
    <p class="text-red-700 dark:text-red-400" role="alert">{error}</p>
  {:else}
    <div class="relative overflow-hidden rounded-xl bg-black">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} class="aspect-[4/3] w-full object-cover" playsinline muted></video>
      <div class="pointer-events-none absolute inset-x-[12%] top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400/80"></div>
    </div>
    <p class="muted">Point the camera at a product's barcode.</p>
  {/if}
</Modal>
