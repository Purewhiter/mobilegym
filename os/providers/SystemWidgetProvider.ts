/**
 * OS-owned WMR ambient data: battery, dark mode, locale, wifi state, wallpaper
 * brightness, and the synthetic "cleanable memory" widget state.
 *
 * Why these live in OS
 * --------------------
 * These vars don't belong to any specific app — they reflect the host
 * environment that every widget shares (analogous to Android's
 * `android.content.res.Configuration` + system status). The OS owns the
 * underlying state stores (`OsStateStore`, `StatusBarService`,
 * `QuickSettingsService`, launcher wallpaper), so this provider just reads
 * from them and exposes domain-tagged ambient adapters.
 *
 * Registration
 * ------------
 * Registered explicitly via `os/providers/bootstrap.ts:ensureSystemWidgetProviderRegistered()`.
 * No URI dispatch — no current MAML bundle queries a `content://` URI for
 * these vars, so we only register ambient adapters.
 *
 * Also owns the `CLEAN_MEMORY` / `VIBRATE` / `CHANGE_POWER_SAVE_MODE` WMR
 * host broadcasts (formerly in `contentProviders.ts:handleWmrHostBroadcast`)
 * since the underlying state lives here.
 */
import AlarmManagerService, { type AlarmClockInfo } from '../AlarmManagerService';
import BroadcastBus from '../BroadcastBus';
import MediaSessionService from '../MediaSessionService';
import QuickSettingsService from '../QuickSettingsService';
import StatusBarService from '../StatusBarService';
import * as TimeService from '../TimeService';
import localeApi from '../locale';
import { useOsStateStore } from '../OsStateStore';
import { getEffectiveBuildInfo } from '../managers/registry';
import { DEFAULT_WALLPAPER_CHOICES } from '../launcher/layout';
import { LAUNCHER_STORAGE_KEY, type LauncherWallpaper } from '../launcher/types';
import {
  registerAmbientAdapter,
  type WmrAmbientAdapterResult,
} from '../wmr/engine/ambientAdapters';
import type { VarValue } from '../wmr/engine/types';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Memory widget state (cleanable-memory display + last-cleaned animation)
// ---------------------------------------------------------------------------

type MemoryWidgetState = {
  cleanableMemory: number;
  lastCleanedMemorySize: number;
  lastUpdatedAt: number;
  lastCleanedAt: number;
};

const memoryWidgetState: MemoryWidgetState = {
  cleanableMemory: 0,
  lastCleanedMemorySize: 0,
  lastUpdatedAt: 0,
  lastCleanedAt: 0,
};

function parseDeviceMemoryBytes(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1024 ? raw : raw * 1024 * 1024 * 1024;
  }
  const text = String(raw ?? '').trim().toUpperCase();
  const match = /^([\d.]+)\s*(GB|G|MB|M|KB|K|B)?$/.exec(text);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  const unit = match[2] ?? 'B';
  const factor = unit.startsWith('G')
    ? 1024 * 1024 * 1024
    : unit.startsWith('M')
      ? 1024 * 1024
      : unit.startsWith('K')
        ? 1024
        : 1;
  return Math.round(value * factor);
}

function parseNumericValue(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(num) ? num : fallback;
}

function estimateCleanableMemoryBytes(): number {
  const perfMemory = (typeof performance !== 'undefined' ? (performance as any).memory : null) as
    | { jsHeapSizeLimit?: number; usedJSHeapSize?: number; totalJSHeapSize?: number }
    | null;
  if (perfMemory?.jsHeapSizeLimit && perfMemory.usedJSHeapSize != null) {
    const headroom = Math.max(0, perfMemory.jsHeapSizeLimit - perfMemory.usedJSHeapSize);
    const reclaimable = Math.max(
      0,
      perfMemory.usedJSHeapSize - (perfMemory.totalJSHeapSize ?? perfMemory.usedJSHeapSize * 0.85),
    );
    const estimated = Math.round(
      Math.min(Math.max(reclaimable, perfMemory.usedJSHeapSize * 0.08), headroom * 0.25),
    );
    if (estimated > 0) return estimated;
  }

  const build = getEffectiveBuildInfo();
  const deviceBytes = parseDeviceMemoryBytes(build.ramTotal);
  if (deviceBytes > 0) {
    return Math.round(deviceBytes * 0.06);
  }

  const navigatorMemory = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : 0;
  if (typeof navigatorMemory === 'number' && navigatorMemory > 0) {
    return Math.round(navigatorMemory * 1024 * 1024 * 1024 * 0.06);
  }

  return 768 * 1024 * 1024;
}

function syncMemoryWidgetState(): void {
  const now = TimeService.realNow();
  if (memoryWidgetState.lastCleanedAt > 0 && now - memoryWidgetState.lastCleanedAt < 30_000) {
    return;
  }
  if (now - memoryWidgetState.lastUpdatedAt < 5_000) {
    return;
  }
  memoryWidgetState.cleanableMemory = estimateCleanableMemoryBytes();
  memoryWidgetState.lastUpdatedAt = now;
}

