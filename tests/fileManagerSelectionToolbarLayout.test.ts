import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const SELECTION_SOURCES = [
  'system/FileManager/pages/BrowseHomePage.tsx',
  'system/FileManager/pages/RecentPage.tsx',
  'system/FileManager/pages/FolderPage.tsx',
];

describe('FileManager 选择模式底部操作栏布局', () => {
  it('滚动内容在选择模式下为底部操作栏预留可滚动空间', () => {
    const dimensSource = readFileSync('system/FileManager/res/dimens.ts', 'utf8');
    expect(dimensSource).toContain('selection_action_bar_scroll_padding');
    expect(dimensSource).toContain('selection_action_bar_height');

    for (const path of SELECTION_SOURCES) {
      const source = readFileSync(path, 'utf8');

      expect(source, path).toContain("paddingBottom: isSelecting ? 'var(--app-selection-action-bar-scroll-padding)'");
      expect(source, path).toContain("minHeight: 'var(--app-selection-action-bar-height)'");
    }
  });
});
