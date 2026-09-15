import defaults from './defaults.json';

export const SCROLL_LAB_ITEM_COUNT = 100;
export const SCROLL_LAB_TARGET_ORDINALS = {
  medium: 24,
  deep: 83,
} as const;

export type ScrollLabTarget = keyof typeof SCROLL_LAB_TARGET_ORDINALS;

export interface ScrollLabItem {
  id: string;
  ordinal: number;
  code: string;
  rowSize: 'compact' | 'regular' | 'expanded';
  target: ScrollLabTarget | null;
}

const targetForOrdinal = (ordinal: number): ScrollLabTarget | null => {
  if (ordinal === SCROLL_LAB_TARGET_ORDINALS.medium) return 'medium';
  if (ordinal === SCROLL_LAB_TARGET_ORDINALS.deep) return 'deep';
  return null;
};

export const SCROLL_LAB_ITEMS: ScrollLabItem[] = Array.from(
  { length: SCROLL_LAB_ITEM_COUNT },
  (_, index) => {
    const ordinal = index + 1;
    const padded = String(ordinal).padStart(3, '0');
    const rowSize = ordinal % 5 === 0
      ? 'expanded'
      : ordinal % 2 === 0
        ? 'regular'
        : 'compact';
    return {
      id: `scroll-item-${padded}`,
      ordinal,
      code: `SL-${padded}`,
      rowSize,
      target: targetForOrdinal(ordinal),
    };
  },
);

export const SCROLL_LAB_DEFAULTS = {
  selectedItemId: defaults.selectedItemId as string | null,
};

export const SCROLL_LAB_CONFIG = {
  ...SCROLL_LAB_DEFAULTS,
  items: SCROLL_LAB_ITEMS,
};

export function findScrollLabItem(itemId: string): ScrollLabItem | undefined {
  return SCROLL_LAB_ITEMS.find((item) => item.id === itemId);
}
