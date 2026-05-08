
import React from 'react';
import { useWechatStrings } from '../hooks/useWechatStrings';
import { IcNavBack, IcMore, IcCamera, IcSearch, IcAddCircle, IcMessage, IcUserAdd, IcScan, IcQrCode, IcEar } from '../res/icons';
import { dimens } from '../res/dimens';
import { matchPath, useLocation } from 'react-router-dom';
import { selectMomentDraft, useWechatStore } from '../state';
import { useWechatGestures } from '../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';
import { resolveChatPeerByWxid } from '../utils/resolveChatPeer';
const POST_MOMENT_TRY_EXIT_EVENT = 'wechat:postMoment:tryExit';
const POST_TEXT_MOMENT_TRY_EXIT_EVENT = 'wechat:postTextMoment:tryExit';

const TopBar: React.FC = () => {
  const t = useWechatStrings();
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const text = isEnglish
        ? {
            wallet: 'Wallet',
            paymentSettings: 'Payment Settings',
            autoRenew: 'Auto Renew',
            friendSettings: 'Friend Settings',
            chatInfo: 'Chat Info',
            bills: 'Transactions',
            post: 'Post',
            done: 'Done',
          }
        : {
            wallet: '钱包',
            paymentSettings: '支付设置',
            autoRenew: '自动续费',
            friendSettings: '朋友设置',
            chatInfo: '聊天信息',
            bills: '账单',
            post: '发表',
            done: '完成',
          };
    const location = useLocation();
    const user = useWechatStore(s => s.user);
    const chats = useWechatStore(s => s.chats);
    const contacts = useWechatStore(s => s.contacts);
    const rightAction = useWechatStore(s => s._temp.rightAction);
    const momentDraft = useWechatStore(selectMomentDraft);
    const { bindTap, bindLongPress, bindBack, go } = useWechatGestures();
    const cameraLongPressTriggeredRef = React.useRef(false);

    const searchParams = new URLSearchParams(location.search);
    const showPlusMenu = searchParams.get('menu') === 'plus';

    const path = location.pathname;
    const isMainTab = ['/', '/contacts', '/discover', '/me'].includes(path);
    const isIndividualMomentsPage = path.startsWith('/moments/') && path !== '/moments';
    const momentsMatch = matchPath('/moments/:wxid', path);
    const momentsWxid = momentsMatch?.params?.wxid;
    const isMyMomentsPage = !!momentsWxid && momentsWxid === user.wxid;
    const isUserProfilePage = path.startsWith('/user-profile/');
    const isFriendInfoPage = path.startsWith('/friend-info/');
    const isChatMediaPickerPage = /^\/chat\/[^/]+\/media-picker$/.test(path);

    const whiteBackgroundPages = [
        '/me', '/me/qrcode', '/moments', '/post-moment', '/user-profile', '/friend-info',
        '/post-text-moment', '/select-location', '/me/name', '/me/gender', '/me/pat', '/me/signature',
        '/settings/notifications/sound', '/settings/general/dark-mode', '/add-friend', '/search', '/settings/privacy/add-me',
        '/settings/privacy/authorization'
    ];

    let title: React.ReactNode = t.tab_wechat;
    let rightContent: React.ReactNode = null;
    let bgClass = (whiteBackgroundPages.includes(path) || isUserProfilePage || isFriendInfoPage) ? 'bg-app-surface' : 'bg-(--app-c-misc-divider-light)';
    let containerStyle = "pt-10 h-(--app-item-height-88) flex items-center justify-between px-4 relative";

    const titleMap: Record<string, string> = {
        '/': t.tab_wechat,
        '/contacts': t.tab_contacts,
        '/new-friends': t.contacts_new_friend,
        '/groups': t.contacts_group_chat,
        '/tags': t.contacts_tags,
        '/discover': t.tab_discover,
        '/moments': t.discover_moments,
        '/select-location': t.me_location,
        '/post-moment': '',
        '/post-text-moment': t.topbar_post_text,
        '/me': '',
        '/my-profile-detail': t.settings_profile,
        '/me/name': t.topbar_edit_name,
        '/me/gender': t.topbar_set_gender,
        '/me/region': t.topbar_select_region,
        '/me/phone': t.contacts_phone,
        '/me/wxid': '',
        '/me/qrcode': '',
        '/me/pat': '',
        '/me/moments-album': t.me_album,
        '/me/signature': t.topbar_signature,
        '/me/address': t.profile_address,
        '/me/address/add': t.topbar_add_address,
        '/me/invoice': t.profile_invoice,
        '/me/invoice/add': t.topbar_add_invoice,
        '/me/beans': t.settings_wechat_beans,
        '/services': t.me_services,
        '/settings': t.settings_title,
        '/settings/security': t.settings_account_security,
        '/settings/security/more': t.security_more_settings,
        '/settings/minor-mode': '',
        '/settings/care-mode': '',
        '/settings/notifications': t.settings_notifications,
        '/settings/notifications/display': t.topbar_banner_display,
        '/settings/notifications/sound': t.topbar_notification_sound,
        '/settings/notifications/ringtone': t.profile_ringtone,
        '/settings/chat': t.settings_chat,
        '/settings/general': t.settings_general,
        '/settings/general/dark-mode': t.settings_dark_mode,
        '/settings/general/translation': '',
        '/settings/general/media': t.topbar_media_files,
        '/settings/general/audio': t.discover_listen,
        '/settings/general/discover': '',
        '/settings/general/accessibility': t.settings_accessibility,
        '/settings/privacy/friends': t.discover_friend_permission,
        '/settings/privacy/add-me': t.topbar_add_me_methods,
        '/settings/privacy/moments': t.topbar_moments_permission,
        '/settings/privacy/top-stories': t.topbar_top_stories_permission,
        '/settings/privacy/personal': t.settings_personal_info,
        '/settings/privacy/authorization': '',
        '/settings/privacy/blacklist': t.topbar_blacklist,
        '/pay/wallet': text.wallet,
        '/pay/settings': text.paymentSettings,
        '/settings/subscriptions': text.autoRenew,
        '/user-profile': '',
        '/friend-info': t.contacts_friend_info,
        '/wechat-sports': t.settings_wechat_sports,
        '/wechat-sports/leaderboard': t.topbar_leaderboard,
        '/wechat-sports/profile': t.topbar_my_profile,
        '/wechat-sports/privacy': t.topbar_privacy_settings,
        '/discover/nearby': t.discover_nearby
    };

    if (path.startsWith('/settings/general/discover/')) {
        const id = path.split('/').pop();
        const names: any = { moments: t.discover_moments, channels: t.discover_channels, live: t.discover_live, scan: t.discover_scan, listen: t.discover_listen, topStories: t.discover_watch, search: t.discover_search, nearby: t.discover_nearby, games: t.discover_games };
        title = names[id || ''] || t.discover_management;
    } else if (path.startsWith('/settings/general/accessibility/')) {
        const id = path.split('/').pop();
        const names: any = { tencentNews: t.accessibility_tencent_news, broadcast: t.accessibility_broadcast, qqMail: t.accessibility_qq_mail, wechatSports: t.settings_wechat_sports, wechatPay: t.accessibility_wechat_pay, wechatGames: t.accessibility_wechat_games };
        title = names[id || ''] || t.settings_accessibility;
    } else if (path.startsWith('/wechat-sports/profile/')) {
        title = t.topbar_sports_profile;
    } else if (isUserProfilePage) {
        title = '';
    } else if (isFriendInfoPage) {
        title = t.contacts_friend_info;
    } else if (isIndividualMomentsPage) {
        title = '';
        bgClass = 'bg-transparent';
        // 个人朋友圈页顶部是透明浮层，但仍必须为系统状态栏预留安全区（pt-10），避免返回键/按钮被遮挡
        containerStyle = "pt-10 h-(--app-item-height-80) flex items-center justify-between px-4 absolute top-0 left-0 right-0 z-[100]";
        // 注意：该气泡目前无功能，仅作展示；按规范不得打标 data-trigger/data-action
        rightContent = isMyMomentsPage ? (
            <div className="text-white opacity-90">
                <IcMessage size={dimens.icSizeTab} className="text-white" fill="white" />
            </div>
        ) : null;
    } else if (path.startsWith('/settings/privacy/authorization/')) {
        title = '';
    } else if (path.startsWith('/friend-settings/')) {
        title = text.friendSettings;
    } else if (path.startsWith('/friend-permissions-detail/')) {
        title = t.discover_friend_permission;
    } else if (path.startsWith('/settings/subscriptions/')) {
        title = '';
    } else {
        title = titleMap[path] ?? title;
    }

    if (['/', '/contacts', '/discover'].includes(path)) {
        // 规范：避免 bindTap(变量ID)，用字面量绑定，确保静态工具可发现入口。
        const plusMenuTapProps =
            path === '/' ? bindTap<HTMLDivElement>('home.menu.plus.open', { stopPropagation: true }) :
            path === '/contacts' ? bindTap<HTMLDivElement>('contacts.menu.plus.open', { stopPropagation: true }) :
            path === '/discover' ? bindTap<HTMLDivElement>('discover.menu.plus.open', { stopPropagation: true }) :
            null;
        rightContent = (
            <div className="flex items-center gap-4 relative">
                <div
                    {...bindTap<HTMLDivElement>('search.open')}
                    className="text-app-text active:opacity-60 cursor-pointer"
                >
                    <IcSearch size={dimens.icSizeToolbar} />
                </div>
                {plusMenuTapProps ? (
                    <div
                        {...plusMenuTapProps}
                        className="text-app-text active:opacity-60 cursor-pointer"
                    >
                        <IcAddCircle size={dimens.icSizeToolbar} />
                    </div>
                ) : null}
            </div>
        );
    } else if (path === '/moments') {
        const hasMomentDraft =
            Boolean(momentDraft.content?.trim()) ||
            (momentDraft.selectedImages?.length ?? 0) > 0 ||
            Boolean(momentDraft.location);

        const cameraLongPressProps = bindLongPress<HTMLDivElement>('moments.post.open.longPress', {
            duration: 800,
            onLongPressEnd: (_event, triggered) => {
                if (triggered) cameraLongPressTriggeredRef.current = true;
            },
        });
        const cameraTapBinding = hasMomentDraft
            ? bindTap<HTMLDivElement>('moments.post.open.fromDraft')
            : bindTap<HTMLDivElement>('moments.menu.camera.open');

        const { onClick: triggerTap, ...cameraTapProps } = cameraTapBinding;
        rightContent = (
            <div
                {...cameraLongPressProps}
                className="active:opacity-60 cursor-pointer"
            >
                <div
                    {...cameraTapProps}
                    onClick={(event) => {
                        // 如果刚刚触发过长按，释放后产生的 click 直接忽略
                        if (cameraLongPressTriggeredRef.current) {
                            cameraLongPressTriggeredRef.current = false;
                            return;
                        }
                        // 有草稿时：直接进入发表页，不打开相机菜单
                        if (hasMomentDraft) {
                            triggerTap?.(event);
                            return;
                        }
                        // 避免重复打开同一个 menu 状态导致 from 校验失败
                        if (searchParams.get('menu') === 'camera') return;
                        triggerTap?.(event);
                    }}
                >
                    <IcCamera size={dimens.icSizeToolbar} className="text-app-text" />
                </div>
            </div>
        );
    } else if (path === '/settings/privacy/authorization') {
        rightContent = <IcSearch size={dimens.icSizeToolbar} className="text-app-text active:opacity-60 cursor-pointer" />;
    } else if (path === '/me/qrcode' || isUserProfilePage || path.startsWith('/chat/')) {
        if (path.endsWith('/info')) {
            title = text.chatInfo;
            rightContent = null;
        } else {
            const chatId = path.split('/chat/')[1];
            const userIdFromProfile =
                isUserProfilePage ? (path.split('/')[2] || null) : new URLSearchParams(location.search).get('id');
            const targetId = chatId || userIdFromProfile;

            if (isUserProfilePage) {
                const canOpenFriendSettings = !!targetId && targetId !== user.wxid;
                rightContent = canOpenFriendSettings ? (
                    <div
                        {...bindTap<HTMLDivElement>('friendSettings.open', { params: { id: targetId } })}
                        className="text-app-text active:opacity-60 cursor-pointer"
                    >
                        <IcMore size={dimens.icSizeTab} />
                    </div>
                ) : null;
            } else if (path.startsWith('/chat/')) {
                rightContent = chatId ? (
                    <div
                        {...bindTap<HTMLDivElement>('chatInfo.open', { params: { id: chatId } })}
                        className="text-app-text active:opacity-60 cursor-pointer"
                    >
                        <IcMore size={dimens.icSizeTab} />
                    </div>
                ) : null;
            }
        }
    } else if (path === '/pay/wallet') {
        rightContent = (
            <span className="text-(--app-settings-item-text-size) text-app-text">{text.bills}</span>
        );
    } else if (path.startsWith('/settings/subscriptions/')) {
        rightContent = (
            <div className="text-app-text">
                <IcMore size={dimens.icSizeTab} />
            </div>
        );
    } else if (rightAction && !isIndividualMomentsPage) {
        const buttonText = path === '/post-moment' || path === '/post-text-moment' ? text.post : text.done;
        const rightActionProps = rightAction.id
            ? bindTap<HTMLButtonElement>(
                { kind: 'action', id: rightAction.id },
                { params: rightAction.params, onTrigger: rightAction.onTrigger },
              )
            : { onClick: () => rightAction.onTrigger() };
        rightContent = (
            <button
                {...rightActionProps}
                className="bg-app-primary text-white px-3 py-1 rounded-[4px] text-sm font-medium active:opacity-80 cursor-pointer"
            >
                {buttonText}
            </button>
        );
    }

    const backBtnColor = isIndividualMomentsPage ? 'text-white' : 'text-app-text';

    if (path.startsWith('/chat/') && !path.endsWith('/info')) {
        const chatId = path.split('/chat/')[1];
        const chat = chats.find(c => c.id === chatId);
        const peer = chat?.user ?? resolveChatPeerByWxid(chatId, contacts);
        const name = peer?.name ?? t.chat_title;
        title = (
            <div className="flex items-center gap-1">
                <span>{name}</span>
                <IcEar size={dimens.icSizeTiny} className="text-(--app-c-tw-text-gray-300)" strokeWidth={3} />
            </div>
        );
    }

    if (path === '/camera' || path === '/edit-image' || path === '/radar' || path === '/scan' || isChatMediaPickerPage) return null;

    return (
        <div className={`${containerStyle} ${bgClass}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
            <div className="flex-1 flex items-center z-10">
                {!isMainTab && (
                    <button
                        {...(path === '/post-moment'
                            ? bindBack<HTMLButtonElement>({
                                stopPropagation: true,
                                onTrigger: () => {
                                  window.dispatchEvent(
                                    new CustomEvent(POST_MOMENT_TRY_EXIT_EVENT),
                                  );
                                },
                              })
                            : path === '/post-text-moment'
                            ? bindBack<HTMLButtonElement>({
                                stopPropagation: true,
                                onTrigger: () => {
                                  window.dispatchEvent(
                                    new CustomEvent(POST_TEXT_MOMENT_TRY_EXIT_EVENT),
                                  );
                                },
                              })
                            : bindBack<HTMLButtonElement>({ stopPropagation: true }))}
                        className={`flex items-center -ml-2 ${backBtnColor} active:opacity-60 cursor-pointer`}
                    >
                        <IcNavBack size={dimens.icSizeNav} />
                    </button>
                )}
            </div>
            <div className="absolute left-0 right-0 flex h-full min-w-0 items-center justify-center px-16 pointer-events-none">
                <div className={`max-w-full truncate text-center font-medium text-(--app-settings-item-text-size) tracking-wide ${isIndividualMomentsPage ? 'text-white' : 'text-app-text'}`}>{title}</div>
            </div>
            <div className="flex-1 flex justify-end items-center gap-4 z-10">{rightContent}</div>
        </div>
    );
};

export default TopBar;
