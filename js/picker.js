import { esc } from './utils.js';
import { MUSCLES, EQUIPMENT, CATEGORIES, allExercises, addCustomExercise, matchExercise, getExercise } from './exercises.js';
import { register, openModal, setModalContent, closeModal, toast } from './ui.js';
import { state, save } from './store.js';
import { exercisesWithHistory } from './logic.js';
import { I } from './icons.js';
import { guideHtml, activateGuide } from './exguide.js';
import { observeThumbs } from './thumbs.js';
import { t, tn, lang } from './i18n.js';
const COLL = new Intl.Collator(lang); // un solo collatore riusato (localeCompare ne crea uno a ogni confronto)

let ps = null;
const PAGE = 24;
const FILTER_MUSCLES = MUSCLES.filter((m) => m !== 'Altro');

/**
 * Apre il selettore esercizi (griglia con immagini, filtri per muscolo, preferiti).
 * onPick(ids[]) viene chiamato con gli esercizi scelti.
 */
export function openPicker({ multi = true, title = t('Esercizi'), onPick }) {
  ps = { q: '', muscle: '', cat: '', eq: '', fav: false, search: false, view: state.settings.pickerView || 'grid', shown: PAGE, selected: [], multi, title, onPick };
  openModal(pickerHtml(), { cls: 'modal-full picker-modal' });
  afterRender();
}

const favs = () => (state.favorites ||= []);
const isFav = (id) => favs().includes(id);

function filtered() {
  const recent = new Map(exercisesWithHistory().map((e) => [e.exId, e.count]));
  return allExercises()
    .filter((e) => (!ps.fav || isFav(e.id)) && (!ps.muscle || e.muscle === ps.muscle) && (!ps.cat || e.category === ps.cat) && (!ps.eq || e.equipment === ps.eq) && matchExercise(e, ps.q))
    .sort((a, b) => (recent.get(b.id) || 0) - (recent.get(a.id) || 0) || a.rank - b.rank || COLL.compare(a.name, b.name));
}

function card(e) {
  const sel = ps.selected.includes(e.id);
  const n = ps.selected.indexOf(e.id) + 1;
  if (ps.view === 'list') {
    return `<div class="pk-row ${sel ? 'selected' : ''}" data-action="picker-toggle" data-id="${e.id}" role="button">
      <img class="pk-row-img" data-thumb="${e.id}" alt="">
      <span class="pk-row-text"><span class="pk-name">${esc(e.name)}</span><span class="pk-sub">${esc(tn(e.muscle))} · ${esc(tn(e.equipment))}</span></span>
      <span class="pk-fav ${isFav(e.id) ? 'on' : ''}" data-action="picker-fav" data-id="${e.id}" role="button" aria-label="${t('Preferito')}">${I.bookmark}</span>
      <span class="pk-help" data-action="picker-info" data-id="${e.id}" role="button" aria-label="${t('Come si esegue')}">?</span>
      ${sel ? `<span class="pk-badge">${ps.multi ? n : '✓'}</span>` : ''}
    </div>`;
  }
  return `<div class="pk-card ${sel ? 'selected' : ''}" data-action="picker-toggle" data-id="${e.id}" role="button">
    <div class="pk-img"><img data-thumb="${e.id}" alt=""><span class="pk-ph"></span></div>
    <span class="pk-fav ${isFav(e.id) ? 'on' : ''}" data-action="picker-fav" data-id="${e.id}" role="button" aria-label="${t('Preferito')}">${I.bookmark}</span>
    <span class="pk-help" data-action="picker-info" data-id="${e.id}" role="button" aria-label="${t('Come si esegue')}">?</span>
    ${sel ? `<span class="pk-badge">${ps.multi ? n : '✓'}</span>` : ''}
    <div class="pk-body"><div class="pk-name">${esc(e.name)}</div><div class="pk-sub">${esc(tn(e.muscle))}</div></div>
  </div>`;
}

