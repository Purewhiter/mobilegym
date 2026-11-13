import { describe, expect, it } from 'vitest';

import ContentResolver from '../os/ContentResolver';
import { createContentSnapshot } from '../os/providers/contentSnapshot';

/** Observers are told in a microtask after the change (BroadcastBus). */
const changed = async (uri: string) => {
  ContentResolver.notifyChange(uri);
  await Promise.resolve();
  await Promise.resolve();
};

describe('content snapshot', () => {
  it('keeps one value until the provider changes, also with nobody subscribed', async () => {
    let reads = 0;
    const snapshot = createContentSnapshot('content://snaptest/items', () => ({ n: ++reads }));

    const first = snapshot.get();
    expect(snapshot.get()).toBe(first);

    // No page is showing the data (hidden on the back stack, or not mounted).
    await changed('content://snaptest/items/7');
    expect(snapshot.get()).toEqual({ n: 2 });

    // Another provider's change is not ours.
    await changed('content://other/items');
    expect(snapshot.get()).toEqual({ n: 2 });
  });

  it('hears a change to the provider as a whole', async () => {
    let reads = 0;
    const snapshot = createContentSnapshot('content://snapwhole/items', () => ++reads);
    expect(snapshot.get()).toBe(1);
    // A patch, a reset or the session's data arriving reports the authority, not a path.
    await changed('content://snapwhole');
    expect(snapshot.get()).toBe(2);
  });

  it('gives subscribers the new value when they are told', async () => {
    let reads = 0;
    const snapshot = createContentSnapshot('content://snapsub/items', () => ++reads);
    snapshot.get();
    const seen: number[] = [];
    const stop = snapshot.subscribe(() => seen.push(snapshot.get()));
    await changed('content://snapsub/items');
    stop();
    await changed('content://snapsub/items');
    expect(seen).toEqual([2]);
    expect(snapshot.get()).toBe(3);
  });
});
