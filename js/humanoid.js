// Corpo umano realistico (uomo/donna) generato da MakeHuman/MPFB2 (CC0), con scheletro e pelle.
// Le pose arrivano dallo scheletro 3D di mannequin3d: ogni osso viene orientato verso la posizione
// del giunto successivo (retargeting per direzioni), poi il corpo viene ancorato come nel 2D.

const cache = {};
const LEG = 0.78; // lunghezza gamba (anca → caviglia) dello scheletro delle pose, in metri

export async function loadBody(THREE, gender) {
  if (cache[gender]) return cache[gender];
  // formato binario; in alternativa la stessa cosa in base64 (per hosting che non servono .bin)
  let buf;
  const res = await fetch(`data/body-${gender}.bin`).catch(() => null);
  if (res && res.ok && !(res.headers.get('content-type') || '').includes('text/html')) buf = await res.arrayBuffer();
  else {
    const txt = await (await fetch(`data/body-${gender}.b64.txt`)).text();
    const bin = atob(txt.trim());
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    buf = u8.buffer;
  }
  const dv = new DataView(buf);
  const hlen = dv.getUint32(0, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen)));
  let o = 4 + hlen;
  const nv = meta.nv, nt = meta.nt;
  const pos = new Float32Array(buf.slice(o, o + nv * 12)); o += nv * 12;
  const part = new Uint8Array(buf.slice(o, o + nv)); o += nv + ((4 - (nv % 4)) % 4);
  const skinI = new Uint8Array(buf.slice(o, o + nv * 4)); o += nv * 4;
  const skinW = new Uint8Array(buf.slice(o, o + nv * 4)); o += nv * 4;
  const tri = new Uint16Array(buf.slice(o, o + nt * 6));

  // ruota il modello (guarda +Z) perché guardi +X come le pose: (x, y, z) → (z, y, -x)
  const rot = (x, y, z) => [z, y, -x];
  for (let i = 0; i < nv; i++) {
    const [a, b, c] = rot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    pos[i * 3] = a; pos[i * 3 + 1] = b; pos[i * 3 + 2] = c;
  }
  const bones = meta.bones.map((b) => ({ ...b, head: rot(...b.head), tail: rot(...b.tail) }));
  const byName = Object.fromEntries(bones.map((b, i) => [b.name, i]));

  // scala: gamba del modello = gamba dello scheletro delle pose
  const H = (n) => bones[byName[n]].head;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const leg = dist(H('thigh_r'), H('calf_r')) + dist(H('calf_r'), H('foot_r'));
  const s = (LEG / leg) * (gender === 'female' ? 0.97 : 1);
  for (let i = 0; i < pos.length; i++) pos[i] *= s;
  bones.forEach((b) => {
    b.head = b.head.map((v) => v * s);
    b.tail = b.tail.map((v) => v * s);
  });

  const data = { meta, nv, pos, part, skinI, skinW, tri, bones, byName, gender };
  data.regions = classify(data);
  cache[gender] = data;
  return data;
}

/* ------------------------------------------------------------------ */
/* Regioni del corpo: abbigliamento e muscoli con bordi sfumati         */
/* ------------------------------------------------------------------ */

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function classify(d) {
  const { nv, pos, skinI, skinW, bones, byName, part } = d;
  const root = bones.map((b) => b.name.replace(/_(l|r)$/, '').replace(/_0\d$/, ''));
  const H = (n) => bones[byName[n]].head;
  // peso per gruppo di ossa (somma dei 4 pesi)
  const W = new Map();
  const groupW = (i, set) => {
    let s = 0;
    for (let k = 0; k < 4; k++) if (set.has(root[skinI[i * 4 + k]])) s += skinW[i * 4 + k] / 255;
    return s;
  };
  // asse di un osso alla quota di un vertice → lato anteriore/posteriore
  const axisX = (n, y) => {
    const a = H(n), b = n.startsWith('upperarm') ? H(n.replace('upperarm', 'lowerarm')) : n.startsWith('lowerarm') ? H(n.replace('lowerarm', 'hand'))
      : n.startsWith('thigh') ? H(n.replace('thigh', 'calf')) : H(n.replace('calf', 'foot'));
    const t = Math.min(1, Math.max(0, (y - a[1]) / (b[1] - a[1] || 1)));
    return a[0] + (b[0] - a[0]) * t;
  };
  const eyeY = (() => {
    let s = 0, n = 0;
    for (let i = 0; i < nv; i++) if (part[i] === 2) { s += pos[i * 3 + 1]; n++; }
    return n ? s / n : H('head')[1] + 0.06;
  })();
  // punto più avanzato del petto e sommità delle spalle (misurati sul modello)
  let bustY = H('spine_03')[1], bustX = -1, shoulderTop = H('upperarm_r')[1];
  for (let i = 0; i < nv; i++) {
    if (part[i] !== 0) continue;
    const x = pos[i * 3], y = pos[i * 3 + 1], az = Math.abs(pos[i * 3 + 2]);
    if (y > H('spine_02')[1] && y < H('neck_01')[1] && az < 0.12 && x > bustX) { bustX = x; bustY = y; }
    if (az > 0.13 && az < 0.16 && y > H('spine_03')[1] && y < H('neck_01')[1] + 0.05 && y > shoulderTop) shoulderTop = y;
  }
  const L = {
    bustY, shoulderTop, shX: H('upperarm_r')[0], shZ: Math.abs(H('upperarm_r')[2]),
    pelvisY: H('pelvis')[1], chestY: H('spine_03')[1], neckY: H('neck_01')[1], headY: H('head')[1],
    kneeY: H('calf_r')[1], thighY: H('thigh_r')[1], ankleY: H('foot_r')[1], cx: H('spine_02')[0], headX: H('head')[0], eyeY,
  };
  const G = {
    torso: new Set(['spine', 'pelvis', 'clavicle', 'neck']), chestG: new Set(['spine', 'clavicle']), up: new Set(['upperarm']), fore: new Set(['lowerarm']),
    hand: new Set(['hand', 'thumb', 'index', 'middle', 'ring', 'pinky']), thigh: new Set(['thigh']), calf: new Set(['calf']),
    foot: new Set(['foot', 'ball']), hips: new Set(['pelvis', 'thigh', 'spine']), neck: new Set(['neck']), head: new Set(['head']),
    pelvis: new Set(['pelvis']), arms: new Set(['upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky', 'clavicle']),
  };
  const reg = new Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const side = z >= 0 ? 'r' : 'l';
    const v = {
      x, y, z, part: part[i],
      torso: groupW(i, G.torso), up: groupW(i, G.up), fore: groupW(i, G.fore), hand: groupW(i, G.hand),
      thigh: groupW(i, G.thigh), calf: groupW(i, G.calf), foot: groupW(i, G.foot), hips: groupW(i, G.hips),
      neck: groupW(i, G.neck), head: groupW(i, G.head), pelvis: groupW(i, G.pelvis), arms: groupW(i, G.arms),
      clav: groupW(i, new Set(['clavicle'])),
    };
    v.frontT = sstep(-0.025, 0.025, x - L.cx); // busto: davanti
    v.frontUp = sstep(-0.012, 0.012, x - axisX('upperarm_' + side, y));
    v.frontTh = sstep(-0.02, 0.02, x - axisX('thigh_' + side, y));
    v.frontCalf = sstep(-0.015, 0.015, x - axisX('calf_' + side, y));
    reg[i] = v;
  }
  void W;
  return { reg, ...L };
}

