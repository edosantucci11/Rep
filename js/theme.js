// Temi: sfondo nero assoluto + un unico colore accento ad alto contrasto.
// I valori CSS sono in css/style.css ([data-theme=...]).
export const THEMES = {
  volt: { name: 'Volt', accent: '#D4FF00' },
  lava: { name: 'Lava', accent: '#FF5A1F' },
  ghiaccio: { name: 'Ghiaccio', accent: '#3DE8FF' },
  fucsia: { name: 'Fucsia', accent: '#FF3D8B' },
  menta: { name: 'Menta', accent: '#2BFFA3' },
  laser: { name: 'Laser', accent: '#FF2D2D' },
  ultra: { name: 'Ultra', accent: '#A98BFF' },
  oro: { name: 'Oro', accent: '#FFC21A' },
  bianco: { name: 'Bianco', accent: '#FFFFFF' },
};

export function applyTheme(key) {
  const k = THEMES[key] ? key : 'volt';
  document.documentElement.dataset.theme = k;
  window.dispatchEvent(new CustomEvent('themechange', { detail: k }));
  try {
    localStorage.setItem('rep-theme', k);
  } catch (e) {
    /* ignora */
  }
}
