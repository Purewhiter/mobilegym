import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { IcNavBack, IcLoading } from './res/icons';
import { useTheme } from '../../os/ThemeContext';
import type { ThemeMeta } from '../../os/ThemeService';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { SIMULATOR_CONFIG } from '@/os/data';
import { loadLauncherLayout, saveLauncherLayout } from '../../os/launcher/storage';
import type { LauncherWallpaper } from '../../os/launcher/types';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useAppStrings } from '../../os/useAppStrings';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useThemeStoreGestures } from './hooks/useThemeStoreGestures';

const { statusBarHeight } = SIMULATOR_CONFIG.framework;

type StoreTab = 'themes' | 'fonts' | 'aod';

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function pill(label: string, tone: 'blue' | 'green' | 'gray' = 'gray') {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700'
      : tone === 'green'
        ? 'bg-green-50 text-green-700'
        : 'bg-gray-100 text-gray-600';
  return <span className={cn('text-[11px] px-2 py-0.5 rounded-full', cls)}>{label}</span>;
}

function setLauncherWallpaper(wallpaper: LauncherWallpaper) {
  try {
    const layout = loadLauncherLayout();
    saveLauncherLayout({ ...layout, wallpaper });
  } catch (e) {
    console.warn('[ThemeStore] Failed to set launcher wallpaper', e);
  }
}

const ThemeStoreNavigationHandler: React.FC = () => {
  const location = useLocation();
  const { back } = useThemeStoreGestures();

  const handleBackPress = useCallback((): boolean => {
    if (location.pathname !== '/') {
      back();
      return true;
    }
    return false;
  }, [location.pathname, back]);

  useAppNavigationHandler('theme_store', { onBack: handleBackPress });

  return null;
};

