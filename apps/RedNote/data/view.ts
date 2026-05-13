/**
 * RedNote view hooks — per-resource on-demand queries with runtime overlay merged in.
 *
 * Replaces the prior `useRedNoteView()` which returned a fully-materialized
 * `{ notesById, usersById, feedIds, userIds }` blob backed by a JS-side
 * full-corpus copy. Instead, this layer exposes targeted hooks
 * (`useNoteById`, `useUserById`, `useFeedIds`, `useSearchNotes`, …) that
 * query `base.sqlite` on demand and merge in the Zustand runtime overlay.
 *
 * Loading semantics: every hook returns `{ data, loading: boolean }`. While
 * the base DB is still initializing (sqlite-wasm compile + fetch + deserialize),
 * `loading` is true and `data` is `undefined`/empty. Components show skeletons
 * during this window.
 *
 * Why no central `notesById` map: the simulator has 4221 notes / 15000 users,
 * and a typical page screen only reads ~30 of them. Materializing everything
 * upfront cost ~16MB per page × 16 bench pages = 256MB of duplicated state.
 * Point lookups via SQL primary key are ~10µs; we re-query per-id and let
 * React/useMemo cache the merged result.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
    isBaseDatasetReady,
    subscribeBaseDatasetReady,
    selectBaseNoteById,
    selectBaseUserById,
    selectBaseFeedIds,
    selectBaseUserIds,
    selectBaseNotesByAuthor,
    searchBaseNotes,
    searchBaseUsers,
    selectTopNotesByLikes,
    selectTopNoteForAuthor,
    getBaseCommentToNote,
} from './loader';
import {
    parseRedNoteCount,
    getRedNoteFollowingIds,
    type RedNoteRuntimeCommentTable,
    type RedNoteRuntimeNoteTable,
    type RedNoteRuntimeUserTable,
} from '../utils/runtimeResolvers';
import { useRedNoteStore, type RedNoteStoreState } from '../state';
import type { Comment, Note, User } from '../types';

// ── DB-ready gate ─────────────────────────────────────────────────────

/** True once `base.sqlite` is fetched + deserialized and queries can run.
 *  Components that need to do non-trivial work conditioned on the data
 *  being ready should bail out (or show a skeleton) while this is false. */
export function useBaseDatasetReady(): boolean {
    return useSyncExternalStore(
        subscribeBaseDatasetReady,
        isBaseDatasetReady,
        isBaseDatasetReady,
    );
}

export interface Loadable<T> {
    data: T;
    loading: boolean;
}

