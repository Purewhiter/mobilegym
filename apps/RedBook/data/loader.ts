/**
 * RedBook data loader.
 *
 * The base dataset (notes.json + users.json, ~13MB) is no longer fetched into
 * the page: it lives in the device server (apps/RedBook/device), shared by
 * every session. Loading RedBook only means syncing the store mirror with this
 * page's device session; pages read notes and users through device queries
 * (see ./view.ts).
 */

import { useRedBookStore } from '../state';

// ============ App-data-loader contract ============

export async function hydrateStore(): Promise<void> {
  await useRedBookStore.ensureSynced();
}

export async function preload(): Promise<void> {
  await useRedBookStore.ensureSynced();
}
