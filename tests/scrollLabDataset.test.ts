import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SCROLL_LAB_ITEMS,
  SCROLL_LAB_ITEM_COUNT,
  SCROLL_LAB_TARGET_ORDINALS,
} from '../apps/ScrollLab/data';
import { NAVIGATION_DECLARATION } from '../apps/ScrollLab/navigation.declaration';
import { useScrollLabStore } from '../apps/ScrollLab/state';

describe('Scroll Lab deterministic long-list fixture', () => {
  afterEach(() => {
    useScrollLabStore.setState({ selectedItemId: null, scrollTop: 0, firstVisibleOrdinal: 1 });
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

  it('keeps titles and previews unique in both supported locales', () => {
    for (const field of ['title', 'preview'] as const) {
      expect(new Set(SCROLL_LAB_ITEMS.map((item) => item[field].zh)).size).toBe(SCROLL_LAB_ITEM_COUNT);
      expect(new Set(SCROLL_LAB_ITEMS.map((item) => item[field].en)).size).toBe(SCROLL_LAB_ITEM_COUNT);
    }
  });

  it('uses content-distinct target records with similar distractors', () => {
    const mid = SCROLL_LAB_ITEMS[23];
    const deep = SCROLL_LAB_ITEMS[82];
    expect(mid).toMatchObject({
      id: 'scroll-item-024',
      title: { zh: '取回蓝色雨伞' },
      preview: { zh: expect.stringContaining('尾号 7312') },
    });
    expect(deep).toMatchObject({
      id: 'scroll-item-083',
      title: { zh: '冷链样品交接' },
      preview: { zh: expect.stringContaining('银色保温箱') },
    });

    expect(SCROLL_LAB_ITEMS.some((item) => item.title.zh === '取回黑色雨伞')).toBe(true);
    expect(SCROLL_LAB_ITEMS.some((item) => item.title.zh === '领取蓝色文件袋')).toBe(true);
    expect(SCROLL_LAB_ITEMS.some((item) => item.preview.zh.includes('透明冷藏盒'))).toBe(true);
    expect(SCROLL_LAB_ITEMS.some((item) => item.preview.zh.includes('白色纸箱'))).toBe(true);
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
    expect(source).not.toContain('target_badge');
    expect(source).not.toContain('String(item.ordinal).padStart');
  });

  it('records the selected item id as judgeable app state', () => {
    expect(useScrollLabStore.getState().selectedItemId).toBeNull();
    useScrollLabStore.getState().selectItem('scroll-item-083');
    expect(useScrollLabStore.getState().selectedItemId).toBe('scroll-item-083');
  });

  it('starts at the list top with a single visible first item', () => {
    expect(useScrollLabStore.getState().scrollTop).toBe(0);
    expect(useScrollLabStore.getState().firstVisibleOrdinal).toBe(1);
  });

  it('tracks scroll position for single-screen precision checks', () => {
    useScrollLabStore.getState().setScrollPosition(720, 8);
    expect(useScrollLabStore.getState().scrollTop).toBe(720);
    expect(useScrollLabStore.getState().firstVisibleOrdinal).toBe(8);
  });
});
