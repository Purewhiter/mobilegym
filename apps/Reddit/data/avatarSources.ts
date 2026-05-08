/**
 * Auto-generated manifest for local avatar assets under:
 * `apps/Reddit/assets/avatars/*`
 *
 * Uses Vite's import.meta.glob to dynamically import all avatar images.
 */

const avatarModules = import.meta.glob<{ default: string }>(
  '../assets/avatars/*.{png,jpg,jpeg}',
  { eager: true }
);

export const AVATAR_SOURCES: string[] = Object.values(avatarModules).map(
  (module) => module.default
);
