/**
 * Oyun taymeri (bölmə 2.4). Vaxt `performance.now()` ilə hesablanır, sayğac toplanmır.
 * Ekran `requestAnimationFrame` ilə yenilənir, `onTick` yalnız saniyə dəyişəndə çağırılır.
 * Angular-da: `@Injectable` TimerService.
 * @module core/Timer
 */

/**
 * Millisaniyəni `mm:ss` formatına çevirir. 60 dəqiqədən çox olsa `mm` artmağa davam edir (`75:02`).
 * @param {number | null} ms  null → `--:--`
 * @returns {string}
 */
export function formatTime(ms) {
  if (ms == null) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** @param {number} n */
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Yerli tarix və saat: `dd.mm.yyyy - hh:mm:ss` (nəticələr cədvəli və Google Sheets üçün).
 * @param {Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  const day = `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
  const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  return `${day} - ${clock}`;
}

export class Timer {
  /** @type {(seconds: number) => void} */
  #onTick;
  /** @type {number | null} */
  #startedAt = null;
  #elapsedBeforeStop = 0;
  #rafId = 0;
  #lastSecond = -1;

  /** @param {(seconds: number) => void} onTick  Tam saniyə dəyişəndə çağırılır */
  constructor(onTick) {
    this.#onTick = onTick;
  }

  /** Keçən vaxt (ms). */
  get elapsedMs() {
    return this.#startedAt == null ? this.#elapsedBeforeStop : performance.now() - this.#startedAt;
  }

  get isRunning() {
    return this.#startedAt != null;
  }

  /** 0-dan başladır. */
  start() {
    this.reset();
    this.#startedAt = performance.now();
    this.#rafId = requestAnimationFrame(this.#frame);
  }

  /** Dayandırır, keçən vaxtı saxlayır. */
  stop() {
    if (this.#startedAt == null) return;
    this.#elapsedBeforeStop = performance.now() - this.#startedAt;
    this.#startedAt = null;
    cancelAnimationFrame(this.#rafId);
  }

  /** Dayandırır və sıfırlayır. */
  reset() {
    cancelAnimationFrame(this.#rafId);
    this.#startedAt = null;
    this.#elapsedBeforeStop = 0;
    this.#lastSecond = -1;
    this.#emit(0);
  }

  destroy() {
    cancelAnimationFrame(this.#rafId);
    this.#startedAt = null;
  }

  #frame = () => {
    this.#emit(this.elapsedMs);
    this.#rafId = requestAnimationFrame(this.#frame);
  };

  /** @param {number} ms */
  #emit(ms) {
    const second = Math.floor(ms / 1000);
    if (second === this.#lastSecond) return;
    this.#lastSecond = second;
    this.#onTick(second);
  }
}
