
import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useLocation } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsItem, SettingsToggle } from './Shared';
import { UserSettings } from '../../types';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const MomentsPermissionsPage: React.FC = () => {
  const t = useWechatStrings();
  const { settings, updateSettings } = useWechatStore(
    useShallow(s => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
    })),
  );
  const { privacy } = settings;
  const location = useLocation();
  const { bindTap, bindBack, back } = useWechatGestures();
  const searchParams = new URLSearchParams(location.search);
  const showRangeModal = searchParams.get('menu') === 'range';

  const updatePrivacy = (updates: Partial<UserSettings['privacy']>) => {
    updateSettings({
      ...settings,
      privacy: {
        ...privacy,
        ...updates,
      },
    });
  };

  const rangeOptions: UserSettings['privacy']['momentsRange'][] = ['最近半年', '最近一个月', '最近三天', '全部'];

  const localizeRange = (value: UserSettings['privacy']['momentsRange']) => {
    switch (value) {
      case '最近半年':
        return t.privacy_moments_range_half_year;
      case '最近一个月':
        return t.privacy_moments_range_month;
      case '最近三天':
        return t.privacy_moments_range_three_days;
      case '全部':
        return t.privacy_moments_range_all;
      default:
        return value;
    }
  };

  const rangeActionPropsOf = (range: UserSettings['privacy']['momentsRange']) => {
    switch (range) {
      case '最近半年':
        return bindTap<HTMLDivElement>(
          { kind: 'action', id: 'settings.privacy.moments.range.select.recentHalfYear' },
          { params: { range }, onTrigger: () => handleSelectRange(range) },
        );
      case '最近一个月':
        return bindTap<HTMLDivElement>(
          { kind: 'action', id: 'settings.privacy.moments.range.select.recentMonth' },
          { params: { range }, onTrigger: () => handleSelectRange(range) },
        );
      case '最近三天':
        return bindTap<HTMLDivElement>(
          { kind: 'action', id: 'settings.privacy.moments.range.select.recentThreeDays' },
          { params: { range }, onTrigger: () => handleSelectRange(range) },
        );
      case '全部':
      default:
        return bindTap<HTMLDivElement>(
          { kind: 'action', id: 'settings.privacy.moments.range.select.all' },
          { params: { range }, onTrigger: () => handleSelectRange(range) },
        );
    }
  };

  const handleSelectRange = (range: UserSettings['privacy']['momentsRange']) => {
    updatePrivacy({ momentsRange: range });
    back();
  };

  return (
    <div className="bg-app-bg min-h-full relative">
      <div className="h-2"></div>
      <div className="bg-app-surface">
        <SettingsItem label={t.privacy_moments_hide_mine_from_them} />
        <SettingsItem label={t.privacy_moments_do_not_view_theirs} isLast />
      </div>

      <div className="h-2"></div>
      <div className="bg-app-surface">
        <SettingsToggle
          label={t.privacy_moments_stranger_ten}
          isOn={privacy.momentsStrangerTen}
          onToggle={() => updatePrivacy({ momentsStrangerTen: !privacy.momentsStrangerTen })}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.moments.strangerTen.toggle' },
            { onTrigger: () => updatePrivacy({ momentsStrangerTen: !privacy.momentsStrangerTen }) },
          )}
          isLast
        />
      </div>

      <div className="h-2"></div>
      <div className="bg-app-surface">
        <SettingsItem
          label={t.privacy_moments_friend_range}
          rightContent={
            <span className="text-(--app-c-settings-item-extra-text) text-(--app-settings-item-text-size)">
              {localizeRange(privacy.momentsRange)}
            </span>
          }
          tapProps={bindTap<HTMLDivElement>('settings.privacy.moments.menu.range.open')}
          isLast
        />
      </div>

      {showRangeModal && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center px-8">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-black/50"
            style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
          ></div>

          <div
            className="relative bg-app-surface w-full rounded-[12px] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in"
            style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          >
            <div className="px-6 py-8">
              <h3 className="text-(--app-title-text-size-18) font-bold text-app-text text-center mb-8">
                {t.privacy_moments_friend_range}
              </h3>

              <div className="space-y-8">
                {rangeOptions.map(option => (
                  <div key={option} {...rangeActionPropsOf(option)} className="flex items-center group cursor-pointer">
                    <div
                      className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center mr-4 ${
                        privacy.momentsRange === option
                          ? 'border-app-primary bg-app-surface'
                          : 'border-(--app-c-tw-border-gray-300) bg-app-surface'
                      }`}
                      style={{
                        transition:
                          'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)',
                      }}
                    >
                      {privacy.momentsRange === option && (
                        <div className="w-2.5 h-2.5 rounded-full bg-app-primary"></div>
                      )}
                    </div>
                    <span
                      className={`text-(--app-settings-item-text-size) ${
                        privacy.momentsRange === option ? 'text-app-text font-medium' : 'text-app-text'
                      }`}
                    >
                      {localizeRange(option)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-(--app-c-tw-border-gray-100)">
              <button
                {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
                className="w-full h-(--app-settings-item-height) text-(--app-settings-item-text-size) font-bold text-app-text active:bg-(--app-c-tw-bg-gray-50)"
                style={{
                  transition:
                    'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)',
                }}
              >
                {t.common_cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
