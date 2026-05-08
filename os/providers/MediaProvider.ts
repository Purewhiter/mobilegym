import type { MediaItem } from '../types';
import ContentProvider from '../ContentProvider';
import ContentResolver from '../ContentResolver';
import { createOsStore } from '../createOsStore';
import type { ContentUri, ContentValues, Cursor } from '../types/content';
import * as MediaService from '../MediaService';
import BroadcastBus, { ACTION_MEDIA_SCANNER_SCAN_FILE } from '../BroadcastBus';
import { now as timeNow } from '../TimeService';
import mediaDefaults from './defaults/media.json';

export interface MediaProviderState {
  favorites: string[];
}

const runtimeImages: MediaItem[] = [];

function mergeById(primary: MediaItem[], secondary: MediaItem[]): MediaItem[] {
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...secondary]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function withFavorite(items: MediaItem[], favorites: Set<string>): Array<MediaItem & { favorite: boolean }> {
  return items.map((item) => ({
    ...item,
    favorite: favorites.has(item.path),
  }));
}

function genMediaId(): string {
  return `media_${timeNow()}_${Math.random().toString(36).slice(2, 8)}`;
}

const defaultState: MediaProviderState = {
  favorites: structuredClone((mediaDefaults as { favorites?: string[] }).favorites ?? []) as string[],
};

export const useMediaProviderStore = createOsStore<MediaProviderState>(
  'provider.media',
  defaultState,
  {
    persistName: 'provider_media',
    registerToServiceRegistry: false,
    registerToProviderRegistry: true,
  },
);

export class MediaProvider extends ContentProvider {
  query(uri: ContentUri, _projection?: string[]): Cursor<any> {
    const parsed = ContentResolver.parseUri(uri);
    const path = parsed.path;
    const favorites = new Set(useMediaProviderStore.getState().favorites || []);

    if (path === '/images' || path === '/images/') {
      const images = mergeById(runtimeImages, MediaService.getMediaItems({ type: 'image' }));
      const items = withFavorite(images, favorites);
      return { items, count: items.length };
    }

    if (path === '/videos' || path === '/videos/') {
      const videos = MediaService.getMediaItems({ type: 'video' });
      return { items: videos, count: videos.length };
    }

    if (path === '/images/albums') {
      const albums = MediaService.getAlbums();
      return { items: albums, count: albums.length };
    }

    if (path === '/favorites' || path === '/favorites/') {
      const items = Array.from(favorites).map((favoritePath) => ({ path: favoritePath }));
      return { items, count: items.length };
    }

    const imageMatch = path.match(/^\/images\/([^/]+)$/);
    if (imageMatch) {
      const id = imageMatch[1];
      const images = mergeById(runtimeImages, MediaService.getMediaItems({ type: 'image' }));
      const item = images.find((x) => x.id === id);
      if (!item) return { items: [], count: 0 };
      return { items: [{ ...item, favorite: favorites.has(item.path) }], count: 1 };
    }

    const videoMatch = path.match(/^\/videos\/([^/]+)$/);
    if (videoMatch) {
      const id = videoMatch[1];
      const item = MediaService.getMediaItems({ type: 'video' }).find((x) => x.id === id);
      if (!item) return { items: [], count: 0 };
      return { items: [item], count: 1 };
    }

    return { items: [], count: 0 };
  }

  insert(uri: ContentUri, values: ContentValues): ContentUri {
    const parsed = ContentResolver.parseUri(uri);
    if (!(parsed.path === '/images' || parsed.path === '/images/')) {
      throw new Error(`[MediaProvider] Unsupported insert URI: ${parsed.path}`);
    }

    const now = timeNow();
    const id = typeof values.id === 'string' ? values.id : genMediaId();
    const mimeType = typeof values.mimeType === 'string' ? values.mimeType : 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpg';
    const fileName = typeof values.fileName === 'string' ? values.fileName : `IMG_${now}.${ext}`;
    const path = typeof values.path === 'string' ? values.path : `/sdcard/DCIM/Camera/${fileName}`;
    const uriValue = typeof values.uri === 'string'
      ? values.uri
      : `data:${mimeType};base64,`;

    const item: MediaItem = {
      id,
      type: 'image',
      uri: uriValue,
      thumbnailUri: typeof values.thumbnailUri === 'string' ? values.thumbnailUri : undefined,
      name: fileName,
      mimeType,
      size: typeof values.size === 'number' ? values.size : 0,
      width: typeof values.width === 'number' ? values.width : undefined,
      height: typeof values.height === 'number' ? values.height : undefined,
      duration: undefined,
      createdAt: now,
      path,
    };

    runtimeImages.unshift(item);
    BroadcastBus.sendBroadcast({
      action: ACTION_MEDIA_SCANNER_SCAN_FILE,
      extras: { id: item.id, uri: item.uri, path: item.path },
    });
    return `content://media/images/${item.id}`;
  }

  update(uri: ContentUri, values: ContentValues, _where?: string): number {
    const parsed = ContentResolver.parseUri(uri);
    const imageMatch = parsed.path.match(/^\/images\/([^/]+)$/);
    const videoMatch = parsed.path.match(/^\/videos\/([^/]+)$/);
    const id = imageMatch?.[1] ?? videoMatch?.[1];
    if (!id) return 0;
    const images = mergeById(runtimeImages, MediaService.getMediaItems({ type: 'image' }));
    const videos = MediaService.getMediaItems({ type: 'video' });
    const item = [...images, ...videos].find((entry) => entry.id === id);
    if (!item) return 0;
    if ('favorite' in values) {
      const shouldFavorite = Boolean(values.favorite);
      (useMediaProviderStore.setState as any)((state: MediaProviderState) => {
        const next = new Set(state.favorites);
        if (shouldFavorite) {
          next.add(item.path);
        } else {
          next.delete(item.path);
        }
        state.favorites = Array.from(next);
      });
      return 1;
    }
    return 0;
  }

  delete(uri: ContentUri, _where?: string): number {
    const parsed = ContentResolver.parseUri(uri);
    const imageMatch = parsed.path.match(/^\/images\/([^/]+)$/);
    if (!imageMatch) return 0;
    const id = imageMatch[1];
    const before = runtimeImages.length;
    const item = runtimeImages.find((entry) => entry.id === id);
    const next = runtimeImages.filter((x) => x.id !== id);
    runtimeImages.length = 0;
    runtimeImages.push(...next);
    if (item) {
      (useMediaProviderStore.setState as any)((state: MediaProviderState) => {
        state.favorites = state.favorites.filter((favoritePath) => favoritePath !== item.path);
      });
    }
    return before === next.length ? 0 : 1;
  }

  getType(uri: ContentUri): string {
    const parsed = ContentResolver.parseUri(uri);
    if (parsed.path.startsWith('/videos')) return 'video/*';
    return 'image/*';
  }
}

let mediaProvider: MediaProvider | null = null;

export function ensureMediaProviderRegistered(): void {
  if (!mediaProvider) {
    mediaProvider = new MediaProvider();
  }
  ContentResolver.registerProvider('media', mediaProvider);
}

export default MediaProvider;
