import type { AppId, OSState } from '../types';
import type { IntentPayload, ActivityResult } from './manifest';
import type { StorageIsolationMode } from '../storageIsolation';

interface OSApi {
  state: OSState & { activeAppId?: AppId | null };
  getState(): OSState & { activeAppId?: AppId | null };
  getAppRoute(appId?: AppId | string): AppRouteInfo | null;
  launchApp(id: AppId): void;
  launchTaskById(taskId: string): void;
  goHome(): void;
  showRecents(): void;
  closeTask(taskId: string): void;
  closeApp(id: AppId): void;
  handleBack(): void;
  finishActivity(result?: ActivityResult): void;
  openApp(appId: AppId | string, initialRoute?: string): void;
  startActivityForResult(
    appIdOrIntent: AppId | string | IntentPayload,
    intentOrCallback?: IntentPayload | ((result: ActivityResult) => void),
    callbackOrUndefined?: (result: ActivityResult) => void,
  ): boolean;
  startActivity(
    appIdOrIntent: AppId | string | IntentPayload,
    intentOrOptions?: IntentPayload | { newTask?: boolean },
    options?: { newTask?: boolean },
  ): boolean;
  setResult(result: ActivityResult): void;
  hasActiveIntent(): boolean;
  getIntentPayload(appId?: AppId | string): IntentPayload | null;
  resolveActivity(intent: { action: string; scheme?: string; type?: string }): string[];
  setBrightness(value: number): void;
  setVolume(value: number): void;
  getSkin(): string;
  setSkin(id: string): void;

