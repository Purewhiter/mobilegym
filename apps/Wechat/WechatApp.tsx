
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useWechatStrings } from './hooks/useWechatStrings';
import { MemoryRouter as Router, Routes, Route, Outlet, useLocation, useNavigate, UNSAFE_NavigationContext, Navigate } from 'react-router-dom';
import { IcMessageSquare, IcUserAdd, IcScan, IcQrCode } from './res/icons';
import './styles/index.css';
import TopBar from './components/TopBar';
import TabBar from './components/TabBar';
import ChatList from './pages/ChatList';
import Contacts from './pages/Contacts';
import Me from './pages/Me';
import Services from './pages/Services';
import { ChatDetail } from './pages/chat/ChatDetail';
import { ChatInfo } from './pages/chat/ChatInfo';
import { ChatSearch } from './pages/chat/ChatSearch';
import { SelectFilePage } from './pages/chat/SelectFile';
import { NearbyPeople } from './pages/discover/NearbyPeople';
import { DiscoverPage } from './pages/discover/Discover';
import { MomentsFeed } from './pages/discover/MomentsFeed';
import { UserMoments } from './pages/discover/UserMoments';
import { PostMomentPage } from './pages/discover/PostMoment';
import { PostTextMomentPage } from './pages/discover/PostTextMoment';
import { MomentMediaPickerPage } from './pages/discover/MomentMediaPicker';
import { CameraView } from './pages/discover/CameraView';
import { EditImage } from './pages/discover/EditImage';
import { SelectLocationPage } from './pages/discover/SelectLocation';
import { ScanPage } from './pages/discover/ScanPage';
import { UserProfile } from './pages/contacts/UserProfile';
import { FriendInfoPage } from './pages/contacts/FriendInfo';
import { FriendSettingsPage } from './pages/contacts/FriendSettings';
import { FriendPermissionsDetailPage } from './pages/contacts/FriendPermissionsDetail';
import { BlacklistPage } from './pages/settings/Blacklist';
import { NewFriends } from './pages/contacts/NewFriends';
import { AddFriendPage } from './pages/contacts/AddFriend';
import { RadarPage } from './pages/contacts/RadarPage';
import { TagsPage } from './pages/contacts/Tags';
import { GroupsPage } from './pages/contacts/Groups';
import { SearchPage } from './pages/discover/Search';
import { ProfileDetail } from './pages/me/ProfileDetail';
import { MomentsAlbum } from './pages/me/MomentsAlbum';
import { SettingsPage } from './pages/settings/Settings';
import { SubscriptionsPage } from './pages/settings/Subscriptions';
import { SubscriptionDetailPage } from './pages/settings/SubscriptionDetailPage';
import { WalletPage } from './pages/pay/WalletPage';
import { PaymentSettingsPage } from './pages/pay/PaymentSettingsPage';
import { General, ChatSettings, NotificationSettings } from './pages/settings/GeneralFlow';
import { AccountSecurity, FriendPermissions, PersonalInfoPermissions } from './pages/settings/PrivacyFlow';
import { AddMeMethodsPage } from './pages/settings/AddMeMethods';
import { MomentsPermissionsPage } from './pages/settings/MomentsPermissions';
import { TopStoriesPermissionsPage } from './pages/settings/TopStoriesPermissions';
import { AuthorizationManagementPage } from './pages/settings/AuthorizationManagement';
import { AuthorizationDetailPage } from './pages/settings/AuthorizationDetail';
import { SecurityCenterPage, AccountDeletionPage, DataWarningPage, ImportantReminderPage } from './pages/settings/SecurityCenter';
import { MoreSecurityPage } from './pages/settings/MoreSecurityPage';
import { CareMode, MinorMode } from './pages/settings/Modes';
import { NotificationDisplayPage } from './pages/settings/NotificationDisplay';
import { NotificationSoundPage } from './pages/settings/NotificationSound';
import { IncomingRingtonePage } from './pages/settings/IncomingRingtone';
import { DarkModePage } from './pages/settings/DarkMode';
import { TranslationPage } from './pages/settings/Translation';
import { MediaAndFilesPage } from './pages/settings/MediaAndFiles';
import { AudioSettingsPage } from './pages/settings/AudioSettings';
import { DiscoverManagementPage } from './pages/settings/DiscoverManagement';
import { DiscoverItemDetailPage } from './pages/settings/DiscoverItemDetail';
import { AccessibilityPage } from './pages/settings/Accessibility';
import { AccessibilityDetailPage } from './pages/settings/AccessibilityDetail';
import {
  WechatSportsMain,
  SportsLeaderboard,
  SportsMyProfile,
  SportsFriendProfile,
  SportsPrivacySettings
} from './pages/settings/WechatSports';
import { ChangeNamePage } from './pages/me/profile/Name';
import { SetGenderPage } from './pages/me/profile/Gender';
import { RegionPage } from './pages/me/profile/Region';
import { PhonePage } from './pages/me/profile/Phone';
import { WxidPage } from './pages/me/profile/Wxid';
import { MyQrCodePage } from './pages/me/profile/QrCode';
import { PatPage } from './pages/me/profile/Pat';
import { SignaturePage } from './pages/me/profile/Signature';
import { AddressListPage, AddAddressPage } from './pages/me/general/Address';
import { InvoiceListPage, AddInvoicePage } from './pages/me/general/Invoice';
import { BeansPage } from './pages/me/Beans';
import { FaceToFaceGroupInput, FaceToFaceGroupJoin } from './pages/contacts/FaceToFaceGroup';
import { StartGroupPage } from './pages/contacts/StartGroup';
import WechatLoginPage from './pages/auth/Login';
import WechatRegisterPage from './pages/auth/Register';
import WechatForgotPasswordPage from './pages/auth/ForgotPassword';
import WechatTrustDevicePage from './pages/auth/TrustDevice';
import WechatDeviceManagementPage from './pages/auth/DeviceManagement';
import { PaymentConfirmationPage } from './pages/pay/PaymentConfirmationPage';
import { ShareForwardPage } from './pages/share/ShareForwardPage';
import { useAppNavigate } from './navigation';
import { useWechatGestures } from './hooks/useWechatGestures';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { AppNavigatorRegistry } from '../../os/AppNavigatorRegistry';
import { useActivityContext } from '../../os/ActivityContext';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { anim } from './res/anim';
import { dimens } from './res/dimens';
import { useWechatStore } from './state';
import * as TimeService from '../../os/TimeService';

