// Schemi di movimento del manichino.
// Ogni esercizio ha una "mossa" (es. "bench:incline") + attrezzo → specifica di animazione.
const FY = 155;
const STAND = { torso: 180, ua: 0, fa: 0, th: 0, sn: 0, ft: 90 };
const SEAT_HIP = [92, 117];
const R = Math.PI / 180;

/** Attrezzo → tipo di carico */
export function loadOf(ex) {
  switch (ex.equipment) {
    case 'Bilanciere': case 'Bilanciere EZ': case 'Multipower': return 'barbell';
    case 'Manubri': return 'dumbbell';
    case 'Kettlebell': return 'kettlebell';
    case 'Cavi': return 'cable';
    case 'Elastici': return 'band';
    case 'Palla medica': return 'ball';
    case 'Macchina': return 'machine';
    default: return 'none';
  }
}

const handProp = (load) =>
  load === 'barbell' ? [{ t: 'barbell' }] :
  load === 'dumbbell' ? [{ t: 'dumbbell' }] :
  load === 'kettlebell' ? [{ t: 'kettlebell' }] :
  load === 'ball' ? [{ t: 'ball' }] : [];

const cableOr = (load, pulley) => (load === 'cable' || load === 'band' || load === 'machine' ? [{ t: 'pulley', ...pulley }] : handProp(load));
const seatProps = (x = SEAT_HIP[0], y = SEAT_HIP[1], back = true) => [
  { t: 'seat', x: x + 6, y: y + 8, w: 34 },
  ...(back ? [{ t: 'back', x: x - 9, y: y + 4, x2: x - 11, y2: y - 46 }] : []),
];
const flatBench = (x1 = 56, x2 = 134, y = 128) => [{ t: 'bench', x: x1, y, w: x2 - x1, leg: (x1 + x2) / 2 }];

/** IK a due segmenti: anca → punto, ginocchio in avanti */
function ik(hip, target, l1 = 40, l2 = 38) {
  const dx = target[0] - hip[0], dy = target[1] - hip[1];
  const d = Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy));
  const base = Math.atan2(dx, dy) / R; // angolo nel nostro sistema (0 = giù)
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) / R;
  const th = base + a;
  const knee = [hip[0] + Math.sin(th * R) * l1, hip[1] + Math.cos(th * R) * l1];
  const sn = Math.atan2(target[0] - knee[0], target[1] - knee[1]) / R;
  return [th, sn];
}

