import React, { useEffect } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { preload } from './data/loader';
import { RedBookNavigationHandler } from './components/RedBookNavigationHandler';
import { Layout } from './pages/Layout';
import { DetailPage } from './pages/DetailPage';
import { PublishTextEntryPage } from './pages/publish/PublishTextEntryPage';
import { PublishTextTemplatePage } from './pages/publish/PublishTextTemplatePage';
import { PublishTextFinalPage } from './pages/publish/PublishTextFinalPage';
import { SearchPage } from './pages/SearchPage';
import { ChatPage } from './pages/ChatPage';
import { ChatSettingsPage } from './pages/ChatSettingsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountSecurityPage } from './pages/AccountSecurityPage';
import { GeneralSettingsPage } from './pages/GeneralSettingsPage';
import { StoragePage } from './pages/StoragePage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import PrivateMessageSettingsPage from './pages/notification/PrivateMessageSettingsPage';
import FollowUpdatesPage from './pages/notification/FollowUpdatesPage';
import LiveStreamReminderPage from './pages/notification/LiveStreamReminderPage';
import ContentRecommendationPage from './pages/notification/ContentRecommendationPage';
import UserRecommendationPage from './pages/notification/UserRecommendationPage';
import OtherNotificationsPage from './pages/notification/OtherNotificationsPage';
import InAppBannerPage from './pages/notification/InAppBannerPage';
import LanguageSettingsPage from './pages/LanguageSettingsPage';
import PrivacySettingsPage from './pages/PrivacySettingsPage';
import OnlineStatusPage from './pages/privacy/OnlineStatusPage';
import MessagePermissionPage from './pages/privacy/MessagePermissionPage';
import CollectPrivacyPage from './pages/privacy/CollectPrivacyPage';
import CommentPrivacyPage from './pages/privacy/CommentPrivacyPage';
import FindMeWayPage from './pages/privacy/FindMeWayPage';
import FollowListPrivacyPage from './pages/privacy/FollowListPrivacyPage';
import SystemPermissionPage from './pages/privacy/SystemPermissionPage';
import PersonalizationPage from './pages/privacy/PersonalizationPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { FollowListPage } from './pages/FollowListPage';
import { UserPage } from './pages/UserPage';
import { LikesAndCollectionsPage } from './pages/LikesAndCollectionsPage';
import { NewFollowersPage } from './pages/NewFollowersPage';
import { CommentsAndAtPage } from './pages/CommentsAndAtPage';
import { AddFriendPage } from './pages/AddFriendPage';
import { HistoryPage } from './pages/HistoryPage';

export const RedBookApp: React.FC = () => {
  const { isDark } = useDarkMode();
  // base dataset 的加载已经由 OS 的 lazy() + Suspense + AppLaunchSplash 三件套
  // 在 component mount **之前**完成（见 os/data/appRegistry.tsx 的 lazy 包装）。
  // 到这里 mount 时 `getBaseDataset()` 必非 null，无需 in-app gate / splash。
  // 保留 useEffect(preload()) 作幂等兜底：极少数路径（hot reload / 直接 mount）
  // 可能绕过 OS lazy，preload() 内部有 cache 短路，重复调用零成本。
  useEffect(() => {
    void preload();
  }, []);

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
      <style>{`
        * {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
      <MemoryRouter initialEntries={['/?tab=discover']}>
        <RedBookNavigationHandler />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div />} /> {/* Persistent HomePage is handled in Layout */}
            <Route path="market" element={<div />} /> {/* Persistent ShopPage (Market) is handled in Layout */}
            <Route path="message" element={<div />} /> {/* Persistent Message is handled in Layout */}
            <Route path="me" element={<div />} /> {/* Persistent MePage is handled in Layout */}
            
            <Route path="note/:id" element={<DetailPage />} />
            <Route path="publish/text" element={<PublishTextEntryPage />} />
            <Route path="publish/text/template" element={<PublishTextTemplatePage />} />
            <Route path="publish/text/final" element={<PublishTextFinalPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="chat/:userId" element={<ChatPage />} />
            <Route path="chat/:userId/settings" element={<ChatSettingsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/storage" element={<StoragePage />} />
            <Route path="settings/account" element={<AccountSecurityPage />} />
            <Route path="settings/general" element={<GeneralSettingsPage />} />
            <Route path="settings/notification" element={<NotificationSettingsPage />} />
            <Route path="settings/notification/private" element={<PrivateMessageSettingsPage />} />
            <Route path="settings/notification/follow" element={<FollowUpdatesPage />} />
            <Route path="settings/notification/live" element={<LiveStreamReminderPage />} />
            <Route path="settings/notification/content" element={<ContentRecommendationPage />} />
            <Route path="settings/notification/user" element={<UserRecommendationPage />} />
            <Route path="settings/notification/other" element={<OtherNotificationsPage />} />
            <Route path="settings/notification/banner" element={<InAppBannerPage />} />
            <Route path="settings/language" element={<LanguageSettingsPage />} />
            <Route path="settings/privacy" element={<PrivacySettingsPage />} />
            <Route path="settings/privacy/online-status" element={<OnlineStatusPage />} />
            <Route path="settings/privacy/message-permission" element={<MessagePermissionPage />} />
            <Route path="settings/privacy/collect" element={<CollectPrivacyPage />} />
            <Route path="settings/privacy/comment" element={<CommentPrivacyPage />} />
            <Route path="settings/privacy/find-me" element={<FindMeWayPage />} />
            <Route path="settings/privacy/follow-list" element={<FollowListPrivacyPage />} />
            <Route path="settings/privacy/system-permission" element={<SystemPermissionPage />} />
            <Route path="settings/privacy/personalization" element={<PersonalizationPage />} />
            <Route path="edit-profile" element={<EditProfilePage />} />
            <Route path="user/allUser" element={<FollowListPage />} />
            <Route path="user/:userId" element={<UserPage />} />
            <Route path="message/likes" element={<LikesAndCollectionsPage />} />
            <Route path="message/followers" element={<NewFollowersPage />} />
            <Route path="message/comments" element={<CommentsAndAtPage />} />
            <Route path="addfriend" element={<AddFriendPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </div>
  );
};

export default RedBookApp;
