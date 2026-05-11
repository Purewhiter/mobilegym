import ContentProvider from './ContentProvider';
import type { ContentUri, ContentValues, Cursor } from './types/content';
import BroadcastBus, { ACTION_PROVIDER_CHANGED } from './BroadcastBus';
import PackageManagerService from './PackageManagerService';

type ContentObserver = (uri: ContentUri) => void;

type ParsedContentUri = {
  uri: ContentUri;
  authority: string;
  path: string;
  query: URLSearchParams;
};

const providers = new Map<string, ContentProvider>();

function parseUri(uri: ContentUri): ParsedContentUri {
  const raw = String(uri ?? '').trim();
  if (!raw) throw new Error('[ContentResolver] URI is required');
  if (!raw.startsWith('content:')) {
    const scheme = raw.match(/^([^:]+):/)?.[1] ?? '';
    throw new Error(`[ContentResolver] Unsupported scheme: ${scheme ? `${scheme}:` : '(none)'}; uri=${JSON.stringify(raw)}`);
  }

  const match = raw.match(/^content:\/\/([^/?#]+)([^?#]*)?(?:\?([^#]*))?(?:#.*)?$/);
  const authority = String(match?.[1] ?? '').trim();
  if (!authority) throw new Error(`[ContentResolver] Missing authority; uri=${JSON.stringify(raw)}`);
  const path = match?.[2] || '/';
  return { uri: raw, authority, path, query: new URLSearchParams(match?.[3] ?? '') };
}

function getProviderOrThrow(uri: ContentUri): { provider: ContentProvider; parsed: ParsedContentUri } {
  const parsed = parseUri(uri);
  const provider = providers.get(parsed.authority);
  if (!provider) {
    throw new Error(`[ContentResolver] No provider registered for authority="${parsed.authority}"`);
  }
  return { provider, parsed };
}

function getActiveCallerPermissions(): string[] | null {
  try {
    const os = window.__OS__;
    const state = typeof os?.getState === 'function' ? os.getState() : os?.state;
    const appId = String(state?.activeAppId ?? '').trim();
    if (!appId) return null;
    const manifest = PackageManagerService.getPackageInfo(appId);
    return manifest?.permissions ?? [];
  } catch {
    return null;
  }
}

function warnPermissionIfNeeded(provider: ContentProvider, required: string | undefined, op: string, uri: ContentUri): void {
  if (!required) return;
  const granted = getActiveCallerPermissions();
  if (!granted) return;
  if (granted.includes(required)) return;
  console.warn(
    `[ContentResolver] permission warn-only: missing "${required}" for ${op} ${uri}`,
  );
}

export const ContentResolver = {
  parseUri,

  registerProvider(authority: string, provider: ContentProvider): void {
    const key = String(authority ?? '').trim();
    if (!key) throw new Error('[ContentResolver] authority is required');
    if (!provider) throw new Error('[ContentResolver] provider is required');
    providers.set(key, provider);
  },

  query<T = any>(uri: ContentUri, projection?: string[]): Cursor<T> {
    const { provider } = getProviderOrThrow(uri);
    warnPermissionIfNeeded(provider, provider.readPermission, 'query', uri);
    return provider.query(uri, projection) as Cursor<T>;
  },

  insert(uri: ContentUri, values: ContentValues): ContentUri {
    const { provider } = getProviderOrThrow(uri);
    warnPermissionIfNeeded(provider, provider.writePermission, 'insert', uri);
    const result = provider.insert(uri, values);
    ContentResolver.notifyChange(result || uri);
    return result;
  },

  update(uri: ContentUri, values: ContentValues, where?: string): number {
    const { provider } = getProviderOrThrow(uri);
    warnPermissionIfNeeded(provider, provider.writePermission, 'update', uri);
    const changed = provider.update(uri, values, where);
    if (changed > 0) ContentResolver.notifyChange(uri);
    return changed;
  },

  delete(uri: ContentUri, where?: string): number {
    const { provider } = getProviderOrThrow(uri);
    warnPermissionIfNeeded(provider, provider.writePermission, 'delete', uri);
    const changed = provider.delete(uri, where);
    if (changed > 0) ContentResolver.notifyChange(uri);
    return changed;
  },

  notifyChange(uri: ContentUri): void {
    const parsed = parseUri(uri);
    BroadcastBus.sendBroadcast({
      action: ACTION_PROVIDER_CHANGED,
      data: { uri: parsed.uri },
      extras: { uri: parsed.uri },
    });
  },

  registerContentObserver(uri: ContentUri, cb: ContentObserver): () => void {
    const target = parseUri(uri);
    return BroadcastBus.registerReceiver(ACTION_PROVIDER_CHANGED, (intent) => {
      const changedUri = String(intent?.extras?.uri ?? intent?.data?.uri ?? '').trim();
      if (!changedUri) return;
      let parsed: ParsedContentUri;
      try {
        parsed = parseUri(changedUri);
      } catch {
        return;
      }
      if (parsed.authority !== target.authority) return;
      if (!parsed.path.startsWith(target.path)) return;
      cb(changedUri);
    });
  },
};

// Auto-load optional app-owned provider registration modules.
import.meta.glob(['../apps/*/providers/*.ts', '../system/*/providers/*.ts'], { eager: true });

export default ContentResolver;
