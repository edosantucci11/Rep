import { state, save, markDeleted } from '../store.js';
import { register, go, rerender, confirmDialog, actionSheet, getPath } from '../ui.js';
import { getExercise } from '../exercises.js';
import { openPicker } from '../picker.js';
import { esc, fmtClock } from '../utils.js';
import { I } from '../icons.js';
import '../exguide.js';
import { onDragSort, moveExercise } from '../drag.js';
import { nameSize } from './workout.js';
import { t, tn } from '../i18n.js';

export const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];
export const restLabel = (s) => (s ? fmtClock(s) : 'Off');

const find = (id) => state.routines.find((r) => r.id === id);

export function render(id) {
  const r = find(id);
  if (!r) return `<div class="empty">${t('Scheda non trovata.')}<br><button class="btn" data-action="go" data-to="#/">${t('Torna alle schede')}</button></div>`;

  const items = r.exercises
    .map((e, i) => {
      const ex = getExercise(e.exId);
      const linkedPrev = i > 0 && r.exercises[i - 1].superset;
      const inSS = e.superset || linkedPrev;
      return `
      <div class="card rex ${inSS ? 'in-superset' : ''} ${e.superset ? 'ss-next' : ''} ${linkedPrev ? 'ss-prev' : ''}" data-drag="rex">
        <div class="rex-head">
          <button class="drag-handle" data-drag-handle aria-label="${t('Tieni premuto e trascina per spostare')}">${I.grip}</button>
          <img class="ex-thumb" data-thumb="${e.exId}" alt="" data-action="ex-guide" data-id="${e.exId}">
          <div class="rex-title" data-drag-hold>
            ${inSS ? `<span class="tag tag-ss">${I.link} ${t('Superset')}</span>` : ''}
            <div class="ex-name ${nameSize(ex.name)}" data-action="ex-guide" data-id="${e.exId}">${esc(ex.name)} <span class="guide-hint">${I.info}</span></div>
            <div class="label" style="margin-top:4px">${esc(tn(ex.muscle))} · ${esc(tn(ex.equipment))}</div>
          </div>
          <button class="icon-btn" data-action="rex-menu" data-rid="${r.id}" data-i="${i}" aria-label="${t('Opzioni')}">${I.more}</button>
        </div>
        <div class="rex-fields">
          <label><span>${t('Serie')}</span>
            <div class="stepper">
              <button data-action="rex-sets" data-rid="${r.id}" data-i="${i}" data-d="-1">−</button>
              <b>${e.sets}</b>
              <button data-action="rex-sets" data-rid="${r.id}" data-i="${i}" data-d="1">+</button>
            </div>
          </label>
          <label><span>${t('Ripetizioni')}</span><input class="input input-sm" value="${esc(e.reps)}" placeholder="8-12" data-input="rex-reps" data-rid="${r.id}" data-i="${i}"></label>
          <label><span>${t('Recupero')}</span><button class="input input-sm select-like" data-action="rex-rest" data-rid="${r.id}" data-i="${i}">${restLabel(e.rest)}</button></label>
        </div>
      </div>`;
    })
    .join('');

  return `
  <header class="page-head with-back">
    <button class="icon-btn" data-action="go" data-to="#/" aria-label="${t('Indietro')}">${I.back}</button>
    <h1>${t('Modifica scheda')}</h1>
    <button class="btn btn-primary btn-small" data-action="go" data-to="#/">${t('Fatto')}</button>
  </header>
  <label class="field"><span>${t('Nome scheda')}</span>
    <input class="input input-lg" value="${esc(r.name)}" data-input="routine-name" data-rid="${r.id}" placeholder="${t('Es. Petto e tricipiti')}">
  </label>
  <label class="field"><span>${t('Note')}</span>
    <textarea class="input" rows="2" data-input="routine-notes" data-rid="${r.id}" placeholder="${t('Note sulla scheda (opzionale)')}">${esc(r.notes)}</textarea>
  </label>
  <div class="section-head"><h2>${t('Esercizi')}</h2><span class="muted small">${r.exercises.length}</span></div>
  ${items ? `<div class="stagger">${items}</div>` : `<div class="empty small">${t('Aggiungi il primo esercizio alla scheda.')}</div>`}
  <button class="btn btn-block btn-outline" data-action="rex-add" data-rid="${r.id}">${I.plus} ${t('Aggiungi esercizi')}</button>
  ${r.exercises.length ? `<button class="btn btn-block btn-outline" data-action="share-routine" data-id="${r.id}">${I.share} ${t('Condividi scheda')}</button>` : ''}
  <button class="btn btn-block btn-ghost danger-text" data-action="routine-delete" data-rid="${r.id}">${t('Elimina scheda')}</button>
  `;
}

