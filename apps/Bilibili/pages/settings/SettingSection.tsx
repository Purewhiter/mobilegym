import React from 'react';

/** 设置分组标题（浅灰背景） */
export const SettingSection: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 py-2 bg-[#F5F6F7] text-[13px] text-gray-600">{title}</div>
);
