/**
 * Brauzer mühitinə giriş: `window` / `document` yalnız bu modulda istifadə olunur (bölmə 10).
 * @module core/env
 */

/**
 * URL-də query flag olub-olmadığını yoxlayır (məs. `?dev`).
 * @param {string} name
 * @returns {boolean}
 */
export function hasUrlFlag(name) {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}

/**
 * İstifadəçi animasiyaların azaldılmasını istəyirmi (bölmə 7.3).
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Başqa tabda/pəncərədə localStorage dəyişəndə çağırılır (məs. oyun nəticə yazanda).
 * @param {() => void} handler
 * @returns {() => void}  Abunəliyi ləğv edən funksiya
 */
export function onStorageChange(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/**
 * CSS dəyişəninin dəyəri (məs. `--c-accent`) — canvas-da rəngi koda yazmamaq üçün.
 * @param {Element} element
 * @param {string} name
 * @returns {string}
 */
export function readCssVar(element, name) {
  if (typeof window === 'undefined') return '';
  return window.getComputedStyle(element).getPropertyValue(name).trim();
}

/** @returns {number}  Ekranın piksel sıxlığı (canvas üçün, maks. 2) */
export function getPixelRatio() {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Brauzer internetə qoşuludurmu (Sheets-dən rekordu gözləməyə dəyərmi).
 * @returns {boolean}
 */
export function isOnline() {
  return globalThis.navigator?.onLine !== false;
}

/** Səhifəni yenidən yükləyir (Service Worker yeni versiyanı aktivləşdirəndə). */
export function reloadPage() {
  if (typeof window !== 'undefined') window.location.reload();
}

/**
 * Oyunun kök elementini tapır.
 * @param {string} selector
 * @returns {HTMLElement | null}
 */
export function findRoot(selector) {
  if (typeof document === 'undefined') return null;
  return document.querySelector(selector);
}
