import { state, save, exportState, replaceState, resetState, markDeleted, DEFAULT_PLATES } from '../store.js';
import { maxHr } from '../hr.js';
import '../intervals.js';
import { register, rerender, confirmDialog, toast, embedded, openModal } from '../ui.js';
import { getExercise } from '../exercises.js';
import { setLabels, isDeloadWeek, cycleWeek } from '../logic.js';
import { esc, fmtNum, toNum, download, dayKey, fmtDate } from '../utils.js';
import { REST_OPTIONS, restLabel } from './routine.js';
import { THEMES, applyTheme } from '../theme.js';
import { logoUrl, themePreviewUrl } from '../logo.js';
import { I } from '../icons.js';
import { cloudMeta, isCloudAvailable, appleButton } from '../cloud.js';
import { isNative, connectHealth, healthStatus, watchStatus, latestAutoBackup } from '../native.js';
import { t, tn, LANGS, langChoice, setLang } from '../i18n.js';

const ALL_PLATES = [50, 25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];
const BARS = [20, 15, 10, 7, 0];

let target = '';
let themeJustChanged = false;
let bar = null;

/** Foto profilo o iniziale del nome */
export function avatarHtml(cls = 'account-avatar') {
  const s = state.settings;
  const name = (s.shareName || cloudMeta().name || '').trim();
  return s.photo
    ? `<img class="${cls}" src="${s.photo}" alt="${t('Foto profilo')}">`
    : `<span class="${cls}">${name ? esc(name.charAt(0).toUpperCase()) : I.user}</span>`;
}

/** Profilo (nome e foto, anche nella web app) + account Apple e iCloud (solo app iPhone) */
function accountSection() {
  const s = state.settings;
  const m = cloudMeta();
  let cloud = '';
  if (isCloudAvailable()) {
    if (!m.enabled) {
      cloud = `<p class="small muted">${t('Accedi per salvare in automatico schede e allenamenti su iCloud e ritrovarli su ogni iPhone e iPad.')}</p>
    ${appleButton('account-signin')}`;
    } else {
      const when = m.lastSync ? t('Sincronizzato {d} alle {h}', { d: fmtDate(m.lastSync), h: new Date(m.lastSync).toTimeString().slice(0, 5) }) : t('In attesa della prima sincronizzazione');
      cloud = `<div class="account-cloud">
      <span>${I.check} iCloud · ${esc(m.email || m.name || t('Account Apple'))}<br><span class="native-status">${m.error ? t('Ultima sincronizzazione non riuscita: riprovo da solo') : when}</span></span>
    </div>
    <div class="row-gap">
      <button class="btn btn-small btn-outline" data-action="account-sync">${t('Sincronizza ora')}</button>
      <button class="btn btn-small btn-ghost" data-action="account-signout">${t('Esci')}</button>
    </div>`;
    }
  }
  return `<div class="section-head"><h2>${t('Profilo')}</h2>${m.enabled ? `<span class="label">${t('iCloud')}</span>` : ''}</div>
  <div class="card account">
    <div class="account-row">
      <label class="avatar-pick" aria-label="${t('Cambia foto profilo')}">
        ${avatarHtml()}
        <span class="avatar-cam">${I.camera}</span>
        <input type="file" accept="image/*" data-change="profile-photo" hidden>
      </label>
      <div class="account-fields">
        <input class="input" value="${esc(s.shareName || m.name || '')}" placeholder="${t('Il tuo nome')}" maxlength="24" data-input="share-name" aria-label="${t('Il tuo nome')}">
        <span class="label">${s.photo ? `<button class="link-btn" data-action="profile-photo-remove">${t('Rimuovi foto')}</button>` : t('Tocca il cerchio per la foto')}</span>
      </div>
    </div>
    ${cloud}
  </div>`;
}

/** Foto scelta dalla libreria o scattata: ritagliata quadrata e rimpicciolita (pochi KB) */
function squarePhoto(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      cv.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('Immagine non leggibile')));
    };
    img.src = url;
  });
}

/** Calcola i dischi per lato (algoritmo greedy) */
export function platesFor(total, barKg, plates) {
  let perSide = (total - barKg) / 2;
  const out = [];
  const sortedP = [...plates].sort((a, b) => b - a);
  for (const p of sortedP) {
    while (perSide >= p - 1e-9) {
      out.push(p);
      perSide -= p;
    }
  }
  return { plates: out, rest: Math.max(0, perSide) };
}

