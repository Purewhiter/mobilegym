import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { useAppNavigate } from '../navigation';
import { PHONE_SETTINGS_PAGES } from '../data/phoneSettingsPages.generated';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { IcNavBack, IcNavForward } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { getPhoneSettingsPageTitle } from '../utils/localizedText';

export const PhoneSettingsHomePage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindBack, bindTap } = useContactsGestures();
  const location = useLocation();
  const { go } = useAppNavigate();
  const s = useAppStrings(strings, stringsEn);

  const mode: 'calls' | 'contacts' = location.pathname.includes('/settings/contacts') ? 'contacts' : 'calls';
  const title = mode === 'contacts' ? s.settings_contacts_title : s.settings_calls_title;

  const rootPageCandidates =
    mode === 'contacts'
      ? ['preference_settings']
      : ['miui_call_feature_setting', 'phone_calls_settings_home'];

  const rootPageId = rootPageCandidates.find((id) => Boolean(PHONE_SETTINGS_PAGES[id])) || rootPageCandidates[0];

  useEffect(() => {
    if (PHONE_SETTINGS_PAGES[rootPageId]) {
      go('settings.page.open', { pageId: rootPageId }, { mode: 'replace' });
    }
  }, [go, rootPageId]);

  if (PHONE_SETTINGS_PAGES[rootPageId]) {
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <div className="sticky top-0 z-20 bg-app-bg">
          <div className="h-10" />
          <div className="flex items-center h-12 px-3">
            <button
              type="button"
              aria-label={isEnglish ? 'Back' : '返回'}
              {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
              className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
            >
              <IcNavBack size={24} className="text-app-text" />
            </button>
            <div className="flex-1 text-center text-[16px] font-semibold text-app-text">{title}</div>
            <div className="w-10" />
          </div>
        </div>

        <div className="px-6 py-10 text-[13px] text-gray-400">{s.settings_opening}</div>
      </div>
    );
  }

  const pageIds = useMemo(() => {
    const extracted = Object.keys(PHONE_SETTINGS_PAGES);
    if (extracted.length > 0) return extracted.sort();

    return [
      'preference_settings',
      'preference_import_and_export',
      'preference_display_options',
      'preference_more',
      'preference_privacy_settings',
      'preference_privacy_contacts',
      'preference_privacy_permission',
      'preference_account_list_filter',
      'preference_dial_pad_touch_tone',
      'preference_dial_pad_touch_tone_v11',
      'preference_device_other_fragment',
    ];
  }, []);

  const visibleIds = useMemo(() => {
    if (mode === 'contacts') {
      return pageIds.filter((id) => !id.startsWith('preference_dial_pad_touch_tone'));
    }
    return pageIds.filter((id) => id.startsWith('preference_dial_pad_touch_tone') || id.startsWith('preference_privacy_'));
  }, [mode, pageIds]);

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <div className="sticky top-0 z-20 bg-app-bg">
        <div className="h-10" />
        <div className="flex items-center h-12 px-3">
          <button
            type="button"
            aria-label={isEnglish ? 'Back' : '返回'}
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
          >
            <IcNavBack size={24} className="text-app-text" />
          </button>
          <div className="flex-1 text-center text-[16px] font-semibold text-app-text">{title}</div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="px-4 mt-3">
          <div className="bg-app-surface rounded-2xl overflow-hidden">
            {visibleIds.map((id, index) => (
              <React.Fragment key={id}>
                <button
                  type="button"
                  {...bindTap('settings.page.open', { params: { pageId: id } })}
                  className="w-full px-4 py-4 flex items-center justify-between text-left active:bg-black/5"
                >
                  <span className="text-[15px] text-app-text">
                    {PHONE_SETTINGS_PAGES[id]?.title ? getPhoneSettingsPageTitle(id, locale) : getPhoneSettingsPageTitle(id, locale)}
                  </span>
                  <IcNavForward size={18} className="text-gray-300" />
                </button>
                {index < visibleIds.length - 1 ? <div className="h-px bg-black/5 ml-4" /> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
