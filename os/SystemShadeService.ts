import type { ShadePanelKind, SystemShadeSnapshot } from './types';
import { BackDispatcher } from './BackDispatcher';
import { createVolatileOsStore } from './createOsStore';
import { KeyboardService } from './keyboard/KeyboardService';
import { TextSelectionService } from './TextSelectionService';

const base = createVolatileOsStore<SystemShadeSnapshot>('shade', {
  open: false,
  kind: 'notifications',
});

export const SystemShadeService = {
  getState: base.getState,

  subscribe(listener: (state: SystemShadeSnapshot) => void): () => void {
    listener(base.getState());
    return base.subscribe(listener);
  },

  isOpen(): boolean {
    return base.getState().open;
  },

  open(kind: ShadePanelKind): void {
    KeyboardService.hide();
    TextSelectionService.hideSelectionMenu();

    const state = base.getState();
    if (state.open && state.kind === kind) return;
    base.setState({ open: true, kind }, true);
  },

  close(): void {
    const state = base.getState();
    if (!state.open) return;
    base.setState({ ...state, open: false }, true);
  },

  toggle(kind: ShadePanelKind): void {
    const state = base.getState();
    if (state.open && state.kind === kind) {
      SystemShadeService.close();
      return;
    }
    SystemShadeService.open(kind);
  },
};

if (typeof window !== 'undefined') {
  BackDispatcher.register('shade.dismiss', () => {
    if (!SystemShadeService.isOpen()) return false;
    SystemShadeService.close();
    return true;
  }, 800);
}

export default SystemShadeService;
