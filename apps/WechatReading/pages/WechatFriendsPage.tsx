import React from 'react';
import { IcNavBack, IcCheckCircle2 } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingStore } from '../state';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { formatWechatReadingMessage } from '../utils/localization';

function formatReadingTime(minutes: number, s: ReturnType<typeof useWechatReadingStrings>): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = hours > 0
        ? formatWechatReadingMessage(s.wechat_friends_reading_hours_minutes, hours, mins)
        : formatWechatReadingMessage(s.wechat_friends_reading_minutes, mins);
    return formatWechatReadingMessage(s.wechat_friends_reading_time, timeStr);
}

export const WechatFriendsPage: React.FC = () => {
    const user = useWechatReadingStore(s => s.user);
    const toggleFollow = useWechatReadingStore(s => s.toggleFollow);
    const { bindBack, bindTap } = useWechatReadingGestures();
    const s = useWechatReadingStrings();

    const wechatFriends = WECHAT_READING_CONFIG.users.filter(
        (u: any) => u.isWechatFriend && u.id !== user.id,
    );

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header */}
            <div className="pt-10 pb-2 px-4 flex items-center justify-between border-b border-(--app-c-tw-border-gray-50) bg-white sticky top-0 z-40">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2">
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </button>
                <span className="text-base font-medium text-(--app-c-tw-text-slate-900)">
                    {s.wechat_friends_title}
                </span>
                <button className="p-2 -mr-2 flex items-center gap-1 text-(--app-c-tw-text-slate-600)">
                    <IcCheckCircle2 size={16} />
                    <span className="text-sm">{s.wechat_friends_select}</span>
                </button>
            </div>

            {/* Friend List */}
            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar">
                {wechatFriends.map((friend: any) => {
                    const isFollowing = user.following.includes(friend.id);
                    return (
                        <div
                            key={friend.id}
                            className="px-5 py-3.5 flex items-center justify-between active:bg-(--app-c-tw-bg-gray-50)"
                            style={{ transition: 'background-color var(--app-duration-short) var(--app-easing-standard)' }}
                            {...bindTap<HTMLDivElement>('user.profile.open.fromFriends', { params: { userId: friend.id } })}
                        >
                            <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                <div className="w-11 h-11 rounded-full overflow-hidden border border-(--app-c-tw-border-gray-100) shrink-0 bg-(--app-c-tw-bg-gray-100)">
                                    {friend.avatar ? (
                                        <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-(--app-c-tw-text-slate-400) text-lg font-medium">
                                            {friend.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[15px] font-semibold text-(--app-c-tw-text-slate-800) truncate">
                                        {friend.name}
                                    </span>
                                    {friend.readingTimeMinutes > 0 && (
                                        <span className="text-xs text-(--app-c-tw-text-slate-400) mt-0.5 truncate">
                                            {formatReadingTime(friend.readingTimeMinutes, s)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {isFollowing ? (
                                <button
                                    {...bindTap<HTMLButtonElement>(
                                        { kind: 'action', id: 'wechatFriends.item.follow.toggle' },
                                        {
                                            params: { userId: friend.id },
                                            stopPropagation: true,
                                            onTrigger: () => toggleFollow(friend.id),
                                        },
                                    )}
                                    className="px-4 py-1.5 rounded-full border border-app-border text-sm font-medium text-(--app-c-tw-text-slate-500) bg-(--app-c-tw-bg-gray-50) flex items-center gap-1 shrink-0"
                                >
                                    <span className="text-xs">✓</span> {s.following_status_followed}
                                </button>
                            ) : (
                                <button
                                    {...bindTap<HTMLButtonElement>(
                                        { kind: 'action', id: 'wechatFriends.item.follow.toggle' },
                                        {
                                            params: { userId: friend.id },
                                            stopPropagation: true,
                                            onTrigger: () => toggleFollow(friend.id),
                                        },
                                    )}
                                    className="px-4 py-1.5 rounded-full border border-(--app-c-tw-border-gray-100) text-sm font-medium text-(--app-c-tw-text-slate-500) bg-white flex items-center gap-1 shrink-0"
                                >
                                    <span className="text-sm">+</span> {s.wechat_friends_follow}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