  notifications: {
    getState: () => import('../types').OSNotificationSnapshot;
    push: (input: Partial<import('../types').OSNotification> & Pick<import('../types').OSNotification, 'title'>) => import('../types').OSNotification;
    markRead: (id: string, read?: boolean) => void;
    dismiss: (id: string) => void;
    dismissByRoute: (appId: AppId, route: string) => void;
    clearAll: () => void;
    clearForApp: (appId: AppId) => void;
    subscribe: (listener: (snapshot: import('../types').OSNotificationSnapshot) => void) => () => void;
    onPush: (listener: (item: import('../types').OSNotification) => void) => () => void;
  };
  permissions: {
    getState: () => import('../permissions').PermissionSnapshot;
    checkPermission: (appId: AppId, permissionId: import('../permissions').PermissionId) => import('../permissions').PermissionStatus;
    checkPermissions: (appId: AppId, permissionIds: import('../permissions').PermissionId[]) => Partial<Record<import('../permissions').PermissionId, import('../permissions').PermissionStatus>>;
    requestPermissions: (appId: AppId, permissionIds: import('../permissions').PermissionId[], options?: import('../permissions').PermissionRequestOptions) => Promise<Partial<Record<import('../permissions').PermissionId, import('../permissions').PermissionStatus>>>;
    grantPermission: (appId: AppId, permissionId: import('../permissions').PermissionId) => void;
    revokePermission: (appId: AppId, permissionId: import('../permissions').PermissionId) => void;
    revokeAll: (appId: AppId) => void;
    getAppsWithPermissions: () => AppId[];
    getDeclaredPermissions: (appId: AppId) => import('../permissions').PermissionId[];
  };
  clipboard: {
    read: () => import('../ClipboardService').ClipboardItem | null;
    write: (item: Omit<import('../ClipboardService').ClipboardItem, 'timestamp'>) => void;
    getText: () => string | null;
    hasText: () => boolean;
    clear: () => void;
    getState: () => import('../ClipboardService').ClipboardServiceState;
    getHistory: () => import('../ClipboardService').ClipboardItem[];
    readHistory: (limit?: number) => import('../ClipboardService').ClipboardItem[];
    copyText: (text: string, source?: string) => void;
    copyImage: (uri: string, source?: string) => void;
  };
  statusBar: {
    getState: () => import('../StatusBarService').StatusBarDynamicState;
    reset: () => void;
    subscribe: (listener: (s: import('../StatusBarService').StatusBarDynamicState) => void) => () => void;
  };
  keyboard: {
    getState: () => import('../keyboard/KeyboardService').KeyboardServiceState;
    subscribe: (listener: (s: import('../keyboard/KeyboardService').KeyboardServiceState) => void) => () => void;
    show: () => void;
    hide: () => void;
    setHeight: (height: number) => void;
    setMode: (mode: import('../keyboard/KeyboardService').KeyboardMode) => void;
    toggleMode: () => void;
    isVisible: () => boolean;
    getHeight: () => number;
  };
  quickSettings: {
    getState: () => import('../types').QuickSettingsState;
    set: (patch: Partial<import('../types').QuickSettingsState>) => void;
    toggle: (key: keyof import('../types').QuickSettingsState) => void;
    reset: () => void;
    subscribe: (listener: (s: import('../types').QuickSettingsState) => void) => () => void;
  };
  shade: {
    getState: () => import('../types').SystemShadeSnapshot;
    open: (kind: import('../types').ShadePanelKind) => void;
    close: () => void;
    toggle: (kind: import('../types').ShadePanelKind) => void;
    isOpen: () => boolean;
    subscribe: (listener: (s: import('../types').SystemShadeSnapshot) => void) => () => void;
  };
  locale: {
    getLocale: () => import('../locale').Locale;
    setLocale: (locale: import('../locale').Locale) => void;
    subscribe: (listener: () => void) => () => void;
  };
  device: {
    getPreference: (key: string) => import('../managers/registry').DeviceSettingValue | undefined;
    setPreference: (key: string, value: import('../managers/registry').DeviceSettingValue, options?: import('../managers/registry').DeviceSetOptions) => void;
    setNearbyWifi: (list: import('../data/types').WifiAccessPointPreset[]) => void;
    setNearbyBluetooth: (list: import('../data/types').BluetoothDevicePreset[]) => void;
    connectWifi: (ssid: string) => void;
    disconnectWifi: () => void;
    connectBluetooth: (mac: string) => void;
    disconnectBluetooth: (mac: string) => void;
  };
  broadcast: {
    sendBroadcast: (intent: import('../types/broadcast').BroadcastIntent) => void;
    sendOrderedBroadcast: (intent: import('../types/broadcast').BroadcastIntent) => void;
    registerReceiver: (
      action: string,
      receiver: import('../types/broadcast').BroadcastReceiver,
      opts?: { priority?: number },
    ) => () => void;
    actions: typeof import('../BroadcastBus').BROADCAST_ACTIONS;
  };
  content: {
    registerProvider: (authority: string, provider: import('../ContentProvider').default) => void;
    query: <T = unknown>(uri: import('../types/content').ContentUri, projection?: string[]) => import('../types/content').Cursor<T>;
    insert: (uri: import('../types/content').ContentUri, values: import('../types/content').ContentValues) => import('../types/content').ContentUri;
    update: (uri: import('../types/content').ContentUri, values: import('../types/content').ContentValues, where?: string) => number;
    delete: (uri: import('../types/content').ContentUri, where?: string) => number;
    notifyChange: (uri: import('../types/content').ContentUri) => void;
    registerContentObserver: (uri: import('../types/content').ContentUri, cb: (uri: import('../types/content').ContentUri) => void) => () => void;
  };
  pendingIntent: {
    getActivity: (intent: IntentPayload) => import('../types').PendingIntentToken;
    getBroadcast: (intent: import('../types/broadcast').BroadcastIntent) => import('../types').PendingIntentToken;
    send: (token: import('../types').PendingIntentToken) => void;
  };
  sms: typeof import('../SmsGateway').SmsGateway;
}

interface SimApi {
  /** Clear all state WITHOUT reloading (for Playwright page.reload() pattern) */
  resetState(): Promise<void>;
  reset(seed?: number): Promise<void>;
  warmUpAllApps(): void;
  /** 动态导入全部 app state 模块，确保 Zustand store 已注册（不依赖 lazy App 是否已挂载） */
  preloadAllAppStores(): Promise<void>;
  /** 定向预加载指定 app 的 state 模块 */
  preloadAppStores(appIds: string[]): Promise<void>;
  waitForData(appIds?: string[]): Promise<void>;
  getState(): { os: Record<string, unknown>; apps: Record<string, unknown> };
  setState(
    patch: { apps?: Record<string, unknown>; os?: Record<string, unknown> },
    options?: { deep?: boolean; reload?: boolean },
  ): void;
}

interface SimTimeApi {
  now(): number;
  getDate(): Date;
  setRealTime(): void;
  setSimulatedTime(time: string | number, flowing?: boolean): void;
  setFlowing(flowing: boolean): void;
  /** Set speed multiplier. 1 = real-time, 100 = 100x faster. */
  setSpeed(speed: number): void;
  getSpeed(): number;
  getConfig(): { mode: 'real' | 'simulated'; simulatedTime?: string | number; flowing?: boolean; speed: number };
}

