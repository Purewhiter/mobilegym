import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FSNode } from '@/os/types';

const fsMock = vi.hoisted(() => ({
  listDirectory: vi.fn<(path: string) => FSNode[]>(),
  createDirectory: vi.fn<(path: string) => Promise<FSNode>>(),
  copyFile: vi.fn<(srcPath: string, destPath: string) => Promise<FSNode | null>>(),
  moveNode: vi.fn<(srcPath: string, destPath: string) => Promise<FSNode | null>>(),
}));

vi.mock('@/os/FileSystemService', () => fsMock);

function node(path: string, type: FSNode['type']): FSNode {
  const name = path.split('/').pop() || path;
  return {
    id: path,
    name,
    path,
    type,
    parentId: 'parent',
    size: type === 'file' ? 12 : 0,
    mimeType: type === 'file' ? 'text/plain' : undefined,
    modifiedAt: 1,
    createdAt: 1,
    storage: 'indexeddb',
  };
}

describe('FileManager 复制和移动操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const tree: Record<string, FSNode[]> = {
      '/sdcard/Docs': [
        node('/sdcard/Docs/readme.txt', 'file'),
        node('/sdcard/Docs/Nested', 'directory'),
      ],
      '/sdcard/Docs/Nested': [
        node('/sdcard/Docs/Nested/todo.txt', 'file'),
      ],
    };

    fsMock.listDirectory.mockImplementation((path) => tree[path] ?? []);
    fsMock.createDirectory.mockImplementation(async (path) => node(path, 'directory'));
    fsMock.copyFile.mockImplementation(async (_src, dest) => node(dest, 'file'));
    fsMock.moveNode.mockImplementation(async (_src, dest) => node(dest, 'file'));
  });

  it('复制文件夹时递归复制子文件和子文件夹', async () => {
    const { transferNodesToDirectory } = await import('@/system/FileManager/utils/fileOperations');

    const success = await transferNodesToDirectory([node('/sdcard/Docs', 'directory')], '/sdcard/Target', 'copy');

    expect(success).toBe(true);
    expect(fsMock.createDirectory).toHaveBeenCalledWith('/sdcard/Target/Docs');
    expect(fsMock.createDirectory).toHaveBeenCalledWith('/sdcard/Target/Docs/Nested');
    expect(fsMock.copyFile).toHaveBeenCalledWith('/sdcard/Docs/readme.txt', '/sdcard/Target/Docs/readme.txt');
    expect(fsMock.copyFile).toHaveBeenCalledWith('/sdcard/Docs/Nested/todo.txt', '/sdcard/Target/Docs/Nested/todo.txt');
    expect(fsMock.moveNode).not.toHaveBeenCalled();
  });

  it('移动文件时移动到目标目录下同名路径', async () => {
    const { transferNodesToDirectory } = await import('@/system/FileManager/utils/fileOperations');

    const success = await transferNodesToDirectory([node('/sdcard/Download/a.txt', 'file')], '/sdcard/Target', 'move');

    expect(success).toBe(true);
    expect(fsMock.moveNode).toHaveBeenCalledWith('/sdcard/Download/a.txt', '/sdcard/Target/a.txt');
    expect(fsMock.copyFile).not.toHaveBeenCalled();
  });
});
