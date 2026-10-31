/**
 * RedBook on the device server.
 *
 * Storage keeps RedBook's existing runtime shape (`RedBookDeviceState`: the
 * current user's truth fields plus note/comment/user patch tables) so
 * `__SIM__.getState().apps.redbook` and every bench judge keep working
 * unchanged. After each write, `materialize` resolves that state against the
 * shared catalog into final `notes` / `users` records — what the user actually
 * sees, with like/collect/follow counts and runtime comments applied. This is
 * the only implementation of that merge: the page and Python read the records
 * instead of re-deriving them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppContext, AppModule, Catalog, DeviceRecord } from '../../../device/engine';
import { resolveCdnUrlWithBase } from '../../../os/utils/cdn';
import type { ChatConversation, ChatMessage, Comment, Note, Notification, User } from '../types';
import type { RedBookStoreState } from '../state';
import {
  getRedBookFollowingIds,
  parseRedBookCount,
  resolveRedBookRuntimeUser,
  type RedBookRuntimeComment,
} from '../utils/runtimeResolvers';

export type RedBookDeviceState = Omit<RedBookStoreState, '_temp'>;

type Ctx = AppContext<RedBookDeviceState>;

export const REDBOOK_STATE_KEYS = [
  'user', 'notes', 'comments', 'users', 'chats', 'notifications', 'history',
  'searchHistory', 'hotSearch', 'guessYouLike', 'settings', 'storage', 'publishDraft',
] as const satisfies readonly (keyof RedBookDeviceState)[];

// ── Catalog ─────────────────────────────────────────────────────────

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|mp4|webm|avif)(\?.*)?$/i;

function assetResolver(cdnBase: string, appAssetsBase: string) {
  return (raw: unknown): unknown => {
    if (typeof raw !== 'string' || !raw) return raw;
    if (raw.startsWith('http') || raw.startsWith('/')) return raw;
    if (raw.startsWith('./images/') || raw.startsWith('images/')) {
      return resolveCdnUrlWithBase(raw, cdnBase, 'redbook');
    }
    if (!ASSET_EXT_RE.test(raw)) return raw;
    return `${appAssetsBase}RedBook/${raw}`;
  };
}

function loadCatalog(root: string, cdnBase: string, appAssetsBase: string): Catalog {
  const dataDir = join(root, 'apps', 'RedBook', 'data');
  const resolve = assetResolver(cdnBase, appAssetsBase);
  const users = JSON.parse(readFileSync(join(dataDir, 'users.json'), 'utf8')) as User[];
  const notes = JSON.parse(readFileSync(join(dataDir, 'notes.json'), 'utf8')) as Note[];

  const usersById = new Map<string, DeviceRecord>();
  for (const user of users) {
    if (user.avatar) user.avatar = resolve(user.avatar) as string;
    if (user.userCover) user.userCover = resolve(user.userCover) as string;
    usersById.set(user.id, user as unknown as DeviceRecord);
  }
  const notesById = new Map<string, DeviceRecord>();
  const baseCommentToNote: Record<string, string> = {};
  for (const note of notes) {
    if (note.cover) note.cover = resolve(note.cover) as string;
    if (note.video) note.video = resolve(note.video) as string;
    if ((note as any).videoUrl) (note as any).videoUrl = resolve((note as any).videoUrl);
    if (Array.isArray(note.images)) note.images = note.images.map(img => resolve(img) as string);
    for (const comment of note.commentList ?? []) {
      if (comment.avatar) comment.avatar = resolve(comment.avatar) as string;
      if (comment.id != null) baseCommentToNote[String(comment.id)] = note.id;
      // Commenters without a profile still need a user record to be tappable.
      if (comment.userId && !usersById.has(comment.userId)) {
        usersById.set(comment.userId, {
          id: comment.userId,
          name: comment.username || 'Unknown',
          avatar: comment.avatar || '',
          intro: '暂无简介',
          location: comment.location || '未知',
          followers: 0,
          following: 0,
          likesAndCollections: 0,
        });
      }
    }
    notesById.set(note.id, note as unknown as DeviceRecord);
  }
  return {
    collections: new Map([
      ['notes', { order: notes.map(n => n.id), byId: notesById }],
      ['users', { order: [...usersById.keys()], byId: usersById }],
    ]),
    extras: {
      baseCommentToNote,
      usersByIdObject: Object.fromEntries(usersById),
      // users.json order; commenters added above have no profile of their own.
      profileUserIds: users.map(u => u.id),
    },
  };
}

const catalogNote = (ctx: Ctx, id: string) =>
  ctx.catalog.collections.get('notes')!.byId.get(id) as unknown as Note | undefined;
/** Catalog users as a plain object, the shape `resolveRedBookRuntimeUser` takes. */
const baseUsersById = (ctx: Ctx) => ctx.catalog.extras.usersByIdObject as Record<string, User>;

