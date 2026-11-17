// Battito di un allenamento: grafico con le zone di frequenza cardiaca e tempo passato in ciascuna.
// Le zone sono percentuali della frequenza massima, stimata dall'età (208 − 0,7 × età).
import { state } from './store.js';
import { I } from './icons.js';
import { t, tn } from './i18n.js';

export const ZONES = [
  { name: t('Riscaldamento'), from: 0, to: 0.6, color: '#8e9aaf' },
  { name: t('Brucia grassi'), from: 0.6, to: 0.7, color: '#3ec7ff' },
  { name: t('Aerobica'), from: 0.7, to: 0.8, color: '#3dd68c' },
  { name: t('Soglia'), from: 0.8, to: 0.9, color: '#ffb340' },
  { name: t('Massima'), from: 0.9, to: Infinity, color: '#ff4d5e' },
];

export const maxHr = () => Math.round(208 - 0.7 * (state.settings.age || 30));

const zoneOf = (bpm, max) => ZONES.findIndex((z) => bpm / max < z.to);

/** Secondi passati in ogni zona, dai punti della curva [secondi dall'inizio, bpm] */
export function zoneTimes(curve, duration) {
  const max = maxHr();
  const out = ZONES.map(() => 0);
  curve.forEach(([sec, bpm], i) => {
    const next = i + 1 < curve.length ? curve[i + 1][0] : duration;
    out[zoneOf(bpm, max)] += Math.max(0, next - sec);
  });
  return out;
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Sezione battito: medie, grafico con le fasce delle zone, tempo in ogni zona */
export function hrSection(w) {
  const { avg, max, min, curve = [] } = w.hr;
  const dur = Math.max(1, (w.end - w.start) / 1000);
  const hrMax = maxHr();
  const lo = Math.min(...curve.map((c) => c[1]), min) - 6;
  const hi = Math.max(...curve.map((c) => c[1]), max) + 6;
  const y = (bpm) => 100 - ((bpm - lo) / (hi - lo)) * 96;
  const bands = ZONES.map((z) => {
    const top = Math.min(hi, z.to * hrMax), bottom = Math.max(lo, z.from * hrMax);
    return top > bottom ? `<rect x="0" width="300" y="${y(top).toFixed(1)}" height="${(y(bottom) - y(top)).toFixed(1)}" fill="${z.color}" opacity="0.13"/>` : '';
  }).join('');
  const pts = curve.map(([sec, b]) => `${((sec / dur) * 300).toFixed(1)},${y(b).toFixed(1)}`).join(' ');
  const times = zoneTimes(curve, dur);
  const total = times.reduce((a, b) => a + b, 0) || 1;
  return `
    <div class="hr-head"><span class="hr-ico">${I.heart}</span><b>${t('Battito')}</b><span class="muted xsmall">${t('da Salute')}</span></div>
    <div class="stat-grid"><div class="stat"><b>${avg}</b><span>${t('Media bpm')}</span></div><div class="stat"><b>${max}</b><span>${t('Massimo')}</span></div><div class="stat"><b>${min}</b><span>${t('Minimo')}</span></div></div>
    ${curve.length > 1 ? `<svg class="hr-chart" viewBox="0 0 300 100" preserveAspectRatio="none">${bands}<polyline points="${pts}"/></svg>
    <div class="hr-axis"><span>0:00</span><span>${mmss(dur)}</span></div>` : ''}
    <div class="hr-zones">
      ${ZONES.map((z, k) => ({ z, k })).reverse().map(({ z, k }) => `
      <div class="hr-zone">
        <span class="hz-name"><i style="background:${z.color}"></i>Z${k + 1} ${z.name}</span>
        <span class="hz-bar"><span style="width:${((times[k] / total) * 100).toFixed(1)}%;background:${z.color}"></span></span>
        <span class="hz-time">${mmss(times[k])}</span>
      </div>`).join('')}
      <div class="muted xsmall">${t('Frequenza massima stimata')} ${hrMax} ${t('bpm (dall\'età in Altro › Impostazioni)')}</div>
    </div>`;
}
