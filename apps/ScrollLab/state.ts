import { createVolatileAppStore } from '@/os/createAppStore';
import { SCROLL_LAB_DEFAULTS } from './data';

interface ScrollLabState {
  selectedItemId: string | null;
}

interface ScrollLabActions {
  selectItem: (itemId: string) => void;
}

export const useScrollLabStore = createVolatileAppStore<ScrollLabState & ScrollLabActions>(
  'scroll_lab',
  {
    selectedItemId: SCROLL_LAB_DEFAULTS.selectedItemId,
    selectItem: (itemId: string) => {
      useScrollLabStore.setState({ selectedItemId: itemId });
    },
  },
);
