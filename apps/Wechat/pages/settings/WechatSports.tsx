
import { LucideIcon } from '../../res/icons';
import { dimens } from '../../res/dimens';
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { IcCamera, IcNavForward, IcMessage, IcHeart } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle, SettingsItem } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStrings } from '../../hooks/useWechatStrings';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Wechat/${s}`; };

/**
 * 核心逻辑：优先根据传入的参与者对象读取步数和点赞数。
 * 如果不存在，则根据用户 ID 生成稳定的步数和点赞数（兜底方案）。
 */
const getSportsData = (participant: { wxid: string, name: string, steps?: number, likes?: number }) => {
    // 优先读取 data 中的步数和点赞数
    if (participant.steps !== undefined && participant.likes !== undefined) {
        return { steps: participant.steps, likes: participant.likes };
    }

    // 兜底方案：简单的字符串哈希函数，确保步数固定但看起来像随机的
    let hash = 0;
    for (let i = 0; i < participant.wxid.length; i++) {
        hash = participant.wxid.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // 步数范围 1000 - 9000
    const steps = Math.abs(hash % 8000) + 1000;
    // 点赞数范围 0 - 5
    const likes = Math.abs(hash % 6);
    
    return { steps, likes };
};

// --- 微信运动主页（消息列表流） ---
export const WechatSportsMain: React.FC = () => {
    const t = useWechatStrings();
    const { bindTap } = useWechatGestures();
    return (
        <div className="bg-app-bg min-h-full flex flex-col relative">
            <div className="flex-1 p-4 space-y-4">
                <div className="flex justify-center mb-2">
                    <span className="text-xs text-(--app-c-tw-text-gray-400)">18:53</span>
                </div>
                
                <div className="flex items-start">
                    <div className="w-10 h-10 bg-app-primary rounded-[4px] flex items-center justify-center mr-2 flex-shrink-0">
                        <IcMessage size={dimens.icSizeTab} className="text-white" fill="white" />
                    </div>
                    <div className="bg-app-surface rounded-[4px] p-4 flex gap-4 w-(--app-modal-width-280) shadow-sm relative">
                        <div className="absolute top-3 left-[-6px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-white"></div>
                        <div className="flex-1">
                            <div className="text-(--app-settings-item-text-size) text-app-text mb-1 font-medium">{t.sports_share_joy}</div>
                            <div className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400)">{t.sports_welcome}</div>
                        </div>
                        <img src={asset('avatars/avatar_10.jpg')} className="w-16 h-16 rounded-[2px] object-cover" alt="" />
                    </div>
                </div>
            </div>

            <div 
                {...bindTap<HTMLDivElement>('wechatSports.leaderboard.open')}
                className="sticky bottom-0 h-(--app-settings-item-height) bg-app-surface border-t border-app-border flex items-center justify-center active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
            >
                <span className="text-(--app-settings-item-text-size) text-app-text font-medium">{t.sports_leaderboard}</span>
            </div>
        </div>
    );
};

// --- 步数排行榜页面 ---
export const SportsLeaderboard: React.FC = () => {
    const t = useWechatStrings();
    const { bindTap } = useWechatGestures();
    const { user, contacts } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        contacts: s.contacts,
    })));

    const sortedLeaderboard = useMemo(() => {
        const participantsMap = new Map();

        // 加入“我”
        const myData = getSportsData(user);
        participantsMap.set(user.wxid, {
            wxid: user.wxid,
            name: user.name,
            avatar: user.avatar,
            steps: myData.steps,
            likes: myData.likes,
            isMe: true
        });

        // 遍历联系人
        contacts.forEach(c => {
            if (participantsMap.has(c.wxid)) return;
            const friendData = getSportsData(c);
            participantsMap.set(c.wxid, {
                wxid: c.wxid,
                name: c.name,
                avatar: c.avatar,
                steps: friendData.steps,
                likes: friendData.likes,
                isMe: false
            });
        });

        return Array.from(participantsMap.values()).sort((a, b) => b.steps - a.steps);
    }, [user, contacts]);

    const winner = sortedLeaderboard[0] || { avatar: '', name: t.sports_no_data };
    const myRankInfo = useMemo(() => {
        const index = sortedLeaderboard.findIndex(item => item.isMe);
        return { rank: index + 1, data: sortedLeaderboard[index] };
    }, [sortedLeaderboard]);

    const LeaderboardItem = ({ rank, name, avatar, steps, likes, isMe = false, wxid }: any) => {
        const tapProps = isMe
            ? bindTap<HTMLDivElement>('wechatSports.profile.me.open')
            : bindTap<HTMLDivElement>('wechatSports.profile.friend.open', { params: { id: wxid } });

        return (
            <div 
                {...tapProps}
                className="flex items-center px-4 h-(--app-item-height-72) bg-app-surface active:bg-(--app-c-tw-bg-gray-50) border-b border-(--app-c-tw-border-gray-100) cursor-pointer"
            >
            <div className="w-8 text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal">{rank}</div>
            <img src={avatar} className="w-12 h-12 rounded-[4px] bg-(--app-c-tw-bg-gray-100) object-cover mr-4" alt="" />
            <div className="flex-1 text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal truncate pr-4">{name}</div>
            <div className="flex items-center gap-4">
                <span className="text-(--app-title-text-size-24) font-medium text-app-primary">{steps}</span>
                <div className="flex flex-col items-center">
                    <span className={`${likes > 0 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-300)'} text-(--app-chat-list-item-time-size) font-medium`}>{likes}</span>
                    <IcHeart size={dimens.icSizeHeartSm} className={likes > 0 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-200)'} fill={likes > 0 ? 'currentColor' : 'none'} />
                </div>
            </div>
            </div>
        );
    };

    return (
        <div className="bg-app-bg min-h-full flex flex-col pb-10 no-scrollbar">
            <div className="bg-(--app-c-common-text-secondary) h-(--app-item-height-280) relative flex flex-col items-center justify-center">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10 whitespace-nowrap bg-black/20 px-3 py-1 rounded-full">
                    <img src={winner.avatar} className="w-6 h-6 rounded-full object-cover border border-white/50" alt="" />
                    <span className="text-white text-(--app-settings-group-title-size)">{winner.name}{t.sports_cover_occupied}</span>
                </div>
                
                <div className="flex flex-col items-center opacity-40">
                    <IcCamera size={dimens.icSizePlaceholder} className="text-(--app-c-tw-text-gray-400) mb-2" />
                    <span className="text-(--app-c-tw-text-gray-400) text-sm">{t.sports_set_background}</span>
                </div>
            </div>

            <div className="mb-2">
                <LeaderboardItem 
                    rank={myRankInfo.rank} 
                    name={myRankInfo.data?.name} 
                    avatar={myRankInfo.data?.avatar} 
                    steps={myRankInfo.data?.steps} 
                    likes={myRankInfo.data?.likes} 
                    isMe 
                    wxid={myRankInfo.data?.wxid}
                />
            </div>

            <div className="bg-app-surface">
                {sortedLeaderboard.map((item, idx) => (
                    <LeaderboardItem 
                        key={item.wxid}
                        rank={idx + 1}
                        name={item.name}
                        avatar={item.avatar}
                        steps={item.steps}
                        likes={item.likes}
                        wxid={item.wxid}
                        isMe={item.isMe}
                    />
                ))}
            </div>

            <div className="flex justify-center py-8">
                <button className="text-(--app-c-address-link-text) text-(--app-settings-item-text-size) font-normal active:opacity-60">
                    {t.accessibility_invite_friend}
                </button>
            </div>
        </div>
    );
};

