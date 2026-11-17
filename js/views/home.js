import { state, save, markDeleted } from '../store.js';
import { register, go, rerender, confirmDialog, actionSheet, toast } from '../ui.js';
import { getExercise } from '../exercises.js';
import { startFromRoutine, startWorkout } from '../logic.js';
import { esc, uid, relDays, fmtClock, startOfWeek, fmtTime, fmtDate } from '../utils.js';
import { I } from '../icons.js';
import { shareRoutine } from '../share.js';
import { t, tn } from '../i18n.js';

const TEMPLATES = [
  {
    name: t('Push (spinta)'),
    exercises: [
      ['b-panca-piana', 4, '6-8', 150], ['b-panca-inclinata-man', 3, '8-10', 120], ['b-military-press', 3, '8-10', 120],
      ['b-alzate-laterali', 3, '12-15', 60, true], ['b-pushdown-corda', 3, '10-12', 60],
    ],
  },
  {
    name: t('Pull (tirata)'),
    exercises: [
      ['b-trazioni', 4, '6-10', 150], ['b-rematore-bil', 3, '8-10', 120], ['b-lat-machine', 3, '10-12', 90],
      ['b-face-pull', 3, '12-15', 60, true], ['b-curl-man', 3, '10-12', 60],
    ],
  },
  {
    name: t('Legs (gambe)'),
    exercises: [
      ['b-squat', 4, '5-8', 180], ['b-stacco-rumeno', 3, '8-10', 150], ['b-pressa', 3, '10-12', 120],
      ['b-leg-curl-seduto', 3, '10-12', 90], ['b-calf-piedi', 4, '12-15', 60],
    ],
  },
];

function makeRoutine(tpl) {
  return {
    id: uid(),
    name: tpl.name,
    notes: '',
    exercises: tpl.exercises.map(([exId, sets, reps, rest, superset]) => ({ exId, sets, reps, rest, superset: !!superset })),
  };
}

function lastDone(routineId) {
  const w = state.workouts.find((x) => x.routineId === routineId);
  return w ? relDays(w.start) : null;
}

function routineCard(r) {
  const names = r.exercises.map((e) => getExercise(e.exId).name);
  const shown = names.slice(0, 4).join(', ') + (names.length > 4 ? ` +${names.length - 4}` : '');
  const last = lastDone(r.id);
  return `
  <div class="card routine-card">
    <div class="routine-top" data-action="go" data-to="#/routine/${r.id}">
      <div class="routine-name">${esc(r.name)}</div>
      <div class="muted small">${shown ? esc(shown) : t('Nessun esercizio')}</div>
      <div class="label" style="margin-top:6px">${t('{n} esercizi', { n: r.exercises.length })}${last ? ` · ${last}` : ''}</div>
    </div>
    <div class="routine-actions">
      <button class="icon-btn" data-action="routine-menu" data-id="${r.id}" aria-label="${t('Opzioni')}">${I.more}</button>
      <button class="play-btn" data-action="routine-start" data-id="${r.id}" aria-label="Inizia ${esc(r.name)}">${I.play}</button>
    </div>
  </div>`;
}

