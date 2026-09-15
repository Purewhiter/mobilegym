import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SCROLL_LAB_ITEMS,
  SCROLL_LAB_ITEM_COUNT,
  SCROLL_LAB_TARGET_ORDINALS,
} from '../apps/ScrollLab/data';
import { NAVIGATION_DECLARATION } from '../apps/ScrollLab/navigation.declaration';
import { itemTitle } from '../apps/ScrollLab/pages/itemText';
import { strings } from '../apps/ScrollLab/res/strings';
import { stringsEn } from '../apps/ScrollLab/res/strings.en';
import { useScrollLabStore } from '../apps/ScrollLab/state';

describe('Scroll Lab deterministic long-list fixture', () => {
  afterEach(() => {
    useScrollLabStore.setState({ selectedItemId: null });
  });

  it('keeps exactly 100 stable and unique list items', () => {
    expect(SCROLL_LAB_ITEMS).toHaveLength(SCROLL_LAB_ITEM_COUNT);
    expect(new Set(SCROLL_LAB_ITEMS.map((item) => item.id)).size).toBe(SCROLL_LAB_ITEM_COUNT);
    expect(SCROLL_LAB_ITEMS[0]).toMatchObject({ id: 'scroll-item-001', ordinal: 1 });
    expect(SCROLL_LAB_ITEMS.at(-1)).toMatchObject({ id: 'scroll-item-100', ordinal: 100 });
  });

  it('places one medium and one deep target at fixed positions', () => {
    const targets = SCROLL_LAB_ITEMS.filter((item) => item.target !== null);
    expect(targets).toEqual([
      expect.objectContaining({ id: 'scroll-item-024', ordinal: SCROLL_LAB_TARGET_ORDINALS.medium, target: 'medium' }),
      expect.objectContaining({ id: 'scroll-item-083', ordinal: SCROLL_LAB_TARGET_ORDINALS.deep, target: 'deep' }),
    ]);
  });

  it('keeps target titles exact and unique in both supported locales', () => {
    const zhTitles = SCROLL_LAB_ITEMS.map((item) => itemTitle(item, strings));
    const enStrings = { ...strings, ...stringsEn };
    const enTitles = SCROLL_LAB_ITEMS.map((item) => itemTitle(item, enStrings));

    expect(zhTitles.filter((title) => title === 'Aiden 滚动目标 024')).toHaveLength(1);
    expect(zhTitles.filter((title) => title === 'Aiden 滚动目标 083')).toHaveLength(1);
    expect(enTitles.filter((title) => title === 'Aiden Scroll Target 024')).toHaveLength(1);
    expect(enTitles.filter((title) => title === 'Aiden Scroll Target 083')).toHaveLength(1);
  });

  it('declares and tags the primary vertical scroll surface', () => {
    const listRoute = NAVIGATION_DECLARATION.routes.find((route) => route.path === '/');
    expect(listRoute?.scrollContainers).toEqual([
      expect.objectContaining({ name: 'main', direction: 'vertical' }),
    ]);

    const source = readFileSync('apps/ScrollLab/pages/ScrollLabListPage.tsx', 'utf8');
    expect(source).toContain('data-scroll-container="main"');
    expect(source).toContain('data-scroll-direction="vertical"');
    expect(source).toContain("'scroll_lab.list.openItem'");
  });

  it('records the selected item id as judgeable app state', () => {
    expect(useScrollLabStore.getState().selectedItemId).toBeNull();
    useScrollLabStore.getState().selectItem('scroll-item-083');
    expect(useScrollLabStore.getState().selectedItemId).toBe('scroll-item-083');
  });
});