// ── Materialization ─────────────────────────────────────────────────

/**
 * Merge one note's patches into its final shape: like/collect counts, comment
 * patches and tombstones, runtime comments, comment likes.
 */
function resolveNote(
  source: Note,
  noteId: string,
  comments: RedBookDeviceState['comments'],
  runtimeComments: Comment[] | undefined,
  likedCommentIdsRaw: string[] | undefined,
  isLiked: boolean,
  isCollected: boolean,
): Note {
  const note = { ...source };
  const likedCommentIds = likedCommentIdsRaw?.length ? new Set(likedCommentIdsRaw.map(String)) : null;
  const ownBaseCommentIds = new Set<string>();
  const outComments: Comment[] = [];
  let hiddenBaseCommentCount = 0;
  for (const baseComment of note.commentList || []) {
    if (!baseComment || typeof baseComment !== 'object') {
      outComments.push(baseComment);
      continue;
    }
    const commentId = String(baseComment.id || '');
    if (commentId) ownBaseCommentIds.add(commentId);
    const patch = commentId && Object.prototype.hasOwnProperty.call(comments, commentId)
      ? comments[commentId]
      : undefined;
    if (patch === null) {
      hiddenBaseCommentCount += 1;
      continue;
    }
    let merged: Comment = patch && typeof patch === 'object'
      ? ({ ...patch, id: patch.id || commentId } as Comment)
      : baseComment;
    if (likedCommentIds?.has(String(merged.id))) {
      merged = { ...merged, likes: parseRedBookCount(merged.likes) + 1 };
    }
    outComments.push(merged);
  }

  let runtimeOnly = (runtimeComments ?? []).filter(c => !ownBaseCommentIds.has(String(c.id)));
  if (likedCommentIds && runtimeOnly.length) {
    runtimeOnly = runtimeOnly.map(c =>
      likedCommentIds.has(String(c.id)) ? { ...c, likes: parseRedBookCount(c.likes) + 1 } : c,
    );
  }

  note.likes = parseRedBookCount(source.likes) + (isLiked ? 1 : 0);
  note.collections = parseRedBookCount(source.collections) + (isCollected ? 1 : 0);
  note.comments = Math.max(0, parseRedBookCount(source.comments) - hiddenBaseCommentCount + runtimeOnly.length);
  note.commentList = [...runtimeOnly, ...outComments];
  note.id = noteId || note.id;
  return note;
}

function materialize(ctx: Ctx): void {
  const { user, notes, comments, users } = ctx.state;
  const baseCommentToNote = ctx.catalog.extras.baseCommentToNote as Record<string, string>;

  const likedNotes = new Set(user.likedNotes || []);
  const collectedNotes = new Set(user.collectedNotes || []);
  const likedCommentsByNote = user.likedCommentsByNote || {};
  const runtimeCommentsByNote = new Map<string, Comment[]>();
  const touched = new Set<string>([
    ...Object.keys(notes || {}),
    ...likedNotes,
    ...collectedNotes,
    ...Object.keys(likedCommentsByNote),
  ]);
  for (const [commentId, value] of Object.entries(comments || {})) {
    if (value === undefined) continue;
    const baseOwner = baseCommentToNote[commentId];
    if (baseOwner) touched.add(baseOwner);
    if (value === null) continue;
    const noteId = String(value.noteId || '');
    if (!noteId) continue;
    touched.add(noteId);
    const normalized = (value.id ? value : { ...value, id: commentId }) as Comment;
    const bucket = runtimeCommentsByNote.get(noteId);
    if (bucket) bucket.push(normalized);
    else runtimeCommentsByNote.set(noteId, [normalized]);
  }

  ctx.clearOverlay('notes');
  for (const noteId of touched) {
    const hasPatch = Object.prototype.hasOwnProperty.call(notes || {}, noteId);
    const patch = hasPatch ? notes[noteId] : undefined;
    if (patch === null) {
      ctx.hide('notes', noteId);
      continue;
    }
    const source = patch && typeof patch === 'object' ? patch : catalogNote(ctx, noteId);
    if (!source) continue;
    const resolved = resolveNote(
      source,
      noteId,
      comments || {},
      runtimeCommentsByNote.get(noteId),
      likedCommentsByNote[noteId],
      likedNotes.has(noteId),
      collectedNotes.has(noteId),
    );
    ctx.put('notes', resolved as unknown as DeviceRecord);
  }

  ctx.clearOverlay('users');
  const baseUsers = baseUsersById(ctx);
  const touchedUsers = new Set<string>([user.id, ...Object.keys(users || {}), ...getRedBookFollowingIds(user)]);
  for (const userId of touchedUsers) {
    const resolved = resolveRedBookRuntimeUser(users, baseUsers, user, userId);
    if (resolved) ctx.put('users', resolved as unknown as DeviceRecord);
    else if (baseUsers[userId]) ctx.hide('users', userId);
  }
}

