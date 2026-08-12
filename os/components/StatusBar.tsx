import { useState, useEffect } from 'react';
import { Wifi, Bluetooth, Signal, BatteryMedium, Plane } from 'lucide-react';
import { SIMULATOR_CONFIG } from '../data';
import { getAppManifest } from '../data/appRegistry';
import { useTheme } from '../ThemeContext';
import * as TimeService from '../TimeService';
import { SystemShadeService } from '../SystemShadeService';
import QuickSettingsService from '../QuickSettingsService';
import StatusBarService from '../StatusBarService';
import { useTaskManagerSelector } from '../hooks/useTaskManagerSelector';
import {
  getLightTextFromManifestForeground,
  getChromeTaskSnapshot,
  areChromeTaskSnapshotsEqual,
  getForegroundObserverTarget,
  getDeclaredForeground,
  getDeclaredHidden,
} from './chromeForeground';

const { statusBarHeight, transitionDuration, zIndexStatusBar } = SIMULATOR_CONFIG.framework;

/**
 * System status bar: clock, connectivity/status icons, battery (dual render
 * modes: theme RGBA variant sprite vs alpha-mask + system tint).
 *
 * DOM contract (reader side): probes foreground/hidden declarations inside
 * `#activity-container-${activityId}` (rendered by os/SystemShell.tsx) or the
 * launcher root via chromeForeground helpers, and re-detects on DOM mutations
 * (attributeFilter: data-status-bar-foreground / data-status-bar-hidden).
 * Rendered by SystemShell inside its own SystemErrorBoundary.
 */
