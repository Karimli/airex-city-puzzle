/**
 * Assetlərin preload-u: SVG-lər mətn kimi fetch olunur (inline yerləşdirmək üçün), şəkillər decode olunur.
 * Angular-da: `@Injectable` AssetService.
 * @module core/assets
 */

/**
 * @typedef {Object} PreloadResult
 * @property {Map<string, string>} svgs  url → SVG mətni
 */

/**
 * SVG faylını mətn kimi yükləyir.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchSvg(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SVG yüklənmədi: ${url} (${response.status})`);
  return response.text();
}

/**
 * Şəkli yükləyib decode edir ki, ekranda göstəriləndə gecikmə olmasın.
 * @param {string} url
 * @returns {Promise<void>}
 */
export async function preloadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
}

/**
 * Bütün assetləri paralel yükləyir (bölmə 6.1).
 * @param {{ svgs?: string[], images?: string[] }} lists
 * @returns {Promise<PreloadResult>}
 */
export async function preloadAll({ svgs = [], images = [] }) {
  const unique = [...new Set(svgs)];
  const [texts] = await Promise.all([
    Promise.all(unique.map(fetchSvg)),
    Promise.all([...new Set(images)].map(preloadImage)),
  ]);
  return { svgs: new Map(unique.map((url, i) => [url, texts[i]])) };
}
