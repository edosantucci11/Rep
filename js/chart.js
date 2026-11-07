import { fmtNum, fmtDate } from './utils.js';
import { t, tn } from './i18n.js';

/**
 * Grafico a linee SVG.
 * points: [{x: timestamp, y: number}] ordinati per x
 */
export function lineChart(points, { unit = '', color = 'var(--accent)', height = 200, digits = 1 } = {}) {
  if (!points.length) return `<div class="chart-empty">${t('Nessun dato nel periodo selezionato')}</div>`;
  const W = 340;
  const H = height;
  const padL = 40, padR = 12, padT = 14, padB = 26;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minX === maxX) { minX -= 86400000; maxX += 86400000; }
  if (minY === maxY) { minY = minY - Math.max(1, Math.abs(minY) * 0.1); maxY = maxY + Math.max(1, Math.abs(maxY) * 0.1); }
  const span = maxY - minY;
  minY -= span * 0.08;
  maxY += span * 0.08;
  if (minY < 0 && Math.min(...ys) >= 0) minY = 0;

  const sx = (x) => padL + ((x - minX) / (maxX - minX)) * (W - padL - padR);
  const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * (H - padT - padB);

  const ticks = 4;
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = minY + ((maxY - minY) * i) / ticks;
    const y = sy(v);
    grid += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="chart-grid"/>`;
    grid += `<text x="${padL - 6}" y="${y + 3.5}" class="chart-label" text-anchor="end">${fmtNum(v, span < 10 ? 1 : 0)}</text>`;
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = points.length > 1
    ? `${path} L${sx(points.at(-1).x).toFixed(1)},${H - padB} L${sx(points[0].x).toFixed(1)},${H - padB} Z`
    : '';
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  const dots = points
    .map((p, i) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${points.length > 40 ? 2.5 : 4}" class="chart-dot ${i === points.length - 1 ? 'last' : ''}" style="--i:${i};--n:${points.length}"><title>${fmtDate(p.x)}: ${fmtNum(p.y, digits)} ${unit}</title></circle>`)
    .join('');

  const opt = { day: 'numeric', month: 'short' };
  const xl = `<text x="${padL}" y="${H - 6}" class="chart-label">${fmtDate(xs[0], opt)}</text>
    <text x="${W - padR}" y="${H - 6}" class="chart-label" text-anchor="end">${fmtDate(xs.at(-1), opt)}</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${grid}
    ${area ? `<path class="chart-area" d="${area}" fill="url(#${id})"/>` : ''}
    <path class="chart-line" pathLength="1" d="${path}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${xl}
  </svg>`;
}