function hero() {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 6 ? t('Notte fonda') : hour < 12 ? t('Buongiorno') : hour < 18 ? t('Buon pomeriggio') : t('Buonasera');
  const ws = startOfWeek(now).getTime();
  const done = state.workouts.filter((w) => w.start >= ws).length;
  const goal = Math.max(1, state.settings.weeklyGoal || 3);
  const frac = Math.min(1, done / goal);
  const date = fmtDate(now, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  return `
  <section class="hero">
    <div>
      <div class="hero-greet">${greet}</div>
      <div class="hero-time" id="hero-clock">${fmtTime(now)}</div>
      <div class="hero-date">${esc(date)}</div>
    </div>
    <div class="ring" title="${t('Obiettivo settimanale')}">
      <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="44"/>
        <circle class="prog" cx="50" cy="50" r="44" pathLength="1" style="stroke-dashoffset:${(1 - frac).toFixed(3)}"/></svg>
      <div class="ring-text"><b>${done}<small>/${goal}</small></b><span>${t('settimana')}</span></div>
    </div>
  </section>`;
}

export function render() {
  const a = state.active;
  return `
  ${hero()}
  ${state.demo ? `
  <div class="card demo-card">
    <div><div class="label accent-text">${t('Modalità prova')}</div><div class="small muted">${t('Stai vedendo 8 settimane di dati di esempio.')}</div></div>
    <button class="btn btn-small btn-outline" data-action="demo-clear">${t('Inizia da zero')}</button>
  </div>` : ''}

  ${a ? `
  <div class="card active-card" data-action="go" data-to="#/workout">
    <div><div class="label accent-text">${t('● In corso')}</div><div class="routine-name" style="margin-top:4px">${esc(a.name)}</div>
    <div class="muted small">${fmtClock((Date.now() - a.start) / 1000)} · ${t('{n} esercizi', { n: a.exercises.length })}</div></div>
    <span class="play-btn">${I.play}</span>
  </div>` : ''}

  <button class="btn btn-block btn-outline" data-action="start-empty">${I.plus} ${t('Allenamento libero')}</button>

  <div class="section-head"><h2>${t('Le mie schede')}</h2><button class="btn btn-small btn-primary" data-action="routine-new">${I.plus} ${t('Nuova')}</button></div>
  ${state.routines.length ? `<div class="stagger">${state.routines.map(routineCard).join('')}</div>` : `
    <div class="empty">
      <div class="empty-icon">${I.list}</div>
      <p>${t('Non hai ancora nessuna scheda.')}</p>
      <button class="btn btn-primary" data-action="routine-new">${t('Crea la tua prima scheda')}</button>
      <button class="btn btn-ghost" data-action="add-templates">${t('oppure aggiungi Push / Pull / Legs di esempio')}</button>
    </div>`}
  `;
}

async function ensureNoActive() {
  if (!state.active) return true;
  const ok = await confirmDialog(t('Hai già un allenamento in corso. Vuoi scartarlo e iniziarne uno nuovo?'), {
    okText: t('Scarta e inizia'),
    danger: true,
  });
  if (ok) state.active = null;
  return ok;
}

register({
  'demo-clear': async () => {
    if (!(await confirmDialog(t('Le schede, gli allenamenti e le misure di esempio verranno cancellati.'), { title: t('Iniziare da zero?'), okText: t('Cancella esempi'), danger: true }))) return;
    Object.assign(state, { routines: [], workouts: [], body: [], active: null, demo: false });
    save();
    toast(t('Pronto: crea la tua prima scheda'));
    rerender();
  },
  'routine-new': () => {
    const r = { id: uid(), name: t('Nuova scheda'), notes: '', exercises: [] };
    state.routines.push(r);
    save();
    go(`#/routine/${r.id}?new=1`);
  },
  'add-templates': () => {
    TEMPLATES.forEach((tpl) => state.routines.push(makeRoutine(tpl)));
    save();
    toast(t('Schede di esempio aggiunte'));
    rerender();
  },
  'routine-start': async (el) => {
    const r = state.routines.find((x) => x.id === el.dataset.id);
    if (!r) return;
    if (!r.exercises.length) return toast(t('Aggiungi prima degli esercizi alla scheda'));
    if (!(await ensureNoActive())) return;
    startFromRoutine(r);
    go('#/workout');
  },
  'start-empty': async () => {
    if (!(await ensureNoActive())) return;
    startWorkout({ name: t('Allenamento libero') });
    go('#/workout');
  },
  'routine-menu': (el) => {
    const r = state.routines.find((x) => x.id === el.dataset.id);
    if (!r) return;
    const i = state.routines.indexOf(r);
    actionSheet(r.name, [
      { label: t('Modifica'), icon: I.edit, fn: () => go(`#/routine/${r.id}`) },
      { label: t('Condividi'), icon: I.share, fn: () => shareRoutine(r) },
      { label: t('Duplica'), icon: I.copy, fn: () => {
        state.routines.splice(i + 1, 0, { ...structuredClone(r), id: uid(), name: r.name + ' (copia)' });
        save();
        rerender();
      } },
      i > 0 && { label: t('Sposta su'), icon: I.up, fn: () => {
        state.routines.splice(i - 1, 0, state.routines.splice(i, 1)[0]);
        save();
        rerender();
      } },
      i < state.routines.length - 1 && { label: t('Sposta giù'), icon: I.down, fn: () => {
        state.routines.splice(i + 1, 0, state.routines.splice(i, 1)[0]);
        save();
        rerender();
      } },
      { label: t('Elimina'), icon: I.trash, danger: true, fn: async () => {
        if (await confirmDialog(t('Eliminare la scheda "{name}"? Lo storico degli allenamenti resta.', { name: r.name }), { okText: t('Elimina'), danger: true })) {
          state.routines = state.routines.filter((x) => x.id !== r.id);
          markDeleted(r.id);
          save();
          rerender();
        }
      } },
    ]);
  },
});
