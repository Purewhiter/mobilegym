import React from 'react';
import { SettingLayout, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsSleepPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const enabled = useBilibiliStore((st) => st.settings.sleepReminder) ?? false;

  return (
    <SettingLayout title={s.ssl_title}>
      <SettingItemSwitch
        label={s.ssl_label}
        subtitle={s.ssl_sub}
        checked={enabled}
        onChange={(v) => setSetting('sleepReminder', v)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
