# Quick Calorie Counter App

This is a quick vibe-coded calorie counter app

I didn't read anything, so code's probably a mess but that's okay, it's client only and won't be maintained. Don't read it, for your sanity (also why would you???)

## Data sources

- [Open Food Facts](https://world.openfoodfacts.org) for packaged products (live API).
- [Ciqual 2025](https://doi.org/10.57745/RDMHWY) food composition table, ANSES, Etalab 2.0 licence. Bundled as `src/lib/ciqual.json`; rebuild with `node scripts/build-ciqual.mjs <dir with the official XML files>`.
