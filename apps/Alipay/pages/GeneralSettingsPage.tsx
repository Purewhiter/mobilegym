import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type Row =
  | { id: string; label: string; rightText?: string; type?: 'link' }
  | { id: string; label: string; type: 'switch'; value: boolean; onToggle: () => void };

export const GeneralSettingsPage: React.FC = () => {
  const { bindTap, bindBack } = useAlipayGestures();
  const language = useAlipayStore(s => s.language);
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const s = useAlipayStrings();
  const selfScrollRef = React.useRef<HTMLDivElement | null>(null);
  const refreshSoundEnabled = settings.general.refreshSoundEnabled;
  const persistSelfScroll = () => {
    try {
      const top = selfScrollRef.current?.scrollTop ?? 0;
      window.sessionStorage.setItem('alipay_scroll_settings_general_inner_v1', String(top));
    } catch {}
  };
  const darkModeRightText = (() => {
    const follow = settings.general.darkMode.followSystem;
    const mode = settings.general.darkMode.mode;
    if (follow) return s.generalsettingspage_on;
    if (mode === 'dark') return s.generalsettingspage_on;
    return s.generalsettingspage_off;
  })();
  const languageLabel =
    language === 'zh-TW'
      ? s.traditional_chinese_tw
      : language === 'zh-HK'
        ? s.traditional_chinese_hk
        : language === 'en'
          ? 'English'
          : s.simplified_chinese;

  const groups: Row[][] = [
    [
      { id: 'widgets', label: s.widgets_and_shortcuts },
      { id: 'language', label: s.language, rightText: languageLabel },
      { id: 'translate', label: s.translation },
      { id: 'fontSize', label: s.font_size },
      { id: 'darkMode', label: s.dark_mode, rightText: darkModeRightText },
      { id: 'speedMode', label: s.speed_mode },
      { id: 'skin', label: s.skin_settings },
    ],
    [
      { id: 'homeManage', label: s.home_management },
      { id: 'videoManage', label: s.video_management },
      { id: 'messageManage', label: s.messages_management },
      { id: 'myManage', label: s.my_page_management },
    ],
    [{ id: 'otherFeatureManage', label: s.other_features }],
    [
      { id: 'navSettings', label: s.navigation },
      { id: 'clipboard', label: s.clipboard },
      {
        id: 'refreshSound',
        label: s.refresh_sound,
        type: 'switch',
        value: refreshSoundEnabled,
        onToggle: () => setSettings((prev) => ({ ...prev, general: { ...prev.general, refreshSoundEnabled: !prev.general.refreshSoundEnabled } })),
      },
    ],
    [
      { id: 'storage', label: s.storage_management, rightText: s.clear_cache },
      { id: 'clearChats', label: s.clear_chat_history },
    ],
  ];

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('alipay_scroll_settings_general_inner_v1');
      const top = raw ? Number(raw) : 0;
      if (!Number.isFinite(top) || top <= 0) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (selfScrollRef.current) selfScrollRef.current.scrollTop = top;
        });
      });
      const t = window.setTimeout(() => {
        if (selfScrollRef.current) selfScrollRef.current.scrollTop = top;
      }, 50);
      return () => window.clearTimeout(t);
    } catch {}
  }, []);

  React.useEffect(() => {
    return () => {
      persistSelfScroll();
    };
  }, []);

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>

      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.general}</span>
        <div className="w-6" />
      </div>

      <div
        ref={selfScrollRef}
        className="flex-1 overflow-auto no-scrollbar px-4 py-3 space-y-3"
        onScroll={persistSelfScroll}
      >
        {groups.map((rows, gi) => (
          <div key={gi} className="bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {rows.map((row) => {
              if (row.type === 'switch') {
                return (
                  <div key={row.id} className="flex items-center justify-between px-4 py-4">
                    <span className="text-sm font-medium text-gray-800">{row.label}</span>
                    <button
                      {...bindTap<HTMLButtonElement>(
                        { kind: 'action', id: 'general.refreshSound.toggle' },
                        { onTrigger: row.onToggle, stopPropagation: true },
                      )}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${row.value ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
                    >
                      <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                  {...(row.id === 'language'
                    ? bindTap<HTMLDivElement>('settings.general.language.open', { beforeTrigger: persistSelfScroll })
                    : row.id === 'fontSize'
                      ? bindTap<HTMLDivElement>('settings.general.fontSize.open', { beforeTrigger: persistSelfScroll })
                      : row.id === 'darkMode'
                        ? bindTap<HTMLDivElement>('settings.general.darkMode.open', { beforeTrigger: persistSelfScroll })
                        : row.id === 'speedMode'
                          ? bindTap<HTMLDivElement>('settings.general.speedMode.open', { beforeTrigger: persistSelfScroll })
                          : row.id === 'clipboard'
                            ? bindTap<HTMLDivElement>('settings.general.clipboard.open', { beforeTrigger: persistSelfScroll })
                            : row.id === 'myManage'
                              ? bindTap<HTMLDivElement>('settings.general.myManage.open', { beforeTrigger: persistSelfScroll })
                              : row.id === 'homeManage'
                                ? bindTap<HTMLDivElement>('settings.general.homeManage.open', { beforeTrigger: persistSelfScroll })
                                : {})}
                >
                  <span className="text-sm font-medium text-gray-800">{row.label}</span>
                  <div className="flex items-center text-xs text-gray-400">
                    {row.rightText && <span className="mr-2">{row.rightText}</span>}
                    <IcNavForward size={16} className="text-gray-300" />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div className="h-10" />
      </div>
    </div>
  );
};
