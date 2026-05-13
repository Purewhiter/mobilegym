import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSyncExternalStore } from 'react';

import {
    getBaseDataset,
    subscribeBaseDataset,
    type RedBookBaseDataset,
} from './loader';
import {
    parseRedBookCount,
    resolveRedBookRuntimeUser,
    type RedBookRuntimeCommentTable,
    type RedBookRuntimeNoteTable,
    type RedBookRuntimeUserTable,
} from '../utils/runtimeResolvers';
import { useRedBookStore, type RedBookStoreState } from '../state';
import type { Comment, Note, User } from '../types';

const EMPTY_BASE: RedBookBaseDataset = Object.freeze({
    notesById: Object.freeze({}) as Record<string, Note>,
    usersById: Object.freeze({}) as Record<string, User>,
    feedIds: Object.freeze([]) as readonly string[] as string[],
    userIds: Object.freeze([]) as readonly string[] as string[],
    baseCommentToNote: Object.freeze({}) as Record<string, string>,
}) as RedBookBaseDataset;

const getBaseSnapshot = (): RedBookBaseDataset => getBaseDataset() ?? EMPTY_BASE;

/** Subscribe to RedBook base dataset (notes.json + users.json) loaded async. */
export function useRedBookBaseDataset(): RedBookBaseDataset {
    return useSyncExternalStore(subscribeBaseDataset, getBaseSnapshot, getBaseSnapshot);
}


// ============ 细粒度订阅 hook（避免 NoteItem 调 useRedBookView） ============
//
// NoteItem 之前每张卡片都调 useRedBookView()，store 任何变化（toggleLike/Collect/
// followUser/addComment/addNote）都会让每张卡片的 useShallow(slice) 触发重渲染
// + buildRedBookView 重算。20 张可见卡片 = 20× buildRedBookView/feed-iter，
// 单次点赞 30-50ms 主线程阻塞，体感"卡顿一下"。
//
// 这里提供 NoteItem 真正需要的两个细粒度 hook：author 和 isLiked。每张卡片只在
// 自己关心的字段变化时才重渲染。

/**
 * 订阅单个用户的最新数据。优化点：
 * - selector 1: `s.user.id === authorId ? s.user : null` —— 只有"是本人的卡片"
 *   才订阅 currentUser，其他卡片 selector 返回 null，永不因 currentUser 变化重渲染
 * - selector 2: `s.users[authorId]` —— 只订阅这一个用户的 patch，与其他用户互不影响
 * - base lookup 走非订阅的同步读（getBaseDataset），base 在 app session 内稳定
 */
export function useRedBookAuthor(authorId: string): User | undefined {
    const ownUserOrNull = useRedBookStore(s => s.user.id === authorId ? s.user : null);
    const patch = useRedBookStore(s => s.users[authorId]);
    if (ownUserOrNull) return ownUserOrNull;
    if (patch === null) return undefined; // tombstone
    if (patch !== undefined) return patch as User;
    return getBaseDataset()?.usersById[authorId];
}

/** 订阅"当前用户是否点赞过该笔记"。selector 返回 boolean，仅在 flip 时重渲染。 */
export function useIsNoteLiked(noteId: string): boolean {
    return useRedBookStore(s => (s.user.likedNotes || []).includes(noteId));
}

/** 订阅"当前用户是否关注了某用户"。同上。 */
export function useIsFollowingUser(userId: string): boolean {
    return useRedBookStore(s => (s.user.followingIds || []).includes(userId));
}

export interface RedBookViewData {
    notesById: Record<string, Note>;
    usersById: Record<string, User>;
    feedIds: string[];
    userIds: string[];
}

interface RuntimeSlice {
    notes: RedBookRuntimeNoteTable;
    comments: RedBookRuntimeCommentTable;
    users: RedBookRuntimeUserTable;
    user: User;
}

/**
 * Pure function: merge runtime overlay slice + base dataset into a view.
 *
 * Feed order: runtime-only notes (newly published, sorted by `createdAt` desc) first,
 * then base feed in its declared order, with tombstoned entries filtered out.
 *
 * Hot-path optimization: for the ~99% of base notes the current user hasn't
 * interacted with and which have no overlay, `view.notesById[id]` returns the
 * base note **reference unchanged** (no clone, no derivation). This keeps the
 * per-render cost of `buildRedBookView` to roughly O(feed-size) lookups even
 * when there are thousands of base notes. Callers MUST treat returned notes
 * as read-only.
 */
