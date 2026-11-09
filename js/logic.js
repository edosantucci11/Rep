import { state, save } from './store.js';
import { getExercise } from './exercises.js';
import { uid, toNum, e1rm, startOfWeek, addDays } from './utils.js';
import { t, tn } from './i18n.js';
import { parseSecs, stopClock } from './clock.js';

export const SET_TYPES = {
  N: { label: t('Normale'), short: '' },
  W: { label: t('Riscaldamento'), short: 'R' },
  D: { label: t('Dropset'), short: 'D' },
  F: { label: t('Cedimento'), short: 'C' },
};

export const PR_LABELS = {
  kg: t('Peso massimo'),
  e1rm: '1RM stimato',
  vol: t('Miglior serie (kg×rip)'),
  reps: t('Ripetizioni massime'),
  secs: t('Tempo massimo'),
};

/** Nome del record: con la zavorra il "peso massimo" è la zavorra più pesante */
export const prLabel = (p) => (p.bw && p.kind === 'kg' ? t('Zavorra massima') : PR_LABELS[p.kind]);

/** Campi del tipo di esercizio (a tempo, max rip in tempo, intervalli) da copiare tra scheda, allenamento e storico */
export const modeFields = (e) => (e?.mode && e.mode !== 'reps'
  ? { mode: e.mode, ...(e.dur ? { dur: e.dur } : {}), ...(e.work ? { work: e.work } : {}), ...(e.pause != null ? { pause: e.pause } : {}) }
  : {});

export const newSet = (type = 'N') => ({ type, kg: '', reps: '', rpe: '', done: false });

/** Serie allenanti (escluso riscaldamento) */
export const workingSets = (sets) => sets.filter((s) => s.type !== 'W');

export function setLabels(sets) {
  let n = 0;
  return sets.map((s, j) => {
    if (s.type !== 'N') return s.type === 'F' ? 'C' : SET_TYPES[s.type].short;
    // monopodalico: la serie sinistra ha lo stesso numero della destra appena prima
    if (s.side === 'L' && sets[j - 1]?.side === 'R' && sets[j - 1].type === 'N') return String(n);
    return String(++n);
  });
}

/** Lato della serie negli esercizi monopodalici: "DX" / "SX" (vuoto se a due lati) */
export const sideLabel = (s) => (s?.side === 'R' ? t('DX') : s?.side === 'L' ? t('SX') : '');

/** Esercizio monopodalico acceso/spento: ogni serie diventa una coppia DX + SX, o torna singola */
export function setUnilateral(e, on) {
  e.uni = on;
  if (on) {
    if (e.sets.some((s) => s.side)) return;
    e.sets = e.sets.flatMap((s) => [{ ...s, side: 'R' }, { ...s, side: 'L', done: false }]);
  } else {
    e.sets = e.sets.filter((s) => s.side !== 'L').map(({ side, ...s }) => s);
  }
}

/** Esecuzione più recente di un esercizio (prima di `beforeTs`) */
export function lastPerformance(exId, beforeTs = Infinity) {
  for (const w of state.workouts) {
    if (w.start >= beforeTs) continue;
    const e = w.exercises.find((x) => x.exId === exId);
    if (e) return { workout: w, exercise: e };
  }
  return null;
}

/** Settimana di scarico (Altro › Impostazioni): ogni N settimane dall'inizio del ciclo */
export function isDeloadWeek(ts = Date.now()) {
  const n = state.settings.deloadEvery || 0;
  if (!n || !state.settings.cycleStart) return false;
  const weeks = Math.round((startOfWeek(ts) - startOfWeek(state.settings.cycleStart)) / (7 * 864e5));
  return weeks >= 0 && (weeks + 1) % n === 0;
}

/** Settimana del ciclo (1…N), per mostrarla nelle impostazioni */
export function cycleWeek(ts = Date.now()) {
  const n = state.settings.deloadEvery || 0;
  if (!n || !state.settings.cycleStart) return 0;
  const weeks = Math.round((startOfWeek(ts) - startOfWeek(state.settings.cycleStart)) / (7 * 864e5));
  return (((weeks % n) + n) % n) + 1;
}

const repRange = (r) => String(r || '').split(/[-–]/).map((x) => parseInt(x, 10)).filter((x) => x > 0);

/**
 * Valori proposti per la serie j: quelli della stessa serie l'ultima volta (contando le serie dello stesso tipo),
 * +incremento se allora tutte le serie avevano raggiunto il massimo dell'intervallo di ripetizioni,
 * 60% nella settimana di scarico. { kg, reps, up, deload, prev } oppure null se l'esercizio è nuovo.
 */
