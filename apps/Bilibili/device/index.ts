/**
 * Bilibili on the device server.
 *
 * The catalog (videos, tags, online counts, comments, authors, commenters,
 * rankings: ~90MB of JSON) is loaded once per server process and shared by
 * every session, instead of being fetched and parsed by every page. It is
 * read-only: user interactions never rewrite catalog records, so every query
 * here reads the catalog alone.
 *
 * Session state is the user's own data (`user` + `settings`), in the same
 * shape as before, so `__SIM__.getState().apps.bilibili` and every bench judge
 * keep working unchanged. Commands are the former store actions.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppContext, AppModule, Catalog, DeviceRecord } from '../../../device/engine';
import { createBilibiliAssetResolver } from '../data/assets';
import type {
  BilibiliSettings,
  BilibiliUser,
  BilibiliVideo,
  CommentReply,
  RankingVideo,
  UserInfo,
} from '../types';

export interface BilibiliDeviceState {
  user: BilibiliUser;
  settings: BilibiliSettings;
}

type Ctx = AppContext<BilibiliDeviceState>;

export const BILIBILI_STATE_KEYS = ['user', 'settings'] as const satisfies readonly (keyof BilibiliDeviceState)[];

interface VideoComments {
  comments: CommentReply[];
  count: number;
}

interface BilibiliCatalogExtras {
  tags: Record<string, string[]>;
  online: Record<string, string>;
  comments: Record<string, VideoComments>;
  /** Commenters are a fallback profile source (users who never uploaded). */
  commenters: Map<string, UserInfo>;
  /** Author list in file order (search walks it). */
  authorList: UserInfo[];
  authorByName: Map<string, UserInfo>;
  rankings: Record<string, RankingVideo[]>;
  /** Home "recommend" ids, the fallback for related videos. */
  recommendIds: string[];
}

// ── Catalog ─────────────────────────────────────────────────────────

function loadCatalog(root: string, cdnBase: string): Catalog {
  const dataDir = join(root, 'apps', 'Bilibili', 'data');
  const { resolveDeep } = createBilibiliAssetResolver(cdnBase);
  const read = <T,>(name: string) => resolveDeep(JSON.parse(readFileSync(join(dataDir, name), 'utf8'))) as T;

  const videos = read<BilibiliVideo[]>('videos.json');
  const authors = read<Record<string, UserInfo>>('authors.json');
  const commenters = read<Record<string, UserInfo>>('commenters.json');
  const recommend = JSON.parse(readFileSync(join(dataDir, 'recommend.json'), 'utf8')) as BilibiliVideo[];

  const videosById = new Map<string, DeviceRecord>();
  for (const video of videos) videosById.set(video.id, video as unknown as DeviceRecord);
  const authorsById = new Map<string, DeviceRecord>();
  const authorByName = new Map<string, UserInfo>();
  for (const [mid, author] of Object.entries(authors)) {
    authorsById.set(mid, { ...author, id: mid } as unknown as DeviceRecord);
    if (!authorByName.has(author.name)) authorByName.set(author.name, author);
  }

  const extras: BilibiliCatalogExtras = {
    tags: read('videoTags.json'),
    online: read('videoOnline.json'),
    comments: read('videoComments.json'),
    commenters: new Map(Object.entries(commenters)),
    authorList: Object.values(authors),
    authorByName,
    rankings: read('rankings.json'),
    recommendIds: recommend.map(v => v.id),
  };
  return {
    collections: new Map([
      ['videos', { order: videos.map(v => v.id), byId: videosById }],
      ['authors', { order: Object.keys(authors), byId: authorsById }],
    ]),
    extras: extras as unknown as Record<string, unknown>,
  };
}

const extras = (ctx: Ctx) => ctx.catalog.extras as unknown as BilibiliCatalogExtras;
const videoCollection = (ctx: Ctx) => ctx.catalog.collections.get('videos')!;
const videoById = (ctx: Ctx, id: string) => videoCollection(ctx).byId.get(id) as unknown as BilibiliVideo | undefined;

