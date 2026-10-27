/**
 * Puzzle sahəsi (bölmə 5.2): board.svg inline render, xana seçimi, yerləşmiş hissələr qatı.
 *
 * Quruluş:
 *   .cp-board
 *     .cp-board__pieces   yerləşmiş hissələr (mövqe % ilə → ResizeObserver lazım deyil)
 *     svg                 xanalar + sonda highlight qatı (<use>), seçilmiş kontur qonşuların altında qalmır
 *
 * Angular-da: standalone component.
 * @module game/BoardView
 */

import { onTap } from '../core/tap.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class BoardView {
  /** @type {HTMLElement} */
  #container;
  #svgMarkup;
  #cols;
  /** @type {(slotIndex: number) => void} */
  #onSlotTap;

  /** @type {SVGSVGElement | null} */
  #svg = null;
  /** @type {SVGUseElement | null} */
  #highlight = null;
  /** @type {HTMLElement | null} */
  #piecesLayer = null;
  /** @type {(() => void) | null} */
  #unbindTap = null;

  /**
   * @param {HTMLElement} container  `.cp-board`
   * @param {{ svgMarkup: string, cols: number, onSlotTap: (slotIndex: number) => void }} options
   */
  constructor(container, { svgMarkup, cols, onSlotTap }) {
    this.#container = container;
    this.#svgMarkup = svgMarkup;
    this.#cols = cols;
    this.#onSlotTap = onSlotTap;
  }

  mount() {
    const doc = this.#container.ownerDocument;
    this.#container.innerHTML = this.#svgMarkup; // öz assetimiz (bölmə 9)
    this.#svg = this.#container.querySelector('svg');
    if (!this.#svg) throw new Error('board.svg tapılmadı');

    this.#piecesLayer = doc.createElement('div');
    this.#piecesLayer.className = 'cp-board__pieces';
    this.#container.prepend(this.#piecesLayer);

    this.#highlight = /** @type {SVGUseElement} */ (doc.createElementNS(SVG_NS, 'use'));
    this.#highlight.classList.add('slot-highlight');
    this.#svg.append(this.#highlight);

    this.#unbindTap = onTap(this.#svg, '[data-index]', (target) => {
      this.#onSlotTap(Number(target.getAttribute('data-index')));
    });
  }

  /**
   * Seçilmiş xananı lime konturla göstərir.
   * @param {number | null} slotIndex
   */
  setSelected(slotIndex) {
    for (const slot of this.#slots()) {
      slot.classList.toggle('is-selected', Number(slot.getAttribute('data-index')) === slotIndex);
    }
    if (!this.#highlight) return;
    if (slotIndex == null) {
      this.#highlight.removeAttribute('href');
      this.#highlight.removeAttribute('data-index');
      this.#highlight.classList.remove('is-active');
    } else {
      this.#highlight.setAttribute('href', `#slot-${slotIndex}`);
      // Toxunuş klonun üzərinə düşəndə hədəf <use> olur: təkrar toxunuş (seçimi ləğv) eyni xanaya getsin
      this.#highlight.setAttribute('data-index', String(slotIndex));
      this.#highlight.classList.add('is-active');
    }
  }

  /**
   * Hissəni öz xanasına köçürür (animasiyanı çağıran edir).
   * @param {HTMLElement} pieceElement
   * @param {number} slotIndex
   */
  attachPiece(pieceElement, slotIndex) {
    pieceElement.style.setProperty('--col', String(slotIndex % this.#cols));
    pieceElement.style.setProperty('--row', String(Math.floor(slotIndex / this.#cols)));
    this.#piecesLayer?.append(pieceElement);
    this.#svg?.querySelector(`#slot-${slotIndex}`)?.classList.add('is-placed');
  }

  /** Yeni oyun: seçim və yerləşmiş hissələr təmizlənir. */
  reset() {
    this.setSelected(null);
    for (const slot of this.#slots()) slot.classList.remove('is-placed');
    this.#piecesLayer?.replaceChildren();
  }

  destroy() {
    this.#unbindTap?.();
    this.#unbindTap = null;
    this.#container.replaceChildren();
    this.#svg = null;
    this.#highlight = null;
    this.#piecesLayer = null;
  }

  /** @returns {SVGElement[]} */
  #slots() {
    return this.#svg ? [...this.#svg.querySelectorAll('.slot')] : [];
  }
}