function listHtml() {
  const all = filtered();
  if (!all.length) {
    return `<div class="empty small">${ps.fav ? t('Nessun preferito: tocca il segnalibro su un esercizio per salvarlo.') : t('Nessun esercizio trovato.')}<br>
      <button class="btn btn-small btn-primary" data-action="picker-new">${t('Crea "{name}"', { name: esc(ps.q || t('nuovo esercizio')) })}</button></div>`;
  }
  const list = all.slice(0, ps.shown);
  return `<div class="pk-${ps.view}">${list.map(card).join('')}</div>${all.length > ps.shown ? '<div class="pk-more" id="pk-more"><span></span></div>' : ''}`;
}

/** Categorie in vista (le altre restano nei filtri): un tocco mostra solo quelle */
const QUICK_CATS = ['CrossFit', 'Riscaldamento', 'Mobilità', 'Stretching', 'Cardio'];
function catsHtml() {
  return QUICK_CATS.map((c) => `<button class="chip small ${ps.cat === c ? 'active' : ''}" data-action="picker-cat" data-v="${esc(c)}">${esc(tn(c))}</button>`).join('');
}

function musclesHtml() {
  return `<button class="pk-mu pk-mu-fav ${ps.fav ? 'active' : ''}" data-action="picker-favs" aria-label="${t('Preferiti')}"><span class="pk-mu-img">${I.bookmark}</span><span>${t('Preferiti')}</span></button>` +
    FILTER_MUSCLES.map((m) => `<button class="pk-mu ${ps.muscle === m ? 'active' : ''}" data-action="picker-muscle" data-m="${esc(m)}">
      <span class="pk-mu-img"><img data-muscle-icon="${esc(m)}" alt=""></span><span>${esc(tn(m))}</span></button>`).join('');
}

function titleHtml() {
  const n = filtered().length;
  const head = ps.fav ? t('Preferiti') : [ps.cat && ps.cat !== 'Forza' ? tn(ps.cat) : '', tn(ps.muscle)].filter(Boolean).join(' · ') || t('Tutti gli esercizi');
  return `<span>${esc(head)} <em>${n}</em></span><button class="icon-btn small" data-action="picker-view" aria-label="${t('Cambia vista')}">${ps.view === 'grid' ? I.list : I.grid}</button>`;
}

const filterCount = () => (ps.cat ? 1 : 0) + (ps.eq ? 1 : 0);

function filtersHtml() {
  if (!ps.filterOpen) return '';
  const row = (label, k, list) => `<div class="label">${label}</div><div class="chips scroll-x">${list.map((v) =>
    `<button class="chip small ${ps[k] === v ? 'active' : ''}" data-action="picker-setf" data-k="${k}" data-v="${esc(v)}">${esc(tn(v))}</button>`).join('')}</div>`;
  return row('Tipo', 'cat', CATEGORIES) + row('Attrezzo', 'eq', EQUIPMENT.filter((q) => q !== 'Altro'));
}

function pickerHtml() {
  const fc = filterCount();
  return `
  <div class="pk-head">
    <button class="icon-btn" data-action="modal-close" aria-label="${t('Chiudi')}">${I.close}</button>
    <h3>${esc(ps.title)}</h3>
    <button class="icon-btn ${ps.search ? 'on' : ''}" data-action="picker-search" aria-label="${t('Cerca')}">${I.search}</button>
    <button class="icon-btn pk-filter ${fc ? 'on' : ''}" data-action="picker-filter" aria-label="${t('Filtri')}">${I.filter}${fc ? `<b>${fc}</b>` : ''}</button>
    <button class="icon-btn" data-action="picker-new" aria-label="${t('Crea esercizio')}">${I.plus}</button>
  </div>
  <div class="pk-search ${ps.search || ps.q ? 'open' : ''}">
    <input id="picker-q" class="input search" type="search" placeholder="${t('Cerca (es. panca, curl, squat, rematore)…')}" data-input="picker-q" value="${esc(ps.q)}" autocomplete="off">
  </div>
  <div class="pk-filters ${ps.filterOpen ? 'open' : ''}" id="pk-filters">${filtersHtml()}</div>
  <div class="chips scroll-x pk-cats" id="picker-cats">${catsHtml()}</div>
  <div class="pk-muscles" id="picker-chips">${musclesHtml()}</div>
  <div class="pk-title" id="pk-title">${titleHtml()}</div>
  <div class="picker-list" id="picker-list">${listHtml()}</div>
  <div class="picker-foot" id="picker-foot">${footHtml()}</div>`;
}

