import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStateOnlyModule } from '../device/stateOnly';
import { patchServerState, resetServerStates, serverState } from './support/memoryDevice';

vi.mock('../os/device/DeviceClient', async () =>
  (await import('./support/memoryDevice')).memoryDeviceClient([createStateOnlyModule('provider_notes')]));

const changed: string[] = [];
vi.mock('../os/ContentResolver', () => {
  const ContentResolver = { notifyChange: (uri: string) => void changed.push(uri) };
  return { ContentResolver, default: ContentResolver };
});

const { createProviderStore, ensureProvidersSynced } = await import('../os/providers/providerStore');
const { patchProviders, resetAllOsStores, snapshotProviders } = await import('../os/createOsStore');
/** Saves are queued behind the sync: give the in-memory session a moment to take them. */
const saved = () => new Promise((resolve) => setTimeout(resolve, 20));

type NotesState = { notes: { id: string; text: string }[] };
const defaults: NotesState = { notes: [{ id: 'n1', text: 'default' }] };

const store = createProviderStore<NotesState>('notes', defaults);
const add = (id: string, text: string) =>
  (store.setState as any)((state: NotesState) => {
    state.notes.push({ id, text });
  });

describe('provider store kept in the device session', () => {
  beforeEach(async () => {
    resetServerStates();
    resetAllOsStores();
    await ensureProvidersSynced();
    changed.length = 0;
  });

  it('seeds a new session with the defaults and saves writes to it', async () => {
    expect(serverState('provider_notes')).toEqual(defaults);
    add('n2', 'written');
    // Synchronous for the provider that wrote it.
    expect(store.getState().notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    await saved();
    expect(serverState('provider_notes').notes.map((n: { id: string }) => n.id)).toEqual(['n1', 'n2']);
    // The defaults were not changed in place.
    expect(defaults.notes).toHaveLength(1);
  });

  it('adopts what the session holds and tells observers', async () => {
    patchServerState('provider_notes', { notes: [{ id: 's1', text: 'from session' }] });
    await store.ensureSynced(true);
    expect(store.getState().notes).toEqual([{ id: 's1', text: 'from session' }]);
    expect(changed).toContain('content://notes');
  });

  it('applies an external patch to the session and the page', async () => {
    const { patched, pending } = patchProviders({ notes: { 'notes[]': { id: 'p1', text: 'patched' }, 'notes[id=n1]': null } }, true);
    expect(patched).toEqual([]);
    await Promise.all(pending);
    expect(store.getState().notes).toEqual([{ id: 'p1', text: 'patched' }]);
    expect(serverState('provider_notes').notes).toEqual([{ id: 'p1', text: 'patched' }]);
    expect(changed).toContain('content://notes');
  });

  it('is part of os.providers and goes back to the defaults on reset', async () => {
    add('n2', 'gone after reset');
    expect(snapshotProviders().notes.notes).toHaveLength(2);
    resetAllOsStores();
    expect(snapshotProviders().notes).toEqual(defaults);
  });
});
