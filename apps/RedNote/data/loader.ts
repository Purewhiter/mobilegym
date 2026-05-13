/**
 * RedNote SQL loader — persistent in-memory sqlite-wasm + per-resource queries.
 *
 * `base.sqlite` (≈10MB) is fetched once and deserialized into an in-memory
 * READ-ONLY sqlite database, which stays open for the page lifetime. All
 * frontend reads go through the query helpers in this file; bench Python
 * reads the same file via the matching SQL constants in
 * `bench_env/task/rednote/queries.py`.
 *
 * Why no materialized `notesById` / `usersById` dicts:
 *   - 4221 notes × ~3KB resolved + 15000 users × ~250 bytes ≈ 16MB per page
 *     in JS heap, and with `parallel=16` bench pages we paid for 16 copies.
 *   - Real apps (xiaohongshu mobile + web) never load full corpora client-side;
 *     they paginate / point-lookup from a server-side database. Keeping a
 *     persistent sqlite mirrors that pattern at simulator scale: each
 *     consumer asks for exactly what it needs.
 *
 * Single source of truth: SQL strings live in `./queries.ts`. Schema lives
 * in `./schema.sql`. The build script `./build_base_db.py` produces
 * `./base.sqlite`. Bench and frontend both pin to those three files.
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Sqlite3Static, Database, SqlValue } from '@sqlite.org/sqlite-wasm';

import type { Comment, User, Note } from '../types';
import { resolveAssetUrl } from '.';
import { resolveDataTimestamp } from '../../../os/TimeService';
import {
    Q_NOTE_BY_ID,
    Q_USER_BY_ID,
    Q_IMAGES_BY_NOTE_ID,
    Q_ALL_FEED_IDS,
    Q_FEED_IDS_BY_CATEGORY,
    Q_ALL_USER_IDS,
    Q_NOTES_BY_AUTHOR,
    Q_NOTE_IDS_BY_AUTHOR,
    Q_SEARCH_NOTES,
    Q_SEARCH_USERS,
    Q_TOP_NOTES_BY_LIKES,
    Q_TOP_NOTE_FOR_AUTHOR,
    Q_ALL_NOTE_COMMENT_LISTS,
} from './queries';

// ── Module singletons ─────────────────────────────────────────────────

const baseDbUrl = new URL('./base.sqlite', import.meta.url).href;

let sqlite3Promise: Promise<Sqlite3Static> | null = null;
let dbPromise: Promise<Database> | null = null;
let db: Database | null = null;
const readySubscribers = new Set<() => void>();

function getSqlite3(): Promise<Sqlite3Static> {
    if (!sqlite3Promise) {
        sqlite3Promise = sqlite3InitModule();
    }
    return sqlite3Promise;
}

function openDbFromBytes(sqlite3: Sqlite3Static, bytes: Uint8Array): Database {
    const conn = new sqlite3.oo1.DB(':memory:', 'c');
    let pAlloc: number | null = null;
    try {
        pAlloc = sqlite3.wasm.allocFromTypedArray(bytes);
        const rc = sqlite3.capi.sqlite3_deserialize(
            conn.pointer!,
            'main',
            pAlloc,
            bytes.byteLength,
            bytes.byteLength,
            sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_READONLY,
        );
        if (rc !== sqlite3.capi.SQLITE_OK) {
            throw new Error(`sqlite3_deserialize failed: rc=${rc}`);
        }
        // FREEONCLOSE transfers ownership of `pAlloc` to sqlite3 after a
        // successful deserialize; sqlite3 frees it on `conn.close()`. We
        // intentionally never close this connection — it lives for the
        // lifetime of the page (matches RedBook's in-memory caches).
        return conn;
    } catch (err) {
        // Pre-ownership transfer failure path: explicitly free buffer + conn.
        if (pAlloc !== null) {
            try { sqlite3.wasm.dealloc(pAlloc); } catch { /* swallow */ }
        }
        try { conn.close(); } catch { /* swallow */ }
        throw err;
    }
}

