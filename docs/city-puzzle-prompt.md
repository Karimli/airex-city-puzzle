# AIREX — CITY PUZZLE (Bakı) · Development Prompt

## 0. Rol və tapşırıq

Sən təcrübəli frontend developersən. Sıfırdan, **yalnız HTML + CSS + vanilla JavaScript (ES modules)** ilə bir web puzzle oyunu yazacaqsan. Oyun böyük **toxunma ekranlı monitorda (kiosk)** açılacaq. Gələcəkdə layihə **Angular**-a köçürüləcək, ona görə kod buna uyğun qurulmalıdır (bax: bölmə 10).

Dizayn 4 ekrandan ibarətdir. Ekran görüntüləri əlavə olunub (`01`–`07`). Dizayn 1080×1920 (portret) ölçüsündə çəkilib, amma oyun **istənilən konteyner ölçüsünə dinamik uyğunlaşmalıdır** (bax: bölmə 4).

---

## 0.1 Hədəf cihaz

- **Cihaz:** IQTouch markalı, yerdə dayanan şaquli (portret) totem-monitor (digital signage kiosk).
- **Oriyentasiya:** portret. Ekran nisbəti təxminən 9:16, ehtimal olunan həll 1080×1920 (modeldən dəqiqləşdiriləcək).
- **Əməliyyat sistemi:** Windows. Oyun brauzerdə (Chrome və ya Edge) kiosk rejimində tam ekran açılır.
- **Giriş:** toxunma (barmaq). Mouse və klaviatura yoxdur. Hover effektləri istifadə olunmamalıdır, bütün vəziyyətlər toxunuşla işləməlidir.
- **Ergonomika:** interaktiv hissələr (puzzle sahəsi, tray, düymələr) ekranın orta və aşağı hissəsində olmalıdır ki, istifadəçi rahat çata bilsin. Dizayn artıq belədir, header-də isə interaktiv element yoxdur.
- **Toxunma sahələri:** ən kiçik toxunma sahəsi təxminən 1.5 sm × 1.5 sm (≈ `90 * var(--u)`) olmalıdır.
- Monitorun nisbəti dəqiq 9:16 olmasa da, bölmə 4-dəki `--u` sistemi oyunu proporsiyanı pozmadan mərkəzdə saxlayır.

---

## 1. Oyun axını (state machine)

```
RULES  ──[DAVAM ET]──▶  START  ──[BAŞLA]──▶  GAME  ──[12/12 yerləşdi]──▶  RESULT
  ▲                                                                          │
  └──────────────────────────[YENİDƏN OYNA]──────────────────────────────────┘
```

| State | Ekran | Məzmun |
|---|---|---|
| `rules` | 01 | Oyun qaydaları, 3 bənd, “DAVAM ET” düyməsi |
| `start` | 02 | Şəhər adı (BAKI), tam şəkil, “ƏN YAXŞI VAXT: mm:ss”, “BAŞLA” düyməsi |
| `game` | 03–06 | Taymer, ən yaxşı vaxt, 4×3 puzzle sahəsi, ipucu mətni, aşağıda 12 qarışıq hissə |
| `result` | 07 | “NƏTİCƏ”, böyük vaxt, ən yaxşı vaxt, tamamlanmış şəkil, “YENİDƏN OYNA” |

- “YENİDƏN OYNA” istifadəçini **rules** ekranına qaytarır (`config.restartTarget`: `'rules' | 'start'`, default `'rules'`).
- Hər yeni oyunda bütün state tam sıfırlanır: taymer, seçimlər, yerləşmiş hissələr, animasiyalar.
- Ekranlar arası keçid animasiyasız, birbaşa olur.

---

## 2. Oyun mexanikası (GAME ekranı)

### 2.1 Başlanğıc
- Puzzle sahəsi: **4 sütun × 3 sətir = 12 xana**, hamısı boş. Yalnız boz konturlar görünür (ekran 03).
- Aşağıdakı tray-də 12 hissə **hər oyunda random sırada** düzülür (Fisher–Yates shuffle). Shuffle nəticəsi düzgün sıraya bərabər çıxarsa, yenidən qarışdırılır.
- Taymer GAME ekranı açılanda `00:00`-dan başlayır.

