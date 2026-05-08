import React from 'react';
import { IcSearch } from '../res/icons';
import { SettingsIcon } from './SettingsIcon';
import { PreferenceItem } from './PreferenceItem';
import { Toast } from '@/os/components/Toast';
import { SETTINGS_PAGE_OVERRIDES } from '../data/settingsOverrides';
import { useBooleanPreference, useStringPreference, useSettingsStore, selectWifiConnectedSsid, selectPagesData, selectPagesLoading, selectPagesError } from '../state';
import { CollapsingToolbar, CollapsingLargeTitle, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { useSettingsStrings } from '../res/useSettingsStrings';
import { ChevronRightIcon } from '../res/icons';
import { useSettingsGestures } from '../hooks/useSettingsGestures';
import { useLocale } from '../../../os/locale';
/** Mock dynamic summaries for certain items */
const DYNAMIC_SUMMARY_KEYS: Record<string, string> = {
  mi_account_settings: 'mi_account_settings_summary',
  battery_settings_new: '',
};

/** Manual mapping: item id -> SETTINGS_PAGES key.
 *  Keep this small: only for external-intent entries and hand-written stubs. */
const PAGE_OVERRIDES: Record<string, string> = {
  // External intents (no fragment in headers, but we have useful internal XML screens)
  msim_settings: 'mobile_network_pref_screen',
  interconnection_settings: 'connected_devices_screen',
  privacy_protection_settings: 'security_privacy_settings',
  battery_settings_new: 'battery_settings',
  flash_notifications: 'flash_notifications_settings',
  ai_services: 'ai_settings',

  // Hand-written stubs
  app_timer: 'app_timer',
  minors_control: 'minors_control',
};

/** Items that should be hidden (device-specific, not relevant for simulation) */
const HIDDEN_ITEMS = new Set([
  'sub_screen',
  'system_apps_updater',
  'fold_screen_settings',
  'tablet_screen_settings',
  'flip_screen_settings',
  'security_status',
  'satellite_settings',
  'operator_settings',
  'camera_grip_settings',
  'stylus_and_keyboard_settings',
  'privacy_settings2',
  'dynamic_item',
  'manufacturer_settings',
  'global_feedback_category',
  'onedrive_account',
]);

export const SettingsMainPage: React.FC = () => {
  const { bindTap, go } = useSettingsGestures();
  const { s, t } = useSettingsStrings();
  const locale = useLocale();
  const data = useSettingsStore(selectPagesData);
  const loading = useSettingsStore(selectPagesLoading);
  const error = useSettingsStore(selectPagesError);
  const mainSections = data?.mainSections ?? null;
  const pages = data?.pages ?? null;
  const [wifiEnabled] = useBooleanPreference('wifi_enable', true);
  const connectedSsid = useSettingsStore(selectWifiConnectedSsid);
  const [bluetoothEnabled] = useBooleanPreference('bluetooth_enable', true);
  const [storedAccountName] = useStringPreference('branded_account', '');
  const accountName = React.useMemo(() => {
    if (!storedAccountName) return s.default_account_name;
    if (locale === 'en' && storedAccountName === '小米用户') return s.default_account_name;
    if (locale !== 'en' && storedAccountName === 'Xiaomi User') return s.default_account_name;
    return storedAccountName;
  }, [locale, s.default_account_name, storedAccountName]);
  const accountAvatarText = accountName.slice(0, 1);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [toast, setToast] = React.useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const toastTimerRef = React.useRef<number | undefined>(undefined);

  // ── Two-phase collapsing toolbar (sticky + snap) ──
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const searchBarRef = React.useRef<HTMLDivElement>(null);
  const largeTitleRef = React.useRef<HTMLDivElement>(null);
  const [collapseZones, setCollapseZones] = React.useState({ S: 56, T: 42 });

  React.useLayoutEffect(() => {
    const s = searchBarRef.current?.offsetHeight ?? 56;
    const t = largeTitleRef.current?.offsetHeight ?? 42;
    setCollapseZones({ S: s, T: t });
  }, []);

  const { S, T } = collapseZones;
  const phase2 = Math.max(0, Math.min(1, (scrollTop - S) / T));
  const largeTitleOpacity = scrollTop <= S ? 1 : Math.max(0, 1 - phase2 * 2);
  const smallTitleOpacity = scrollTop <= S ? 0 : Math.min(1, phase2 * 2);

  const snapTimerRef = React.useRef<number | undefined>(undefined);
  const snapToNearest = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const st = el.scrollTop;
    if (st > S + T || [0, S, S + T].some(p => Math.abs(st - p) < 2)) return;
    const target = st <= S ? (st < S / 2 ? 0 : S) : (st < S + T / 2 ? S : S + T);
    el.scrollTo({ top: target, behavior: 'smooth' });
  }, [S, T]);

  const handleScroll = React.useCallback((e: React.UIEvent) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(snapToNearest, 150);
  }, [snapToNearest]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scrollend', snapToNearest);
    return () => el.removeEventListener('scrollend', snapToNearest);
  }, [snapToNearest]);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
  };

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, []);

  const getTargetPageId = React.useCallback(
    (itemId: string, targetPage?: string) => PAGE_OVERRIDES[itemId] || targetPage || itemId,
    [],
  );

  const handleItemClick = React.useCallback((itemId: string, targetPage?: string) => {
    if (!pages) {
      showToast(loading ? s.loading_settings_please_wait : s.settings_data_load_failed);
      return;
    }

    // Theme / wallpaper entries: open Theme Store app directly.
    if (itemId === 'wallpaper_settings' || itemId === 'theme_settings') {
      const os = window.__OS__;
      if (os && typeof os.openApp === 'function') {
        os.openApp('theme_store');
        return;
      }
    }

    // Check manual override first, then use targetPage, then fallback to itemId
    const candidate = getTargetPageId(itemId, targetPage);
    const hasPage = !!(pages as any)[candidate] || !!(SETTINGS_PAGE_OVERRIDES as any)[candidate];
    if (hasPage) {
      go('page.open', { pageId: candidate });
      return;
    }
    showToast(s.this_setting_would_open_a_system_page_on_a_real);
  }, [getTargetPageId, go, loading, pages, s]);

  const bindOpenPage = React.useCallback(
    (itemId: string, targetPage?: string) =>
      bindTap<HTMLDivElement>('page.open', {
        params: { pageId: getTargetPageId(itemId, targetPage) },
        onTrigger: () => handleItemClick(itemId, targetPage),
      }),
    [bindTap, getTargetPageId, handleItemClick],
  );

  return (
    <div className="h-full bg-app-bg relative flex flex-col">
      <CollapsingToolbar
        title={s.settings}
        scrollTop={scrollTop}
        smallTitleOpacity={smallTitleOpacity}
      />

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
      >
        {/* ★ Collapse wrapper — sticky 父容器边界约束 */}
        <div>
          {/* Fixed toolbar spacer */}
          <div style={{ height: TOOLBAR_SPACER_HEIGHT }} />

          {/* Large collapsing title — sticky below toolbar */}
          <CollapsingLargeTitle
            ref={largeTitleRef}
            title={s.settings}
            scrollTop={scrollTop}
            fontSizeClass="text-[28px]"
            sticky
            opacity={largeTitleOpacity}
          />

          {/* Search bar — scrolls behind sticky title */}
          <div ref={searchBarRef} className="px-4 pb-4 relative z-10">
            <button
              type="button"
              className="w-full bg-white/80 backdrop-blur rounded-full flex items-center px-4 py-2.5 gap-2 active:bg-gray-50"
              {...bindTap<HTMLButtonElement>('search.open')}
            >
              <IcSearch size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-[14px] text-gray-400">{s.search_settings}</span>
            </button>
          </div>
        </div>

        {/* Sections */}
        {!mainSections ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">
            {error ? s.settings_data_load_failed : (loading ? s.loading_settings_data : s.settings_data_not_ready)}
          </div>
        ) : mainSections.map((section, sectionIdx) => {
        const visibleItems = section.items.filter(
          (item) => !HIDDEN_ITEMS.has(item.id) && item.title
        );
        if (visibleItems.length === 0) return null;

        // Special: first section = account + my device
        if (sectionIdx === 0) {
          return (
            <div key={sectionIdx} className="px-4 mb-3 space-y-2">
              {visibleItems.map((item) => {
                if (item.id === 'mi_account_settings') {
                  return (
                    <div
                      key={item.id}
                      className="bg-app-surface rounded-2xl p-4 flex items-center active:bg-gray-50"
                      {...bindOpenPage(item.id, item.targetPage)}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-lg mr-3 flex-shrink-0">
                        {accountAvatarText}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-medium text-app-text">{accountName}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5">
                          {s.mi_account_settings_summary}
                        </div>
                      </div>
                      <ChevronRightIcon className="text-gray-300" />
                    </div>
                  );
                }
                if (item.id === 'my_device') {
                  return (
                    <div
                      key={item.id}
                      className="bg-app-surface rounded-2xl px-4 py-3.5 flex items-center active:bg-gray-50"
                      {...bindOpenPage(item.id, item.targetPage)}
                    >
                      {item.icon && (
                        <div className="mr-3 flex-shrink-0">
                          <SettingsIcon name={item.icon} size={28} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] text-app-text">{t(item.title)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white bg-app-primary rounded-full px-2 py-0.5">
                          {s.new_version}
                        </span>
                        <ChevronRightIcon className="text-gray-300" />
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          );
        }

        // Regular sections: white card with items
        return (
          <div key={sectionIdx} className="px-4 mb-3">
            <div className="bg-app-surface rounded-2xl overflow-hidden">
              {visibleItems.map((item, idx) => (
                <PreferenceItem
                  key={item.id}
                  title={t(item.title)}
                  icon={item.icon}
                  value={
                    item.id === 'wifi_settings'
                      ? (wifiEnabled ? (connectedSsid || s.not_connected) : s.off_2)
                      : item.id === 'bluetooth_settings'
                        ? (bluetoothEnabled ? s.on_2 : s.off_2)
                        : (DYNAMIC_SUMMARY_KEYS[item.id] ? s[DYNAMIC_SUMMARY_KEYS[item.id] as keyof typeof s] : undefined)
                  }
                  showDivider={idx < visibleItems.length - 1}
                  itemProps={bindOpenPage(item.id, item.targetPage)}
                />
              ))}
            </div>
          </div>
        );
      })}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};
