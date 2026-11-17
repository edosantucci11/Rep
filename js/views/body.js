import { state, save, markDeleted } from '../store.js';
import { register, rerender, confirmDialog, toast } from '../ui.js';
import { lineChart } from '../chart.js';
import { esc, uid, fmtNum, fmtDate, dayKey, toNum, count } from '../utils.js';
import { I } from '../icons.js';
import { t, tn } from '../i18n.js';

export const MEASURES = [
  ['collo', 'Collo'], ['spalle', 'Spalle'], ['petto', 'Petto'], ['braccio', 'Braccio'], ['avambraccio', 'Avambraccio'],
  ['vita', 'Vita'], ['fianchi', 'Fianchi'], ['coscia', 'Coscia'], ['polpaccio', 'Polpaccio'],
];

let metric = 'peso';
let showMeasures = false;

const sorted = () => [...state.body].sort((a, b) => a.date.localeCompare(b.date));

export function render() {
  const entries = sorted();
  const available = [['peso', t('Peso')], ['grasso', t('% grasso')], ...MEASURES.map(([k, l]) => [k, t(l)])].filter(([k]) => k === 'peso' || entries.some((e) => e[k] != null));
  if (!available.some(([k]) => k === metric)) metric = 'peso';
  const points = entries.filter((e) => e[metric] != null).map((e) => ({ x: new Date(e.date + 'T12:00').getTime(), y: e[metric] }));
  const unit = metric === 'peso' ? 'kg' : metric === 'grasso' ? '%' : 'cm';
  const latest = entries.filter((e) => e.peso != null).at(-1);
  const prevW = entries.filter((e) => e.peso != null).at(-2);
  const today = dayKey(Date.now());
  const existing = state.body.find((e) => e.date === today) || {};

  return `
  <header class="page-head"><h1>${t('Corpo')}</h1></header>
  <div class="stat-grid">
    <div class="stat">${latest ? count(latest.peso, 1) : '<b>–</b>'}<span>${t('peso attuale kg')}</span></div>
    <div class="stat"><b>${latest && prevW ? (latest.peso - prevW.peso >= 0 ? '+' : '') + fmtNum(latest.peso - prevW.peso, 1) + ' kg' : '–'}</b><span>${t('dalla misura precedente')}</span></div>
  </div>

  <div class="card">
    <h3>${t('Nuova misurazione')}</h3>
    <div class="form-row">
      <label class="field"><span>${t('Data')}</span><input id="b-date" type="date" class="input" value="${today}" max="${today}"></label>
      <label class="field"><span>${t('Peso (kg)')}</span><input id="b-peso" class="input" inputmode="decimal" placeholder="${t('es. 78,5')}" value="${existing.peso ?? ''}"></label>
      <label class="field"><span>${t('% grasso')}</span><input id="b-grasso" class="input" inputmode="decimal" placeholder="${t('opz.')}" value="${existing.grasso ?? ''}"></label>
    </div>
    <button class="btn btn-ghost btn-small" data-action="b-toggle">${showMeasures ? t('Nascondi circonferenze') : `${I.plus} ${t('Circonferenze (cm)')}`}</button>
    ${showMeasures ? `<div class="form-grid">${MEASURES.map(([k, l]) => `<label class="field"><span>${l}</span><input id="b-${k}" class="input" inputmode="decimal" placeholder="cm" value="${existing[k] ?? ''}"></label>`).join('')}</div>` : ''}
    <button class="btn btn-primary btn-block" data-action="b-save">${t('Salva')}</button>
  </div>

  <div class="card">
    <div class="chips scroll-x">${available.map(([k, l]) => `<button class="chip ${k === metric ? 'active' : ''}" data-action="b-metric" data-k="${k}">${l}</button>`).join('')}</div>
    ${lineChart(points, { unit })}
  </div>

  <div class="section-head"><h2>${t('Misurazioni')}</h2></div>
  ${entries.length ? entries.slice().reverse().map((e) => `
    <div class="list-item static">
      <span><span class="li-title">${fmtDate(e.date + 'T12:00')}</span><br><span class="label">${[
        e.grasso != null ? `${fmtNum(e.grasso, 1)}${t('% grasso')}` : '',
        ...MEASURES.filter(([k]) => e[k] != null).map(([k, l]) => `${l} ${fmtNum(e[k], 1)}`),
      ].filter(Boolean).join(' · ') || '&nbsp;'}</span></span>
      <span class="right">${e.peso != null ? `<span class="li-val">${fmtNum(e.peso, 1)}</span>` : ''}
        <button class="icon-btn small" data-action="b-del" data-id="${e.id}" aria-label="${t('Elimina')}">${I.close}</button></span>
    </div>`).join('') : `<div class="empty small">${t('Registra il tuo peso per vederne l\'andamento.')}</div>`}
  `;
}

register({
  'b-toggle': () => {
    showMeasures = !showMeasures;
    rerender();
  },
  'b-metric': (el) => {
    metric = el.dataset.k;
    rerender();
  },
  'b-save': () => {
    const date = document.getElementById('b-date').value || dayKey(Date.now());
    const vals = {};
    for (const k of ['peso', 'grasso', ...MEASURES.map(([k]) => k)]) {
      const input = document.getElementById('b-' + k);
      if (!input) continue;
      const v = toNum(input.value);
      if (input.value.trim() !== '' && !(v > 0)) return toast(t('Valore non valido'));
      if (v > 0) vals[k] = v;
    }
    if (!Object.keys(vals).length) return toast(t('Inserisci almeno un valore'));
    const ex = state.body.find((e) => e.date === date);
    if (ex) Object.assign(ex, vals);
    else state.body.push({ id: uid(), date, ...vals });
    save();
    toast(t('Misurazione salvata'));
    rerender();
  },
  'b-del': async (el) => {
    if (!(await confirmDialog(t('Eliminare questa misurazione?'), { okText: t('Elimina'), danger: true }))) return;
    state.body = state.body.filter((e) => e.id !== el.dataset.id);
    markDeleted(el.dataset.id);
    save();
    rerender();
  },
});
