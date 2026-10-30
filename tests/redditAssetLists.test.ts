import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import lists from '../apps/Reddit/data/assetLists.json';

// The page and the device server both pick avatars and community icons by
// index into these lists, so they must match what is on disk.
const files = (dir: string, prefix = '') =>
  readdirSync(join(__dirname, '..', 'apps', 'Reddit', 'assets', dir))
    .filter((f) => /\.(png|jpe?g)$/i.test(f) && f.startsWith(prefix))
    .sort();

describe('Reddit asset lists', () => {
  it('matches the avatar and subreddit icon files', () => {
    expect(lists.avatars).toEqual(files('avatars'));
    expect(lists.subredditIcons).toEqual(files('subreddit_icons', 'subreddit_'));
  });
});
