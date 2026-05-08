
import React, { useMemo } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams } from 'react-router-dom';
import { IcCamera, IcAlert } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import * as TimeService from '../../../../os/TimeService';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { WechatSmartImage } from '../../components/WechatSmartImage';

export const UserMoments: React.FC = () => {
  const t = useWechatStrings();
    const { wxid } = useParams<{ wxid: string }>();
    const { user, contacts, moments, momentDraft } = useWechatStore(useShallow(s => ({
        user: s.user,
        contacts: s.contacts,
        moments: s.moments,
        momentDraft: s.momentDraft,
    })));
    const { bindTap } = useWechatGestures();

    const isMe = wxid === user.wxid;
    const profileUser = isMe
        ? user
        : contacts.find(c => c.wxid === wxid) || { name: '未知用户', avatar: '', wxid: '', signature: '' };

    const userMoments = useMemo(() => {
        return moments.filter(m => m.wxid === wxid).sort((a, b) => b.timestamp - a.timestamp);
    }, [moments, wxid]);

    // 按天分组朋友圈
    const groupedMoments = useMemo(() => {
        const groups: { date: string, location?: string, items: typeof userMoments }[] = [];

        userMoments.forEach(m => {
            const date = TimeService.fromTimestamp(m.timestamp);
            const today = TimeService.getDate();
            const yesterday = TimeService.fromTimestamp(today.getTime());
            yesterday.setDate(today.getDate() - 1);

            let dateLabel = '';
            if (date.toDateString() === today.toDateString()) {
                dateLabel = t.common_today;
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateLabel = '昨天';
            } else {
                dateLabel = `${date.getDate()} ${date.getMonth() + 1}月`;
            }

            const existingGroup = groups.find(g => g.date === dateLabel);
            if (existingGroup) {
                existingGroup.items.push(m);
            } else {
                groups.push({
                    date: dateLabel,
                    location: m.location || undefined,
                    items: [m]
                });
            }
        });

        // 如果是本人且今天没有动态，手动补一个“今天”分组用来显示相机图标
        if (isMe && !groups.some(g => g.date === t.common_today)) {
            groups.unshift({ date: '今天', location: user.currentLocation || '北京市', items: [] });
        }

        return groups;
    }, [userMoments, isMe, user]);

    return (
        <div className="bg-app-surface min-h-full pb-20 no-scrollbar overflow-x-hidden" data-status-bar-foreground="light">
            {/* 顶部背景墙 - 对应截图中的暗灰色；状态栏声明为 dark 以便在深色背景上显示白色图标 */}
            <div className="relative mb-24 h-(--app-item-height-280) bg-(--app-c-overlay-dark-item-alt) flex flex-col items-center justify-center">
                <div className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) opacity-60">{t.discover_moments_cover_hint}</div>

                {/* 个人信息悬浮层 - 对应截图重叠布局 */}
                <div className="absolute right-4 bottom-[-40px] flex flex-col items-end z-20">
                    <div className="flex items-end mb-2">
                        <span className="mr-4 mb-2 text-(--app-me-username-size) font-bold text-white drop-shadow-lg">{profileUser.name}</span>
                        <div
                            className="w-(--app-item-width-84) h-(--app-item-height-84) bg-app-surface p-(--app-card-padding-1) rounded-[10px] shadow-lg cursor-pointer active:opacity-80"
                            {...(wxid
                                ? bindTap<HTMLDivElement>('userProfile.open', { params: { id: wxid } })
                                : {})}
                        >
                            <img src={profileUser.avatar} className="w-full h-full rounded-[8px] object-cover" alt="" />
                        </div>
                    </div>
                    {/* 签名档 */}
                    <div className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) font-normal text-right pr-2">
                        {profileUser.signature || '这是我的签名'}
                    </div>
                </div>
            </div>

            {/* 朋友圈内容流 */}
            <div className="px-6 space-y-10 mt-12">
                {groupedMoments.map((group, gIdx) => (
                    <div key={gIdx} className="flex gap-4">
                        {/* 左侧：日期和地理位置 */}
                        <div className="w-20 flex-shrink-0 flex flex-col pt-1">
                            <span className="text-(--app-title-text-size-28) font-bold text-app-text leading-none mb-1">{group.date}</span>
                            {group.location && (
                                <span className="text-(--app-chat-time-label-text-size) text-(--app-c-tw-text-gray-400) leading-tight">
                                    {group.location}
                                </span>
                            )}
                        </div>

                        {/* 右侧：动态详情 */}
                        <div className="flex-1 flex flex-col gap-2">
                            {/* 如果是今天，显示拍照入口图标（对应截图） */}
                            {isMe && group.date === t.common_today && (
                                (() => {
                                    const hasMomentDraft =
                                        Boolean(momentDraft.content?.trim()) ||
                                        (momentDraft.selectedImages?.length ?? 0) > 0 ||
                                        Boolean(momentDraft.location);

                                    const tapProps = wxid
                                        ? hasMomentDraft
                                            ? bindTap<HTMLDivElement>('userMoments.post.open.fromDraft', {
                                                params: { wxid },
                                              })
                                            : bindTap<HTMLDivElement>('userMoments.menu.camera.open', {
                                                params: { wxid },
                                              })
                                        : {};

                                    return (
                                <div
                                    className="w-(--app-item-width-80) h-(--app-item-height-80) bg-(--app-c-chat-input-bar-bg) flex items-center justify-center rounded-[2px] active:bg-(--app-c-tw-bg-gray-200) cursor-pointer mb-2"
                                    {...tapProps}
                                >
                                    <IcCamera size={dimens.icSizeServiceGrid} className="text-(--app-c-me-chevron-color)" strokeWidth={1.5} />
                                </div>
                                    );
                                })()
                            )}

                            {group.items.map((moment) => (
                                <div key={moment.id} className="flex flex-col gap-2 mb-1">
                                    {/* 1. 图片动态样式 */}
                                    {moment.images && moment.images.length > 0 && (
                                        <div className="relative w-(--app-item-width-80) h-(--app-item-height-80)">
                                            <WechatSmartImage
                                                src={moment.images[0]}
                                                className="w-full h-full object-cover rounded-[2px] bg-(--app-c-tw-bg-gray-50)"
                                                alt=""
                                            />
                                            {/* 模拟截图中的发送失败红色感叹号 */}
                                            {moment.content === 'FAILED' && (
                                                <div className="absolute bottom-1 right-1">
                                                    <IcAlert size={dimens.icSizeTiny} className="text-red-500 fill-white" />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 2. 纯文字动态样式 - 对应截图中的浅灰色背景块 */}
                                    {moment.content && moment.content !== 'FAILED' && (
                                        <div className="bg-(--app-c-chat-input-bar-bg) px-4 py-3 text-(--app-chat-bubble-text-size) text-app-text leading-relaxed rounded-[2px] font-normal">
                                            {moment.content}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* 底部页码圆点 - 对应截图底部的装饰点 */}
            <div className="mt-20 flex justify-center items-center gap-2 pb-12">
                <div className="w-4 h-(--app-divider-height-1) bg-(--app-c-tw-bg-gray-200)"></div>
                <div className="w-1 h-1 rounded-full bg-(--app-c-tw-bg-gray-300)"></div>
                <div className="w-1 h-1 rounded-full bg-(--app-c-tw-bg-gray-100)"></div>
                <div className="w-4 h-(--app-divider-height-1) bg-(--app-c-tw-bg-gray-200)"></div>
            </div>
        </div>
    );
};
