import React from 'react';
import { SettingLayout, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsSleepPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const enabled = useBilibiliStore((s) => s.settings.sleepReminder) ?? false;

  return (
    <SettingLayout title="睡眠提醒">
      <SettingItemSwitch
        label="睡眠提醒"
        subtitle="开启后在睡眠时间将进行提醒"
        checked={enabled}
        onChange={(v) => setSetting('sleepReminder', v)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
