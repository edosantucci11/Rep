import { state, save } from './store.js';
import { register } from './ui.js';
import { fmtClock, fmtTime } from './utils.js';
import { t, tn } from './i18n.js';

let audioCtx = null;
let lastRemaining = null;

/** Sblocca l'audio al primo tocco (richiesto da iOS) */
export function unlockAudio() {
  if (audioCtx) return;
  try {
    // i bip si mescolano alla musica invece di interromperla (Safari/iOS 16.4+)
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    /* nessun audio */
  }
}

export function beep() {
  if (!state.settings.sound || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [0, 0.25, 0.5].forEach((d, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.2);
    });
  } catch (e) {
    /* ignora */
  }
}

export function vibrate(p) {
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(p);
}

/** Recupero di `seconds` secondi a partire da `from` (di solito adesso) */
export function startRest(seconds, from = Date.now()) {
  if (!state.active || !(seconds > 0) || from + seconds * 1000 <= Date.now()) return;
  state.active.rest = { endAt: from + seconds * 1000, total: seconds };
  save();
  lastRemaining = null;
  tick();
  window.dispatchEvent(new CustomEvent('rep:rest', { detail: { endAt: state.active?.rest?.endAt || null } }));
}

export function stopRest() {
  if (state.active) {
    state.active.rest = null;
    save();
  }
  tick();
  window.dispatchEvent(new CustomEvent('rep:rest', { detail: { endAt: state.active?.rest?.endAt || null } }));
}

export function adjustRest(delta) {
  const r = state.active?.rest;
  if (!r) return;
  r.endAt += delta * 1000;
  r.total = Math.max(1, r.total + delta);
  if (r.endAt <= Date.now()) return stopRest();
  save();
  tick();
  window.dispatchEvent(new CustomEvent('rep:rest', { detail: { endAt: state.active?.rest?.endAt || null } }));
}

export function tick() {
  const banner = document.getElementById('rest-banner');
  const a = state.active;
  const elapsed = document.getElementById('elapsed');
  if (elapsed && a) elapsed.textContent = fmtClock((Date.now() - a.start) / 1000);
  const barClock = document.getElementById('active-bar-clock');
  if (barClock && a) barClock.textContent = fmtClock((Date.now() - a.start) / 1000);

  const hero = document.getElementById('hero-clock');
  if (hero) {
    const now = fmtTime(Date.now()); // 4 volte al secondo: formattatore riusato
    if (hero.textContent !== now) {
      hero.textContent = now;
      hero.classList.remove('flip');
      void hero.offsetWidth;
      hero.classList.add('flip');
    }
  }

  const r = a?.rest;
  if (!r) {
    if (!banner.hidden) {
      banner.hidden = true;
      document.body.classList.remove('has-rest', 'rest-full');
    }
    return;
  }
  const remaining = Math.ceil((r.endAt - Date.now()) / 1000);
  if (remaining <= 0) {
    a.rest = null;
    save();
    banner.hidden = true;
    document.body.classList.remove('has-rest', 'rest-full');
    // avvisa solo se il timer è scaduto da poco (non dopo ore in background)
    if (remaining > -30) {
      beep();
      vibrate([300, 150, 300, 150, 300]);
      window.dispatchEvent(new Event('rep:rest-end')); // l'allenamento passa alla prossima serie
    }
    return;
  }
  if (banner.hidden || !banner.firstElementChild) {
    banner.innerHTML = `
      <div class="rest-progress"><div class="rest-progress-fill"></div></div>
      <div class="rest-row">
        <div class="rest-center" data-action="rest-expand" role="button" aria-label="${t('Espandi timer')}">
          <svg class="rest-ring" viewBox="0 0 48 48"><circle class="track" cx="24" cy="24" r="21"/><circle class="prog" cx="24" cy="24" r="21" pathLength="1"/></svg>
          <div class="rest-text"><div class="rest-label">${t('Recupero')}</div><div class="rest-time"></div></div>
        </div>
        <button class="rest-btn" data-action="rest-adj" data-d="-15">−15</button>
        <button class="rest-btn" data-action="rest-adj" data-d="15">+15</button>
        <button class="rest-btn rest-skip" data-action="rest-skip">${t('Salta')}</button>
        <div class="rest-full-hint" data-action="rest-expand">${t('Tocca il timer per ridurlo')}</div>
      </div>`;
    banner.hidden = false;
    document.body.classList.add('has-rest');
  }
  if (remaining !== lastRemaining) {
    banner.querySelector('.rest-time').textContent = fmtClock(remaining);
    const frac = Math.min(1, remaining / r.total);
    banner.querySelector('.rest-progress-fill').style.width = `${frac * 100}%`;
    banner.querySelector('.rest-ring .prog').style.strokeDashoffset = String(1 - frac);
    banner.classList.toggle('ending', remaining <= 5);
    if (remaining <= 3 && remaining > 0 && lastRemaining !== null && lastRemaining > remaining) vibrate(60);
    lastRemaining = remaining;
  }
}

export function startTicker() {
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);
}

register({
  'rest-adj': (el) => adjustRest(Number(el.dataset.d)),
  'rest-skip': () => stopRest(),
  'rest-expand': () => document.body.classList.toggle('rest-full'),
});
