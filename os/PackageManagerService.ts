import type { AppId } from './types';
import type { AppIntentFilter, AppManifest } from './types/manifest';
import { patchAppNames } from './i18n/en';
import BroadcastBus, { ACTION_PACKAGE_ADDED, ACTION_PACKAGE_REMOVED } from './BroadcastBus';

type IntentQuery = { action: string; scheme?: string; type?: string };

const manifestModules = import.meta.glob<{ manifest: AppManifest }>(
  ['../apps/*/manifest.ts', '../system/*/manifest.ts'],
  { eager: true },
);

let manifests: AppManifest[] = [];
let manifestMap = new Map<AppId, AppManifest>();
let packageNameMap = new Map<string, AppId>();
let aliasMap = new Map<string, AppId>();
let dirToAppIdMap = new Map<string, AppId>();

function normalizeKey(v: string): string {
  return String(v ?? '').trim().toLowerCase();
}

function matchType(filterType: string | undefined, intentType: string | undefined): boolean {
  if (!filterType) return true;
  if (!intentType) return false;
  if (filterType.endsWith('/*')) return intentType.startsWith(filterType.slice(0, -1));
  return filterType === intentType;
}

function matchScheme(filterScheme: string | undefined, intentScheme: string | undefined): boolean {
  if (!filterScheme) return true;
  return filterScheme === intentScheme;
}

function rebuildMaps(): void {
  manifestMap = new Map<AppId, AppManifest>();
  packageNameMap = new Map<string, AppId>();
  aliasMap = new Map<string, AppId>();
  const appEnNames: Record<string, string> = {};

  for (const manifest of manifests) {
    manifestMap.set(manifest.id, manifest);
    if (manifest.packageName) packageNameMap.set(manifest.packageName, manifest.id);
    if (manifest.displayNameEn) appEnNames[manifest.displayName] = manifest.displayNameEn;
    const aliases = new Set<string>([
      manifest.id,
      manifest.displayName,
      manifest.displayNameEn ?? '',
      ...(manifest.aliases ?? []),
    ]);
    for (const alias of aliases) {
      const key = normalizeKey(alias);
      if (!key || aliasMap.has(key)) continue;
      aliasMap.set(key, manifest.id);
    }
  }

  patchAppNames(appEnNames);
}

function buildInitialState(): void {
  const nextManifests: AppManifest[] = [];
  const nextDirMap = new Map<string, AppId>();
  for (const [path, mod] of Object.entries(manifestModules)) {
    const manifest = mod?.manifest;
    if (!manifest || !manifest.id) continue;
    nextManifests.push(manifest);
    const m = path.match(/\/(apps|system)\/([^/]+)\/manifest\.ts$/);
    if (m) nextDirMap.set(m[2], manifest.id);
  }
  manifests = nextManifests;
  dirToAppIdMap = nextDirMap;
  rebuildMaps();
}

buildInitialState();

export const PackageManagerService = {
  getInstalledPackages(): readonly AppManifest[] {
    return manifests;
  },

  getPackageInfo(appId: AppId | string): AppManifest | undefined {
    return manifestMap.get(String(appId) as AppId);
  },

  isInstalled(appId: AppId | string): boolean {
    return manifestMap.has(String(appId) as AppId);
  },

  resolvePackageName(packageName: string): AppId | undefined {
    return packageNameMap.get(String(packageName ?? '').trim());
  },

  queryByAlias(name: string): AppId | undefined {
    return aliasMap.get(normalizeKey(name));
  },

  queryIntentActivities(intent: IntentQuery): { appId: AppId; filter: AppIntentFilter }[] {
    const action = String(intent?.action ?? '').trim();
    if (!action) return [];
    const results: { appId: AppId; filter: AppIntentFilter }[] = [];
    for (const manifest of manifests) {
      for (const filter of manifest.intentFilters ?? []) {
        if (filter.action !== action) continue;
        if (!matchScheme(filter.scheme, intent.scheme)) continue;
        if (!matchType(filter.type, intent.type)) continue;
        results.push({ appId: manifest.id, filter });
      }
    }
    return results;
  },

  resolveActivity(intent: IntentQuery): AppId | undefined {
    const first = this.queryIntentActivities(intent)[0];
    return first?.appId;
  },

  resolveActivityAll(intent: IntentQuery): AppId[] {
    const ids: AppId[] = [];
    const seen = new Set<string>();
    for (const m of this.queryIntentActivities(intent)) {
      if (seen.has(m.appId)) continue;
      seen.add(m.appId);
      ids.push(m.appId);
    }
    return ids;
  },

  get dirToAppId(): ReadonlyMap<string, AppId> {
    return dirToAppIdMap;
  },

  install(manifest: AppManifest, dirName?: string): void {
    if (!manifest?.id) return;
    const exists = manifestMap.has(manifest.id);
    if (exists) return;
    manifests = [...manifests, manifest];
    if (dirName) dirToAppIdMap = new Map(dirToAppIdMap).set(dirName, manifest.id);
    rebuildMaps();
    BroadcastBus.sendBroadcast({
      action: ACTION_PACKAGE_ADDED,
      extras: { appId: manifest.id, packageName: manifest.packageName },
    });
  },

  uninstall(appId: AppId | string): void {
    const id = String(appId) as AppId;
    const info = manifestMap.get(id);
    if (!info) return;
    manifests = manifests.filter((m) => m.id !== id);
    dirToAppIdMap = new Map(
      [...dirToAppIdMap.entries()].filter(([, value]) => value !== id),
    );
    rebuildMaps();
    BroadcastBus.sendBroadcast({
      action: ACTION_PACKAGE_REMOVED,
      extras: { appId: id, packageName: info.packageName },
    });
  },
};

export default PackageManagerService;
