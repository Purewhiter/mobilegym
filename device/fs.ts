/**
 * Phone file system on the device server (OS-level module `fs`).
 *
 * The preset public/sdcard tree is scanned once per server and shared by every
 * session: a seed file's content is never copied, its node just points at the
 * static `/sdcard/...` URL. Files written during a session are uploaded once
 * as session blobs and referenced by id, so copy/move never move bytes.
 *
 * The page keeps a mirror of `nodes` for its synchronous read API
 * (os/FileSystemService.ts); every write is a command here.
 */

import path from 'node:path';

import { FILE_SYSTEM_CONFIG } from '../os/data/fileSystemConfig';
import type { FSNode } from '../os/types';
import { DeviceError, type AppContext, type AppModule, type Catalog } from './engine';
import { scanSdcard, type SdcardScan } from './sdcard';

/** Where a file's bytes live: a static seed URL or a session blob. */
export type FsContentRef = { seed: string } | { blob: string };

export type FsNode = FSNode & { content?: FsContentRef };

export interface FsState {
  nodes: Record<string, FsNode>;
  /** The page's IANA time zone; seed dates in file names are local to it. */
  timeZone: string;
}

type Ctx = AppContext<FsState>;

// ── Paths ───────────────────────────────────────────────────────────

const normalizePath = (p: string) => p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

function parentPath(p: string): string {
  const parts = p.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/');
}

const fileName = (p: string) => p.split('/').filter(Boolean).pop() || '';

const randomSuffix = () => Math.random().toString(36).slice(2, 8);

// ── Seed dates ──────────────────────────────────────────────────────

// Building an Intl.DateTimeFormat is slow; one per zone is enough.
const zoneFormats = new Map<string, Intl.DateTimeFormat>();

function zoneFormat(timeZone: string): Intl.DateTimeFormat {
  let format = zoneFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    zoneFormats.set(timeZone, format);
  }
  return format;
}

/** UTC ms for a wall-clock time in `timeZone` (same result as `new Date(iso)` in a page using that zone). */
function zonedTimeToUtc(parts: number[], timeZone: string): number {
  const [y, mo, d, h, mi, s] = parts;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const format = zoneFormat(timeZone);
  const offsetAt = (t: number) => {
    const get = (type: string) => Number(format.formatToParts(t).find(p => p.type === type)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t;
  };
  const first = wall - offsetAt(wall);
  return wall - offsetAt(first);
}

/** `IMG_20260320_101500.jpg` → that local time; otherwise `fallback`. */
function inferCreatedAtFromName(name: string, fallback: number, timeZone: string): number {
  const match = name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!match) return fallback;
  const ts = zonedTimeToUtc(match.slice(1, 7).map(Number), timeZone);
  return Number.isFinite(ts) ? ts : fallback;
}

// ── Tree helpers ────────────────────────────────────────────────────

/** Mutable working copy of the tree for one command. */
class Tree {
  readonly nodes: Map<string, FsNode>;
  readonly byPath: Map<string, string>;

  constructor(nodes: Record<string, FsNode>) {
    this.nodes = new Map(Object.entries(nodes).map(([id, n]) => [id, { ...n }]));
    this.byPath = new Map([...this.nodes.values()].map(n => [n.path, n.id]));
  }

  get(p: string): FsNode | undefined {
    const id = this.byPath.get(normalizePath(p));
    return id ? this.nodes.get(id) : undefined;
  }

  add(node: FsNode): FsNode {
    this.nodes.set(node.id, node);
    this.byPath.set(node.path, node.id);
    return node;
  }

  remove(node: FsNode): void {
    this.nodes.delete(node.id);
    this.byPath.delete(node.path);
  }

  children(dir: FsNode): FsNode[] {
    return [...this.nodes.values()].filter(n => n.parentId === dir.id);
  }

  ensureDirectory(p: string, now: number): FsNode | null {
    const dirPath = normalizePath(p);
    const existing = this.get(dirPath);
    if (existing) return existing.type === 'directory' ? existing : null;
    const parent = parentPath(dirPath);
    if (parent !== dirPath && parent !== '') this.ensureDirectory(parent, now);
    return this.add({
      id: `dir_${now}_${randomSuffix()}`,
      name: fileName(dirPath),
      type: 'directory',
      parentId: this.byPath.get(parent) || 'root',
      path: dirPath,
      size: 0,
      createdAt: now,
      modifiedAt: now,
      storage: 'memory',
    });
  }