// ── Read helpers ────────────────────────────────────────────────────

/** Feed order: runtime-only notes newest first, then catalog order minus tombstones. */
function feedIds(ctx: Ctx): string[] {
  const notes = ctx.state.notes || {};
  const catalog = ctx.catalog.collections.get('notes')!;
  const tombstones = new Set<string>();
  const runtimeOnly: Array<{ id: string; createdAt: number }> = [];
  for (const [id, value] of Object.entries(notes)) {
    if (value === null) tombstones.add(id);
    // Non-numeric createdAt (raw relative seeds like "-2d6h") sorts as 0.
    else if (value && !catalog.byId.has(id)) runtimeOnly.push({ id, createdAt: Number(value.createdAt) || 0 });
  }
  runtimeOnly.sort((a, b) => b.createdAt - a.createdAt);
  const out = runtimeOnly.map(n => n.id);
  for (const id of catalog.order) if (!tombstones.has(id)) out.push(id);
  return out;
}

const viewNote = (ctx: Ctx, id: string) => ctx.get('notes', id) as unknown as Note | undefined;
const viewUser = (ctx: Ctx, id: string) => ctx.get('users', id) as unknown as User | undefined;

/** Canonical user order: current user, catalog order, then runtime-only users. */
function userIds(ctx: Ctx): string[] {
  const out = [ctx.state.user.id];
  const seen = new Set(out);
  for (const id of ctx.catalog.collections.get('users')!.order) {
    if (!seen.has(id)) { out.push(id); seen.add(id); }
  }
  for (const id of Object.keys(ctx.state.users || {})) {
    if (!seen.has(id)) { out.push(id); seen.add(id); }
  }
  return out;
}

const strArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

// ── Commands (one per store action) ─────────────────────────────────

function setState(ctx: Ctx, patch: Partial<RedBookDeviceState>): void {
  ctx.state = { ...ctx.state, ...patch };
}