/** Pesi 0..1 per abbigliamento e regioni muscolari */
function regionWeights(d) {
  const R = d.regions, female = d.gender === 'female';
  const { pelvisY, chestY, neckY, kneeY, thighY, ankleY, headY, headX, eyeY, bustY, shoulderTop, shX, shZ } = R;
  const cut = kneeY + (thighY - kneeY) * (d.style === 'skin' ? (female ? 0.42 : 0.3) : 0.6);
  const waist = pelvisY + (female ? 0.075 : 0.065);

  // testa come ellissoide: centro ed estensione dai vertici della testa
  const hv = R.reg.filter((v) => v.part === 0 && v.head > 0.6);
  const ext = (k) => [Math.min(...hv.map((v) => v[k])), Math.max(...hv.map((v) => v[k]))];
  const [x0, x1] = ext('x'), [y0, y1] = ext('y'), [z0, z1] = ext('z');
  const HC = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, ex: (x1 - x0) / 2, ey: (y1 - y0) / 2, ez: (z1 - z0) / 2 };
  R.headEll = HC;
  // attaccatura dei capelli: alta sulla fronte, sopra le orecchie, bassa sulla nuca (soglia sull'elevazione)
  const front = female ? 0.64 : 0.6;
  const hairOf = (v) => {
    if (v.head < 0.05) return 0;
    const dx = (v.x - HC.x) / HC.ex, dy = (v.y - HC.y) / HC.ey, dz = (v.z - HC.z) / HC.ez;
    const len = Math.hypot(dx, dy, dz) || 1;
    const phi = Math.atan2(Math.abs(dz), dx); // 0 = fronte, π = nuca
    const A = (front - 0.5) / 2 + 0.11, C = A - 0.22, B = front - A - C;
    const thr = A + B * Math.cos(phi) + C * Math.cos(2 * phi);
    const ears = 1 - sstep(0.86, 0.97, Math.abs(dz)) * (1 - sstep(0.25, 0.4, dy / len));
    return v.head * sstep(thr - 0.045, thr + 0.045, dy / len) * ears;
  };

  return R.reg.map((v) => {
    if (v.part !== 0) return { eye: 1 };
    const notArm = 1 - Math.min(1, v.arms * 1.6);
    const shorts = Math.min(1, v.hips * 1.15) * notArm * sstep(cut - 0.008, cut + 0.008, v.y) * (1 - sstep(waist - 0.008, waist + 0.008, v.y));
    let top = 0;
    if (female) {
      // reggiseno sportivo: fascia dal sottoseno a sopra il seno (più bassa dietro) + spalline
      const fr = v.frontT;
      const low = bustY - 0.075 * fr - 0.07 * (1 - fr);
      const high = bustY + 0.07 * fr + 0.0 * (1 - fr);
      const band = sstep(low - 0.005, low + 0.005, v.y) * (1 - sstep(high - 0.006, high + 0.006, v.y));
      const az = Math.abs(v.z);
      const strap = sstep(0.05, 0.058, az) * (1 - sstep(0.078, 0.086, az)) * sstep(high - 0.012, high, v.y) * (1 - sstep(shoulderTop + 0.004, shoulderTop + 0.014, v.y)) * (1 - Math.min(1, (v.neck + v.head) * 2));
      top = Math.max(band * notArm, strap) * (1 - Math.min(1, (v.neck + v.head) * 2)); // tutto il busto nella fascia, braccia escluse
    }
    const hair = hairOf(v);
    const brow = v.head * sstep(0.055, 0.07, v.x - headX) * sstep(eyeY + 0.012, eyeY + 0.016, v.y) * (1 - sstep(eyeY + 0.024, eyeY + 0.028, v.y)) * sstep(0.008, 0.014, Math.abs(v.z)) * (1 - sstep(0.045, 0.052, Math.abs(v.z)));
    const fT = v.frontT, bT = 1 - v.frontT;
    const m = {
      chest: Math.min(1, (v.torso - v.pelvis) * 1.2) * fT * sstep(chestY - 0.07, chestY - 0.03, v.y) * (1 - sstep(neckY - 0.02, neckY + 0.01, v.y)) * (1 - v.up),
      belly: Math.min(1, v.torso * 1.2) * fT * sstep(pelvisY - 0.02, pelvisY + 0.02, v.y) * (1 - sstep(chestY - 0.07, chestY - 0.03, v.y)),
      back: Math.min(1, v.torso * 1.2) * bT * sstep(chestY - 0.16, chestY - 0.1, v.y) * (1 - sstep(neckY - 0.03, neckY, v.y)) * (1 - v.up),
      lower: Math.min(1, v.torso * 1.2) * bT * sstep(pelvisY + 0.02, pelvisY + 0.05, v.y) * (1 - sstep(chestY - 0.14, chestY - 0.09, v.y)),
      delt: Math.min(1, v.up + v.clav * 0.7) * sstep(0.115, 0.15, Math.abs(v.z)) * sstep(shoulderTop - 0.16, shoulderTop - 0.1, v.y) * (1 - v.torso * 0.5),
      // deltoide anteriore / laterale / posteriore (rispetto alla testa dell'omero)
      deltFront: 0, deltSide: 0, deltRear: 0,
      chestUpper: 0, chestLower: 0, lats: 0, midback: 0, trapUpper: 0,
      biceps: v.up * v.frontUp * (1 - sstep(shoulderTop - 0.11, shoulderTop - 0.06, v.y)),
      triceps: v.up * (1 - v.frontUp) * (1 - sstep(shoulderTop - 0.11, shoulderTop - 0.06, v.y)),
      upper: v.up,
      fore: v.fore,
      trap: (v.neck * 0.8 + v.clav * 0.7 + v.torso * 0.4) * bT * sstep(chestY + 0.04, chestY + 0.08, v.y) * (1 - v.head),
      neck: v.neck * (1 - v.head * 0.8),
      quads: v.thigh * v.frontTh,
      hams: v.thigh * (1 - v.frontTh),
      thigh: v.thigh,
      glute: (v.pelvis + v.thigh * 0.6) * bT * (1 - sstep(pelvisY + 0.03, pelvisY + 0.06, v.y)) * sstep(thighY - 0.16, thighY - 0.1, v.y),
      shin: v.calf * (1 - v.frontCalf),
      calfAll: v.calf,
    };
    const az = Math.abs(v.z);
    const dl = m.delt;
    m.deltFront = dl * sstep(-0.005, 0.03, v.x - shX);
    m.deltRear = dl * sstep(-0.005, 0.03, shX - v.x);
    m.deltSide = dl * (1 - Math.max(sstep(0.01, 0.04, v.x - shX), sstep(0.01, 0.04, shX - v.x))) * sstep(shZ - 0.02, shZ + 0.02, az);
    m.chestUpper = m.chest * sstep(chestY + 0.015, chestY + 0.06, v.y);
    m.chestLower = m.chest * (1 - sstep(chestY + 0.01, chestY + 0.05, v.y));
    // gran dorsale: ali laterali della schiena, dalla vita alla scapola
    m.lats = Math.min(1, v.torso * 1.3) * (1 - v.frontT * 0.85) * sstep(0.035, 0.07, az) * sstep(pelvisY + 0.05, pelvisY + 0.11, v.y) * (1 - sstep(chestY + 0.04, chestY + 0.09, v.y)) * (1 - Math.min(1, v.up * 1.5));
    m.midback = m.back * (1 - sstep(0.05, 0.08, az)) * sstep(chestY - 0.06, chestY - 0.02, v.y);
    m.trapUpper = m.trap * sstep(chestY + 0.07, chestY + 0.11, v.y);
    return { shorts, top, hair, brow, foot: v.foot * (1 - sstep(ankleY + 0.02, ankleY + 0.05, v.y)), m };
  });
}

// mappa le zone del motore pose (hl) sulle regioni anatomiche
const HL_MAP = {
  chest: ['chest'], belly: ['belly'], delt: ['delt'], upper: ['upper'], fore: ['fore'], thigh: ['thigh'], shin: ['shin'],
  glute: ['glute'], thighTop: ['glute'], trap: ['trap'], neck: ['neck'],
};
const MUSCLE_MAP = {
  Petto: ['chest'], Dorso: ['back'], Lombari: ['lower'], Spalle: ['delt'], Trapezi: ['trap'], Bicipiti: ['biceps'], Tricipiti: ['triceps'],
  Avambracci: ['fore'], Collo: ['neck'], Quadricipiti: ['quads'], Femorali: ['hams'], Glutei: ['glute'], Abduttori: ['glute'],
  Adduttori: ['thigh'], Polpacci: ['shin'], Addome: ['belly'], Cardio: ['quads', 'shin'],
};

/**
 * Cavità della superficie (solchi tra i muscoli): differenza tra il punto e la sua
 * versione levigata lungo la normale. Positivo = incavato. Calcolato una volta per corpo.
 */
function cavity(d) {
  if (d.cav) return d.cav;
  const { nv, pos, tri, part } = d;
  const nb = Array.from({ length: nv }, () => new Set());
  const nrm = new Float32Array(nv * 3);
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t + 1], c = tri[t + 2];
    if (part[a] === 1 || part[b] === 1 || part[c] === 1) continue;
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nrm[k * 3] += nx; nrm[k * 3 + 1] += ny; nrm[k * 3 + 2] += nz; }
  }
  const adj = nb.map((s) => [...s]);
  // levigatura della posizione (più passate = solchi più ampi, scala dei muscoli)
  const smooth = (src, it) => {
    let cur = src.slice();
    for (let n = 0; n < it; n++) {
      const nxt = new Float32Array(cur.length);
      for (let i = 0; i < nv; i++) {
        const l = adj[i];
        if (!l.length) { nxt.set(cur.subarray(i * 3, i * 3 + 3), i * 3); continue; }
        let x = 0, y = 0, z = 0;
        for (const j of l) { x += cur[j * 3]; y += cur[j * 3 + 1]; z += cur[j * 3 + 2]; }
        nxt[i * 3] = (cur[i * 3] + x / l.length) / 2;
        nxt[i * 3 + 1] = (cur[i * 3 + 1] + y / l.length) / 2;
        nxt[i * 3 + 2] = (cur[i * 3 + 2] + z / l.length) / 2;
      }
      cur = nxt;
    }
    return cur;
  };
  const fine = smooth(pos, 3), coarse = smooth(pos, 14);
  const cav = new Float32Array(nv);
  const raw = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
    const L = Math.hypot(nx, ny, nz) || 1;
    const df = ((fine[i * 3] - pos[i * 3]) * nx + (fine[i * 3 + 1] - pos[i * 3 + 1]) * ny + (fine[i * 3 + 2] - pos[i * 3 + 2]) * nz) / L;
    const dc = ((coarse[i * 3] - pos[i * 3]) * nx + (coarse[i * 3 + 1] - pos[i * 3 + 1]) * ny + (coarse[i * 3 + 2] - pos[i * 3 + 2]) * nz) / L;
    raw[i] = df * 1.6 + dc * 0.6;
  }
  // normalizza sul 97° percentile dei valori positivi
  const sorted = Array.from(raw).filter((v) => v > 0).sort((x, y) => x - y);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 1;
  for (let i = 0; i < nv; i++) cav[i] = Math.max(-1, Math.min(1, raw[i] / p90));
  d.cav = cav;
  return cav;
}

