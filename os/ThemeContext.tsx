import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeService } from './ThemeService';

type ThemeContextValue = {
  ready: boolean;
  version: number; // increments when theme changes
  themeService: typeof ThemeService;
};

/**
 * Default context value uses the ThemeService singleton directly.
 * This prevents crashes if useTheme is called outside the Provider
 * (e.g. during HMR or React error recovery). The singleton is always
 * available; only the reactive `version` counter won't auto-increment.
 */
const defaultContextValue: ThemeContextValue = {
  ready: false,
  version: 0,
  themeService: ThemeService,
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ThemeService.init()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        console.error('[ThemeProvider] init failed', e);
        if (!cancelled) setReady(true);
      });

    const off = ThemeService.onThemeChanged(() => {
      setVersion((v) => v + 1);
    });

    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    return { ready, version, themeService: ThemeService };
  }, [ready, version]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
