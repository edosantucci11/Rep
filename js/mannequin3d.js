// Manichino umanoide 3D (Three.js). Riusa le pose e la cinematica del motore 2D:
// il piano della vista laterale diventa il piano sagittale (x avanti, y su),
// gli arti destro/sinistro vengono separati sull'asse z.
import { solve, poseAt } from './mannequin.js';
import { loadBody, createHumanoid, muscleMask, bodyCavity, vertexColors } from './humanoid.js';

let THREE = null;
const loadThree = async () => (THREE ||= await import('./vendor/three.module.min.js'));

const U = 0.01; // unità 2D → metri
const GROUND = 160;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------ */
/* Scheletro 3D a partire dalla soluzione 2D                           */
/* ------------------------------------------------------------------ */

function skeleton(spec, j, pose = {}) {
  const V = THREE.Vector3;
  const side = j.view === 'side';
  const p3 = (p, z = 0) => (side ? new V((p[0] - 100) * U, (GROUND - p[1]) * U, z) : new V(0, (GROUND - p[1]) * U, (p[0] - 100) * U));
  const hip = p3(j.hip);
  const top = p3(j.sh);
  const t = top.clone().sub(hip).normalize();
  const fwd = side ? new V(t.y, -t.x, 0).normalize() : new V(1, 0, 0);
  const lat = new V().crossVectors(fwd, t).normalize();
  const arms = j.arms.map((a, i) => {
    const s = i === 0 ? 1 : -1;
    if (!side) return { sh: p3(a.sh).addScaledVector(t, -0.03), el: p3(a.el), wr: p3(a.wr), hd: p3(a.hd) };
    const sh = top.clone().addScaledVector(t, -0.045).addScaledVector(lat, s * 0.17);
    return { sh, el: p3(a.el, s * 0.19), wr: p3(a.wr, s * 0.2), hd: p3(a.hd, s * 0.2) };
  });
  const legs = j.legs.map((l, i) => {
    const s = i === 0 ? 1 : -1;
    if (!side) return { hip: p3(l.hip), kn: p3(l.kn), an: p3(l.an), to: p3(l.to) };
    const z = s * 0.095;
    return { hip: hip.clone().addScaledVector(lat, s * 0.095), kn: p3(l.kn, z), an: p3(l.an, z), to: p3(l.to, z) };
  });
  const k = { side, hip, top, t, fwd, lat, head: p3(j.head), arms, legs, p3, tw: pose.tw || 0, roll: pose.roll || 0 };
  // rotazione di punti attorno a un asse passante per un centro
  const rot = (pts, center, axis, deg) => {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180);
    for (const p of pts) p.sub(center).applyQuaternion(q).add(center);
  };
  const awayFrom = (base, pts, axis, deg, outward) => {
    // sceglie il verso che allontana l'arto dal corpo
    const probe = pts[pts.length - 1].clone();
    rot([probe], base, axis, deg);
    const sign = probe.clone().sub(base).dot(outward) >= pts[pts.length - 1].clone().sub(base).dot(outward) ? 1 : -1;
    rot(pts, base, axis, deg * sign);
    return deg * sign;
  };
  // cardine del gomito: normale al piano in cui il motore 2D piega il braccio, verso della flessione
  // (laterale: asse laterale; frontale: avanti/indietro secondo come si piega l'avambraccio)
  const relSum = (i) => (spec.frames || []).reduce((acc, f) => acc + pairOf(f.fb ?? 0)[i] - pairOf(f.ab ?? 0)[i], 0);
  arms.forEach((a, i) => {
    a.hn = side ? lat.clone() : fwd.clone().multiplyScalar(-(i === 0 ? 1 : -1) * (relSum(i) >= 0 ? 1 : -1));
  });
  const rotDir = (v, axis, deg) => v.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180));
  // apertura delle braccia attorno all'asse del busto (croci da sdraiato, alzate posteriori)
  const abd = pose.abd ? pairOf(pose.abd) : null;
  if (abd && side) arms.forEach((a, i) => abd[i] && rotDir(a.hn, t, awayFrom(a.sh, [a.el, a.wr, a.hd], t, abd[i], lat.clone().multiplyScalar(i === 0 ? 1 : -1))));
  // apertura delle gambe da seduti (macchina abduttori/adduttori)
  const lab = pose.lab ? pairOf(pose.lab) : null;
  if (lab && side) legs.forEach((l, i) => lab[i] && awayFrom(l.hip, [l.kn, l.an, l.to], new V(0, 1, 0), lab[i], lat.clone().multiplyScalar(i === 0 ? 1 : -1)));
  // torsione del busto (Russian twist, woodchop): spalle e braccia ruotano attorno all'asse del busto
  if (k.tw) arms.forEach((a) => { rot([a.sh, a.el, a.wr, a.hd], hip, t, k.tw); rotDir(a.hn, t, k.tw); });
  return k;
}
const pairOf = (v) => (Array.isArray(v) ? v : [v, v]);
/** Fasci muscolari precisi in base al movimento (es. panca inclinata → petto alto) */
export function focusFor(spec) {
  const k = spec.key, m = spec.muscle;
  const o = Object.fromEntries((spec.opts || '').split(',').filter(Boolean).map((x) => [x, true]));
  if (m === 'Spalle') {
    if (['latraise', 'uprightrow'].includes(k)) return { p: ['deltSide'], s: ['deltFront'] };
    if (['reardelt', 'facepull'].includes(k)) return { p: ['deltRear'], s: ['midback'] };
    if (k === 'frontraise') return { p: ['deltFront'], s: [] };
    if (['ohpress', 'jerk'].includes(k)) return { p: ['deltFront', 'deltSide'], s: ['triceps'] };
  }
  if (m === 'Petto') {
    if (o.incline) return { p: ['chestUpper'], s: ['chest', 'deltFront'] };
    if (o.decline || k === 'dip') return { p: ['chestLower'], s: ['chest', 'triceps'] };
    if (['bench', 'pushup'].includes(k)) return { p: ['chest'], s: ['deltFront', 'triceps'] };
    if (['fly', 'flylying'].includes(k)) return { p: ['chest'], s: ['deltFront'] };
  }
  if (m === 'Dorso') {
    if (['pullup', 'pulldown', 'straightarm', 'pullover'].includes(k)) return { p: ['lats'], s: ['midback', 'biceps'] };
    if (['row', 'seatedrow'].includes(k)) return { p: ['midback', 'lats'], s: ['deltRear', 'biceps'] };
  }
  if (m === 'Trapezi') {
    if (k === 'shrug') return { p: ['trapUpper'], s: [] };
    return { p: ['trap'], s: ['deltRear'] };
  }
  return null;
}

