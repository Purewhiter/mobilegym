import { useState, useEffect, useRef } from 'react';

const SCROLL_CONTAINER_SELECTOR =
  '[data-scroll-container][data-scroll-direction="vertical"]';

/** Scroll steps smaller than this are jitter and ignored. */
const MIN_DELTA_PX = 2;
/** Within this distance of the top the tab bar is always shown. */
const TOP_REVEAL_PX = 10;

/**
 * Whether the tab bar should show: hidden while scrolling down, shown while
 * scrolling up or near the top. Driven by scroll events, so it costs nothing
 * while nothing scrolls (no per-frame polling).
 */
export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const lastByElRef = useRef(new Map<HTMLElement, number>());

  useEffect(() => {
    const lastByEl = lastByElRef.current;

    const handleScrollOf = (el: HTMLElement) => {
      const prev = lastByEl.get(el);
      const next = el.scrollTop;
      if (prev === undefined) {
        // First event from this container: record the baseline only.
        lastByEl.set(el, next);
        return;
      }
      const delta = next - prev;
      if (Math.abs(delta) < MIN_DELTA_PX) return;
      lastByEl.set(el, next);
      setIsVisible(next < TOP_REVEAL_PX ? true : delta < 0);
    };

    const root =
      (document.querySelector('[data-ebay-root]') as HTMLElement | null) ??
      document.body;

    // Record current containers so the first scroll event already has a baseline.
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(SCROLL_CONTAINER_SELECTOR))) {
      lastByEl.set(el, el.scrollTop);
    }

    // Element scroll events do not bubble but do pass the capture phase, so one
    // capturing listener on the app root covers containers mounted later too.
    const onCapturedScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches(SCROLL_CONTAINER_SELECTOR)) return;
      handleScrollOf(target);
    };

    // Viewport scrolls target the document and never reach the root's capture path.
    const onDocumentScroll = () => {
      const scrollingEl = document.scrollingElement as HTMLElement | null;
      if (scrollingEl) handleScrollOf(scrollingEl);
    };

    setIsVisible(true);
    root.addEventListener('scroll', onCapturedScroll, { capture: true, passive: true });
    document.addEventListener('scroll', onDocumentScroll, { passive: true });

    return () => {
      root.removeEventListener('scroll', onCapturedScroll, { capture: true });
      document.removeEventListener('scroll', onDocumentScroll);
      lastByEl.clear();
    };
  }, []);

  return isVisible;
}
