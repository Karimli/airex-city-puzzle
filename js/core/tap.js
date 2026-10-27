/**
 * Toxunuş üçün event delegation (bölmə 9): bir konteynerə bir cüt listener.
 * Tap yalnız `pointerdown` və `pointerup` eyni hədəfdə olanda sayılır; ikinci barmaq (isPrimary=false) nəzərə alınmır.
 * @module core/tap
 */

/**
 * @param {Element} container
 * @param {string} selector  Hədəf elementin selektoru (məs. `[data-index]`)
 * @param {(target: Element, event: PointerEvent) => void} handler
 * @returns {() => void}  Listener-ləri silən funksiya
 */
export function onTap(container, selector, handler) {
  /** @type {Element | null} */
  let pressed = null;

  /** @param {Event} event */
  const findTarget = (event) => {
    const target = /** @type {Element} */ (event.target).closest?.(selector);
    return target && container.contains(target) ? target : null;
  };

  /** @param {Event} event */
  const onDown = (event) => {
    const e = /** @type {PointerEvent} */ (event);
    pressed = e.isPrimary ? findTarget(e) : null;
  };

  /** @param {Event} event */
  const onUp = (event) => {
    const e = /** @type {PointerEvent} */ (event);
    if (!e.isPrimary) return;
    const target = findTarget(e);
    const wasPressed = pressed;
    pressed = null;
    if (target && target === wasPressed) handler(target, e);
  };

  const onCancel = () => {
    pressed = null;
  };

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onCancel);

  return () => {
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onCancel);
    pressed = null;
  };
}
