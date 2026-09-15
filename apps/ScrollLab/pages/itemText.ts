import type { ScrollLabItem } from '../data';

export type ScrollLabLocale = 'zh' | 'en';

export function itemTitle(item: ScrollLabItem, locale: ScrollLabLocale): string {
  return item.title[locale];
}

export function itemPreview(item: ScrollLabItem, locale: ScrollLabLocale): string {
  return item.preview[locale];
}
