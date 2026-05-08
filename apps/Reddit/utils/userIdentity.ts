import { AVATAR_SOURCES } from '../data/avatarSources';

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const normalizeUsername = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.startsWith('u/')) return s.slice(2);
  if (s.startsWith('/u/')) return s.slice(3);
  return s;
};

/**
 * Deterministic avatar assignment: same username always maps to the same avatar.
 * AVATAR_SOURCES are resolved URLs from Vite import.meta.glob (no further wrapping needed).
 */
export const getUserAvatar = (usernameLike: unknown): string | undefined => {
  if (!AVATAR_SOURCES.length) return undefined;
  const u = normalizeUsername(usernameLike);
  if (!u) return AVATAR_SOURCES[0];
  return AVATAR_SOURCES[hashString(u) % AVATAR_SOURCES.length];
};