/** Scheletro 3D a un certo istante dell'animazione */
function kAt(spec, ms) {
  const p = poseAt(spec, ms);
  return skeleton(spec, solve(spec, p), p);
}

/* ------------------------------------------------------------------ */
/* Costruzione della scena                                             */
/* ------------------------------------------------------------------ */

function makeScene(spec, accentHex, human = null, style = 'anatomy') {
  const scene = new THREE.Scene();
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  const base = track(new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.55, metalness: 0.05 }));
  const joint = track(new THREE.MeshStandardMaterial({ color: 0xc9c9c9, roughness: 0.5, metalness: 0.08 }));
  const accent = new THREE.Color(accentHex);
  const hiMat = track(new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.28, roughness: 0.4 }));
  const hi2Mat = track(new THREE.MeshStandardMaterial({ color: accent.clone().lerp(new THREE.Color(0xdedede), 0.55), emissive: accent, emissiveIntensity: 0.08, roughness: 0.5 }));
  const metal = track(new THREE.MeshStandardMaterial({ name: 'metal', color: 0x9a9a9a, roughness: 0.3, metalness: 0.8 }));
  const iron = track(new THREE.MeshStandardMaterial({ name: 'iron', color: 0x1c1c1c, roughness: 0.6, metalness: 0.4 }));
  const pad = track(new THREE.MeshStandardMaterial({ name: 'pad', color: 0x262626, roughness: 0.85, metalness: 0.1 }));
  const cableMat = track(new THREE.MeshStandardMaterial({ name: 'cable', color: 0x8d8d8d, roughness: 0.4, metalness: 0.6 }));

  const hl = new Set(spec.hl || []);
  const hl2 = new Set(spec.hl2 || []);
  const matFor = (part) => (hl.has(part) ? hiMat : hl2.has(part) ? hi2Mat : base);

  const sphereG = track(new THREE.SphereGeometry(1, 28, 20));
  const cylG = track(new THREE.CylinderGeometry(1, 1, 1, 20));
  const boxG = track(new THREE.BoxGeometry(1, 1, 1));
  const mesh = (g, m, shadow = true) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = shadow;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  };

  // segmento rastremato tra due punti
  const seg = (rA, rB, m) => {
    const g = track(new THREE.CylinderGeometry(rB, rA, 1, 20, 1, true));
    const o = mesh(g, m);
    return (a, b) => {
      const d = b.clone().sub(a);
      const len = d.length();
      o.position.copy(a).addScaledVector(d, 0.5);
      o.quaternion.setFromUnitVectors(Y, d.divideScalar(len || 1));
      o.scale.set(1, len, 1);
    };
  };
  const ball = (r, m) => {
    const o = mesh(sphereG, m);
    o.scale.setScalar(r);
    return (p) => o.position.copy(p);
  };
  // ellissoide orientato: asse y lungo dir, x avanti, z laterale
  const ellip = (rx, ry, rz, m) => {
    const o = mesh(sphereG, m);
    o.scale.set(rx, ry, rz);
    return (p, dir) => {
      o.position.copy(p);
      o.quaternion.setFromUnitVectors(Y, dir);
    };
  };

  // --- corpo: umano realistico se disponibile, altrimenti manichino
  if (human) scene.add(human.mesh);
  const body = human ? null : {
    pelvis: ellip(0.115, 0.1, 0.17, base),
    glutes: [ellip(0.075, 0.08, 0.075, matFor('glute')), ellip(0.075, 0.08, 0.075, matFor('glute'))],
    abdomen: ellip(0.105, 0.15, 0.15, matFor('belly')),
    chest: ellip(0.125, 0.16, 0.2, matFor('chest')),
    traps: ellip(0.07, 0.06, 0.15, hl.has('trap') ? hiMat : base),
    neck: seg(0.046, 0.04, hl.has('neck') ? hiMat : base),
    head: ellip(0.095, 0.115, 0.09, base),
    jaw: ellip(0.06, 0.05, 0.06, base),
    arms: [0, 1].map(() => ({
      delt: ball(0.068, hl.has('delt') ? hiMat : hl2.has('delt') ? hi2Mat : joint),
      upper: seg(0.052, 0.042, matFor('upper')),
      elbow: ball(0.043, joint),
      fore: seg(0.042, 0.03, matFor('fore')),
      wrist: ball(0.031, joint),
      hand: ellip(0.026, 0.055, 0.045, base),
    })),
    legs: [0, 1].map(() => ({
      thigh: seg(0.078, 0.055, matFor('thigh')),
      thighTop: hl.has('thighTop') || hl2.has('thighTop') ? seg(0.08, 0.07, hl.has('thighTop') ? hiMat : hi2Mat) : null,
      knee: ball(0.055, joint),
      shin: seg(0.055, 0.038, matFor('shin')),
      ankle: ball(0.04, joint),
      foot: ellip(0.038, 0.085, 0.048, base),
    })),
  };

  function updateBody(k) {
    if (!body) return;
    const { hip, top, t, fwd, lat } = k;
    body.pelvis(hip.clone().addScaledVector(t, 0.03), t);
    body.glutes[0](hip.clone().addScaledVector(fwd, -0.055).addScaledVector(lat, 0.065).addScaledVector(t, -0.01), t);
    body.glutes[1](hip.clone().addScaledVector(fwd, -0.055).addScaledVector(lat, -0.065).addScaledVector(t, -0.01), t);
    body.abdomen(hip.clone().addScaledVector(t, 0.2).addScaledVector(fwd, 0.005), t);
    body.chest(hip.clone().addScaledVector(t, 0.355).addScaledVector(fwd, 0.012), t);
    body.traps(top.clone().addScaledVector(t, -0.04).addScaledVector(fwd, -0.02), t);
    const hd = k.head.clone().sub(top).normalize();
    const neckEnd = top.clone().addScaledVector(hd, 0.08);
    body.neck(top.clone().addScaledVector(t, -0.03), neckEnd);
    body.head(k.head.clone().addScaledVector(hd, 0.02), hd);
    const headFwd = fwd.clone().addScaledVector(hd, -fwd.dot(hd)).normalize();
    body.jaw(k.head.clone().addScaledVector(headFwd, 0.045).addScaledVector(hd, -0.045), hd);
    k.arms.forEach((a, i) => {
      const b = body.arms[i];
      b.delt(a.sh);
      b.upper(a.sh, a.el);
      b.elbow(a.el);
      b.fore(a.el, a.wr);
      b.wrist(a.wr);
      const hdir = a.hd.clone().sub(a.wr).normalize();
      b.hand(a.wr.clone().addScaledVector(hdir, 0.045), hdir);
    });
    k.legs.forEach((l, i) => {
      const b = body.legs[i];
      b.thigh(l.hip, l.kn);
      if (b.thighTop) b.thighTop(l.hip, l.hip.clone().lerp(l.kn, 0.42));
      b.knee(l.kn);
      b.shin(l.kn, l.an);
      b.ankle(l.an);
      const fd = l.to.clone().sub(l.an);
      b.foot(l.an.clone().addScaledVector(fd, 0.55), fd.normalize());
    });
  }

  /* ---------- attrezzi ---------- */
  const props = [];
  const group = (build) => {
    const g = new THREE.Group();
    build(g);
    scene.add(g);
    return g;
  };
  const part = (g, geo, mat, sx, sy, sz, x = 0, y = 0, z = 0, rotX = 0, rotZ = 0) => {
    const o = new THREE.Mesh(geo, mat);
    o.scale.set(sx, sy, sz);
    o.position.set(x, y, z);
    o.rotation.set(rotX, 0, rotZ);
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const along = Math.PI / 2; // ruota il cilindro (asse y) sull'asse z del mondo
  const floorY = 0;
  const P = (x, y, z = 0) => new THREE.Vector3((x - 100) * U, (GROUND - y) * U, z);
  const front = spec.view === 'front';

  for (const pr of spec.props || []) {
    switch (pr.t) {
      case 'barbell': {
        const g = group((g) => {
          part(g, cylG, metal, 0.014, 1.7, 0.014, 0, 0, 0, along);
          for (const s of [-1, 1]) {
            part(g, cylG, iron, 0.2, 0.05, 0.2, 0, 0, s * 0.62, along);
            part(g, cylG, iron, 0.16, 0.04, 0.16, 0, 0, s * 0.67, along);
            part(g, cylG, metal, 0.03, 0.04, 0.03, 0, 0, s * 0.56, along);
          }
        });
        props.push((k) => {
          if (k.bar) g.position.copy(k.bar);
          else if (pr.at === 'back') g.position.copy(k.top).addScaledVector(k.t, -0.02).addScaledVector(k.fwd, -0.085);
          else if (pr.at === 'hip') g.position.copy(k.hip).addScaledVector(k.fwd, 0.1).addScaledVector(k.t, 0.05);
          else g.position.copy(k.arms[0].wr).setZ(0).addScaledVector(k.fwd, 0.0);
          if (front) g.position.z = 0;
        });
        break;
      }
      case 'dumbbell': {
        const gs = [0, 1].map(() => group((g) => {
          part(g, cylG, metal, 0.014, 0.17, 0.014, 0, 0, 0, along);
          for (const s of [-1, 1]) part(g, cylG, iron, 0.06, 0.05, 0.06, 0, 0, s * 0.1, along);
        }));
        if (pr.one) gs[1].visible = false;
        props.push((k) => gs.forEach((g, i) => {
          const a = k.arms[i];
          if (a.ax) { // corpo realistico: manico nel palmo, lungo l'asse della presa
            g.position.copy(a.wr);
            g.quaternion.setFromUnitVectors(Z, a.ax);
            return;
          }
          g.position.copy(a.wr).addScaledVector(a.hd.clone().sub(a.wr).normalize(), 0.045);
          g.rotation.set(0, front ? along : 0, 0);
        }));
        break;
      }
      case 'kettlebell': {
        const g = group((g) => {
          part(g, sphereG, iron, 0.085, 0.085, 0.085, 0, -0.1, 0);
          const tor = new THREE.Mesh(track(new THREE.TorusGeometry(0.05, 0.012, 10, 24)), iron);
          tor.position.set(0, -0.02, 0);
          tor.castShadow = true;
          g.add(tor);
        });
        props.push((k) => {
          g.position.copy(k.arms[0].wr);
          if (spec.key !== 'row') g.position.z = 0;
          if (k.arms[0].ax && spec.key !== 'row') g.position.y += 0.012;
        });
        break;
      }
      case 'ball': {
        const g = group((g) => part(g, sphereG, iron, 0.11, 0.11, 0.11));
        props.push((k) => {
          const w = k.arms[0].wr.clone().lerp(k.arms[1].wr, 0.5);
          g.position.copy(w).addScaledVector(k.fwd, 0.08);
          if (!front) g.position.z = 0;
        });
        break;
      }
      case 'wheel': { // ab wheel: ruota tra le mani, manico che passa nei palmi
        const tyre = new THREE.Mesh(track(new THREE.TorusGeometry(0.075, 0.022, 14, 40)), iron);
        const hub = new THREE.Mesh(cylG, metal);
        const handle = new THREE.Mesh(cylG, iron);
        for (const o of [tyre, hub, handle]) { o.castShadow = true; scene.add(o); }
        props.push((k) => {
          const a = k.arms[0].wr, b = k.arms[1].wr;
          const c = a.clone().lerp(b, 0.5);
          const ax = b.clone().sub(a).normalize();
          const len = a.distanceTo(b) + 0.09;
          handle.position.copy(c); handle.quaternion.setFromUnitVectors(Y, ax); handle.scale.set(0.016, len, 0.016);
          hub.position.copy(c); hub.quaternion.setFromUnitVectors(Y, ax); hub.scale.set(0.05, 0.05, 0.05);
          tyre.position.copy(c); tyre.quaternion.setFromUnitVectors(Z, ax);
        });
        break;
      }
      case 'pulley': {
        const mkLine = () => {
          const o = new THREE.Mesh(cylG, cableMat);
          scene.add(o);
          return o;
        };
        const lines = [mkLine(), pr.both ? mkLine() : null];
        const wheel = (x, z) => {
          const w = new THREE.Mesh(track(new THREE.TorusGeometry(0.045, 0.014, 10, 24)), iron);
          scene.add(w);
          return w;
        };
        const w1 = wheel(), w2 = pr.both ? wheel() : null;
        // impugnature: barra, corda, maniglia a V o maniglie singole (D)
        const handleMat = pr.h === 'rope' ? track(new THREE.MeshStandardMaterial({ name: 'rope', color: 0x2b2b2b, roughness: 0.9 })) : metal;
        const stick = (r) => { const o = new THREE.Mesh(cylG, handleMat); o.castShadow = true; o.userData.r = r; scene.add(o); return o; };
        const hs = pr.h === 'bar' ? [stick(0.014)] : pr.h === 'rope' || pr.h === 'v' ? [stick(0.012), stick(0.012), stick(0.01), stick(0.01)] : pr.h === 'd' ? [stick(0.014), pr.both ? stick(0.014) : null].filter(Boolean) : [];
        const place = (o, a, b, r = 0.006) => {
          const d = b.clone().sub(a);
          o.position.copy(a).addScaledVector(d, 0.5);
          o.quaternion.setFromUnitVectors(Y, d.clone().normalize());
          o.scale.set(r, d.length(), r);
        };
        props.push((k) => {
          const real = !!k.arms[0].ax;
          const two = real && pr.h && pr.h !== 'd';
          const hand = two ? k.arms[0].wr.clone().lerp(k.arms[1].wr, 0.5) : (pr.hand === 'far' ? k.arms[1] : k.arms[0]).wr;
          const anchor = front ? new THREE.Vector3(0.0, (GROUND - pr.y) * U, (pr.x - 100) * U) : P(pr.x, pr.y, hand.z);
          let end = hand;
          if (real && pr.h === 'bar') {
            const a = k.arms[0].wr, b = k.arms[1].wr, ax = b.clone().sub(a).normalize();
            place(hs[0], a.clone().addScaledVector(ax, -0.09), b.clone().addScaledVector(ax, 0.09), 0.014);
          } else if (real && (pr.h === 'rope' || pr.h === 'v')) {
            // le due estremità partono da un punto comune poco verso il cavo
            end = hand.clone().addScaledVector(anchor.clone().sub(hand).normalize(), pr.h === 'rope' ? 0.12 : 0.08);
            // impugnatura nel palmo, lungo l'asse della presa, collegata al punto d'aggancio del cavo
            k.arms.forEach((a, i) => {
              const s1 = a.wr.clone().addScaledVector(a.ax, -0.055), s2 = a.wr.clone().addScaledVector(a.ax, 0.055);
              const near = s1.distanceTo(end) < s2.distanceTo(end) ? s1 : s2;
              place(hs[i], s1, s2, pr.h === 'rope' ? 0.013 : 0.012);
              place(hs[i + 2], end, near, pr.h === 'rope' ? 0.011 : 0.009);
            });
          } else if (real && pr.h === 'd') {
            hs.forEach((o, i) => { const a = k.arms[pr.hand === 'far' ? 1 - i : i]; place(o, a.wr.clone().addScaledVector(a.ax, -0.06), a.wr.clone().addScaledVector(a.ax, 0.06), 0.014); });
          }
          place(lines[0], anchor, end);
          w1.position.copy(anchor);
          if (pr.both && w2) {
            const a2 = new THREE.Vector3(0, (GROUND - pr.y) * U, (pr.x2 - 100) * U);
            place(lines[1], a2, k.arms[1].wr);
            w2.position.copy(a2);
          }
        });
        break;
      }
      case 'bench': {
        const R = Math.PI / 180;
        const a = P(pr.x, pr.y), b = P(pr.x + Math.cos((pr.ang || 0) * R) * pr.w, pr.y - Math.sin((pr.ang || 0) * R) * pr.w);
        if (!pr.ang) a.x -= 0.24; // panca a misura di persona reale (testa appoggiata)
        const d = b.clone().sub(a);
        const g = group((g) => {
          const top = part(g, boxG, pad, d.length(), 0.07, 0.32);
          top.position.copy(a.clone().lerp(b, 0.5)).add(new THREE.Vector3(0, -0.035, 0));
          top.rotation.z = Math.atan2(d.y, d.x);
          const lx = ((pr.leg ?? pr.x + pr.w / 2) - 100) * U;
          const ly = Math.min(a.y, b.y) - 0.05;
          part(g, boxG, iron, 0.05, ly, 0.05, lx, ly / 2, 0);
          part(g, boxG, iron, 0.36, 0.03, 0.36, lx, 0.015, 0);
        });
        props.push(() => g);
        break;
      }
      case 'seat': {
        const c = P(pr.x, pr.y);
        group((g) => {
          part(g, boxG, pad, pr.w * U, 0.07, 0.36, c.x, c.y - 0.03, 0);
          part(g, boxG, iron, 0.05, c.y - 0.06, 0.05, c.x, (c.y - 0.06) / 2, 0);
          part(g, boxG, iron, 0.4, 0.03, 0.4, c.x, 0.015, 0);
        });
        break;
      }
      case 'back': {
        const a = P(pr.x, pr.y), b = P(pr.x2, pr.y2);
        const d = b.clone().sub(a);
        group((g) => {
          const o = part(g, boxG, pad, 0.07, d.length(), 0.36);
          o.position.copy(a.clone().lerp(b, 0.5));
          o.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2;
        });
        break;
      }
      case 'box': {
        const h = (GROUND - pr.y) * U;
        group((g) => part(g, boxG, pad, pr.w * U, h, 0.5, (pr.x + pr.w / 2 - 100) * U, h / 2, 0));
        break;
      }
      case 'bar': {
        const c = P(pr.x, pr.y);
        if (spec.key === 'dip') {
          group((g) => {
            for (const s of [-1, 1]) {
              part(g, cylG, metal, 0.02, 0.6, 0.02, c.x, c.y, s * 0.24, 0, along);
              part(g, cylG, iron, 0.025, c.y, 0.025, c.x - 0.25, c.y / 2, s * 0.24);
              part(g, cylG, iron, 0.025, c.y, 0.025, c.x + 0.25, c.y / 2, s * 0.24);
            }
          });
        } else {
          group((g) => {
            part(g, cylG, metal, 0.018, 1.3, 0.018, c.x, c.y, 0, along);
            for (const s of [-1, 1]) part(g, cylG, iron, 0.03, c.y + 0.1, 0.03, c.x, (c.y + 0.1) / 2, s * 0.65);
          });
        }
        break;
      }
      case 'pad': {
        const g = group((g) => part(g, cylG, pad, 0.055, 0.36, 0.055, 0, 0, 0, along));
        props.push((k) => {
          const pt = pr.j === 'ankle' ? k.legs[0].an : pr.j === 'knee' ? k.legs[0].kn : pr.j === 'elbow' ? k.arms[0].el : k.hip;
          g.position.set(pt.x + (pr.dx || 0) * U, pt.y - (pr.dy || 0) * U, 0);
        });
        break;
      }
      case 'plate': {
        const g = group((g) => part(g, boxG, pad, 0.05, 0.5, 0.55));
        props.push((k) => {
          const l = k.legs[0];
          g.position.copy(l.an.clone().lerp(l.to, 0.4)).setZ(0);
          g.rotation.z = -(pr.ang * Math.PI) / 180;
        });
        break;
      }
      case 'roller': {
        const g = group((g) => part(g, cylG, pad, 0.085, 0.55, 0.085, 0, 0, 0, along));
        props.push((k) => {
          const l = k.legs[0];
          const pt = pr.j === 'thigh' ? l.hip.clone().lerp(l.kn, 0.5) : pr.j === 'shin' ? l.kn.clone().lerp(l.an, 0.5) : k.hip.clone().lerp(k.top, 0.5);
          g.position.set(pt.x, 0.085, 0);
        });
        break;
      }
      case 'wall':
        group((g) => part(g, boxG, pad, 0.08, 2.2, 1.4, (pr.x - 100) * U, 1.1, 0));
        break;
      case 'rail':
        group((g) => part(g, boxG, pad, (pr.x2 - pr.x1) * U, 0.05, 0.4, ((pr.x1 + pr.x2) / 2 - 100) * U, 0.03, 0));
        break;
      case 'bike': {
        const c = P(pr.x, pr.y), s = P(pr.sx, pr.sy), h = P(pr.hx, pr.hy);
        group((g) => {
          const tor = new THREE.Mesh(track(new THREE.TorusGeometry(0.13, 0.012, 10, 32)), iron);
          tor.position.copy(c);
          g.add(tor);
          part(g, boxG, pad, 0.2, 0.05, 0.16, s.x, s.y, 0);
          const frame = (a, b) => {
            const d = b.clone().sub(a);
            const o = part(g, cylG, iron, 0.025, d.length(), 0.025);
            o.position.copy(a.clone().lerp(b, 0.5));
            o.quaternion.setFromUnitVectors(Y, d.normalize());
          };
          frame(s, c);
          frame(c, h);
          frame(c, new THREE.Vector3(c.x + 0.3, 0, 0));
          frame(c, new THREE.Vector3(c.x - 0.3, 0, 0));
          part(g, cylG, metal, 0.015, 0.4, 0.015, h.x, h.y, 0, along);
        });
        break;
      }
    }
  }

  /* ---------- pavimento e luci ---------- */
  // pavimento che sfuma nel nero (niente bordi netti)
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const cx = cv.getContext('2d');
  const grad = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(30,30,30,1)');
  grad.addColorStop(0.55, 'rgba(18,18,18,0.9)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 256);
  const floorTex = track(new THREE.CanvasTexture(cv));
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(track(new THREE.CircleGeometry(1.25, 64)), track(new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false })));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = floorY - 0.001;
  if (style === 'skin') scene.add(disc);
  const shadowPlane = new THREE.Mesh(track(new THREE.CircleGeometry(1.25, 64)), track(new THREE.ShadowMaterial({ opacity: style === 'skin' ? 0.55 : 0.35 })));
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = floorY;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(0.62, 0.64, 64)), track(new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false })));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = floorY + 0.002;
  if (style === 'skin') scene.add(ring);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.2, 4.5, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 12 });
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new THREE.DirectionalLight(style === 'skin' ? accent : new THREE.Color('#ffffff'), style === 'skin' ? 1.15 : 0.9);
  rim.position.set(-3, 2.2, -2.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-2, 1, 3);
  scene.add(fill);

  return {
    scene,
    update(k) {
      const kk = human ? human.pose(k, spec) : (updateBody(k), k);
      for (const f of props) f(kk);
      return kk;
    },
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      human?.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Montaggio                                                           */
/* ------------------------------------------------------------------ */

function bounds(spec) {
  const box = new THREE.Box3();
  const per = (spec.dur || 1000) + (spec.hold ?? 260);
  const n = spec.frames.length * 2 * 4;
  for (let i = 0; i <= n; i++) {
    const k = kAt(spec, (i / n) * per * spec.frames.length * 2);
    [k.hip, k.top, k.head, ...k.arms.flatMap((a) => [a.el, a.wr]), ...k.legs.flatMap((l) => [l.kn, l.an, l.to])].forEach((p) => box.expandByPoint(p));
  }
  box.expandByPoint(new THREE.Vector3(box.min.x, 0, box.min.z));
  box.expandByScalar(0.1);
  return box;
}

/**
 * Monta il manichino 3D nell'elemento. Restituisce false se WebGL non è disponibile.
 */
export async function mount3d(el, spec, { gender = 'male', azimuth = null, style = 'anatomy' } = {}) {
  try {
    await loadThree();
  } catch (e) {
    return false;
  }
  let bodyData = null;
  try {
    bodyData = await loadBody(THREE, gender);
  } catch (e) {
    bodyData = null; // ricade sul manichino
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    return false;
  }
  if (!el.isConnected) {
    renderer.dispose();
    return true;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D4FF00';
  const grip = !['pushup', 'plank', 'climber', 'dip', 'stretch', 'roll'].includes(spec.key) && (spec.props || []).some((p) => ['barbell', 'dumbbell', 'kettlebell', 'pulley', 'bar', 'ball', 'wheel'].includes(p.t));
  const human = bodyData ? createHumanoid(THREE, bodyData, { muscle: spec.muscle, secondary: spec.secondary || [], accent, grip, style, focus: focusFor(spec) }) : null;
  const world = makeScene(spec, accent, human, style);
  const box = bounds(spec);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const radius = Math.max(size.x, size.y, size.z * 0.8) * 0.5 + 0.08;

  el.innerHTML = '';
  el.classList.add('mq3d');
  el.appendChild(renderer.domElement);
  const hint = document.createElement('div');
  hint.className = 'mq-hint';
  hint.textContent = 'Trascina per ruotare';
  el.appendChild(hint);

  const resize = () => {
    const w = el.clientWidth || 320;
    const h = el.clientHeight || w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = radius / Math.tan((camera.fov * Math.PI) / 360) * (camera.aspect < 1 ? 1 / camera.aspect : 1) * 1.05;
    camera.userData.dist = dist;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // vista 3/4: laterale per i movimenti sul piano sagittale, quasi frontale per quelli laterali
  // muscoli posteriori: inquadratura da dietro (3/4), come nelle tavole anatomiche
  const BACK = ['Dorso', 'Lombari', 'Trapezi', 'Tricipiti', 'Glutei', 'Femorali', 'Polpacci'];
  const t0r = spec.frames[0].torso ?? 180;
  const upright = spec.view === 'front' || Math.abs(((t0r % 360) + 360) % 360 - 180) < 70;
  const fromBack = BACK.includes(spec.muscle) && upright;
  const baseAz = azimuth ?? spec.cam ?? (fromBack ? (spec.view === 'front' ? -118 : -132) : spec.view === 'front' ? 62 : 32);
  let userAz = 0, userEl = 0, dragging = false, lastX = 0, lastY = 0, lastInteract = -1e9;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture?.(e.pointerId);
    hint.classList.add('hide');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    userAz -= (e.clientX - lastX) * 0.45;
    userEl = Math.max(-8, Math.min(40, userEl + (e.clientY - lastY) * 0.25));
    lastX = e.clientX;
    lastY = e.clientY;
    lastInteract = performance.now();
    if (reduce.matches) draw(performance.now());
  });
  const end = () => (dragging = false);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => {
    userAz = 0;
    userEl = 0;
  });

  // ---------- tempo dell'animazione: pausa, velocità, scorrimento ----------
  const per = (spec.dur || 1000) + (spec.hold ?? 260);
  const nF = spec.frames.length;
  const cycle = nF < 2 ? per : (spec.loop === 'cycle' ? nF : 2 * (nF - 1)) * per;
  let sim = reduce.matches ? (spec.dur || 1000) * 0.6 + (spec.hold ?? 260) : 0;
  let playing = !reduce.matches, speed = 1, lastNow = performance.now();
  // ---------- viste predefinite ----------
  const VIEWS = { auto: baseAz, front: 90, side: 0, back: -90 };
  let curAz = baseAz, targetAz = baseAz, swayOn = true;
  // ---------- posizioni fantasma (inizio e fine del movimento) ----------
  let ghosts = null;
  const makeGhosts = () => {
    if (!bodyData) return [];
    const ends = [0, (nF - 1) * per + (spec.hold ?? 260) + 1];
    return ends.map((ms) => {
      const g = createHumanoid(THREE, bodyData, { muscle: 'Altro', secondary: [], accent, grip, style });
      g.mesh.traverse((o) => {
        if (!o.material) return;
        o.material = o.material.clone();
        Object.assign(o.material, { transparent: true, opacity: 0.16, depthWrite: false, vertexColors: false });
        o.material.color = new THREE.Color(accent);
        o.material.needsUpdate = true;
        o.castShadow = false;
      });
      world.scene.add(g.mesh);
      g.mesh.updateMatrixWorld(true);
      g.pose(kAt(spec, ms), spec);
      return g;
    });
  };
  let onProgress = null;

  const draw = (now) => {
    const dt = Math.min(100, now - lastNow);
    lastNow = now;
    if (playing) sim = (sim + dt * speed) % cycle;
    world.update(kAt(spec, sim));
    onProgress?.(sim / cycle);
    // la telecamera raggiunge con dolcezza la vista scelta
    let dA = ((targetAz - curAz + 540) % 360) - 180;
    curAz += dA * Math.min(1, dt / 160);
    const idle = now - lastInteract > 2500 && !reduce.matches && swayOn && playing;
    const sway = idle ? Math.sin(now / 2600) * 14 : 0;
    const az = ((curAz + userAz + sway) * Math.PI) / 180;
    const elv = ((10 + userEl) * Math.PI) / 180;
    const d = camera.userData.dist;
    camera.position.set(center.x + Math.sin(az) * Math.cos(elv) * d, center.y + Math.sin(elv) * d, center.z + Math.cos(az) * Math.cos(elv) * d);
    camera.lookAt(center);
    renderer.render(world.scene, camera);
  };

  let raf = 0;
  const loop = (now) => {
    if (!el.isConnected) {
      ro.disconnect();
      ghosts?.forEach((g) => g.dispose());
      world.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      return;
    }
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  setTimeout(() => hint.classList.add('hide'), 3500);

  /** Comandi per l'interfaccia */
  const ctrl = {
    get playing() { return playing; },
    get speed() { return speed; },
    get ghost() { return !!ghosts; },
    play(v = !playing) { playing = v; lastNow = performance.now(); return playing; },
    setSpeed(v) { speed = v; },
    seek(frac) { playing = false; sim = Math.max(0, Math.min(0.999, frac)) * cycle; },
    view(name) {
      targetAz = VIEWS[name] ?? baseAz;
      userAz = 0;
      userEl = 0;
      swayOn = name === 'auto';
    },
    setGhost(v) {
      if (v && !ghosts) ghosts = makeGhosts();
      else if (!v && ghosts) { ghosts.forEach((g) => { world.scene.remove(g.mesh); g.dispose(); }); ghosts = null; }
    },
    onProgress(fn) { onProgress = fn; },
  };
  el._mq = ctrl;
  return ctrl;
}

/** Collaudo: posa il corpo realistico in vari istanti e conta i valori non validi */
export async function poseCheck(spec, gender, times) {
  await loadThree();
  const d = await loadBody(THREE, gender);
  const h = createHumanoid(THREE, d, { muscle: spec.muscle, secondary: spec.secondary || [] });
  let bad = 0, minY = Infinity, jump = 0, jumpBone = '', gripErr = 0;
  const prev = {};
  for (const t of times) {
    const k = h.pose(kAt(spec, t), spec);
    // continuità: rotazione massima di un osso del braccio tra due istanti vicini
    for (const n of ['upperarm_r', 'lowerarm_r', 'hand_r', 'twB_r', 'upperarm_l', 'hand_l']) {
      const q = h.mesh.skeleton.getBoneByName(n).getWorldQuaternion(new THREE.Quaternion());
      if (prev[n]) { const a = q.angleTo(prev[n]); if (a > jump) { jump = a; jumpBone = n + '@' + Math.round(t); } }
      prev[n] = q;
    }
    const bar = (spec.props || []).find((p) => p.t === 'bar');
    if (bar) {
      const w = spec.key === 'dip' ? 0.24 : spec.grip?.w ?? 0.24;
      k.arms.forEach((a, i) => { gripErr = Math.max(gripErr, a.wr.distanceTo(new THREE.Vector3((bar.x - 100) * U, (GROUND - bar.y) * U, i ? -w : w))); });
    }
    const pts = [k.hip, k.top, ...k.arms.flatMap((a) => [a.sh, a.el, a.wr]), ...k.legs.flatMap((l) => [l.kn, l.an, l.to])];
    for (const p of pts) {
      if (![p.x, p.y, p.z].every(Number.isFinite)) bad++;
      minY = Math.min(minY, p.y);
    }
  }
  h.dispose();
  return { bad, minY, jump: (jump * 180) / Math.PI, jumpBone, gripErr };
}

/* ------------------------------------------------------------------ */
/* Immagini statiche (miniature): un solo renderer condiviso           */
/* ------------------------------------------------------------------ */

let still = null;
const queue = [];
let busy = false;

function stillRenderer(size) {
  if (still && still.size === size) return still;
  still?.renderer.dispose();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  still = { renderer, size };
  return still;
}

/**
 * Disegna una posa in un'immagine (dataURL webp/png).
 * opts: gender, style, size, azimuth, frame ('peak'|'start'), crop ('full'|'upper')
 */
export function renderStill(spec, opts = {}) {
  return new Promise((resolve, reject) => {
    queue.push({ spec, opts, resolve, reject });
    pump();
  });
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const job = queue.shift();
  try {
    job.resolve(await doStill(job.spec, job.opts));
  } catch (e) {
    job.reject(e);
  }
  busy = false;
  setTimeout(pump, 0);
}

async function doStill(spec, { gender = 'male', style = 'anatomy', size = 320, azimuth = null, frame = 'peak', crop = 'full', at = null, close = null } = {}) {
  await loadThree();
  const bodyData = await loadBody(THREE, gender);
  const { renderer } = stillRenderer(size);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D4FF00';
  const grip = !['pushup', 'plank', 'climber', 'dip', 'stretch', 'roll'].includes(spec.key) && (spec.props || []).some((p) => ['barbell', 'dumbbell', 'kettlebell', 'pulley', 'bar', 'ball', 'wheel'].includes(p.t));
  const human = createHumanoid(THREE, bodyData, { muscle: spec.muscle, secondary: spec.secondary || [], accent, grip, style, focus: focusFor(spec) });
  const world = makeScene(spec, accent, human, style);
  const per = (spec.dur || 1000) + (spec.hold ?? 260);
  const ms = at ?? (frame === 'peak' ? (spec.frames.length - 1) * per + (spec.hold ?? 260) + 1 : 0);
  const kk = world.update(kAt(spec, ms));
  const box = bounds(spec);
  const center = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  let radius = Math.max(sz.x, sz.y * 0.96, sz.z * 0.7) * 0.45 + 0.02;
  if (crop === 'upper') {
    center.y = 1.12;
    radius = 0.55;
  }
  if (close) { // inquadratura ravvicinata (collaudo delle mani)
    center.copy(close.head ? kk.head.clone().addScaledVector(kk.t, -0.12) : kk.arms[close.arm || 0].wr);
    radius = close.r || 0.16;
  }
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const BACK = ['Dorso', 'Lombari', 'Trapezi', 'Tricipiti', 'Glutei', 'Femorali', 'Polpacci'];
  const t0r = spec.frames[0].torso ?? 180;
  const upright = spec.view === 'front' || Math.abs(((t0r % 360) + 360) % 360 - 180) < 70;
  const az = ((azimuth ?? spec.cam ?? (BACK.includes(spec.muscle) && upright ? (spec.view === 'front' ? -118 : -132) : spec.view === 'front' ? 62 : 32)) * Math.PI) / 180;
  const elv = ((close?.el ?? 10) * Math.PI) / 180;
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.02;
  camera.position.set(center.x + Math.sin(az) * Math.cos(elv) * dist, center.y + Math.sin(elv) * dist, center.z + Math.cos(az) * Math.cos(elv) * dist);
  camera.lookAt(center);
  renderer.setClearColor(0x000000, 0);
  renderer.render(world.scene, camera);
  let url;
  try {
    url = renderer.domElement.toDataURL('image/webp', 0.82);
    if (!url.startsWith('data:image/webp')) url = renderer.domElement.toDataURL('image/png');
  } finally {
    world.dispose();
  }
  return url;
}

/**
 * Esporta una posa per il render offline (Blender): corpo già posato con maschera dei muscoli
 * e cavità, primitive degli attrezzi con matrici, inquadratura. Solo strumenti di produzione.
 */
export async function exportPose(spec, { gender = 'male', ms = 0, azimuth = null } = {}) {
  await loadThree();
  const d = await loadBody(THREE, gender);
  const human = createHumanoid(THREE, d, { muscle: 'Altro', secondary: [], style: 'anatomy' });
  const world = makeScene(spec, '#ffffff', human, 'anatomy');
  world.update(kAt(spec, ms));
  world.scene.updateMatrixWorld(true);
  const mesh = human.mesh;
  const pos = mesh.geometry.getAttribute('position');
  const v = new THREE.Vector3();
  const P = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(mesh.matrixWorld);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
  }
  // colori neutri con ombreggiatura dipinta leggera: nel render offline ombre e solchi sono reali
  const col = vertexColors(THREE, d, [], [], '#ffffff', 'anatomy', null, 0.3);
  const mask = muscleMask(d, [spec.muscle], spec.secondary || [], 'anatomy', focusFor(spec));
  const cav = bodyCavity(d);
  const rw = d.rwBy.anatomy;
  const cloth = rw.map((w) => +Math.max(w.shorts || 0, w.top || 0).toFixed(3));
  const prims = [], meshes = [];
  // maglie libere (capelli, coda): triangoli già posati nel mondo
  const bake = (o) => {
    const pa = o.geometry.getAttribute('position');
    const out = [];
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
      v.applyMatrix4(o.matrixWorld);
      out.push(+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5));
    }
    meshes.push({ mat: o.material?.name || 'hair', pos: out, index: Array.from(o.geometry.index.array) });
  };
  world.scene.traverse((o) => {
    if (!o.isMesh || o === mesh || !o.visible) return;
    if (o.isSkinnedMesh || o.geometry.type === 'BufferGeometry') { bake(o); return; }
    const g = o.geometry;
    if (['CircleGeometry', 'RingGeometry'].includes(g.type)) return;
    const tag = o.material?.name || (o.parent && o.parent.isBone ? 'hair' : 'other');
    prims.push({ g: g.type, p: g.parameters, m: Array.from(o.matrixWorld.elements), mat: tag });
  });
  // inquadratura come nell'app (3/4, da dietro per i muscoli posteriori)
  const box = bounds(spec);
  const center = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  const BACK = ['Dorso', 'Lombari', 'Trapezi', 'Tricipiti', 'Glutei', 'Femorali', 'Polpacci'];
  const t0r = spec.frames[0].torso ?? 180;
  const upright = spec.view === 'front' || Math.abs(((t0r % 360) + 360) % 360 - 180) < 70;
  const az = azimuth ?? spec.cam ?? (BACK.includes(spec.muscle) && upright ? (spec.view === 'front' ? -118 : -132) : spec.view === 'front' ? 62 : 32);
  const out = {
    pos: Array.from(P, (x) => +x.toFixed(5)), index: Array.from(mesh.geometry.index.array),
    col: Array.from(col, (x) => +x.toFixed(4)), mask: Array.from(mask, (x) => +x.toFixed(3)), cav: Array.from(cav, (x) => +x.toFixed(3)), cloth,
    prims, meshes, cam: { center: center.toArray(), size: sz.toArray(), az },
    joints: Object.fromEntries(['pelvis', 'head', 'neck_01', 'hand_r', 'foot_r'].map((n) => [n, mesh.skeleton.getBoneByName(n).getWorldPosition(new THREE.Vector3()).toArray()])),
  };
  world.dispose();
  return out;
}