export function suggestSet(exId, sets, j, target) {
  const lp = lastPerformance(exId);
  if (!lp) return null;
  const type = sets[j]?.type || 'N';
  const side = sets[j]?.side;
  // monopodalico: si confronta con lo stesso lato (se l'ultima volta era a due lati, con le serie normali)
  const k = sets.slice(0, j).filter((s) => s.type === type && (!side || s.side === side)).length;
  let same = lp.exercise.sets.filter((s) => s.type === type);
  if (side && same.some((s) => s.side)) same = same.filter((s) => s.side === side);
  const p = same[k] || (type !== 'W' ? same.at(-1) : null);
  if (!p) return null;
  let kg = Number(p.kg) || 0;
  let reps = Number(p.reps) || 0;
  let up = false;
  const [lo, hi = lo] = repRange(target);
  if (type !== 'W' && hi && kg > 0 && workingSets(lp.exercise.sets).every((s) => (s.reps || 0) >= hi)) {
    kg += state.settings.increment || 2.5;
    reps = lo;
    up = true;
  }
  const deload = type !== 'W' && kg > 0 && isDeloadWeek();
  if (deload) kg = Math.round((kg * 0.6) / 2.5) * 2.5;
  return { kg, reps, up, deload, prev: same[k] || null };
}

/** Serie di avvicinamento verso il peso di lavoro (bilanciere: vuoto, 50, 70, 85%; altrimenti 50 e 75%) */
export function warmupSets(work, barbell) {
  const bar = barbell ? state.settings.barWeight || 20 : 0;
  const steps = barbell ? [[0, 10], [0.5, 8], [0.7, 5], [0.85, 3]] : [[0.5, 10], [0.75, 5]];
  const out = [];
  for (const [pct, reps] of steps) {
    const kg = pct ? Math.max(bar, Math.round((work * pct) / 2.5) * 2.5) : bar;
    if (kg >= work || (out.length && out.at(-1).kg === kg)) continue;
    out.push({ kg, reps });
  }
  return out;
}

/* ---------- Zavorra (esercizi a corpo libero) ---------- */

/**
 * Esercizi a corpo libero (trazioni, dip, push-up…): il campo kg è la zavorra (+10 cintura, −20 assistito)
 * e il carico vero è peso corporeo + zavorra. Si può accendere/spegnere per esercizio (e.bw).
 */
export function isBW(e) {
  if (!e) return false;
  if (e.bw != null) return !!e.bw;
  if (e.mode && e.mode !== 'reps') return false;
  const ex = getExercise(e.exId);
  return ex.equipment === 'Corpo libero' && ex.muscle !== 'Cardio';
}

/** Peso corporeo (Corpo › Peso) alla data: l'ultima misura prima, altrimenti la prima dopo; 0 se non ce ne sono */
export function bodyWeightAt(ts = Date.now()) {
  const day = new Date(ts).toISOString().slice(0, 10);
  let before = null, after = null;
  for (const m of state.body || []) {
    if (!(m.peso > 0)) continue;
    if (m.date <= day) { if (!before || m.date > before.date) before = m; }
    else if (!after || m.date < after.date) after = m;
  }
  return (before || after)?.peso || 0;
}

/** Peso corporeo da aggiungere ai kg dell'esercizio (0 se non è a corpo libero) */
export const bwAdd = (e, ts = Date.now()) => (isBW(e) ? (e.bwKg ?? bodyWeightAt(ts)) : 0);

/** Record e confronti: kg = zavorra/peso usato; 1RM e volume sul carico vero (peso corporeo + zavorra) */
export function bests(sets, add = 0) {
  const ws = workingSets(sets);
  const b = { kg: 0, e1rm: 0, vol: 0, reps: 0, secs: 0, bestSet: null };
  for (const s of ws) {
    const kg = s.kg || 0;
    const load = Math.max(0, kg + add);
    const reps = s.reps || 0;
    if ((s.secs || 0) > b.secs) b.secs = s.secs;
    if (kg > b.kg) b.kg = kg;
    const one = e1rm(load, reps);
    if (one > b.e1rm) { b.e1rm = one; b.bestSet = s; }
    if (load * reps > b.vol) b.vol = load * reps;
    if (reps > b.reps) b.reps = reps;
  }
  if (!b.bestSet && ws.length) b.bestSet = ws.reduce((a, s) => ((s.reps || 0) > (a.reps || 0) ? s : a), ws[0]);
  return b;
}

/** Storico per esercizio, dal più vecchio */
export function exerciseHistory(exId) {
  const out = [];
  for (const w of state.workouts) {
    const entries = w.exercises.filter((x) => x.exId === exId);
    if (!entries.length) continue;
    const sets = entries.flatMap((e) => e.sets);
    const ws = workingSets(sets);
    if (!ws.length) continue;
    const add = bwAdd(entries[0], w.start);
    const b = bests(sets, add);
    out.push({
      date: w.start,
      workoutId: w.id,
      sets,
      bw: isBW(entries[0]),
      ...b,
      volume: ws.reduce((a, s) => a + Math.max(0, (s.kg || 0) + add) * (s.reps || 0), 0),
      totalReps: ws.reduce((a, s) => a + (s.reps || 0), 0),
    });
  }
  return out.reverse();
}

