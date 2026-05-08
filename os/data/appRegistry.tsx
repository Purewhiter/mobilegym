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

const AppComponents: Record<string, React.LazyExoticComponent<ComponentType<any>>> = {};
for (const [path, importFn] of Object.entries(appModules)) {
  const m = path.match(/\/(apps|system)\/([^/]+)\//);
  if (!m) continue;
  const appId = dirToAppId.get(m[2]);
  if (appId && !AppComponents[appId]) {
    AppComponents[appId] = lazy(importFn);
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