/** Colori per vertice. style: 'anatomy' (illustrazione anatomica) o 'skin' (pelle realistica) */
export function vertexColors(THREE, d, primary, secondary, accentHex, style = 'anatomy', focus = null, cavAmount = 1) {
  const female = d.gender === 'female';
  const C = (h) => new THREE.Color(h);
  const anat = style !== 'skin';
  const skin = anat ? C('#e4e4e2') : C(female ? '#d9a48a' : '#c58d6c');
  const cloth = C(anat ? '#151517' : '#18181b'), hair = C(anat ? '#5a5a5a' : female ? '#3a2519' : '#211610');
  const brow = C(anat ? '#8a8a8a' : '#2a1b12'), eye = C(anat ? '#3a3a3a' : '#1e140e');
  // colore del tema; su pelle chiara lo scuriamo un po' per farlo risaltare (il bianco non si vedrebbe: rosso)
  let accentC = C(accentHex);
  if (anat && accentC.r + accentC.g + accentC.b > 2.6) accentC = C('#d2382c');
  const hi = anat ? accentC.clone().multiplyScalar(0.82) : accentC;
  const hi2 = accentC.clone().lerp(C(anat ? '#e4e4e2' : '#c58d6c'), 0.5);
  d.style = style;
  d.rwBy ||= {};
  d.rw = d.rwBy[style] ||= regionWeights(d);
  const cav = cavity(d);
  const P = focus?.p?.length ? focus.p : primary.flatMap((m) => MUSCLE_MAP[m] || []);
  const S2 = [...(focus?.s || []), ...secondary.flatMap((m) => MUSCLE_MAP[m] || [])];
  const out = new Float32Array(d.rw.length * 3);
  const c = new THREE.Color();
  d.rw.forEach((w, i) => {
    if (w.eye) c.copy(eye);
    else {
      c.copy(skin).lerp(brow, w.brow * 0.85).lerp(hair, w.hair);
      const hp = Math.max(0, ...P.map((k) => w.m[k] || 0));
      const hs = Math.max(0, ...S2.map((k) => w.m[k] || 0));
      if (hp > 0.02) c.lerp(hi, Math.min(1, hp * 1.3) * (anat ? 0.97 : 0.8));
      else if (hs > 0.02) c.lerp(hi2, Math.min(1, hs) * (anat ? 0.55 : 0.4));
      c.lerp(cloth, Math.max(w.shorts, w.top));
      // ombreggiatura dei solchi muscolari (forte nello stile anatomico)
      const k = cav[i] * cavAmount;
      const dark = k > 0 ? Math.pow(k, 0.85) * (anat ? 0.58 : 0.28) : 0;
      const light = k < 0 ? -k * (anat ? 0.16 : 0.04) : 0;
      c.multiplyScalar(1 - dark).lerp(C('#ffffff'), light * (1 - Math.max(w.shorts, w.top)));
    }
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  });
  return out;
}
void HL_MAP;

/** Maschera dei muscoli per vertice: [principale, secondario] (0..1), senza abbigliamento */
export function muscleMask(d, primary, secondary, style = 'anatomy', focus = null) {
  d.rwBy ||= {};
  const rw = (d.rwBy[style] ||= regionWeights(d));
  const P = focus?.p?.length ? focus.p : primary.flatMap((m) => MUSCLE_MAP[m] || []);
  const S2 = [...(focus?.s || []), ...secondary.flatMap((m) => MUSCLE_MAP[m] || [])];
  const out = new Float32Array(rw.length * 2);
  rw.forEach((w, i) => {
    const cloth = Math.max(w.shorts || 0, w.top || 0);
    const m = w.m || {};
    const hp = Math.max(0, ...P.map((k) => m[k] || 0));
    const hs = Math.max(0, ...S2.map((k) => m[k] || 0));
    const bare = 1 - sstep(0.12, 0.4, cloth); // niente colore sugli indumenti
    out[i * 2] = hp > 0.02 ? Math.min(1, hp * 1.3) * bare : 0;
    out[i * 2 + 1] = hp <= 0.02 && hs > 0.02 ? Math.min(1, hs) * bare : 0;
  });
  return out;
}
export { cavity as bodyCavity };

/** Triangoli del corpo (senza la calzamaglia di aiuto) */
function bodyIndex(d) {
  const out = [];
  for (let t = 0; t < d.tri.length; t += 3) {
    const a = d.tri[t];
    if (d.part[a] === 1 || d.part[d.tri[t + 1]] === 1 || d.part[d.tri[t + 2]] === 1) continue;
    out.push(a, d.tri[t + 1], d.tri[t + 2]);
  }
  return new Uint16Array(out);
}

/* ------------------------------------------------------------------ */
/* Istanza animabile                                                   */
/* ------------------------------------------------------------------ */

/**
 * Ossa di torsione dell'avambraccio (a metà e al polso): la prono-supinazione si distribuisce
 * lungo l'avambraccio invece di attorcigliare il polso. I pesi dell'osso "lowerarm" vengono
 * ripartiti in base alla distanza dal gomito.
 */