const POST_MOMENT_TRY_EXIT_EVENT = 'wechat:postMoment:tryExit';
const POST_TEXT_MOMENT_TRY_EXIT_EVENT = 'wechat:postTextMoment:tryExit';

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loggedIn = useWechatStore(s => s.auth?.session?.loggedIn);
  const location = useLocation();

  if (!loggedIn) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
};

// 导航处理组件：跟踪 MemoryRouter 的历史深度
const WechatNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { go, back } = useAppNavigate();
  const { activityId } = useActivityContext();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  // 跟踪历史索引
  const historyIndexRef = useRef(0);

  useEffect(() => {
    // 监听导航变化来更新历史索引
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex = typeof memoryNavigator.index === 'number' ? memoryNavigator.index : historyIndexRef.current;

    // 优先处理“同一路由内的覆盖层状态”（避免直接 back 离开页面）
    const searchParams = new URLSearchParams(location.search);
    const menu = searchParams.get('menu');
    if (location.pathname === '/moments/media-picker' && menu === 'preview') {
      go('moments.mediaPicker.preview.close');
      return true;
    }
    if (/^\/chat\/[^/]+\/media-picker$/.test(location.pathname) && menu === 'preview') {
      const chatId = location.pathname.match(/^\/chat\/([^/]+)\/media-picker$/)?.[1];
      if (chatId) {
        go('chat.mediaPicker.preview.close', { id: chatId });
        return true;
      }
    }

    // 朋友圈发表页：若存在内容，返回时弹窗确认“是否保留此次编辑”
    // 说明：该确认弹窗属于局部 UI，不进入导航声明/路由图。
    if (location.pathname === '/post-moment') {
      window.dispatchEvent(new CustomEvent(POST_MOMENT_TRY_EXIT_EVENT));
      return true;
    }
    if (location.pathname === '/post-text-moment') {
      window.dispatchEvent(new CustomEvent(POST_TEXT_MOMENT_TRY_EXIT_EVENT));
      return true;
    }

    if (currentIndex > 0) {
      back();
      return true;
    }
    return false;
  }, [back, go, location.pathname, location.search, navigator]);

  useEffect(() => {
    // 默认 replace=true（兼容 OS 内部 finishActivity/back 等"重置到根"的旧调用），
    // 但调用方显式传 { replace: false } 时尊重之 —— singleTask 启动需要 push 才能保留 '/' 在历史栈底。
    const navFn = (path: string, opts?: { replace?: boolean }) => {
      navigate(path, { replace: opts?.replace ?? true });
    };
    AppNavigatorRegistry.registerActivity(activityId, { navigate: navFn, back: handleBackPress }, 'wechat');

    return () => {
      AppNavigatorRegistry.unregisterActivity(activityId);
    };
  }, [activityId, handleBackPress, navigate]);

  useAppNavigationHandler('wechat', { onBack: handleBackPress });

  return null;
};

