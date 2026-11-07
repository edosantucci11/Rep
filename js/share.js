// Condivisione tra persone, senza server: la scheda o l'allenamento viaggiano dentro il link
// (compressi), insieme a un'immagine dei risultati. Chi apre il link vede l'anteprima e può salvarla.
import { state, save } from './store.js';
import { register, go, toast, confirmDialog } from './ui.js';
import { getExercise } from './exercises.js';
import { workoutVolume, workoutSetCount, workingSets, setLabels, startWorkout, PR_LABELS } from './logic.js';
import { esc, fmtNum, fmtDuration, fmtDateLong, uid } from './utils.js';
import { I } from './icons.js';
import { cloudMeta } from './cloud.js';
import { t, tn } from './i18n.js';

const cap = window.Capacitor;
const Share = () => (cap?.isNativePlatform?.() ? cap.Plugins?.RepShare : null);
/** indirizzo pubblico della web app: i link funzionano anche per chi non ha l'app */
const WEB_URL = 'https://edosantucci11.github.io/Rep/';
const baseUrl = () => (location.protocol.startsWith('http') && !cap?.isNativePlatform?.() ? location.origin + location.pathname : WEB_URL);

/* ---------- codifica nel link ---------- */

const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function encode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if ('CompressionStream' in window) {
    try {
      return 'z' + b64(await pipe(raw, new CompressionStream('deflate-raw')));
    } catch (e) { /* senza compressione */ }
  }
  return 'j' + b64(raw);
}

export async function decode(code) {
  const bytes = unb64(code.slice(1));
  const raw = code[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}

/** Gli esercizi personalizzati viaggiano con nome e muscolo, così chi riceve li vede giusti */
function customsFor(exIds) {
  return [...new Set(exIds)]
    .map((id) => state.customExercises.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => [c.id, c.name, c.muscle, c.equipment]);
}

const sender = () => (state.settings.shareName || cloudMeta().name || '').trim().split(' ')[0];

export function packRoutine(r) {
  return {
    v: 1, t: 'r', n: r.name, no: r.notes || '', by: sender(),
    x: r.exercises.map((e) => [e.exId, e.sets, e.reps, e.rest, e.superset ? 1 : 0]),
    c: customsFor(r.exercises.map((e) => e.exId)),
  };
}

export function packWorkout(w) {
  return {
    v: 1, t: 'w', n: w.name, s: w.start, d: w.end - w.start, by: sender(),
    pr: (w.prs || []).map((p) => [p.exId, p.kind, p.value]),
    x: w.exercises.map((e) => [e.exId, e.sets.filter((s) => s.done !== false).map((s) => [+s.kg || 0, +s.reps || 0, s.type]), e.superset ? 1 : 0, e.target || '', e.rest]),
    c: customsFor(w.exercises.map((e) => e.exId)),
  };
}

const linkFor = async (obj) => `${baseUrl()}#/import/${await encode(obj)}`;

/* ---------- immagine dei risultati ---------- */

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}

