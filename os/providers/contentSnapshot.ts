/**
 * A cached read of provider data for `useSyncExternalStore`.
 *
 * `useSyncExternalStore` needs the same value back until the data changes, so
 * a page keeps the result of its `ContentResolver.query` in a module variable.
 * Refreshing that variable from the component's own subscription is not
 * enough: a page that is hidden (kept on the back stack) or not mounted has no
 * subscription, and would come back showing what it read before the change.
 * Here the cache is dropped by an observer that is always registered, and
 * rebuilt on the next read. Observers hear of a change in a microtask, so a
 * read in the same tick as the write still returns the value from before it.
 */

import ContentResolver from '../ContentResolver';
import type { ContentUri } from '../types/content';

export interface ContentSnapshot<T> {
  /** The current value; the same object until the provider reports a change under `uri`. */
  get: () => T;
  /** `useSyncExternalStore` subscribe. */
  subscribe: (listener: () => void) => () => void;
}

export function createContentSnapshot<T>(uri: ContentUri, read: () => T): ContentSnapshot<T> {
  let value: T | undefined;
  let fresh = false;
  const drop = () => {
    fresh = false;
  };
  ContentResolver.registerContentObserver(uri, drop);
  return {
    get() {
      if (!fresh) {
        value = read();
        fresh = true;
      }
      return value as T;
    },
    subscribe: (listener) =>
      ContentResolver.registerContentObserver(uri, () => {
        // Dropped here too, so the listener never reads the old value whatever the observer order.
        drop();
        listener();
      }),
  };
}
