// Ponte con l'app nativa iPhone (Capacitor): battiti da Salute, notifiche del recupero, Live Activity, Apple Watch.
// Nel browser non fa nulla: tutte le funzioni controllano `isNative` e tornano subito.
import { state, save, exportState } from './store.js';
import { rerender, getPath, toast, go } from './ui.js';
import { startRest, stopRest, adjustRest } from './timer.js';
import { getExercise } from './exercises.js';
import { startFromRoutine, startWorkout, finishActive, workoutVolume, workoutSetCount, weekStreak, suggestSet, PR_LABELS } from './logic.js';
import { startOfWeek } from './utils.js';
import { t, tn, lang } from './i18n.js';

const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);

const cap = window.Capacitor;
export const isNative = !!cap?.isNativePlatform?.();
const plugin = (name) => (isNative ? cap.Plugins?.[name] : null);
const Health = () => plugin('RepHealth');
const Watch = () => plugin('RepWatch');
const Notify = () => plugin('RepNotify');
const Music = () => plugin('RepMusic');
const Live = () => plugin('RepLive');
const Backup = () => plugin('RepBackup');
const Icon = () => plugin('RepIcon');

/* ---------------- Salute (HealthKit) ---------------- */

/** Chiede il permesso di leggere i battiti (la prima volta iOS mostra la schermata di Salute) */
export async function connectHealth() {
  const h = Health();
  if (!h) return false;
  try {
    const r = await h.requestAuthorization();
    return !!r?.granted;
  } catch (e) {
    return false;
  }
}

/** Stato del permesso: { available, asked, saving } (null nel browser) */
export async function healthStatus() {
  const h = Health();
  if (!h) return null;
  try {
    return await h.status();
  } catch (e) {
    return null;
  }
}

/**
 * Collegamento automatico: al primo avvio, finita la presentazione (e l'eventuale accesso),
 * iOS mostra una volta sola la schermata di Salute. Le volte dopo non chiede più niente.
 */
async function autoConnectHealth(tries = 0) {
  const st = await healthStatus();
  if (!st?.available || st.asked) return;
  // aspetta che non ci sia niente davanti (presentazione, pagina d'accesso)
  if (!state.settings.onboarded || document.getElementById('onboard') || document.getElementById('login')) {
    if (tries < 40) setTimeout(() => autoConnectHealth(tries + 1), 3000);
    return;
  }
  await connectHealth();
  // subito dopo, il permesso per l'avviso di fine recupero (iOS lo chiede una volta sola)
  try { await Notify()?.requestPermission(); } catch (e) { /* niente */ }
  if (getPath() === '/tools') rerender();
}

/** Battiti tra due istanti: media, massimo, minimo e una curva da circa un punto al minuto */
export async function heartRateBetween(start, end) {
  const h = Health();
  if (!h) return null;
  try {
    const { samples = [] } = await h.heartRate({ start, end });
    if (!samples.length) return null;
    const bpm = samples.map((s) => s.bpm);
    const step = Math.max(1, Math.round(samples.length / Math.max(1, (end - start) / 60000)));
    return {
      avg: Math.round(bpm.reduce((a, b) => a + b, 0) / bpm.length),
      max: Math.round(Math.max(...bpm)),
      min: Math.round(Math.min(...bpm)),
      curve: samples.filter((_, i) => i % step === 0).map((s) => [Math.round((s.t - start) / 1000), Math.round(s.bpm)]),
    };
  } catch (e) {
    return null;
  }
}

/** Aggiunge i battiti a un allenamento salvato (se Salute ne ha) */
export async function attachHeartRate(workoutId, { quiet = false } = {}) {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return false;
  const hr = await heartRateBetween(w.start, w.end);
  if (!hr) {
    if (!quiet) toast(t('Nessun battito in Salute per questo allenamento'));
    return false;
  }
  w.hr = hr;
  save();
  window.dispatchEvent(new CustomEvent('rep:hr', { detail: { id: workoutId } })); // riepilogo aperto
  if (getPath() === `/history/${workoutId}`) rerender();
  return true;
}

/* ---------------- Backup automatico (app File › Sul mio iPhone › Rep) ---------------- */

/** Salva il backup del giorno; si chiama a fine allenamento e all'apertura (al massimo uno al giorno) */
export async function autoBackup() {
  const b = Backup();
  if (!b) return false;
  try {
    const r = await b.save({ json: exportState() });
    state.lastAutoBackup = r.date;
    save();
    return true;
  } catch (e) {
    return false;
  }
}

/** Ultimo backup automatico: { json, date, count } oppure null */
export async function latestAutoBackup() {
  const b = Backup();
  if (!b) return null;
  try {
    const r = await b.latest();
    return r?.json ? r : null;
  } catch (e) {
    return null;
  }
}

