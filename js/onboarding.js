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

// app iPhone: anche le pagine su Apple Watch, Live Activity e iCloud (la web app non le ha)
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const kick = (n, label) => `<div class="ob-kicker">${String(n).padStart(2, '0')} · ${label}</div>`;

const ALL_SLIDES = [
  {
    key: 'hello',
    html: () => `
      <div class="ob-hero">
        <div class="ob-logo"><span>R</span><span>E</span><span>P</span></div>
        <h1 class="ob-h">${t('Il tuo diario')}<br>${t('di allenamento')}</h1>
        <p class="ob-p">${t('Schede, pesi, record e progressi.')}<br>${NATIVE ? t('Su iPhone e Apple Watch, anche offline.') : t('Tutto sul tuo telefono, anche offline.')}</p>
        <div class="ob-hint">${t('Tocca per continuare')} ${I.chevron}</div>
      </div>`,
  },
  {
    key: 'live',
    html: (n) => `
      ${kick(n, t('Allenamento'))}
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
        <div class="ob-tags">
          <span>${I.clock} ${t('A tempo')}</span><span>${t('Intervalli')}</span><span>${t('DX / SX')}</span><span>${I.link} ${t('Superset')}</span><span>RPE</span>
        </div>
      </div>
      <p class="ob-p">${t('I pesi della volta scorsa sono già pronti e il recupero parte da solo. Esercizi a tempo, intervalli, lato destro e sinistro, superset e RPE: tutto dentro la scheda.')}</p>`,
  },
  {
    key: 'wrist',
    native: true,
    html: (n) => `
      ${kick(n, t('Ovunque'))}
      <h2 class="ob-h">${t('Dal polso e dalla schermata di blocco')}</h2>
      <div class="ob-lock">
        <div class="ob-lock-head"><span>${I.weight} PUSH</span><span>7/18 ${t('SERIE')}</span></div>
        <div class="ob-lock-row">
          <div><div class="label">${t('Recupero')}</div><div class="ob-lock-t">1:12</div></div>
          <span class="ob-pill ghost">+15 S</span><span class="ob-pill">${t('SALTA')}</span>
        </div>
      </div>
      <div class="ob-devices">
        <div class="ob-watch"><div class="ob-watch-face"><span class="label">${t('Panca piana')}</span><b>82,5</b><span class="ob-watch-btn">${t('FATTO')}</span></div></div>
        <div class="ob-widget"><div class="ob-widget-ring"><b>2/3</b></div><span class="label">${t('PROSSIMA')}</span><b>PULL</b></div>
      </div>
      <p class="ob-p">${t('Live Activity per segnare le serie senza sbloccare il telefono, app per Apple Watch con battito e calorie, widget sulla Home e complicazioni sul quadrante.')}</p>`,
  },
  {
    key: 'body',
    html: (n) => `
      ${kick(n, t('Esercizi'))}
      <h2 class="ob-h">${t('960+ esercizi animati')}</h2>
      <div class="ob-3d"><div class="mq" id="ob-mq"></div></div>
      <p class="ob-p">${t('Palestra e CrossFit: per ogni esercizio un manichino che esegue il movimento, i muscoli coinvolti in evidenza e la spiegazione passo passo.')}</p>`,
    enter: (el) => {
      const box = el.querySelector('#ob-mq');
      mount(box, specFor(getExercise('b-squat')));
    },
  },
  {
    key: 'progress',
    html: (n) => `
      ${kick(n, t('Progressi'))}
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
    key: 'more',
    html: (n) => `
      ${kick(n, t('E poi'))}
      <h2 class="ob-h">${t('Tutto il resto')}</h2>
      <div class="ob-more">
        <div class="ob-more-card">
          <span class="ob-more-ic">${I.user}</span>
          <div><b>${t('Corpo')}</b><span>${t('Peso, misure e % di grasso con i grafici')}</span></div>
          <em>78,5 <small>kg</small></em>
        </div>
        ${NATIVE ? `
        <div class="ob-more-card">
          <span class="ob-more-ic heart">${I.heart}</span>
          <div><b>${t('Salute')}</b><span>${t('Battito e calorie salvati nell\'app Salute')}</span></div>
          <em>132 <small>bpm</small></em>
        </div>
        <div class="ob-more-card">
          <span class="ob-more-ic">${I.play}</span>
          <div><b>Siri</b><span>${t('«Inizia Push con Rep»')}</span></div>
        </div>` : ''}
        <div class="ob-more-card">
          <span class="ob-more-ic">${I.weight}</span>
          <div><b>${t('Strumenti')}</b><span>${t('Dischi da caricare, riscaldamento automatico, settimana di scarico, timer a intervalli')}</span></div>
        </div>
      </div>
      <p class="ob-p">${NATIVE
        ? t('Il tuo peso serve anche per le zavorre: trazioni e dip contano il carico vero. E durante l\'allenamento controlli la musica senza uscire da Rep.')
        : t('Il tuo peso serve anche per le zavorre: trazioni e dip contano il carico vero.')}</p>`,
  },
  {
    key: 'friends',
    html: (n) => `
      ${kick(n, t('Amici'))}
      <h2 class="ob-h">${t('Allenati con gli amici')}</h2>
      <div class="ob-mock card ob-share">
        <div class="label">${t('Giulia ti ha mandato una scheda')}</div>
        <b class="ob-share-t">PUSH DAY</b>
        <div class="ob-share-ex"><span>${t('Panca piana')} · 4×6-8</span><span>${t('Military press')} · 3×8-10</span><span>Dips · 3×10</span></div>
        <div class="ob-share-btns"><span class="ob-pill">${I.play} ${t('Allenati con questo')}</span><span class="ob-pill ghost">${t('Salva come scheda')}</span></div>
      </div>
      <p class="ob-p">${t('Manda schede e allenamenti con un link o un\'immagine dei risultati: chi li apre li salva o li fa con un tocco.')}</p>`,
  },
  {
    key: 'you',
    last: true,
    html: (n) => `
      ${kick(n, t('Su misura'))}
      <h2 class="ob-h">${t('Scegli il tuo stile')}</h2>
      <div class="label ob-lab">${t('Colore')}</div>
      <div class="ob-themes">${Object.entries(THEMES).map(([k, t], i) => `
        <button class="ob-sw ${k === (state.settings.theme || 'volt') ? 'active' : ''}" style="--sw:${t.accent};--i:${i}" data-action="ob-theme" data-k="${k}" aria-label="${t.name}"></button>`).join('')}</div>
      <p class="ob-p">${NATIVE
        ? t('Con Accedi con Apple i tuoi dati si salvano nel tuo iCloud privato e li ritrovi su ogni dispositivo. Rep parla 6 lingue e puoi cambiare tutto da')
        : t('I dati restano solo sul tuo telefono. Rep parla 6 lingue e puoi cambiare tutto da')} <b>${t('Altro')}</b>.</p>
      <button class="btn btn-primary btn-block ob-start" data-action="ob-done">${t('Inizia ad allenarti')}</button>`,
  },
];
const SLIDES = ALL_SLIDES.filter((x) => NATIVE || !x.native);

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
  el.innerHTML = SLIDES[cur].html(cur); // numero della pagina (01, 02…) dopo quella iniziale
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
