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
  Outlet,
  Route,
  useNavigate,
  useLocation,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { ActivityRouteHost } from '../../os/components/ActivityRouteHost';
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
import { useNav } from '../../os/navigation';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';

const RedditNavigationHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = useNav(); const back = nav.back;
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
  
  const isChatThread = /^\/chat\/[^/]+$/.test(pathname) && pathname !== '/chat/new';
  const isChatMessageThread = /^\/chat\/[^/]+\/thread\/[^/]+$/.test(pathname);
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
        <Outlet />
      </div>

      {showTabBar && <BottomTabBar />}
    </div>
  );
};

/** The main tabs: one instance each, kept while you are on another tab (ActivityRouteHost). */
const MAIN_TAB_PATHS = ['/', '/communities', '/chat', '/inbox', '/me'] as const;

const tabPage = (page: React.ReactNode) => <div className="h-full">{page}</div>;
const fullPage = (page: React.ReactNode) => <div className="absolute inset-0 bg-white z-50">{page}</div>;

const RedditApp: React.FC = () => {
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
    <div className="h-full w-full overflow-hidden" style={cssVars as React.CSSProperties}>
      <MemoryRouter initialEntries={['/']}>
        <RedditNavigationHandler />
        {/* Pages below the top stay as they were left (Fragment back stack), see ActivityRouteHost. */}
        <ActivityRouteHost persistent={MAIN_TAB_PATHS}>
          <Route element={<RedditLayout />}>
            <Route path="/" element={tabPage(<HomePage />)} />
            <Route path="/communities" element={tabPage(<CommunitiesPage />)} />
            <Route path="/chat" element={tabPage(<ChatPage />)} />
            <Route path="/inbox" element={tabPage(<InboxPage />)} />
            <Route path="/me" element={tabPage(<ProfilePage />)} />
            <Route path="/user/:id" element={tabPage(<UserProfilePage />)} />
            <Route path="/me/edit" element={fullPage(<EditProfilePage />)} />
            <Route path="/me/settings" element={fullPage(<SettingsPage />)} />
            <Route path="/create" element={fullPage(<CreatePage />)} />
            <Route path="/create/community" element={fullPage(<SelectCommunityPage />)} />
            <Route path="/chat/new" element={fullPage(<NewChatPage />)} />
            <Route path="/chat/:id" element={fullPage(<ChatThreadPage />)} />
            <Route path="/chat/:id/thread/:threadId" element={fullPage(<ChatMessageThreadPage />)} />
            <Route path="/post/:id/reply/:commentId" element={fullPage(<CommentReplyPage />)} />
            <Route path="/post/:id/edit/:commentId" element={fullPage(<CommentEditPage />)} />
            <Route path="/post/*" element={fullPage(<PostCommentsPage />)} />
            <Route path="/search" element={fullPage(<SearchPage />)} />
          </Route>
        </ActivityRouteHost>
      </MemoryRouter>
    </div>
  );
};

export default RedditApp;
