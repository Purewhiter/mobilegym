import { describe, expect, it } from 'vitest';
import { resolveCdnBase } from '../os/utils/cdn';

describe('resolveCdnBase', () => {
  it('treats empty string as /cdn (Vite .env.local default)', () => {
    expect(resolveCdnBase('')).toBe('/cdn');
    expect(resolveCdnBase('   ')).toBe('/cdn');
  });

  it('preserves explicit remote base', () => {
    expect(resolveCdnBase('https://cdn.mobilegym.dev')).toBe('https://cdn.mobilegym.dev');
  });

  it('falls back for undefined', () => {
    expect(resolveCdnBase(undefined)).toBe('/cdn');
  });

  it('strips trailing slashes', () => {
    expect(resolveCdnBase('/cdn/')).toBe('/cdn');
    expect(resolveCdnBase('https://cdn.mobilegym.dev/')).toBe('https://cdn.mobilegym.dev');
  });
});
