import { ACTION_KEYBOARD_CHANGED } from '../BroadcastBus';
import BroadcastBus from '../BroadcastBus';
import { BackDispatcher } from '../BackDispatcher';
import { createVolatileOsStore } from '../createOsStore';
import { SIMULATOR_CONFIG } from '../data';

const { keyboardHeight } = SIMULATOR_CONFIG.framework;

export type KeyboardMode = 'en' | 'zh';

export interface KeyboardServiceState {
  visible: boolean;
  mode: KeyboardMode;
  height: number;
}

const base = createVolatileOsStore<KeyboardServiceState>('keyboard', {
  visible: false,
  mode: 'en',
  height: 0,
});

export const KeyboardService = {
  getState: base.getState,

  subscribe(listener: (state: KeyboardServiceState) => void): () => void {
    listener(base.getState());
    return base.subscribe(listener);
  },

  isVisible(): boolean {
    return base.getState().visible;
  },

  getHeight(): number {
    return base.getState().height;
  },

  show(): void {
    const state = base.getState();
    if (state.visible) return;
    base.setState({ ...state, visible: true, height: keyboardHeight }, true);
  },

  hide(): void {
    const state = base.getState();
    if (!state.visible) return;
    base.setState({ ...state, visible: false, height: 0 }, true);
  },

  setHeight(height: number): void {
    const state = base.getState();
    if (state.height === height) return;
    base.setState({ ...state, height }, true);
  },

  setMode(mode: KeyboardMode): void {
    const state = base.getState();
    if (state.mode === mode) return;
    base.setState({ ...state, mode }, true);
  },

  toggleMode(): void {
    const state = base.getState();
    KeyboardService.setMode(state.mode === 'en' ? 'zh' : 'en');
  },
};

base.subscribe((state) => {
  BroadcastBus.sendBroadcast({
    action: ACTION_KEYBOARD_CHANGED,
    extras: { ...state },
  });
});

if (typeof window !== 'undefined') {
  BackDispatcher.register('keyboard.dismiss', () => {
    if (!KeyboardService.isVisible()) return false;
    KeyboardService.hide();
    return true;
  }, 700);
}

export default KeyboardService;
