import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcAdd, IcAddCircle, IcList, IcNavBackArrow, IcSearch } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { getWechatReadingBookById, useWechatReadingStore } from '../state';


type CategoryId = 'all' | 'reading' | 'finished';

const CATEGORY_MY: CategoryId = 'all';
const CATEGORY_COLLECTED: CategoryId = 'finished';

function formatTemplate(template: string, value: string | number) {
  return template.replace('{0}', String(value));
}

/** 「我」页「书单」入口对应的独立页面（非 /reading-list 在读/读完列表） */
const BookListsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();


  const s = useWechatReadingStrings();
  const { bindBack, bindTap } = useWechatReadingGestures();
  const user = useWechatReadingStore(st => st.user);
  const likedListBooks = useWechatReadingStore(st => st.likedListBooks);
  const displayName = (user.name || '').trim() || '我';
  const likedListTitle = formatTemplate(s.book_lists_liked_title, displayName);

  const rawCategory = searchParams.get('category') as CategoryId | null;
  const category: CategoryId =
    rawCategory && (rawCategory === 'all' || rawCategory === 'reading' || rawCategory === 'finished')
      ? rawCategory
      : CATEGORY_MY;

  React.useEffect(() => {
    if (!rawCategory || rawCategory !== category) {
      setSearchParams({ category }, { replace: true });
    }
  }, [rawCategory, category, setSearchParams]);

  const activeSide = category === CATEGORY_COLLECTED ? 'collected' : 'my';
  const myListsCount = 1;

  const setSideTab = (nextCategory: CategoryId) => {
    setSearchParams({ category: nextCategory }, { replace: true });
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-(--app-c-tw-bg-slate-100)">
      <div className="sticky top-0 z-40 border-b border-(--app-c-tw-border-gray-100)/80 bg-(--app-c-tw-bg-slate-100)/95 px-4 pt-10 pb-3 backdrop-blur-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
          <div className="flex justify-start">
            <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-2 active:opacity-60">
              <IcNavBackArrow size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
            </button>
          </div>
          <h1 className="text-center text-[22px] font-black leading-tight tracking-tight text-(--app-c-tw-text-slate-900)">
            {s.reading_book_list}
          </h1>
          <div className="flex items-center justify-end gap-1">
            <button type="button" className="p-1.5 active:opacity-60" {...bindTap<HTMLButtonElement>('search.open')}>
              <IcSearch size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
            </button>
            <button
              type="button"
              className="p-1.5 active:opacity-60"
              {...bindTap<HTMLButtonElement>('bookLists.edit.open')}
              aria-label={s.book_lists_add_books}
            >
              <IcAddCircle size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-1 rounded-full bg-(--app-c-tw-bg-gray-200)/60 p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setSideTab(CATEGORY_MY)}
            className={`flex-1 rounded-full py-2 text-center text-(--app-settings-item-value-size) font-semibold ${
              activeSide === 'my'
                ? 'bg-app-surface text-(--app-c-tw-text-slate-900) shadow-sm'
                : 'text-(--app-c-tw-text-slate-500)'
            }`}
            style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {formatTemplate(s.book_lists_tab_my, myListsCount)}
          </button>
          <button
            type="button"
            onClick={() => setSideTab(CATEGORY_COLLECTED)}
            className={`flex-1 rounded-full py-2 text-center text-(--app-settings-item-value-size) font-semibold ${
              activeSide === 'collected'
                ? 'bg-app-surface text-(--app-c-tw-text-slate-900) shadow-sm'
                : 'text-(--app-c-tw-text-slate-500)'
            }`}
            style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {s.book_lists_tab_collected}
          </button>
        </div>
      </div>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="no-scrollbar flex-1 overflow-y-auto px-4 pb-10"
      >
        {activeSide === 'my' ? (
          <div className="pt-4">
            <div className="w-full overflow-hidden rounded-2xl bg-app-surface shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-3 border-b border-(--app-c-tw-border-gray-100) px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400 text-white shadow-sm">
                  <IcList size={dimens.icSizeChevron} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-900)">
                    {likedListTitle}
                  </div>
                </div>
              </div>

              <button type="button" {...bindTap<HTMLButtonElement>('bookLists.edit.open')} className="w-full text-left">
                <div className="px-4 pb-5 pt-4">
                  {likedListBooks.length > 0 && (
                    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                      {likedListBooks.slice(0, 12).map(entry => {
                        const book = getWechatReadingBookById(entry.bookId);
                        if (!book) return null;
                        return (
                          <div
                            key={entry.bookId}
                            className="relative h-20 w-14 shrink-0 overflow-hidden rounded-sm border border-(--app-c-tw-border-gray-100) shadow-sm"
                          >
                            {book.cover ? (
                              <img src={book.cover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div
                                className={`flex h-full w-full flex-col items-center justify-center p-1 text-center ${book.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}
                              >
                                <span className="line-clamp-3 text-(--app-title-text-size-9) font-bold leading-tight text-(--app-c-tw-text-slate-800)">
                                  {book.title}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div
                    className={`flex w-full items-center justify-center rounded-xl border border-dashed border-(--app-c-tw-border-slate-200) bg-(--app-c-tw-bg-slate-50)/80 active:bg-(--app-c-tw-bg-slate-100) ${likedListBooks.length === 0 ? 'min-h-[200px]' : 'min-h-[100px]'}`}
                    style={{ transition: 'background-color var(--app-duration-short) var(--app-easing-standard)' }}
                  >
                    <div className="flex flex-col items-center justify-center py-6">
                      <IcAdd size={dimens.icSizeService} className="text-(--app-c-tw-text-slate-300) stroke-[1.5]" />
                      <div className="mt-3 text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-slate-500)">
                        {s.book_lists_add_books}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <div className="text-xs font-medium text-(--app-c-tw-text-slate-400)">
                {formatTemplate(s.book_lists_my_lists_count_label, myListsCount)}
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-[#4A90E2] active:opacity-60"
                {...bindTap<HTMLButtonElement>('bookLists.viewProfile')}
              >
                {s.book_lists_view_public_homepage}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[min(100%,520px)] flex-1 flex-col items-center justify-center px-6 py-12">
            <p className="text-center text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-slate-400)">
              {s.book_lists_empty_collected}
            </p>
            <button
              type="button"
              className="mt-10 rounded-full bg-[#4A90E2] px-10 py-3 text-center text-(--app-settings-item-text-size) font-semibold text-white shadow-sm active:opacity-90"
              style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
              {...bindTap<HTMLButtonElement>('bookLists.viewPopular')}
            >
              {s.book_lists_view_popular}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookListsPage;