/** Catalog author record as the page knows it (no engine `id` field). */
function authorById(ctx: Ctx, mid: string): UserInfo | undefined {
  const record = ctx.catalog.collections.get('authors')!.byId.get(mid);
  if (!record) return undefined;
  const { id: _id, ...author } = record;
  return author as unknown as UserInfo;
}

const strArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/** `{ id -> video }` for the given ids that exist in the catalog. */
function videoMap(ctx: Ctx, ids: Iterable<string>): Record<string, BilibiliVideo> {
  const out: Record<string, BilibiliVideo> = {};
  for (const id of ids) {
    const video = videoById(ctx, id);
    if (video) out[id] = video;
  }
  return out;
}

// ── Commands (one per store action) ─────────────────────────────────

function deepSet<T extends Record<string, unknown>>(obj: T, path: string, value: string | boolean): T {
  const keys = path.split('.');
  if (keys.length === 1) return { ...obj, [keys[0]!]: value } as T;
  const [head, ...rest] = keys;
  const next =
    obj[head!] != null && typeof obj[head!] === 'object' && !Array.isArray(obj[head!])
      ? (obj[head!] as Record<string, unknown>)
      : {};
  return { ...obj, [head!]: deepSet(next, rest.join('.'), value) } as T;
}

/** Command args travel as JSON, so an omitted `title` arrives as `null`; keep it omitted. */
const subscription = (id: unknown, title: unknown) =>
  (title == null ? { id: String(id) } : { id: String(id), title: String(title) });

function setUser(ctx: Ctx, user: BilibiliUser): void {
  ctx.state = { ...ctx.state, user };
}

