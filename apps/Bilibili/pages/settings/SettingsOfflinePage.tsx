import React from 'react';
import { SettingLayout, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsOfflinePage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const autoDownload = useBilibiliStore((st) => st.settings.offline.autoDownload) ?? true;

  return (
    <SettingLayout title={s.so_title}>
      <SettingItemSwitch
        label={s.so_auto}
        subtitle={s.so_auto_sub}
        checked={autoDownload}
        onChange={(v) => setSetting('offline.autoDownload', v)}
      />
      <SettingItemArrow label={s.so_diagnosis} />
      <SettingItemArrow label={s.so_sdcard} />
      <div className="h-8" />
    </SettingLayout>
  );
};
