import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const splashSource = readFileSync('os/BootSplash.tsx', 'utf8');
const themeContextSource = readFileSync('os/ThemeContext.tsx', 'utf8');
const bootGateSource = readFileSync('os/BootGate.tsx', 'utf8');

describe('boot splash', () => {
  it('lives in os/BootSplash.tsx and shows the OS boot copy', () => {
    expect(splashSource).toContain('MobileGym');
    expect(splashSource).not.toContain('启动中');
    expect(splashSource).not.toContain('正在加载主题');
  });

  it('has been decoupled from ThemeContext (theme module owns no boot UI)', () => {
    expect(themeContextSource).not.toContain('BootFallback');
    expect(themeContextSource).not.toContain('MobileGym');
    expect(themeContextSource).not.toContain('启动中');
    expect(themeContextSource).not.toContain('正在加载主题');
  });

  it('is mounted by a dedicated BootGate that fades out on ready', () => {
    expect(bootGateSource).toContain('BootSplash');
    expect(bootGateSource).toContain('fadingOut');
  });
});