### 2.2 Seçim məntiqi
Əsas axın (qaydalarda yazıldığı kimi): **əvvəl boş xana, sonra hissə.**

1. İstifadəçi boş xanaya toxunur → xana **lime rəngli qalın kontur** ilə yanır (ekran 04). Eyni anda yalnız bir xana seçilə bilər. Başqa boş xanaya toxunanda seçim ora keçir. Seçilmiş xanaya təkrar toxunanda seçim ləğv olur.
2. Xana seçili ikən istifadəçi aşağıdan hissəyə toxunur:
   - **Düzgündürsə** (`piece.correctIndex === selectedSlotIndex`): hissə tray-dəki yerindən xanaya **animasiya ilə gedir** və yerinə oturur (ekran 05). Tray-də onun yeri **boş qalır**, digər hissələr sürüşmür. Xananın seçimi təmizlənir, yerləşmiş xana artıq kliklənmir.
   - **Yanlışdırsa**: hissə **narıncı kontur** alır, yuxarı sağ küncdə narıncı dairə içində **✕ ikonu** çıxır və hissə **titrəyir** (shake, ≈400ms) (ekran 06). ≈700ms sonra narıncı vəziyyət yox olur. Xana seçili qalır ki, istifadəçi başqa hissə yoxlaya bilsin.
3. Xana seçilməmiş halda hissəyə toxunulsa, `config.allowPieceFirst` aktivdirsə (default `true`) hissə seçilir (lime kontur). Sonra xanaya toxunanda eyni yoxlama işləyir: düzgündürsə hissə xanaya uçur, yanlışdırsa hissə titrəyir. Bu rejim də qaydalarla ziddiyyət yaratmır.
4. 12-ci hissə yerləşəndə taymer dayanır. Son hissənin animasiyası bitdikdən sonra ≈500ms gözlənilir və RESULT ekranı açılır.

### 2.3 Qadağalar / kənar hallar
- Animasiya gedərkən yeni klikləri blokla (`isAnimating` flag).
- Sürətli çoxlu toxunuşda bir hissənin iki dəfə yerləşməsinə icazə verilməməlidir.
- Yerləşmiş hissə və xanalar interaktiv deyil.

### 2.4 Vaxt və rekord
- Vaxtı `performance.now()` ilə hesabla. `setInterval` sayğacı ilə toplamamalısan. Ekranı `requestAnimationFrame` ilə yenilə, amma yalnız saniyə dəyişəndə DOM-a yaz.
- Format: `mm:ss` (60 dəqiqədən çox olsa `mm` artmağa davam edir, məsələn `75:02`).
- Ən yaxşı vaxt şəhər üzrə saxlanılır (`localStorage`, açar: `airex.cityPuzzle.best.<cityId>`). Storage ayrıca modulda olmalıdır (Angular-da service ilə əvəz ediləcək). `try/catch` ilə qorunmalıdır.
- Rekord hələ yoxdursa `--:--` göstər.
- RESULT ekranında yeni rekord qırılıbsa, vaxtın altında lime rəngdə **“YENİ REKORD!”** yazısı çıxsın və “ƏN YAXŞI VAXT” yeni dəyərlə göstərilsin.

---

## 3. Vizual dizayn

### 3.1 Rənglər

```css
:root {
  /* Təsdiqlənmiş rənglər */
  --c-accent:        #C7FF00; /* yaşıl: düymələr, seçim, vurğu, ən yaxşı vaxt */
  --c-bg:            #262A37; /* əsas fon */
  --c-text-muted:    #C3C6C8; /* "CITY PUZZLE", "VAXT", "ƏN YAXŞI VAXT" etiketləri */
  --c-text:          #FFFFFF; /* ağ */
  --c-error:         #FB7232; /* yanlış seçim: kontur + ✕ dairəsi */

  /* Törəmə rənglər (yuxarıdakılardan) */
  --c-accent-ink:    var(--c-bg);       /* yaşıl düymə üzərindəki mətn */
  --c-stroke:        var(--c-text-muted); /* puzzle sahəsi və hissələrin boz konturu */
  --c-divider:       rgb(195 198 200 / 0.2); /* muted rəngin 20%-i */
}
```

