// Manichino animato: figura stilizzata 2D che esegue l'esercizio.
// Angoli assoluti in gradi: 0 = verso il basso, 90 = in avanti (destra), 180 = verso l'alto, -90 = indietro.
// La figura guarda a destra. Vista laterale ("side") o frontale ("front").

const R = Math.PI / 180;
const dir = (a) => [Math.sin(a * R), Math.cos(a * R)];
const add = (p, a, len) => {
  const d = dir(a);
  return [p[0] + d[0] * len, p[1] + d[1] * len];
};
const pair = (v) => (Array.isArray(v) ? v : [v, v]);
const G = 160; // linea del pavimento
const FY = 155; // altezza caviglia/punta quando il piede è a terra
const L = { torso: 50, neck: 7, head: 10.5, upper: 29, fore: 27, hand: 7, thigh: 40, shin: 38, foot: 13 };

/* ------------------------------------------------------------------ */
/* Cinematica                                                          */
/* ------------------------------------------------------------------ */

function sideJoints(p) {
  const hip = [0, 0];
  let sh = add(hip, p.torso, L.torso);
  sh = [sh[0], sh[1] - (p.sh || 0)];
  const ha = p.torso + (p.head || 0);
  const neck = add(sh, ha, L.neck);
  const head = add(neck, ha, L.head);
  const ua = pair(p.ua), fa = pair(p.fa), hd = pair(p.hand ?? p.fa);
  const th = pair(p.th), sn = pair(p.sn);
  const ft = p.ft !== undefined ? pair(p.ft) : [sn[0] + 90, sn[1] + 90];
  const arms = [0, 1].map((i) => {
    const el = add(sh, ua[i], L.upper);
    const wr = add(el, fa[i], L.fore);
    return { sh, el, wr, hd: add(wr, hd[i], L.hand) };
  });
  const legs = [0, 1].map((i) => {
    const kn = add(hip, th[i], L.thigh);
    const an = add(kn, sn[i], L.shin);
    return { hip, kn, an, to: add(an, ft[i], L.foot) };
  });
  return { view: 'side', hip, sh, neck, head, arms, legs };
}

function frontJoints(p) {
  const tl = p.tl || 0;
  const hip = [0, 0];
  const top = add(hip, 180 + tl, L.torso);
  const t = dir(180 + tl);
  const perp = [-t[1], t[0]];
  const head = add(add(top, 180 + tl + (p.head || 0), L.neck), 180 + tl + (p.head || 0), L.head);
  const ab = pair(p.ab), fb = pair(p.fb ?? p.ab), lb = pair(p.lb ?? 3), sb = pair(p.sb ?? p.lb ?? 3);
  const sides = [1, -1];
  const arms = sides.map((s, i) => {
    const sh = [top[0] + s * perp[0] * 15, top[1] + s * perp[1] * 15 - (p.sh || 0)];
    const el = [sh[0] + s * Math.sin(ab[i] * R) * L.upper, sh[1] + Math.cos(ab[i] * R) * L.upper];
    const wr = [el[0] + s * Math.sin(fb[i] * R) * L.fore, el[1] + Math.cos(fb[i] * R) * L.fore];
    return { sh, el, wr, hd: [wr[0] + s * Math.sin(fb[i] * R) * L.hand, wr[1] + Math.cos(fb[i] * R) * L.hand] };
  });
  const legs = sides.map((s, i) => {
    const h = [hip[0] + s * 9, hip[1]];
    const kn = [h[0] + s * Math.sin(lb[i] * R) * L.thigh, h[1] + Math.cos(lb[i] * R) * L.thigh];
    const an = [kn[0] + s * Math.sin(sb[i] * R) * L.shin, kn[1] + Math.cos(sb[i] * R) * L.shin];
    return { hip: h, kn, an, to: [an[0] + s * 7, an[1] + 2] };
  });
  return { view: 'front', hip, sh: top, neck: top, head, arms, legs, top };
}

