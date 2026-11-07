// Timer a intervalli (Altro): Tabata, EMOM o personalizzato, con conto alla rovescia a tutto schermo.
import { register, openModal, closeModal, setModalContent } from './ui.js';
import { unlockAudio, beep, vibrate } from './timer.js';
import { I } from './icons.js';
import { t, tn } from './i18n.js';

const PRESETS = {
  tabata: { name: 'Tabata', work: 20, rest: 10, rounds: 8 },
  emom: { name: 'EMOM', work: 60, rest: 0, rounds: 10 },
  custom: { name: t('Personalizzato'), work: 40, rest: 20, rounds: 6 },
};

let cfg = { ...PRESETS.tabata, kind: 'tabata' };
let run = null; // { start, timer, lastPhase }

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const total = () => cfg.rounds * (cfg.work + cfg.rest) - cfg.rest;

/** Fase in corso a `t` secondi dall'inizio: lavoro o pausa, giro e secondi rimasti */
function phaseAt(sec) {
  const cycle = cfg.work + cfg.rest;
  const round = Math.min(cfg.rounds, Math.floor(sec / cycle) + 1);
  const into = sec - (round - 1) * cycle;
  if (sec >= total()) return { done: true, round: cfg.rounds, left: 0, work: false };
  const work = into < cfg.work;
  return { done: false, round, work, left: Math.ceil(work ? cfg.work - into : cycle - into) };
}

function setupHtml() {
  const stepper = (k, label, step, min) => `<div class="setting"><span>${label}</span>
    <div class="stepper" style="width:140px"><button data-action="iv-adj" data-k="${k}" data-d="${-step}" data-min="${min}">−</button>
    <b>${k === 'rounds' ? cfg[k] : mmss(cfg[k])}</b><button data-action="iv-adj" data-k="${k}" data-d="${step}" data-min="${min}">+</button></div></div>`;
  return `
    <div class="iv">
      <h3>${t('Timer a intervalli')}</h3>
      <div class="segmented iv-kinds">${Object.entries(PRESETS).map(([k, p]) => `<button class="${cfg.kind === k ? 'active' : ''}" data-action="iv-kind" data-k="${k}">${p.name}</button>`).join('')}</div>
      <div class="card settings">
        ${stepper('work', cfg.kind === 'emom' ? t('Ogni') : t('Lavoro'), cfg.kind === 'emom' ? 15 : 5, 5)}
        ${cfg.kind === 'emom' ? '' : stepper('rest', 'Pausa', 5, 0)}
        ${stepper('rounds', cfg.kind === 'emom' ? t('Minuti') : t('Giri'), 1, 1)}
      </div>
      <p class="muted small center">${t('Durata totale')} ${mmss(total())}</p>
      <button class="btn btn-primary btn-block" data-action="iv-start">${I.play} ${t('Avvia')}</button>
    </div>`;
}

function runHtml(p) {
  return `
    <div class="iv iv-run ${p.done ? 'done' : p.work ? 'work' : 'rest'}">
      <div class="label">${p.done ? 'Finito' : p.work ? 'Lavoro' : 'Pausa'}</div>
      <div class="iv-time">${p.done ? '✓' : mmss(p.left)}</div>
      <div class="iv-round">${t('Giro')} ${p.round} / ${cfg.rounds}</div>
      <button class="btn btn-block ${p.done ? 'btn-primary' : 'btn-outline'}" data-action="iv-stop">${p.done ? 'Chiudi' : 'Ferma'}</button>
    </div>`;
}

function tickRun() {
  const p = phaseAt((Date.now() - run.start) / 1000);
  const key = p.done ? 'done' : `${p.round}-${p.work}`;
  if (key !== run.lastPhase) {
    if (run.lastPhase) {
      beep();
      vibrate(p.done ? [300, 150, 300] : [200]);
    }
    run.lastPhase = key;
  }
  setModalContent(runHtml(p));
  if (p.done) stop(false);
}

function stop(close = true) {
  if (run) clearInterval(run.timer);
  run = null;
  if (close) closeModal();
}

export function openIntervals() {
  openModal(setupHtml(), { onClose: () => stop(false) });
}

register({
  'iv-kind': (el) => {
    cfg = { ...PRESETS[el.dataset.k], kind: el.dataset.k };
    setModalContent(setupHtml());
  },
  'iv-adj': (el) => {
    const k = el.dataset.k;
    cfg[k] = Math.max(Number(el.dataset.min), Math.min(k === 'rounds' ? 60 : 600, cfg[k] + Number(el.dataset.d)));
    setModalContent(setupHtml());
  },
  'iv-start': () => {
    unlockAudio();
    run = { start: Date.now() + 3000, timer: null, lastPhase: '' };
    // 3 secondi per prepararsi
    const pre = () => {
      const left = Math.ceil((run.start - Date.now()) / 1000);
      if (left > 0) return setModalContent(`<div class="iv iv-run rest"><div class="label">${t('Pronti')}</div><div class="iv-time">${left}</div><div class="iv-round">${cfg.name}</div></div>`);
      tickRun();
    };
    pre();
    run.timer = setInterval(() => (Date.now() < run.start ? pre() : tickRun()), 200);
  },
  'iv-stop': () => stop(true),
  'iv-open': () => openIntervals(),
});
