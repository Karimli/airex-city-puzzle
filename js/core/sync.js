/**
 * Google Sheets sinxronizasiyası (bölmə 6.2-dəki outbox ideyası).
 * Nəticə əvvəl lokal növbəyə yazılır, sonra göndərilir; internet yoxdursa növbədə qalır və
 * `online` hadisəsində, səhifə açılanda və növbəti oyunda yenidən göndərilir.
 * URL boşdursa heç nə göndərilmir, oyun yalnız lokal işləyir.
 * Angular-da: `@Injectable` SyncService.
 * @module core/sync
 */

import { getOutbox, setOutbox } from './storage.js';

const REQUEST_TIMEOUT_MS = 15000;
const BATCH_SIZE = 200;

/** @returns {string} */
export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Apps Script Web App-ə JSON göndərir. `text/plain` → CORS preflight olmur.
 * @param {string} url
 * @param {unknown} payload
 * @returns {Promise<any>}  Cavab JSON-u (`ok: false` olsa xəta atılır)
 */
async function post(url, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.ok) throw new Error(data?.error ?? 'Naməlum cavab');
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Google Cədvəldəki nəticələri oxuyur (cədvəldəki sıra ilə, köhnədən yeniyə).
 * @param {string} url
 * @returns {Promise<Array<{ local: string, ms: number }>>}  Uğursuz olsa xəta atılır
 */
export async function fetchRemoteResults(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}?action=list`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.ok || !Array.isArray(data.results)) throw new Error(data?.error ?? 'Naməlum cavab');
    return data.results
      .map((/** @type {any} */ r) => ({ local: String(r.local ?? ''), ms: Number(r.ms) }))
      .filter((r) => r.local && Number.isFinite(r.ms) && r.ms > 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Google Cədvəldəki bütün nəticələri silir.
 * @param {string} url
 * @returns {Promise<void>}  Uğursuz olsa xəta atılır
 */
export async function resetRemote(url) {
  await post(url, { action: 'reset' });
}

export class ResultSync {
  #url;
  /** @type {Promise<void> | null} */
  #flushing = null;
  #flushAgain = false;

  /** @param {string} url  Apps Script Web App URL (boş → söndürülüb) */
  constructor(url) {
    this.#url = url;
  }

  get enabled() {
    return Boolean(this.#url);
  }

  /** `online` hadisəsinə qulaq asır və növbədə qalanları göndərir. */
  mount() {
    if (!this.enabled || typeof window === 'undefined') return;
    window.addEventListener('online', this.#onOnline);
    this.flush();
  }

  destroy() {
    if (typeof window !== 'undefined') window.removeEventListener('online', this.#onOnline);
  }

  /**
   * Nəticəni növbəyə əlavə edir və göndərməyə çalışır.
   * @param {import('./storage.js').OutboxItem} item
   */
  queue(item) {
    if (!this.enabled) return;
    setOutbox([...getOutbox(), item]);
    this.flush();
  }

  /**
   * Növbəni göndərir. Eyni anda yalnız bir sorğu gedir; gedərkən yeni nəticə gəlsə, bitəndən sonra təkrarlanır.
   * Xətalar udulur (növbədə qalır), konsola yazılmır — internetin olmaması normal haldır.
   * @returns {Promise<void>}
   */
  flush() {
    if (!this.enabled) return Promise.resolve();
    if (this.#flushing) {
      this.#flushAgain = true;
      return this.#flushing;
    }
    this.#flushing = this.#send()
      .catch(() => {})
      .finally(() => {
        this.#flushing = null;
        if (this.#flushAgain) {
          this.#flushAgain = false;
          this.flush();
        }
      });
    return this.#flushing;
  }

  async #send() {
    const batch = getOutbox().slice(0, BATCH_SIZE);
    if (!batch.length) return;

    const data = await post(this.#url, { results: batch });
    const accepted = new Set(Array.isArray(data.accepted) ? data.accepted.map(String) : []);
    // Göndərmə zamanı növbəyə yeni nəticə düşə bilər: yalnız qəbul olunanları sil
    setOutbox(getOutbox().filter((item) => !accepted.has(item.id)));
    if (accepted.size && getOutbox().length) this.#flushAgain = true;
  }

  #onOnline = () => {
    this.flush();
  };
}
