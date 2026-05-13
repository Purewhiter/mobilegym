import type { Comment, Note, User } from '../types';

export type RedBookRuntimeNoteTable = Record<string, Note | null | undefined>;
export type RedBookRuntimeUserTable = Record<string, User | null | undefined>;
export type RedBookRuntimeComment = Comment & { noteId: string };
export type RedBookRuntimeCommentTable = Record<string, RedBookRuntimeComment | null | undefined>;

export const parseRedBookCount = (count: number | string | undefined | null): number => {
  if (count === null || count === undefined) return 0;
  if (typeof count === 'number') return Number.isFinite(count) ? count : 0;
  const raw = String(count).replace(/\+/g, '').trim();
  if (!raw) return 0;
  if (raw.includes('万')) return (parseFloat(raw.replace('万', '')) || 0) * 10000;
  if (raw.toLowerCase().includes('w')) return (parseFloat(raw.toLowerCase().replace('w', '')) || 0) * 10000;
  return parseFloat(raw) || 0;
};

export const getRedBookFollowingIds = (user: Pick<User, 'followingIds'> | undefined | null): string[] =>
  user?.followingIds || [];

function tableEntry<T>(
  table: Record<string, T | null | undefined> | undefined,
  id: string,
): T | null | undefined {
  if (!table || !id) return undefined;
  return Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined;
}

export function resolveRedBookRuntimeUser(
  users: RedBookRuntimeUserTable | undefined,
  baseUsersById: Record<string, User>,
  currentUser: User,
  userId: string,
): User | null {
  if (!userId) return null;
  if (userId === currentUser.id) {
    return {
      ...currentUser,
      following: getRedBookFollowingIds(currentUser).length,
      followers: currentUser.followerIds?.length || 0,
    };
  }

  const patch = tableEntry(users, userId);
  if (patch === null) return null;
  const base = baseUsersById[userId] ?? null;
  if (!base && !patch) return null;

  const merged = patch && typeof patch === 'object' ? patch : base;
  if (!merged) return null;

  const isFollowed = getRedBookFollowingIds(currentUser).includes(merged.id);
  return {
    ...merged,
    followers: parseRedBookCount(merged.followers) + (isFollowed ? 1 : 0),
  };
}
