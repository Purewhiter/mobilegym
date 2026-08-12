import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SIMULATOR_CONFIG } from '../data';
const { statusBarHeight, zIndexSystemShade, transitionDuration } = SIMULATOR_CONFIG.framework;
import { useOS } from '../OSContext';
import { useOsStateStore } from '../OsStateStore';
import { useTheme } from '../ThemeContext';
import * as TimeService from '../TimeService';
import { SystemShadeService } from '../SystemShadeService';
import { NotificationService } from '../NotificationService';
import { QuickSettingsService } from '../QuickSettingsService';
import StatusBarService from '../StatusBarService';
import type {
  OSNotification,
  OSNotificationSnapshot,
  QuickSettingsState,
  ShadePanelKind,
  SystemShadeSnapshot,
} from '../types';
import { getAppManifest } from '../data/appRegistry';
import { AppIcon } from './AppIcon';
import { PendingIntent } from '../PendingIntent';
import { useLocale, type Locale } from '../locale';
import {
  getShadeDragOffset,
  getShadeSwipeTarget,
  getShadeWheelOffset,
  getShadeWheelTarget,
  SHADE_SWITCH_DOMINANCE,
  shouldIgnoreShadePanelGestureStart,
} from './systemShadeGestures';
import {
  Bell,
  BellOff,
  BatteryCharging,
  Bluetooth,
  Cast,
  Eye,
  Image as ImageIcon,
  Lock,
  MapPin,
  Moon,
  Plane,
  Play,
  Scissors,
  Settings,
  Signal,
  SkipBack,
  SkipForward,
  Sun,
  Ticket,
  Volume2,
  Wifi,
  BatteryMedium,
  Zap,
} from 'lucide-react';

function formatShadeDate(d: Date, locale: Locale): string {
  if (locale === 'en') {
    return TimeService.formatDateTimeForLocale(d, {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  }
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${m}月${day}日 ${week}`;
}

function formatHM(ts: number, locale: Locale): string {
  try {
    const d = TimeService.fromTimestamp(ts);
    return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function BackgroundBlur() {
  // Match system control-center: blurred wallpaper + dark veil.
  return {
    backdropFilter: 'blur(22px)',
    background:
      'radial-gradient(1200px 700px at 20% 15%, rgba(255,255,255,0.10), rgba(255,255,255,0.00) 55%), linear-gradient(180deg, rgba(40,50,70,0.62), rgba(35,45,65,0.62))',
  } as React.CSSProperties;
}

const connectivityTileBaseClassName =
  'h-[72px] rounded-[22px] px-5 flex items-center justify-between shadow-sm active:scale-[0.99] transition-transform';
const connectivityTileActiveClassName = `${connectivityTileBaseClassName} bg-white/95`;
const connectivityTileInactiveClassName =
  `${connectivityTileBaseClassName} bg-black/25 backdrop-blur-2xl border border-white/10`;
const connectivityIconSlotClassName = 'w-[26px] h-[26px] shrink-0 flex items-center justify-center';

type ConnectivityTileVisual = {
  tileClassName: string;
  iconSlotClassName: string;
  title: string;
  subtitle: string;
  iconClassName: string;
  titleClassName: string;
  subtitleClassName: string;
};

function shadeText(locale: Locale, zh: string, en: string): string {
  return locale === 'en' ? en : zh;
}

function cleanTileLabel(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getWifiTileVisual(enabled: boolean, ssid: string | undefined, locale: Locale): ConnectivityTileVisual {
  if (!enabled) {
    return {
      tileClassName: connectivityTileInactiveClassName,
      iconSlotClassName: connectivityIconSlotClassName,
      title: shadeText(locale, 'WLAN', 'WLAN'),
      subtitle: shadeText(locale, '已关闭', 'Off'),
      iconClassName: 'text-white/85',
      titleClassName: 'text-white/85',
      subtitleClassName: 'text-white/50',
    };
  }

  return {
    tileClassName: connectivityTileActiveClassName,
    iconSlotClassName: connectivityIconSlotClassName,
    title: cleanTileLabel(ssid) || shadeText(locale, 'WLAN', 'WLAN'),
    subtitle: shadeText(locale, '已连接', 'Connected'),
    iconClassName: 'text-blue-500',
    titleClassName: 'text-black/90',
    subtitleClassName: 'text-black/45',
  };
}

function getMobileDataTileVisual(enabled: boolean, carrier: string, locale: Locale): ConnectivityTileVisual {
  if (!enabled) {
    return {
      tileClassName: connectivityTileInactiveClassName,
      iconSlotClassName: connectivityIconSlotClassName,
      title: carrier,
      subtitle: shadeText(locale, '已关闭', 'Off'),
      iconClassName: 'text-white/85',
      titleClassName: 'text-white/85',
      subtitleClassName: 'text-white/50',
    };
  }

  return {
    tileClassName: connectivityTileActiveClassName,
    iconSlotClassName: connectivityIconSlotClassName,
    title: carrier,
    subtitle: shadeText(locale, '已开启', 'On'),
    iconClassName: 'text-emerald-500',
    titleClassName: 'text-black/90',
    subtitleClassName: 'text-black/45',
  };
}

const ScrollingTileText: React.FC<{
  text: string;
  className: string;
}> = ({ text, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const distance = textEl.scrollWidth - container.clientWidth;
      setScrollDistance(distance > 1 ? textEl.scrollWidth + 24 : 0);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(textEl);
    return () => ro.disconnect();
  }, [text]);

  const isScrolling = scrollDistance > 0;
  const animationDuration = `${Math.max(7, Math.min(14, scrollDistance / 14))}s`;
  const marqueeStyle = isScrolling
    ? ({
      '--system-shade-title-scroll': `-${scrollDistance}px`,
      animation: `system-shade-title-marquee ${animationDuration} linear infinite`,
    } as React.CSSProperties)
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative min-w-0 max-w-full overflow-hidden whitespace-nowrap text-left text-[16px] font-medium ${className}`}
      aria-label={text}
    >
      <span className={isScrolling ? 'inline-flex w-max' : 'block'} style={marqueeStyle}>
        <span ref={textRef} className="block">{text}</span>
        {isScrolling ? <span className="block pl-6">{text}</span> : null}
      </span>
      <style>{`
        @keyframes system-shade-title-marquee {
          0%, 12% { transform: translateX(0); }
          88%, 100% { transform: translateX(var(--system-shade-title-scroll)); }
        }
      `}</style>
    </div>
  );
};

