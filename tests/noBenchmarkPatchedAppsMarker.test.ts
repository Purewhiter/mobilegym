import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');

describe('deprecated benchmark patch marker', () => {
  it('is not referenced by runtime TypeScript code', () => {
    const files = [
      'os/OSContext.tsx',
      'os/types/globals.d.ts',
      'apps/X/state.ts',
    ];

    for (const file of files) {
      const source = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(source, file).not.toContain('_benchmarkPatchedApps');
    }
  });
});
