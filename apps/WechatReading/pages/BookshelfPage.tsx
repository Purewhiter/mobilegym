import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getWechatReadingBookById, useWechatReadingStore } from '../state';
import { dimens } from '../res/dimens';
import {
  IcAddCircle,
  IcCheckCircle,
  IcSearch,
  IcAdd,
  IcCheck,
  IcDownload,
  IcListPlus,
  IcPin,
  IcFolderAdd,
  IcBookRemove,
  IcGhost,
} from '../res/icons';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';

function formatMessage(template: string, ...values: Array<string | number>) {
  let result = template;
  values.forEach((value, index) => {
    result = result.replace(`{${index}}`, String(value));
  });
  return result;
}

const BookshelfPage: React.FC = () => {
  const shelf = useWechatReadingStore(s => s.shelf);
  const removeFromShelf = useWechatReadingStore(s => s.removeFromShelf);
  const togglePrivate = useWechatReadingStore(s => s.togglePrivate);
  const { bindTap, bindLongPress, bindBack, go, back } = useWechatReadingGestures();
  const s = useWechatReadingStrings();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const isSelectMode = searchParams.get('select') === 'true';
  const showConfirmModal = searchParams.get('modal') === 'confirm_remove';
  const showPrivateModal = searchParams.get('modal') === 'private_reading';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const shelfItems = useMemo(() => {
    return shelf
      .map(item => ({
        ...item,
        book: getWechatReadingBookById(item.bookId),
      }))
      .filter(item => item.book);
  }, [shelf]);

  const publicCount = shelfItems.filter(item => !item.isPrivate).length;
  const privateCount = shelfItems.filter(item => item.isPrivate).length;
  const isAllSelected = shelfItems.length > 0 && selectedIds.size === shelfItems.length;
  const selectedCountLabel = formatMessage(s.bookshelf_selected_count, selectedIds.size);
  const footerStats = privateCount > 0
    ? `${publicCount}${s.bookshelf_public_reading} · ${privateCount}${s.bookshelf_private_reading}`
    : `${publicCount}${s.bookshelf_public_reading}`;

  useEffect(() => {
    if (!isSelectMode) {
      setSelectedIds(new Set());
    }
  }, [isSelectMode]);

  const toggleSelection = (bookId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shelfItems.map(item => item.bookId)));
    }
  };

  const enterSelectModeFromItem = (bookId: string) => {
    if (isSelectMode) return;
    setSelectedIds(new Set([bookId]));
    go('bookshelf.select.enter');
  };

  const openReaderFromItem = (bookId: string) => {

    go('reader.open', { bookId });
  };

  const sortTabs = [
    s.bookshelf_sort_default,
    s.bookshelf_sort_update,
    s.bookshelf_sort_progress,
    s.bookshelf_sort_recommendation,
    s.bookshelf_sort_title,
    s.bookshelf_sort_category,
  ];

  return (
    <div className="flex flex-col h-full bg-app-surface relative overflow-hidden">
      <div className="pt-10 px-4 bg-app-surface sticky top-0 z-40 shadow-sm/5">
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            {...bindTap<HTMLButtonElement>('search.open')}
            className="flex-1 h-9 bg-(--app-c-tw-bg-gray-100)/80 rounded-full flex items-center px-3 gap-2 active:opacity-70"
            style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
          >
            <IcSearch size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400)" />
            <div className="flex-1 text-left text-sm text-(--app-c-tw-placeholder-gray-400) truncate">
              {s.search_placeholder_default}
            </div>
            <div className="w-(--app-comp-header-width-1) h-3.5 bg-(--app-c-tw-bg-gray-300)/50 mx-1" />
            <span className="text-sm font-medium text-(--app-c-tw-text-slate-600) px-1">
              {s.header_bookstore}
            </span>
          </button>
        </div>

        {isSelectMode ? (
          <div className="flex justify-between items-center h-12 mb-2 animate-in fade-in slide-in-from-top-1" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}>
            <button
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: 'bookshelf.selectAll.toggle' },
                { onTrigger: handleSelectAll },
              )}
              className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-slate-800) active:opacity-60"
            >
              {isAllSelected ? s.bookshelf_deselect_all : s.bookshelf_select_all}
            </button>
            <div className="flex flex-col items-center">
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-900)">{s.bookshelf_select_books}</span>
              <span className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-500)">{selectedCountLabel}</span>
            </div>
            <button
              {...bindTap<HTMLButtonElement>('bookshelf.select.exit')}
              className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-slate-800) active:opacity-60"
            >
              {s.bookshelf_cancel}
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-end mb-4 mt-2">
            <h1 className="text-2xl font-bold text-(--app-c-tw-text-slate-800)">{s.bookshelf_title}</h1>
            <div className="flex gap-4 text-(--app-c-tw-text-slate-500) mb-1">
              <button className="flex items-center gap-1 text-sm font-medium active:opacity-60">
                <IcAddCircle size={dimens.icSizeAction} /> {s.bookshelf_import}
              </button>
              <button
                {...bindTap<HTMLButtonElement>('bookshelf.select.enter.tap', {
                  beforeTrigger: () => setSelectedIds(new Set()),
                })}
                className="flex items-center gap-1 text-sm font-medium active:opacity-60"
              >
                <IcCheckCircle size={dimens.icSizeAction} /> {s.bookshelf_select}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-6 text-sm text-(--app-c-tw-text-slate-400) font-medium pb-3 overflow-x-auto no-scrollbar">
          {sortTabs.map((tab, index) => (
            <button key={tab} className={`${index === 0 ? 'text-blue-600 font-bold' : ''} whitespace-nowrap`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div data-scroll-container="main" data-scroll-direction="vertical" className={`flex-1 overflow-y-auto no-scrollbar ${isSelectMode ? 'pb-32' : 'pb-24'}`}>
        <div className="p-4 grid grid-cols-3 gap-x-4 gap-y-8">
          {shelfItems.map(item => {
            const isSelected = selectedIds.has(item.bookId);
            const itemTapProps = isSelectMode
              ? bindTap<HTMLDivElement>(
                { kind: 'action', id: 'bookshelf.item.select.toggle' },
                { params: { bookId: item.bookId }, onTrigger: () => toggleSelection(item.bookId) },
              )
              : bindTap<HTMLDivElement>('reader.open', {
                params: { bookId: item.bookId },
                onTrigger: () => openReaderFromItem(item.bookId),
              });
            const itemLongPressProps = bindLongPress<HTMLDivElement>('bookshelf.select.enter', {
              duration: 600,
              onTrigger: () => enterSelectModeFromItem(item.bookId),
            });

            return (
              <div key={item.bookId} className="flex flex-col group relative" {...itemLongPressProps} {...itemTapProps}>
                <div className={`aspect-[3/4] ${item.book?.coverColor || 'bg-(--app-c-tw-bg-gray-100)'} rounded-sm shadow-sm mb-3 relative overflow-hidden ${isSelected ? 'scale-[0.92] brightness-90 shadow-inner' : 'active:scale-95'}`} style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}>
                  <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-(--app-settings-item-value-size) font-bold leading-snug text-(--app-c-tw-text-slate-800) opacity-90 line-clamp-3">
                      {item.book?.title}
                    </span>
                    <span className="text-(--app-title-text-size-9) text-(--app-c-tw-text-slate-500) mt-1.5 opacity-80 font-medium">
                      {item.book?.author}
                    </span>
                  </div>

                  {isSelectMode && (
                    <div className="absolute inset-0 bg-black/5 pointer-events-none flex items-end justify-end p-1.5 animate-in fade-in zoom-in" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}>
                      <div className={`w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${isSelected ? 'bg-(--app-c-tw-bg-blue-500) border-blue-500' : 'bg-app-surface/20'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                        {isSelected && <IcCheck size={dimens.icSizeReaderChevron} className="text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  )}

                  {item.isPrivate && !isSelectMode && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/20 backdrop-blur-sm rounded-full p-1 border border-white/10">
                      <IcGhost size={dimens.icSizeInlineArrow} className="text-white fill-white" />
                    </div>
                  )}
                </div>

                <h3 className={`text-(--app-settings-item-value-size) font-medium leading-tight truncate px-0.5 ${isSelected ? 'text-blue-600' : 'text-(--app-c-tw-text-slate-800)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                  {item.book?.title}
                </h3>
              </div>
            );
          })}

          {!isSelectMode && (
            <button {...bindTap<HTMLButtonElement>('reading.open')} className="aspect-[3/4] flex flex-col items-center justify-center">
              <div className="w-full h-full bg-(--app-c-tw-bg-slate-50) border-2 border-dashed border-(--app-c-tw-border-slate-200) rounded-sm flex items-center justify-center active:bg-(--app-c-tw-bg-slate-100)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                <IcAdd size={dimens.icSizeService} className="text-(--app-c-tw-text-slate-300) stroke-[1.5]" />
              </div>
              <div className="h-(--app-bookshelf-page-height-19) mt-3" />
            </button>
          )}
        </div>

        <div className="pt-4 pb-12 flex flex-col items-center justify-center gap-1">
          <span className="text-xs text-(--app-c-tw-text-slate-400)">{footerStats}</span>
          <button
            {...bindTap<HTMLButtonElement>('profile.my.open')}
            className="text-xs text-(--app-c-tw-text-blue-500) font-medium active:opacity-60"
          >
            {s.bookshelf_view_public_page}
          </button>
        </div>
      </div>

      {isSelectMode && (
        <div className="absolute bottom-0 inset-x-0 bg-app-surface border-t border-(--app-c-tw-border-gray-100) pt-5 pb-8 px-6 z-50 animate-slide-up shadow-[0_-4px_15px_rgba(0,0,0,0.05)] pb-safe">
          <div className="grid grid-cols-3 gap-y-7">
            <button
              disabled={selectedIds.size === 0}
              className={`flex flex-col items-center gap-1.5 ${selectedIds.size === 0 ? 'opacity-30' : 'active:opacity-60'}`}
              style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
              {...bindTap<HTMLButtonElement>('bookshelf.modal.private.open')}
            >
              <IcGhost size={dimens.icSizeTab} strokeWidth={1.5} className="text-(--app-c-tw-text-slate-600)" />
              <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) scale-90">{s.bookshelf_toolbar_private_reading}</span>
            </button>
            <div className="flex flex-col items-center gap-1.5 active:opacity-60">
              <IcDownload size={dimens.icSizeTab} strokeWidth={1.5} className="text-(--app-c-tw-text-slate-600)" />
              <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) scale-90">{s.bookshelf_toolbar_download}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 active:opacity-60">
              <IcListPlus size={dimens.icSizeTab} strokeWidth={1.5} className="text-(--app-c-tw-text-slate-600)" />
              <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) scale-90">{s.bookshelf_toolbar_add_to_list}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 active:opacity-60">
              <IcPin size={dimens.icSizeTab} strokeWidth={1.5} className="text-(--app-c-tw-text-slate-600)" />
              <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) scale-90">{s.bookshelf_toolbar_pin_top}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 active:opacity-60">
              <IcFolderAdd size={dimens.icSizeTab} strokeWidth={1.5} className="text-(--app-c-tw-text-slate-600)" />
              <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) scale-90">{s.bookshelf_toolbar_group_to}</span>
            </div>
            <button
              disabled={selectedIds.size === 0}
              className={`flex flex-col items-center gap-1.5 ${selectedIds.size === 0 ? 'opacity-30' : 'active:opacity-60'}`}
              style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
              {...bindTap<HTMLButtonElement>('bookshelf.modal.confirm_remove.open')}
            >
              <IcBookRemove size={dimens.icSizeTab} strokeWidth={1.5} className="text-red-500" />
              <span className="text-(--app-tab-bar-label-size) text-red-500 scale-90 font-medium">{s.bookshelf_toolbar_remove}</span>
            </button>
          </div>
        </div>
      )}

      {showPrivateModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[100] animate-in fade-in" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }} {...bindBack()} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-(--app-card-width-320) bg-app-surface rounded-[24px] z-[110] animate-in zoom-in shadow-2xl overflow-hidden" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}>
            <div className="p-8 pb-6 flex flex-col items-center text-center">
              <h3 className="text-(--app-modal-title-size) font-bold text-(--app-c-tw-text-slate-900) mb-3">{s.bookshelf_private_modal_title}</h3>
              <p className="text-(--app-settings-item-text-size) leading-relaxed text-(--app-c-tw-text-slate-500)">{s.bookshelf_private_modal_desc}</p>
            </div>
            <div className="flex border-t border-(--app-c-tw-border-gray-100) h-14">
              <button
                {...bindBack<HTMLButtonElement>()}
                className="flex-1 text-(--app-modal-action-text-size) font-bold text-app-primary active:bg-(--app-c-tw-bg-gray-100) border-r border-(--app-c-tw-border-gray-100)"
                style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
              >
                {s.common_cancel}
              </button>
              <button
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'bookshelf.privateReading.enable.submit' },
                  {
                    onTrigger: () => {
                      togglePrivate(Array.from(selectedIds), true);
                      back(2);
                    },
                  },
                )}
                className="flex-1 text-(--app-modal-action-text-size) font-bold text-app-primary active:bg-(--app-c-tw-bg-gray-100)"
                style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
              >
                {s.bookshelf_private_modal_enable}
              </button>
            </div>
          </div>
        </>
      )}

      {showConfirmModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }} {...bindBack()} />
          <div className="fixed bottom-0 left-0 right-0 bg-app-surface rounded-t-[20px] z-[70] animate-slide-up overflow-hidden pb-8">
            <div className="p-6 text-center border-b border-(--app-c-tw-border-gray-100)">
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-gray-900)">{s.bookshelf_remove_modal_title}</span>
            </div>
            <div className="flex flex-col">
              <button
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'bookshelf.removeSelected.submit' },
                  {
                    onTrigger: () => {
                      selectedIds.forEach(id => removeFromShelf(id));
                      back(2);
                    },
                  },
                )}
                className="w-full py-4 text-(--app-title-text-size-16) font-bold text-red-500 active:bg-(--app-c-tw-bg-gray-50) bg-app-surface border-b border-(--app-c-tw-border-gray-50)"
              >
                {s.bookshelf_remove_modal_confirm}
              </button>
              <button
                {...bindBack<HTMLButtonElement>()}
                className="w-full py-4 text-(--app-title-text-size-16) font-bold text-(--app-c-tw-text-gray-800) active:bg-(--app-c-tw-bg-gray-50) bg-app-surface"
              >
                {s.common_cancel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BookshelfPage;
