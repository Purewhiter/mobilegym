/**
 * Media Service
 * 
 * Provides gallery/media functionality built on top of FileSystemService.
 * Handles media picking, album management, and media queries.
 */
import { MediaItem, Album, MediaPickerOptions, MediaPickerResult, FSNode } from './types';
import * as FileSystem from './FileSystemService';
import { ALBUM_DEFINITIONS } from './data/fileSystemConfig';
import * as TimeService from './TimeService';

// ============================================================================
// Internal State
// ============================================================================

let pickCallback: ((result: MediaPickerResult) => void) | null = null;
let currentPickerOptions: MediaPickerOptions = {};

// ============================================================================
// Album Management
// ============================================================================

/**
 * Get all albums with their cover and count
 */
export function getAlbums(): Album[] {
  const allMedia = FileSystem.getMediaFiles()
    .filter(f => f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/'));
  
  return ALBUM_DEFINITIONS.map(def => {
    let items: FSNode[];
    
    if ((def as any).mimePrefix) {
      // Filter by MIME type (e.g., videos)
      items = allMedia.filter(m => m.mimeType?.startsWith((def as any).mimePrefix));
    } else if (def.pathPattern) {
      // Filter by path pattern
      items = def.id === 'all' 
        ? allMedia
        : allMedia.filter(m => m.path.startsWith(def.pathPattern!));
    } else {
      items = [];
    }
    
    // Get first image as cover
    const coverItem = items.find(i => i.mimeType?.startsWith('image/'));
    const coverUri = coverItem ? FileSystem.getFileUri(coverItem.path) : null;
    
    return {
      id: def.id,
      name: def.name,
      type: def.type,
      coverUri: coverUri || undefined,
      coverPath: coverItem?.path,
      count: items.length,
      pathPattern: def.pathPattern || undefined,
    };
  }).filter(album => album.count > 0 || album.id === 'all');
}

/**
 * Get media items for a specific album
 */
export function getMediaItems(options?: {
  albumId?: string;
  type?: 'image' | 'video' | 'all';
}): MediaItem[] {
  const albumDef = options?.albumId 
    ? ALBUM_DEFINITIONS.find(a => a.id === options.albumId)
    : ALBUM_DEFINITIONS.find(a => a.id === 'all');
  
  let files: FSNode[];
  
  if (!albumDef) {
    files = FileSystem.getMediaFiles();
  } else if ((albumDef as any).mimePrefix) {
    // Album defined by MIME type
    files = FileSystem.getMediaFiles().filter(
      f => f.mimeType?.startsWith((albumDef as any).mimePrefix)
    );
  } else if (albumDef.pathPattern) {
    // Album defined by path
    files = albumDef.id === 'all'
      ? FileSystem.getMediaFiles()
      : FileSystem.getFilesByPath(albumDef.pathPattern).filter(
          f => f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/')
        );
  } else {
    files = FileSystem.getMediaFiles();
  }
  
  // Gallery only deals with visual media — always exclude audio
  files = files.filter(f => f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/'));

  // Filter by type if specified
  if (options?.type && options.type !== 'all') {
    const mimePrefix = options.type === 'image' ? 'image/' : 'video/';
    files = files.filter(f => f.mimeType?.startsWith(mimePrefix));
  }
  
  return files.map(nodeToMediaItem);
}

/**
 * Get a single media item by path
 */
export function getMediaItem(path: string): MediaItem | null {
  const node = FileSystem.getNode(path);
  if (!node || node.type !== 'file') return null;
  if (!node.mimeType?.startsWith('image/') && !node.mimeType?.startsWith('video/')) {
    return null;
  }
  return nodeToMediaItem(node);
}

/**
 * Convert FSNode to MediaItem
 */
function nodeToMediaItem(node: FSNode): MediaItem {
  return {
    id: node.id,
    type: node.mimeType?.startsWith('video/') ? 'video' : 'image',
    uri: FileSystem.getFileUri(node.path) || '',
    thumbnailUri: node.thumbnailUri,
    name: node.name,
    mimeType: node.mimeType || 'application/octet-stream',
    size: node.size,
    width: node.width,
    height: node.height,
    duration: node.duration,
    createdAt: node.createdAt,
    path: node.path,
  };
}

// ============================================================================
// Media Picker
// ============================================================================

/**
 * Open media picker and return selected items
 * This triggers a system-level UI overlay
 */
export function pickMedia(options?: MediaPickerOptions): Promise<MediaPickerResult> {
  return new Promise((resolve) => {
    // Prevent concurrent pickers from clobbering each other.
    if (pickCallback) {
      console.warn('[MediaService] pickMedia called while another picker is active; cancelling previous picker');
      cancelSelection();
    }
    pickCallback = resolve;
    currentPickerOptions = options || {};
    
    // Dispatch event to open the picker UI
    window.dispatchEvent(new CustomEvent('media-picker-open', {
      detail: currentPickerOptions
    }));
  });
}

/**
 * Get current picker options (for the MediaPicker component)
 */
export function getPickerOptions(): MediaPickerOptions {
  return currentPickerOptions;
}

/**
 * Complete media selection (called by MediaPicker UI)
 */
export function completeSelection(selected: MediaItem[]): void {
  if (pickCallback) {
    pickCallback({ selected, cancelled: false });
    pickCallback = null;
    currentPickerOptions = {};
    window.dispatchEvent(new CustomEvent('media-picker-close'));
  }
}

/**
 * Cancel media selection (called by MediaPicker UI)
 */
export function cancelSelection(): void {
  if (pickCallback) {
    pickCallback({ selected: [], cancelled: true });
    pickCallback = null;
    currentPickerOptions = {};
    window.dispatchEvent(new CustomEvent('media-picker-close'));
  }
}

/**
 * Check if picker is currently active
 */
export function isPickerActive(): boolean {
  return pickCallback !== null;
}

// ============================================================================
// Media Operations
// ============================================================================

/**
 * Save an image to the gallery
 */
export async function saveToGallery(
  content: Blob | string,
  options?: {
    album?: string;
    fileName?: string;
    mimeType?: string;
  }
): Promise<MediaItem | null> {
  const album = options?.album || 'Saved';
  const now = TimeService.now();
  const date = TimeService.fromTimestamp(now);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
  
  const mimeType = options?.mimeType || (content instanceof Blob ? content.type : 'image/jpeg');
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : 'jpg';
  const fileName = options?.fileName || `IMG_${dateStr}_${timeStr}.${ext}`;
  
  // Determine path based on album
  let basePath = '/sdcard/Pictures/Saved';
  if (album === 'Camera') basePath = '/sdcard/DCIM/Camera';
  else if (album === 'Screenshots') basePath = '/sdcard/DCIM/Screenshots';
  else if (album === 'WeChat') basePath = '/sdcard/Pictures/WeChat';
  else if (album === 'Redbook') basePath = '/sdcard/Pictures/Redbook';
  
  const path = `${basePath}/${fileName}`;
  
  try {
    const blob = content instanceof Blob 
      ? content 
      : await (await fetch(content)).blob();
    
    const node = await FileSystem.writeFile(path, blob, { mimeType });
    return nodeToMediaItem(node);
  } catch (error) {
    console.error('[MediaService] Failed to save to gallery:', error);
    return null;
  }
}

/**
 * Delete a media item
 */
export async function deleteMedia(pathOrId: string): Promise<boolean> {
  // Try to find by path first
  let path = pathOrId;
  if (!pathOrId.startsWith('/')) {
    // It's an ID, need to find the path
    const items = getMediaItems();
    const item = items.find(i => i.id === pathOrId);
    if (!item) return false;
    path = item.path;
  }
  
  return FileSystem.deleteNode(path);
}

// ============================================================================
// Agent API
// ============================================================================

export function exposeAgentAPI(): void {
  window.__SIM_MEDIA__ = {
    // Albums
    getAlbums,
    
    // Media queries
    getItems: getMediaItems,
    getItem: getMediaItem,
    
    // Picker
    pick: pickMedia,
    
    // Operations
    save: saveToGallery,
    delete: deleteMedia,
    
    // For automation/testing
    simulateSelect: (itemIds: string[]) => {
      const items = getMediaItems().filter(i => itemIds.includes(i.id));
      completeSelection(items);
    },
  };
}
