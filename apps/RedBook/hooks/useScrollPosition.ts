import { useRef, useEffect } from 'react';

export const useScrollPosition = (key: string) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    // Restore scroll position
    const savedPosition = sessionStorage.getItem(`scroll_pos_${key}`);
    if (savedPosition) {
      // Use setTimeout to ensure content is rendered before scrolling
      setTimeout(() => {
        element.scrollTop = parseInt(savedPosition, 10);
      }, 0);
    }

    // Save scroll position on scroll
    const handleScroll = () => {
        sessionStorage.setItem(`scroll_pos_${key}`, element.scrollTop.toString());
    };

    element.addEventListener('scroll', handleScroll);

    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [key]);

  return scrollRef;
};