import { esc } from './utils.js';
import { t, tn } from './i18n.js';

export const actions = {};
export const inputs = {};
export const changes = {};

/** Registra gestori: click (data-action), input (data-input), change (data-change) */
export function register(a = {}, i = {}, c = {}) {
  Object.assign(actions, a);
  Object.assign(inputs, i);
  Object.assign(changes, c);
}

let renderFn = () => {};
export const setRenderer = (fn) => (renderFn = fn);
/** Ridisegna la vista corrente mantenendo lo scroll */
export const rerender = () => renderFn(true);

/* ---------- Navigazione ----------
   Nella PWA si usa l'hash (#/history) così funziona il tasto indietro.
   Dentro un iframe (es. anteprima/artefatto) la rotta resta in memoria. */
export const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();
let memPath = '/';
const memStack = [];
let routeListener = () => {};
const afterNav = [];

const clean = (h) => (h || '').replace(/^#/, '').split('?')[0] || '/';

export const getPath = () => (embedded ? memPath : clean(location.hash));
export const onRoute = (fn) => (routeListener = fn);

/** Chiamato dal router dopo aver disegnato una nuova pagina */
export function flushAfterNav() {
  afterNav.splice(0).forEach((fn) => setTimeout(fn, 0));
}

export function go(hash, after) {
  const path = clean(hash);
  if (after) afterNav.push(after);
  if (path === getPath()) {
    rerender();
    flushAfterNav();
    return;
  }
  if (embedded) {
    memStack.push(memPath);
    memPath = path;
    routeListener();
  } else {
    location.hash = '#' + path;
  }
}

export function back() {
  if (embedded) {
    memPath = memStack.pop() || '/';
    routeListener();
  } else history.back();
}

if (!embedded) window.addEventListener('hashchange', () => routeListener());

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => (el.hidden = true), 250);
  }, ms);
}

/* ---------- Modal ---------- */
let modalOnClose = null;

export function openModal(html, { onClose, cls = '' } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="modal-bg"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.classList.add('modal-open');
  modalOnClose = onClose || null;
  requestAnimationFrame(() => root.firstElementChild?.classList.add('show'));
}

export function setModalContent(html) {
  const m = document.querySelector('#modal-root .modal-backdrop:not(.closing) .modal');
  if (m) m.innerHTML = html;
}

export function closeModal() {
  const bg = document.querySelector('#modal-root .modal-backdrop:not(.closing)');
  if (bg) {
    bg.classList.add('closing');
    bg.removeAttribute('data-action');
    setTimeout(() => bg.remove(), 320);
  }
  document.body.classList.remove('modal-open');
  const fn = modalOnClose;
  modalOnClose = null;
  fn?.();
}

export const isModalOpen = () => !!document.querySelector('#modal-root .modal-backdrop:not(.closing)');

/* ---------- Action sheet ---------- */
let sheetItems = [];

export function actionSheet(title, items) {
  sheetItems = items.filter(Boolean);
  openModal(
    `${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
     <div class="sheet-list">
       ${sheetItems
         .map((it, k) => `<button class="sheet-item ${it.danger ? 'danger' : ''} ${it.active ? 'active' : ''}" style="--i:${k}" data-action="sheet-pick" data-k="${k}">${it.icon ? `<span class="sheet-icon">${it.icon}</span>` : ''}${esc(it.label)}</button>`)
         .join('')}
     </div>
     <button class="btn btn-block btn-ghost" data-action="modal-close">${t('Annulla')}</button>`,
    { cls: 'sheet' }
  );
}

/* ---------- Conferma ---------- */
export function confirmDialog(message, { title = t('Sei sicuro?'), okText = t('Conferma'), danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    openModal(
      `<h3>${esc(title)}</h3>
       <p class="muted">${esc(message)}</p>
       <div class="modal-actions">
         <button class="btn btn-ghost" data-action="modal-close">${t('Annulla')}</button>
         <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-ok">${esc(okText)}</button>
       </div>`,
      { onClose: () => resolve(result) }
    );
    confirmOk = () => {
      result = true;
      closeModal();
    };
  });
}
let confirmOk = () => closeModal();

register({
  'modal-bg': (el, e) => {
    if (e.target === el) closeModal();
  },
  'modal-close': () => closeModal(),
  'confirm-ok': () => confirmOk(),
  'sheet-pick': (el) => {
    const it = sheetItems[Number(el.dataset.k)];
    closeModal();
    it?.fn?.();
  },
  go: (el) => go(el.dataset.to),
  back: () => back(),
});
