import { useEffect, useState, type RefObject } from 'react';

export function useElementHeight(ref: RefObject<HTMLElement | null>, initial = 0): number {
  const [height, setHeight] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setHeight(el.getBoundingClientRect().height);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [ref]);

  return height;
}
