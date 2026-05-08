import React, { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import {
  IcClose,
  IcFilter,
  IcNavigation,
  IcPhone,
  IcShare,
  IcBookmark,
  IcCheck,
  IcStar,
} from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapBackHandler } from '../hooks/useMapBackHandler';
import { useDraggableSheet } from '../hooks/useDraggableSheet';
import { useMapStrings } from '../hooks/useMapStrings';
import { useMapStore } from '../state';
import type { ShoppingItem } from '../types';
import { formatDistanceLabelMeters } from '../utils/placeUtils';
import { getPlaceRatingTier, setPlaceRatingTier, stripPlaceRatingFilters } from '../utils/placeResultsFilters';
import { useLocale } from '../locale';

export interface PlaceResultsSheetProps {
  title: string;
  category: string;
  items: ShoppingItem[];
  onClose: () => void;
  onItemClick: (item: ShoppingItem) => void;
  onSortChange: (sort: 'relevance' | 'distance') => void;
  onFilterChange: (filters: string[]) => void;
  onNavigate?: (item: ShoppingItem) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  hideCallButton?: boolean;
  loading?: boolean;
  /** 与 PlaceDetailSheet 一致：用页面根容器高度计算 full 吸附点，上拉可盖住顶部搜索栏等 */
  layoutRootRef?: React.RefObject<HTMLElement | null>;
}

