import { cpSync, mkdtempSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanSdcard } from '../device/sdcard';
import { SDCARD_MODIFIED_AT } from '../device/sdcardTimes';

const SDCARD = join(__dirname, '..', 'public', 'sdcard');

describe('public/sdcard seed scan', () => {
  it('gives every preset file a fixed time', () => {
    const missing = scanSdcard(SDCARD).files
      .map(f => f.path.slice('/sdcard/'.length))
      .filter(p => !Object.hasOwn(SDCARD_MODIFIED_AT, p));
    expect(missing).toEqual([]);
  });

  it('does not depend on host mtimes', () => {
    const copy = mkdtempSync(join(tmpdir(), 'sdcard-scan-'));
    cpSync(SDCARD, copy, { recursive: true });
    const touch = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        utimesSync(p, 1, 1);
        if (entry.isDirectory()) touch(p);
      }
    };
    touch(copy);
    expect(scanSdcard(copy)).toEqual(scanSdcard(SDCARD));
  });
});
