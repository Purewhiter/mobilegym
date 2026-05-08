import React, { useMemo } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcNavForward } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { WechatSmartImage } from '../../components/WechatSmartImage';
import * as TimeService from '../../../../os/TimeService';

type TabId = 'album' | 'status';

/** 分组数据 - 支持"今天"或年/月分组 */
interface AlbumGroup {
  key: string;
  sortTs: number;
  year: number;
  month: number;
  /** 显示在左侧的标签：今天、昨天、12月 */
  label: string;
  allImages: string[];
}

export const MomentsAlbum: React.FC = () => {
  const t = useWechatStrings();
  const { user, moments } = useWechatStore(useShallow(s => ({ user: s.user, moments: s.moments })));
  const { bindTap } = useWechatGestures();
  const [activeTab, setActiveTab] = React.useState<TabId>('album');

  const wxid = user.wxid;
  const myMoments = useMemo(
    () => moments.filter(m => m.wxid === wxid).sort((a, b) => b.timestamp - a.timestamp),
    [moments, wxid],
  );

  const groupedAlbum = useMemo(() => {
    const map = new Map<string, AlbumGroup>();
    const now = TimeService.getDate();
    const today = TimeService.fromLocalParts(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = TimeService.fromTimestamp(today.getTime());
    yesterday.setDate(yesterday.getDate() - 1);

    for (const m of myMoments) {
      const d = TimeService.fromTimestamp(m.timestamp);
      // 重置时间部分以便比较日期
      const dateCheck = TimeService.fromLocalParts(d.getFullYear(), d.getMonth(), d.getDate());
      
      const isToday = dateCheck.getTime() === today.getTime();
      const isYesterday = dateCheck.getTime() === yesterday.getTime();
      
      const y = d.getFullYear();
      const mo = d.getMonth() + 1;
      
      // key 用于合并：今天、昨天单独合并，其他按月合并
      let key = '';
      let label = '';
      
      if (isToday) {
        key = 'today';
        label = t.common_today;
      } else if (isYesterday) {
        key = 'yesterday';
        label = '昨天';
      } else {
        key = `${y}-${mo}`;
        label = `${mo}月`;
      }

      const images = m.images || [];

      if (map.has(key)) {
        const g = map.get(key)!;
        g.allImages.push(...images);
        // 如果原本存的时间比现在小（倒序遍历时可能不需要，但为了保险），更新 sortTs？
        // 这里的遍历是按时间倒序的 (myMoments sorted)，所以第一个遇到的就是最新的
      } else {
        map.set(key, {
          key,
          sortTs: m.timestamp, // 使用该组最新一条的时间戳排序
          year: y,
          month: mo,
          label,
          allImages: [...images],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sortTs - a.sortTs);
  }, [myMoments]);

  // 过滤掉没有图片的分组
  const displayGroups = useMemo(() => {
    return groupedAlbum.filter(g => g.allImages.length > 0);
  }, [groupedAlbum]);

  return (
    <div className="bg-app-surface min-h-full flex flex-col pb-20">
      {/* 标签页 */}
      <div className="flex border-b border-(--app-c-tw-border-gray-100)">
        <button
          type="button"
          onClick={() => setActiveTab('album')}
          className={`flex-1 py-3 text-(--app-chat-bubble-text-size) font-normal relative ${activeTab === 'album' ? 'text-app-primary' : 'text-(--app-c-settings-item-text)'}`}
        >
          朋友圈相册
          {activeTab === 'album' && (
            <div className="absolute bottom-0 left-0 right-0 h-(--app-divider-height-2) bg-app-primary" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-3 text-(--app-chat-bubble-text-size) font-normal relative ${activeTab === 'status' ? 'text-app-primary' : 'text-(--app-c-settings-item-text)'}`}
        >
          状态
          {activeTab === 'status' && (
            <div className="absolute bottom-0 left-0 right-0 h-(--app-divider-height-2) bg-app-primary" />
          )}
        </button>
      </div>

      {activeTab === 'album' && (
        <div className="flex-1 overflow-auto">
          {/* 我的朋友圈 入口 */}
          <div
            className="flex items-center justify-end px-4 py-3 text-(--app-search-filter-text-size) text-(--app-c-settings-item-text) active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
            {...bindTap<HTMLDivElement>('momentsAlbum.myTimeline.open', { params: { wxid } })}
          >
            我的朋友圈
            <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-me-chevron-color) ml-0.5" strokeWidth={dimens.icStrokeWidth} />
          </div>

          {/* 按时间分组内容 */}
          <div className="px-5 pb-8">
            {displayGroups.length === 0 ? (
              <div className="py-12 text-center text-(--app-c-search-empty-text) text-(--app-search-filter-text-size)">暂无朋友圈相册</div>
            ) : (
              displayGroups.map((group, index) => {
                const prevGroup = displayGroups[index - 1];
                // 仅在年份发生变化时显示年份标题
                // 且逻辑调整：如果是今年，通常不显示年份；只有往年才显示年份
                const currentYear = TimeService.getDate().getFullYear();
                const isCurrentYear = group.year === currentYear;
                
                // 显示年份的条件：
                // 1. 不是今年
                // 2. 且 (是列表第一项 OR 年份与上一项不同)
                const showYear = !isCurrentYear && (index === 0 || group.year !== prevGroup?.year);

                return (
                  <div key={group.key} className="mb-6">
                    {/* 年份标题 (左对齐) */}
                    {showYear && (
                      <div className="text-(--app-title-text-size-26) font-bold text-app-text mb-3 leading-none">
                        {group.year}年
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      {/* 左侧时间列 */}
                      <div className="flex-shrink-0 w-(--app-me-moments-album-width-70) pt-0.5">
                        <div className="text-(--app-title-text-size-24) font-bold text-app-text leading-tight">
                          {group.label}
                        </div>
                      </div>

                      {/* 右侧图片区域 */}
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-1.5">
                          {group.allImages.map((imgSrc, idx) => (
                            <div
                              key={`${group.key}-${idx}`}
                              className="w-(--app-me-moments-album-width-85) h-(--app-me-moments-album-height-85) bg-(--app-c-misc-divider-gray) flex-shrink-0"
                            >
                              <WechatSmartImage
                                src={imgSrc}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="flex-1 flex items-center justify-center text-(--app-c-search-empty-text) text-(--app-search-filter-text-size)">
          暂无状态
        </div>
      )}
    </div>
  );
};