Kodda heç bir rəng birbaşa (hex ilə) yazılmamalıdır, yalnız bu dəyişənlər istifadə olunur. SVG-lərdəki rənglər də CSS-dən (`stroke: var(--c-stroke)`) idarə olunur.

### 3.2 Şrift
- **Inter** (400/500/600/700/800), **lokal `woff2` fayllar** ilə `@font-face` vasitəsilə (`assets/fonts/`). Google Fonts linki istifadə olunmamalıdır. `font-display: block` təyin olunmalıdır. Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- `<html lang="az">` mütləqdir.
- Böyük hərfli mətnləri HTML-də **artıq böyük hərflə** yaz (`NƏTİCƏ`, `YENİDƏN OYNA`, `ƏN YAXŞI VAXT`). `text-transform` istifadə etmə, çünki Azərbaycan dilində i/İ çevrilməsi səhv çıxa bilər.
- Rəqəmlər üçün `font-variant-numeric: tabular-nums;` istifadə et, taymer “tullanmasın”.

### 3.3 Ölçülər (1080×1920 baza dizayn, px)

| Element | Dəyər |
|---|---|
| Yan padding | 64 |
| Header (logo sol, “CITY PUZZLE” sağ) | top 64, logo hündürlüyü ≈66, “CITY PUZZLE” ≈30, semibold, muted |
| Ekran başlığı (BAKI, NƏTİCƏ) | ≈80, extra-bold, ağ |
| Rules başlığı | “CITY PUZZLE” lime + “OYUN QAYDALARI” ağ, ≈80, extra-bold, 2 sətir |
| Başlıq altı divider | 1px, `--c-divider` |
| Rules sətirləri | hündürlük ≈340, arasında 1px divider. Nömrə lime ≈40. Mətn ağ ≈44, medium. Sağda xətti ikon ≈80 |
| Əsas düymə | eni tam (64 padding ilə), hündürlüyü 160, alt boşluq 64, fon lime, mətn ≈44 bold, radius 0 |
| Start şəkli | eni 952 (tam kontent eni), 4:3 |
| Taymer bloku | etiket (“VAXT”, “ƏN YAXŞI VAXT”) ≈22 muted. Dəyər ≈52 bold. Soldakı ağ, sağdakı lime |
| Puzzle sahəsi | ≈800×600, mərkəzdə, xana 200×200, kontur 3px `--c-stroke` |
| Seçilmiş xana konturu | 6px lime |
| İpucu mətni | “Boş xanaya toxun, sonra uyğun hissəni seç.” ≈30, ağ |
| Tray | 4×3 grid, xana addımı ≈260 |
| Hissə tray-də | xana ölçüsü ≈200 + çıxıntılar, 3px açıq boz kontur |
| Yanlış hissə | 6px `--c-error` kontur + sağ yuxarıda Ø≈44 narıncı dairə, içində ✕ (`--c-bg` rəngində; ayrıca qara token yoxdur) |
| Result vaxtı | ≈230, extra-bold. “VAXT” etiketi ≈64 bold |
| Result şəkli | 800×600 |

---

## 4. Dinamik ölçülər (full container)

Oyun bütün səhifəni yox, **yerləşdiyi konteyneri tam doldurur**. Angular-da bir komponentin içinə qoyulacaq.

- Kök element: `.cp-app { width:100%; height:100%; container-type:size; overflow:hidden; }`
- Bütün ölçülər 1080×1920 bazasına nisbətən bir vahidlə hesablanır, proporsiya pozulmur:

```css
.cp-app {
  /* 1 dizayn pikseli = konteynerə sığan ən kiçik nisbət */
  --u: min(calc(100cqw / 1080), calc(100cqh / 1920));
}
.cp-title  { font-size: calc(80 * var(--u)); }
.cp-button { height: calc(160 * var(--u)); }
```

