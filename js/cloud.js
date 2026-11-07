// Account Apple e sincronizzazione iCloud (solo app iPhone).
// I dati stanno nello spazio iCloud privato dell'utente (CloudKit): nessun server, nessuna password.
// "Accedi con Apple" collega il profilo (nome, email); la sincronizzazione unisce i dati dei dispositivi.
import { state, applySynced } from './store.js';
import { register, toast, rerender } from './ui.js';
import { I } from './icons.js';
import { logoUrl } from './logo.js';
import { t, tn } from './i18n.js';

const cap = window.Capacitor;
// disponibile solo nell'app iPhone con i permessi iCloud attivi (lo dice il plugin all'avvio)
let available = false;
const Cloud = () => (available && cap?.isNativePlatform?.() ? cap.Plugins?.RepCloud : null);
const META_KEY = 'rep-cloud';

/* ---------- stato dell'account (sul dispositivo, non sincronizzato) ---------- */

function readMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch (e) {
    return {};
  }
}
let meta = readMeta();
const writeMeta = () => {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* niente */ }
};
export const cloudMeta = () => meta;
export const isCloudAvailable = () => available;

/* ---------- unione dei dati di due dispositivi ---------- */

const LISTS = ['workouts', 'routines', 'customExercises', 'body'];

/**
 * Unisce i dati locali con quelli di iCloud. Gli elementi (allenamenti, schede, misure, esercizi)
 * si uniscono per id: se ci sono da entrambe le parti vince la versione del dispositivo modificato
 * più di recente; gli eliminati restano eliminati ovunque. Impostazioni e preferiti vengono dalla
 * versione più recente; l'allenamento in corso resta quello del dispositivo.
 */
export function mergeStates(local, remote) {
  // un dispositivo appena installato (senza dati) prende impostazioni e preferiti da iCloud
  const empty = (s) => !LISTS.some((k) => s[k]?.length);
  const remoteNewer = (empty(local) && !empty(remote)) || (remote.modifiedAt || 0) > (local.modifiedAt || 0);
  const newer = remoteNewer ? remote : local;
  const older = remoteNewer ? local : remote;
  const deleted = { ...(older.deleted || {}) };
  for (const [id, ts] of Object.entries(newer.deleted || {})) deleted[id] = Math.max(ts, deleted[id] || 0);
  const out = { ...newer, deleted, active: local.active ?? null, modifiedAt: Math.max(local.modifiedAt || 0, remote.modifiedAt || 0) };
  for (const k of LISTS) {
    const map = new Map();
    // l'ordine è quello della versione più recente; poi gli elementi che ha solo l'altra
    for (const x of newer[k] || []) map.set(x.id, x);
    for (const x of older[k] || []) if (!map.has(x.id)) map.set(x.id, x);
    out[k] = [...map.values()].filter((x) => !x.id || !deleted[x.id]);
  }
  out.workouts.sort((a, b) => b.start - a.start);
  return out;
}

/** Dati da salvare su iCloud: tutto tranne ciò che riguarda solo questo dispositivo */
function cloudPayload() {
  const { active, lastAutoBackup, ...rest } = state;
  return JSON.stringify(rest);
}

/* ---------- sincronizzazione ---------- */

let busy = false;
let again = false;

/** Scarica da iCloud, unisce, salva il risultato su iCloud. Ritorna true se è andata bene. */
export async function syncNow({ quiet = true } = {}) {
  const c = Cloud();
  if (!c || !meta.enabled) return false;
  if (busy) {
    again = true;
    return false;
  }
  busy = true;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await c.pull();
      if (r?.json) {
        const remote = JSON.parse(r.json);
        if (remote.modifiedAt !== state.modifiedAt || JSON.stringify(remote.deleted) !== JSON.stringify(state.deleted)) {
          const merged = mergeStates(state, remote);
          applySynced(merged);
          rerender();
        }
      }
      // niente da mandare se iCloud ha già esattamente questi dati
      if (r?.json && JSON.parse(r.json).modifiedAt === state.modifiedAt && meta.pushed === state.modifiedAt) break;
      const p = await c.push({ json: cloudPayload() });
      if (p?.conflict) continue; // un altro dispositivo ha salvato nel frattempo: si riunisce e si riprova
      meta.pushed = state.modifiedAt;
      break;
    }
    meta.lastSync = Date.now();
    meta.error = null;
    writeMeta();
    if (!quiet) toast(t('Sincronizzato con iCloud'));
    return true;
  } catch (e) {
    meta.error = String(e?.message || e);
    writeMeta();
    if (!quiet) toast(/account|iCloud/i.test(meta.error) ? t('Accedi a iCloud nelle Impostazioni dell\'iPhone') : t('Sincronizzazione non riuscita, riprovo più tardi'));
    return false;
  } finally {
    busy = false;
    if (again) {
      again = false;
      setTimeout(() => syncNow(), 1000);
    }
  }
}

