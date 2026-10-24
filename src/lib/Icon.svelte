<script>
  // Thin wrapper over Lucide so the rest of the app refers to icons by a short name, sized in em to follow the text.
  import {
    Apple, Carrot, Check, Flame, ChefHat, ChevronLeft, ChevronRight, Cherry, Coffee, Cookie, Drumstick, Droplet, Egg, Fish, Leaf, Milk, Nut,
    Pencil, Settings, Trash2, Utensils, Wheat, X,
  } from '@lucide/svelte';

  let { name, class: cls = '' } = $props();

  const icons = {
    x: X,
    check: Check,
    flame: Flame,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    trash: Trash2,
    pencil: Pencil,
    settings: Settings,
    recipe: ChefHat,
    // food categories (see foodIcon.js)
    apple: Apple,
    milk: Milk,
    grain: Wheat,
    egg: Egg,
    fish: Fish,
    meat: Drumstick,
    carrot: Carrot,
    cherry: Cherry,
    nut: Nut,
    sweet: Cookie,
    coffee: Coffee,
    leaf: Leaf,
    droplet: Droplet,
    utensils: Utensils,
  };

  const Component = $derived(icons[name] ?? Utensils);
</script>

<Component class="inline-block size-[1.15em] shrink-0 align-[-0.15em] {cls}" aria-hidden="true" />
