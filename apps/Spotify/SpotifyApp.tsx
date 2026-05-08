import React, { useCallback, useRef } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { UNSAFE_NavigationContext } from 'react-router';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { anim } from './res/anim';
import { colorStates, colorStatesDark } from './res/colors.states';
import { colors, colorsDark } from './res/colors';
import { dimens } from './res/dimens';
import { manifest } from './manifest';
import { HomePage } from './pages/HomePage';
import { PlaylistPage } from './pages/PlaylistPage';
import { SearchPage } from './pages/SearchPage';
import { SearchInputPage } from './pages/SearchInputPage';
import { ShortVideoPage } from './pages/ShortVideoPage';
import { CategoryPage } from './pages/CategoryPage';
import { LibraryPage } from './pages/LibraryPage';
import { PremiumPage } from './pages/PremiumPage';
import { CreatePage } from './pages/CreatePage';
import { ArtistPage } from './pages/ArtistPage';
import { LikedSongsPage } from './pages/LikedSongsPage';
import { PaymentPage } from './pages/PaymentPage';
import { PlayerPage } from './pages/PlayerPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { RecentPlayedPage } from './pages/RecentPlayedPage';
import { WhatsNewPage } from './pages/WhatsNewPage';
import { LoginLandingPage } from './pages/LoginLandingPage';
import { SignupPage } from './pages/SignupPage';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { CreatePasswordPage } from './pages/CreatePasswordPage';
import { CreateDatePage } from './pages/CreateDatePage';
import { CreateGenderPage } from './pages/CreateGenderPage';
import { CreateNamePage } from './pages/CreateNamePage';
import { ChooseArtistsPage } from './pages/ChooseArtistsPage';
import { SignupCompletePage } from './pages/SignupCompletePage';
import { AccountPage } from './pages/settings/AccountPage';
import { ContentDisplayPage } from './pages/settings/ContentDisplayPage';
import { PlaybackPage } from './pages/settings/PlaybackPage';
import { PrivacyPage } from './pages/settings/PrivacyPage';
import { NotificationsPage } from './pages/settings/NotificationsPage';
import { AppsDevicesPage } from './pages/settings/AppsDevicesPage';
import { DataSaverPage } from './pages/settings/DataSaverPage';
import { MediaQualityPage } from './pages/settings/MediaQualityPage';
import { AboutPage } from './pages/settings/AboutPage';
import { useSpotifyStore } from './state';
import { BottomPlayer } from './components/BottomPlayer';
import { QueueToastBanner, QueueSheet } from './components/QueueToast';
import { LikedToastBanner, SaveLocationSheet } from './components/LikedToast';
import { IcCloseCircle, IcTabCreate, IcTabHome, IcTabLibrary, IcTabSearch, SpotifyLogoIcon } from './res/icons';
import { Sidebar } from './components/Sidebar';
import { useSpotifyGestures } from './hooks/useSpotifyGestures';
import { useSpotifyStrings } from './hooks/useSpotifyStrings';

