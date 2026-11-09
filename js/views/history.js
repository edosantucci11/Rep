import { state, save, markDeleted } from '../store.js';
import { hrSection } from '../hr.js';
import { register, go, rerender, confirmDialog, toast } from '../ui.js';
import { getExercise } from '../exercises.js';
import { fmtSecs } from '../clock.js';
import { workoutVolume, workoutSetCount, setLabels, sideLabel, weekStreak, startFromWorkout, PR_LABELS, prLabel, workingSets, isBW } from '../logic.js';
import { esc, fmtDate, fmtDateLong, fmtTime, fmtDuration, fmtNum, dayKey, MONTHS, uid, e1rm } from '../utils.js';
import { groupsOf } from './workout.js';
import { I } from '../icons.js';
import { count } from '../utils.js';
import { isNative, attachHeartRate } from '../native.js';
import { t, tn } from '../i18n.js';

let cal = null; // {y, m}

function calendar() {
  const now = new Date();
  if (!cal) cal = { y: now.getFullYear(), m: now.getMonth() };
  const first = new Date(cal.y, cal.m, 1);
  const days = new Date(cal.y, cal.m + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const byDay = new Map();
  for (const w of state.workouts) {
    const k = dayKey(w.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(w);
  }
  const today = dayKey(now);
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const k = dayKey(new Date(cal.y, cal.m, d));
    const ws = byDay.get(k);
    cells += ws
      ? `<button class="cal-day has" style="--d:${d}" data-action="go" data-to="#/history/${ws[0].id}" title="${esc(ws.map((w) => w.name).join(', '))}">${d}</button>`
      : `<span class="cal-day ${k === today ? 'today' : ''}">${d}</span>`;
  }
  const monthCount = state.workouts.filter((w) => {
    const x = new Date(w.start);
    return x.getFullYear() === cal.y && x.getMonth() === cal.m;
  }).length;
  return `
  <div class="card">
    <div class="cal-head">
      <button class="icon-btn" data-action="cal-nav" data-d="-1" aria-label="${t('Mese precedente')}">${I.back}</button>
      <div><b>${MONTHS[cal.m]} ${cal.y}</b><div class="label">${t('{n} allenamenti', { n: monthCount })}</div></div>
      <button class="icon-btn" data-action="cal-nav" data-d="1" aria-label="${t('Mese successivo')}">${I.chevron}</button>
    </div>
    <div class="cal-grid">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((x) => `<span class="cal-dow">${x}</span>`).join('')}${cells}</div>
  </div>`;
}

/** Testo della serie nello storico: "100 kg × 8", "1:05" (a tempo), "22 rip in 0:45", giro degli intervalli */
export function setText(e, s) {
  const kg = s.kg > 0 ? `<b>${fmtNum(s.kg, 2)}</b> kg` : '';
  if (e.mode === 'hold') return `${kg ? `${kg} · ` : ''}<b>${fmtSecs(s.secs) || '–'}</b>`;
  if (e.mode === 'amrap') return `${kg ? `${kg} × ` : ''}<b>${s.reps}</b> ${t('rip')} <span class="muted">${t('in {x}', { x: fmtSecs(s.secs || e.dur || 60) })}</span>`;
  if (e.mode === 'int') return s.reps ? `${kg ? `${kg} × ` : ''}<b>${s.reps}</b> ${t('rip')}` : `<b>${fmtSecs(s.secs || e.work || 20)}</b>`;
  if (isBW(e)) {
    // corpo libero: "+10 kg × 8" con il carico vero (peso corporeo del giorno + zavorra)
    const z = s.kg > 0 ? `+${fmtNum(s.kg, 2)}` : s.kg < 0 ? `−${fmtNum(-s.kg, 2)}` : '';
    const load = e.bwKg ? ` <span class="muted xsmall">${t('carico {x} kg', { x: fmtNum(Math.max(0, e.bwKg + (s.kg || 0)), 1) })}</span>` : '';
    return `${z ? `<b>${z}</b> ${t('kg ×')} ` : `${t('corpo ×')} `}<b>${s.reps}</b>${load}`;
  }
  return `<b>${fmtNum(s.kg, 2)}</b> ${t('kg ×')} <b>${s.reps}</b>`;
}

export function workoutCard(w) {
  const prs = (w.prs || []).length;
  const lines = w.exercises
    .slice(0, 5)
    .map((e) => `<div class="wc-line"><span>${e.sets.length} × ${esc(getExercise(e.exId).name)}</span></div>`)
    .join('');
  return `
  <div class="card workout-card" data-action="go" data-to="#/history/${w.id}">
    <div class="wc-head"><span class="wc-title">${esc(w.name)}</span>${prs ? `<span class="tag tag-pr">${I.trophy} ${prs} PR</span>` : ''}</div>
    <div class="label" style="margin-top:4px">${fmtDateLong(w.start)}</div>
    <div class="wc-stats"><span>${I.clock} ${fmtDuration(w.end - w.start)}</span><span>${I.weight} ${fmtNum(workoutVolume(w), 0)} kg</span><span>${I.sets} ${workoutSetCount(w)}</span></div>
    ${lines}${w.exercises.length > 5 ? `<div class="muted xsmall">${t('+ altri')} ${w.exercises.length - 5}</div>` : ''}
  </div>`;
}

export function render() {
  const streak = weekStreak();
  const cal0 = calendar();
  const list = state.workouts.filter((w) => {
    const x = new Date(w.start);
    return cal ? x.getFullYear() === cal.y && x.getMonth() === cal.m : true;
  });
  return `
  <header class="page-head"><h1>${t('Storico')}</h1></header>
  <div class="stat-grid">
    <div class="stat">${count(streak)}<span>${t('settimane di fila')}</span></div>
    <div class="stat">${count(state.workouts.length)}<span>${t('allenamenti totali')}</span></div>
  </div>
  ${cal0}
  <div class="section-head"><h2>${MONTHS[cal.m]}</h2></div>
  ${list.length ? `<div class="stagger">${list.map(workoutCard).join('')}</div>` : `<div class="empty small">${t('Nessun allenamento in questo mese.')}</div>`}
  `;
}

/** Battiti dell'allenamento (dall'app iPhone con Salute / Apple Watch) */
function hrCard(w) {
  if (!w.hr) {
    return isNative ? `<button class="btn btn-block btn-outline" data-action="w-hr" data-id="${w.id}">${I.heart} ${t('Leggi i battiti da Salute')}</button>` : '';
  }
  return `<div class="card hr-card">${hrSection(w)}</div>`;
}

export function renderDetail(id) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return `<div class="empty">${t('Allenamento non trovato.')}<br><button class="btn" data-action="go" data-to="#/history">${t('Torna allo storico')}</button></div>`;
  const effort = w.effort === 'rir' ? 'RIR' : 'RPE';
  const prsBy = new Map();
  for (const p of w.prs || []) {
    if (!prsBy.has(p.exId)) prsBy.set(p.exId, []);
    prsBy.get(p.exId).push(p);
  }
  const block = (e) => {
    const modeTag = e.mode === 'hold' ? t('A tempo') : e.mode === 'amrap' ? t('Max rip in {x}', { x: fmtSecs(e.dur || 60) })
      : e.mode === 'int' ? `${t('Intervalli')} · ${fmtSecs(e.work || 20)} / ${fmtSecs(e.pause ?? 10) || '0:00'}` : '';
    const ex = getExercise(e.exId);
    const labels = setLabels(e.sets);
    const prs = prsBy.get(e.exId) || [];
    return `
    <div class="detail-ex">
      <div class="ex-name" data-action="go" data-to="#/stats/ex/${e.exId}">${esc(ex.name)} ${I.chevron}</div>
      ${prs.length ? `<div class="pr-tags">${prs.map((p) => `<span class="tag tag-pr">${I.trophy} ${prLabel(p)}</span>`).join('')}</div>` : ''}
      ${modeTag ? `<div class="label">${esc(modeTag)}</div>` : ''}
      ${e.notes ? `<div class="muted small note">${I.note} ${esc(e.notes)}</div>` : ''}
      ${e.sets.map((s, j) => `
        <div class="detail-set type-${s.type}">
          <span class="set-num static">${labels[j]}${s.side ? `<small>${sideLabel(s)}</small>` : ''}</span>
          <span class="ds-main">${setText(e, s)}${s.rpe != null ? ` <span class="muted">@${effort} ${s.rpe}</span>` : ''}</span>
          <span class="muted xsmall">${!e.mode && !isBW(e) && s.type !== 'W' && s.kg > 0 ? `${t('1RM ~')}${fmtNum(e1rm(s.kg, s.reps), 0)}` : ''}</span>
        </div>`).join('')}
    </div>`;
  };
  const blocks = groupsOf(w.exercises)
    .map((g) => (g.length > 1
      ? `<div class="superset-group"><div class="superset-label">${I.link} ${t('Superset')}</div>${g.map((i) => block(w.exercises[i])).join('')}</div>`
      : block(w.exercises[g[0]])))
    .join('');

  return `
  <header class="page-head with-back">
    <button class="icon-btn" data-action="go" data-to="#/history" aria-label="${t('Indietro')}">${I.back}</button>
    <h1 class="ellipsis">${esc(w.name)}</h1><span></span>
  </header>
  <div class="label center">${fmtDateLong(w.start)} · ${fmtTime(w.start)}–${fmtTime(w.end)}</div>
  <div class="stat-grid">
    <div class="stat"><b>${fmtDuration(w.end - w.start)}</b><span>${t('Durata')}</span></div>
    <div class="stat">${count(workoutVolume(w))}<span>${t('kg volume')}</span></div>
    <div class="stat">${count((w.prs || []).length)}<span>${t('Record')}</span></div>
  </div>
  ${w.notes ? `<div class="card note">${I.note} ${esc(w.notes)}</div>` : ''}
  ${hrCard(w)}
  <div class="card">${blocks}</div>
  <button class="btn btn-block btn-primary" data-action="w-repeat" data-id="${w.id}">${I.repeat} ${t('Ripeti allenamento')}</button>
  <button class="btn btn-block btn-outline" data-action="share-workout" data-id="${w.id}">${I.share} ${t('Condividi con un amico')}</button>
  <button class="btn btn-block btn-outline" data-action="w-to-routine" data-id="${w.id}">${t('Salva come scheda')}</button>
  <button class="btn btn-block btn-ghost danger-text" data-action="w-delete" data-id="${w.id}">${t('Elimina allenamento')}</button>
  `;
}

