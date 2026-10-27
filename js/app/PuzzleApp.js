/**
 * State machine: ekranlar arası keçid (bölmə 1) və oyun hissələrinin birləşdirilməsi.
 *
 *   rules ──[DAVAM ET]──▶ start ──[BAŞLA]──▶ game ──[12/12]──▶ result ──[YENİDƏN OYNA]──▶ rules | start
 *
 * Angular-da: parent component + `signal` state.
 * @module app/PuzzleApp
 */

import { preloadAll } from '../core/assets.js';
import { prefersReducedMotion } from '../core/env.js';
import { shuffleUntilChanged } from '../core/shuffle.js';
import { addResult, getBestTime, setBestTime } from '../core/storage.js';
import { ResultSync, createId } from '../core/sync.js';
import { onTap } from '../core/tap.js';
import { Timer, formatDateTime, formatTime } from '../core/Timer.js';
import { GameEngine } from '../game/GameEngine.js';
import { BoardView } from '../game/BoardView.js';
import { TrayView } from '../game/TrayView.js';
import { flyFrom } from '../game/animations.js';

/** Son hissənin animasiyasından sonra RESULT-a qədər gözləmə (bölmə 2.2) */
const RESULT_DELAY_MS = 500;

/** @typedef {'rules' | 'start' | 'game' | 'result'} ScreenState */

/**
 * @typedef {Object} PuzzleAppOptions
 * @property {import('../config.js').CityConfig} city
 * @property {import('../config.js').Settings} settings
 * @property {Record<string, string>} uiAssets  `data-svg` açarı → SVG yolu
 * @property {string} sheetsUrl  Google Sheets Web App URL (boş → yalnız lokal)
 * @property {boolean} devMode  true → GAME ekranına dev düyməsi əlavə olunur (bölmə 9.1)
 * @property {(state: ScreenState) => void} [onScreenChange]  Ekran dəyişəndə (məs. yeniləməni rules-da tətbiq etmək üçün)
 */

export class PuzzleApp {
  /** @type {HTMLElement} */
  root;
  /** @type {PuzzleAppOptions} */
  options;
  /** @type {ScreenState | null} */
  state = null;

  /** @type {Map<ScreenState, HTMLElement>} */
  #screens = new Map();
  /** @type {HTMLButtonElement | null} */
  #devButton = null;
  /** @type {Array<() => void>} */
  #unbinders = [];

  /** @type {GameEngine | null} */
  #engine = null;
  /** @type {BoardView | null} */
  #board = null;
  /** @type {TrayView | null} */
  #tray = null;
  /** @type {Timer | null} */
  #timer = null;
  /** @type {ResultSync | null} */
  #sync = null;

  /** Gedən "uçuş" animasiyaları; hamısı bitəndə engine kilidi açılır */
  /** @type {Set<Promise<void>>} */
  #flights = new Set();
  /** @type {Set<Animation>} */
  #animations = new Set();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #resultTimeout;
  /** Hərəkətsizlik taymeri: `idleResetMs` ərzində toxunuş olmasa rules ekranına qayıdılır */
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #idleTimeout;
  /** Hər yeni oyunda artır: köhnə oyunun gecikmiş callback-ləri işləmir */
  #gameId = 0;

  /**
   * Konstruktorda side-effect yoxdur, başlatma `mount()` ilə edilir.
   * @param {HTMLElement} root
   * @param {PuzzleAppOptions} options
   */
  constructor(root, options) {
    this.root = root;
    this.options = options;
  }