function ensureDB(): Promise<Database> {
    if (db) return Promise.resolve(db);
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
        const tStart = performance.now();
        const [sqlite3, buffer] = await Promise.all([
            getSqlite3(),
            fetch(baseDbUrl).then(async resp => {
                if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${baseDbUrl}`);
                return resp.arrayBuffer();
            }),
        ]);
        const tFetched = performance.now();
        const conn = openDbFromBytes(sqlite3, new Uint8Array(buffer));
        const tOpened = performance.now();
        db = conn;
        // One-line perf summary for the benchmark harness.
        (window as unknown as Record<string, unknown>).__REDNOTE_LOAD_PROFILE__ = {
            fetchAndWasmInitMs: Math.round(tFetched - tStart),
            openMs: Math.round(tOpened - tFetched),
            // `materializeMs` retained as 0 so callers that grep for it
            // don't break — there's no materialization anymore.
            materializeMs: 0,
            totalMs: Math.round(tOpened - tStart),
        };
        readySubscribers.forEach(fn => {
            try { fn(); } catch { /* swallow listener errors */ }
        });
        return conn;
    })().catch(err => {
        dbPromise = null;
        throw err;
    });
    return dbPromise;
}

// ── Ready-state subscription (for useSyncExternalStore in view layer) ─

export function subscribeBaseDatasetReady(listener: () => void): () => void {
    readySubscribers.add(listener);
    return () => { readySubscribers.delete(listener); };
}

export function isBaseDatasetReady(): boolean {
    return db !== null;
}

// ── App-data-loader contract (called by OSContext.waitForData + RedNoteApp) ─

export async function preload(): Promise<void> {
    await ensureDB();
}

export async function hydrateStore(): Promise<void> {
    await ensureDB();
}

// ── Low-level query helper ────────────────────────────────────────────

type RowObject = Record<string, SqlValue>;

function exec(sql: string, bind?: SqlValue[]): RowObject[] {
    if (!db) throw new Error('RedNote base DB not ready — call preload() first or guard with isBaseDatasetReady()');
    return db.exec({ sql, bind, returnValue: 'resultRows', rowMode: 'object' }) as RowObject[];
}

// ── Row → object mappers ──────────────────────────────────────────────
//
// resolveStr: per-field URL rewrite (avatar, cover, video). Mirrors
// the inlined logic from the prior `loadAll()`. Keeps `null/undefined`
// passthrough so optional fields stay optional in the typed result.
const resolveStr = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    const r = resolveAssetUrl(v);
    return typeof r === 'string' ? r : (typeof v === 'string' ? v : undefined);
};

const ts = (v: unknown) => resolveDataTimestamp(v as string | number);

function rowToUser(row: RowObject): User {
    return {
        id: String(row.id),
        name: String(row.name ?? ''),
        avatar: resolveStr(row.avatar) ?? '',
        userCover: resolveStr(row.user_cover),
        following: Number(row.following ?? 0),
        followers: Number(row.followers ?? 0),
        likesAndCollections: Number(row.likes_and_collections ?? 0),
        intro: (row.intro as string | null) ?? '',
        location: (row.location as string | null) ?? '',
        gender: (row.gender as string | null) ?? undefined,
        age: (row.age as string | null) ?? undefined,
        userUrl: (row.user_url as string | null) ?? undefined,
    };
}

/** Resolve URLs anywhere in the commentList tree (top-level avatar,
 *  subComments[].avatar, subComments[].user.avatar). Mirrors the legacy
 *  `resolveAssetsDeep` walk over comment trees — see git blame on this
 *  function for the rendering 404 bug it fixes. */
function resolveCommentTree(cs: unknown): unknown {
    if (!Array.isArray(cs)) return cs;
    return cs.map(c => {
        if (!c || typeof c !== 'object') return c;
        const out: Record<string, unknown> = { ...(c as Record<string, unknown>) };
        if (typeof out.avatar === 'string') {
            out.avatar = resolveStr(out.avatar) ?? out.avatar;
        }
        if (out.user && typeof out.user === 'object') {
            const u = out.user as Record<string, unknown>;
            if (typeof u.avatar === 'string') {
                out.user = { ...u, avatar: resolveStr(u.avatar) ?? u.avatar };
            }
        }
        if (Array.isArray(out.subComments)) {
            out.subComments = resolveCommentTree(out.subComments);
        }
        return out;
    });
}

function rowToNote(row: RowObject, images: string[]): Note {
    const tags = row.tags_json ? (JSON.parse(String(row.tags_json)) as string[]) : [];
    const commentListRaw = row.comment_list_json
        ? (JSON.parse(String(row.comment_list_json)) as Comment[])
        : [];
    const commentList = (resolveCommentTree(commentListRaw) as Comment[]).map(c => ({
        ...c,
        time: ts(c.time as unknown as string | number),
    }));
    return {
        id: String(row.id),
        title: String(row.title ?? ''),
        content: (row.content as string | null) ?? '',
        authorId: String(row.author_id),
        images,
        video: resolveStr(row.video),
        cover: resolveStr(row.cover),
        likes: Number(row.likes ?? 0),
        collections: Number(row.collections ?? 0),
        comments: Number(row.comments_count ?? 0),
        commentList,
        createdAt: ts(row.created_at as number),
        category: (row.category as string | null) ?? undefined,
        url: (row.url as string | null) ?? undefined,
        tags,
        // xsec_token kept off the typed shape (not in Note interface) — read
        // via raw row if a caller needs it.
    };
}

function fetchImagesForNote(noteId: string): string[] {
    return exec(Q_IMAGES_BY_NOTE_ID, [noteId]).map(r => resolveStr(r.url) ?? String(r.url));
}

// ── Public query API (frontend hot path) ──────────────────────────────

export function selectBaseNoteById(id: string): Note | null {
    if (!id) return null;
    const rows = exec(Q_NOTE_BY_ID, [id]);
    if (!rows.length) return null;
    return rowToNote(rows[0], fetchImagesForNote(id));
}

export function selectBaseUserById(id: string): User | null {
    if (!id) return null;
    const rows = exec(Q_USER_BY_ID, [id]);
    if (!rows.length) return null;
    return rowToUser(rows[0]);
}

export function selectBaseFeedIds(opts?: { category?: string | null }): string[] {
    const cat = opts?.category;
    const rows = cat
        ? exec(Q_FEED_IDS_BY_CATEGORY, [cat])
        : exec(Q_ALL_FEED_IDS);
    return rows.map(r => String(r.id));
}

export function selectBaseUserIds(): string[] {
    return exec(Q_ALL_USER_IDS).map(r => String(r.id));
}

export function selectBaseNotesByAuthor(authorId: string): Note[] {
    if (!authorId) return [];
    const rows = exec(Q_NOTES_BY_AUTHOR, [authorId]);
    return rows.map(r => rowToNote(r, fetchImagesForNote(String(r.id))));
}

export function selectBaseNoteIdsByAuthor(authorId: string): string[] {
    if (!authorId) return [];
    return exec(Q_NOTE_IDS_BY_AUTHOR, [authorId]).map(r => String(r.id));
}

export function searchBaseNotes(keyword: string, limit = 100): Note[] {
    const kw = keyword.trim();
    if (!kw) return [];
    const pat = `%${kw}%`;
    const rows = exec(Q_SEARCH_NOTES, [pat, pat, pat, limit]);
    return rows.map(r => rowToNote(r, fetchImagesForNote(String(r.id))));
}

export function searchBaseUsers(keyword: string, limit = 100): User[] {
    const kw = keyword.trim();
    if (!kw) return [];
    return exec(Q_SEARCH_USERS, [`%${kw}%`, limit]).map(rowToUser);
}

export function selectTopNotesByLikes(limit = 30): Note[] {
    return exec(Q_TOP_NOTES_BY_LIKES, [limit])
        .map(r => rowToNote(r, fetchImagesForNote(String(r.id))));
}

export function selectTopNoteForAuthor(authorId: string): Note | null {
    if (!authorId) return null;
    const rows = exec(Q_TOP_NOTE_FOR_AUTHOR, [authorId]);
    if (!rows.length) return null;
    const r = rows[0];
    return rowToNote(r, fetchImagesForNote(String(r.id)));
}

// ── Lazy inverse index: comment id → owning note id ───────────────────
//
// Used by the runtime overlay to distinguish patches-on-base-comments
// (same id appears in base) from runtime-only new comments. Built on
// first use by reading every note's `comment_list_json` blob and walking
// it once. Cached for session lifetime — base data is read-only.

let baseCommentToNoteCache: Record<string, string> | null = null;

export function getBaseCommentToNote(): Record<string, string> {
    if (baseCommentToNoteCache) return baseCommentToNoteCache;
    const map: Record<string, string> = {};
    for (const row of exec(Q_ALL_NOTE_COMMENT_LISTS)) {
        const blob = row.comment_list_json;
        if (typeof blob !== 'string' || !blob) continue;
        try {
            const list = JSON.parse(blob) as Array<{ id?: string | number }>;
            const nid = String(row.id);
            for (const c of list) {
                if (c && c.id != null) map[String(c.id)] = nid;
            }
        } catch { /* malformed JSON in a row — skip rather than abort init */ }
    }
    baseCommentToNoteCache = map;
    return map;
}

// ── Legacy / transitional API ─────────────────────────────────────────
//
// `loadUsers` / `loadNotes` / `getUsersSync` / `getNotesSync` and
// `getBaseDataset` / `subscribeBaseDataset` were the prior contract.
// All in-tree consumers have moved to per-resource hooks in `view.ts`,
// but we keep nothing here — if a future caller needs full materialization,
// they should be re-evaluated: the right answer is almost always to add a
// targeted query, not to materialize everything.
