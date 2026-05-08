import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'off', label: '不启用' },
  { id: 'center', label: '图片中部' },
  { id: 'bottomRight', label: '图片右下角' },
];

export const SettingsWatermarkPage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.other.watermark) ?? 'off';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="图片水印设置">
      <div className="px-4 py-2 text-[13px] text-gray-500">开启后,将为动态和评论发布的图片添加水印</div>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('other.watermark', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
