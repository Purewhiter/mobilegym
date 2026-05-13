/**
 * Unified App Registry
 *
 * - App identity/theme/icon metadata comes from PackageManagerService
 * - OS layer auto-discovers app components via import.meta.glob
 * - Convention: entry component must be `apps/<Dir>/*App.tsx` or `system/<Dir>/*App.tsx` with `export default`
 */
import React, { Suspense, lazy, type ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppId } from '../types';
import type { AppIntentFilter, AppManifest } from '../types/manifest';
import type { AppIconSource } from '../types/res';
import { osT } from '../i18n';
import { getLocale } from '../locale';
import PackageManagerService from '../PackageManagerService';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { AppLaunchSplash } from '../components/AppLaunchSplash';
import { runAppDataLoaderModule, type AppDataLoaderModule } from '../appDataLoaderReady';

export const APP_REGISTRY: AppManifest[] = [
  ...PackageManagerService.getInstalledPackages(),
];

// ============================================================================
// App Loading Fallback
// ============================================================================
/**
 * Generic loading fallback used only when the manifest is unavailable
 * (defensive — should not normally happen, since registered Apps must have
 * a manifest). When the manifest exists, AppLaunchSplash is used instead.
 */
export const AppLoadingFallback = () => (
  <div className="h-full w-full bg-white flex flex-col items-center justify-center gap-3">
    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
    <span className="text-sm text-gray-400">{osT('加载中...')}</span>
  </div>
);

// ============================================================================
// Directory → appId mapping
// ============================================================================
export const dirToAppId = PackageManagerService.dirToAppId;

// ============================================================================
// Lazy-loaded App Components — auto-discovered via import.meta.glob
// ============================================================================
const appModules = import.meta.glob<{ default: ComponentType<any> }>(
  ['../../apps/*/*App.tsx', '../../system/*/*App.tsx'],
);

// Data loaders: 让 App 的 lazy 包装 await preload + hydrateStore + waitReady
// 完成后再返回 component。这样 Suspense fallback (AppLaunchSplash) 自动跨越
//   - 模块下载（小，几十 KB）
//   - 数据加载（大，13MB JSON.parse / sqlite-wasm deserialize）
// 直到数据 ready，真实 App 才挂载——彻底消除"App 进了但 base feed 是空的"race。
// 不需要每个 App 自己再 useEffect(() => preload()) 或 isBaseLoaded splash gate。
//
// 注：preload 失败时**不 catch**，让 Promise reject 抛到 React Suspense 上层，
// 由 `AppErrorBoundary` 接管显示错误态。早期版本用 try/catch + warn 会让错误
// 被静默吞掉，App 落到空 UI——比明确报错更难排查。
const _dataLoaderModules = import.meta.glob<AppDataLoaderModule>(
  ['../../apps/*/data/loader.ts', '../../system/*/data/loader.ts'],
);
/** appId → 该 app 的 data loader module 动态 import 工厂。
 *  appRegistry 内 lazy() 用，OSContext.waitForData 也复用此 map（避免重复 glob 维护）。 */
export const dataLoaderByAppId = new Map<string, () => Promise<AppDataLoaderModule>>();
for (const [path, importFn] of Object.entries(_dataLoaderModules)) {
  const m = path.match(/\/(apps|system)\/([^/]+)\/data\/loader\.ts$/);
  if (!m) continue;
  const appId = dirToAppId.get(m[2]);
  if (appId && !dataLoaderByAppId.has(appId)) {
    dataLoaderByAppId.set(appId, importFn);
  }
}

const AppComponents: Record<string, React.LazyExoticComponent<ComponentType<any>>> = {};
for (const [path, importFn] of Object.entries(appModules)) {
  const m = path.match(/\/(apps|system)\/([^/]+)\//);
  if (!m) continue;
  const appId = dirToAppId.get(m[2]);
  if (appId && !AppComponents[appId]) {
    const dataLoaderFn = dataLoaderByAppId.get(appId);
    AppComponents[appId] = lazy(async () => {
      if (dataLoaderFn) {
        const loaderMod = await dataLoaderFn();
        await runAppDataLoaderModule(loaderMod);
      }
      return importFn();
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================
export function hasAppComponent(appId: string): boolean {
  return appId in AppComponents;
}

export function isValidAppId(id: string): boolean {
  return PackageManagerService.isInstalled(id);
}

export function getAppManifest(appId: AppId): AppManifest | undefined {
  return PackageManagerService.getPackageInfo(appId);
}

/**
 * 根据 intent 的 action/scheme/type 查找所有匹配的 App（隐式 Intent 解析）
 * 返回按 PackageManagerService 安装顺序排列的匹配结果
 */
export function resolveIntent(intent: {
  action: string;
  scheme?: string;
  type?: string;
}): { appId: AppId; filter: AppIntentFilter }[] {
  return PackageManagerService.queryIntentActivities(intent);
}

export function getAppIcon(appId: AppId): AppIconSource | undefined {
  return getAppManifest(appId)?.icon;
}

export function getLocalizedAppName(appId: AppId): string {
  const manifest = getAppManifest(appId);
  if (!manifest) return appId;
  if (getLocale() === 'en' && manifest.displayNameEn) {
    return manifest.displayNameEn;
  }
  return osT(manifest.displayName);
}

export function renderAppContent(appId: AppId): React.ReactNode {
  if (hasAppComponent(appId)) {
    const AppComponent = AppComponents[appId];
    const manifest = getAppManifest(appId);
    const fallback = manifest
      ? <AppLaunchSplash manifest={manifest} />
      : <AppLoadingFallback />;
    return (
      <AppErrorBoundary appId={appId}>
        <Suspense fallback={fallback}>
          <AppComponent />
        </Suspense>
      </AppErrorBoundary>
    );
  }

  const manifest = getAppManifest(appId);
  return (
    <div className="h-full w-full bg-white flex flex-col items-center justify-center gap-4">
      <div className="text-xl text-gray-500">
        {manifest ? osT(manifest.displayName) : appId} {osT('正在开发中...')}
      </div>
    </div>
  );
}
