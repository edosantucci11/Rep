// Miniature degli esercizi e icone dei muscoli dal manichino 2D (SVG), in memoria per tema.
import { renderFrame } from './mannequin.js';
import { specFor, HL } from './moves.js';
import { getExercise } from './exercises.js';

const VER = 'v9-2d';
const mem = new Map();
// colore del tema letto una volta (getComputedStyle per ogni miniatura forzerebbe ricalcoli di stile)
let accentCache = null;
const accent = () => (accentCache ||= getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D4FF00');
addEventListener('themechange', () => (accentCache = null));
const svgUrl = (inner, vb = '-8 -46 216 214') =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`);

function cached(key, make) {
  if (!mem.has(key)) mem.set(key, Promise.resolve().then(make));
  return mem.get(key);
}

/** Miniatura di un esercizio: posa di massima contrazione */
export function getThumb(exId) {
  const a = accent();
  return cached(`${VER}|ex|${exId}|${a}`, () => {
    const spec = specFor(getExercise(exId));
    const per = (spec.dur || 1000) + (spec.hold ?? 260);
    return svgUrl(renderFrame(spec, (spec.frames.length - 1) * per + (spec.hold ?? 260) + 1, a));
  });
}

/** Icona di un gruppo muscolare: figura in piedi, di fronte, con il muscolo evidenziato */
export function getMuscleIcon(muscle) {
  const a = accent();
  return cached(`${VER}|mu|${muscle}|${a}`, () => {
    const spec = { view: 'front', anchor: 'feet', at: [100, 155], props: [], noFloor: true, hl: HL[muscle] || [], hl2: [], frames: [{ ab: 14, fb: 10, lb: 4 }] };
    return svgUrl(renderFrame(spec, 0, a), '40 -40 120 200');
  });
}

/* ---------- caricamento pigro delle immagini visibili ---------- */
let io = null;
function load(img) {
  const p = img.dataset.thumb ? getThumb(img.dataset.thumb) : getMuscleIcon(img.dataset.muscleIcon);
  p.then((url) => {
    if (!img.isConnected) return;
    img.src = url;
    img.classList.add('ready');
  }).catch(() => img.classList.add('failed'));
}

export function observeThumbs(root) {
  const imgs = root.querySelectorAll('img[data-thumb]:not(.ready), img[data-muscle-icon]:not(.ready)');
  if (!('IntersectionObserver' in window)) return imgs.forEach(load);
  io ||= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      load(e.target);
    }
  }, { rootMargin: '300px' });
  imgs.forEach((img) => io.observe(img));
}

/** Svuota la cache (es. cambio tema) */
export function resetThumbCache() {
  mem.clear();
}