const NotificationCenterPanel: React.FC<{
  snapshot: OSNotificationSnapshot;
  onClose: () => void;
  onOpenNotification: (it: OSNotification) => void;
  withBackground?: boolean;
}> = ({ snapshot, onOpenNotification, withBackground = true }) => {
  const locale = useLocale();
  const now = useMemo(() => TimeService.getDate(), [snapshot.items.length, snapshot.unreadCount]);
  const timeText = useMemo(() => `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`, [now]);
  const dateText = useMemo(() => formatShadeDate(now, locale), [locale, now]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamically toggle touch-action on the scroll container so that
  // swipe-up-to-close works in touch mode when the list is at the top.
  // When scrollTop===0, set touch-action:none so the browser won't steal
  // the upward swipe for native scrolling; otherwise allow pan-y for normal scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      el.style.touchAction = el.scrollTop <= 1 ? 'none' : 'pan-y';
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    return () => el.removeEventListener('scroll', sync);
  }, [snapshot.items.length]);

  return (
    <div
      className="h-full w-full text-white flex flex-col"
      data-status-bar-foreground="light"
      style={withBackground ? BackgroundBlur() : undefined}
    >
      <div className="shrink-0 px-6" style={{ paddingTop: statusBarHeight + 18 }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[64px] leading-none font-light text-white">{timeText}</div>
            <div className="mt-1 text-[15px] text-white/75">{dateText}</div>
          </div>
          <div className="relative w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center">
            <Bell size={20} className="text-white/85" />
            {snapshot.unreadCount > 0 && (
              <div className="absolute right-[10px] top-[10px] w-1.5 h-1.5 rounded-full bg-white/85" />
            )}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mt-10 px-6 pb-10 min-h-0 flex-1 overflow-y-auto no-scrollbar"
        data-shade-scroll="true"
      >
        {snapshot.items.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-white/35 text-[16px]">
            {locale === 'en' ? 'No notifications' : '暂无通知消息'}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] text-white/55">{locale === 'en' ? `Unread ${snapshot.unreadCount}` : `未读 ${snapshot.unreadCount}`}</div>
              <button
                type="button"
                className="text-[13px] text-white/70 active:text-white/90"
                onClick={() => {
                  NotificationService.clearAll();
                  // If clearing leaves empty, match system by staying on the empty page.
                }}
              >
                {locale === 'en' ? 'Clear all' : '清除全部'}
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {snapshot.items.map(it => (
                <div
                  key={it.id}
                  className="bg-black/25 backdrop-blur-2xl border border-white/10 rounded-2xl px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
                  onClick={() => onOpenNotification(it)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {it.appId ? (() => {
                        const manifest = getAppManifest(it.appId);
                        return manifest ? (
                          <AppIcon manifest={manifest} size={40} radius={12} showShadow={false} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                            <Bell size={18} className="text-white/75" />
                          </div>
                        );
                      })() : (
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <Bell size={18} className="text-white/75" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!it.read && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                          <div className="text-[14px] font-medium text-white/90 truncate">
                            {it.title}
                          </div>
                        </div>
                        {it.body && (
                          <div className="mt-0.5 text-[13px] text-white/60 truncate">
                            {it.body}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[12px] text-white/45 shrink-0">
                      {formatHM(it.timestamp, locale)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const NfcGlyph: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`text-[18px] font-semibold ${active ? 'text-blue-500' : 'text-blue-300'}`}>N</span>
);

const CircleButton: React.FC<{
  active?: boolean;
  onClick?: () => void;
  activeIconClassName?: string;
  children: React.ReactNode;
  ariaLabel: string;
}> = ({ active = false, onClick, children, activeIconClassName, ariaLabel }) => {
  const { themeService, version } = useTheme();
  const themedBg = themeService.getShadeTileBackground(active ? 'active' : 'inactive');
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-transform active:scale-95 ${themedBg ? 'bg-transparent shadow-sm' : active ? 'bg-white/95 shadow-sm' : 'bg-black/25 backdrop-blur-2xl border border-white/10'
        }`}
      onClick={onClick}
      style={
        themedBg
          ? { backgroundImage: `url(${themedBg})`, backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
          : undefined
      }
    >
      <div className={active ? (activeIconClassName ?? 'text-black') : 'text-white/85'}>
        <span key={version}>{children}</span>
      </div>
    </button>
  );
};

const VerticalSlider: React.FC<{
  value: number;
  onChange: (v: number) => void;
  icon: React.ReactNode;
  iconClassName: string;
}> = ({ value, onChange, icon, iconClassName }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pid: number;
    active: boolean;
    pointerType: string;
    startY: number;
    startValue: number;
    h: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // System-like: press then swipe; tap alone does nothing.
    const h = Math.max(1, (e.currentTarget as HTMLDivElement).getBoundingClientRect().height);
    dragRef.current = {
      pid: e.pointerId,
      active: true,
      pointerType: e.pointerType,
      startY: e.clientY,
      startValue: value,
      h,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Prevent page/overlay from hijacking the gesture.
    e.preventDefault?.();
    e.stopPropagation?.();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current?.active || dragRef.current.pid !== e.pointerId) return;
    const s = dragRef.current;
    const dy = e.clientY - s.startY;
    if (!s.moved) {
      // Small threshold to avoid treating tap jitter as swipe.
      const SWIPE_START_PX = s.pointerType === 'mouse' ? 2 : 6;
      if (Math.abs(dy) < SWIPE_START_PX) return;
      s.moved = true;
    }
    e.preventDefault?.();
    e.stopPropagation?.();
    // Swipe up (clientY decreases) => increase value. 1:1 pixel follow.
    const delta = (-dy / Math.max(1, s.h)) * 100;
    const next = Math.max(0, Math.min(100, Math.round(s.startValue + delta)));
    onChange(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pid !== e.pointerId) return;
    const s = dragRef.current;
    if (s?.moved) {
      // Ensure final position is applied (some environments may deliver sparse move events).
      const dy = e.clientY - s.startY;
      const delta = (-dy / Math.max(1, s.h)) * 100;
      const next = Math.max(0, Math.min(100, Math.round(s.startValue + delta)));
      onChange(next);
    }
    dragRef.current = null;
  };

  const TRACK_H = 160;
  const ICON_SIZE = 22;
  const PAD = 12;
  const v = Math.max(0, Math.min(100, value));
  const fillPx = (v / 100) * TRACK_H;
  // Keep icon inside filled area; center it when fill is large enough.
  let iconBottom = fillPx / 2 - ICON_SIZE / 2;
  if (fillPx < ICON_SIZE + PAD * 2) {
    iconBottom = PAD;
  } else {
    iconBottom = Math.max(PAD, Math.min(fillPx - ICON_SIZE - PAD, iconBottom));
  }
  const fillH = `${v}%`;

  return (
    <div
      data-shade-slider="true"
      className="relative w-full h-[160px] rounded-[28px] overflow-hidden border border-white/10 backdrop-blur-2xl bg-gradient-to-b from-black/25 to-indigo-900/15 touch-none"
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="absolute inset-x-0 bottom-0 bg-white/95 pointer-events-none" style={{ height: fillH }} />
      <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ bottom: `${iconBottom}px` }}>
        <div className={`${iconClassName} pointer-events-none`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const ControlCenterPanel: React.FC<{
  qs: QuickSettingsState;
  wifiSsid?: string;
  brightness: number;
  volume: number;
  onClose: () => void;
  onToggle: (key: keyof QuickSettingsState) => void;
  onSetBrightness: (v: number) => void;
  onSetVolume: (v: number) => void;
  withBackground?: boolean;
}> = ({ qs, wifiSsid, brightness, volume, onClose, onToggle, onSetBrightness, onSetVolume, withBackground = true }) => {
  const locale = useLocale();
  const { themeService, version } = useTheme();
  const sbState = useSyncExternalStore(StatusBarService.subscribe, StatusBarService.getState);
  const batteryPct = Math.min(Math.max(sbState.batteryPercent, 0), 100);
  const shadeIconTintFilter = 'brightness(0) invert(1)';
  const shadeStatusIconClassName = 'w-[14px] h-[14px] object-contain';
  const wifiVisible = qs.wifiEnabled;
  const btVisible = qs.bluetoothEnabled;
  const airplaneMode = qs.airplaneModeEnabled;
  const noSim = sbState.noSim;
  const signalVisible = !airplaneMode && !noSim;
  const nfcUrl = qs.nfcEnabled ? themeService.getStatusBarIcon('nfc') : null;
  const btUrl = btVisible ? themeService.getStatusBarIcon('bluetooth') : null;
  const airplaneUrl = airplaneMode ? themeService.getStatusBarIcon('airplane') : null;
  const noSimUrl = !airplaneMode && noSim
    ? themeService.getStatusBarIcon('no_sim') || themeService.getStatusBarIcon('signal_null')
    : null;
  const signalUrl = signalVisible ? themeService.getStatusBarSignalIcon(sbState.signalLevel) : null;
  const dataTypeVisible =
    signalVisible && qs.mobileDataEnabled && sbState.mobileDataType !== 'none';
  const dataTypeUrl = dataTypeVisible ? themeService.getStatusBarDataTypeIcon(sbState.mobileDataType) : null;
  const wifiUrl = wifiVisible ? themeService.getStatusBarWifiIcon(sbState.wifiLevel) : null;
  // Theme-first / system-fallback (mirrors SystemShell logic):
  const baseSprite = themeService.getStatusBarBatterySprite();
  const lowBattery = !sbState.charging && sbState.batteryPercent < 20;

  let themeRgbaSprite: { url: string; frames: number; frameSide: number } | null = null;
  let rgbaHasBakedBolt = false;
  if (qs.batterySaverEnabled && sbState.charging) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save_charge');
    if (themeRgbaSprite) rgbaHasBakedBolt = true;
    if (!themeRgbaSprite) {
      themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save');
    }
  } else if (sbState.charging) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('charge');
    if (themeRgbaSprite) rgbaHasBakedBolt = true;
  } else if (qs.batterySaverEnabled) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save');
  }

  const batterySprite = themeRgbaSprite ?? baseSprite;
  const useThemeRgba = themeRgbaSprite !== null;
  const batteryFallback = themeService.getStatusBarIcon('battery');
  const batteryFrames = batterySprite?.frames ?? 0;
  const batteryFrameIdx =
    batterySprite && batteryFrames > 1
      ? Math.min(Math.max(Math.floor(((batteryFrames - 1) * batteryPct) / 100), 0), batteryFrames - 1)
      : 0;
  // System-tint color used when no theme variant matches.
  const systemTintColor = qs.batterySaverEnabled
    ? '#F5C518'
    : sbState.charging
      ? '#22C55E'
      : lowBattery
        ? '#EF4444'
        : '#FFFFFF';
  const needsBoltOverlay = sbState.charging && !rgbaHasBakedBolt;
  const batteryBoltUrl = needsBoltOverlay
    ? themeService.getStatusBarBatteryBoltOverlay()
    : null;
  const batteryBoltCoreColor = sbState.fastCharging ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.78)';
  const batteryBoltHaloColor = systemTintColor;
  const now = useMemo(() => TimeService.getDate(), [qs]);
  const dateText = useMemo(() => formatShadeDate(now, locale), [locale, now]);
  const shadeText = useMemo(() => ({
    connected: locale === 'en' ? 'Connected' : '已连接',
    off: locale === 'en' ? 'Off' : '已关闭',
    on: locale === 'en' ? 'On' : '已开启',
    mobileData: locale === 'en' ? 'Mobile data' : '移动数据',
    bluetooth: locale === 'en' ? 'Bluetooth' : '蓝牙',
    airplane: locale === 'en' ? 'Airplane mode' : '飞行模式',
    silent: locale === 'en' ? 'Silent' : '静音',
    flashlight: locale === 'en' ? 'Flashlight' : '手电筒',
    screenshot: locale === 'en' ? 'Screenshot' : '截屏',
    screenshotDone: locale === 'en' ? 'Screenshot simulated' : '已模拟截屏',
    screenshotHint: locale === 'en' ? '(Control Center demo)' : '（控制中心示意）',
    batterySaver: locale === 'en' ? 'Battery saver' : '省电模式',
    cast: locale === 'en' ? 'Cast' : '投屏',
    rotationLock: locale === 'en' ? 'Rotation lock' : '旋转锁定',
    gallery: locale === 'en' ? 'Gallery' : '相册',
    settings: locale === 'en' ? 'Settings' : '设置',
    display: locale === 'en' ? 'Display' : '显示',
    pass: locale === 'en' ? 'Cards' : '票证',
    passHint: locale === 'en' ? '(Placeholder)' : '（占位）',
    eyeComfort: locale === 'en' ? 'Eye comfort' : '护眼',
    location: locale === 'en' ? 'Location' : '定位',
    darkMode: locale === 'en' ? 'Dark mode' : '深色',
    noMedia: locale === 'en' ? 'Nothing playing' : '暂无播放',
    edit: locale === 'en' ? 'Edit' : '编辑',
    carrier: locale === 'en' ? 'China Unicom' : '中国联通',
    carrierHd: locale === 'en' ? 'China Telecom HD | China Unicom HD' : '中国电信HD | 中国联通HD',
  }), [locale]);

  const getTileStyle = (active: boolean, className: string): { className: string; style?: React.CSSProperties } => {
    const bg = themeService.getShadeTileBackground(active ? 'active' : 'inactive');
    if (!bg) return { className };
    return {
      className: className
        .replace('bg-white/95', 'bg-transparent')
        .replace('bg-black/25', 'bg-transparent'),
      style: { backgroundImage: `url(${bg})`, backgroundSize: '100% 100%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' },
    };
  };

  const WifiTile = () => {
    const visual = getWifiTileVisual(qs.wifiEnabled, wifiSsid, locale);
    const t = getTileStyle(qs.wifiEnabled, visual.tileClassName);
    return (
      <button type="button" className={t.className} style={t.style} onClick={() => onToggle('wifiEnabled')} aria-label="Wi‑Fi">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className={visual.iconSlotClassName}>
            <Wifi key={version} size={26} strokeWidth={2} className={`block ${visual.iconClassName}`} />
          </span>
          <div className="min-w-0 flex-1">
            <ScrollingTileText text={visual.title} className={visual.titleClassName} />
            <div className={`text-left text-[12px] ${visual.subtitleClassName}`}>{visual.subtitle}</div>
          </div>
        </div>
      </button>
    );
  };

  const MobileDataTile = () => {
    const visual = getMobileDataTileVisual(qs.mobileDataEnabled, shadeText.carrier, locale);
    const t = getTileStyle(qs.mobileDataEnabled, visual.tileClassName);
    return (
      <button type="button" className={t.className} style={t.style} onClick={() => onToggle('mobileDataEnabled')} aria-label={shadeText.mobileData}>
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className={visual.iconSlotClassName}>
            <Signal key={version} size={26} strokeWidth={2} className={`block ${visual.iconClassName}`} />
          </span>
          <div className="min-w-0 flex-1">
            <ScrollingTileText text={visual.title} className={visual.titleClassName} />
            <div className={`text-left text-[12px] ${visual.subtitleClassName}`}>{visual.subtitle}</div>
          </div>
        </div>
      </button>
    );
  };

  const openSettings = () => {
    onClose();
    const os = window.__OS__;
    if (os && typeof os.openApp === 'function') {
      os.openApp('settings');
    }
  };

  const grid = [
    // row 1
    { kind: 'toggle' as const, key: 'bluetoothEnabled' as const, activeIcon: 'text-blue-500', icon: <Bluetooth size={22} />, label: shadeText.bluetooth },
    { kind: 'toggle' as const, key: 'airplaneModeEnabled' as const, activeIcon: 'text-black', icon: <Plane size={22} />, label: shadeText.airplane },
    { kind: 'toggle' as const, key: 'doNotDisturbEnabled' as const, activeIcon: 'text-red-500', icon: <BellOff size={22} />, label: shadeText.silent },
    { kind: 'toggle' as const, key: 'flashlightEnabled' as const, activeIcon: 'text-black', icon: <Zap size={22} />, label: shadeText.flashlight },
    // row 2
    { kind: 'action' as const, id: 'screenshot', active: false, activeIcon: 'text-black', icon: <Scissors size={22} />, label: shadeText.screenshot, onClick: () => NotificationService.push({ title: shadeText.screenshotDone, body: shadeText.screenshotHint, read: true }) },
    { kind: 'toggle' as const, key: 'batterySaverEnabled' as const, activeIcon: 'text-black', icon: <BatteryCharging size={22} />, label: shadeText.batterySaver },
    { kind: 'toggle' as const, key: 'screenCastEnabled' as const, activeIcon: 'text-black', icon: <Cast size={22} />, label: shadeText.cast },
    { kind: 'toggle' as const, key: 'rotationLocked' as const, activeIcon: 'text-blue-500', icon: <Lock size={22} />, label: shadeText.rotationLock },
    // row 3
    { kind: 'action' as const, id: 'gallery', active: false, activeIcon: 'text-black', icon: <ImageIcon size={22} />, label: shadeText.gallery, onClick: () => { onClose(); window.__OS__?.openApp?.('gallery'); } },
    { kind: 'action' as const, id: 'settings', active: false, activeIcon: 'text-black', icon: <Settings size={22} />, label: shadeText.settings, onClick: openSettings },
    {
      kind: 'toggle' as const, key: 'autoBrightnessEnabled' as const, activeIcon: 'text-amber-500', icon: (
        <div className="relative">
          <Sun size={22} />
          <span className="absolute -right-1 -top-1 text-[10px] font-semibold">A</span>
        </div>
      ), label: shadeText.display
    },
    { kind: 'toggle' as const, key: 'nfcEnabled' as const, activeIcon: 'text-blue-500', icon: <NfcGlyph active={qs.nfcEnabled} />, label: 'NFC' },
    // row 4
    { kind: 'action' as const, id: 'ticket', active: false, activeIcon: 'text-black', icon: <Ticket size={22} />, label: shadeText.pass, onClick: () => NotificationService.push({ title: shadeText.pass, body: shadeText.passHint, read: true }) },
    { kind: 'toggle' as const, key: 'eyeComfortEnabled' as const, activeIcon: 'text-black', icon: <Eye size={22} />, label: shadeText.eyeComfort },
    { kind: 'toggle' as const, key: 'locationEnabled' as const, activeIcon: 'text-blue-500', icon: <MapPin size={22} />, label: shadeText.location },
    { kind: 'toggle' as const, key: 'darkModeEnabled' as const, activeIcon: 'text-black', icon: <Moon size={22} />, label: shadeText.darkMode },
  ];

  return (
    <div className="h-full w-full text-white" data-status-bar-foreground="light" style={withBackground ? BackgroundBlur() : undefined}>
      <div className="px-4" style={{ paddingTop: statusBarHeight + 18 }}>
        <div className="flex justify-end">
          <div className="text-[12px] text-white/55 leading-none text-right">{shadeText.carrierHd}</div>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-[15px] text-white/80 leading-none">
            {dateText}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-white/85 text-[12px] leading-none">
            {nfcUrl ? (
              <img
                key={`shade_nfc_${version}`}
                src={nfcUrl}
                className={shadeStatusIconClassName}
                style={{ filter: shadeIconTintFilter }}
                alt="nfc"
              />
            ) : null}
            {btVisible ? (
              btUrl ? (
                <img
                  key={`shade_bt_${version}`}
                  src={btUrl}
                  className={shadeStatusIconClassName}
                  style={{ filter: shadeIconTintFilter }}
                  alt="bluetooth"
                />
              ) : (
                <Bluetooth size={14} />
              )
            ) : null}
            {airplaneMode ? (
              airplaneUrl ? (
                <img
                  key={`shade_airplane_${version}`}
                  src={airplaneUrl}
                  className={shadeStatusIconClassName}
                  style={{ filter: shadeIconTintFilter }}
                  alt="airplane"
                />
              ) : (
                <Plane size={14} />
              )
            ) : noSim ? (
              noSimUrl ? (
                <img
                  key={`shade_no_sim_${version}`}
                  src={noSimUrl}
                  className={shadeStatusIconClassName}
                  style={{ filter: shadeIconTintFilter }}
                  alt="no-sim"
                />
              ) : null
            ) : signalUrl ? (
              <img
                key={`shade_signal_${sbState.signalLevel}_${version}`}
                src={signalUrl}
                className={shadeStatusIconClassName}
                style={{ filter: shadeIconTintFilter }}
                alt="signal"
              />
            ) : (
              <Signal size={14} />
            )}
            {dataTypeUrl ? (
              <img
                key={`shade_data_${sbState.mobileDataType}_${version}`}
                src={dataTypeUrl}
                className={shadeStatusIconClassName}
                style={{ filter: shadeIconTintFilter }}
                alt={`data-${sbState.mobileDataType}`}
              />
            ) : null}
            {wifiVisible ? (
              wifiUrl ? (
                <img
                  key={`shade_wifi_${sbState.wifiLevel}_${version}`}
                  src={wifiUrl}
                  className={shadeStatusIconClassName}
                  style={{ filter: shadeIconTintFilter }}
                  alt="wifi"
                />
              ) : (
                <Wifi size={14} />
              )
            ) : null}
            <div className="flex items-center gap-1 text-white/90">
              <span className="text-[11px] leading-none">{batteryPct}%</span>
              {batterySprite ? (
                <div
                  key={`shade_battery_${batteryPct}_${sbState.charging ? 1 : 0}_${sbState.fastCharging ? 1 : 0}_${qs.batterySaverEnabled ? 1 : 0}_${useThemeRgba ? 'r' : 't'}_${version}`}
                  className="relative w-[18px] h-[18px]"
                  aria-label="battery"
                >
                  {useThemeRgba ? (
                    <div
                      className="absolute inset-0 bg-no-repeat"
                      style={{
                        backgroundImage: `url(${batterySprite.url})`,
                        backgroundSize: `18px ${batteryFrames * 18}px`,
                        backgroundPosition: `0px ${-batteryFrameIdx * 18}px`,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundColor: systemTintColor,
                        WebkitMaskImage: `url(${batterySprite.url})`,
                        maskImage: `url(${batterySprite.url})`,
                        WebkitMaskSize: `18px ${batteryFrames * 18}px`,
                        maskSize: `18px ${batteryFrames * 18}px`,
                        WebkitMaskPosition: `0px ${-batteryFrameIdx * 18}px`,
                        maskPosition: `0px ${-batteryFrameIdx * 18}px`,
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                      }}
                    />
                  )}
                  {batteryBoltUrl ? (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: batteryBoltHaloColor,
                          WebkitMaskImage: `url(${batteryBoltUrl})`,
                          maskImage: `url(${batteryBoltUrl})`,
                          WebkitMaskSize: '20px 20px',
                          maskSize: '20px 20px',
                          WebkitMaskPosition: '-1px -1px',
                          maskPosition: '-1px -1px',
                          WebkitMaskRepeat: 'no-repeat',
                          maskRepeat: 'no-repeat',
                        }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: batteryBoltCoreColor,
                          WebkitMaskImage: `url(${batteryBoltUrl})`,
                          maskImage: `url(${batteryBoltUrl})`,
                          WebkitMaskSize: '18px 18px',
                          maskSize: '18px 18px',
                          WebkitMaskRepeat: 'no-repeat',
                          maskRepeat: 'no-repeat',
                        }}
                        aria-label="battery-charging"
                      />
                    </>
                  ) : null}
                </div>
              ) : batteryFallback ? (
                <img
                  key={`shade_battery_${version}`}
                  src={batteryFallback}
                  className="w-[18px] h-[18px] object-contain"
                  style={{ filter: shadeIconTintFilter }}
                  alt="battery"
                />
              ) : sbState.charging ? (
                <BatteryCharging size={16} />
              ) : (
                <BatteryMedium size={16} fill="currentColor" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 px-4 pb-10">
        {/* top tiles */}
        <div className="grid grid-cols-2 gap-3">
          <WifiTile />
          <MobileDataTile />
        </div>

        {/* media + sliders */}
        {/* IMPORTANT: Tailwind arbitrary grid values use '_' for spaces (no commas). */}
        <div className="mt-4 grid grid-cols-[2.2fr_1fr_1fr] gap-3">
          <div className="rounded-[28px] bg-gradient-to-br from-black/35 via-black/25 to-indigo-900/20 backdrop-blur-2xl border border-white/10 p-4 h-[160px] flex flex-col justify-between">
            <div className="flex-1 flex items-center justify-center text-white/35 text-[16px]">
              {shadeText.noMedia}
            </div>
            <div className="flex items-center justify-between px-4 pb-1 text-white/85">
              <SkipBack size={22} className="opacity-70" />
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <Play size={22} className="text-white/90" />
              </div>
              <SkipForward size={22} className="opacity-70" />
            </div>
          </div>

          <VerticalSlider
            value={brightness}
            onChange={onSetBrightness}
            icon={<Sun size={22} />}
            iconClassName="text-amber-500"
          />

          <VerticalSlider
            value={volume}
            onChange={onSetVolume}
            icon={<Volume2 size={22} />}
            iconClassName="text-blue-500"
          />
        </div>

        {/* quick toggles grid */}
        <div className="mt-5 grid grid-cols-4 gap-y-4 justify-items-center">
          {grid.map((it, idx) => {
            if (it.kind === 'toggle') {
              const active = Boolean(qs[it.key]);
              return (
                <CircleButton
                  key={`${it.kind}-${it.key}-${idx}`}
                  active={active}
                  activeIconClassName={it.activeIcon}
                  ariaLabel={it.label}
                  onClick={() => onToggle(it.key)}
                >
                  {it.icon}
                </CircleButton>
              );
            }
            return (
              <CircleButton
                key={`${it.kind}-${it.id}-${idx}`}
                active={Boolean(it.active)}
                activeIconClassName={it.activeIcon}
                ariaLabel={it.label}
                onClick={it.onClick}
              >
                {it.icon}
              </CircleButton>
            );
          })}
        </div>

        <button
          type="button"
          className="mt-6 mx-auto block px-6 py-1.5 rounded-full bg-black/25 backdrop-blur-xl text-white/70 text-[13px] active:bg-black/35"
          onClick={() => {
            // placeholder: edit mode for quick tiles
          }}
        >
          {shadeText.edit}
        </button>
      </div>
    </div>
  );
};

export const SystemShade: React.FC = () => {
  const { launchApp, setBrightness, setVolume } = useOS();
  const brightness = useOsStateStore(s => s.settings.system.brightness);
  const volume = useOsStateStore(s => s.settings.system.mediaVolume);
  const wifiSsid = useOsStateStore(s => s.hardware.wifi.connectedSsid);

  const [shade, setShade] = useState<SystemShadeSnapshot>(SystemShadeService.getState());
  const [notif, setNotif] = useState<OSNotificationSnapshot>(NotificationService.getState());
  const [qs, setQs] = useState<QuickSettingsState>(QuickSettingsService.getState());

  useEffect(() => SystemShadeService.subscribe(setShade), []);
  useEffect(() => NotificationService.subscribe(setNotif), []);
  useEffect(() => QuickSettingsService.subscribe(setQs), []);

  // ESC closes shade (desktop convenience)
  useEffect(() => {
    if (!shade.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') SystemShadeService.close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shade.open]);

  const onClose = () => SystemShadeService.close();

  const panelRef = useRef<HTMLDivElement>(null);
  const [shadeDragOffsetX, setShadeDragOffsetX] = useState(0);
  const [isShadeDragging, setIsShadeDragging] = useState(false);
  const suppressShadeClickRef = useRef(false);
  const wasShadeOpenRef = useRef(false);
  const wheelSwitchRef = useRef<{ dx: number; dy: number; timer: number | null; kind: ShadePanelKind | null }>({
    dx: 0,
    dy: 0,
    timer: null,
    kind: null,
  });

  // 横滑切换 + 上滑关闭。避免和亮度/音量 slider、可滚动通知列表抢手势。
  const shadeGestureRef = useRef<{
    pid: number;
    x: number;
    y: number;
    kind: ShadePanelKind;
    mode: 'pending' | 'horizontal' | 'vertical';
    canVerticalClose: boolean;
  } | null>(null);

  const shouldIgnoreSwipeClose = (target: EventTarget | null): boolean => {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    if (el.closest?.('[data-shade-slider="true"]')) return true;
    if (el.closest?.('[role="button"], button, a, [data-clickable="true"]')) return true;
    const scrollEl = el.closest?.('[data-shade-scroll="true"]') as HTMLElement | null;
    if (scrollEl) {
      const isScrollable = scrollEl.scrollHeight > scrollEl.clientHeight + 2;
      if (!isScrollable) return false;
      return scrollEl.scrollTop > 1;
    }
    return false;
  };
  const shouldBlockShadeGesture = (target: EventTarget | null): boolean => {
    const el = target instanceof Element ? target : null;
    return shouldIgnoreShadePanelGestureStart(el);
  };
  const getPanelWidth = () => panelRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 360);

  useEffect(() => {
    setShadeDragOffsetX(0);
    setIsShadeDragging(false);
    const w = wheelSwitchRef.current;
    w.dx = 0;
    w.dy = 0;
    w.kind = shade.kind;
    if (w.timer) {
      window.clearTimeout(w.timer);
      w.timer = null;
    }
  }, [shade.kind, shade.open]);

  useEffect(() => () => {
    const w = wheelSwitchRef.current;
    if (w.timer) {
      window.clearTimeout(w.timer);
      w.timer = null;
    }
  }, []);

  const onPanelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!shade.open) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 上一次横滑若结束在 panel 空白处，浏览器不派发 click，suppressShadeClickRef 会悬挂吞掉下次合法点击。
    suppressShadeClickRef.current = false;
    shadeGestureRef.current = null;
    if (shouldBlockShadeGesture(e.target)) return;
    shadeGestureRef.current = {
      pid: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      kind: shade.kind,
      mode: 'pending',
      canVerticalClose: !shouldIgnoreSwipeClose(e.target),
    };
  };
  const onPanelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = shadeGestureRef.current;
    if (!s || s.pid !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      shadeGestureRef.current = null;
      setShadeDragOffsetX(0);
      setIsShadeDragging(false);
      return;
    }
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;

    if (s.mode === 'pending') {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX > 10 && absX >= absY * SHADE_SWITCH_DOMINANCE && getShadeDragOffset(s.kind, dx, getPanelWidth()) !== 0) {
        s.mode = 'horizontal';
        setIsShadeDragging(true);
        try {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (absY > 10) {
        s.mode = 'vertical';
        if (s.canVerticalClose) {
          try {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }
      }
    }

    if (s.mode === 'horizontal') {
      suppressShadeClickRef.current = true;
      e.preventDefault?.();
      e.stopPropagation?.();
      setShadeDragOffsetX(getShadeDragOffset(s.kind, dx, getPanelWidth()));
      return;
    }

    if (s.mode === 'vertical' && s.canVerticalClose && dy < -90 && Math.abs(dx) < 90) {
      shadeGestureRef.current = null;
      setShadeDragOffsetX(0);
      setIsShadeDragging(false);
      onClose();
    }
  };
  const onPanelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = shadeGestureRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;
    shadeGestureRef.current = null;
    if (s.mode === 'horizontal') {
      const target = getShadeSwipeTarget(s.kind, { dx, dy });
      if (target) SystemShadeService.open(target);
      suppressShadeClickRef.current = true;
    }
    setShadeDragOffsetX(0);
    setIsShadeDragging(false);
  };
  const onPanelPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = shadeGestureRef.current;
    if (!s || s.pid !== e.pointerId) return;
    shadeGestureRef.current = null;
    // pointercancel 不会有后续 click，绝不能置位 suppressShadeClickRef，否则会吞掉下次合法点击。
    setShadeDragOffsetX(0);
    setIsShadeDragging(false);
  };
  const onPanelWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!shade.open) return;
    if (shouldBlockShadeGesture(e.target)) return;
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absX < absY * SHADE_SWITCH_DOMINANCE) return;
    if (e.cancelable) e.preventDefault();

    const w = wheelSwitchRef.current;
    if (w.kind !== shade.kind) {
      w.dx = 0;
      w.dy = 0;
      w.kind = shade.kind;
    }
    w.dx += e.deltaX;
    w.dy += e.deltaY;
    if (w.timer) window.clearTimeout(w.timer);
    setIsShadeDragging(true);
    setShadeDragOffsetX(getShadeWheelOffset(shade.kind, w.dx, getPanelWidth()));
    w.timer = window.setTimeout(() => {
      const target = getShadeWheelTarget(shade.kind, { deltaX: w.dx, deltaY: w.dy });
      if (target) SystemShadeService.open(target);
      setShadeDragOffsetX(0);
      setIsShadeDragging(false);
      w.dx = 0;
      w.dy = 0;
      w.kind = null;
      w.timer = null;
    }, 180);
  };
  const onPanelClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressShadeClickRef.current) return;
    suppressShadeClickRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const onOpenNotification = (it: OSNotification) => {
    if (it.autoCancel !== false) {
      NotificationService.dismiss(it.id);
    } else {
      NotificationService.markRead(it.id, true);
    }
    onClose();
    if (it.pendingIntent) {
      PendingIntent.send(it.pendingIntent);
      return;
    }
    if (!it.appId) return;
    const os = window.__OS__;
    if (it.route && os && typeof os.openApp === 'function') {
      os.openApp(it.appId, it.route);
      return;
    }
    launchApp(it.appId);
  };

  const kind: ShadePanelKind = shade.kind;
  const open = shade.open;
  const panelWidth = getPanelWidth();
  const activePanelIndex = kind === 'control' ? 1 : 0;
  const panelTrackX = -activePanelIndex * panelWidth + shadeDragOffsetX;
  const shouldAnimatePanelTrack = open && wasShadeOpenRef.current && !isShadeDragging;

  useEffect(() => {
    wasShadeOpenRef.current = open;
  }, [open]);

  return (
    <div
      data-no-clipboard="true"
      className={`fixed inset-0 select-none ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ zIndex: zIndexSystemShade }}
    >
      {/* Scrim */}
      <div
        className={`absolute inset-0 transition-opacity ${open ? 'opacity-100' : 'opacity-0'
          }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute inset-0 touch-none overflow-hidden transition-transform ease-out ${open ? 'translate-y-0' : '-translate-y-full'
          }`}
        style={{ transitionDuration: `${transitionDuration}ms` }}
        onClickCapture={onPanelClickCapture}
        onPointerDown={onPanelPointerDown}
        onPointerMove={onPanelPointerMove}
        onPointerUp={onPanelPointerUp}
        onPointerCancel={onPanelPointerCancel}
        onWheel={onPanelWheel}
      >
        <div className="absolute inset-0 pointer-events-none" style={BackgroundBlur()} />
        <div
          className="relative flex h-full will-change-transform ease-out"
          style={{
            transform: `translate3d(${panelTrackX}px, 0, 0)`,
            transitionProperty: 'transform',
            transitionDuration: shouldAnimatePanelTrack ? `${transitionDuration}ms` : '0ms',
          }}
        >
          <div className="h-full min-w-full">
            <NotificationCenterPanel
              snapshot={notif}
              onClose={onClose}
              onOpenNotification={onOpenNotification}
              withBackground={false}
            />
          </div>
          <div className="h-full min-w-full">
            <ControlCenterPanel
              qs={qs}
              wifiSsid={wifiSsid}
              brightness={brightness}
              volume={volume}
              onClose={onClose}
              onToggle={(key) => QuickSettingsService.toggle(key)}
              onSetBrightness={setBrightness}
              onSetVolume={setVolume}
              withBackground={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemShade;
