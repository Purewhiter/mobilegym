import React from 'react';
import { IcBell, IcChart, IcDownload, IcInfo, IcLock, IcMic, IcPhone, IcUser, IcVolume } from '../res/icons';
import { Header } from '../components/SettingsComponents';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const SettingsPage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();

  const Section = ({
    icon: Icon,
    title,
    desc,
    tapProps,
  }: {
    icon: any;
    title: string;
    desc: string;
    tapProps?: React.HTMLAttributes<HTMLDivElement>;
  }) => (
    <div
      {...(tapProps ?? {})}
      className="flex items-center gap-4 py-2 active:bg-white/10 -mx-4 px-4 rounded transition-colors cursor-pointer"
    >
      <div className="text-gray-400"><Icon size={24} /></div>
      <div className="flex-1">
        <div className="text-base font-medium">{title}</div>
        {desc && <div className="text-gray-400 text-xs mt-0.5">{desc}</div>}
      </div>
    </div>
  );

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40"
    >
      <Header title={s.settings_title} />

      <div className="space-y-0.5">
        <Section icon={IcUser} title={s.settings_account} desc={s.settings_account_desc} tapProps={bindTap('settings.account.open')} />
        <Section icon={IcPhone} title={s.settings_content_display} desc={s.settings_content_display_desc} tapProps={bindTap('settings.content.open')} />
        <Section icon={IcVolume} title={s.settings_playback} desc={s.settings_playback_desc} tapProps={bindTap('settings.playback.open')} />
        <Section icon={IcLock} title={s.settings_privacy} desc={s.settings_privacy_desc} tapProps={bindTap('settings.privacy.open')} />
        <Section icon={IcBell} title={s.settings_notifications} desc={s.settings_notifications_desc} tapProps={bindTap('settings.notifications.open')} />
        <Section icon={IcMic} title={s.settings_apps_devices} desc={s.settings_apps_devices_desc} tapProps={bindTap('settings.apps.open')} />
        <Section icon={IcDownload} title={s.settings_data_saver} desc={s.settings_data_saver_desc} tapProps={bindTap('settings.dataSaver.open')} />
        <Section icon={IcChart} title={s.settings_media_quality} desc={s.settings_media_quality_desc} tapProps={bindTap('settings.quality.open')} />
        <Section icon={IcInfo} title={s.settings_about} desc={s.settings_about_desc} tapProps={bindTap('settings.about.open')} />
      </div>

      <div className="mt-6 mb-8 flex justify-center">
        <button
          {...bindTap('tab.home')}
          className="bg-white text-black px-8 py-3 rounded-full font-bold text-sm active:scale-95 transition-transform"
        >
          {s.settings_logout}
        </button>
      </div>
    </div>
  );
};
