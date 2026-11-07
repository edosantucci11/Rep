import { state, save } from '../store.js';
import { hrSection } from '../hr.js';
import { isNative } from '../native.js';
import { register, go, rerender, confirmDialog, actionSheet, toast, openModal, getPath } from '../ui.js';
import { getExercise } from '../exercises.js';
import { openPicker } from '../picker.js';
import { startRest, stopRest } from '../timer.js';
import {
  newSet, setLabels, lastPerformance, finishActive, workoutVolume, workoutSetCount, SET_TYPES, PR_LABELS,
  suggestSet, warmupSets, isDeloadWeek,
} from '../logic.js';
import { esc, fmtClock, fmtNum, toNum, fmtDuration, count } from '../utils.js';
import { REST_OPTIONS, restLabel } from './routine.js';
import { I } from '../icons.js';
import { openGuide } from '../exguide.js';
import { burst, countUps, haptic } from '../motion.js';
import { onDragSort, moveExercise } from '../drag.js';
import { t, tn } from '../i18n.js';

let justDone = null; // serie appena completata (per l'animazione)
let justAdded = null;

const RPE_VALUES = ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
const RIR_VALUES = ['5', '4', '3', '2', '1', '0'];

/** Gruppi di esercizi: i superset sono esercizi consecutivi collegati */
/** Nomi lunghi (es. in tedesco) un po' più piccoli, così non vanno sopra le icone */
export const nameSize = (n) => (n.length > 18 ? 'xl' : n.length > 10 ? 'lg' : '');

export function groupsOf(exercises) {
  const groups = [];
  let cur = [];
  exercises.forEach((e, i) => {
    cur.push(i);
    if (!e.superset || i === exercises.length - 1) {
      groups.push(cur);
      cur = [];
    }
  });
  return groups;
}

