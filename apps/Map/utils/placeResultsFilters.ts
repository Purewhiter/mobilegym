import type { ShoppingItem } from '../types';

/** 与 PlaceResultsSheet 中 activeFilters 约定一致 */
export const PLACE_RATING_FILTER_KEYS = [
  'rating_min_35',
  'top_rated',
  'rating_min_40',
  'rating_min_45',
] as const;

export function stripPlaceRatingFilters(filters: string[]): string[] {
  return filters.filter((f) => !PLACE_RATING_FILTER_KEYS.includes(f as (typeof PLACE_RATING_FILTER_KEYS)[number]));
}

/** 评分档位互斥：'none' | 3.5 | 4.0 | 4.5（4.0 使用 top_rated 与快捷「评分最高」一致） */
export function setPlaceRatingTier(filters: string[], tier: 'none' | '35' | '40' | '45'): string[] {
  const base = stripPlaceRatingFilters(filters);
  if (tier === '35') return [...base, 'rating_min_35'];
  if (tier === '40') return [...base, 'top_rated'];
  if (tier === '45') return [...base, 'rating_min_45'];
  return base;
}

export function getPlaceRatingTier(filters: string[]): 'none' | '35' | '40' | '45' {
  if (filters.includes('rating_min_45')) return '45';
  if (filters.includes('rating_min_35')) return '35';
  if (filters.includes('top_rated') || filters.includes('rating_min_40')) return '40';
  return 'none';
}

/** 仅筛选（不含排序），供 Explore 分类结果与 Search 共用 */
export function applyPlaceResultItemFilters(items: ShoppingItem[], filters: string[]): ShoppingItem[] {
  let next = [...items];
  if (filters.includes('open_now')) {
    next = next.filter((item) => item.status === 'Open');
  }
  const minRating = filters.includes('rating_min_45')
    ? 4.5
    : filters.includes('rating_min_35')
      ? 3.5
      : filters.includes('top_rated') || filters.includes('rating_min_40')
        ? 4.0
        : null;
  if (minRating !== null) {
    next = next.filter((item) => (item.rating || 0) >= minRating);
  }
  if (filters.includes('reviews_min_3')) {
    next = next.filter((item) => (item.ratingCount ?? 0) >= 3);
  }
  return next;
}

export function applyPlaceResultsDisplay(
  base: ShoppingItem[],
  sort: 'relevance' | 'distance',
  filters: string[],
): ShoppingItem[] {
  let items = applyPlaceResultItemFilters(base, filters);
  if (sort === 'distance') {
    items.sort((a, b) => a.distance - b.distance);
  }
  return items;
}