/** Snapshot for external callers (e.g. host broadcast dispatcher). */
export function getMemoryWidgetSnapshot(): Readonly<MemoryWidgetState> {
  syncMemoryWidgetState();
  return memoryWidgetState;
}

// ---------------------------------------------------------------------------
// Wallpaper brightness lookup (read-only — launcher state)
// ---------------------------------------------------------------------------

function getWallpaperIsLight(): number {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LAUNCHER_STORAGE_KEY) : null;
    if (!raw) return 0;
    const layout = JSON.parse(raw) as { wallpaper?: LauncherWallpaper };
    const wallpaper = layout.wallpaper;
    if (!wallpaper) return 0;
    const choice = DEFAULT_WALLPAPER_CHOICES.find(
      (item) => item.wallpaper.imageUrl === wallpaper.imageUrl,
    );
    return choice && !choice.isDark ? 1 : 0;
  } catch {
    // ignore
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Ambient adapters
// ---------------------------------------------------------------------------

function getDeviceAmbient(): WmrAmbientAdapterResult {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};

  const osState = useOsStateStore.getState();
  const statusBar = StatusBarService.getState();

  const batteryLevel = osState.hardware.battery.percent ?? statusBar.batteryPercent ?? 0;
  const charging = osState.hardware.battery.charging ?? statusBar.charging ?? false;
  const fastCharging = osState.hardware.battery.fastCharging ?? statusBar.fastCharging ?? false;

  vars.battery_level = batteryLevel;
  vars.battery_state = charging ? 1 : 0;
  vars.ChargeSpeed = fastCharging ? 2 : charging ? 1 : 0;
  vars.applied_light_wallpaper = getWallpaperIsLight();
  vars.__miui_version_code = 14;

  return { vars, arrays };
}

function getHostFlagsAmbient(): WmrAmbientAdapterResult {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};

  const qs = QuickSettingsService.getState();
  const locale = localeApi.getLocale();
  const lang = locale === 'en' ? 'en_US' : 'zh_CN';

  vars.lang = lang;
  vars.is_bo_cn = '0';
  vars.isPreviewMode = 'false';
  vars.wifi_state = qs.wifiEnabled ? 1 : 0;
  vars.data_state = qs.mobileDataEnabled ? 1 : 0;
  vars.__darkmode = qs.darkModeEnabled ? 1 : 0;
  vars.enable_background_blur = 0;

  return { vars, arrays };
}

/**
 * Clock ambient adapter — reads registered alarms from
 * {@link AlarmManagerService} (NOT from any specific clock app's private
 * store). Real Android equivalent: Lockscreen + status bar alarm icon call
 * `AlarmManager.getNextAlarmClock()`; the clock app (or any third-party
 * alarm app) publishes via `setAlarmClock()`. Same publish/subscribe
 * decoupling as MediaSession.
 *
 * The bundle inference also routes a few pedometer vars (`hassteps`,
 * `step_today`, `Mi_step[]`, etc.) into the clock domain via
 * `WmrBundleCache.CLOCK_PATTERN`. There's no step service yet, so we
 * emit static zeros — preserves the pre-refactor placeholder behavior.
 */
function daysOfWeekMaskForRepeat(info: AlarmClockInfo): string {
  // Bundle expects a Bose 7-bit bitmask string (Sun=1, Mon=2, ... Sat=64).
  switch (info.repeat) {
    case 'daily':
      return '127';
    case 'weekday':
    case 'workday':
      return '31';
    case 'holiday':
      return '96';
    case 'custom':
      return String(info.daysOfWeekMask ?? 0);
    case 'once':
    default:
      return '0';
  }
}

function getClockAmbient(): WmrAmbientAdapterResult {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};

  const alarms = AlarmManagerService.getRegisteredAlarmClocks();

  vars.hasAlarmClock = alarms.length;
  vars.AlarmDesk = alarms.length > 0 ? 1 : 0;

  // Pedometer placeholders — see file header. No real step service yet.
  vars.hassteps = 0;
  vars.step_today = 0;
  arrays.Mi_step = [];
  arrays.Mi_begin_time = [];
  arrays.Mi_end_time = [];

  if (alarms.length === 0) {
    vars.next_alarm_time = '';
    arrays.clock_message = [];
    arrays.clock_enabled = [];
    arrays.clock_hour = [];
    arrays.clock_minute = [];
    arrays.clock_alarmtime = [];
    arrays.clock_daysofweek = [];
    return { vars, arrays };
  }

  const weekLabel =
    localeApi.getLocale() === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const nextAlarm = alarms[0]; // already sorted by triggerAtMs ascending
  const nextDate = TimeService.fromTimestamp(nextAlarm.triggerAtMs);
  vars.next_alarm_time = `${weekLabel[nextDate.getDay()]} ${pad2(nextDate.getHours())}:${pad2(
    nextDate.getMinutes(),
  )}`;

  arrays.clock_message = alarms.map((alarm) => alarm.label);
  arrays.clock_enabled = alarms.map(() => '1');
  arrays.clock_hour = alarms.map((alarm) => String(alarm.hour));
  arrays.clock_minute = alarms.map((alarm) => String(alarm.minute));
  arrays.clock_alarmtime = alarms.map((alarm) => String(alarm.triggerAtMs));
  arrays.clock_daysofweek = alarms.map(daysOfWeekMaskForRepeat);

  return { vars, arrays };
}

