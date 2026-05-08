import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAVIGATION_DECLARATION } from '../system/FileManager/navigation.declaration';

const PAGE_SOURCES = [
  'system/FileManager/pages/BrowseHomePage.tsx',
  'system/FileManager/pages/RecentPage.tsx',
  'system/FileManager/pages/FolderPage.tsx',
];

describe('FileManager 复制和移动目标选择导航', () => {
  it('三种文件列表页面都声明目标选择弹窗状态', () => {
    const routeIds = NAVIGATION_DECLARATION.routes.flatMap(route => route.uiStates.map(state => state.id));

    expect(routeIds).toContain('browse.select.modal.transfer');
    expect(routeIds).toContain('recent.select.modal.transfer');
    expect(routeIds).toContain('folder.select.modal.transfer');
  });

  it('三种文件列表页面都接入复制和移动弹窗入口', () => {
    for (const path of PAGE_SOURCES) {
      const source = readFileSync(path, 'utf8');

      expect(source, path).toContain("openTransferSheet('copy')");
      expect(source, path).toContain("openTransferSheet('move')");
      expect(source, path).toContain('<TransferSheet');
    }
  });

  it('目标选择弹窗的新建文件夹复用文件管理器输入弹窗', () => {
    const source = readFileSync('system/FileManager/components/TransferSheet.tsx', 'utf8');

    expect(source).toContain("import { InputDialog } from './Dialog'");
    expect(source).toContain('<InputDialog');
    expect(source).toContain('open={isCreateFolderOpen}');
    expect(source).not.toContain('<input');
    expect(source).not.toContain('newFolderName');
  });

  it('目标选择弹窗内的新建文件夹弹窗由 URL 子状态驱动', () => {
    const routeIds = NAVIGATION_DECLARATION.routes.flatMap(route => route.uiStates.map(state => state.id));
    const transitionIds = NAVIGATION_DECLARATION.transitions.map(transition => transition.id);

    expect(routeIds).toContain('browse.select.modal.transfer.newFolder');
    expect(routeIds).toContain('recent.select.modal.transfer.newFolder');
    expect(routeIds).toContain('folder.select.modal.transfer.newFolder');
    expect(transitionIds).toContain('browse.modal.transfer.newFolder.open');
    expect(transitionIds).toContain('recent.modal.transfer.newFolder.open');
    expect(transitionIds).toContain('folder.modal.transfer.newFolder.open');

    for (const path of PAGE_SOURCES) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toContain("transferDialog === 'newFolder'");
      expect(source, path).toContain('onOpenCreateFolder');
      expect(source, path).toContain('onCloseCreateFolder');
    }

    const sheetSource = readFileSync('system/FileManager/components/TransferSheet.tsx', 'utf8');
    expect(sheetSource).not.toContain('isCreateFolderDialogOpen');
    expect(sheetSource).not.toContain('setIsCreateFolderDialogOpen');
  });

  it('浏览主页的内部存储根目录不能过滤掉根目录文件', () => {
    const source = readFileSync('system/FileManager/pages/BrowseHomePage.tsx', 'utf8');

    expect(source).not.toContain(".filter(item => item.type === 'directory')");
    expect(source).toContain('isTextPreviewableFile(item)');
    expect(source).toContain('isPdfPreviewableFile(item)');
    expect(source).toContain('FileSystem.formatFileSize(item.size)');
  });
});