register({
  'w-hr': async (el) => {
    el.disabled = true;
    await attachHeartRate(el.dataset.id);
    el.disabled = false;
  },
  'cal-nav': (el) => {
    const d = new Date(cal.y, cal.m + Number(el.dataset.d), 1);
    cal = { y: d.getFullYear(), m: d.getMonth() };
    rerender();
  },
  'w-repeat': async (el) => {
    const w = state.workouts.find((x) => x.id === el.dataset.id);
    if (state.active && !(await confirmDialog(t('Hai già un allenamento in corso. Vuoi scartarlo?'), { okText: t('Scarta e inizia'), danger: true }))) return;
    startFromWorkout(w);
    go('#/workout');
  },
  'w-to-routine': (el) => {
    const w = state.workouts.find((x) => x.id === el.dataset.id);
    const r = {
      id: uid(),
      name: w.name,
      notes: '',
      exercises: w.exercises.map((e) => {
        const ws = workingSets(e.sets);
        const reps = ws.map((s) => s.reps);
        const min = Math.min(...reps), max = Math.max(...reps);
        return {
          exId: e.exId,
          sets: Math.max(1, ws.length),
          reps: reps.length ? (min === max ? String(min) : `${min}-${max}`) : '8-12',
          rest: e.rest ?? state.settings.defaultRest,
          superset: !!e.superset,
        };
      }),
    };
    state.routines.push(r);
    save();
    toast(t('Scheda creata'));
    go(`#/routine/${r.id}`);
  },
  'w-delete': async (el) => {
    if (!(await confirmDialog(t('L\'allenamento verrà eliminato definitivamente.'), { okText: t('Elimina'), danger: true }))) return;
    state.workouts = state.workouts.filter((x) => x.id !== el.dataset.id);
    markDeleted(el.dataset.id);
    save();
    go('#/history');
  },
});
