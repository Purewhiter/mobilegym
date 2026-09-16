import { createVolatileAppStore } from '@/os/createAppStore';
import { SCROLL_LAB_DEFAULTS } from './data';

interface ScrollLabState {
  selectedItemId: string | null;
  scrollTop: number;
  firstVisibleOrdinal: number;
}

interface ScrollLabActions {
  selectItem: (itemId: string) => void;
  setScrollPosition: (scrollTop: number, firstVisibleOrdinal: number) => void;
}

export const useScrollLabStore = createVolatileAppStore<ScrollLabState & ScrollLabActions>(
  'scroll_lab',
  {
    selectedItemId: SCROLL_LAB_DEFAULTS.selectedItemId,
    scrollTop: 0,
    firstVisibleOrdinal: 1,
    selectItem: (itemId: string) => {
      useScrollLabStore.setState({ selectedItemId: itemId });
    },
    setScrollPosition: (scrollTop: number, firstVisibleOrdinal: number) => {
      useScrollLabStore.setState({ scrollTop, firstVisibleOrdinal });
    },
  },
);
