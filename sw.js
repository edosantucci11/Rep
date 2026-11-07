// Service worker: rende l'app disponibile offline.
// Aumenta VERSION a ogni rilascio per aggiornare la cache.
const VERSION = 'rep-v38';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/utils.js',
  './js/ui.js',
  './js/timer.js',
  './js/chart.js',
  './js/picker.js',
  './js/logic.js',
  './js/exercises.js',
  './js/theme.js',
  './js/motion.js',
  './js/icons.js',
  './js/demo.js',
  './js/logo.js',
  './js/mannequin.js',
  './js/thumbs.js',
  './js/onboarding.js',
  './js/moves.js',
  './js/howto.js',
  './js/exguide.js',
  './js/native.js',
  './js/exercise-db.js',
  './data/exercise-details.json',
  './fonts/barlow-condensed-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-700-normal.woff2',
  './fonts/barlow-condensed-latin-800-normal.woff2',
  './fonts/barlow-condensed-latin-900-normal.woff2',
  './fonts/barlow-latin-400-normal.woff2',
  './fonts/barlow-latin-500-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-latin-700-normal.woff2',
  './js/views/home.js',
  './js/views/routine.js',
  './js/views/workout.js',
  './js/views/history.js',
  './js/views/stats.js',
  './js/views/body.js',
  './js/views/tools.js',
  './js/views/help.js',
  './js/hr.js',
  './js/cloud.js',
  './js/drag.js',
  './js/share.js',
  './js/boot.js',
  './js/i18n.js',
  './js/howto-en.js',
  './js/lang/en.js',
  './js/lang/es.js',
  './js/lang/fr.js',
  './js/lang/de.js',
  './js/lang/pt.js',
  './js/musclemap.js',
  './js/intervals.js',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pagina: prima la rete (così gli aggiornamenti arrivano subito), poi la cache se offline.
// Altri file: risposta immediata dalla cache e aggiornamento in background.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      if (isPage) {
        try {
          const res = await fetch(req);
          if (res.ok) cache.put('./index.html', res.clone());
          return res;
        } catch (err) {
          return (await cache.match('./index.html')) || Response.error();
        }
      }
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
