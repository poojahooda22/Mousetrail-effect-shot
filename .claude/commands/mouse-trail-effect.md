Implement a mouse-following image trail effect in the hero section of this project, based on the Codrops ImageTrailEffects Demo 1.

Use the complete reference below — it contains the full architecture, translated GSAP v3 code, porting plan, and pitfalls. Follow the implementation checklist at the end.

---

# Mouse Trail Effect — Codrops Demo 1 Reference

## 1. What It Does
Mouse-following image trail: pre-loaded images spawn at cursor position, slide to catch up, then fade and shrink away. Pure DOM positioning via GSAP — no WebGL/Canvas.

## 2. Dependency Map

```
Original repo structure:
index.html (Demo 1)
├── css/base.css              — Layout, theming (CSS vars), loading overlay
├── js/imagesloaded.pkgd.min.js — Waits for all <img> to decode before init
├── js/TweenMax.min.js        — GSAP v2 (animation engine)
├── js/demo.js                — Demo 1 logic (Image class + ImageTrail class)
└── img/1.jpg … img/15.jpg    — 15 trail images (JPEG, ~250px wide)
```

| Original Dep | Role | Our Equivalent | Action |
|---|---|---|---|
| TweenMax (GSAP v2) | Animation | `gsap` v3.14.2 | Already installed — API migration only |
| imagesloaded | Image preloading | Native `Promise.all` + `img.decode()` | No install needed |
| 15 JPEGs | Trail pool | Place in `public/images/trail/` | Need to source/create images |
| Typekit fonts | Title styling | Our own font stack | Not required for trail logic |
| base.css | Layout/theme | Tailwind utilities | Translate to Tailwind classes |

**No new npm dependencies required.**

## 3. How It Works — Runtime Flow

### 3a. Initialization
```
preloadImages()                          // waits for all .content__img to load
  .then(() => {
    body.classList.remove('loading')      // hide loading overlay
    new ImageTrail()                      // boot the effect
  })
```
- `ImageTrail` constructor queries the content container, wraps each `<img>` in an `Image` instance
- `Image` caches `getBoundingClientRect()` and adds a resize listener
- Starts `requestAnimationFrame` loop immediately

### 3b. Mouse Tracking — Three-Position Model
| Variable | Updated | Purpose |
|---|---|---|
| `mousePos` | Every `mousemove` event | Real cursor coordinates |
| `lastMousePos` | When an image spawns | Snapshot used to measure travel distance |
| `cacheMousePos` | Every rAF frame (lerp 0.1) | Smoothed/lagged position — images appear HERE |

The lag between `cacheMousePos` and `mousePos` creates the "trailing" feel. Images spawn at `cacheMousePos` and animate toward `mousePos`.

### 3c. rAF Render Loop
```
each frame:
  1. distance = hypot(mousePos - lastMousePos)
  2. cacheMousePos = lerp(cacheMousePos, mousePos, 0.1)
  3. if distance > 100px:
       showNextImage()
       zIndexVal++
       imgPosition = (imgPosition + 1) % 15
       lastMousePos = mousePos
  4. if ALL images idle (not tweening, opacity == 0):
       reset zIndexVal = 1
```

### 3d. Image Spawn Animation (per image)
```
t = 0.0s:  kill existing tweens on element
           set opacity=1, scale=1, zIndex=N
           position at (cacheMousePos - size/2)  ← lagged position

t = 0.0 → 0.9s:  slide x,y to (mousePos - size/2)     [expo.out]
t = 0.4 → 1.4s:  fade opacity to 0                      [power1.out]
t = 0.4 → 1.4s:  scale down to 0.2                      [quint.out]
```
Total visible time per image: ~1.4s. The 0.4s delay gives a moment of full visibility before decay.

### 3e. Pooling Strategy
- Fixed pool of 15 DOM `<img>` elements — **no DOM creation/destruction at runtime**
- Round-robin cycling via `imgPosition` (wraps 14 → 0)
- If a still-animating image is reused, `gsap.killTweensOf(el)` clears its tween first

## 4. Key Parameters