export function allTimeBests(exId, beforeTs = Infinity) {
  const b = { kg: 0, e1rm: 0, vol: 0, reps: 0, secs: 0, count: 0 };
  for (const w of state.workouts) {
    if (w.start >= beforeTs) continue;
    for (const e of w.exercises) {
      if (e.exId !== exId) continue;
      const x = bests(e.sets, bwAdd(e, w.start));
      b.kg = Math.max(b.kg, x.kg);
      b.e1rm = Math.max(b.e1rm, x.e1rm);
      b.vol = Math.max(b.vol, x.vol);
      b.reps = Math.max(b.reps, x.reps);
      b.secs = Math.max(b.secs, x.secs);
      b.count++;
    }
  }
  return b;
}

/** Record battuti in un allenamento rispetto allo storico precedente */
export function detectPRs(w) {
  const prs = [];
  const seen = new Set();
  for (const e of w.exercises) {
    if (seen.has(e.exId)) continue;
    seen.add(e.exId);
    const prev = allTimeBests(e.exId, w.start);
    if (!prev.count) continue; // prima volta: niente record
    const sets = w.exercises.filter((x) => x.exId === e.exId).flatMap((x) => x.sets);
    const add = bwAdd(e, w.start);
    const cur = bests(sets, add);
    // corpo libero: record di zavorra (+kg), di 1RM sul carico vero (se conosci il tuo peso) e di ripetizioni
    if (isBW(e)) {
      if (cur.kg > 0 && cur.kg > prev.kg + 1e-9) prs.push({ exId: e.exId, kind: 'kg', value: cur.kg, prev: prev.kg, bw: true });
      if (add > 0 && cur.e1rm > prev.e1rm + 1e-9) prs.push({ exId: e.exId, kind: 'e1rm', value: cur.e1rm, prev: prev.e1rm });
      if (cur.reps > prev.reps) prs.push({ exId: e.exId, kind: 'reps', value: cur.reps, prev: prev.reps });
      continue;
    }
    // esercizi a tempo (tenuta): il record è il tempo più lungo
    if (e.mode === 'hold') {
      if (cur.secs > prev.secs) prs.push({ exId: e.exId, kind: 'secs', value: cur.secs, prev: prev.secs });
      if (cur.kg > prev.kg && prev.kg > 0) prs.push({ exId: e.exId, kind: 'kg', value: cur.kg, prev: prev.kg });
      continue;
    }
    if (cur.kg > 0) {
      for (const k of ['kg', 'e1rm', 'vol']) {
        if (cur[k] > prev[k] + 1e-9) prs.push({ exId: e.exId, kind: k, value: cur[k], prev: prev[k] });
      }
    } else if (cur.reps > prev.reps && prev.kg === 0) {
      prs.push({ exId: e.exId, kind: 'reps', value: cur.reps, prev: prev.reps });
    }
  }
  return prs;
}

export function workoutVolume(w) {
  let v = 0;
  for (const e of w.exercises) {
    const add = bwAdd(e, w.start || Date.now());
    for (const s of workingSets(e.sets)) if (s.done !== false) v += Math.max(0, (toNum(s.kg) || 0) + add) * (toNum(s.reps) || 0);
  }
  return v;
}

export function workoutSetCount(w) {
  return w.exercises.reduce((a, e) => a + workingSets(e.sets).filter((s) => s.done !== false).length, 0);
}

/* ---------- Allenamento attivo ---------- */

/**
 * Serie da fare adesso: la prossima dell'esercizio su cui stai lavorando (a.cur, l'ultimo toccato),
 * poi quelli dopo e infine quelli prima rimasti indietro. Gli esercizi saltati non contano;
 * nei superset le serie si alternano tra gli esercizi del gruppo. Ritorna [i, j] o null.
 */
export function currentSet(a) {
  const ex = a?.exercises || [];
  const groups = [];
  let g = [];
  ex.forEach((e, i) => {
    g.push(i);
    if (!e.superset || i === ex.length - 1) {
      groups.push(g);
      g = [];
    }
  });
  const gi = Math.max(0, groups.findIndex((x) => x.includes(a?.cur ?? 0)));
  for (const grp of [...groups.slice(gi), ...groups.slice(0, gi)]) {
    const live = grp.filter((i) => !ex[i].skipped);
    const rounds = Math.max(0, ...live.map((i) => ex[i].sets.length));
    for (let r = 0; r < rounds; r++) {
      for (const i of live) {
        const s = ex[i].sets[r];
        if (s && !s.done) return [i, r];
      }
    }
  }
  return null;
}

