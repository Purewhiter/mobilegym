import React from 'react';
import { AppIcon } from './AppIcon';
import type { AppManifest } from '../types/manifest';

type Props = { manifest: AppManifest };

/**
 * App 启动开屏 dispatcher。根据 `manifest.splash.kind` 路由到具体实现。
 *
 * Phase 1（当前）：
 *   - 未设 `splash` → SystemSplash（主题色 + 图标 scale-in），覆盖所有 28 个 App
 *   - 设 `branded` / `custom` → 暂时也走 SystemSplash（占位），等 Phase 2 落实
 *
 * Phase 2（未来）：
 *   - branded：图标下方加 tagline + 可选 minDuration（强制最短停留，需在 Suspense 外层加 gate）
 *   - custom：直接 render manifest.splash.render(manifest) 的返回值
 */
export const AppLaunchSplash: React.FC<Props> = ({ manifest }) => {
  const splash = manifest.splash;

  // Phase 2 hooks — 当前尚未实现，先 fall through 到 SystemSplash
  if (splash?.kind === 'custom') {
    // TODO Phase 2: return <>{splash.render(manifest)}</>;
    return <SystemSplash manifest={manifest} />;
  }
  if (splash?.kind === 'branded') {
    // TODO Phase 2: SystemSplash + tagline + minDurationMs gate
    return <SystemSplash manifest={manifest} />;
  }

  return <SystemSplash manifest={manifest} />;
};

/**
 * 系统级默认 splash：复刻 Android 12 SplashScreen API 的视觉。
 * 主题色铺底 + 图标居中 + ~220ms scale-in。
 *
 * 时长由 React Suspense 自然控制 —— 加载多久就显示多久，无最小停留时长，
 * bench_env 不会被拖慢。冷启动 (~50-300ms) 看到色块闪现；热启动直接跳过。
 */
const SystemSplash: React.FC<Props> = ({ manifest }) => {
  const bg = manifest.theme.colors.background;

  return (
    <div
      className="h-full w-full flex items-center justify-center overflow-hidden"
      style={{ background: bg }}
      data-app-launch-splash={manifest.id}
    >
      <div className="app-splash-icon-enter">
        <AppIcon manifest={manifest} size={88} radius={20} showShadow={false} />
      </div>

      <style>{`
        @keyframes app-splash-icon-enter {
          0%   { opacity: 0; transform: scale(0.85); }
          60%  { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        .app-splash-icon-enter {
          animation: app-splash-icon-enter 220ms cubic-bezier(0.32, 0.72, 0.36, 1) forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
};
