import { useState, useEffect, useRef } from 'react';

export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const lastByElRef = useRef(new Map<HTMLElement, number>());
  const rafRef = useRef<number | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const collectWatchElements = (): HTMLElement[] => {
      const root =
        (document.querySelector('[data-ebay-root]') as HTMLElement | null) ??
        document.body;

      const containers = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-scroll-container][data-scroll-direction="vertical"]',
        ),
      );

      const visibleContainers = containers.filter((el) => el.offsetParent !== null);

      const watch: HTMLElement[] = [];
      for (const el of visibleContainers) watch.push(el);

      const scrollingEl = document.scrollingElement as HTMLElement | null;
      if (scrollingEl) watch.push(scrollingEl);

      return watch;
    };

    let watchElements = collectWatchElements();
    for (const el of watchElements) {
      if (!lastByElRef.current.has(el)) {
        lastByElRef.current.set(el, el.scrollTop);
      }
    }

    const step = () => {
      const nowWatchElements = collectWatchElements();
      if (nowWatchElements.length !== watchElements.length) {
        watchElements = nowWatchElements;
        for (const el of watchElements) {
          if (!lastByElRef.current.has(el)) {
            lastByElRef.current.set(el, el.scrollTop);
          }
        }
      }

      let bestEl: HTMLElement | null = null;
      let bestDelta = 0;
      let bestNext = 0;
      let bestPrev = 0;

      for (const el of watchElements) {
        const prev = lastByElRef.current.get(el) ?? el.scrollTop;
        const next = el.scrollTop;
        const delta = next - prev;

        if (Math.abs(delta) > Math.abs(bestDelta) && Math.abs(delta) >= 2) {
          bestEl = el;
          bestDelta = delta;
          bestNext = next;
          bestPrev = prev;
        }
      }

      if (bestEl) {
        activeElRef.current = bestEl;

        if (bestNext < 10) {
          setIsVisible(true);
        } else {
          setIsVisible(bestDelta < 0);
        }

        lastByElRef.current.set(bestEl, bestNext);
      } else if (activeElRef.current) {
        const el = activeElRef.current;
        const prev = lastByElRef.current.get(el) ?? el.scrollTop;
        const next = el.scrollTop;
        const delta = next - prev;

        if (Math.abs(delta) >= 2) {
          if (next < 10) {
            setIsVisible(true);
          } else {
            setIsVisible(delta < 0);
          }
          lastByElRef.current.set(el, next);
        }
      }

      rafRef.current = window.requestAnimationFrame(step);
    };

    setIsVisible(true);
    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastByElRef.current.clear();
      activeElRef.current = null;
    };
  }, []);

  return isVisible;
}