const commands: AppModule<BilibiliDeviceState>['commands'] = {
  /** `unset`: keys the page set to `undefined` (JSON cannot carry them); they are removed. */
  updateUser(ctx, [updates, unset]) {
    const user: Record<string, unknown> = { ...ctx.state.user, ...(updates as Partial<BilibiliUser>) };
    for (const key of strArray(unset)) delete user[key];
    setUser(ctx, user as unknown as BilibiliUser);
  },
  setSetting(ctx, [path, value]) {
    ctx.state = {
      ...ctx.state,
      settings: deepSet(
        ctx.state.settings as unknown as Record<string, unknown>,
        String(path),
        value as string | boolean,
      ) as unknown as BilibiliSettings,
    };
  },
  toggleFollow(ctx, [id]) {
    const mid = String(id);
    const user = ctx.state.user;
    const currentList = user.followingList || [];
    const isFollowing = currentList.some(u => String(u.mid) === mid);
    const newList = isFollowing
      ? currentList.filter(u => String(u.mid) !== mid)
      : [...currentList, { mid, name: `用户${mid}`, face: '', sign: '' }];
    setUser(ctx, { ...user, followingList: newList, following: newList.length });
  },
  toggleLike(ctx, [vid]) {
    const user = ctx.state.user;
    const id = String(vid);
    const liked = (user.likedVideoIds || []).includes(id);
    const disliked = (user.dislikedVideoIds || []).includes(id);
    let newLiked = [...(user.likedVideoIds || [])];
    let newDisliked = [...(user.dislikedVideoIds || [])];
    if (liked) {
      newLiked = newLiked.filter(v => v !== id);
    } else {
      newLiked.push(id);
      if (disliked) newDisliked = newDisliked.filter(v => v !== id);
    }
    setUser(ctx, { ...user, likedVideoIds: newLiked, dislikedVideoIds: newDisliked });
  },
  toggleDislike(ctx, [vid]) {
    const user = ctx.state.user;
    const id = String(vid);
    const liked = (user.likedVideoIds || []).includes(id);
    const disliked = (user.dislikedVideoIds || []).includes(id);
    let newLiked = [...(user.likedVideoIds || [])];
    let newDisliked = [...(user.dislikedVideoIds || [])];
    if (disliked) {
      newDisliked = newDisliked.filter(v => v !== id);
    } else {
      newDisliked.push(id);
      if (liked) newLiked = newLiked.filter(v => v !== id);
    }
    setUser(ctx, { ...user, likedVideoIds: newLiked, dislikedVideoIds: newDisliked });
  },
  addCoin(ctx, [vid, count, alsoLike]) {
    const user = ctx.state.user;
    const id = String(vid);
    const n = Number(count);
    const existing = (user.coinedVideoCoins || {})[id] || 0;
    if (existing + n > 2) return { success: false, msg: '投硬币失败~超过投币上限啦~' };
    if (user.coins < n) return { success: false, msg: '硬币不足' };
    const alreadyLiked = (user.likedVideoIds || []).includes(id);
    setUser(ctx, {
      ...user,
      coins: user.coins - n,
      coinedVideoCoins: { ...(user.coinedVideoCoins || {}), [id]: existing + n },
      ...(alsoLike && !alreadyLiked
        ? {
            likedVideoIds: [...(user.likedVideoIds || []), id],
            dislikedVideoIds: (user.dislikedVideoIds || []).filter(v => v !== id),
          }
        : {}),
    });
    return { success: true, msg: '' };
  },
  toggleFav(ctx, [vid]) {
    const user = ctx.state.user;
    const id = String(vid);
    const folders = user.favoritesFolders || [];
    const isFavored = folders.some(f => (f.videoIds || []).includes(id));
    const updatedFolders = isFavored
      ? folders.map(f => ({ ...f, videoIds: (f.videoIds || []).filter(v => v !== id) }))
      : folders.map(f => (f.id === 'fav_default' ? { ...f, videoIds: [...(f.videoIds || []), id] } : f));
    setUser(ctx, { ...user, favoritesFolders: updatedFolders });
  },
  setFavFolders(ctx, [vid, selectedIds]) {
    const user = ctx.state.user;
    const id = String(vid);
    const selected = strArray(selectedIds);
    const updatedFolders = (user.favoritesFolders || []).map(folder => {
      const shouldContain = selected.includes(folder.id);
      const currentIds = folder.videoIds || [];
      const alreadyIn = currentIds.includes(id);
      if (shouldContain && !alreadyIn) return { ...folder, videoIds: [...currentIds, id] };
      if (!shouldContain && alreadyIn) return { ...folder, videoIds: currentIds.filter(v => v !== id) };
      return folder;
    });
    setUser(ctx, { ...user, favoritesFolders: updatedFolders });
  },
  createFavFolder(ctx, [title, description, isPublic], { now }) {
    const user = ctx.state.user;
    const id = `fav_${now.toString(36)}`;
    setUser(ctx, {
      ...user,
      favoritesFolders: [
        {
          id,
          title: String(title),
          isPublic: isPublic == null ? true : Boolean(isPublic),
          videoIds: [],
          ...(description ? { description: String(description) } : {}),
        },
        ...(user.favoritesFolders || []),
      ],
    });
    return id;
  },
  tripleAction(ctx, [vid]) {
    const user = ctx.state.user;
    const id = String(vid);
    let msg = '';
    const liked = (user.likedVideoIds || []).includes(id);
    const coinCount = (user.coinedVideoCoins || {})[id] || 0;
    const isFavored = (user.favoritesFolders || []).some(f => (f.videoIds || []).includes(id));

    const newLiked = [...(user.likedVideoIds || [])];
    const newCoinedVideoCoins = { ...(user.coinedVideoCoins || {}) };
    let newCoins = user.coins;
    const newDisliked = (user.dislikedVideoIds || []).filter(v => v !== id);
    if (!liked) newLiked.push(id);
    if (coinCount < 2) {
      if (user.coins >= 1) {
        newCoinedVideoCoins[id] = coinCount + 1;
        newCoins -= 1;
      } else {
        msg = '硬币不足，仅点赞收藏';
      }
    }
    const updatedFolders = !isFavored
      ? (user.favoritesFolders || []).map(folder =>
          folder.id === 'fav_default' ? { ...folder, videoIds: [...(folder.videoIds || []), id] } : folder,
        )
      : user.favoritesFolders;
    setUser(ctx, {
      ...user,
      likedVideoIds: newLiked,
      dislikedVideoIds: newDisliked,
      coinedVideoCoins: newCoinedVideoCoins,
      coins: newCoins,
      favoritesFolders: updatedFolders,
    });
    return { success: true, msg: msg || '三连成功' };
  },
  toggleAnime(ctx, [id, title]) {
    const user = ctx.state.user;
    const subscribed = (user.subscribedAnime || []).some(a => a.id === id);
    setUser(ctx, {
      ...user,
      subscribedAnime: subscribed
        ? (user.subscribedAnime || []).filter(a => a.id !== id)
        : [...(user.subscribedAnime || []), subscription(id, title)],
    });
  },
  toggleDrama(ctx, [id, title]) {
    const user = ctx.state.user;
    const subscribed = (user.subscribedDramas || []).some(d => d.id === id);
    setUser(ctx, {
      ...user,
      subscribedDramas: subscribed
        ? (user.subscribedDramas || []).filter(d => d.id !== id)
        : [...(user.subscribedDramas || []), subscription(id, title)],
    });
  },
  addSearchHistory(ctx, [keyword]) {
    const trimmed = String(keyword ?? '').trim();
    if (!trimmed) return;
    const user = ctx.state.user;
    const history = user.searchHistory || [];
    setUser(ctx, { ...user, searchHistory: [trimmed, ...history.filter(h => h !== trimmed)].slice(0, 10) });
  },
  clearSearchHistory(ctx) {
    setUser(ctx, { ...ctx.state.user, searchHistory: [] });
  },
};

