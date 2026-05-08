import React from 'react';
import { IcNavBack } from '../../res/icons';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

/** 设置子页通用布局：状态栏留白 + 返回 + 标题 + 可滚动内容区 */
export const SettingLayout: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const { bindBack } = useBilibiliGestures();

  return (
    <div className="flex flex-col h-full bg-white" data-status-bar-foreground="dark">
      <div className="flex items-center justify-center relative px-4 pt-10 pb-3 bg-white border-b border-gray-100 shrink-0">
        <button className="absolute left-3 top-10 p-1" {...bindBack()}>
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <h1 className="text-[17px] font-medium text-gray-900">{title}</h1>
      </div>
      <div
        className="flex-1 overflow-y-auto no-scrollbar bg-white"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {children}
      </div>
    </div>
  );
};