// ── Per-note overlay merge ────────────────────────────────────────────
//
// Mirrors the prior `resolveNoteSlow` from `buildRedNoteView` but operates
// on a single base note instead of a full dict. Returns null when the note
// should NOT appear in the view (tombstoned, or no base + no overlay).
function mergeNoteOverlay(
    base: Note | null,
    notePatch: Note | null | undefined,
    commentsTable: RedNoteRuntimeCommentTable | undefined,
    user: User,
    noteId: string,
): Note | null {
    if (notePatch === null) return null; // tombstoned
    const mergedSource = (notePatch && typeof notePatch === 'object') ? notePatch : base;
    if (!mergedSource) return null;

    const resolvedId = String(mergedSource.id || noteId);
    const isLiked = (user.likedNotes || []).includes(resolvedId);
    const isCollected = (user.collectedNotes || []).includes(resolvedId);
    const likedCommentIdsRaw = (user.likedCommentsByNote || {})[resolvedId];
    const likedCommentIds = likedCommentIdsRaw?.length
        ? new Set(likedCommentIdsRaw.map(String))
        : null;

    // Walk base commentList, applying per-comment patches and tombstones.
    const note: Note = { ...mergedSource };
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
        const commentPatch = commentId && commentsTable
            ? commentsTable[commentId]
            : undefined;
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
            merged = { ...merged, likes: parseRedNoteCount(merged.likes) + 1 };
        }
        outComments.push(merged);
    }

    // Runtime-only comments: entries in `commentsTable` that target this
    // note via their `noteId` AND whose id isn't a patch on an existing
    // base comment. With typical |state.comments| < 50 the full scan is
    // negligible.
    let runtimeOnlyComments: Comment[] = [];
    if (commentsTable) {
        for (const [cid, value] of Object.entries(commentsTable)) {
            if (!value || typeof value !== 'object') continue;
            if (String(value.noteId || '') !== resolvedId) continue;
            if (thisNoteBaseCommentIds.has(String(value.id || cid))) continue;
            const c = value.id ? (value as Comment) : ({ ...value, id: cid } as Comment);
            runtimeOnlyComments.push(c);
        }
    }
    if (likedCommentIds && runtimeOnlyComments.length) {
        runtimeOnlyComments = runtimeOnlyComments.map(c =>
            likedCommentIds.has(String(c.id))
                ? { ...c, likes: parseRedNoteCount(c.likes) + 1 }
                : c,
        );
    }

    note.likes = parseRedNoteCount(mergedSource.likes) + (isLiked ? 1 : 0);
    note.collections = parseRedNoteCount(mergedSource.collections) + (isCollected ? 1 : 0);
    note.comments = Math.max(
        0,
        parseRedNoteCount(mergedSource.comments) - hiddenBaseCommentCount + runtimeOnlyComments.length,
    );
    note.commentList = [...runtimeOnlyComments, ...outComments];
    note.id = resolvedId;
    return note;
}

// ── Per-user overlay merge ────────────────────────────────────────────

function mergeUserOverlay(
    base: User | null,
    userPatch: User | null | undefined,
    user: User,
    userId: string,
): User | null {
    if (!userId) return null;
    if (userId === user.id) {
        return {
            ...user,
            following: getRedNoteFollowingIds(user).length,
            followers: user.followerIds?.length || 0,
        };
    }
    if (userPatch === null) return null;
    const merged = userPatch && typeof userPatch === 'object' ? userPatch : base;
    if (!merged) return null;
    const isFollowed = getRedNoteFollowingIds(user).includes(merged.id);
    return {
        ...merged,
        followers: parseRedNoteCount(merged.followers) + (isFollowed ? 1 : 0),
    };
}

// ── Store-slice selectors ─────────────────────────────────────────────

const selectNoteOverlay = (id: string | undefined) =>
    (s: RedNoteStoreState) => (id ? s.notes[id] : undefined);
const selectUserOverlay = (id: string | undefined) =>
    (s: RedNoteStoreState) => (id ? s.users[id] : undefined);

const selectCommentsTable = (s: RedNoteStoreState) => s.comments;
const selectNotesTable = (s: RedNoteStoreState) => s.notes;
const selectUsersTable = (s: RedNoteStoreState) => s.users;
const selectCurrentUser = (s: RedNoteStoreState) => s.user;

// ── Per-resource hooks ────────────────────────────────────────────────

/** Single note (base + overlay merged). `data === undefined` while DB warming
 *  or when the id doesn't resolve (incl. tombstoned). */
export function useNoteById(id: string | undefined): Loadable<Note | undefined> {
    const ready = useBaseDatasetReady();
    const notePatch = useRedNoteStore(selectNoteOverlay(id));
    const commentsTable = useRedNoteStore(selectCommentsTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!id) return { data: undefined, loading: false };
        if (!ready) return { data: undefined, loading: true };
        const base = selectBaseNoteById(id);
        const merged = mergeNoteOverlay(base, notePatch, commentsTable, user, id);
        return { data: merged ?? undefined, loading: false };
    }, [id, ready, notePatch, commentsTable, user]);
}

/** Single user (base + overlay merged), or the current user object if
 *  `id === user.id`. `data === undefined` while warming or unresolved. */
