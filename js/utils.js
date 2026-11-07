import { locale, t } from './i18n.js';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Converte input testuale ("82,5") in numero; stringa vuota -> NaN */
export const toNum = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
};

// I formattatori Intl sono costosi da creare: uno per configurazione, riusato
const NF = new Map();
export const fmtNum = (n, digits = 1) => {
  if (!isFinite(n)) return '–';
  let f = NF.get(digits);
  if (!f) NF.set(digits, (f = new Intl.NumberFormat(locale, { maximumFractionDigits: digits })));
  return f.format(Number(n));
};
const DF = new Map();
const dateFmt = (opts, time = false) => {
  const k = (time ? 't' : 'd') + JSON.stringify(opts);
  let f = DF.get(k);
  if (!f) DF.set(k, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
};

/** 1RM stimato (Epley) */
export const e1rm = (kg, reps) => {
  if (!(kg > 0) || !(reps > 0)) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
};

export const fmtDate = (ts, opts) => dateFmt(opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts));

export const fmtDateLong = (ts) => dateFmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts));

export const fmtTime = (ts) => dateFmt({ hour: '2-digit', minute: '2-digit' }, true).format(new Date(ts));

export const fmtDuration = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}min` : `${m} min`;
};

export const fmtClock = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Lunedì della settimana */
export const startOfWeek = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const relDays = (ts) => {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (diff <= 0) return t('oggi');
  if (diff === 1) return t('ieri');
  if (diff < 7) return t('{n} giorni fa', { n: diff });
  if (diff < 14) return t('1 settimana fa');
  if (diff < 60) return t('{n} settimane fa', { n: Math.floor(diff / 7) });
  return fmtDate(ts);
};

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Numero animato (vedi motion.countUps) */
export const count = (v, d = 0, suf = '') =>
  `<b data-count="${Number(v) || 0}" data-d="${d}" data-suf="${esc(suf)}">${fmtNum(Number(v) || 0, d)}${esc(suf)}</b>`;
