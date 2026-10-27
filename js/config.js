/**
 * Şəhər konfiqi və oyun ayarları (bölmə 8.1).
 * Asset yolları yalnız buradan gəlir (Angular-da `assets/` yolu dəyişə bilər).
 * @module config
 */

/**
 * @typedef {Object} PieceConfig
 * @property {string} id
 * @property {number} correctIndex  Düzgün xana indeksi (row * cols + col)
 * @property {string} src           Hissə SVG faylı
 */

/**
 * @typedef {Object} CityConfig
 * @property {string} id
 * @property {string} title
 * @property {number} cols
 * @property {number} rows
 * @property {string} image   Tam şəkil (start + result)
 * @property {string} board   Puzzle sahəsi SVG
 * @property {PieceConfig[]} pieces
 */

/** @type {CityConfig} */
export const CITY_BAKU = {
  id: 'baku',
  title: 'BAKI',
  cols: 4,
  rows: 3,
  image: 'assets/cities/baku/full.webp',
  board: 'assets/cities/baku/board.svg',
  pieces: Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    correctIndex: i,
    src: `assets/cities/baku/pieces/piece-${String(i).padStart(2, '0')}.svg`,
  })),
};

/**
 * Şəhərdən asılı olmayan SVG-lər. HTML-də `data-svg="<açar>"` ilə işarələnən yerə inline yerləşdirilir.
 * @type {Record<string, string>}
 */
export const UI_ASSETS = {
  logo: 'assets/brand/airex-logo.svg',
  ruleTap: 'assets/icons/rule-tap.svg',
  rulePuzzle: 'assets/icons/rule-puzzle.svg',
  ruleTimer: 'assets/icons/rule-timer.svg',
  errorX: 'assets/icons/error-x.svg',
};

/**
 * @typedef {Object} Settings
 * @property {'rules' | 'start'} restartTarget  "YENİDƏN OYNA" hara qaytarır
 * @property {boolean} allowPieceFirst          Əvvəl hissə, sonra xana seçimi
 * @property {number} errorResetMs              Yanlış vəziyyətin müddəti
 * @property {number} idleResetMs               Toxunuş olmasa rules-a qayıt (0 = söndür)
 */

/** @type {Settings} */
export const SETTINGS = {
  restartTarget: 'rules',
  allowPieceFirst: true,
  errorResetMs: 700,
  idleResetMs: 90000,
};

/** true → GAME ekranında dev düyməsi görünür. URL-də `?dev` də eyni effekti verir (bölmə 9.1). */
export const DEBUG = false;
