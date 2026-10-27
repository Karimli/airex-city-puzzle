/**
 * Fisher–Yates shuffle (bölmə 2.1).
 * @module core/shuffle
 */

/**
 * Massivin qarışdırılmış surətini qaytarır (orijinal dəyişmir).
 * @template T
 * @param {readonly T[]} items
 * @param {() => number} [random]
 * @returns {T[]}
 */
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Qarışdırır; nəticə orijinal sıraya bərabər çıxarsa, təkrar qarışdırır.
 * @template T
 * @param {readonly T[]} items
 * @param {() => number} [random]
 * @returns {T[]}
 */
export function shuffleUntilChanged(items, random = Math.random) {
  if (items.length < 2) return [...items];
  let result;
  do {
    result = shuffle(items, random);
  } while (result.every((item, i) => item === items[i]));
  return result;
}