function plateResult() {
  const total = toNum(target);
  const b = bar ?? state.settings.barWeight;
  if (!(total > 0)) return `<div class="muted small center">${t('Inserisci il peso totale da caricare.')}</div>`;
  if (total < b) return `<div class="muted small center">${t('Il peso è inferiore al bilanciere ({b} kg).', { b })}</div>`;
  const { plates, rest } = platesFor(total, b, state.settings.plates);
  const loaded = b + plates.reduce((a, p) => a + p, 0) * 2;
  const counts = {};
  plates.forEach((p) => (counts[p] = (counts[p] || 0) + 1));
  return `
    <div class="barbell">
      <div class="bar-sleeve"></div>
      ${plates.map((p, i) => `<div class="plate" style="height:${44 + (p / 25) * 96}px;--o:${(0.45 + Math.min(1, p / 25) * 0.55).toFixed(2)};--i:${i};width:${p >= 10 ? 24 : 18}px" title="${p} kg"><span>${fmtNum(p, 2)}</span></div>`).join('')}
      <div class="bar-end"></div>
    </div>
    <div class="center plate-txt"><span class="accent-text">${t('Per lato')}</span> · ${plates.length ? Object.entries(counts).sort((a, b) => b[0] - a[0]).map(([p, n]) => `${n}× ${fmtNum(Number(p), 2)} kg`).join(' + ') : t('nessun disco')}</div>
    ${rest > 1e-6 ? `<div class="warn center">${t('Non raggiungibile esattamente: caricati {a} kg (mancano {b} kg)', { a: fmtNum(loaded, 2), b: fmtNum(rest * 2, 2) })}</div>` : ''}`;
}