function eachPoint(j, fn) {
  const pts = [j.hip, j.sh, j.neck, j.head, j.top].filter(Boolean);
  for (const a of j.arms) pts.push(a.sh, a.el, a.wr, a.hd);
  for (const l of j.legs) pts.push(l.hip, l.kn, l.an, l.to);
  const seen = new Set();
  for (const p of pts) if (!seen.has(p)) { seen.add(p); fn(p); }
}

function anchorPoint(j, key) {
  switch (key) {
    case 'feet': return j.view === 'front' ? [(j.legs[0].an[0] + j.legs[1].an[0]) / 2, Math.max(j.legs[0].an[1], j.legs[1].an[1])] : j.legs[0].an;
    case 'toes': return j.legs[0].to;
    case 'hands': return j.view === 'front' ? [(j.arms[0].wr[0] + j.arms[1].wr[0]) / 2, j.arms[0].wr[1]] : j.arms[0].wr;
    case 'shoulder': return j.sh;
    case 'knee': return j.legs[0].kn;
    case 'farknee': return j.legs[1].kn;
    case 'elbow': return j.arms[0].el;
    default: return j.hip;
  }
}

const ANG_KEYS = ['torso', 'ua', 'fa', 'hand', 'th', 'sn', 'ft'];
function rotatePose(p, d) {
  const q = { ...p };
  for (const k of ANG_KEYS) {
    if (q[k] === undefined) continue;
    q[k] = Array.isArray(q[k]) ? q[k].map((v) => v + d) : q[k] + d;
  }
  return q;
}

function solve(spec, pose) {
  const build = (p) => {
    const j = (spec.view === 'front' ? frontJoints : sideJoints)(p);
    const at = spec.anchor || 'hip';
    const ap = anchorPoint(j, at);
    const target = spec.at || [100, at === 'feet' || at === 'toes' ? FY : 100];
    const dx = target[0] - ap[0] + (p.x || 0);
    const dy = target[1] - ap[1] + (p.y || 0);
    eachPoint(j, (pt) => {
      pt[0] += dx;
      pt[1] += dy;
    });
    return j;
  };
  if (!spec.fix || spec.view === 'front') return build(pose);
  // ruota tutta la figura attorno all'ancora finché il giunto indicato tocca il pavimento
  const pick = (j) => {
    const f = spec.fix;
    if (f === 'wr') return j.arms[0].wr[1];
    if (f === 'el') return j.arms[0].el[1];
    if (f === 'kn') return j.legs[0].kn[1];
    return j.legs[0].to[1];
  };
  const target = spec.fixY ?? FY;
  let best = 0, bestErr = Infinity;
  for (let d = -35; d <= 35; d += 0.5) {
    const err = Math.abs(pick(build(rotatePose(pose, d))) - target);
    if (err < bestErr) { bestErr = err; best = d; }
  }
  return build(rotatePose(pose, best));
}

/* ------------------------------------------------------------------ */
/* Interpolazione                                                      */
/* ------------------------------------------------------------------ */

const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
function lerpPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] ?? b[k], vb = b[k] ?? a[k];
    if (Array.isArray(va) || Array.isArray(vb)) {
      const pa = pair(va), pb = pair(vb);
      out[k] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
    } else if (typeof va === 'number') out[k] = va + (vb - va) * t;
    else out[k] = t < 0.5 ? va : vb;
  }
  return out;
}

function poseAt(spec, ms) {
  const fr = spec.frames;
  if (fr.length === 1) return fr[0];
  const seg = spec.dur || 1000, hold = spec.hold ?? 260;
  const order = spec.loop === 'cycle' ? [...fr.keys(), 0] : [...fr.keys(), ...[...fr.keys()].reverse().slice(1)];
  const steps = order.length - 1;
  const per = seg + hold;
  const t = Math.max(0, ms) % (steps * per);
  const i = Math.floor(t / per);
  const local = Math.max(0, (t - i * per - hold) / seg);
  return lerpPose(fr[order[i]], fr[order[i + 1]], ease(Math.min(1, local)));
}

/* ------------------------------------------------------------------ */
/* Disegno                                                             */
/* ------------------------------------------------------------------ */

