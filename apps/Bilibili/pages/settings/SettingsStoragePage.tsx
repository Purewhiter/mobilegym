import React, { useState } from 'react';
import { SettingLayout } from './index';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsStoragePage: React.FC = () => {
  const s = useBilibiliStrings();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ITEMS: { id: string; label: string; size: string }[] = [
    { id: 'base', label: s.st_base, size: '1GB' },
    { id: 'image', label: s.st_image, size: '19MB' },
    { id: 'other', label: s.st_other, size: '336MB' },
    { id: 'account', label: s.st_account, size: '16KB' },
    { id: 'offline', label: s.st_offline, size: '76KB' },
    { id: 'webview', label: s.st_webview, size: '68B' },
    { id: 'game', label: s.st_game, size: '0B' },
  ];

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SettingLayout title={s.st_title}>
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
          {s.st_clean}
        </div>
      </div>
      <div className="h-8" />
    </SettingLayout>
  );
};
