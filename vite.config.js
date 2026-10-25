import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'node:fs';

// Fills the precache list in the service worker with the files of this build.
const precache = () => ({
  name: 'precache',
  apply: 'build',
  writeBundle(options, bundle) {
    const files = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon.svg', ...Object.keys(bundle)];
    const sw = options.dir + '/sw.js';
    writeFileSync(
      sw,
      readFileSync(sw, 'utf8').replace('__PRECACHE__', JSON.stringify(files)).replace('__VERSION__', Date.now().toString(36)),
    );
  },
});

export default defineConfig({
  base: './',
  build: { outDir: 'docs' },
  plugins: [tailwindcss(), svelte(), precache()],
});