- Konteyner nisbəti 9:16 deyilsə, səhnə (`.cp-stage`) mərkəzdə qalır, kənarlarda `--c-bg` fonu görünür (letterbox). `transform: scale()` istifadə etmə, ölçüləri yalnız `--u` ilə ver.
- Ekranın içi flex-column ilə qurulur, düymə həmişə aşağıya yapışıq qalır.
- Puzzle sahəsi və tray ölçüləri də `--u` ilə hesablanır. Hissələrin mövqeyi isə JS-də `getBoundingClientRect()` ilə ölçülür, ona görə istənilən ölçüdə dəqiq oturur.
- `ResizeObserver` ilə konteyner ölçüsü dəyişəndə yerləşmiş hissələrin mövqeyi yenilənməlidir. Ən yaxşısı yerləşmiş hissələri faiz (%) ilə mövqeyləndirməkdir, onda yenidən hesablamağa ehtiyac qalmır.

---

## 5. Assetlər və SVG qaydaları

### 5.1 Fayllar
```
assets/
  brand/airex-logo.svg
  icons/rule-tap.svg  rule-puzzle.svg  rule-timer.svg  error-x.svg
  cities/baku/
    full.webp            # tam şəkil (start + result), 4:3, min 1600×1200
    board.svg            # puzzle sahəsi: 12 AYRI <path>
    pieces/piece-00.svg … piece-11.svg
```

### 5.2 `board.svg`
- `viewBox="0 0 400 300"` (xana = 100 vahid).
- Hər xana ayrı `<path id="slot-N" data-index="N">` olmalıdır (N = `row * 4 + col`, 0–11, soldan sağa, yuxarıdan aşağı). Birləşdirilmiş tək kontur **olmamalıdır**.
- `fill="transparent"`, `stroke` CSS-dən idarə olunur (`.slot`, `.slot.is-selected`). SVG içinə inline `style` yazılmamalıdır.
- Kod SVG-ni `fetch` edib inline yerləşdirir ki, path-lara klik və class əlavə etmək mümkün olsun.
- Seçilmiş xananın konturu qonşu xanaların altında qalmasın. Bunun üçün ayrıca highlight qatı istifadə et: `<use href="#slot-N" class="slot-highlight">` SVG-nin sonuna əlavə olunur.
- Toxunma sahəsi: `pointer-events: all` (fill şəffaf olsa da klik tutulsun).

### 5.3 Hissə SVG-ləri (`piece-NN.svg`)
- Fayl adı nömrəsi = düzgün xana indeksi (`piece-05.svg` → `slot-5`).
- **Bütün hissələrin viewBox-u eyni olmalıdır**: `viewBox="-25 -25 150 150"`. Xana 0..100 aralığındadır, çıxıntılar üçün hər tərəfdən 25 vahid boşluq saxlanılır. Bu şərt pozulsa, hissələr yerinə düz oturmayacaq.
- Hissənin forması `board.svg`-dəki uyğun `slot-N` path-ı ilə **eyni koordinatda** olmalıdır.
- Hissənin içində şəkil `clipPath` ilə kəsilir. Kontur ayrıca `<path class="piece-outline">` kimi verilir ki, CSS ilə rəngi dəyişdirilə bilsin (normal / seçilmiş / yanlış).
- Ekranda hissə elementinin ölçüsü: `width = cellSize * 1.5`. Mövqe: `left = col * cellSize - cellSize * 0.25`, `top` da eyni qayda ilə.

---

## 6. Texnologiyalar və kitabxanalar

| Nə | Nə üçün | Qoşulma |
|---|---|---|
| **modern-normalize** 3.0.1 | CSS reset | `vendor/modern-normalize.css` (+ `modern-normalize.LICENSE.txt`, MIT) |
| Öz `reset.css` | əlavə kiosk reset (aşağıda) | `css/reset.css` |
| **Inter** 4.1 (hinted) | şrift, 400/500/600/700/800 | `assets/fonts/Inter-*.woff2` (+ `Inter.LICENSE.txt`, OFL), `@font-face` blokları `css/fonts.css`-də |

