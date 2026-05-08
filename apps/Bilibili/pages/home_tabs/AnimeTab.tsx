import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocale } from '@/apps/Bilibili/locale';
import type { BilibiliVideo } from '../../data';
import { useRankings, useVideos } from '../../hooks/useData';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

const rankingTabs = [
  { key: 'bangumi', label: '番剧榜', labelEn: 'Anime', rankingKey: '番剧' },
  { key: 'guochuang', label: '国创榜', labelEn: 'Chinese animation', rankingKey: '国创' },
  { key: 'news', label: '资讯榜', labelEn: 'News', rankingKey: null },
] as const;
const quickLinks = [
  { label: '找番看', labelEn: 'Discover anime' },
  { label: '时间表', labelEn: 'Schedule' },
  { label: '番剧', labelEn: 'Series', partition: '番剧' },
  { label: '国创', labelEn: 'Chinese animation', partition: '国创' },
  { label: '少儿', labelEn: 'Kids' },
  { label: '动画', labelEn: 'Animation', partition: '动画' },
] as const;

type RankingTabKey = 'bangumi' | 'guochuang';

const isRankingTabKey = (value: string | null): value is RankingTabKey =>
  value === 'bangumi' || value === 'guochuang';

export const AnimeTab: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams] = useSearchParams();
  const { bindTap } = useBilibiliGestures();
  const rankings = useRankings();
  const videos = useVideos();
  const videoById = useMemo(() => new Map(videos.map((video) => [video.id, video])), [videos]);
  const animeRankParam = searchParams.get('animeRank');
  const activeRankingTabKey = isRankingTabKey(animeRankParam) ? animeRankParam : 'bangumi';
  const activeRankingTab = rankingTabs.find((tab) => tab.key === activeRankingTabKey) || rankingTabs[0];
  const activeRankingKey = activeRankingTab.rankingKey || '番剧';
  const cards = (rankings[activeRankingKey] || []).slice(0, 10).map((item) => {
    const video = videoById.get(item.id);
    return { ...item, ...(video || {}) } as BilibiliVideo & { rank: number };
  });
  const bannerItems = [...(rankings['番剧'] || []).slice(0, 2), ...(rankings['国创'] || []).slice(0, 2)].map((item) => {
    const video = videoById.get(item.id);
    return { ...item, ...(video || {}) } as BilibiliVideo & { rank: number };
  });

  return (
    <div className="pb-20">
      <div className="w-full aspect-[16/7] bg-[#1F2430] relative overflow-hidden">
        <div className="h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
          {bannerItems.map((item) => (
            <div
              key={item.id}
              className="relative h-full w-full flex-shrink-0 snap-center overflow-hidden"
              {...bindTap('video.open', { params: { bvid: item.id } })}
            >
              {item.cover && (
                <>
                  <img
                    src={item.cover}
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-55"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
                  <img
                    src={item.cover}
                    className="absolute right-5 top-4 h-[calc(100%-32px)] aspect-[3/4] rounded-md object-cover shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                </>
              )}
              <div className="absolute left-5 top-1/2 -translate-y-1/2 w-[58%] text-white">
                <div className="mb-2 inline-flex rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-medium">
                  {item.partition}
                </div>
                <div className="line-clamp-2 text-[19px] font-bold leading-snug">{item.title}</div>
                <div className="mt-2 text-[12px] text-white/80 line-clamp-1">
                  {item.raw?.new_ep?.index_show || item.author}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 py-4 no-scrollbar">
        {quickLinks.map((item) => {
          const partition = 'partition' in item ? item.partition : null;
          return (
            <div
              key={item.label}
              {...(partition ? bindTap('home.anime.partition.open', { params: { label: partition } }) : {})}
              className={`px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 whitespace-nowrap ${
                partition ? 'active:scale-95 transition-transform' : ''
              }`}
            >
              {isEnglish ? item.labelEn : item.label}
            </div>
          );
        })}
      </div>

      <div className="px-4 mt-2">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg">{isEnglish ? 'Top rankings' : '热门排行榜'}</h3>
          <span className="text-xs text-gray-500">
            {isEnglish ? 'More rankings >' : '更多榜单 >'}
          </span>
        </div>

        <div className="flex gap-4 mb-4 text-sm text-gray-500">
          {rankingTabs.map((tab) => (
            <button
              key={tab.key}
              {...(tab.rankingKey && tab.key !== activeRankingTab.key
                ? bindTap('home.anime.ranking.switch', { params: { animeRank: tab.key } })
                : {})}
              className={
                tab.key === activeRankingTab.key
                  ? 'text-black font-bold bg-gray-100 px-3 py-1 rounded-full'
                  : `py-1 ${tab.rankingKey ? '' : 'opacity-50'}`
              }
            >
              {isEnglish ? tab.labelEn : tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4">
          {cards.map((item, index) => (
            <div
              key={item.id}
              className="w-32 flex-shrink-0 flex flex-col gap-2 active:scale-95 transition-transform"
              {...bindTap('video.open', { params: { bvid: item.id } })}
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-200">
                {item.cover ? (
                  <img src={item.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1">
                  <span className="text-[10px] text-white">{item.raw?.new_ep?.index_show || item.partition}</span>
                </div>
                <div
                  className={`absolute top-0 left-2 w-6 h-8 ${
                    index === 0 ? 'bg-app-primary' : index === 1 ? 'bg-app-primary/70' : 'bg-app-primary/40'
                  } text-white flex items-center justify-center font-bold text-lg rounded-b`}
                >
                  {index + 1}
                </div>
              </div>

              <div>
                <div className="font-medium text-sm line-clamp-1">{item.title}</div>
                <div className="text-xs text-gray-400 line-clamp-1">{item.author}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
