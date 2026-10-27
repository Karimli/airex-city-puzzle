/**
 * Nəticələr səhifəsi (/result).
 *
 * Mənbə: Google Sheets qoşulubsa nəticələr oradan oxunur → bütün cihazlarda eyni cədvəl.
 * Bu cihazın hələ göndərilməmiş nəticələri (növbə) də əlavə olunur. Sheets əlçatmazdırsa, bu cihazın
 * localStorage-ı göstərilir. Səhifə hər 30 saniyədən bir özü yenilənir.
 *
 * Sıra: 1) ən yaxşı nəticə (yaşıl), sonra qalanları yenidən köhnəyə (2-ci sətir = son oyun, təkrar yoxdur).
 * "SIFIRLA" → təsdiq popup-ı → əvvəl Google Cədvəl, sonra bu cihazdakı bütün məlumatlar silinir.
 * @module results/ResultsPage
 */

import { fetchSvg } from '../core/assets.js';
import { onStorageChange } from '../core/env.js';
import { clearAllData, getOutbox, getResults } from '../core/storage.js';
import { fetchRemoteResults, resetRemote } from '../core/sync.js';
import { onTap } from '../core/tap.js';
import { formatDateTime, formatTime } from '../core/Timer.js';

const REFRESH_MS = 30000;

/**
 * @typedef {Object} ResultEntry  Xronoloji sırada bir oyun
 * @property {string} label  "dd.mm.yyyy - hh:mm:ss"
 * @property {number} ms
 */

/**
 * @typedef {ResultEntry & { number: number }} ResultRow
 */

export class ResultsPage {
  /** @type {HTMLElement} */
  root;
  #cityId;
  #logoUrl;
  #sheetsUrl;
  #isResetting = false;
  /** Köhnə sorğunun cavabı yenisini əzməsin */
  #loadId = 0;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  #refreshTimer;
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
      onStorageChange(() => this.refresh()),
    );
    if (this.#sheetsUrl) this.#refreshTimer = setInterval(() => this.refresh(), REFRESH_MS);

    const logo = this.root.querySelector('[data-svg="logo"]');
    await Promise.all([
      this.refresh(),
      fetchSvg(this.#logoUrl).then((svg) => {
        if (logo) logo.innerHTML = svg; // öz assetimiz
      }),
    ]);
  }

  /** Nəticələri (Sheets və ya lokal) yükləyib cədvəli yenidən çəkir. */
  async refresh() {
    const loadId = ++this.#loadId;
    const local = this.#localEntries();

    if (!this.#sheetsUrl) {
      this.#draw(local, null);
      return;
    }
    if (loadId === 1) this.#draw(local, 'loading'); // ilk açılışda gözləmədən lokal göstər

    try {
      const remote = (await fetchRemoteResults(this.#sheetsUrl)).map((r) => ({ label: r.local, ms: Math.round(r.ms) }));
      if (loadId !== this.#loadId) return;
      // Bu cihazın hələ göndərilməmiş nəticələri sonda (onlar ən yenilərdir)
      const known = new Set(remote.map(entryKey));
      const pending = getOutbox()
        .map((item) => ({ label: item.local, ms: Math.round(item.ms) }))
        .filter((entry) => !known.has(entryKey(entry)));
      this.#draw([...remote, ...pending], 'remote');
    } catch {
      if (loadId === this.#loadId) this.#draw(local, 'offline');
    }
  }

  destroy() {
    for (const unbind of this.#unbinders) unbind();
    this.#unbinders = [];
    clearInterval(this.#refreshTimer);
    this.#loadId++;
    this.#dialog()?.close();
  }

  /** @returns {ResultEntry[]} */
  #localEntries() {
    return getResults(this.#cityId)
      .sort((a, b) => a.at - b.at)
      .map((r) => ({ label: formatDateTime(new Date(r.at)), ms: r.ms }));
  }

  /**
   * @param {ResultEntry[]} entries  Xronoloji sıra ilə
   * @param {'loading' | 'remote' | 'offline' | null} source  null = Sheets qoşulmayıb
   */
  #draw(entries, source) {
    const rows = orderRows(entries);
    const doc = this.root.ownerDocument;
    const table = /** @type {HTMLTableElement} */ (this.root.querySelector('.cp-table'));

    for (const body of [...table.tBodies]) body.remove();
    const body = doc.createElement('tbody');
    rows.forEach((row, i) => {
      const tr = body.insertRow();
      if (i === 0) tr.className = 'cp-table__best';
      tr.insertCell().textContent = String(row.number);
      tr.insertCell().textContent = row.label;
      tr.insertCell().textContent = formatTime(row.ms);
    });
    table.append(body);

    const hasRows = entries.length > 0;
    table.classList.toggle('has-rows', hasRows);
    /** @type {HTMLElement} */ (this.root.querySelector('[data-empty]')).hidden = hasRows;
    // Sheets qoşulubsa, bu cihazda nəticə olmasa da Google Cədvəl sıfırlana bilər
    /** @type {HTMLButtonElement} */ (this.root.querySelector('[data-action="ask-reset"]')).disabled =
      !hasRows && !this.#sheetsUrl;

    const summary = this.root.querySelector('[data-summary]');
    if (summary) {
      summary.textContent = hasRows
        ? `Cəmi: ${entries.length} oyun · Ən yaxşı: ${formatTime(rows[0].ms)}`
        : '';
    }

    const sourceEl = this.root.querySelector('[data-source]');
    if (sourceEl) {
      sourceEl.textContent =
        source === 'remote' ? 'Google Cədvəl · bütün cihazlarda eyni'
        : source === 'loading' ? 'Google Cədvəl yüklənir…'
        : source === 'offline' ? 'Google Cədvələ qoşulmaq alınmadı · bu cihazın nəticələri göstərilir'
        : '';
    }
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
      await this.refresh();
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

/** @param {ResultEntry} entry */
const entryKey = (entry) => `${entry.label}|${entry.ms}`;

/**
 * Cədvəl sırası: 1) ən yaxşı nəticə (bərabərlikdə daha əvvəlki oyun), sonra qalanları yenidən köhnəyə —
 * yəni 2-ci sətir həmişə son oyundur; son oyun ən yaxşıdırsa təkrarlanmır, 2-ci sətirdə ondan əvvəlki oyun olur.
 * `number` — xronoloji sıra nömrəsi (1 = ilk oyun).
 * @param {ResultEntry[]} entries  Xronoloji sıra ilə
 * @returns {ResultRow[]}
 */
export function orderRows(entries) {
  const rows = entries.map((entry, i) => ({ ...entry, number: i + 1 }));
  if (!rows.length) return [];

  let best = rows[0];
  for (const row of rows) if (row.ms < best.ms) best = row;

  return [best, ...rows.filter((r) => r !== best).reverse()];
}