function footHtml() {
  if (!ps.multi) return '';
  const n = ps.selected.length;
  return `<button class="btn btn-primary btn-block" data-action="picker-done" ${n ? '' : 'disabled'}>${n ? `${t('Aggiungi')} ${n} ${n === 1 ? 'esercizio' : 'esercizi'}` : t('Seleziona esercizi')}</button>`;
}

let moreIO = null;
function afterRender() {
  const root = document.getElementById('modal-root');
  observeThumbs(root);
  const more = document.getElementById('pk-more');
  moreIO?.disconnect();
  if (more && 'IntersectionObserver' in window) {
    moreIO = new IntersectionObserver((en) => {
      if (en.some((e) => e.isIntersecting)) {
        ps.shown += PAGE;
        refreshList(false);
      }
    }, { root: document.getElementById('picker-list'), rootMargin: '400px' });
    moreIO.observe(more);
  }
}

function refreshList(all = true) {
  const list = document.getElementById('picker-list');
  if (!list) return;
  const y = list.scrollTop;
  list.innerHTML = listHtml();
  if (!all) list.scrollTop = y;
  document.getElementById('pk-title').innerHTML = titleHtml();
  if (all) {
    document.getElementById('picker-chips').innerHTML = musclesHtml();
    document.getElementById('picker-foot').innerHTML = footHtml();
  }
  afterRender();
}

function finish(ids) {
  const cb = ps.onPick;
  moreIO?.disconnect();
  closeModal();
  ps = null;
  cb?.(ids);
}

function newExerciseForm() {
  setModalContent(`
    <div class="modal-head">
      <button class="btn btn-ghost btn-small" data-action="picker-back">${t('Indietro')}</button>
      <h3>${t('Nuovo esercizio')}</h3><span></span>
    </div>
    <label class="field"><span>${t('Nome')}</span><input id="nx-name" class="input" value="${esc(ps.q)}" placeholder="${t('Es. Panca su macchina')}"></label>
    <label class="field"><span>${t('Muscolo principale')}</span><select id="nx-muscle" class="input">${MUSCLES.map((m) => `<option value="${m}" ${m === ps.muscle ? 'selected' : ''}>${tn(m)}</option>`).join('')}</select></label>
    <label class="field"><span>${t('Attrezzo')}</span><select id="nx-eq" class="input">${EQUIPMENT.map((m) => `<option value="${m}">${tn(m)}</option>`).join('')}</select></label>
    <button class="btn btn-primary btn-block" data-action="picker-create">${t('Crea esercizio')}</button>`);
  setTimeout(() => document.getElementById('nx-name')?.focus(), 50);
}

const back = () => {
  setModalContent(pickerHtml());
  afterRender();
};

