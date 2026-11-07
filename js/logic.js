import { state, save } from './store.js';
import { getExercise } from './exercises.js';
import { uid, toNum, e1rm, startOfWeek, addDays } from './utils.js';
import { t, tn } from './i18n.js';

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
};

export const newSet = (type = 'N') => ({ type, kg: '', reps: '', rpe: '', done: false });

/** Serie allenanti (escluso riscaldamento) */
export const workingSets = (sets) => sets.filter((s) => s.type !== 'W');

export function setLabels(sets) {
  let n = 0;
  return sets.map((s) => (s.type === 'N' || s.type === 'F' ? (s.type === 'F' ? 'C' : String(++n)) : SET_TYPES[s.type].short));
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
  const k = sets.slice(0, j).filter((s) => s.type === type).length;
  const same = lp.exercise.sets.filter((s) => s.type === type);
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

export function bests(sets) {
  const ws = workingSets(sets);
  const b = { kg: 0, e1rm: 0, vol: 0, reps: 0, bestSet: null };
  for (const s of ws) {
    const kg = s.kg || 0;
    const reps = s.reps || 0;
    if (kg > b.kg) b.kg = kg;
    const one = e1rm(kg, reps);
    if (one > b.e1rm) { b.e1rm = one; b.bestSet = s; }
    if (kg * reps > b.vol) b.vol = kg * reps;
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
    const b = bests(sets);
    out.push({
      date: w.start,
      workoutId: w.id,
      sets,
      ...b,
      volume: ws.reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0),
      totalReps: ws.reduce((a, s) => a + (s.reps || 0), 0),
    });
  }
  return out.reverse();
}

export function allTimeBests(exId, beforeTs = Infinity) {
  const b = { kg: 0, e1rm: 0, vol: 0, reps: 0, count: 0 };
  for (const w of state.workouts) {
    if (w.start >= beforeTs) continue;
    for (const e of w.exercises) {
      if (e.exId !== exId) continue;
      const x = bests(e.sets);
      b.kg = Math.max(b.kg, x.kg);
      b.e1rm = Math.max(b.e1rm, x.e1rm);
      b.vol = Math.max(b.vol, x.vol);
      b.reps = Math.max(b.reps, x.reps);
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
    const cur = bests(sets);
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
  for (const e of w.exercises) for (const s of workingSets(e.sets)) if (s.done !== false) v += (toNum(s.kg) || 0) * (toNum(s.reps) || 0);
  return v;
}

export function workoutSetCount(w) {
  return w.exercises.reduce((a, e) => a + workingSets(e.sets).filter((s) => s.done !== false).length, 0);
}

/* ---------- Allenamento attivo ---------- */

export function startWorkout({ name, routineId = null, exercises = [] }) {
  state.active = {
    id: uid(),
    name,
    routineId,
    start: Date.now(),
    notes: '',
    effort: state.settings.effort,
    rest: null,
    exercises: exercises.map((re) => ({
      exId: re.exId,
      rest: re.rest ?? state.settings.defaultRest,
      superset: !!re.superset,
      target: re.reps || '',
      notes: '',
      sets: re.setList
        ? re.setList.map((s) => newSet(s.type))
        : Array.from({ length: Math.max(1, Number(re.sets) || 1) }, () => newSet()),
    })),
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
    exercises: w.exercises.map((e) => ({ exId: e.exId, rest: e.rest, superset: e.superset, setList: e.sets })),
  });
}

export function finishActive() {
  const a = state.active;
  const exercises = a.exercises
    .map((e) => ({
      exId: e.exId,
      superset: !!e.superset,
      rest: e.rest,
      notes: (e.notes || '').trim(),
      sets: e.sets
        .filter((s) => s.done)
        .map((s) => ({
          type: s.type,
          kg: toNum(s.kg) || 0,
          reps: toNum(s.reps) || 0,
          rpe: s.rpe === '' || s.rpe == null ? null : Number(s.rpe),
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