// dopo ogni modifica (raggruppate: qualche secondo dopo l'ultima)
let timer = null;
window.addEventListener('rep:saved', () => {
  // durante l'allenamento cambia solo quello in corso, che non va su iCloud: si sincronizza alla fine
  if (!Cloud() || !meta.enabled || meta.pushed === state.modifiedAt || state.active) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 4000);
});
// tornando nell'app: dati degli altri dispositivi; uscendo: si salva subito quello che manca
document.addEventListener('visibilitychange', () => {
  if (!Cloud() || !meta.enabled) return;
  if (document.visibilityState === 'visible') syncNow();
  else if (meta.pushed !== state.modifiedAt) {
    clearTimeout(timer);
    syncNow();
  }
});
// con l'app aperta: un controllo al minuto (dati arrivati da iPad o da un altro iPhone)
setInterval(() => {
  if (Cloud() && meta.enabled && document.visibilityState === 'visible' && !state.active) syncNow();
}, 60000);

/* ---------- accesso con Apple ---------- */

export async function signIn() {
  const c = Cloud();
  if (!c) return false;
  try {
    const r = await c.signIn();
    meta = { ...meta, enabled: true, asked: true, user: r.user, name: r.name || meta.name || '', email: r.email || meta.email || '' };
    writeMeta();
    const ok = await syncNow();
    toast(ok ? t('Ciao {name}! I tuoi dati sono su iCloud', { name: meta.name ? meta.name.split(' ')[0] : '' }).replace(' !', '!') : t('Accesso fatto: la sincronizzazione riprova a breve'));
    return true;
  } catch (e) {
    if (!/cancel|annull|1001/i.test(String(e?.message || e))) toast(t('Accesso non riuscito'));
    return false;
  }
}

export function signOut() {
  meta = { asked: true };
  writeMeta();
  toast(t('Uscito: i dati restano su questo iPhone'));
}

/** All'avvio: account ancora valido (l'utente può revocarlo dalle Impostazioni) e prima sincronizzazione */
export async function startCloud() {
  const plugin = cap?.isNativePlatform?.() ? cap.Plugins?.RepCloud : null;
  if (!plugin) return;
  try {
    available = !!(await plugin.status())?.available;
  } catch (e) {
    available = false;
  }
  if (!available) return;
  if (location.hash.startsWith('#/tools')) rerender();
  const c = Cloud();
  if (meta.enabled && meta.user) {
    try {
      const { state: s } = await c.checkUser({ user: meta.user });
      if (s === 'revoked' || s === 'notFound') {
        signOut();
        return;
      }
    } catch (e) { /* senza rete si riprova la prossima volta */ }
    setTimeout(() => syncNow(), 1500);
  } else if (!meta.asked) {
    if (state.settings.onboarded) showLogin();
    else window.addEventListener('rep:onboarded', () => setTimeout(showLogin, 500), { once: true });
  }
}

/* ---------- pagina di accesso ---------- */

const APPLE = '<svg viewBox="0 0 17 20" width="17" height="20" aria-hidden="true"><path fill="currentColor" d="M14.06 10.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.59 1.1 8.74.73 1.05 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.85.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM11.88 4.16c.6-.73 1-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.22z"/></svg>';

export const appleButton = (action, label = t('Accedi con Apple')) =>
  `<button class="apple-btn" data-action="${action}">${APPLE}<span>${label}</span></button>`;

export function showLogin() {
  if (document.getElementById('login')) return;
  const el = document.createElement('div');
  el.id = 'login';
  el.className = 'login';
  el.innerHTML = `
    <div class="login-body">
      <img class="login-mark" src="${logoUrl()}" alt="Rep">
      <h1>${t('I tuoi allenamenti,')}<br><span>${t('ovunque')}</span></h1>
      <p>${t('Accedi con il tuo account Apple: schede, allenamenti e progressi si salvano da soli su iCloud e li ritrovi su ogni iPhone e iPad.')}</p>
      <ul class="login-points">
        <li>${I.check} ${t('Nessuna password da ricordare')}</li>
        <li>${I.check} ${t('Dati nel tuo iCloud privato: li vedi solo tu')}</li>
        <li>${I.check} ${t('Cambi telefono e ritrovi tutto')}</li>
      </ul>
    </div>
    <div class="login-foot">
      ${appleButton('login-apple')}
      <button class="btn btn-block btn-ghost" data-action="login-skip">${t('Continua senza account')}</button>
      <p class="muted xsmall center">${t('Puoi accedere anche dopo, da Altro › Account.')}</p>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
}

function hideLogin() {
  const el = document.getElementById('login');
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 400);
}

register({
  'login-apple': async () => {
    if (await signIn()) hideLogin();
  },
  'login-skip': () => {
    meta.asked = true;
    writeMeta();
    hideLogin();
  },
  'account-signin': async () => {
    if (await signIn()) rerender();
  },
  'account-sync': async () => {
    await syncNow({ quiet: false });
    rerender();
  },
  'account-signout': () => {
    signOut();
    rerender();
  },
});
