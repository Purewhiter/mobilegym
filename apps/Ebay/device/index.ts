/**
 * Ebay on the device server.
 *
 * The catalog (`products.json` ~6MB, `categories.json`) is loaded once per
 * server process and shared by every session. It goes out raw: image URLs
 * depend on the page's CDN base, so the page resolves them (data/loader.ts).
 *
 * Session state is the whole former store state (recent searches, settings,
 * search bookkeeping, and the pass-through config fields), in the same shape
 * as before, so `__SIM__.getState().apps.ebay` and every bench judge keep
 * working unchanged. Commands are the former store actions.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppModule, Catalog } from '../../../device/engine';
import type { EbaySearchSnapshot } from '../state';
import type { ProductItem } from '../types';

export type EbayDeviceState = Record<string, any> & {
  recentSearches: { id: string; query: string }[];
  settings: { themeId: string };
  search: {
    current: Omit<EbaySearchSnapshot, 'id'>;
    history: EbaySearchSnapshot[];
    lastCompare: { a: EbaySearchSnapshot; b: EbaySearchSnapshot; cheaper: 'A' | 'B' | 'same' } | null;
  };
};

// ── Catalog ─────────────────────────────────────────────────────────

interface EbayCatalogExtras {
  products: ProductItem[];
  productById: Map<string, ProductItem>;
  categories: unknown[];
}

function loadCatalog(root: string): Catalog {
  const dataDir = join(root, 'apps', 'Ebay', 'data');
  const read = <T,>(name: string) => JSON.parse(readFileSync(join(dataDir, name), 'utf8')) as T;
  const products = read<ProductItem[]>('products.json');
  const extras: EbayCatalogExtras = {
    products,
    productById: new Map(products.map((p) => [String(p.id), p])),
    categories: read('categories.json'),
  };
  return { collections: new Map(), extras: extras as unknown as Record<string, unknown> };
}

const extras = (ctx: { catalog: Catalog }) => ctx.catalog.extras as unknown as EbayCatalogExtras;

// ── Commands (one per store action) ─────────────────────────────────

const commands: AppModule<EbayDeviceState>['commands'] = {
  addRecentSearch(ctx, [query]) {
    const q = String(query ?? '').trim();
    if (!q) return;
    const recent = ctx.state.recentSearches ?? [];
    ctx.state = {
      ...ctx.state,
      recentSearches: [{ id: `${recent.length + 1}`, query: q }, ...recent.filter((item) => item.query !== q)],
    };
  },

  clearRecentSearches(ctx) {
    ctx.state = { ...ctx.state, recentSearches: [] };
  },

  updateSettings(ctx, [patch]) {
    ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, ...(patch as object) } };
  },

  setSearchCurrent(ctx, [patch]) {
    const search = ctx.state.search;
    ctx.state = { ...ctx.state, search: { ...search, current: { ...search.current, ...(patch as object) } } };
  },

  recordSearchSnapshot(ctx) {
    const search = ctx.state.search;
    const history = [...search.history, { id: `${search.history.length + 1}`, ...search.current }];
    let lastCompare = search.lastCompare;
    if (history.length >= 2) {
      const a = history[history.length - 2];
      const b = history[history.length - 1];
      const at = a.firstTotalCents;
      const bt = b.firstTotalCents;
      const cheaper: 'A' | 'B' | 'same' =
        at == null || bt == null ? 'same' : at < bt ? 'A' : bt < at ? 'B' : 'same';
      lastCompare = { a, b, cheaper };
    }
    ctx.state = { ...ctx.state, search: { ...search, history, lastCompare } };
  },
};

// ── Queries (catalog only) ──────────────────────────────────────────

const queries: AppModule<EbayDeviceState>['queries'] = {
  products: (ctx) => extras(ctx).products,
  product: (ctx, args) => extras(ctx).productById.get(String(args.id ?? '')) ?? null,
  categories: (ctx) => extras(ctx).categories,
};

export function createEbayModule(): AppModule<EbayDeviceState> {
  return {
    appId: 'ebay',
    loadCatalog,
    materialize() {},
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ebay state must be an object');
      return raw as EbayDeviceState;
    },
    commands,
    queries,
  };
}