/**
 * Music ambient adapter — reads the OS-level "now playing" state from
 * {@link MediaSessionService}, NOT from any specific music app. This mirrors
 * the real Android model where the music widget reads from
 * `MediaSessionManager.getActiveSessions()` and doesn't know which app is
 * the publisher.
 *
 * Publishers (e.g. `apps/Spotify/state.ts`) push their session here whenever
 * their playback state changes. Any future music app that publishes to the
 * same service will surface in the widget with zero changes to OS code.
 */
function getMusicAmbient(): WmrAmbientAdapterResult {
  const vars: Record<string, VarValue> = {};
  const arrays: Record<string, VarValue[]> = {};

  const session = MediaSessionService.getActiveSession();
  if (!session) {
    vars['music_control.music_state'] = 0;
    return { vars, arrays };
  }

  vars['music_control.music_state'] = session.isPlaying ? 1 : 0;
  vars['music_control.music_position'] = session.positionMs;
  vars['music_control.music_duration'] = Math.max(1, session.durationMs);
  vars['music_control.title'] = session.title;
  vars['music_control.artist'] = session.artist;
  vars['music_control.package'] = session.packageName;
  vars['music_control.class'] = session.activityClass;

  return { vars, arrays };
}

// ---------------------------------------------------------------------------
// WMR host broadcast handlers — formerly in contentProviders.ts. Returning
// true means the OS dispatcher should consider the broadcast handled.
// ---------------------------------------------------------------------------

export function handleSystemWidgetBroadcast(
  action: string,
  extras?: Record<string, unknown>,
  valueHints?: Record<string, number>,
): boolean {
  if (action === 'com.miui.intent.action.CLEAN_MEMORY') {
    syncMemoryWidgetState();
    const hintedFreed = Math.max(
      parseNumericValue(extras?.memoryCleanable, 0),
      parseNumericValue(extras?.lastCleanedMemorySize, 0),
      parseNumericValue(valueHints?.cleanableMemory, 0),
      parseNumericValue(valueHints?.memoryCleanable, 0),
      parseNumericValue(valueHints?.memoryCleanableAniVal, 0),
    );
    const freed = Math.max(memoryWidgetState.cleanableMemory, hintedFreed);
    memoryWidgetState.lastCleanedMemorySize = freed;
    memoryWidgetState.cleanableMemory = 0;
    memoryWidgetState.lastCleanedAt = TimeService.realNow();
    memoryWidgetState.lastUpdatedAt = memoryWidgetState.lastCleanedAt;
    return true;
  }

  if (action === 'com.miui.intent.action.VIBRATE') {
    const vibrateMs = Math.max(0, parseNumericValue(extras?.vibrate_milli, 0));
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && vibrateMs > 0) {
      navigator.vibrate(vibrateMs);
    }
    return true;
  }

  if (action === 'miui.intent.action.MAML_WIDGET_ADDED') {
    return true;
  }

  if (action === 'com.miui.intent.action.CHANGE_POWER_SAVE_MODE') {
    const open = extras?.POWER_SAVE_MODE_OPEN;
    const shouldEnable = open === true || open === 1 || open === '1';
    const qs = QuickSettingsService.getState();
    if (qs.batterySaverEnabled !== shouldEnable) {
      QuickSettingsService.set({ batterySaverEnabled: shouldEnable });
    }
    BroadcastBus.sendBroadcast({
      action: 'miui.intent.action.POWER_SAVE_MODE_CHANGED',
      extras: { POWER_SAVE_MODE_OPEN: shouldEnable ? 1 : 0, POWER_SAVE_MODE_OPEN_MAML: shouldEnable ? 1 : 0 },
    });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

let registered = false;

export function ensureSystemWidgetProviderRegistered(): void {
  if (registered) return;
  registered = true;
  registerAmbientAdapter('device', getDeviceAmbient);
  registerAmbientAdapter('hostFlags', getHostFlagsAmbient);
  registerAmbientAdapter('clock', getClockAmbient);
  registerAmbientAdapter('music', getMusicAmbient);
}