export function useUserById(id: string | undefined): Loadable<User | undefined> {
    const ready = useBaseDatasetReady();
    const userPatch = useRedNoteStore(selectUserOverlay(id));
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!id) return { data: undefined, loading: false };
        if (id === user.id) {
            return { data: mergeUserOverlay(null, undefined, user, id) ?? undefined, loading: false };
        }
        if (!ready) return { data: undefined, loading: true };
        const base = selectBaseUserById(id);
        const merged = mergeUserOverlay(base, userPatch, user, id);
        return { data: merged ?? undefined, loading: false };
    }, [id, ready, userPatch, user]);
}

/** Feed-id list, runtime-overlay-aware. Runtime-only notes (newly published,
 *  newest first) come first, then base feed in canonical order with
 *  tombstones filtered out. Optional `category` filters both halves. */
export function useFeedIds(opts?: { category?: string | null }): Loadable<string[]> {
    const ready = useBaseDatasetReady();
    const notesTable = useRedNoteStore(selectNotesTable);
    const category = opts?.category ?? null;
    return useMemo(() => {
        if (!ready) return { data: [], loading: true };
        const baseIds = selectBaseFeedIds({ category });
        const baseIdSet = new Set(baseIds);

        const tombstones = new Set<string>();
        const runtimeOnly: Array<{ id: string; createdAt: number }> = [];
        for (const [noteId, value] of Object.entries(notesTable || {})) {
            if (value === null) { tombstones.add(noteId); continue; }
            if (value === undefined) continue;
            if (baseIdSet.has(noteId)) continue;
            if (category && (value as Note).category !== category) continue;
            runtimeOnly.push({ id: noteId, createdAt: (value as Note).createdAt ?? 0 });
        }
        runtimeOnly.sort((a, b) => b.createdAt - a.createdAt);

        const seen = new Set<string>();
        const out: string[] = [];
        for (const { id } of runtimeOnly) {
            if (!seen.has(id)) { seen.add(id); out.push(id); }
        }
        for (const id of baseIds) {
            if (id && !seen.has(id) && !tombstones.has(id)) {
                seen.add(id); out.push(id);
            }
        }
        return { data: out, loading: false };
    }, [ready, notesTable, category]);
}

/** Convenience: resolve a list of note ids to merged Note objects via
 *  per-id queries. Used by HistoryPage / LikesAndCollections / etc. */
export function useNotesByIds(ids: string[] | undefined): Loadable<Note[]> {
    const ready = useBaseDatasetReady();
    const notesTable = useRedNoteStore(selectNotesTable);
    const commentsTable = useRedNoteStore(selectCommentsTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!ids || !ids.length) return { data: [], loading: false };
        if (!ready) return { data: [], loading: true };
        const out: Note[] = [];
        for (const id of ids) {
            const base = selectBaseNoteById(id);
            const patch = notesTable?.[id];
            const merged = mergeNoteOverlay(base, patch, commentsTable, user, id);
            if (merged) out.push(merged);
        }
        return { data: out, loading: false };
    }, [ids, ready, notesTable, commentsTable, user]);
}

/** Notes authored by `authorId`, newest first. Merges in runtime patches and
 *  prepends any runtime-only notes whose `authorId` matches. */
export function useNotesByAuthor(authorId: string | undefined): Loadable<Note[]> {
    const ready = useBaseDatasetReady();
    const notesTable = useRedNoteStore(selectNotesTable);
    const commentsTable = useRedNoteStore(selectCommentsTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!authorId) return { data: [], loading: false };
        if (!ready) return { data: [], loading: true };

        const baseNotes = selectBaseNotesByAuthor(authorId);
        const baseIds = new Set(baseNotes.map(n => n.id));
        const runtimeOnly: Note[] = [];
        for (const [nid, value] of Object.entries(notesTable || {})) {
            if (!value || baseIds.has(nid)) continue;
            if ((value as Note).authorId === authorId) runtimeOnly.push(value as Note);
        }
        runtimeOnly.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

        const out: Note[] = [];
        for (const note of runtimeOnly) {
            // Runtime-only: no base; pass the overlay note as both source + patch.
            const merged = mergeNoteOverlay(null, note, commentsTable, user, note.id);
            if (merged) out.push(merged);
        }
        for (const base of baseNotes) {
            const patch = notesTable?.[base.id];
            const merged = mergeNoteOverlay(base, patch, commentsTable, user, base.id);
            if (merged) out.push(merged);
        }
        return { data: out, loading: false };
    }, [authorId, ready, notesTable, commentsTable, user]);
}

