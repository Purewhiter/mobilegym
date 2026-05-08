import React from 'react';
import { SettingLayout, SettingSection, SettingItemArrow, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsAvatarEntryPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const watchVideo = useBilibiliStore((s) => s.settings.avatarEntry.watchVideo) ?? true;
  const listenVideo = useBilibiliStore((s) => s.settings.avatarEntry.listenVideo) ?? true;

  return (
    <SettingLayout title="首页头像入口设置">
      <SettingSection title="首页头像入口跳转设置" />
      <SettingItemArrow label="最近/看视频/听视频" subtitle="点击首页左上角头像入口跳转至最近等内容" />
      <SettingItemSwitch label="看视频" subtitle="关闭后不展示看视频入口" checked={watchVideo} onChange={(v) => setSetting('avatarEntry.watchVideo', v)} />
      <SettingItemSwitch label="听视频" subtitle="关闭后不展示听视频入口" checked={listenVideo} onChange={(v) => setSetting('avatarEntry.listenVideo', v)} />
      <SettingItemArrow label="我的" subtitle="点击首页左上角头像入口跳转至我的页" />
      <SettingSection title="最近页快捷功能设置" />
      <div className="px-4 py-3 flex flex-wrap gap-4">
        {['离线缓存', '历史记录', '我的收藏', '稍后再看'].map((name) => (
          <div key={name} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs" />
            <span className="text-[12px] text-gray-600 mt-1">{name}</span>
          </div>
        ))}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xl">+</div>
          <span className="text-[12px] text-gray-500 mt-1">添加</span>
        </div>
      </div>
      <div className="h-8" />
    </SettingLayout>
  );
};
