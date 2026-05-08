import React from 'react';
import { SettingLayout, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsOfflinePage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const autoDownload = useBilibiliStore((s) => s.settings.offline.autoDownload) ?? true;

  return (
    <SettingLayout title="离线设置">
      <SettingItemSwitch
        label="自动下载"
        subtitle="自动开始未完成的下载任务"
        checked={autoDownload}
        onChange={(v) => setSetting('offline.autoDownload', v)}
      />
      <SettingItemArrow label="离线诊断" />
      <SettingItemArrow label="外置存储卡测试" />
      <div className="h-8" />
    </SettingLayout>
  );
};