let qTimer = 0;
register(
  {
    'picker-info': (el, ev) => {
      ev.stopPropagation();
      const ex = getExercise(el.dataset.id);
      setModalContent(`<div class="modal-head"><button class="btn btn-ghost btn-small" data-action="picker-back">${t('Indietro')}</button><h3>${esc(ex.name)}</h3><span></span></div>
        <div class="picker-guide">${guideHtml(ex, { compact: true })}</div>
        <button class="btn btn-primary btn-block" data-action="picker-toggle" data-id="${esc(ex.id)}">${ps.selected.includes(ex.id) ? t('Rimuovi dalla selezione') : 'Seleziona'}</button>`);
      activateGuide(document.getElementById('modal-root'));
    },
    'picker-fav': (el, ev) => {
      ev.stopPropagation();
      const id = el.dataset.id;
      const f = favs();
      const i = f.indexOf(id);
      if (i >= 0) f.splice(i, 1);
      else f.push(id);
      save();
      el.classList.toggle('on', i < 0);
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      if (ps.fav) refreshList(false);
    },
    'picker-favs': () => {
      ps.fav = !ps.fav;
      if (ps.fav) ps.muscle = '';
      ps.shown = PAGE;
      refreshList();
    },
    'picker-toggle': (el) => {
      const id = el.dataset.id;
      if (!ps.multi) return finish([id]);
      const i = ps.selected.indexOf(id);
      if (i >= 0) ps.selected.splice(i, 1);
      else ps.selected.push(id);
      if (!document.getElementById('picker-list')) back();
      else {
        refreshList(false);
        document.getElementById('picker-foot').innerHTML = footHtml();
      }
    },
    'picker-muscle': (el) => {
      ps.muscle = ps.muscle === el.dataset.m ? '' : el.dataset.m;
      ps.fav = false;
      ps.shown = PAGE;
      refreshList();
      document.getElementById('picker-list').scrollTop = 0;
    },
    'picker-search': () => {
      ps.search = !ps.search;
      document.querySelector('.pk-search')?.classList.toggle('open', ps.search || !!ps.q);
      document.querySelector('[data-action=picker-search]')?.classList.toggle('on', ps.search);
      if (ps.search) setTimeout(() => document.getElementById('picker-q')?.focus(), 50);
    },
    'picker-view': () => {
      ps.view = ps.view === 'grid' ? 'list' : 'grid';
      state.settings.pickerView = ps.view;
      save();
      refreshList(false);
    },
    'picker-filter': () => {
      ps.filterOpen = !ps.filterOpen;
      const box = document.getElementById('pk-filters');
      box.innerHTML = filtersHtml();
      box.classList.toggle('open', ps.filterOpen);
    },
    'picker-setf': (el) => {
      ps[el.dataset.k] = ps[el.dataset.k] === el.dataset.v ? '' : el.dataset.v;
      ps.shown = PAGE;
      document.getElementById('pk-filters').innerHTML = filtersHtml();
      document.getElementById('picker-cats').innerHTML = catsHtml();
      const fc = filterCount();
      const btn = document.querySelector('.pk-filter');
      btn.classList.toggle('on', !!fc);
      btn.innerHTML = I.filter + (fc ? `<b>${fc}</b>` : '');
      refreshList(false);
    },
    'picker-cat': (el) => {
      ps.cat = ps.cat === el.dataset.v ? '' : el.dataset.v;
      ps.shown = PAGE;
      document.getElementById('picker-cats').innerHTML = catsHtml();
      const box = document.getElementById('pk-filters');
      if (box) box.innerHTML = filtersHtml();
      const fc = filterCount();
      const btn = document.querySelector('.pk-filter');
      btn.classList.toggle('on', !!fc);
      btn.innerHTML = I.filter + (fc ? `<b>${fc}</b>` : '');
      refreshList(false);
    },
    'picker-done': () => finish([...ps.selected]),
    'picker-new': () => newExerciseForm(),
    'picker-back': () => back(),
    'picker-create': () => {
      const name = document.getElementById('nx-name').value.trim();
      if (!name) return toast(t('Inserisci un nome'));
      const ex = addCustomExercise({
        name,
        muscle: document.getElementById('nx-muscle').value,
        equipment: document.getElementById('nx-eq').value,
      });
      toast(t('Esercizio creato'));
      if (!ps.multi) return finish([ex.id]);
      ps.selected.push(ex.id);
      ps.q = '';
      back();
    },
  },
  {
    'picker-q': (el) => {
      ps.q = el.value;
      // aggiorna l'elenco quando si smette di digitare per un attimo, non a ogni lettera
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        if (!document.getElementById('picker-list')) return;
        ps.shown = PAGE;
        document.getElementById('picker-list').innerHTML = listHtml();
        document.getElementById('pk-title').innerHTML = titleHtml();
        afterRender();
      }, 140);
    },
  }
);
