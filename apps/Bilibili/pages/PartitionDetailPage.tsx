import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLocale } from '@/apps/Bilibili/locale';
import { useVirtualList } from '../../../os/hooks/useVirtualList';
import type { BilibiliVideo } from '../data';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideos } from '../hooks/useData';
import { BilibiliDanmakuIcon, IcMonitorPlay, IcNavBack } from '../res/icons';
import {
  formatBilibiliDuration,
  formatBilibiliStat,
} from '../utils/localizeBilibiliText';

const ChevronLeft = IcNavBack;
const MonitorPlay = IcMonitorPlay;

type PartitionGroup = {
  zh: string;
  en: string;
  aliases: string[];
};

const PARTITION_GROUPS: PartitionGroup[] = [
  { zh: '健康', en: 'Health', aliases: ['健康', '医疗保健', 'Health', 'Healthcare'] },
  { zh: '体育运动', en: 'Sports', aliases: ['运动', '体育运动', '体育', 'Sports'] },
  { zh: '科技数码', en: 'Tech', aliases: ['科技', '数码', '科技数码', 'Tech'] },
  { zh: '时尚美妆', en: 'Style & Beauty', aliases: ['时尚', '美妆', '时尚美妆', 'Style & Beauty'] },
  { zh: 'vlog', en: 'Vlog', aliases: ['VLOG', 'vlog', '日常', 'Vlog'] },
  { zh: '生活', en: 'Lifestyle', aliases: ['生活', '日常', '搞笑', '手工', '绘画', 'Lifestyle'] },
  { zh: '综艺', en: 'Variety', aliases: ['综艺', 'Variety'] },
  { zh: '娱乐', en: 'Entertainment', aliases: ['娱乐', 'Entertainment'] },
  { zh: '影视', en: 'Movies & TV', aliases: ['影视', '电影', '电视剧', '纪录片', '小剧场', 'Movies & TV'] },
  { zh: '家装房产', en: 'Home & Property', aliases: ['家装房产', '家居房产', 'Home & Property'] },
  { zh: '旅游出行', en: 'Travel', aliases: ['旅游出行', '出行', 'Travel'] },
];

const PARTITION_ROW_ESTIMATE_PX = 214;

function getPartitionGroup(label: string) {
  const normalized = label.trim().toLowerCase();
  return PARTITION_GROUPS.find((group) =>
    group.aliases.some((alias) => alias.trim().toLowerCase() === normalized),
  );
}

const VideoCard: React.FC<{ video: BilibiliVideo; isEnglish: boolean }> = ({ video, isEnglish }) => {
  const coverSrc = typeof video.cover === 'string' && !video.cover.startsWith('#') ? video.cover : '';
  const { bindTap } = useBilibiliGestures();
  const locale = useLocale();

  return (
    <div
      className="bg-app-surface rounded-lg overflow-hidden shadow-sm flex flex-col h-full active:scale-95"
      style={{ transition: 'transform var(--app-duration-quick) var(--app-easing-standard)' }}
      {...bindTap('video.open', { params: { bvid: video.id } })}
    >
      <div className="relative aspect-video bg-gray-200">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={video.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}

        <div className="absolute bottom-1 left-2 text-[10px] text-white flex items-center gap-2 drop-shadow-md">
          <div className="flex items-center gap-0.5">
            <MonitorPlay size={10} />
            {formatBilibiliStat(video.plays, locale)}
          </div>
          <div className="flex items-center gap-0.5">
            <BilibiliDanmakuIcon className="scale-75" />
            {formatBilibiliStat(video.danmaku, locale)}
          </div>
        </div>

        <div className="absolute bottom-1 right-2 text-[10px] text-white drop-shadow-md">
          {formatBilibiliDuration(video.duration)}
        </div>
      </div>

      <div className="p-2 flex flex-col flex-1 justify-between">
        <h3 className="text-sm font-medium line-clamp-2 text-app-text leading-snug">
          {video.title}
        </h3>

        <div className="flex items-center justify-between mt-2 text-xs text-app-text-muted">
          <div className="flex items-center gap-1">
            {video.isAd && (
              <span className="border border-[#9499A0] rounded px-0.5 text-[9px]">
                {isEnglish ? 'Ad' : '广告'}
              </span>
            )}
            <span className="truncate max-w-[80px]">{video.author}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PartitionDetailPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { label } = useParams<{ label: string }>();
  const { bindBack } = useBilibiliGestures();
  const videos = useVideos();

  const normalizedLabel = label ? decodeURIComponent(label) : '';
  const partitionGroup = useMemo(() => getPartitionGroup(normalizedLabel), [normalizedLabel]);

  const filteredVideos = useMemo(() => {
    if (!normalizedLabel) return [];

    const targetNames = partitionGroup ? partitionGroup.aliases : [normalizedLabel];
    return videos.filter((video) => {
      if (video.partition && targetNames.includes(video.partition)) return true;
      if (targetNames.some((name) => video.partition?.includes(name))) return true;
      return video.desc === normalizedLabel || video.partition === normalizedLabel;
    });
  }, [normalizedLabel, partitionGroup, videos]);

  const videoRows = useMemo(() => {
    const rows: BilibiliVideo[][] = [];
    for (let index = 0; index < filteredVideos.length; index += 2) {
      rows.push(filteredVideos.slice(index, index + 2));
    }
    return rows;
  }, [filteredVideos]);

  const displayTitle = partitionGroup
    ? isEnglish
      ? partitionGroup.en
      : partitionGroup.zh
    : normalizedLabel || (isEnglish ? 'Partition' : '分区');

  const { parentRef, virtualizer, virtualItems, totalSize } = useVirtualList({
    items: videoRows,
    estimateSize: () => PARTITION_ROW_ESTIMATE_PX,
    overscan: 4,
    paddingEnd: 40,
    gap: 8,
    getItemKey: (index, row) => row.map((video) => video.id).join('-') || `partition-row-${index}`,
  });

  return (
    <div className="flex flex-col h-full bg-app-bg">
      <div className="flex items-center px-4 pt-10 pb-2 bg-app-surface sticky top-0 z-10 shadow-sm">
        <button {...bindBack()} className="p-1 -ml-2 relative z-20">
          <ChevronLeft size={24} className="text-app-text" />
        </button>
        <h1 className="flex-1 text-center font-medium text-[17px] text-app-text -ml-6">
          {displayTitle}
        </h1>
      </div>

      <div
        key={normalizedLabel}
        ref={parentRef}
        className="flex-1 overflow-y-auto no-scrollbar px-2 pt-2"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20">
            <p>{isEnglish ? 'No related videos yet' : '暂无相关视频'}</p>
          </div>
        ) : (
          <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
            {virtualItems.map((virtualRow) => {
              const row = videoRows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {row.map((video) => (
                      <VideoCard key={video.id} video={video} isEnglish={isEnglish} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