**Animasiya kitabxanası istifadə olunmur.** Oyunda cəmi iki animasiya var (bölmə 7). Hər ikisi brauzerin daxili imkanları ilə yazılır: CSS `@keyframes` və **Web Animations API** (`element.animate()`). GSAP, anime.js və s. qoşulmamalıdır.

**Heç bir fayl CDN-dən və ya xarici linkdən yüklənməməlidir.** modern-normalize bir dəfə yüklənib `vendor/` qovluğuna qoyulur. Başqa kitabxana (jQuery, framework, bundler) istifadə olunmamalıdır.

### 6.1 Kiosk üçün əlavə reset
```css
html, body { height:100%; margin:0; background:var(--c-bg); }
* { -webkit-tap-highlight-color: transparent; }
.cp-app {
  user-select: none; -webkit-user-select: none;
  touch-action: manipulation;          /* double-tap zoom yoxdur */
  -webkit-touch-callout: none;
  overscroll-behavior: none;
}
img, svg { display:block; max-width:100%; -webkit-user-drag:none; }
button { font:inherit; border:0; cursor:pointer; }
```
- `contextmenu` hadisəsini kök elementdə blokla (long-press menyusu).
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`
- Bütün şəkillər və SVG-lər oyun başlamazdan əvvəl preload olunmalıdır (`Promise.all`). Bu müddətdə loading vəziyyəti göstərilir.

### 6.2 Offline iş rejimi (internet olmaya da bilər)
Oyun **internetdən tam asılı olmamalıdır**. İnternet kəsiləndə heç bir funksiya pozulmamalıdır.

1. **Bütün resurslar lokaldır**: kod, CSS reset (`vendor/`), şriftlər, şəkillər, SVG-lər. Xarici sorğu yoxdur.
2. **Service Worker** (`sw.js`) əlavə olunur. Oyun serverdən (URL ilə) açılanda bütün faylları ilk yükləmədə keşləyir (precache), sonra internet olmasa da keşdən işləyir.
   - Strategiya: *cache-first*. Bütün faylların siyahısı `sw.js`-də `PRECACHE` massivində saxlanılır.
   - Keş adına versiya əlavə olunur (`city-puzzle-v1`). Yeni versiya çıxanda köhnə keş `activate` hadisəsində silinir.
   - Qeydiyyat yalnız `core/` modulunda aparılır və `'serviceWorker' in navigator` yoxlanılır. Angular-a keçəndə bunun əvəzinə `@angular/service-worker` istifadə olunacaq.
3. **Ən yaxşı vaxt** `localStorage`-da saxlanılır, internetə ehtiyac yoxdur. Gələcəkdə server əlavə olunarsa: nəticə əvvəl lokal yazılır, sonra internet olanda (`online` hadisəsi) serverə göndərilir (növbə / outbox məntiqi). Bu hissə indi yazılmır, amma `storage.js` interfeysi buna mane olmamalıdır.
4. Service Worker yalnız `http://localhost` və ya `https` üzərində işləyir. `file://` ilə açmaq olmaz.

**Kioskda quraşdırma (Windows):**

