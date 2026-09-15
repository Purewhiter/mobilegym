import type { ScrollLabItem } from '../data';
import type { strings } from '../res/strings';

type ScrollLabStrings = Record<keyof typeof strings, string>;

export function itemTitle(item: ScrollLabItem, s: ScrollLabStrings): string {
  if (item.target === 'medium') return s.target_mid_title;
  if (item.target === 'deep') return s.target_deep_title;
  return `${s.item_title_prefix} ${String(item.ordinal).padStart(3, '0')}`;
}

export function itemPreview(item: ScrollLabItem, s: ScrollLabStrings): string {
  if (item.rowSize === 'expanded') return s.preview_long;
  if (item.rowSize === 'regular') return s.preview_medium;
  return s.preview_short;
}
