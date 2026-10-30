/**
 * File System Service
 *
 * The phone's file system lives in the device server session (device/fs.ts).
 * This module keeps a mirror of the node tree so reads stay synchronous
 * (`listDirectory`, `getNode`, `exists`, `getFileUri`, …); every write is a
 * server command whose result replaces the mirror.
 *
 * File contents are never copied into the page: preset sdcard files are read
 * from their static `/sdcard/...` URL, files written at runtime from the
 * session's blob URL. A fresh session therefore costs one small metadata
 * request instead of re-importing the whole sdcard tree.
 */
import { FSNode } from './types';
import { FILE_SYSTEM_CONFIG } from './data/fileSystemConfig';
import * as TimeService from './TimeService';
import { DeviceClient } from './device/DeviceClient';

type ContentRef = { seed: string } | { blob: string };
type MirrorNode = FSNode & { content?: ContentRef };

// ============================================================================
// Mirror
// ============================================================================

interface FileSystemState {
  nodes: Map<string, MirrorNode>;
  pathIndex: Map<string, string>; // path -> id
  initialized: boolean;
}

const state: FileSystemState = {
  nodes: new Map(),
  pathIndex: new Map(),
  initialized: false,
};

function adopt(exported: unknown): void {
  const nodes = ((exported as { nodes?: MirrorNode[] } | null)?.nodes ?? []);
  state.nodes = new Map(nodes.map(n => [n.id, n]));
  state.pathIndex = new Map(nodes.map(n => [n.path, n.id]));
}

