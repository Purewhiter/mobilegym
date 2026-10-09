import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStore } from '../state';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';

/** 设置项：标题 + 可选副标题 + 右箭头，点击跳转子页 */
const SettingItem: React.FC<{
  label: string;
  subtitle?: string;
  transitionId?: string;
  onClick?: () => void;
}> = ({ label, subtitle, transitionId, onClick }) => {
  const { bindTap } = useBilibiliGestures();
  const binding = transitionId ? bindTap(transitionId as any) : {};
  return (
    <div
      className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 cursor-pointer"
      onClick={onClick}
      {...binding}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-gray-900">{label}</div>
        {subtitle != null && subtitle !== '' && (
          <div className="text-[12px] text-gray-400 mt-0.5">{subtitle}</div>
        )}
      </div>
      <IcNavForward size={16} className="text-gray-300 flex-shrink-0 ml-2" />
    </div>
  );
};

/** 分组间的灰色间隔 */
const SectionGap: React.FC = () => (
  <div className="h-2 bg-[#F5F6F7]" />
);

export const SettingsPage: React.FC = () => {
  const { bindBack } = useBilibiliGestures();
  const s = useBilibiliStrings();
  const timerVal = useBilibiliStore((st) => st.settings.timer);
  const sleepReminder = useBilibiliStore((st) => st.settings.sleepReminder);
  const text = {
    title: s.settings_title,
    timerOff: s.settings_timer_off,
    timerOn: s.settings_timer_on,
    sleepOn: s.settings_sleep_on,
    sleepOff: s.settings_sleep_off,
    accountProfile: s.settings_account_profile,
    security: s.settings_security,
    shipping: s.settings_shipping,
    language: s.settings_language,
    splash: s.settings_splash,
    recommend: s.settings_recommend,
    recommendSubtitle: s.settings_recommend_subtitle,
    avatarEntry: s.settings_avatar_entry,
    playback: s.settings_playback,
    offline: s.settings_offline,
    chase: s.settings_chase,
    push: s.settings_push,
    messages: s.settings_messages,
    harass: s.settings_harass,
    downloads: s.settings_downloads,
    storage: s.settings_storage,
    other: s.settings_other,
    timer: s.settings_timer,
    sleep: s.settings_sleep,
    dark: s.settings_dark,
    support: s.settings_support,
    about: s.settings_about,
    business: s.settings_business,
    terms: s.settings_terms,
    privacy: s.settings_privacy,
    privacyPermissions: s.settings_privacy_permissions,
    collectionList: s.settings_collection_list,
    sharingList: s.settings_sharing_list,
    basicPrivacy: s.settings_basic_privacy,
    switchAccount: s.settings_switch_account,
    logout: s.settings_logout,
  };
  const timerLabel = timerVal === 'off' || timerVal === undefined ? text.timerOff : text.timerOn;
  const sleepLabel = sleepReminder ? text.sleepOn : text.sleepOff;

  return (
    <div className="flex flex-col h-full bg-white" data-status-bar-foreground="dark">
      {/* Header */}
      <div className="flex items-center justify-center relative px-4 pt-10 pb-3 bg-white border-b border-gray-100">
        <button
          className="absolute left-3 top-10 p-1"
          {...bindBack()}
        >
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <h1 className="text-[17px] font-medium text-gray-900">{text.title}</h1>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar bg-white"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Section 1: 账号 */}
        <SettingItem label={text.accountProfile} transitionId="settings.profileEdit.open" />
        <SettingItem label={text.security} />
        <SettingItem label={text.shipping} />

        <SectionGap />

        {/* Section 2: 语言 */}
        <SettingItem label={text.language} transitionId="settings.language.open" />

        <SectionGap />

        {/* Section 3: 个性化 */}
        <SettingItem label={text.splash} />
        <SettingItem
          label={text.recommend}
          subtitle={text.recommendSubtitle}
          transitionId="settings.recommend.open"
        />
        <SettingItem label={text.avatarEntry} transitionId="settings.avatarEntry.open" />
        <SettingItem label={text.playback} transitionId="settings.playback.open" />
        <SettingItem label={text.offline} transitionId="settings.offline.open" />
        <SettingItem label={text.chase} transitionId="settings.chase.open" />

        <SectionGap />

        {/* Section 4: 通知 */}
        <SettingItem label={text.push} transitionId="settings.push.open" />
        <SettingItem label={text.messages} transitionId="settings.message.open" />
        <SettingItem label={text.harass} transitionId="settings.harass.open" />
        <SettingItem label={text.downloads} />
        <SettingItem label={text.storage} transitionId="settings.storage.open" />
        <SettingItem label={text.other} transitionId="settings.other.open" />

        <SectionGap />

        {/* Section 5: 定时 */}
        <SettingItem label={text.timer} subtitle={timerLabel} transitionId="settings.timer.open" />
        <SettingItem label={text.sleep} subtitle={sleepLabel} transitionId="settings.sleep.open" />

        <SectionGap />

        {/* Section 6: 深色 */}
        <SettingItem label={text.dark} />

        <SectionGap />

        {/* Section 7: 关于 */}
        <SettingItem label={text.support} />
        <SettingItem label={text.about} />
        <SettingItem label={text.business} />

        <SectionGap />

        {/* Section 8: 协议 */}
        <SettingItem label={text.terms} />
        <SettingItem label={text.privacy} />
        <SettingItem label={text.privacyPermissions} />
        <SettingItem label={text.collectionList} />
        <SettingItem label={text.sharingList} />
        <SettingItem label={text.basicPrivacy} />

        <SectionGap />

        {/* Bottom buttons */}
        <div className="py-3">
          <div className="text-center text-[15px] text-gray-900 py-3 active:bg-gray-50 cursor-pointer">
            {text.switchAccount}
          </div>
        </div>
        <div className="border-t border-gray-100 py-3">
          <div className="text-center text-[15px] text-gray-900 py-3 active:bg-gray-50 cursor-pointer">
            {text.logout}
          </div>
        </div>

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
};
