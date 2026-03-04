import gsap from 'gsap';

interface Point {
  x: number;
  y: number;
}

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

  getRect() {
    this.rect = this.el.getBoundingClientRect();
  }

  isActive() {
    return gsap.isTweening(this.el) || this.el.style.opacity !== '0';
  }
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

    container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      this.images.push(new TrailImage(img));
    });

    this.onMouseMove = (ev: MouseEvent) => {
      this.mousePos = { x: ev.pageX, y: ev.pageY };
    };

    this.onResize = () => {
      this.images.forEach((img) => {
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

    this.cacheMousePos.x = lerpVal(
      this.cacheMousePos.x || this.mousePos.x,
      this.mousePos.x,
      this.lerpFactor,
    );
    this.cacheMousePos.y = lerpVal(
      this.cacheMousePos.y || this.mousePos.y,
      this.mousePos.y,
      this.lerpFactor,
    );

    if (d > this.threshold) {
      this.showNextImage();
      this.zIndexVal++;
      this.imgPosition = (this.imgPosition + 1) % this.images.length;
      this.lastMousePos = { ...this.mousePos };
    }

    if (this.images.every((img) => !img.isActive()) && this.zIndexVal !== 1) {
      this.zIndexVal = 1;
    }

    this.rafId = requestAnimationFrame(() => this.render());
  }

  private showNextImage() {
    const img = this.images[this.imgPosition];
    gsap.killTweensOf(img.el);

    gsap
      .timeline()
      .set(
        img.el,
        {
          opacity: 1,
          scale: 1,
          zIndex: this.zIndexVal,
          x: this.cacheMousePos.x - img.rect.width / 2,
          y: this.cacheMousePos.y - img.rect.height / 2,
        },
        0,
      )
      .to(
        img.el,
        {
          duration: 0.9,
          ease: 'expo.out',
          x: this.mousePos.x - img.rect.width / 2,
          y: this.mousePos.y - img.rect.height / 2,
        },
        0,
      )
      .to(
        img.el,
        {
          duration: 1,
          ease: 'power1.out',
          opacity: 0,
        },
        0.4,
      )
      .to(
        img.el,
        {
          duration: 1,
          ease: 'quint.out',
          scale: 0.2,
        },
        0.4,
      );
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('resize', this.onResize);
    this.images.forEach((img) => gsap.killTweensOf(img.el));
  }
}
