import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { useLocale } from '@/apps/Bilibili/locale';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStore } from '../state';

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
  const locale = useLocale();
  const timerVal = useBilibiliStore((s) => s.settings.timer);
  const sleepReminder = useBilibiliStore((s) => s.settings.sleepReminder);
  const text = locale === 'en'
    ? {
        title: 'Settings',
        timerOff: 'Off',
        timerOn: 'On',
        sleepOn: 'Remind me',
        sleepOff: 'No reminder',
        accountProfile: 'Account profile',
        security: 'Security & privacy',
        shipping: 'Shipping info',
        language: 'Language',
        splash: 'Launch screen',
        recommend: 'Home recommendations',
        recommendSubtitle: 'Double-column / autoplay on Wi-Fi or mobile data',
        avatarEntry: 'Home avatar entry',
        playback: 'Playback',
        offline: 'Offline settings',
        chase: 'Anime & drama settings',
        push: 'Push notifications',
        messages: 'Message settings',
        harass: 'Harassment & interaction filters',
        downloads: 'Download management',
        storage: 'Clear storage',
        other: 'Other settings',
        timer: 'Sleep timer',
        sleep: 'Sleep reminder',
        dark: 'Dark mode',
        support: 'Support',
        about: 'About Bilibili',
        business: 'Business inquiries',
        terms: 'User Agreement',
        privacy: 'Privacy Policy',
        privacyPermissions: 'Privacy permissions',
        collectionList: 'Personal info collection list',
        sharingList: 'Third-party sharing list',
        basicPrivacy: 'Bilibili basic feature privacy policy',
        switchAccount: 'Switch account',
        logout: 'Sign out',
      }
    : {
        title: '设置',
        timerOff: '不开启',
        timerOn: '已开启',
        sleepOn: '已提醒',
        sleepOff: '不提醒',
        accountProfile: '账号资料',
        security: '安全隐私',
        shipping: '收货信息',
        language: '语言',
        splash: '开屏画面设置',
        recommend: '首页推荐设置',
        recommendSubtitle: '双列/Wi-Fi/免流/移动网络下自动播放',
        avatarEntry: '首页头像入口设置',
        playback: '播放设置',
        offline: '离线设置',
        chase: '追番/追剧设置',
        push: '推送设置',
        messages: '消息设置',
        harass: '防骚扰和互动人群设置',
        downloads: '下载管理',
        storage: '清理存储空间',
        other: '其他设置',
        timer: '定时关闭',
        sleep: '睡眠提醒',
        dark: '深色设置',
        support: '我的客服',
        about: '关于哔哩哔哩',
        business: '商务合作',
        terms: '用户协议',
        privacy: '隐私政策',
        privacyPermissions: '隐私权限设置',
        collectionList: '个人信息收集清单',
        sharingList: '第三方信息共享清单',
        basicPrivacy: '哔哩哔哩（基本功能）隐私政策',
        switchAccount: '账号切换',
        logout: '退出登录',
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
