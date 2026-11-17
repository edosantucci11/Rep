// Dati di esempio: 8 settimane di Push / Pull / Legs con progressione realistica.
import { state, save } from './store.js';
import { detectPRs } from './logic.js';
import { uid, startOfWeek, addDays, dayKey } from './utils.js';
import { t } from './i18n.js';

const PLAN = [
  {
    name: t('Push (spinta)'),
    day: 0,
    ex: [
      ['b-panca-piana', 4, '6-8', 150, 70, 2.5],
      ['b-panca-inclinata-man', 3, '8-10', 120, 24, 2],
      ['b-military-press', 3, '8-10', 120, 40, 2.5],
      ['b-alzate-laterali', 3, '12-15', 60, 8, 1, true],
      ['b-pushdown-corda', 3, '10-12', 60, 20, 2.5],
    ],
  },
  {
    name: t('Pull (tirata)'),
    day: 2,
    ex: [
      ['b-trazioni', 4, '6-10', 150, 0, 0],
      ['b-rematore-bil', 3, '8-10', 120, 60, 2.5],
      ['b-lat-machine', 3, '10-12', 90, 55, 2.5],
      ['b-face-pull', 3, '12-15', 60, 15, 1, true],
      ['b-curl-man', 3, '10-12', 60, 12, 1],
    ],
  },
  {
    name: t('Legs (gambe)'),
    day: 4,
    ex: [
      ['b-squat', 4, '5-8', 180, 90, 5],
      ['b-stacco-rumeno', 3, '8-10', 150, 80, 5],
      ['b-pressa', 3, '10-12', 120, 140, 10],
      ['b-leg-curl-seduto', 3, '10-12', 90, 40, 2.5],
      ['b-calf-piedi', 4, '12-15', 60, 60, 5],
    ],
  },
];

export function seedDemoIfEmpty() {
  if (state.routines.length || state.workouts.length || state.body.length || state.active) return;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const routines = PLAN.map((p) => ({
    id: uid(),
    name: p.name,
    notes: '',
    exercises: p.ex.map(([exId, sets, reps, rest, , , ss]) => ({ exId, sets, reps, rest, superset: !!ss })),
  }));

  const WEEKS = 8;
  const thisWeek = startOfWeek(Date.now());
  const workouts = [];
  for (let wk = WEEKS; wk >= 0; wk--) {
    const monday = addDays(thisWeek, -7 * wk);
    PLAN.forEach((p, pi) => {
      if (wk === 5 && pi === 1) return; // una sessione saltata, come nella vita reale
      const day = addDays(monday, p.day);
      day.setHours(18, Math.floor(rnd() * 40), 0, 0);
      const start = day.getTime();
      if (start > Date.now() - 3600000) return; // niente allenamenti nel futuro
      const step = Math.floor((WEEKS - wk) / 2); // aumento ogni 2 settimane
      const exercises = p.ex.map(([exId, sets, reps, rest, base, inc, ss]) => {
        const [lo, hi] = reps.split('-').map(Number);
        const kg = base + inc * step;
        const list = [];
        if (base >= 60) list.push({ type: 'W', kg: Math.round(kg * 0.5 / 2.5) * 2.5, reps: 10, rpe: null });
        for (let s = 0; s < sets; s++) {
          const r = Math.max(lo, hi - s - Math.floor(rnd() * 2) + ((WEEKS - wk) % 2));
          list.push({ type: 'N', kg, reps: Math.min(hi + 2, r), rpe: s === sets - 1 ? 8.5 + (rnd() > 0.5 ? 0.5 : 0) : null });
        }
        return { exId, superset: !!ss, rest, notes: '', sets: list };
      });
      workouts.push({
        id: uid(),
        name: p.name,
        routineId: routines[pi].id,
        start,
        end: start + (52 + Math.floor(rnd() * 20)) * 60000,
        notes: '',
        effort: 'rpe',
        exercises,
      });
    });
  }
  state.routines = routines;
  state.workouts = workouts.sort((a, b) => b.start - a.start);
  for (const w of state.workouts) w.prs = detectPRs(w);

  state.body = [];
  for (let wk = WEEKS; wk >= 0; wk--) {
    const d = addDays(thisWeek, -7 * wk);
    const entry = { id: uid(), date: dayKey(d), peso: Math.round((80.6 - (WEEKS - wk) * 0.28 + (rnd() - 0.5) * 0.5) * 10) / 10 };
    if (wk % 4 === 0) Object.assign(entry, { vita: 86 - (WEEKS - wk) * 0.3, braccio: 37 + (WEEKS - wk) * 0.1 });
    state.body.push(entry);
  }
  state.demo = true;
  save();
}
