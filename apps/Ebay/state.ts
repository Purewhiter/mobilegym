import { createAppStoreWithActions } from '../../os/createAppStore';
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
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  updateSettings: (patch: Partial<EbayState['settings']>) => void;
  setSearchCurrent: (patch: Partial<EbaySearchCurrent>) => void;
  recordSearchSnapshot: () => void;
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

export const useEbayStore = createAppStoreWithActions<EbayState, EbayActions>(
  'ebay',
  initialState,
  (set, get) => ({
    addRecentSearch: (query: string) => {
      const q = query.trim();
      if (!q) return;
      set(state => ({
        recentSearches: [
          { id: `${(state.recentSearches?.length ?? 0) + 1}`, query: q },
          ...(state.recentSearches ?? []).filter((item: any) => item.query !== q),
        ],
      }));
    },

    clearRecentSearches: () => {
      set({ recentSearches: [] });
    },

    updateSettings: (patch) => {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },

    setSearchCurrent: (patch: Partial<EbaySearchCurrent>) => {
      set(state => ({
        search: {
          ...state.search,
          current: { ...state.search.current, ...patch },
        },
      }));
    },

    recordSearchSnapshot: () => {
      set(state => {
        const currentSearch = state.search.current;
        const prevHistory = state.search.history;
        const id = `${prevHistory.length + 1}`;
        const next: EbaySearchSnapshot = { id, ...currentSearch };
        const nextHistory = [...prevHistory, next];
        let newLastCompare = state.search.lastCompare;
        if (nextHistory.length >= 2) {
          const a = nextHistory[nextHistory.length - 2];
          const b = nextHistory[nextHistory.length - 1];
          const at = a.firstTotalCents;
          const bt = b.firstTotalCents;
          const cheaper: 'A' | 'B' | 'same' =
            at == null || bt == null ? 'same' : at < bt ? 'A' : bt < at ? 'B' : 'same';
          newLastCompare = { a, b, cheaper };
        }
        return {
          search: {
            ...state.search,
            history: nextHistory,
            lastCompare: newLastCompare,
          },
        };
      });
    },
  }),
);
