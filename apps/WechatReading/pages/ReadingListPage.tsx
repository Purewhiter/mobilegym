import React, { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as TimeService from '../../../os/TimeService';
import { useLocale } from '../../../os/locale';
import { Book } from '../data/types';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { dimens } from '../res/dimens';
import { IcCheckCircle2, IcFilter, IcNavBack, IcSearch } from '../res/icons';
import {
  getWechatReadingBookById,
  selectAllProgressBookIds,
  selectFinishedBookIds,
  selectReadingBookIds,
  useWechatReadingStore,
} from '../state';

const CATEGORIES = ['all', 'reading', 'finished'] as const;
type CategoryId = typeof CATEGORIES[number];

const ReadingListPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const category = (searchParams.get('category') || 'all') as CategoryId;
  const locale = useLocale();
  const s = useWechatReadingStrings();
  const shelf = useWechatReadingStore(s => s.shelf);
  const bookProgress = useWechatReadingStore(s => s.bookProgress);
  const allProgressBookIds = useWechatReadingStore(selectAllProgressBookIds);
  const readingBookIds = useWechatReadingStore(selectReadingBookIds);
  const finishedBookIds = useWechatReadingStore(selectFinishedBookIds);
  const { bindBack, bindTap, go } = useWechatReadingGestures();

  React.useEffect(() => {
    if (location.pathname !== '/reading-list') return;
    const raw = new URLSearchParams(location.search).get('category');
    if (!raw || !(['all', 'reading', 'finished'] as const).includes(raw as any)) {
      go('readingList.tab.switch', { category: 'all' });
    }
  }, [go, location.pathname, location.search]);

  const shelfByBookId = useMemo(() => new Map(shelf.map(i => [String(i.bookId), i])), [shelf]);

  type ListItem = {
    bookId: string;
    book: Book | undefined;
    progress: any;
    isFinished: boolean;
    percent: number;
    startedAt: string;
    year: number;
  };

  const buildItem = (bookId: string): ListItem => {
    const id = String(bookId);
    const book = getWechatReadingBookById(id);
    const progress = bookProgress[id];
    const totalWords = book?.totalWords ?? 0;
    const isFinished = !!(book && progress && progress.charOffset >= totalWords);
    const percent = book && progress && totalWords > 0 ? Math.floor((progress.charOffset / totalWords) * 100) : 0;
    const shelfItem = shelfByBookId.get(id);
    const startedAt = shelfItem?.addedAt || progress?.lastReadAt || '';
    const year = startedAt
      ? TimeService.fromTimestamp(TimeService.parseToTimestamp(startedAt)).getFullYear()
      : TimeService.getDate().getFullYear();

    return { bookId: id, book, progress, isFinished, percent, startedAt, year };
  };

  const counts = useMemo(() => {
    const valid = (id: string) => !!getWechatReadingBookById(String(id));
    return {
      all: allProgressBookIds.filter(valid).length,
      reading: readingBookIds.filter(valid).length,
      finished: finishedBookIds.filter(valid).length,
    };
  }, [allProgressBookIds, finishedBookIds, readingBookIds]);

  const filteredList = useMemo(() => {
    const ids = category === 'reading' ? readingBookIds : category === 'finished' ? finishedBookIds : allProgressBookIds;
    return ids.map(buildItem).filter(item => item.book);
  }, [allProgressBookIds, bookProgress, category, finishedBookIds, readingBookIds, shelfByBookId]);

  const groupedData = useMemo(() => {
    const groups: Record<number, ListItem[]> = {};
    filteredList.forEach(item => {
      if (!groups[item.year]) groups[item.year] = [];
      groups[item.year].push(item);
    });
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [filteredList]);

  const formatMonthMeta = (item: ListItem) => {
    const sourceDate = item.isFinished ? item.progress?.lastReadAt : item.startedAt;
    if (!sourceDate) return '';
    const date = TimeService.fromTimestamp(TimeService.parseToTimestamp(sourceDate));
    if (locale === 'en') {
      const monthLabel = date.toLocaleString('en-US', { month: 'short' });
      return item.isFinished ? `${monthLabel} ${s.reading_list_month_finished}` : `${monthLabel} ${s.reading_list_month_started}`;
    }
    return item.isFinished ? `${date.getMonth() + 1}${s.reading_list_month_finished}` : `${date.getMonth() + 1}${s.reading_list_month_started}`;
  };

  const tabs = [
    { id: 'all' as CategoryId, label: s.reading_list_tab_all, count: counts.all },
    { id: 'reading' as CategoryId, label: s.reading_list_tab_reading, count: counts.reading },
    { id: 'finished' as CategoryId, label: s.reading_list_tab_finished, count: counts.finished },
  ];

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-app-bg">
      <div className="sticky top-0 z-40 bg-app-bg px-4 pb-2 pt-10">
        <div className="mb-4 flex items-center justify-between">
          <IcNavBack
            size={dimens.icSizeTab as number}
            className="text-(--app-c-tw-text-slate-800) active:opacity-60"
            {...(bindBack() as unknown as Record<string, unknown>)}
          />
          <h1 className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-900)">{s.reading_list_title}</h1>
          <div className="flex gap-4">
            <IcSearch size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
            <IcCheckCircle2 size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
          </div>
        </div>

        <div className="mb-4 flex gap-1 rounded-full bg-(--app-c-tw-bg-gray-200)/50 p-1">
          {tabs.map(tab => {
            const isActive = category === tab.id;
            return (
              <div
                key={tab.id}
                {...(isActive ? {} : bindTap<HTMLDivElement>('readingList.tab.switch', { params: { category: tab.id } }))}
                className={`flex-1 cursor-pointer rounded-full py-1.5 text-center text-(--app-settings-item-value-size) font-medium ${
                  isActive ? 'bg-app-surface text-(--app-c-tw-text-slate-900) shadow-sm' : 'text-(--app-c-tw-text-slate-500)'
                }`}
                style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
              >
                {tab.label} ({tab.count})
              </div>
            );
          })}
        </div>
      </div>

      <div data-scroll-container="main" data-scroll-direction="vertical" className="no-scrollbar flex-1 overflow-y-auto px-4 pb-10">
        {groupedData.map(([year, items]) => (
          <div key={year} className="mb-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">
                {locale === 'en' ? `${year} (${items.length})` : `${year}${s.reading_list_year_unit}(${items.length})`}
              </span>
              <div className="flex items-center gap-1 text-(--app-c-tw-text-slate-400)">
                <IcFilter size={dimens.icSizeNavPagination} />
                <span className="text-(--app-settings-item-value-size)">{s.reading_list_filter}</span>
              </div>
            </div>

            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.bookId}
                  className="flex items-stretch justify-between rounded-2xl bg-app-surface p-5 shadow-sm active:scale-[0.98]"
                  style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
                  {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: item.bookId } })}
                >
                  <div className="flex flex-col justify-between py-1">
                    <div className="space-y-3">
                      {item.isFinished ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-500)">{s.reading_list_less_than}</span>
                          <span className="text-(--app-title-text-size-22) font-bold text-(--app-c-tw-text-slate-900)">1</span>
                          <span className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-500)">{s.common_minutes_unit}</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          {item.percent > 0 ? (
                            <>
                              <span className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-500)">{s.reading_list_read_to}</span>
                              <span className="text-(--app-title-text-size-22) font-bold text-(--app-c-tw-text-slate-900)">{item.percent}</span>
                              <span className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-500)">%</span>
                            </>
                          ) : (
                            <span className="text-(--app-title-text-size-18) font-bold text-(--app-c-tw-text-slate-900)">{s.reading_list_status_reading}</span>
                          )}
                        </div>
                      )}

                      <h3 className="text-(--app-settings-item-text-size) font-bold leading-tight text-(--app-c-tw-text-slate-800)">
                        {locale === 'en' ? `"${item.book?.title}"` : `《${item.book?.title}》`}
                      </h3>
                    </div>

                    <div className="text-(--app-bookshelf-footer-text-size) text-(--app-c-tw-text-slate-400)">
                      {formatMonthMeta(item)}
                    </div>
                  </div>

                  <div className={`relative flex h-22 w-16 flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded p-2 text-center shadow-sm ${item.book?.coverColor || 'bg-(--app-c-tw-bg-slate-200)'}`}>
                    <span className="line-clamp-2 text-(--app-title-text-size-9) font-bold leading-tight">{item.book?.title}</span>
                    <span className="mt-1 text-(--app-item-text-size-7) text-(--app-c-tw-text-slate-500)">{item.book?.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredList.length === 0 && (
          <div className="mt-20 flex flex-col items-center justify-center text-(--app-c-tw-text-slate-300)">
            <span className="text-(--app-settings-item-text-size)">{s.reading_list_no_records}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadingListPage;
