import React, { useMemo } from 'react';
import { IcNavBackArrow, IcEye, IcUser, IcHeart, IcShareAlt } from '../res/icons';
import { dimens } from '../res/dimens';
import { useLocation, useSearchParams } from 'react-router-dom';
import { getWechatReadingBookById, useWechatReadingStore, selectHomeFinishedBookIds } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import {
    formatWechatReadingDuration,
    formatWechatReadingMessage,
    localizeWechatReadingGender,
    localizeWechatReadingVisibility,
    quoteWechatReadingTitle,
} from '../utils/localization';

const MyProfilePage: React.FC = () => {
    const user = useWechatReadingStore(s => s.user);
    const shelf = useWechatReadingStore(s => s.shelf);
    const settings = useWechatReadingStore(s => s.settings);
    const readingRecords = useWechatReadingStore(s => s.readingRecords);
    const homeFinishedBookIds = useWechatReadingStore(selectHomeFinishedBookIds);
    const { bindBack, bindTap, go } = useWechatReadingGestures();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const locale = useLocale();
    const s = useWechatReadingStrings();

    const activeCardTab = (searchParams.get('tab') || 'shelf') as 'shelf' | 'finished';
    const canShowFinishedTab = homeFinishedBookIds.length > 0;
    const effectiveTab: 'shelf' | 'finished' = canShowFinishedTab ? activeCardTab : 'shelf';

    React.useEffect(() => {
        if (location.pathname !== '/my-profile') return;
        const raw = new URLSearchParams(location.search).get('tab');
        const valid = raw === 'shelf' || raw === 'finished';
        if (!valid) {
            go('myProfile.tab.switch', { tab: 'shelf' });
            return;
        }
        if (raw === 'finished' && !canShowFinishedTab) {
            go('myProfile.tab.switch', { tab: 'shelf' });
        }
    }, [location.pathname, location.search, canShowFinishedTab, go]);

    const totalReadingMinutes = useMemo(
        () => readingRecords.reduce((sum, record) => sum + record.duration, 0),
        [readingRecords],
    );

    const stats = useMemo(() => {
        const publicShelf = shelf.filter(item => !item.isPrivate);
        const finishedBooks = homeFinishedBookIds
            .map(id => getWechatReadingBookById(id))
            .filter(Boolean);

        return {
            publicShelf,
            finishedBooks,
            finishedCount: finishedBooks.length,
        };
    }, [shelf, homeFinishedBookIds]);

    const displayBooks = useMemo(() => {
        if (effectiveTab === 'shelf') {
            return stats.publicShelf
                .slice(0, 3)
                .map(item => getWechatReadingBookById(item.bookId))
                .filter(Boolean);
        }
        return homeFinishedBookIds
            .slice(0, 3)
            .map(id => getWechatReadingBookById(id))
            .filter(Boolean);
    }, [effectiveTab, stats.publicShelf, homeFinishedBookIds]);

    const visibilityLabel = settings.privacy.profile.visibility
        ? localizeWechatReadingVisibility(settings.privacy.profile.visibility, s)
        : s.my_profile_followers_visible;

    return (
        <div data-scroll-container="main" data-scroll-direction="vertical" className="flex flex-col h-full bg-app-bg font-sans overflow-y-auto no-scrollbar pb-10">
            <div className="flex items-center justify-between px-4 pt-10 pb-2 relative z-10">
                <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-2 active:opacity-60">
                    <IcNavBackArrow size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </button>

                <div className="flex flex-col items-center">
                    <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-800) leading-tight">{s.my_profile_title}</span>
                    <span className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-400) leading-tight mt-0.5">{visibilityLabel}</span>
                </div>

                <div className="flex gap-2">
                    <button
                        className="p-2 active:opacity-60"
                        {...bindTap<HTMLButtonElement>('settings.privacy.profile.open')}
                    >
                        <IcEye size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
                    </button>
                    <button className="p-2 active:opacity-60">
                        <IcShareAlt size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
                    </button>
                </div>
            </div>

            <div className="flex flex-col items-center pt-8 px-6">
                <div className="w-24 h-24 rounded-full bg-app-surface shadow-sm overflow-hidden mb-5 border-4 border-white">
                    {user.avatar ? (
                        <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                        <div className="w-full h-full bg-(--app-c-tw-bg-gray-100) flex items-center justify-center">
                            <IcUser size={dimens.icSizePlaceholder} className="text-(--app-c-tw-text-slate-200)" />
                        </div>
                    )}
                </div>

                <h1
                    className="text-2xl font-black text-(--app-c-tw-text-slate-900) mb-3 active:opacity-60 cursor-pointer"
                    {...bindTap<HTMLHeadingElement>('profile.edit.open')}
                >
                    {user.name}
                </h1>

                {user.gender && (
                    <div className="px-3 py-0.5 bg-(--app-c-tw-bg-gray-200)/50 rounded-full text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-400) font-bold mb-4">
                        {localizeWechatReadingGender(user.gender, s)}
                    </div>
                )}

                <div className="text-sm text-(--app-c-tw-text-slate-400) flex items-center gap-1 mb-8 h-5">
                    {user.introduction || user.signature ? (
                        <>
                            {user.introduction && <span>{user.introduction}</span>}
                            {user.introduction && user.signature && <span className="mx-1 text-(--app-c-tw-text-slate-200)">|</span>}
                            {user.signature && <span>{user.signature}</span>}
                        </>
                    ) : (
                        <span></span>
                    )}
                </div>

                <div className="w-full grid grid-cols-3 gap-0 mb-10">
                    <div
                        className="flex flex-col items-center border-r border-(--app-c-tw-border-gray-100) active:opacity-60 cursor-pointer"
                        {...bindTap<HTMLDivElement>('myReading.open.total')}
                    >
                        <span className="text-xl font-black text-(--app-c-tw-text-slate-900)">{formatWechatReadingDuration(totalReadingMinutes, locale)}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-1 font-bold">{s.my_profile_reading_duration}</span>
                    </div>
                    <div className="flex flex-col items-center border-r border-(--app-c-tw-border-gray-100)">
                        <span className="text-xl font-black text-(--app-c-tw-text-slate-900)">{user.likesCount}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-1 font-bold">{s.my_profile_likes_received}</span>
                    </div>
                    <div
                        className="flex flex-col items-center active:opacity-60 cursor-pointer"
                        {...bindTap<HTMLDivElement>('following.open.followers')}
                    >
                        <span className="text-xl font-black text-(--app-c-tw-text-slate-900)">{user.followerCount}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-1 font-bold">{s.my_profile_followers}</span>
                    </div>
                </div>

                <div className="w-full bg-app-surface rounded-[28px] overflow-hidden shadow-sm">
                    <div className="flex border-b border-(--app-c-tw-border-gray-50)">
                        <div
                            className="flex-1 py-4 flex flex-col items-center relative cursor-pointer"
                            {...bindTap<HTMLDivElement>('myProfile.tab.switch', { params: { tab: 'shelf' } })}
                        >
                            <span className={`text-base font-black ${activeCardTab === 'shelf' ? 'text-app-primary' : 'text-(--app-c-tw-text-slate-300)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>{s.my_profile_tab_shelf}</span>
                            {effectiveTab === 'shelf' && <div className="absolute bottom-0 w-6 h-0.5 bg-app-primary rounded-full"></div>}
                        </div>
                        {canShowFinishedTab && (
                            <div
                                className="flex-1 py-4 flex items-center justify-center gap-1 cursor-pointer relative"
                                {...bindTap<HTMLDivElement>('myProfile.tab.switch', { params: { tab: 'finished' } })}
                            >
                                <span className={`text-base font-black ${effectiveTab === 'finished' ? 'text-app-primary' : 'text-(--app-c-tw-text-slate-300)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>{s.my_profile_tab_finished}</span>
                                <span className={`text-xs font-bold mt-1 ${effectiveTab === 'finished' ? 'text-app-primary' : 'text-(--app-c-tw-text-slate-300)'}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>· {stats.finishedCount}</span>
                                {effectiveTab === 'finished' && <div className="absolute bottom-0 w-6 h-0.5 bg-app-primary rounded-full"></div>}
                            </div>
                        )}
                    </div>

                    <div className="p-5">
                        <div className="flex items-center justify-between mb-5">
                            <span className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-400) font-bold">
                                {formatWechatReadingMessage(s.my_profile_recent_activity, quoteWechatReadingTitle('活着', locale))}
                            </span>
                            <IcHeart size={dimens.icSizeChevron} className="text-(--app-c-tw-text-slate-300)" />
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-6 min-h-(--app-my-profile-page-height-140)">
                            {displayBooks.length > 0 ? (
                                displayBooks.map((book: any, idx) => (
                                    <div
                                        key={idx}
                                        className="flex flex-col gap-2 active:opacity-60"
                                        {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
                                    >
                                        <div className={`aspect-[3/4] ${book.coverColor || 'bg-(--app-c-tw-bg-gray-100)'} rounded shadow-sm overflow-hidden relative border border-black/5`}>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                                                <span className={`${book.coverColor === 'bg-app-surface' ? 'text-(--app-c-tw-text-slate-800)' : 'text-white'} text-(--app-title-text-size-9) font-bold leading-tight drop-shadow-sm`}>
                                                    {book.title}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-(--app-title-text-size-11) font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">{book.title}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-3 flex items-center justify-center py-10 text-(--app-c-tw-text-slate-300) text-sm font-bold">
                                    {s.my_profile_no_books}
                                </div>
                            )}
                        </div>

                        <button
                            className="w-full py-4 bg-app-bg rounded-2xl text-(--app-settings-item-text-size) font-black text-(--app-c-tw-text-slate-600) active:bg-(--app-c-tw-bg-gray-200)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                            {...(effectiveTab === 'shelf'
                                ? bindTap<HTMLButtonElement>('user.shelf.open', { params: { userId: user.id } })
                                : bindTap<HTMLButtonElement>('readingList.open.finished'))}
                        >
                            {effectiveTab === 'shelf' ? s.my_profile_view_shelf : s.my_profile_view_all}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyProfilePage;