const commands: AppModule<RedBookDeviceState>['commands'] = {
  updatePublishDraft(ctx, [updates]) {
    setState(ctx, { publishDraft: { ...ctx.state.publishDraft, ...(updates as object) } });
  },
  resetPublishDraft(ctx) {
    setState(ctx, { publishDraft: { text: '', templateId: 'basic', title: '', images: [] } });
  },
  toggleLike(ctx, [noteId]) {
    const s = ctx.state;
    const liked = s.user.likedNotes || [];
    const next = liked.includes(noteId as string) ? liked.filter(id => id !== noteId) : [...liked, noteId as string];
    setState(ctx, { user: { ...s.user, likedNotes: next } });
  },
  toggleCollect(ctx, [noteId]) {
    const s = ctx.state;
    const collected = s.user.collectedNotes || [];
    const next = collected.includes(noteId as string)
      ? collected.filter(id => id !== noteId)
      : [...collected, noteId as string];
    setState(ctx, { user: { ...s.user, collectedNotes: next } });
  },
  addComment(ctx, [noteId, content, replyToCommentId], { now }) {
    const s = ctx.state;
    const comment: Comment = {
      id: `c_${now}`,
      userId: s.user.id,
      username: s.user.name,
      avatar: s.user.avatar,
      content: content as string,
      time: now,
      likes: 0,
      replyToId: replyToCommentId as string | undefined,
      location: s.user.location || '上海',
    };
    const runtimeComment: RedBookRuntimeComment = { ...comment, noteId: noteId as string };
    setState(ctx, {
      user: { ...s.user, commentIds: [...(s.user.commentIds || []), comment.id] },
      comments: { ...s.comments, [comment.id]: runtimeComment },
    });
  },
  toggleCommentLike(ctx, [noteId, commentId]) {
    const s = ctx.state;
    const byNote = s.user.likedCommentsByNote || {};
    const current = byNote[noteId as string] || [];
    const next = current.includes(commentId as string)
      ? current.filter(id => id !== commentId)
      : [...current, commentId as string];
    setState(ctx, { user: { ...s.user, likedCommentsByNote: { ...byNote, [noteId as string]: next } } });
  },
  followUser(ctx, [userId]) {
    const s = ctx.state;
    const baseUsers = baseUsersById(ctx);
    if (!resolveRedBookRuntimeUser(s.users, baseUsers, s.user, userId as string)) return;
    const following = getRedBookFollowingIds(s.user);
    const next = following.includes(userId as string)
      ? following.filter(id => id !== userId)
      : [...following, userId as string];
    setState(ctx, { user: { ...s.user, followingIds: next } });
  },
  addNote(ctx, [noteData], { now }) {
    const s = ctx.state;
    const note: Note = {
      id: `note_${now}`,
      ...(noteData as Pick<Note, 'title' | 'content' | 'images'>),
      authorId: s.user.id,
      likes: 0,
      collections: 0,
      comments: 0,
      commentList: [],
      createdAt: now,
    };
    setState(ctx, {
      user: { ...s.user, publishedNoteIds: [note.id, ...(s.user.publishedNoteIds || [])] },
      notes: { ...s.notes, [note.id]: note },
    });
    return note.id;
  },
  sendMessage(ctx, [toUserId, content], { now }) {
    const s = ctx.state;
    const chats = [...s.chats];
    const index = chats.findIndex(c => c.userId === toUserId);
    const message: ChatMessage = {
      id: `msg_${now}`,
      senderId: s.user.id,
      content: content as string,
      timestamp: now,
      type: 'text',
    };
    if (index === -1) {
      const baseUsers = baseUsersById(ctx);
      const target = resolveRedBookRuntimeUser(s.users, baseUsers, s.user, toUserId as string)
        || { name: 'User ' + toUserId, avatar: '' };
      chats.unshift({
        userId: toUserId as string,
        username: target.name,
        avatar: target.avatar,
        unreadCount: 0,
        lastMessage: content as string,
        lastTime: now,
        messages: [message],
      } as ChatConversation);
    } else {
      const chat = { ...chats[index] };
      chat.messages = [...chat.messages, message];
      chat.lastMessage = content as string;
      chat.lastTime = now;
      chats.splice(index, 1);
      chats.unshift(chat);
    }
    setState(ctx, { chats });
  },
  logout() {},
  updateUser(ctx, [updates]) {
    const { following: _following, followers: _followers, ...safe } = (updates ?? {}) as Partial<User>;
    setState(ctx, { user: { ...ctx.state.user, ...safe } });
  },
  markNotificationsAsRead(ctx, [type]) {
    setState(ctx, {
      notifications: ctx.state.notifications.map((n: Notification) => {
        if (!type || n.type === type
          || (type === 'like_note' && (n.type === 'collect_note' || n.type === 'like_comment'))) {
          return { ...n, isRead: true };
        }
        return n;
      }),
    });
  },
  addToHistory(ctx, [noteId]) {
    setState(ctx, { history: [noteId as string, ...ctx.state.history.filter(id => id !== noteId)] });
  },
  clearHistory(ctx) {
    setState(ctx, { history: [] });
  },
  addSearchHistory(ctx, [keyword]) {
    const trimmed = String(keyword ?? '').trim();
    if (!trimmed) return;
    setState(ctx, { searchHistory: [trimmed, ...(ctx.state.searchHistory || []).filter(k => k !== trimmed)] });
  },
  removeSearchHistory(ctx, [keyword]) {
    setState(ctx, { searchHistory: (ctx.state.searchHistory || []).filter(k => k !== keyword) });
  },
  clearSearchHistory(ctx) {
    setState(ctx, { searchHistory: [] });
  },
  clearCache(ctx) {
    setState(ctx, { storage: { cacheSizeBytes: 0 } });
  },
  updateSettings(ctx, [category, updates]) {
    const settings = ctx.state.settings;
    if (category === 'language' && (typeof updates === 'string' || updates === null)) {
      setState(ctx, { settings: { ...settings, language: updates } });
      return;
    }
    if (updates && typeof updates === 'object' && !Array.isArray(updates) && category !== 'language') {
      const key = category as keyof typeof settings;
      setState(ctx, { settings: { ...settings, [key]: { ...(settings[key] as object), ...updates } } });
    }
  },
};

// ── Queries ─────────────────────────────────────────────────────────