const W = { torso: 16, neck: 7, upper: 10, fore: 9, hand: 6, thigh: 13, shin: 11, foot: 7 };
const C_NEAR = '#efefef', C_FAR = '#5f5f5f', C_PROP = '#2b2b2b', C_PROP_LINE = '#8d8d8d';

// segmenti evidenziati per muscolo
const HL = {
  Petto: ['chest'], Dorso: ['chest', 'belly'], Lombari: ['belly'], Spalle: ['delt'], Trapezi: ['neck', 'trap'],
  Bicipiti: ['upper'], Tricipiti: ['upper'], Avambracci: ['fore'], Collo: ['neck'],
  Quadricipiti: ['thigh'], Femorali: ['thigh'], Glutei: ['glute', 'thighTop'], Abduttori: ['glute', 'thigh'], Adduttori: ['thigh'],
  Polpacci: ['shin'], Addome: ['belly'], Cardio: ['thigh', 'shin'], Altro: [],
};

const line = (a, b, w, c, extra = '') =>
  `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
const circle = (p, r, fill, extra = '') => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r}" fill="${fill}"${extra}/>`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function drawFigure(j, spec, accent) {
  const hl = new Set(spec.hl || []);
  const hl2 = new Set(spec.hl2 || []);
  const col = (part, near) => {
    if (hl.has(part)) return near ? accent : accent;
    if (hl2.has(part)) return near ? accent : accent;
    return near ? C_NEAR : C_FAR;
  };
  const op = (part, near) => (hl.has(part) ? (near ? '' : ' opacity="0.55"') : hl2.has(part) ? ' opacity="0.45"' : '');
  let back = '', front = '';
  const limb = (arm, near) => {
    let s = line(arm.sh, arm.el, W.upper, col('upper', near), op('upper', near));
    if (hl.has('delt')) s += line(arm.sh, lerp(arm.sh, arm.el, 0.35), W.upper + 1, accent, near ? '' : ' opacity="0.55"');
    s += line(arm.el, arm.wr, W.fore, col('fore', near), op('fore', near));
    s += line(arm.wr, arm.hd, W.hand, near ? C_NEAR : C_FAR);
    return s;
  };
  const leg = (lg, near) => {
    let s = line(lg.hip, lg.kn, W.thigh, col('thigh', near), op('thigh', near));
    if (hl.has('thighTop') || hl2.has('thighTop')) s += line(lg.hip, lerp(lg.hip, lg.kn, 0.4), W.thigh, accent, hl.has('thighTop') ? (near ? '' : ' opacity="0.55"') : ' opacity="0.45"');
    s += line(lg.kn, lg.an, W.shin, col('shin', near), op('shin', near));
    s += line(lg.an, lg.to, W.foot, near ? C_NEAR : C_FAR);
    return s;
  };
  if (j.view === 'side') {
    back += limb(j.arms[1], false) + leg(j.legs[1], false);
    let body = line(j.hip, j.sh, W.torso, C_NEAR);
    if (hl.has('chest') || hl2.has('chest')) body += line(lerp(j.hip, j.sh, 0.5), j.sh, W.torso, accent, hl.has('chest') ? '' : ' opacity="0.5"');
    if (hl.has('belly') || hl2.has('belly')) body += line(j.hip, lerp(j.hip, j.sh, 0.55), W.torso, accent, hl.has('belly') ? '' : ' opacity="0.5"');
    if (hl.has('trap')) body += line(lerp(j.hip, j.sh, 0.8), j.sh, W.torso, accent);
    if (hl.has('glute') || hl2.has('glute')) body += circle(j.hip, 8.5, accent, hl.has('glute') ? '' : ' opacity="0.5"');
    body += line(j.sh, j.neck, W.neck, col('neck', true)) + circle(j.head, L.head, C_NEAR);
    front += body + leg(j.legs[0], true) + limb(j.arms[0], true);
  } else {
    // vista frontale: braccio/gamba sinistra e destra entrambe "vicine"
    let body = line(j.hip, j.top, 24, C_NEAR) + line(j.arms[0].sh, j.arms[1].sh, 11, C_NEAR) + line(j.legs[0].hip, j.legs[1].hip, 13, C_NEAR);
    if (hl.has('chest') || hl.has('belly')) body += line(hl.has('belly') ? j.hip : lerp(j.hip, j.top, 0.5), hl.has('belly') ? lerp(j.hip, j.top, 0.55) : j.top, 18, accent);
    if (hl.has('trap')) body += line(j.arms[0].sh, j.arms[1].sh, 7, accent);
    body += line(j.top, j.head, W.neck, col('neck', true)) + circle(j.head, L.head, C_NEAR);
    back += leg(j.legs[0], true) + leg(j.legs[1], true);
    front += body + limb(j.arms[0], true) + limb(j.arms[1], true);
  }
  return { back, front };
}

