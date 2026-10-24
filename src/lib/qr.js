import { renderSVG } from 'uqr';
import { MEALS } from './store.svelte.js';

// The deployed app; QR codes always point here so a phone camera opens the real site.
const APP_URL = 'https://juliuszmuskala.github.io/calorie_counter/';
// Characters of data per QR code. Codes much denser than this (1000 was tried) are too fine for a phone camera to read off a screen.
const CHUNK = 400;
const STASH = 'calorie-counter:qr-parts';

// ---- encoding: JSON -> gzip -> base64url

const toB64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Log entries dominate the size, mostly their random ids and repeated nutrition snapshots. For transfer, entries are packed as
// rows pointing into a table of distinct foods, and get a deterministic id on arrival (so scanning twice doesn't duplicate them).
const FOOD_KEYS = ['name', 'brand', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'salt', 'icon'];

function pack(obj) {
  const foods = [];
  const index = new Map();
  const rows = (obj.entries ?? []).map((e) => {
    const food = FOOD_KEYS.map((k) => e[k] ?? '');
    const key = JSON.stringify(food);
    if (!index.has(key)) index.set(key, foods.push(food) - 1);
    return [e.date, Math.max(0, MEALS.indexOf(e.meal)), e.grams, index.get(key)];
  });
  const { entries, ...rest } = obj;
  return { ...rest, v: 2, foods, rows };
}

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

function unpack(data) {
  if (data?.v !== 2) return data;
  const { foods, rows, v, ...rest } = data;
  const entries = (rows ?? []).flatMap(([date, meal, grams, f], n) => {
    const food = foods?.[f];
    if (!food) return [];
    const e = { date, meal: MEALS[meal] ?? 'Snacks', grams };
    FOOD_KEYS.forEach((k, i) => (e[k] = food[i] === '' ? undefined : food[i]));
    return [{ ...e, id: 'qr-' + fnv(`${date}|${meal}|${grams}|${food.join('|')}|${rows.slice(0, n).filter((r) => r.join() === rows[n].join()).length}`) }];
  });
  return { ...rest, entries };
}

const encodeData = async (obj) => toB64(await pipe(new TextEncoder().encode(JSON.stringify(pack(obj))), new CompressionStream('gzip')));
const decodeData = async (str) => unpack(JSON.parse(new TextDecoder().decode(await pipe(fromB64(str), new DecompressionStream('gzip')))));

// ---- sending

// Returns the share links, one per QR code: APP_URL#qr=<id>.<part>.<total>.<data>
export async function buildLinks(obj) {
  const data = await encodeData(obj);
  const id = Math.random().toString(36).slice(2, 6);
  const total = Math.max(1, Math.ceil(data.length / CHUNK));
  return Array.from({ length: total }, (_, i) => `${APP_URL}#qr=${id}.${i + 1}.${total}.${data.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}

// QR codes keep a white background so they scan in dark mode too.
export const qrSvg = (text) => renderSVG(text, { ecc: 'L', border: 2, whiteColor: '#ffffff', blackColor: '#000000' });

// ---- receiving

const readStash = () => {
  try {
    return JSON.parse(localStorage.getItem(STASH)) ?? null;
  } catch {
    return null;
  }
};
const clearStash = () => {
  try {
    localStorage.removeItem(STASH);
  } catch {}
};

// Looks at the URL hash. Returns null if there is no transfer in it, else
// { status: 'partial', received, total } while codes are missing, or { status: 'ready', data } when complete.
// Throws on malformed data. Multi-code transfers are collected in localStorage across scans.
export async function readIncoming() {
  const m = location.hash.match(/^#qr=([a-z0-9]+)\.(\d+)\.(\d+)\.([\w-]*)$/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  const [, id, part, total, chunk] = m;
  const i = Number(part);
  const n = Number(total);
  if (!(i >= 1 && i <= n && n <= 200)) throw new Error('This QR code is damaged.');

  let stash = readStash();
  if (stash?.id !== id || stash.total !== n) stash = { id, total: n, parts: {} };
  stash.parts[i] = chunk;
  const received = Object.keys(stash.parts).length;
  if (received < n) {
    try {
      localStorage.setItem(STASH, JSON.stringify(stash));
    } catch {}
    return { status: 'partial', received, total: n, have: Object.keys(stash.parts).map(Number).sort((a, b) => a - b) };
  }
  clearStash();
  const joined = Array.from({ length: n }, (_, k) => stash.parts[k + 1]).join('');
  try {
    return { status: 'ready', data: await decodeData(joined) };
  } catch {
    throw new Error('Could not read the data. Make sure all codes come from the same transfer.');
  }
}
