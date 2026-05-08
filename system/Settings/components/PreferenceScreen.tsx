import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import { SETTINGS_PAGE_OVERRIDES } from '../data/settingsOverrides';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import { SwitchPreference } from './SwitchPreference';
import { SeekBarPreference } from './SeekBarPreference';
import { ListPreference } from './ListPreference';
import { ValuePreference } from './ValuePreference';
import { Toast } from '@/os/components/Toast';
import { WifiSavedNetworksPage } from './WifiSavedNetworksPage';
import { WifiSavedNetworkDetailPage } from './WifiSavedNetworkDetailPage';
import { WifiNetworksPage } from './WifiNetworksPage';
import { BluetoothDevicesPage } from './BluetoothDevicesPage';
import { StorageDashboardPage } from './StorageDashboardPage';
import { NotificationManagingPage } from './NotificationManagingPage';
import { NotificationAppDetailPage } from './NotificationAppDetailPage';
import { AppPermissionsPage } from './AppPermissionsPage';
import { AppPermissionDetailPage } from './AppPermissionDetailPage';
import { LauncherSettingsPage } from './LauncherSettingsPage';
import { SilentModeSettingsPage } from './SilentModeSettingsPage';
import { LanguagePickerPage } from './LanguagePickerPage';
import type { SettingsItem, SettingsMainSection, SettingsPage } from '../types';
import { ClipboardService } from '../../../os/ClipboardService';
import { routeGetPreference } from '../../../os/managers/registry';
import { getOsDataRevision, subscribeOsDataRevision } from '../../../os/simState';
import { useSettingsStrings } from '../res/useSettingsStrings';
import { useSettingsStore, selectPagesData, selectPagesLoading, selectPagesError } from '../state';
import { useSettingsGestures } from '../hooks/useSettingsGestures';

const PAGE_ID_ALIASES: Record<string, { targetId: string; title?: string }> = {
  // MIUI/HyperOS: this page is built dynamically; we reuse a close static screen.
  security_settings: { targetId: 'security_settings_common' },
};

const INFO_VALUE_PAGES = new Set<string>([
  'my_device_settings',
  'my_device_detail_settings',
  'my_device_info_pref_screen',
  'hardware_info',
  'battery_info',
  // SIM / radio status pages (AOSP/MIUI alike)
  'device_info_sim_status',
  'status_sim',
]);

// Theme / wallpaper / icons entries should open Theme Store app directly.
const THEME_STORE_KEYS = new Set<string>([
  // personalize_title
  'theme_center',
  'wallpaper_center',
  'font_center',
  // theme_settings
  'theme_store',
  'my_themes',
  'icon_pack',
  'font_style',
  'system_sounds',
  'notification_shade',
  // wallpaper_settings
  'lock_wallpaper',
  'home_wallpaper',
  'super_wallpaper',
  'live_wallpaper',
  'dynamic_wallpaper',
  'effect_wallpaper',
  'wallpaper_carousel',
]);

function formatValue(v: any, s: { on: string; off: string }): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v ? s.on : s.off;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return String(v);
}

/** Lookup a page by id: hand-written overrides first, then auto-generated */
function findPage(pageId: string, pages: Record<string, SettingsPage> | null) {
  const alias = PAGE_ID_ALIASES[pageId];
  const effectiveId = alias?.targetId || pageId;

  // Prefer hand-written overrides when present (to emulate programmatic pages)
  const base = SETTINGS_PAGE_OVERRIDES[effectiveId] || pages?.[effectiveId] || undefined;
  if (!base) return undefined;

  if (alias) {
    // Keep the requested id for routing, but reuse the aliased categories.
    return { ...base, id: pageId, title: alias.title || base.title };
  }
  return base;
}

function buildMainTargetPageTitleMap(sections: SettingsMainSection[] | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!sections) return map;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.targetPage && item.title && !map[item.targetPage]) {
        map[item.targetPage] = item.title;
      }
    }
  }
  return map;
}

const EXTERNAL_PAGE_PREFIX = '__external__';
const EXTERNAL_PAGE_SEPARATOR = '::';

