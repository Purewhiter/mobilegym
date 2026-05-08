/**
 * `settingsConfig.ts`：纯"配置/默认值/类型"。
 *
 * - 只放：类型、默认值、key 字典
 * - 不放：localStorage 持久化 / hooks / 业务逻辑
 * - 状态与持久化在 `state.ts`（Zustand store）
 */

import type { SettingsConfigState, SettingsValue } from '../types';

// ── Defaults / Config keys ──────────────────────────────────────────

/** 常用可配置项默认值（其余键允许动态写入 preferences） */
export const SETTINGS_DEFAULT_PREFERENCES: Record<string, SettingsValue> = {};

/** 默认状态尽量"干净"：仅保留 Settings App 私有数据。 */
export const DEFAULT_SETTINGS_STATE: SettingsConfigState = {
  preferences: SETTINGS_DEFAULT_PREFERENCES,
  wifi: {
    savedNetworks: [],
  },
};
