import { state, setSaveErrorHandler } from './store.js';
import { actions, inputs, changes, setRenderer, toast, closeModal, isModalOpen, getPath, onRoute, flushAfterNav, go, embedded, register } from './ui.js';
import { shouldOnboard, startOnboarding, ONBOARD_ACTIONS } from './onboarding.js';
register(ONBOARD_ACTIONS);
import { seedDemoIfEmpty } from './demo.js';
import './native.js'; // funzioni dell'app iPhone (inattive nel browser)
import { startCloud } from './cloud.js';
import { importPage } from './share.js';
import { startTicker, tick, unlockAudio } from './timer.js';
import { esc, fmtClock } from './utils.js';
import { enter, reducedMotion, haptic } from './motion.js';
import { observeThumbs } from './thumbs.js';
import { applyTheme } from './theme.js';
import { applyAppIcon } from './logo.js';
import * as home from './views/home.js';
import * as routine from './views/routine.js';
import * as workout from './views/workout.js';
import * as historyView from './views/history.js';
import * as stats from './views/stats.js';
import * as body from './views/body.js';
import * as tools from './views/tools.js';
import * as help from './views/help.js';
import { t, tn } from './i18n.js';

const routes = [
  [/^\/?$/, 'home', () => home.render()],
  [/^\/routine\/([\w-]+)$/, 'home', (id) => routine.render(id)],
  [/^\/workout$/, 'workout', () => workout.render()],
  [/^\/history$/, 'history', () => historyView.render()],
  [/^\/history\/([\w-]+)$/, 'history', (id) => historyView.renderDetail(id)],
  [/^\/stats$/, 'stats', () => stats.render()],
  [/^\/stats\/ex\/([\w-]+)$/, 'stats', (id) => stats.renderExercise(id)],
  [/^\/body$/, 'body', () => body.render()],
  [/^\/tools$/, 'tools', () => tools.render()],
  [/^\/tools\/guida$/, 'tools', () => help.render()],
  [/^\/import\/([\w-]+)$/, 'home', (code) => importPage(code)],
];

const app = document.getElementById('app');
let currentPath = null;
const TAB_ORDER = ['home', 'history', 'stats', 'body', 'tools'];
let lastTab = null;
const depth = (p) => p.split('/').filter(Boolean).length;

/** Direzione della transizione: a destra se si va "avanti" (tab successiva o pagina più profonda) */
function slideDirection(tab, path) {
  if (lastTab === null || currentPath === null) return null;
  if (tab !== lastTab) return TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(lastTab) ? 'right' : 'left';
  return depth(path) >= depth(currentPath) ? 'right' : 'left';
}

function render(keepScroll = false) {
  const path = getPath();
  const y = window.scrollY;
  let tab = 'home';
  let html = null;
  for (const [re, t, fn] of routes) {
    const m = path.match(re);
    if (m) {
      tab = t;
      html = fn(...m.slice(1));
      break;
    }
  }
  if (html === null) {
    go('#/');
    return;
  }
  const dir = path === currentPath ? null : slideDirection(tab, path);
  app.innerHTML = html;
  if (dir && !reducedMotion()) {
    app.classList.remove('from-right', 'from-left');
    void app.offsetWidth;
    app.classList.add('from-' + dir);
  }
  if (lastTab !== null && tab !== lastTab) haptic(8);
  lastTab = tab;
  const samePage = path === currentPath;
  currentPath = path;
  document.body.dataset.page = path === '/workout' ? 'workout' : tab;
  const tabs = [...document.querySelectorAll('#tabbar a')];
  tabs.forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  renderActiveBar(path);
  updateWakeLock(path);
  window.scrollTo(0, keepScroll && samePage ? y : 0);
  observeThumbs(app);
  window.dispatchEvent(new Event('rep:rendered'));
  if (!samePage) {
    document.body.classList.remove('nav-hidden');
    if (!document.documentElement.classList.contains('splashing')) enter(app);
  }
  tick();
}