/** Server-down fallback: an empty tree so the OS still boots. */
function createBaseStateInMemory(): void {
  const now = TimeService.now();
  const nodes: MirrorNode[] = [
    { id: 'root', name: '/', type: 'directory', parentId: null, path: '/', size: 0, createdAt: now, modifiedAt: now, storage: 'memory' },
  ];
  for (const dir of FILE_SYSTEM_CONFIG.presetStructure) {
    nodes.push({
      id: `dir_${now}_${dir.path}`, name: getFileName(dir.path), type: 'directory', parentId: 'root',
      path: normalizePath(dir.path), size: 0, createdAt: now, modifiedAt: now, storage: 'memory',
    });
  }
  adopt({ nodes });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Shared initialization promise to prevent race conditions.
 * Multiple callers (e.g. OSProvider, ThemeProvider) may call initFileSystem()
 * concurrently; we must ensure only one initialization runs.
 */
let initPromise: Promise<void> | null = null;

/**
 * Initialize the file system
 * Call this on app startup
 */
export async function initFileSystem(): Promise<void> {
  if (state.initialized) return;
  initPromise ??= initFileSystemInternal().finally(() => {
    initPromise = null;
  });
  return initPromise;
}

async function initFileSystemInternal(): Promise<void> {
  try {
    const current = await DeviceClient.getState('fs');
    if (current.initialized) {
      adopt(current.state);
    } else {
      // Fresh session: the server seeds the preset sdcard tree. Seed dates in
      // file names are local times, so it needs this page's time zone.
      const seeded = await DeviceClient.putState('fs', {
        now: TimeService.now(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      adopt(seeded.state);
    }
    console.log('[FileSystem] Initialized with', state.nodes.size, 'nodes');
  } catch (error) {
    console.error('[FileSystem] Initialization failed:', error);
    createBaseStateInMemory();
  }
  state.initialized = true;
  exposeAgentAPI();
}

/** Run a file system command and adopt the resulting tree. */
async function run<T>(name: string, args: unknown[]): Promise<T> {
  await initFileSystem();
  const call = () => DeviceClient.command<unknown>('fs', name, args, TimeService.now());
  let response;
  try {
    response = await call();
  } catch (err) {
    // The session was replaced (reset / server restart): seed it, retry once.
    if ((err as { status?: number }).status !== 409) throw err;
    state.initialized = false;
    await initFileSystem();
    response = await call();
  }
  adopt(response.state);
  const result = response.result as { id?: string } | null;
  // Hand back the mirror's node object, like the old in-memory API did.
  return (result && typeof result === 'object' && result.id ? state.nodes.get(result.id) ?? result : result) as T;
}

// ============================================================================
// Public API - Read Operations
// ============================================================================

/**
 * List contents of a directory
 */
export function listDirectory(path: string): FSNode[] {
  const normalPath = normalizePath(path);
  const dirId = state.pathIndex.get(normalPath);

  if (!dirId) return [];

  return Array.from(state.nodes.values())
    .filter(node => node.parentId === dirId)
    .sort((a, b) => {
      // Directories first, then by name
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Get a node by path
 */
export function getNode(path: string): FSNode | null {
  const id = state.pathIndex.get(normalizePath(path));
  return id ? state.nodes.get(id) || null : null;
}

/**
 * Check if a path exists
 */
export function exists(path: string): boolean {
  return state.pathIndex.has(normalizePath(path));
}

/**
 * 把存储的根绝对路径（如 /sdcard/DCIM/...）转成可 fetch 的 URL，带上部署 base。
 * public/sdcard/* 在 build 时被发布到 <BASE_URL>sdcard/*；根部署 base='/' 时原样返回，
 * demo 分支 /sim/ 子路径部署时变成 /sim/sdcard/...。非根绝对路径（http/blob/相对）原样放过。
 */
function presetAssetUrl(p: string): string {
  if (!p.startsWith('/')) return p;
  return import.meta.env.BASE_URL + p.slice(1);
}

/**
 * Get the URI for displaying a file. Every file has a stable URL (static seed
 * path or session blob), so this works synchronously for all files.
 */
export function getFileUri(path: string): string | null {
  const node = state.nodes.get(state.pathIndex.get(normalizePath(path)) ?? '');
  if (!node || node.type !== 'file' || !node.content) return null;
  if ('seed' in node.content) return presetAssetUrl(node.content.seed);
  return DeviceClient.blobUrl(node.content.blob);
}

/**
 * Get the URI for displaying a file (async version, kept for callers that
 * may run before the file system is initialized).
 */
export async function getFileUriAsync(path: string): Promise<string | null> {
  await initFileSystem();
  return getFileUri(path);
}

/**
 * Read file content as Blob
 */
export async function readFile(path: string): Promise<Blob | null> {
  const uri = await getFileUriAsync(path);
  if (!uri) return null;
  try {
    const response = await fetch(uri);
    return response.ok ? await response.blob() : null;
  } catch (error) {
    console.error('[FileSystem] Failed to read file:', path, error);
    return null;
  }
}

/**
 * Get all media files (images and videos)
 */
export function getMediaFiles(type?: 'image' | 'video' | 'audio'): FSNode[] {
  const mimePrefix = type === 'image' ? 'image/'
    : type === 'video' ? 'video/'
    : type === 'audio' ? 'audio/'
    : null;

  return Array.from(state.nodes.values())
    .filter(node => {
      if (node.type !== 'file') return false;
      if (!node.mimeType) return false;

      if (mimePrefix) {
        return node.mimeType.startsWith(mimePrefix);
      }

      // Return all media types
      return node.mimeType.startsWith('image/') ||
             node.mimeType.startsWith('video/') ||
             node.mimeType.startsWith('audio/');
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/**
 * Get files matching a path pattern
 */
export function getFilesByPath(pathPattern: string): FSNode[] {
  const pattern = normalizePath(pathPattern);

  return Array.from(state.nodes.values())
    .filter(node => node.type === 'file' && node.path.startsWith(pattern))
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/**
 * Search files by name
 */
export function searchFiles(query: string, options?: {
  path?: string;
  mimeType?: string;
  type?: 'file' | 'directory';
}): FSNode[] {
  const lowerQuery = query.toLowerCase();

  return Array.from(state.nodes.values()).filter(node => {
    if (options?.type && node.type !== options.type) return false;
    if (options?.mimeType && !node.mimeType?.startsWith(options.mimeType)) return false;
    if (options?.path && !node.path.startsWith(options.path)) return false;
    return node.name.toLowerCase().includes(lowerQuery);
  });
}

// ============================================================================
// Public API - Write Operations (device server commands)
// ============================================================================

/**
 * Create a directory
 */
export function createDirectory(path: string): Promise<FSNode> {
  return run<FSNode>('mkdir', [normalizePath(path)]);
}

/**
 * Write a file
 */
export async function writeFile(
  path: string,
  content: Blob | ArrayBuffer | string,
  options?: { mimeType?: string; createdAt?: number; modifiedAt?: number }
): Promise<FSNode> {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: options?.mimeType || 'application/octet-stream' });
  await initFileSystem();
  const uploaded = await DeviceClient.putBlob(blob);
  return run<FSNode>('write', [normalizePath(path), {
    blob: uploaded.id,
    size: blob.size,
    mimeType: options?.mimeType,
    defaultMimeType: blob.type,
    createdAt: options?.createdAt,
    modifiedAt: options?.modifiedAt,
  }]);
}

/**
 * Editable file metadata — the descriptive fields a caller may safely patch
 * without breaking filesystem invariants. Structural fields (id/path/name/
 * parentId/type) are excluded because changing them is a move/rename (use
 * ``moveNode``); derived/internal fields (size/storage) are excluded because
 * they must stay in sync with the actual content (use ``writeFile`` to change
 * content).
 */
export type EditableMetadata = Partial<Pick<FSNode,
  'createdAt' | 'modifiedAt' | 'mimeType' |
  'thumbnailUri' | 'width' | 'height' | 'duration'
>>;

/**
 * Patch a file's editable metadata in place without touching its content.
 * Returns the updated node, or null if the path doesn't exist or isn't a file.
 */
export function setMetadata(path: string, patch: EditableMetadata): Promise<FSNode | null> {
  return run<FSNode | null>('setMetadata', [path, patch]);
}

/**
 * Delete a file or directory (recursively)
 */
export function deleteNode(path: string): Promise<boolean> {
  return run<boolean>('delete', [path]);
}

/**
 * Move/rename a file or directory
 */
export function moveNode(srcPath: string, destPath: string): Promise<FSNode | null> {
  return run<FSNode | null>('move', [srcPath, destPath]);
}

/**
 * Copy a file (the copy shares the original's content; no bytes move)
 */
export function copyFile(srcPath: string, destPath: string): Promise<FSNode | null> {
  return run<FSNode | null>('copy', [srcPath, destPath]);
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizePath(path: string): string {
  // Remove trailing slashes and normalize multiple slashes
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function getFileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || '';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * Get display name for a directory
 */
export function getDirectoryDisplayName(path: string): string {
  const preset = FILE_SYSTEM_CONFIG.presetStructure.find(d => d.path === path);
  return preset?.displayName || getFileName(path);
}

export function snapshotFileSystem(): { nodes: Omit<FSNode, 'thumbnailUri'>[] } {
  const nodes = Array.from(state.nodes.values())
    .map((node) => {
      const { thumbnailUri: _thumbnailUri, content: _content, ...meta } = node;
      return meta;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  return { nodes };
}

/**
 * Forget the mirror. The data itself belongs to the device session, which
 * `__SIM__.resetState` drops; the next `initFileSystem()` seeds a new one.
 */
export async function clearFileSystemDB(): Promise<void> {
  state.nodes.clear();
  state.pathIndex.clear();
  state.initialized = false;
  initPromise = null;
}

export const destroyFileSystemDB = clearFileSystemDB;

// ============================================================================
// Agent API
// ============================================================================

/**
 * 刷新文件系统
 *
 * V2 语义：运行时不再扫描/合并 public/sdcard，预置内容更新统一通过 reset 完成。
 */
export async function refreshFileSystem(): Promise<void> {
  console.warn('[FileSystem] refresh() is deprecated. Use __SIM_FS__.reset() to re-import from public/sdcard.');
}

/**
 * 重置文件系统：回到 public/sdcard 的预置内容
 */
export async function resetFileSystem(): Promise<void> {
  await run<void>('reset', []);
  console.log('[FileSystem] Reset complete, now has', state.nodes.size, 'nodes');
}

function exposeAgentAPI(): void {
  window.__SIM_FS__ = {
    // Directory operations
    list: listDirectory,
    mkdir: createDirectory,

    // File operations
    read: readFile,
    write: writeFile,
    setMetadata,
    delete: deleteNode,
    move: moveNode,
    copy: copyFile,

    // Query
    stat: getNode,
    exists,
    search: searchFiles,
    getMedia: getMediaFiles,
    getByPath: getFilesByPath,

    // Utils
    getUri: getFileUri,
    getUriAsync: getFileUriAsync,
    formatSize: formatFileSize,
    getDisplayName: getDirectoryDisplayName,

    // Refresh & Reset
    refresh: refreshFileSystem,
    reset: resetFileSystem,
  };
}