// trascinando la maniglia ⠿ (o tenendo premuto il nome) si cambia l'ordine
onDragSort('rex', (from, to) => {
  const r = find(getPath().split('/').pop());
  if (!r) return;
  moveExercise(r.exercises, from, to);
  save();
  rerender();
});

function withRex(el, fn) {
  const r = find(el.dataset.rid);
  if (!r) return;
  const i = Number(el.dataset.i);
  fn(r, i, r.exercises[i]);
  save();
}

register(
  {
    'rex-add': (el) => {
      const r = find(el.dataset.rid);
      openPicker({
        onPick: (ids) => {
          ids.forEach((exId) => r.exercises.push({ exId, sets: 3, reps: '8-12', rest: state.settings.defaultRest, superset: false }));
          save();
          rerender();
        },
      });
    },
    'rex-sets': (el) =>
      withRex(el, (r, i, e) => {
        e.sets = Math.min(20, Math.max(1, e.sets + Number(el.dataset.d)));
        // solo il numero: ridisegnare la scheda intera (con le immagini degli esercizi) rallenta i tocchi
        const n = el.parentElement.querySelector('b');
        if (n) n.textContent = e.sets;
        else rerender();
      }),
    'rex-rest': (el) =>
      withRex(el, (r, i, e) =>
        actionSheet(t('Tempo di recupero'), REST_OPTIONS.map((s) => ({
          label: restLabel(s),
          active: s === e.rest,
          fn: () => {
            e.rest = s;
            save();
            rerender();
          },
        })))
      ),
    'rex-menu': (el) =>
      withRex(el, (r, i, e) => {
        const ex = r.exercises;
        const after = () => {
          save();
          rerender();
        };
        actionSheet(getExercise(e.exId).name, [
          i < ex.length - 1 && {
            label: e.superset ? t('Scollega dal superset') : t('Superset con il successivo'),
            icon: I.link,
            fn: () => {
              e.superset = !e.superset;
              after();
            },
          },
          {
            label: t('Sostituisci esercizio'),
            icon: I.swap,
            fn: () => openPicker({ multi: false, title: t('Sostituisci'), onPick: ([id]) => { e.exId = id; after(); } }),
          },
          {
            label: t('Rimuovi'),
            icon: I.trash,
            danger: true,
            fn: () => {
              if (i > 0 && ex[i - 1].superset && !e.superset) ex[i - 1].superset = false;
              ex.splice(i, 1);
              after();
            },
          },
        ]);
      }),
    'routine-delete': async (el) => {
      const r = find(el.dataset.rid);
      if (await confirmDialog(t('Eliminare la scheda "{name}"?', { name: r.name }), { okText: t('Elimina'), danger: true })) {
        state.routines = state.routines.filter((x) => x.id !== r.id);
        markDeleted(r.id);
        save();
        go('#/');
      }
    },
  },
  {
    'routine-name': (el) => {
      find(el.dataset.rid).name = el.value;
      save();
    },
    'routine-notes': (el) => {
      find(el.dataset.rid).notes = el.value;
      save();
    },
    'rex-reps': (el) => withRex(el, (r, i, e) => (e.reps = el.value)),
  }
);