  toRecord(): Record<string, FsNode> {
    return Object.fromEntries(this.nodes);
  }
}

function seedState(scan: SdcardScan, now: number, timeZone: string): FsState {
  const tree = new Tree({});
  tree.add({
    id: 'root', name: '/', type: 'directory', parentId: null, path: '/',
    size: 0, createdAt: now, modifiedAt: now, storage: 'memory',
  });
  for (const dir of FILE_SYSTEM_CONFIG.presetStructure) tree.ensureDirectory(dir.path, now);
  for (const dir of scan.directories) tree.ensureDirectory(dir.path, now);
  for (const file of scan.files) {
    const filePath = normalizePath(file.path);
    const parent = tree.ensureDirectory(parentPath(filePath), now);
    if (!parent) continue;
    const modifiedAt = file.modifiedAt || now;
    tree.add({
      id: `seed_${filePath.replace(/\//g, '_')}`,
      name: file.name,
      type: 'file',
      parentId: parent.id,
      path: filePath,
      size: file.size,
      mimeType: file.mimeType,
      createdAt: inferCreatedAtFromName(file.name, modifiedAt, timeZone),
      modifiedAt,
      storage: 'device',
      content: { seed: file.uri || filePath },
    });
  }
  return { nodes: tree.toRecord(), timeZone };
}

// ── Commands ────────────────────────────────────────────────────────

interface WriteInput {
  /** Session blob id from `PUT /blobs`; omitted for an empty file. */
  blob?: string;
  size?: number;
  /** Set or replace the MIME type. */
  mimeType?: string;
  /** MIME type for a new file when `mimeType` is absent (the blob's own type). */
  defaultMimeType?: string;
  createdAt?: number;
  modifiedAt?: number;
}

const EDITABLE_METADATA = ['createdAt', 'modifiedAt', 'mimeType', 'thumbnailUri', 'width', 'height', 'duration'] as const;

function writeNode(tree: Tree, p: string, content: FsContentRef | undefined, input: WriteInput, now: number): FsNode {
  const filePath = normalizePath(p);
  const parent = tree.ensureDirectory(parentPath(filePath), now);
  if (!parent) throw new DeviceError(400, `cannot create directory for ${filePath}`);
  const createdAt = Number.isFinite(input.createdAt) ? Number(input.createdAt) : now;
  const modifiedAt = Number.isFinite(input.modifiedAt) ? Number(input.modifiedAt) : now;
  const size = Number(input.size ?? 0);

  const existing = tree.get(filePath);
  if (existing && existing.type !== 'file') {
    throw new DeviceError(400, `[FileSystem] Cannot write file: path exists and is a directory: ${filePath}`);
  }
  if (existing) {
    existing.size = size;
    existing.modifiedAt = modifiedAt;
    if (Number.isFinite(input.createdAt)) existing.createdAt = createdAt;
    existing.storage = 'device';
    if (input.mimeType) existing.mimeType = input.mimeType;
    existing.content = content;
    return existing;
  }
  return tree.add({
    id: `file_${now}_${randomSuffix()}`,
    name: fileName(filePath),
    type: 'file',
    parentId: parent.id,
    path: filePath,
    size,
    mimeType: input.mimeType || input.defaultMimeType || '',
    createdAt,
    modifiedAt,
    storage: 'device',
    content,
  });
}

function deleteRecursive(tree: Tree, node: FsNode): void {
  if (node.type === 'directory') for (const child of tree.children(node)) deleteRecursive(tree, child);
  tree.remove(node);
}

/** Free session blobs that no file references any more. */
function collectBlobs(ctx: Ctx): void {
  const live = new Set<string>();
  for (const node of Object.values(ctx.state.nodes)) {
    if (node.content && 'blob' in node.content) live.add(node.content.blob);
  }
  ctx.session.collectBlobs(live);
}

