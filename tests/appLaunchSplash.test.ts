import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const splashSource = readFileSync('os/components/AppLaunchSplash.tsx', 'utf8');
const registrySource = readFileSync('os/data/appRegistry.tsx', 'utf8');
const manifestTypeSource = readFileSync('os/types/manifest.ts', 'utf8');

describe('app launch splash', () => {
  it('replaces the generic Loader2 spinner when a manifest is available', () => {
    expect(registrySource).toContain('AppLaunchSplash');
    expect(registrySource).toContain('manifest ?');
    // Loader2 still imported for the manifest-missing fallback path
    expect(registrySource).toContain('AppLoadingFallback');
  });

  it('renders Android-style splash: theme bg + icon + scale-in animation', () => {
    expect(splashSource).toContain('manifest.theme.colors.background');
    expect(splashSource).toContain('AppIcon');
    expect(splashSource).toContain('app-splash-icon-enter');
    // No loading text — system splash should mimic real OS, not a web loader
    expect(splashSource).not.toContain('加载中');
  });

  it('dispatches by manifest.splash.kind so apps can switch to branded/custom later', () => {
    expect(splashSource).toContain("splash?.kind === 'branded'");
    expect(splashSource).toContain("splash?.kind === 'custom'");
  });

  it('declares an extensible AppSplashConfig union in the manifest type', () => {
    expect(manifestTypeSource).toContain('AppSplashConfig');
    expect(manifestTypeSource).toContain("kind: 'branded'");
    expect(manifestTypeSource).toContain("kind: 'custom'");
    expect(manifestTypeSource).toContain('splash?: AppSplashConfig');
  });
});
