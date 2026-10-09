import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../os/TimeService', () => ({ now: () => 1000, realNow: () => 1000 }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('filesystem snapshots omit transient thumbnail data but retain metadata', async () => {
  vi.resetModules();
  vi.stubGlobal('window', {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const fs = await import('../os/FileSystemService');
  await fs.initFileSystem();
  const node = await fs.createDirectory('/review-snapshot');
  node.thumbnailUri = 'data:image/png;base64,review';
  node.width = 64;
  const snapshot = fs.snapshotFileSystem().nodes.find(n => n.path === node.path);
  expect(snapshot).not.toHaveProperty('thumbnailUri');
  expect(snapshot?.width).toBe(64);
});