/* ------------------------------------------------------------------ */
/* Attrezzi                                                            */
/* ------------------------------------------------------------------ */

function drawProps(j, spec) {
  let back = '', front = '';
  const P = spec.props || [];
  for (const pr of P) {
    switch (pr.t) {
      case 'bench': { // panca piana / inclinata: x, y, w, ang
        const ang = pr.ang || 0;
        const a = [pr.x, pr.y], b = [pr.x + Math.cos(ang * R) * pr.w, pr.y - Math.sin(ang * R) * pr.w];
        back += line(a, b, 8, '#3a3a3a');
        const base = pr.leg ?? pr.x + pr.w / 2;
        back += line([base, pr.y + 4], [base, G], 6, C_PROP) + line([base - 14, G - 1], [base + 14, G - 1], 4, C_PROP);
        break;
      }
      case 'box': back += `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${G - pr.y}" rx="3" fill="${C_PROP}" stroke="#3a3a3a"/>`; break;
      case 'bar': // sbarra per trazioni (vista di testa)
        back += line([pr.x - 30, pr.y], [pr.x + 30, pr.y], 3, '#3a3a3a') + circle([pr.x, pr.y], 4, C_PROP_LINE);
        break;
      case 'pulley': {
        const hand = (pr.hand === 'far' ? j.arms[1] : j.arms[0]).wr;
        back += circle([pr.x, pr.y], 5, C_PROP, ` stroke="${C_PROP_LINE}" stroke-width="2"`);
        back += line([pr.x, pr.y], hand, 1.6, C_PROP_LINE);
        if (pr.both && j.view === 'front') back += line([pr.x2, pr.y], j.arms[1].wr, 1.6, C_PROP_LINE) + circle([pr.x2, pr.y], 5, C_PROP, ` stroke="${C_PROP_LINE}" stroke-width="2"`);
        front += circle(hand, 3.5, C_PROP_LINE);
        break;
      }
      case 'barbell': {
        const at = pr.at === 'back' ? [j.sh[0] - 6, j.sh[1] - 3] : pr.at === 'hip' ? [j.hip[0] + 4, j.hip[1] - 12] : j.arms[0].wr;
        front += circle(at, pr.r || 15, '#1d1d1d', ` stroke="${C_PROP_LINE}" stroke-width="2.5"`) + circle(at, 3, C_PROP_LINE);
        break;
      }
      case 'dumbbell':
        for (const k of j.view === 'front' ? [0, 1] : [1, 0]) {
          const w = j.arms[k].wr;
          (k === 0 || j.view === 'front' ? (s) => (front += s) : (s) => (back += s))(circle(w, 6.5, '#1d1d1d', ` stroke="${C_PROP_LINE}" stroke-width="2"`));
        }
        break;
      case 'kettlebell': {
        const w = j.arms[0].wr;
        front += circle([w[0], w[1] + 8], 7.5, '#1d1d1d', ` stroke="${C_PROP_LINE}" stroke-width="2"`) + line(w, [w[0], w[1] + 2], 3, C_PROP_LINE);
        break;
      }
      case 'ball': case 'wheel': {
        const w = j.view === 'front' ? lerp(j.arms[0].wr, j.arms[1].wr, 0.5) : j.arms[0].wr;
        front += circle([w[0] + (j.view === 'side' ? 6 : 0), w[1]], 10, '#1d1d1d', ` stroke="${C_PROP_LINE}" stroke-width="2"`);
        break;
      }
      case 'pad': { // cuscinetto della macchina attaccato a un giunto
        const p = pr.j === 'ankle' ? j.legs[0].an : pr.j === 'knee' ? j.legs[0].kn : pr.j === 'elbow' ? j.arms[0].el : j.hip;
        back += circle([p[0] + (pr.dx || 0), p[1] + (pr.dy || 0)], pr.r || 6, '#3a3a3a');
        break;
      }
      case 'seat': back += line([pr.x - pr.w / 2, pr.y], [pr.x + pr.w / 2, pr.y], 8, '#3a3a3a') + line([pr.x, pr.y + 4], [pr.x, G], 6, C_PROP); break;
      case 'back': back += line([pr.x, pr.y], [pr.x2, pr.y2], 8, '#3a3a3a'); break;
      case 'plate': { // pedana della leg press, perpendicolare alla spinta
        const a = j.legs[0].to, b = j.legs[0].an;
        const m = lerp(a, b, 0.4), d = dir(pr.ang);
        back += line([m[0] - d[0] * 22, m[1] - d[1] * 22], [m[0] + d[0] * 22, m[1] + d[1] * 22], 7, '#3a3a3a');
        break;
      }
      case 'roller': {
        const p = pr.j === 'thigh' ? lerp(j.legs[0].hip, j.legs[0].kn, 0.5) : pr.j === 'shin' ? lerp(j.legs[0].kn, j.legs[0].an, 0.5) : lerp(j.hip, j.sh, 0.5);
        back += circle([p[0], G - 9], 9, C_PROP, ` stroke="${C_PROP_LINE}" stroke-width="2"`);
        break;
      }
      case 'wall': back += line([pr.x, -40], [pr.x, G], 6, '#2a2a2a'); break;
      case 'bike': back += circle([pr.x, pr.y], 12, 'none', ` stroke="${C_PROP_LINE}" stroke-width="2" stroke-dasharray="3 4"`) + line([pr.sx - 10, pr.sy], [pr.sx + 10, pr.sy], 6, '#3a3a3a') + line([pr.sx, pr.sy], [pr.x, pr.y], 4, C_PROP) + line([pr.hx, pr.hy], [pr.x + 10, pr.y], 4, C_PROP); break;
      case 'rail': back += line([pr.x1, G - 6], [pr.x2, G - 6], 6, '#3a3a3a'); break;
    }
  }
  return { back, front };
}

