// Riordino trascinando: si tiene premuta la maniglia ⠿ (o a lungo la testata dell'esercizio)
// e si sposta su o giù; gli altri elementi si fanno da parte. Funziona con dito e mouse.
import { haptic } from './motion.js';

const HOLD_MS = 320; // pressione lunga sulla testata
let drag = null;
const handlers = {};

/**
 * Riordino degli elementi [data-drag="gruppo"] della pagina:
 * fn(da, a) viene chiamata al rilascio se la posizione è cambiata.
 */
export function onDragSort(group, fn) {
  handlers[group] = fn;
}
const onMove = (group, from, to) => handlers[group]?.(from, to);

{
  let hold = null;

  document.addEventListener('pointerdown', (e) => {
    if (drag || e.button > 0) return;
    const handle = e.target.closest('[data-drag-handle]');
    const head = !handle && e.target.closest('[data-drag-hold]');
    if (!handle && !head) return;
    if (head && e.target.closest('input, textarea, select, button:not([data-drag-hold])')) return;
    const item = (handle || head).closest('[data-drag]');
    if (!item) return;
    if (handle) {
      e.preventDefault();
      start(item, e);
      return;
    }
    // testata: parte solo dopo una pressione lunga, se il dito non si è mosso (altrimenti è scorrimento)
    const x0 = e.clientX, y0 = e.clientY;
    const cancel = () => {
      clearTimeout(hold?.t);
      hold = null;
      document.removeEventListener('pointermove', moveCheck);
      document.removeEventListener('pointerup', cancel);
      document.removeEventListener('pointercancel', cancel);
    };
    const moveCheck = (m) => {
      if (Math.hypot(m.clientX - x0, m.clientY - y0) > 8) cancel();
    };
    hold = { t: setTimeout(() => { cancel(); start(item, e); }, HOLD_MS) };
    document.addEventListener('pointermove', moveCheck);
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
  });
}

function start(item, e) {
  const group = item.dataset.drag;
  const items = [...document.querySelectorAll(`[data-drag="${group}"]`)];
  if (items.length < 2) return;
  const from = items.indexOf(item);
  const rects = items.map((el) => el.getBoundingClientRect());
  const gap = items.length > 1 ? rects[1].top - rects[0].bottom : 0;
  const shift = rects[from].height + Math.max(0, gap);
  drag = { group, items, from, to: from, rects, shift, y0: e.clientY, sy0: window.scrollY, lastY: e.clientY, raf: 0 };
  document.body.classList.add('dragging');
  item.classList.add('drag-active');
  items.forEach((el) => el !== item && el.classList.add('drag-sib'));
  haptic(12);
  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // iOS: impedisce lo scorrimento della pagina mentre si trascina
  document.addEventListener('touchmove', block, { passive: false });
  autoscroll();
}

const block = (e) => drag && e.preventDefault();

function move(e) {
  if (!drag) return;
  e.preventDefault();
  drag.lastY = e.clientY;
  layout();
}

function layout() {
  const d = drag;
  const dy = d.lastY - d.y0 + (window.scrollY - d.sy0);
  d.items[d.from].style.transform = `translateY(${dy}px) scale(1.02)`;
  // centro dell'elemento trascinato, in coordinate della pagina all'inizio
  const r = d.rects[d.from];
  const mid = r.top + r.height / 2 + dy;
  // nuova posizione = quanti altri elementi hanno il centro sopra quello trascinato
  let to = 0;
  d.rects.forEach((rr, k) => {
    if (k !== d.from && rr.top + rr.height / 2 < mid) to++;
  });
  if (to !== d.to) {
    d.to = to;
    haptic(6);
  }
  d.items.forEach((el, k) => {
    if (k === d.from) return;
    let off = 0;
    if (d.from < to && k > d.from && k <= to) off = -d.shift;
    if (d.from > to && k >= to && k < d.from) off = d.shift;
    el.style.transform = off ? `translateY(${off}px)` : '';
  });
}

/** Vicino ai bordi dello schermo la pagina scorre da sola */
function autoscroll() {
  if (!drag) return;
  const edge = 90;
  const y = drag.lastY;
  const h = window.innerHeight;
  let v = 0;
  if (y < edge) v = -Math.ceil((edge - y) / 6);
  else if (y > h - edge) v = Math.ceil((y - (h - edge)) / 6);
  if (v) {
    window.scrollBy(0, v);
    layout();
  }
  drag.raf = requestAnimationFrame(autoscroll);
}

function end() {
  const d = drag;
  if (!d) return;
  drag = null;
  cancelAnimationFrame(d.raf);
  document.removeEventListener('pointermove', move);
  document.removeEventListener('pointerup', end);
  document.removeEventListener('pointercancel', end);
  document.removeEventListener('touchmove', block);
  document.body.classList.remove('dragging');
  d.items.forEach((el) => {
    el.style.transform = '';
    el.classList.remove('drag-active', 'drag-sib');
  });
  // il tocco che chiude il trascinamento non deve anche aprire qualcosa
  const swallow = (c) => { c.stopPropagation(); c.preventDefault(); };
  document.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
  if (d.to !== d.from) {
    haptic(10);
    onMove(d.group, d.from, d.to);
  }
}

/** Sposta un esercizio nella lista; uscendo da un superset si stacca dal gruppo */
export function moveExercise(list, from, to) {
  const e = list[from];
  if (from > 0 && list[from - 1].superset && !e.superset) list[from - 1].superset = false;
  e.superset = false;
  list.splice(to, 0, list.splice(from, 1)[0]);
}
