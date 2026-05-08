import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppNavigate } from '../navigation';
import { IcNavBackArrow, IcShare, IcNavBack, IcNavForward, IcCalendar } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingStore, selectFinishedBookIds } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import * as TimeService from '../../../os/TimeService';
import { useVirtualList } from '../../../os/hooks/useVirtualList';

// Helper for date formatting
const formatDate = (date: Date): string => {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const getWeekRange = (date: Date) => {
  const day = date.getDay(); // 0 is Sunday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = TimeService.fromTimestamp(date.getTime());
  monday.setDate(diff);
  const sunday = TimeService.fromTimestamp(monday.getTime());
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const WEEKS = ['一', '二', '三', '四', '五', '六', '日'];

const MonthSection = ({ year, month, records }: { year: number, month: number, records: any[] }) => {
  const monthRecords = useMemo(() => {
    return records.filter(r => {
      const d = TimeService.fromTimestamp(TimeService.parseToTimestamp(r.date));
      return d.getFullYear() === year && d.getMonth() === month - 1;
    });
  }, [records, year, month]);

  const totalReadingDays = new Set(monthRecords.map(r => TimeService.fromTimestamp(TimeService.parseToTimestamp(r.date)).getDate())).size;
  const totalReadingMinutes = monthRecords.reduce((acc, curr) => acc + curr.duration, 0);

  const daysInMonth = TimeService.fromLocalParts(year, month, 0).getDate();
  const firstDayOfMonth = TimeService.fromLocalParts(year, month - 1, 1).getDay();
  // Adjust so 1 = Monday, 7 = Sunday. 0 (Sunday) becomes 7.
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const renderCalendarGrid = () => {
    const days: React.ReactNode[] = [];
    // Empty slots for start offset
    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayRecords = monthRecords.filter(r => TimeService.fromTimestamp(TimeService.parseToTimestamp(r.date)).getDate() === d);
      const dayMinutes = dayRecords.reduce((acc, curr) => acc + curr.duration, 0);
      const hasReading = dayMinutes > 0;
      
      days.push(
        <div key={d} className="aspect-square flex flex-col items-center justify-center gap-1">
          {hasReading ? (
             <div className="w-10 h-10 rounded-xl bg-(--app-c-my-reading-page-bg-a0cf) flex items-center justify-center text-white font-medium shadow-sm">
               {d}
             </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-(--app-c-tw-bg-gray-100) flex items-center justify-center text-(--app-c-tw-text-gray-400) font-medium">
              {d}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="pb-10">
         <div className="mb-6">
           <div className="text-lg font-bold text-(--app-c-my-reading-page-text-3333) mb-1">
             {month}月 · 累计阅读 <span className="text-2xl">{totalReadingDays}</span> 天
           </div>
           <div className="text-xs text-(--app-c-tw-text-gray-500)">
             累计阅读 {totalReadingMinutes} 分钟
           </div>
         </div>

         <div className="grid grid-cols-7 gap-y-4 gap-x-1 mb-8">
           {renderCalendarGrid()}
         </div>
    </div>
  );
};

const CalendarView = ({ 
  records, 
  onClose 
}: { 
  records: any[], 
  onClose: () => void 
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  
  // Generate last 10 years (120 months)
  const months = useMemo(() => {
    const result: { year: number; month: number }[] = [];
    const today = TimeService.getDate();
    for (let i = 0; i < 120; i++) {
      const d = TimeService.fromLocalParts(today.getFullYear(), today.getMonth() - i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return result;
  }, []);
  const orderedMonths = useMemo(() => [...months].reverse(), [months]);
  const newestMonth = orderedMonths[orderedMonths.length - 1] || { year: TimeService.getDate().getFullYear(), month: TimeService.getDate().getMonth() + 1 };

  const [currentHeaderDate, setCurrentHeaderDate] = useState({ year: newestMonth.year, month: newestMonth.month });
  const { parentRef, virtualizer, virtualItems, totalSize } = useVirtualList({
    items: orderedMonths,
    estimateSize: () => 320,
    overscan: 4,
    paddingEnd: 40,
    getItemKey: (index, item) => `${item.year}-${item.month}-${index}`,
  });

  const handleScroll = useCallback(() => {
    const container = parentRef.current;
    if (!container) return;

    const setHeaderIfChanged = (next: { year: number; month: number }) => {
      setCurrentHeaderDate((prev) =>
        prev.year === next.year && prev.month === next.month ? prev : next
      );
    };

    if (container.scrollHeight - container.scrollTop - container.clientHeight < 50) {
      setHeaderIfChanged({ year: newestMonth.year, month: newestMonth.month });
      return;
    }

    const topVisible = virtualizer.getVirtualItems()[0];
    if (!topVisible) return;
    const topMonth = orderedMonths[topVisible.index];
    if (!topMonth) return;
    setHeaderIfChanged({ year: topMonth.year, month: topMonth.month });
  }, [newestMonth.month, newestMonth.year, orderedMonths, parentRef, virtualizer]);

  React.useEffect(() => {
    if (!orderedMonths.length) return;
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(orderedMonths.length - 1, { align: 'end' });
      requestAnimationFrame(() => handleScroll());
    });
  }, [handleScroll, orderedMonths.length, virtualizer]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom-full" style={{ transition: 'all var(--app-duration-medium) var(--app-easing-standard)' }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-24 bg-(--app-c-my-reading-page-bg-f6f7) rounded-t-3xl flex flex-col overflow-hidden">
          
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0" onClick={onClose}>
            <div className="w-10 h-1 bg-(--app-c-tw-bg-gray-300) rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 pt-2 pb-4 shrink-0">
            <div className="text-(--app-title-text-size-22) font-bold text-(--app-c-my-reading-page-text-3333)">
                阅读天数 · {currentHeaderDate.year}/{currentHeaderDate.month}
            </div>
            <div className="flex bg-(--app-c-tw-bg-gray-200)/50 rounded-full p-0.5">
                <button 
                className={`px-4 py-1 rounded-full text-sm font-medium ${viewMode === 'month' ? 'bg-app-surface shadow-sm text-(--app-c-my-reading-page-text-3333)' : 'text-(--app-c-tw-text-gray-500)'}`} style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
                onClick={() => setViewMode('month')}
                >
                月
                </button>
                <button 
                className={`px-4 py-1 rounded-full text-sm font-medium ${viewMode === 'year' ? 'bg-app-surface shadow-sm text-(--app-c-my-reading-page-text-3333)' : 'text-(--app-c-tw-text-gray-500)'}`} style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
                onClick={() => setViewMode('year')}
                >
                年
                </button>
            </div>
          </div>

          <div className="px-5 shrink-0 bg-(--app-c-my-reading-page-bg-f6f7) pb-2">
             <div className="grid grid-cols-7">
                {WEEKS.map(d => (
                    <div key={d} className="text-center text-xs text-(--app-c-tw-text-gray-400) font-medium">{d}</div>
                ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5" onScroll={handleScroll} ref={parentRef}>
            <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
              {virtualItems.map((vItem) => {
                const month = orderedMonths[vItem.index];
                if (!month) return null;
                return (
                  <div
                    key={vItem.key}
                    ref={virtualizer.measureElement}
                    data-index={vItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vItem.start}px)`,
                    }}
                  >
                    <MonthSection
                      year={month.year}
                      month={month.month}
                      records={records}
                    />
                  </div>
                );
              })}
            </div>
          </div>
      </div>
    </div>
  );
};

const VALID_TABS = ['week', 'month', 'year', 'total', 'history'] as const;
type TabId = typeof VALID_TABS[number];

const MyReadingPage: React.FC = () => {
  const { go } = useAppNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const readingRecords = useWechatReadingStore(s => s.readingRecords);
  const finishedBookIds = useWechatReadingStore(selectFinishedBookIds);
  const { bindTap, bindBack } = useWechatReadingGestures();

  const activeTab: TabId = (VALID_TABS.includes(searchParams.get('tab') as TabId)
    ? searchParams.get('tab')
    : 'week') as TabId;

  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });

  const [currentDate, setCurrentDate] = useState(TimeService.getDate()); // Defaults to today
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Reset selection when view changes
  useEffect(() => {
    setSelectedBarIndex(null);
  }, [activeTab, currentDate]);

  // Calculate Date Range
  const dateRange = useMemo(() => {
    if (activeTab === 'week') {
      const { start, end } = getWeekRange(currentDate);
      return `${formatDate(start)}至${formatDate(end)}`;
    } else if (activeTab === 'month') {
      return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
    } else if (activeTab === 'year') {
      return `${currentDate.getFullYear()}年`;
    }
    return '';
  }, [activeTab, currentDate]);

  // Filter Records
  const currentRecords = useMemo(() => {
    return readingRecords.filter(record => {
      const rDate = TimeService.fromTimestamp(TimeService.parseToTimestamp(record.date));
      if (activeTab === 'week') {
        const { start, end } = getWeekRange(currentDate);
        const s = TimeService.fromTimestamp(start.getTime()); s.setHours(0,0,0,0);
        const e = TimeService.fromTimestamp(end.getTime()); e.setHours(23,59,59,999);
        return rDate >= s && rDate <= e;
      } else if (activeTab === 'month') {
        return rDate.getMonth() === currentDate.getMonth() && rDate.getFullYear() === currentDate.getFullYear();
      } else if (activeTab === 'year') {
        return rDate.getFullYear() === currentDate.getFullYear();
      }
      return true;
    });
  }, [readingRecords, activeTab, currentDate]);

  // Statistics
  const totalMinutes = useMemo(() => currentRecords.reduce((acc, curr) => acc + curr.duration, 0), [currentRecords]);
  const dailyAverage = useMemo(() => {
    let days = 1;
    if (activeTab === 'week') days = 7;
    if (activeTab === 'month') days = TimeService.fromLocalParts(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    if (activeTab === 'year') days = 365;
    return Math.round(totalMinutes / days);
  }, [totalMinutes, activeTab, currentDate]);

  // Chart Data
  const chartData = useMemo(() => {
    if (activeTab === 'week') {
      const { start } = getWeekRange(currentDate);
      const startDay = TimeService.fromTimestamp(start.getTime()); 
      startDay.setHours(0,0,0,0);
      
      const items = new Array(7).fill(0).map((_, i) => {
          const d = TimeService.fromTimestamp(startDay.getTime());
          d.setDate(d.getDate() + i);
          return {
              value: 0,
              label: WEEKS[i],
              fullDate: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
          };
      });

      currentRecords.forEach(r => {
        const d = TimeService.fromTimestamp(TimeService.parseToTimestamp(r.date));
        d.setHours(0,0,0,0);
        const diffTime = Math.abs(d.getTime() - startDay.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays >= 0 && diffDays < 7) {
          items[diffDays].value += r.duration;
        }
      });
      return items;
    } else if (activeTab === 'month') {
      const daysInMonth = TimeService.fromLocalParts(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      const items = Array.from({length: daysInMonth}, (_, i) => ({
          value: 0,
          label: (i+1).toString(),
          fullDate: `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${i+1}日`
      }));

      currentRecords.forEach(r => {
        const d = TimeService.fromTimestamp(TimeService.parseToTimestamp(r.date));
        const dayIdx = d.getDate() - 1;
        if (dayIdx >= 0 && dayIdx < daysInMonth) {
          items[dayIdx].value += r.duration;
        }
      });
      return items;
    } else if (activeTab === 'year') {
      const items = Array.from({length: 12}, (_, i) => ({
          value: 0,
          label: (i+1).toString(),
          fullDate: `${currentDate.getFullYear()}年${i+1}月`
      }));

      currentRecords.forEach(r => {
        const d = TimeService.fromTimestamp(TimeService.parseToTimestamp(r.date));
        items[d.getMonth()].value += r.duration;
      });
      return items;
    }
    return [];
  }, [currentRecords, currentDate, activeTab]);

  // Quick stats (读过/读完/阅读/笔记)
  const quickStats = useMemo(() => {
    const bookIds = [...new Set(currentRecords.map(r => r.bookId))];
    const dayCount = new Set(currentRecords.map(r => r.date)).size;
    const finishedCount = bookIds.filter(id => finishedBookIds.includes(id)).length;
    return { bookCount: bookIds.length, finishedCount, dayCount, noteCount: 0 };
  }, [currentRecords, finishedBookIds]);

  const maxMinutes = useMemo(() => Math.max(...chartData.map(d => d.value), 0), [chartData]);
  const maxDayIndex = useMemo(() => chartData.findIndex(d => d.value === maxMinutes), [chartData, maxMinutes]);
  
  const maxInfoText = useMemo(() => {
    if (maxMinutes === 0) return activeTab === 'week' ? '本周暂无阅读记录' : '暂无阅读记录';
    
    const item = chartData[maxDayIndex];
    if (!item) return '';

    if (activeTab === 'week') {
      return `周${item.label}阅读最久，${maxMinutes}分钟`;
    } else if (activeTab === 'month') {
      return `${item.label}日阅读最久，${maxMinutes}分钟`;
    } else if (activeTab === 'year') {
      return `${item.label}月阅读最久，${maxMinutes}分钟`;
    }
    return '';
  }, [maxMinutes, maxDayIndex, activeTab, chartData]);

  // Navigation Handlers
  const handlePrev = () => {
    const newDate = TimeService.fromTimestamp(currentDate.getTime());
    if (activeTab === 'week') newDate.setDate(newDate.getDate() - 7);
    if (activeTab === 'month') newDate.setMonth(newDate.getMonth() - 1);
    if (activeTab === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = TimeService.fromTimestamp(currentDate.getTime());
    if (activeTab === 'week') newDate.setDate(newDate.getDate() + 7);
    if (activeTab === 'month') newDate.setMonth(newDate.getMonth() + 1);
    if (activeTab === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    setCurrentDate(newDate);
  };

  return (
    <div className="h-full w-full bg-(--app-c-my-reading-page-bg-f6f7) flex flex-col font-sans overflow-hidden pt-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <button {...bindBack()} className="p-2 -ml-2 text-(--app-c-tw-text-gray-600)">
          <IcNavBackArrow size={dimens.settings_header_back_size} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-my-reading-page-text-3333)">我的阅读</span>
          <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) mt-0.5">{activeTab === 'week' ? `本周 ${dateRange}` : dateRange}</span>
        </div>
        <button className="p-2 -mr-2 text-(--app-c-tw-text-gray-600)">
          <IcShare size={dimens.icSizeNav} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-2 mb-6 shrink-0">
        <div className="flex justify-between bg-transparent">
          {['week', 'month', 'year', 'total', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-1.5 text-(--app-settings-item-text-size) font-medium rounded-full ${
                activeTab === tab
                  ? 'bg-app-surface text-(--app-c-my-reading-page-text-3333) shadow-sm'
                  : 'text-(--app-c-tw-text-gray-500) hover:text-(--app-c-tw-text-gray-700)'
              }`}
              style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
            >
              {{ week: '周', month: '月', year: '年', total: '总', history: '阅历' }[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        
        {/* Date Navigation */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-base font-bold text-(--app-c-my-reading-page-text-3333)">
             {activeTab === 'week' ? '本周' : activeTab === 'month' ? '本月' : '今年'} {dateRange}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="w-6 h-6 rounded-full bg-(--app-c-tw-bg-gray-200)/60 flex items-center justify-center text-(--app-c-tw-text-gray-500)">
              <IcNavBack size={dimens.icSizeNavPagination} />
            </button>
            <button onClick={handleNext} className="w-6 h-6 rounded-full bg-(--app-c-tw-bg-gray-200)/60 flex items-center justify-center text-(--app-c-tw-text-gray-500)">
              <IcNavForward size={dimens.icSizeNavPagination} />
            </button>
          </div>
        </div>

        {/* Big Stats */}
        <div className="mb-8">
          <div className="flex items-baseline gap-1.5">
            <span className="text-(--app-title-text-size-48) font-bold text-(--app-c-my-reading-page-text-3333) leading-none tracking-tight">
              {totalMinutes}
            </span>
            <span className="text-sm font-medium text-(--app-c-tw-text-gray-500)">分钟</span>
          </div>
          <div className="text-xs text-(--app-c-tw-text-gray-400) mt-1.5 font-medium">
            日均阅读{dailyAverage}分钟
          </div>
        </div>

        {/* 周：显示排名；其他标签：显示读过/读完/阅读/笔记统计 */}
        {activeTab === 'week' ? (
          <div className="flex items-center gap-1 mb-8">
            <span className="text-sm font-bold text-(--app-c-my-reading-page-text-3333)">朋友中排名</span>
            <span className="text-lg font-bold text-(--app-c-my-reading-page-text-3333) mx-1">1</span>
            <span className="text-sm font-bold text-(--app-c-my-reading-page-text-3333)">名</span>
            <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-gray-400) mt-0.5" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-5 mb-8">
            <div
              className="flex items-center gap-1 cursor-pointer active:opacity-60"
              {...bindTap('readingList.open.all')}
              onClick={() => go('readingList.open.all')}
            >
              <div className="text-(--app-c-my-reading-page-text-3333) font-bold flex items-baseline">
                <span className="text-sm">读过</span>
                <span className="text-(--app-title-text-size-18) ml-1">{quickStats.bookCount}</span>
                <span className="text-sm ml-1">本</span>
              </div>
              <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-gray-400)" />
            </div>
            <div
              className="flex items-center gap-1 cursor-pointer active:opacity-60"
              {...bindTap('readingList.open.finished')}
              onClick={() => go('readingList.open.finished')}
            >
              <div className="text-(--app-c-my-reading-page-text-3333) font-bold flex items-baseline">
                <span className="text-sm">读完</span>
                <span className="text-(--app-title-text-size-18) ml-1">{quickStats.finishedCount}</span>
                <span className="text-sm ml-1">本</span>
              </div>
              <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-gray-400)" />
            </div>
            <div className="flex items-center gap-1">
              <div className="text-(--app-c-my-reading-page-text-3333) font-bold flex items-baseline">
                <span className="text-sm">阅读</span>
                <span className="text-(--app-title-text-size-18) ml-1">{quickStats.dayCount}</span>
                <span className="text-sm ml-1">天</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="text-(--app-c-my-reading-page-text-3333) font-bold flex items-baseline">
                <span className="text-sm">笔记</span>
                <span className="text-(--app-title-text-size-18) ml-1">{quickStats.noteCount}</span>
                <span className="text-sm ml-1">条</span>
              </div>
            </div>
          </div>
        )}

        {/* Challenge Card */}
        <div className="bg-app-surface rounded-2xl p-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-(--app-c-tw-border-gray-100)/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-(--app-settings-item-text-size) font-bold text-(--app-c-my-reading-page-text-3333) mb-1">阅读挑战赛</div>
              <div className="text-xs text-(--app-c-tw-text-gray-400)">赢取 365 天付费会员卡 + 500 书币</div>
            </div>
            <button className="bg-(--app-c-my-reading-page-bg-00aa) text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-sm shadow-blue-200">
              去挑战
            </button>
          </div>
        </div>

        {/* Chart Card */}
        <div className="bg-app-surface rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-(--app-c-tw-border-gray-100)/50 relative">
          <div className="flex items-center justify-between mb-8">
             <div className="text-(--app-settings-item-text-size) font-bold text-(--app-c-my-reading-page-text-3333)">阅读时长分布</div>
             <button 
               onClick={() => setShowCalendar(true)}
               className="p-1.5 rounded-lg hover:bg-(--app-c-tw-bg-gray-50) text-(--app-c-tw-text-gray-400)"
             >
               <IcCalendar size={dimens.icSizeAction} />
             </button>
          </div>

          <div className="h-48 flex items-end justify-between px-2 gap-1 mb-6">
            {chartData.map((item, idx) => {
              const heightPercentage = maxMinutes > 0 ? (item.value / maxMinutes) * 100 : 0;
              const isSelected = selectedBarIndex === idx;
              const isMax = item.value === maxMinutes && item.value > 0;
              
              // Only show some labels for month view to avoid clutter
              const showLabel = activeTab !== 'month' || [1, 5, 10, 15, 20, 25, 30].includes(parseInt(item.label));
              
              return (
                <div 
                  key={idx} 
                  className="flex flex-col items-center flex-1 gap-1 h-full justify-end relative cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBarIndex(idx);
                  }}
                >
                   {/* Tooltip */}
                   {isSelected && (
                     <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 w-max pointer-events-none animate-in fade-in zoom-in-95" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}>
                        <div className="bg-(--app-c-my-reading-page-bg-00aa) text-white rounded-lg px-3 py-2 shadow-lg relative flex flex-col items-center min-w-(--app-title-width-80)">
                           {/* Arrow */}
                           <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-(--app-c-my-reading-page-bg-00aa) rotate-45 rounded-[1px]" />
                           
                           <div className="text-(--app-title-text-size-11) font-medium opacity-90 leading-tight mb-1 whitespace-nowrap">{item.fullDate}</div>
                           <div className="text-(--app-settings-item-text-size) font-bold leading-tight">{item.value}分钟</div>
                        </div>
                     </div>
                   )}

                   {/* Bar */}
                   <div
                     className={`w-full ${activeTab === 'month' ? 'max-w-(--app-my-reading-page-width-6) rounded-t-[2px]' : 'max-w-(--app-my-reading-page-width-24) rounded-t-sm'} ${
                       isSelected || isMax ? 'bg-gradient-to-b from-(--app-c-my-reading-page-gradient-from-4fc3) to-(--app-c-my-reading-page-gradient-to-039b)' : 'bg-(--app-c-my-reading-page-bg-4fc3)/60'
                     }`}
                     style={{ height: item.value > 0 ? `${Math.max(heightPercentage, 4)}%` : '0%', transition: 'all var(--app-duration-long) var(--app-easing-standard)' }}
                   />
                   <div className="h-4 flex items-center justify-center">
                     {showLabel && <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) font-medium scale-90">{item.label}</span>}
                   </div>
                </div>
              );
            })}
          </div>

          <div className={`${maxMinutes > 0 ? 'bg-(--app-c-my-reading-page-bg-f0f9) text-(--app-c-my-reading-page-text-0288)' : 'bg-(--app-c-tw-bg-gray-50) text-(--app-c-tw-text-gray-400)'} text-xs font-medium py-3 rounded-xl text-center`}>
              {maxInfoText}
          </div>
        </div>

      </div>

      {/* Calendar Overlay */}
      {showCalendar && (
        <CalendarView 
          records={readingRecords} 
          onClose={() => setShowCalendar(false)} 
        />
      )}
    </div>
  );
};

export default MyReadingPage;
