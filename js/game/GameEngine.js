/**
 * SAF oyun məntiqi (bölmə 2). DOM-a toxunmur: state saxlayır və event yayır, view-lar qulaq asır.
 * Angular-da: `@Injectable` GameEngineService (kod olduğu kimi köçürülür).
 * @module game/GameEngine
 */

import { Emitter } from '../core/Emitter.js';

/**
 * @typedef {Object} GameEvents
 * @property {number | null} slotSelected                         Seçilmiş xana (null = seçim yoxdur)
 * @property {string | null} pieceSelected                        Seçilmiş hissə (allowPieceFirst rejimi)
 * @property {{ pieceId: string, slotIndex: number }} placed      Düzgün hissə yerləşdi
 * @property {{ pieceId: string, slotIndex: number }} wrong       Yanlış cəhd
 * @property {{ placedCount: number }} completed                  Bütün hissələr yerləşdi
 */

/**
 * @typedef {Object} EnginePiece
 * @property {string} id
 * @property {number} correctIndex
 */

export class GameEngine {
  /** @type {Emitter<GameEvents>} */
  events = new Emitter();

  /** @type {Map<string, number>} pieceId → correctIndex */
  #pieces;
  #allowPieceFirst;

  /** @type {Set<string>} */
  #placed = new Set();
  /** @type {Set<number>} */
  #filledSlots = new Set();
  /** @type {number | null} */
  #selectedSlot = null;
  /** @type {string | null} */
  #selectedPiece = null;
  #isAnimating = false;
  #isComplete = false;

  /**
   * @param {{ pieces: EnginePiece[], allowPieceFirst: boolean }} options
   */
  constructor({ pieces, allowPieceFirst }) {
    this.#pieces = new Map(pieces.map((p) => [p.id, p.correctIndex]));
    this.#allowPieceFirst = allowPieceFirst;
  }

  get selectedSlot() { return this.#selectedSlot; }
  get selectedPiece() { return this.#selectedPiece; }
  get placedCount() { return this.#placed.size; }
  get totalCount() { return this.#pieces.size; }
  get isAnimating() { return this.#isAnimating; }
  get isComplete() { return this.#isComplete; }

  /** @param {string} pieceId */
  isPlaced(pieceId) {
    return this.#placed.has(pieceId);
  }

  /** Yeni oyun: bütün state sıfırlanır. */
  reset() {
    this.#placed.clear();
    this.#filledSlots.clear();
    this.#selectedSlot = null;
    this.#selectedPiece = null;
    this.#isAnimating = false;
    this.#isComplete = false;
  }

  /**
   * View animasiyanı bitirəndə çağırır; bundan sonra kliklər yenidən qəbul olunur.
   * @param {boolean} value
   */
  setAnimating(value) {
    this.#isAnimating = value;
  }

  /**
   * Boş xanaya toxunuş.
   * @param {number} slotIndex
   */
  selectSlot(slotIndex) {
    if (!this.#acceptsInput() || this.#filledSlots.has(slotIndex)) return;

    if (this.#selectedPiece != null) {
      this.#attempt(this.#selectedPiece, slotIndex);
      return;
    }
    this.#setSlot(this.#selectedSlot === slotIndex ? null : slotIndex);
  }

  /**
   * Tray-dəki hissəyə toxunuş.
   * @param {string} pieceId
   */
  selectPiece(pieceId) {
    if (!this.#acceptsInput() || !this.#pieces.has(pieceId) || this.#placed.has(pieceId)) return;

    if (this.#selectedSlot != null) {
      this.#attempt(pieceId, this.#selectedSlot);
      return;
    }
    if (this.#allowPieceFirst) {
      this.#setPiece(this.#selectedPiece === pieceId ? null : pieceId);
    }
  }

  /** Dev (bölmə 9.1): qalan bütün hissələri öz yerlərinə qoyur, oyun adi qaydada bitir. */
  solveRemaining() {
    if (!this.#acceptsInput()) return;
    for (const [pieceId, slotIndex] of this.#pieces) {
      if (!this.#placed.has(pieceId)) this.#place(pieceId, slotIndex);
    }
    this.#checkComplete();
  }

  /** Listener-ləri silir. */
  destroy() {
    this.events.clear();
  }

  #acceptsInput() {
    return !this.#isAnimating && !this.#isComplete;
  }

  /**
   * @param {string} pieceId
   * @param {number} slotIndex
   */
  #attempt(pieceId, slotIndex) {
    if (this.#pieces.get(pieceId) === slotIndex) {
      this.#place(pieceId, slotIndex);
      this.#checkComplete();
    } else {
      // Seçim qalır ki, istifadəçi başqa variant yoxlaya bilsin
      this.events.emit('wrong', { pieceId, slotIndex });
    }
  }

  /**
   * @param {string} pieceId
   * @param {number} slotIndex
   */
  #place(pieceId, slotIndex) {
    this.#placed.add(pieceId);
    this.#filledSlots.add(slotIndex);
    this.#isAnimating = true;
    this.#setSlot(null);
    this.#setPiece(null);
    this.events.emit('placed', { pieceId, slotIndex });
  }

  #checkComplete() {
    if (this.#placed.size < this.#pieces.size) return;
    this.#isComplete = true;
    this.events.emit('completed', { placedCount: this.#placed.size });
  }

  /** @param {number | null} slotIndex */
  #setSlot(slotIndex) {
    if (this.#selectedSlot === slotIndex) return;
    this.#selectedSlot = slotIndex;
    this.events.emit('slotSelected', slotIndex);
  }

  /** @param {string | null} pieceId */
  #setPiece(pieceId) {
    if (this.#selectedPiece === pieceId) return;
    this.#selectedPiece = pieceId;
    this.events.emit('pieceSelected', pieceId);
  }
}
