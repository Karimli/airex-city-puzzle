/**
 * AIREX City Puzzle → Google Sheets
 *
 * Kiosk hər bitmiş oyunu bu Web App-ə POST edir, nəticə "Nəticələr" vərəqinə yazılır.
 * Eyni nəticə iki dəfə gəlsə (internet kəsilib təkrar göndəriləndə), ID-yə görə təkrar yazılmır.
 * /result səhifəsində SIFIRLA → { action: 'reset' } → başlıqdan başqa bütün sətirlər silinir.
 *
 * Quraşdırma: Extensions → Apps Script → bu kodu yapışdır → Deploy → New deployment → Web app
 *   Execute as: Me   ·   Who has access: Anyone
 */

const SHEET_NAME = 'Nəticələr';
const HEADERS = ['ID', 'Tarix - saat', 'Vaxt', 'Vaxt (ms)', 'Şəhər'];

/**
 * Kioskdan gələn sorğular:
 *   { results: [{ id, at, local, ms, city }] }  → nəticələri yazır
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
      lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map((r) => String(r[0])) : [],
    );

    const rows = [];
    for (const r of incoming) {
      const id = String(r.id || '');
      const ms = Number(r.ms);
      if (!id || known.has(id) || !Number.isFinite(ms) || ms <= 0) continue;
      known.add(id);
      rows.push([id, String(r.local || ''), formatTime_(ms), Math.round(ms), String(r.city || '')]);
    }
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);

    // Kiosk bu ID-ləri növbədən silir (yeni yazılanlar + əvvəldən olanlar)
    const accepted = incoming.map((r) => String(r.id || '')).filter((id) => known.has(id));
    return json_({ ok: true, saved: rows.length, accepted });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Brauzerdə linki açanda işlədiyini yoxlamaq üçün */
function doGet() {
  return json_({ ok: true, sheet: SHEET_NAME });
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

function formatTime_(ms) {
  const total = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