| Parameter | Default | Location | Effect | Tuning Range |
|---|---|---|---|---|
| `lerp factor` | `0.1` | `render()` | Lag between cached and real cursor. Lower = more trail spacing | 0.02–0.3 |
| `threshold` | `100` px | constructor | Min cursor travel to trigger next spawn | 50–200 |
| `pool size` | `15` | HTML (img count) | Max simultaneous trail elements | 10–20 |
| `slide duration` | `0.9` s | `showNextImage()` | Catch-up animation duration | |
| `slide easing` | `expo.out` | `showNextImage()` | Sharp deceleration on slide | |
| `fade delay` | `0.4` s | `showNextImage()` | Delay before decay begins | |
| `fade duration` | `1.0` s | `showNextImage()` | Opacity fade-out time | |
| `scale target` | `0.2` | `showNextImage()` | Final scale on disappearance | |
| `scale easing` | `quint.out` | `showNextImage()` | Smooth deceleration on shrink | |
| `img max-width` | `250px` | CSS / Tailwind class | Max image width | |

## 5. GSAP v2 → v3 Migration (already applied in code sketch below)

| GSAP v2 (original) | GSAP v3 (our project) |
|---|---|
| `new TimelineMax()` | `gsap.timeline()` |
| `TweenMax.set(el, {...})` | `gsap.set(el, {...})` |
| `TweenMax.killTweensOf(el)` | `gsap.killTweensOf(el)` |
| `TweenMax.isTweening(el)` | `gsap.isTweening(el)` |
| `.to(el, 0.9, {ease: Expo.easeOut, x})` | `.to(el, {duration: 0.9, ease: "expo.out", x})` |
| `Expo.easeOut` | `"expo.out"` |
| `Power1.easeOut` | `"power1.out"` |
| `Quint.easeOut` | `"quint.out"` |

**Key difference:** In v2, duration is the 2nd argument. In v3, duration moves inside the vars object.

## 6. File Structure to Create

```
src/
  effects/
    ImageTrail.ts            ← Core engine (pure TS, no React)
  components/
    HeroImageTrail.tsx       ← React wrapper component
public/
  images/
    trail/
      1.jpg … 15.jpg         ← Trail images
```

## 7. Complete GSAP v3 TypeScript Implementation

Use this as the starting point for `src/effects/ImageTrail.ts`:

```typescript
import gsap from 'gsap';

interface Point { x: number; y: number; }

interface TrailConfig {
  threshold: number;
  lerp: number;
}

const lerpVal = (a: number, b: number, n: number) => (1 - n) * a + n * b;
const dist = (p1: Point, p2: Point) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

class TrailImage {
  el: HTMLImageElement;
  rect!: DOMRect;

  constructor(el: HTMLImageElement) {
    this.el = el;
    this.getRect();
  }
  getRect() { this.rect = this.el.getBoundingClientRect(); }
  isActive() { return gsap.isTweening(this.el) || this.el.style.opacity !== '0'; }
}

export class ImageTrail {
  private images: TrailImage[] = [];
  private imgPosition = 0;
  private zIndexVal = 1;
  private threshold: number;
  private lerpFactor: number;
  private mousePos: Point = { x: 0, y: 0 };
  private lastMousePos: Point = { x: 0, y: 0 };
  private cacheMousePos: Point = { x: 0, y: 0 };
  private rafId = 0;
  private onMouseMove: (ev: MouseEvent) => void;
  private onResize: () => void;

  constructor(container: HTMLElement, config?: Partial<TrailConfig>) {
    this.threshold = config?.threshold ?? 100;
    this.lerpFactor = config?.lerp ?? 0.1;

    container.querySelectorAll<HTMLImageElement>('img').forEach(img => {
      this.images.push(new TrailImage(img));
    });

    this.onMouseMove = (ev: MouseEvent) => {
      this.mousePos = { x: ev.pageX, y: ev.pageY };
    };
    this.onResize = () => {
      this.images.forEach(img => {
        gsap.set(img.el, { scale: 1, x: 0, y: 0, opacity: 0 });
        img.getRect();
      });
    };

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('resize', this.onResize);
    this.rafId = requestAnimationFrame(() => this.render());
  }

  private render() {
    const d = dist(this.mousePos, this.lastMousePos);

    this.cacheMousePos.x = lerpVal(this.cacheMousePos.x || this.mousePos.x, this.mousePos.x, this.lerpFactor);
    this.cacheMousePos.y = lerpVal(this.cacheMousePos.y || this.mousePos.y, this.mousePos.y, this.lerpFactor);

    if (d > this.threshold) {
      this.showNextImage();
      this.zIndexVal++;
      this.imgPosition = (this.imgPosition + 1) % this.images.length;
      this.lastMousePos = { ...this.mousePos };
    }

    if (this.images.every(img => !img.isActive()) && this.zIndexVal !== 1) {
      this.zIndexVal = 1;
    }

    this.rafId = requestAnimationFrame(() => this.render());
  }

  private showNextImage() {
    const img = this.images[this.imgPosition];
    gsap.killTweensOf(img.el);

    gsap.timeline()
      .set(img.el, {
        opacity: 1,
        scale: 1,
        zIndex: this.zIndexVal,
        x: this.cacheMousePos.x - img.rect.width / 2,
        y: this.cacheMousePos.y - img.rect.height / 2,
      }, 0)
      .to(img.el, {
        duration: 0.9,
        ease: 'expo.out',
        x: this.mousePos.x - img.rect.width / 2,
        y: this.mousePos.y - img.rect.height / 2,
      }, 0)
      .to(img.el, {
        duration: 1,
        ease: 'power1.out',
        opacity: 0,
      }, 0.4)
      .to(img.el, {
        duration: 1,
        ease: 'quint.out',
        scale: 0.2,
      }, 0.4);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('resize', this.onResize);
    this.images.forEach(img => gsap.killTweensOf(img.el));
  }
}
```

