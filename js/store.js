const KEY = 'rep-gym-app-v1';

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

const defaults = () => ({
  version: 1,
  customExercises: [],
  favorites: [],
  routines: [],
  workouts: [], // ordinati dal più recente
  body: [],
  settings: {
    defaultRest: 90,
    effort: 'rpe', // 'rpe' | 'rir'
    sound: true,
    vibrate: true,
    wakeLock: true,
    barWeight: 20,
    plates: [...DEFAULT_PLATES],
    theme: 'volt',
    weeklyGoal: 3,
    age: 30, // per la frequenza massima delle zone del battito
    increment: 2.5, // progressione suggerita: kg in più quando si completano tutte le ripetizioni
    deloadEvery: 0, // settimana di scarico ogni N settimane (0 = mai)
    cycleStart: null, // inizio del ciclo (per contare le settimane)
    body: 'male', // manichino 3D: 'male' | 'female'
    figure: 'anatomy', // stile: 'anatomy' (tavola anatomica) | 'skin' (pelle realistica)
  },
  active: null,
  lastBackup: null,
  modifiedAt: 0, // ultima modifica (sincronizzazione iCloud: vince la più recente)
  deleted: {}, // id eliminati → quando (così non ricompaiono dagli altri dispositivi)
});

function normalize(s) {
  const d = defaults();
  const out = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
  for (const k of ['customExercises', 'routines', 'workouts', 'body']) if (!Array.isArray(out[k])) out[k] = [];
  if (!out.deleted || typeof out.deleted !== 'object') out.deleted = {};
  out.workouts.sort((a, b) => b.start - a.start);
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.error('Errore caricamento dati', e);
  }
  return defaults();
}

export let state = load();

let onSaveError = null;
export const setSaveErrorHandler = (fn) => (onSaveError = fn);

function writeNow() {
  pending = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error(e);
    onSaveError?.(e);
  }
  window.dispatchEvent(new Event('rep:saved')); // app nativa: aggiorna l'Apple Watch
}
/**
 * Salvataggio raggruppato: più modifiche ravvicinate (es. digitare un peso) diventano una sola scrittura,
 * poco dopo l'ultima. Prima che la pagina venga nascosta o chiusa si scrive subito, così nulla va perso.
 */
let pending = null;
export function save() {
  state.modifiedAt = Date.now();
  if (pending) return;
  pending = setTimeout(writeNow, 250);
}
export function saveNow() {
  if (pending) clearTimeout(pending);
  writeNow();
}
const flush = () => { if (pending) saveNow(); };
addEventListener('pagehide', flush);
addEventListener('beforeunload', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

/** Sostituisce tutti i dati (import backup) */
export function replaceState(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.workouts)) {
    throw new Error('File di backup non valido');
  }
  state = normalize(data);
  saveNow();
}

/** Ricorda un elemento eliminato (allenamento, scheda, misura, esercizio) per la sincronizzazione */
export function markDeleted(id) {
  if (id) state.deleted[id] = Date.now();
}

/** Dati arrivati dalla sincronizzazione: sostituiscono quelli locali senza contare come nuova modifica */
export function applySynced(data) {
  state = normalize(data);
  if (pending) clearTimeout(pending);
  writeNow();
}

export function resetState() {
  state = defaults();
  saveNow();
}

export function exportState() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'Rep' }, null, 2);
}
