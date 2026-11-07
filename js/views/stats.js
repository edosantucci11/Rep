import { state } from '../store.js';
import { muscleMapSvg } from '../musclemap.js';
import { register, rerender } from '../ui.js';
import { getExercise, MUSCLES } from '../exercises.js';
import { lineChart } from '../chart.js';
import {
  weeklyMuscleSets, weekStreak, exercisesWithHistory, exerciseHistory, allTimeBests, workoutVolume, PR_LABELS, setLabels,
} from '../logic.js';
import { esc, fmtNum, fmtDate, startOfWeek, addDays, fmtDuration, relDays, count } from '../utils.js';
import { I } from '../icons.js';
import { guideHtml, activateGuide } from '../exguide.js';
import { t, tn } from '../i18n.js';

let weekOffset = 0;
let exQuery = '';
let metric = 'e1rm';
let range = 'all';

const METRICS = {
  e1rm: { label: t('1RM stimato'), unit: 'kg', get: (h) => h.e1rm },
  kg: { label: t('Peso max'), unit: 'kg', get: (h) => h.kg },
  volume: { label: t('Volume'), unit: 'kg', get: (h) => h.volume },
  reps: { label: t('Rip. max'), unit: 'rip', get: (h) => h.reps },
};
const RANGES = { '1m': ['1M', 30], '3m': ['3M', 91], '6m': ['6M', 182], '1y': ['1A', 365], all: ['Tutto', 0] };

