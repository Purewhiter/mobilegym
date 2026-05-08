import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsChasePage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const xianXiu = useBilibiliStore((s) => s.settings.chase.xianXiuMode) ?? false;

  return (
    <SettingLayout title="追番/追剧设置">
      <SettingItemSwitch
        label="修仙模式"
        subtitle="开启后深夜0点-6点的动画将在前一天展示"
        checked={xianXiu}
        onChange={(v) => setSetting('chase.xianXiuMode', v)}
      />
      <SettingSection title="修仙模式预览" />
      <div className="px-4 py-2 text-[12px] text-gray-500">修仙模式 显示次日0-6点番剧</div>
      <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100">
        <span className="text-[13px] text-gray-600">23:59</span>
        <div className="w-14 h-14 bg-gray-100 rounded flex-shrink-0" />
        <div className="flex-1">
          <div className="h-3 bg-gray-200 rounded w-full mb-1" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
      {['24:00', '26:00', '28:00', '29:59'].map((t) => (
        <div key={t} className="px-4 py-2 flex items-center gap-3 border-b border-gray-100">
          <span className="text-[13px] text-gray-600">{t}</span>
          <div className="w-14 h-14 bg-gray-100 rounded flex-shrink-0" />
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded w-full mb-1" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      ))}
      <div className="h-8" />
    </SettingLayout>
  );
};