function ThemeStoreHomePage() {
  const s = useAppStrings(strings, stringsEn);
  const { themeService, version } = useTheme();
  const { go } = useThemeStoreGestures();
  const [tab, setTab] = useState<StoreTab>('themes');
  const [items, setItems] = useState<ThemeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback((forceReload: boolean) => {
    setLoading(true);
    setError(null);
    const request =
      tab === 'themes'
        ? themeService.getInstalledThemes(forceReload)
        : tab === 'fonts'
          ? themeService.getFonts(forceReload)
          : themeService.getAod(forceReload);

    request
      .then((nextItems) => setItems(nextItems))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [tab, themeService]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request =
      tab === 'themes'
        ? themeService.getInstalledThemes(true)
        : tab === 'fonts'
          ? themeService.getFonts(true)
          : themeService.getAod(true);

    request
      .then((nextItems) => {
        if (!cancelled) setItems(nextItems);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, themeService, version]);

  const currentThemeId = themeService.getCurrentThemeId();

  return (
    <div className="h-full w-full bg-app-bg flex flex-col overflow-hidden">
      <div className="bg-app-surface border-b border-black/5">
        <div style={{ height: statusBarHeight }} />
        <div className="h-(--app-top-bar-height) px-4 flex items-center justify-between">
          <div className="text-base font-semibold text-black">{s.app_name}</div>
          <button
            className="text-sm font-medium text-blue-600"
            onClick={() => loadItems(true)}
          >
            {s.refresh}
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="inline-flex bg-black/5 rounded-full p-1 gap-1">
            <button
              className={cn(
                'h-8 px-4 rounded-full text-sm font-medium',
                tab === 'themes' ? 'bg-app-surface text-black shadow-sm' : 'text-app-text-muted'
              )}
              onClick={() => setTab('themes')}
            >
              {s.tab_themes}
            </button>
            <button
              className={cn(
                'h-8 px-4 rounded-full text-sm font-medium',
                tab === 'fonts' ? 'bg-app-surface text-black shadow-sm' : 'text-app-text-muted'
              )}
              onClick={() => setTab('fonts')}
            >
              {s.tab_fonts}
            </button>
            <button
              className={cn(
                'h-8 px-4 rounded-full text-sm font-medium',
                tab === 'aod' ? 'bg-app-surface text-black shadow-sm' : 'text-app-text-muted'
              )}
              onClick={() => setTab('aod')}
            >
              {s.tab_aod}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-gray-400">
            <IcLoading className="w-5 h-5 animate-spin" />
            <span className="text-sm">{s.loading}</span>
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{s.load_failed}{error}</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-app-text-muted">
            <div>{s.no_resources_found}</div>
            <div className="mt-2 text-[12px] font-mono text-black/60">
              python3 scripts/dev/prepare-themes.py -&gt; public/themes
            </div>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-3">
            {items.map((themeMeta) => {
              const previewUrl = themeService.getThemePreviewUrls(themeMeta.id)[0] || '';
              const active = tab === 'themes' ? currentThemeId === themeMeta.id : false;
              const supportsIcons = (themeMeta.iconPackageNames?.length || 0) > 0;
              const supportsWallpaper = !!themeMeta.extracted?.wallpaper?.default;
              const supportsStatusbar = (themeMeta.statusbarIcons?.length || 0) > 0;
              const supportsShade = !!themeMeta.extracted?.shade;

              return (
                <button
                  key={themeMeta.id}
                  className="bg-app-surface rounded-2xl overflow-hidden border border-black/5 shadow-sm text-left"
                  onClick={() => go('item.open', {
                    kind: tab === 'themes' ? 'theme' : tab === 'fonts' ? 'font' : 'aod',
                    id: themeMeta.id,
                  })}
                >
                  <div className="h-(--app-card-preview-height) w-full bg-black/5">
                    {previewUrl ? <img src={previewUrl} alt={themeMeta.title} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-black truncate">{themeMeta.title}</div>
                      {active ? pill(s.enabled, 'green') : null}
                    </div>
                    <div className="mt-1 text-xs text-app-text-muted truncate">{themeMeta.author || s.unknown_author}</div>
                    {tab === 'themes' ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {supportsIcons ? pill(s.pill_icons, 'blue') : null}
                        {supportsWallpaper ? pill(s.pill_wallpaper, 'blue') : null}
                        {supportsStatusbar ? pill(s.pill_statusbar, 'blue') : null}
                        {supportsShade ? pill(s.pill_control_center, 'blue') : null}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StoreItemDetailPage() {
  const s = useAppStrings(strings, stringsEn);
  const { themeService, version } = useTheme();
  const { bindBack } = useThemeStoreGestures();
  const params = useParams<{ kind: 'theme' | 'font' | 'aod'; id: string }>();
  const kind = params.kind || 'theme';
  const id = params.id || '';
  const [themeMeta, setThemeMeta] = useState<ThemeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request =
      kind === 'theme'
        ? themeService.getInstalledThemes(false)
        : kind === 'font'
          ? themeService.getFonts(false)
          : themeService.getAod(false);

    request
      .then((nextItems) => {
        if (!cancelled) setThemeMeta(nextItems.find((item) => item.id === id) || null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, kind, themeService, version]);

  const currentThemeId = themeService.getCurrentThemeId();
  const active = kind === 'theme' ? currentThemeId === id : false;

  const previewPaths = useMemo(() => {
    if (!themeMeta) return [];
    return themeService.getThemePreviewUrls(themeMeta.id);
  }, [themeMeta, themeService]);

  const supportsIcons = (themeMeta?.iconPackageNames?.length || 0) > 0;
  const supportsWallpaper = !!themeMeta?.extracted?.wallpaper?.default;
  const supportsStatusbar = (themeMeta?.statusbarIcons?.length || 0) > 0;
  const supportsShade = !!themeMeta?.extracted?.shade;

  const apply = async (applyKind: 'theme' | 'icons' | 'wallpaper') => {
    if (!themeMeta) return;
    setApplying(applyKind);
    setError(null);
    try {
      if (applyKind === 'theme') {
        await themeService.applyTheme(themeMeta.id);
        const wallpaperUrl = themeService.getThemeWallpaperUrl(themeMeta.id);
        if (wallpaperUrl) setLauncherWallpaper({ kind: 'image', imageUrl: wallpaperUrl });
      }

      if (applyKind === 'icons') {
        await themeService.applyComponent(themeMeta.id, 'icons');
      }

      if (applyKind === 'wallpaper') {
        const wallpaperUrl = themeService.getThemeWallpaperUrl(themeMeta.id);
        if (!wallpaperUrl) throw new Error(s.no_available_wallpaper);
        setLauncherWallpaper({ kind: 'image', imageUrl: wallpaperUrl });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="h-full w-full bg-app-bg flex flex-col overflow-hidden">
      <div className="bg-app-surface border-b border-black/5">
        <div style={{ height: statusBarHeight }} />
        <div className="h-(--app-top-bar-height) px-2 flex items-center gap-2">
          <button className="w-10 h-10 rounded-full flex items-center justify-center" {...bindBack()}>
            <IcNavBack className="w-5 h-5 text-black" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-black truncate">{themeMeta?.title || s.theme_detail}</div>
            <div className="text-xs text-app-text-muted truncate">{themeMeta?.author || ''}</div>
          </div>
          {active ? pill(s.enabled, 'green') : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-gray-400">
            <IcLoading className="w-5 h-5 animate-spin" />
            <span className="text-sm">{s.loading}</span>
          </div>
        ) : !themeMeta ? (
          <div className="p-4 text-sm text-app-text-muted">{s.resource_not_found}{id}</div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="bg-app-surface rounded-2xl overflow-hidden border border-black/5">
              <div className="grid grid-cols-2 gap-2 p-2">
                {previewPaths.slice(0, 4).map((previewPath) => (
                  <div key={previewPath} className="h-(--app-detail-preview-image-h) rounded-xl overflow-hidden bg-black/5">
                    <img src={previewPath} alt={themeMeta.title} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {kind === 'theme' ? (
              <>
                <div className="bg-app-surface rounded-2xl border border-black/5 p-3">
                  <div className="text-sm font-semibold text-black">{s.apply}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                      disabled={!!applying}
                      onClick={() => apply('theme')}
                    >
                      {applying === 'theme' ? s.applying : s.apply_full_theme}
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-app-text-muted flex flex-wrap gap-1">
                    {supportsIcons ? pill(s.pill_icons, 'blue') : pill(s.pill_icons, 'gray')}
                    {supportsWallpaper ? pill(s.pill_wallpaper, 'blue') : pill(s.pill_wallpaper, 'gray')}
                    {supportsStatusbar ? pill(s.pill_statusbar, 'blue') : pill(s.pill_statusbar, 'gray')}
                    {supportsShade ? pill(s.pill_control_center, 'blue') : pill(s.pill_control_center, 'gray')}
                  </div>
                </div>

                <div className="bg-app-surface rounded-2xl border border-black/5 p-3">
                  <div className="text-sm font-semibold text-black">{s.mix_and_match}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
                      disabled={!!applying || !supportsIcons}
                      onClick={() => apply('icons')}
                    >
                      {applying === 'icons' ? s.applying : s.apply_icons_only}
                    </button>
                    <button
                      className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
                      disabled={!!applying || !supportsWallpaper}
                      onClick={() => apply('wallpaper')}
                    >
                      {applying === 'wallpaper' ? s.applying : s.apply_wallpaper_only}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-app-surface rounded-2xl border border-black/5 p-3 text-sm text-app-text-muted">
                {kind === 'font' ? s.sim_font_not_supported : s.sim_aod_not_supported}
              </div>
            )}

            {error ? <div className="text-sm text-red-600 px-1">{s.operation_failed}{error}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

const ThemeStoreApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };

  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <MemoryRouter>
        <ThemeStoreNavigationHandler />
        <Routes>
          <Route path="/" element={<ThemeStoreHomePage />} />
          <Route path="/item/:kind/:id" element={<StoreItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    </div>
  );
};

export default ThemeStoreApp;