export const StatusBar = () => {
  const {
    activeTopActivityId,
    activeRootAppId,
    isLauncherVisible,
    isRecentsVisible,
  } = useTaskManagerSelector(getChromeTaskSnapshot, areChromeTaskSnapshotsEqual);
  const { themeService, version } = useTheme();
  const [time, setTime] = useState('');
  const [isLight, setIsLight] = useState(true); // true = white text, false = black text
  const [isHidden, setIsHidden] = useState(false);
  const [shadeOpen, setShadeOpen] = useState(SystemShadeService.getState().open);
  const [themedIconTick, setThemedIconTick] = useState(0);
  const [qs, setQs] = useState(() => QuickSettingsService.getState());
  const [dyn, setDyn] = useState(() => StatusBarService.getState());

  useEffect(() => {
    const updateTime = () => {
      setTime(TimeService.formatTime());
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return SystemShadeService.subscribe(s => setShadeOpen(s.open));
  }, []);

  useEffect(() => {
    return QuickSettingsService.subscribe(setQs);
  }, []);

  useEffect(() => {
    return StatusBarService.subscribe(setDyn);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      themeService.getStatusBarIconAsync('bluetooth'),
      themeService.getStatusBarIconAsync('signal'),
      themeService.getStatusBarIconAsync('wifi'),
      themeService.getStatusBarIconAsync('battery'),
    ])
      .then(() => {
        if (!cancelled) setThemedIconTick((x) => x + 1);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [themeService, version]);

  useEffect(() => {
    const detectChromeState = () => {
      const targetElement = getForegroundObserverTarget(
        activeTopActivityId,
        isLauncherVisible,
        isRecentsVisible,
      );
      setIsHidden(getDeclaredHidden(targetElement, 'data-status-bar-hidden'));
      const declaredLightText = getDeclaredForeground(targetElement, 'data-status-bar-foreground');
      if (declaredLightText !== null) {
        setIsLight(declaredLightText);
        return;
      }

      if (isRecentsVisible) {
        setIsLight(true);
        return;
      }

      if (!isLauncherVisible && activeRootAppId) {
        const activeManifest = getAppManifest(activeRootAppId);
        const manifestLightText = getLightTextFromManifestForeground(
          activeManifest?.theme.colors.statusBarForeground,
        );
        if (manifestLightText !== null) {
          setIsLight(manifestLightText);
          return;
        }
      }

      // 不再做 DOM 颜色采样；无声明时默认使用深色文字。
      setIsLight(false);
    };

    detectChromeState();

    const targetElement = getForegroundObserverTarget(
      activeTopActivityId,
      isLauncherVisible,
      isRecentsVisible,
    );

    let observer: MutationObserver | null = null;
    if (targetElement) {
      observer = new MutationObserver(() => {
        requestAnimationFrame(detectChromeState);
      });
      observer.observe(targetElement, {
        childList: true,
        attributes: true,
        subtree: true,
        attributeFilter: ['data-status-bar-foreground', 'data-status-bar-hidden'],
      });
    }

    return () => {
      observer?.disconnect();
    };
  }, [activeRootAppId, activeTopActivityId, isLauncherVisible, isRecentsVisible]);

  const textColor = isLight ? 'text-white' : 'text-black';

  // Themed status bar icons are PNGs with baked-in colors (usually white).
  // We apply a CSS filter to re-tint them to match the current textColor:
  //   brightness(0)  → forces all pixels to black
  //   invert(1)      → flips black → white  (only when we need white text)
  const iconTintFilter = isLight ? 'brightness(0) invert(1)' : 'brightness(0)';

  if (shadeOpen || isHidden) return null;

  const wifiVisible = qs.wifiEnabled;
  const btVisible = qs.bluetoothEnabled;
  const airplaneMode = qs.airplaneModeEnabled;
  const noSim = dyn.noSim;
  const signalVisible = !airplaneMode && !noSim;

  const vpnUrl = dyn.vpn ? themeService.getStatusBarIcon('vpn') : null;
  const alarmUrl = dyn.alarm ? themeService.getStatusBarIcon('alarm') : null;
  const headsetUrl = dyn.headset ? themeService.getStatusBarIcon('headset') : null;
  const silentUrl = dyn.silent ? themeService.getStatusBarIcon('silent') : null;
  const nfcUrl = qs.nfcEnabled ? themeService.getStatusBarIcon('nfc') : null;

  const airplaneUrl = airplaneMode ? themeService.getStatusBarIcon('airplane') : null;
  const noSimUrl = !airplaneMode && noSim
    ? themeService.getStatusBarIcon('no_sim') || themeService.getStatusBarIcon('signal_null')
    : null;

  const wifiUrl = wifiVisible ? themeService.getStatusBarWifiIcon(dyn.wifiLevel) : null;
  const signalUrl = signalVisible ? themeService.getStatusBarSignalIcon(dyn.signalLevel) : null;
  const dataTypeVisible =
    signalVisible && qs.mobileDataEnabled && dyn.mobileDataType !== 'none';
  const dataTypeUrl = dataTypeVisible ? themeService.getStatusBarDataTypeIcon(dyn.mobileDataType) : null;

  // ---- Battery rendering ----
  //
  // Priority hierarchy (theme-first, system-fallback):
  //   1. saver+charging → theme `power_save_charge` variant (if any) → render RGBA
  //   2. charging       → theme `charge` variant (if any) → render RGBA (bolt baked in)
  //   3. saver          → theme `power_save` variant (if any) → render RGBA
  //   4. fallback       → base sprite + system tint (mask-image), with bolt overlay
  //                       when charging, plus low-battery red when <20% & not charging.
  //
  // RGBA mode preserves theme designer's chosen color palette (which varies by
  // theme: AP15 ships saturated green for charging, 夜半 a darker forest green,
  // some themes choose teal or blue). Tint mode enforces a consistent system
  // visual when the theme didn't ship the matching variant.
  const baseSprite = themeService.getStatusBarBatterySprite();
  const lowBattery = !dyn.charging && dyn.batteryPercent < 20;

  let themeRgbaSprite: { url: string; frames: number; frameSide: number } | null = null;
  let rgbaHasBakedBolt = false;
  if (qs.batterySaverEnabled && dyn.charging) {
    // Saver wins for body color. Try the most specific variant (yellow + bolt
    // baked); else fall back to power_save (yellow body, bolt added separately
    // via overlay). DO NOT fall through to `charge` here — that would render
    // green and lose the saver indication.
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save_charge');
    if (themeRgbaSprite) rgbaHasBakedBolt = true;
    if (!themeRgbaSprite) {
      themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save');
    }
  } else if (dyn.charging) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('charge');
    if (themeRgbaSprite) rgbaHasBakedBolt = true;
  } else if (qs.batterySaverEnabled) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save');
  }

  const batterySprite = themeRgbaSprite ?? baseSprite;
  const batteryFallback = themeService.getStatusBarIcon('battery');

  const batteryPct = Math.min(Math.max(dyn.batteryPercent, 0), 100);
  const batteryFrames = batterySprite?.frames ?? 0;
  const batteryFrameIdx =
    batterySprite && batteryFrames > 1
      ? Math.min(
        Math.max(Math.floor(((batteryFrames - 1) * batteryPct) / 100), 0),
        batteryFrames - 1
      )
      : 0;

  // System-tint mode only — color used when we fall back to alpha-mask + bg.
  const systemTintColor = qs.batterySaverEnabled
    ? '#F5C518' // saver yellow
    : dyn.charging
      ? '#22C55E' // charging green (普通充电也变绿)
      : lowBattery
        ? '#EF4444' // low battery red
        : isLight
          ? '#FFFFFF'
          : '#000000';

  // Charging bolt overlay: needed when charging AND the body-rendering layer
  // doesn't already have a bolt baked in. So:
  //   - tint mode + charging         → overlay needed
  //   - rgba `charge`/`power_save_charge` variant → bolt baked, no overlay
  //   - rgba `power_save` (saver+charging fallback) → overlay needed (yellow body, no bolt)
  const useThemeRgba = themeRgbaSprite !== null;
  const needsBoltOverlay = dyn.charging && !rgbaHasBakedBolt;
  const batteryBoltUrl = needsBoltOverlay
    ? themeService.getStatusBarBatteryBoltOverlay()
    : null;
  // 快充叠一层更深的内核 + 略大的 halo，让闪电在 25% 这种小填充态也清晰可见。
  const batteryBoltCoreColor = dyn.fastCharging ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.78)';
  const batteryBoltHaloColor = systemTintColor;

  return (
    <div
      className={`absolute top-0 w-full flex justify-between items-center px-6 ${textColor} text-[13px] font-medium pointer-events-none transition-colors`}
      style={{
        height: `${statusBarHeight}px`,
        zIndex: zIndexStatusBar,
        transitionDuration: `${transitionDuration}ms`
      }}
    >
      <div>{time}</div>
      <div className="flex items-center gap-1.5">
        {vpnUrl ? (
          <img
            key={`vpn_${version}_${themedIconTick}`}
            src={vpnUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="vpn"
          />
        ) : null}

        {alarmUrl ? (
          <img
            key={`alarm_${version}_${themedIconTick}`}
            src={alarmUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="alarm"
          />
        ) : null}

        {headsetUrl ? (
          <img
            key={`headset_${version}_${themedIconTick}`}
            src={headsetUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="headset"
          />
        ) : null}

        {silentUrl ? (
          <img
            key={`silent_${version}_${themedIconTick}`}
            src={silentUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="silent"
          />
        ) : null}

        {nfcUrl ? (
          <img
            key={`nfc_${version}_${themedIconTick}`}
            src={nfcUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="nfc"
          />
        ) : null}

        {btVisible ? (
          themeService.getStatusBarIcon('bluetooth') ? (
            <img
              key={`bt_${version}_${themedIconTick}`}
              src={themeService.getStatusBarIcon('bluetooth')!}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="bluetooth"
            />
          ) : (
            <Bluetooth size={14} />
          )
        ) : null}

        {airplaneMode ? (
          airplaneUrl ? (
            <img
              key={`airplane_${version}_${themedIconTick}`}
              src={airplaneUrl}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="airplane"
            />
          ) : (
            <Plane size={14} />
          )
        ) : noSim ? (
          noSimUrl ? (
            <img
              key={`no_sim_${version}_${themedIconTick}`}
              src={noSimUrl}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="no-sim"
            />
          ) : null
        ) : signalUrl ? (
          <img
            key={`signal_${dyn.signalLevel}_${version}_${themedIconTick}`}
            src={signalUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="signal"
          />
        ) : (
          <Signal size={14} />
        )}

        {dataTypeUrl ? (
          <img
            key={`data_${dyn.mobileDataType}_${version}_${themedIconTick}`}
            src={dataTypeUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt={`data-${dyn.mobileDataType}`}
          />
        ) : null}

        {wifiVisible ? (
          wifiUrl ? (
            <img
              key={`wifi_${dyn.wifiLevel}_${version}_${themedIconTick}`}
              src={wifiUrl}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="wifi"
            />
          ) : (
            <Wifi size={14} />
          )
        ) : null}

        <span className="text-[11px] leading-none">{batteryPct}%</span>

        {batterySprite ? (
          // Two render modes:
          //   - useThemeRgba: render the variant sprite directly via background-image
          //     (theme color baked into RGB). Bolt is pre-baked in `_charge` variants.
          //   - else: alpha-mask + system tint color, plus optional bolt overlay
          //     when charging.
          <div
            key={`battery_${batteryPct}_${dyn.charging ? 1 : 0}_${dyn.fastCharging ? 1 : 0}_${qs.batterySaverEnabled ? 1 : 0}_${useThemeRgba ? 'r' : 't'}_${version}_${themedIconTick}`}
            className="relative w-[20px] h-[20px]"
            aria-label="battery"
          >
            {useThemeRgba ? (
              <div
                className="absolute inset-0 bg-no-repeat"
                style={{
                  backgroundImage: `url(${batterySprite.url})`,
                  backgroundSize: `20px ${batteryFrames * 20}px`,
                  backgroundPosition: `0px ${-batteryFrameIdx * 20}px`,
                }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: systemTintColor,
                  WebkitMaskImage: `url(${batterySprite.url})`,
                  maskImage: `url(${batterySprite.url})`,
                  WebkitMaskSize: `20px ${batteryFrames * 20}px`,
                  maskSize: `20px ${batteryFrames * 20}px`,
                  WebkitMaskPosition: `0px ${-batteryFrameIdx * 20}px`,
                  maskPosition: `0px ${-batteryFrameIdx * 20}px`,
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
                    WebkitMaskSize: '22px 22px',
                    maskSize: '22px 22px',
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
                    WebkitMaskSize: '20px 20px',
                    maskSize: '20px 20px',
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
            key={`battery_${version}_${themedIconTick}`}
            src={batteryFallback}
            className="w-[20px] h-[20px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="battery"
          />
        ) : (
          <BatteryMedium size={20} fill="currentColor" />
        )}
      </div>
    </div>
  );
};
