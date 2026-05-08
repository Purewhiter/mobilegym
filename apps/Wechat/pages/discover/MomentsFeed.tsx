
import React from 'react';
import { dimens } from '../../res/dimens';
import { IcCamera, IcTrash, IcMore, IcLocation } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import * as TimeService from '../../../../os/TimeService';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { WechatSmartImage } from '../../components/WechatSmartImage';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const MomentsFeed: React.FC = () => {
    const t = useWechatStrings();
    const { user, moments, contacts } = useWechatStore(useShallow(s => ({
        user: s.user,
        moments: s.moments,
        contacts: s.contacts,
    })));
    const { bindTap } = useWechatGestures();

    const filteredMoments = moments.filter(m => {
        // If it's me, show
        if (m.wxid === user.wxid) return true;

        // Find the contact
        const contact = contacts.find(c => c.wxid === m.wxid);
        if (!contact) return true;

        // If chat-only or hide-their-moments is true, filter it out
        if (contact.permissionMode === 'chatOnly' || contact.hideTheirMoments) return false;

        return true;
    });

    const formatMomentTime = (timestamp: number) => {
        const now = TimeService.now();
        const diff = now - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return '刚刚';
        if (mins < 60) return `${mins}分钟前`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}小时前`;
        return `${Math.floor(hours / 24)}天前`;
    };

    return (
        <div className="bg-app-surface min-h-full pb-10 no-scrollbar">
            {/* 朋友圈封面区域 */}
            <div className="relative mb-16 h-(--app-item-height-280) bg-(--app-c-common-text-secondary) flex flex-col items-center justify-center">
                <div className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) opacity-60">{t.discover_moments_cover_hint}</div>

                {/* 个人信息悬浮层 */}
                <div className="absolute right-4 bottom-[-32px] flex items-center z-20">
                    <span className="mr-4 mb-2 text-(--app-me-username-size) font-bold text-white drop-shadow-md">{user.name}</span>
                    <div
                        className="w-(--app-card-width-78) h-(--app-card-height-78) bg-app-surface p-(--app-card-padding-3) rounded-[10px] shadow-sm cursor-pointer"
                        {...bindTap<HTMLDivElement>('userProfile.open', { params: { id: user.wxid } })}
                    >
                        <img src={user.avatar} className="w-full h-full rounded-[8px] object-cover" alt="" />
                    </div>
                </div>
            </div>

            {/* 动态列表 */}
            <div className="px-0">
                {filteredMoments.map((moment) => {
                    const isMe = moment.wxid === user.wxid;
                    return (
                        <div key={moment.id} className="flex px-4 py-5 border-b border-(--app-c-tw-border-gray-100)">
                            {/* 左侧头像 */}
                            <div
                                className="mr-3 flex-shrink-0 cursor-pointer"
                                {...bindTap<HTMLDivElement>('userProfile.open', { params: { id: moment.wxid } })}
                            >
                                <img src={moment.userAvatar} className="w-(--app-avatar-width-44) h-(--app-avatar-height-44) rounded-[4px] object-cover bg-(--app-c-tw-bg-gray-100)" alt="" />
                            </div>

                            {/* 右侧内容 */}
                            <div className="flex-1 min-w-0">
                                <div className="text-(--app-c-address-link-text) text-(--app-chat-bubble-text-size) font-bold mb-1">{moment.userName}</div>

                                {moment.content && (
                                    <div className="text-(--app-chat-bubble-text-size) text-(--app-c-common-text-primary) leading-relaxed mb-1.5 break-all">
                                        {moment.content}
                                    </div>
                                )}

                                {moment.images && moment.images.length > 0 && (
                                    <div className="mb-3">
                                        {moment.images.map((img, i) => (
                                            <WechatSmartImage
                                                key={i}
                                                src={img}
                                                className="max-w-(--app-card-width-180) max-h-(--app-card-height-300) rounded-[2px] object-cover bg-(--app-c-tw-bg-gray-50) shadow-sm"
                                                alt=""
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-(--app-c-tw-text-gray-400) text-(--app-chat-system-msg-text-size)">{formatMomentTime(moment.timestamp)}</span>

                                        {/* 位置信息已移动到时间右侧 */}
                                        {moment.location && (
                                            <div className="text-(--app-c-address-link-text) text-(--app-chat-system-msg-text-size) truncate max-w-(--app-discover-moments-feed-width-150)">
                                                {moment.location}
                                            </div>
                                        )}

                                        {/* 删除文字已替换为垃圾桶图标 */}
                                        {isMe && (
                                            <button className="text-(--app-c-address-link-text) active:opacity-60 cursor-pointer">
                                                <IcTrash size={dimens.icSizeTiny} strokeWidth={2.5} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-(--app-c-chat-input-bar-bg) rounded-[4px] px-1.5 py-1 active:bg-(--app-c-tw-bg-gray-200) cursor-pointer">
                                        <div className="flex items-center gap-(--app-item-gap-3)">
                                            <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-address-link-text)"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-address-link-text)"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="py-12 flex flex-col items-center opacity-30">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-(--app-divider-height-1) bg-(--app-c-tw-bg-gray-400)"></div>
                    <div className="w-1 h-1 rounded-full bg-(--app-c-tw-bg-gray-400)"></div>
                    <div className="w-8 h-(--app-divider-height-1) bg-(--app-c-tw-bg-gray-400)"></div>
                </div>
            </div>
        </div>
    );
};
