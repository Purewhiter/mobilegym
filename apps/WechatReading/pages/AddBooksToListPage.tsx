import React, { useMemo, useState } from 'react';
import { IcCheck, IcExpand, IcSearch } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { getWechatReadingBookById, useWechatReadingStore } from '../state';
import { useAppNavigate } from '../navigation';
import type { Book } from '../data/types';

const AddBooksToListPage: React.FC = () => {
  const { back } = useAppNavigate();
  const s = useWechatReadingStrings();
  const { bindBack } = useWechatReadingGestures();
  const shelf = useWechatReadingStore(st => st.shelf);
  const likedListBooks = useWechatReadingStore(st => st.likedListBooks);
  const addBooksToLikedList = useWechatReadingStore(st => st.addBooksToLikedList);

  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const likedIds = useMemo(() => new Set(likedListBooks.map(e => e.bookId)), [likedListBooks]);

  const pickableItems = useMemo(() => {
    return shelf
      .map(item => ({
        ...item,
        book: getWechatReadingBookById(item.bookId),
      }))
      .filter(item => item.book && !likedIds.has(item.bookId));
  }, [shelf, likedIds]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pickableItems;
    return pickableItems.filter(item => {
      const b = item.book as Book;
      return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    });
  }, [pickableItems, query]);

  const filteredIds = useMemo(() => filteredItems.map(i => i.bookId), [filteredItems]);
  const isAllFilteredSelected =
    filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));

  const toggleOne = (bookId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleDone = () => {
    if (selectedIds.size > 0) {
      addBooksToLikedList(Array.from(selectedIds));
    }
    back();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <header className="sticky top-0 z-40 shrink-0 bg-white px-1 pb-2 pt-10">
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>()}
            className="p-2.5 text-slate-400 active:opacity-60"
            aria-label={s.common_cancel}
          >
            <IcExpand size={dimens.settings_header_back_size} className="text-slate-400" />
          </button>
          <span className="text-[15px] font-medium text-slate-700">{s.book_lists_add_books}</span>
          <div className="w-11" />
        </div>
        <div className="mt-2 px-3">
          <div className="flex h-11 items-center gap-2.5 rounded-full bg-[#F5F5F5] px-4">
            <IcSearch size={18} className="shrink-0 text-slate-400" strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={s.book_lists_search_books}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </header>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="no-scrollbar flex-1 overflow-y-auto pb-28"
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-5">
          <span className="text-[15px] font-semibold text-slate-800">{s.book_lists_shelf_section}</span>
          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            className="flex h-9 w-9 items-center justify-center active:opacity-70"
            disabled={filteredIds.length === 0}
          >
            <span
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px] ${
                isAllFilteredSelected ? 'border-[#3B8EE5] bg-[#3B8EE5]' : 'border-slate-300 bg-white'
              }`}
            >
              {isAllFilteredSelected && <IcCheck size={11} className="text-white" strokeWidth={3} />}
            </span>
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <div className="px-4 py-14 text-center text-[14px] text-slate-400">
            {pickableItems.length === 0 ? s.book_lists_nothing_to_add : s.search_no_result}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredItems.map(item => {
              const book = item.book as Book;
              const isSelected = selectedIds.has(item.bookId);
              return (
                <li key={item.bookId}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3.5 px-4 py-4 text-left active:bg-slate-50/80"
                    onClick={() => toggleOne(item.bookId)}
                  >
                    <div
                      className={`relative h-[76px] w-[52px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${book.coverColor || 'bg-slate-200'}`}
                    >
                      {book.cover ? (
                        <img src={book.cover} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center">
                          <span className="line-clamp-3 text-[10px] font-bold leading-tight text-slate-800">
                            {book.title}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-[15px] font-semibold leading-snug text-slate-900">{book.title}</div>
                      <div className="mt-1 text-[13px] text-slate-500">{book.author}</div>
                    </div>
                    <span
                      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                        isSelected ? 'border-[#3B8EE5] bg-[#3B8EE5]' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <IcCheck size={11} className="text-white" strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white py-4">
        <button
          type="button"
          onClick={handleDone}
          className="w-full text-center text-[16px] font-medium text-[#3B8EE5] active:opacity-70"
        >
          {s.book_lists_add_books_done}
        </button>
      </footer>
    </div>
  );
};

export default AddBooksToListPage;