export function render() {
  const s = state.settings;
  const b = bar ?? s.barWeight;
  const sizeKB = Math.round(new Blob([JSON.stringify(state)]).size / 1024);
  return `
  <header class="page-head"><h1>${t('Altro')}</h1></header>
${accountSection()}

  <button class="list-item help-link" data-action="go" data-to="#/tools/guida">
    <span><span class="li-title">${t('Guida')}</span><br><span class="label">${t('Come fare ogni cosa, passo per passo')}</span></span>
    <span class="li-val">${I.info}</span>
  </button>

  <div class="section-head"><h2>${t('Tema')}</h2><span class="label">${esc(THEMES[s.theme]?.name || 'Volt')}</span></div>
  <div class="logo-row">
    <img class="logo-tile" src="${isNative ? themePreviewUrl(s.theme) : logoUrl()}" alt="${t('Logo Rep')}">
    <div class="small muted">${isNative
      ? t('Il tema cambia il colore di pulsanti, grafici, schermata di apertura e anche dell\'icona dell\'app (iOS ti avvisa con un messaggio).')
      : t('Icona dell\'app. Il tema cambia il colore di pulsanti, grafici e schermata di apertura.')}</div>
  </div>
  <div class="theme-grid">
    ${Object.entries(THEMES).map(([k, t]) => `
      <button class="swatch ${k === s.theme ? 'active' : ''}" style="--sw:${t.accent}" data-action="set-theme" data-k="${k}" aria-label="Tema ${t.name}">
        <img class="sw-logo" src="${themePreviewUrl(k)}" alt="">
        <span class="sw-name">${t.name}</span>
        <span class="sw-dot">${I.check}</span>
      </button>`).join('')}
  </div>

  <div class="section-head"><h2>${t('Timer a intervalli')}</h2></div>
  <button class="list-item" data-action="iv-open">
    <span><span class="li-title">${t('Tabata, EMOM, circuiti')}</span><br><span class="label">${t('Lavoro e pausa con conto alla rovescia e bip')}</span></span>
    <span class="li-val">${I.clock}</span>
  </button>

  <div class="section-head"><h2>${t('Calcolatore dischi')}</h2></div>
  <div class="card">
    <div class="form-row">
      <label class="field"><span>${t('Peso totale (kg)')}</span><input class="input input-lg" inputmode="decimal" value="${esc(target)}" placeholder="${t('es. 100')}" data-input="plate-target"></label>
      <label class="field"><span>${t('Bilanciere')}</span><select class="input input-lg" data-change="plate-bar">${BARS.map((x) => `<option value="${x}" ${x === b ? 'selected' : ''}>${x ? x + ' kg' : 'nessuno'}</option>`).join('')}</select></label>
    </div>
    <div id="plate-result">${plateResult()}</div>
  </div>

  ${isNative ? `<div class="section-head"><h2>${t('Salute e Apple Watch')}</h2></div>
  <div class="card settings">
    <div class="setting"><span>${I.heart} ${t('Salute')}<br><span class="native-status" id="health-status">${t('Controllo…')}</span></span>
      <button class="btn btn-small btn-outline" data-action="health-connect" id="health-btn" hidden>${t('Collega')}</button></div>
    <div class="setting"><span>${I.watch} Apple Watch<br><span class="native-status" id="watch-status">${t('Controllo…')}</span></span></div>
  </div>` : ''}

  <div class="section-head"><h2>${t('Impostazioni')}</h2></div>
  ${langCard()}
  ${settingsCard()}

  <div class="section-head"><h2>${t('Esercizi personalizzati')}</h2></div>
  ${state.customExercises.length ? `<div class="card">${state.customExercises.map((e) => `
    <div class="list-item static"><span><span class="li-title">${esc(e.name)}</span><br><span class="label">${esc(tn(e.muscle))} · ${esc(tn(e.equipment))}</span></span>
    <button class="icon-btn small" data-action="cx-del" data-id="${e.id}" aria-label="${t('Elimina')}">${I.close}</button></div>`).join('')}</div>`
    : `<div class="empty small">${t('Puoi creare esercizi personalizzati dal selettore esercizi.')}</div>`}

  <div class="section-head"><h2>${t('Dati e backup')}</h2></div>
  <div class="card">
    <p class="muted small">${t('I dati sono salvati')} <b>${t('solo su questo dispositivo')}</b> (${sizeKB} ${t('KB). Fai un backup ogni tanto: se cancelli i dati del browser li perdi.')}
    ${state.lastBackup ? `<br>${t('Ultimo backup:')} <b>${fmtDate(state.lastBackup)}</b>` : `<br><b class="warn">${t('Non hai ancora fatto nessun backup.')}</b>`}</p>
    <button class="btn btn-block btn-primary" data-action="export-json">${I.down} ${t('Esporta backup')}</button>
    <button class="btn btn-block btn-outline" data-action="export-csv">${I.down} ${t('Esporta CSV (Excel)')}</button>
    <label class="btn btn-block btn-outline file-btn">${I.up} ${t('Importa backup')}<input type="file" accept="application/json,.json" data-change="import-json" hidden></label>
    ${isNative ? `<div class="auto-backup">
      <p class="muted small">${I.check} <b>${t('Backup automatico')}</b> ${t('dopo ogni allenamento, nell\'app File › Sul mio iPhone › Rep › Backup (gli ultimi 14 giorni).')}
      ${state.lastAutoBackup ? `<br>${t('Ultimo:')} <b>${fmtDate(state.lastAutoBackup)}</b>` : ''} ${t('Da File puoi copiarli in iCloud Drive.')}</p>
      <button class="btn btn-block btn-outline" data-action="auto-restore">${I.up} ${t('Ripristina l\'ultimo backup automatico')}</button>
    </div>` : ''}
    <button class="btn btn-block btn-ghost danger-text" data-action="reset-all">${t('Cancella tutti i dati')}</button>
  </div>
  <button class="btn btn-block btn-outline" data-action="ob-replay">${t('Rivedi la presentazione')}</button>
  <p class="muted xsmall center">${t('Rep · funziona offline · aggiungila alla schermata Home dal menu del browser')}</p>
  `;
}

