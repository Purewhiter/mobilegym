import { useState, useEffect, useRef } from 'react';

const SCROLL_CONTAINER_SELECTOR =
  '[data-scroll-container][data-scroll-direction="vertical"]';

/** 单次滚动位移小于该值时忽略（抖动过滤） */
const MIN_DELTA_PX = 2;
/** 距顶部小于该值时强制显示 TabBar */
const TOP_REVEAL_PX = 10;

export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const lastByElRef = useRef(new Map<HTMLElement, number>());

  useEffect(() => {
    const lastByEl = lastByElRef.current;

    const handleScrollOf = (el: HTMLElement) => {
      const prev = lastByEl.get(el);
      const next = el.scrollTop;
      if (prev === undefined) {
        // 首次收到该容器的事件：只记录基准，不判定方向
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

    // 挂载时收集当前容器，记录滚动基准，使首个 scroll 事件即可判定方向
    for (const el of Array.from(
      root.querySelectorAll<HTMLElement>(SCROLL_CONTAINER_SELECTOR),
    )) {
      lastByEl.set(el, el.scrollTop);
    }

    // scroll 事件不冒泡，但会经过捕获路径：在 app 根节点用捕获监听即可
    // 覆盖当前及后续挂载的所有滚动容器（事件驱动，无 rAF 轮询；后台隐藏时
    // 容器不会产生滚动事件，天然零开销）。
    const onCapturedScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches(SCROLL_CONTAINER_SELECTOR)) return;
      handleScrollOf(target);
    };

    // 视口滚动的 target 是 document，不经过 root 的捕获路径，需单独监听；
    // 元素滚动不冒泡，因此该监听器只会收到视口（scrollingElement）滚动。
    const onDocumentScroll = () => {
      const scrollingEl = document.scrollingElement as HTMLElement | null;
      if (scrollingEl) handleScrollOf(scrollingEl);
    };

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
