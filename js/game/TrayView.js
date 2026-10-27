/**
 * Tray (bölmə 2): 12 hissənin render-i, seçim və yanlış vəziyyəti.
 * Hissə götürüləndə onun xanası boş qalır, digər hissələr sürüşmür.
 *
 * Quruluş:
 *   .cp-tray
 *     .cp-tray__cell[data-piece-id]   toxunma hədəfi (qonşu hissələrin çıxıntıları üst-üstə düşmür)
 *       .cp-piece                     hissə SVG + ✕ ikonu
 *
 * Angular-da: standalone component.
 * @module game/TrayView
 */

import { onTap } from '../core/tap.js';
import { retriggerClass } from './animations.js';

/**
 * @typedef {Object} TrayPiece
 * @property {string} id
 * @property {string} svgMarkup
 */

export class TrayView {
  /** @type {HTMLElement} */
  #container;
  /** @type {Map<string, string>} */
  #markup;
  #errorIconMarkup;
  #errorResetMs;
  /** @type {(pieceId: string) => void} */
  #onPieceTap;

  /** @type {Map<string, HTMLElement>} pieceId → .cp-tray__cell */
  #cells = new Map();
  /** @type {Map<string, { cancelRaf: () => void, timeoutId: ReturnType<typeof setTimeout> }>} */
  #errorTimers = new Map();
  /** @type {(() => void) | null} */
  #unbindTap = null;

  /**
   * @param {HTMLElement} container  `.cp-tray`
   * @param {{ pieces: TrayPiece[], errorIconMarkup: string, errorResetMs: number, onPieceTap: (pieceId: string) => void }} options
   */
  constructor(container, { pieces, errorIconMarkup, errorResetMs, onPieceTap }) {
    this.#container = container;
    this.#markup = new Map(pieces.map((p) => [p.id, p.svgMarkup]));
    this.#errorIconMarkup = errorIconMarkup;
    this.#errorResetMs = errorResetMs;
    this.#onPieceTap = onPieceTap;
  }

  mount() {
    this.#unbindTap = onTap(this.#container, '[data-piece-id]', (target) => {
      this.#onPieceTap(target.getAttribute('data-piece-id') ?? '');
    });
  }

  /**
   * Hissələri verilmiş sırada yenidən yaradır (yeni oyun).
   * @param {string[]} order  pieceId-lər
   */
  render(order) {
    this.#clearErrors();
    this.#cells.clear();
    const doc = this.#container.ownerDocument;

    const cells = order.map((pieceId) => {
      const cell = doc.createElement('div');
      cell.className = 'cp-tray__cell';
      cell.dataset.pieceId = pieceId;

      const piece = doc.createElement('div');
      piece.className = 'cp-piece';
      piece.innerHTML = this.#markup.get(pieceId) ?? ''; // öz assetimiz (bölmə 9)

      const errorIcon = doc.createElement('span');
      errorIcon.className = 'cp-piece__error';
      errorIcon.setAttribute('aria-hidden', 'true');
      errorIcon.innerHTML = this.#errorIconMarkup;
      piece.append(errorIcon);

      cell.append(piece);
      this.#cells.set(pieceId, cell);
      return cell;
    });

    this.#container.replaceChildren(...cells);
  }

  /**
   * @param {string | null} pieceId
   */
  setSelected(pieceId) {
    for (const [id, cell] of this.#cells) {
      cell.firstElementChild?.classList.toggle('is-selected', id === pieceId);
    }
  }

  /**
   * Yanlış seçim: narıncı kontur + ✕ + shake, `errorResetMs` sonra normal vəziyyət (bölmə 7.1).
   * Ardıcıl yanlış seçimdə animasiya yenidən başlayır.
   * @param {string} pieceId
   */
  showError(pieceId) {
    const piece = this.#pieceElement(pieceId);
    if (!piece) return;

    this.#clearError(pieceId);
    const cancelRaf = retriggerClass(piece, 'is-error');
    const timeoutId = setTimeout(() => {
      piece.classList.remove('is-error');
      this.#errorTimers.delete(pieceId);
    }, this.#errorResetMs);
    this.#errorTimers.set(pieceId, { cancelRaf, timeoutId });
  }

  /**
   * Hissəni tray-dən götürür: xana boş qalır, element qaytarılır (board-a köçürmək üçün).
   * @param {string} pieceId
   * @returns {{ element: HTMLElement, rect: DOMRect } | null}
   */
  takePiece(pieceId) {
    const cell = this.#cells.get(pieceId);
    const piece = this.#pieceElement(pieceId);
    if (!cell || !piece) return null;

    this.#clearError(pieceId);
    piece.classList.remove('is-selected');
    const rect = piece.getBoundingClientRect();
    delete cell.dataset.pieceId; // boş xana artıq toxunma hədəfi deyil
    return { element: piece, rect };
  }

  /** Listener-ləri və taymerləri silir, DOM-u təmizləyir. */
  destroy() {
    this.#unbindTap?.();
    this.#unbindTap = null;
    this.#clearErrors();
    this.#cells.clear();
    this.#container.replaceChildren();
  }

  /** @param {string} pieceId */
  #pieceElement(pieceId) {
    return /** @type {HTMLElement | null} */ (this.#cells.get(pieceId)?.querySelector('.cp-piece') ?? null);
  }

  /** @param {string} pieceId */
  #clearError(pieceId) {
    const timers = this.#errorTimers.get(pieceId);
    if (!timers) return;
    timers.cancelRaf();
    clearTimeout(timers.timeoutId);
    this.#errorTimers.delete(pieceId);
    this.#pieceElement(pieceId)?.classList.remove('is-error');
  }

  #clearErrors() {
    for (const pieceId of [...this.#errorTimers.keys()]) this.#clearError(pieceId);
  }
}
