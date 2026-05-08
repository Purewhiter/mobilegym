import React from 'react';
import { SettingLayout, SettingItemArrow, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

export const SettingsOtherPage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const wifiPkg = useBilibiliStore((s) => s.settings.other.wifiPkg) ?? true;
  const clipboard = useBilibiliStore((s) => s.settings.other.clipboard) ?? true;
  const screenshotShare = useBilibiliStore((s) => s.settings.other.screenshotShare) ?? true;
  const watermark = useBilibiliStore((s) => s.settings.other.watermark) ?? 'off';
  const imageQuality = useBilibiliStore((s) => s.settings.other.imageQuality) ?? 'clear';

  return (
    <SettingLayout title="其他设置">
      <SettingItemArrow
        label="图片水印设置"
        subtitle={watermark === 'off' ? '不启用' : watermark === 'center' ? '图片中部' : '图片右下角'}
        onClick={() => go('settings.other.watermark.open' as any)}
      />
      <SettingItemArrow
        label="默认图片质量"
        subtitle={imageQuality === 'clear' ? '清晰 (质量高,图片更清晰)' : imageQuality === 'normal' ? '普通 (流量少,速度加载快)' : '自动 (wifi下使用清晰,流量下使用普通)'}
        onClick={() => go('settings.other.imageQuality.open' as any)}
      />
      <SettingItemSwitch label="WIFI下自动准备安装包" subtitle="在WIFI下自动帮你下载好最新安装包" checked={wifiPkg} onChange={(v) => setSetting('other.wifiPkg', v)} />
      <SettingItemSwitch label="剪贴板自动跳转" subtitle="自动帮你跳转到已复制的内容" checked={clipboard} onChange={(v) => setSetting('other.clipboard', v)} />
      <SettingItemSwitch label="截屏快捷分享" subtitle="关闭后,在视频播放页/动态详情页截屏时,不再出现快捷分享引导。" checked={screenshotShare} onChange={(v) => setSetting('other.screenshotShare', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
