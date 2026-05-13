/**
 * RedBook 数据懒加载器
 *
 * users.json + notes.json 是只读的 base dataset（共 ~13MB），由本模块异步加载并缓存于
 * 模块作用域。运行态叠加（user 真值字段 + notes/comments/users 三张 patch 表）由
 * Zustand store 管理，与本模块解耦——store 中不再持有 base 副本。
 *
 * 组件通过 `subscribeBaseDataset` + `getBaseDataset`（或 `useRedBookView` hook）订阅
 * base 加载完成事件，触发 re-render。
 */

import type { Comment, User, Note } from '../types';
import { resolveCdnUrl } from '../../../os/utils/cdn';

const ASSET_EXT_RE = /\.(jpe?g|png|webp|gif|svg|mp4|webm|avif)(\?.*)?$/i;

/** Resolve a single RedBook asset path. Mirrors the matcher in `data/index.ts`
 *  but is called targeted-per-field rather than via deep tree walk. */
function resolveOne(raw: unknown): unknown {
    if (typeof raw !== 'string' || !raw) return raw;
    if (raw.startsWith('http') || raw.startsWith('/')) return raw;
    if (raw.startsWith('./images/') || raw.startsWith('images/')) {
        return resolveCdnUrl(raw, 'redbook');
    }
    if (!ASSET_EXT_RE.test(raw)) return raw;
    return `/@app-assets/RedBook/${raw}`;
}

/** In-place URL resolution for known image fields on a base User. */
function resolveBaseUserAssets(user: User): User {
    if (user.avatar) user.avatar = resolveOne(user.avatar) as string;
    if (user.userCover) user.userCover = resolveOne(user.userCover) as string;
    return user;
}

/** In-place URL resolution for known image fields on a base Note + nested comments. */
function resolveBaseNoteAssets(note: Note): Note {
    if (note.cover) note.cover = resolveOne(note.cover) as string;
    if (note.video) note.video = resolveOne(note.video) as string;
    if ((note as any).videoUrl) (note as any).videoUrl = resolveOne((note as any).videoUrl);
    if (Array.isArray(note.images)) {
        for (let i = 0; i < note.images.length; i++) {
            note.images[i] = resolveOne(note.images[i]) as string;
        }
    }
    const cl = note.commentList;
    if (cl) {
        for (const c of cl as Comment[]) {
            if (c && c.avatar) c.avatar = resolveOne(c.avatar) as string;
        }
    }
    return note;
}

export interface RedBookBaseDataset {
    notesById: Record<string, Note>;
    usersById: Record<string, User>;
    feedIds: string[];
    userIds: string[];
    /**
     * Reverse index: base comment id → its parent note id.
     *
     * Lets `buildRedBookView` distinguish *patches on base comments* (an entry
     * in `state.comments` whose id appears here — handled by the base
     * commentList loop) from *runtime-only new comments* (id NOT here —
     * added to `runtimeCommentsByNote`). Without this filter, a patch
     * carrying `noteId` would be double-counted.
     */
    baseCommentToNote: Record<string, string>;
}

const usersUrl = new URL('./users.json', import.meta.url).href;
const notesUrl = new URL('./notes.json', import.meta.url).href;

let cache: RedBookBaseDataset | null = null;
let loading: Promise<RedBookBaseDataset> | null = null;
const subscribers = new Set<() => void>();

function assertUniqueIds(items: Array<{ id?: string }>, label: string): void {
    const seen = new Set<string>();
    for (const item of items) {
        if (!item.id) throw new Error(`Missing RedBook ${label} id`);
        if (seen.has(item.id)) throw new Error(`Duplicate RedBook ${label} id: ${item.id}`);
        seen.add(item.id);
    }
}

/**
 * Yield once to the event loop after the big synchronous chunk (JSON.parse +
 * targeted URL resolution). JSON.parse on a 13MB string is itself an
 * uninterruptible ~150ms block — splitting subsequent work into more chunks
 * mostly adds wall-time without meaningfully improving responsiveness, so we
 * keep just one yield to let any queued click/input handler run before the
 * "finalize cache + notify subscribers" tail.
 */
const yieldToBrowser = (): Promise<void> =>
    new Promise(resolve => {
        if (typeof window === 'undefined') return resolve();
        // setTimeout(0) yields after the current task drains queued events.
        // Faster than requestAnimationFrame (~4ms vs ~16ms) and we don't need
        // to be aligned to a paint here.
        setTimeout(resolve, 0);
    });

