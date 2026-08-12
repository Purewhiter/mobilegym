import React from 'react';
import { SettingLayout, SettingSection, SettingItemArrow, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsAvatarEntryPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const watchVideo = useBilibiliStore((st) => st.settings.avatarEntry.watchVideo) ?? true;
  const listenVideo = useBilibiliStore((st) => st.settings.avatarEntry.listenVideo) ?? true;

  return (
    <SettingLayout title={s.sa_title}>
      <SettingSection title={s.sa_sec_jump} />
      <SettingItemArrow label={s.sa_recent} subtitle={s.sa_recent_sub} />
      <SettingItemSwitch label={s.sa_watch} subtitle={s.sa_watch_sub} checked={watchVideo} onChange={(v) => setSetting('avatarEntry.watchVideo', v)} />
      <SettingItemSwitch label={s.sa_listen} subtitle={s.sa_listen_sub} checked={listenVideo} onChange={(v) => setSetting('avatarEntry.listenVideo', v)} />
      <SettingItemArrow label={s.sa_me} subtitle={s.sa_me_sub} />
      <SettingSection title={s.sa_sec_quick} />
      <div className="px-4 py-3 flex flex-wrap gap-4">
        {[s.sa_offline, s.sa_history, s.sa_fav, s.sa_later].map((name) => (
          <div key={name} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs" />
            <span className="text-[12px] text-gray-600 mt-1">{name}</span>
          </div>
        ))}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xl">+</div>
          <span className="text-[12px] text-gray-500 mt-1">{s.sa_add}</span>
        </div>
      </div>
      <div className="h-8" />
    </SettingLayout>
  );
};
