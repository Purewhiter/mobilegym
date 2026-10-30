import { createDeviceAppStore } from '../../os/device/deviceStore';
import { EBAY_CONFIG } from './data';

// ---- Types ----

type ThemeId = 'light' | 'dark' | 'battery' | 'system';
type SortOptionType = 'bestMatch' | 'priceLow' | 'priceHigh' | 'endingSoon' | 'newlyListed' | 'distance';
type BuyingFormat = 'all' | 'auction' | 'buyItNow' | 'offer';

export type EbaySearchSnapshot = {
  id: string;
  query: string;
  sortOption: SortOptionType;
  buyingFormat: BuyingFormat;
  categoryId: string | null;
  brand: string | null;
  location: string | null;
  freeShippingOnly: boolean;
  conditions: string[];
  priceMin: string;
  priceMax: string;
  resultsCount: number;
  firstTitle: string | null;
  firstTotalCents: number | null;
};

type EbaySearchCurrent = Omit<EbaySearchSnapshot, 'id'>;

// ---- State & Actions interfaces ----

interface EbayState {
  recentSearches: typeof EBAY_CONFIG.recentSearches;
  settings: {
    themeId: ThemeId;
  };
  search: {
    current: EbaySearchCurrent;
    history: EbaySearchSnapshot[];
    lastCompare: {
      a: EbaySearchSnapshot;
      b: EbaySearchSnapshot;
      cheaper: 'A' | 'B' | 'same';
    } | null;
  };
  // Pass-through fields from EBAY_CONFIG (user, savedItems, cartItems, homeProducts, etc.)
  [key: string]: any;
}

interface EbayActions {
  addRecentSearch: (query: string) => Promise<void>;
  clearRecentSearches: () => Promise<void>;
  updateSettings: (patch: Partial<EbayState['settings']>) => Promise<void>;
  setSearchCurrent: (patch: Partial<EbaySearchCurrent>) => Promise<void>;
  recordSearchSnapshot: () => Promise<void>;
}

// ---- Store ----

const initialState: EbayState = {
  ...EBAY_CONFIG,
  recentSearches: EBAY_CONFIG.recentSearches,
  settings: {
    themeId: (EBAY_CONFIG.settings?.themeId as ThemeId) ?? 'system',
  },
  search: {
    current: { ...EBAY_CONFIG.search.current } as EbaySearchCurrent,
    history: (EBAY_CONFIG.search.history ?? []) as EbaySearchSnapshot[],
    lastCompare: (EBAY_CONFIG.search.lastCompare ?? null) as EbayState['search']['lastCompare'],
  },
};

// Every field lives in the device server session (apps/Ebay/device); this
// store mirrors it, so components and `__SIM__.getState().apps.ebay` read the
// same shape as before. Actions run the matching server command.
export const useEbayStore = createDeviceAppStore<EbayState, EbayActions>(
  'ebay',
  initialState,
  { localKeys: [] },
  ({ command, optimistic }) => {
    const run = (name: string) => async (...args: unknown[]) => {
      await command(name, ...args);
    };
    return {
      addRecentSearch: run('addRecentSearch'),
      clearRecentSearches: run('clearRecentSearches'),
      // Show the new value at once, so a second tap reads it.
      updateSettings: async (patch) => {
        await optimistic((state) => ({ settings: { ...state.settings, ...patch } }), 'updateSettings', patch);
      },
      setSearchCurrent: run('setSearchCurrent'),
      recordSearchSnapshot: run('recordSearchSnapshot'),
    };
  },
);