/* ---------------- Notifiche del recupero ---------------- */
// Con l'app in background il timer di JavaScript si ferma: una notifica locale avvisa comunque
// (e compare anche sull'Apple Watch).

window.addEventListener('rep:rest', (e) => {
  const n = Notify();
  if (!n) return;
  const { endAt } = e.detail || {};
  if (endAt && endAt > Date.now() + 1500) {
    const a = state.active;
    const next = a ? nextSetLabel(a) : '';
    n.scheduleRest({ at: endAt, title: t('Recupero finito'), body: next ? `${t('Tocca a te:')} ${next}` : t('Pronto per la prossima serie') }).catch(() => {});
  } else n.cancelRest().catch(() => {});
});

function nextSetLabel(a) {
  for (const e of a.exercises) {
    const j = e.sets.findIndex((s) => !s.done);
    if (j >= 0) return t('{ex}, serie {n}', { ex: tn(getExercise(e.exId).name), n: j + 1 });
  }
  return '';
}

/* ---------------- Live Activity (schermata di blocco e Dynamic Island) ---------------- */
// Allenamento in corso fuori dall'app: serie da fare con peso e ripetizioni, recupero con conto alla rovescia.
// Riceve lo stesso stato dell'orologio; i suoi pulsanti (Fatto, − / +, +15 s, Salta) tornano qui come
// azioni dell'orologio. I timer li fa scorrere iOS: qui si manda solo ciò che cambia.

let lastLive = '';
function syncLive() {
  const l = Live();
  if (!l) return;
  const active = activeState();
  const accent = accentColor();
  const json = active ? JSON.stringify(active) : '';
  if (json + accent === lastLive) return;
  lastLive = json + accent;
  (active ? l.update({ state: json, accent }) : l.end({ accent })).catch(() => {});
}
window.addEventListener('rep:saved', syncLive);

// schede per Siri e Comandi rapidi ("Inizia Giorno 1 con Rep")
let lastRoutines = '';
function syncRoutines() {
  const l = Live();
  if (!l) return;
  const list = state.routines.map((r) => ({ id: r.id, name: r.name }));
  const json = JSON.stringify(list);
  if (json === lastRoutines) return;
  lastRoutines = json;
  l.routines({ list }).catch(() => {});
}
window.addEventListener('rep:saved', syncRoutines);

// widget (schermata Home e di blocco): settimana, settimane di fila, prossima scheda, ultimo allenamento
let lastWidget = '';
function syncWidget() {
  const l = Live();
  if (!l) return;
  const weekFrom = startOfWeek(Date.now()).getTime();
  const last = state.workouts[0];
  const rs = state.routines;
  const idx = last?.routineId ? rs.findIndex((r) => r.id === last.routineId) : -1;
  const next = rs.length ? rs[(idx + 1) % rs.length].name : '';
  const days = last ? Math.round((startOfDay(Date.now()) - startOfDay(last.start)) / 864e5) : 0;
  const data = {
    done: state.workouts.filter((w) => w.start >= weekFrom).length,
    goal: state.settings.weeklyGoal || 3,
    streak: weekStreak(),
    next,
    last: last?.name || '',
    lastAgo: !last ? '' : days === 0 ? t('oggi') : days === 1 ? t('ieri') : t('{n} giorni fa', { n: days }),
    accent: accentColor(),
    lang,
  };
  const json = JSON.stringify(data);
  if (json === lastWidget) return;
  lastWidget = json;
  l.widget({ json }).catch(() => {});
}
window.addEventListener('rep:saved', syncWidget);
window.addEventListener('themechange', () => setTimeout(syncWidget, 50));
// icona dell'app nel colore del tema (iOS avvisa con un messaggio a ogni cambio)
window.addEventListener('themechange', (e) => Icon()?.set({ theme: e.detail }).catch(() => {}));
window.addEventListener('rep:rest', syncLive);
window.addEventListener('themechange', () => setTimeout(syncLive, 50));

/** Azioni fatte dalla Live Activity (anche con l'app in background: restano in coda fino a qui) */
async function takeLiveActions() {
  const l = Live();
  if (!l) return;
  try {
    const { actions = [] } = await l.takePending();
    actions.forEach(onWatchAction);
  } catch (e) { /* nessuna azione */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) takeLiveActions(); });

/* ---------------- Apple Watch ---------------- */

const accentColor = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D4FF00';

/** Stato compatto per l'orologio */
// ultimo allenamento in corso mandato all'orologio: quando finisce gli si dice se è stato salvato o annullato
let lastActiveId = null;
function watchState() {
  const active = activeState();
  let ended = null;
  if (active) lastActiveId = active.id;
  else if (lastActiveId) ended = { id: lastActiveId, saved: state.workouts.some((w) => w.id === lastActiveId) };
  return { accent: accentColor(), summary: watchSummary(), active, ended, lang };
}