export const PlaceResultsSheet: React.FC<PlaceResultsSheetProps> = ({
  title,
  category,
  items,
  onClose,
  onItemClick,
  onSortChange,
  onFilterChange,
  onNavigate,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
  hideCallButton,
  loading = false,
  layoutRootRef,
}) => {
  const { bindTap } = useMapGestures();
  const s = useMapStrings();
  const setPlaceResultsSheetOpen = useMapStore((s) => s.setPlaceResultsSheetOpen);

  useEffect(() => {
    setPlaceResultsSheetOpen(true);
    return () => setPlaceResultsSheetOpen(false);
  }, [setPlaceResultsSheetOpen]);

  const onItemClickRef = useRef(onItemClick);
  const onNavigateRef = useRef(onNavigate);
  onItemClickRef.current = onItemClick;
  onNavigateRef.current = onNavigate;
  const isFoodOrCafe = category === 'restaurant' || category === 'cafe';
  const isClothing = category === 'clothing_store';
  const shouldHideCall = Boolean(hideCallButton) || isClothing || category === 'public_toilet';
  const isPublicToilet = category === 'public_toilet';

  const [showSortModal, setShowSortModal] = useState(false);
  const [currentSort, setCurrentSort] = useState<'relevance' | 'distance'>('relevance');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFullFilter, setShowFullFilter] = useState(false);

  const ratingTier = getPlaceRatingTier(activeFilters);

  useMapBackHandler(
    () => {
      setShowSortModal(false);
      return true;
    },
    { enabled: showSortModal, priority: 850 },
  );

  useMapBackHandler(
    () => {
      setShowFullFilter(false);
      return true;
    },
    { enabled: showFullFilter, priority: 840 },
  );

  useMapBackHandler(
    () => {
      onClose();
      return true;
    },
    { priority: 400 },
  );

  const [snapPoints, setSnapPoints] = useState(() => {
    const h = typeof window !== 'undefined' ? window.innerHeight : 640;
    const half = Math.round(h * 0.7);
    const full = Math.max(Math.round(h - 48), half + 80);
    return { collapsed: 140, half, full };
  });

  const snapArray = useMemo(
    () => [snapPoints.collapsed, snapPoints.half, snapPoints.full],
    [snapPoints.collapsed, snapPoints.half, snapPoints.full],
  );

  const {
    height: sheetHeight,
    setHeight: setSheetHeight,
    isDragging,
    pointerHandlers,
  } = useDraggableSheet({
    snapPoints: snapArray,
    initialHeight: snapPoints.half,
    minHeight: 100,
    maxHeight: snapPoints.full,
  });

  const firstLayoutDoneRef = useRef(false);

  useLayoutEffect(() => {
    const measure = () => {
      const root = layoutRootRef?.current ?? null;
      const h = root ? root.clientHeight : window.innerHeight;
      const collapsed = 140;
      const half = Math.round(h * 0.7);
      const full = Math.max(Math.round(h - 48), half + 80);
      setSnapPoints({ collapsed, half, full });
      if (!firstLayoutDoneRef.current) {
        firstLayoutDoneRef.current = true;
        setSheetHeight(half);
      } else {
        setSheetHeight((prev) => Math.min(prev, full));
      }
    };

    measure();
    const root = layoutRootRef?.current ?? null;
    const ro = root ? new ResizeObserver(measure) : null;
    if (root && ro) ro.observe(root);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [layoutRootRef, setSheetHeight]);

  const handleSortSelect = (sort: 'relevance' | 'distance') => {
    setCurrentSort(sort);
    onSortChange(sort);
    setShowSortModal(false);
  };

  const toggleFilter = (filter: 'open_now' | 'top_rated') => {
    if (filter === 'open_now') {
      setActiveFilters((prev) => {
        const isActive = prev.includes('open_now');
        const newFilters = isActive ? prev.filter((f) => f !== 'open_now') : [...prev, 'open_now'];
        onFilterChange(newFilters);
        return newFilters;
      });
      return;
    }
    // top_rated：与完整筛选 4.0★ 一致，并与其他评分档位互斥
    setActiveFilters((prev) => {
      const has40 = prev.includes('top_rated') || prev.includes('rating_min_40');
      const newFilters = has40
        ? prev.filter((f) => f !== 'top_rated' && f !== 'rating_min_40')
        : [...stripPlaceRatingFilters(prev), 'top_rated'];
      onFilterChange(newFilters);
      return newFilters;
    });
  };

  return (
    <>
      <div
        className="place-results-sheet-container absolute bottom-0 left-0 right-0 bg-app-surface rounded-t-3xl shadow-up z-30 flex flex-col pointer-events-auto"
        style={{
          height: `${sheetHeight}px`,
          overscrollBehavior: 'contain',
          // 与 PlaceDetailSheet 一致：拖拽中不做 height 过渡，避免与 pointer 抢动画
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
          willChange: isDragging ? 'height' : 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0 w-full touch-none" {...pointerHandlers}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 pt-2 pb-2 shrink-0 touch-none" {...pointerHandlers}>
          <h2 className="text-xl font-bold text-black">{title}</h2>
          <button
            type="button"
            {...bindTap(
              { kind: 'action', id: 'placeResults.sheet.close' },
              { onTrigger: onClose },
            )}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <IcClose size={20} className="text-app-text-muted" />
          </button>
        </div>

        {!loading && (
          <div className="flex items-center px-4 py-2 space-x-2 overflow-x-auto no-scrollbar overscroll-x-contain shrink-0">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 bg-app-surface border border-app-border rounded-full shadow-sm text-gray-700 shrink-0"
              onClick={() => setShowFullFilter(true)}
            >
              <IcFilter size={14} />
            </button>

            <button
              type="button"
              className={`flex items-center space-x-1 px-3 py-1.5 border rounded-full shadow-sm text-sm whitespace-nowrap ${currentSort === 'relevance' ? 'bg-app-surface border-app-border text-gray-700' : 'bg-green-50 border-green-200 text-green-800'}`}
              onClick={() => setShowSortModal(true)}
            >
              <span>{currentSort === 'relevance' ? s.filter_relevance : s.filter_distance}</span>
              <span className="text-[10px]">▼</span>
            </button>

            <button
              type="button"
              className={`px-3 py-1.5 border rounded-full shadow-sm text-sm whitespace-nowrap ${activeFilters.includes('open_now') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-app-surface border-app-border text-gray-700'}`}
              onClick={() => toggleFilter('open_now')}
            >
              {s.filter_open_now}
            </button>

            {isFoodOrCafe && (
              <>
                <button
                  type="button"
                  className={`px-3 py-1.5 border rounded-full shadow-sm text-sm whitespace-nowrap ${ratingTier === '40' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-app-surface border-app-border text-gray-700'}`}
                  onClick={() => toggleFilter('top_rated')}
                >
                  {s.filter_top_rated}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-gray-100 border border-transparent rounded-full text-sm text-gray-700 whitespace-nowrap"
                >
                  {s.filter_conditions}
                </button>
              </>
            )}

            {!isFoodOrCafe && (
              <button type="button" className="ml-auto text-blue-600 text-sm font-medium whitespace-nowrap px-2">
                {s.filter_more}
              </button>
            )}
          </div>
        )}

        {/* 与 PlaceDetailSheet 一致：列表区始终挂载，仅通过 Sheet 高度变化露出/收起，避免折叠阈值附近反复挂载 DOM 造成顿挫 */}
        <div
          className="place-results-sheet-scrollable flex-1 overflow-y-auto no-scrollbar px-4 pb-4 overscroll-y-contain min-h-0"
          onWheel={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-10">
              <div
                className="h-11 w-11 rounded-full border-2 border-gray-200 border-t-teal-600 animate-spin"
                role="status"
                aria-label={s.filter_loading}
              />
              <span className="text-sm text-app-text-muted">{s.search_loading_results}</span>
            </div>
          ) : (
            <>
              <PlaceResultsItemsBody
                items={items}
                isPublicToilet={isPublicToilet}
                shouldHideCall={shouldHideCall}
                onItemClickRef={onItemClickRef}
                onNavigateRef={onNavigateRef}
              />
              {hasMore && (
                <LoadMoreSentinel onLoadMore={onLoadMore} loadingMore={loadingMore} />
              )}
            </>
          )}
        </div>
      </div>

      {showFullFilter && (
        <div className="absolute inset-0 z-50 bg-app-surface flex flex-col animate-slide-up pt-12">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-black">{s.filter_title}</h2>
            <button
              type="button"
              onClick={() => setShowFullFilter(false)}
              className="p-1 rounded-full bg-gray-100 text-app-text-muted"
            >
              <IcClose size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-2">
            <div className="mb-6">
              <div className="font-bold text-base mb-3">{s.filter_sort_by}</div>
              <div className="flex border border-app-border rounded-lg overflow-hidden h-10">
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${currentSort === 'relevance' ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                  onClick={() => setCurrentSort('relevance')}
                >
                  {currentSort === 'relevance' && <IcCheck size={16} />}
                  {s.filter_relevance}
                </button>
                <div className="w-[1px] bg-gray-200" />
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${currentSort === 'distance' ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                  onClick={() => setCurrentSort('distance')}
                >
                  {currentSort === 'distance' && <IcCheck size={16} />}
                  {s.filter_distance}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div className="font-bold text-base mb-3">{s.filter_rating}</div>
              <div className="flex gap-2">
                <FilterOption
                  label={s.filter_no_limit}
                  active={ratingTier === 'none'}
                  onClick={() => setActiveFilters((prev) => setPlaceRatingTier(prev, 'none'))}
                />
                <FilterOption
                  label={
                    <span className="flex items-center gap-0.5">
                      3.5 <span className="text-yellow-400">★</span>
                    </span>
                  }
                  active={ratingTier === '35'}
                  onClick={() => setActiveFilters((prev) => setPlaceRatingTier(prev, '35'))}
                />
                <FilterOption
                  label={
                    <span className="flex items-center gap-0.5">
                      4.0 <span className="text-yellow-400">★</span>
                    </span>
                  }
                  active={ratingTier === '40'}
                  onClick={() => setActiveFilters((prev) => setPlaceRatingTier(prev, '40'))}
                />
                <FilterOption
                  label={
                    <span className="flex items-center gap-0.5">
                      4.5 <span className="text-yellow-400">★</span>
                    </span>
                  }
                  active={ratingTier === '45'}
                  onClick={() => setActiveFilters((prev) => setPlaceRatingTier(prev, '45'))}
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="font-bold text-base mb-3">{s.filter_review_count}</div>
              <div className="flex border border-app-border rounded-lg overflow-hidden h-10 w-full">
                <button
                  type="button"
                  className={`flex-1 text-sm font-medium flex items-center justify-center gap-1 ${!activeFilters.includes('reviews_min_3') ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                  onClick={() =>
                    setActiveFilters((prev) => prev.filter((f) => f !== 'reviews_min_3'))
                  }
                >
                  {!activeFilters.includes('reviews_min_3') && <IcCheck size={16} />} {s.filter_no_limit}
                </button>
                <div className="w-[1px] bg-gray-200" />
                <button
                  type="button"
                  className={`flex-1 text-sm font-medium flex items-center justify-center gap-1 ${activeFilters.includes('reviews_min_3') ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                  onClick={() =>
                    setActiveFilters((prev) =>
                      prev.includes('reviews_min_3') ? prev : [...prev, 'reviews_min_3'],
                    )
                  }
                >
                  {activeFilters.includes('reviews_min_3') && <IcCheck size={16} />} 3+
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div className="font-bold text-base mb-3">{s.filter_opening_hours}</div>
              <div className="flex border border-app-border rounded-lg overflow-hidden h-10 w-full">
                <button
                  type="button"
                  className={`flex-1 text-sm font-medium flex items-center justify-center gap-1 ${!activeFilters.includes('open_now') ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                  onClick={() => {
                    if (activeFilters.includes('open_now')) toggleFilter('open_now');
                  }}
                >
                  {!activeFilters.includes('open_now') && <IcCheck size={16} />} {s.filter_no_limit}
                </button>
                <div className="w-[1px] bg-gray-200" />
                <button
                  type="button"
                  className={`flex-1 text-sm font-medium flex items-center justify-center gap-1 ${activeFilters.includes('open_now') ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                  onClick={() => {
                    if (!activeFilters.includes('open_now')) toggleFilter('open_now');
                  }}
                >
                  {activeFilters.includes('open_now') && <IcCheck size={16} />} {s.filter_open_now}
                </button>
                <div className="w-[1px] bg-gray-200" />
                <button type="button" className="flex-1 bg-app-surface text-gray-700 text-sm font-medium">
                  {s.filter_custom}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 flex gap-4">
            <button
              type="button"
              className="flex-1 py-3 rounded-full bg-cyan-100 text-cyan-800 font-bold text-base"
              onClick={() => {
                setActiveFilters([]);
                setCurrentSort('relevance');
              }}
            >
              {s.filter_clear}
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-full bg-teal-700 text-white font-bold text-base"
              onClick={() => {
                onSortChange(currentSort);
                onFilterChange(activeFilters);
                setShowFullFilter(false);
              }}
            >
              {s.filter_apply}
            </button>
          </div>
        </div>
      )}

      {showSortModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-end"
          onClick={() => setShowSortModal(false)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="w-full bg-app-surface rounded-t-2xl p-4 pb-safe animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold mb-4">{s.filter_sort_by}</div>
            <div className="flex border border-app-border rounded-lg overflow-hidden h-12 mb-4">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 font-medium ${currentSort === 'relevance' ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                onClick={() => handleSortSelect('relevance')}
              >
                {currentSort === 'relevance' && <IcCheck size={18} />}
                {s.filter_relevance}
              </button>
              <div className="w-[1px] bg-gray-200" />
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 font-medium ${currentSort === 'distance' ? 'bg-gray-100 text-black' : 'bg-app-surface text-gray-700'}`}
                onClick={() => handleSortSelect('distance')}
              >
                {currentSort === 'distance' && <IcCheck size={18} />}
                {s.filter_distance}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** 与 PlaceDetailSheet 一致：高度拖拽不触发整表 diff；回调经 ref 始终最新 */
const PlaceResultsItemsBody = React.memo(
  function PlaceResultsItemsBody({
    items,
    isPublicToilet,
    shouldHideCall,
    onItemClickRef,
    onNavigateRef,
  }: {
    items: ShoppingItem[];
    isPublicToilet: boolean;
    shouldHideCall: boolean;
    onItemClickRef: React.MutableRefObject<(item: ShoppingItem) => void>;
    onNavigateRef: React.MutableRefObject<((item: ShoppingItem) => void) | undefined>;
  }) {
    const { bindTap } = useMapGestures();
    const s = useMapStrings();
    const locale = useLocale();
    return (
      <>
        {items.map((item) => (
          <div
            key={item.id}
            className="py-4 border-b border-gray-100 last:border-0"
            {...bindTap(
              { kind: 'action', id: 'placeResults.result.select.item' },
              { params: { itemId: item.id }, onTrigger: () => onItemClickRef.current(item) },
            )}
          >
            <div className="mb-1">
              <h3 className="text-lg font-bold text-black">{item.name}</h3>
            </div>

            <div className="flex items-center text-sm text-app-text-muted mb-1 space-x-1">
              {isPublicToilet ? (
                <>
                  {item.rating ? (
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      <span className="text-gray-900">{item.rating}</span>
                      <IcStar size={12} fill="currentColor" stroke="none" className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">({item.ratingCount || 5})</span>
                    </span>
                  ) : (
                    <span>{s.place_no_rating}</span>
                  )}
                  <span>·</span>
                  <span>{item.category}</span>
                </>
              ) : (
                <>
                  {item.rating ? (
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      <span className="text-gray-900">{item.rating}</span>
                      <IcStar size={12} fill="currentColor" stroke="none" className="text-amber-500 shrink-0" />
                      <span className="text-gray-400">({item.ratingCount || 5})</span>
                    </span>
                  ) : (
                    <span>{s.place_no_rating}</span>
                  )}
                  <span>·</span>
                  <span>{item.category}</span>
                  <span>·</span>
                  <span>{formatDistanceLabelMeters(item.distance, locale)}</span>
                </>
              )}
            </div>

            {item.openNow === true && (
              <div className="text-sm mb-2">
                <span className="text-green-700 font-medium">{s.place_open_now}</span>
                {item.closesAt && <span className="text-app-text-muted"> · {s.place_closes_at}{item.closesAt}</span>}
              </div>
            )}
            {item.openNow === false && (
              <div className="text-sm mb-2">
                <span className="text-red-600 font-medium">{s.place_closed_now}</span>
                {item.opensNextLabel && <span className="text-app-text-muted"> · {s.place_opens_at}{item.opensNextLabel}</span>}
              </div>
            )}

            <div className="flex space-x-3 overflow-x-auto no-scrollbar mt-3">
              <ActionButton
                icon={<IcNavigation size={18} fill="currentColor" />}
                label={s.route}
                active
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateRef.current?.(item);
                }}
              />
              {!shouldHideCall && <ActionButton icon={<IcPhone size={18} fill="currentColor" />} label={s.action_call} />}
              <ActionButton icon={<IcShare size={18} fill="currentColor" />} label={s.action_share} />
              <ActionButton icon={<IcBookmark size={18} fill="currentColor" />} label={s.action_save} />
            </div>
          </div>
        ))}
      </>
    );
  },
  (prev, next) =>
    prev.items === next.items &&
    prev.isPublicToilet === next.isPublicToilet &&
    prev.shouldHideCall === next.shouldHideCall &&
    prev.onItemClickRef === next.onItemClickRef &&
    prev.onNavigateRef === next.onNavigateRef,
);

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    className={`
      flex items-center space-x-1.5 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap
      ${active ? 'bg-cyan-50 border-cyan-100 text-cyan-800' : 'bg-app-surface border-app-border text-cyan-700'}
    `}
    onClick={onClick}
  >
    <span className="text-cyan-700">{icon}</span>
    <span>{label}</span>
  </button>
);

const LoadMoreSentinel: React.FC<{
  onLoadMore?: () => void;
  loadingMore?: boolean;
}> = ({ onLoadMore, loadingMore }) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const s = useMapStrings();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !onLoadMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, loadingMore]);

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {loadingMore ? (
        <div
          className="h-6 w-6 rounded-full border-2 border-gray-200 border-t-teal-600 animate-spin"
          role="status"
          aria-label={s.filter_load_more}
        />
      ) : (
        <span className="text-xs text-app-text-muted">{s.filter_swipe_to_load_more}</span>
      )}
    </div>
  );
};

const FilterOption: React.FC<{ label: React.ReactNode; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <button
    type="button"
    className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 border ${active ? 'bg-gray-100 border-app-border text-black' : 'bg-app-surface border-app-border text-gray-700'}`}
    onClick={onClick}
  >
    {active && <IcCheck size={14} />}
    {label}
  </button>
);
