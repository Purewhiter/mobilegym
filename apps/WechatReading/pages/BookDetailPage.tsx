import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
    IcNavBack,
    IcMore,
    IcShare,
    IcUser,
    IcSparkles,
} from '../res/icons';
import { dimens } from '../res/dimens';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { WechatReadingDownloadIcon, WechatReadingFolderIcon, WechatReadingBookshelfIcon } from '../res/icons';
import { AppNavigatorRegistry } from '../../../os/AppNavigatorRegistry';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import {
    formatWechatReadingCount,
    formatWechatReadingWords,
    quoteWechatReadingTitle,
} from '../utils/localization';

export const BookDetailPage: React.FC = () => {
    const { bookId } = useParams();
    const location = useLocation();
    const addToBookshelf = useWechatReadingStore(s => s.addToBookshelf);
    const removeFromShelf = useWechatReadingStore(s => s.removeFromShelf);
    const shelf = useWechatReadingStore(s => s.shelf);
    const [book, setBook] = useState<any>(null);
    const { bindBack, bindTap, back } = useWechatReadingGestures();
    const locale = useLocale();
    const s = useWechatReadingStrings();

    const searchParams = new URLSearchParams(location.search);
    const showShelfModal = searchParams.get('modal') === 'shelf';

    useEffect(() => {
        const found = WECHAT_READING_CONFIG.store.find(b => b.id === bookId);
        if (found) {
            setBook(found);
            return;
        }

        const audio = WECHAT_READING_CONFIG.audiobooks.find(b => b.id === bookId);
        if (audio) {
            setBook({
                ...audio,
                totalReads: audio.plays,
                totalWords: 0,
                recommendedValue: parseFloat(audio.rating.replace('%', '')),
                isAudio: true,
            });
        }
    }, [bookId]);

    useEffect(() => {
        const handleBack = () => {
            const isModalOpen = new URLSearchParams(location.search).get('modal') === 'shelf';
            if (isModalOpen) {
                back();
                return true;
            }
            back();
            return true;
        };

        AppNavigatorRegistry.setBackOverride('wechat_reading', handleBack);
        return () => {
            AppNavigatorRegistry.setBackOverride('wechat_reading');
        };
    }, [back, location.search]);

    const isInShelf = shelf.some(item => item.bookId === bookId);

    if (!book) return <div className="w-full h-full bg-(--app-c-tw-bg-slate-50)" />;

    const introText = locale === 'en'
        ? `${quoteWechatReadingTitle(book.title, locale)} is a representative work by ${book.author}, following a life shaped by hardship, loss, and endurance.`
        : (book.intro ?? '');

    const reviewSnippet = locale === 'en'
        ? `${quoteWechatReadingTitle(book.title, locale)} follows one person's life through repeated upheaval and quiet resilience, which is what makes it hit so hard.`
        : (book.content?.split('\n\n')[0] ?? book.intro ?? '');

    const extraTags = [
        `${s.book_detail_tag_tragic_figures}${locale === 'en' ? ' (863)' : '(863)'}`,
        `${s.book_detail_tag_tears}${locale === 'en' ? ' (408)' : '(408)'}`,
        `${s.book_detail_tag_plain_prose}${locale === 'en' ? ' (320)' : '(320)'}`,
    ];

    return (
        <div className="w-full h-full bg-(--app-c-book-detail-page-bg-fafa) flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 pt-12 bg-transparent z-10">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2 text-(--app-c-tw-text-gray-700) active:opacity-60">
                    <IcNavBack size={dimens.book_detail_nav_back_icon_size} />
                </button>
                <div className="flex gap-4 text-(--app-c-tw-text-gray-700)">
                    <button className="p-1"><span className="text-xs font-bold border border-(--app-c-tw-border-gray-700)/30 rounded px-1">{s.book_detail_paid}</span></button>
                    <button className="p-1"><span className="text-base font-bold">{s.book_detail_listen}</span></button>
                    <button className="p-1 flex items-center gap-0.5"><IcUser size={dimens.icSizeNav} /><span className="text-xs scale-75">2949</span></button>
                    <button className="p-1"><IcShare size={dimens.icSizeToolbar} /></button>
                    <button className="p-1"><IcMore size={dimens.icSizeToolbar} /></button>
                </div>
            </div>

            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar pb-24">
                <div className="px-4 pt-4">
                    <div className="flex gap-5 mb-8">
                        <div className={`w-28 aspect-[2/3] shrink-0 rounded shadow-md relative overflow-hidden ${book.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}>
                            {book.cover ? (
                                <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 p-3 flex flex-col items-center justify-center text-center">
                                    <span className="text-sm font-bold opacity-90 text-(--app-c-tw-text-slate-900)">{book.title}</span>
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) mt-1">{book.author}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 flex flex-col pt-1">
                            <h1 className="text-2xl font-bold text-(--app-c-tw-text-gray-900) font-serif mb-1">{book.title}</h1>
                            <div className="text-(--app-c-tw-text-blue-500) text-sm mb-3 font-medium">{book.author} &gt;</div>

                            <div className="inline-flex items-center bg-blue-100/50 rounded-r-full pl-0 pr-3 py-1 mb-3 self-start -ml-1">
                                <span className="bg-(--app-c-tw-bg-blue-500) text-white text-(--app-tab-bar-label-size) font-bold px-1.5 py-0.5 rounded-sm ml-1">TOP 200</span>
                                <span className="text-(--app-c-tw-text-blue-500) text-(--app-tab-bar-label-size) ml-1 font-bold">{s.book_detail_top_chart}</span>
                            </div>

                            <p className="text-xs text-(--app-c-tw-text-gray-500) leading-relaxed line-clamp-3">
                                {introText}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between items-start mb-8 px-2">
                        <div className="flex flex-col items-center flex-1">
                            <div className="text-xs text-(--app-c-tw-text-gray-400) mb-1">{book.isAudio ? s.book_detail_stat_listening : s.book_detail_stat_reading}</div>
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">
                                {formatWechatReadingCount(book.totalReads, locale)}
                                {book.isAudio ? s.book_detail_stat_times : s.book_detail_stat_person}
                            </div>
                            {!book.isAudio && <div className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) mt-1">{s.book_detail_friends_reading}</div>}
                        </div>
                        <div className="w-(--app-comp-header-width-1) h-8 bg-(--app-c-tw-bg-gray-200) mt-2" />
                        <div className="flex flex-col items-center flex-1">
                            <div className="text-xs text-(--app-c-tw-text-gray-400) mb-1">{book.isAudio ? s.book_detail_my_listening : s.book_detail_my_reading}</div>
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">
                                {locale === 'en' ? `12 ${s.common_minutes_unit}` : `12${s.common_minutes_unit}`}
                            </div>
                            <div className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) mt-1 flex items-center gap-0.5">
                                <span>👉 {book.isAudio ? s.book_detail_currently_listening : s.book_detail_currently_reading}</span>
                            </div>
                        </div>
                        <div className="w-(--app-comp-header-width-1) h-8 bg-(--app-c-tw-bg-gray-200) mt-2" />
                        <div className="flex flex-col items-center flex-1">
                            <div className="text-xs text-(--app-c-tw-text-gray-400) mb-1">{book.isAudio ? s.book_detail_rating : s.book_detail_word_count}</div>
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">{book.isAudio ? book.rating : formatWechatReadingWords(book.totalWords, locale)}</div>
                            {!book.isAudio && <div className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) mt-1">{s.book_detail_published_date}</div>}
                        </div>
                    </div>

                    <div className="bg-app-surface rounded-xl p-5 shadow-sm mb-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">{s.book_detail_weread_recommendation} {book.recommendedValue}%</div>
                            <button className="text-xs font-medium text-(--app-c-tw-text-gray-500) border border-app-border rounded-full px-3 py-1">{s.book_detail_write_review}</button>
                        </div>

                        <div className="flex items-center gap-4 mb-5">
                            {book.masterpiece && (
                                <div className="flex items-center gap-1">
                                    <span className="text-(--app-c-book-detail-page-text-d1a0) text-2xl font-bold font-serif">{s.book_detail_masterpiece}</span>
                                    <div className="text-(--app-c-book-detail-page-text-d1a0) transform rotate-45 border-l-2 border-b-2 border-(--app-c-book-detail-page-border-d1a0) w-2.5 h-2.5 ml-0.5 mt-1" />
                                </div>
                            )}

                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) w-16 text-right">{s.book_detail_recommend}</span>
                                    <div className="flex-1 h-1.5 bg-(--app-c-tw-bg-gray-100) rounded-full overflow-hidden">
                                        <div className="h-full bg-(--app-c-tw-bg-gray-500) w-[92%] rounded-full" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) w-16 text-right">{s.book_detail_average}</span>
                                    <div className="flex-1 h-1.5 bg-(--app-c-tw-bg-gray-100) rounded-full overflow-hidden">
                                        <div className="h-full bg-(--app-c-tw-bg-gray-300) w-[6%] rounded-full" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) w-16 text-right">{s.book_detail_not_recommend}</span>
                                    <div className="flex-1 h-1.5 bg-(--app-c-tw-bg-gray-100) rounded-full overflow-hidden">
                                        <div className="h-full bg-(--app-c-tw-bg-gray-200) w-[1%] rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_tag_all}({formatWechatReadingCount(book.totalReviews, locale)})</span>
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_recommend}({formatWechatReadingCount(book.reviewBreakdown?.recommended, locale)})</span>
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_average}({formatWechatReadingCount(book.reviewBreakdown?.average, locale)})</span>
                            {extraTags.map(tag => (
                                <span key={tag} className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{tag}</span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-app-surface rounded-xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 overflow-hidden">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=smile`} alt="avatar" className="w-full h-full" />
                            </div>
                            <span className="text-xs font-bold text-(--app-c-tw-text-gray-700)">smile</span>
                            <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) border border-app-border rounded px-1">☺ {s.book_detail_recommend}</span>
                        </div>
                        <p className="text-sm text-(--app-c-tw-text-gray-700) leading-relaxed font-serif">
                            {reviewSnippet}
                        </p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 h-16 bg-app-surface border-t border-(--app-c-tw-border-gray-100) flex items-center px-4 gap-4 z-20 pb-safe">
                <button className="w-12 h-10 bg-(--app-c-tw-bg-gray-100) rounded-lg flex items-center justify-center text-(--app-c-tw-text-gray-600)">
                    <IcSparkles size={dimens.icSizeNav} />
                </button>
                {(() => {
                    const shelfButtonProps = isInShelf
                        ? bindTap<HTMLButtonElement>('book.modal.shelf.open', { params: { bookId: bookId! } })
                        : bindTap<HTMLButtonElement>(
                            { kind: 'action', id: 'bookDetail.item.shelf.add.submit' },
                            { params: { bookId: bookId! }, onTrigger: () => addToBookshelf(bookId!) },
                          );
                    return (
                        <button
                            {...shelfButtonProps}
                            className={`flex-1 h-10 rounded-lg font-bold text-sm ${isInShelf
                                ? 'bg-(--app-c-tw-bg-gray-100) text-(--app-c-tw-text-gray-400)'
                                : 'bg-(--app-c-tw-bg-gray-100) text-(--app-c-tw-text-gray-800)'
                                }`}
                            style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        >
                            {isInShelf ? s.book_detail_added_to_shelf : s.book_detail_add_to_shelf}
                        </button>
                    );
                })()}
                <button
                    className="flex-1 h-10 bg-app-primary rounded-lg text-white font-bold text-sm active:bg-blue-600" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                    {...bindTap<HTMLButtonElement>('reader.open', { params: { bookId: bookId! } })}
                >
                    {s.book_detail_read_button}
                </button>
            </div>

            {showShelfModal && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-40" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }} {...bindBack()} />
                    <div className="fixed bottom-0 left-0 right-0 bg-(--app-c-book-detail-page-bg-f7f7) rounded-t-2xl z-50 animate-slide-up overflow-hidden pb-safe">
                        <div className="flex flex-col">
                            <button className="flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-[1px]">
                                <div className="w-6 flex justify-center"><IcUser size={dimens.icSizeNav} className="text-(--app-c-tw-text-gray-600)" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-gray-800)">{s.book_detail_shelf_modal_private}</span>
                            </button>
                            <button className="flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-[1px]">
                                <div className="w-6 flex justify-center"><WechatReadingDownloadIcon className="text-(--app-c-tw-text-gray-600)" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-gray-800)">{s.book_detail_shelf_modal_download}</span>
                            </button>
                            <button className="flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-[1px]">
                                <div className="w-6 flex justify-center"><WechatReadingFolderIcon className="text-(--app-c-tw-text-gray-600)" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-gray-800)">{s.book_detail_shelf_modal_move}</span>
                            </button>
                            <button
                                {...bindTap<HTMLButtonElement>(
                                    { kind: 'action', id: 'bookDetail.item.shelf.remove.submit' },
                                    {
                                        params: { bookId: bookId! },
                                        onTrigger: () => {
                                            removeFromShelf(bookId!);
                                            back();
                                        },
                                    },
                                )}
                                className="flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-2"
                            >
                                <div className="w-6 flex justify-center"><WechatReadingBookshelfIcon className="text-red-500" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-red-500">{s.book_detail_shelf_modal_remove}</span>
                            </button>

                            <button
                                {...bindBack<HTMLButtonElement>()}
                                className="w-full py-4 bg-app-surface text-center text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-gray-800) active:bg-(--app-c-tw-bg-gray-50)"
                            >
                                {s.book_detail_shelf_modal_cancel}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