/** Cartolina 1080×1350 (formato Instagram) con i numeri dell'allenamento */
export async function workoutImage(w) {
  // i caratteri vanno caricati prima di disegnare, altrimenti il canvas usa quelli di riserva
  try {
    await Promise.all(['900 64px "Barlow Condensed"', '800 40px "Barlow Condensed"', '700 30px "Barlow Condensed"', '600 38px "Barlow"', '500 32px "Barlow"']
      .map((f) => document.fonts.load(f)));
  } catch (e) { /* si disegna comunque */ }
  const W = 1080, H = 1350, P = 80;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const accent = css('--accent') || '#D4FF00';
  const D = (wt, px) => `${wt} ${px}px "Barlow Condensed", sans-serif`;
  const T = (wt, px) => `${wt} ${px}px "Barlow", sans-serif`;

  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, 900);
  glow.addColorStop(0, accent + '40');
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // intestazione
  g.fillStyle = accent;
  g.font = D(900, 64);
  g.fillText('REP', P, P + 50);
  g.fillStyle = '#8a8a8f';
  g.font = D(700, 30);
  g.textAlign = 'right';
  g.fillText(fmtDateLong(w.start).toUpperCase(), W - P, P + 46);
  g.textAlign = 'left';

  g.fillStyle = '#fff';
  g.font = D(900, 110);
  let name = w.name.toUpperCase();
  while (g.measureText(name).width > W - 2 * P && name.length > 4) name = name.slice(0, -2) + '…';
  g.fillText(name, P, P + 210);

  // tre numeri
  const stats = [
    [fmtDuration(w.end - w.start), 'DURATA'],
    [fmtNum(workoutVolume(w), 0), t('KG VOLUME')],
    [String(workoutSetCount(w)), t('SERIE')],
  ];
  const sw = (W - 2 * P - 40) / 3;
  stats.forEach(([v, l], k) => {
    const x = P + k * (sw + 20), y = P + 260;
    roundRect(g, x, y, sw, 170, 28);
    g.fillStyle = '#141416';
    g.fill();
    g.fillStyle = k === 1 ? accent : '#fff';
    g.font = D(900, 72);
    g.fillText(v, x + 28, y + 95);
    g.fillStyle = '#8a8a8f';
    g.font = D(700, 26);
    g.fillText(l, x + 28, y + 140);
  });

  // record
  let y = P + 500;
  const prs = w.prs || [];
  if (prs.length) {
    roundRect(g, P, y, W - 2 * P, 84, 42);
    g.fillStyle = accent;
    g.fill();
    g.fillStyle = '#000';
    g.font = D(900, 40);
    g.fillText(`🏆  ${prs.length} ${prs.length === 1 ? t('NUOVO RECORD') : t('NUOVI RECORD')}`, P + 36, y + 56);
    y += 124;
  }

  // esercizi con la serie migliore
  const exs = w.exercises.filter((e) => e.sets.some((s) => s.done !== false));
  const show = exs.slice(0, prs.length ? 6 : 7);
  g.font = D(700, 28);
  g.fillStyle = '#8a8a8f';
  g.fillText(t('ESERCIZI'), P, y + 10);
  y += 40;
  for (const e of show) {
    const ws = workingSets(e.sets).filter((s) => s.done !== false);
    const best = ws.reduce((b, s) => ((+s.kg || 0) * (1 + (+s.reps || 0) / 30) > (+b?.kg || 0) * (1 + (+b?.reps || 0) / 30) ? s : b), null);
    const isPr = prs.some((p) => p.exId === e.exId);
    g.fillStyle = '#fff';
    g.font = T(600, 38);
    let n = getExercise(e.exId).name;
    while (g.measureText(n).width > 560 && n.length > 4) n = n.slice(0, -2) + '…';
    g.fillText(n, P, y + 46);
    g.textAlign = 'right';
    g.font = D(800, 40);
    g.fillStyle = isPr ? accent : '#fff';
    g.fillText(`${ws.length}× · ${best ? `${fmtNum(+best.kg || 0, 2)} kg × ${best.reps}` : '—'}${isPr ? ' 🏆' : ''}`, W - P, y + 46);
    g.textAlign = 'left';
    g.fillStyle = '#222226';
    g.fillRect(P, y + 72, W - 2 * P, 2);
    y += 86;
  }
  if (exs.length > show.length) {
    g.fillStyle = '#8a8a8f';
    g.font = T(500, 32);
    g.fillText(`${t('+ altri')} ${t('{n} esercizi', { n: exs.length - show.length })}`, P, y + 44);
  }

  // firma, con la foto profilo se c'è
  let fx = P;
  if (state.settings.photo) {
    const im = new Image();
    im.src = state.settings.photo;
    try {
      await im.decode();
      const r = 34, cx = P + r, cy = H - P;
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      g.drawImage(im, cx - r, cy - r, r * 2, r * 2);
      g.restore();
      g.strokeStyle = accent;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, r + 2, 0, Math.PI * 2);
      g.stroke();
      fx = P + r * 2 + 20;
    } catch (e) { /* senza foto */ }
  }
  g.fillStyle = '#8a8a8f';
  g.font = D(700, 30);
  const by = sender();
  g.fillText(by ? `${by.toUpperCase()} · ${t('ALLENATO CON REP')}` : t('ALLENATO CON REP'), fx, H - P + 10);
  return cv.toDataURL('image/png');
}

/* ---------- invio ---------- */

async function shareOut({ title, text, url, image, fileName = 'rep.png' }) {
  const native = Share();
  if (native) {
    await native.share({ title, text, url, image: image ? image.split(',')[1] : '' });
    return;
  }
  try {
    if (image && navigator.canShare) {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, text: `${text}\n${url}`, files: [file] });
        return;
      }
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  // computer senza condivisione: link copiato e immagine scaricata
  try { await navigator.clipboard.writeText(url); } catch (e) { /* niente */ }
  if (image) {
    const a = document.createElement('a');
    a.href = image;
    a.download = fileName;
    a.click();
  }
  toast(t('Link copiato: incollalo dove vuoi'));
}

