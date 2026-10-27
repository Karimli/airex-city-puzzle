/**
 * Ən yaxşı vaxtın və oyun nəticələrinin saxlanması (bölmə 2.4). `localStorage` əlçatmaz olsa da oyun işləyir.
 * Gələcəkdə server əlavə olunarsa: əvvəl buraya lokal yazılır, sonra outbox ilə göndərilir (bölmə 6.2).
 * Angular-da: `@Injectable` StorageService.
 * @module core/storage
 */

const APP_PREFIX = 'airex.cityPuzzle.';
const BEST_PREFIX = `${APP_PREFIX}best.`;
const RESULTS_PREFIX = `${APP_PREFIX}results.`;
/** Ən köhnələr silinir ki, localStorage limiti (≈5 MB) dolmasın */
const MAX_RESULTS = 10000;

/**
 * @typedef {Object} GameResult
 * @property {number} at  Oyunun bitdiyi an (epoch ms)
 * @property {number} ms  Oyun müddəti (ms)
 */

/**
 * @param {string} cityId
 * @returns {number | null}  Ən yaxşı vaxt (ms) və ya rekord yoxdursa null
 */
export function getBestTime(cityId) {
  try {
    const raw = globalThis.localStorage?.getItem(BEST_PREFIX + cityId);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} cityId
 * @param {number} ms
 * @returns {boolean}  Yazılıbsa true
 */
export function setBestTime(cityId, ms) {
  try {
    globalThis.localStorage?.setItem(BEST_PREFIX + cityId, String(Math.round(ms)));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} cityId
 * @returns {GameResult[]}  Saxlanma sırası ilə (köhnədən yeniyə)
 */
export function getResults(cityId) {
  try {
    const raw = globalThis.localStorage?.getItem(RESULTS_PREFIX + cityId);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((r) => Number.isFinite(r?.at) && Number.isFinite(r?.ms))
      : [];
  } catch {
    return [];
  }
}

/**
 * Bitmiş oyunun nəticəsini jurnala əlavə edir.
 * @param {string} cityId
 * @param {GameResult} result
 * @returns {boolean}  Yazılıbsa true
 */
export function addResult(cityId, result) {
  try {
    const list = getResults(cityId);
    list.push({ at: Math.round(result.at), ms: Math.round(result.ms) });
    globalThis.localStorage?.setItem(RESULTS_PREFIX + cityId, JSON.stringify(list.slice(-MAX_RESULTS)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Oyunun bütün məlumatlarını silir (nəticələr + ən yaxşı vaxt). Başqa saytların açarlarına toxunmur.
 * @returns {boolean}  Silinibsə true
 */
export function clearAllData() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(APP_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