function safeDecodeURIComponent(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function makeExternalPageId(title: string, key?: string) {
  return `${EXTERNAL_PAGE_PREFIX}${encodeURIComponent(title)}${EXTERNAL_PAGE_SEPARATOR}${encodeURIComponent(
    key || ''
  )}`;
}

/** Generic preference screen renderer - driven by page data from config */
export const PreferenceScreenPage: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const { bindTap, go } = useSettingsGestures();
  const { s, t } = useSettingsStrings();
  const data = useSettingsStore(selectPagesData);
  const loading = useSettingsStore(selectPagesLoading);
  const error = useSettingsStore(selectPagesError);
  const mainSections = data?.mainSections ?? null;
  const pages = data?.pages ?? null;
  const mainTargetPageTitleMap = useMemo(() => buildMainTargetPageTitleMap(mainSections), [mainSections]);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const toastTimerRef = useRef<number | undefined>(undefined);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Keep info pages reactive: re-render when OS/device state changes.
  // NOTE: Must stay before any early return to keep hook order stable.
  useSyncExternalStore(
    subscribeOsDataRevision,
    getOsDataRevision
  );

  // ── External/system pages stub ─────────────────────────────────────
  if (pageId?.startsWith(EXTERNAL_PAGE_PREFIX)) {
    const raw = pageId.slice(EXTERNAL_PAGE_PREFIX.length);
    const [encTitle = '', encKey = ''] = raw.split(EXTERNAL_PAGE_SEPARATOR);
    const title = safeDecodeURIComponent(encTitle) || s.settings;
    const key = safeDecodeURIComponent(encKey || '');

    return (
      <div className="h-full bg-app-bg flex flex-col">
        <SettingsHeader title={t(title)} />
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center text-gray-400">
            <div className="text-[40px] mb-4 opacity-30">⚙</div>
            <div className="text-[14px] font-medium text-app-text-muted mb-1">{t(title)}</div>
            <div className="text-[12px] text-gray-400">
              {s.on_a_real_device_this_would_open_a_system_page}{key ? `（${key}）` : ''}{s.simulation_not_supported_suffix}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Dynamic (programmatic) pages that exist on device but aren't pure XML ──
  // NOTE: Keep this AFTER hooks to avoid conditional hook calls across pageId changes.
  if (pageId === 'wifi_settings' || pageId === 'wifi_settings2') {
    return <WifiNetworksPage />;
  }
  if (pageId === 'bluetooth_settings' || pageId === 'bluetooth_switchbar_screen') {
    return <BluetoothDevicesPage />;
  }
  if (pageId === 'storage_dashboard_fragment') {
    return <StorageDashboardPage />;
  }
  if (pageId === 'launcher_settings') {
    return <LauncherSettingsPage />;
  }
  if (pageId === 'silent_mode_settings') {
    return <SilentModeSettingsPage />;
  }
  if (pageId === 'locale_picker') {
    return <LanguagePickerPage />;
  }
  if (pageId === 'notification_managing') {
    return <NotificationManagingPage />;
  }
  if (pageId === 'permission_managing') {
    return <AppPermissionsPage />;
  }
  if (pageId?.startsWith('app_permission_detail__')) {
    const raw = pageId.slice('app_permission_detail__'.length);
    let appId = raw;
    try {
      appId = decodeURIComponent(raw);
    } catch {
      // ignore
    }
    return <AppPermissionDetailPage appId={appId} />;
  }
  if (pageId?.startsWith('notification_app__')) {
    const raw = pageId.slice('notification_app__'.length);
    let appId = raw;
    try {
      appId = decodeURIComponent(raw);
    } catch {
      // ignore
    }
    return <NotificationAppDetailPage appId={appId} />;
  }
  if (pageId === 'saved_access_points' || pageId === 'wifi_display_saved_access_points2' || pageId === 'saved_wifi') {
    return <WifiSavedNetworksPage title={pageId === 'saved_wifi' ? s.manage_saved_networks : s.saved_networks} />;
  }
  if (pageId?.startsWith('wifi_saved_network__')) {
    const raw = pageId.slice('wifi_saved_network__'.length);
    let ssid = raw;
    try {
      ssid = decodeURIComponent(raw);
    } catch {
      // ignore
    }
    return <WifiSavedNetworkDetailPage ssid={ssid} />;
  }

  if (!pages) {
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <SettingsHeader title={s.settings} />
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center text-gray-400">
            <div className="text-[40px] mb-4 opacity-30">⚙</div>
            <div className="text-[14px] font-medium text-app-text-muted mb-1">{s.settings}</div>
            <div className="text-[12px] text-gray-400">
              {error ? s.settings_data_load_failed : (loading ? s.loading_settings_data : s.settings_data_not_ready)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const page = pageId ? findPage(pageId, pages) : undefined;

  if (!page) {
    // Fallback: show a stub page with the id as title
    const displayTitle = pageId
      ? pageId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : s.settings;
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <SettingsHeader title={displayTitle} />
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center text-gray-400">
            <div className="text-[40px] mb-4 opacity-30">⚙</div>
            <div className="text-[14px] font-medium text-app-text-muted mb-1">{displayTitle}</div>
            <div className="text-[12px] text-gray-400">{s.this_page_content_has_not_loaded_yet}</div>
          </div>
        </div>
      </div>
    );
  }

  const getTargetPageForItem = (item: SettingsItem): string | undefined => {
    if (item.targetPage) return item.targetPage;

    // Heuristics: some pages are wired in code (no fragment/intent in XML)
    if (page.id === 'accessibility_text_reading_options') {
      if (item.key === 'font_size' || item.key === 'display_size') return 'PageLayoutFragment';
    }
    if (page.id === 'display_settings_screen') {
      if (item.key === 'font_settings') return 'font_settings2';
      if (item.key === 'page_layout_settings') return 'PageLayoutFragment';
    }
    if (page.id === 'my_device_settings') {
      if (item.key === 'storage_settings') return 'storage_dashboard_fragment';
    }
    if (page.id === 'my_device_detail_settings') {
      if (item.key === 'device_internal_memory') return 'storage_dashboard_fragment';
    }
    if (page.id === 'my_device_info_pref_screen') {
      if (item.key === 'sim_status') return 'device_info_sim_status';
    }
    if (page.id === 'notification_status_bar_settings') {
      if (item.key === 'notification_managing') return 'notification_managing';
    }
    if (
      item.key === 'permission_manager' ||
      item.key === 'permission_settings' ||
      item.key === 'permission_manage' ||
      item.key === 'privacy_authorize_revoke'
    ) {
      return 'permission_managing';
    }
    if (page.id === 'wifi_settings' || page.id === 'wifi_settings2') {
      if (item.key === 'saved_access_point' || item.key === 'saved_access_points' || item.key === 'saved_networks') {
        return 'saved_access_points';
      }
    }

    // Generic fallback: many preference keys map to an internal page id.
    if (item.key) {
      if (findPage(item.key, pages)) return item.key;
      if (findPage(`${item.key}_settings`, pages)) return `${item.key}_settings`;
      if (findPage(`${item.key}_screen`, pages)) return `${item.key}_screen`;
    }

    return undefined;
  };

  const handleItemClick = (item: SettingsItem) => {
    if (item.type === 'preference' && item.key && THEME_STORE_KEYS.has(item.key)) {
      const os = window.__OS__;
      if (os && typeof os.openApp === 'function') {
        os.openApp('theme_store');
        return;
      }
      showToast(s.theme_store_unavailable);
      return;
    }
    const target = getTargetPageForItem(item);
    if (target) {
      go('page.open', { pageId: target });
      return;
    }
    if (item.type === 'preference') {
      go('page.open', {
        pageId: makeExternalPageId(item.title || s.settings, item.key || ''),
      });
    }
  };

  const renderItem = (item: SettingsItem, idx: number, total: number) => {
    const isLast = idx === total - 1;
    const settingKey = item.key || `${page.id}__${item.type}__${idx}`;
    const isInfoPage = INFO_VALUE_PAGES.has(page.id);
    const dynamicValue = isInfoPage && item.key ? formatValue(routeGetPreference(item.key), s) : undefined;
    const tTitle = item.title ? t(item.title) : item.title;
    const tSummary = item.summary ? t(item.summary) : item.summary;

    // Device name is editable on real phones. Use an input dialog instead of external stub/copy-only.
    if (page.id === 'my_device_settings' && item.key === 'device_name') {
      return (
        <ValuePreference
          key={item.key || idx}
          title={tTitle}
          summary={tSummary}
          settingKey={settingKey}
          defaultValue={dynamicValue || item.defaultValue || ''}
          inputType={item.inputType}
          showDivider={!isLast}
        />
      );
    }

    switch (item.type) {
      case 'switch':
      case 'checkbox':
        return (
          <SwitchPreference
            key={item.key || idx}
            title={tTitle}
            summary={tSummary}
            defaultChecked={item.defaultValue === 'true'}
            settingKey={settingKey}
            showDivider={!isLast}
          />
        );
      case 'seekbar':
        return (
          <SeekBarPreference
            key={item.key || idx}
            title={tTitle}
            summary={tSummary}
            defaultValue={
              item.defaultValue && Number.isFinite(Number(item.defaultValue))
                ? Number(item.defaultValue)
                : undefined
            }
            settingKey={settingKey}
            showDivider={!isLast}
          />
        );
      case 'list': {
        return (
          <ListPreference
            key={item.key || idx}
            title={tTitle}
            summary={tSummary}
            options={item.options?.map(o => ({ ...o, label: t(o.label) }))}
            defaultValue={item.defaultValue}
            settingKey={settingKey}
            showDivider={!isLast}
            onMissingOptions={() => showToast(s.this_setting_has_no_available_options_may_be)}
          />
        );
      }
      case 'value': {
        const target = getTargetPageForItem(item);
        // For device information pages, most \"value\" rows are read-only info.
        // If a target exists, treat it as navigation (keep ValuePreference behavior).
        if (isInfoPage && !target && item.key) {
          return (
            <PreferenceItem
              key={item.key || idx}
              title={tTitle}
              summary={tSummary}
              value={dynamicValue || undefined}
              showChevron={false}
              showDivider={!isLast}
              onClick={() => {
                if (!dynamicValue) return;
                ClipboardService.copyText(dynamicValue, 'settings');
                showToast(s.copied_to_clipboard);
              }}
            />
          );
        }
        return (
          <ValuePreference
            key={item.key || idx}
            title={tTitle}
            summary={tSummary}
            settingKey={settingKey}
            defaultValue={item.defaultValue || ''}
            inputType={item.inputType}
            showDivider={!isLast}
            onNavigate={target ? () => go('page.open', { pageId: target }) : undefined}
            itemProps={
              target
                ? bindTap<HTMLDivElement>('page.open', { params: { pageId: target } })
                : undefined
            }
          />
        );
      }
      case 'footer':
        return (
          <div key={item.key || idx} className="px-4 py-2 text-[12px] text-gray-400">
            {tTitle || tSummary}
          </div>
        );
      default: {
        const target = getTargetPageForItem(item);
        const hasInfoValue = isInfoPage && !!item.key && !!dynamicValue;
        const shouldCopyValue = hasInfoValue && !target;
        // Filter out "null" or placeholder summaries (resource keys / placeholders)
        const cleanSummary = (() => {
          const s = item.summary?.trim();
          if (!s) return undefined;
          if (s === 'null') return undefined;
          if (shouldCopyValue && s === t('无法获取')) return undefined;
          if (s.includes('%s')) return undefined;
          if (s === 'summary_placeholder') return undefined;
          if (/^[a-z0-9_]+$/i.test(s) && s.includes('_')) return undefined;
          return t(s);
        })();
        return (
          <PreferenceItem
            key={item.key || idx}
            title={tTitle}
            summary={cleanSummary}
            value={hasInfoValue ? dynamicValue : undefined}
            showChevron={!!target}
            showDivider={!isLast}
            onClick={() => {
              if (shouldCopyValue) {
                ClipboardService.copyText(dynamicValue!, 'settings');
                showToast(s.copied_to_clipboard);
                return;
              }
              handleItemClick(item);
            }}
            itemProps={
              target
                ? bindTap<HTMLDivElement>('page.open', {
                    params: { pageId: target },
                    onTrigger: () => handleItemClick(item),
                  })
                : undefined
            }
          />
        );
      }
    }
  };

  const displayTitle = t(
    mainTargetPageTitleMap[page.id] ||
    page.title ||
    page.id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );

  const isPlaceholderText = (raw: string | undefined) => {
    const s = raw?.trim();
    if (!s) return true;
    if (s === 'null') return true;
    if (s === 'summary_placeholder') return true;
    // Many extracted pages contain resource keys as titles (e.g. "foo_bar_baz").
    if (/^[a-z0-9_]+$/i.test(s) && s.includes('_')) return true;
    return false;
  };

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={displayTitle} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {page.categories.map((category, catIdx) => {
          const visibleItems = category.items.filter((item) => {
            if (item.type === 'footer') {
              return !(isPlaceholderText(item.title) && isPlaceholderText(item.summary));
            }
            return !isPlaceholderText(item.title);
          });
          if (!visibleItems.length) return null;

          return (
            <PreferenceCategory
              key={catIdx}
              title={isPlaceholderText(category.title) ? undefined : t(category.title!)}
            >
              {visibleItems.map((item, idx) =>
                renderItem(item, idx, visibleItems.length)
              )}
            </PreferenceCategory>
          );
        })}
      </div>
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};