/** Notes authored by ANY of `authorIds`, newest first per author. Used by
 *  the Follow tab to materialize the feed of followed users without
 *  scanning the entire 4k-row notes table client-side. Cheap because each
 *  author lookup hits `notes_author` index, and |authorIds| is typically
 *  small (<50 followings). */
export function useNotesByAuthors(authorIds: string[] | undefined): Loadable<Note[]> {
    const ready = useBaseDatasetReady();
    const notesTable = useRedNoteStore(selectNotesTable);
    const commentsTable = useRedNoteStore(selectCommentsTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!authorIds || !authorIds.length) return { data: [], loading: false };
        if (!ready) return { data: [], loading: true };
        const out: Note[] = [];
        // Track seen ids so a runtime-patched note authored by user X (in
        // notesTable) doesn't double-emit alongside its base row.
        const seen = new Set<string>();
        for (const aid of authorIds) {
            for (const base of selectBaseNotesByAuthor(aid)) {
                if (seen.has(base.id)) continue;
                seen.add(base.id);
                const patch = notesTable?.[base.id];
                const merged = mergeNoteOverlay(base, patch, commentsTable, user, base.id);
                if (merged) out.push(merged);
            }
        }
        // Append runtime-only notes authored by any of the same users.
        for (const [nid, value] of Object.entries(notesTable || {})) {
            if (!value || seen.has(nid)) continue;
            if (!authorIds.includes((value as Note).authorId)) continue;
            seen.add(nid);
            const merged = mergeNoteOverlay(null, value, commentsTable, user, nid);
            if (merged) out.push(merged);
        }
        return { data: out, loading: false };
    }, [authorIds, ready, notesTable, commentsTable, user]);
}

/** Substring search across note title + content (SQL LIKE). Results ranked
 *  by base likes desc; runtime patches/tombstones applied after. */
export function useSearchNotes(keyword: string, limit = 100): Loadable<Note[]> {
    const ready = useBaseDatasetReady();
    const notesTable = useRedNoteStore(selectNotesTable);
    const commentsTable = useRedNoteStore(selectCommentsTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        const kw = keyword.trim();
        if (!kw) return { data: [], loading: false };
        if (!ready) return { data: [], loading: true };
        const baseHits = searchBaseNotes(kw, limit);
        const out: Note[] = [];
        for (const base of baseHits) {
            const patch = notesTable?.[base.id];
            const merged = mergeNoteOverlay(base, patch, commentsTable, user, base.id);
            if (merged) out.push(merged);
        }
        return { data: out, loading: false };
    }, [keyword, limit, ready, notesTable, commentsTable, user]);
}

/** Substring search across user name. */
export function useSearchUsers(keyword: string, limit = 100): Loadable<User[]> {
    const ready = useBaseDatasetReady();
    const usersTable = useRedNoteStore(selectUsersTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        const kw = keyword.trim();
        if (!kw) return { data: [], loading: false };
        if (!ready) return { data: [], loading: true };
        const baseHits = searchBaseUsers(kw, limit);
        const out: User[] = [];
        for (const base of baseHits) {
            const patch = usersTable?.[base.id];
            const merged = mergeUserOverlay(base, patch, user, base.id);
            if (merged) out.push(merged);
        }
        return { data: out, loading: false };
    }, [keyword, limit, ready, usersTable, user]);
}

