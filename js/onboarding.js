// Presentazione iniziale (stile "storie"): mostra cosa fa l'app e fa scegliere corpo e tema.
import { state, save } from './store.js';
import { THEMES, applyTheme } from './theme.js';
import { getExercise } from './exercises.js';
import { specFor } from './moves.js';
import { mount } from './mannequin.js';
import { reducedMotion, haptic, countUps } from './motion.js';
import { I } from './icons.js';
import { t, tn } from './i18n.js';

const DUR = 6000;

const SLIDES = [
  {
    key: 'hello',
    html: () => `
      <div class="ob-hero">
        <div class="ob-logo"><span>R</span><span>E</span><span>P</span></div>
        <h1 class="ob-h">${t('Il tuo diario')}<br>${t('di allenamento')}</h1>
        <p class="ob-p">${t('Schede, pesi, record e progressi.')}<br>${t('Tutto sul tuo telefono, anche offline.')}</p>
        <div class="ob-hint">${t('Tocca per continuare')} ${I.chevron}</div>
      </div>`,
  },
  {
    key: 'live',
    html: () => `
      <div class="ob-kicker">${t('01 · Allenamento')}</div>
      <h2 class="ob-h">${t('Allenati in diretta')}</h2>
      <div class="ob-mock card">
        <div class="ob-mock-head"><b>${t('Panca piana')}</b><span class="label">${t('Petto · 6-8 rip')}</span></div>
        ${[['80', '8'], ['80', '7'], ['82,5', '6']].map(([kg, r], i) => `
          <div class="ob-set" style="--i:${i}">
            <span class="ob-n">${i + 1}</span><span class="ob-prev">${kg}×${r}</span>
            <span class="ob-in">${kg}</span><span class="ob-in">${r}</span><span class="ob-ok">${I.check}</span>
          </div>`).join('')}
        <div class="ob-rest">
          <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" class="t"/><circle cx="24" cy="24" r="21" class="p" pathLength="1"/></svg>
          <div><div class="label">${t('Recupero')}</div><div class="ob-rest-t">1:30</div></div>
        </div>
      </div>
      <p class="ob-p">${t('I pesi della volta scorsa sono già pronti, il timer di recupero parte da solo e puoi segnare RPE, dropset e superset.')}</p>`,
  },
  {
    key: 'body',
    html: () => `
      <div class="ob-kicker">${t('02 · Esercizi')}</div>
      <h2 class="ob-h">${t('960+ esercizi animati')}</h2>
      <div class="ob-3d"><div class="mq" id="ob-mq"></div></div>
      <p class="ob-p">${t('Per ogni esercizio un manichino che esegue il movimento, i muscoli coinvolti in evidenza e la spiegazione passo passo in italiano.')}</p>`,
    enter: (el) => {
      const box = el.querySelector('#ob-mq');
      mount(box, specFor(getExercise('b-squat')));
    },
  },
  {
    key: 'progress',
    html: () => `
      <div class="ob-kicker">${t('03 · Progressi')}</div>
      <h2 class="ob-h">${t('Guarda i tuoi progressi')}</h2>
      <div class="ob-mock card">
        <div class="ob-stats">
          <div class="stat"><b data-count="108" data-d="0">108</b><span>${t('1RM stimato')}</span></div>
          <div class="stat"><b data-count="12.4" data-d="1" data-suf="%">12,4%</b><span>${t('in 8 settimane')}</span></div>
        </div>
        <svg class="ob-chart" viewBox="0 0 300 120">
          <path class="ob-area" d="M10 105 L50 92 L90 95 L130 76 L170 70 L210 52 L250 44 L290 22 L290 115 L10 115 Z"/>
          <path class="ob-line" pathLength="1" d="M10 105 L50 92 L90 95 L130 76 L170 70 L210 52 L250 44 L290 22"/>
          <circle class="ob-dot" cx="290" cy="22" r="6"/>
        </svg>
        <div class="ob-pr"><span class="ob-trophy">${I.trophy}</span><span><b>${t('Nuovo record!')}</b><br><span class="label">${t('Panca piana · 85 kg')}</span></span></div>
      </div>
      <p class="ob-p">${t('Grafici per esercizio, record personali automatici, volume per muscolo e calendario dei tuoi allenamenti.')}</p>`,
    enter: (el) => countUps(el),
  },
  {
    key: 'you',
    last: true,
    html: () => `
      <div class="ob-kicker">${t('04 · Su misura')}</div>
      <h2 class="ob-h">${t('Scegli il tuo stile')}</h2>
      <div class="label ob-lab">${t('Colore')}</div>
      <div class="ob-themes">${Object.entries(THEMES).map(([k, t], i) => `
        <button class="ob-sw ${k === (state.settings.theme || 'volt') ? 'active' : ''}" style="--sw:${t.accent};--i:${i}" data-action="ob-theme" data-k="${k}" aria-label="${t.name}"></button>`).join('')}</div>
      <p class="ob-p">${t('I dati restano solo sul tuo telefono. Puoi cambiare tutto quando vuoi da')} <b>${t('Altro')}</b>.</p>
      <button class="btn btn-primary btn-block ob-start" data-action="ob-done">${t('Inizia ad allenarti')}</button>`,
  },
];

