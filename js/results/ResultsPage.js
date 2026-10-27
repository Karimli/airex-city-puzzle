/**
 * Nəticələr səhifəsi (/result): localStorage-dakı oyunlar saata görə qruplaşdırılmış cədvəldə,
 * "SIFIRLA" → təsdiq popup-ı → oyunun bütün məlumatları silinir.
 * @module results/ResultsPage
 */

import { fetchSvg } from '../core/assets.js';
import { onStorageChange } from '../core/env.js';
import { clearAllData, getResults } from '../core/storage.js';
import { onTap } from '../core/tap.js';
import { formatTime } from '../core/Timer.js';

/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} d */
const formatDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

/** @param {Date} d */
const formatClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/**
 * @typedef {Object} HourGroup
 * @property {Date} start  Saatın başlanğıcı
 * @property {Array<{ number: number, at: number, ms: number }>} rows  Yenidən köhnəyə
 */

export class ResultsPage {
  /** @type {HTMLElement} */
  root;
  #cityId;
  #logoUrl;
  /** @type {Array<() => void>} */
  #unbinders = [];

  /**
   * @param {HTMLElement} root
   * @param {{ cityId: string, logoUrl: string }} options
   */
  constructor(root, { cityId, logoUrl }) {
    this.root = root;
    this.#cityId = cityId;
    this.#logoUrl = logoUrl;
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

  /** Cədvəli localStorage-dan yenidən qurur. */
  render() {
    const results = getResults(this.#cityId);
    const groups = groupByHour(results);
    const doc = this.root.ownerDocument;
    const table = /** @type {HTMLTableElement} */ (this.root.querySelector('.cp-table'));

    for (const body of [...table.tBodies]) body.remove();

    // Birinci sətir: ən yaxşı nəticə (bərabərlikdə daha əvvəlki oyun), yaşıl
    const best = groups.flatMap((g) => g.rows).reduce(
      (a, b) => (!a || b.ms < a.ms || (b.ms === a.ms && b.at < a.at) ? b : a),
      /** @type {HourGroup['rows'][number] | null} */ (null),
    );
    if (best) {
      const body = doc.createElement('tbody');
      body.className = 'cp-table__best';
      const tr = body.insertRow();
      const at = new Date(best.at);
      tr.insertCell().textContent = String(best.number);
      tr.insertCell().textContent = `ƏN YAXŞI · ${formatDate(at)} · ${formatClock(at)}`;
      tr.insertCell().textContent = formatTime(best.ms);
      table.append(body);
    }

    for (const group of groups) {
      const body = doc.createElement('tbody');

      const head = body.insertRow();
      head.className = 'cp-table__group';
      const th = doc.createElement('th');
      th.colSpan = 3;
      th.scope = 'rowgroup';
      const end = new Date(group.start.getTime() + 3600_000);
      th.textContent = `${formatDate(group.start)} · ${pad(group.start.getHours())}:00–${pad(end.getHours())}:00`;
      const meta = doc.createElement('span');
      meta.className = 'cp-table__group-meta';
      const best = Math.min(...group.rows.map((r) => r.ms));
      meta.textContent = `${group.rows.length} oyun · ən yaxşı ${formatTime(best)}`;
      th.append(meta);
      head.append(th);

      for (const row of group.rows) {
        const tr = body.insertRow();
        tr.insertCell().textContent = String(row.number);
        tr.insertCell().textContent = formatClock(new Date(row.at));
        tr.insertCell().textContent = formatTime(row.ms);
      }
      table.append(body);
    }

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
        if (dialog && !dialog.open) dialog.showModal();
        break;
      case 'cancel-reset':
        dialog?.close();
        break;
      case 'confirm-reset':
        clearAllData();
        dialog?.close();
        this.render();
        break;
    }
  }

  #dialog() {
    return /** @type {HTMLDialogElement | null} */ (this.root.querySelector('[data-reset-dialog]'));
  }
}

/**
 * Nəticələri saat başlanğıcına görə qruplaşdırır; həm qruplar, həm sətirlər yenidən köhnəyə.
 * `number` — bütün oyunlar üzrə xronoloji sıra nömrəsi (1 = ilk oyun).
 * @param {import('../core/storage.js').GameResult[]} results
 * @returns {HourGroup[]}
 */
export function groupByHour(results) {
  const numbered = [...results]
    .sort((a, b) => a.at - b.at)
    .map((r, i) => ({ number: i + 1, at: r.at, ms: r.ms }))
    .reverse();

  /** @type {Map<number, HourGroup>} */
  const groups = new Map();
  for (const row of numbered) {
    const start = new Date(row.at);
    start.setMinutes(0, 0, 0);
    const key = start.getTime();
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { start, rows: [] }));
    group.rows.push(row);
  }
  return [...groups.values()];
}
