import { useRef, useEffect } from 'react';
import { ImageTrail } from '../effects/ImageTrail';

const IMAGE_COUNT = 12;
const images = Array.from(
  { length: IMAGE_COUNT },
  (_, i) => `/images/trail/${i + 1}.jpg`,
);

export function HeroImageTrail() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    let trail: ImageTrail | null = null;
    let isMounted = true;

    const imgs = container.querySelectorAll<HTMLImageElement>('img');
    Promise.all(Array.from(imgs).map((img) => img.decode())).then(() => {
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
      className="relative h-screen overflow-hidden flex items-center justify-center"
      style={{ isolation: 'isolate' }}
    >
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="absolute top-0 left-0 opacity-0 will-change-transform pointer-events-none"
          style={{ maxWidth: '250px' }}
        />
      ))}

      <h2 className="relative z-[10000] w-[59%] text-[4.6rem] leading-[1.1] text-center text-zinc-100 pointer-events-none mix-blend-difference">
        Next-Gen Websites. Immersive, and Fast. I build digital experiences that
        feel expensive, load instantly, and turn visitors into loyal clients.
      </h2>
    </div>
  );
}