1. Oyun faylları kompüterdə saxlanılır (məsələn `C:\city-puzzle\`) və lokal statik serverlə açılır. Variantlar: Node.js qurulubsa `npx serve -l 3000`, qurulmayıbsa portativ statik server (məsələn `miniserve.exe`) istifadə oluna bilər.
2. Brauzer kiosk rejimində açılır:
   - Edge: `msedge --kiosk http://localhost:3000 --edge-kiosk-type=fullscreen --no-first-run`
   - Chrome: `chrome --kiosk --disable-pinch --overscroll-history-navigation=0 --no-first-run http://localhost:3000`
3. Server və brauzer Windows açılanda avtomatik başlamalıdır (`.bat` fayl + Task Scheduler və ya Startup qovluğu).
4. Windows toxunma jestləri söndürülməlidir: ekranın kənarından sürüşdürmə (edge swipe), toxunma klaviaturasının avtomatik açılması, bildirişlər.
5. **Windows aktivləşdirilməlidir.** Aktiv olmayan Windows-da ekranın küncündə “Activate Windows” yazısı oyunun üstündə görünür.
6. Ekranın sönməsi və yuxu rejimi söndürülməlidir.

Bu quraşdırmada internet heç vaxt lazım olmur. Service Worker isə oyun uzaq serverdən açılan hal üçün əlavə qorumadır.

---

## 7. Animasiyalar (cəmi 2 dənə, kitabxanasız)

Oyunda **yalnız iki animasiya** var. Ekran keçidləri, seçim effektləri və nəticə ekranı animasiyasızdır. Seçilmiş xana və yanlış hissə sadəcə class ilə rəng dəyişir (`.is-selected`, `.is-error`).

### 7.1 Yanlış seçim: titrəmə (shake)
CSS `@keyframes` ilə yazılır:

```css
@keyframes cp-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(calc(-14 * var(--u))); }
  30% { transform: translateX(calc( 14 * var(--u))); }
  45% { transform: translateX(calc(-10 * var(--u))); }
  60% { transform: translateX(calc( 10 * var(--u))); }
  75% { transform: translateX(calc( -5 * var(--u))); }
  90% { transform: translateX(calc(  5 * var(--u))); }
}
.cp-piece.is-error { animation: cp-shake 400ms ease-in-out; }
```

- JS hissəyə `.is-error` class-ı əlavə edir (narıncı kontur və ✕ ikonu da bu class ilə görünür). `animationend` hadisəsindən sonra (təxminən 700ms-də) class silinir.
- Eyni hissə ardıcıl yanlış seçilsə, animasiya yenidən başlamalıdır: əvvəl class silinir, sonra `requestAnimationFrame` ilə yenidən əlavə olunur.

### 7.2 Düzgün seçim: hissənin yerinə getməsi
**FLIP texnikası + Web Animations API** ilə yazılır:

1. **First:** hissənin tray-dəki mövqeyi ölçülür (`getBoundingClientRect()`).
2. **Last:** hissə DOM-da board üzərindəki qata, öz xanasının son mövqeyinə köçürülür və yeni mövqeyi ölçülür.
3. **Invert:** iki mövqe arasındakı fərq hesablanır (`dx`, `dy`, `scale`).
4. **Play:**

```js
const anim = piece.animate(
  [
    { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
    { transform: 'translate(0, 0) scale(1)' }
  ],
  { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
);
await anim.finished;
```

- Animasiya zamanı hissə digər elementlərin üstündə görünməlidir (`z-index`).
- `anim.finished` gözlənilir, bundan sonra `isAnimating = false` olur və hissə `.is-placed` vəziyyətinə keçir.
- Tray-də hissənin yeri boş qalır (görünməz placeholder saxlanılır, digər hissələr sürüşmür).

### 7.3 Ümumi
- `prefers-reduced-motion` aktivdirsə: shake olmur (yalnız narıncı vəziyyət göstərilir), hissə yerinə animasiyasız qoyulur.
- Davam edən animasiyalar `destroy()` zamanı `cancel()` ilə dayandırılır.

---

## 8. Fayl strukturu

```
city-puzzle/
  index.html
  css/
    reset.css
    fonts.css           # Inter @font-face (index.html-də tokens.css-dən əvvəl qoşulur)
    tokens.css          # rənglər, --u, şrift
    layout.css          # header, ekranlar, düymələr
    game.css            # board, tray, piece vəziyyətləri
  js/
    main.js             # bootstrap: konfiq yüklə, PuzzleApp yarat
    config.js           # şəhər konfiqi, ayarlar
    app/PuzzleApp.js    # state machine, ekranlar arası keçid
    game/GameEngine.js  # SAF məntiq: state, yoxlama (DOM yoxdur)
    game/BoardView.js   # board.svg render, xana seçimi
    game/TrayView.js    # hissələrin render-i, seçim, vəziyyətlər
    game/animations.js  # 2 animasiya: shake və hissənin yerinə getməsi
    core/Timer.js
    core/storage.js
    core/shuffle.js
    core/assets.js      # preload, SVG fetch
    core/Emitter.js     # sadə event emitter
    core/sw-register.js # Service Worker qeydiyyatı
    core/env.js         # URL flag-ləri, kök elementin tapılması (window/document yalnız burada)
  vendor/               # modern-normalize.css + LICENSE
  sw.js                 # offline keş
  assets/
    fonts/              # Inter woff2
    …
```

### 8.1 Konfiq nümunəsi
```js
export const CITY_BAKU = {
  id: 'baku',
  title: 'BAKI',
  cols: 4,
  rows: 3,
  image: 'assets/cities/baku/full.webp',
  board: 'assets/cities/baku/board.svg',
  pieces: Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    correctIndex: i,
    src: `assets/cities/baku/pieces/piece-${String(i).padStart(2, '0')}.svg`,
  })),
};

export const SETTINGS = {
  restartTarget: 'rules',
  allowPieceFirst: true,
  errorResetMs: 700,
  idleResetMs: 90000,   // toxunuş olmasa rules ekranına qayıt (0 = söndür)
};

export const DEBUG = false; // true → dev düyməsi görünür (bax: 9.1)
```

---

## 9. Kod tələbləri

- ES modules (`<script type="module">`). Qlobal dəyişən olmamalıdır, `window`-a heç nə yazılmamalıdır.
- Bütün DOM sorğuları **kök elementə görə** aparılır: `this.root.querySelector(...)`. `document.getElementById` istifadə olunmamalıdır.
- HTML-də inline `onclick` və inline `style` olmamalıdır. Hadisələr `addEventListener` ilə qoşulur. Kliklər üçün `pointerup` hadisəsi istifadə olunur (mouse və touch üçün eyni).
- Event delegation: board və tray üçün bir listener, hədəf isə `data-index` / `data-piece-id` ilə müəyyən olunur.
- Vəziyyət dəyişiklikləri yalnız class ilə idarə olunur: `.is-selected`, `.is-placed`, `.is-error`, `.is-active`.
- `GameEngine` DOM-a toxunmur. O, state saxlayır və event yayır (`slotSelected`, `placed`, `wrong`, `completed`). View-lar bu eventlərə qulaq asır.
- Hər class-ın `destroy()` metodu olmalıdır: listener-ləri silir, `ResizeObserver`-i disconnect edir, rAF-ı ləğv edir, davam edən animasiyaları `animation.cancel()` ilə dayandırır.
- `innerHTML`-ə yalnız öz assetlərimiz (SVG) yazıla bilər. Xarici mətn yazılmamalıdır.
- Kod JSDoc ilə şərh olunmalıdır. Dəyişən və funksiya adları ingiliscə, UI mətnləri Azərbaycanca olmalıdır.
- Konsolda error və warning olmamalıdır.
- Oyun lokal serverdən açılmalıdır (`npx serve`). ES modules və `fetch` `file://` ilə işləmir.

### 9.1 Dev düyməsi (test üçün)
- GAME ekranında müvəqqəti “tamamla” düyməsi. Birbaşa RESULT ekranına **keçmir**: qalan hissələri öz yerlərinə qoyur və oyun adi qaydada bitir. Beləcə taymerin dayanması, rekordun yazılması və “YENİ REKORD!” real axında yoxlanılır.
- Düymə yalnız `config.js`-də `DEBUG: true` olanda və ya URL-də `?dev` olanda görünür.
- `DEBUG: false` olanda (və `?dev` yoxdursa) düymə DOM-a ümumiyyətlə əlavə olunmur.

---

## 10. Angular-a köçürmə üçün qaydalar

Kod elə yazılmalıdır ki, Angular-a köçürüləndə məntiq dəyişmədən istifadə oluna bilsin:

| Vanilla | Angular qarşılığı |
|---|---|
| `GameEngine`, `Timer`, `shuffle`, `storage` | `@Injectable` service-lər (kod olduğu kimi köçürülür) |
| Hər ekran (`rules`, `start`, `game`, `result`) | ayrı standalone component |
| `PuzzleApp` state machine | parent component + `signal` state |
| `Emitter` eventləri | `Output()` / RxJS `Subject` |
| `animations.js` | eyni funksiyalar (Web Animations API Angular-da dəyişmədən işləyir), element `ElementRef` / `viewChild` ilə ötürülür |
| `destroy()` | `ngOnDestroy` |

- Funksiyalar DOM elementini **parametr kimi** qəbul etməlidir, özləri axtarmamalıdır.
- `window` / `document` / `localStorage` çağırışları yalnız `core/` modullarında olmalıdır (SSR-safe olsun).
- Konstruktorlarda side-effect olmamalıdır. Başlatma ayrıca `init()` / `mount()` metodu ilə edilir.
- Asset yolları konfiqdən gəlir (Angular-da `assets/` yolu dəyişə bilər).

---

## 11. UI mətnləri

| Açar | Mətn |
|---|---|
| brand | CITY PUZZLE |
| rules.title1 | CITY PUZZLE |
| rules.title2 | OYUN QAYDALARI |
| rules.1 | Boş xanaya toxun |
| rules.2 | Aşağıdan uyğun pazl hissəsini seç |
| rules.3 | Bütün 12 hissəni mümkün qədər tez tamamla |
| rules.cta | DAVAM ET |
| start.best | ƏN YAXŞI VAXT: |
| start.cta | BAŞLA |
| game.time | VAXT |
| game.best | ƏN YAXŞI VAXT |
| game.hint | Boş xanaya toxun, sonra uyğun hissəni seç. |
| result.title | NƏTİCƏ |
| result.time | VAXT |
| result.best | ƏN YAXŞI VAXT: |
| result.record | YENİ REKORD! |
| result.cta | YENİDƏN OYNA |

Oyun **yalnız Azərbaycan dilində** olacaq, çoxdillilik (i18n) lazım deyil. Ayrıca tərcümə faylı və ya dil seçimi qurulmamalıdır. Statik mətnlər birbaşa HTML-də yazılır. JS yalnız dinamik dəyərləri (vaxt, rekord, “YENİ REKORD!”) dəyişir.

---

## 12. Qəbul meyarları (checklist)

- [ ] 4 ekran dizayna piksel səviyyəsində uyğundur (1080×1920-də).
- [ ] 720×1280, 1440×2560 və qeyri-standart nisbətli konteynerdə proporsiya pozulmur.
- [ ] Hər oyunda hissələr fərqli random sıradadır.
- [ ] Xana seçimi lime ilə yanır, düzgün hissə animasiya ilə yerinə tam oturur (1px sürüşmə olmadan).
- [ ] Yanlış hissə narıncı olur, ✕ çıxır, titrəyir və geri qayıdır.
- [ ] Taymer dəqiqdir, tamamlananda dayanır. Result ekranında düzgün vaxt göstərilir.
- [ ] Ən yaxşı vaxt saxlanılır və yenilənir. Yeni rekord göstərilir.
- [ ] “YENİDƏN OYNA” tam sıfırlayır. 10 dəfə ardıcıl oynandıqda memory leak olmur (listener sayı artmır).
- [ ] Sürətli çoxlu toxunuşda bug yaranmır.
- [ ] Konsolda error yoxdur.
- [ ] DevTools → Network → *Offline* rejimində səhifə yenilənəndə oyun tam işləyir.
- [ ] Network tabında heç bir xarici domenə sorğu yoxdur.
- [ ] Production-da (`DEBUG: false`, `?dev` yoxdur) dev düyməsi görünmür.

---

## 13. Açıq suallar (developer başlamazdan əvvəl dəqiqləşdirilməlidir)

1. Şriftin təsdiqi (Inter?).
2. Monitorun dəqiq modeli və həlli (Windows → Display settings bölməsində görünür).
3. Ən yaxşı vaxt yalnız bu cihazda saxlanılır, yoxsa serverdən gəlir?
4. Səs effektləri lazımdırmı (düzgün / yanlış / tamamlandı)?
5. Hərəkətsizlik zamanı avtomatik başa qayıtma lazımdırmı, neçə saniyədən sonra?
6. Gələcəkdə başqa şəhərlər əlavə olunacaqmı? (Konfiq buna hazırdır.)
