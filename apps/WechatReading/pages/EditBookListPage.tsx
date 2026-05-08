import React from 'react';
import { IcAdd, IcCheck, IcClose } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { getWechatReadingBookById, useWechatReadingStore } from '../state';
import { useAppNavigate } from '../navigation';
import type { Book } from '../data/types';

function formatTemplate(template: string, value: string | number) {
  return template.replace('{0}', String(value));
}

function BookCoverThumb({ book, className }: { book: Book; className?: string }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-sm border border-(--app-c-tw-border-gray-100) shadow-sm ${className ?? 'h-[88px] w-[60px]'}`}
    >
      {book.cover ? (
        <img src={book.cover} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full flex-col items-center justify-center p-1.5 text-center ${book.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}
        >
          <span className="line-clamp-3 text-(--app-title-text-size-9) font-bold leading-tight text-(--app-c-tw-text-slate-800)">
            {book.title}
          </span>
        </div>
      )}
    </div>
  );
}

const EditBookListPage: React.FC = () => {
  const s = useWechatReadingStrings();
  const { bindBack } = useWechatReadingGestures();
  const { go, back } = useAppNavigate();
  const user = useWechatReadingStore(st => st.user);
  const likedListBooks = useWechatReadingStore(st => st.likedListBooks);
  const likedListSyncToHome = useWechatReadingStore(st => st.likedListSyncToHome);
  const removeBookFromLikedList = useWechatReadingStore(st => st.removeBookFromLikedList);
  const updateLikedListRecommendation = useWechatReadingStore(st => st.updateLikedListRecommendation);
  const toggleLikedListSyncToHome = useWechatReadingStore(st => st.toggleLikedListSyncToHome);

  const displayName = (user.name || '').trim() || '我';
  const likedTitle = formatTemplate(s.book_lists_liked_title, displayName);

  const handleDone = () => {
    back();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <header className="sticky top-0 z-40 grid shrink-0 grid-cols-[44px_1fr_44px] items-center bg-white px-1 pb-3 pt-10">
        <button
          type="button"
          {...bindBack<HTMLButtonElement>()}
          className="justify-self-start p-2 text-slate-400 active:opacity-60"
          aria-label={s.common_cancel}
        >
          <IcClose size={22} strokeWidth={1.5} />
        </button>
        <span className="text-center text-[16px] font-normal text-slate-600">{s.book_lists_edit_title}</span>
        <span className="w-11" />
      </header>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="no-scrollbar flex-1 overflow-y-auto px-4 pb-40"
      >
        <h1 className="pt-2 font-serif text-[28px] font-bold leading-[1.32] tracking-wide text-slate-900">
          {likedTitle}
        </h1>

        <button
          type="button"
          className="mb-10 mt-7 flex w-full items-center gap-4 py-1 text-left active:opacity-80"
          style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
          onClick={() => go('bookLists.addBooks.open')}
        >
          <div className="flex h-[104px] w-[72px] shrink-0 items-center justify-center rounded-[2px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <IcAdd size={28} className="text-slate-300" strokeWidth={1.25} />
          </div>
          <span className="text-[16px] font-normal text-slate-900">{s.book_lists_add_books}</span>
        </button>

        {likedListBooks.map(entry => {
          const book = getWechatReadingBookById(entry.bookId);
          if (!book) return null;
          return (
            <div key={entry.bookId} className="mb-9">
              <div className="flex gap-4">
                <BookCoverThumb book={book} className="h-[104px] w-[72px]" />
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="text-[16px] font-normal leading-snug text-slate-900">{book.title}</div>
                  <div className="mt-1 text-[13px] text-slate-500">{book.author}</div>
                  <button
                    type="button"
                    className="mt-3 self-start text-[13px] font-normal text-red-500 active:opacity-70"
                    onClick={() => removeBookFromLikedList(entry.bookId)}
                  >
                    {s.book_lists_delete_book}
                  </button>
                </div>
              </div>
              <textarea
                value={entry.recommendation ?? ''}
                onChange={e => updateLikedListRecommendation(entry.bookId, e.target.value)}
                placeholder={s.book_lists_recommendation_placeholder}
                rows={2}
                className="mt-5 w-full resize-none rounded-lg border-0 bg-[#F5F5F5] px-3.5 py-3 text-[14px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200/80"
              />
            </div>
          );
        })}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100/80 bg-white px-4 pt-3">
        <div className="flex items-center justify-between gap-3 pb-7">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 active:opacity-80"
            onClick={() => toggleLikedListSyncToHome()}
          >
            <span
              className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                likedListSyncToHome ? 'border-[#4A9FE8] bg-[#4A9FE8]' : 'border-[#7EB8F0] bg-white'
              }`}
            >
              {likedListSyncToHome && <IcCheck size={10} className="text-white" strokeWidth={3} />}
            </span>
            <span className="text-left text-[14px] font-normal text-[#4A9FE8]">{s.book_lists_sync_to_home}</span>
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="shrink-0 rounded-full bg-[#1E88F5] px-10 py-2.5 text-[15px] font-medium text-white active:opacity-90"
            style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {s.book_lists_done}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default EditBookListPage;
