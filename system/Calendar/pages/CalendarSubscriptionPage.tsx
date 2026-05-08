import React from 'react';
import { MaskIcon } from '../components/MaskIcon';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

const Card: React.FC<{ title: string; desc: string; onClick?: () => void }> = ({ title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left bg-app-surface dark:bg-[#1c1c1e] rounded-2xl px-4 py-4 active:bg-black/5 dark:active:bg-white/5"
  >
    <div className="text-[16px] text-app-text dark:text-gray-100">{title}</div>
    <div className="text-[12px] text-gray-400 mt-1 leading-snug">{desc}</div>
  </button>
);

export const CalendarSubscriptionPage: React.FC = () => {
  const { bindBack } = useCalendarGestures();
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="flex flex-col h-full bg-app-bg dark:bg-black text-black dark:text-white pt-10">
      <div className="flex items-center px-4 py-3 bg-app-surface dark:bg-black shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
        >
          <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
        </button>
        <h1 className="ml-2 text-[17px] font-medium">{s.subscription}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          <Card title={s.sub_holiday} desc={s.sub_holiday_desc} />
          <Card title={s.sub_almanac} desc={s.sub_almanac_desc} />
          <Card title={s.sub_horoscope} desc={s.sub_horoscope_desc} />
          <Card title={s.sub_traffic} desc={s.sub_traffic_desc} />
          <Card title={s.sub_shift} desc={s.sub_shift_desc} />
        </div>
      </div>
    </div>
  );
};