export function renderFrame(spec, ms, accent = 'var(--accent)') {
  const pose = poseAt(spec, ms);
  const j = solve(spec, pose);
  const fig = drawFigure(j, spec, accent);
  const pr = drawProps(j, spec);
  const floor = spec.noFloor ? '' : line([-6, G + 1.5], [206, G + 1.5], 2, '#2a2a2a');
  return floor + pr.back + fig.back + fig.front + pr.front;
}

/* ------------------------------------------------------------------ */
/* Montaggio e animazione                                              */
/* ------------------------------------------------------------------ */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

export function mount(el, spec) {
  if (!el || !spec) return;
  el.innerHTML = `<svg viewBox="-8 -46 216 214" class="mq-svg" role="img" aria-label="Animazione dell'esercizio"><g></g></svg>`;
  const g = el.querySelector('g');
  if (reduce.matches) {
    g.innerHTML = renderFrame(spec, (spec.dur || 1000) * 0.6 + (spec.hold ?? 260));
    return;
  }
  // ~30 fotogrammi al secondo bastano a un movimento lento; fermo se non è visibile o l'app è in background
  const t0 = performance.now();
  let last = 0, visible = true;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => (visible = es[0].isIntersecting)) : null;
  io?.observe(el);
  const loop = (now) => {
    if (!g.isConnected) { io?.disconnect(); return; }
    if (visible && !document.hidden && now - last > 31) {
      last = now;
      g.innerHTML = renderFrame(spec, now - t0);
    }
    requestAnimationFrame(loop);
  };
  g.innerHTML = renderFrame(spec, 0);
  requestAnimationFrame(loop);
}
export { solve, poseAt, FY as FOOT_Y };
