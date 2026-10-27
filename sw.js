/**
 * Offline keş (bölmə 6.2). İlk açılışda (internet lazımdır) bütün fayllar keşə yazılır,
 * sonra sayt internetsiz də açılır. Strategiya: cache-first. Google Sheets sorğularına toxunulmur.
 *
 * PRECACHE və VERSION əl ilə yazılmır: `node tools/update-sw.mjs` faylları tapıb bu bloku yeniləyir.
 * Fayllardan biri dəyişəndə VERSION da dəyişir → kiosk yeni versiyanı yükləyir, köhnə keş silinir.
 */

// <precache> — tools/update-sw.mjs tərəfindən yaradılır, əl ilə dəyişməyin
const VERSION = '7a78d2fd9374';
const PRECACHE = [
  './assets/brand/airex-logo.svg',
  './assets/cities/baku/board.svg',
  './assets/cities/baku/full.webp',
  './assets/cities/baku/pieces/piece-00.svg',
  './assets/cities/baku/pieces/piece-01.svg',
  './assets/cities/baku/pieces/piece-02.svg',
  './assets/cities/baku/pieces/piece-03.svg',
  './assets/cities/baku/pieces/piece-04.svg',
  './assets/cities/baku/pieces/piece-05.svg',
  './assets/cities/baku/pieces/piece-06.svg',
  './assets/cities/baku/pieces/piece-07.svg',
  './assets/cities/baku/pieces/piece-08.svg',
  './assets/cities/baku/pieces/piece-09.svg',
  './assets/cities/baku/pieces/piece-10.svg',
  './assets/cities/baku/pieces/piece-11.svg',
  './assets/fonts/Inter-Bold.woff2',
  './assets/fonts/Inter-ExtraBold.woff2',
  './assets/fonts/Inter-Medium.woff2',
  './assets/fonts/Inter-Regular.woff2',
  './assets/fonts/Inter-SemiBold.woff2',
  './assets/icons/error-x.svg',
  './assets/icons/rule-puzzle.svg',
  './assets/icons/rule-tap.svg',
  './assets/icons/rule-timer.svg',
  './css/fonts.css',
  './css/game.css',
  './css/layout.css',
  './css/reset.css',
  './css/results.css',
  './css/tokens.css',
  './',
  './js/app/PuzzleApp.js',
  './js/config.js',
  './js/core/Emitter.js',
  './js/core/Timer.js',
  './js/core/assets.js',
  './js/core/env.js',
  './js/core/shuffle.js',
  './js/core/storage.js',
  './js/core/sw-register.js',
  './js/core/sync.js',
  './js/core/tap.js',
  './js/game/BoardView.js',
  './js/game/GameEngine.js',
  './js/game/TrayView.js',
  './js/game/animations.js',
  './js/main.js',
  './js/results/ResultsPage.js',
  './js/results/main.js',
  './result/',
  './vendor/modern-normalize.css',
];
// </precache>

const CACHE_PREFIX = 'city-puzzle-';
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // HTTP keşini keç: hər versiyada faylların ən təzəsi yazılsın
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Google Sheets və s. — həmişə şəbəkə

  event.respondWith(fromCache(request, url));
});

/**
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function fromCache(request, url) {
  const cache = await caches.open(CACHE_NAME);

  // Səhifə açılışı: ?dev kimi parametrlər də keşdəki səhifəyə düşsün
  if (request.mode === 'navigate') {
    // /result → /result/ (GitHub Pages da belə edir): yoxsa səhifədəki ../css yolları alt qovluqda qırılır
    if (url.pathname.endsWith('/result')) return Response.redirect(`${url.pathname}/${url.search}`, 301);
    const page = /\/result\/(index\.html)?$/.test(url.pathname) ? './result/' : './';
    const cached = await cache.match(new URL(page, self.registration.scope));
    if (cached) return cached;
  }

  const cached = await cache.match(request, { ignoreSearch: true });
  return cached ?? fetch(request);
}
