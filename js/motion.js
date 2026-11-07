import { fmtNum } from './utils.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => reduce.matches;

const ease = (p) => 1 - Math.pow(1 - p, 4);

/** Entrata a cascata degli elementi della pagina */
export function enter(root) {
  if (reduce.matches) return;
  const items = [...root.querySelectorAll(':scope > *, .stagger > *')];
  items.forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 16));
    el.classList.add('enter');
  });
  setTimeout(() => items.forEach((el) => el.classList.remove('enter')), 1400);
  countUps(root);
}

/** Numeri che "contano" fino al valore: <b data-count="123" data-d="1" data-suf=" kg"> */
export function countUps(root) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count);
    const d = Number(el.dataset.d || 0);
    const suf = el.dataset.suf || '';
    if (!isFinite(to) || reduce.matches || to === 0) return;
    const t0 = performance.now();
    const dur = 900 + Math.min(500, Math.abs(to) / 10);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmtNum(to * ease(p), d) + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = fmtNum(0, d) + suf;
    requestAnimationFrame(step);
  });
}

/** Coriandoli nel colore accento */
export function burst(container, n = 36) {
  if (reduce.matches || !container) return;
  const wrap = document.createElement('div');
  wrap.className = 'burst';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const r = 90 + Math.random() * 120;
    p.style.setProperty('--x', `${Math.cos(a) * r}px`);
    p.style.setProperty('--y', `${Math.sin(a) * r - 40}px`);
    p.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    p.style.setProperty('--d', `${Math.random() * 120}ms`);
    p.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
    wrap.appendChild(p);
  }
  container.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1800);
}

/** Feedback tattile leggero */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch (e) {
    /* ignora */
  }
}