/* ------------------------------------------------------------------ */
const M = {
  squat(o) {
    const v = o.opt.front ? 'front' : o.opt.goblet || o.load === 'kettlebell' ? 'goblet' : o.opt.overhead ? 'overhead'
      : o.load === 'barbell' || o.load === 'machine' ? 'back' : o.load === 'dumbbell' ? 'sides' : 'none';
    const arms = {
      back: [{ ua: -38, fa: 165 }, { ua: -22, fa: 168 }],
      front: [{ ua: 78, fa: 165 }, { ua: 80, fa: 160 }],
      goblet: [{ ua: 24, fa: 136 }, { ua: 40, fa: 128 }],
      overhead: [{ ua: 172, fa: 174 }, { ua: 165, fa: 170 }],
      sides: [{ ua: 0, fa: 0 }, { ua: 4, fa: 2 }],
      none: [{ ua: 90, fa: 90 }, { ua: 92, fa: 92 }],
    }[v];
    const props = v === 'back' ? [{ t: 'barbell', at: 'back' }] : v === 'sides' ? [{ t: 'dumbbell' }] : v === 'none' ? [] : handProp(o.load === 'none' ? 'none' : o.load);
    return {
      anchor: 'feet', at: [100, FY], props,
      frames: [{ ...STAND, ...arms[0] }, { torso: 143, th: 84, sn: -31, ft: 90, ...arms[1] }],
    };
  },
  rdl(o) {
    return { anchor: 'feet', at: [92, FY], props: handProp(o.load),
      frames: [{ ...STAND }, { torso: 98, th: 14, sn: -7, ft: 90, ua: 0, fa: 0 }] };
  },
  deadlift(o) {
    return { anchor: 'feet', at: [96, FY], props: handProp(o.load === 'none' ? 'barbell' : o.load), dur: 1200,
      frames: [{ torso: 122, th: 70, sn: -27, ft: 90, ua: -2, fa: -2 }, { ...STAND }] };
  },
  goodmorning() {
    return { anchor: 'feet', at: [92, FY], props: [{ t: 'barbell', at: 'back' }],
      frames: [{ ...STAND, ua: -38, fa: 165 }, { torso: 100, th: 10, sn: -6, ft: 90, ua: -60, fa: 120 }] };
  },
  lunge(o) {
    const arms = o.load === 'barbell' ? { ua: -38, fa: 165 } : { ua: 0, fa: 0 };
    const props = o.load === 'barbell' ? [{ t: 'barbell', at: 'back' }] : handProp(o.load);
    if (o.opt.bulgarian) props.push({ t: 'box', x: 30, y: 128, w: 34 });
    return { anchor: 'feet', at: [118, FY], props, dur: 1100,
      frames: o.opt.bulgarian
        ? [{ torso: 180, th: [10, -30], sn: [0, -100], ft: [90, -10], ...arms }, { torso: 172, th: [80, -10], sn: [2, -100], ft: [90, -10], ...arms }]
        : [{ torso: 180, th: [12, -14], sn: [0, -14], ft: [90, 70], ...arms }, { torso: 180, th: [82, -22], sn: [2, -92], ft: [90, 0], ...arms }] };
  },
  stepup(o) {
    return { anchor: 'feet', at: [122, 117], props: [{ t: 'box', x: 102, y: 121, w: 52 }, ...handProp(o.load)],
      frames: [{ torso: 165, th: [80, -6], sn: [-8, -6], ft: [90, 70], ua: 0, fa: 0 }, { torso: 180, th: [2, 40], sn: [0, -50], ft: [90, 40], ua: 0, fa: 0 }] };
  },
  legpress() {
    return { anchor: 'hip', at: [62, 118], props: [{ t: 'back', x: 66, y: 128, x2: 24, y2: 96 }, { t: 'seat', x: 74, y: 128, w: 28 }, { t: 'plate', ang: 38 }],
      frames: [{ torso: -128, th: 166, sn: 76, ua: 40, fa: 80 }, { torso: -128, th: 128, sn: 128, ua: 40, fa: 80 }] };
  },
  legext() {
    return { anchor: 'hip', at: SEAT_HIP, props: [...seatProps(), { t: 'pad', j: 'ankle', dx: 7, r: 6 }],
      frames: [{ torso: 176, th: 90, sn: 4, ft: 94, ua: 8, fa: 55 }, { torso: 176, th: 90, sn: 84, ft: 174, ua: 8, fa: 55 }] };
  },
  legcurl(o) {
    if (o.opt.seated) {
      return { anchor: 'hip', at: SEAT_HIP, props: [...seatProps(), { t: 'pad', j: 'ankle', dx: -6, r: 6 }],
        frames: [{ torso: 176, th: 90, sn: 86, ft: 176, ua: 8, fa: 55 }, { torso: 176, th: 90, sn: -18, ft: 72, ua: 8, fa: 55 }] };
    }
    return { anchor: 'hip', at: [104, 120], props: [...flatBench(46, 150, 128), { t: 'pad', j: 'ankle', dy: -7, r: 6 }],
      frames: [{ torso: -92, th: 92, sn: 92, ft: 2, ua: -12, fa: 20 }, { torso: -92, th: 92, sn: 168, ft: 78, ua: -12, fa: 20 }] };
  },
  calf(o) {
    if (o.opt.seated) {
      return { anchor: 'toes', at: [132, FY], props: [{ t: 'seat', x: 98, y: 125, w: 34 }, { t: 'pad', j: 'knee', dy: -8, r: 7 }],
        frames: [{ torso: 178, th: 90, sn: 0, ft: 90, ua: 30, fa: 90 }, { torso: 178, th: 90, sn: 0, ft: 52, ua: 30, fa: 90 }] };
    }
    const arms = o.load === 'barbell' ? { ua: -38, fa: 165 } : { ua: 0, fa: 0 };
    const props = o.load === 'barbell' ? [{ t: 'barbell', at: 'back' }] : o.load === 'machine' ? [] : handProp(o.load);
    return { anchor: 'toes', at: [112, FY], props,
      frames: [{ ...STAND, ...arms }, { ...STAND, ...arms, ft: 50 }] };
  },
  hipthrust(o) {
    if (o.opt.floor || o.load !== 'barbell') {
      return { anchor: 'shoulder', at: [50, 150], props: [],
        frames: [{ torso: -92, th: 128, sn: 24, ua: 88, fa: 88 }, { torso: -70, th: 100, sn: 0, ua: 76, fa: 80 }] };
    }
    return { anchor: 'shoulder', at: [54, 112], props: [{ t: 'bench', x: 22, y: 120, w: 40, leg: 42 }, { t: 'barbell', at: 'hip' }],
      frames: [{ torso: -125, th: 118, sn: 8, ua: 55, fa: 55 }, { torso: -92, th: 96, sn: -6, ua: 88, fa: 88 }] };
  },
  backext(o) {
    if (o.opt.floor) {
      return { anchor: 'hip', at: [100, 151], props: [],
        frames: [{ torso: -90, th: 90, sn: 90, ft: 170, ua: -90, fa: -90 }, { torso: -106, th: 100, sn: 100, ft: 180, ua: -104, fa: -104 }] };
    }
    return { anchor: 'hip', at: [100, 92], props: [{ t: 'pad', j: 'hip', dx: 4, dy: 8, r: 8 }, { t: 'pad', j: 'ankle', dx: 2, dy: -7, r: 5 }, { t: 'back', x: 108, y: 102, x2: 52, y2: 150 }],
      frames: [{ torso: 18, th: -50, sn: -50, ft: 40, ua: 0, fa: 0 }, { torso: 128, th: -50, sn: -50, ft: 40, ua: 0, fa: 0 }] };
  },
  nordic() {
    return { anchor: 'knee', at: [80, 152], props: [{ t: 'pad', j: 'ankle', dy: -6, r: 5 }],
      frames: [{ torso: 180, th: 0, sn: -90, ft: -90, ua: 60, fa: 110 }, { torso: 126, th: -54, sn: -90, ft: -90, ua: 80, fa: 100 }] };
  },
  glutekick(o) {
    return { anchor: 'farknee', at: [78, 152], fix: 'wr', props: o.load === 'cable' ? [{ t: 'pulley', x: 10, y: 150 }] : [],
      frames: [{ torso: 97, th: [2, 2], sn: [-90, -90], ft: [-90, -90], ua: 0, fa: 0 }, { torso: 97, th: [-96, 2], sn: [-96, -90], ft: [-10, -90], ua: 0, fa: 0 }] };
  },
  flylying(o) {
    const props = handProp(o.load === 'none' || o.load === 'machine' || o.load === 'cable' ? 'dumbbell' : o.load);
    if (o.opt.incline) {
      return { anchor: 'hip', at: [118, 122], props: [{ t: 'bench', x: 120, y: 130, w: 70, ang: 132, leg: 104 }, ...props],
        frames: [{ torso: -132, th: 86, sn: 0, ft: 90, ua: 178, fa: 172, abd: 4 }, { torso: -132, th: 86, sn: 0, ft: 90, ua: 178, fa: 170, abd: 74 }] };
    }
    return { anchor: 'hip', at: [124, 119], props: [...flatBench(), ...props],
      frames: [{ torso: -90, th: 62, sn: 2, ft: 92, ua: 180, fa: 174, abd: 4 }, { torso: -90, th: 62, sn: 2, ft: 92, ua: 180, fa: 172, abd: 76 }] };
  },
  twistseat(o) {
    return { anchor: 'hip', at: [100, 150], props: handProp(o.load === 'none' || o.load === 'cable' ? 'ball' : o.load === 'barbell' ? 'ball' : o.load), dur: 750, hold: 120,
      frames: [
        { torso: -152, th: 128, sn: 62, ft: 150, ua: 98, fa: 96, tw: -42 },
        { torso: -152, th: 128, sn: 62, ft: 150, ua: 98, fa: 96, tw: 42 },
      ] };
  },
  woodchop(o) {
    return { anchor: 'feet', at: [100, FY], props: o.load === 'cable' ? [{ t: 'pulley', x: 60, y: -30 }] : handProp(o.load === 'none' ? 'ball' : o.load), dur: 800,
      frames: [
        { torso: 180, th: [10, -6], sn: [-4, -4], ft: 90, ua: 158, fa: 158, tw: -48 },
        { torso: 158, th: [26, -2], sn: [-16, -4], ft: 90, ua: 40, fa: 36, tw: 46 },
      ] };
  },
  bench(o) {
    if (o.opt.machine || (o.load === 'machine' && !o.opt.incline && !o.opt.decline)) {
      return { anchor: 'hip', at: SEAT_HIP, props: [...seatProps(), { t: 'pulley', x: 170, y: 70 }],
        frames: [{ torso: 178, th: 90, sn: 0, ft: 90, ua: 32, fa: 94 }, { torso: 178, th: 90, sn: 0, ft: 90, ua: 88, fa: 90 }] };
    }
    if (o.opt.floor) {
      return { anchor: 'hip', at: [128, 150], props: handProp(o.load),
        frames: [{ torso: -90, th: 125, sn: 20, ua: 180, fa: 180 }, { torso: -90, th: 125, sn: 20, ua: 62, fa: 178 }] };
    }
    const props = handProp(o.load === 'none' ? 'barbell' : o.load === 'machine' || o.load === 'cable' ? 'dumbbell' : o.load);
    if (o.opt.incline) {
      return { anchor: 'hip', at: [118, 122], props: [{ t: 'bench', x: 120, y: 130, w: 70, ang: 132, leg: 104 }, ...props],
        frames: [{ torso: -132, th: 86, sn: 0, ft: 90, ua: 172, fa: 174 }, { torso: -132, th: 86, sn: 0, ft: 90, ua: 52, fa: 166 }] };
    }
    if (o.opt.decline) {
      return { anchor: 'hip', at: [126, 110], props: [{ t: 'bench', x: 132, y: 118, w: 82, ang: 196, leg: 96 }, ...props],
        frames: [{ torso: -74, th: 112, sn: 22, ft: 112, ua: 182, fa: 182 }, { torso: -74, th: 112, sn: 22, ft: 112, ua: 40, fa: 186 }] };
    }
    return { anchor: 'hip', at: [124, 119], props: [...flatBench(), ...props],
      frames: [{ torso: -90, th: 62, sn: 2, ft: 92, ua: 180, fa: 180 }, { torso: -90, th: 62, sn: 2, ft: 92, ua: 28, fa: 176 }] };
  },
  pushup(o) {
    const B = o.opt.decline ? [{ t: 'box', x: 10, y: 128, w: 34 }] : o.opt.incline ? [{ t: 'box', x: 150, y: 120, w: 40 }] : [];
    return { anchor: 'toes', at: o.opt.decline ? [32, 126] : [42, FY], fix: 'wr', fixY: o.opt.incline ? 118 : 156, props: B,
      frames: [{ torso: 101, th: -79, sn: -79, ft: 8, ua: 2, fa: 2, hand: 92 }, { torso: 96, th: -84, sn: -84, ft: 8, ua: -126, fa: 22, hand: 92 }] };
  },
  dip() {
    return { anchor: 'hands', at: [112, 30], props: [{ t: 'bar', x: 112, y: 34 }],
      frames: [{ torso: 182, ua: 2, fa: 0, hand: 80, th: 10, sn: -60, ft: 30 }, { torso: 168, ua: -100, fa: 10, hand: 80, th: 14, sn: -60, ft: 30 }] };
  },
  ohpress(o) {
    const props = o.load === 'machine' || o.load === 'cable' ? [{ t: 'pulley', x: 96, y: -44 }] : handProp(o.load === 'none' ? 'barbell' : o.load);
    const seated = o.opt.seated || o.load === 'machine';
    const base = seated ? { torso: 180, th: 90, sn: 0, ft: 90 } : { ...STAND };
    return { anchor: seated ? 'hip' : 'feet', at: seated ? SEAT_HIP : [100, FY], props: seated ? [...seatProps(), ...props] : props,
      frames: [{ ...base, ua: 22, fa: 170 }, { ...base, ua: 172, fa: 177 }] };
  },
  jerk(o) {
    return { anchor: 'feet', at: [100, FY], props: handProp(o.load === 'none' ? 'barbell' : o.load), dur: 650, hold: 200,
      frames: [{ ...STAND, ua: 22, fa: 170 }, { torso: 176, th: 26, sn: -16, ft: 90, ua: 22, fa: 170 }, { ...STAND, ua: 174, fa: 178 }] };
  },
  row(o) {
    const one = o.opt.one;
    const props = one ? [{ t: 'bench', x: 120, y: 118, w: 50, leg: 145 }, ...(o.load === 'dumbbell' ? [{ t: 'dumbbell', one: true }] : handProp(o.load))]
      : o.load === 'cable' ? [{ t: 'pulley', x: 150, y: 152 }] : handProp(o.load === 'none' ? 'barbell' : o.load);
    return { anchor: 'feet', at: [88, FY], props,
      frames: [{ torso: 118, th: 22, sn: -12, ft: 90, ua: [0, one ? 20 : 0], fa: [0, one ? 0 : 0] }, { torso: 118, th: 22, sn: -12, ft: 90, ua: [-58, one ? 20 : -58], fa: [-8, one ? 0 : -8] }] };
  },
  seatedrow(o) {
    if (o.load === 'machine') {
      return { anchor: 'hip', at: [80, 117], props: [...seatProps(80, 117, false), { t: 'pad', j: 'hip', dx: 26, dy: -38, r: 7 }, { t: 'pulley', x: 170, y: 82 }],
        frames: [{ torso: 178, th: 90, sn: 0, ft: 90, ua: 84, fa: 88 }, { torso: 178, th: 90, sn: 0, ft: 90, ua: -40, fa: 80 }] };
    }
    return { anchor: 'hip', at: [66, 138], props: [{ t: 'seat', x: 66, y: 146, w: 30 }, { t: 'pulley', x: 192, y: 118 }],
      frames: [{ torso: 152, th: 82, sn: 98, ft: 180, ua: 92, fa: 92 }, { torso: 188, th: 82, sn: 98, ft: 180, ua: -38, fa: 82 }] };
  },
  pullup() {
    return { anchor: 'hands', at: [100, -26], props: [{ t: 'bar', x: 100, y: -26 }],
      frames: [{ torso: 180, ua: 180, fa: 180, th: 2, sn: -35, ft: 40 }, { torso: 176, ua: 16, fa: 180, th: 8, sn: -35, ft: 40 }] };
  },
  pulldown() {
    return { anchor: 'hip', at: [96, 108], props: [{ t: 'seat', x: 98, y: 116, w: 34 }, { t: 'pad', j: 'knee', dy: -9, r: 6 }, { t: 'pulley', x: 104, y: -42 }],
      frames: [{ torso: 176, th: 92, sn: 2, ft: 92, ua: 176, fa: 178 }, { torso: 170, th: 92, sn: 2, ft: 92, ua: 18, fa: 168 }] };
  },
  straightarm() {
    return { anchor: 'feet', at: [88, FY], props: [{ t: 'pulley', x: 160, y: -36 }],
      frames: [{ torso: 160, th: 10, sn: -6, ft: 90, ua: 150, fa: 150 }, { torso: 160, th: 10, sn: -6, ft: 90, ua: 4, fa: 4 }] };
  },
  pullover(o) {
    return { anchor: 'hip', at: [124, 119], props: [...flatBench(), ...handProp(o.load === 'none' ? 'dumbbell' : o.load)],
      frames: [{ torso: -90, th: 62, sn: 2, ft: 92, ua: -100, fa: -100 }, { torso: -90, th: 62, sn: 2, ft: 92, ua: 176, fa: 176 }] };
  },
  curl(o) {
    if (o.opt.preacher) {
      return { anchor: 'hip', at: [84, 117], props: [{ t: 'seat', x: 88, y: 125, w: 30 }, { t: 'back', x: 108, y: 66, x2: 128, y2: 88 }, ...handProp(o.load === 'machine' ? 'barbell' : o.load)],
        frames: [{ torso: 174, th: 90, sn: 0, ft: 90, ua: 50, fa: 56 }, { torso: 174, th: 90, sn: 0, ft: 90, ua: 50, fa: 168 }] };
    }
    if (o.opt.incline) {
      return { anchor: 'hip', at: [104, 120], props: [{ t: 'bench', x: 108, y: 128, w: 64, ang: 118, leg: 96 }, ...handProp(o.load)],
        frames: [{ torso: -156, th: 72, sn: 0, ft: 90, ua: 2, fa: 2 }, { torso: -156, th: 72, sn: 0, ft: 90, ua: 8, fa: 150 }] };
    }
    if (o.opt.conc) {
      return { anchor: 'hip', at: SEAT_HIP, props: [{ t: 'seat', x: 98, y: 125, w: 30 }, ...handProp(o.load)],
        frames: [{ torso: 142, th: 90, sn: 0, ft: 90, ua: 12, fa: 8 }, { torso: 142, th: 90, sn: 0, ft: 90, ua: 12, fa: 155 }] };
    }
    const props = o.load === 'cable' || o.load === 'band' || o.load === 'machine' ? [{ t: 'pulley', x: 150, y: 156 }] : handProp(o.load === 'none' ? 'dumbbell' : o.load);
    return { anchor: 'feet', at: [96, FY], props,
      frames: [{ ...STAND, ua: 4, fa: 4 }, { ...STAND, ua: 14, fa: 162 }] };
  },
  wristcurl(o) {
    return { anchor: 'hip', at: [84, 117], props: [{ t: 'seat', x: 88, y: 125, w: 30 }, ...handProp(o.load === 'none' ? 'dumbbell' : o.load)],
      frames: [{ torso: 165, th: 90, sn: 0, ft: 90, ua: 28, fa: 92, hand: 40 }, { torso: 165, th: 90, sn: 0, ft: 90, ua: 28, fa: 92, hand: 135 }] };
  },
  ohext(o) {
    const props = o.load === 'cable' || o.load === 'band' ? [{ t: 'pulley', x: 60, y: 150 }] : handProp(o.load === 'none' ? 'dumbbell' : o.load);
    return { anchor: 'feet', at: [100, FY], props,
      frames: [{ ...STAND, ua: 172, fa: 342 }, { ...STAND, ua: 172, fa: 176 }] };
  },
  skull(o) {
    return { anchor: 'hip', at: [124, 119], props: [...flatBench(), ...handProp(o.load === 'none' ? 'barbell' : o.load)],
      frames: [{ torso: -90, th: 62, sn: 2, ft: 92, ua: -172, fa: -172 }, { torso: -90, th: 62, sn: 2, ft: 92, ua: -168, fa: -92 }] };
  },
  pushdown() {
    return { anchor: 'feet', at: [88, FY], props: [{ t: 'pulley', x: 150, y: -36 }],
      frames: [{ ...STAND, torso: 172, ua: 6, fa: 112 }, { ...STAND, torso: 172, ua: 6, fa: 4 }] };
  },
  kickback(o) {
    return { anchor: 'feet', at: [88, FY], props: o.load === 'cable' ? [{ t: 'pulley', x: 150, y: 150 }] : handProp(o.load === 'none' ? 'dumbbell' : o.load),
      frames: [{ torso: 115, th: 22, sn: -12, ft: 90, ua: -64, fa: 2 }, { torso: 115, th: 22, sn: -12, ft: 90, ua: -64, fa: -64 }] };
  },
  latraise(o) {
    const props = o.load === 'cable' || o.load === 'band' ? [{ t: 'pulley', x: 60, y: 155 }] : handProp(o.load === 'none' ? 'dumbbell' : o.load === 'barbell' ? 'dumbbell' : o.load);
    return { view: 'front', anchor: 'feet', at: [100, FY], props,
      frames: [{ ab: 8, fb: 6, lb: 4 }, { ab: 86, fb: 92, lb: 4 }] };
  },
  frontraise(o) {
    return { anchor: 'feet', at: [96, FY], props: o.load === 'cable' ? [{ t: 'pulley', x: 70, y: 155 }] : handProp(o.load === 'none' ? 'dumbbell' : o.load),
      frames: [{ ...STAND, ua: 2, fa: 2 }, { ...STAND, ua: 92, fa: 92 }] };
  },
  reardelt(o) {
    if (o.load === 'machine' || o.load === 'cable') {
      return { view: 'front', anchor: 'feet', at: [100, FY], props: o.load === 'cable' ? [{ t: 'pulley', x: 30, x2: 170, y: 50, both: true }] : [],
        frames: [{ ab: 30, fb: -20 }, { ab: 88, fb: 92 }] };
    }
    return { anchor: 'feet', at: [88, FY], props: handProp(o.load === 'none' ? 'dumbbell' : o.load),
      frames: [{ torso: 108, th: 20, sn: -12, ft: 90, ua: 0, fa: 6, abd: 0 }, { torso: 108, th: 20, sn: -12, ft: 90, ua: 0, fa: 8, abd: 82 }] };
  },
  facepull() {
    return { anchor: 'feet', at: [92, FY], props: [{ t: 'pulley', x: 192, y: 16 }],
      frames: [{ ...STAND, ua: 88, fa: 88, abd: 0 }, { ...STAND, ua: 92, fa: 176, abd: 100 }] };
  },
  uprightrow(o) {
    return { view: 'front', anchor: 'feet', at: [100, FY], props: o.load === 'cable' ? [] : handProp(o.load === 'none' ? 'barbell' : o.load),
      frames: [{ ab: 6, fb: -8, lb: 4 }, { ab: 104, fb: -50, lb: 4 }] };
  },
  shrug(o) {
    const arms = { ua: 0, fa: 0 };
    return { anchor: 'feet', at: [98, FY], props: handProp(o.load === 'none' ? 'dumbbell' : o.load === 'machine' ? 'barbell' : o.load), hl: ['trap', 'neck'],
      frames: [{ ...STAND, ...arms, sh: 0 }, { ...STAND, ...arms, sh: 9 }] };
  },
  rotation(o) {
    return { view: 'front', anchor: 'feet', at: [100, FY], props: o.load === 'cable' || o.load === 'band' ? [{ t: 'pulley', x: 20, y: 40 }] : handProp(o.load),
      frames: [{ ab: [90, 10], fb: [92, 5] }, { ab: [90, 10], fb: [178, 5] }] };
  },
  fly(o) {
    const props = o.load === 'cable' ? [{ t: 'pulley', x: 8, x2: 192, y: -30, both: true }] : o.load === 'machine' ? [] : handProp(o.load === 'none' ? 'dumbbell' : o.load);
    return { view: 'front', anchor: 'feet', at: [100, FY], props,
      frames: [{ ab: 84, fb: 94, lb: 5 }, { ab: 24, fb: -18, lb: 5 }] };
  },
  crunch(o) {
    if (o.opt.reverse) {
      return { anchor: 'hip', at: [112, 150], props: [],
        frames: [{ torso: -92, th: 140, sn: 40, ua: 88, fa: 88 }, { torso: -88, th: 190, sn: 120, ua: 88, fa: 88 }] };
    }
    if (o.opt.vup) {
      return { anchor: 'hip', at: [100, 150], props: [],
        frames: [{ torso: -92, th: 92, sn: 92, ua: -92, fa: -92 }, { torso: -140, th: 140, sn: 140, ua: 140, fa: 140 }] };
    }
    if (o.load === 'cable') {
      return { anchor: 'knee', at: [100, 152], props: [{ t: 'pulley', x: 104, y: -40 }],
        frames: [{ torso: 175, th: 0, sn: -90, ft: -90, ua: 170, fa: -20 }, { torso: 95, th: 0, sn: -90, ft: -90, ua: 120, fa: -60 }] };
    }
    const top = o.opt.situp ? -168 : -128;
    return { anchor: 'hip', at: [112, 150], props: o.load === 'machine' ? [] : handProp(o.load === 'ball' ? 'ball' : 'none'),
      frames: [{ torso: -92, th: 142, sn: 22, ua: 84, fa: 84 }, { torso: top, th: 142, sn: 22, ua: o.opt.situp ? 82 : 58, fa: o.opt.situp ? 82 : 58 }] };
  },
  legraise(o) {
    if (o.opt.hanging) {
      const B = o.opt.knee ? { th: 100, sn: 8 } : { th: 92, sn: 92 };
      return { anchor: 'hands', at: [100, -26], props: [{ t: 'bar', x: 100, y: -26 }],
        frames: [{ torso: 180, ua: 180, fa: 180, th: 0, sn: 0, ft: 90 }, { torso: 176, ua: 180, fa: 180, ...B }] };
    }
    return { anchor: 'hip', at: [110, 150], props: [],
      frames: [{ torso: -92, ua: 88, fa: 88, th: 94, sn: 94, ft: 180 }, { torso: -92, ua: 88, fa: 88, th: 176, sn: 176, ft: 266 }] };
  },
  plank() {
    return { anchor: 'toes', at: [40, FY], fix: 'el', fixY: 152, props: [], dur: 1600, hold: 600,
      frames: [{ torso: 99, th: -81, sn: -81, ft: 8, ua: 2, fa: 92, hand: 92 }, { torso: 101, th: -79, sn: -79, ft: 8, ua: 2, fa: 92, hand: 92 }] };
  },
  climber() {
    return { anchor: 'toes', at: [42, FY], fix: 'wr', props: [], dur: 380, hold: 60,
      frames: [{ torso: 101, th: [-79, -79], sn: [-79, -79], ft: [8, 8], ua: 2, fa: 2, hand: 92 }, { torso: 101, th: [40, -79], sn: [-55, -79], ft: [30, 8], ua: 2, fa: 2, hand: 92 }] };
  },
  flutter() {
    return { anchor: 'hip', at: [110, 150], props: [], dur: 380, hold: 40,
      frames: [{ torso: -92, ua: 88, fa: 88, th: [118, 138], sn: [118, 138], ft: [200, 220] }, { torso: -92, ua: 88, fa: 88, th: [138, 118], sn: [138, 118], ft: [220, 200] }] };
  },
  twist(o) {
    return { view: 'front', anchor: 'feet', at: [100, FY], props: handProp(o.load === 'none' ? 'ball' : o.load === 'cable' ? 'none' : o.load), dur: 700,
      frames: [{ tl: -6, ab: [52, -18], fb: [30, -40] }, { tl: 6, ab: [-18, 52], fb: [-40, 30] }] };
  },
  sidebend(o) {
    return { view: 'front', anchor: 'feet', at: [100, FY], props: handProp(o.load === 'none' ? 'dumbbell' : o.load),
      frames: [{ tl: 0, ab: [6, 6], fb: [4, 4] }, { tl: 20, ab: [8, 16], fb: [6, 12] }] };
  },
  rollout() {
    return { anchor: 'knee', at: [70, 152], fix: 'wr', fixY: 150, props: [{ t: 'wheel' }],
      frames: [{ torso: 140, th: -30, sn: -92, ft: -92, ua: 30, fa: 30 }, { torso: 102, th: -76, sn: -92, ft: -92, ua: 98, fa: 98 }] };
  },
  kbswing(o) {
    return { anchor: 'feet', at: [96, FY], props: handProp(o.load === 'none' ? 'kettlebell' : o.load), dur: 650, hold: 80,
      frames: [{ torso: 112, th: 28, sn: -16, ft: 90, ua: -22, fa: -22 }, { torso: 180, th: 0, sn: 0, ft: 90, ua: 92, fa: 95 }] };
  },
  clean(o) {
    return { anchor: 'feet', at: [96, FY], props: handProp(o.load === 'none' ? 'barbell' : o.load), dur: 600, hold: 220,
      frames: [{ torso: 122, th: 70, sn: -27, ft: 90, ua: -2, fa: -2 }, { torso: 186, th: -4, sn: 0, ft: 60, ua: -8, fa: 10, y: -4 }, { torso: 172, th: 34, sn: -18, ft: 90, ua: 78, fa: 168 }] };
  },
  snatch(o) {
    return { anchor: 'feet', at: [96, FY], props: handProp(o.load === 'none' ? 'barbell' : o.load), dur: 650, hold: 220,
      frames: [{ torso: 122, th: 70, sn: -27, ft: 90, ua: -2, fa: -2 }, { torso: 186, th: -4, sn: 0, ft: 60, ua: 30, fa: 60, y: -4 }, { torso: 162, th: 72, sn: -30, ft: 90, ua: 166, fa: 170 }] };
  },
  jump() {
    return { anchor: 'feet', at: [100, FY], props: [], dur: 380, hold: 60, loop: 'cycle',
      frames: [{ ...STAND }, { torso: 140, th: 74, sn: -32, ft: 90, ua: -40, fa: -40 }, { torso: 182, th: -4, sn: -4, ft: 40, ua: 162, fa: 166, y: -30 }, { torso: 150, th: 60, sn: -26, ft: 90, ua: 30, fa: 30 }] };
  },
  jack() {
    return { view: 'front', anchor: 'feet', at: [100, FY], props: [], dur: 340, hold: 60,
      frames: [{ ab: 6, fb: 6, lb: 3, y: 0 }, { ab: 166, fb: 170, lb: 17, y: -6 }] };
  },
  run(o) {
    return { anchor: 'hip', at: [100, 84], props: o.opt.treadmill ? [{ t: 'rail', x1: 40, x2: 165 }] : [], dur: 360, hold: 0,
      frames: [
        { torso: 172, th: [40, -26], sn: [-28, -82], ft: [70, 10], ua: [-36, 34], fa: [62, 104] },
        { torso: 172, th: [-26, 40], sn: [-82, -28], ft: [10, 70], ua: [34, -36], fa: [104, 62] },
      ] };
  },
  walk(o) {
    return { anchor: 'hip', at: [100, 80], props: handProp(o.load === 'none' ? 'dumbbell' : o.load), dur: 560, hold: 0,
      frames: [
        { torso: 180, th: [20, -14], sn: [-4, -26], ft: [94, 64], ua: 0, fa: 0 },
        { torso: 180, th: [-14, 20], sn: [-26, -4], ft: [64, 94], ua: 0, fa: 0 },
      ] };
  },
  sled() {
    return { anchor: 'hip', at: [96, 94], props: [{ t: 'box', x: 152, y: 110, w: 28 }], dur: 520, hold: 0,
      frames: [
        { torso: 128, th: [62, -30], sn: [-30, -40], ft: [80, 40], ua: 108, fa: 98 },
        { torso: 128, th: [-30, 62], sn: [-40, -30], ft: [40, 80], ua: 108, fa: 98 },
      ] };
  },
  bike() {
    const hip = [86, 92], c = [116, 140], r = 13;
    const frames = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = (k / 6) * Math.PI * 2;
      const p0 = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
      const p1 = [c[0] - Math.cos(a) * r, c[1] - Math.sin(a) * r];
      const [t0, s0] = ik(hip, p0);
      const [t1, s1] = ik(hip, p1);
      return { torso: 142, ua: 112, fa: 100, th: [t0, t1], sn: [s0, s1], ft: [s0 + 95, s1 + 95] };
    });
    return { anchor: 'hip', at: hip, props: [{ t: 'bike', x: c[0], y: c[1], sx: hip[0], sy: hip[1] + 8, hx: 140, hy: 70 }], frames, loop: 'cycle', dur: 160, hold: 0 };
  },
  rowmachine() {
    return { anchor: 'hip', at: [92, 142], props: [{ t: 'rail', x1: 40, x2: 190 }], dur: 800, hold: 120,
      frames: [
        { x: -18, torso: 146, th: 150, sn: 46, ft: 136, ua: 118, fa: 110 },
        { x: 14, torso: 200, th: 96, sn: 92, ft: 182, ua: -34, fa: 84 },
      ] };
  },
  rope() {
    return { anchor: 'feet', at: [100, FY], props: [], dur: 260, hold: 0,
      frames: [{ ...STAND, ua: 10, fa: 60, ft: 70, y: 0 }, { ...STAND, ua: 12, fa: 70, ft: 50, y: -10 }] };
  },
  hipflex(o) {
    return { anchor: 'feet', at: [100, FY], props: o.load === 'cable' ? [{ t: 'pulley', x: 50, y: 156 }] : [],
      frames: [{ ...STAND, th: [0, 0], sn: [0, 0] }, { ...STAND, th: [95, 0], sn: [2, 0], ft: [90, 90] }] };
  },
  abduction(o) {
    if (o.opt.machine || o.load === 'machine') {
      return { anchor: 'hip', at: SEAT_HIP, props: [...seatProps()],
        cam: 70, frames: [{ torso: 176, th: 90, sn: 0, ft: 90, ua: 10, fa: 40, lab: 2 }, { torso: 176, th: 90, sn: 0, ft: 90, ua: 10, fa: 40, lab: 34 }] };
    }
    return { view: 'front', anchor: 'feet', at: [100, FY], props: o.load === 'cable' || o.load === 'band' ? [{ t: 'pulley', x: 60, y: 156 }] : [],
      frames: [{ ab: [20, 6], fb: [10, 6], lb: [3, 3] }, { ab: [20, 6], fb: [10, 6], lb: [3, 38], sb: [3, 38] }] };
  },
  adduction(o) {
    if (o.opt.machine || o.load === 'machine') {
      return { anchor: 'hip', at: SEAT_HIP, props: [...seatProps()],
        cam: 70, frames: [{ torso: 176, th: 90, sn: 0, ft: 90, ua: 10, fa: 40, lab: 32 }, { torso: 176, th: 90, sn: 0, ft: 90, ua: 10, fa: 40, lab: 2 }] };
    }
    return { view: 'front', anchor: 'feet', at: [100, FY], props: o.load === 'cable' || o.load === 'band' ? [{ t: 'pulley', x: 10, y: 156 }] : [],
      frames: [{ ab: [20, 6], fb: [10, 6], lb: [3, 32], sb: [3, 32] }, { ab: [20, 6], fb: [10, 6], lb: [3, -8], sb: [3, -8] }] };
  },
  mbthrow(o) {
    if (o.opt.slam) {
      return { anchor: 'feet', at: [96, FY], props: [{ t: 'ball' }], dur: 600,
        frames: [{ ...STAND, torso: 186, ua: 172, fa: 176 }, { torso: 118, th: 30, sn: -16, ft: 90, ua: 62, fa: 62 }] };
    }
    if (o.opt.overhead) {
      return { anchor: 'feet', at: [96, FY], props: [{ t: 'ball' }], dur: 600,
        frames: [{ ...STAND, torso: 192, ua: -165, fa: -160 }, { ...STAND, torso: 170, ua: 120, fa: 115 }] };
    }
    return { anchor: 'feet', at: [92, FY], props: [{ t: 'ball' }], dur: 600,
      frames: [{ ...STAND, ua: 28, fa: 160 }, { ...STAND, torso: 172, ua: 92, fa: 92 }] };
  },
  roll(o) {
    const m = o.muscle;
    if (m === 'Quadricipiti' || m === 'Adduttori' || m === 'Abduttori') {
      return { anchor: 'hip', at: [100, 138], props: [{ t: 'roller', j: 'thigh' }], dur: 1200,
        frames: [{ torso: 96, th: -88, sn: -88, ft: -20, ua: 2, fa: 92, x: 0 }, { torso: 96, th: -88, sn: -88, ft: -20, ua: 2, fa: 92, x: -16 }] };
    }
    if (m === 'Polpacci' || m === 'Femorali' || m === 'Glutei') {
      return { anchor: 'hip', at: [70, 136], props: [{ t: 'roller', j: m === 'Polpacci' ? 'shin' : 'thigh' }], dur: 1200,
        frames: [{ torso: -150, th: 90, sn: 90, ft: 170, ua: -30, fa: -28, x: 0 }, { torso: -150, th: 90, sn: 90, ft: 170, ua: -30, fa: -28, x: -14 }] };
    }
    return { anchor: 'hip', at: [104, 132], props: [{ t: 'roller', j: 'torso' }], dur: 1200,
      frames: [{ torso: -98, th: 122, sn: 14, ua: 70, fa: 160, x: 0 }, { torso: -98, th: 122, sn: 14, ua: 70, fa: 160, x: 14 }] };
  },
  neck() {
    return { anchor: 'feet', at: [100, FY], props: [], hl: ['neck'], dur: 1300,
      frames: [{ ...STAND, head: -22 }, { ...STAND, head: 28 }] };
  },
  stretch(o) {
    const breathe = (a, b) => ({ dur: 1800, hold: 700, frames: [a, b] });
    switch (o.muscle) {
      case 'Quadricipiti':
        return { anchor: 'feet', at: [100, FY], props: [], ...breathe(
          { ...STAND, th: [0, -6], sn: [0, -158], ft: [90, -70], ua: [90, -22], fa: [90, -150] },
          { ...STAND, th: [0, -14], sn: [0, -164], ft: [90, -76], ua: [92, -26], fa: [92, -156] }) };
      case 'Polpacci':
        return { anchor: 'feet', at: [126, FY], props: [{ t: 'wall', x: 168 }], ...breathe(
          { torso: 152, th: [30, -24], sn: [-8, -24], ft: [90, 66], ua: 98, fa: 94 },
          { torso: 148, th: [36, -28], sn: [-12, -28], ft: [90, 62], ua: 100, fa: 96 }) };
      case 'Petto': case 'Bicipiti':
        return { anchor: 'feet', at: [100, FY], props: [], ...breathe({ ...STAND, ua: -92, fa: -92 }, { ...STAND, torso: 176, ua: -108, fa: -108 }) };
      case 'Spalle': case 'Trapezi':
        return { view: 'front', anchor: 'feet', at: [100, FY], props: [], hl: o.muscle === 'Trapezi' ? ['trap', 'neck'] : undefined, ...breathe(
          { ab: [-70, 30], fb: [-78, -60], lb: 4, head: o.muscle === 'Trapezi' ? 0 : 0 },
          { ab: [-82, 34], fb: [-90, -66], lb: 4, head: 0 }) };
      case 'Tricipiti':
        return { anchor: 'feet', at: [100, FY], props: [], ...breathe({ ...STAND, ua: [172, 150], fa: [-12, -150] }, { ...STAND, ua: [178, 156], fa: [-6, -156] }) };
      case 'Dorso': case 'Lombari':
        return { anchor: 'knee', at: [92, 152], props: [], ...breathe(
          { torso: 74, th: 60, sn: -92, ft: -92, ua: 94, fa: 94 },
          { torso: 82, th: 64, sn: -92, ft: -92, ua: 96, fa: 96 }) };
      case 'Glutei': case 'Abduttori':
        return { anchor: 'hip', at: [112, 150], props: [], ...breathe(
          { torso: -92, th: [136, 172], sn: [60, 84], ua: 88, fa: 88 },
          { torso: -92, th: [150, 182], sn: [70, 92], ua: 88, fa: 88 }) };
      case 'Adduttori':
        return { view: 'front', anchor: 'feet', at: [100, FY], props: [], ...breathe(
          { ab: 30, fb: 8, lb: 32, sb: 16 }, { ab: 34, fb: 6, lb: 40, sb: 18 }) };
      case 'Addome':
        return { anchor: 'hip', at: [104, 150], props: [], ...breathe(
          { torso: 116, th: -90, sn: -90, ft: -178, ua: 6, fa: 4 }, { torso: 126, th: -90, sn: -90, ft: -178, ua: 8, fa: 2 }) };
      case 'Collo':
        return { anchor: 'feet', at: [100, FY], props: [], hl: ['neck'], ...breathe({ ...STAND, head: 18 }, { ...STAND, head: 34 }) };
      case 'Avambracci':
        return { anchor: 'feet', at: [100, FY], props: [], ...breathe(
          { ...STAND, ua: [90, 70], fa: [90, 112], hand: [140, 112] }, { ...STAND, ua: [90, 72], fa: [90, 116], hand: [160, 116] }) };
      default: // femorali e generico: piegamento in avanti
        return { anchor: 'feet', at: [96, FY], props: [], ...breathe({ ...STAND, torso: 46, th: 2 }, { ...STAND, torso: 32, th: 4 }) };
    }
  },
};

