import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('os/wmr/WmrRenderer.tsx', 'utf8');

describe('WMR renderer loading state', () => {
  it('uses a generic loading label for widget loading', () => {
    expect(source).not.toContain('正在加载 WMR');
    expect(source).toContain('Loading...');
  });
});
