import React, { useCallback, useEffect, useContext, useRef } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import {
  MemoryRouter,
  useNavigate,
  useLocation,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { useRedditStore } from './state';
import { preload as preloadRedditPosts } from './data/loader';
import { HomePage } from './pages/HomePage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { ChatPage } from './pages/ChatPage';
import { NewChatPage } from './pages/NewChatPage';
import { ChatThreadPage } from './pages/ChatThreadPage';
import { ChatMessageThreadPage } from './pages/ChatMessageThreadPage';
import { PostCommentsPage } from './pages/PostCommentsPage';
import { CommentReplyPage } from './pages/CommentReplyPage';
import { CommentEditPage } from './pages/CommentEditPage';
import { InboxPage } from './pages/InboxPage';
import { CreatePage } from './pages/CreatePage';
import { SelectCommunityPage } from './pages/SelectCommunityPage';
import { ProfilePage } from './pages/ProfilePage';
import { EditProfilePage } from './pages/EditProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SearchPage } from './pages/SearchPage';
import { BottomTabBar } from './components/BottomTabBar';
import { useAppNavigate } from './navigation';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';

const RedditNavigationHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { back } = useAppNavigate();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);
  
  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);
  
  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex =
      typeof memoryNavigator.index === 'number' ? memoryNavigator.index : historyIndexRef.current;
    if (currentIndex > 0) {
      back();
      return true;
    }
    return false;
  }, [back, navigator]);

  useAppNavigationHandler('reddit', {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      try {
        navigateToPath(path);
      } catch {
        console.error('[Reddit.onNavigate] invalid path:', path);
      }
    },
  });
  
  return null;
};

const RedditLayout: React.FC = () => {
  const { pathname, search } = useLocation();
  
  // Define main tabs for persistent rendering
  const isHome = pathname === '/';
  const isCommunities = pathname === '/communities';
  const isChatThread = /^\/chat\/[^/]+$/.test(pathname) && pathname !== '/chat/new';
  const isChatMessageThread = /^\/chat\/[^/]+\/thread\/[^/]+$/.test(pathname);
  const isChat = pathname === '/chat' || pathname === '/chat/new';
  const isInbox = pathname === '/inbox';
  const isCreate = pathname === '/create';
  const isSelectCommunity = pathname === '/create/community';
  const isProfile = pathname === '/me';
  const isEditProfile = pathname === '/me/edit';
  const isSettings = pathname === '/me/settings';
  const isUserProfile = /^\/user\/[^/]+$/.test(pathname);
  const isChatNew = pathname === '/chat/new';
  const isCommentReply = /^\/post\/[^/]+\/reply\/[^/]+$/.test(pathname);
  const isCommentEdit = /^\/post\/[^/]+\/edit\/[^/]+$/.test(pathname);
  const isPostComments = pathname.startsWith('/post/') && !isCommentReply && !isCommentEdit;
  const isSearch = pathname === '/search';
  const statusBarForeground =
    isProfile || isUserProfile || isPostComments ? 'light' : 'dark';
  
  const isDrawerOpen = new URLSearchParams(search).get('menu') === 'drawer';
  const showTabBar =
    !isCreate &&
    !isSelectCommunity &&
    !isDrawerOpen &&
    !isChatNew &&
    !isChatThread &&
    !isChatMessageThread &&
    !isPostComments &&
    !isCommentReply &&
    !isCommentEdit &&
    !isEditProfile &&
    !isSettings &&
    !isSearch;

  return (
    <div
      className="flex flex-col h-full bg-white"
      data-status-bar-foreground={statusBarForeground}
    >
      <div className="flex-1 overflow-hidden relative">
        <div style={{ display: isHome ? 'block' : 'none', height: '100%' }}>
          <HomePage />
        </div>
        <div style={{ display: isCommunities ? 'block' : 'none', height: '100%' }}>
          <CommunitiesPage />
        </div>
        <div style={{ display: isChat ? 'block' : 'none', height: '100%' }}>
          <ChatPage />
        </div>
        <div style={{ display: isInbox ? 'block' : 'none', height: '100%' }}>
          <InboxPage />
        </div>
        <div style={{ display: isProfile ? 'block' : 'none', height: '100%' }}>
          <ProfilePage />
        </div>
        <div style={{ display: isUserProfile ? 'block' : 'none', height: '100%' }}>
          <UserProfilePage />
        </div>
        
        {isEditProfile && (
          <div className="absolute inset-0 bg-white z-50">
            <EditProfilePage />
          </div>
        )}

        {isSettings && (
          <div className="absolute inset-0 bg-white z-50">
            <SettingsPage />
          </div>
        )}

        {isCreate && (
          <div className="absolute inset-0 bg-white z-50">
             <CreatePage />
          </div>
        )}

        {isSelectCommunity && (
          <div className="absolute inset-0 bg-white z-50">
            <SelectCommunityPage />
          </div>
        )}

        {isChatNew && (
          <div className="absolute inset-0 bg-white z-50">
            <NewChatPage />
          </div>
        )}

        {isChatThread && (
          <div className="absolute inset-0 bg-white z-50">
            <ChatThreadPage />
          </div>
        )}

        {isChatMessageThread && (
          <div className="absolute inset-0 bg-white z-50">
            <ChatMessageThreadPage />
          </div>
        )}

        {isPostComments && (
          <div className="absolute inset-0 bg-white z-50">
            <PostCommentsPage />
          </div>
        )}

        {isCommentReply && (
          <div className="absolute inset-0 bg-white z-50">
            <CommentReplyPage />
          </div>
        )}

        {isCommentEdit && (
          <div className="absolute inset-0 bg-white z-50">
            <CommentEditPage />
          </div>
        )}

        {isSearch && (
          <div className="absolute inset-0 bg-white z-50">
            <SearchPage />
          </div>
        )}
      </div>
      
      {showTabBar && <BottomTabBar />}
    </div>
  );
};

const RedditApp: React.FC = () => {
  const { isDark } = useDarkMode();

  // Side-effect: trim user comments on mount and whenever comments change
  const commentIds = useRedditStore((s) => s.user.commentIds);
  const trimUserComments = useRedditStore((s) => s.trimUserComments);
  useEffect(() => {
    trimUserComments();
  }, [commentIds, trimUserComments]);

  // Kick off lazy fixture posts load on mount; the useFixturePosts hooks
  // subscribe via useSyncExternalStore and re-render when the cache flips.
  useEffect(() => {
    void preloadRedditPosts();
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
    <div className="h-full w-full overflow-hidden" style={cssVars as React.CSSProperties}>
      <MemoryRouter initialEntries={['/']}>
        <RedditNavigationHandler />
        <RedditLayout />
      </MemoryRouter>
    </div>
  );
};

export default RedditApp;