// --- 微信运动我的主页 ---
export const SportsMyProfile: React.FC = () => {
    const t = useWechatStrings();
    const user = useWechatStore(s => s.user);
    const myData = getSportsData(user);

    return (
        <div className="bg-app-bg min-h-full pb-10 no-scrollbar">
            <div className="h-(--app-item-height-280) bg-(--app-c-common-text-secondary) relative flex flex-col items-center justify-center">
                <div className="flex flex-col items-center opacity-40">
                    <IcCamera size={dimens.icSizePlaceholder} className="text-(--app-c-tw-text-gray-400) mb-2" />
                    <span className="text-(--app-c-tw-text-gray-400) text-sm">{t.sports_set_background}</span>
                </div>
                
                <div className="absolute left-6 bottom-[-32px] flex items-center z-20">
                    <div className="w-(--app-card-width-78) h-(--app-card-height-78) bg-app-surface p-(--app-card-padding-3) rounded-[10px] shadow-sm">
                        <img src={user.avatar} className="w-full h-full rounded-[8px] object-cover" alt="" />
                    </div>
                    <span className="ml-4 mb-2 text-(--app-me-username-size) font-bold text-white drop-shadow-md">{user.name}</span>
                </div>
            </div>

            <div className="h-12"></div>

            <div className="px-4 mb-4">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-(--app-settings-item-text-size) font-bold text-app-text">{t.sports_today}</span>
                    <div className="flex items-center text-(--app-c-tw-text-gray-400) text-sm">
                        <span className="mr-1">12月18日</span>
                        <IcNavForward size={dimens.icSizeChevronSm} />
                    </div>
                </div>
                
                <div className="bg-app-surface rounded-xl p-6 flex justify-between items-center shadow-sm">
                    <div className="flex items-baseline gap-2">
                        <span className="text-(--app-c-tw-text-gray-500) text-(--app-settings-item-text-size)">{t.sports_steps}</span>
                        <span className="text-(--app-title-text-size-34) font-medium text-app-primary">{myData.steps}</span>
                        <span className="text-(--app-c-tw-text-gray-500) text-(--app-settings-item-text-size)">步</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className={`${myData.likes > 0 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-300)'} text-(--app-chat-list-item-time-size) font-medium`}>{myData.likes}</span>
                        <IcHeart size={dimens.icSizeHeartLg} className={myData.likes > 0 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-200)'} fill={myData.likes > 0 ? 'currentColor' : 'none'} />
                    </div>
                </div>
            </div>

            <div className="px-4 space-y-3">
                <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm">
                    <SettingsItem label={t.sports_following} isLast />
                </div>
                <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm">
                    <SettingsItem label={t.sports_donate} isLast />
                </div>
            </div>
        </div>
    );
};

