import { describe, expect, it } from 'vitest';
import { isTextPreviewableFile } from '../system/FileManager/utils/fileUtils';
import type { FSNode } from '../os/types';

function node(overrides: Partial<FSNode>): FSNode {
  const name = overrides.name ?? 'note.txt';
  return {
    id: overrides.id ?? name,
    name,
    type: overrides.type ?? 'file',
    parentId: null,
    path: overrides.path ?? `/sdcard/Download/${name}`,
    size: overrides.size ?? 12,
    mimeType: overrides.mimeType,
    createdAt: overrides.createdAt ?? 1,
    modifiedAt: overrides.modifiedAt ?? 1,
    storage: overrides.storage ?? 'memory',
  };
}

describe('FileManager 文本预览识别', () => {
  it('允许常见文本扩展名和 text MIME 打开预览', () => {
    expect(isTextPreviewableFile(node({ name: 'note.txt' }))).toBe(true);
    expect(isTextPreviewableFile(node({ name: 'raw_login.log' }))).toBe(true);
    expect(isTextPreviewableFile(node({ name: 'data.json' }))).toBe(true);
    expect(isTextPreviewableFile(node({ name: 'table.csv' }))).toBe(true);
    expect(isTextPreviewableFile(node({ name: 'README', mimeType: 'text/plain' }))).toBe(true);
  });

  it('拒绝目录和非文本文件', () => {
    expect(isTextPreviewableFile(node({ name: 'logs', type: 'directory' }))).toBe(false);
    expect(isTextPreviewableFile(node({ name: 'contract.pdf', mimeType: 'application/pdf' }))).toBe(false);
    expect(isTextPreviewableFile(node({ name: 'photo.txt.jpg', mimeType: 'image/jpeg' }))).toBe(false);
  });
});
