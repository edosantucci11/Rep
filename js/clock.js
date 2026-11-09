// Esercizi a tempo dentro la scheda:
//  - 'hold'  A tempo (tenuta): cronometro, tieni finché cedi (plank, wall sit, dead hang…). La serie salva i secondi.
//  - 'amrap' Max ripetizioni in un tempo fisso: conto alla rovescia di `dur` secondi, poi si scrivono le ripetizioni.
//  - 'int'   Intervalli (Tabata/EMOM): `sets` giri di `work` secondi di lavoro e `pause` di pausa; i giri si spuntano da soli.
// Il tempo che scorre vive in state.active.clock (con l'ora di partenza), così sopravvive a ricarica, schermo bloccato,
// Live Activity e orologio: { i, j, kind: 'up'|'down'|'int', start, dur?, work?, pause?, rounds?, from? }
import { state, save } from './store.js';
import { t } from './i18n.js';
import { fmtClock } from './utils.js';
import { getExercise } from './exercises.js';
import { startRest } from './timer.js';

export const MODES = {
  reps: { label: t('Ripetizioni') },
  hold: { label: t('A tempo') },
  amrap: { label: t('Max rip in tempo') },
  int: { label: t('Intervalli') },
};

export const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240, 300, 420, 600];

/** "1:05", "65", "1.05" → 65 secondi (0 se vuoto o non valido) */
export function parseSecs(v) {
  if (v == null) return 0;
  const s = String(v).trim().replace(',', '.');
  if (!s) return 0;
  const m = /^(\d+)[:.](\d{1,2})$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s);
  return n > 0 ? Math.round(n) : 0;
}

export const fmtSecs = (s) => (s > 0 ? fmtClock(s) : '');

/** Esercizi del catalogo che di solito si fanno a tempo: si propongono già come "A tempo" */
const TIMED = /plank|hollow|l-sit|wall-sit|isometric|dead-hang|handstand-walk|wall-walk|farmers|sandbag-carry|carry/;
export const defaultMode = (exId) => (TIMED.test(exId) || /\(secondi\)|isometric/i.test(getExercise(exId).name) ? 'hold' : 'reps');

/** Stato del cronometro adesso: secondi passati/rimasti, fase e giro degli intervalli */
export function clockNow(c, now = Date.now()) {
  if (!c) return null;
  const el = Math.max(0, (now - c.start) / 1000);
  if (c.kind === 'up') return { elapsed: el, show: el, phase: 'work', done: false };
  if (c.kind === 'down') {
    const left = c.dur - el;
    return { elapsed: el, show: Math.max(0, left), phase: 'work', done: left <= 0 };
  }
  // intervalli: lavoro, pausa, lavoro… (niente pausa dopo l'ultimo giro)
  const cycle = c.work + c.pause;
  const total = c.rounds * c.work + (c.rounds - 1) * c.pause;
  if (el >= total) return { elapsed: total, show: 0, phase: 'done', round: c.rounds, done: true, completed: c.rounds };
  const k = Math.floor(el / cycle);
  const inCycle = el - k * cycle;
  const working = inCycle < c.work;
  return {
    elapsed: el,
    show: working ? c.work - inCycle : cycle - inCycle,
    phase: working ? 'work' : 'pause',
    round: k + 1,
    completed: working ? k : k + 1,
    done: false,
  };
}

/** Avvia il tempo della serie j dell'esercizio i (o tutto il blocco di intervalli) */
export function startClock(i, j, now = Date.now()) {
  const a = state.active;
  const e = a?.exercises[i];
  if (!e || a.clock) return null;
  if (e.mode === 'hold') a.clock = { i, j, kind: 'up', start: now };
  else if (e.mode === 'amrap') a.clock = { i, j, kind: 'down', start: now, dur: e.dur || 60 };
  else if (e.mode === 'int') {
    // si riparte dal primo giro non fatto
    const from = Math.max(0, e.sets.findIndex((s) => !s.done));
    a.clock = { i, j: from, kind: 'int', start: now, work: e.work || 20, pause: e.pause ?? 10, rounds: e.sets.length - from, from };
  } else return null;
  a.cur = i;
  a.rest = null; // il recupero in corso non serve più
  save();
  window.dispatchEvent(new CustomEvent('rep:clock'));
  return a.clock;
}

/**
 * Ferma il tempo (a mano o perché è finito). Ritorna cosa è successo, per far partire il recupero:
 *  { kind, i, j, secs } — hold: serie fatta con i secondi tenuti; amrap: tempo finito, si aspettano le ripetizioni;
 *  int: giri completati spuntati.
 */
export function stopClock(at = Date.now()) {
  const a = state.active;
  const c = a?.clock;
  if (!c) return null;
  const e = a.exercises[c.i];
  const st = clockNow(c, at);
  a.clock = null;
  let res = { kind: c.kind, i: c.i, j: c.j, secs: 0 };
  if (e) {
    if (c.kind === 'up') {
      const s = e.sets[c.j];
      if (s) {
        s.secs = String(Math.round(st.elapsed));
        s.done = st.elapsed >= 1;
        if (String(s.kg).trim() === '') s.kg = '0';
      }
      res.secs = Math.round(st.elapsed);
    } else if (c.kind === 'down') {
      const s = e.sets[c.j];
      if (s) s.secs = String(Math.round(Math.min(c.dur, st.elapsed)));
      res.secs = Math.round(Math.min(c.dur, st.elapsed));
    } else {
      const n = st.completed ?? 0;
      for (let k = 0; k < n; k++) {
        const s = e.sets[c.from + k];
        if (s && !s.done) {
          s.done = true;
          s.secs = String(c.work);
          if (String(s.kg).trim() === '') s.kg = '0';
        }
      }
      res.secs = n;
    }
  }
  save();
  window.dispatchEvent(new CustomEvent('rep:clock'));
  return res;
}

/** Dopo lo stop: recupero per la serie a tempo fatta o per il blocco di intervalli finito (non dentro un superset) */
export function afterStop(res, at = Date.now()) {
  const e = state.active?.exercises[res?.i];
  if (!e || e.superset) return;
  if (res.kind === 'up' && e.sets[res.j]?.done) startRest(e.rest, at);
  if (res.kind === 'int' && e.sets.every((s) => s.done)) startRest(e.rest, at);
}

/** Testo breve per righe e pulsanti: "0:45", "Lavoro 0:12 · giro 3/8" */
export function clockLabel(c, now = Date.now()) {
  const st = clockNow(c, now);
  if (!st) return '';
  if (c.kind !== 'int') return fmtClock(st.show);
  return `${st.phase === 'pause' ? t('Pausa') : t('Lavoro')} ${fmtClock(st.show)} · ${t('giro {a}/{b}', { a: Math.min(st.round, c.rounds) + (c.from || 0), b: (c.from || 0) + c.rounds })}`;
}