// ── Queries (catalog only) ──────────────────────────────────────────

const queries: AppModule<BilibiliDeviceState>['queries'] = {
  /**
   * Videos by id. `order: 'ids'` keeps the given order (missing ids dropped);
   * `order: 'catalog'` returns them in catalog order, like filtering the full list.
   */
  videos(ctx, args) {
    const ids = strArray(args.ids);
    if (args.order === 'catalog') {
      const wanted = new Set(ids);
      return videoCollection(ctx).order.filter(id => wanted.has(id)).map(id => videoById(ctx, id)!);
    }
    return ids.map(id => videoById(ctx, id)).filter(Boolean);
  },

  /** Catalog authors by mid (`{ mid -> author }`, unknown mids omitted). */
  authors(ctx, args) {
    const out: Record<string, UserInfo> = {};
    for (const mid of strArray(args.mids)) {
      const author = authorById(ctx, mid);
      if (author) out[mid] = author;
    }
    return out;
  },

  /** A profile (author, else commenter) with its uploads merged with full video records. */
  profile(ctx, args) {
    const mid = String(args.mid ?? '');
    const user = authorById(ctx, mid) ?? extras(ctx).commenters.get(mid);
    if (!user) return { user: null, videos: [] };
    const videos = (user.videos || []).map(v => {
      const full = videoById(ctx, v.id);
      return full ? { ...v, ...full } : v;
    });
    return { user, videos };
  },

  /** Everything the video page shows from the catalog. */
  videoDetail(ctx, args) {
    const bvid = String(args.bvid ?? '');
    const collection = videoCollection(ctx);
    const video = videoById(ctx, bvid) ?? videoById(ctx, collection.order[0]!)!;
    const ex = extras(ctx);

    // Related: same partition first, then the home recommend list.
    const related: BilibiliVideo[] = [];
    const exclude = new Set<string>([video.id]);
    if (video.partition) {
      for (const id of collection.order) {
        if (related.length >= 5) break;
        const candidate = videoById(ctx, id)!;
        if (exclude.has(id) || candidate.partition !== video.partition) continue;
        related.push(candidate);
        exclude.add(id);
      }
    }
    for (const id of ex.recommendIds) {
      if (related.length >= 5) break;
      if (exclude.has(id)) continue;
      const full = videoById(ctx, id);
      if (full) {
        related.push(full);
        exclude.add(id);
      }
    }

    const author = video.author ? ex.authorByName.get(video.author) ?? null : null;
    return {
      bvid,
      video,
      related,
      tags: ex.tags[bvid] ?? [],
      online: ex.online[bvid] ?? null,
      comments: ex.comments[bvid] ?? null,
      author,
    };
  },

  /** Videos in a partition: `names` are the partition aliases, `label` the raw route label. */
  partition(ctx, args) {
    const label = String(args.label ?? '');
    if (!label) return [];
    const names = strArray(args.names);
    return videoCollection(ctx).order.map(id => videoById(ctx, id)!).filter(video =>
      (video.partition && names.includes(video.partition))
      || names.some(name => video.partition?.includes(name))
      || video.desc === label
      || video.partition === label,
    );
  },

  /** Ranking lists for `keys`, plus the full records of every listed video. */
  rankings(ctx, args) {
    const all = extras(ctx).rankings;
    const keys = args.keys === undefined ? Object.keys(all) : strArray(args.keys);
    const rankings: Record<string, RankingVideo[]> = {};
    const ids = new Set<string>();
    for (const key of keys) {
      const list = all[key];
      if (!list) continue;
      rankings[key] = list;
      for (const item of list) ids.add(item.id);
    }
    return { rankings, videosById: videoMap(ctx, ids) };
  },

  /**
   * Search: videos by title/author, authors by name, anime and movie ranking
   * entries by title. Highlighting stays on the page.
   */
  search(ctx, args) {
    const q = String(args.q ?? '').toLowerCase();
    if (!q) return { videos: [], users: [], animes: [], movies: [], authorFaces: {}, videosById: {} };
    const ex = extras(ctx);
    const videos = videoCollection(ctx).order.map(id => videoById(ctx, id)!).filter(v =>
      (v.title ?? '').toLowerCase().includes(q) || v.author?.toLowerCase().includes(q),
    );
    const users = ex.authorList.filter(u => u.name.toLowerCase().includes(q));
    const rankingHits = (keys: string[]) =>
      keys.flatMap(key => ex.rankings[key] || []).filter(v => v.title?.toLowerCase().includes(q)).map(v => {
        const full = videoById(ctx, v.id);
        return { ...v, ...(full || {}) };
      });

    // Author avatars for video rows, and full records for the top user card.
    const authorFaces: Record<string, string> = {};
    for (const video of videos) {
      const name = video.author || '';
      if (name in authorFaces) continue;
      const author = ex.authorByName.get(name);
      if (author) authorFaces[name] = author.face;
    }
    const topUserVideoIds = (users[0]?.videos || []).slice(0, 3).map(v => v.id);
    return {
      videos,
      users,
      animes: rankingHits(['番剧', '国创']),
      movies: rankingHits(['电影', '电视剧', '纪录片']),
      authorFaces,
      videosById: videoMap(ctx, topUserVideoIds),
    };
  },
};

export function createBilibiliModule(options: { cdnBase: string }): AppModule<BilibiliDeviceState> {
  return {
    appId: 'bilibili',
    loadCatalog: root => loadCatalog(root, options.cdnBase),
    materialize() {},
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('bilibili state must be an object');
      const source = raw as Record<string, unknown>;
      const state: Record<string, unknown> = {};
      for (const key of BILIBILI_STATE_KEYS) state[key] = source[key];
      return state as unknown as BilibiliDeviceState;
    },
    commands,
    queries,
  };
}
