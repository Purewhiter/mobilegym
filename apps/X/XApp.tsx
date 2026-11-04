import React, { useCallback, useEffect, useContext, useRef } from 'react';
import {
  MemoryRouter,
  Route,
  useNavigate,
  useLocation,
  Outlet,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { RouteScrollContainer } from '../../os/components/RouteScrollContainer';
import { ActivityRouteHost } from '../../os/components/ActivityRouteHost';
import { IcTabHome, IcTabSearch, IcTabNotifications, IcTabMessages, IcTabGrok } from './res/icons';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SearchInputPage } from './pages/SearchInputPage';
import { ComposePage } from './pages/ComposePage';
import { ChatPage } from './pages/ChatPage';
import { GrokPage } from './pages/GrokPage';
import { useNav } from '../../os/navigation';
import { useXGestures } from './hooks/useXGestures';
import { XDrawer } from './components/XDrawer';
import { ReplyPage } from './pages/ReplyPage';
import { UserConnectionsPage } from './pages/UserConnectionsPage';
import { PostDetailsPage } from './pages/PostDetailsPage';
import { PostActivityPage } from './pages/PostActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsAccountPage } from './pages/SettingsAccountPage';
import { SettingsAccountInfoPage } from './pages/SettingsAccountInfoPage';
import { SettingsPrivacyPage } from './pages/SettingsPrivacyPage';
import { SettingsPrivacyAudiencePage } from './pages/SettingsPrivacyAudiencePage';
import { SettingsPrivacyYourPostsPage } from './pages/SettingsPrivacyYourPostsPage';
import { SettingsPrivacyChatPage } from './pages/SettingsPrivacyChatPage';
import { SettingsPrivacySpacePage } from './pages/SettingsPrivacySpacePage';
import { SettingsPrivacyFindContactsPage } from './pages/SettingsPrivacyFindContactsPage';
import { SettingsPrivacyAboutAccountPage } from './pages/SettingsPrivacyAboutAccountPage';
import { SettingsSeenContentPage } from './pages/SettingsSeenContentPage';
import { SettingsSeenExplorePage } from './pages/SettingsSeenExplorePage';
import { SettingsNotificationsPage } from './pages/SettingsNotificationsPage';
import { SettingsNotificationPreferencesPage } from './pages/SettingsNotificationPreferencesPage';
import { SettingsNotificationPushPage } from './pages/SettingsNotificationPushPage';
import { SettingsNotificationFilterPage } from './pages/SettingsNotificationFilterPage';
import { SettingsTimelinePage } from './pages/SettingsTimelinePage';
import { SettingsTimelineInteractionsPage } from './pages/SettingsTimelineInteractionsPage';
import { SettingsTimelineHomeTagsPage } from './pages/SettingsTimelineHomeTagsPage';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { routes } from './routes';

const XNavigationHandler: React.FC = () => {
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

  const handleNavigate = useCallback((path: string, navigateToPath: (nextPath: string) => void) => {
    // 拒绝非法地址（不做静默 normalize）
    try {
      // 如果是 '/?tab=foryou' 这种相对路径，需要拼接一个 dummy host 才能被 URL 解析
      const fullPath = path.startsWith('http') ? path : `http://local${path.startsWith('/') ? '' : '/'}${path}`;
      const url = new URL(fullPath);
      const pathname = url.pathname;

      const isValid =
        pathname === '/' || // 允许根路径，即使没有 tab（HomePage 有默认值）
        pathname === '/search' ||
        pathname === '/search/input' ||
        pathname === '/notifications' ||
        pathname === '/messages' ||
        pathname === '/grok' ||
        pathname.startsWith('/user/') ||
        pathname === '/profile' ||
        pathname === '/compose' ||
        pathname.startsWith('/reply/') ||
        pathname.startsWith('/connections/') ||
        pathname.startsWith('/messages/') ||
        pathname.startsWith('/status/') ||
        pathname === '/settings' ||
        pathname.startsWith('/settings/');

      if (!isValid) {

        console.error('[X.onNavigate] invalid path:', path);
        return;
      }

      navigateToPath(path);
    } catch {

      console.error('[X.onNavigate] invalid path:', path);
    }
  }, []);

  useAppNavigationHandler('x', {
    onBack: handleBackPress,
    onNavigate: handleNavigate,
  });

  return null;
};

