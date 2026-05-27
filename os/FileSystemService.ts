/**
 * File System Service
 *
 * Provides a virtual file system for the simulated Android environment.
 * Uses IndexedDB for persistent storage.
 *
 * 设计目标（V2）：
 * - 仅在「首次初始化」或「手动 reset」时，从 public/sdcard 扫描并全量导入（meta + content）到 IndexedDB
 * - 常规启动只从 IndexedDB 读取，不再运行时扫描/合并 public/sdcard
 * - 这样预置文件与运行中写入文件拥有一致语义（可重命名/移动/删除且跨重启保持）
 */
import { FSNode, PresetFile } from './types';
import { FILE_SYSTEM_CONFIG } from './data/fileSystemConfig';
import { getNamespacedIndexedDbName } from './storageIsolation';
import * as TimeService from './TimeService';

// API 响应结构
interface ScanResult {
  totalFiles: number;
  totalDirectories: number;
  files: {
    path: string;
    uri: string;
    name: string;
    mimeType: string;
    size: number;
    modifiedAt?: number;
  }[];
  directories: {
    path: string;
    name: string;
    modifiedAt?: number;
  }[];
}

// ============================================================================
// Internal State
// ============================================================================
interface FileSystemState {
  nodes: Map<string, FSNode>;
  pathIndex: Map<string, string>;  // path -> id
  initialized: boolean;
}

let state: FileSystemState = {
  nodes: new Map(),
  pathIndex: new Map(),
  initialized: false,
};

// IndexedDB configuration
const DB_NAME = getNamespacedIndexedDbName('SimFileSystem');
const DB_VERSION = 2;
const STORE_FILES = 'files';
const STORE_METADATA = 'metadata';
const STORE_SYSTEM = 'system';

const SEED_MARKER_ID = '__fs_seed__';
// Bump this when the preset sdcard seed structure changes.
// This will trigger a one-time re-import from public/sdcard on next startup.
const SEED_SCHEMA_VERSION = 2 as const;


type SeedMarker = {
  id: typeof SEED_MARKER_ID;
  version: typeof SEED_SCHEMA_VERSION;
  status: 'in_progress' | 'complete';
  importedAt?: number;
  source?: 'public/sdcard' | 'config' | 'none' | 'legacy_migration';
  note?: string;
};


let db: IDBDatabase | null = null;
let dbClosed = false;

/**
 * Get a valid IDBDatabase handle, reopening the connection if needed.
 * Returns null only when IndexedDB is fundamentally unavailable.
 */