export async function shareWorkout(w) {
  toast(t('Preparo la condivisione…'), 1500);
  const [image, url] = await Promise.all([workoutImage(w), linkFor(packWorkout(w))]);
  await shareOut({
    title: w.name,
    text: `${w.name}: ${fmtDuration(w.end - w.start)}, ${fmtNum(workoutVolume(w), 0)} kg${(w.prs || []).length ? `, ${t('{n} record', { n: (w.prs || []).length })} 🏆` : ''}. ${t('Guardalo su Rep:')}`,
    url,
    image,
    fileName: 'allenamento-rep.png',
  });
}

export async function shareRoutine(r) {
  const url = await linkFor(packRoutine(r));
  await shareOut({ title: r.name, text: t('Ti mando la mia scheda "{name}" ({n} esercizi). Aprila con Rep:', { name: r.name, n: r.exercises.length }), url });
}

/* ---------- apertura di un link ricevuto ---------- */

let incoming = null;

export async function renderImport(code) {
  try {
    incoming = await decode(code);
  } catch (e) {
    incoming = null;
  }
  const d = incoming;
  if (!d || !Array.isArray(d.x)) {
    return `<div class="empty">${t('Link non valido o incompleto.')}<br><button class="btn" data-action="go" data-to="#/">${t('Vai a Rep')}</button></div>`;
  }
  const names = new Map((d.c || []).map(([id, name, muscle]) => [id, { name, muscle }]));
  const exName = (id) => {
    const ex = getExercise(id);
    return ex.missing ? names.get(id) || ex : ex;
  };
  const who = d.by ? esc(d.by) : t('Un amico');
  let body;
  if (d.t === 'r') {
    body = `
    <div class="label center">${t('{who} ti ha mandato una scheda', { who })}</div>
    <h2 class="import-title">${esc(d.n)}</h2>
    ${d.no ? `<div class="card note">${I.note} ${esc(d.no)}</div>` : ''}
    <div class="card">${d.x.map(([id, sets, reps]) => `
      <div class="import-row"><span>${esc(exName(id).name)}<br><span class="label">${esc(exName(id).muscle || '')}</span></span><b>${sets} × ${esc(reps)}</b></div>`).join('')}
    </div>
    <button class="btn btn-block btn-primary" data-action="import-routine">${I.plus} ${t('Salva nelle mie schede')}</button>`;
  } else {
    const prs = d.pr || [];
    const vol = d.x.reduce((sum, [, sets]) => sum + sets.filter((s) => s[2] !== 'W').reduce((a, [kg, r]) => a + kg * r, 0), 0);
    const nSets = d.x.reduce((sum, [, sets]) => sum + sets.filter((s) => s[2] !== 'W').length, 0);
    body = `
    <div class="label center">${t('Allenamento di')} ${who} · ${fmtDateLong(d.s)}</div>
    <h2 class="import-title">${esc(d.n)}</h2>
    <div class="stat-grid">
      <div class="stat"><b>${fmtDuration(d.d)}</b><span>${t('Durata')}</span></div>
      <div class="stat"><b>${fmtNum(vol, 0)}</b><span>${t('kg volume')}</span></div>
      <div class="stat"><b>${nSets}</b><span>${t('Serie')}</span></div>
    </div>
    ${prs.length ? `<div class="pr-list">${prs.map(([id, kind, value]) => `
      <div class="pr-item"><span><span class="pr-name">${esc(exName(id).name)}</span><br><span class="label">${PR_LABELS[kind] || 'Record'}</span></span>
      <b>${fmtNum(value, 1)}${kind === 'reps' ? '' : ' kg'}</b></div>`).join('')}</div>` : ''}
    <div class="card">${d.x.map(([id, sets]) => {
      const labels = setLabels(sets.map(([, , type]) => ({ type })));
      return `<div class="detail-ex"><div class="ex-name">${esc(exName(id).name)}</div>
        ${sets.map(([kg, reps, type], j) => `<div class="detail-set type-${type}"><span class="set-num static">${labels[j]}</span>
        <span class="ds-main"><b>${fmtNum(kg, 2)}</b> kg × <b>${reps}</b></span><span></span></div>`).join('')}</div>`;
    }).join('')}</div>
    <button class="btn btn-block btn-primary" data-action="import-train">${I.play} ${t('Allenati con questo')}</button>
    <button class="btn btn-block btn-outline" data-action="import-as-routine">${t('Salva come scheda')}</button>`;
  }
  // dalla web app su iPhone: chi ha l'app Rep può aprire il contenuto lì
  const appLink = !cap?.isNativePlatform?.() && /iPhone|iPad/.test(navigator.userAgent)
    ? `<a class="btn btn-block btn-ghost" href="rep://import/${code}">${t('Apri nell\'app Rep')}</a>` : '';
  return `
  <header class="page-head with-back">
    <button class="icon-btn" data-action="go" data-to="#/" aria-label="${t('Chiudi')}">${I.back}</button>
    <h1>${t('Condiviso')}</h1><span></span>
  </header>
  <div class="import">${body}${appLink}</div>`;
}

