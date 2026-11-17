// Logo dell'app: scritta REP bianca (Barlow Condensed Black convertita in tracciato) su fondo nero.
import { THEMES } from './theme.js';

const WORDMARK = 'M283 -13 222 -264Q220 -269 218 -269Q214 -269 214 -263V-15Q214 -8 210.0 -4.0Q206 0 199 0H41Q34 0 30.0 -4.0Q26 -8 26 -15V-685Q26 -692 30.0 -696.0Q34 -700 41 -700H266Q326 -700 372.5 -671.5Q419 -643 445.0 -592.5Q471 -542 471 -477Q471 -422 452.0 -378.5Q433 -335 397 -308Q393 -305 394 -300L475 -17Q476 -15 476 -12Q476 0 462 0H299Q286 0 283 -13ZM220 -539Q214 -539 214 -533V-418Q214 -412 220 -412H233Q255 -412 269.0 -428.5Q283 -445 283 -475Q283 -506 269.5 -522.5Q256 -539 233 -539ZM866.0 -539H675.0Q669.0 -539 669.0 -533V-437Q669.0 -431 675.0 -431H774.0Q781.0 -431 785.0 -427.0Q789.0 -423 789.0 -416V-285Q789.0 -278 785.0 -274.0Q781.0 -270 774.0 -270H675.0Q669.0 -270 669.0 -264V-167Q669.0 -161 675.0 -161H866.0Q873.0 -161 877.0 -157.0Q881.0 -153 881.0 -146V-15Q881.0 -8 877.0 -4.0Q873.0 0 866.0 0H496.0Q489.0 0 485.0 -4.0Q481.0 -8 481.0 -15V-685Q481.0 -692 485.0 -696.0Q489.0 -700 496.0 -700H866.0Q873.0 -700 877.0 -696.0Q881.0 -692 881.0 -685V-554Q881.0 -547 877.0 -543.0Q873.0 -539 866.0 -539ZM1333.0 -475Q1333.0 -411 1308.5 -362.0Q1284.0 -313 1240.0 -286.5Q1196.0 -260 1138.0 -260H1082.0Q1076.0 -260 1076.0 -254V-15Q1076.0 -8 1072.0 -4.0Q1068.0 0 1061.0 0H903.0Q896.0 0 892.0 -4.0Q888.0 -8 888.0 -15V-685Q888.0 -692 892.0 -696.0Q896.0 -700 903.0 -700H1128.0Q1188.0 -700 1234.5 -671.5Q1281.0 -643 1307.0 -592.0Q1333.0 -541 1333.0 -475ZM1145.0 -471Q1145.0 -504 1131.5 -521.5Q1118.0 -539 1095.0 -539H1082.0Q1076.0 -539 1076.0 -533V-411Q1076.0 -405 1082.0 -405H1095.0Q1118.0 -405 1131.5 -421.5Q1145.0 -438 1145.0 -471Z';
const B = [26, -700, 1333.0, 0]; // xmin, ymin, xmax, ymax

/** SVG del logo (512×512) */
export function logoSVG({ maskable = false, bg = '#000', fg = '#fff' } = {}) {
  const w = maskable ? 300 : 372;
  const s = w / (B[2] - B[0]);
  const h = (B[3] - B[1]) * s;
  const tx = (512 - w) / 2 - B[0] * s;
  const ty = 256 + h / 2 - B[3] * s;
  const rect = maskable
    ? `<rect width="512" height="512" fill="${bg}"/>`
    : `<rect width="512" height="512" rx="116" fill="${bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${rect}<path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})" d="${WORDMARK}" fill="${fg}"/></svg>`;
}

export const svgDataUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
/** Logo ufficiale (nero/bianco) */
export const logoUrl = () => svgDataUrl(logoSVG());
/** Anteprima del tema: scritta nel colore del tema */
export const themePreviewUrl = (themeKey) => svgDataUrl(logoSVG({ fg: (THEMES[themeKey] || THEMES.volt).accent }));

function toPng(svg, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      try {
        resolve(c.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = svgDataUrl(svg);
  });
}

function setLink(rel, href, type) {
  let l = document.querySelector(`link[rel="${rel}"]`);
  if (!l) {
    l = document.createElement('link');
    l.rel = rel;
    document.head.appendChild(l);
  }
  if (type) l.type = type;
  l.href = href;
}

let manifestUrl = null;

let applied = false;
/** Il logo è fisso (nero/bianco): favicon, icona iOS e manifest sono file statici. */
export async function applyAppIcon() {}
