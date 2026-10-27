/**
 * Oyundakı animasiyalar (bölmə 7) + tamamlanma "firework"-ü, kitabxanasız. Funksiyalar elementi parametr kimi alır, DOM-da axtarmır.
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

/**
 * Tamamlanma "firework"-ü: NƏTİCƏ ekranı açılanda ardıcıl bir neçə incə qığılcım partlayışı.
 * Mövqelər nəticə şəklinə (800×600) nisbətəndir: x 0..1 = şəklin eni, y 0..1 = hündürlüyü,
 * mənfi y = şəklin üstü (böyük vaxt sahəsi). Partlayışlar tünd fonda olur ki, aydın görünsün:
 * böyük vaxtın yanları, vaxtla şəkil arasındakı zolaq və şəklin yanları (lime şəklin üstündə itir).
 * Sürət və ölçülər şəklin eninə görə miqyaslanır (800 = dizayn).
 */
const BURSTS = [
  { at: 0, x: 0.5, y: -0.12, count: 44 },
  { at: 240, x: -0.06, y: -0.72, count: 30 },
  { at: 460, x: 1.06, y: -0.68, count: 30 },
  { at: 720, x: -0.08, y: 0.42, count: 26 },
  { at: 880, x: 1.08, y: 0.5, count: 26 },
  { at: 1120, x: 0.26, y: -0.11, count: 30 },
  { at: 1280, x: 0.74, y: -0.1, count: 30 },
];
const SPARK_LIFE_MS = [900, 1400];
const SPEED = [200, 430]; // dizayn px / san
const GRAVITY = 260; // dizayn px / san²
const DRAG = 0.22; // 1 saniyədə sürətin qalan hissəsi

/**
 * @typedef {Object} Celebration
 * @property {Promise<void>} finished  Animasiya bitəndə (və ya cancel-da) həll olunur
 * @property {() => void} cancel
 */

/**
 * @param {HTMLElement} host    Canvas-ın yerləşəcəyi element (position: relative), məs. səhnə
 * @param {HTMLElement} anchor  Partlayışların mövqeyinin hesablandığı element (nəticə şəkli)
 * @param {{ colors: string[], pixelRatio?: number, reducedMotion?: boolean }} options
 *   colors — birincisi əsas rəngdir (daha çox istifadə olunur)
 * @returns {Celebration}
 */
export function celebrate(host, anchor, { colors, pixelRatio = 1, reducedMotion = false }) {
  if (reducedMotion || !colors.length) return { finished: Promise.resolve(), cancel: () => {} };

  const canvas = host.ownerDocument.createElement('canvas');
  canvas.className = 'cp-celebration';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const hostRect = host.getBoundingClientRect();
  const board = anchor.getBoundingClientRect();
  canvas.width = Math.round(hostRect.width * pixelRatio);
  canvas.height = Math.round(hostRect.height * pixelRatio);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.scale(pixelRatio, pixelRatio);
  ctx.lineCap = 'round';

  const scale = board.width / 800;
  const originX = board.left - hostRect.left;
  const originY = board.top - hostRect.top;
  const rand = (/** @type {number[]} */ [min, max]) => min + Math.random() * (max - min);

  /** @type {Array<{ x: number, y: number, px: number, py: number, vx: number, vy: number, age: number, life: number, color: string }>} */
  const sparks = [];
  /** @type {Array<{ x: number, y: number, age: number }>} */
  const flashes = [];
  const pending = BURSTS.map((b) => ({ ...b }));
  const lastEnd = BURSTS[BURSTS.length - 1].at + SPARK_LIFE_MS[1];

  /** @param {typeof BURSTS[number]} burst */
  const explode = (burst) => {
    const x = originX + burst.x * board.width;
    const y = originY + burst.y * board.height;
    flashes.push({ x, y, age: 0 });
    for (let i = 0; i < burst.count; i++) {
      const angle = (i / burst.count) * Math.PI * 2 + rand([-0.12, 0.12]);
      const speed = rand(SPEED) * scale;
      const r = Math.random();
      sparks.push({
        x, y, px: x, py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: rand(SPARK_LIFE_MS),
        // əsas rəng (lime) üstünlük təşkil edir, aralarında ağ və boz qığılcımlar
        color: colors[r < 0.62 ? 0 : r < 0.9 ? 1 % colors.length : 2 % colors.length],
      });
    }
  };

  /** @type {(value?: void) => void} */
  let resolve = () => {};
  const finished = new Promise((r) => (resolve = r));
  let rafId = 0;
  let startedAt = 0;
  let lastTime = 0;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    canvas.remove();
    resolve();
  };

  /** @param {number} now */
  const frame = (now) => {
    if (!startedAt) startedAt = lastTime = now;
    const elapsed = now - startedAt;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    while (pending.length && pending[0].at <= elapsed) explode(/** @type {typeof BURSTS[number]} */ (pending.shift()));

    ctx.clearRect(0, 0, hostRect.width, hostRect.height);

    for (const flash of flashes) {
      flash.age += dt * 1000;
      const p = flash.age / 260;
      if (p >= 1) continue;
      ctx.globalAlpha = 0.28 * (1 - p);
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, (10 + 46 * p) * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    const drag = Math.pow(DRAG, dt);
    ctx.lineWidth = Math.max(2, 4 * scale);
    for (const s of sparks) {
      if (s.age >= s.life) continue;
      s.age += dt * 1000;
      s.px = s.x;
      s.py = s.y;
      s.vx *= drag;
      s.vy = s.vy * drag + GRAVITY * scale * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const p = Math.min(s.age / s.life, 1);
      ctx.globalAlpha = (1 - p * p) * 0.95;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      // qısa iz: əvvəlki mövqedən bir az uzun xətt — qığılcım effekti
      ctx.moveTo(s.px - (s.x - s.px) * 1.5, s.py - (s.y - s.py) * 1.5);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (elapsed >= lastEnd) finish();
    else rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  return { finished, cancel: finish };
}