const ChildPageViewport: React.FC<React.PropsWithChildren<{ ownScroll?: boolean }>> = ({
  children,
  ownScroll = false,
}) => {
  const location = useLocation();
  // A sheet opened over the page (?sheet=retweet) keeps the page mounted: its search, tab and scroll stay.
  const pageSearch = new URLSearchParams(location.search);
  pageSearch.delete('sheet');
  pageSearch.delete('sheetPostId');
  const viewportKey = `${location.pathname}?${pageSearch.toString()}`;

  return (
    <div
      key={viewportKey}
      className={`absolute inset-0 h-full w-full bg-app-bg ${
        ownScroll ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'
      }`}
      data-scroll-container={ownScroll ? undefined : 'main'}
      data-scroll-direction={ownScroll ? undefined : 'vertical'}
    >
      {children}
    </div>
  );
};

function withChildPageViewport(
  element: React.ReactElement,
  options?: { ownScroll?: boolean },
) {
  return <ChildPageViewport ownScroll={options?.ownScroll}>{element}</ChildPageViewport>;
}

/** The main tabs: one instance each, kept while you are on another tab (ActivityRouteHost). */
const MAIN_TAB_PATHS = ['/', '/search', '/grok', '/notifications', '/messages'] as const;

const Layout = () => {
    const { pathname } = useLocation();
    const { bindNav } = useXGestures();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const isDrawerOpen = searchParams.get('menu') === 'drawer';

    const tabs = [
      { id: 'home', path: '/', icon: IcTabHome, tapProps: bindNav(routes.home, { search: { tab: 'foryou' }, replace: true }) },
      { id: 'search', path: '/search', icon: IcTabSearch, tapProps: bindNav(routes.search, { search: { tab: 'foryou' }, replace: true }) },
      { id: 'grok', path: '/grok', icon: IcTabGrok, tapProps: bindNav(routes.grok, { replace: true }) },
      {
        id: 'notifications',
        path: '/notifications',
        icon: IcTabNotifications,
        tapProps: bindNav(routes.notifications, { search: { tab: 'all' }, replace: true }),
      },
      { id: 'messages', path: '/messages', icon: IcTabMessages, tapProps: bindNav(routes.messages, { search: { tab: 'all' }, replace: true }) },
    ] as const;

    const isMainTab = (MAIN_TAB_PATHS as readonly string[]).includes(pathname);
    // Home scrolls its own feed; the other tabs scroll as a whole page.
    const tabScrolls = isMainTab && pathname !== '/';

    return (
        <div className="h-full flex flex-col bg-app-bg text-app-text">
            <XDrawer isOpen={isDrawerOpen} />
            <div className="flex-1 overflow-hidden relative">
                {/* Main tabs keep one instance each, child pages own their viewport (see ActivityRouteHost). */}
                {tabScrolls ? (
                    <RouteScrollContainer className="absolute inset-0 h-full w-full overflow-y-auto no-scrollbar">
                        <Outlet />
                    </RouteScrollContainer>
                ) : isMainTab ? (
                    <div className="absolute inset-0 h-full w-full overflow-hidden">
                        <Outlet />
                    </div>
                ) : (
                    <Outlet />
                )}
            </div>
            
            {/* Bottom Tab Bar - Only on main tabs */}
            {isMainTab && (
            <div className="w-full border-t border-app-border flex items-center justify-around bg-app-bg shrink-0 z-50 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = pathname === tab.path;
                    return (
                        <div 
                            key={tab.id} 
                            {...tab.tapProps}
                            className={`p-2 ${isActive ? 'text-app-text' : 'text-app-text-muted cursor-pointer'}`}
                        >
                            <Icon 
                                className="w-7 h-7" 
                                strokeWidth={isActive ? 2.5 : 2} 
                                fill={isActive && tab.id === 'home' ? 'currentColor' : 'none'}
                            />
                        </div>
                    );
                })}
                </div>
            )}
            
            {/* Home FAB 已迁移到 HomePage（便于工具链将触发点映射到 '/'） */}
        </div>
    );
};