  /**
   * Ekranları tapır, listener-ləri qoşur, assetləri preload edir, ilk ekranı göstərir.
   * Preload bitənə qədər kök elementdə `.is-loading` qalır.
   * @returns {Promise<void>}
   */
  async mount() {
    for (const el of this.root.querySelectorAll('[data-screen]')) {
      this.#screens.set(/** @type {ScreenState} */ (el.getAttribute('data-screen')), /** @type {HTMLElement} */ (el));
    }

    this.#unbinders.push(onTap(this.root, '[data-action]', (target) => {
      this.#handleAction(target.getAttribute('data-action') ?? '');
    }));
    this.root.addEventListener('contextmenu', this.#onContextMenu);
    this.root.addEventListener('pointerdown', this.#onActivity, { capture: true });

    if (this.options.devMode) this.#mountDevButton();

    this.#sync = new ResultSync(this.options.sheetsUrl);
    this.#sync.mount();

    const svgs = await this.#loadAssets();
    this.#mountGame(svgs);
    this.#renderBest();
    this.show('rules');
    this.root.classList.remove('is-loading');
  }

  /**
   * Aktiv ekranı dəyişir (animasiyasız).
   * @param {ScreenState} next
   */
  show(next) {
    if (next === this.state) return;
    for (const [name, el] of this.#screens) {
      el.classList.toggle('is-active', name === next);
    }
    this.state = next;
    this.#armIdle();
    this.options.onScreenChange?.(next);
  }

  /** Listener-ləri, taymeri, animasiyaları dayandırır; view-ları təmizləyir. */
  destroy() {
    this.#cancelGameWork();
    for (const unbind of this.#unbinders) unbind();
    this.#unbinders = [];
    this.root.removeEventListener('contextmenu', this.#onContextMenu);
    this.root.removeEventListener('pointerdown', this.#onActivity, { capture: true });
    clearTimeout(this.#idleTimeout);

    this.#engine?.destroy();
    this.#board?.destroy();
    this.#tray?.destroy();
    this.#timer?.destroy();
    this.#sync?.destroy();
    this.#engine = this.#board = this.#tray = this.#timer = this.#sync = null;

    this.#devButton?.remove();
    this.#devButton = null;
    this.#screens.clear();
    this.state = null;
  }

  // ---------------------------------------------------------------- assets + quraşdırma

  /**
   * Bütün SVG-ləri və şəkli yükləyir; UI SVG-lərini `[data-svg]` yerlərinə qoyur.
   * @returns {Promise<Map<string, string>>}  url → SVG mətni
   */
  async #loadAssets() {
    const { city, uiAssets } = this.options;
    const { svgs } = await preloadAll({
      svgs: [...Object.values(uiAssets), city.board, ...city.pieces.map((p) => p.src)],
      images: [city.image],
    });

    for (const el of this.root.querySelectorAll('[data-svg]')) {
      const url = uiAssets[/** @type {HTMLElement} */ (el).dataset.svg ?? ''];
      const markup = url && svgs.get(url);
      if (markup) el.innerHTML = markup; // yalnız öz assetlərimiz (bölmə 9)
    }
    for (const img of this.root.querySelectorAll('[data-city-image]')) {
      /** @type {HTMLImageElement} */ (img).src = city.image;
    }
    return svgs;
  }

  /** @param {Map<string, string>} svgs */
  #mountGame(svgs) {
    const { city, settings, uiAssets } = this.options;
    const boardEl = /** @type {HTMLElement} */ (this.root.querySelector('[data-board]'));
    const trayEl = /** @type {HTMLElement} */ (this.root.querySelector('[data-tray]'));
    const timeEl = this.root.querySelector('[data-time]');

    this.#engine = new GameEngine({ pieces: city.pieces, allowPieceFirst: settings.allowPieceFirst });

    this.#board = new BoardView(boardEl, {
      svgMarkup: svgs.get(city.board) ?? '',
      cols: city.cols,
      onSlotTap: (slotIndex) => this.#engine?.selectSlot(slotIndex),
    });
    this.#tray = new TrayView(trayEl, {
      pieces: city.pieces.map((p) => ({ id: p.id, svgMarkup: svgs.get(p.src) ?? '' })),
      errorIconMarkup: svgs.get(uiAssets.errorX) ?? '',
      errorResetMs: settings.errorResetMs,
      onPieceTap: (pieceId) => this.#engine?.selectPiece(pieceId),
    });
    this.#timer = new Timer((seconds) => {
      if (timeEl) timeEl.textContent = formatTime(seconds * 1000);
    });

    this.#board.mount();
    this.#tray.mount();

    const { events } = this.#engine;
    this.#unbinders.push(
      events.on('slotSelected', (slotIndex) => this.#board?.setSelected(slotIndex)),
      events.on('pieceSelected', (pieceId) => this.#tray?.setSelected(pieceId)),
      events.on('wrong', ({ pieceId }) => this.#tray?.showError(pieceId)),
      events.on('placed', ({ pieceId, slotIndex }) => this.#onPlaced(pieceId, slotIndex)),
      events.on('completed', () => this.#onCompleted()),
    );
  }

  // ---------------------------------------------------------------- oyun axını

  /**
   * `data-action` → keçid.
   * @param {string} action
   */
  #handleAction(action) {
    switch (action) {
      case 'continue':
        this.#renderBest();
        this.show('start');
        break;
      case 'start':
        this.#startGame();
        break;
      case 'restart':
        this.#resetGame();
        this.#renderBest();
        this.show(this.options.settings.restartTarget);
        break;
      case 'dev-complete':
        // Bölmə 9.1: RESULT-a birbaşa keçmir, qalan hissələr yerinə qoyulur, oyun adi qaydada bitir
        if (this.state === 'game') this.#engine?.solveRemaining();
        break;
    }
  }

  #startGame() {
    this.#resetGame();
    this.#tray?.render(shuffleUntilChanged(this.options.city.pieces.map((p) => p.id)));
    this.#renderBest();
    this.show('game');
    this.#timer?.start();
  }

  /** Taymer, seçimlər, yerləşmiş hissələr, animasiyalar — hamısı sıfırlanır (bölmə 1). */
  #resetGame() {
    this.#cancelGameWork();
    this.#gameId++;
    this.#engine?.reset();
    this.#board?.reset();
    this.#timer?.reset();
    this.root.querySelector('[data-record]')?.classList.remove('is-active');
  }

  /**
   * Hərəkətsizlik taymerini yenidən başladır. Rules ekranında (artıq başlanğıcdadır) işləmir.
   * Yarımçıq oyun yazılmır, tam sıfırlanır.
   */
  #armIdle() {
    clearTimeout(this.#idleTimeout);
    const { idleResetMs } = this.options.settings;
    if (!idleResetMs || this.state === 'rules' || this.state == null) return;
    this.#idleTimeout = setTimeout(() => {
      this.#resetGame();
      this.show('rules');
    }, idleResetMs);
  }

  #onActivity = () => {
    this.#armIdle();
  };

  #cancelGameWork() {
    clearTimeout(this.#resultTimeout);
    for (const animation of this.#animations) animation.cancel();
    this.#animations.clear();
    this.#flights.clear();
  }

  /**
   * Düzgün hissə: tray-dən götürülür, board-a köçürülür, FLIP ilə uçur (bölmə 7.2).
   * @param {string} pieceId
   * @param {number} slotIndex
   */
  #onPlaced(pieceId, slotIndex) {
    const taken = this.#tray?.takePiece(pieceId);
    if (!taken || !this.#board) return;
    const { element, rect } = taken;
    const gameId = this.#gameId;

    element.classList.add('is-flying');
    this.#board.attachPiece(element, slotIndex);
    const animation = flyFrom(element, rect, { reducedMotion: prefersReducedMotion() });
    if (animation) this.#animations.add(animation);

    const flight = (animation ? animation.finished : Promise.resolve())
      .then(() => {
        element.classList.remove('is-flying');
        element.classList.add('is-placed');
      })
      .catch(() => {}) // cancel() → reset zamanı
      .finally(() => {
        if (animation) this.#animations.delete(animation);
        this.#flights.delete(flight);
        if (gameId === this.#gameId && this.#flights.size === 0) this.#engine?.setAnimating(false);
      });
    this.#flights.add(flight);
  }

  /** 12/12: taymer dayanır, rekord yoxlanılır, son animasiya + 500ms sonra RESULT. */
  async #onCompleted() {
    const { city } = this.options;
    const gameId = this.#gameId;

    this.#timer?.stop();
    const elapsed = this.#timer?.elapsedMs ?? 0;
    const best = getBestTime(city.id);
    const isRecord = best == null || elapsed < best;
    if (isRecord) setBestTime(city.id, elapsed);
    const at = Date.now();
    addResult(city.id, { at, ms: elapsed });
    this.#sync?.queue({ id: createId(), at, local: formatDateTime(new Date(at)), ms: Math.round(elapsed), city: city.id });

    const timeEl = this.root.querySelector('[data-result-time]');
    if (timeEl) timeEl.textContent = formatTime(elapsed);
    this.root.querySelector('[data-record]')?.classList.toggle('is-active', isRecord);
    this.#renderBest(isRecord ? elapsed : best);

    await Promise.all(this.#flights);
    if (gameId !== this.#gameId) return;
    this.#resultTimeout = setTimeout(() => {
      if (gameId === this.#gameId) this.show('result');
    }, RESULT_DELAY_MS);
  }

  /**
   * Bütün `[data-best]` yerlərində ən yaxşı vaxtı göstərir.
   * @param {number | null} [best]  Verilməsə storage-dan oxunur
   */
  #renderBest(best = getBestTime(this.options.city.id)) {
    const text = formatTime(best);
    for (const el of this.root.querySelectorAll('[data-best]')) el.textContent = text;
  }

  #mountDevButton() {
    const gameScreen = this.#screens.get('game');
    if (!gameScreen) return;
    const button = this.root.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'cp-dev-button';
    button.dataset.action = 'dev-complete';
    button.textContent = 'DEV: TAMAMLA';
    gameScreen.append(button);
    this.#devButton = button;
  }

  /** @param {Event} event */
  #onContextMenu = (event) => {
    event.preventDefault();
  };
}
