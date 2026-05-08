# Android Simulator OS 层架构设计

> 浏览器端 Android 模拟器 · React + TypeScript + Vite · 单仓库

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [数据模型设计](#2-数据模型设计)
3. [持久化架构](#3-持久化架构)
4. [服务/模块划分](#4-服务模块划分)
5. [系统 UI 与服务的关系](#5-系统-ui-与服务的关系)
6. [App 与 OS 的交互模式](#6-app-与-os-的交互模式)
7. [评测框架集成](#7-评测框架集成)
8. [目录结构](#8-目录结构)
9. [关键代码示例](#9-关键代码示例)

---

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Browser Window                                    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    React App (UI Layer)                           │   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────┐  │   │
│  │  │  System UI   │  │           App Viewport                   │  │   │
│  │  │              │  │                                          │  │   │
│  │  │ StatusBar    │  │  ┌────────────┐  ┌────────────────────┐  │  │   │
│  │  │ NavBar       │  │  │ System App │  │   Third-party App  │  │  │   │
│  │  │ Notification │  │  │ (Settings/ │  │ (WeChat/Alipay...) │  │  │   │
│  │  │ Panel        │  │  │ Phone/SMS) │  │                    │  │  │   │
│  │  │ QuickSettings│  │  └─────┬──────┘  └────────┬───────────┘  │  │   │
│  │  └──────┬───────┘  └────────┼─────────────────┼──────────────┘  │   │
│  │         │                   │   useOS() hook  │                  │   │
│  │         └───────────────────┴────────┬────────┘                  │   │
│  │                                      │                           │   │
│  └──────────────────────────────────────┼───────────────────────────┘   │
│                                         │                               │
│  ┌──────────────────────────────────────▼───────────────────────────┐   │
│  │                     OS Core (Service Layer)                       │   │
│  │                                                                   │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐   │   │
│  │  │SystemService│ │NotifService  │ │    PermissionService     │   │   │
│  │  │             │ │              │ │                          │   │   │
│  │  │ wifi        │ │ add()        │ │ grant/revoke             │   │   │
│  │  │ bluetooth   │ │ dismiss()    │ │ check()                  │   │   │
│  │  │ battery     │ │ clear()      │ └──────────────────────────┘   │   │
│  │  │ volume      │ └──────────────┘                               │   │
│  │  │ brightness  │ ┌──────────────┐ ┌──────────────────────────┐   │   │
│  │  │ airplane    │ │AppRegistry   │ │    ClipboardService      │   │   │
│  │  │ ...         │ │              │ │                          │   │   │
│  │  └──────┬──────┘ │ register()   │ │ read() / write()         │   │   │
│  │         │        │ getApp()     │ └──────────────────────────┘   │   │
│  │         │        │ glob-scan    │                               │   │
│  │         │        └──────────────┘                               │   │
│  │         │                                                       │   │
│  │  ┌──────▼──────────────────────────────────────────────────┐   │   │
│  │  │              State Store (Zustand)                       │   │   │
│  │  │                                                          │   │   │
│  │  │  systemSlice │ appsSlice │ notifSlice │ uiSlice          │   │   │
│  │  │                    ↕ persist middleware                  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼──────────────────────────────┐    │
│  │               Storage Layer (localStorage)                      │    │
│  │                                                                  │    │
│  │  sim:system  │  sim:apps:settings  │  sim:apps:wechat  │  ...   │    │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  window.__SIM__  ←── Evaluation Framework (Python + Playwright)         │
│  .getState()                                                            │
│  .setState()                                                            │
│  .reset()                                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 核心设计原则

| 原则 | 说明 |
|------|------|
| **单向数据流** | UI 只读 Store，写操作只能通过 Service 方法 |
| **服务拥有数据** | 每个 Service 是对应 Store Slice 的唯一写入者 |
| **App 沙箱隔离** | 每个 App 的状态存于独立 localStorage key，互不干扰 |
| **评测 API 是薄层** | `window.__SIM__` 不含业务逻辑，直接代理 Store 的序列化/反序列化 |
| **默认状态分层** | `DEFAULT_STATE` 常量 → 运行时 Store → 持久化快照，三层覆盖 |

---

## 2. 数据模型设计

### 2.1 总体状态树

```typescript
// src/os/types/state.ts

/** 整个模拟器的完整状态快照（用于 getState/setState/reset） */
export interface SimulatorSnapshot {
  version: number;          // schema 版本，用于迁移
  timestamp: number;        // 快照时间戳
  system: SystemState;
  notifications: NotificationState;
  apps: Record<AppId, unknown>;  // 各 App 自定义结构
}

/** 系统层状态（对应 sim:system） */
export interface SystemState {
  // ── 网络 ──
  wifi: WifiState;
  bluetooth: BluetoothState;
  cellular: CellularState;
  airplaneMode: boolean;
  hotspot: HotspotState;

  // ── 显示 ──
  brightness: number;         // 0–255
  nightMode: boolean;
  fontSize: FontScale;        // 'small'|'normal'|'large'|'xl'
  displayScale: number;       // 0.85–1.3
  darkTheme: boolean;
  wallpaper: string;          // URL or preset key
  screenTimeout: number;      // ms

  // ── 音频 ──
  volume: VolumeState;
  doNotDisturb: DndState;

  // ── 电源/硬件 ──
  battery: BatteryState;
  location: LocationState;

  // ── 设备信息（只读，可被 setState 覆写用于测试） ──
  deviceInfo: DeviceInfo;

  // ── 通话/SIM ──
  sim: SimState;

  // ── 权限 ──
  permissions: PermissionMap;

  // ── 剪贴板 ──
  clipboard: string;

  // ── 输入法 ──
  ime: ImeState;

  // ── 主题 ──
  theme: ThemeConfig;
}
```

### 2.2 子状态类型

```typescript
// src/os/types/system.ts

export interface WifiState {
  enabled: boolean;
  connected: boolean;
  ssid: string | null;
  signalLevel: 0 | 1 | 2 | 3 | 4;  // 格数
  ipAddress: string | null;
  nearbyNetworks: WifiNetwork[];
}

export interface WifiNetwork {
  ssid: string;
  bssid: string;
  signalLevel: 0 | 1 | 2 | 3 | 4;
  secured: boolean;
  frequency: 2.4 | 5;
}

export interface BluetoothState {
  enabled: boolean;
  connected: boolean;
  deviceName: string;
  pairedDevices: BtDevice[];
  nearbyDevices: BtDevice[];
}

export interface BatteryState {
  level: number;          // 0–100
  charging: boolean;
  chargingType: 'none' | 'usb' | 'ac' | 'wireless';
  temperature: number;    // 摄氏度
  health: 'good' | 'overheat' | 'dead' | 'unknown';
}

export interface VolumeState {
  media: number;    // 0–15
  ring: number;
  alarm: number;
  notification: number;
  muted: boolean;
}

export interface DeviceInfo {
  model: string;              // e.g. "Pixel 7"
  manufacturer: string;
  androidVersion: string;
  sdkVersion: number;
  buildNumber: string;
  imei: string;
  serial: string;
  totalStorage: number;       // bytes
  usedStorage: number;
  totalRam: number;
  availableRam: number;
  screenWidth: number;
  screenHeight: number;
  dpi: number;
}

export interface SimState {
  present: boolean;
  carrier: string;
  phoneNumber: string;
  countryCode: string;
  roaming: boolean;
  dualSim: boolean;
}

export type PermissionMap = Record<AppId, Record<PermissionName, PermissionStatus>>;
export type PermissionStatus = 'granted' | 'denied' | 'not_asked';
export type PermissionName =
  | 'camera' | 'microphone' | 'contacts' | 'location'
  | 'storage' | 'phone' | 'sms' | 'notifications' | 'calendar';

export type FontScale = 'small' | 'normal' | 'large' | 'xl';

export interface CellularState {
  enabled: boolean;
  signalLevel: 0 | 1 | 2 | 3 | 4;
  networkType: 'none' | '2G' | '3G' | '4G' | '5G';
  dataEnabled: boolean;
  roaming: boolean;
}

export interface LocationState {
  enabled: boolean;
  mode: 'off' | 'battery_saving' | 'device_only' | 'high_accuracy';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export interface DndState {
  enabled: boolean;
  mode: 'all' | 'priority' | 'alarms_only' | 'silent';
  schedule: { start: string; end: string } | null;
}

export interface ImeState {
  activeIme: string;   // e.g. 'com.google.android.inputmethod.latin'
  visible: boolean;
}

export interface ThemeConfig {
  accentColor: string;
  iconPack: string;
}

export interface HotspotState {
  enabled: boolean;
  ssid: string;
  password: string;
  connectedDevices: number;
}

// ── 通知 ──
export interface NotificationState {
  items: Notification[];
  panelOpen: boolean;
  quickSettingsOpen: boolean;
}

export interface Notification {
  id: string;
  appId: AppId;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  category: 'message' | 'system' | 'social' | 'promo' | 'alarm';
  actions?: NotificationAction[];
  icon?: string;
}

export interface NotificationAction {
  key: string;
  label: string;
}

// ── App 元数据 ──
export type AppId = string;

export interface AppManifest {
  id: AppId;
  name: string;
  icon: string;        // SVG string or URL
  version: string;
  isSystemApp: boolean;
  permissions: PermissionName[];
  defaultState: unknown;
  component: React.ComponentType<AppProps>;
}

export interface AppProps {
  os: OSBridge;        // App 与 OS 交互的接口
}
```

### 2.3 默认状态管理

```typescript
// src/os/defaults.ts
// 三层默认值：DEFAULT（代码常量）→ PRESET（预设场景）→ runtime（运行时）

import type { SystemState, NotificationState } from './types/state';

export const DEFAULT_SYSTEM_STATE: SystemState = {
  wifi: {
    enabled: true,
    connected: true,
    ssid: 'SimNet',
    signalLevel: 3,
    ipAddress: '192.168.1.100',
    nearbyNetworks: [
      { ssid: 'SimNet', bssid: 'AA:BB:CC:DD:EE:01', signalLevel: 3, secured: true, frequency: 5 },
      { ssid: 'Neighbor_2.4G', bssid: 'AA:BB:CC:DD:EE:02', signalLevel: 2, secured: true, frequency: 2.4 },
    ],
  },
  bluetooth: { enabled: false, connected: false, deviceName: 'Sim Device', pairedDevices: [], nearbyDevices: [] },
  cellular: { enabled: true, signalLevel: 3, networkType: '4G', dataEnabled: true, roaming: false },
  airplaneMode: false,
  hotspot: { enabled: false, ssid: 'SimHotspot', password: '12345678', connectedDevices: 0 },
  brightness: 128,
  nightMode: false,
  fontSize: 'normal',
  displayScale: 1.0,
  darkTheme: false,
  wallpaper: 'default',
  screenTimeout: 30000,
  volume: { media: 8, ring: 8, alarm: 8, notification: 8, muted: false },
  doNotDisturb: { enabled: false, mode: 'all', schedule: null },
  battery: { level: 80, charging: false, chargingType: 'none', temperature: 28, health: 'good' },
  location: { enabled: true, mode: 'high_accuracy', latitude: 39.9042, longitude: 116.4074, accuracy: 10 },
  deviceInfo: {
    model: 'Pixel 7', manufacturer: 'Google', androidVersion: '14',
    sdkVersion: 34, buildNumber: 'UP1A.231005.007',
    imei: '352099001761481', serial: 'SIM0001',
    totalStorage: 128 * 1024 ** 3, usedStorage: 32 * 1024 ** 3,
    totalRam: 8 * 1024 ** 3, availableRam: 4 * 1024 ** 3,
    screenWidth: 1080, screenHeight: 2400, dpi: 416,
  },
  sim: { present: true, carrier: 'China Mobile', phoneNumber: '+8613800000001', countryCode: 'CN', roaming: false, dualSim: false },
  permissions: {},
  clipboard: '',
  ime: { activeIme: 'com.google.android.inputmethod.latin', visible: false },
  theme: { accentColor: '#1976D2', iconPack: 'default' },
};

export const DEFAULT_NOTIFICATION_STATE: NotificationState = {
  items: [],
  panelOpen: false,
  quickSettingsOpen: false,
};

/** 评测用预设场景，可通过 setState 快速注入 */
export const STATE_PRESETS = {
  lowBattery: {
    system: { battery: { level: 15, charging: false, chargingType: 'none', temperature: 35, health: 'good' } },
  },
  airplaneMode: {
    system: { airplaneMode: true, wifi: { enabled: false }, cellular: { enabled: false }, bluetooth: { enabled: false } },
  },
  noNetwork: {
    system: { wifi: { enabled: false, connected: false }, cellular: { dataEnabled: false } },
  },
} satisfies Record<string, DeepPartial<{ system: SystemState }>>;
```

---

## 3. 持久化架构

### 3.1 localStorage Key 策略

```
sim:system            ← 系统状态（单 key，约 5–10 KB）
sim:notifications     ← 通知列表（独立，避免频繁写入污染系统状态）
sim:apps:{appId}      ← 每个 App 一个 key（隔离，可单独清除）
sim:meta              ← schema 版本、最后写入时间等元数据
```

**为什么这样分 key？**

| 考量 | 说明 |
|------|------|
| **隔离性** | App 崩溃/重置不影响系统状态；系统重置不清除 App 数据（除非显式） |
| **评测粒度** | `setState({ apps: { wechat: ... } })` 可只覆写单个 App |
| **写入频率** | 通知频繁变化，单独存储避免 JSON 序列化整棵树 |
| **大小控制** | 单 key 上限 5 MB；App 数据膨胀不会挤占系统状态 |
| **调试友好** | DevTools → Application → localStorage 一目了然 |

### 3.2 持久化中间件

```typescript
// src/os/store/persistence.ts

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

type PersistConfig<T> = {
  key: string;
  serialize?: (state: T) => string;
  deserialize?: (raw: string) => Partial<T>;
  migrations?: Migration<T>[];
};

type Migration<T> = {
  version: number;
  migrate: (old: unknown) => Partial<T>;
};

/** 自定义持久化中间件，支持版本迁移 */
export function simPersist<T>(
  config: PersistConfig<T>
): (f: StateCreator<T>) => StateCreator<T> {
  return (f) => (set, get, store) => {
    const { key, serialize = JSON.stringify, deserialize = JSON.parse, migrations = [] } = config;

    // 初始化时读取持久化状态
    const loadFromStorage = (): Partial<T> => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = deserialize(raw) as { _version?: number } & Partial<T>;
        
        // 运行迁移
        let state = parsed as unknown;
        const currentVersion = parsed._version ?? 0;
        for (const m of migrations.filter(m => m.version > currentVersion)) {
          state = m.migrate(state);
        }
        return state as Partial<T>;
      } catch {
        console.warn(`[SimPersist] Failed to load ${key}, using defaults`);
        return {};
      }
    };

    // 写入防抖
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleWrite = (state: T) => {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        try {
          localStorage.setItem(key, serialize({ ...state, _version: SCHEMA_VERSION }));
        } catch (e) {
          console.error(`[SimPersist] Write failed for ${key}`, e);
        }
      }, 100);  // 100ms 防抖，避免高频写入
    };

    const initialState = f(
      (partial, replace) => {
        set(partial, replace);
        scheduleWrite(get());
      },
      get,
      store
    );

    // 合并持久化状态（持久化覆盖默认值）
    const persisted = loadFromStorage();
    return mergeDeep(initialState, persisted) as T;
  };
}

export const SCHEMA_VERSION = 1;
```

### 3.3 StorageService（原子操作）

```typescript
// src/os/services/StorageService.ts

/** 对 localStorage 的类型安全封装，供 SimAPI 的 getState/setState 使用 */
export class StorageService {
  static readonly KEYS = {
    SYSTEM: 'sim:system',
    NOTIFICATIONS: 'sim:notifications',
    META: 'sim:meta',
    app: (id: string) => `sim:apps:${id}`,
  } as const;

  /** 读取所有 App keys */
  static listAppKeys(): string[] {
    return Object.keys(localStorage).filter(k => k.startsWith('sim:apps:'));
  }

  /** 原子清除所有模拟器状态 */
  static clearAll(): void {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('sim:'));
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}
```

---

## 4. 服务/模块划分

### 4.1 服务职责矩阵

```
服务                  拥有的数据                职责
─────────────────────────────────────────────────────────────────
SystemService         system slice              读写所有系统设置+硬件状态
NotificationService   notifications slice       增删改通知、面板开关
AppRegistry           (纯注册表，无状态)         glob 扫描 → 注册 App 清单
PermissionService     system.permissions        权限申请/授权/撤销
ClipboardService      system.clipboard          剪贴板读写
ImeService            system.ime                输入法显示/隐藏
StorageService        (基础设施，无业务状态)      localStorage 原子操作
SimAPI                (门面，无独立状态)          window.__SIM__ 实现
```

### 4.2 各服务接口定义

```typescript
// src/os/services/SystemService.ts

import { useSimStore } from '../store';
import type { WifiState, BatteryState, VolumeState } from '../types/state';

/** OS 系统服务 — 所有系统级设置的唯一写入者 */
export class SystemService {
  // ── WiFi ──
  static setWifiEnabled(enabled: boolean): void {
    useSimStore.getState().setSystem(s => ({
      wifi: { ...s.wifi, enabled, connected: enabled ? s.wifi.connected : false },
      // 开启飞行模式时联动关闭
    }));
  }

  static connectWifi(ssid: string): void {
    const network = useSimStore.getState().system.wifi.nearbyNetworks.find(n => n.ssid === ssid);
    if (!network) throw new Error(`Network "${ssid}" not found`);
    useSimStore.getState().setSystem(s => ({
      wifi: { ...s.wifi, connected: true, ssid, signalLevel: network.signalLevel },
    }));
  }

  // ── 飞行模式（联动） ──
  static setAirplaneMode(enabled: boolean): void {
    useSimStore.getState().setSystem(s => ({
      airplaneMode: enabled,
      ...(enabled && {
        wifi: { ...s.wifi, enabled: false, connected: false },
        bluetooth: { ...s.bluetooth, enabled: false },
        cellular: { ...s.cellular, enabled: false },
      }),
    }));
  }

  // ── 音量 ──
  static setVolume(channel: keyof VolumeState, value: number): void {
    if (channel === 'muted') throw new Error('Use setMuted()');
    useSimStore.getState().setSystem(s => ({
      volume: { ...s.volume, [channel]: Math.max(0, Math.min(15, value as number)) },
    }));
  }

  // ── 电池（供评测注入） ──
  static setBattery(patch: Partial<BatteryState>): void {
    useSimStore.getState().setSystem(s => ({
      battery: { ...s.battery, ...patch },
    }));
  }

  // ── 通用 patch（供 SimAPI.setState 使用） ──
  static patchSystem(patch: DeepPartial<SystemState>): void {
    useSimStore.getState().setSystem(s => mergeDeep(s, patch));
  }
}
```

```typescript
// src/os/services/NotificationService.ts

import { useSimStore } from '../store';
import type { Notification } from '../types/state';

export class NotificationService {
  static post(notif: Omit<Notification, 'id' | 'timestamp' | 'read'>): string {
    const id = crypto.randomUUID();
    useSimStore.getState().addNotification({ ...notif, id, timestamp: Date.now(), read: false });
    return id;
  }

  static dismiss(id: string): void {
    useSimStore.getState().removeNotification(id);
  }

  static clearAll(): void {
    useSimStore.getState().clearNotifications();
  }

  static markRead(id: string): void {
    useSimStore.getState().updateNotification(id, { read: true });
  }

  static getUnreadCount(): number {
    return useSimStore.getState().notifications.items.filter(n => !n.read).length;
  }
}
```

```typescript
// src/os/services/AppRegistry.ts

import type { AppManifest, AppId } from '../types/state';

/** 通过 import.meta.glob 自动发现所有 App，无需手动注册 */
export class AppRegistry {
  private static registry = new Map<AppId, AppManifest>();
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    // 自动扫描 src/apps/*/manifest.ts
    const manifests = import.meta.glob<{ default: AppManifest }>('../apps/*/manifest.ts', { eager: true });
    
    for (const [path, mod] of Object.entries(manifests)) {
      const manifest = mod.default;
      if (!manifest?.id) {
        console.warn(`[AppRegistry] Invalid manifest at ${path}`);
        continue;
      }
      this.registry.set(manifest.id, manifest);
    }

    this.initialized = true;
    console.info(`[AppRegistry] Loaded ${this.registry.size} apps`);
  }

  static getAll(): AppManifest[] {
    return [...this.registry.values()];
  }

  static get(id: AppId): AppManifest | undefined {
    return this.registry.get(id);
  }

  static getSystemApps(): AppManifest[] {
    return this.getAll().filter(a => a.isSystemApp);
  }

  static getThirdPartyApps(): AppManifest[] {
    return this.getAll().filter(a => !a.isSystemApp);
  }
}
```

---

## 5. 系统 UI 与服务的关系

### 5.1 设计原则

系统 UI 组件（状态栏、快捷设置、通知下拉栏）是**纯展示层**：
- 只从 Store **读取**状态（通过 `useSimStore` hooks）
- 用户交互通过调用 **Service 方法**写入（不直接 `setState`）
- UI 组件不持有本地状态（除动画/过渡等纯视觉状态外）

```
用户点击 WiFi 开关
    ↓
QuickSettingsPanel.tsx (UI)
    ↓ 调用
SystemService.setWifiEnabled(false)
    ↓ 写入
useSimStore → system.wifi.enabled = false
    ↓ 触发重渲染
StatusBar.tsx ← useSimStore(s => s.system.wifi)  自动更新
QuickSettingsPanel.tsx ← 自动更新
```

### 5.2 系统 UI Hook 设计

```typescript
// src/os/hooks/useSystemUI.ts

/** StatusBar 专用 hook — 只订阅需要的字段，避免不必要重渲染 */
export function useStatusBarState() {
  return useSimStore(
    s => ({
      time: s.ui.currentTime,
      batteryLevel: s.system.battery.level,
      batteryCharging: s.system.battery.charging,
      wifiEnabled: s.system.wifi.enabled,
      wifiConnected: s.system.wifi.connected,
      wifiSignal: s.system.wifi.signalLevel,
      cellularSignal: s.system.cellular.signalLevel,
      networkType: s.system.cellular.networkType,
      airplaneMode: s.system.airplaneMode,
      notificationCount: s.notifications.items.filter(n => !n.read).length,
      doNotDisturb: s.system.doNotDisturb.enabled,
    }),
    shallow  // Zustand shallow 比较，避免引用变化导致的无效渲染
  );
}

/** 快捷设置面板 hook */
export function useQuickSettings() {
  const state = useSimStore(s => ({
    wifi: s.system.wifi,
    bluetooth: s.system.bluetooth,
    airplaneMode: s.system.airplaneMode,
    brightness: s.system.brightness,
    nightMode: s.system.nightMode,
    doNotDisturb: s.system.doNotDisturb,
    rotation: s.system.rotation,
    hotspot: s.system.hotspot,
  }), shallow);

  const actions = useMemo(() => ({
    toggleWifi: () => SystemService.setWifiEnabled(!state.wifi.enabled),
    toggleBluetooth: () => SystemService.setBluetoothEnabled(!state.bluetooth.enabled),
    toggleAirplane: () => SystemService.setAirplaneMode(!state.airplaneMode),
    setBrightness: (v: number) => SystemService.setBrightness(v),
    toggleNightMode: () => SystemService.setNightMode(!state.nightMode),
    toggleDnd: () => NotificationService.toggleDoNotDisturb(),
  }), [state]);

  return { ...state, ...actions };
}
```

### 5.3 UI 组件结构

```
src/os/ui/
├── SystemUI.tsx              ← 顶层 Shell，包含所有系统 UI 层
├── status-bar/
│   ├── StatusBar.tsx         ← 顶部状态栏（只读 hooks）
│   ├── BatteryIcon.tsx
│   ├── SignalIcon.tsx
│   └── TimeDisplay.tsx
├── notification-panel/
│   ├── NotificationPanel.tsx ← 下拉通知栏（调用 NotificationService）
│   ├── NotificationItem.tsx
│   └── NotificationActions.tsx
├── quick-settings/
│   ├── QuickSettingsPanel.tsx
│   ├── QsTile.tsx            ← 单个快捷设置瓦片
│   └── BrightnessSlider.tsx
└── nav-bar/
    └── NavBar.tsx            ← 手势导航栏 / 三键导航
```

---

## 6. App 与 OS 的交互模式

### 6.1 OSBridge 接口（App 视角）

App 通过 `useOS()` hook 获得一个沙箱化的 OS 访问接口：

```typescript
// src/os/hooks/useOS.ts

export interface OSBridge {
  // 读取系统状态（只读视图）
  system: Readonly<SystemState>;
  
  // 通知
  notify: (n: Omit<Notification, 'id' | 'timestamp' | 'read' | 'appId'>) => string;
  
  // 权限
  requestPermission: (name: PermissionName) => Promise<PermissionStatus>;
  checkPermission: (name: PermissionName) => PermissionStatus;
  
  // 剪贴板
  clipboard: { read: () => string; write: (text: string) => void };
  
  // 输入法
  ime: { show: () => void; hide: () => void };
  
  // App 自己的持久化状态（隔离于系统状态）
  appStorage: {
    get: <T>() => T | null;
    set: <T>(state: T) => void;
    reset: () => void;
  };

  // 跳转其他 App（模拟 Intent）
  startActivity: (appId: AppId, params?: Record<string, unknown>) => void;
}

/** 供 App 内部使用的 hook */
export function useOS(appId: AppId): OSBridge {
  const system = useSimStore(s => s.system);
  const store = useSimStore();

  return useMemo<OSBridge>(() => ({
    system,

    notify: (n) => NotificationService.post({ ...n, appId }),

    requestPermission: (name) => PermissionService.request(appId, name),
    checkPermission: (name) => PermissionService.check(appId, name),

    clipboard: {
      read: () => ClipboardService.read(),
      write: (text) => ClipboardService.write(text),
    },

    ime: {
      show: () => ImeService.show(),
      hide: () => ImeService.hide(),
    },

    appStorage: {
      get: <T>() => {
        const raw = localStorage.getItem(StorageService.KEYS.app(appId));
        return raw ? (JSON.parse(raw) as T) : null;
      },
      set: <T>(state: T) => {
        localStorage.setItem(StorageService.KEYS.app(appId), JSON.stringify(state));
        store.syncAppState(appId, state);
      },
      reset: () => {
        localStorage.removeItem(StorageService.KEYS.app(appId));
        store.syncAppState(appId, null);
      },
    },

    startActivity: (targetId, params) => {
      store.setForegroundApp(targetId, params);
    },
  }), [appId, system, store]);
}
```

### 6.2 系统 App vs 第三方 App 的区别

```typescript
// 系统 App 拥有更多 OS 访问权限
export interface SystemAppBridge extends OSBridge {
  // 系统 App 专用：可直接读写系统设置
  systemService: typeof SystemService;
  // 可访问其他 App 的数据（用于设置→隐私页面）
  queryAppPermissions: (appId: AppId) => PermissionMap[AppId];
}

export function useSystemOS(appId: AppId): SystemAppBridge {
  const base = useOS(appId);
  return {
    ...base,
    systemService: SystemService,
    queryAppPermissions: (id) => PermissionService.getAppPermissions(id),
  };
}
```

### 6.3 App Manifest 示例

```typescript
// src/apps/settings/manifest.ts
import type { AppManifest } from '../../os/types/state';
import SettingsApp from './SettingsApp';

const manifest: AppManifest = {
  id: 'com.android.settings',
  name: '设置',
  icon: '<svg>...</svg>',
  version: '14.0.0',
  isSystemApp: true,            // ← 系统 App
  permissions: [],              // 系统 App 不需要申请权限
  defaultState: {},
  component: SettingsApp,
};
export default manifest;

// src/apps/wechat/manifest.ts
const manifest: AppManifest = {
  id: 'com.tencent.mm',
  name: '微信',
  icon: '<svg>...</svg>',
  version: '8.0.44',
  isSystemApp: false,           // ← 第三方 App
  permissions: ['contacts', 'microphone', 'camera', 'location', 'notifications'],
  defaultState: {
    chats: [],
    contacts: [],
    moments: [],
    unreadCount: 0,
  },
  component: WeChatApp,
};
```

---

## 7. 评测框架集成

### 7.1 window.__SIM__ 实现

```typescript
// src/os/SimAPI.ts

import { useSimStore } from './store';
import { AppRegistry } from './services/AppRegistry';
import { StorageService } from './services/StorageService';
import { DEFAULT_SYSTEM_STATE, DEFAULT_NOTIFICATION_STATE } from './defaults';
import type { SimulatorSnapshot } from './types/state';

export interface SimAPIType {
  /** 获取完整状态快照（系统 + 所有 App） */
  getState(): SimulatorSnapshot;

  /** 注入状态（深度合并，非替换） */
  setState(patch: DeepPartial<SimulatorSnapshot>): void;

  /** 完全重置到出厂状态 */
  reset(): void;

  /** 工具方法 */
  getAppState<T = unknown>(appId: string): T | null;
  setAppState<T = unknown>(appId: string, state: T): void;

  /** 内部版本，供调试 */
  _version: number;
}

export function createSimAPI(): SimAPIType {
  const api: SimAPIType = {
    _version: 1,

    getState(): SimulatorSnapshot {
      const store = useSimStore.getState();
      
      // 收集所有 App 状态
      const apps: Record<string, unknown> = {};
      for (const key of StorageService.listAppKeys()) {
        const appId = key.replace('sim:apps:', '');
        const raw = localStorage.getItem(key);
        apps[appId] = raw ? JSON.parse(raw) : null;
      }

      return {
        version: 1,
        timestamp: Date.now(),
        system: structuredClone(store.system),
        notifications: structuredClone(store.notifications),
        apps,
      };
    },

    setState(patch: DeepPartial<SimulatorSnapshot>): void {
      const store = useSimStore.getState();

      if (patch.system) {
        store.setSystem(s => mergeDeep(s, patch.system!));
      }

      if (patch.notifications) {
        if (patch.notifications.items) {
          store.replaceNotifications(patch.notifications.items);
        }
      }

      if (patch.apps) {
        for (const [appId, appState] of Object.entries(patch.apps)) {
          if (appState === null) {
            localStorage.removeItem(StorageService.KEYS.app(appId));
          } else {
            localStorage.setItem(StorageService.KEYS.app(appId), JSON.stringify(appState));
          }
          store.syncAppState(appId, appState);
        }
      }
    },

    reset(): void {
      // 1. 清除所有 localStorage
      StorageService.clearAll();

      // 2. 重置 Store 到默认值
      useSimStore.getState().resetAll();

      // 3. 重置所有 App 状态到 defaultState
      for (const app of AppRegistry.getAll()) {
        if (app.defaultState) {
          localStorage.setItem(
            StorageService.KEYS.app(app.id),
            JSON.stringify(app.defaultState)
          );
        }
      }

      console.info('[SimAPI] Full reset complete');
    },

    getAppState<T>(appId: string): T | null {
      const raw = localStorage.getItem(StorageService.KEYS.app(appId));
      return raw ? (JSON.parse(raw) as T) : null;
    },

    setAppState<T>(appId: string, state: T): void {
      localStorage.setItem(StorageService.KEYS.app(appId), JSON.stringify(state));
      useSimStore.getState().syncAppState(appId, state);
    },
  };

  return api;
}

/** 在 main.tsx 中调用 */
export function exposeSimAPI(): void {
  if (import.meta.env.MODE === 'production' && !import.meta.env.VITE_EXPOSE_SIM_API) return;
  (window as Window & { __SIM__?: SimAPIType }).__SIM__ = createSimAPI();
}
```

### 7.2 Python + Playwright 评测示例

```python
# evaluation/runner.py

import asyncio
from playwright.async_api import async_playwright

class SimulatorClient:
    def __init__(self, page):
        self.page = page

    async def get_state(self) -> dict:
        return await self.page.evaluate("window.__SIM__.getState()")

    async def set_state(self, patch: dict) -> None:
        await self.page.evaluate("(p) => window.__SIM__.setState(p)", patch)

    async def reset(self) -> None:
        await self.page.evaluate("window.__SIM__.reset()")
        await self.page.wait_for_timeout(500)  # 等待重渲染

    async def inject_scenario(self, scenario: dict) -> None:
        """注入预设场景，例如 wifi=off, battery=30%"""
        await self.set_state({
            "system": {
                "battery": {"level": scenario.get("battery", 80)},
                "wifi": {"enabled": scenario.get("wifi_enabled", True)},
            },
            "notifications": {
                "items": scenario.get("notifications", [])
            },
            "apps": scenario.get("apps", {})
        })


# 评测任务示例
async def evaluate_task_wifi_toggle():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173")
        
        sim = SimulatorClient(page)
        
        # 1. 注入初始状态
        await sim.reset()
        await sim.inject_scenario({
            "battery": 30,
            "wifi_enabled": True,
            "notifications": [
                {"appId": "com.tencent.mm", "title": "微信", "body": "你有3条未读消息", "category": "message"}
            ]
        })
        
        # 2. 运行 Agent（截图 → 操作循环）
        for step in range(20):
            screenshot = await page.screenshot()
            action = agent.predict(screenshot)  # Agent 只看截图
            await execute_action(page, action)
        
        # 3. 读取最终状态判定
        final_state = await sim.get_state()
        wifi_off = not final_state["system"]["wifi"]["enabled"]
        print(f"Task success: {wifi_off}")

        await browser.close()
```

### 7.3 Store 的 resetAll 实现

```typescript
// src/os/store/index.ts (核心 slice)

interface SimStore {
  system: SystemState;
  notifications: NotificationState;
  appStates: Record<string, unknown>;
  ui: UIState;

  // 写入方法
  setSystem: (updater: (s: SystemState) => Partial<SystemState>) => void;
  addNotification: (n: Notification) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  updateNotification: (id: string, patch: Partial<Notification>) => void;
  replaceNotifications: (items: Notification[]) => void;
  syncAppState: (appId: string, state: unknown) => void;
  resetAll: () => void;
}

export const useSimStore = create<SimStore>()(
  immer((set, get) => ({
    system: DEFAULT_SYSTEM_STATE,
    notifications: DEFAULT_NOTIFICATION_STATE,
    appStates: {},
    ui: DEFAULT_UI_STATE,

    setSystem: (updater) =>
      set(state => { Object.assign(state.system, updater(state.system)); }),

    addNotification: (n) =>
      set(state => { state.notifications.items.unshift(n); }),

    removeNotification: (id) =>
      set(state => {
        state.notifications.items = state.notifications.items.filter(n => n.id !== id);
      }),

    clearNotifications: () =>
      set(state => { state.notifications.items = []; }),

    updateNotification: (id, patch) =>
      set(state => {
        const n = state.notifications.items.find(n => n.id === id);
        if (n) Object.assign(n, patch);
      }),

    replaceNotifications: (items) =>
      set(state => { state.notifications.items = items; }),

    syncAppState: (appId, appState) =>
      set(state => { state.appStates[appId] = appState; }),

    resetAll: () =>
      set(state => {
        state.system = DEFAULT_SYSTEM_STATE;
        state.notifications = DEFAULT_NOTIFICATION_STATE;
        state.appStates = {};
        state.ui = DEFAULT_UI_STATE;
      }),
  }))
);
```

---

## 8. 目录结构

```
src/
├── main.tsx                        ← 入口：初始化 AppRegistry + exposeSimAPI
├── App.tsx                         ← 顶层路由/Shell
│
├── os/                             ← OS Core（与 UI 无关的纯逻辑）
│   ├── types/
│   │   ├── state.ts                ← 所有状态类型定义（唯一真相源）
│   │   ├── system.ts               ← 系统子类型（WifiState 等）
│   │   └── utils.ts                ← DeepPartial 等工具类型
│   │
│   ├── defaults.ts                 ← DEFAULT_SYSTEM_STATE + 预设场景
│   │
│   ├── store/
│   │   ├── index.ts                ← useSimStore（Zustand + Immer）
│   │   ├── persistence.ts          ← simPersist 中间件
│   │   └── slices/
│   │       ├── systemSlice.ts
│   │       ├── notificationSlice.ts
│   │       ├── uiSlice.ts
│   │       └── appStateSlice.ts
│   │
│   ├── services/
│   │   ├── SystemService.ts        ← 系统设置写入（wifi/bt/battery...）
│   │   ├── NotificationService.ts  ← 通知 CRUD
│   │   ├── AppRegistry.ts          ← glob 扫描注册
│   │   ├── PermissionService.ts    ← 权限管理
│   │   ├── ClipboardService.ts     ← 剪贴板
│   │   ├── ImeService.ts           ← 输入法状态
│   │   └── StorageService.ts       ← localStorage 工具
│   │
│   ├── hooks/
│   │   ├── useOS.ts                ← App 用的 OSBridge hook
│   │   ├── useSystemUI.ts          ← StatusBar/QuickSettings 专用 hooks
│   │   └── usePermission.ts        ← 权限 hook
│   │
│   └── SimAPI.ts                   ← window.__SIM__ 实现
│
├── os/ui/                          ← 系统 UI 组件（状态栏/通知/导航栏等）
│   ├── SystemUI.tsx                ← Shell：包裹所有系统 UI
│   ├── status-bar/
│   │   └── StatusBar.tsx
│   ├── notification-panel/
│   │   └── NotificationPanel.tsx
│   ├── quick-settings/
│   │   └── QuickSettingsPanel.tsx
│   └── nav-bar/
│       └── NavBar.tsx
│
├── apps/                           ← 所有 App（glob 自动发现）
│   │
│   ├── settings/                   ← 系统 App：设置
│   │   ├── manifest.ts             ← AppManifest（必须有此文件）
│   │   ├── SettingsApp.tsx
│   │   └── screens/
│   │       ├── WifiScreen.tsx
│   │       ├── BluetoothScreen.tsx
│   │       └── ...
│   │
│   ├── phone/                      ← 系统 App：电话
│   │   ├── manifest.ts
│   │   └── PhoneApp.tsx
│   │
│   ├── messages/                   ← 系统 App：短信
│   │   ├── manifest.ts
│   │   └── MessagesApp.tsx
│   │
│   ├── contacts/                   ← 系统 App：联系人
│   │   ├── manifest.ts
│   │   └── ContactsApp.tsx
│   │
│   ├── wechat/                     ← 第三方 App：微信
│   │   ├── manifest.ts
│   │   ├── WeChatApp.tsx
│   │   └── screens/
│   │
│   ├── alipay/                     ← 第三方 App：支付宝
│   │   ├── manifest.ts
│   │   └── AlipayApp.tsx
│   │
│   └── bilibili/                   ← 第三方 App：B站
│       ├── manifest.ts
│       └── BilibiliApp.tsx
│
├── simulator/                      ← 模拟器 Shell（手机外壳、屏幕容器）
│   ├── DeviceFrame.tsx             ← 手机外壳 UI
│   ├── Launcher.tsx                ← 桌面/启动器
│   ├── AppWindow.tsx               ← App 容器（管理前台 App）
│   └── GestureLayer.tsx            ← 手势捕获层
│
└── shared/                         ← 公共组件/工具
    ├── utils/
    │   ├── mergeDeep.ts
    │   └── cn.ts
    └── components/
        ├── Switch.tsx
        ├── Slider.tsx
        └── Icon.tsx
```

---

## 9. 关键代码示例

### 9.1 main.tsx — 初始化流程

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppRegistry } from './os/services/AppRegistry';
import { exposeSimAPI } from './os/SimAPI';

async function bootstrap() {
  // 1. 扫描并注册所有 App
  await AppRegistry.initialize();

  // 2. 暴露评测 API
  exposeSimAPI();

  // 3. 挂载 React
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
```

### 9.2 Settings App WiFi 页面示例

```typescript
// src/apps/settings/screens/WifiScreen.tsx
import { useOS } from '../../../os/hooks/useOS';
import { SystemService } from '../../../os/services/SystemService';

export function WifiScreen() {
  // 通过 OSBridge 读取系统状态（系统 App 也用 useOS，只是还可访问 systemService）
  const { system } = useOS('com.android.settings');
  const { wifi } = system;

  return (
    <div className="wifi-screen">
      <div className="setting-row">
        <span>WLAN</span>
        <Switch
          checked={wifi.enabled}
          onChange={(v) => SystemService.setWifiEnabled(v)}  // 写操作走 Service
        />
      </div>
      
      {wifi.enabled && (
        <div className="network-list">
          {wifi.nearbyNetworks.map(network => (
            <NetworkItem
              key={network.bssid}
              network={network}
              connected={wifi.connected && wifi.ssid === network.ssid}
              onConnect={() => SystemService.connectWifi(network.ssid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 9.3 微信 App 发通知示例

```typescript
// src/apps/wechat/WeChatApp.tsx
import { useOS } from '../../os/hooks/useOS';

const APP_ID = 'com.tencent.mm';

export default function WeChatApp() {
  const os = useOS(APP_ID);
  
  // 读取 App 自己的持久化状态
  const [chatState, setChatState] = useState(
    () => os.appStorage.get<WeChatState>() ?? DEFAULT_WECHAT_STATE
  );

  // 发送消息时触发通知
  const receiveMessage = (from: string, text: string) => {
    const newState = { ...chatState, unreadCount: chatState.unreadCount + 1 };
    setChatState(newState);
    os.appStorage.set(newState);  // 持久化到 sim:apps:com.tencent.mm

    // 通知系统发通知
    os.notify({
      title: from,
      body: text,
      category: 'message',
      actions: [{ key: 'reply', label: '回复' }, { key: 'mark_read', label: '标记已读' }],
    });
  };

  return <WeChatUI state={chatState} onReceive={receiveMessage} />;
}
```

---

## 附录：关键决策对比

### 为什么用 Zustand + Immer 而不是 Redux/Context？

| | Zustand + Immer | Redux Toolkit | React Context |
|---|---|---|---|
| 样板代码 | ✅ 极少 | ⚠️ 中等 | ✅ 少 |
| 选择性订阅 | ✅ 原生支持 | ✅ | ❌ 需手动 memo |
| 评测框架集成 | ✅ `getState()` 同步调用 | ✅ | ❌ 无法在组件外读取 |
| Immer 可变写法 | ✅ | ✅ | ❌ |
| DevTools | ✅ | ✅ | ❌ |
| 包大小 | ✅ ~3KB | ⚠️ ~15KB | ✅ 0 |

**核心原因**：`useSimStore.getState()` 可以在组件外（如 `SimAPI.getState()`、Service 方法）同步调用，这对评测框架至关重要。Context 无法做到这点。

### 为什么 App 状态独立存储而不是统一在系统状态树中？

1. **隔离重置**：评测时可以 `reset()` 系统状态但保留 App 数据，或反之
2. **避免大 JSON**：15 个 App 的状态合并后可能超过 1 MB，独立 key 分散写压力
3. **懒加载友好**：App 打开时才读取自己的 key，不影响启动时间
4. **调试友好**：直接在 DevTools 查看/编辑单个 App 数据