export function startWorkout({ name, routineId = null, exercises = [] }) {
  state.active = {
    id: uid(),
    name,
    routineId,
    start: Date.now(),
    notes: '',
    effort: state.settings.effort,
    rest: null,
    exercises: exercises.map((re) => {
      const e = {
        exId: re.exId,
        rest: re.rest ?? state.settings.defaultRest,
        superset: !!re.superset,
        target: re.reps || '',
        notes: '',
        rpe: !!re.rpe, // colonna RPE/RIR solo dove l'hai attivata
        ...modeFields(re), // a tempo, max rip in tempo, intervalli
        ...(re.bw != null ? { bw: !!re.bw } : {}), // zavorra accesa/spenta a mano
        sets: re.setList
          ? re.setList.map((s) => (s.side ? { ...newSet(s.type), side: s.side } : newSet(s.type)))
          : Array.from({ length: Math.max(1, Number(re.sets) || 1) }, () => newSet()),
      };
      if (re.uni) setUnilateral(e, true);
      return e;
    }),
  };
  save();
}

export function startFromRoutine(r) {
  startWorkout({ name: r.name, routineId: r.id, exercises: r.exercises });
}

export function startFromWorkout(w) {
  startWorkout({
    name: w.name,
    routineId: w.routineId,
    exercises: w.exercises.map((e) => ({ exId: e.exId, rest: e.rest, superset: e.superset, rpe: e.rpe, uni: e.uni, ...modeFields(e), ...(e.bw != null ? { bw: e.bw } : {}), setList: e.sets })),
  });
}

export function finishActive() {
  const a = state.active;
  if (a.clock) stopClock(); // un tempo ancora in corso conta fino a qui
  const exercises = a.exercises
    .map((e) => ({
      exId: e.exId,
      superset: !!e.superset,
      rest: e.rest,
      notes: (e.notes || '').trim(),
      ...(e.rpe ? { rpe: true } : {}),
      ...(e.uni ? { uni: true } : {}),
      ...modeFields(e),
      ...(e.bw != null ? { bw: !!e.bw } : {}),
      // corpo libero: il peso corporeo del giorno resta salvato, così i calcoli non cambiano se ti pesi di nuovo
      ...(isBW(e) && bodyWeightAt(a.start) > 0 ? { bwKg: bodyWeightAt(a.start) } : {}),
      sets: e.sets
        .filter((s) => s.done)
        .map((s) => ({
          type: s.type,
          kg: toNum(s.kg) || 0,
          reps: toNum(s.reps) || 0,
          rpe: s.rpe === '' || s.rpe == null ? null : Number(s.rpe),
          ...(s.side ? { side: s.side } : {}),
          ...(parseSecs(s.secs) > 0 ? { secs: parseSecs(s.secs) } : {}),
        })),
    }))
    .filter((e) => e.sets.length);
  const w = {
    id: a.id,
    name: (a.name || '').trim() || t('Allenamento'),
    routineId: a.routineId,
    start: a.start,
    end: Date.now(),
    notes: (a.notes || '').trim(),
    effort: a.effort || 'rpe',
    exercises,
  };
  w.prs = detectPRs(w);
  state.workouts.push(w);
  state.workouts.sort((x, y) => y.start - x.start);
  state.active = null;
  save();
  window.dispatchEvent(new CustomEvent('rep:finished', { detail: { id: w.id } })); // app nativa: battiti da Salute
  return w;
}

/* ---------- Statistiche ---------- */

export function weeklyMuscleSets(weekStart) {
  const from = weekStart.getTime();
  const to = addDays(weekStart, 7).getTime();
  const res = {};
  for (const w of state.workouts) {
    if (w.start < from || w.start >= to) continue;
    for (const e of w.exercises) {
      const m = getExercise(e.exId).muscle;
      res[m] = (res[m] || 0) + workingSets(e.sets).length;
    }
  }
  return res;
}

/** Settimane consecutive con almeno un allenamento */
export function weekStreak() {
  const weeks = new Set(state.workouts.map((w) => startOfWeek(w.start).getTime()));
  let cur = startOfWeek(Date.now());
  if (!weeks.has(cur.getTime())) cur = addDays(cur, -7);
  let n = 0;
  while (weeks.has(cur.getTime())) {
    n++;
    cur = addDays(cur, -7);
  }
  return n;
}

export function exercisesWithHistory() {
  const map = new Map();
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      const m = map.get(e.exId) || { exId: e.exId, count: 0, last: 0 };
      m.count++;
      m.last = Math.max(m.last, w.start);
      map.set(e.exId, m);
    }
  }
  return [...map.values()].sort((a, b) => b.last - a.last);
}
