import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { DeviceServer, type Session } from '../device/engine';
import { createFsModule, type FsNode } from '../device/fs';

/** A tiny public/sdcard with one dated photo and one note. */
function writeSdcard(): string {
  const root = mkdtempSync(join(tmpdir(), 'device-fs-'));
  const camera = join(root, 'public', 'sdcard', 'DCIM', 'Camera');
  mkdirSync(camera, { recursive: true });
  mkdirSync(join(root, 'public', 'sdcard', 'Documents'), { recursive: true });
  writeFileSync(join(camera, 'IMG_20221201_094515.jpg'), 'jpeg-bytes');
  writeFileSync(join(root, 'public', 'sdcard', 'Documents', 'note.txt'), 'hello');
  return root;
}

const root = writeSdcard();

describe('device file system', () => {
  let server: DeviceServer;
  let session: Session;
  const nodes = () => (server.exportState(session, 'fs') as { nodes: FsNode[] }).nodes;
  const node = (path: string) => nodes().find(n => n.path === path);
  const run = (name: string, ...args: unknown[]) => server.runCommand(session, 'fs', name, args, { now: 50_000 });
  const write = (path: string, extra: Record<string, unknown> = {}) => {
    const blob = session.putBlob(new Uint8Array([1]), 'image/jpeg');
    return run('write', path, { blob, size: 1, mimeType: 'image/jpeg', createdAt: 1_000, modifiedAt: 1_000, ...extra });
  };

  beforeEach(() => {
    server = new DeviceServer(root);
    server.register(createFsModule());
    session = server.createSession();
    server.importState(session, 'fs', { now: 10_000, timeZone: 'Asia/Shanghai' });
  });

  it('seeds the preset tree without copying content', () => {
    const photo = node('/sdcard/DCIM/Camera/IMG_20221201_094515.jpg')!;
    expect(photo).toMatchObject({
      id: 'seed__sdcard_DCIM_Camera_IMG_20221201_094515.jpg',
      type: 'file',
      mimeType: 'image/jpeg',
      size: 10,
      storage: 'device',
      content: { seed: '/sdcard/DCIM/Camera/IMG_20221201_094515.jpg' },
    });
    // 09:45:15 in Asia/Shanghai, as the page would parse the name.
    expect(photo.createdAt).toBe(Date.UTC(2022, 11, 1, 1, 45, 15));
    expect(node('/sdcard/Documents')?.type).toBe('directory');
    expect(session.blobs.size).toBe(0);
  });

  it('writes, moves, copies and deletes', () => {
    const { result: written } = run('write', '/sdcard/Download/a/b.txt', {
      blob: session.putBlob(new Uint8Array([104, 105]), 'text/plain'),
      size: 2,
      defaultMimeType: 'text/plain',
    });
    expect((written as FsNode).content).toHaveProperty('blob');
    expect(node('/sdcard/Download/a')?.type).toBe('directory');

    run('move', '/sdcard/Download/a', '/sdcard/Download/c');
    expect(node('/sdcard/Download/c/b.txt')?.id).toBe((written as FsNode).id);
    expect(node('/sdcard/Download/a')).toBeUndefined();

    const { result: copy } = run('copy', '/sdcard/Documents/note.txt', '/sdcard/Download/c/note.txt');
    expect((copy as FsNode).content).toEqual({ seed: '/sdcard/Documents/note.txt' });

    expect(run('delete', '/sdcard/Download/c').result).toBe(true);
    expect(nodes().some(n => n.path.startsWith('/sdcard/Download/c'))).toBe(false);
  });

  it('refuses to move a directory into its own subtree', () => {
    expect(run('move', '/sdcard/DCIM', '/sdcard/DCIM/Camera/inner').result).toBeNull();
    expect(node('/sdcard/DCIM/Camera')).toBeDefined();
  });

  it('rejects a write over a directory and leaves the tree unchanged', () => {
    const before = nodes();
    expect(() => write('/sdcard/Documents')).toThrow(/is a directory/);
    expect(nodes()).toEqual(before);
  });

  it('reset restores the preset tree', () => {
    write('/sdcard/Download/x.jpg');
    run('delete', '/sdcard/Documents/note.txt');
    run('reset');
    expect(node('/sdcard/Download/x.jpg')).toBeUndefined();
    expect(node('/sdcard/Documents/note.txt')).toBeDefined();
  });

  it('frees blobs no file references any more, but keeps fresh uploads', () => {
    const { result: a } = write('/sdcard/Download/a.jpg');
    const blobA = ((a as FsNode).content as { blob: string }).blob;
    const pending = session.putBlob(new Uint8Array([9]), 'image/jpeg');
    run('copy', '/sdcard/Download/a.jpg', '/sdcard/Download/b.jpg');
    run('delete', '/sdcard/Download/a.jpg');
    expect(session.blobs.has(blobA)).toBe(true); // still used by the copy
    run('delete', '/sdcard/Download/b.jpg');
    expect(session.blobs.has(blobA)).toBe(false);
    expect(session.blobs.has(pending)).toBe(true); // uploaded, not yet written
  });

  it('keeps sessions isolated', () => {
    const other = server.createSession();
    server.importState(other, 'fs', { now: 10_000, timeZone: 'UTC' });
    run('delete', '/sdcard/Documents/note.txt');
    const otherNodes = (server.exportState(other, 'fs') as { nodes: FsNode[] }).nodes;
    expect(otherNodes.some(n => n.path === '/sdcard/Documents/note.txt')).toBe(true);
  });

  describe('setMetadata', () => {
    const path = '/sdcard/DCIM/Camera/setmeta.jpg';
    beforeEach(() => {
      write(path);
    });

    it('patches only the fields present', () => {
      run('setMetadata', path, { modifiedAt: 2_000 });
      expect(node(path)).toMatchObject({ modifiedAt: 2_000, createdAt: 1_000 });
    });

    it('ignores structural and internal fields', () => {
      const before = node(path)!;
      run('setMetadata', path, { modifiedAt: 4_000, id: 'evil', path: '/evil', storage: 'preset', size: 999 });
      expect(node(path)).toMatchObject({ modifiedAt: 4_000, id: before.id, storage: before.storage, size: before.size });
      expect(node('/evil')).toBeUndefined();
    });

    it('returns null for a missing path or a directory', () => {
      expect(run('setMetadata', '/sdcard/missing.jpg', { modifiedAt: 1 }).result).toBeNull();
      expect(run('setMetadata', '/sdcard/DCIM', { modifiedAt: 1 }).result).toBeNull();
    });
  });
});