// --- 微信运动好友主页 ---
export const SportsFriendProfile: React.FC = () => {
    const t = useWechatStrings();
    const { id } = useParams<{ id: string }>();
    const contacts = useWechatStore(s => s.contacts);
    const contact = contacts.find(c => c.wxid === id) || contacts[0];

    // 使用确定性函数获取步数和点赞，优先读取 data
    const friendData = getSportsData(contact);

    return (
        <div className="bg-app-bg min-h-full pb-10 no-scrollbar">
            <div className="h-(--app-item-height-280) bg-slate-800 relative flex flex-col items-center justify-center">
                <div className="absolute left-6 bottom-[-32px] flex items-center z-20">
                    <div className="w-(--app-card-width-78) h-(--app-card-height-78) bg-app-surface p-(--app-card-padding-3) rounded-[10px] shadow-sm">
                        <img src={contact.avatar} className="w-full h-full rounded-[8px] object-cover" alt="" />
                    </div>
                    <span className="ml-4 mb-2 text-(--app-me-username-size) font-bold text-white drop-shadow-md">{contact.name}</span>
                </div>
            </div>

            <div className="h-12"></div>

            <div className="px-4 mb-4">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-(--app-settings-item-text-size) font-bold text-app-text">{t.sports_today}</span>
                    <div className="flex items-center text-(--app-c-tw-text-gray-400) text-sm">
                        <span className="mr-1">12月18日</span>
                        <IcNavForward size={dimens.icSizeChevronSm} />
                    </div>
                </div>
                <div className="bg-app-surface rounded-xl p-6 flex justify-between items-center shadow-sm">
                    <div className="flex items-baseline gap-2">
                        <span className="text-(--app-c-tw-text-gray-500) text-(--app-settings-item-text-size)">{t.sports_steps}</span>
                        <span className="text-(--app-title-text-size-34) font-medium text-app-primary">{friendData.steps}</span>
                        <span className="text-(--app-c-tw-text-gray-500) text-(--app-settings-item-text-size)">步</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className={`${friendData.likes > 0 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-300)'} text-(--app-chat-list-item-time-size) font-medium`}>{friendData.likes}</span>
                        <IcHeart size={dimens.icSizeHeartLg} className={friendData.likes > 0 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-200)'} fill={friendData.likes > 0 ? 'currentColor' : 'none'} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 微信运动隐私设置 ---
export const SportsPrivacySettings: React.FC = () => {
    const t = useWechatStrings();
    const { settings: allSettings, updateSettings } = useWechatStore(useShallow(s => ({
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const { bindTap } = useWechatGestures();
    const sportsSettings = allSettings.accessibility.wechatSports;

    const update = (field: string, value: boolean) => {
        updateSettings({
                ...allSettings,
                accessibility: {
                    ...allSettings.accessibility,
                    wechatSports: { ...sportsSettings, [field]: value }
                }
        });
    };

    return (
        <div className="bg-app-bg min-h-full">
            <div className="h-2"></div>
            <div className="bg-app-surface">
                <SettingsToggle
                    label={t.sports_join_leaderboard}
                    isOn={!!sportsSettings.joinLeaderboard}
                    onToggle={() => update('joinLeaderboard', !sportsSettings.joinLeaderboard)}
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'wechatSports.privacy.joinLeaderboard.toggle' },
                      { onTrigger: () => update('joinLeaderboard', !sportsSettings.joinLeaderboard) },
                    )}
                />
                <SettingsToggle
                    label={t.sports_recv_leaderboard_msg}
                    isOn={!!sportsSettings.recvLeaderboardMsg}
                    onToggle={() => update('recvLeaderboardMsg', !sportsSettings.recvLeaderboardMsg)}
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'wechatSports.privacy.recvLeaderboardMsg.toggle' },
                      { onTrigger: () => update('recvLeaderboardMsg', !sportsSettings.recvLeaderboardMsg) },
                    )}
                />
                <SettingsToggle
                    label={t.sports_recv_like_msg}
                    isOn={!!sportsSettings.recvLikeMsg}
                    onToggle={() => update('recvLikeMsg', !sportsSettings.recvLikeMsg)}
                    actionProps={bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'wechatSports.privacy.recvLikeMsg.toggle' },
                      { onTrigger: () => update('recvLikeMsg', !sportsSettings.recvLikeMsg) },
                    )}
                    isLast
                />
            </div>

            <div className="h-2"></div>

            <div className="bg-app-surface">
                <SettingsItem label={t.sports_exclude_ranking} isLast />
            </div>
        </div>
    );
};
