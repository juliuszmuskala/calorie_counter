<script>
  import Icon from './Icon.svelte';
  import { foodIcon } from './foodIcon.js';

  // item: a product or a logged entry (entries remember their icon so recipes keep theirs)
  let { item, class: cls = '' } = $props();
</script>

<span
  class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 {cls}"
  aria-hidden="true"
>
  <Icon name={item.icon ?? foodIcon(item)} class="size-5" />
</span>
