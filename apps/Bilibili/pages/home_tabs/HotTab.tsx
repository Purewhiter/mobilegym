import React from 'react';
import { IcChart, IcCalendar, IcAward } from '../../res/icons';
import { HOT_DATA } from '../../data/hotData';
import { useVideos } from '../../hooks/useData';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useLocale } from '@/apps/Bilibili/locale';
import {
  formatBilibiliDuration,
  formatBilibiliRelativeDate,
  formatBilibiliStat,
} from '../../utils/localizeBilibiliText';

const BarChart2 = IcChart;
const Calendar = IcCalendar;
const Award = IcAward;

export const HotTab: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindTap } = useBilibiliGestures();
  const videos = useVideos();

  const iconItems = [
    {
      name: isEnglish ? 'Rankings' : '排行榜',
      icon: <BarChart2 className="text-white" size={24} />,
      color: 'bg-[#FF6699]',
      opensRanking: true,
    },
    {
      name: isEnglish ? 'Weekly picks' : '每周必看',
      icon: <Calendar className="text-white" size={24} />,
      color: 'bg-[#FFCC33]',
    },
    {
      name: isEnglish ? 'New Year gala' : '跨年晚会',
      icon: <span className="text-white font-bold text-xs">2026</span>,
      color: 'bg-[#000033]',
    },
    {
      name: isEnglish ? 'Must-watch' : '入站必刷',
      icon: <Award className="text-white" size={24} />,
      color: 'bg-[#FF9900]',
    },
    {
      name: isEnglish ? 'Year in review' : '年度报告',
      icon: <span className="text-white font-bold text-xs">REPORT</span>,
      color: 'bg-[#3366FF]',
    },
  ];

  const badgeLabels = isEnglish ? ['1M views', 'Shared a lot', 'High energy'] : ['百万播放', '很多人分享', '高能'];

  return (
    <div className="pb-20 bg-app-bg">
      <div className="flex justify-between px-4 py-4 mb-2 bg-app-surface">
        {iconItems.map((item) => (
          <div
            key={item.name}
            className="flex flex-col items-center gap-2 cursor-pointer"
            {...(item.opensRanking ? bindTap('ranking.open') : {})}
          >
            <div className={`w-12 h-12 rounded-full ${item.color} flex items-center justify-center shadow-sm`}>
              {item.icon}
            </div>
            <span className="text-xs text-gray-600 text-center">{item.name}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 px-2">
        {HOT_DATA.map((video, index) => {
          const displayVideo = videos.find((item) => item.id === video.id) || video;
          return (
            <div
              key={displayVideo.id}
              className="bg-app-surface rounded-lg p-3 shadow-sm flex gap-3 h-[8.5rem] active:scale-[0.98] transition-transform"
              {...bindTap('video.open', { params: { bvid: displayVideo.id } })}
            >
              <div className="relative w-44 h-full rounded-md overflow-hidden flex-shrink-0 bg-gray-200">
                <img
                  src={displayVideo.cover}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded">
                  {formatBilibiliDuration(displayVideo.duration)}
                </div>
              </div>

              <div className="flex flex-col justify-between py-0.5 flex-1 min-w-0">
                <h3 className="text-[15px] font-medium line-clamp-2 text-app-text leading-snug">
                  {displayVideo.title}
                </h3>

                <div className="flex flex-col gap-1 mt-auto">
                  {index < 3 && (
                    <div className="self-start px-1 py-0.5 bg-[#FF6699]/10 text-[#FF6699] text-[10px] rounded mb-1">
                      {badgeLabels[index]}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[12px] text-gray-400">
                    <span className="border border-app-border rounded px-0.5 text-[9px] scale-90 origin-left">
                      UP
                    </span>
                    <span className="truncate">{displayVideo.author}</span>
                  </div>

                  <div className="text-[12px] text-gray-400">
                    {formatBilibiliStat(displayVideo.plays, locale)}{' '}
                    {isEnglish ? 'views' : '观看'} ·{' '}
                    {formatBilibiliRelativeDate(Boolean(displayVideo.date), locale)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