const FALLBACK = {
  Petto: 'bench', Dorso: 'row', Lombari: 'backext', Spalle: 'ohpress', Bicipiti: 'curl', Tricipiti: 'pushdown',
  Avambracci: 'wristcurl', Trapezi: 'shrug', Collo: 'neck', Quadricipiti: 'squat', Femorali: 'legcurl', Glutei: 'hipthrust',
  Abduttori: 'abduction', Adduttori: 'adduction', Polpacci: 'calf', Addome: 'crunch', Cardio: 'run', Altro: 'squat',
};

export const HL = {
  Petto: ['chest'], Dorso: ['chest', 'belly'], Lombari: ['belly'], Spalle: ['delt'], Trapezi: ['trap', 'neck'],
  Bicipiti: ['upper'], Tricipiti: ['upper'], Avambracci: ['fore'], Collo: ['neck'],
  Quadricipiti: ['thigh'], Femorali: ['thigh'], Glutei: ['glute', 'thighTop'], Abduttori: ['glute'], Adduttori: ['thigh'],
  Polpacci: ['shin'], Addome: ['belly'], Cardio: ['thigh', 'shin'], Altro: [],
};

/** "bench:incline,one" → { key, opt } */
export function parseMove(move) {
  const [key, opts = ''] = (move || '').split(':');
  const opt = {};
  for (const o of opts.split(',').filter(Boolean)) opt[o] = true;
  return { key, opt };
}

