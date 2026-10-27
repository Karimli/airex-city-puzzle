/**
 * Bootstrap: konfiqi yükləyir, PuzzleApp yaradır və mount edir.
 * @module main
 */

import { CITY_BAKU, SETTINGS, UI_ASSETS, SHEETS_URL, DEBUG } from './config.js';
import { PuzzleApp } from './app/PuzzleApp.js';
import { findRoot, hasUrlFlag, reloadPage } from './core/env.js';
import { registerServiceWorker } from './core/sw-register.js';

const root = findRoot('[data-cp-root]');

if (root) {
  // Yeni versiya hazır olanda səhifə yalnız rules ekranında yenilənir — oyunun ortasında heç vaxt
  let updateReady = false;
  /** @param {string | null} state */
  const applyUpdateIfIdle = (state) => {
    if (updateReady && state === 'rules') reloadPage();
  };

  const app = new PuzzleApp(root, {
    city: CITY_BAKU,
    settings: SETTINGS,
    uiAssets: UI_ASSETS,
    sheetsUrl: SHEETS_URL,
    devMode: DEBUG || hasUrlFlag('dev'),
    onScreenChange: applyUpdateIfIdle,
  });
  app.mount().catch((error) => console.error('[CityPuzzle] Assetlər yüklənmədi:', error));

  registerServiceWorker({
    url: './sw.js',
    onUpdateReady: () => {
      updateReady = true;
      applyUpdateIfIdle(app.state);
    },
  });
}
