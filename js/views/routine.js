import { state, save, markDeleted } from '../store.js';
import { MODES, DURATIONS, fmtSecs, defaultMode } from '../clock.js';
import { isBW } from '../logic.js';
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

  const effort = state.settings.effort === 'rir' ? 'RIR' : 'RPE';
  const items = r.exercises
    .map((e, i) => {
      const ex = getExercise(e.exId);
      const mode = e.mode || 'reps';
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
        <div class="rex-modes segmented small" role="radiogroup" aria-label="${t('Tipo di esercizio')}">
          ${Object.entries(MODES).map(([k, m]) => `<button class="${mode === k ? 'active' : ''}" role="radio" aria-checked="${mode === k}" data-action="rex-mode" data-m="${k}" data-rid="${r.id}" data-i="${i}">${m.label}</button>`).join('')}
        </div>
        <div class="rex-fields">
          <label><span>${mode === 'int' ? t('Giri') : t('Serie')}</span>
            <div class="stepper">
              <button data-action="rex-sets" data-rid="${r.id}" data-i="${i}" data-d="-1">−</button>
              <b>${e.sets}</b>
              <button data-action="rex-sets" data-rid="${r.id}" data-i="${i}" data-d="1">+</button>
            </div>
          </label>
          ${mode === 'reps' ? `<label><span>${t('Ripetizioni')}</span><input class="input input-sm" value="${esc(e.reps)}" placeholder="8-12" data-input="rex-reps" data-rid="${r.id}" data-i="${i}"></label>` : ''}
          ${mode === 'hold' ? `<label><span>${t('Obiettivo')}</span><button class="input input-sm select-like" data-action="rex-dur" data-f="dur" data-rid="${r.id}" data-i="${i}">${e.dur ? fmtSecs(e.dur) : t('Max')}</button></label>` : ''}
          ${mode === 'amrap' ? `<label><span>${t('Durata')}</span><button class="input input-sm select-like" data-action="rex-dur" data-f="dur" data-rid="${r.id}" data-i="${i}">${fmtSecs(e.dur || 60)}</button></label>` : ''}
          ${mode === 'int' ? `<label><span>${t('Lavoro')}</span><button class="input input-sm select-like" data-action="rex-dur" data-f="work" data-rid="${r.id}" data-i="${i}">${fmtSecs(e.work || 20)}</button></label>
          <label><span>${t('Pausa')}</span><button class="input input-sm select-like" data-action="rex-dur" data-f="pause" data-rid="${r.id}" data-i="${i}">${e.pause === 0 ? 'Off' : fmtSecs(e.pause ?? 10)}</button></label>` : `<label><span>${t('Recupero')}</span><button class="input input-sm select-like" data-action="rex-rest" data-rid="${r.id}" data-i="${i}">${restLabel(e.rest)}</button></label>`}
        </div>
        ${mode === 'int' ? `<div class="label rex-int-sum">${t('{n} giri · {a} lavoro / {b} pausa · {c} in tutto', { n: e.sets, a: fmtSecs(e.work || 20), b: e.pause === 0 ? '0:00' : fmtSecs(e.pause ?? 10), c: fmtSecs(e.sets * (e.work || 20) + (e.sets - 1) * (e.pause ?? 10)) })}</div>` : `
        <div class="rex-opts">
          <button class="chip small ${e.rpe ? 'active' : ''}" data-action="rex-flag" data-f="rpe" data-rid="${r.id}" data-i="${i}" aria-pressed="${!!e.rpe}">${effort}</button>
          <button class="chip small ${e.uni ? 'active' : ''}" data-action="rex-flag" data-f="uni" data-rid="${r.id}" data-i="${i}" aria-pressed="${!!e.uni}">${t('Monopodalico DX / SX')}</button>
          <button class="chip small ${isBW(e) ? 'active' : ''}" data-action="rex-flag" data-f="bw" data-rid="${r.id}" data-i="${i}" aria-pressed="${isBW(e)}">${t('Zavorra')}</button>
        </div>`}
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
          ids.forEach((exId) => {
            const mode = defaultMode(exId); // plank, hollow hold… partono già "A tempo"
            r.exercises.push({ exId, sets: 3, reps: mode === 'hold' ? '' : '8-12', rest: state.settings.defaultRest, superset: false, ...(mode !== 'reps' ? { mode } : {}) });
          });
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
    // tipo di esercizio: ripetizioni, a tempo (tenuta), max rip in un tempo, intervalli
    'rex-mode': (el) =>
      withRex(el, (r, i, e) => {
        const m = el.dataset.m;
        if (m === 'reps') delete e.mode;
        else e.mode = m;
        if (m === 'amrap' && !e.dur) e.dur = 60;
        if (m === 'int') {
          e.work ??= 20;
          e.pause ??= 10;
          if (e.sets < 4) e.sets = 8;
        }
        rerender();
      }),
    // durata: obiettivo della tenuta, tempo del max rip, lavoro e pausa degli intervalli
    'rex-dur': (el) =>
      withRex(el, (r, i, e) => {
        const f = el.dataset.f;
        const opts = f === 'pause' ? [0, 5, 10, 15, 20, 30, 40, 60, 90, 120] : DURATIONS;
        actionSheet(f === 'pause' ? t('Pausa') : f === 'work' ? t('Lavoro') : e.mode === 'hold' ? t('Obiettivo') : t('Durata'), [
          ...(f === 'dur' && e.mode === 'hold' ? [{ label: t('Max (finché cedi)'), active: !e.dur, fn: () => { delete e.dur; save(); rerender(); } }] : []),
          ...opts.map((sec) => ({ label: sec ? fmtSecs(sec) : 'Off', active: e[f] === sec, fn: () => { e[f] = sec; save(); rerender(); } })),
        ]);
      }),
    // RPE/RIR e monopodalico (destra e sinistra separate) per singolo esercizio della scheda
    'rex-flag': (el) =>
      withRex(el, (r, i, e) => {
        const f = el.dataset.f;
        e[f] = f === 'bw' ? !isBW(e) : !e[f];
        save();
        rerender();
      }),
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
