/**
 * Nəticələr səhifəsi (/result): localStorage-dakı oyunlar cədvəldə (ən yaxşı birinci, sonra saata görə),
 * "SIFIRLA" → təsdiq popup-ı → əvvəl Google Cədvəl (qoşulubsa), sonra bu cihazdakı bütün məlumatlar silinir.
 * @module results/ResultsPage
 */

import { fetchSvg } from '../core/assets.js';
import { onStorageChange } from '../core/env.js';
import { clearAllData, getResults } from '../core/storage.js';
import { resetRemote } from '../core/sync.js';
import { onTap } from '../core/tap.js';
import { formatDateTime, formatTime } from '../core/Timer.js';

export class ResultsPage {
  /** @type {HTMLElement} */
  root;
  #cityId;
  #logoUrl;
  #sheetsUrl;
  #isResetting = false;
  /** @type {Array<() => void>} */
  #unbinders = [];

  /**
   * @param {HTMLElement} root
   * @param {{ cityId: string, logoUrl: string, sheetsUrl: string }} options
   */
  constructor(root, { cityId, logoUrl, sheetsUrl }) {
    this.root = root;
    this.#cityId = cityId;
    this.#logoUrl = logoUrl;
    this.#sheetsUrl = sheetsUrl;
  }

  async mount() {
    this.#unbinders.push(
      onTap(this.root, '[data-action]', (target) => this.#handleAction(target.getAttribute('data-action') ?? '')),
      onStorageChange(() => this.render()),
    );
    this.render();

    const logo = this.root.querySelector('[data-svg="logo"]');
    if (logo) logo.innerHTML = await fetchSvg(this.#logoUrl); // öz assetimiz
  }

  /** Cədvəli localStorage-dan yenidən qurur: birinci sətir ən yaxşı nəticə (yaşıl), sonra qalanları yenidən köhnəyə. */
  render() {
    const results = getResults(this.#cityId);
    const { best, rest } = orderRows(results);
    const doc = this.root.ownerDocument;
    const table = /** @type {HTMLTableElement} */ (this.root.querySelector('.cp-table'));

    for (const body of [...table.tBodies]) body.remove();
    const body = doc.createElement('tbody');
    for (const row of best ? [best, ...rest] : rest) {
      const tr = body.insertRow();
      if (row === best) tr.className = 'cp-table__best';
      tr.insertCell().textContent = String(row.number);
      tr.insertCell().textContent = formatDateTime(new Date(row.at));
      tr.insertCell().textContent = formatTime(row.ms);
    }
    table.append(body);

    const hasRows = results.length > 0;
    table.classList.toggle('has-rows', hasRows);
    /** @type {HTMLElement} */ (this.root.querySelector('[data-empty]')).hidden = hasRows;
    /** @type {HTMLButtonElement} */ (this.root.querySelector('[data-action="ask-reset"]')).disabled = !hasRows;

    const summary = this.root.querySelector('[data-summary]');
    if (summary) {
      summary.textContent = hasRows
        ? `Cəmi: ${results.length} oyun · Ən yaxşı: ${formatTime(Math.min(...results.map((r) => r.ms)))}`
        : '';
    }
  }

  destroy() {
    for (const unbind of this.#unbinders) unbind();
    this.#unbinders = [];
    this.#dialog()?.close();
  }

  /** @param {string} action */
  #handleAction(action) {
    const dialog = this.#dialog();
    switch (action) {
      case 'ask-reset':
        this.#setResetState('idle');
        if (dialog && !dialog.open) dialog.showModal();
        break;
      case 'cancel-reset':
        if (!this.#isResetting) dialog?.close();
        break;
      case 'confirm-reset':
        this.#confirmReset();
        break;
    }
  }

  /**
   * Əvvəl Google Cədvəl silinir; uğursuz olsa lokal məlumata toxunulmur ki, ikisi bir-birindən ayrılmasın.
   */
  async #confirmReset() {
    if (this.#isResetting) return;
    this.#isResetting = true;
    this.#setResetState('busy');
    try {
      if (this.#sheetsUrl) await resetRemote(this.#sheetsUrl);
      clearAllData();
      this.#dialog()?.close();
      this.render();
    } catch {
      this.#setResetState('error');
    } finally {
      this.#isResetting = false;
    }
  }

  /** @param {'idle' | 'busy' | 'error'} state */
  #setResetState(state) {
    const confirm = /** @type {HTMLButtonElement | null} */ (this.root.querySelector('[data-action="confirm-reset"]'));
    const cancel = /** @type {HTMLButtonElement | null} */ (this.root.querySelector('[data-action="cancel-reset"]'));
    const error = /** @type {HTMLElement | null} */ (this.root.querySelector('[data-reset-error]'));
    if (confirm) {
      confirm.disabled = state === 'busy';
      confirm.textContent = state === 'busy' ? 'SİLİNİR…' : state === 'error' ? 'YENİDƏN CƏHD ET' : 'TƏSDİQLƏ';
    }
    if (cancel) cancel.disabled = state === 'busy';
    if (error) error.hidden = state !== 'error';
  }

  #dialog() {
    return /** @type {HTMLDialogElement | null} */ (this.root.querySelector('[data-reset-dialog]'));
  }
}

/**
 * @typedef {{ number: number, at: number, ms: number }} ResultRow
 */

/**
 * Ən yaxşı nəticəni (bərabərlikdə daha əvvəlki oyun) ayırır, qalanlarını yenidən köhnəyə sıralayır.
 * `number` — bütün oyunlar üzrə xronoloji sıra nömrəsi (1 = ilk oyun).
 * @param {import('../core/storage.js').GameResult[]} results
 * @returns {{ best: ResultRow | null, rest: ResultRow[] }}
 */
export function orderRows(results) {
  const rows = [...results]
    .sort((a, b) => a.at - b.at)
    .map((r, i) => ({ number: i + 1, at: r.at, ms: r.ms }));

  /** @type {ResultRow | null} */
  let best = null;
  for (const row of rows) if (!best || row.ms < best.ms) best = row;

  return { best, rest: rows.filter((r) => r !== best).reverse() };
}
