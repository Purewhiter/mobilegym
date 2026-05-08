import React from 'react';
import { MaskIcon } from '../components/MaskIcon';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

export const CalendarDeskThemePage: React.FC = () => {
  const { bindBack } = useCalendarGestures();
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
      <div className="flex items-center px-4 py-3 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
        >
          <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
        </button>
        <h1 className="ml-2 text-[17px] font-medium">{s.desk_theme}</h1>
      </div>

      <div className="flex-1 px-5 py-6 text-sm text-app-text-muted dark:text-gray-400">
        该页面在原版日历中用于选择台历主题（桌面台历/小组件相关）。当前仿真版先提供页面壳，后续可继续从反编译资源补齐卡片列表与预览。
      </div>
    </div>
  );
};