/** Esercizi personalizzati di chi ha mandato il link: si aggiungono se mancano */
function addCustoms(d) {
  for (const [id, name, muscle, equipment] of d.c || []) {
    if (getExercise(id).missing) state.customExercises.push({ id, name, muscle, equipment, category: 'Forza' });
  }
}

function routineFrom(d) {
  addCustoms(d);
  if (d.t === 'r') {
    return { id: uid(), name: d.n, notes: d.no || '', exercises: d.x.map(([exId, sets, reps, rest, ss]) => ({ exId, sets, reps: String(reps), rest: rest ?? state.settings.defaultRest, superset: !!ss })) };
  }
  return {
    id: uid(), name: d.n, notes: d.by ? `${t('Dall\'allenamento di')} ${d.by}` : '',
    exercises: d.x.map(([exId, sets, ss, target, rest]) => {
      const reps = sets.filter((s) => s[2] !== 'W').map((s) => s[1]);
      const min = Math.min(...reps), max = Math.max(...reps);
      return { exId, sets: Math.max(1, reps.length), reps: target || (reps.length ? (min === max ? String(min) : `${min}-${max}`) : '8-12'), rest: rest ?? state.settings.defaultRest, superset: !!ss };
    }),
  };
}

register({
  'share-workout': (el) => {
    const w = state.workouts.find((x) => x.id === el.dataset.id);
    if (w) shareWorkout(w);
  },
  'share-routine': (el) => {
    const r = state.routines.find((x) => x.id === el.dataset.id);
    if (r) shareRoutine(r);
  },
  'import-routine': () => {
    if (!incoming) return;
    const r = routineFrom(incoming);
    state.routines.push(r);
    save();
    toast(t('Scheda salvata'));
    go(`#/routine/${r.id}`);
  },
  'import-as-routine': () => {
    if (!incoming) return;
    const r = routineFrom(incoming);
    state.routines.push(r);
    save();
    toast(t('Scheda creata'));
    go(`#/routine/${r.id}`);
  },
  'import-train': async () => {
    if (!incoming) return;
    if (state.active && !(await confirmDialog(t('Hai già un allenamento in corso. Vuoi scartarlo?'), { okText: t('Scarta e inizia'), danger: true }))) return;
    addCustoms(incoming);
    startWorkout({
      name: incoming.n,
      exercises: incoming.x.map(([exId, sets, ss, target, rest]) => ({
        exId, superset: !!ss, reps: target, rest: rest ?? state.settings.defaultRest,
        setList: sets.map(([, , type]) => ({ type: type || 'N' })),
      })),
    });
    go('#/workout');
  },
});

// app iPhone: un link rep://… o https://…/Rep/#/import/… aperto da Messaggi/WhatsApp porta qui
Share()?.addListener?.('openUrl', ({ url }) => {
  const m = /#\/import\/([\w-]+)/.exec(url || '') || /import\/([\w-]+)/.exec(url || '');
  if (m) go(`#/import/${m[1]}`);
});


/** Pagina #/import/…: si decodifica il link e poi si mostra l'anteprima */
export function importPage(code) {
  renderImport(code).then((html) => {
    const root = document.getElementById('import-root');
    if (root) root.innerHTML = html;
  });
  return `<div id="import-root"><div class="empty small">${t('Apro il contenuto condiviso…')}</div></div>`;
}