function muscleVolume() {
  const ws = addDays(startOfWeek(Date.now()), weekOffset * 7);
  const data = weeklyMuscleSets(ws);
  const entries = MUSCLES.map((m) => [m, data[m] || 0]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(20, ...entries.map(([, n]) => n));
  const label = weekOffset === 0 ? t('Questa settimana') : weekOffset === -1 ? t('Settimana scorsa') :
    `${fmtDate(ws, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(ws, 6), { day: 'numeric', month: 'short' })}`;
  return `
  <div class="card">
    <div class="cal-head">
      <button class="icon-btn" data-action="mv-nav" data-d="-1" aria-label="${t('Settimana precedente')}">${I.back}</button>
      <div><b>${label}</b><div class="label">${t('serie allenanti per muscolo')}</div></div>
      <button class="icon-btn" data-action="mv-nav" data-d="1" ${weekOffset >= 0 ? 'disabled' : ''} aria-label="${t('Settimana successiva')}">${I.chevron}</button>
    </div>
    ${muscleMapSvg(data)}
    ${entries.length ? entries.map(([m, n], k) => `
      <div class="bar-row">
        <span class="bar-label">${m}</span>
        <div class="bar-track"><div class="bar-zone" style="left:${(10 / max) * 100}%;width:${(10 / max) * 100}%"></div>
          <div class="bar-fill ${n < 10 ? 'low' : n > 20 ? 'high' : ''}" style="width:${(n / max) * 100}%;--i:${k}"></div></div>
        <span class="bar-val">${n}</span>
      </div>`).join('') + '<div class="muted xsmall legend"><span class="legend-zone"></span> zona 10–20 serie/settimana (indicativa per l\'ipertrofia)</div>'
      : `<div class="empty small">${t('Nessuna serie in questa settimana.')}</div>`}
  </div>`;
}

export function render() {
  const now = Date.now();
  const weekWs = state.workouts.filter((w) => w.start >= startOfWeek(now).getTime());
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthCount = state.workouts.filter((w) => w.start >= monthStart).length;
  const avgDur = state.workouts.length
    ? state.workouts.slice(0, 20).reduce((a, w) => a + (w.end - w.start), 0) / Math.min(20, state.workouts.length)
    : 0;

  const prs = [];
  for (const w of state.workouts) {
    for (const p of w.prs || []) prs.push({ ...p, date: w.start, wid: w.id });
    if (prs.length >= 8) break;
  }

  const q = exQuery.toLowerCase();
  const exs = exercisesWithHistory()
    .map((e) => ({ ...e, ex: getExercise(e.exId) }))
    .filter((e) => !q || e.ex.name.toLowerCase().includes(q));

  return `
  <header class="page-head"><h1>${t('Progressi')}</h1></header>
  <div class="stat-grid four">
    <div class="stat">${count(weekStreak())}<span>${t('sett. di fila')}</span></div>
    <div class="stat">${count(monthCount)}<span>${t('questo mese')}</span></div>
    <div class="stat">${count(weekWs.reduce((a, w) => a + workoutVolume(w), 0) / 1000, 1, 't')}<span>${t('volume sett.')}</span></div>
    <div class="stat">${avgDur ? count(Math.round(avgDur / 60000), 0, "'") : '<b>–</b>'}<span>${t('durata media')}</span></div>
  </div>

  <div class="section-head"><h2>${t('Volume per muscolo')}</h2></div>
  ${muscleVolume()}

  <div class="section-head"><h2>${t('Record recenti')}</h2></div>
  ${prs.length ? `<div class="card">${prs.slice(0, 8).map((p) => `
    <div class="pr-item" data-action="go" data-to="#/stats/ex/${p.exId}">
      <span><span class="pr-name">${esc(getExercise(p.exId).name)}</span><br><span class="label">${PR_LABELS[p.kind]} · ${relDays(p.date)}</span></span>
      <b>${fmtNum(p.value, 1)}${p.kind === 'reps' ? '' : ' kg'}</b>
    </div>`).join('')}</div>` : `<div class="empty small">${t('I record personali compariranno qui quando superi i tuoi massimi.')}</div>`}

  <div class="section-head"><h2>${t('Esercizi')}</h2></div>
  <input class="input search" type="search" placeholder="${t('Cerca esercizio…')}" value="${esc(exQuery)}" data-input="stats-q">
  <div id="stats-ex-list">${exListHtml(exs)}</div>
  `;
}

function exListHtml(exs) {
  if (!exs.length) return `<div class="empty small">${t('Completa un allenamento per vedere i grafici dei tuoi esercizi.')}</div>`;
  return exs.map((e) => {
    const b = allTimeBests(e.exId);
    return `<button class="list-item" data-action="go" data-to="#/stats/ex/${e.exId}">
      <span><span class="li-title">${esc(e.ex.name)}</span><br><span class="label">${t('{n} sessioni', { n: e.count })} · ${relDays(e.last)}</span></span>
      <span class="right">${b.e1rm ? `<span class="li-val">${fmtNum(b.e1rm, 0)}</span><span class="label">${t('1RM kg')}</span>` : b.reps ? `<span class="li-val">${b.reps}</span><span class="label">${t('rip max')}</span>` : ''}</span>
    </button>`;
  }).join('');
}

export function renderExercise(exId) {
  const ex = getExercise(exId);
  setTimeout(() => activateGuide(document.getElementById('app')), 0);
  const hist = exerciseHistory(exId);
  const b = allTimeBests(exId);
  const days = RANGES[range][1];
  const from = days ? Date.now() - days * 86400000 : 0;
  const m = METRICS[metric];
  const points = hist.filter((h) => h.date >= from).map((h) => ({ x: h.date, y: m.get(h) }));
  const first = points[0]?.y, last = points.at(-1)?.y;
  const delta = points.length > 1 && first ? ((last - first) / first) * 100 : null;

  return `
  <header class="page-head with-back">
    <button class="icon-btn" data-action="back" aria-label="${t('Indietro')}">${I.back}</button>
    <h1 class="ex-title-h">${esc(ex.name)}</h1><span></span>
  </header>
  <div class="ex-tags">
    <span class="tag tag-pr">${esc(tn(ex.muscle))}</span>
    ${(ex.secondary || []).map((m) => `<span class="tag">${esc(tn(m))}</span>`).join('')}
    <span class="tag">${esc(tn(ex.equipment))}</span>
    ${ex.level ? `<span class="tag">${esc(ex.level)}</span>` : ''}
    ${ex.mechanic ? `<span class="tag">${esc(ex.mechanic)}</span>` : ''}
    ${ex.category && ex.category !== 'Forza' ? `<span class="tag">${esc(tn(ex.category))}</span>` : ''}
  </div>
  ${guideHtml(ex)}
  <div class="section-head"><h2>${t('I tuoi progressi')}</h2></div>

  <div class="stat-grid four">
    <div class="stat">${count(b.e1rm, 0)}<span>${t('1RM stimato')}</span></div>
    <div class="stat">${count(b.kg, 1)}<span>${t('peso max')}</span></div>
    <div class="stat">${count(b.vol, 0)}<span>${t('miglior serie')}</span></div>
    <div class="stat">${count(b.reps)}<span>${t('rip. max')}</span></div>
  </div>

  <div class="card">
    <div class="chips">${Object.entries(METRICS).map(([k, v]) => `<button class="chip ${k === metric ? 'active' : ''}" data-action="ex-metric" data-k="${k}">${v.label}</button>`).join('')}</div>
    ${delta !== null ? `<div class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(delta), 1)}${t('% nel periodo')}</div>` : ''}
    ${lineChart(points, { unit: m.unit })}
    <div class="chips center">${Object.entries(RANGES).map(([k, v]) => `<button class="chip small ${k === range ? 'active' : ''}" data-action="ex-range" data-k="${k}">${v[0]}</button>`).join('')}</div>
  </div>

  <div class="section-head"><h2>${t('Storico')}</h2><span class="muted small">${t('{n} sessioni', { n: hist.length })}</span></div>
  ${hist.length ? '<div class="stagger">' + hist.slice().reverse().map((h) => {
    const labels = setLabels(h.sets);
    return `<div class="card hist-item" data-action="go" data-to="#/history/${h.workoutId}">
      <div class="wc-head"><b>${fmtDate(h.date)}</b><span class="label">${t('1RM ~')}${fmtNum(h.e1rm, 0)} kg</span></div>
      <div class="hist-sets">${h.sets.map((s, j) => `<span class="hs type-${s.type}"><i>${labels[j]}</i>${fmtNum(s.kg, 2)}×${s.reps}</span>`).join('')}</div>
    </div>`;
  }).join('') + '</div>' : `<div class="empty small">${t('Non hai ancora eseguito questo esercizio.')}</div>`}
  `;
}

register(
  {
    'mv-nav': (el) => {
      weekOffset = Math.min(0, weekOffset + Number(el.dataset.d));
      rerender();
    },
    'ex-metric': (el) => {
      metric = el.dataset.k;
      rerender();
    },
    'ex-range': (el) => {
      range = el.dataset.k;
      rerender();
    },
  },
  {
    'stats-q': (el) => {
      exQuery = el.value;
      const q = exQuery.toLowerCase();
      const exs = exercisesWithHistory()
        .map((e) => ({ ...e, ex: getExercise(e.exId) }))
        .filter((e) => !q || e.ex.name.toLowerCase().includes(q));
      document.getElementById('stats-ex-list').innerHTML = exListHtml(exs);
    },
  }
);
