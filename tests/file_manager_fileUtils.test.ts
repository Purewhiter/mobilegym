import { describe, expect, it } from 'vitest';
import type { FSNode } from '@/os/types';
import { isPdfPreviewableFile } from '@/system/FileManager/utils/fileUtils';

function fileNode(partial: Partial<FSNode>): FSNode {
  return {
    id: 'file_test',
    name: 'document.pdf',
    type: 'file',
    parentId: 'dir_test',
    path: '/sdcard/Download/document.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    createdAt: 1,
    modifiedAt: 1,
    storage: 'indexeddb',
    ...partial,
  };
}

describe('fileUtils', () => {
  it('recognizes pdf files as previewable', () => {
    expect(isPdfPreviewableFile(fileNode({ mimeType: 'application/pdf' }))).toBe(true);
    expect(isPdfPreviewableFile(fileNode({ name: 'quote.PDF', mimeType: 'application/octet-stream' }))).toBe(true);
  });
});