/** Notes plus the authors the page needs to render their cards. */
function withAuthors(ctx: Ctx, items: Note[]) {
  const authorIds = [...new Set(items.map(n => n.authorId).filter(Boolean))];
  const authors = authorIds.map(id => viewUser(ctx, id)).filter((u): u is User => Boolean(u));
  return { items, authors };
}

const queries: AppModule<RedBookDeviceState>['queries'] = {
  /** Visible note ids in feed order. */
  feedIds(ctx) {
    return feedIds(ctx);
  },
  /** Users with a profile: the current user, users.json order, then users only this session has. */
  profileUserIds(ctx) {
    const catalog = ctx.catalog.extras.profileUserIds as string[];
    const known = new Set(catalog);
    return {
      current: ctx.state.user.id,
      catalog,
      runtime: Object.keys(ctx.state.users || {}).filter(id => !known.has(id)),
    };
  },
  /** Feed page; optional category label, author filter, and like-count sort. */
  feed(ctx, args) {
    let notes = feedIds(ctx).map(id => viewNote(ctx, id)).filter((n): n is Note => Boolean(n));
    if (typeof args.category === 'string' && args.category) {
      notes = notes.filter(n => n.category === args.category);
    }
    if (Array.isArray(args.authorIds)) {
      const authors = new Set(strArray(args.authorIds));
      notes = notes.filter(n => authors.has(n.authorId));
    }
    if (args.sort === 'likes') notes = [...notes].sort((a, b) => parseRedBookCount(b.likes) - parseRedBookCount(a.likes));
    const offset = Number(args.offset ?? 0) || 0;
    const limit = args.limit == null ? notes.length : Number(args.limit);
    return { ...withAuthors(ctx, notes.slice(offset, offset + limit)), total: notes.length };
  },
  /** Notes by id, either in the given id order or in feed order. */
  notesByIds(ctx, args) {
    const ids = strArray(args.ids);
    const wanted = new Set(ids);
    const ordered = args.order === 'feed' ? feedIds(ctx).filter(id => wanted.has(id)) : ids;
    return withAuthors(ctx, ordered.map(id => viewNote(ctx, id)).filter((n): n is Note => Boolean(n)));
  },
  /** Users by id in canonical user order. */
  usersByIds(ctx, args) {
    const wanted = new Set(strArray(args.ids));
    return userIds(ctx).filter(id => wanted.has(id)).map(id => viewUser(ctx, id)).filter(Boolean);
  },
  user(ctx, args) {
    return viewUser(ctx, String(args.id ?? '')) ?? null;
  },
  note(ctx, args) {
    const note = viewNote(ctx, String(args.id ?? ''));
    return note ? withAuthors(ctx, [note]) : { items: [], authors: [] };
  },
  searchNotes(ctx, args) {
    const keyword = String(args.keyword ?? '').toLowerCase();
    if (!keyword) return { items: [], authors: [] };
    const matches = feedIds(ctx)
      .map(id => viewNote(ctx, id))
      .filter((n): n is Note => Boolean(n) && (
        String(n!.title ?? '').toLowerCase().includes(keyword)
        || String(n!.content ?? '').toLowerCase().includes(keyword)
        || String(n!.category ?? '').toLowerCase().includes(keyword)
      ));
    switch (args.sort) {
      case 'latest': matches.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'likes': matches.sort((a, b) => parseRedBookCount(b.likes) - parseRedBookCount(a.likes)); break;
      case 'comments': matches.sort((a, b) => parseRedBookCount(b.comments) - parseRedBookCount(a.comments)); break;
      case 'collects': matches.sort((a, b) => parseRedBookCount(b.collections) - parseRedBookCount(a.collections)); break;
      default: break;
    }
    return withAuthors(ctx, matches);
  },
  searchUsers(ctx, args) {
    const keyword = String(args.keyword ?? '').toLowerCase();
    if (!keyword) return [];
    return userIds(ctx)
      .map(id => viewUser(ctx, id))
      .filter((u): u is User => Boolean(u) && String(u!.name ?? '').toLowerCase().includes(keyword));
  },
};

export function createRedBookModule(options: { cdnBase: string; appAssetsBase: string }): AppModule<RedBookDeviceState> {
  return {
    appId: 'redbook',
    loadCatalog: root => loadCatalog(root, options.cdnBase, options.appAssetsBase),
    materialize,
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('redbook state must be an object');
      const source = raw as Record<string, unknown>;
      const state: Record<string, unknown> = {};
      for (const key of REDBOOK_STATE_KEYS) state[key] = source[key];
      return state as RedBookDeviceState;
    },
    commands,
    queries,
  };
}
