/**
 * 导航类型定义 — 标准项目类型
 * 从 apps/Compass/navigation.types.ts 复制
 */

export interface NavigateOptions {
  mode?: 'push' | 'replace';
  popTo?: string;
  popToInclusive?: boolean;
}

export interface AppNavigateHook {
  go: (path: string, options?: NavigateOptions) => void;
  back: () => void;
}
