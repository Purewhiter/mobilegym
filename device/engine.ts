/**
 * Device server engine — app-agnostic core.
 *
 * One server process holds every session. A session is one simulated phone:
 * per app it keeps an opaque app state (whatever the app module stores) plus a
 * record overlay layered on top of that app's read-only catalog. Catalogs are
 * loaded once per process and shared by all sessions, so a 4k-note dataset is
 * parsed once instead of once per browser page.
 *
 * Reads of a record resolve `overlay ?? catalog`; an overlay entry of `null` is
 * a tombstone. Commands are the only writers. They run synchronously against
 * one session, so no locking is needed inside a process.
 */

export type DeviceRecord = { id: string; [key: string]: unknown };

export interface CatalogCollection {
  /** Canonical order of catalog ids (e.g. feed order). */
  order: string[];
  byId: Map<string, DeviceRecord>;
}

export interface Catalog {
  collections: Map<string, CatalogCollection>;
  /** App-specific derived indexes built at load time (e.g. reverse lookups). */
  extras: Record<string, unknown>;
}

export interface AppContext<S> {
  readonly appId: string;
  readonly catalog: Catalog;
  readonly session: Session;
  state: S;
  /** Merged record: overlay first, then catalog; `undefined` when absent or tombstoned. */
  get(collection: string, id: string): DeviceRecord | undefined;
  put(collection: string, record: DeviceRecord): void;
  /** Tombstone a catalog record. */
  hide(collection: string, id: string): void;
  /** Drop any overlay entry so the catalog value shows through again. */
  revert(collection: string, id: string): void;
  overlayEntries(collection: string): IterableIterator<[string, DeviceRecord | null]>;
  clearOverlay(collection: string): void;
}

export interface CommandInput {
  /** Simulated wall clock of the calling device (TimeService.now()). */
  now: number;
}

export interface AppModule<S> {
  appId: string;
  loadCatalog(root: string): Catalog;
  /** Called after any state change so derived overlay records stay current. */
  materialize(ctx: AppContext<S>): void;
  /** Snapshot exposed through `__SIM__.getState().apps[appId]`. */
  exportState(ctx: AppContext<S>): unknown;
  /** Replace the app state from an external snapshot (task setup, client bootstrap). */
  importState(raw: unknown, catalog: Catalog): S;
  commands: Record<string, (ctx: AppContext<S>, args: unknown[], input: CommandInput) => unknown>;
  queries: Record<string, (ctx: AppContext<S>, args: Record<string, unknown>) => unknown>;
}

type Overlay = Map<string, Map<string, DeviceRecord | null>>;

interface AppSlot {
  state: unknown;
  overlay: Overlay;
}

export interface SessionBlob {
  data: Uint8Array;
  type: string;
  /** Set once some record referenced it; after that, losing all references frees it. */
  referenced: boolean;
}

/** Sessions idle this long are dropped (the page opens a new one on its next request). */
const SESSION_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSIONS = 2000;
/** Bytes of uploaded file content one session may hold. */
export const MAX_SESSION_BLOB_BYTES = 512 * 1024 * 1024;

export class Session {
  readonly id: string;
  version = 0;
  lastUsedAt = Date.now();
  readonly apps = new Map<string, AppSlot>();
  /** File contents written in this session (uploaded once, referenced by id). */
  readonly blobs = new Map<string, SessionBlob>();
  private nextBlobSeq = 1;

  constructor(id: string) {
    this.id = id;
  }

  putBlob(data: Uint8Array, type: string): string {
    if (this.blobBytes() + data.length > MAX_SESSION_BLOB_BYTES) {
      throw new DeviceError(413, `session ${this.id} exceeds ${MAX_SESSION_BLOB_BYTES} bytes of file content`);
    }
    const id = `b${(this.nextBlobSeq++).toString(36)}`;
    this.blobs.set(id, { data, type, referenced: false });
    return id;
  }

  blobBytes(): number {
    let total = 0;
    for (const blob of this.blobs.values()) total += blob.data.length;
    return total;
  }

  /**
   * Free blobs that were referenced before but no longer are. Blobs never
   * referenced yet are kept: an upload precedes the command that uses it.
   */
  collectBlobs(live: Set<string>): void {
    for (const [id, blob] of this.blobs) {
      if (live.has(id)) blob.referenced = true;
      else if (blob.referenced) this.blobs.delete(id);
    }
  }
}

export class DeviceServer {
  private readonly modules = new Map<string, AppModule<unknown>>();
  private readonly catalogs = new Map<string, Catalog>();
  private readonly sessions = new Map<string, Session>();
  private nextSessionSeq = 1;

  /**
   * `shard`: set when several server processes share one host. Session ids
   * then start with `s<shard>-`, so a proxy can route every request of a
   * session to the process that holds it (see scripts/server/start_nginx_gateway.sh).
   */
  constructor(
    private readonly root: string,
    private readonly shard?: number,
  ) {}

