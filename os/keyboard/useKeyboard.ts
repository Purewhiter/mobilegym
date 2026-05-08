import { useEffect, useState } from 'react';
import { KeyboardService, KeyboardServiceState } from './KeyboardService';

/**
 * Hook to subscribe to keyboard state changes.
 * 
 * Usage in App components:
 * 
 *   const { visible, height } = useKeyboard();
 *   
 *   // Bottom input bar: set bottom to keyboard height
 *   <div style={{ bottom: height }}>...</div>
 *   
 *   // Content area: add paddingBottom to avoid being covered
 *   <div style={{ paddingBottom: height }}>...</div>
 */
export function useKeyboard(): KeyboardServiceState {
  const [state, setState] = useState<KeyboardServiceState>(KeyboardService.getState());

  useEffect(() => {
    return KeyboardService.subscribe(setState);
  }, []);

  return state;
}

/**
 * Returns just the keyboard height (convenience hook).
 * Returns 0 when keyboard is hidden.
 */
export function useKeyboardHeight(): number {
  const { height } = useKeyboard();
  return height;
}