function renderActiveBar(path) {
  const bar = document.getElementById('active-bar');
  const a = state.active;
  if (!a || path === '/workout') {
    bar.hidden = true;
    document.body.classList.remove('has-active');
    return;
  }
  bar.innerHTML = `<button data-action="go" data-to="#/workout">
    <span class="pulse"></span><span class="ab-name">${esc(a.name)}</span>
    <span id="active-bar-clock">${fmtClock((Date.now() - a.start) / 1000)}</span><span class="ab-go">${t('Riprendi ›')}</span></button>`;
  if (bar.hidden) {
    bar.hidden = false;
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
  }
  document.body.classList.add('has-active');
}

/* ---------- Schermo sempre acceso ---------- */
let wakeLock = null;
async function updateWakeLock(path) {
  const want = path === '/workout' && state.active && state.settings.wakeLock && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {
    wakeLock = null;
  }
}

/* ---------- Eventi delegati ---------- */
document.addEventListener('click', (e) => {
  unlockAudio();
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el) inputs[el.dataset.input]?.(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el, e);
});
// Invio nei campi serie: passa al campo successivo
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isModalOpen()) closeModal();
  if (e.key === 'Enter' && e.target.classList?.contains('set-in')) {
    e.preventDefault();
    const all = [...document.querySelectorAll('.set-in')];
    const next = all[all.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
  }
});
// Seleziona il contenuto dei campi numerici al focus
document.addEventListener('focusin', (e) => {
  if (e.target.classList?.contains('set-in')) setTimeout(() => e.target.select?.(), 0);
});

onRoute(() => {
  if (isModalOpen()) closeModal();
  render(false);
  flushAfterNav();
});
document.addEventListener('visibilitychange', () => updateWakeLock(currentPath));

/* ---------- Schermata di apertura ---------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function runSplash() {
  const root = document.documentElement;
  const splash = document.getElementById('splash');
  if (!splash) {
    root.classList.remove('splashing');
    return;
  }
  const reduce = reducedMotion();
  const fonts = document.fonts?.ready ?? Promise.resolve();
  // le lettere partono quando il carattere è pronto (vedi index.html): l'uscita aspetta che abbiano finito
  Promise.race([fonts, wait(700)]).then(() => wait(reduce ? 150 : 1150)).then(() => {
    root.classList.add('splash-exit');
    root.classList.remove('splashing');
    enter(app);
    if (shouldOnboard()) setTimeout(startOnboarding, reduce ? 300 : 1100);
    setTimeout(() => {
      splash.remove();
      root.classList.remove('splash-exit');
    }, reduce ? 400 : 1900);
  });
}

/* ---------- Ripple al tocco ---------- */
const RIPPLE = '.btn, .chip, .list-item, .sheet-item, .picker-item, .play-btn, .icon-btn, .swatch, .rest-btn, .segmented button, #tabbar a';
document.addEventListener('pointerdown', (e) => {
  if (reducedMotion()) return;
  const el = e.target.closest(RIPPLE);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  const d = Math.max(r.width, r.height) * 2.2;
  const sp = document.createElement('span');
  sp.className = 'ripple';
  sp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  el.appendChild(sp);
  setTimeout(() => sp.remove(), 700);
});

/* ---------- Barra che si nasconde scorrendo in giù ---------- */
let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (y > lastY + 8 && y > 140) document.body.classList.add('nav-hidden');
  else if (y < lastY - 8 || y < 60) document.body.classList.remove('nav-hidden');
  lastY = y;
}, { passive: true });

// testi fissi della pagina (barra in basso) nella lingua dell'app
document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.textContent.trim())));
document.title = t('Rep – Diario palestra');
setSaveErrorHandler(() => toast(t('Errore nel salvataggio dei dati: memoria piena?')));
if (embedded) seedDemoIfEmpty();
window.addEventListener('themechange', (e) => applyAppIcon(e.detail, { embedded }));
applyTheme(state.settings.theme);
setRenderer(render);
render();
runSplash();
startTicker();
setTimeout(startCloud, 1600); // account Apple e iCloud (solo app iPhone)

if (!embedded && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

// blocca lo zoom: gesti di pizzico (iOS ignora user-scalable=no) e ctrl+rotellina
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
// il doppio tocco è già disattivato da touch-action: manipulation (senza perdere i tocchi rapidi sui pulsanti)