export function buildRedBookView(slice: RuntimeSlice, base: RedBookBaseDataset): RedBookViewData {
    const { notes, comments, users, user } = slice;

    // ── Precomputed lookup sets (one-time cost per view build) ──────────
    const likedNotesSet = new Set(user.likedNotes || []);
    const collectedNotesSet = new Set(user.collectedNotes || []);
    const likedCommentsByNote = user.likedCommentsByNote || {};

    // Bucket state.comments entries by their declared `noteId`. We DO NOT filter
    // patches on base comments here — instead `resolveNoteSlow` filters per-note
    // using THAT note's base commentList ids. This preserves the prior semantic that
    // an entry whose id matches a base comment of note B but whose `noteId` points
    // to note A still appears as a runtime comment under A.
    const stateCommentKeys = new Set<string>();
    const runtimeCommentsByNote = new Map<string, Comment[]>();
    for (const [commentId, value] of Object.entries(comments || {})) {
        if (value === undefined) continue;
        stateCommentKeys.add(commentId);
        if (value === null) continue;
        const noteId = String(value.noteId || '');
        if (!noteId) continue;
        // Prefer the entry's own `id` field; fall back to the dict key when missing.
        const normalized: Comment = value.id
            ? (value as Comment)
            : ({ ...value, id: commentId } as Comment);
        const bucket = runtimeCommentsByNote.get(noteId);
        if (bucket) bucket.push(normalized);
        else runtimeCommentsByNote.set(noteId, [normalized]);
    }

    // Notes whose base commentList has at least one id matching state.comments keys.
    // O(|stateCommentKeys|) via the reverse index, not O(F·C).
    const baseNotesWithCommentOverlay = new Set<string>();
    for (const cid of stateCommentKeys) {
        const nid = base.baseCommentToNote[cid];
        if (nid) baseNotesWithCommentOverlay.add(nid);
    }

    // ── feed order: runtime-only (createdAt desc) + base order (sans tombstones) ──
    //
    // 不变量: store action 写 `state.notes` 时必须保持 `state.notes[note.id] === note`
    // (即 dict key 与 note.id 字段一致)。runtimeOnly 用 dict key 作为 feed id，slow path
    // 也用 dict key 作为 base lookup 索引。若调用方违反，feedIds 与 notesById 会以不同 id
    // 索引导致 `notesById[feedId]` miss。state.ts 的 `addNote` 与 bench `_publish_note`
    // 都遵守此不变量，无需运行期断言。
    const baseFeedSet = new Set(base.feedIds);
    const tombstones = new Set<string>();
    const runtimeOnly: Array<{ id: string; createdAt: number }> = [];
    for (const [noteId, value] of Object.entries(notes || {})) {
        if (value === null) {
            tombstones.add(noteId);
            continue;
        }
        if (value === undefined) continue;
        if (baseFeedSet.has(noteId)) continue;
        runtimeOnly.push({ id: noteId, createdAt: value.createdAt ?? 0 });
    }
    runtimeOnly.sort((a, b) => b.createdAt - a.createdAt);

    // runtimeOnly 来自 `Object.entries(notes)`，key 唯一，无需二次 dedup。
    // 只在合并 base.feedIds 时用 seenFeed 防止 base 与 runtime 重叠。
    const viewFeedIds: string[] = [];
    const seenFeed = new Set<string>();
    for (const { id } of runtimeOnly) {
        viewFeedIds.push(id);
        seenFeed.add(id);
    }
    for (const id of base.feedIds) {
        if (!id || seenFeed.has(id) || tombstones.has(id)) continue;
        viewFeedIds.push(id);
        seenFeed.add(id);
    }

    // ── Per-note resolution (inline fast path) ───────────────────────────
    const notesById: Record<string, Note> = {};
    for (const noteId of viewFeedIds) {
        const patch = Object.prototype.hasOwnProperty.call(notes, noteId) ? notes[noteId] : undefined;
        if (patch === null) continue;
        const baseNote = base.notesById[noteId];

        // Fast path: clean base note, no interactions, no overlays.
        if (
            patch === undefined
            && baseNote != null
            && !likedNotesSet.has(noteId)
            && !collectedNotesSet.has(noteId)
            && !(likedCommentsByNote[noteId]?.length)
            && !runtimeCommentsByNote.has(noteId)
            && !baseNotesWithCommentOverlay.has(noteId)
        ) {
            notesById[noteId] = baseNote;
            continue;
        }

        // Slow path: clone + derive. 依赖上面 feed-order 注释中的不变量
        // (`state.notes[id].id === id`)；resolvedId 与 noteId 不一致时 feedIds
        // 仍以 noteId 排序、notesById 仍以 noteId 索引，调用方一致。
        const mergedSource = (patch && typeof patch === 'object') ? patch : baseNote;
        if (!mergedSource) continue;
        const resolved = resolveNoteSlow(
            mergedSource,
            noteId,
            stateCommentKeys,
            comments,
            runtimeCommentsByNote.get(noteId),
            likedCommentsByNote[noteId],
            likedNotesSet.has(noteId),
            collectedNotesSet.has(noteId),
        );
        if (resolved) notesById[noteId] = resolved;
    }

    // ── Users (lower volume; resolver per id is fine) ────────────────────
    const viewUserIds = Array.from(new Set([user.id, ...base.userIds, ...Object.keys(users || {})]));
    const usersById: Record<string, User> = {};
    for (const userId of viewUserIds) {
        const item = resolveRedBookRuntimeUser(users, base.usersById, user, userId);
        if (item) usersById[item.id] = item;
    }

    return { notesById, usersById, feedIds: viewFeedIds, userIds: Object.keys(usersById) };
}

