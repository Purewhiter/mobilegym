/**
 * App 唯一标识符。
 * 新增 App 无需修改此文件 —— manifest.ts 自动发现。
 * 运行时验证通过 isValidAppId()（检查 APP_REGISTRY）。
 */
export type AppId = string;

/**
 * 已实现组件的 App ID（运行时由 hasAppComponent() 判定）。
 */
export type ImplementedAppId = string;

/** 单个 Activity 实例（Task 栈中的一层） */
export interface ActivityInstance {
  /** 全局唯一，如 act_1 */
  activityId: string;
  appId: AppId;
  /** 创建时的路由（用于首次导航） */
  initialRoute: string;
  /** 启动此 Activity 时的来源 Task（用于 finish 后回到调用方） */
  launchedByTaskId?: string;
  /** startActivityForResult 时的 Intent 载荷 */
  intent?: import('./types/manifest').IntentPayload;
  /** OS 分配的 requestCode（仅 intent activity 有） */
  requestCode?: number;
  /** 调用方 activityId（仅 intent activity 有） */
  callerActivityId?: string;
}

/** Task = 一组 Activity 的栈（bottom -> top） */
export interface Task {
  taskId: string;
  rootAppId: AppId;
  stack: ActivityInstance[];
  /** 最近激活时间（用于 MRU 排序） */
  lastActiveAt: number;
  /** 激活此 Task 时的前台 TaskId（用于 Task 返回栈：finish 时回到发起方） */
  launchedByTaskId?: string;
  /** 此 Task 的初始路由是否由外部 openApp(appId, route) 设置。
   *  true → Back 到底时 finish Task（等同 Android 非 launcher Activity 的 finish）
   *  false/undefined → Back 到底时 moveTaskToBack（Task 保活） */
  wasExternallyRouted?: boolean;
}

/** 由 tasks 派生的活跃 Intent 记录 */
export interface ActiveIntentEntry {
  requestCode: number;
  callerAppId: AppId;
  targetAppId: AppId;
  wasTargetRunning: boolean;
  intent: import('./types/manifest').IntentPayload;
  resolvedRoute: string;
}

export interface OSState {
  tasks: Task[];
  activeTaskId: string | null;
  /** 派生字段：当前前台 App 的 ID（从 activeTask 栈顶 Activity 推导） */
  readonly activeAppId?: AppId | null;
  isLauncherVisible: boolean;
  isRecentsVisible: boolean;
}

// ============================================================================
// System Shade / Notifications / Quick Settings
// ============================================================================

export type ShadePanelKind = 'notifications' | 'control';

export type PendingIntentToken = string;

export interface OSNotification {
  id: string;
  appId?: AppId;              // optional: system notifications may omit appId
  title: string;
  body?: string;
  timestamp: number;          // ms since epoch
  read: boolean;
  importance?: 'low' | 'default' | 'high';
  route?: string;             // optional: deep-link into app when tapped
  pendingIntent?: PendingIntentToken;
  /** When true (default), tapping the notification auto-dismisses it (Android setAutoCancel). */
  autoCancel?: boolean;
}

export interface OSNotificationSnapshot {
  items: OSNotification[];
  unreadCount: number;
}

export interface QuickSettingsState {
  wifiEnabled: boolean;
  mobileDataEnabled: boolean;
  bluetoothEnabled: boolean;
  airplaneModeEnabled: boolean;
  doNotDisturbEnabled: boolean;
  flashlightEnabled: boolean;
  batterySaverEnabled: boolean;
  rotationLocked: boolean;
  locationEnabled: boolean;
  nfcEnabled: boolean;
  screenCastEnabled: boolean;
  autoBrightnessEnabled: boolean;
  eyeComfortEnabled: boolean;
  darkModeEnabled: boolean;
}

export interface SystemShadeSnapshot {
  open: boolean;
  kind: ShadePanelKind;
}

// ============================================================================
// File System Types
// ============================================================================

/**
 * File/Directory node in the virtual file system
 */
export interface FSNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  parentId: string | null;      // null = root directory
  path: string;                 // Full path, e.g., /sdcard/DCIM/Camera/IMG_001.jpg

  // Metadata
  size: number;                 // File size in bytes (0 for directories)
  mimeType?: string;            // MIME type for files
  createdAt: number;            // Timestamp
  modifiedAt: number;           // Timestamp

  // Storage location marker
  storage: 'preset' | 'indexeddb' | 'memory';

  // Media-specific properties
  thumbnailUri?: string;        // Thumbnail for images/videos
  width?: number;               // Image/video width
  height?: number;              // Image/video height
  duration?: number;            // Video/audio duration in seconds
}

/**
 * Preset directory configuration
 */
export interface PresetDirectory {
  path: string;
  displayName?: string;         // Display name, e.g., "相机" for /DCIM/Camera
  icon?: string;
}

/**
 * Preset file configuration
 */
export interface PresetFile {
  path: string;
  uri: string;                  // Actual resource path (in public/ or URL)
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}

/**
 * File system configuration
 */
export interface FileSystemConfig {
  presetStructure: PresetDirectory[];
  presetFiles: PresetFile[];
}

// ============================================================================
// Media Service Types
// ============================================================================

/**
 * Media item (photo/video) for gallery
 */
export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  uri: string;                  // Display URI
  thumbnailUri?: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: number;
  path: string;                 // File system path
}

/**
 * Album for grouping media
 */
export interface Album {
  id: string;
  name: string;
  type: 'system' | 'app';       // System album vs app-specific
  coverUri?: string;
  coverPath?: string;           // Path for async loading
  count: number;
  pathPattern?: string;         // Path pattern to match, e.g., "/sdcard/DCIM/Camera"
}

/**
 * Media picker options
 */
export interface MediaPickerOptions {
  type?: 'image' | 'video' | 'all';
  multiple?: boolean;
  maxSelect?: number;
  albumId?: string;
  title?: string;
}

/**
 * Media picker result
 */
export interface MediaPickerResult {
  selected: MediaItem[];
  cancelled: boolean;
}