/**
 * Presa delle mani: prona (palmi giù/avanti), supina, neutra (palmi uno verso l'altro),
 * pollici in avanti, palmo a terra… più la forma delle dita e la larghezza sull'impugnatura.
 */
function gripOf(key, opt, ex, spec) {
  const n = (ex.name || '').toLowerCase();
  const load = loadOf(ex);
  const holds = (spec.props || []).some((p) => ['barbell', 'dumbbell', 'kettlebell', 'pulley', 'bar', 'wheel'].includes(p.t));
  const ball = (spec.props || []).some((p) => p.t === 'ball');
  const shape = holds || ['machine', 'cable'].includes(load) ? 'wrap' : ball ? 'open' : 'relax';
  const g = (type, extra = {}) => ({ type, shape, ...extra });
  const db = load === 'dumbbell';
  const supName = /underhand|reverse[- ]grip|supinat|palms[- ]up/.test(n);
  const neutralName = /hammer|neutral|palms[- ](facing )?in|parallel|v-bar|rope/.test(n);
  switch (key) {
    case 'pushup': case 'climber': return { type: 'flat', shape: 'flat', wristMax: 1.75 };
    case 'plank': return { type: 'neutral', shape: 'fist' };
    case 'dip': return { type: 'fwd', shape: 'wrap', w: 0.24 };
    case 'pullup':
      if (opt.chin || /chin/.test(n)) return { type: 'sup', shape: 'wrap', w: 0.17 };
      if (neutralName) return { type: 'neutral', shape: 'wrap', w: 0.2 };
      return { type: 'pron', shape: 'wrap', w: /wide/.test(n) ? 0.34 : 0.27 };
    case 'legraise': return opt.hanging ? { type: 'pron', shape: 'wrap', w: 0.25 } : g('neutral', { shape: 'relax' });
    case 'curl':
      if (opt.hammer || neutralName || /cross body/.test(n)) return g('neutral');
      if (opt.reverse || /reverse/.test(n)) return g('pron');
      return g('sup');
    case 'wristcurl': return g(/palms-down|reverse/.test(n) ? 'pron' : 'sup', { wristMax: 1.6 });
    case 'row':
      if (supName) return g('sup');
      if (db || load === 'kettlebell' || load === 'cable' || /t-bar|palms in/.test(n) || opt.one) return g('neutral');
      return g('pron');
    case 'seatedrow': return g(/wide/.test(n) ? 'pron' : 'neutral');
    case 'pulldown':
      if (supName) return g('sup');
      if (/close|v-bar|neutral/.test(n)) return g('neutral');
      return g('pron');
    case 'bench':
      if (neutralName) return g('neutral');
      if (supName) return g('sup');
      return g('pron');
    case 'fly': case 'flylying': case 'rotation': case 'reardelt': return g('up', { shape: 'wrap' });
    case 'latraise': return g('fwd');
    case 'frontraise': return g(/plate/.test(n) ? 'neutral' : 'pron');
    case 'ohpress': return g(neutralName ? 'neutral' : 'pron');
    case 'ohext': case 'skull': return g(load === 'barbell' ? 'pron' : 'neutral');
    case 'pushdown': return g(neutralName ? 'neutral' : supName ? 'sup' : 'pron');
    case 'kickback': case 'facepull': case 'pullover': return g('neutral');
    case 'straightarm': case 'rollout': case 'rowmachine': case 'bike': return g('pron');
    case 'squat': return spec.props.some((p) => p.at === 'back') ? g('pron', { w: 0.27 }) : g(db ? 'neutral' : 'pron');
    case 'hipthrust': return g('pron', { w: 0.3 });
    default:
      if (load === 'barbell' || load === 'kettlebell') return g(spec.props.some((p) => p.at === 'back') ? 'pron' : 'pron', { w: 0.27 });
      return g('neutral');
  }
}

