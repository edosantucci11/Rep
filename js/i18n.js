// Lingue di Rep. I testi nel codice sono in italiano e passano da t(): per le altre lingue
// t() cerca la traduzione nel dizionario (js/lang/<lingua>.js), con l'italiano come chiave.
// Se manca, resta l'italiano. Variabili: t('{n} esercizi', { n: 5 }).
// La lingua è quella del telefono (se disponibile), oppure quella scelta in Altro › Lingua.

export const LANGS = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
};

const KEY = 'rep-lang';
const LOCALES = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR' };

function pick() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* niente */ }
  if (saved && LANGS[saved]) return saved;
  for (const l of navigator.languages || [navigator.language || 'it']) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (LANGS[code]) return code;
  }
  return 'en';
}

export const lang = pick();
/** "auto" se segue la lingua del telefono */
export const langChoice = (() => { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } })();
/** Formato di numeri e date: quello del telefono se è nella stessa lingua */
export const locale = (() => {
  const dev = (navigator.languages || [])[0] || navigator.language || '';
  return dev.slice(0, 2).toLowerCase() === lang ? dev : LOCALES[lang];
})();
document.documentElement.lang = lang;

let dict = {};
let names = {};
/** Spiegazioni degli esercizi in inglese (per tutte le lingue tranne l'italiano) */
export let HOWTO = null;
/** Carica il dizionario della lingua (da chiamare prima del primo disegno) */
export async function loadLang() {
  if (lang === 'it') return;
  try {
    const [m, h] = await Promise.all([import(`./lang/${lang}.js`), import('./howto-en.js')]);
    dict = m.UI || {};
    names = m.NAMES || {};
    HOWTO = h;
  } catch (e) {
    console.warn('Lingua non caricata', lang, e);
  }
}

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : s);

// chiavi con una nota per distinguere lo stesso testo usato in due modi: in italiano la nota non si vede
const IT_FIX = { 'Serie (aggiungi)': 'Serie' };

/** Testo dell'interfaccia */
export function t(s, vars) {
  return fill(lang === 'it' ? IT_FIX[s] ?? s : dict[s] ?? s, vars);
}

/** Nome di un esercizio, muscolo, attrezzo o categoria (dati salvati in italiano) */
export function tn(s) {
  if (lang === 'it' || !s) return s;
  return names[s] ?? dict[s] ?? s;
}

/** Cambia lingua: "auto" = quella del telefono. Si ricarica l'app. */
export function setLang(code) {
  try {
    if (code === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, code);
  } catch (e) { /* niente */ }
  location.reload();
}
