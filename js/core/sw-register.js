/**
 * Service Worker qeydiyyatı (bölmə 6.2). Angular-a keçəndə: `@angular/service-worker`.
 *
 * - localhost / 127.0.0.1-də qeydiyyat edilmir (development zamanı köhnə keş mane olmasın);
 *   lokal yoxlamaq üçün URL-ə `?sw` əlavə edin.
 * - Kiosk tab-ı heç vaxt bağlamır: yeniləmə 30 dəqiqədən bir yoxlanılır.
 * - Yeni versiya aktiv olanda `onUpdateReady` çağırılır (ilk quraşdırmada yox).
 * @module core/sw-register
 */

const UPDATE_CHECK_MS = 30 * 60 * 1000;

/**
 * @param {{ url: string, onUpdateReady?: () => void }} options
 *   url — sw.js-in səhifəyə nisbətən yolu (`./sw.js` və ya `../sw.js`)
 */
export function registerServiceWorker({ url, onUpdateReady }) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) return;

  const { hostname, search } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocal && !new URLSearchParams(search).has('sw')) return;

  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) onUpdateReady?.();
    controlled = true;
  });

  navigator.serviceWorker
    .register(url)
    .then((registration) => {
      setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS);
    })
    .catch(() => {}); // SW olmasa da oyun işləyir
}
