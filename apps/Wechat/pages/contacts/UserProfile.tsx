
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcNavForward, IcMessage, IcPhone, IcUser } from '../../res/icons';
import { useParams } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';
const asset = (r: unknown) => { const str = String(r ?? '').trim(); return (!str || str.startsWith('http')) ? str : `/@app-assets/Wechat/${str}`; };

export const UserProfile: React.FC = () => {
  const t = useWechatStrings();
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const { bindTap } = useWechatGestures();
    const { id: targetWxid } = useParams<{ id: string }>();
    const { user, contacts, nearbyPeople, moments } = useWechatStore(useShallow(s => ({
        user: s.user,
        contacts: s.contacts,
        nearbyPeople: s.nearbyPeople,
        moments: s.moments,
    })));

    const isMe = !!targetWxid && targetWxid === user.wxid;

    // 判断是联系人还是附近的人
    const contactFromList = contacts.find(c => c.wxid === targetWxid);
    const nearbyPerson = nearbyPeople?.find(p => p.wxid === targetWxid);
    const isNearbyPerson = !contactFromList && !!nearbyPerson;

    const text = isEnglish
      ? {
          unknownUser: 'Unknown User',
          unknown: 'Unknown',
          distance: 'Distance',
          region: 'Region',
          signature: 'Bio',
          source: 'Source',
          fromNearby: 'From Nearby People',
          sayHi: 'Say Hi',
          wechatId: 'WeChat ID',
          notSet: 'Not set',
          permission: 'Permissions',
          friendInfoHint: 'Add note names, phone numbers, tags, memos, photos and more, then manage friend permissions.',
          sendMessage: 'Send Message',
          voiceCall: 'Voice/Video Call',
          blacklistedNotice: 'This contact is in your blacklist. You will no longer receive their messages.',
        }
      : {
          unknownUser: '未知用户',
          unknown: '未知',
          distance: '距离',
          region: '地区',
          signature: '签名',
          source: '来源',
          fromNearby: '来自附近的人',
          sayHi: '打招呼',
          wechatId: '微信号',
          notSet: '未设置',
          permission: '权限',
          friendInfoHint: '添加朋友的备注名、电话、标签、备忘、照片等，并设置朋友权限。',
          sendMessage: '发消息',
          voiceCall: '音视频通话',
          blacklistedNotice: '已添加至黑名单，你将不再收到对方的消息',
        };

    const contact = isMe ? user :
                    contactFromList ||
                    nearbyPerson ||
                    { wxid: 'unknown', name: text.unknownUser, avatar: '', category: '', region: '', gender: '' };

    const lastMoment = moments.find(m => m.wxid === (contact as any).wxid);
    const isBlacklisted = (contact as any).isBlacklisted;
    const isChatOnly = (contact as any).permissionMode === 'chatOnly';

    // 附近的人的资料页面
    if (isNearbyPerson) {
        return (
            <div className="bg-app-bg min-h-full flex flex-col">
                {/* 头部资料卡片 */}
                <div className="bg-app-surface px-6 pt-6 pb-6 flex">
                    <div className="w-(--app-avatar-width-64) h-(--app-avatar-height-64) rounded-[6px] mr-5 bg-(--app-c-me-avatar-bg) overflow-hidden flex-shrink-0">
                        <img 
                            src={(contact as any).avatar || asset('avatars/avatar_default.jpg')} 
                            className="w-full h-full object-cover" 
                            alt="" 
                        />
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex items-center text-(--app-item-text-size-22) font-bold text-app-text mb-1.5 leading-none">
                            <span className="truncate">{(contact as any).name}</span>
                            {(contact as any).gender === t.common_female && (
                                <div className="ml-1.5 text-(--app-c-common-link-pink)">
                                    <IcUser size={dimens.icSizeChevronSm} fill="currentColor" strokeWidth={0} />
                                </div>
                            )}
                            {(contact as any).gender === t.common_male && (
                                <div className="ml-1.5 text-(--app-c-common-link-blue)">
                                    <IcUser size={dimens.icSizeChevronSm} fill="currentColor" strokeWidth={0} />
                                </div>
                            )}
                        </div>
                        <div className="text-(--app-c-tw-text-gray-500) text-(--app-settings-group-title-size) mb-0.5 font-normal">{text.distance}: {(contact as any).distance || text.unknown}</div>
                        <div className="text-(--app-c-tw-text-gray-500) text-(--app-settings-group-title-size) font-normal">{text.region}: {(contact as any).region || text.unknown}</div>
                    </div>
                </div>

                {/* 朋友资料区块 */}
                <div className="bg-app-surface px-4 py-4 border-t border-(--app-c-misc-border-light)">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-(--app-settings-item-text-size) text-app-text font-medium">{t.contacts_friend_info}</span>
                        <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-me-chevron-color)" strokeWidth={dimens.icStrokeWidth} />
                    </div>
                    {(contact as any).signature && (
                        <div className="flex mb-2">
                            <span className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) w-(--app-contacts-user-profile-width-50) flex-shrink-0">{text.signature}</span>
                            <span className="text-(--app-settings-group-title-size) text-app-text flex-1">{(contact as any).signature}</span>
                        </div>
                    )}
                    <div className="flex">
                        <span className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400) w-(--app-contacts-user-profile-width-50) flex-shrink-0">{text.source}</span>
                        <span className="text-(--app-settings-group-title-size) text-app-text flex-1">{text.fromNearby}</span>
                    </div>
                </div>

                {/* 打招呼按钮 */}
                <div className="bg-app-surface mt-2">
                    <button className="w-full h-(--app-settings-item-height) text-(--app-c-address-link-text) font-bold text-(--app-settings-item-text-size) flex justify-center items-center active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                        {text.sayHi}
                    </button>
                </div>

                {/* 底部投诉 */}
                <div className="flex-1 bg-app-bg flex flex-col items-center pt-8">
                    <button className="text-(--app-c-address-link-text) text-(--app-chat-bubble-text-size) font-medium active:opacity-60">
                        {t.chat_complaint}
                    </button>
                </div>
            </div>
        );
    }

    // 已添加好友或自己的资料页面
    return (
        <div className="bg-app-bg min-h-full flex flex-col">
            {/* 头部资料卡片 (白色背景) */}
            <div className="bg-app-surface px-6 pt-6 pb-6 flex">
                <div className="w-(--app-avatar-width-64) h-(--app-avatar-height-64) rounded-[6px] mr-5 bg-(--app-c-me-avatar-bg) overflow-hidden flex-shrink-0">
                    <img 
                        src={(contact as any).avatar || asset('avatars/avatar_default.jpg')} 
                        className="w-full h-full object-cover" 
                        alt="" 
                    />
                </div>
                <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="flex items-center text-(--app-item-text-size-22) font-bold text-app-text mb-1 leading-none">
                        <span className="truncate">{(contact as any).name}</span>
                        {(contact as any).gender === t.common_female && (
                            <div className="ml-1.5 text-(--app-c-common-link-pink)">
                                <IcUser size={dimens.icSizeChevronSm} fill="currentColor" strokeWidth={0} />
                            </div>
                        )}
                        {(contact as any).gender === t.common_male && (
                            <div className="ml-1.5 text-(--app-c-common-link-blue)">
                                <IcUser size={dimens.icSizeChevronSm} fill="currentColor" strokeWidth={0} />
                            </div>
                        )}
                    </div>
                    <div className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) mb-1 font-normal truncate">{text.wechatId}: {(contact as any).wxid || text.notSet}</div>
                    <div className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) font-normal truncate">{text.region}: {(contact as any).region || text.unknown}</div>
                </div>
            </div>

            {/* 朋友资料入口 (仅在查看他人时显示) */}
            {!isMe && (
                <div 
                    className="bg-app-surface flex items-center px-4 py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer min-h-(--app-item-height-72) border-t border-(--app-c-misc-border-light)"
                    {...bindTap<HTMLDivElement>('friendInfo.open', { params: { id: (contact as any).wxid } })}
                >
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="text-(--app-settings-item-text-size) text-app-text font-normal mb-0.5">{t.contacts_friend_info}</div>
                        {isChatOnly ? (
                            <div className="flex items-center gap-6 mt-1">
                                <span className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-400)">{text.permission}</span>
                                <span className="text-app-text text-(--app-settings-group-title-size)">{t.chat_only}</span>
                            </div>
                        ) : (
                            <p className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) leading-[1.4] mt-1 pr-6">
                                {text.friendInfoHint}
                            </p>
                        )}
                    </div>
                    <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-me-chevron-color) flex-shrink-0" strokeWidth={dimens.icStrokeWidth} />
                </div>
            )}

            {/* 朋友圈入口 (自己或非黑名单好友均可见) */}
            {!isBlacklisted && (
                <div 
                    className={`bg-app-surface flex items-center px-4 py-3 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer h-(--app-settings-item-height) border-b border-gray-100/50 ${isMe ? 'mt-2 border-t' : ''}`} 
                    {...bindTap<HTMLDivElement>('moments.user.open', { params: { wxid: (contact as any).wxid } })}
                >
                    <span className="text-(--app-settings-item-text-size) text-app-text w-24 flex-shrink-0">{t.discover_moments}</span>
                    <div className="flex-1 flex items-center overflow-hidden">
                        {lastMoment?.images && lastMoment.images.length > 0 && !isChatOnly && (
                            <img src={lastMoment.images[0]} className="w-10 h-10 rounded-[2px] object-cover mr-2" alt="" />
                        )}
                        {!lastMoment?.images && isMe && (
                             <div ></div>
                             
                        )}
                    </div>
                    <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-me-chevron-color) flex-shrink-0" strokeWidth={dimens.icStrokeWidth} />
                </div>
            )}

            {/* 分隔空间 */}
            <div className="h-2"></div>

            {/* 发消息按钮 (自己也可以发消息给自己，作为文件传输或记录) */}
            {!isBlacklisted && (
                <div className="bg-app-surface">
                    <button 
                        className="w-full h-(--app-settings-item-height) text-(--app-c-address-link-text) font-bold text-(--app-settings-item-text-size) flex justify-center items-center active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        {...bindTap<HTMLButtonElement>('chat.open', { params: { id: (contact as any).wxid } })}
                    >
                        <IcMessage size={dimens.icSizeToolbar} className="mr-2" strokeWidth={1.5} /> {text.sendMessage}
                    </button>
                    
                    {/* 仅在查看他人且非黑名单时显示音视频通话 */}
                    {!isMe && (
                        <button className="w-full h-(--app-settings-item-height) text-(--app-c-address-link-text) font-bold text-(--app-settings-item-text-size) flex justify-center items-center active:bg-(--app-c-tw-bg-gray-50) border-t border-gray-100/50" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                            <IcPhone size={dimens.icSizeCheck} className="mr-2" strokeWidth={1.5} /> {text.voiceCall}
                        </button>
                    )}
                </div>
            )}

            {/* 如果是黑名单，显示提示区域 */}
            {isBlacklisted && (
                <div className="flex-1 bg-app-bg flex flex-col items-center pt-8 px-10 text-center">
                    <div className="text-(--app-c-tw-text-gray-400) text-(--app-settings-group-title-size) mb-8 leading-relaxed max-w-(--app-modal-width-280)">
                        {text.blacklistedNotice}
                    </div>
                    <button className="text-(--app-c-address-link-text) text-(--app-chat-bubble-text-size) font-medium active:opacity-60">
                        {t.chat_complaint}
                    </button>
                </div>
            )}
            
            {/* 底部填充 */}
            {!isBlacklisted && <div className="flex-1 bg-app-bg"></div>}
        </div>
    );
};
