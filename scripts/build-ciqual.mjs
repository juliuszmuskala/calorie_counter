// Builds src/lib/ciqual.json from the official ANSES Ciqual XML tables.
// Source: https://doi.org/10.57745/RDMHWY (Etalab 2.0). Usage: node scripts/build-ciqual.mjs <dir with alim*.xml, compo*.xml>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: node scripts/build-ciqual.mjs <dir>');
const read = (prefix) => readFileSync(join(dir, readdirSync(dir).find((f) => f.startsWith(prefix) && !f.includes('grp') && f.endsWith('.xml'))), 'utf8');

const unescape = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? unescape(m[1]) : '';
};
const blocks = (xml, name) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);

// Ciqual constituent codes (per 100 g)
const C = { kcal: '328', kcalJones: '333', protein: '25000', carbs: '31000', fat: '40000', fiber: '34100', salt: '10004', sodium: '10110' };
const wanted = new Set(Object.values(C));

// "12,5" -> 12.5; "< 0,5" and "traces" count as 0; "-" (not measured) -> null
function parse(raw) {
  const s = raw.trim();
  if (!s || s === '-') return null;
  if (s === 'traces' || s.startsWith('<')) return 0;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const values = new Map(); // alim_code -> { constCode: value }
for (const b of blocks(read('compo'), 'COMPO')) {
  const c = tag(b, 'const_code');
  if (!wanted.has(c)) continue;
  const v = parse(tag(b, 'teneur'));
  if (v == null) continue;
  const code = tag(b, 'alim_code');
  if (!values.has(code)) values.set(code, {});
  values.get(code)[c] = v;
}

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const foods = [];
for (const b of blocks(read('alim'), 'ALIM')) {
  const v = values.get(tag(b, 'alim_code'));
  const kcal = v?.[C.kcal] ?? v?.[C.kcalJones];
  if (kcal == null) continue;
  const salt = v[C.salt] ?? (v[C.sodium] != null ? (v[C.sodium] / 1000) * 2.5 : 0);
  const fr = tag(b, 'alim_nom_fr');
  const en = tag(b, 'alim_nom_eng') || fr;
  // [code, english name, french name, kcal, protein, carbs, fat, fiber, salt]
  foods.push([Number(tag(b, 'alim_code')), en, fr, r1(kcal), r1(v[C.protein] ?? 0), r1(v[C.carbs] ?? 0), r1(v[C.fat] ?? 0), r1(v[C.fiber] ?? 0), r2(salt)]);
}
writeFileSync(new URL('../src/lib/ciqual.json', import.meta.url), JSON.stringify(foods));
console.log(`${foods.length} foods`);