/** Allenamento in corso in forma compatta (orologio e Live Activity) */
function activeState() {
  const a = state.active;
  if (!a) return null;
  return {
    id: a.id,
    name: a.name || t('Allenamento'),
    start: a.start,
    restEndAt: a.rest?.endAt || null,
    restTotal: a.rest?.total || 0,
    kgStep: Number(state.settings.increment) || 2.5, // − / + della Live Activity
    lang, // lingua dell'app per Live Activity e orologio
    exercises: a.exercises.map((e) => {
      const ex = getExercise(e.exId);
      const sug = e.sets.map((_, j) => suggestSet(e.exId, e.sets, j, e.target)); // valori proposti (ultima volta, progressione)
      return {
        name: ex.name,
        muscle: ex.muscle,
        rest: e.rest || state.settings.defaultRest || 90,
        target: String(e.target || ''),
        superset: !!e.superset,
        sets: e.sets.map((s, j) => ({
          kg: String(s.kg ?? ''), reps: String(s.reps ?? ''), done: !!s.done, type: s.type || 'N',
          pkg: sug[j] ? String(sug[j].kg) : '', preps: sug[j] ? String(sug[j].reps) : '',
        })),
      };
    }),
  };
}

/** Dati da consultare sull'orologio quando non c'è un allenamento: schede, settimana, ultimi allenamenti, record */
function watchSummary() {
  const weekFrom = startOfWeek(Date.now()).getTime();
  const week = state.workouts.filter((w) => w.start >= weekFrom);
  const prs = [];
  for (const w of state.workouts) {
    for (const p of w.prs || []) {
      if (p.kind !== 'kg' && p.kind !== 'e1rm') continue;
      prs.push({ ex: getExercise(p.exId).name, label: PR_LABELS[p.kind], value: Math.round(p.value * 10) / 10, date: w.start });
      if (prs.length >= 6) break;
    }
    if (prs.length >= 6) break;
  }
  return {
    routines: state.routines.map((r) => ({ id: r.id, name: r.name, count: r.exercises.length })),
    week: { done: week.length, goal: state.settings.weeklyGoal || 3, volume: Math.round(week.reduce((sum, w) => sum + workoutVolume(w), 0)) },
    streak: weekStreak(),
    recent: state.workouts.slice(0, 6).map((w) => ({
      name: w.name, date: w.start, minutes: Math.round((w.end - w.start) / 60000),
      volume: Math.round(workoutVolume(w)), sets: workoutSetCount(w), hr: w.hr?.avg || 0,
    })),
    prs,
  };
}

let lastSent = '';
function syncWatch(force = false) {
  const w = Watch();
  if (!w) return;
  const json = JSON.stringify(watchState());
  if (json === lastSent && !force) return;
  lastSent = json;
  w.sendState({ state: json }).catch(() => {});
}
// ogni salvataggio (già raggruppato da store.js) aggiorna l'orologio se qualcosa è cambiato
window.addEventListener('rep:saved', syncWatch);
window.addEventListener('themechange', () => setTimeout(syncWatch, 50));

/** Azioni arrivate dall'orologio */
function onWatchAction(msg) {
  if (!msg) return;
  // avvio e chiusura dell'allenamento dall'orologio
  if (msg.action === 'start') {
    if (!state.active) {
      const r = state.routines.find((x) => x.id === msg.routineId);
      if (r) startFromRoutine(r);
      else startWorkout({ name: t('Allenamento libero') });
      go('#/workout');
    }
    syncWatch(true);
    return;
  }
  if (msg.action === 'finish' || msg.action === 'discard') {
    const a = state.active;
    if (!a) return syncWatch(true);
    const done = a.exercises.some((e) => e.sets.some((s) => s.done));
    stopRest();
    if (msg.action === 'finish' && done) {
      const w = finishActive();
      go(`#/history/${w.id}`);
      toast(t('Allenamento salvato dall\'orologio'));
    } else {
      state.active = null;
      save();
      go('#/');
      toast(t('Allenamento annullato dall\'orologio'));
    }
    return;
  }
  if (msg.action === 'refresh') return syncWatch(true);
  const a = state.active;
  if (!a) return;
  if (msg.action === 'done') {
    const e = a.exercises[msg.i];
    const s = e?.sets[msg.j];
    if (!s) return;
    if (msg.kg !== undefined) s.kg = String(msg.kg);
    if (msg.reps !== undefined) s.reps = String(msg.reps);
    s.done = true;
    save();
    // dalla Live Activity l'azione può arrivare dopo (app in background): il recupero conta da `at`
    if (!e.superset) startRest(e.rest, msg.at || Date.now());
  } else if (msg.action === 'undo') {
    const s = a.exercises[msg.i]?.sets[msg.j];
    if (!s) return;
    s.done = false;
    save();
  } else if (msg.action === 'restAdd') adjustRest(Number(msg.delta) || 15);
  else if (msg.action === 'restSkip') stopRest();
  else if (msg.action === 'hr') {
    liveHr = Number(msg.bpm) || null;
    paintLiveHr();
    return;
  }
  if (getPath() === '/workout') rerender();
}

