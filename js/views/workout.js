import { state, save } from '../store.js';
import { hrSection } from '../hr.js';
import { isNative } from '../native.js';
import { register, go, rerender, confirmDialog, actionSheet, toast, openModal, getPath } from '../ui.js';
import { getExercise } from '../exercises.js';
import { openPicker } from '../picker.js';
import { startRest, stopRest, beep, vibrate, unlockAudio } from '../timer.js';
import { startClock, stopClock, afterStop, clockNow, clockLabel, parseSecs, fmtSecs, defaultMode } from '../clock.js';
import {
  newSet, setLabels, lastPerformance, finishActive, workoutVolume, workoutSetCount, SET_TYPES, PR_LABELS, prLabel,
  suggestSet, warmupSets, isDeloadWeek, currentSet,
  sideLabel, setUnilateral, isBW, bodyWeightAt,
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

/** Sotto il nome: "8-12 rip", "A tempo · obiettivo 1:00", "Max rip in 0:45", "8 × 0:20 / 0:10" */
function modeSub(e) {
  if (e.mode === 'hold') return ` · ${t('A tempo')}${e.dur ? ` · ${t('obiettivo {x}', { x: fmtSecs(e.dur) })}` : ''}`;
  if (e.mode === 'amrap') return ` · ${t('Max rip in {x}', { x: fmtSecs(e.dur || 60) })}`;
  if (e.mode === 'int') return ` · ${e.sets.length} × ${fmtSecs(e.work || 20)} / ${fmtSecs(e.pause ?? 10) || '0:00'}`;
  return e.target ? ` · ${esc(e.target)} ${t('rip')}` : '';
}

/** Ultima colonna della serie: ✓ per le serie a ripetizioni, ▶ / ■ per quelle a tempo */
function setButton(e, s, i, j, mode, clk, running) {
  const done = `<button class="set-done" data-action="w-done" data-i="${i}" data-j="${j}" aria-label="${t('Completa serie')}">${I.check}</button>`;
  if (mode === 'reps' || mode === 'int' || s.done) return done;
  if (running) return `<button class="set-done set-stop" data-action="w-clock-stop" aria-label="${t('Ferma')}"><i class="stop-sq"></i></button>`;
  if (mode === 'hold' && parseSecs(s.secs) > 0) return done;
  if (mode === 'amrap' && (String(s.reps).trim() !== '' || parseSecs(s.secs) > 0)) return done; // tempo finito: si scrivono le ripetizioni
  return `<button class="set-done set-play" data-action="w-clock" data-i="${i}" data-j="${j}" ${clk ? 'disabled' : ''} aria-label="${t('Avvia')}">${I.play}</button>`;
}

/** Riquadro del tempo che scorre (e pulsante "Avvia" degli intervalli) */
function clockPanel(e, i, mode, clk) {
  if (clk) {
    const st = clockNow(clk);
    const label = clk.kind === 'up' ? (e.dur ? t('Obiettivo {x}', { x: fmtSecs(e.dur) }) : t('Tieni finché cedi'))
      : clk.kind === 'down' ? t('Più ripetizioni che puoi') : '';
    return `<div class="clock-panel kind-${clk.kind} ${st.phase === 'pause' ? 'is-pause' : ''}" data-clock-panel>
      <div class="clock-big" data-clock-big>${fmtClock(st.show)}</div>
      <div class="clock-sub" data-clock-sub>${clk.kind === 'int' ? esc(clockLabel(clk).replace(/ \d+:\d\d/, '')) : label}</div>
      <button class="btn btn-small clock-stop" data-action="w-clock-stop">${t('Stop')}</button>
    </div>`;
  }
  if (mode === 'int' && e.sets.some((s) => !s.done)) {
    return `<button class="btn btn-primary btn-block int-start" data-action="w-clock" data-i="${i}" data-j="0">${I.play} ${e.sets.some((s) => s.done) ? t('Riprendi intervalli') : t('Avvia intervalli')}</button>`;
  }
  return '';
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
  const mode = e.mode || 'reps';
  const showRpe = !!e.rpe && mode !== 'int'; // colonna RPE/RIR solo sugli esercizi dove l'hai attivata
  const clk = a.clock && a.clock.i === i ? a.clock : null; // tempo che scorre su questo esercizio
  const bw = isBW(e); // corpo libero: il campo kg è la zavorra (+kg), il carico è peso corporeo + zavorra
  const myKg = bw ? bodyWeightAt(a.start) : 0;
  const plus = (v) => (!bw ? fmtNum(v, 2) : Number(v) < 0 ? `−${fmtNum(-v, 2)}` : `+${fmtNum(Number(v) || 0, 2)}`);
  const lastNote = lastPerformance(e.exId)?.exercise.notes || '';

  const rows = e.sets
    .map((s, j) => {
      const g = sugs[j];
      const p = g?.prev;
      const prevTxt = !p ? '—'
        : mode === 'hold' ? `${p.kg ? `${plus(p.kg)}·` : ''}${fmtSecs(p.secs) || '—'}`
        : `${plus(p.kg)}×${p.reps}`;
      const running = clk && (clk.kind === 'int' ? j >= clk.j && !s.done : clk.j === j);
      const jd = justDone && justDone[0] === i && justDone[1] === j ? 'just-done' : '';
      const ja = justAdded && justAdded[0] === i && justAdded[1] === j ? 'added' : '';
      return `
      <div class="set-row ${s.done ? 'done' : ''} ${jd} ${ja} type-${s.type} ${showRpe ? '' : 'no-rpe'} ${s.side ? `side-${s.side}` : ''}">
        <button class="set-num" data-action="w-set-menu" data-i="${i}" data-j="${j}">${labels[j]}${s.side ? `<small>${sideLabel(s)}</small>` : ''}</button>
        <button class="set-prev" data-action="w-prev" data-i="${i}" data-j="${j}" ${p ? '' : 'disabled'}>${prevTxt}</button>
        <input class="set-in ${g?.up ? 'up' : ''} ${g?.deload ? 'deload' : ''}" inputmode="decimal" enterkeyhint="next" value="${esc(s.kg)}" placeholder="${g ? plus(g.kg) : bw ? '+0' : 'kg'}" data-input="w-set" data-f="kg" data-i="${i}" data-j="${j}" aria-label="kg">
        ${mode === 'hold'
    ? (running ? `<span class="set-in clock-cell" data-clock-cell>${clockLabel(clk)}</span>`
      : `<input class="set-in set-time" inputmode="text" enterkeyhint="done" value="${esc(fmtSecs(parseSecs(s.secs)))}" placeholder="${fmtSecs(g?.prev?.secs) || (e.dur ? fmtSecs(e.dur) : '0:00')}" data-input="w-set" data-f="secs" data-i="${i}" data-j="${j}" aria-label="${t('tempo')}">`)
    : `<input class="set-in" inputmode="numeric" enterkeyhint="done" value="${esc(s.reps)}" placeholder="${g ? g.reps : mode === 'int' ? '–' : esc(targetReps) || 'rip'}" data-input="w-set" data-f="reps" data-i="${i}" data-j="${j}" aria-label="${t('ripetizioni')}">`}
        ${showRpe ? `<select class="set-rpe" data-change="w-rpe" data-i="${i}" data-j="${j}" aria-label="${effortLabel}">
          <option value=""></option>${effortVals.map((v) => `<option ${String(s.rpe) === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>` : ''}
        ${setButton(e, s, i, j, mode, clk, running)}
      </div>`;
    })
    .join('');

  return `
  <section class="ex-block ${e.skipped ? 'skipped' : ''}" data-ex="${i}" data-drag="wex">
    <div class="ex-head">
      <button class="drag-handle" data-drag-handle aria-label="${t('Tieni premuto e trascina per spostare')}">${I.grip}</button>
      <img class="ex-thumb" data-thumb="${e.exId}" alt="" data-action="ex-guide" data-id="${e.exId}">
      <div class="ex-title" data-drag-hold data-action="go" data-to="#/stats/ex/${e.exId}">
        <div class="ex-name ${nameSize(ex.name)}">${esc(ex.name)}</div>
        ${e.skipped ? `<div class="label skip-tag">${t('Saltato')}</div>` : ''}
        <div class="label ex-sub">${esc(tn(ex.muscle))}${modeSub(e)} · ${I.clock} ${restLabel(e.rest)}${bw ? ` · <span class="bw-tag">${myKg ? t('corpo {x} kg + zavorra', { x: fmtNum(myKg, 1) }) : t('zavorra')}</span>` : ''}${e.uni ? ` · <span class="uni-tag">${t('DX / SX')}</span>` : ''}</div>
        ${up ? `<div class="label prog-up">${I.up} +${fmtNum(state.settings.increment || 2.5, 2)} ${t('kg proposti')}</div>` : ''}
        ${isDeloadWeek() && sugs.some((g) => g?.deload) ? `<div class="label prog-deload">${t('Settimana di scarico: pesi proposti al 60%')}</div>` : ''}
      </div>
      <button class="icon-btn guide-btn" data-action="ex-guide" data-id="${e.exId}" aria-label="${t('Come si esegue')}">${I.info}</button>
      <button class="icon-btn" data-action="w-ex-menu" data-i="${i}" aria-label="${t('Opzioni esercizio')}">${I.more}</button>
    </div>
    <textarea class="input note-in" rows="1" placeholder="${lastNote ? esc(t('Ultima volta: {x}', { x: lastNote })) : t('Note sull\'esercizio…')}" data-input="w-ex-notes" data-i="${i}">${esc(e.notes)}</textarea>
    ${clockPanel(e, i, mode, clk)}
    <div class="set-row set-head ${showRpe ? '' : 'no-rpe'}"><span>${mode === 'int' ? t('Giro') : t('Serie')}</span><span>${t('Prec.')}</span><span>${bw ? '+kg' : 'kg'}</span><span>${mode === 'hold' ? t('Tempo') : t('Rip')}</span>${showRpe ? `<span>${effortLabel}</span>` : ''}<span></span></div>
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
  // scrivere in un altro esercizio lo rende quello attuale (Live Activity e orologio lo seguono)
  const blk = el.closest('.ex-block');
  const a = act();
  if (blk && a && el.matches('.set-in') && Number(blk.dataset.ex) !== (a.cur ?? 0)) {
    a.cur = Number(blk.dataset.ex);
    save();
  }
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
  const c = currentSet(act());
  const row = c && document.querySelectorAll(`.ex-block[data-ex="${c[0]}"] .set-row:not(.set-head)`)[c[1]];
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.remove('next-up');
  void row.offsetWidth;
  row.classList.add('next-up');
  setTimeout(() => row.classList.remove('next-up'), 2400);
});

/* ---------- Tempo che scorre (a tempo, max rip in tempo, intervalli) ---------- */

let lastPhase = null; // fase/giro precedente degli intervalli, per il bip al cambio
let goalBeeped = false;

/** Ferma il tempo e fa partire quello che serve dopo (serie fatta, recupero, ripetizioni da scrivere) */
function finishClock(auto = false) {
  const a = act();
  const c = a?.clock;
  if (!c) return;
  const e = a.exercises[c.i];
  const res = stopClock();
  lastPhase = null;
  goalBeeped = false;
  if (!res || !e) return rerender();
  if (auto) {
    beep();
    vibrate([300, 150, 300]);
  } else haptic(20);
  if (res.kind === 'up' && e.sets[res.j]?.done) justDone = [res.i, res.j];
  afterStop(res);
  refreshBlock(res.i);
  if (res.kind === 'down') {
    // tempo scaduto: si scrivono le ripetizioni fatte
    const inp = document.querySelector(`.ex-block[data-ex="${res.i}"] input[data-f="reps"][data-j="${res.j}"]`);
    inp?.focus();
    toast(t('Tempo! Quante ripetizioni hai fatto?'));
  }
}

function clockTick() {
  const a = act();
  const c = a?.clock;
  if (!c) return;
  const st = clockNow(c);
  if (st.done) return finishClock(true);
  // intervalli: bip a ogni cambio lavoro/pausa e giri spuntati man mano
  if (c.kind === 'int') {
    const key = `${st.phase}-${st.round}`;
    if (lastPhase && lastPhase !== key) {
      beep();
      vibrate(st.phase === 'work' ? [200, 100, 200] : 250);
      const e = a.exercises[c.i];
      for (let k = 0; k < (st.completed || 0); k++) {
        const s = e?.sets[c.from + k];
        if (s && !s.done) {
          s.done = true;
          s.secs = String(c.work);
          if (String(s.kg).trim() === '') s.kg = '0';
        }
      }
      save();
      if (getPath() === '/workout') refreshBlock(c.i);
    }
    lastPhase = key;
  }
  // ultimi 3 secondi del conto alla rovescia: vibrazione breve
  if ((c.kind === 'down' || c.kind === 'int') && st.show <= 3.05 && st.show > 0 && Math.abs(st.show - Math.round(st.show)) < 0.13) vibrate(60);
  // a tempo con obiettivo: un bip quando lo raggiungi (il cronometro continua)
  if (c.kind === 'up') {
    const goal = a.exercises[c.i]?.dur;
    if (goal && st.elapsed >= goal && !goalBeeped) {
      goalBeeped = true;
      beep();
      vibrate([200, 100, 200]);
    }
  }
  if (getPath() !== '/workout') return;
  const big = document.querySelector('[data-clock-big]');
  if (big) big.textContent = fmtClock(st.show);
  const sub = document.querySelector('[data-clock-sub]');
  if (sub && c.kind === 'int') sub.textContent = clockLabel(c).replace(/ \d+:\d\d/, '');
  document.querySelector('[data-clock-panel]')?.classList.toggle('is-pause', st.phase === 'pause');
  const cell = document.querySelector('[data-clock-cell]');
  if (cell) cell.textContent = fmtClock(st.show);
}
setInterval(clockTick, 250);
document.addEventListener('visibilitychange', clockTick);
// cambi fatti da orologio o Live Activity
window.addEventListener('rep:clock-remote', () => { lastPhase = null; if (getPath() === '/workout') rerender(); });

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

/** Salta un esercizio: resta nell'elenco (attenuato) e si passa al successivo; le serie non fatte non si salvano */
function skipExercise(i) {
  const a = act();
  a.exercises[i].skipped = true;
  if ((a.cur ?? 0) === i) {
    const next = currentSet({ ...a, cur: i + 1 < a.exercises.length ? i + 1 : 0 });
    a.cur = next ? next[0] : i;
  }
  save();
  rerender();
  toast(t('Esercizio saltato'));
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
  if (e.mode === 'hold' || e.mode === 'int') {
    // a tempo: serve il tempo (scritto o dal cronometro); intervalli: le ripetizioni sono facoltative
    if (e.mode === 'hold' && !(parseSecs(s.secs) > 0)) {
      if (p?.prev?.secs) s.secs = String(p.prev.secs);
      else return toast(t('Avvia il cronometro o scrivi il tempo'));
    }
    if (e.mode === 'int' && !s.secs) s.secs = String(e.work || 20);
    if (String(s.kg).trim() === '') s.kg = '0';
    s.done = true;
    a.cur = i;
    justDone = [i, j];
    haptic(15);
    save();
    if (!e.superset && (e.mode === 'hold' || e.sets.every((x) => x.done))) startRest(e.rest);
    return refreshBlock(i);
  }
  if (e.mode === 'amrap' && !(parseSecs(s.secs) > 0)) s.secs = String(e.dur || 60);
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
  a.cur = i; // la Live Activity e l'orologio seguono l'esercizio su cui stai lavorando
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
    'w-clock': (el) => {
      unlockAudio();
      const [i, j] = ij(el);
      if (act().clock) return;
      startClock(i, j);
      lastPhase = null;
      haptic(20);
      refreshBlock(i);
    },
    'w-clock-stop': () => finishClock(),
    'w-prev': (el) => {
      const [i, j] = ij(el);
      const e = act().exercises[i];
      const p = suggestSet(e.exId, e.sets, j, e.target)?.prev;
      if (!p) return;
      Object.assign(e.sets[j], { kg: String(p.kg), reps: String(p.reps) }, p.secs && e.mode === 'hold' ? { secs: String(p.secs) } : {});
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
      if (e.uni) {
        // monopodalico: si aggiunge la coppia destra + sinistra
        const r = e.sets.findLast((x) => x.side === 'R');
        e.sets.push({ ...s, side: 'R', kg: r?.kg ?? s.kg, reps: r?.reps ?? s.reps }, { ...s, side: 'L' });
      } else e.sets.push(s);
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
        // corpo libero: "assistito" toglie peso (elastico, macchina per trazioni): zavorra negativa
        isBW(e) && {
          label: toNum(s.kg) < 0 ? t('Zavorra (aggiungi peso)') : t('Assistito (togli peso)'),
          icon: '±',
          fn: () => {
            const v = toNum(s.kg);
            s.kg = v ? String(-v) : '-10';
            save();
            rerender();
          },
        },
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
        e.skipped
          ? { label: t('Riprendi esercizio'), icon: I.repeat, fn: () => { e.skipped = false; a.cur = i; after(); } }
          : e.sets.some((s) => !s.done) && { label: t('Salta esercizio'), icon: I.chevron, fn: () => skipExercise(i) },
        { label: t('Come si esegue'), icon: I.info, fn: () => openGuide(e.exId) },
        { label: t('Aggiungi serie di riscaldamento'), icon: I.flame, fn: () => addWarmups(i) },
        { label: e.rpe ? t('Togli la colonna {x}', { x: a.effort === 'rir' ? 'RIR' : 'RPE' }) : t('Segna {x} per ogni serie', { x: a.effort === 'rir' ? 'RIR' : 'RPE' }), icon: I.flame, active: !!e.rpe, fn: () => { e.rpe = !e.rpe; after(); } },
        { label: e.uni ? t('Due lati insieme') : t('Monopodalico (DX / SX)'), icon: I.swap, active: !!e.uni, fn: () => { setUnilateral(e, !e.uni); after(); } },
        { label: isBW(e) ? t('Togli zavorra (kg normali)') : t('Zavorra (peso corporeo + kg)'), icon: I.weight, active: isBW(e), fn: () => { e.bw = !isBW(e); after(); } },
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
            // come l'ultima volta: stesse serie, lati DX/SX e colonna RPE
            act().exercises.push({
              exId,
              rest: lp?.exercise.rest ?? state.settings.defaultRest,
              superset: false,
              target: '',
              notes: '',
              rpe: !!lp?.exercise.rpe,
              uni: !!lp?.exercise.uni,
              ...(lp?.exercise.mode ? { mode: lp.exercise.mode, dur: lp.exercise.dur, work: lp.exercise.work, pause: lp.exercise.pause }
                : defaultMode(exId) !== 'reps' ? { mode: defaultMode(exId) } : {}),
              sets: Array.from({ length: n }, (_, k) => {
                const p = lp?.exercise.sets[k];
                return p?.side ? { ...newSet(p.type), side: p.side } : newSet(p ? p.type : 'N');
              }),
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
      const pending = a.exercises.reduce((n, e) => n + (e.skipped ? 0 : e.sets.filter((s) => !s.done).length), 0);
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
        <span class="label">${prLabel(p)}</span></span>
        <b>${p.kind === 'secs' ? fmtSecs(p.value) : `${p.bw ? '+' : ''}${fmtNum(p.value, 1)}${p.kind === 'reps' ? '' : ' kg'}`}</b></div>`).join('')}</div>` : ''}
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
