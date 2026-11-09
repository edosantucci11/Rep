// Scheda "come si esegue": manichino animato + spiegazione in italiano (+ originale in inglese).
import { getExercise } from './exercises.js';
import { specFor } from './moves.js';
import { howTo } from './howto.js';
import { mount } from './mannequin.js';
import { esc } from './utils.js';
import { register, openModal, embedded } from './ui.js';
import { I } from './icons.js';
import { t, tn } from './i18n.js';
let details = null;
async function loadDetails() {
  if (!details) details = await (await fetch('data/exercise-details.json')).json();
  return details;
}

/** HTML della guida; poi chiamare activateGuide() dopo l'inserimento nel DOM */
export function guideHtml(ex, { compact = false } = {}) {
  const spec = specFor(ex);
  const h = howTo(ex, spec.key);
  return `
  <div class="guide-card ${compact ? 'compact' : ''}">
    <div class="mq" data-mq="${esc(ex.id)}" aria-hidden="true"></div>
    <div class="mq-legend"><span class="mq-dot"></span> ${esc(tn(ex.muscle))}${(ex.secondary || []).length ? ` <span class="mq-dot sec"></span> ${esc(ex.secondary.map(tn).join(', '))}` : ''}</div>
  </div>
  <div class="card guide">
    <div class="h-guide-static">${t('Come si esegue')}</div>
    <ol class="guide-steps">${h.steps.map((x, k) => `<li style="--i:${k}">${esc(x)}</li>`).join('')}</ol>
    ${h.variants.length ? `<div class="guide-sub">${t('Variante')}</div><ul class="guide-list">${h.variants.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <div class="guide-sub">${t('Consigli')}</div>
    <ul class="guide-list">${h.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${ex.lib ? `<details class="guide-orig" data-orig="${esc(ex.id)}"><summary><span>${t('Istruzioni originali complete')}</span><span class="label">${t('in inglese')}</span></summary><div class="guide-orig-body label">${t('Caricamento…')}</div></details>` : ''}
  </div>`;
}

export function activateGuide(root) {
  root.querySelectorAll('[data-mq]').forEach((el) => mount(el, specFor(getExercise(el.dataset.mq))));
  root.querySelectorAll('[data-orig]').forEach((det) => {
    det.addEventListener('toggle', async () => {
      if (!det.open || det.dataset.loaded) return;
      const body = det.querySelector('.guide-orig-body');
      try {
        const d = (await loadDetails())[det.dataset.orig];
        if (!d) throw new Error();
        const imgs = !embedded && navigator.onLine && d.img.length
          ? `<div class="guide-img">${d.img.map((src) => `<img src="https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${esc(src)}" alt="" loading="lazy" onerror="this.parentNode.remove()">`).join('')}</div>`
          : '';
        body.className = 'guide-orig-body';
        body.innerHTML = `${imgs}<ol class="guide-steps en">${d.i.map((x, k) => `<li style="--i:${k}">${esc(x)}</li>`).join('')}</ol>`;
        det.dataset.loaded = '1';
      } catch (e) {
        body.textContent = t('Istruzioni non disponibili.');
      }
    });
  });
}

/** Apre la guida in un pannello (da allenamento, scheda, selettore) */
export function openGuide(exId) {
  const ex = getExercise(exId);
  openModal(`
    <div class="modal-head"><span></span><h3>${esc(ex.name)}</h3><button class="icon-btn" data-action="modal-close" aria-label="${t('Chiudi')}">${I.close}</button></div>
    ${guideHtml(ex, { compact: true })}
    <button class="btn btn-block btn-outline" data-action="go" data-to="#/stats/ex/${esc(ex.id)}">${t('Vai a progressi e storico')}</button>`);
  activateGuide(document.getElementById('modal-root'));
}

register({
  'ex-guide': (el) => openGuide(el.dataset.id),
});
