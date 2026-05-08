import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('os/maml/MamlRenderer.tsx', 'utf8');

describe('MAML renderer loading state', () => {
  it('uses a generic loading label for widget loading', () => {
    expect(source).not.toContain('正在加载 MAML');
    expect(source).toContain('Loading...');
  });
});
