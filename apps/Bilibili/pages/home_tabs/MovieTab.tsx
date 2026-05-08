import React, { useMemo } from 'react';
import { useLocale } from '@/apps/Bilibili/locale';
import type { BilibiliVideo } from '../../data';
import { useRankings, useVideos } from '../../hooks/useData';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

const featuredRankingKeys = ['电影', '电视剧', '纪录片'] as const;
const quickLinks = [
  { label: '找片看', labelEn: 'Find something to watch' },
  { label: '片单', labelEn: 'Lists' },
  { label: '电影', labelEn: 'Movies', partition: '电影' },
  { label: '电视剧', labelEn: 'TV series', partition: '电视剧' },
  { label: '纪录片', labelEn: 'Documentaries', partition: '纪录片' },
  { label: '综艺', labelEn: 'Variety', partition: '综艺' },
] as const;

export const MovieTab: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindTap } = useBilibiliGestures();
  const rankings = useRankings();
  const videos = useVideos();
  const videoById = useMemo(() => new Map(videos.map((video) => [video.id, video])), [videos]);
  const bannerItems = featuredRankingKeys.map((key) => {
    const item = rankings[key]?.[0];
    const video = item ? videoById.get(item.id) : undefined;
    return item ? ({ ...item, ...(video || {}) } as BilibiliVideo & { rank: number }) : null;
  }).filter((item): item is BilibiliVideo & { rank: number } => Boolean(item));
  const cards = featuredRankingKeys.flatMap((key) => rankings[key]?.slice(0, key === '电影' ? 4 : 3) || []).map((item) => {
    const video = videoById.get(item.id);
    return { ...item, ...(video || {}) } as BilibiliVideo & { rank: number };
  });

  return (
    <div className="pb-20">
      <div className="w-full aspect-[16/9] bg-[#20242E] relative overflow-hidden">
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
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-50"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
                  <img
                    src={item.cover}
                    className="absolute right-5 top-4 h-[calc(100%-32px)] aspect-[2/3] rounded-md object-cover shadow-xl"
                    referrerPolicy="no-referrer"
                  />
                </>
              )}
              <div className="absolute left-5 top-1/2 -translate-y-1/2 w-[58%] text-white">
                <div className="mb-2 inline-flex rounded-full bg-white/18 px-2 py-0.5 text-[11px] font-medium">
                  {item.partition}
                </div>
                <div className="line-clamp-2 text-[20px] font-bold leading-snug">{item.title}</div>
                <div className="mt-2 text-[12px] text-white/80 line-clamp-1">
                  {item.raw?.new_ep?.index_show || item.author}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 py-4 no-scrollbar border-b border-gray-100">
        {quickLinks.map((item) => {
          const partition = 'partition' in item ? item.partition : null;
          return (
            <div
              key={item.label}
              {...(partition ? bindTap('home.movie.partition.open', { params: { label: partition } }) : {})}
              className={`px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 whitespace-nowrap ${
                partition ? 'active:scale-95 transition-transform' : ''
              }`}
            >
              {isEnglish ? item.labelEn : item.label}
            </div>
          );
        })}
      </div>

      <div className="px-4 mt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg">{isEnglish ? 'Picked for you' : '猜你想追'}</h3>
          <span className="text-xs text-gray-500">
            {isEnglish ? 'My watchlist >' : '我的追剧 >'}
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {cards.map((item) => (
            <div
              key={item.id}
              className="w-32 flex-shrink-0 flex flex-col gap-2 active:scale-95 transition-transform"
              {...bindTap('video.open', { params: { bvid: item.id } })}
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200">
                {item.cover ? (
                  <img src={item.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
                {item.raw?.new_ep?.index_show && (
                  <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1 rounded">
                    {item.raw.new_ep.index_show}
                  </div>
                )}
              </div>

              <div>
                <div className="font-medium text-sm line-clamp-1">{item.title}</div>
                <div className="text-xs text-gray-400 line-clamp-1">{item.author || item.partition}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg">{isEnglish ? 'Now streaming' : '正在热播'}</h3>
        </div>
      </div>
    </div>
  );
};