function twistRig(d) {
  if (d.twist) return d.twist;
  const extra = [];
  for (const s of ['r', 'l']) {
    const lo = d.byName['lowerarm_' + s];
    const head = d.bones[lo].head, tail = d.bones[d.byName['hand_' + s]].head;
    extra.push({ name: 'twA_' + s, parent: lo, head, tail }, { name: 'twB_' + s, parent: lo, head, tail });
  }
  const bones = [...d.bones, ...extra];
  const byName = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  const skinI = d.skinI.slice(), skinW = d.skinW.slice();
  const lowers = { [d.byName.lowerarm_r]: 'r', [d.byName.lowerarm_l]: 'l' };
  for (let i = 0; i < d.nv; i++) {
    let has = false;
    for (let k = 0; k < 4; k++) if (lowers[skinI[i * 4 + k]] && skinW[i * 4 + k]) has = true;
    if (!has) continue;
    const w = new Map();
    for (let k = 0; k < 4; k++) {
      const bi = skinI[i * 4 + k], wt = skinW[i * 4 + k] / 255;
      if (!wt) continue;
      const s = lowers[bi];
      if (!s) { w.set(bi, (w.get(bi) || 0) + wt); continue; }
      const e = d.bones[bi].head, h = d.bones[d.byName['hand_' + s]].head;
      const ax = [h[0] - e[0], h[1] - e[1], h[2] - e[2]];
      const len2 = ax[0] ** 2 + ax[1] ** 2 + ax[2] ** 2;
      const t = Math.min(1, Math.max(0, ((d.pos[i * 3] - e[0]) * ax[0] + (d.pos[i * 3 + 1] - e[1]) * ax[1] + (d.pos[i * 3 + 2] - e[2]) * ax[2]) / len2));
      const a = byName['twA_' + s], b = byName['twB_' + s];
      const parts = t < 0.5 ? [[bi, 1 - 2 * t], [a, 2 * t]] : [[a, 2 - 2 * t], [b, 2 * t - 1]];
      for (const [j, f] of parts) if (f > 0) w.set(j, (w.get(j) || 0) + wt * f);
    }
    const top = [...w.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((x, y) => x + y[1], 0) || 1;
    let left = 255;
    for (let k = 0; k < 4; k++) {
      const [bi, wt] = top[k] || [0, 0];
      const q = k === top.length - 1 ? left : Math.round((wt / sum) * 255);
      skinI[i * 4 + k] = bi;
      skinW[i * 4 + k] = k < top.length ? q : 0;
      left -= k < top.length ? q : 0;
    }
  }
  return (d.twist = { bones, byName, skinI, skinW });
}

export function createHumanoid(THREE, d, { muscle = 'Altro', secondary = [], accent = '#D4FF00', grip = false, style = 'anatomy', focus = null } = {}) {
  const rig = twistRig(d);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.pos.slice(), 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(rig.skinI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(rig.skinW, 4, true));
  geo.setAttribute('color', new THREE.BufferAttribute(vertexColors(THREE, d, [muscle], secondary, accent, style, focus), 3));
  geo.setIndex(new THREE.BufferAttribute(bodyIndex(d), 1));
  geo.computeVertexNormals();

  // scarpe: guscio gonfiato attorno ai piedi (nasconde le dita), suola scura
  d.rw ||= regionWeights(d);
  const nrm = geo.getAttribute('normal');
  const shoeTris = [];
  const isFoot = (i) => d.rw[i].foot > 0.35;
  const bi = geo.index.array;
  for (let t = 0; t < bi.length; t += 3) if (isFoot(bi[t]) && isFoot(bi[t + 1]) && isFoot(bi[t + 2])) shoeTris.push(bi[t], bi[t + 1], bi[t + 2]);
  const used = [...new Set(shoeTris)];
  const remap = new Map(used.map((v, k) => [v, k]));
  const sp = new Float32Array(used.length * 3), sc = new Float32Array(used.length * 3);
  const si = new Uint8Array(used.length * 4), sw = new Uint8Array(used.length * 4);
  const ankleY = d.regions.ankleY;
  used.forEach((v, k) => {
    const off = 0.013;
    for (let a = 0; a < 3; a++) sp[k * 3 + a] = d.pos[v * 3 + a] + nrm.array[v * 3 + a] * off;
    const y = d.pos[v * 3 + 1];
    const sole = y < 0.022 ? 1 : 0;
    const col = sole ? [0.07, 0.07, 0.08] : y > ankleY + 0.025 ? [0.1, 0.1, 0.11] : [1.0, 1.0, 1.0];
    sc.set(col, k * 3);
    for (let a = 0; a < 4; a++) { si[k * 4 + a] = d.skinI[v * 4 + a]; sw[k * 4 + a] = d.skinW[v * 4 + a]; }
  });
  const shoeGeo = new THREE.BufferGeometry();
  shoeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  shoeGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  shoeGeo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  shoeGeo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  shoeGeo.setIndex(shoeTris.map((v) => remap.get(v)));
  shoeGeo.computeVertexNormals();

  // capelli: calotta sopra il cuoio capelluto, spessore che sfuma all'attaccatura (niente scalino)
  const female = d.gender === 'female';
  const hw = (i) => d.rw[i].hair || 0;
  const hairTris = [];
  for (let t = 0; t < bi.length; t += 3) if (hw(bi[t]) > 0.04 && hw(bi[t + 1]) > 0.04 && hw(bi[t + 2]) > 0.04) hairTris.push(bi[t], bi[t + 1], bi[t + 2]);
  const hUsed = [...new Set(hairTris)];
  const hMap = new Map(hUsed.map((v, k) => [v, k]));
  const hp = new Float32Array(hUsed.length * 3), hc = new Float32Array(hUsed.length * 3);
  const hi = new Uint8Array(hUsed.length * 4), hwt = new Uint8Array(hUsed.length * 4);
  const thick = female ? 0.0085 : 0.0055;
  const hairColor = style === 'skin' ? (female ? '#3b2618' : '#1f150e') : '#4b4b4d';
  const skinC = new THREE.Color(style === 'skin' ? (female ? '#d9a48a' : '#c58d6c') : '#e4e4e2'), hairC = new THREE.Color(hairColor), cc = new THREE.Color();
  hUsed.forEach((v, k) => {
    const w = hw(v);
    const off = 0.0004 + thick * sstep(0.05, 0.7, w);
    for (let a = 0; a < 3; a++) hp[k * 3 + a] = d.pos[v * 3 + a] + nrm.array[v * 3 + a] * off;
    cc.copy(skinC).lerp(hairC, sstep(0.0, 0.55, w)); // attaccatura sfumata, niente bordo seghettato
    hc[k * 3] = cc.r; hc[k * 3 + 1] = cc.g; hc[k * 3 + 2] = cc.b;
    for (let a = 0; a < 4; a++) { hi[k * 4 + a] = d.skinI[v * 4 + a]; hwt[k * 4 + a] = d.skinW[v * 4 + a]; }
  });
  const hairGeo = new THREE.BufferGeometry();
  hairGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  hairGeo.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  hairGeo.setAttribute('skinIndex', new THREE.BufferAttribute(hi, 4));
  hairGeo.setAttribute('skinWeight', new THREE.BufferAttribute(hwt, 4, true));
  hairGeo.setIndex(hairTris.map((v) => hMap.get(v)));
  hairGeo.computeVertexNormals();

  const allBones = rig.bones;
  const bones = allBones.map((b) => {
    const bone = new THREE.Bone();
    bone.name = b.name;
    return bone;
  });
  allBones.forEach((b, i) => {
    const p = b.parent >= 0 ? allBones[b.parent].head : [0, 0, 0];
    bones[i].position.set(b.head[0] - p[0], b.head[1] - p[1], b.head[2] - p[2]);
    if (b.parent >= 0) bones[b.parent].add(bones[i]);
  });
  const rootBone = bones[allBones.findIndex((b) => b.parent < 0)];
  const mat = style === 'skin'
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffd9c4'), clearcoat: 0.05 })
    : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.55 });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(rootBone);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  const shoeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const shoes = new THREE.SkinnedMesh(shoeGeo, shoeMat);
  shoes.bind(skeleton, mesh.matrixWorld);
  shoes.castShadow = true;
  shoes.frustumCulled = false;
  shoes.visible = style === 'skin'; // stile anatomico: piedi nudi come nelle tavole
  mesh.add(shoes);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const hairMat = new THREE.MeshStandardMaterial({ name: 'hair', vertexColors: true, roughness: 0.68, metalness: 0 });
  const ponyMat = new THREE.MeshStandardMaterial({ name: 'hair', color: hairColor, roughness: 0.62, metalness: 0 });
  const hair = new THREE.SkinnedMesh(hairGeo, hairMat);
  hair.bind(skeleton, mesh.matrixWorld);
  hair.castShadow = true;
  hair.frustumCulled = false;
  mesh.add(hair);

  // donna: coda di cavallo affusolata con elastico, attaccata all'osso della testa
  let pony = null;
  if (female) {
    const headB = bones[rig.byName.head];
    const V3 = THREE.Vector3;
    // punto più arretrato della nuca, poco sopra il centro della testa (coordinate dell'osso della testa)
    const HC = d.regions.headEll, Hh = d.bones[d.byName.head].head;
    let back = null;
    d.regions.reg.forEach((v) => {
      if (v.part !== 0 || v.head < 0.6 || Math.abs(v.z) > 0.015) return;
      const up = (v.y - HC.y) / HC.ey;
      if (up > 0.25 && up < 0.5 && (!back || v.x < back.x)) back = v;
    });
    const bx = back.x - Hh[0], by = back.y - Hh[1];
    const curve = new THREE.CatmullRomCurve3([new V3(bx + 0.016, by + 0.004, 0), new V3(bx - 0.012, by - 0.012, 0), new V3(bx - 0.03, by - 0.06, 0),
      new V3(bx - 0.034, by - 0.13, 0), new V3(bx - 0.026, by - 0.19, 0)]);
    const N = 40, M = 18;
    const fr = curve.computeFrenetFrames(N, false);
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const r = 0.005 + 0.024 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.1)) * (1 - t * 0.45); // stretta all'elastico, piena, poi punta
      const c = curve.getPointAt(t);
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * Math.PI * 2;
        const ny = fr.normals[i].clone().multiplyScalar(Math.cos(a) * r * 1.05);
        const nz = fr.binormals[i].clone().multiplyScalar(Math.sin(a) * r * 0.85);
        pos.push(c.x + ny.x + nz.x, c.y + ny.y + nz.y, c.z + ny.z + nz.z);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    pony = new THREE.Mesh(g, ponyMat);
    pony.castShadow = true;
    headB.add(pony);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0042, 10, 24), new THREE.MeshStandardMaterial({ name: 'tie', color: style === 'skin' ? '#151515' : '#2a2a2a', roughness: 0.5 }));
    const p0 = curve.getPointAt(0.1), t0 = curve.getTangentAt(0.1);
    tie.position.copy(p0);
    tie.quaternion.setFromUnitVectors(new V3(0, 0, 1), t0);
    tie.castShadow = true;
    headB.add(tie);
    pony.userData.tie = tie;
  }

  // direzioni a riposo (dall'osso al figlio) nel sistema del mondo a riposo
  const V = THREE.Vector3;
  const restDir = (n, child) => {
    const a = d.bones[d.byName[n]].head, b = child ? d.bones[d.byName[child]].head : d.bones[d.byName[n]].tail;
    return new V(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  };
  const R = {
    upperarm_r: restDir('upperarm_r', 'lowerarm_r'), lowerarm_r: restDir('lowerarm_r', 'hand_r'), hand_r: restDir('hand_r', 'middle_01_r'),
    upperarm_l: restDir('upperarm_l', 'lowerarm_l'), lowerarm_l: restDir('lowerarm_l', 'hand_l'), hand_l: restDir('hand_l', 'middle_01_l'),
    thigh_r: restDir('thigh_r', 'calf_r'), calf_r: restDir('calf_r', 'foot_r'), foot_r: restDir('foot_r', 'ball_r'),
    thigh_l: restDir('thigh_l', 'calf_l'), calf_l: restDir('calf_l', 'foot_l'), foot_l: restDir('foot_l', 'ball_l'),
    neck_01: restDir('neck_01', 'head'), head: restDir('head'),
  };
  const restUp = restDir('pelvis', 'neck_01');
  const hb = (n) => d.bones[d.byName[n]].head;
  const restLat = new V(...hb('thigh_r')).sub(new V(...hb('thigh_l'))).normalize();
  // altezze dal suolo (pianta del piede) di caviglia e avampiede a riposo
  let soleY = Infinity;
  for (let i = 0; i < d.nv; i++) if (d.part[i] === 0 && d.pos[i * 3 + 1] < soleY) soleY = d.pos[i * 3 + 1];
  const restFootY = hb('foot_r')[1] - soleY + 0.012; // + suola della scarpa
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const legLen = [dist3(hb('thigh_r'), hb('calf_r')), dist3(hb('calf_r'), hb('foot_r'))];
  const restBallY = hb('ball_r')[1] - soleY + 0.012;
  const B = (n) => bones[rig.byName[n]];
  const qTmp = new THREE.Quaternion(), qP = new THREE.Quaternion(), vTmp = new V();

  const basis = (up, lat) => {
    const u = up.clone().normalize();
    const l = lat.clone().addScaledVector(u, -lat.dot(u)).normalize();
    const f = new V().crossVectors(u, l).normalize();
    return new THREE.Matrix4().makeBasis(f, u, l);
  };
  const restBasis = basis(restUp, restLat);
  const restBasisInv = restBasis.clone().invert();

  function aim(name, dir) {
    const bone = B(name);
    bone.parent.getWorldQuaternion(qP);
    const cur = R[name].clone().applyQuaternion(qP);
    const target = dir.clone().normalize();
    qTmp.setFromUnitVectors(cur, target).multiply(qP); // rotazione mondo desiderata
    bone.quaternion.copy(qP.invert().multiply(qTmp));
    bone.updateMatrixWorld(true);
  }

  /* ---------------- braccia e mani ---------------- */
  // Sistemi di riferimento a riposo: cardine del gomito, asse del pollice, normale del palmo.
  const qFrame = (x, y) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, new V().crossVectors(x, y)));
  const setWorldQ = (bone, qw) => {
    bone.parent.getWorldQuaternion(qP);
    bone.quaternion.copy(qP.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  };
  const FINGERS = ['index', 'middle', 'ring', 'pinky'];
  const armRest = {};
  for (const s of ['r', 'l']) {
    const sh = new V(...hb('upperarm_' + s)), el = new V(...hb('lowerarm_' + s)), wr = new V(...hb('hand_' + s));
    const mcp = new V(...hb('middle_01_' + s));
    const u0 = el.clone().sub(sh).normalize(), l0 = wr.clone().sub(el).normalize();
    const H0 = new V().crossVectors(u0, l0).normalize();
    const F0 = mcp.clone().sub(wr).normalize();
    const A0 = new V(...hb('index_01_' + s)).sub(new V(...hb('pinky_01_' + s)));
    A0.addScaledVector(F0, -A0.dot(F0)).normalize();
    // palmo: per la mano destra pollice × dita, per la sinistra al contrario (chiralità)
    const N0 = s === 'r' ? new V().crossVectors(A0, F0) : new V().crossVectors(F0, A0);
    // spessore del palmo vicino alle nocche, misurato sulla pelle
    let palm = 0.012;
    const hi = d.byName['hand_' + s];
    for (let i = 0; i < d.nv; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (d.skinI[i * 4 + k] === hi) w += d.skinW[i * 4 + k];
      if (w < 200) continue;
      const p = new V(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]);
      const along = p.clone().sub(wr).dot(F0) / mcp.distanceTo(wr);
      if (along < 0.55 || along > 1) continue;
      palm = Math.max(palm, p.sub(wr).dot(N0));
    }
    // punto di presa: l'impugnatura passa qui (palmo, alla base delle dita)
    const grip = wr.clone().lerp(mcp, 0.84).addScaledVector(N0, palm + 0.008);
    // assi di flessione delle dita (verso il palmo)
    const flex = {};
    for (const f of FINGERS) {
      for (let k = 1; k <= 3; k++) {
        const n = `${f}_0${k}_${s}`;
        const b = d.bones[d.byName[n]];
        const dir = new V(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]).normalize();
        flex[n] = new V().crossVectors(dir, N0).normalize();
      }
    }
    // pollice: opposizione verso il palmo, poi flessione verso il mignolo
    const tDir = (n) => { const b = d.bones[d.byName[n]]; return new V(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]).normalize(); };
    const thumbTo = N0.clone().multiplyScalar(0.6).addScaledVector(A0, -1).normalize();
    flex['thumb_01_' + s] = new V().crossVectors(tDir('thumb_01_' + s), N0).normalize();
    flex['thumb_02_' + s] = new V().crossVectors(tDir('thumb_02_' + s), thumbTo).normalize();
    flex['thumb_03_' + s] = new V().crossVectors(tDir('thumb_03_' + s), thumbTo).normalize();
    armRest[s] = {
      u0, l0, H0, F0, A0, N0, head: wr, grip, flex, tRest: [1, 2, 3].map((k) => tDir(`thumb_0${k}_${s}`)),
      len: [sh.distanceTo(el), el.distanceTo(wr)],
      qU0inv: qFrame(u0, H0).invert(), qL0inv: qFrame(l0, H0).invert(), qH0inv: qFrame(F0, N0).invert(),
    };
  }

  const TD = {
    wrap: [[0.5, 0.7, 0.35], [0.3, 0.9, -0.2], [0.0, 0.85, -0.55]],
    fist: [[0.55, 0.6, 0.1], [0.3, 0.55, -0.75], [0.0, 0.35, -0.95]],
  };
  // Pose delle dita: [nocca, seconda, terza falange] e pollice [opposizione, nocca, punta] (radianti)
  const HANDS = {
    wrap: { f: [1.0, 1.45, 0.95], t: [0, 0, 0], td: TD.wrap },
    flat: { f: [0.04, 0.08, 0.05], t: [0.0, 0.08, 0.05] },
    relax: { f: [0.32, 0.5, 0.32], t: [0.25, 0.18, 0.2] },
    fist: { f: [1.45, 1.6, 1.1], t: [0, 0, 0], td: TD.fist },
    open: { f: [0.18, 0.22, 0.15], t: [0.1, 0.1, 0.1] },
    wrapBase: { f: [0.6, 0.6, 0.4], t: [0.5, 0.2, 0.2] },
  };
  function setFingers(s, shape) {
    const h = HANDS[shape] || HANDS.relax;
    const fl = armRest[s].flex;
    for (const f of FINGERS) {
      // le dita più esterne si chiudono un po' di più (presa naturale)
      const extra = f === 'pinky' ? 1.08 : f === 'ring' ? 1.04 : 1;
      for (let k = 1; k <= 3; k++) B(`${f}_0${k}_${s}`).quaternion.setFromAxisAngle(fl[`${f}_0${k}_${s}`], h.f[k - 1] * extra);
    }
    if (h.td) { // pollice orientato esplicitamente nel sistema della mano (dita F, palmo N, pollice A)
      const r = armRest[s];
      const qh = B('hand_' + s).getWorldQuaternion(new THREE.Quaternion());
      h.td.forEach(([cf, cn, ca], k) => {
        const n = `thumb_0${k + 1}_${s}`;
        const want = r.F0.clone().multiplyScalar(cf).addScaledVector(r.N0, cn).addScaledVector(r.A0, ca).normalize().applyQuaternion(qh);
        const bone = B(n);
        bone.parent.updateMatrixWorld(true);
        bone.parent.getWorldQuaternion(qP);
        const cur = r.tRest[k].clone().applyQuaternion(qP);
        qTmp.setFromUnitVectors(cur, want).multiply(qP);
        bone.quaternion.copy(qP.invert().multiply(qTmp));
        bone.updateMatrixWorld(true);
      });
      return;
    }
    for (let k = 1; k <= 3; k++) B(`thumb_0${k}_${s}`).quaternion.setFromAxisAngle(fl[`thumb_0${k}_${s}`], h.t[k - 1]);
  }

  /**
   * Orienta braccio, avambraccio e mano.
   * u: spalla→gomito, l: gomito→polso, fb: direzione desiderata delle dita,
   * g: { G: asse del pollice } oppure { N: direzione del palmo }, roll: rotazione extra (supinazione +)
   */
  // memoria tra fotogrammi: a braccio teso cardine e torsione proseguono senza scatti
  const lastH = {}, lastTau = {};
  function solveArm(s, u, l, fb, g) {
    const r = armRest[s];
    u = u.clone().normalize();
    l = l.clone().normalize();
    // cardine del gomito: dal piano braccio-avambraccio; a braccio teso resta quello di riposo trasportato
    // Cardine del gomito: normale al piano di piegamento della posa (verso della flessione);
    // il piano reale braccio-avambraccio lo affina quando il gomito è piegato.
    const right = s === 'r';
    const c = new V().crossVectors(u, l);
    const w = sstep(0.05, 0.25, c.length());
    let Hfb = g.hinge ? g.hinge.clone().addScaledVector(u, -g.hinge.dot(u)) : null;
    if (!Hfb || Hfb.lengthSq() < 0.04) Hfb = c.lengthSq() > 1e-4 ? c.clone() : r.H0.clone().applyQuaternion(qTmp.setFromUnitVectors(r.u0, u));
    Hfb.normalize();
    const H = Hfb.clone().multiplyScalar(1 - w);
    if (w > 0) {
      c.normalize();
      if (c.dot(Hfb) < 0) c.negate(); // iperestensione: stesso cardine, niente giro di 180°
      H.addScaledVector(c, w);
    }
    H.addScaledVector(u, -H.dot(u)).normalize();
    lastH[s] = H.clone();
    setWorldQ(B('upperarm_' + s), qFrame(u, H).multiply(r.qU0inv));
    const lp = l.clone().addScaledVector(H, -l.dot(H)).normalize();
    const qL = qFrame(lp, H).multiply(r.qL0inv);
    setWorldQ(B('lowerarm_' + s), qL);

    // mano
    let f = fb.clone().normalize(), n, a;
    const rollQ = g.roll ? new THREE.Quaternion().setFromAxisAngle(lp, ((right ? 1 : -1) * g.roll * Math.PI) / 180) : null;
    if (g.N) {
      n = g.N.clone().normalize();
      if (rollQ) n.applyQuaternion(rollQ);
      f.addScaledVector(n, -f.dot(n));
      if (f.lengthSq() < 1e-4) f.copy(lp).addScaledVector(n, -lp.dot(n));
      f.normalize();
      a = right ? new V().crossVectors(f, n) : new V().crossVectors(n, f);
    } else {
      a = g.G.clone().normalize();
      if (rollQ) a.applyQuaternion(rollQ);
      f.addScaledVector(a, -f.dot(a));
      if (f.lengthSq() < 1e-4) f.copy(lp).addScaledVector(a, -lp.dot(a));
      if (f.lengthSq() < 1e-4) f.crossVectors(a, H);
      f.normalize();
      // polso: non oltre ~80° rispetto all'avambraccio
      const lpa = lp.clone().addScaledVector(a, -lp.dot(a));
      if (lpa.lengthSq() > 1e-4) {
        lpa.normalize();
        const max = g.wristMax ?? 1.4;
        if (Math.acos(Math.max(-1, Math.min(1, f.dot(lpa)))) > max) {
          const side = f.clone().addScaledVector(lpa, -f.dot(lpa)).normalize();
          f.copy(lpa).multiplyScalar(Math.cos(max)).addScaledVector(side, Math.sin(max)).normalize();
        }
      }
      n = right ? new V().crossVectors(a, f) : new V().crossVectors(f, a);
    }
    // torsione dell'avambraccio: quanto serve per portare il pollice dove deve stare
    const au = r.A0.clone().applyQuaternion(qL);
    const p1 = au.addScaledVector(lp, -au.dot(lp)), p2 = a.clone().addScaledVector(lp, -a.dot(lp));
    let tau = Math.atan2(lp.dot(new V().crossVectors(p1, p2)), p1.dot(p2));
    if (lastTau[s] !== undefined) tau = lastTau[s] + Math.atan2(Math.sin(tau - lastTau[s]), Math.cos(tau - lastTau[s]));
    tau = Math.max(-2.4, Math.min(2.4, tau));
    lastTau[s] = tau;
    B('twA_' + s).quaternion.setFromAxisAngle(r.l0, tau * 0.5);
    B('twB_' + s).quaternion.setFromAxisAngle(r.l0, tau * 0.88);
    B('twA_' + s).updateMatrixWorld(true);
    B('twB_' + s).updateMatrixWorld(true);
    setWorldQ(B('hand_' + s), qFrame(f, n).multiply(r.qH0inv));
    setFingers(s, g.shape === 'wrap' ? 'wrapBase' : g.shape);
    B('hand_' + s).updateMatrixWorld(true);
    if (g.shape === 'wrap') wrapHand(s, gripW(s), f, n, a, g.rho);
    return { f, n, a };
  }
  // lunghezze delle falangi (testa → osso successivo, o coda per l'ultima)
  const segLen = {};
  for (const f of [...FINGERS, 'thumb']) for (const s of ['r', 'l']) for (let k = 1; k <= 3; k++) {
    const b = d.bones[d.byName[`${f}_0${k}_${s}`]];
    segLen[`${f}_0${k}_${s}`] = Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
  }
  const aimAt = (n, target) => {
    const bone = B(n);
    const head = bone.getWorldPosition(new V());
    const b = d.bones[d.byName[n]];
    const rest = new V(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]).normalize();
    bone.parent.getWorldQuaternion(qP);
    const cur = rest.applyQuaternion(qP);
    qTmp.setFromUnitVectors(cur, target.clone().sub(head).normalize()).multiply(qP);
    bone.quaternion.copy(qP.invert().multiply(qTmp));
    bone.updateMatrixWorld(true);
  };
  /**
   * Dita chiuse attorno a un'impugnatura cilindrica (centro C, asse A): ogni falange è una corda
   * di una circonferenza attorno al manico, così le dita lo avvolgono senza attraversarlo.
   * Le dita girano in un verso, il pollice nell'altro.
   */
  function wrapHand(s, C, F, N, A, rho = 0.026) {
    const to2 = (P) => { const v = P.clone().sub(C); return [v.dot(F), v.dot(N), v.dot(A)]; };
    const from2 = (x, y, z) => C.clone().addScaledVector(F, x).addScaledVector(N, y).addScaledVector(A, z);
    const step = ([x, y], L, R, dir) => {
      const dq = Math.hypot(x, y);
      if (dq > R + L - 1e-4 || dq < Math.abs(R - L) + 1e-4) { // nessuna intersezione: verso la circonferenza
        const k = dq > R ? Math.max(0, dq - L) / dq : Math.min(R, dq + L) / Math.max(dq, 1e-6);
        return [x * k, y * k];
      }
      // intersezione delle circonferenze (C, R) e (Q, L)
      const a = (R * R - L * L + dq * dq) / (2 * dq);
      const h = Math.sqrt(Math.max(0, R * R - a * a));
      const ux = x / dq, uy = y / dq;
      const px = ux * a, py = uy * a;
      const c1 = [px - uy * h, py + ux * h], c2 = [px + uy * h, py - ux * h];
      const ang = (p) => Math.atan2(p[1], p[0]);
      const base = Math.atan2(y, x);
      const d1 = Math.atan2(Math.sin(ang(c1) - base), Math.cos(ang(c1) - base));
      return dir > 0 ? (d1 > 0 ? c1 : c2) : (d1 < 0 ? c1 : c2);
    };
    for (const f of FINGERS) {
      let [x, y, z] = to2(B(`${f}_01_${s}`).getWorldPosition(new V()));
      for (let k = 1; k <= 3; k++) {
        const n = `${f}_0${k}_${s}`;
        [x, y] = step([x, y], segLen[n], rho, 1);
        aimAt(n, from2(x, y, z));
      }
    }
    // pollice: dal lato del polso attorno al manico, sopra le dita
    let [x, y, z] = to2(B(`thumb_02_${s}`).getWorldPosition(new V()));
    for (let k = 2; k <= 3; k++) {
      const n = `thumb_0${k}_${s}`;
      [x, y] = step([x, y], segLen[n], rho + 0.006, -1);
      aimAt(n, from2(x, y, z));
    }
  }
  // punto di presa nel mondo (dove passa il manico)
  const gripW = (s) => {
    const r = armRest[s];
    return B('hand_' + s).localToWorld(r.grip.clone().sub(r.head));
  };

  /** Presa richiesta per un braccio, nel sistema del corpo (fwd, t, lat) */
  function gripFor(spec, k, i, l) {
    const gr = spec.grip || { type: 'relax' };
    const sg = i === 0 ? 1 : -1;
    const shape = gr.shape || 'relax';
    const roll = Array.isArray(k.roll) ? k.roll[i] : k.roll || 0;
    const type = Array.isArray(gr.type) ? gr.type[i] : gr.type;
    const lat = k.lat.clone(), fwd = k.fwd.clone(), t = k.t.clone();
    const base = { shape, roll, wristMax: gr.wristMax, hinge: (k.arms[i].hn || lat).clone() };
    switch (type) {
      case 'pron': return { ...base, G: lat.multiplyScalar(-sg) };
      case 'sup': return { ...base, G: lat.multiplyScalar(sg) };
      case 'fwd': {
        const h = new V(fwd.x, 0, fwd.z);
        return { ...base, G: h.lengthSq() > 0.1 ? h.normalize() : fwd };
      }
      case 'up': { // pollici verso la testa; se l'avambraccio è allineato al busto, in avanti
        const v = t.clone().addScaledVector(fwd, 0.8);
        v.addScaledVector(l, -v.dot(l));
        return { ...base, G: v.lengthSq() > 1e-3 ? v.normalize() : fwd };
      }
      case 'flat': return { ...base, N: new V(0, -1, 0) };
      case 'flatfwd': return { ...base, N: fwd.multiplyScalar(-1) };
      default: { // neutra: palmi uno verso l'altro (braccia aperte di lato: pollici avanti)
        const G = new V().crossVectors(lat, l).addScaledVector(fwd.clone().addScaledVector(l, -fwd.dot(l)), 0.35);
        return { ...base, G: G.lengthSq() > 1e-3 ? G.normalize() : t };
      }
    }
  }

  /** Impugnature fisse per le due mani (coordinate del mondo), se l'esercizio ne ha */
  function reachTargets(spec, k, W, toWorldDir) {
    const gr = spec.grip || {};
    const w = gr.w ?? 0.24;
    const lat = toWorldDir(k.lat);
    if (gr.span != null) { // due mani sulla stessa impugnatura (maniglia, barra del cavo, palla)
      const mid = gripW('r').add(gripW('l')).multiplyScalar(0.5);
      if (spec.view !== 'front') mid.z = 0;
      return [mid.clone().addScaledVector(lat, gr.span), mid.clone().addScaledVector(lat, -gr.span)];
    }
    for (const pr of spec.props || []) {
      if (pr.t === 'bar') {
        const c = new V((pr.x - 100) * 0.01, (160 - pr.y) * 0.01, 0);
        const ww = spec.key === 'dip' ? 0.24 : w;
        return [c.clone().setZ(ww), c.clone().setZ(-ww)];
      }
      if (pr.t === 'barbell' && (pr.at === 'back' || pr.at === 'hip')) {
        const t = toWorldDir(k.t), fwd = toWorldDir(k.fwd);
        const c = pr.at === 'back'
          ? W('neck_01').addScaledVector(t, -0.02).addScaledVector(fwd, -0.085)
          : W('pelvis').addScaledVector(fwd, 0.1).addScaledVector(t, 0.05);
        if (spec.view !== 'front') c.z = 0;
        const out = [c.clone().addScaledVector(lat, w), c.clone().addScaledVector(lat, -w)];
        out.bar = c;
        out.posePole = true;
        return out;
      }
    }
    return null;
  }

  /** k: scheletro 3D delle pose. Ritorna i punti reali del corpo per agganciare gli attrezzi. */
  function pose(k, spec) {
    bones.forEach((b, i) => {
      b.quaternion.identity();
      const p = allBones[i].parent >= 0 ? allBones[allBones[i].parent].head : [0, 0, 0];
      b.position.set(allBones[i].head[0] - p[0], allBones[i].head[1] - p[1], allBones[i].head[2] - p[2]);
    });
    // bacino: allinea "su" e "lato destro" del modello a busto e lato delle pose
    const target = basis(k.t, k.lat);
    const rotM = target.multiply(restBasisInv);
    const pelvis = B('pelvis');
    pelvis.quaternion.setFromRotationMatrix(rotM);
    mesh.updateMatrixWorld(true);
    if (k.tw) {
      const step = new THREE.Quaternion().setFromAxisAngle(k.t.clone().normalize(), (k.tw * Math.PI) / 180 / 3);
      for (const n of ['spine_01', 'spine_02', 'spine_03']) {
        const b = B(n);
        const pw = b.parent.getWorldQuaternion(new THREE.Quaternion());
        const cw = b.getWorldQuaternion(new THREE.Quaternion());
        const want = step.clone().multiply(cw);
        b.quaternion.copy(pw.invert().multiply(want));
        b.updateMatrixWorld(true);
      }
    }
    const D3 = (a, b) => b.clone().sub(a);
    const arms = [['r', k.arms[0]], ['l', k.arms[1]]];
    const grips = arms.map(([s, a], i) => {
      const l = D3(a.el, a.wr);
      const g = gripFor(spec, k, i, l.clone().normalize());
      solveArm(s, D3(a.sh, a.el), l, D3(a.wr, a.hd), g);
      return g;
    });
    const legs = [['r', k.legs[0]], ['l', k.legs[1]]];
    for (const [s, l] of legs) {
      aim('thigh_' + s, D3(l.hip, l.kn));
      aim('calf_' + s, D3(l.kn, l.an));
      aim('foot_' + s, D3(l.an, l.to));
    }
    const hd = D3(k.top, k.head);
    aim('neck_01', hd);
    aim('head', hd);
    mesh.updateMatrixWorld(true);

    // ancoraggio, come nel motore 2D
    const W = (n) => B(n).getWorldPosition(new V());
    const anchor = spec.anchor || 'hip';
    let shift = new V();
    const sideView = spec.view !== 'front';
    const match = (model, want) => shift.copy(want).sub(model);
    if (anchor === 'feet') {
      if (sideView) {
        match(W('foot_r'), k.legs[0].an);
        shift.y = restFootY - W('foot_r').y + (k.legs[0].an.y - 0.05);
      } else {
        const hip = W('pelvis');
        shift.set(k.hip.x - hip.x, 0, k.hip.z - hip.z);
        shift.y = restFootY - Math.min(W('foot_r').y, W('foot_l').y) + (Math.min(k.legs[0].an.y, k.legs[1].an.y) - 0.05);
      }
    } else if (anchor === 'toes') {
      match(W('ball_r'), k.legs[0].to);
      shift.y = restBallY - W('ball_r').y + (k.legs[0].to.y - 0.05);
    } else if (anchor === 'hands') {
      // nel 2D il polso è sulla sbarra; nel corpo reale la sbarra passa nel palmo, qualche cm oltre
      const hdir = k.arms[0].hd.clone().sub(k.arms[0].wr).normalize();
      match(W('hand_r'), k.arms[0].wr.clone().addScaledVector(hdir, -0.075));
    }
    else if (anchor === 'shoulder') match(W('upperarm_r'), k.arms[0].sh);
    else if (anchor === 'knee') match(W('calf_r'), k.legs[0].kn);
    else if (anchor === 'farknee') match(W('calf_l'), k.legs[1].kn);
    else if (anchor === 'elbow') match(W('lowerarm_r'), k.arms[0].el);
    else match(W('pelvis'), k.hip);
    if (sideView) shift.z = 0;
    B('Root').position.add(shift);
    mesh.updateMatrixWorld(true);

    // IK delle gambe: da sdraiati/seduti i piedi restano appoggiati dove previsto dalla posa
    if (sideView && (anchor === 'hip' || anchor === 'shoulder')) {
      for (const [s, l, i] of [['r', k.legs[0], 0], ['l', k.legs[1], 1]]) {
        if (l.an.y > 0.16) continue;
        const Hp = W('thigh_' + s);
        const l1 = legLen[0], l2 = legLen[1];
        const T = new V(l.an.x, restFootY, Hp.z);
        const dv = T.clone().sub(Hp);
        let dist = dv.length();
        if (dist > l1 + l2 - 0.002) { T.copy(Hp).addScaledVector(dv.normalize(), l1 + l2 - 0.002); dist = l1 + l2 - 0.002; }
        const dirHT = T.clone().sub(Hp).normalize();
        // direzione di piega: verso il ginocchio della posa
        const bend = l.kn.clone().sub(l.hip).addScaledVector(dirHT, -l.kn.clone().sub(l.hip).dot(dirHT));
        if (bend.lengthSq() < 1e-6) bend.set(0, 1, 0);
        bend.normalize();
        const a = (l1 * l1 + dist * dist - l2 * l2) / (2 * dist);
        const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        const knee = Hp.clone().addScaledVector(dirHT, a).addScaledVector(bend, h);
        aim('thigh_' + s, knee.clone().sub(Hp));
        aim('calf_' + s, T.clone().sub(W('calf_' + s)));
        aim('foot_' + s, l.to.clone().sub(l.an));
        void i;
      }
      mesh.updateMatrixWorld(true);
    }

    // contatto con il pavimento (piegamenti, plank…): ruota il corpo attorno all'ancora
    if (spec.fix && sideView) {
      const jn = spec.fix === 'wr' ? 'hand_r' : spec.fix === 'el' ? 'lowerarm_r' : spec.fix === 'kn' ? 'calf_r' : 'ball_r';
      const want = spec.fix === 'el' ? 0.06 : spec.fix === 'wr' ? 0.045 : 0.05;
      const piv = spec.anchor === 'toes' ? W('ball_r') : spec.anchor === 'farknee' ? W('calf_l') : spec.anchor === 'knee' ? W('calf_r') : W('pelvis');
      const tgt = spec.fixY !== undefined ? (160 - spec.fixY) * 0.01 + (want - 0.05) : want;
      const p = W(jn).sub(piv);
      const Rr = Math.hypot(p.x, p.y);
      const want2 = tgt - piv.y;
      if (Rr > 0.05 && Math.abs(want2 / Rr) < 1) {
        const phi = Math.atan2(p.y, p.x);
        let dl = Math.asin(want2 / Rr) - phi;
        const dl2 = Math.PI - Math.asin(want2 / Rr) - phi;
        const norm = (x) => Math.atan2(Math.sin(x), Math.cos(x));
        dl = Math.abs(norm(dl)) < Math.abs(norm(dl2)) ? norm(dl) : norm(dl2);
        if (Math.abs(dl) < 0.6) {
          const root = B('Root');
          const q = new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), dl);
          // ruota attorno al perno: p' = piv + q (p - piv)
          const rootW = root.getWorldPosition(new V());
          const rel = rootW.sub(piv).applyQuaternion(q).add(piv);
          root.quaternion.premultiply(q);
          root.position.copy(rel);
          mesh.updateMatrixWorld(true);
        }
      }
    }

    // appoggio su panca/sedile: schiena o glutei a contatto con la superficie
    const supports = (spec.props || []).filter((p) => (p.t === 'bench' && !p.ang) || p.t === 'seat').map((p) => ({
      y: (160 - p.y) * 0.01 + (p.t === 'seat' ? 0.005 : 0.0), x1: ((p.t === 'seat' ? p.x - p.w / 2 : p.x) - 100) * 0.01 - 0.2, x2: ((p.t === 'seat' ? p.x + p.w / 2 : p.x + p.w) - 100) * 0.01,
    }));
    if (supports.length && sideView && spec.anchor === 'hip') {
      const back = new V().copy(k.fwd).multiplyScalar(-1);
      const pts = [['pelvis', 0.1], ['spine_02', 0.1], ['spine_03', 0.11]].map(([n, th]) => W(n).addScaledVector(back, th));
      pts.push(W('pelvis').add(new V(0, -0.1, 0)));
      let best = null;
      for (const sp of supports) {
        const on = pts.filter((p) => p.x >= sp.x1 && p.x <= sp.x2);
        if (!on.length) continue;
        const dy = sp.y - Math.min(...on.map((p) => p.y));
        if (Math.abs(dy) < 0.25 && (best === null || Math.abs(dy) < Math.abs(best))) best = dy;
      }
      if (best !== null) {
        B('Root').position.y += best;
        mesh.updateMatrixWorld(true);
      }
    }

    // non attraversare il pavimento
    const holding = ['wrap', 'fist', 'open'].includes(spec.grip?.shape);
    const low = Math.min(...['foot_r', 'foot_l', 'ball_r', 'ball_l', 'hand_r', 'hand_l', 'calf_r', 'calf_l', 'pelvis', 'head'].map((n) => W(n).y),
      ...(holding ? [gripW('r').y - 0.02, gripW('l').y - 0.02] : []));
    if (low < 0.035) {
      B('Root').position.y += 0.035 - low;
      mesh.updateMatrixWorld(true);
    }

    // mani sull'attrezzo fisso (sbarra, parallele, bilanciere sulla schiena o sulle anche):
    // IK del braccio finché il punto di presa coincide con l'impugnatura
    const qRoot = B('Root').quaternion.clone();
    const toWorldDir = (v) => v.clone().applyQuaternion(qRoot);
    const reach = reachTargets(spec, k, W, toWorldDir);
    arms.forEach(([s, a], i) => {
      const T = reach?.[i];
      const g = grips[i];
      const worldG = { ...g, G: g.G && (g.N ? null : toWorldDir(g.G)), N: g.N, hinge: toWorldDir(g.hinge) };
      const fb = toWorldDir(D3(a.wr, a.hd));
      if (!T) {
        if (g.N && qRoot.w < 0.99999) solveArm(s, W('lowerarm_' + s).sub(W('upperarm_' + s)), W('hand_' + s).sub(W('lowerarm_' + s)), fb, worldG);
        return;
      }
      const r = armRest[s];
      let wPrev = null;
      const el0 = W('lowerarm_' + s);
      for (let it = 0; it < 6; it++) {
        const S = W('upperarm_' + s);
        const off = gripW(s).sub(W('hand_' + s));
        let wt = T.clone().sub(off);
        if (wPrev) wt = wPrev.lerp(wt, 0.5); // smorzamento: convergenza anche con il braccio molto piegato
        wPrev = wt.clone();
        const dv = wt.clone().sub(S);
        const [L1, L2] = r.len;
        const dist = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.004, dv.length()));
        dv.normalize();
        const along = (L1 * L1 + dist * dist - L2 * L2) / (2 * dist);
        const h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
        // il gomito sta dal lato opposto alla flessione: direzione = (spalla→polso) × cardine
        // il gomito sta dal lato opposto alla flessione: (spalla→polso) × cardine;
        // se il cardine è quasi allineato alla direzione, vale il gomito della posa originale
        const bend = worldG.hinge ? new V().crossVectors(dv, worldG.hinge) : new V();
        bend.addScaledVector(dv, -bend.dot(dv));
        if (bend.lengthSq() > 1e-6) bend.normalize();
        const pose0 = el0.clone().sub(S);
        pose0.addScaledVector(dv, -pose0.dot(dv));
        const m = pose0.length();
        if (reach.posePole && m > 1e-4) { // bilanciere sulla schiena: gomiti come nella posa (in basso, dietro)
          const wp = sstep(0.025, 0.07, m);
          bend.multiplyScalar(1 - wp).addScaledVector(pose0.divideScalar(m), wp);
        }
        if (bend.lengthSq() < 1e-6) bend.copy(toWorldDir(k.fwd)).multiplyScalar(-1);
        if (bend.lengthSq() < 1e-6) bend.copy(toWorldDir(k.fwd)).multiplyScalar(-1);
        bend.normalize();
        const el = S.clone().addScaledVector(dv, along).addScaledVector(bend, h);
        const wr = S.clone().addScaledVector(dv, dist);
        // impugnatura fissa: polso neutro, la mano prosegue l'avambraccio
        solveArm(s, el.clone().sub(S), wr.clone().sub(el), wr.clone().sub(el), worldG);
      }
    });
    mesh.updateMatrixWorld(true);

    // punti reali per gli attrezzi
    const P = (n) => W(n);
    const out = {
      ...k,
      hip: P('pelvis'),
      top: P('neck_01'),
      arms: ['r', 'l'].map((s) => {
        const hand = B('hand_' + s);
        const q = hand.getWorldQuaternion(new THREE.Quaternion());
        const r = armRest[s];
        const gp = holding ? gripW(s) : P('hand_' + s).lerp(P('middle_01_' + s), 0.5);
        return {
          sh: P('upperarm_' + s), el: P('lowerarm_' + s), wr: gp, hd: gp.clone().addScaledVector(r.F0.clone().applyQuaternion(q), 0.05),
          ax: r.A0.clone().applyQuaternion(q), pn: r.N0.clone().applyQuaternion(q),
        };
      }),
      bar: reach?.bar || null,
      legs: [
        { hip: P('thigh_r'), kn: P('calf_r'), an: P('foot_r'), to: P('ball_r') },
        { hip: P('thigh_l'), kn: P('calf_l'), an: P('foot_l'), to: P('ball_l') },
      ],
    };
    return out;
  }

  return {
    mesh,
    pose,
    dispose() {
      geo.dispose();
      mat.dispose();
      shoeGeo.dispose();
      shoeMat.dispose();
      hairGeo.dispose(); hairMat.dispose(); ponyMat.dispose();
      if (pony) { pony.geometry.dispose(); pony.userData.tie.geometry.dispose(); pony.userData.tie.material.dispose(); }
    },
  };
}