/** Top-N notes by base likes (City/Hot surface). Runtime patches applied. */
export function useTopNotesByLikes(limit = 30): Loadable<Note[]> {
    const ready = useBaseDatasetReady();
    const notesTable = useRedNoteStore(selectNotesTable);
    const commentsTable = useRedNoteStore(selectCommentsTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!ready) return { data: [], loading: true };
        const baseHits = selectTopNotesByLikes(limit);
        const out: Note[] = [];
        for (const base of baseHits) {
            const patch = notesTable?.[base.id];
            const merged = mergeNoteOverlay(base, patch, commentsTable, user, base.id);
            if (merged) out.push(merged);
        }
        return { data: out, loading: false };
    }, [ready, limit, notesTable, commentsTable, user]);
}

/** Author's top-liked note (judge surface for "top liked title" task). Base-only. */
export function useTopNoteForAuthor(authorId: string | undefined): Loadable<Note | undefined> {
    const ready = useBaseDatasetReady();
    return useMemo(() => {
        if (!authorId) return { data: undefined, loading: false };
        if (!ready) return { data: undefined, loading: true };
        const base = selectTopNoteForAuthor(authorId);
        return { data: base ?? undefined, loading: false };
    }, [authorId, ready]);
}

/** All known user ids (base + runtime-added). Used by HomePage's
 *  follow-list / similar surfaces that need to enumerate users we've
 *  ever heard of. NoteCard / DetailPage should prefer `useUserById`. */
export function useKnownUserIds(): Loadable<string[]> {
    const ready = useBaseDatasetReady();
    const usersTable = useRedNoteStore(selectUsersTable);
    const user = useRedNoteStore(useShallow(selectCurrentUser));
    return useMemo(() => {
        if (!ready) return { data: [], loading: true };
        const baseIds = selectBaseUserIds();
        const set = new Set<string>([user.id, ...baseIds]);
        for (const [uid, value] of Object.entries(usersTable || {})) {
            if (value !== null) set.add(uid);
        }
        return { data: Array.from(set), loading: false };
    }, [ready, usersTable, user]);
}

// ── Fine-grained subscriptions for NoteCard-style rendering ──────────
//
// HomePage renders 200+ NoteItem siblings. If each one subscribed to the
// whole merged note via `useNoteById`, toggling a like would re-render all
// of them (every NoteItem's useMemo deps include `user`). The hooks below
// expose narrow boolean / per-author subscriptions so that toggling a like
// on note X only re-renders the cards that read `useIsNoteLiked(X)`.

/** Author of a note, runtime-overlay-merged. Returns `undefined` while
 *  warming or when the user is unknown. Thin wrapper over `useUserById`
 *  named for grep-ability + intent. */
export function useRedNoteAuthor(authorId: string | undefined): User | undefined {
    return useUserById(authorId).data;
}

/** Whether the current user has liked a specific note. Subscribes only to
 *  the boolean — flipping `likedNotes` for note X re-renders the cards
 *  observing X but not the rest. */
export function useIsNoteLiked(noteId: string | undefined): boolean {
    return useRedNoteStore(s =>
        !!noteId && (s.user.likedNotes || []).includes(noteId)
    );
}

/** Whether the current user is following a specific other user. */
export function useIsFollowingUser(userId: string | undefined): boolean {
    return useRedNoteStore(s =>
        !!userId && (s.user.followingIds || []).includes(userId)
    );
}

/** Whether the current user has collected a specific note. */
export function useIsNoteCollected(noteId: string | undefined): boolean {
    return useRedNoteStore(s =>
        !!noteId && (s.user.collectedNotes || []).includes(noteId)
    );
}

/** Comment→note inverse index. Cached for session lifetime by the loader;
 *  this hook only re-renders when the DB transitions to ready. */
export function useBaseCommentToNote(): Loadable<Record<string, string>> {
    const ready = useBaseDatasetReady();
    return useMemo(() => {
        if (!ready) return { data: {}, loading: true };
        return { data: getBaseCommentToNote(), loading: false };
    }, [ready]);
}

// ── Re-exports for callers that need raw overlay tables ───────────────

export type {
    RedNoteRuntimeCommentTable,
    RedNoteRuntimeNoteTable,
    RedNoteRuntimeUserTable,
};