/** Apply `fn` to a working copy of the tree; commit only if it returns. */
function edit<T>(ctx: Ctx, fn: (tree: Tree) => T): T {
  const tree = new Tree(ctx.state.nodes);
  const result = fn(tree);
  ctx.state = { ...ctx.state, nodes: tree.toRecord() };
  collectBlobs(ctx);
  return result;
}

const commands: AppModule<FsState>['commands'] = {
  mkdir(ctx, [p], { now }) {
    return edit(ctx, (tree) => {
      const node = tree.ensureDirectory(String(p), now);
      if (!node) throw new DeviceError(400, `[FileSystem] Cannot create directory: path exists and is not a directory: ${p}`);
      return node;
    });
  },
  write(ctx, [p, input], { now }) {
    const w = (input ?? {}) as WriteInput;
    if (w.blob && !ctx.session.blobs.has(w.blob)) throw new DeviceError(400, `unknown blob ${w.blob}`);
    return edit(ctx, tree => writeNode(tree, String(p), w.blob ? { blob: w.blob } : undefined, w, now));
  },
  setMetadata(ctx, [p, patch]) {
    return edit(ctx, (tree) => {
      const node = tree.get(String(p));
      if (!node || node.type !== 'file') return null;
      for (const key of EDITABLE_METADATA) {
        const value = (patch as Record<string, unknown> | undefined)?.[key];
        if (value !== undefined) (node as unknown as Record<string, unknown>)[key] = value;
      }
      return node;
    });
  },
  delete(ctx, [p]) {
    return edit(ctx, (tree) => {
      const node = tree.get(String(p));
      if (!node) return false;
      deleteRecursive(tree, node);
      return true;
    });
  },
  move(ctx, [src, dest], { now }) {
    return edit(ctx, (tree) => {
      const from = normalizePath(String(src));
      const to = normalizePath(String(dest));
      const node = tree.get(from);
      if (!node) return null;
      if (from === to) return node;
      if (tree.get(to)) return null;
      // A directory cannot move into its own subtree.
      if (node.type === 'directory' && to.startsWith(from === '/' ? '/' : from + '/')) return null;
      const newParent = tree.ensureDirectory(parentPath(to), now);
      if (!newParent) return null;

      const affected = node.type === 'file'
        ? [node]
        : [...tree.nodes.values()].filter(n => n.path === from || n.path.startsWith(from + '/'));
      for (const n of affected) tree.byPath.delete(n.path);
      for (const n of affected) {
        if (n.id === node.id) {
          n.path = to;
          n.name = fileName(to);
          n.parentId = newParent.id;
        } else {
          n.path = to + n.path.slice(from.length);
        }
        n.modifiedAt = now;
        tree.byPath.set(n.path, n.id);
      }
      return node;
    });
  },
  copy(ctx, [src, dest], { now }) {
    return edit(ctx, (tree) => {
      const source = tree.get(String(src));
      if (!source || source.type !== 'file') return null;
      return writeNode(tree, String(dest), source.content, { size: source.size, mimeType: source.mimeType }, now);
    });
  },
  /** Back to the preset sdcard tree (`__SIM_FS__.reset()`). */
  reset(ctx, _args, { now }) {
    ctx.state = seedState(ctx.catalog.extras.scan as SdcardScan, now, ctx.state.timeZone);
    collectBlobs(ctx);
  },
};

export function createFsModule(): AppModule<FsState> {
  return {
    appId: 'fs',
    loadCatalog(root: string): Catalog {
      return { collections: new Map(), extras: { scan: scanSdcard(path.join(root, 'public', 'sdcard')) } };
    },
    materialize() {},
    exportState: ctx => ({ nodes: Object.values(ctx.state.nodes) }),
    /** `{ now, timeZone }` from the page seeds the preset tree. */
    importState(raw, catalog) {
      const { now, timeZone } = (raw ?? {}) as { now?: number; timeZone?: string };
      if (typeof now !== 'number') throw new DeviceError(400, 'fs state needs { now, timeZone }');
      return seedState(catalog.extras.scan as SdcardScan, now, timeZone || 'UTC');
    },
    commands,
    queries: {},
  };
}
