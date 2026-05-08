/**
 * RedBook 数据懒加载器
 *
 * users.json + notes.json 有交叉依赖（评论中的用户需从笔记中提取），
 * 因此内部统一加载并合并，对外按内容类型暴露独立的 load/getSync 对。
 */

import type { User, Note } from '../types';
import { REDBOOK_CONFIG, resolveAssetsDeep } from '.';

export interface RedBookLoadedData {
    notesById: Record<string, Note>;
    usersById: Record<string, User>;
    feedIds: string[];
    userIds: string[];
}

const usersUrl = new URL('./users.json', import.meta.url).href;
const notesUrl = new URL('./notes.json', import.meta.url).href;

let cache: RedBookLoadedData | null = null;
let loading: Promise<RedBookLoadedData> | null = null;

async function loadAll(): Promise<RedBookLoadedData> {
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

        // 把 ./images/... 这种相对路径转成 CDN 绝对路径（/cdn/redbook/...）
        const rawUsers = resolveAssetsDeep(rawUsersJson) as User[];
        const rawNotes = resolveAssetsDeep(rawNotesJson) as Note[];

        const allNotes = [...rawNotes, ...REDBOOK_CONFIG.sampleNotes] as Note[];
        const allUsers = [...rawUsers, ...REDBOOK_CONFIG.users] as User[];

        const uniqueNotes = Array.from(new Map(allNotes.map(n => [n.id, n])).values());
        const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());

        const usersById: Record<string, User> = Object.fromEntries(uniqueUsers.map(u => [u.id, u]));
        const notesById: Record<string, Note> = Object.fromEntries(uniqueNotes.map(n => [n.id, n]));

        for (const note of uniqueNotes) {
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

        const feedIds = uniqueNotes.map(n => n.id);
        const userIds = Object.keys(usersById);

        cache = { notesById, usersById, feedIds, userIds };
        return cache;
    })().catch(err => { loading = null; throw err; });

    return loading;
}

// ============ Users ============

export async function loadUsers(): Promise<Record<string, User>> {
    return (await loadAll()).usersById;
}

export function getUsersSync(): Record<string, User> | null {
    return cache?.usersById ?? null;
}

// ============ Notes ============

export async function loadNotes(): Promise<Record<string, Note>> {
    return (await loadAll()).notesById;
}

export function getNotesSync(): Record<string, Note> | null {
    return cache?.notesById ?? null;
}

// ============ Combined (for store _setEntities) ============

export async function loadEntities(): Promise<RedBookLoadedData> {
    return loadAll();
}

export function getEntitiesSync(): RedBookLoadedData | null {
    return cache;
}

export async function hydrateStore(): Promise<void> {
    const loaded = await loadAll();
    const sim = (globalThis as any).__SIM__;
    if (sim?._benchmarkPatchedApps?.has?.('redbook')) return;

    const { useRedBookStore } = await import('../state');
    useRedBookStore.getState()._setEntities(loaded);
}

// ============ Preload ============

export async function preload(): Promise<void> {
    await loadAll();
}