let cur = 0, timer = null, t0 = 0, root = null, paused = false, raf = 0;

export function shouldOnboard() {
  return !state.settings.onboarded;
}

export function startOnboarding() {
  if (root) return;
  root = document.createElement('div');
  root.id = 'onboard';
  root.innerHTML = `
    <div class="ob-bars">${SLIDES.map(() => '<span><i></i></span>').join('')}</div>
    <button class="ob-skip" data-action="ob-done">${t('Salta')}</button>
    <div class="ob-stage"></div>
    <div class="ob-tap ob-tap-l" data-action="ob-prev"></div>
    <div class="ob-tap ob-tap-r" data-action="ob-next"></div>`;
  document.body.appendChild(root);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => root.classList.add('show'));
  // tieni premuto per mettere in pausa, come nelle storie
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ob-tap')) paused = true;
  });
  const resume = () => {
    if (paused) {
      paused = false;
      t0 = performance.now() - elapsed;
    }
  };
  root.addEventListener('pointerup', resume);
  root.addEventListener('pointercancel', resume);
  // scorrimento orizzontale
  let sx = null;
  root.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  root.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)(true);
  });
  show(0);
}

let elapsed = 0;
function loop(now) {
  if (!root) return;
  if (!paused) elapsed = now - t0;
  const bar = root.querySelectorAll('.ob-bars i')[cur];
  const slide = SLIDES[cur];
  const p = slide.last ? 1 : Math.min(1, elapsed / DUR);
  if (bar) bar.style.transform = `scaleX(${p})`;
  if (!slide.last && !reducedMotion() && elapsed >= DUR) return next();
  raf = requestAnimationFrame(loop);
}

function show(i, dir = 1) {
  cancelAnimationFrame(raf);
  cur = Math.max(0, Math.min(SLIDES.length - 1, i));
  const stage = root.querySelector('.ob-stage');
  // tutte le pagine ancora visibili escono (anche con tocchi rapidi)
  stage.querySelectorAll('.ob-slide:not(.leaving)').forEach((old) => {
    old.classList.add('leaving', dir > 0 ? 'out-l' : 'out-r');
    setTimeout(() => old.remove(), 450);
  });
  const el = document.createElement('section');
  el.className = `ob-slide ob-${SLIDES[cur].key} ${dir > 0 ? 'in-r' : 'in-l'}`;
  el.innerHTML = SLIDES[cur].html();
  stage.appendChild(el);
  root.querySelectorAll('.ob-bars i').forEach((b, k) => (b.style.transform = `scaleX(${k < cur ? 1 : 0})`));
  root.classList.toggle('is-last', !!SLIDES[cur].last);
  SLIDES[cur].enter?.(el);
  t0 = performance.now();
  elapsed = 0;
  raf = requestAnimationFrame(loop);
}

function next(manual) {
  if (manual) haptic(8);
  if (cur >= SLIDES.length - 1) return;
  show(cur + 1, 1);
}
function prev(manual) {
  if (manual) haptic(8);
  if (cur > 0) show(cur - 1, -1);
}

export function finishOnboarding() {
  if (!root) return;
  state.settings.onboarded = true;
  save();
  cancelAnimationFrame(raf);
  const r = root;
  root = null;
  r.classList.add('closing');
  document.body.classList.remove('modal-open');
  setTimeout(() => r.remove(), 600);
  window.dispatchEvent(new Event('rep:onboarded'));
}

export const ONBOARD_ACTIONS = {
  'ob-next': () => next(true),
  'ob-prev': () => prev(true),
  'ob-done': () => finishOnboarding(),
  'ob-theme': (el) => {
    state.settings.theme = el.dataset.k;
    applyTheme(el.dataset.k);
    save();
    el.parentElement.querySelectorAll('.ob-sw').forEach((b) => b.classList.toggle('active', b === el));
    haptic(10);
  },
};
