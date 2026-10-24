// Open Food Facts: free, no API key, CORS-enabled.
const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,nutriments,serving_quantity,serving_size';
const TIMEOUT_MS = 15000;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function normalize(p) {
  const name = (p?.product_name || p?.product_name_en || p?.generic_name || '').trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = num(n.energy_100g) / 4.184; // kJ -> kcal
  if (kcal == null) return null;
  const serving = num(p.serving_quantity);
  return {
    name,
    brand: (p.brands ?? '').split(',')[0].trim(),
    barcode: p.code ?? '',
    kcal: round1(num(kcal)),
    protein: round1(num(n.proteins_100g)),
    carbs: round1(num(n.carbohydrates_100g)),
    fat: round1(num(n.fat_100g)),
    fiber: round1(num(n.fiber_100g)),
    salt: round2(n.salt_100g != null ? num(n.salt_100g) : num(n.sodium_100g) * 2.5), // grams; salt = sodium x 2.5
    servingGrams: serving > 0 ? serving : null,
    servingLabel: p.serving_size ?? '',
    source: 'api',
  };
}

// Strips spaces/dashes people paste into barcodes.
const stripBarcode = (q) => q.replace(/[\s-]/g, '');
export const isBarcode = (q) => /^\d{8,14}$/.test(stripBarcode(q));

// fetch with a timeout that also respects the caller's abort signal
async function getJson(url, signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res;
  try {
    res = await fetch(url, { signal: combined });
  } catch (err) {
    if (timeout.aborted && !signal?.aborted) throw new Error('The food database took too long to respond');
    if (err.name === 'AbortError') throw err;
    throw new Error('Could not reach the food database');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The food database returned an error (${res.status})`);
  return res.json();
}

async function lookupBarcode(code, signal) {
  const data = await getJson(`${BASE}/api/v2/product/${encodeURIComponent(stripBarcode(code))}.json?fields=${FIELDS}`, signal);
  const p = data?.status === 1 ? normalize(data.product) : null;
  return p ? [p] : [];
}

async function searchByName(query, signal) {
  const params = new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '25',
    fields: FIELDS,
  });
  const data = await getJson(`${BASE}/cgi/search.pl?${params}`, signal);
  return (data?.products ?? []).map(normalize).filter(Boolean);
}

export const searchProducts = (q, signal) => (isBarcode(q) ? lookupBarcode(q, signal) : searchByName(q, signal));