async function loadAll(): Promise<RedBookBaseDataset> {
    if (cache) return cache;
    if (loading) return loading;

    loading = (async () => {
        const [resUsers, resNotes] = await Promise.all([
            fetch(usersUrl),
            fetch(notesUrl),
        ]);
        if (!resUsers.ok) throw new Error(`HTTP ${resUsers.status} for ${usersUrl}`);
        if (!resNotes.ok) throw new Error(`HTTP ${resNotes.status} for ${notesUrl}`);
        const [rawUsersJson, rawNotesJson] = await Promise.all([
            resUsers.json() as Promise<User[]>,
            resNotes.json() as Promise<Note[]>,
        ]);

        // Targeted asset-URL resolution: only touch the 6 known image fields per
        // entity instead of deep-walking every string. ~6ms for 4221 notes.
        const baseUsers = (rawUsersJson as User[]).map(resolveBaseUserAssets);
        const baseNotes = (rawNotesJson as Note[]).map(resolveBaseNoteAssets);

        await yieldToBrowser();

        assertUniqueIds(baseUsers, 'user');
        assertUniqueIds(baseNotes, 'note');

        const usersById: Record<string, User> = Object.fromEntries(baseUsers.map(u => [u.id, u]));
        const notesById: Record<string, Note> = Object.fromEntries(baseNotes.map(n => [n.id, n]));

        for (const note of baseNotes) {
            if (note.commentList) {
                for (const comment of note.commentList) {
                    if (comment.userId && !usersById[comment.userId]) {
                        usersById[comment.userId] = {
                            id: comment.userId,
                            name: comment.username || 'Unknown',
                            avatar: comment.avatar || '',
                            intro: '暂无简介',
                            location: comment.location || '未知',
                            followers: 0,
                            following: 0,
                            likesAndCollections: 0,
                        } as User;
                    }
                }
            }
        }

        const feedIds = baseNotes.map(n => n.id);
        const userIds = Object.keys(usersById);
        const baseCommentToNote: Record<string, string> = {};
        for (const note of baseNotes) {
            const nid = String(note.id);
            for (const c of (note.commentList || [])) {
                if (c && c.id != null) baseCommentToNote[String(c.id)] = nid;
            }
        }

        cache = { notesById, usersById, feedIds, userIds, baseCommentToNote };
        subscribers.forEach(fn => {
            try { fn(); } catch { /* swallow listener errors */ }
        });
        return cache;
    })().catch(err => { loading = null; throw err; });

    return loading;
}

// ============ Base dataset (canonical API) ============

export function getBaseDataset(): RedBookBaseDataset | null {
    return cache;
}

export function subscribeBaseDataset(listener: () => void): () => void {
    subscribers.add(listener);
    return () => { subscribers.delete(listener); };
}

// ============ Users / Notes (granular accessors retained for now) ============

export async function loadUsers(): Promise<Record<string, User>> {
    return (await loadAll()).usersById;
}

export function getUsersSync(): Record<string, User> | null {
    return cache?.usersById ?? null;
}

export async function loadNotes(): Promise<Record<string, Note>> {
    return (await loadAll()).notesById;
}

export function getNotesSync(): Record<string, Note> | null {
    return cache?.notesById ?? null;
}

// ============ App-data-loader contract ============

export async function hydrateStore(): Promise<void> {
    await loadAll();
}

export async function preload(): Promise<void> {
    await loadAll();
}

// NOTE: no eager fetch on module load.
//
// We tried both `void loadAll()` at module top-level and a `requestIdleCallback`
// variant. Both moved the unavoidable JSON.parse(~13MB) ~150ms block into the
// OS boot window — making the *whole OS* feel sluggish during launcher animation
// without saving any time, since JSON.parse is uninterruptible on the main thread.
//
// Now the fetch is purely lazy: 由 OS 的 lazy() + Suspense + AppLaunchSplash
// 三件套触发（见 os/data/appRegistry.tsx）—— 用户点 RedBook 图标后看到的是
// AppLaunchSplash，后台 await `runAppDataLoaderModule(loaderMod)` 完成后才
// import RedBookApp 并 mount。所以正常路径下 RedBookApp mount 时 cache 已就绪，
// 不存在"App 进了但 base feed 是空的"窗口。
//
// `RedBookApp` 内的 `useEffect(() => void preload())` 是 hot reload / 直接 mount
// 等绕过 OS lazy 的极少数路径的幂等兜底——命中已 ready 的 cache 立即返回。
//
// defaults.json 里的 seed notes (`note_0`/`note_1`) 不是 splash 兜底，而是给
// MePage 我的笔记 / 消息中心 / DetailPage 等始终依赖的入口提供内容（挂在
// `user.publishedNoteIds` 与 `notifications[*].noteId` 上）。它们未声明
// `category`，HomePage 推荐 tab 的 category 过滤会把它们剔除（这是有意的——
// seed 仅服务"我的"侧，不参与发现流）。
//
// If you ever want eager pre-loading again, do it *after* the OS has finished
// settling — e.g. wire it to a launcher idle event, or wrap in a much longer
// `setTimeout` (1-2s) so it doesn't fight with bootstrap.