interface SimLocationApi {
  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions,
  ): void;
  watchPosition(
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions,
  ): number;
  clearWatch(watchId: number): void;
  setRealLocation(): void;
  setSimulatedLocation(coords: string | { latitude: number; longitude: number; accuracy?: number }): void;
  simulateError(code: 1 | 2 | 3, message?: string): void;
  clearError(): void;
  getConfig(): { mode: string; simulatedLocation?: unknown; simulateError?: unknown };
  getCoords(): { latitude: number; longitude: number; accuracy?: number; altitude?: number | null; altitudeAccuracy?: number | null; heading?: number | null; speed?: number | null } | null;
  presets: Record<string, { latitude: number; longitude: number; accuracy?: number }>;
}

interface SimAIApi {
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: Record<string, unknown>,
  ): Promise<{ success: boolean; content?: string; error?: string }>;
  simpleChat(
    prompt: string,
    systemPrompt?: string,
    options?: Record<string, unknown>,
  ): Promise<{ success: boolean; content?: string; error?: string }>;
  init(config: Record<string, unknown>): void;
  getConfig(): { defaultProvider: string; openai?: Record<string, unknown>; anthropic?: Record<string, unknown>; custom?: Record<string, unknown>; mock?: Record<string, unknown> };
  getSystemDefaults(): Record<string, unknown>;
  setProvider(provider: string): void;
  configureOpenAI(config: Record<string, unknown>): void;
  configureAnthropic(config: Record<string, unknown>): void;
  configureCustom(config: Record<string, unknown>): void;
  configureMock(config: Record<string, unknown>): void;
  buildMessages(
    history: Array<{ content: string; isUser: boolean }>,
    systemPrompt?: string,
    maxMessages?: number,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  estimateTokens(text: string): number;
}

interface SimFSApi {
  list(path: string): unknown[];
  mkdir(path: string, name: string): Promise<unknown>;
  read(path: string): Promise<Blob | null>;
  write(path: string, content: string | Blob | ArrayBuffer, options?: { mimeType?: string }): Promise<unknown>;
  delete(path: string): Promise<boolean>;
  move(fromPath: string, toPath: string, newName?: string): Promise<unknown>;
  copy(sourcePath: string, destPath: string, newName?: string): Promise<unknown>;
  stat(path: string): unknown | null;
  exists(path: string): boolean;
  search(query: string, options?: Record<string, unknown>): unknown[];
  getMedia(): unknown[];
  getByPath(prefix: string): unknown[];
  getUri(path: string): string | null;
  getUriAsync(path: string): Promise<string | null>;
  formatSize?(bytes: number): string;
  getDisplayName?(path: string): string;
  refresh(): Promise<void>;
  reset(): Promise<void>;
}

interface SimMediaApi {
  getAlbums(): unknown[];
  getItems(options?: { albumId?: string; type?: string }): unknown[];
  getItem(id: string): unknown | null;
  pick(options?: Record<string, unknown>): Promise<unknown>;
  save(uri: string, options?: Record<string, unknown>): Promise<unknown>;
  delete(pathOrId: string): Promise<boolean>;
  simulateSelect(itemIds: string[]): void;
}

declare global {
  interface AppRouteInfo {
    app: string;
    path: string;
  }

  type RequestIdleCallbackHandle = number;
  interface IdleDeadline {
    readonly didTimeout: boolean;
    timeRemaining(): number;
  }

  interface Window {
    requestIdleCallback(callback: (deadline: IdleDeadline) => void, options?: { timeout: number }): RequestIdleCallbackHandle;
    cancelIdleCallback(handle: RequestIdleCallbackHandle): void;
    __OS__?: OSApi;
    __SIM__?: SimApi;
    __SIM_TIME__?: SimTimeApi;
    __SIM_LOCATION__?: SimLocationApi;
    __SIM_AI__?: SimAIApi;
    __SIM_FS__?: SimFSApi;
    __SIM_MEDIA__?: SimMediaApi;
    __STORAGE_ISOLATION__?: { mode: StorageIsolationMode; namespace: string | null };

    __SIM_INPUT__?: import('../simInput').SimInputAPI;
    __SIM_QUERY__?: import('../simInput').SimQueryAPI;

    __getScrollMeta__?: () => import('../scrollMeta').ScrollMetaMap;
  }
}

export {};
