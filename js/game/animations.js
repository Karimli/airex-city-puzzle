/**
 * Oyundakı 2 animasiya (bölmə 7), kitabxanasız. Funksiyalar elementi parametr kimi alır, DOM-da axtarmır.
 * Angular-da: eyni funksiyalar, element `ElementRef` / `viewChild` ilə ötürülür.
 * @module game/animations
 */

const FLY_DURATION_MS = 500;
const FLY_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Class-ı yenidən əlavə edir ki, CSS animasiyası (shake) əvvəldən başlasın (bölmə 7.1).
 * @param {Element} element
 * @param {string} className
 * @returns {() => void}  Gözləyən rAF-ı ləğv edən funksiya
 */
export function retriggerClass(element, className) {
  element.classList.remove(className);
  const rafId = requestAnimationFrame(() => element.classList.add(className));
  return () => cancelAnimationFrame(rafId);
}

/**
 * FLIP (bölmə 7.2): element artıq son yerinə köçürülüb; `firstRect` köhnə mövqedir.
 * Element köhnə yerdən yenisinə uçur.
 * @param {HTMLElement} element
 * @param {DOMRect} firstRect  Köçürülməzdən əvvəl ölçülmüş mövqe
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {Animation | null}  reducedMotion və ya sıfır məsafədə null
 */
export function flyFrom(element, firstRect, { reducedMotion = false } = {}) {
  if (reducedMotion) return null;

  const last = element.getBoundingClientRect();
  if (!last.width || !last.height) return null;

  const dx = firstRect.left - last.left;
  const dy = firstRect.top - last.top;
  const scale = firstRect.width / last.width;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.001) return null;

  return element.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transform: 'translate(0, 0) scale(1)' },
    ],
    { duration: FLY_DURATION_MS, easing: FLY_EASING },
  );
}
