import React from 'react';
import { IcNavBack, IcSearch, IcCheckCircle2, IcNavForward } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingStore } from '../state';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useLocation, useSearchParams } from 'react-router-dom';
import { WechatReadingWechatBubbleIcon } from '../res/icons';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { formatWechatReadingMessage } from '../utils/localization';

export const FollowingPage: React.FC = () => {
    const user = useWechatReadingStore(s => s.user);
    const toggleFollow = useWechatReadingStore(s => s.toggleFollow);
    const isFollowing = (uid: string) => user.following.includes(uid);
    const { bindBack, bindTap, go } = useWechatReadingGestures();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const s = useWechatReadingStrings();

    const activeTab = (searchParams.get('tab') as 'following' | 'followers') || 'following';

    // Keep URL aligned with declared uiStates: /following?tab=following|followers
    React.useEffect(() => {
        if (location.pathname !== '/following') return;
        if (activeTab !== 'following' && activeTab !== 'followers') {
            go('following.tab.switch', { tab: 'following' });
            return;
        }
        if (!searchParams.get('tab')) {
            go('following.tab.switch', { tab: 'following' });
        }

    }, [location.pathname]);

    const followedUsers = WECHAT_READING_CONFIG.users.filter(u => user.following.includes(u.id));
    const followingCountLabel = formatWechatReadingMessage(s.following_count, followedUsers.length);

    return (
        <div className="flex flex-col h-full bg-app-surface relative">
            {/* Header */}
            <div className="pt-10 pb-2 px-4 flex items-center justify-between border-b border-(--app-c-tw-border-gray-50) bg-app-surface/95 backdrop-blur-sm sticky top-0 z-40">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2">
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </button>

                <div className="flex bg-(--app-c-tw-bg-gray-100) rounded-lg p-0.5">
                    <button
                        {...bindTap<HTMLButtonElement>('following.tab.switch', { params: { tab: 'following' } })}
                        className={`px-4 py-1 rounded-md text-sm font-medium ${activeTab === 'following' ? 'bg-app-surface text-(--app-c-tw-text-slate-900) shadow-sm' : 'text-(--app-c-tw-text-slate-500)'}`} style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
                    >
                        {s.following_tab_following}
                    </button>
                    <button
                        {...bindTap<HTMLButtonElement>('following.tab.switch', { params: { tab: 'followers' } })}
                        className={`px-4 py-1 rounded-md text-sm font-medium ${activeTab === 'followers' ? 'bg-app-surface text-(--app-c-tw-text-slate-900) shadow-sm' : 'text-(--app-c-tw-text-slate-500)'}`} style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
                    >
                        {s.following_tab_followers}
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <button className="p-2 text-(--app-c-tw-text-slate-800)">
                        <IcSearch size={dimens.icSizeToolbar} />
                    </button>
                    <button className="p-2 text-(--app-c-tw-text-slate-800)">
                        <IcCheckCircle2 size={dimens.icSizeToolbar} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar">
                {activeTab === 'following' ? (
                    <div className="flex flex-col">
                        {/* WeChat Friends Row */}
                        <div
                            className="px-5 py-4 flex items-center justify-between active:bg-(--app-c-tw-bg-gray-50)"
                            style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                            {...bindTap<HTMLDivElement>('wechatFriends.open')}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-(--app-c-following-page-bg-07c1) rounded-full flex items-center justify-center">
                                    <WechatReadingWechatBubbleIcon className="text-white fill-current" />
                                </div>
                                <span className="text-base font-medium text-(--app-c-tw-text-slate-800)">{s.following_wechat_friends}</span>
                            </div>
                            <IcNavForward size={dimens.icSizeNav} className="text-(--app-c-tw-text-slate-300)" />
                        </div>

                        <div className="h-2 bg-(--app-c-tw-bg-gray-50) border-y border-(--app-c-tw-border-gray-100) mt-2"></div>

                        <div className="px-5 py-4">
                            <span className="text-sm font-medium text-(--app-c-tw-text-slate-400)">{followingCountLabel}</span>
                        </div>

                        {followedUsers.map(targetUser => (
                            <div
                                key={targetUser.id}
                                className="px-5 py-3 flex items-center justify-between active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                                {...bindTap<HTMLDivElement>('user.profile.open', { params: { userId: targetUser.id } })}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full overflow-hidden border border-(--app-c-tw-border-gray-100) shrink-0">
                                        <img src={targetUser.avatar} alt={targetUser.name} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-base font-bold text-(--app-c-tw-text-slate-800)">{targetUser.name}</span>
                                </div>

                                <button
                                    {...bindTap<HTMLButtonElement>(
                                        { kind: 'action', id: 'following.item.unfollow.toggle' },
                                        {
                                            params: { userId: targetUser.id },
                                            stopPropagation: true,
                                            onTrigger: () => toggleFollow(targetUser.id),
                                        },
                                    )}
                                    className="px-4 py-1.5 rounded-full border border-app-border text-sm font-medium text-(--app-c-tw-text-slate-500) bg-(--app-c-tw-bg-gray-50) flex items-center gap-1"
                                >
                                    <span className="text-xs">✓</span> {s.following_status_followed}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-20 text-(--app-c-tw-text-slate-400)">
                        <span className="text-sm">{s.following_no_followers}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
