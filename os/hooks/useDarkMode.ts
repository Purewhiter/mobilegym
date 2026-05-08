import { useState, useEffect } from 'react';
import { QuickSettingsService } from '../QuickSettingsService';

/**
 * Hook that returns current dark mode state and re-renders when it changes.
 * Apps use this to switch CSS var sets between light/dark palettes.
 */
export function useDarkMode(): { isDark: boolean } {
  const [isDark, setIsDark] = useState(() => QuickSettingsService.getState().darkModeEnabled);

  useEffect(() => {
    return QuickSettingsService.subscribe((s) => {
      setIsDark(s.darkModeEnabled);
    });
  }, []);

  return { isDark };
}
