import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { BROWSER_CONFIG } from './data';

// --- Types ---

export interface Tab {
  id: string;
  url: string;
  title: string;
}

interface BrowserState {
  tabs: Tab[];
  activeTabId: string;
  visitedUrls: string[];
}

interface BrowserActions {
  /** Set the active tab by ID */
  setActiveTabId: (id: string) => void;
  /** Navigate a tab to a URL (updates url + title) */
  navigateTab: (tabId: string, url: string) => void;
  /** Add a new empty tab and make it active; returns the new tab ID */
  addTab: () => string;
  /** Close a tab; if it's the last one, replaces with a fresh default tab.
   *  Returns { newActiveTabId, newActiveTabHasUrl } so the caller can do router navigation. */
  closeTab: (id: string) => { newActiveTabId: string; newActiveTabHasUrl: boolean };
  /** Reset a tab to the home state (empty URL) */
  goHome: (tabId: string) => void;
  /** Track a visited URL (no-op if already tracked) */
  trackVisitedUrl: (url: string) => void;
}

// --- Initial state ---

const initialState: BrowserState = {
  tabs: BROWSER_CONFIG.tabs as Tab[],
  activeTabId: BROWSER_CONFIG.activeTabId,
  visitedUrls: BROWSER_CONFIG.visitedUrls as string[],
};

// --- Store ---

export const useBrowserStore = createAppStoreWithActions<BrowserState, BrowserActions>(
  'browser',
  initialState,
  (set, get) => ({
    setActiveTabId(id: string) {
      set({ activeTabId: id });
    },

    navigateTab(tabId: string, url: string) {
      const { tabs } = get();
      set({
        tabs: tabs.map(t =>
          t.id === tabId ? { ...t, url, title: url.split('/')[2] || url } : t,
        ),
      });
    },

    addTab() {
      const newId = Math.random().toString(36).substr(2, 9);
      const { tabs } = get();
      set({
        tabs: [...tabs, { id: newId, url: '', title: '主页' }],
        activeTabId: newId,
      });
      return newId;
    },

    closeTab(id: string) {
      const { tabs, activeTabId } = get();

      // Last tab: replace with fresh default
      if (tabs.length === 1) {
        const freshTab: Tab = { id: '1', url: '', title: '主页' };
        set({ tabs: [freshTab], activeTabId: '1' });
        return { newActiveTabId: '1', newActiveTabHasUrl: false };
      }

      const newTabs = tabs.filter(t => t.id !== id);
      // If we're closing the active tab, switch to the first remaining one
      if (id === activeTabId) {
        const newActive = newTabs[0];
        set({ tabs: newTabs, activeTabId: newActive.id });
        return { newActiveTabId: newActive.id, newActiveTabHasUrl: !!newActive.url };
      }

      set({ tabs: newTabs });
      return { newActiveTabId: activeTabId, newActiveTabHasUrl: !!tabs.find(t => t.id === activeTabId)?.url };
    },

    goHome(tabId: string) {
      const { tabs } = get();
      set({
        tabs: tabs.map(t =>
          t.id === tabId ? { ...t, url: '', title: '主页' } : t,
        ),
      });
    },

    trackVisitedUrl(url: string) {
      if (!url) return;
      const { visitedUrls } = get();
      if (visitedUrls.includes(url)) return;
      set({ visitedUrls: [...visitedUrls, url] });
    },
  }),
);

// --- Memoized selectors ---

/** Derive the active tab from tabs + activeTabId */
export const selectActiveTab = memoSelector(
  (state: BrowserState & BrowserActions) => ({ tabs: state.tabs, activeTabId: state.activeTabId }),
  ({ tabs, activeTabId }) => tabs.find(t => t.id === activeTabId) || tabs[0],
);
