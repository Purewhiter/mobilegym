import { createVolatileAppStore } from '@/os/createAppStore';
import { SCROLL_LAB_DEFAULTS } from './data';

interface ScrollLabState {
  selectedItemId: string | null;
  scrollTop: number;
  firstVisibleOrdinal: number;
  maxFirstVisibleOrdinal: number;
  upwardReversals: number;
}

interface ScrollLabActions {
  selectItem: (itemId: string) => void;
  recordScroll: (scrollTop: number, firstVisibleOrdinal: number, upwardReversal: boolean) => void;
}

export const useScrollLabStore = createVolatileAppStore<ScrollLabState & ScrollLabActions>(
  'scroll_lab',
  {
    selectedItemId: SCROLL_LAB_DEFAULTS.selectedItemId,
    scrollTop: 0,
    firstVisibleOrdinal: 1,
    maxFirstVisibleOrdinal: 1,
    upwardReversals: 0,
    selectItem: (itemId: string) => {
      useScrollLabStore.setState({ selectedItemId: itemId });
    },
    recordScroll: (scrollTop: number, firstVisibleOrdinal: number, upwardReversal: boolean) => {
      const previous = useScrollLabStore.getState();
      useScrollLabStore.setState({
        scrollTop,
        firstVisibleOrdinal,
        // Monotonic high-water mark. A target at ordinal N stays tappable only
        // while maxFirstVisibleOrdinal <= N, so this turns "scrolled past the
        // target" into a judgeable, irreversible fact.
        maxFirstVisibleOrdinal: Math.max(previous.maxFirstVisibleOrdinal, firstVisibleOrdinal),
        upwardReversals: previous.upwardReversals + (upwardReversal ? 1 : 0),
      });
    },
  },
);
