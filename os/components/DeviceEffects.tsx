import React, { useEffect } from 'react';
import { useOsStateStore } from '../OsStateStore';
import { displayScaleFromPct, fontScaleFromPct } from '../managers/DisplayManager';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function computeBrightnessFactor(brightnessPct: number): number {
  // Keep a minimum so the UI never becomes fully black.
  const p = clamp01(brightnessPct / 100);
  return 0.25 + p * 0.75; // 0.25..1.0
}

function buildFilter(brightness: number, eyeComfortEnabled: boolean, eyeComfortLevel: number): string {
  const parts: string[] = [];

  const brightnessFactor = computeBrightnessFactor(brightness);
  parts.push(`brightness(${brightnessFactor})`);

  if (eyeComfortEnabled) {
    const level = clamp01(eyeComfortLevel / 100);
    // Warmth / blue-light reduction approximation
    const sepia = 0.45 * level;
    const sat = 1.05 + 0.35 * level;
    const hue = -12 * level;
    parts.push(`sepia(${sepia})`);
    parts.push(`saturate(${sat})`);
    parts.push(`hue-rotate(${hue}deg)`);
  }

  return parts.join(' ');
}

function applyEffects(state: ReturnType<typeof useOsStateStore.getState>) {
  // Apply on the mount root so the whole simulated OS is affected.
  const root = document.getElementById('root');
  if (root) {
    root.style.filter = buildFilter(
      state.settings.system.brightness,
      state.settings.global.eyeComfortEnabled,
      state.settings.system.eyeComfortLevel,
    );
  }

  // Font scaling: affects rem-based styles (safe, low risk).
  const basePx = 16;
  const fontScale = Number.isFinite(fontScaleFromPct(state.settings.system.fontSizePct))
    ? fontScaleFromPct(state.settings.system.fontSizePct)
    : 1;
  document.documentElement.style.fontSize = `${Math.max(10, Math.min(22, basePx * fontScale))}px`;

  // Dark mode flag: exposed for future CSS adjustments.
  document.documentElement.classList.toggle('os-dark', Boolean(state.settings.global.darkModeEnabled));
  // Hint native controls (inputs, scrollbars, etc.)
  document.documentElement.style.colorScheme = state.settings.global.darkModeEnabled ? 'dark' : 'light';
  document.documentElement.style.setProperty('--os-display-scale', String(displayScaleFromPct(state.settings.system.displaySizePct)));
}

export const DeviceEffects: React.FC = () => {
  const state = useOsStateStore((s) => s);

  useEffect(() => {
    applyEffects(state);
  }, [state]);

  return null;
};

export default DeviceEffects;

