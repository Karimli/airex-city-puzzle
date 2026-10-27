/**
 * Bootstrap: konfiqi yükləyir, PuzzleApp yaradır və mount edir.
 * @module main
 */

import { CITY_BAKU, SETTINGS, UI_ASSETS, SHEETS_URL, DEBUG } from './config.js';
import { PuzzleApp } from './app/PuzzleApp.js';
import { findRoot, hasUrlFlag } from './core/env.js';

const root = findRoot('[data-cp-root]');

if (root) {
  const app = new PuzzleApp(root, {
    city: CITY_BAKU,
    settings: SETTINGS,
    uiAssets: UI_ASSETS,
    sheetsUrl: SHEETS_URL,
    devMode: DEBUG || hasUrlFlag('dev'),
  });
  app.mount().catch((error) => console.error('[CityPuzzle] Assetlər yüklənmədi:', error));
}