/** Slow path for a single note: clone + merge overlays + derive counts.
 *
 * `resolvedId` is the note's resolved id (overlay.id || dict key) — used both
 * for "is the user related to this note?" lookups (already done by caller and
 * passed in as `isLiked`/`isCollected`/etc.) AND for filtering out runtime-comment
 * entries whose id collides with a base comment of THIS note specifically
 * (semantic match to the prior per-note filtering).
 */
function resolveNoteSlow(
    mergedSource: Note,
    resolvedId: string,
    stateCommentKeys: Set<string>,
    comments: RedBookRuntimeCommentTable,
    runtimeCommentsForThisNote: Comment[] | undefined,
    likedCommentIdsRaw: string[] | undefined,
    isLiked: boolean,
    isCollected: boolean,
): Note | null {
    const note = { ...mergedSource };
    // String-coerce so set membership works when the raw array contains numeric ids
    // (matches Py `_liked_comments_by_note` which also `str(...)`-normalizes).
    const likedCommentIds = likedCommentIdsRaw && likedCommentIdsRaw.length
        ? new Set(likedCommentIdsRaw.map(String))
        : null;

    // Set of comment ids that THIS note's base commentList already claims — entries
    // in state.comments with these ids are patches handled by the loop below, not
    // runtime-only new comments.
    const thisNoteBaseCommentIds = new Set<string>();
    const outComments: Comment[] = [];
    let hiddenBaseCommentCount = 0;
    for (const baseComment of (note.commentList || [])) {
        if (!baseComment || typeof baseComment !== 'object') {
            outComments.push(baseComment);
            continue;
        }
        const commentId = String(baseComment.id || '');
        if (commentId) thisNoteBaseCommentIds.add(commentId);
        const commentPatch = commentId && stateCommentKeys.has(commentId) ? comments[commentId] : undefined;
        if (commentPatch === null) {
            hiddenBaseCommentCount += 1;
            continue;
        }
        let merged: Comment;
        if (commentPatch && typeof commentPatch === 'object') {
            merged = { ...commentPatch, id: commentPatch.id || commentId } as Comment;
        } else {
            merged = baseComment;
        }
        if (likedCommentIds && likedCommentIds.has(String(merged.id))) {
            merged = { ...merged, likes: parseRedBookCount(merged.likes) + 1 };
        }
        outComments.push(merged);
    }

    let runtimeOnlyComments: Comment[] = runtimeCommentsForThisNote
        ? runtimeCommentsForThisNote.filter(c => !thisNoteBaseCommentIds.has(String(c.id)))
        : [];
    if (likedCommentIds && runtimeOnlyComments.length) {
        runtimeOnlyComments = runtimeOnlyComments.map(c =>
            likedCommentIds.has(String(c.id))
                ? { ...c, likes: parseRedBookCount(c.likes) + 1 }
                : c,
        );
    }

    note.likes = parseRedBookCount(mergedSource.likes) + (isLiked ? 1 : 0);
    note.collections = parseRedBookCount(mergedSource.collections) + (isCollected ? 1 : 0);
    note.comments = Math.max(
        0,
        parseRedBookCount(mergedSource.comments) - hiddenBaseCommentCount + runtimeOnlyComments.length,
    );
    note.commentList = [...runtimeOnlyComments, ...outComments];
    note.id = resolvedId || note.id;
    return note;
}

const selectRuntimeSlice = (s: RedBookStoreState): RuntimeSlice => ({
    notes: s.notes,
    comments: s.comments,
    users: s.users,
    user: s.user,
});

/** Component hook: returns merged view data; re-renders on either base load or runtime change. */
export function useRedBookView(): RedBookViewData {
    const base = useRedBookBaseDataset();
    const slice = useRedBookStore(useShallow(selectRuntimeSlice));
    return useMemo(() => buildRedBookView(slice, base), [slice, base]);
}