/** Specifica di animazione per un esercizio */
export function specFor(ex) {
  const { key, opt } = parseMove(ex.move);
  const k = M[key] ? key : FALLBACK[ex.muscle] || 'squat';
  const spec = M[k]({ opt, load: loadOf(ex), muscle: ex.muscle });
  if (!spec.hl) {
    spec.hl = HL[ex.muscle] || [];
    spec.hl2 = (ex.secondary || []).flatMap((m) => HL[m] || []).filter((s) => !spec.hl.includes(s));
  }
  spec.key = k;
  spec.grip = gripOf(k, opt, ex, spec);
  // impugnature dei cavi e mani sulla stessa maniglia
  const pulley = (spec.props || []).find((p) => p.t === 'pulley');
  if (pulley && !pulley.both) {
    const n = (ex.name || '').toLowerCase();
    const rope = /rope|corda/.test(n) || (spec.grip.type === 'neutral' && ['pushdown', 'facepull', 'ohext', 'crunch'].includes(k));
    const single = opt.one || /one[- ]arm|single/.test(n) || ['bench', 'ohpress', 'latraise', 'frontraise', 'kickback', 'woodchop', 'rotation'].includes(k);
    pulley.h = single ? 'd' : rope ? 'rope' : spec.grip.type === 'neutral' ? 'v' : 'bar';
    if (!single) spec.grip.span = rope ? (k === 'facepull' ? 0.09 : 0.05) : pulley.h === 'v' ? 0.05
      : { pulldown: /close/.test(n) ? 0.16 : 0.36, pushdown: 0.12, straightarm: 0.24, curl: 0.16, seatedrow: 0.3, row: 0.2, uprightrow: 0.1 }[k] ?? 0.18;
  } else if (pulley?.both) pulley.h = 'd';
  const twoOnOne = (spec.props || []).some((p) => p.t === 'kettlebell') && k !== 'row';
  if (twoOnOne) spec.grip.span = 0.045;
  if ((spec.props || []).some((p) => p.t === 'ball')) Object.assign(spec.grip, { span: 0.12, shape: 'open', type: 'neutral' });
  if ((spec.props || []).some((p) => p.t === 'wheel')) Object.assign(spec.grip, { span: 0.09, shape: 'wrap', type: 'pron' });
  if (k === 'squat' && /goblet/.test((ex.name || '').toLowerCase() + (ex.move || ''))) spec.grip.span = 0.06;
  // Arnold press: parte con i palmi verso di sé e ruota durante la spinta
  if (/arnold/i.test(ex.name || '')) spec.frames = spec.frames.map((f, i) => ({ ...f, roll: i === 0 ? 160 : 0 }));
  spec.opts = (ex.move || '').split(':')[1] || '';
  spec.muscle = ex.muscle;
  spec.secondary = ex.secondary || [];
  return spec;
}

export const MOVE_KEYS = Object.keys(M);
