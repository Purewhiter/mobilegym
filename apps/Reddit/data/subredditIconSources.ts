/**
 * Auto-generated manifest for local subreddit icon assets under:
 * `apps/Reddit/assets/subreddit_icons/*`
 *
 * Uses Vite's import.meta.glob to dynamically import all subreddit icons.
 */

const subredditIconModules = import.meta.glob<{ default: string }>(
  '../assets/subreddit_icons/*.{png,jpg,jpeg}',
  { eager: true }
);

export const SUBREDDIT_ICON_SOURCES: Record<string, string> = {};

for (const [path, module] of Object.entries(subredditIconModules)) {
  const filename = path.split('/').pop()?.replace(/\.(png|jpg|jpeg)$/, '') || '';
  if (filename.startsWith('subreddit_')) {
    const subredditName = filename.replace('subreddit_', '');
    SUBREDDIT_ICON_SOURCES[`r/${subredditName}`] = module.default;
  }
}