const NavigationHandler: React.FC = () => {
  const navigate = useNavigate();
  const navigator = (React.useContext(UNSAFE_NavigationContext as any) as { navigator?: { index?: number } })?.navigator;

  const handleBack = useCallback(() => {
    const index = (navigator as any).index || 0;
    if (index > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  const handleNavigate = useCallback((path: string, navigateToPath: (nextPath: string) => void) => {
    const validate = (candidatePath: string): boolean => {
      try {
        const u = new URL(candidatePath, 'http://local');
        const pathname = u.pathname;
        const sp = u.searchParams;

        if (pathname === '/') {
          const tab = sp.get('tab');
          if (!tab) return false;
        }

        if (pathname === '/create') {
          const view = sp.get('view');
          if (!view) return false;
        }

        return true;
      } catch {
        return false;
      }
    };

    if (!validate(path)) {
      console.error(`[spotify] onNavigate rejected illegal path: ${path}`);
      return;
    }
    navigateToPath(path);
  }, []);

  useAppNavigationHandler('spotify', {
    onBack: handleBack,
    onNavigate: handleNavigate,
  });

  return null;
};

const BottomTabBar: React.FC = () => {
  const location = useLocation();
  const { bindTap, bindBack } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const isCreate = location.pathname === '/create';
  const isSearchRoute = location.pathname.startsWith('/search');

  return (
    <div data-hide-on-keyboard className="absolute left-0 right-0 bottom-0 min-h-(--app-tab-bar-height) pb-8 pt-4 bg-gradient-to-t from-black via-black/95 to-transparent flex justify-around items-start z-[60]">
      <button
        {...(location.pathname === '/' ? bindTap('tab.home', { onTrigger: () => {} }) : bindTap('tab.home'))}
        className="flex flex-col items-center gap-1.5 w-16 group transition-colors"
      >
        <IcTabHome
          size={32}
          fill={location.pathname === '/' ? 'white' : 'none'}
          strokeWidth={location.pathname === '/' ? 0 : dimens.icStrokeWidth}
          color={location.pathname === '/' ? 'white' : '#b3b3b3'}
        />
        <span className={`text-sm font-medium ${location.pathname === '/' ? 'text-white' : 'text-app-text-muted'}`}>
          {s.tab_home}
        </span>
      </button>

      <button
        {...(location.pathname === '/search' ? bindTap('tab.search', { onTrigger: () => {} }) : bindTap('tab.search'))}
        className="flex flex-col items-center gap-1.5 w-16 group transition-colors"
      >
        <IcTabSearch size={32} strokeWidth={dimens.icStrokeWidth} color={isSearchRoute ? 'white' : '#b3b3b3'} />
        <span className={`text-sm font-medium ${isSearchRoute ? 'text-white' : 'text-app-text-muted'}`}>
          {s.tab_search}
        </span>
      </button>

      <button
        {...(location.pathname === '/library' ? bindTap('tab.library', { onTrigger: () => {} }) : bindTap('tab.library'))}
        className="flex flex-col items-center gap-1.5 w-16 group transition-colors"
      >
        <IcTabLibrary size={32} strokeWidth={dimens.icStrokeWidth} color={location.pathname === '/library' ? 'white' : '#b3b3b3'} />
        <span className={`text-sm font-medium ${location.pathname === '/library' ? 'text-white' : 'text-app-text-muted'}`}>
          {s.tab_library}
        </span>
      </button>

      <button
        {...(location.pathname === '/premium' ? bindTap('tab.premium', { onTrigger: () => {} }) : bindTap('tab.premium'))}
        className="flex flex-col items-center gap-1.5 w-16 group transition-colors"
      >
        <SpotifyLogoIcon size={32} fill={location.pathname === '/premium' ? 'white' : '#b3b3b3'} />
        <span className={`text-sm font-medium ${location.pathname === '/premium' ? 'text-white' : 'text-app-text-muted'}`}>
          {s.tab_premium}
        </span>
      </button>

      <button
        {...(isCreate
          ? bindBack()
          : bindTap('create.open'))}
        className="flex flex-col items-center justify-center w-16 group transition-colors"
      >
        {isCreate ? (
          <IcCloseCircle size={48} fill="white" color="black" strokeWidth={1.5} />
        ) : (
          <>
            <IcTabCreate size={32} strokeWidth={dimens.icStrokeWidth} color="#b3b3b3" />
            <span className="text-sm font-medium text-app-text-muted mt-1.5">
              {s.tab_create}
            </span>
          </>
        )}
      </button>
    </div>
  );
};

const Layout: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { bindTap, bindBack, back } = useSpotifyGestures();
  const mainTabs = ['/', '/search', '/library', '/premium'];
  const isCreate = location.pathname === '/create';
  const isMainTab = [...mainTabs, '/create'].includes(location.pathname);
  const isPlayerPage = [
    '/player',
    '/login-landing',
    '/signup',
    '/signup/email',
    '/signup/password',
    '/signup/date',
    '/signup/gender',
    '/signup/finish',
    '/signup/artists',
    '/signup/complete',
  ].includes(location.pathname);

  const isSidebarOpen = searchParams.get('drawer') === 'sidebar';
  const createSource = searchParams.get('source'); // 'library' or null

  // Track last active main tab so we can show it behind the create overlay
  const lastMainTabRef = useRef('/');
  if (!isCreate && mainTabs.includes(location.pathname)) {
    lastMainTabRef.current = location.pathname;
  }

  const showTab = (path: string) => {
    if (location.pathname === path) return true;
    // When create overlay is open, keep the previous tab visible underneath
    if (isCreate && lastMainTabRef.current === path) return true;
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-black relative font-sans overflow-hidden">
      <div style={{ display: showTab('/') ? 'block' : 'none', height: '100%' }}>
        <HomePage />
      </div>
      <div style={{ display: showTab('/search') ? 'block' : 'none', height: '100%' }}>
        <SearchPage />
      </div>
      <div style={{ display: showTab('/library') ? 'block' : 'none', height: '100%' }}>
        <LibraryPage />
      </div>
      <div style={{ display: showTab('/premium') ? 'block' : 'none', height: '100%' }}>
        <PremiumPage />
      </div>

      {/* Create overlay - rendered on top of the current tab */}
      {isCreate && searchParams.get('view') !== 'naming' && <CreatePage />}

      {!isMainTab && <Outlet />}

      {/* Naming page renders as full-screen overlay via Outlet when on /create?view=naming */}
      {isCreate && searchParams.get('view') === 'naming' && <CreatePage />}

      {!isPlayerPage && <LikedToastBanner />}
      {!isPlayerPage && <QueueToastBanner />}
      {!isPlayerPage && <BottomPlayer />}
      {!isPlayerPage && <BottomTabBar />}
      <QueueSheet />
      <SaveLocationSheet />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => back()}
        backdropProps={bindBack({ stopPropagation: true })}
        profileOpenProps={bindTap('profile.open')}
        addAccountProps={bindTap('auth.loginLanding.open')}
        whatsNewOpenProps={bindTap('whatsNew.open')}
        historyOpenProps={bindTap('history.open')}
        settingsOpenProps={bindTap('settings.open')}
      />
    </div>
  );
};

export const SpotifyApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const s = useSpotifyStrings();

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

  try {
    return (
      <div className="h-full w-full" style={cssVars as React.CSSProperties}>
        <MemoryRouter initialEntries={['/?tab=all']}>
          <NavigationHandler />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="playlist/:id" element={<PlaylistPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="search/input" element={<SearchInputPage />} />
              <Route path="video/:id" element={<ShortVideoPage />} />
              <Route path="category/:id" element={<CategoryPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="premium" element={<PremiumPage />} />
              <Route path="create" element={<CreatePage />} />
              <Route path="artist/:name" element={<ArtistPage />} />
              <Route path="liked-songs" element={<LikedSongsPage />} />
              <Route path="premium/payment" element={<PaymentPage />} />
              <Route path="player" element={<PlayerPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/account" element={<AccountPage />} />
              <Route path="settings/content" element={<ContentDisplayPage />} />
              <Route path="settings/playback" element={<PlaybackPage />} />
              <Route path="settings/privacy" element={<PrivacyPage />} />
              <Route path="settings/notifications" element={<NotificationsPage />} />
              <Route path="settings/apps" element={<AppsDevicesPage />} />
              <Route path="settings/data-saver" element={<DataSaverPage />} />
              <Route path="settings/quality" element={<MediaQualityPage />} />
              <Route path="settings/about" element={<AboutPage />} />
              <Route path="history" element={<RecentPlayedPage />} />
              <Route path="new-releases" element={<WhatsNewPage />} />
              <Route path="login-landing" element={<LoginLandingPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route path="signup/email" element={<CreateAccountPage />} />
              <Route path="signup/password" element={<CreatePasswordPage />} />
              <Route path="signup/date" element={<CreateDatePage />} />
              <Route path="signup/gender" element={<CreateGenderPage />} />
              <Route path="signup/finish" element={<CreateNamePage />} />
              <Route path="signup/artists" element={<ChooseArtistsPage />} />
              <Route path="signup/complete" element={<SignupCompletePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </div>
    );
  } catch (error) {
    console.error('Spotify App Error:', error);
    return (
      <div className="h-full w-full bg-black text-white flex items-center justify-center">
        <div>{s.app_load_error}</div>
      </div>
    );
  }
};

export default SpotifyApp;
