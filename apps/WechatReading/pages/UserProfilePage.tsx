import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { IcNavBack, IcMail, IcShareAlt, IcMore, IcHeart } from '../res/icons';
import { dimens } from '../res/dimens';
import { getWechatReadingBookById, getWechatReadingUserById, useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { BADGE_COLOR_MAP } from '../constants';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import {
    formatWechatReadingDuration,
    formatWechatReadingMessage,
    localizeWechatReadingGender,
    quoteWechatReadingTitle,
} from '../utils/localization';

export const UserProfilePage: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();
    const currentUser = useWechatReadingStore(s => s.user);
    const userFollowing = useWechatReadingStore(s => s.user.following);
    const toggleFollow = useWechatReadingStore(s => s.toggleFollow);
    const isFollowing = (uid: string) => userFollowing.includes(uid);
    const { bindBack, bindTap, back } = useWechatReadingGestures();
    const locale = useLocale();
    const s = useWechatReadingStrings();

    const targetUser = getWechatReadingUserById(currentUser, userId || '');
    const isMe = userId === 'user_me' || userId === currentUser.id;
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const showUnfollowModal = searchParams.get('modal') === 'unfollow_confirm';

    if (!targetUser) return <div>User not found</div>;

    return (
        <div data-scroll-container="main" data-scroll-direction="vertical" className="flex flex-col h-full bg-app-bg relative overflow-y-auto no-scrollbar">
            <div className="pt-10 pb-2 px-4 flex items-center justify-between sticky top-0 z-40 bg-app-surface/0">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2">
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </button>

                <div className="flex-1 flex flex-col items-center">
                    <span className="text-sm font-bold text-(--app-c-tw-text-slate-800) opacity-0 h-0" style={{ transition: 'opacity var(--app-duration-medium) var(--app-easing-standard)' }}>{targetUser.name}</span>
                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) opacity-0 h-0" style={{ transition: 'opacity var(--app-duration-medium) var(--app-easing-standard)' }}>{s.user_profile_personal_page}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-(--app-c-tw-text-slate-800)">
                        <IcMail size={dimens.icSizeToolbar} />
                    </button>
                    <button className="p-2 text-(--app-c-tw-text-slate-800)">
                        <IcShareAlt size={dimens.icSizeToolbar} />
                    </button>
                    <button className="p-2 text-(--app-c-tw-text-slate-800)">
                        <IcMore size={dimens.icSizeToolbar} />
                    </button>
                </div>
            </div>

            <div className="px-6 flex flex-col items-center pt-2 pb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-md relative mb-4">
                    <img src={targetUser.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt={targetUser.name} className="w-full h-full object-cover" />
                </div>

                <h1 className="text-2xl font-black text-(--app-c-tw-text-slate-900) mb-2">{targetUser.name}</h1>

                <div className="flex items-center gap-2 mb-6">
                    {targetUser.gender && (
                        <span className="px-3 py-0.5 bg-(--app-c-tw-bg-gray-200)/50 rounded-full text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) font-medium">
                            {localizeWechatReadingGender(targetUser.gender, s)}
                        </span>
                    )}
                    {targetUser.isWechatFriend && (
                        <span className="px-3 py-0.5 bg-(--app-c-tw-bg-gray-200)/50 rounded-full text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) font-medium">
                            {s.user_profile_wechat_friend}
                        </span>
                    )}
                </div>

                <div className="w-full grid grid-cols-3 gap-4 mb-8">
                    <div className="flex flex-col items-center border-r border-(--app-c-tw-border-gray-100)">
                        <span className="text-lg font-bold text-(--app-c-tw-text-slate-900)">{formatWechatReadingDuration(targetUser.readingTimeMinutes, locale)}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-1">{s.user_profile_reading_duration}</span>
                    </div>
                    <div className="flex flex-col items-center border-r border-(--app-c-tw-border-gray-100)">
                        <span className="text-lg font-bold text-(--app-c-tw-text-slate-900)">{targetUser.likesCount}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-1">{s.user_profile_likes_received}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-(--app-c-tw-text-slate-900)">{targetUser.followerCount}</span>
                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-1">{s.user_profile_followers}</span>
                    </div>
                </div>

                {!isMe && (
                    (() => {
                        const following = isFollowing(targetUser.id);
                        const followButtonProps = following
                            ? bindTap<HTMLButtonElement>('user.modal.unfollow.open', { params: { userId: targetUser.id } })
                            : bindTap<HTMLButtonElement>(
                                { kind: 'action', id: 'userProfile.item.follow.toggle' },
                                { params: { userId: targetUser.id }, onTrigger: () => toggleFollow(targetUser.id) },
                              );

                        return (
                            <button
                                {...followButtonProps}
                                className={`w-full py-3.5 rounded-xl font-bold shadow-sm ${following
                                    ? 'bg-(--app-c-tw-bg-gray-100) text-(--app-c-tw-text-slate-500)'
                                    : 'bg-app-surface text-app-primary'
                                    }`}
                                style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
                            >
                                {following ? `✓ ${s.user_profile_followed}` : `+ ${s.user_profile_follow}`}
                            </button>
                        );
                    })()
                )}
            </div>

            <div className="mx-4 mb-4 bg-app-surface rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-black text-(--app-c-tw-text-slate-900)">{s.user_profile_badges_title}</h2>
                    <span className="text-xs text-(--app-c-tw-text-slate-400) font-medium">{s.user_profile_badges_count} &gt;</span>
                </div>
                <div className="flex items-center justify-around">
                    {targetUser.badges && targetUser.badges.slice(0, 4).map((badge: any) => (
                        <div key={badge.id} className="flex flex-col items-center gap-2 max-w-(--app-item-width-64)">
                            <div className={`w-14 h-14 ${BADGE_COLOR_MAP[badge.type] ?? 'bg-gray-100 text-gray-600'} rounded-full flex flex-col items-center justify-center p-2 text-center`}>
                                <span className="text-(--app-tab-bar-label-size) font-black leading-tight mb-0.5">{badge.value}</span>
                                <span className="text-(--app-item-text-size-8) opacity-70 scale-90 leading-tight">{badge.type}</span>
                            </div>
                            <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) font-medium text-center truncate w-full">{badge.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mx-4 mb-20 bg-app-surface rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-black text-(--app-c-tw-text-slate-900)">{s.user_profile_bookshelf_title}</h2>
                    <IcHeart size={dimens.icSizeAction} className="text-(--app-c-tw-text-slate-300)" />
                </div>

                <p className="text-xs text-(--app-c-tw-text-slate-400) mb-6">
                    {formatWechatReadingMessage(s.user_profile_recent_activity, quoteWechatReadingTitle('枪炮、病菌与钢铁：人类社会...', locale))}
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    {targetUser.recentBooks && targetUser.recentBooks.map((bookId: string) => {
                        const book = getWechatReadingBookById(bookId);
                        if (!book) return null;
                        return (
                            <div
                                key={book.id}
                                className="flex flex-col gap-2 cursor-pointer active:opacity-60"
                                {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
                            >
                                <div className={`aspect-[3/4] ${book.coverColor || 'bg-(--app-c-tw-bg-slate-200)'} rounded shadow-sm flex items-center justify-center text-center p-2`}>
                                    <span className="text-white text-(--app-tab-bar-label-size) font-bold leading-tight drop-shadow-sm">{book.title}</span>
                                </div>
                                <span className="text-(--app-tab-bar-label-size) font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">{book.title}</span>
                            </div>
                        );
                    })}
                </div>

                <button
                    className="w-full py-3 bg-(--app-c-tw-bg-gray-50) rounded-xl text-sm font-bold text-(--app-c-tw-text-slate-600) active:bg-(--app-c-tw-bg-gray-100)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                    {...bindTap<HTMLButtonElement>('user.shelf.open', { params: { userId: targetUser.id } })}
                >
                    {s.user_profile_view_shelf}
                </button>
            </div>

            {showUnfollowModal && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-[100] animate-in fade-in" style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }} {...bindBack()} />
                    <div className="fixed bottom-0 left-0 right-0 bg-(--app-c-user-profile-page-bg-f7f7) rounded-t-[32px] z-[110] animate-slide-up shadow-2xl overflow-hidden pb-safe">
                        <div className="bg-app-surface px-6 py-8 flex flex-col items-center text-center">
                            <p className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-600) leading-normal max-w-(--app-modal-width-260)">
                                {s.user_profile_unfollow_desc}
                            </p>
                        </div>

                        <div className="mt-2 flex flex-col bg-app-surface">
                            <button
                                {...bindTap<HTMLButtonElement>(
                                    { kind: 'action', id: 'userProfile.item.unfollow.submit' },
                                    {
                                        params: { userId: targetUser.id },
                                        onTrigger: () => {
                                            toggleFollow(targetUser.id);
                                            back();
                                        },
                                    },
                                )}
                                className="w-full py-5 text-(--app-modal-action-text-size) font-bold text-(--app-c-user-profile-page-text-ff3b) active:bg-(--app-c-tw-bg-slate-50) border-b border-(--app-c-tw-border-slate-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                            >
                                {s.user_profile_unfollow}
                            </button>
                            <button
                                {...bindBack<HTMLButtonElement>()}
                                className="w-full py-5 text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-900) active:bg-(--app-c-tw-bg-slate-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                            >
                                {s.user_profile_close}
                            </button>
                        </div>
                        <div className="h-2 bg-(--app-c-user-profile-page-bg-f7f7)"></div>
                    </div>
                </>
            )}
        </div>
    );
};