## 8. React Wrapper Pattern

For `src/components/HeroImageTrail.tsx`:

```tsx
import { useRef, useEffect } from 'react';
import { ImageTrail } from '../effects/ImageTrail';

const IMAGE_COUNT = 15;
const images = Array.from({ length: IMAGE_COUNT }, (_, i) => `/images/trail/${i + 1}.jpg`);

export function HeroImageTrail() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let trail: ImageTrail | null = null;
    let isMounted = true;

    const imgs = container.querySelectorAll<HTMLImageElement>('img');
    Promise.all(Array.from(imgs).map(img => img.decode())).then(() => {
      if (isMounted) {
        trail = new ImageTrail(container);
      }
    });

    return () => {
      isMounted = false;
      trail?.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-screen overflow-hidden flex items-center justify-center [isolation:isolate]"
    >
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="absolute top-0 left-0 opacity-0 will-change-transform max-w-[250px] pointer-events-none"
        />
      ))}
      <h3 className="relative z-[10000] text-[27vw] font-bold mix-blend-difference pointer-events-none [-webkit-text-stroke:2px_white] [-webkit-text-fill-color:transparent]">
        llssmmhh
      </h3>
    </div>
  );
}
```

## 9. Pitfalls & Edge Cases

| Issue | Detail | Fix |
|---|---|---|
| **Memory leak on unmount** | rAF loop + window listeners persist after React unmount | `destroy()` method is mandatory |
| **`docEl` undefined (original bug)** | Original references `docEl` in fallback mouse handler but never declares it | Dropped — use `ev.pageX`/`ev.pageY` only |
| **Implicit globals (original bug)** | `let mousePos = lastMousePos = cacheMousePos = {x:0,y:0}` — only `mousePos` gets `let` | All declared separately in our version |
| **`overflow: hidden` on body** | Original sets this globally; breaks scrolling in an SPA | Scope to hero container only |
| **Stale `getBoundingClientRect`** | Cached on init + resize only; layout shifts can invalidate | Recalculate on container scroll/resize |
| **Preload race condition** | Unmount before preload completes → instantiate on detached DOM | Guard with `isMounted` flag |
| **z-index accumulation** | Grows unbounded during active use | Idle detection resets to 1 (already handled) |
| **Mobile/touch** | Only `mousemove` — no touch support | Add `touchmove` or disable on mobile |
| **React StrictMode double-mount** | Dev mode mounts twice | `destroy()` in cleanup handles this |
| **`prefers-reduced-motion`** | No accessibility consideration in original | Check media query and disable/simplify trail |

## 10. Implementation Checklist

- [ ] Source/create 15 trail images, place in `public/images/trail/`
- [ ] Create `src/effects/ImageTrail.ts` (use code from section 7)
- [ ] Create `src/components/HeroImageTrail.tsx` (use pattern from section 8)
- [ ] Add container + image CSS (Tailwind utilities)
- [ ] Add title with `mix-blend-mode: difference` + text-stroke
- [ ] Wire `<HeroImageTrail />` into `App.tsx`
- [ ] Add `prefers-reduced-motion` check
- [ ] Add `destroy()` cleanup in useEffect return
- [ ] Test resize behavior
- [ ] Test React StrictMode double-mount
- [ ] Verify no memory leaks (DevTools Performance Monitor)

## 11. Original Source Reference
- Repo: https://github.com/codrops/ImageTrailEffects
- Demo 1 entry: `index.html` → `js/demo.js`
- License: MIT