function exerciseBlock(a, i) {
  const e = a.exercises[i];
  const ex = getExercise(e.exId);
  const sugs = e.sets.map((_, j) => suggestSet(e.exId, e.sets, j, e.target));
  const up = sugs.some((g) => g?.up && !g.deload);
  const labels = setLabels(e.sets);
  const effortVals = a.effort === 'rir' ? RIR_VALUES : RPE_VALUES;
  const effortLabel = a.effort === 'rir' ? 'RIR' : 'RPE';
  const targetReps = (e.target || '').toString().split(/[-–]/)[0].trim();

  const rows = e.sets
    .map((s, j) => {
      const g = sugs[j];
      const p = g?.prev;
      const prevTxt = p ? `${fmtNum(p.kg, 2)}×${p.reps}` : '—';
      const jd = justDone && justDone[0] === i && justDone[1] === j ? 'just-done' : '';
      const ja = justAdded && justAdded[0] === i && justAdded[1] === j ? 'added' : '';
      return `
      <div class="set-row ${s.done ? 'done' : ''} ${jd} ${ja} type-${s.type}">
        <button class="set-num" data-action="w-set-menu" data-i="${i}" data-j="${j}">${labels[j]}</button>
        <button class="set-prev" data-action="w-prev" data-i="${i}" data-j="${j}" ${p ? '' : 'disabled'}>${prevTxt}</button>
        <input class="set-in ${g?.up ? 'up' : ''} ${g?.deload ? 'deload' : ''}" inputmode="decimal" enterkeyhint="next" value="${esc(s.kg)}" placeholder="${g ? fmtNum(g.kg, 2) : 'kg'}" data-input="w-set" data-f="kg" data-i="${i}" data-j="${j}" aria-label="kg">
        <input class="set-in" inputmode="numeric" enterkeyhint="done" value="${esc(s.reps)}" placeholder="${g ? g.reps : esc(targetReps) || 'rip'}" data-input="w-set" data-f="reps" data-i="${i}" data-j="${j}" aria-label="${t('ripetizioni')}">
        <select class="set-rpe" data-change="w-rpe" data-i="${i}" data-j="${j}" aria-label="${effortLabel}">
          <option value=""></option>${effortVals.map((v) => `<option ${String(s.rpe) === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <button class="set-done" data-action="w-done" data-i="${i}" data-j="${j}" aria-label="${t('Completa serie')}">${I.check}</button>
      </div>`;
    })
    .join('');

  return `
  <section class="ex-block" data-ex="${i}" data-drag="wex">
    <div class="ex-head">
      <button class="drag-handle" data-drag-handle aria-label="${t('Tieni premuto e trascina per spostare')}">${I.grip}</button>
      <img class="ex-thumb" data-thumb="${e.exId}" alt="" data-action="ex-guide" data-id="${e.exId}">
      <div class="ex-title" data-drag-hold data-action="go" data-to="#/stats/ex/${e.exId}">
        <div class="ex-name ${nameSize(ex.name)}">${esc(ex.name)}</div>
        <div class="label ex-sub">${esc(tn(ex.muscle))}${e.target ? ` · ${esc(e.target)} ${t('rip')}` : ''} · ${I.clock} ${restLabel(e.rest)}</div>
        ${up ? `<div class="label prog-up">${I.up} +${fmtNum(state.settings.increment || 2.5, 2)} ${t('kg proposti')}</div>` : ''}
        ${isDeloadWeek() && sugs.some((g) => g?.deload) ? `<div class="label prog-deload">${t('Settimana di scarico: pesi proposti al 60%')}</div>` : ''}
      </div>
      <button class="icon-btn guide-btn" data-action="ex-guide" data-id="${e.exId}" aria-label="${t('Come si esegue')}">${I.info}</button>
      <button class="icon-btn" data-action="w-ex-menu" data-i="${i}" aria-label="${t('Opzioni esercizio')}">${I.more}</button>
    </div>
    ${e.showNotes || e.notes ? `<textarea class="input note-in" rows="1" placeholder="${t('Note sull\'esercizio…')}" data-input="w-ex-notes" data-i="${i}">${esc(e.notes)}</textarea>` : ''}
    <div class="set-row set-head"><span>${t('Serie')}</span><span>${t('Prec.')}</span><span>kg</span><span>${t('Rip')}</span><span>${effortLabel}</span><span></span></div>
    ${rows}
    <button class="btn btn-ghost btn-small btn-block" data-action="w-add-set" data-i="${i}">${I.plus} ${t('Serie (aggiungi)')}</button>
  </section>`;
}

export function render() {
  const a = state.active;
  if (!a) {
    return `<div class="empty"><div class="empty-icon">${I.weight}</div><p>${t('Nessun allenamento in corso.')}</p>
      <button class="btn btn-primary" data-action="go" data-to="#/">${t('Vai alle schede')}</button></div>`;
  }
  const blocks = groupsOf(a.exercises)
    .map((g) => (g.length > 1
      ? `<div class="superset-group"><div class="superset-label">${I.link} ${t('Superset')}</div>${g.map((i) => exerciseBlock(a, i)).join('')}</div>`
      : exerciseBlock(a, g[0])))
    .join('');

  const html = `
  <header class="workout-head">
    <div class="wh-row">
      <button class="icon-btn" data-action="go" data-to="#/" aria-label="${t('Riduci')}">${I.min}</button>
      <div class="workout-head-mid"><input class="title-input" value="${esc(a.name)}" data-input="w-name" aria-label="${t('Nome allenamento')}"></div>
      <button class="btn btn-primary btn-small" data-action="w-finish">${t('Fine')}</button>
    </div>
    <div class="wh-stats">
      <span id="elapsed">${fmtClock((Date.now() - a.start) / 1000)}</span>
      <div class="wh-stat"><b>${fmtNum(workoutVolume(a), 0)}</b><span>kg</span></div>
      <div class="wh-stat"><b>${workoutSetCount(a)}</b><span>${t('serie')}</span></div>
      <div class="wh-stat wh-hr" id="live-hr" hidden><b>–</b><span>bpm</span></div>
    </div>
    ${document.documentElement.classList.contains('native') ? `<div class="music-bar idle" id="music-bar">
      <div class="mb-art"></div>
      <div class="mb-text"><div class="mb-title">${t('Musica')}</div><div class="mb-artist"></div></div>
      <button class="mb-btn" data-cmd="previous" aria-label="${t('Brano precedente')}">&#9198;&#xFE0E;</button>
      <button class="mb-btn mb-main" data-cmd="toggle" aria-label="${t('Riproduci o metti in pausa')}">&#9654;&#xFE0E;</button>
      <button class="mb-btn" data-cmd="next" aria-label="${t('Brano successivo')}">&#9197;&#xFE0E;</button>
    </div>` : ''}
  </header>
  <div class="stagger">${blocks || `<div class="empty small">${t('Aggiungi un esercizio per iniziare.')}</div>`}</div>
  <button class="btn btn-block btn-outline" data-action="w-add-ex">${I.plus} ${t('Aggiungi esercizio')}</button>
  <label class="field"><span>${t('Note allenamento')}</span>
    <textarea class="input" rows="2" data-input="w-notes" placeholder="${t('Come è andata?')}">${esc(a.notes)}</textarea>
  </label>
  <button class="btn btn-block btn-ghost danger-text" data-action="w-discard">${t('Annulla allenamento')}</button>
  `;
  justDone = null;
  justAdded = null;
  return html;
}

const act = () => state.active;

// trascinando la maniglia ⠿ (o tenendo premuto il nome) si cambia l'ordine degli esercizi
onDragSort('wex', (from, to) => {
  const a = act();
  if (!a) return;
  moveExercise(a.exercises, from, to);
  save();
  rerender();
});
const ij = (el) => [Number(el.dataset.i), Number(el.dataset.j)];

/** Aggiorna solo il blocco dell'esercizio e i contatori in alto (molto più leggero di ridisegnare la pagina) */
function refreshBlock(i) {
  const old = document.querySelector(`.ex-block[data-ex="${i}"]`);
  const a = act();
  if (!old || !a) return rerender();
  const tpl = document.createElement('template');
  tpl.innerHTML = exerciseBlock(a, i).trim();
  const nu = tpl.content.firstElementChild;
  nu.classList.add('no-anim');
  const oldImg = old.querySelector('.ex-thumb'), newImg = nu.querySelector('.ex-thumb');
  if (oldImg && newImg) newImg.replaceWith(oldImg); // stessa miniatura, niente ricaricamento
  old.replaceWith(nu);
  const st = document.querySelectorAll('.wh-stats .wh-stat b');
  if (st.length >= 2) {
    st[0].textContent = fmtNum(workoutVolume(a), 0);
    st[1].textContent = workoutSetCount(a);
  }
  justDone = null;
  justAdded = null;
}

/** Casella selezionata: se la tastiera la fa finire sotto l'intestazione fissa, la riporta in vista */
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el.matches?.('.set-in, .set-rpe, .note-in') || getPath() !== '/workout') return;
  const fix = () => {
    const head = document.querySelector('.workout-head');
    if (!head) return;
    const top = head.getBoundingClientRect().bottom + 12;
    const r = el.getBoundingClientRect();
    if (r.top < top) window.scrollBy(0, r.top - top);
  };
  // iOS sposta la pagina mentre apre la tastiera: si controlla quando ha finito
  setTimeout(fix, 350);
});

/** Fine recupero: porta in vista la prossima serie da fare e la evidenzia */
window.addEventListener('rep:rest-end', () => {
  if (getPath() !== '/workout') return;
  const row = document.querySelector('.ex-block .set-row:not(.set-head):not(.done)');
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.remove('next-up');
  void row.offsetWidth;
  row.classList.add('next-up');
  setTimeout(() => row.classList.remove('next-up'), 2400);
});

/** Serie di avvicinamento calcolate dal peso della prima serie di lavoro */
function addWarmups(i) {
  const e = act().exercises[i];
  const j = e.sets.findIndex((s) => s.type !== 'W');
  if (j < 0) return toast(t('Aggiungi prima una serie di lavoro'));
  const work = toNum(e.sets[j].kg) || suggestSet(e.exId, e.sets, j, e.target)?.kg || 0;
  if (!(work > 0)) return toast(t('Scrivi prima il peso della prima serie'));
  const list = warmupSets(work, /Bilanciere|Multipower/.test(getExercise(e.exId).equipment));
  if (!list.length) return toast(t('Peso troppo basso per le serie di riscaldamento'));
  e.sets = e.sets.filter((s) => s.type !== 'W' || s.done);
  const at = e.sets.findIndex((s) => s.type !== 'W');
  e.sets.splice(at < 0 ? 0 : at, 0, ...list.map((w) => ({ ...newSet('W'), kg: String(w.kg), reps: String(w.reps) })));
  save();
  refreshBlock(i);
  toast(`${t('{n} serie di riscaldamento verso', { n: list.length })} ${fmtNum(work, 2)} kg`);
}

function toggleDone(i, j) {
  const a = act();
  const e = a.exercises[i];
  const s = e.sets[j];
  if (s.done) {
    s.done = false;
    save();
    return refreshBlock(i);
  }
  const p = suggestSet(e.exId, e.sets, j, e.target);
  if (String(s.kg).trim() === '' && p) s.kg = String(p.kg);
  if (String(s.reps).trim() === '') {
    if (p?.reps) s.reps = String(p.reps);
    else {
      const target = parseInt(e.target, 10);
      if (target > 0) s.reps = String(target);
    }
  }
  if (!(toNum(s.reps) > 0)) {
    toast(t('Inserisci le ripetizioni'));
    return;
  }
  if (String(s.kg).trim() === '') s.kg = '0';
  if (isNaN(toNum(s.kg))) return toast(t('Peso non valido'));
  s.done = true;
  justDone = [i, j];
  haptic(15);
  save();
  // nel superset il recupero parte dopo l'ultimo esercizio del gruppo
  if (!e.superset) startRest(e.rest);
  refreshBlock(i);
}

register(
  {
    'w-done': (el) => toggleDone(...ij(el)),
    'w-prev': (el) => {
      const [i, j] = ij(el);
      const e = act().exercises[i];
      const p = suggestSet(e.exId, e.sets, j, e.target)?.prev;
      if (!p) return;
      Object.assign(e.sets[j], { kg: String(p.kg), reps: String(p.reps) });
      save();
      rerender();
    },
    'w-add-set': (el) => {
      const e = act().exercises[Number(el.dataset.i)];
      const last = e.sets.at(-1);
      const s = newSet(last && last.type !== 'W' ? last.type : 'N');
      if (last) {
        s.kg = last.kg;
        s.reps = last.reps;
      }
      e.sets.push(s);
      justAdded = [Number(el.dataset.i), e.sets.length - 1];
      save();
      rerender();
    },
    'w-set-menu': (el) => {
      const [i, j] = ij(el);
      const e = act().exercises[i];
      const s = e.sets[j];
      actionSheet(`${t('Serie')} ${j + 1}`, [
        ...Object.entries(SET_TYPES).map(([k, t]) => ({
          label: t.label,
          icon: t.short || '#',
          active: s.type === k,
          fn: () => {
            s.type = k;
            save();
            rerender();
          },
        })),
        {
          label: t('Elimina serie'),
          icon: I.trash,
          danger: true,
          fn: () => {
            e.sets.splice(j, 1);
            save();
            rerender();
          },
        },
      ]);
    },
    'w-ex-menu': (el) => {
      const i = Number(el.dataset.i);
      const a = act();
      const ex = a.exercises;
      const e = ex[i];
      const after = () => {
        save();
        rerender();
      };
      actionSheet(getExercise(e.exId).name, [
        { label: t('Come si esegue'), icon: I.info, fn: () => openGuide(e.exId) },
        { label: t('Aggiungi serie di riscaldamento'), icon: I.flame, fn: () => addWarmups(i) },
        { label: e.showNotes || e.notes ? t('Nascondi note') : t('Aggiungi nota'), icon: I.note, fn: () => { e.showNotes = !(e.showNotes || e.notes); if (!e.showNotes) e.notes = ''; after(); } },
        {
          label: `${t('Recupero:')} ${restLabel(e.rest)}`,
          icon: I.clock,
          fn: () => actionSheet(t('Tempo di recupero'), REST_OPTIONS.map((s) => ({ label: restLabel(s), active: s === e.rest, fn: () => { e.rest = s; after(); } }))),
        },
        i < ex.length - 1 && { label: e.superset ? t('Scollega dal superset') : t('Superset con il successivo'), icon: I.link, fn: () => { e.superset = !e.superset; after(); } },
        { label: t('Sostituisci esercizio'), icon: I.swap, fn: () => openPicker({ multi: false, title: t('Sostituisci'), onPick: ([id]) => { e.exId = id; after(); } }) },
        {
          label: t('Rimuovi esercizio'),
          icon: I.trash,
          danger: true,
          fn: () => {
            if (i > 0 && ex[i - 1].superset && !e.superset) ex[i - 1].superset = false;
            ex.splice(i, 1);
            after();
          },
        },
      ]);
    },
    'w-add-ex': () =>
      openPicker({
        onPick: (ids) => {
          ids.forEach((exId) => {
            const lp = lastPerformance(exId);
            const n = lp ? lp.exercise.sets.length : 3;
            act().exercises.push({
              exId,
              rest: lp?.exercise.rest ?? state.settings.defaultRest,
              superset: false,
              target: '',
              notes: '',
              sets: Array.from({ length: n }, (_, k) => newSet(lp ? lp.exercise.sets[k].type : 'N')),
            });
          });
          save();
          rerender();
        },
      }),
    'w-finish': async () => {
      const a = act();
      const done = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
      if (!done) {
        if (await confirmDialog(t('Non hai completato nessuna serie. Vuoi scartare questo allenamento?'), { okText: t('Scarta'), danger: true })) {
          state.active = null;
          save();
          stopRest();
          go('#/');
        }
        return;
      }
      const pending = a.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
      const msg = pending
        ? t('Ci sono {n} serie non completate: verranno scartate.', { n: pending })
        : t('Ottimo lavoro! Salvo l\'allenamento?');
      if (!(await confirmDialog(msg, { title: t('Terminare l\'allenamento?'), okText: t('Termina e salva') }))) return;
      const w = finishActive();
      stopRest();
      // il riepilogo si apre dopo il cambio pagina (che chiude i modal)
      go(`#/history/${w.id}`, () => showSummary(w));
    },
    'w-discard': async () => {
      if (await confirmDialog(t('Tutti i dati di questo allenamento andranno persi.'), { title: t('Annullare l\'allenamento?'), okText: t('Annulla allenamento'), danger: true })) {
        state.active = null;
        save();
        stopRest();
        go('#/');
      }
    },
  },
  {
    'w-set': (el) => {
      const [i, j] = ij(el);
      act().exercises[i].sets[j][el.dataset.f] = el.value;
      save();
    },
    'w-name': (el) => {
      act().name = el.value;
      save();
    },
    'w-notes': (el) => {
      act().notes = el.value;
      save();
    },
    'w-ex-notes': (el) => {
      act().exercises[Number(el.dataset.i)].notes = el.value;
      save();
    },
  },
  {
    'w-rpe': (el) => {
      const [i, j] = ij(el);
      act().exercises[i].sets[j].rpe = el.value;
      save();
    },
  }
);

/** Battiti arrivati da Salute: il riepilogo ancora aperto mostra grafico e zone */
window.addEventListener('rep:hr', (e) => {
  const box = document.getElementById('sum-hr');
  const w = state.workouts.find((x) => x.id === e.detail?.id);
  if (box && w?.hr && box.dataset.id === w.id) box.innerHTML = hrSection(w);
});

function showSummary(w) {
  const vol = workoutVolume(w);
  const prs = w.prs || [];
  openModal(`
    <div class="summary">
      <div class="summary-badge">${prs.length ? I.trophy : I.check}</div>
      <div class="label">${prs.length ? `${t('{n} nuovi record', { n: prs.length })}` : t('Allenamento salvato')}</div>
      <h2>${prs.length ? t('Nuovo record!') : t('Grande lavoro')}</h2>
      <div class="stat-grid">
        <div class="stat"><b>${fmtDuration(w.end - w.start)}</b><span>${t('Durata')}</span></div>
        <div class="stat">${count(vol, 0)}<span>${t('kg volume')}</span></div>
        <div class="stat">${count(workoutSetCount(w), 0)}<span>${t('Serie')}</span></div>
      </div>
      ${prs.length ? `<h3>${t('Record personali')}</h3><div class="pr-list">${prs.map((p, k) => `
        <div class="pr-item" style="--i:${k}"><span><span class="pr-name">${esc(getExercise(p.exId).name)}</span><br>
        <span class="label">${PR_LABELS[p.kind]}</span></span>
        <b>${fmtNum(p.value, 1)}${p.kind === 'reps' ? '' : ' kg'}</b></div>`).join('')}</div>` : ''}
      ${w.hr ? `<div class="card hr-card sum-hr" id="sum-hr" data-id="${w.id}">${hrSection(w)}</div>`
        : isNative ? `<div class="card hr-card sum-hr" id="sum-hr" data-id="${w.id}"><div class="muted small">${I.heart} ${t('Battito in arrivo da Salute…')}</div></div>` : ''}
      <div class="row-2">
        <button class="btn btn-outline btn-block" data-action="share-workout" data-id="${w.id}">${I.share} ${t('Condividi')}</button>
        <button class="btn btn-primary btn-block" data-action="modal-close">${t('Chiudi')}</button>
      </div>
    </div>`);
  const m = document.querySelector('#modal-root .summary');
  countUps(m);
  if (prs.length) setTimeout(() => burst(m, 44), 350);
  else setTimeout(() => burst(m, 18), 350);
}
