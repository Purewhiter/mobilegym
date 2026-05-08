import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import { WECHAT_READING_CONFIG } from '../data';
import { IcNavForward, IcCheck } from '../res/icons';
import { getWechatReadingBookById, useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { dimens } from '../res/dimens';
import { useLocale } from '../../../os/locale';
import * as TimeService from '../../../os/TimeService';

const ReadingPage: React.FC = () => {
  const shelf = useWechatReadingStore(s => s.shelf);
  const readingRecords = useWechatReadingStore(s => s.readingRecords);
  const { bindTap } = useWechatReadingGestures();
  const s = useWechatReadingStrings();
  const locale = useLocale();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasInitializedScroll = useRef(false);
  const [recommendedIds, setRecommendedIds] = useState<string[]>(WECHAT_READING_CONFIG.recommendations);

  const topBooks = shelf
    .slice()
    .sort((a, b) => TimeService.parseToTimestamp(b.addedAt) - TimeService.parseToTimestamp(a.addedAt))
    .slice(0, 8)
    .map(item => getWechatReadingBookById(item.bookId))
    .filter((book): book is NonNullable<typeof book> => book !== undefined);

  const recommendedBooks = recommendedIds
    .map(id => getWechatReadingBookById(id))
    .filter((book): book is NonNullable<typeof book> => book !== undefined);

  const weekdayLabels = locale === 'en'
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['一', '二', '三', '四', '五', '六', '日'];

  const monthLabel = locale === 'en'
    ? s.reading_monthly_reading
    : `${TimeService.getDate().getMonth() + 1}${s.reading_monthly_reading}`;

  const handleRefresh = () => {
    const shuffled = [...WECHAT_READING_CONFIG.store].sort(() => 0.5 - Math.random());
    setRecommendedIds(shuffled.slice(0, 6).map(book => book.id));
  };

  useEffect(() => {
    if (!scrollContainerRef.current || hasInitializedScroll.current) return;

    const timer = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      scrollContainerRef.current.scrollLeft = 128;
      hasInitializedScroll.current = true;
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  const { weekTotalMinutes, weekActiveDays, monthTotalMinutes, monthActiveDays } = useMemo(() => {
    const now = TimeService.getDate();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDay() || 7;
    const mondayTime = TimeService.fromLocalParts(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - (currentDay - 1) * 86400000;
    const sundayTime = mondayTime + 6 * 86400000 + 86399999;

    const weekRecords = readingRecords.filter(record => {
      const time = TimeService.fromTimestamp(TimeService.parseToTimestamp(`${record.date}T00:00:00`)).getTime();
      return time >= mondayTime && time <= sundayTime;
    });

    const monthRecords = readingRecords.filter(record => {
      const date = TimeService.fromTimestamp(TimeService.parseToTimestamp(record.date));
      return date.getFullYear() === year && date.getMonth() === month;
    });

    const weekDays: Record<number, boolean> = {};
    weekRecords.forEach(record => {
      const day = TimeService.fromTimestamp(TimeService.parseToTimestamp(record.date)).getDay();
      weekDays[day] = true;
    });

    const monthDays: Record<number, boolean> = {};
    monthRecords.forEach(record => {
      const day = TimeService.fromTimestamp(TimeService.parseToTimestamp(record.date)).getDate();
      monthDays[day] = true;
    });

    return {
      weekTotalMinutes: weekRecords.reduce((sum, record) => sum + record.duration, 0),
      weekActiveDays: weekDays,
      monthTotalMinutes: monthRecords.reduce((sum, record) => sum + record.duration, 0),
      monthActiveDays: monthDays,
    };
  }, [readingRecords]);

  return (
    <div data-scroll-container="main" data-scroll-direction="vertical" className="flex flex-col h-full bg-(--app-c-tw-bg-slate-50) relative pb-16 overflow-y-auto no-scrollbar">
      <Header />

      <div data-scroll-container="categories" data-scroll-direction="horizontal" className="flex items-center gap-3 px-4 pt-8 pb-6 overflow-x-auto no-scrollbar">
        <div className="px-3 py-2 bg-blue-100/50 rounded-full flex items-center gap-1 shrink-0">
          <span className="text-(--app-settings-item-value-size) font-bold text-blue-600">{s.reading_hot_trend}</span>
          <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-blue-500)" />
        </div>
        <div {...bindTap<HTMLDivElement>('categories.open')} className="px-5 py-2 bg-app-surface rounded-full flex items-center gap-1 shrink-0 shadow-sm/50 cursor-pointer">
          <span className="text-(--app-title-text-size-14) font-medium text-(--app-c-tw-text-slate-700)">{s.reading_category}</span>
          <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-slate-400)" />
        </div>
        {[s.reading_ranking, s.reading_book_list].map(item => (
          <div key={item} className="px-5 py-2 bg-app-surface rounded-full flex items-center gap-1 shrink-0 shadow-sm/50">
            <span className="text-(--app-title-text-size-14) font-medium text-(--app-c-tw-text-slate-700)">{item}</span>
            <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-slate-400)" />
          </div>
        ))}
      </div>

      <div
        ref={scrollContainerRef}
        data-scroll-container="heroCarousel"
        data-scroll-direction="horizontal"
        className="px-4 py-2 flex gap-4 overflow-x-auto no-scrollbar h-32 shrink-0 items-stretch snap-x scroll-pl-8"
      >
        <div
          {...bindTap<HTMLDivElement>('myReading.open.month')}
          className="w-36 shrink-0 bg-app-surface p-3 rounded shadow-sm flex flex-col justify-between active:scale-95 overflow-hidden"
          style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
        >
          <div>
            <p className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-500) mb-2 font-medium">{monthLabel}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-(--app-c-tw-text-slate-900)">{monthTotalMinutes}</span>
              <span className="text-xs text-(--app-c-tw-text-slate-400) font-medium pb-1">{s.reading_minutes}</span>
            </div>
          </div>
          <div className="flex items-end justify-between flex-1 mt-2 w-full pb-1 overflow-hidden gap-(--app-item-gap-2) min-h-0">
            {Array.from({ length: 30 }).map((_, index) => {
              const hasRead = monthActiveDays[index + 1];
              return (
                <div
                  key={index}
                  className={`flex-1 rounded-full ${hasRead ? 'bg-sky-400 h-3/4' : 'bg-(--app-c-tw-bg-slate-100) h-1/2'}`}
                />
              );
            })}
          </div>
        </div>

        <div
          {...bindTap<HTMLDivElement>('myReading.open.week')}
          className="w-36 shrink-0 bg-app-surface p-3 rounded shadow-sm flex flex-col justify-between snap-start active:scale-95 overflow-hidden"
          style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
        >
          <div>
            <p className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-500) mb-2 font-medium">{s.reading_weekly_reading}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-(--app-c-tw-text-slate-900)">{weekTotalMinutes}</span>
              <span className="text-xs text-(--app-c-tw-text-slate-400) font-medium pb-1">{s.reading_minutes}</span>
            </div>
          </div>
          <div className="flex items-end justify-between mt-auto w-full">
            {weekdayLabels.map((day, index) => {
              const sysDay = index + 1;
              const isRead = weekActiveDays[sysDay === 7 ? 0 : sysDay];

              return (
                <div key={`${day}-${index}`} className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-[3px] flex items-center justify-center ${isRead ? 'bg-sky-400' : 'bg-(--app-c-tw-bg-slate-100)'}`}>
                    {isRead && <IcCheck size={dimens.icSizeTiny} strokeWidth={4} className="text-white" />}
                  </div>
                  <span className={`text-(--app-title-text-size-9) leading-none ${isRead ? 'text-sky-400 font-bold' : 'text-(--app-c-tw-text-slate-300)'}`}>
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {topBooks.map(book => (
          <div
            key={book.id}
            className="relative aspect-[3/4] h-full shrink-0 rounded shadow-md overflow-hidden bg-(--app-c-tw-bg-slate-200)"
            {...bindTap<HTMLDivElement>('reader.open', { params: { bookId: book.id } })}
          >
            <div className={`absolute inset-0 ${book.coverColor} p-3 flex flex-col items-center justify-center`}>
              <span className="text-(--app-title-text-size-14) font-bold leading-tight opacity-90 text-(--app-c-tw-text-slate-900) text-center">
                {book.title}
              </span>
              <span className="text-(--app-title-text-size-9) text-(--app-c-tw-text-slate-500) mt-1">{book.author}</span>
            </div>
          </div>
        ))}

        <div className="relative aspect-[3/4] h-full shrink-0 rounded bg-app-surface flex items-center justify-center shadow-sm">
          <span className="text-xs text-(--app-c-tw-text-slate-400) writing-vertical-rl tracking-widest">{s.reading_more_ellipsis}</span>
        </div>
      </div>

      <div className="px-4 pb-20 mt-6">
        <h2 className="text-xl font-bold text-(--app-c-tw-text-slate-800) mb-4">{s.reading_recommended_for_you}</h2>
        <div className="grid grid-cols-3 gap-x-4 gap-y-8">
          {recommendedBooks.map(book => (
            <div
              key={book.id}
              className="flex flex-col group cursor-pointer"
              {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
            >
              <div className={`aspect-[2/3] ${book.coverColor} shadow-sm relative overflow-hidden group-active:scale-95`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}>
                <div className="absolute inset-0 p-3 flex flex-col justify-between z-10">
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <span className="text-(--app-title-text-size-14) font-bold leading-tight opacity-90 text-(--app-c-tw-text-slate-900)">{book.title}</span>
                    <span className="text-(--app-title-text-size-9) text-(--app-c-tw-text-slate-500) mt-1">{book.author}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: 'reading.recommendations.refresh.submit' },
            { onTrigger: handleRefresh },
          )}
          className="w-full py-3 bg-app-surface mt-8 rounded-xl shadow-sm text-sm text-(--app-c-tw-text-slate-500) font-medium active:bg-(--app-c-tw-bg-slate-50)"
        >
          {s.reading_refresh_batch}
        </button>
      </div>
    </div>
  );
};

export default ReadingPage;

