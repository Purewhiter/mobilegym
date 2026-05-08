import React, { useState } from 'react';
import { SettingLayout } from './index';

const ITEMS: { id: string; label: string; size: string }[] = [
  { id: 'base', label: 'App 基础组件库', size: '1GB' },
  { id: 'image', label: '图片缓存、消息记录', size: '19MB' },
  { id: 'other', label: '其它缓存文件', size: '336MB' },
  { id: 'account', label: '账号、登录信息', size: '16KB' },
  { id: 'offline', label: '离线缓存的视频文件', size: '76KB' },
  { id: 'webview', label: 'webview的缓存文件', size: '68B' },
  { id: 'game', label: '游戏预下载资源包', size: '0B' },
];

export const SettingsStoragePage: React.FC = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SettingLayout title="清理存储空间">
      {ITEMS.map((item) => (
        <div
          key={item.id}
          className="flex items-center px-4 py-3.5 border-b border-gray-100 active:bg-gray-50 cursor-pointer"
          onClick={() => toggle(item.id)}
        >
          <div
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mr-3 flex items-center justify-center ${
              selected.has(item.id) ? 'border-[#FB7299] bg-[#FB7299]' : 'border-gray-300'
            }`}
          >
            {selected.has(item.id) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
          <span className="flex-1 text-[15px] text-gray-900">{item.label}</span>
          <span className="text-[14px] text-gray-500">{item.size}</span>
        </div>
      ))}
      <div className="border-t border-gray-100 py-3 mt-2">
        <div className="text-center text-[15px] text-gray-900 py-3 active:bg-gray-50 cursor-pointer bg-[#F5F6F7] mx-4 rounded">
          清理选中项目
        </div>
      </div>
      <div className="h-8" />
    </SettingLayout>
  );
};
