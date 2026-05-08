import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface UseVirtualListOptions<TItem> {
  items: TItem[];
  estimateSize: (index: number, item: TItem) => number;
  overscan?: number;
  paddingStart?: number;
  paddingEnd?: number;
  gap?: number;
  scrollMargin?: number;
  getItemKey?: (index: number, item: TItem) => string | number;
}

export function useVirtualList<TItem>({
  items,
  estimateSize,
  overscan = 5,
  paddingStart = 0,
  paddingEnd = 0,
  gap = 0,
  scrollMargin = 0,
  getItemKey,
}: UseVirtualListOptions<TItem>) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateSize(index, items[index]!),
    overscan,
    paddingStart,
    paddingEnd,
    gap,
    scrollMargin,
    getItemKey: getItemKey ? (index) => getItemKey(index, items[index]!) : undefined,
  });

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}