/** Lingua dell'app: quella del telefono o una scelta qui (l'app si ricarica) */
function langCard() {
  const opts = [['auto', t('Lingua del telefono')], ...Object.entries(LANGS)];
  return `<div class="card settings"><div class="setting"><span>${t('Lingua')} · Language</span>
    <select class="input input-sm" data-change="set-lang">${opts.map(([k, l]) => `<option value="${k}" ${k === langChoice ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>`;
}

/** Riquadro Impostazioni: si ridisegna da solo quando cambia un valore (non tutta la pagina con le immagini) */
function settingsCard() {
  const s = state.settings;
  return `<div class="card settings" id="settings-card">
    <div class="setting"><span>${t('Obiettivo allenamenti a settimana')}</span>
      <div class="stepper" style="width:120px">
        <button data-action="set-goal" data-d="-1">−</button><b>${s.weeklyGoal}</b><button data-action="set-goal" data-d="1">+</button>
      </div></div>
    <div class="setting"><span>${t('Età')}<br><span class="native-status">${t('Per le zone del battito (FC max {n} bpm)', { n: maxHr() })}</span></span>
      <div class="stepper" style="width:120px">
        <button data-action="set-age" data-d="-1">−</button><b>${s.age}</b><button data-action="set-age" data-d="1">+</button>
      </div></div>
    <div class="setting"><span>${t('Recupero predefinito')}</span>
      <select class="input input-sm" data-change="set-rest">${REST_OPTIONS.map((x) => `<option value="${x}" ${x === s.defaultRest ? 'selected' : ''}>${restLabel(x)}</option>`).join('')}</select></div>
    <div class="setting"><span>${t('Progressione')}<br><span class="native-status">${t('Kg proposti in più quando completi tutte le ripetizioni')}</span></span>
      <select class="input input-sm" data-change="set-inc">${[1, 1.25, 2, 2.5, 5].map((x) => `<option value="${x}" ${x === (s.increment || 2.5) ? 'selected' : ''}>+${fmtNum(x, 2)} kg</option>`).join('')}</select></div>
    <div class="setting"><span>${t('Settimana di scarico')}<br><span class="native-status">${s.deloadEvery ? (isDeloadWeek() ? t('Questa settimana: pesi proposti al 60%') : t('Settimana {a} di {b}', { a: cycleWeek(), b: s.deloadEvery })) : t('Pesi proposti al 60% una settimana ogni N')}</span></span>
      <select class="input input-sm" data-change="set-deload">${[0, 3, 4, 5, 6, 8].map((x) => `<option value="${x}" ${x === (s.deloadEvery || 0) ? 'selected' : ''}>${x ? t('ogni {n} sett.', { n: x }) : t('Mai')}</option>`).join('')}</select></div>
    <div class="setting"><span>${t('Intensità percepita')}</span>
      <div class="segmented">
        <button class="${s.effort === 'rpe' ? 'active' : ''}" data-action="set-effort" data-v="rpe">RPE</button>
        <button class="${s.effort === 'rir' ? 'active' : ''}" data-action="set-effort" data-v="rir">RIR</button>
      </div></div>
    ${toggle('sound', t('Suono a fine recupero'))}
    ${toggle('vibrate', t('Vibrazione a fine recupero'))}
    ${toggle('wakeLock', t('Schermo sempre acceso durante l\'allenamento'))}
    <div class="setting"><span>${t('Bilanciere predefinito')}</span>
      <select class="input input-sm" data-change="set-bar">${BARS.map((x) => `<option value="${x}" ${x === s.barWeight ? 'selected' : ''}>${x} kg</option>`).join('')}</select></div>
    <div class="setting col"><span>${t('Dischi disponibili in palestra')}</span>
      <div class="chips">${ALL_PLATES.map((p) => `<button class="chip ${s.plates.includes(p) ? 'active' : ''}" data-action="set-plate" data-p="${p}">${fmtNum(p, 2)}</button>`).join('')}</div></div>
  </div>`;
}

/** Dopo una modifica nelle impostazioni: aggiorna solo il riquadro e il calcolatore dischi */
function refreshSettings() {
  const card = document.getElementById('settings-card');
  if (!card) return rerender();
  card.outerHTML = settingsCard();
  const pr = document.getElementById('plate-result');
  if (pr) pr.innerHTML = plateResult();
  const sel = document.querySelector('[data-change="plate-bar"]');
  if (sel) sel.value = String(bar ?? state.settings.barWeight);
}

function toggle(key, label) {
  return `<div class="setting"><span>${label}</span>
    <button class="switch ${state.settings[key] ? 'on' : ''}" data-action="set-toggle" data-k="${key}" role="switch" aria-checked="${!!state.settings[key]}"><i></i></button></div>`;
}

/** Dentro un iframe i download sono bloccati: mostra il testo da copiare */
function saveFile(name, text, type) {
  if (!embedded) return download(name, text, type);
  openModal(`<h3>${esc(name)}</h3>
    <p class="muted small">${t('In questa anteprima i download sono bloccati: copia il testo e salvalo in un file.')}</p>
    <textarea id="export-text" class="input" rows="10" readonly>${esc(text)}</textarea>
    <div class="modal-actions"><button class="btn btn-ghost" data-action="modal-close">${t('Chiudi')}</button>
    <button class="btn btn-primary" data-action="export-copy">${t('Copia')}</button></div>`);
}

function csv() {
  const rows = [['data', 'ora', 'allenamento', 'esercizio', 'muscolo', 'serie', 'tipo', 'kg', 'ripetizioni', 'rpe_rir', 'note']];
  for (const w of [...state.workouts].reverse()) {
    const d = new Date(w.start);
    for (const e of w.exercises) {
      const ex = getExercise(e.exId);
      const labels = setLabels(e.sets);
      e.sets.forEach((s, j) => rows.push([
        dayKey(d), d.toTimeString().slice(0, 5), w.name, ex.name, ex.muscle, labels[j], s.type, String(s.kg).replace('.', ','), s.reps,
        s.rpe ?? '', j === 0 ? e.notes : '',
      ]));
    }
  }
  return '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

register(
  {
    'profile-photo-remove': () => {
      delete state.settings.photo;
      save();
      rerender();
    },
    'set-theme': (el) => {
      if (state.settings.theme === el.dataset.k) return;
      state.settings.theme = el.dataset.k;
      applyTheme(el.dataset.k);
      save();
      themeJustChanged = true;
      rerender();
      themeJustChanged = false;
    },
    'set-goal': (el) => {
      state.settings.weeklyGoal = Math.min(14, Math.max(1, (state.settings.weeklyGoal || 3) + Number(el.dataset.d)));
      save();
      refreshSettings();
    },
    'set-age': (el) => {
      state.settings.age = Math.min(90, Math.max(12, (state.settings.age || 30) + Number(el.dataset.d)));
      save();
      refreshSettings();
    },
    'health-connect': async () => {
      await connectHealth();
      rerender();
    },
    'ob-replay': () => import('../onboarding.js').then((m) => m.startOnboarding()),
    'set-effort': (el) => {
      state.settings.effort = el.dataset.v;
      save();
      refreshSettings();
    },
    'set-toggle': (el) => {
      state.settings[el.dataset.k] = !state.settings[el.dataset.k];
      save();
      refreshSettings();
    },
    'set-plate': (el) => {
      const p = Number(el.dataset.p);
      const pl = state.settings.plates;
      state.settings.plates = pl.includes(p) ? pl.filter((x) => x !== p) : [...pl, p].sort((a, b) => b - a);
      save();
      refreshSettings();
    },
    'cx-del': async (el) => {
      const id = el.dataset.id;
      const used = state.workouts.some((w) => w.exercises.some((e) => e.exId === id)) || state.routines.some((r) => r.exercises.some((e) => e.exId === id));
      const msg = used ? t('Questo esercizio è usato in schede o allenamenti: lì comparirà come "Esercizio eliminato".') : t('Eliminare questo esercizio?');
      if (!(await confirmDialog(msg, { okText: t('Elimina'), danger: true }))) return;
      state.customExercises = state.customExercises.filter((e) => e.id !== id);
      markDeleted(id);
      save();
      rerender();
    },
    'export-json': () => {
      state.lastBackup = Date.now();
      save();
      saveFile(`rep-backup-${dayKey(Date.now())}.json`, exportState());
      toast(t('Backup esportato'));
      rerender();
    },
    'export-csv': () => {
      if (!state.workouts.length) return toast(t('Nessun allenamento da esportare'));
      saveFile(`rep-serie-${dayKey(Date.now())}.csv`, csv(), 'text/csv;charset=utf-8');
    },
    'export-copy': async () => {
      const ta = document.getElementById('export-text');
      try {
        await navigator.clipboard.writeText(ta.value);
        toast(t('Copiato'));
      } catch (e) {
        ta.select();
        toast(t('Seleziona e copia il testo'));
      }
    },
    'reset-all': async () => {
      if (!(await confirmDialog(t('Tutte le schede, gli allenamenti e le misure verranno cancellati. Esporta prima un backup!'), { title: t('Cancellare tutto?'), okText: t('Cancella tutto'), danger: true }))) return;
      resetState();
      toast(t('Dati cancellati'));
      rerender();
    },
  },
  {
    'share-name': (el) => {
      state.settings.shareName = el.value.trim();
      save();
    },
    'plate-target': (el) => {
      target = el.value;
      document.getElementById('plate-result').innerHTML = plateResult();
    },
  },
  {
    'plate-bar': (el) => {
      bar = Number(el.value);
      document.getElementById('plate-result').innerHTML = plateResult();
    },
    'set-inc': (el) => {
      state.settings.increment = Number(el.value);
      save();
    },
    'set-deload': (el) => {
      const n = Number(el.value);
      // il ciclo riparte da questa settimana quando si attiva o si cambia
      state.settings.deloadEvery = n;
      state.settings.cycleStart = n ? Date.now() : null;
      save();
      refreshSettings();
    },
    'set-lang': (el) => setLang(el.value),
    'set-rest': (el) => {
      state.settings.defaultRest = Number(el.value);
      save();
    },
    'set-bar': (el) => {
      state.settings.barWeight = Number(el.value);
      bar = null;
      save();
      refreshSettings();
    },
    'auto-restore': async () => {
      const b = await latestAutoBackup();
      if (!b) return toast(t('Nessun backup automatico trovato'));
      let data;
      try { data = JSON.parse(b.json); } catch (e) { return toast(t('Backup non leggibile')); }
      const ok = await confirmDialog(t('Backup del {d}: {w} allenamenti e {r} schede. I dati attuali verranno sostituiti.', { d: fmtDate(b.date), w: data.workouts?.length || 0, r: data.routines?.length || 0 }), { title: t('Ripristinare il backup?'), okText: t('Ripristina') });
      if (!ok) return;
      replaceState(data);
      applyTheme(state.settings.theme);
      toast(t('Backup ripristinato'));
      rerender();
    },
    'profile-photo': async (el) => {
      const file = el.files?.[0];
      if (!file) return;
      try {
        state.settings.photo = await squarePhoto(file);
        save();
        rerender();
        toast(t('Foto profilo aggiornata'));
      } catch (e) {
        toast(t('Non riesco a leggere questa foto'));
      } finally {
        el.value = '';
      }
    },
    'import-json': async (el) => {
      const file = el.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.workouts)) throw new Error();
        const ok = await confirmDialog(t('Il backup contiene {w} allenamenti e {r} schede. I dati attuali verranno sostituiti.', { w: data.workouts.length, r: data.routines?.length || 0 }), { title: t('Importare il backup?'), okText: t('Importa') });
        if (!ok) return;
        replaceState(data);
        applyTheme(state.settings.theme);
        toast(t('Backup importato'));
        rerender();
      } catch (e) {
        toast(t('File non valido'));
      } finally {
        el.value = '';
      }
    },
  }
);

export { DEFAULT_PLATES };

// stato di Salute e dell'orologio nella sezione "Salute e Apple Watch" (solo app iPhone)
window.addEventListener('rep:rendered', async () => {
  if (!document.getElementById('health-status')) return;
  const h = await healthStatus();
  // la pagina può essere stata ridisegnata nel frattempo: si cercano gli elementi dopo la risposta
  const hs = document.getElementById('health-status');
  const btn = document.getElementById('health-btn');
  if (!hs) return;
  if (!h?.available) hs.textContent = t('Non disponibile su questo dispositivo');
  else if (!h.asked) hs.textContent = t('Non ancora collegata');
  else hs.textContent = h.saving
    ? t('Collegata: battiti da qualsiasi dispositivo e allenamenti salvati in Salute')
    : t('Permessi da attivare: app Salute › Profilo › App › Rep');
  if (btn) btn.hidden = !h?.available || h.asked;
});
window.addEventListener('rep:rendered', async () => {
  const el = document.getElementById('watch-status');
  if (!el) return;
  const st = await watchStatus();
  el.textContent = !st ? t('Non disponibile') : !st.paired ? t('Nessun orologio abbinato') : !st.installed ? t('Installa Rep sull\'orologio dall\'app Watch') : st.reachable ? t('Collegato') : t('Abbinato, app non aperta');
});
