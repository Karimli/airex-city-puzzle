/**
 * Nəticələr səhifəsinin bootstrap-ı (/result).
 * Yollar `result/` qovluğuna nisbətəndir, ona görə asset yolu `../` ilə başlayır.
 * @module results/main
 */

import { CITY_BAKU, UI_ASSETS } from '../config.js';
import { findRoot } from '../core/env.js';
import { ResultsPage } from './ResultsPage.js';

const root = findRoot('[data-results-root]');

if (root) {
  const page = new ResultsPage(root, { cityId: CITY_BAKU.id, logoUrl: `../${UI_ASSETS.logo}` });
  page.mount().catch((error) => console.error('[CityPuzzle] Nəticələr səhifəsi açılmadı:', error));
}
