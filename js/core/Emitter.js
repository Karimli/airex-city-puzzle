/**
 * Sadə event emitter. Angular-da: `Output()` / RxJS `Subject`.
 * @module core/Emitter
 */

/** @template {Record<string, any>} Events */
export class Emitter {
  /** @type {Map<keyof Events, Set<(payload: any) => void>>} */
  #listeners = new Map();

  /**
   * @template {keyof Events} K
   * @param {K} event
   * @param {(payload: Events[K]) => void} listener
   * @returns {() => void}  Abunəliyi ləğv edən funksiya
   */
  on(event, listener) {
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => this.off(event, listener);
  }

  /**
   * @template {keyof Events} K
   * @param {K} event
   * @param {(payload: Events[K]) => void} listener
   */
  off(event, listener) {
    this.#listeners.get(event)?.delete(listener);
  }

  /**
   * @template {keyof Events} K
   * @param {K} event
   * @param {Events[K]} payload
   */
  emit(event, payload) {
    for (const listener of [...(this.#listeners.get(event) ?? [])]) listener(payload);
  }

  /** Bütün listener-ləri silir. */
  clear() {
    this.#listeners.clear();
  }

  /** Test / leak yoxlaması üçün: ümumi listener sayı. */
  get size() {
    let n = 0;
    for (const set of this.#listeners.values()) n += set.size;
    return n;
  }
}