const Layout = () => {
  const t = useWechatStrings();
  const location = useLocation();
  const path = location.pathname;
  const { bindTap, bindBack } = useWechatGestures();

  const searchParams = new URLSearchParams(location.search);
  const isMainTab = ['/', '/contacts', '/discover', '/me'].includes(path);

  const showPlusMenu = isMainTab && searchParams.get('menu') === 'plus';
  const showCameraMenu = (path === '/moments' || path.startsWith('/moments/')) && searchParams.get('menu') === 'camera';

  const showTabs = isMainTab;
  const isMePage = path === '/me';
  const isIndividualMomentsPage = path.startsWith('/moments/') && path !== '/moments';
  const isMomentsPage = path === '/moments' || path.startsWith('/moments/');
  const isChatSearchPage = /^\/chat\/[^/]+\/chat-search$/.test(path);
  const isChatMediaPickerPage = /^\/chat\/[^/]+\/media-picker$/.test(path);
  const isChatSelectFilePage = /^\/chat\/[^/]+\/select-file$/.test(path);
  const isChatImagePreview = /^\/chat\/[^/]+$/.test(path) && searchParams.get('view') === 'preview';
  const isSpecialFullScreen = [
    '/camera',
    '/edit-image',
    '/search',
    '/radar',
    '/scan',
    '/start-group',
    '/face-to-face-group',
    '/face-to-face-group/join',
    '/moments/media-picker',
    '/settings/security-center',
    '/settings/security-center/delete-account',
    '/settings/security-center/delete-account/data-warning',
    '/settings/security-center/delete-account/confirm',
  ].includes(path) || isChatSearchPage || isChatMediaPickerPage || isChatSelectFilePage || isChatImagePreview;

  const visitedTabs = React.useRef<Set<string>>(new Set([path]));
  if (isMainTab && !visitedTabs.current.has(path)) {
    visitedTabs.current.add(path);
  }

  return (
    <div className="relative w-full h-full bg-app-bg flex flex-col overflow-hidden">
      {!isSpecialFullScreen && !isMePage && (
        <div className="absolute left-0 right-0 z-50 top-0">
          <TopBar />
        </div>
      )}

      <div className={`flex-1 relative z-0 w-full overflow-hidden
          ${isMomentsPage || path === '/post-moment' || isSpecialFullScreen || path === '/me/qrcode' ? 'bg-app-surface' : ''}`}
        style={{
          paddingBottom: showTabs ? '56px' : '0'
        }}>

        {/* Main Tabs: Always mounted using CSS display to preserve state */}
        <div
          data-scroll-container="main"
          data-scroll-direction="vertical"
          className="h-full overflow-y-auto no-scrollbar"
          style={{ display: path === '/' ? 'block' : 'none', paddingTop: '92px' }}
        >
          <ChatList />
        </div>

        {(visitedTabs.current.has('/contacts') || path === '/contacts') && (
          <div
            className="h-full overflow-hidden"
            style={{ display: path === '/contacts' ? 'block' : 'none', paddingTop: '88px' }}
          >
            <Contacts />
          </div>
        )}

        {(visitedTabs.current.has('/discover') || path === '/discover') && (
          <div
            data-scroll-container="main"
            data-scroll-direction="vertical"
            className="h-full overflow-y-auto no-scrollbar"
            style={{ display: path === '/discover' ? 'block' : 'none', paddingTop: '88px' }}
          >
            <DiscoverPage />
          </div>
        )}

        {(visitedTabs.current.has('/me') || path === '/me') && (
          <div
            data-scroll-container="main"
            data-scroll-direction="vertical"
            className="h-full overflow-y-auto no-scrollbar"
            style={{ display: path === '/me' ? 'block' : 'none' }}
          >
            <Me />
          </div>
        )}

        {/* Sub-pages: Use Outlet as usual */}
        {!isMainTab && (
          <div
            data-scroll-container="main"
            data-scroll-direction="vertical"
            className="h-full overflow-y-auto no-scrollbar"
            style={{ paddingTop: (isSpecialFullScreen || isIndividualMomentsPage) ? '0' : '88px' }}
          >
            <Outlet />
          </div>
        )}
      </div>

      {showTabs && <div className="absolute bottom-0 left-0 right-0 z-[60]"><TabBar /></div>}

      {showPlusMenu && (
        <div className="absolute top-8 bottom-0 left-0 right-0 z-[200]">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-transparent"
          ></div>
          <div className="absolute top-[48px] right-2 w-(--app-modal-width-160) bg-(--app-c-overlay-dark-item-hover) rounded-[4px] shadow-xl animate-fade-in py-1">
            <div className="absolute top-[-6px] right-[10px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-(--app-c-wechat-app-border-bottom-4c4c)"></div>

            <div className="flex items-center px-4 py-3 active:bg-white/10 gap-3 border-b border-white/10 cursor-pointer"
              {...bindTap<HTMLDivElement>('plusMenu.startGroup.open', { stopPropagation: true })}>
              <IcMessageSquare size={dimens.icSizePlusMenu} className="text-white" fill="white" />
              <span className="text-white text-(--app-wechat-app-text-size-16)">{t.contacts_start_group}</span>
            </div>
            <div className="flex items-center px-4 py-3 active:bg-white/10 gap-3 border-b border-white/10 cursor-pointer"
              {...bindTap<HTMLDivElement>('plusMenu.addFriend.open')}>
              <IcUserAdd size={dimens.icSizePlusMenu} className="text-white" />
              <span className="text-white text-(--app-wechat-app-text-size-16)">{t.contacts_add_friend}</span>
            </div>
            <div
              className="flex items-center px-4 py-3 active:bg-white/10 gap-3 border-b border-white/10 cursor-pointer"
              {...bindTap<HTMLDivElement>('plusMenu.scan.open')}
            >
              <IcScan size={dimens.icSizePlusMenu} className="text-white" />
              <span className="text-white text-(--app-wechat-app-text-size-16)">{t.discover_scan}</span>
            </div>
            <div className="flex items-center px-4 py-3 active:bg-white/10 gap-3 cursor-pointer"
              onClick={() => { }}>
              <IcQrCode size={dimens.icSizePlusMenu} className="text-white" />
              <span className="text-white text-(--app-wechat-app-text-size-16)">{t.me_pay}</span>
            </div>
          </div>
        </div>
      )}

      {showCameraMenu && (
        <div className="absolute inset-0 z-[200] flex flex-col justify-end">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-black/50 transition-opacity"
          ></div>
          <div className="relative bg-(--app-c-chat-input-bar-bg) rounded-t-[12px] overflow-hidden animate-slide-up w-full">
            <button
              {...bindTap<HTMLButtonElement>('moments.camera.open')}
              className="w-full bg-app-surface h-16 flex flex-col items-center justify-center border-b border-(--app-c-tw-border-gray-100) active:bg-(--app-c-tw-bg-gray-50)"
            >
              <span className="text-(--app-title-text-size-17) text-black">{t.moments_shoot}</span>
              <span className="text-(--app-hint-text-size-12) text-(--app-c-tw-text-gray-400)">{t.moments_photo_video}</span>
            </button>
            <button
              {...bindTap<HTMLButtonElement>('moments.post.open.fromAlbum', {
                stopPropagation: true,
                params: { albumId: 'all' },
              })}
              className="w-full bg-app-surface h-16 flex items-center justify-center active:bg-(--app-c-tw-bg-gray-50)"
            >
              <span className="text-(--app-title-text-size-17) text-black">{t.moments_from_album}</span>
            </button>
            <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>
            <button
              {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
              className="w-full bg-app-surface h-16 flex items-center justify-center active:bg-(--app-c-tw-bg-gray-50)"
            >
              <span className="text-(--app-title-text-size-17) text-black font-medium">{t.common_cancel}</span>
            </button>
            <div className="h-6 bg-app-surface"></div>
          </div>
        </div>
      )}
    </div>
  );
};

/** 定时检测 session 是否过期，过期时设 showLoginExpiredModal: true 并标记 loggedIn: false */
const SessionExpiryWatcher: React.FC = () => {
  const auth = useWechatStore(s => s.auth);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = useWechatStore.getState();
      const expiresAt = s.auth?.session?.expiresAt;
      if (!expiresAt || typeof expiresAt !== 'number') return;
      if (!s.auth?.session?.loggedIn) return;
      const now = TimeService.now();
      if (now <= expiresAt) return;
      useWechatStore.setState({
        auth: {
          ...s.auth,
          session: {
            ...s.auth.session,
            loggedIn: false,
            lastExpiredAt: now,
          },
          showLoginExpiredModal: true,
        },
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
};

/** 登录环境异常失效时的通知弹窗（样式：白底圆角、横线分隔、取消/确定） */
const LoginExpiredModalLayer: React.FC = () => {
  const t = useWechatStrings();
  const showModal = useWechatStore(s => s.auth?.showLoginExpiredModal);
  const dismissLoginExpiredModal = useWechatStore(s => s.dismissLoginExpiredModal);
  if (!showModal) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-lg w-[85%] max-w-[320px] overflow-hidden">
        <div className="p-5 text-left text-[15px] text-gray-800 leading-relaxed break-words [overflow-wrap:anywhere]">
          {t.login_expired_message}
        </div>
        <div className="flex border-t border-gray-100">
          <button
            type="button"
            className="flex-1 h-12 text-base text-gray-500 active:bg-gray-50"
            onClick={dismissLoginExpiredModal}
          >
            {t.login_expired_cancel}
          </button>
          <div className="w-px bg-gray-100" />
          <button
            type="button"
            className="flex-1 h-12 text-base text-[#576b95] font-medium active:bg-gray-50"
            onClick={dismissLoginExpiredModal}
          >
            {t.login_expired_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

const WechatLayout: React.FC = () => {
  return (
    <Router>
      <WechatNavigationHandler />
      <SessionExpiryWatcher />
      <LoginExpiredModalLayer />
      <Routes>
        <Route path="/auth/login" element={<WechatLoginPage />} />
        <Route path="/auth/register" element={<WechatRegisterPage />} />
        <Route path="/auth/forgot-password" element={<WechatForgotPasswordPage />} />
        <Route path="/auth/trust-device" element={<WechatTrustDevicePage />} />
        <Route path="/auth/devices" element={<WechatDeviceManagementPage />} />
        <Route path="/pay/confirmation" element={<PaymentConfirmationPage />} />
        <Route path="/share/forward" element={<ShareForwardPage />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<ChatList />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="new-friends" element={<NewFriends />} />
          <Route path="add-friend" element={<AddFriendPage />} />
          <Route path="radar" element={<RadarPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="discover/nearby" element={<NearbyPeople />} />
          <Route path="moments" element={<MomentsFeed />} />
          <Route path="moments/:wxid" element={<UserMoments />} />
          <Route path="moments/media-picker" element={<MomentMediaPickerPage />} />
          <Route path="chat/:id/media-picker" element={<MomentMediaPickerPage />} />
          <Route path="camera" element={<CameraView />} />
          <Route path="edit-image" element={<EditImage />} />
          <Route path="post-moment" element={<PostMomentPage />} />
          <Route path="post-text-moment" element={<PostTextMomentPage />} />
          <Route path="select-location" element={<SelectLocationPage />} />
          <Route path="me" element={<Me />} />
          <Route path="me/moments-album" element={<MomentsAlbum />} />
          <Route path="chat/:id" element={<ChatDetail />} />
          <Route path="chat/:id/info" element={<ChatInfo />} />
          <Route path="chat/:id/chat-search" element={<ChatSearch />} />
          <Route path="chat/:id/select-file" element={<SelectFilePage />} />
          <Route path="user-profile/:id" element={<UserProfile />} />
          <Route path="friend-info/:id" element={<FriendInfoPage />} />
          <Route path="friend-settings/:id" element={<FriendSettingsPage />} />
          <Route path="friend-permissions-detail/:id" element={<FriendPermissionsDetailPage />} />
          <Route path="services" element={<Services />} />
          <Route path="my-profile-detail" element={<ProfileDetail />} />

          <Route path="start-group" element={<StartGroupPage />} />
          <Route path="face-to-face-group" element={<FaceToFaceGroupInput />} />
          <Route path="face-to-face-group/join" element={<FaceToFaceGroupJoin />} />

          <Route path="me/name" element={<ChangeNamePage />} />
          <Route path="me/gender" element={<SetGenderPage />} />
          <Route path="me/region" element={<RegionPage />} />
          <Route path="me/phone" element={<PhonePage />} />
          <Route path="me/wxid" element={<WxidPage />} />
          <Route path="me/qrcode" element={<MyQrCodePage />} />
          <Route path="me/pat" element={<PatPage />} />
          <Route path="me/signature" element={<SignaturePage />} />
          <Route path="me/address" element={<AddressListPage />} />
          <Route path="me/address/add" element={<AddAddressPage />} />
          <Route path="me/invoice" element={<InvoiceListPage />} />
          <Route path="me/invoice/add" element={<AddInvoicePage />} />
          <Route path="me/beans" element={<BeansPage />} />

          <Route path="pay/wallet" element={<WalletPage />} />
          <Route path="pay/settings" element={<PaymentSettingsPage />} />

          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/subscriptions" element={<SubscriptionsPage />} />
          <Route path="settings/subscriptions/:id" element={<SubscriptionDetailPage />} />
          <Route path="settings/security" element={<AccountSecurity />} />
          <Route path="settings/security/more" element={<MoreSecurityPage />} />
          <Route path="settings/security-center" element={<SecurityCenterPage />} />
          <Route path="settings/security-center/delete-account" element={<AccountDeletionPage />} />
          <Route path="settings/security-center/delete-account/data-warning" element={<DataWarningPage />} />
          <Route path="settings/security-center/delete-account/confirm" element={<ImportantReminderPage />} />
          <Route path="settings/minor-mode" element={<MinorMode />} />
          <Route path="settings/care-mode" element={<CareMode />} />
          <Route path="settings/notifications" element={<NotificationSettings />} />
          <Route path="settings/notifications/display" element={<NotificationDisplayPage />} />
          <Route path="settings/notifications/sound" element={<NotificationSoundPage />} />
          <Route path="settings/notifications/ringtone" element={<IncomingRingtonePage />} />
          <Route path="settings/chat" element={<ChatSettings />} />
          <Route path="settings/general" element={<General />} />
          <Route path="settings/general/dark-mode" element={<DarkModePage />} />
          <Route path="settings/general/translation" element={<TranslationPage />} />
          <Route path="settings/general/media" element={<MediaAndFilesPage />} />
          <Route path="settings/general/audio" element={<AudioSettingsPage />} />
          <Route path="settings/general/discover" element={<DiscoverManagementPage />} />
          <Route path="settings/general/discover/:id" element={<DiscoverItemDetailPage />} />
          <Route path="settings/general/accessibility" element={<AccessibilityPage />} />
          <Route path="settings/general/accessibility/tencentNews" element={<AccessibilityDetailPage featureId="tencentNews" />} />
          <Route path="settings/general/accessibility/broadcast" element={<AccessibilityDetailPage featureId="broadcast" />} />
          <Route path="settings/general/accessibility/qqMail" element={<AccessibilityDetailPage featureId="qqMail" />} />
          <Route path="settings/general/accessibility/wechatSports" element={<AccessibilityDetailPage featureId="wechatSports" />} />
          <Route path="settings/general/accessibility/wechatPay" element={<AccessibilityDetailPage featureId="wechatPay" />} />
          <Route path="settings/general/accessibility/wechatGames" element={<AccessibilityDetailPage featureId="wechatGames" />} />
          <Route path="settings/privacy/friends" element={<FriendPermissions />} />
          <Route path="settings/privacy/blacklist" element={<BlacklistPage />} />
          <Route path="settings/privacy/add-me" element={<AddMeMethodsPage />} />
          <Route path="settings/privacy/moments" element={<MomentsPermissionsPage />} />
          <Route path="settings/privacy/top-stories" element={<TopStoriesPermissionsPage />} />
          <Route path="settings/privacy/personal" element={<PersonalInfoPermissions />} />
          <Route path="settings/privacy/authorization" element={<AuthorizationManagementPage />} />
          <Route path="settings/privacy/authorization/:id" element={<AuthorizationDetailPage />} />

          <Route path="wechat-sports" element={<WechatSportsMain />} />
          <Route path="wechat-sports/leaderboard" element={<SportsLeaderboard />} />
          <Route path="wechat-sports/profile" element={<SportsMyProfile />} />
          <Route path="wechat-sports/profile/:id" element={<SportsFriendProfile />} />
          <Route path="wechat-sports/privacy" element={<SportsPrivacySettings />} />
        </Route>
      </Routes>
    </Router>
  );
};


export const WechatApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <WechatLayout />
    </div>
  );
};

export default WechatApp;
