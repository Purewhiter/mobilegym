/**
 * Stores of the system content providers (contacts, SMS, media).
 *
 * Their data is part of the phone, so it lives in the page's device session
 * next to the apps' state (os/device/deviceStore.ts), under `provider_<name>`:
 * every page has its own, a reset starts from the defaults, and nothing is left
 * in localStorage for another page or the next episode to pick up.
 *
 * The page is the authority (`syncSetState`): a provider reads and writes its
 * store synchronously, as before, and each write is saved to the session. The
 * session's data is adopted once per session; until then the store holds the
 * defaults. Code that must see the real data first awaits
 * `ensureProvidersSynced()` (app launch and `__SIM__.waitForData` do); observers
 * are told when it arrives, so anything already on screen reads again.
 */

import { produce } from 'immer';
import type { StoreApi, UseBoundStore } from 'zustand';

import ContentResolver from '../ContentResolver';
import { registerProviderStore } from '../createOsStore';
import { createDeviceAppStore, subscribeDeviceData, type DeviceStateSetter } from '../device/deviceStore';

type ProviderState = Record<string, any>;

export type ProviderStore<S extends ProviderState> = UseBoundStore<StoreApi<S>> & {
  ensureSynced: (force?: boolean) => Promise<void>;
};

const syncs: (() => Promise<void>)[] = [];

/**
 * A provider's store. `name` is the provider's authority (`contacts` for
 * `content://contacts`) and its key under `__SIM__.getState().os.providers`.
 * `setState` takes an immer recipe, like the OS stores.
 */
export function createProviderStore<S extends ProviderState>(name: string, defaultState: S): ProviderStore<S> {
  const sessionKey = `provider_${name}`;
  let reset: () => void = () => {};
  let setter: DeviceStateSetter | null = null;

  const store = createDeviceAppStore<S, Record<never, never>>(
    sessionKey,
    structuredClone(defaultState),
    {
      localKeys: [],
      syncSetState: true,
      migrateLocalStorage: true,
      register: {
        store: (_id, _store, resetStore) => {
          reset = resetStore;
        },
        setter: (_id, patch) => {
          setter = patch;
        },
      },
    },
    () => ({}),
  );

  // Recipes change a draft, as with the immer middleware of the OS stores.
  const save = store.setState;
  store.setState = ((partial: unknown, replace?: boolean) =>
    save(typeof partial === 'function' ? (produce(partial as (draft: S) => void) as never) : (partial as never), replace as false)
  ) as typeof store.setState;

  registerProviderStore(name, store, () => reset(), (applyPatch) => setter!(applyPatch));

  // The session's data arrived, a patch was applied, or the phone was reset:
  // whoever shows this provider's data reads it again.
  subscribeDeviceData(sessionKey, () => {
    try {
      ContentResolver.notifyChange(`content://${name}`);
    } catch {
      // No observers yet (module still loading).
    }
  });

  syncs.push(() => store.ensureSynced());
  return store;
}

/** Resolves once every provider holds its session's data. */
export async function ensureProvidersSynced(): Promise<void> {
  await Promise.all(syncs.map((sync) => sync()));
}
