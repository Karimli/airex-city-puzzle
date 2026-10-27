/**
 * AIREX City Puzzle → Google Sheets
 *
 * Kiosk hər bitmiş oyunu bu Web App-ə POST edir, nəticə "Nəticələr" vərəqinə yazılır.
 * Eyni nəticə iki dəfə gəlsə (internet kəsilib təkrar göndəriləndə), "tarix-saat + ms" cütünə görə təkrar yazılmır.
 * /result səhifəsində SIFIRLA → { action: 'reset' } → başlıqdan başqa bütün sətirlər silinir.
 * /result səhifəsi GET ?action=list ilə nəticələri oxuyur → bütün cihazlarda eyni cədvəl.
 *
 * Quraşdırma: Extensions → Apps Script → bu kodu yapışdır → Deploy → New deployment → Web app
 *   Execute as: Me   ·   Who has access: Anyone
 */

const SHEET_NAME = 'Nəticələr';
const HEADERS = ['Tarix - saat', 'Vaxt', 'Vaxt (ms)'];

/**
 * Kioskdan gələn sorğular:
 *   { results: [{ id, at, local, ms, city }] }  → nəticələri yazır (id və city cədvələ yazılmır)
 *   { action: 'reset' }                          → bütün nəticələri silir
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'reset') return json_({ ok: true, cleared: clearResults_() });

    const incoming = Array.isArray(body.results) ? body.results : [];
    const sheet = getSheet_();

    const lastRow = sheet.getLastRow();
    const known = new Set(
      lastRow > 1
        ? sheet.getRange(2, 1, lastRow - 1, 3).getValues().map((r) => key_(r[0], r[2]))
        : [],
    );

    const rows = [];
    const accepted = [];
    for (const r of incoming) {
      const ms = Math.round(Number(r.ms));
      const local = String(r.local || '');
      if (!local || !Number.isFinite(ms) || ms <= 0) continue;
      const key = key_(local, ms);
      if (!known.has(key)) {
        known.add(key);
        rows.push([local, formatTime_(ms), ms]);
      }
      // Kiosk bu ID-ləri növbədən silir (yeni yazılanlar + əvvəldən olanlar)
      accepted.push(String(r.id || ''));
    }
    if (rows.length) {
      const range = sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length);
      // "00:47" Sheets-də saat:dəqiqə kimi oxunmasın: tarix və vaxt mətn formatında
      range.offset(0, 0, rows.length, 2).setNumberFormat('@');
      range.setValues(rows);
    }

    return json_({ ok: true, saved: rows.length, accepted });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * GET ?action=list → { ok, results: [{ local, ms }] } (cədvəldəki sıra ilə, köhnədən yeniyə)
 * GET (parametrsiz) → işlədiyini yoxlamaq üçün
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'list') {
    try {
      return json_({ ok: true, results: readResults_() });
    } catch (err) {
      return json_({ ok: false, error: String(err) });
    }
  }
  return json_({ ok: true, sheet: SHEET_NAME });
}

/** Düzgün formatlı sətirləri oxuyur (köhnə və ya əl ilə yazılmış yanlış sətirlər atlanır). */
function readResults_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, 3)
    .getValues()
    .map((r) => ({ local: String(r[0]), ms: Number(r[2]) }))
    .filter((r) => r.local && Number.isFinite(r.ms) && r.ms > 0);
}

/**
 * Başlıq sətrindən başqa hər şeyi silir; silinən sətir sayını qaytarır.
 * deleteRows yox, clearContent: dondurulmuş başlıqdan başqa bütün sətirləri silməyə Sheets icazə vermir.
 */
function clearResults_() {
  const sheet = getSheet_();
  const count = sheet.getLastRow() - 1;
  if (count > 0) sheet.getRange(2, 1, count, sheet.getMaxColumns()).clearContent();
  return Math.max(count, 0);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

/** Təkrarlanmanı tanımaq üçün açar: kioskun yerli tarix-saatı + müddət (ms) */
function key_(local, ms) {
  return String(local) + '|' + Math.round(Number(ms));
}

function formatTime_(ms) {
  const total = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
