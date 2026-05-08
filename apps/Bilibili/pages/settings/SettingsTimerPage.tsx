import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'off', label: '不开启' },
  { id: '15', label: '15分钟' },
  { id: '30', label: '30分钟' },
  { id: '60', label: '60分钟' },
  { id: 'custom', label: '自定义' },
];

export const SettingsTimerPage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.timer) ?? 'off';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="定时关闭">
      <div className="px-4 py-3 text-center text-[13px] text-gray-500">计时结束后，将进行提醒</div>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('timer', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
