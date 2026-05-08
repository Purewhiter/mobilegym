import React, { useEffect, useState } from 'react';
import { useTheme } from './ThemeContext';
import { BootSplash } from './BootSplash';

const FADE_DURATION_MS = 200;

/**
 * Gates the app's first render until async boot signals are ready (currently
 * just ThemeService.init). Renders BootSplash on top, fades it out on ready,
 * and unmounts after the fade. Children mount the moment ready flips so the
 * cross-fade reveals real UI underneath rather than hard-popping.
 */
export const BootGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ready } = useTheme();
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setSplashMounted(false), FADE_DURATION_MS + 50);
    return () => window.clearTimeout(id);
  }, [ready]);

  return (
    <>
      {ready ? children : null}
      {splashMounted ? <BootSplash fadingOut={ready} /> : null}
    </>
  );
};