async function ensureDb(): Promise<IDBDatabase | null> {
  if (db && !dbClosed) return db;
  try {
    db = await openDatabase();
    dbClosed = false;
    return db;
  } catch {
    return null;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * 实时扫描 public/sdcard 目录
 * 通过 Vite 服务器的 /api/sdcard 端点获取
 */
async function scanSdcard(): Promise<ScanResult | null> {
  // 1. Try dev-server API (only available in `npm run dev`)
  try {
    const response = await fetch('/api/sdcard');
    if (response.ok) {
      const result = await response.json();
      console.log(`[FileSystem] Scanned ${result.totalFiles} files from /api/sdcard`);
      return result;
    }
  } catch {
    // API not available — likely production build
  }

  // 2. Fallback: static manifest emitted during `npm run build`
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sdcard/manifest.json`);
    if (response.ok) {
      const result = await response.json();
      console.log(`[FileSystem] Loaded ${result.totalFiles} files from static .manifest.json`);
      return result;
    }
  } catch {
    // Manifest not available either
  }

  console.log('[FileSystem] No scan API or manifest available');
  return null;
}

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
  if (initPromise) return initPromise;
  initPromise = initFileSystemInternal();
  return initPromise;
}

async function initFileSystemInternal(): Promise<void> {
  try {
    db = await openDatabase();
    dbClosed = false;
    await loadOrCreateState();
    state.initialized = true;
    exposeAgentAPI();
    console.log('[FileSystem] Initialized with', state.nodes.size, 'nodes');
  } catch (error) {
    console.error('[FileSystem] Initialization failed:', error);
    await createBaseStateInMemory();
    state.initialized = true;
    exposeAgentAPI();
  }
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
        dbClosed = true;
        db = null;
        console.warn('[FileSystem] DB connection closed due to versionchange');
      };

      database.onclose = () => {
        dbClosed = true;
        db = null;
        console.warn('[FileSystem] DB connection closed unexpectedly');
      };

      resolve(database);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_FILES)) {
        database.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      
      if (!database.objectStoreNames.contains(STORE_METADATA)) {
        const metaStore = database.createObjectStore(STORE_METADATA, { keyPath: 'id' });
        metaStore.createIndex('path', 'path', { unique: true });
        metaStore.createIndex('parentId', 'parentId');
      }

      if (!database.objectStoreNames.contains(STORE_SYSTEM)) {
        database.createObjectStore(STORE_SYSTEM, { keyPath: 'id' });
      }
    };
  });
}

async function loadOrCreateState(): Promise<void> {
  const conn = await ensureDb();
  if (!conn) {
    await createBaseStateInMemory();
    return;
  }
  
  try {
    await ensureSeedImportedIfNeeded();

    const savedNodes = await loadMetadataFromDB();
    if (savedNodes.length === 0) {
      await createBaseStateInMemory();
      await persistAllMetadata();
    } else {
      state.nodes = new Map(savedNodes.map(n => [n.id, n]));
      state.pathIndex = new Map(savedNodes.map(n => [n.path, n.id]));
    }

  } catch (error) {
    console.error('[FileSystem] Failed to load state:', error);
    await createBaseStateInMemory();
  }
}


async function createBaseStateInMemory(): Promise<void> {
  state.nodes = new Map();
  state.pathIndex = new Map();
  
  const now = TimeService.now();
  
  // Create root directory
  const root: FSNode = {
    id: 'root',
    name: '/',
    type: 'directory',
    parentId: null,
    path: '/',
    size: 0,
    createdAt: now,
    modifiedAt: now,
    storage: 'memory',
  };
  state.nodes.set(root.id, root);
  state.pathIndex.set(root.path, root.id);
  
  // Create preset directories
  for (const dir of FILE_SYSTEM_CONFIG.presetStructure) {
    ensureDirectorySync(dir.path);
  }
}

function ensureDirectorySync(path: string): FSNode | null {
  const normalPath = normalizePath(path);
  
  // Check if already exists
  const existingId = state.pathIndex.get(normalPath);
  if (existingId) {
    const existing = state.nodes.get(existingId) || null;
    return existing?.type === 'directory' ? existing : null;
  }
  
  // Recursively create parent first
  const parentPath = getParentPath(normalPath);
  if (parentPath !== normalPath && parentPath !== '') {
    ensureDirectorySync(parentPath);
  }
  
  // Create this directory
  const name = getFileName(normalPath);
  const parentId = state.pathIndex.get(parentPath) || 'root';
  const now = TimeService.now();
  
  const node: FSNode = {
    id: `dir_${TimeService.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: 'directory',
    parentId,
    path: normalPath,
    size: 0,
    createdAt: now,
    modifiedAt: now,
    storage: 'memory',
  };
  
  state.nodes.set(node.id, node);
  state.pathIndex.set(normalPath, node.id);
  
  return node;
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

// Blob URL 缓存 - 用于 IndexedDB 文件
const blobUrlCache = new Map<string, string>();

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
 * Get the URI for displaying a file (sync version)
 * For preset files, returns the public path
 * For IndexedDB files, returns cached blob URL or null
 */
export function getFileUri(path: string): string | null {
  const node = getNode(path);
  if (!node || node.type !== 'file') return null;
  
  // Legacy compatibility: old DB may still contain preset nodes.
  // In Vite dev/build, public/sdcard/* is served at /sdcard/* so node.path is fetchable.
  if (node.storage === 'preset') return presetAssetUrl(node.path);
  
  // For IndexedDB files, check cache
  if (blobUrlCache.has(node.id)) {
    return blobUrlCache.get(node.id)!;
  }
  
  // 返回 null，调用者应该使用 getFileUriAsync
  return null;
}

/**
 * Get the URI for displaying a file (async version)
 * Creates Blob URLs for IndexedDB files and caches them
 */
export async function getFileUriAsync(path: string): Promise<string | null> {
  const node = getNode(path);
  if (!node || node.type !== 'file') return null;
  
  if (node.storage === 'preset') return getFileUri(path);
  
  // For IndexedDB files
  if (blobUrlCache.has(node.id)) {
    return blobUrlCache.get(node.id)!;
  }
  
  // Load from IndexedDB and create Blob URL
  const blob = await loadFileFromDB(node.id);
  if (!blob) return null;
  
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(node.id, blobUrl);
  
  return blobUrl;
}

/**
 * Clear a blob URL from cache (call when file is deleted)
 */
function clearBlobUrlCache(nodeId: string): void {
  const url = blobUrlCache.get(nodeId);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlCache.delete(nodeId);
  }
}

/**
 * Read file content as Blob
 */
export async function readFile(path: string): Promise<Blob | null> {
  const node = getNode(path);
  if (!node || node.type !== 'file') return null;
  
  if (node.storage === 'preset') {
    try {
      const response = await fetch(presetAssetUrl(node.path));
      return await response.blob();
    } catch (error) {
      console.error('[FileSystem] Failed to fetch preset file:', error);
      return null;
    }
  }
  
  if (node.storage === 'indexeddb') {
    return loadFileFromDB(node.id);
  }
  
  return null;
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
// Public API - Write Operations
// ============================================================================

/**
 * Create a directory
 */
export async function createDirectory(path: string): Promise<FSNode> {
  const node = ensureDirectorySync(normalizePath(path));
  if (!node) {
    throw new Error(`[FileSystem] Cannot create directory: path exists and is not a directory: ${path}`);
  }
  await saveMetadataToDB(node);
  return node;
}

/**
 * Write a file
 */
export async function writeFile(
  path: string,
  content: Blob | ArrayBuffer | string,
  options?: { mimeType?: string; createdAt?: number; modifiedAt?: number }
): Promise<FSNode> {
  const normalPath = normalizePath(path);
  const parentPath = getParentPath(normalPath);
  const fileName = getFileName(normalPath);
  
  // Ensure parent directory exists
  await createDirectory(parentPath);
  
  // Convert to Blob
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: options?.mimeType || 'application/octet-stream' });
  
  const now = TimeService.now();
  const createdAt = Number.isFinite(options?.createdAt) ? Number(options?.createdAt) : now;
  const modifiedAt = Number.isFinite(options?.modifiedAt) ? Number(options?.modifiedAt) : now;
  
  // Check if file already exists
  let node = getNode(normalPath);
  
  if (node && node.type !== 'file') {
    throw new Error(`[FileSystem] Cannot write file: path exists and is a directory: ${normalPath}`);
  }

  if (node && node.type === 'file') {
    // Update existing file
    node.size = blob.size;
    node.modifiedAt = modifiedAt;
    if (Number.isFinite(options?.createdAt)) node.createdAt = createdAt;
    node.storage = 'indexeddb';
    if (options?.mimeType) node.mimeType = options.mimeType;
  } else {
    // Create new file
    const parentId = state.pathIndex.get(parentPath)!;
    node = {
      id: `file_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: fileName,
      type: 'file',
      parentId,
      path: normalPath,
      size: blob.size,
      mimeType: options?.mimeType || blob.type,
      createdAt,
      modifiedAt,
      storage: 'indexeddb',
    };
    state.nodes.set(node.id, node);
    state.pathIndex.set(normalPath, node.id);
  }
  
  // Save to IndexedDB
  await saveFileToDB(node.id, blob);
  await saveMetadataToDB(node);
  
  return node;
}

/**
 * Delete a file or directory
 */
export async function deleteNode(path: string): Promise<boolean> {
  const node = getNode(path);
  if (!node) return false;
  
  if (node.type === 'directory') {
    // Recursively delete children
    const children = listDirectory(path);
    for (const child of children) {
      await deleteNode(child.path);
    }
  } else if (node.storage === 'indexeddb') {
    await deleteFileFromDB(node.id);
  }
  // For legacy preset files: remove from metadata only; content is still in public assets
  
  // Clear blob URL cache if exists
  clearBlobUrlCache(node.id);
  
  state.nodes.delete(node.id);
  state.pathIndex.delete(node.path);
  await deleteMetadataFromDB(node.id);
  
  return true;
}

/**
 * Move/rename a file or directory
 */
export async function moveNode(srcPath: string, destPath: string): Promise<FSNode | null> {
  const normalSrc = normalizePath(srcPath);
  const normalDest = normalizePath(destPath);

  const node = getNode(normalSrc);
  if (!node) return null;

  if (normalSrc === normalDest) return node;
  if (exists(normalDest)) return null;

  const newParentPath = getParentPath(normalDest);
  const newName = getFileName(normalDest);
  
  // Ensure destination directory exists
  await createDirectory(newParentPath);

  const newParentId = state.pathIndex.get(newParentPath);
  if (!newParentId) return null;

  const now = TimeService.now();

  // Guard: prevent moving a directory into its own subtree
  if (node.type === 'directory') {
    const srcPrefix = normalSrc === '/' ? '/' : normalSrc + '/';
    if (normalDest.startsWith(srcPrefix)) return null;
  }

  if (node.type === 'file') {
    state.pathIndex.delete(node.path);
    node.path = normalDest;
    node.name = newName;
    node.parentId = newParentId;
    node.modifiedAt = now;
    state.pathIndex.set(normalDest, node.id);
    await saveMetadataToDB(node);
    return node;
  }

  // Directory move: update path prefix for all descendants
  const affected: FSNode[] = [];
  const prefix = normalSrc + '/';
  for (const n of state.nodes.values()) {
    if (n.path === normalSrc || n.path.startsWith(prefix)) affected.push(n);
  }

  // Remove old path index entries
  for (const n of affected) {
    state.pathIndex.delete(n.path);
  }

  // Update paths
  for (const n of affected) {
    if (n.id === node.id) {
      n.path = normalDest;
      n.name = newName;
      n.parentId = newParentId;
      n.modifiedAt = now;
    } else {
      const suffix = n.path.slice(normalSrc.length);
      n.path = normalDest + suffix;
      n.modifiedAt = now;
    }
    state.pathIndex.set(n.path, n.id);
  }

  await saveMetadataBatchToDB(affected);
  return node;
}

/**
 * Copy a file
 */
export async function copyFile(srcPath: string, destPath: string): Promise<FSNode | null> {
  const srcNode = getNode(srcPath);
  if (!srcNode || srcNode.type !== 'file') return null;
  
  const content = await readFile(srcPath);
  if (!content) return null;
  
  return writeFile(destPath, content, { mimeType: srcNode.mimeType });
}

// ============================================================================
// IndexedDB Operations
// ============================================================================

async function loadMetadataFromDB(): Promise<FSNode[]> {
  const conn = await ensureDb();
  if (!conn) return [];
  
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_METADATA, 'readonly');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveMetadataToDB(node: FSNode): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_METADATA, 'readwrite');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.put(node);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteMetadataFromDB(id: string): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_METADATA, 'readwrite');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveMetadataBatchToDB(nodes: FSNode[]): Promise<void> {
  if (nodes.length === 0) return;
  const conn = await ensureDb();
  if (!conn) return;

  const tx = conn.transaction(STORE_METADATA, 'readwrite');
  const store = tx.objectStore(STORE_METADATA);
  for (const node of nodes) store.put(node);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// System Store (seed marker)
// ============================================================================

async function loadSeedMarkerFromDB(): Promise<SeedMarker | null> {
  const conn = await ensureDb();
  if (!conn) return null;
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_SYSTEM, 'readonly');
    const store = tx.objectStore(STORE_SYSTEM);
    const request = store.get(SEED_MARKER_ID);
    request.onsuccess = () => resolve((request.result as SeedMarker) || null);
    request.onerror = () => reject(request.error);
  });
}

async function saveSeedMarkerToDB(marker: SeedMarker): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_SYSTEM, 'readwrite');
    const store = tx.objectStore(STORE_SYSTEM);
    const request = store.put(marker);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clearSeedMarkerFromDB(): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_SYSTEM, 'readwrite');
    const store = tx.objectStore(STORE_SYSTEM);
    const request = store.delete(SEED_MARKER_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function persistAllMetadata(): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  
  const tx = conn.transaction(STORE_METADATA, 'readwrite');
  const store = tx.objectStore(STORE_METADATA);
  
  for (const node of state.nodes.values()) {
    store.put(node);
  }
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function saveFileToDB(id: string, content: Blob): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    const request = store.put({ id, content });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadFileFromDB(id: string): Promise<Blob | null> {
  const conn = await ensureDb();
  if (!conn) return null;
  
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.content || null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteFileFromDB(id: string): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================================================
// Seed Import (public/sdcard -> IndexedDB)
// ============================================================================

function inferCreatedAtFromName(fileName: string, fallback: number): number {
  const dateMatch = fileName.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!dateMatch) return fallback;
  const ts = TimeService.parseToTimestamp(
    `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`,
  );
  return Number.isFinite(ts) ? ts : fallback;
}

function makeSeedFileId(path: string): string {
  // Stable across runs (within one DB lifecycle). OK that it changes after reset.
  return `seed_${normalizePath(path).replace(/\//g, '_')}`;
}

async function clearFilesAndMetadataStores(): Promise<void> {
  const conn = await ensureDb();
  if (!conn) return;
  const tx = conn.transaction([STORE_METADATA, STORE_FILES], 'readwrite');
  tx.objectStore(STORE_METADATA).clear();
  tx.objectStore(STORE_FILES).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function seedImportFromPublicSdcard(): Promise<void> {
  if (!(await ensureDb())) return;

  console.log('[FileSystem] Seed import: start');

  // Clean slate
  await clearFilesAndMetadataStores();
  blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
  blobUrlCache.clear();

  await saveSeedMarkerToDB({
    id: SEED_MARKER_ID,
    version: SEED_SCHEMA_VERSION,
    status: 'in_progress',
    importedAt: TimeService.now(),
    source: 'public/sdcard',
  });

  // Build base structure in memory first
  await createBaseStateInMemory();

  const scan = await scanSdcard();
  if (scan) {
    for (const dir of scan.directories) ensureDirectorySync(dir.path);

    // Build metadata + collect items for batched fetching
    const fetchItems: { id: string; uri: string; node: FSNode }[] = [];

    for (const file of scan.files) {
      const normalPath = normalizePath(file.path);
      const parentPath = getParentPath(normalPath);
      ensureDirectorySync(parentPath);

      const parentId = state.pathIndex.get(parentPath);
      if (!parentId) continue;

      const modifiedAt = file.modifiedAt || TimeService.now();
      const createdAt = inferCreatedAtFromName(file.name, modifiedAt);
      const id = makeSeedFileId(normalPath);

      const node: FSNode = {
        id,
        name: file.name,
        type: 'file',
        parentId,
        path: normalPath,
        size: file.size,
        mimeType: file.mimeType,
        createdAt,
        modifiedAt,
        storage: 'indexeddb',
      };

      state.nodes.set(node.id, node);
      state.pathIndex.set(node.path, node.id);

      fetchItems.push({ id, uri: file.uri || normalPath, node });
    }

    // Fetch in batches of 8 to avoid TCP connection storms under high concurrency
    const SEED_FETCH_BATCH = 8;
    const fetched: { id: string; blob: Blob }[] = [];
    for (let i = 0; i < fetchItems.length; i += SEED_FETCH_BATCH) {
      const batch = fetchItems.slice(i, i + SEED_FETCH_BATCH);
      const results = await Promise.all(batch.map(({ id, uri, node }) =>
        fetch(presetAssetUrl(uri)).then(async (resp) => {
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          node.size = blob.size;
          node.mimeType = node.mimeType || blob.type;
          return { id, blob } as { id: string; blob: Blob };
        }).catch((e) => {
          console.warn('[FileSystem] Seed import: failed to fetch file', uri, e);
          return null;
        }),
      ));
      for (const r of results) if (r) fetched.push(r);
    }

    if (fetched.length > 0) {
      const conn = await ensureDb();
      if (conn) {
        const tx = conn.transaction(STORE_FILES, 'readwrite');
        const store = tx.objectStore(STORE_FILES);
        for (const { id, blob } of fetched) {
          store.put({ id, content: blob });
        }
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    }
  } else if (FILE_SYSTEM_CONFIG.presetFiles.length > 0) {
    console.log('[FileSystem] Seed import: scan API unavailable, fallback to config presetFiles');
    for (const preset of FILE_SYSTEM_CONFIG.presetFiles) {
      await importPresetFileFromConfig(preset);
    }
  } else {
    console.warn('[FileSystem] Seed import: no scan API and no presetFiles; created empty /sdcard');
  }

  // Persist all metadata at once (directories + files + root)
  await persistAllMetadata();

  await saveSeedMarkerToDB({
    id: SEED_MARKER_ID,
    version: SEED_SCHEMA_VERSION,
    status: 'complete',
    importedAt: TimeService.now(),
    source: scan ? 'public/sdcard' : (FILE_SYSTEM_CONFIG.presetFiles.length > 0 ? 'config' : 'none'),
  });

  console.log('[FileSystem] Seed import: complete');
}

async function importPresetFileFromConfig(preset: PresetFile): Promise<void> {
  const normalPath = normalizePath(preset.path);
  const parentPath = getParentPath(normalPath);
  ensureDirectorySync(parentPath);
  const parentId = state.pathIndex.get(parentPath);
  if (!parentId) return;

  const fileName = getFileName(normalPath);
  const now = TimeService.now();
  const createdAt = inferCreatedAtFromName(fileName, now);
  const id = makeSeedFileId(normalPath);

  const node: FSNode = {
    id,
    name: fileName,
    type: 'file',
    parentId,
    path: normalPath,
    size: preset.size,
    mimeType: preset.mimeType,
    createdAt,
    modifiedAt: createdAt,
    storage: 'indexeddb',
    width: preset.width,
    height: preset.height,
    duration: preset.duration,
  };

  state.nodes.set(node.id, node);
  state.pathIndex.set(node.path, node.id);

  try {
    const resp = await fetch(presetAssetUrl(preset.uri));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    node.size = blob.size;
    node.mimeType = node.mimeType || blob.type;
    await saveFileToDB(node.id, blob);
  } catch (e) {
    console.warn('[FileSystem] Seed import (config): failed to fetch preset', preset.path, e);
  }
}

async function migrateLegacyPresetNodesToIndexedDB(nodes: FSNode[]): Promise<void> {
  if (!(await ensureDb())) return;

  console.log('[FileSystem] Legacy migration: converting preset nodes to indexeddb');

  // Restore to memory to reuse helpers and keep pathIndex consistent
  state.nodes = new Map(nodes.map((n) => [n.id, n]));
  state.pathIndex = new Map(nodes.map((n) => [n.path, n.id]));

  for (const node of state.nodes.values()) {
    if (node.type !== 'file') continue;
    if (node.storage !== 'preset') continue;

    try {
      const resp = await fetch(node.path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      await saveFileToDB(node.id, blob);
      node.storage = 'indexeddb';
      node.size = blob.size;
      node.mimeType = node.mimeType || blob.type;
    } catch (e) {
      console.warn('[FileSystem] Legacy migration: failed to migrate', node.path, e);
    }
  }

  await persistAllMetadata();
}

async function ensureSeedImportedIfNeeded(): Promise<void> {
  if (!(await ensureDb())) return;

  const marker = await loadSeedMarkerFromDB();
  if (marker?.status === 'complete') {
    if (marker.version !== SEED_SCHEMA_VERSION) {
      console.warn('[FileSystem] Seed schema changed, re-importing');
      await seedImportFromPublicSdcard();
    }
    return;
  }

  // If import was interrupted, restart from scratch
  if (marker?.status === 'in_progress') {
    console.warn('[FileSystem] Seed marker in_progress, re-importing');
    await seedImportFromPublicSdcard();
    return;
  }

  // Backward compatibility: older DB might exist without marker
  const existingNodes = await loadMetadataFromDB();
  if (existingNodes.length > 0) {
    const hasPreset = existingNodes.some((n) => n.type === 'file' && n.storage === 'preset');
    await saveSeedMarkerToDB({
      id: SEED_MARKER_ID,
      version: SEED_SCHEMA_VERSION,
      status: 'in_progress',
      importedAt: TimeService.now(),
      source: 'legacy_migration',
      note: hasPreset ? 'migrating preset nodes' : 'marker added to existing db',
    });

    if (hasPreset) {
      await migrateLegacyPresetNodesToIndexedDB(existingNodes);
    }

    await saveSeedMarkerToDB({
      id: SEED_MARKER_ID,
      version: SEED_SCHEMA_VERSION,
      status: 'complete',
      importedAt: TimeService.now(),
      source: 'legacy_migration',
    });
    return;
  }

  // Fresh DB
  await seedImportFromPublicSdcard();
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizePath(path: string): string {
  // Remove trailing slashes and normalize multiple slashes
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
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
      const { thumbnailUri, ...meta } = node;
      return meta;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  return { nodes };
}

function clearRuntimeState(): void {
  state.nodes.clear();
  state.pathIndex.clear();
  state.initialized = false;
  initPromise = null;
  blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
  blobUrlCache.clear();
}

/**
 * Clear all data from IndexedDB stores without deleting the database.
 * Uses the existing connection — avoids 'deleteDatabase blocked' when
 * transactions (e.g. seed import) are still in-flight.
 * After clearing, the next initFileSystem() will re-seed from scratch.
 */
export async function clearFileSystemDB(): Promise<void> {
  clearRuntimeState();

  const conn = await ensureDb();
  if (!conn) return;

  const storeNames = [STORE_FILES, STORE_METADATA, STORE_SYSTEM].filter(
    name => conn.objectStoreNames.contains(name),
  );
  if (storeNames.length === 0) return;

  const tx = conn.transaction(storeNames, 'readwrite');
  for (const name of storeNames) {
    tx.objectStore(name).clear();
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function destroyFileSystemDB(): Promise<void> {
  if (db && !dbClosed) {
    db.close();
    dbClosed = true;
  }
  db = null;

  clearRuntimeState();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('deleteDatabase failed'));
    request.onblocked = () => reject(new Error('deleteDatabase blocked'));
  });
}

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
 * 重置文件系统（清除 IndexedDB 并重新创建）
 * 用于开发调试
 */
export async function resetFileSystem(): Promise<void> {
  console.log('[FileSystem] Resetting...');
  
  const conn = await ensureDb();
  if (!conn) {
    console.error('[FileSystem] Reset failed to open DB');
    await createBaseStateInMemory();
    return;
  }

  await clearSeedMarkerFromDB();
  await seedImportFromPublicSdcard();

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