/* battito in diretta dall'orologio, mostrato nell'intestazione dell'allenamento */
let liveHr = null;
export const getLiveHr = () => liveHr;
function paintLiveHr() {
  const el = document.getElementById('live-hr');
  if (!el) return;
  el.hidden = !liveHr;
  if (liveHr) el.querySelector('b').textContent = liveHr;
}
window.addEventListener('rep:rendered', paintLiveHr);

/* ---------------- Musica (iPhone) ---------------- */
// Controlla il lettore di sistema (app Musica). Per Spotify e altre app: comandi dal Centro di Controllo o dall'orologio.

let music = null;
export const getMusic = () => music;
export async function musicCommand(cmd) {
  const m = Music();
  if (!m) return;
  try {
    music = await m[cmd]();
  } catch (e) { /* nessuna musica */ }
  paintMusic();
}
async function refreshMusic() {
  const m = Music();
  if (!m || !document.getElementById('music-bar')) return;
  try { music = await m.getState(); } catch (e) { music = null; }
  paintMusic();
}
function paintMusic() {
  const bar = document.getElementById('music-bar');
  if (!bar) return;
  const has = music && music.title;
  bar.classList.toggle('idle', !has); // non 'empty': è lo stile dei messaggi vuoti (in colonna)
  bar.querySelector('.mb-title').textContent = has ? music.title : t('Musica');
  bar.querySelector('.mb-artist').textContent = has ? (music.artist || '') : (music?.authorized === false ? "Consenti l'accesso a Musica nelle Impostazioni" : t('Tocca ▶︎ per riprendere Apple Music'));
  const art = bar.querySelector('.mb-art');
  art.style.backgroundImage = has && music.artwork ? `url(${music.artwork})` : '';
  bar.querySelector('[data-cmd=toggle]').innerHTML = music?.playing ? '&#10073;&#10073;' : '&#9654;&#xFE0E;';
}
// la barra appena disegnata mostra subito l'ultimo brano noto, poi si aggiorna
window.addEventListener('rep:rendered', () => { paintMusic(); refreshMusic(); });
document.addEventListener('click', (e) => {
  const b = e.target.closest('#music-bar [data-cmd]');
  if (b) musicCommand(b.dataset.cmd);
});

/* ---------------- Avvio ---------------- */

if (isNative) {
  document.documentElement.classList.add('native');
  Watch()?.addListener('action', onWatchAction);
  Music()?.addListener('change', (st) => { music = st; paintMusic(); });
  Live()?.addListener('pending', takeLiveActions);
  // battito in diretta da Salute: Apple Watch o bracciali collegati a Salute
  Live()?.addListener('heartRate', ({ bpm }) => {
    liveHr = Number(bpm) || null;
    paintLiveHr();
  });
  // a fine allenamento: battiti da Salute (dall'orologio arrivano con qualche secondo di ritardo)
  window.addEventListener('rep:finished', (e) => {
    const id = e.detail?.id;
    if (!id) return;
    // allenamento di Salute sull'iPhone: salvato (se non c'è l'Apple Watch)
    Live()?.finishHealth({ save: true }).catch(() => {});
    setTimeout(() => attachHeartRate(id, { quiet: true }).finally(autoBackup), 4000);
    setTimeout(() => { const w = state.workouts.find((x) => x.id === id); if (w && !w.hr) attachHeartRate(id, { quiet: true }); }, 60000);
  });
  setTimeout(autoConnectHealth, 2500);
  setTimeout(syncWatch, 1000);
  setTimeout(() => { takeLiveActions(); syncLive(); syncRoutines(); syncWidget(); }, 1000); // azioni rimaste in coda, poi Live Activity aggiornata o chiusa
  // backup del giorno se non c'è ancora
  if (new Date(state.lastAutoBackup || 0).toDateString() !== new Date().toDateString()) setTimeout(autoBackup, 3000);
}

/** Stato dell'orologio per le impostazioni */
export async function watchStatus() {
  const w = Watch();
  if (!w) return null;
  try {
    return await w.status();
  } catch (e) {
    return null;
  }
}
