import { t, tn } from './i18n.js';
// Mappa muscolare: corpo di fronte e di spalle, ogni muscolo colorato in base alle serie della settimana.

// [muscolo, forma] — ellissi "e cx cy rx ry" o rettangoli arrotondati "r x y w h"; figura di fronte centrata a x=60, di spalle a x=160
const FRONT = [
  ['Collo', 'r 55 29 10 7'],
  ['Spalle', 'e 39 45 9 8'], ['Spalle', 'e 81 45 9 8'],
  ['Petto', 'e 51 54 10 8'], ['Petto', 'e 69 54 10 8'],
  ['Bicipiti', 'e 31 68 6 11'], ['Bicipiti', 'e 89 68 6 11'],
  ['Avambracci', 'e 26 93 5 12'], ['Avambracci', 'e 94 93 5 12'],
  ['Addome', 'r 52 64 16 34'],
  ['Abduttori', 'e 44 108 4 7'], ['Abduttori', 'e 76 108 4 7'],
  ['Adduttori', 'e 56 116 3 10'], ['Adduttori', 'e 64 116 3 10'],
  ['Quadricipiti', 'e 49 130 8 20'], ['Quadricipiti', 'e 71 130 8 20'],
  ['Polpacci', 'e 49 171 5 14'], ['Polpacci', 'e 71 171 5 14'],
];
const BACK = [
  ['Trapezi', 'e 160 40 13 8'],
  ['Spalle', 'e 139 46 9 8'], ['Spalle', 'e 181 46 9 8'],
  ['Dorso', 'e 150 64 10 14'], ['Dorso', 'e 170 64 10 14'],
  ['Tricipiti', 'e 131 68 6 11'], ['Tricipiti', 'e 189 68 6 11'],
  ['Avambracci', 'e 126 93 5 12'], ['Avambracci', 'e 194 93 5 12'],
  ['Lombari', 'r 152 82 16 16'],
  ['Glutei', 'e 152 109 9 9'], ['Glutei', 'e 168 109 9 9'],
  ['Femorali', 'e 150 134 8 18'], ['Femorali', 'e 170 134 8 18'],
  ['Polpacci', 'e 150 170 6 14'], ['Polpacci', 'e 170 170 6 14'],
];

// sagoma: testa, busto, braccia e gambe (dietro ai muscoli)
const body = (cx) => `
  <circle cx="${cx}" cy="16" r="11"/>
  <rect x="${cx - 22}" y="34" width="44" height="70" rx="16"/>
  <rect x="${cx - 32}" y="38" width="12" height="70" rx="6"/><rect x="${cx + 20}" y="38" width="12" height="70" rx="6"/>
  <rect x="${cx - 18}" y="96" width="36" height="22" rx="10"/>
  <rect x="${cx - 19}" y="108" width="16" height="78" rx="7"/><rect x="${cx + 3}" y="108" width="16" height="78" rx="7"/>`;

const shape = (spec, attrs) => {
  const [k, ...n] = spec.split(' ');
  const v = n.map(Number);
  return k === 'e'
    ? `<ellipse cx="${v[0]}" cy="${v[1]}" rx="${v[2]}" ry="${v[3]}" ${attrs}/>`
    : `<rect x="${v[0]}" y="${v[1]}" width="${v[2]}" height="${v[3]}" rx="5" ${attrs}/>`;
};

/** Colore per numero di serie: spento, poi sempre più acceso fino a 10–20 serie, arancione oltre */
function fill(n) {
  if (!n) return 'fill="#2c2c2c"';
  if (n > 20) return 'fill="#ff8a3d"';
  const o = n < 5 ? 0.35 : n < 10 ? 0.6 : 1;
  return `fill="var(--accent)" fill-opacity="${o}"`;
}

/** SVG della mappa per un oggetto { muscolo: serie } */
export function muscleMapSvg(sets) {
  // ogni muscolo con il suo titolo (numero di serie) per l'accessibilità
  const draw = (list) => list.map(([m, s]) => shape(s, fill(sets[m] || 0)).replace('/>', `><title>${m}: ${t('{n} serie', { n: sets[m] || 0 })}</title></${s[0] === 'e' ? 'ellipse' : 'rect'}>`)).join('');
  return `<svg class="mmap" viewBox="0 0 220 192" role="img" aria-label="${t('Muscoli allenati: di fronte e di spalle')}">
    <g fill="#1a1a1a">${body(60)}${body(160)}</g>
    ${draw(FRONT)}${draw(BACK)}
    <text x="60" y="191" text-anchor="middle">${t('Davanti')}</text><text x="160" y="191" text-anchor="middle">${t('Dietro')}</text>
  </svg>
  <div class="mmap-legend"><span><i style="background:#2c2c2c"></i>0</span><span><i class="a35"></i>1–4</span><span><i class="a60"></i>5–9</span><span><i class="a100"></i>10–20</span><span><i style="background:#ff8a3d"></i>20+</span><span class="muted">${t('serie')}</span></div>`;
}