export const XApp: React.FC = () => {
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
      <MemoryRouter initialEntries={['/?tab=foryou']}>
        <div className="h-full w-full">
          <XNavigationHandler />
          {/* Pages below the top stay as they were left (Fragment back stack), see ActivityRouteHost. */}
          <ActivityRouteHost persistent={MAIN_TAB_PATHS}>
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/messages/:id" element={<ChatPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="grok" element={<GrokPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="profile" element={withChildPageViewport(<ProfilePage />)} />
              <Route path="user/:id" element={withChildPageViewport(<UserProfilePage />)} />
              <Route path="connections/:id" element={withChildPageViewport(<UserConnectionsPage />)} />
              <Route
                path="search/input"
                element={withChildPageViewport(<SearchInputPage />, { ownScroll: true })}
              />
              <Route path="reply/:id" element={withChildPageViewport(<ReplyPage />, { ownScroll: true })} />
              <Route path="status/:id" element={withChildPageViewport(<PostDetailsPage />, { ownScroll: true })} />
              <Route
                path="status/:id/activity"
                element={withChildPageViewport(<PostActivityPage />, { ownScroll: true })}
              />
              <Route path="settings" element={withChildPageViewport(<SettingsPage />)} />
              <Route path="settings/account" element={withChildPageViewport(<SettingsAccountPage />)} />
              <Route
                path="settings/account/info"
                element={withChildPageViewport(<SettingsAccountInfoPage />)}
              />
              <Route path="settings/privacy" element={withChildPageViewport(<SettingsPrivacyPage />)} />
              <Route
                path="settings/privacy/audience"
                element={withChildPageViewport(<SettingsPrivacyAudiencePage />)}
              />
              <Route
                path="settings/privacy/your-posts"
                element={withChildPageViewport(<SettingsPrivacyYourPostsPage />)}
              />
              <Route
                path="settings/privacy/chat"
                element={withChildPageViewport(<SettingsPrivacyChatPage />)}
              />
              <Route
                path="settings/privacy/space"
                element={withChildPageViewport(<SettingsPrivacySpacePage />)}
              />
              <Route
                path="settings/privacy/find-contacts"
                element={withChildPageViewport(<SettingsPrivacyFindContactsPage />)}
              />
              <Route
                path="settings/privacy/about-account"
                element={withChildPageViewport(<SettingsPrivacyAboutAccountPage />)}
              />
              <Route
                path="settings/privacy/seen"
                element={withChildPageViewport(<SettingsSeenContentPage />)}
              />
              <Route
                path="settings/privacy/seen/explore"
                element={withChildPageViewport(<SettingsSeenExplorePage />)}
              />
              <Route
                path="settings/notifications"
                element={withChildPageViewport(<SettingsNotificationsPage />)}
              />
              <Route
                path="settings/notifications/preferences"
                element={withChildPageViewport(<SettingsNotificationPreferencesPage />)}
              />
              <Route
                path="settings/notifications/preferences/push"
                element={withChildPageViewport(<SettingsNotificationPushPage />)}
              />
              <Route
                path="settings/notifications/filter"
                element={withChildPageViewport(<SettingsNotificationFilterPage />)}
              />
              <Route path="settings/timeline" element={withChildPageViewport(<SettingsTimelinePage />)} />
              <Route
                path="settings/timeline/interactions"
                element={withChildPageViewport(<SettingsTimelineInteractionsPage />)}
              />
              <Route
                path="settings/timeline/home-tags"
                element={withChildPageViewport(<SettingsTimelineHomeTagsPage />)}
              />
            </Route>
          </ActivityRouteHost>
        </div>
      </MemoryRouter>
    </div>
  );
};

export default XApp;
