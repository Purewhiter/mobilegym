import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ICON_REGISTRY, IcMonitor } from '../res/icons';
import { useLocale } from '../../../os/locale';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { localizeRailwayItemName, localizeRailwayItemTag } from '../utils/localizeRailwayItem';

const ICON_MAP: Record<string, any> = ICON_REGISTRY;

interface ServiceItem {
  id: string;
  name: string;
  icon: string;
  color?: string;
  tag?: string;
}

interface SwipeableServiceGridProps {
  items: ServiceItem[];
  columns?: number;
  rowsPerPage?: number;
  onItemClick?: (id: string) => void;
  onOverscrollNavigate?: () => void;
}

export const SwipeableServiceGrid: React.FC<SwipeableServiceGridProps> = ({
  items,
  columns = 5,
  rowsPerPage = 3,
  onItemClick,
  onOverscrollNavigate,
}) => {
  const locale = useLocale();
  const s = useRailwayStrings();
  const itemsPerPage = columns * rowsPerPage;
  const pages: ServiceItem[][] = [];
  for (let i = 0; i < items.length; i += itemsPerPage) {
    pages.push(items.slice(i, i + itemsPerPage));
  }
  const totalPages = pages.length;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [overscrollActive, setOverscrollActive] = useState(false);

  // Track current page from scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pageWidth = el.clientWidth;
    const page = Math.round(el.scrollLeft / pageWidth);
    setCurrentPage(Math.min(page, totalPages - 1));

    // Detect overscroll (scrolled past the last page content)
    const maxScroll = el.scrollWidth - el.clientWidth;
    const isAtEnd = el.scrollLeft >= maxScroll - 2;
    setOverscrollActive(isAtEnd && totalPages > 0);
  }, [totalPages]);

  // Handle touch end: if overscroll panel is in view, navigate
  const handleTouchEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // If scrolled to show the overscroll panel
    if (el.scrollLeft >= maxScroll - 2 && onOverscrollNavigate) {
      // Check if user has scrolled far enough (past the midpoint of the overscroll panel)
      const overscrollThreshold = maxScroll - el.clientWidth * 0.3;
      if (el.scrollLeft > overscrollThreshold) {
        onOverscrollNavigate();
      }
    }
  }, [onOverscrollNavigate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className="relative">
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        onTouchEnd={handleTouchEnd}
        onMouseUp={handleTouchEnd}
      >
        {/* Item pages */}
        {pages.map((pageItems, pageIdx) => (
          <div
            key={pageIdx}
            className="flex-shrink-0 w-full snap-start pb-1"
          >
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {pageItems.map(item => {
                const Icon = ICON_MAP[item.icon] || IcMonitor;
                const tag = localizeRailwayItemTag(item.tag, s);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col items-center gap-1 relative active:opacity-70 h-[72px] pt-[15px]"
                    onClick={() => onItemClick?.(item.id)}
                  >
                    {tag && (
                      <span className="absolute -top-1 right-0 text-[8px] text-white bg-red-500 rounded-full px-1 leading-tight z-10">
                        {tag}
                      </span>
                    )}
                    <div
                      className="w-[33px] h-[33px] rounded-xl flex items-center justify-center"
                      style={item.color ? { backgroundColor: `${item.color}15` } : { backgroundColor: '#EBF3FF' }}
                    >
                      <Icon
                        size={28}
                        style={item.color ? { color: item.color } : undefined}
                        className={!item.color ? 'text-app-primary' : ''}
                      />
                    </div>
                    <span className="text-[11px] text-gray-700 text-center leading-tight">{localizeRailwayItemName(item.id, item.name, s)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Overscroll "松开跳转" panel */}
        {onOverscrollNavigate && (
          <div
            className="flex-shrink-0 w-[40%] snap-start flex items-center justify-center py-3"
            onClick={onOverscrollNavigate}
          >
            <div className="flex flex-col items-center gap-1 text-gray-400">
              {(locale === 'en' ? ['S', 'W', 'I', 'P', 'E'] : ['松', '开', '跳', '转']).map((char) => (
                <span key={char} className="text-sm writing-vertical">{char}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Page indicator dots (includes overscroll target as extra dot) */}
      <div className="flex justify-center gap-1.5 pb-2">
        {pages.map((_, i) => (
          <div
            key={i}
 className={`w-1.5 h-1.5 rounded-full ${
              i === currentPage && !overscrollActive ? 'bg-app-primary' : 'bg-gray-300'
            }`}
          />
        ))}
        {onOverscrollNavigate && (
          <div
 className={`w-1.5 h-1.5 rounded-full ${
              overscrollActive ? 'bg-app-primary' : 'bg-gray-300'
            }`}
          />
        )}
      </div>
    </div>
  );
};
