import { describe, expect, it } from 'vitest';
import {
  createDirectory,
  getNode,
  readFile,
  setMetadata,
  writeFile,
} from '../os/FileSystemService';

// These run against the real FileSystemService. In the vitest `node`
// environment there is no IndexedDB, so the IDB writers (saveFileToDB /
// saveMetadataToDB) gracefully no-op and the module operates purely on its
// in-memory node map — which is exactly the metadata that setMetadata patches.

async function seedFile(path: string): Promise<void> {
  await writeFile(path, new Blob(['x'], { type: 'image/jpeg' }), {
    mimeType: 'image/jpeg',
    createdAt: 1_000,
    modifiedAt: 1_000,
  });
}

describe('FileSystemService.setMetadata', () => {
  it('patches createdAt and modifiedAt in place', async () => {
    const path = '/sdcard/DCIM/Camera/setmeta_times.jpg';
    await seedFile(path);

    const updated = await setMetadata(path, {
      createdAt: 1_679_713_540_000,
      modifiedAt: 1_679_713_540_000,
    });

    expect(updated).not.toBeNull();
    const node = getNode(path)!;
    expect(node.createdAt).toBe(1_679_713_540_000);
    expect(node.modifiedAt).toBe(1_679_713_540_000);
  });

  it('only writes the fields present in the patch', async () => {
    const path = '/sdcard/DCIM/Camera/setmeta_partial.jpg';
    await seedFile(path);

    await setMetadata(path, { modifiedAt: 2_000 });

    const node = getNode(path)!;
    expect(node.modifiedAt).toBe(2_000);
    expect(node.createdAt).toBe(1_000); // untouched
  });

  it('does not touch the blob or storage backend', async () => {
    const path = '/sdcard/DCIM/Camera/setmeta_storage.jpg';
    await seedFile(path);
    const before = getNode(path)!;
    const storageBefore = before.storage;
    const sizeBefore = before.size;

    await setMetadata(path, { modifiedAt: 3_000 });

    const after = getNode(path)!;
    expect(after.storage).toBe(storageBefore);
    expect(after.size).toBe(sizeBefore);
  });

  it('ignores structural / internal fields not on the whitelist', async () => {
    const path = '/sdcard/DCIM/Camera/setmeta_guard.jpg';
    await seedFile(path);
    const before = getNode(path)!;

    // A caller bypassing the type with `as never` must not be able to corrupt
    // identity (id/path) or storage/size invariants.
    await setMetadata(path, {
      modifiedAt: 4_000,
      id: 'evil',
      path: '/evil',
      storage: 'preset',
      size: 999_999,
    } as never);

    const after = getNode(path)!;
    expect(after.modifiedAt).toBe(4_000); // whitelisted field applied
    expect(after.id).toBe(before.id);
    expect(after.path).toBe(path);
    expect(after.storage).toBe(before.storage);
    expect(after.size).toBe(before.size);
    // The rogue path was not registered as a new node.
    expect(getNode('/evil')).toBeNull();
  });

  it('updates timestamps even when the blob is unavailable', async () => {
    const path = '/sdcard/DCIM/Camera/setmeta_noblob.jpg';
    await seedFile(path);
    // Blob was never persisted (no IndexedDB in this env), so read() yields null
    // — the exact scenario the old read-then-write workaround skipped silently.
    expect(await readFile(path)).toBeNull();

    const updated = await setMetadata(path, { modifiedAt: 5_000 });

    expect(updated).not.toBeNull();
    expect(getNode(path)!.modifiedAt).toBe(5_000);
  });

  it('returns null for a missing path', async () => {
    expect(await setMetadata('/sdcard/does_not_exist.jpg', { modifiedAt: 1 })).toBeNull();
  });

  it('returns null for a directory', async () => {
    const dir = '/sdcard/setmeta_dir';
    await createDirectory(dir);

    expect(await setMetadata(dir, { modifiedAt: 1 })).toBeNull();
  });
});