  register<S>(module: AppModule<S>): void {
    this.modules.set(module.appId, module as AppModule<unknown>);
  }

  appIds(): string[] {
    return [...this.modules.keys()];
  }

  createSession(): Session {
    this.evictSessions();
    const prefix = this.shard === undefined ? 's' : `s${this.shard}-`;
    const id = `${prefix}${Date.now().toString(36)}${(this.nextSessionSeq++).toString(36)}`;
    const session = new Session(id);
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) session.lastUsedAt = Date.now();
    return session;
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  /** Drop idle sessions, then the least recently used ones beyond the cap. */
  private evictSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastUsedAt > SESSION_IDLE_TTL_MS) this.sessions.delete(id);
    }
    if (this.sessions.size < MAX_SESSIONS) return;
    const byAge = [...this.sessions.values()].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    for (const session of byAge.slice(0, this.sessions.size - MAX_SESSIONS + 1)) this.sessions.delete(session.id);
  }

  /** Load every registered app's catalog now instead of on first use. */
  warmCatalogs(): void {
    for (const module of this.modules.values()) this.catalog(module);
  }

  /** Whether `appId` has received state in this session yet. */
  isInitialized(session: Session, appId: string): boolean {
    return session.apps.has(appId);
  }

  importState(session: Session, appId: string, raw: unknown): unknown {
    const module = this.module(appId);
    const slot: AppSlot = { state: module.importState(raw, this.catalog(module)), overlay: new Map() };
    session.apps.set(appId, slot);
    const ctx = this.context(session, module, slot);
    module.materialize(ctx);
    session.version += 1;
    return module.exportState(ctx);
  }

  exportState(session: Session, appId: string): unknown {
    const module = this.module(appId);
    const slot = this.slot(session, appId);
    return module.exportState(this.context(session, module, slot));
  }

  runCommand(session: Session, appId: string, name: string, args: unknown[], input: CommandInput) {
    const module = this.module(appId);
    const command = module.commands[name];
    if (!command) throw new DeviceError(404, `unknown command ${appId}.${name}`);
    const slot = this.slot(session, appId);
    const ctx = this.context(session, module, slot);
    const result = command(ctx, args, input);
    slot.state = ctx.state;
    module.materialize(ctx);
    session.version += 1;
    return { result, state: module.exportState(ctx), version: session.version };
  }

  runQuery(session: Session, appId: string, name: string, args: Record<string, unknown>) {
    const module = this.module(appId);
    const query = module.queries[name];
    if (!query) throw new DeviceError(404, `unknown query ${appId}.${name}`);
    const slot = this.slot(session, appId);
    return query(this.context(session, module, slot), args);
  }

  getRecord(session: Session, appId: string, collection: string, id: string): DeviceRecord | undefined {
    const module = this.module(appId);
    return this.context(session, module, this.slot(session, appId)).get(collection, id);
  }

  /** Overlay entries only: what this session changed relative to the catalog. */
  overlay(session: Session, appId: string, collection: string): Record<string, DeviceRecord | null> {
    const slot = this.slot(session, appId);
    return Object.fromEntries(slot.overlay.get(collection) ?? new Map());
  }

  private module(appId: string): AppModule<unknown> {
    const module = this.modules.get(appId);
    if (!module) throw new DeviceError(404, `unknown app ${appId}`);
    return module;
  }

  private slot(session: Session, appId: string): AppSlot {
    const slot = session.apps.get(appId);
    if (!slot) throw new DeviceError(409, `app ${appId} not initialized in session ${session.id}`);
    return slot;
  }

  private catalog(module: AppModule<unknown>): Catalog {
    let catalog = this.catalogs.get(module.appId);
    if (!catalog) {
      catalog = module.loadCatalog(this.root);
      this.catalogs.set(module.appId, catalog);
    }
    return catalog;
  }

  private context(session: Session, module: AppModule<unknown>, slot: AppSlot): AppContext<unknown> {
    const catalog = this.catalog(module);
    const layer = (collection: string) => {
      let map = slot.overlay.get(collection);
      if (!map) {
        map = new Map();
        slot.overlay.set(collection, map);
      }
      return map;
    };
    return {
      appId: module.appId,
      catalog,
      session,
      state: slot.state,
      get(collection, id) {
        const entry = slot.overlay.get(collection)?.get(id);
        if (entry === null) return undefined;
        if (entry !== undefined) return entry;
        return catalog.collections.get(collection)?.byId.get(id);
      },
      put(collection, record) {
        layer(collection).set(record.id, record);
      },
      hide(collection, id) {
        layer(collection).set(id, null);
      },
      revert(collection, id) {
        slot.overlay.get(collection)?.delete(id);
      },
      overlayEntries(collection) {
        return layer(collection).entries();
      },
      clearOverlay(collection) {
        slot.overlay.get(collection)?.clear();
      },
    };
  }
}

export class DeviceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
