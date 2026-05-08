
import React, { useCallback, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useSearchParams, Outlet } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useWechatReadingStore } from './state';
import ReadingPage from './pages/ReadingPage';
import BookshelfPage from './pages/BookshelfPage';
import { ReaderPage } from './pages/ReaderPage';
import { BookDetailPage } from './pages/BookDetailPage';
import AudiobooksPage from './pages/AudiobooksPage';
import MePage from './pages/MePage';
import EditProfilePage from './pages/EditProfilePage';
import GenderSelectionPage from './pages/GenderSelectionPage';
import MyProfilePage from './pages/MyProfilePage';
import MyReadingPage from './pages/MyReadingPage';
import ReadingListPage from './pages/ReadingListPage';
import BookListsPage from './pages/BookListsPage';
import EditBookListPage from './pages/EditBookListPage';
import AddBooksToListPage from './pages/AddBooksToListPage';
import SettingsPage from './pages/SettingsPage';
import AutoDownloadPage from './pages/settings/AutoDownloadPage';
import PageTurnStylePage from './pages/settings/PageTurnStylePage';
import DarkModePage from './pages/settings/DarkModePage';
import PrivacyPage from './pages/settings/PrivacyPage';
import ProfilePrivacyPage from './pages/settings/ProfilePrivacyPage';
import NotificationsPage from './pages/settings/NotificationsPage';
import { FollowingPage } from './pages/FollowingPage';
import { WechatFriendsPage } from './pages/WechatFriendsPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { UserBookshelfPage } from './pages/UserBookshelfPage';
import CoinsPage from './pages/CoinsPage';
import TransactionsPage from './pages/TransactionsPage';
import SearchPage from './pages/SearchPage';
import CategoryListPage from './pages/CategoryListPage';
import CategoryDetailPage from './pages/CategoryDetailPage';
import TabBar from './components/TabBar';
import { useAppNavigate } from './navigation';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';

const MAIN_TAB_PATHS = ['/', '/bookshelf', '/audiobooks', '/me'];

const NavigationHandler: React.FC = () => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { back } = useAppNavigate();

    // Sync audioSubTab ephemeral state from URL
    useEffect(() => {
        if (location.pathname === '/audiobooks') {
            const next = (searchParams.get('sub') as 'audio' | 'community') || 'audio';
            useWechatReadingStore.getState().setAudioSubTab(next);
        }
    }, [location.pathname, searchParams]);

    const handleBackPress = useCallback((): boolean => {
        const hasQueryParams = location.search.length > 0;
        const isMainTab = MAIN_TAB_PATHS.includes(location.pathname);
        if (isMainTab && !hasQueryParams) {
            return false;
        }
        back();
        return true;
    }, [back, location.pathname, location.search]);

    useAppNavigationHandler('wechat_reading', { onBack: handleBackPress });

    return null;
};

// Main Layout that manages the constant presence of the 4 primary tabs
const Layout: React.FC = () => {
    const location = useLocation();
    const pathname = location.pathname;
    const isSelectMode = new URLSearchParams(location.search).get('select') === 'true';

    // Define which paths constitute the main tabs
    const isMainTab = ['/', '/bookshelf', '/audiobooks', '/me'].includes(pathname);

    return (
        <div className="flex flex-col h-full bg-white text-(--app-c-tw-text-slate-900) font-sans select-none overflow-hidden relative">
            <div className="flex-1 relative w-full overflow-hidden"
                style={{ paddingBottom: (isMainTab && !isSelectMode) ? '56px' : '0' }}>

                {/* 4 Primary Tabs: Always mounted, toggled by CSS display */}
                <div className="h-full" style={{ display: pathname === '/' ? 'block' : 'none' }}>
                    <ReadingPage />
                </div>
                <div className="h-full" style={{ display: pathname === '/bookshelf' ? 'block' : 'none' }}>
                    <BookshelfPage />
                </div>
                <div className="h-full" style={{ display: pathname === '/audiobooks' ? 'block' : 'none' }}>
                    <AudiobooksPage />
                </div>
                <div className="h-full" style={{ display: pathname === '/me' ? 'block' : 'none' }}>
                    <MePage />
                </div>

                {/* Sub-pages: Rendered exclusively via Outlet (standard Route behavior) */}
                {!isMainTab && (
                    <div className="h-full bg-white">
                        <Outlet />
                    </div>
                )}
            </div>

            {/* TabBar only visible on main paths AND not in select mode */}
            {isMainTab && !isSelectMode && <TabBar />}
        </div>
    );
};


export const WechatReadingApp: React.FC = () => {
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
        <MemoryRouter>
                <NavigationHandler />
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<div />} /> {/* Occupied by ReadingPage in Layout */}
                        <Route path="bookshelf" element={<div />} /> {/* Occupied by BookshelfPage in Layout */}
                        <Route path="audiobooks" element={<div />} /> {/* Occupied by AudiobooksPage in Layout */}
                        <Route path="me" element={<div />} /> {/* Occupied by MePage in Layout */}

                        <Route path="search" element={<SearchPage />} />
                        <Route path="categories" element={<CategoryListPage />} />
                        <Route path="categories/:categoryName" element={<CategoryDetailPage />} />
                        <Route path="book/:bookId" element={<BookDetailPage />} />
                        <Route path="read/:bookId" element={<ReaderPage />} />

                        {/* Genuine sub-pages that should unmount when leaving */}
                        <Route path="edit-profile" element={<EditProfilePage />} />
                        <Route path="gender-selection" element={<GenderSelectionPage />} />
                        <Route path="my-profile" element={<MyProfilePage />} />
                        <Route path="my-reading" element={<MyReadingPage />} />
                        <Route path="reading-list" element={<ReadingListPage />} />
                        <Route path="book-lists" element={<BookListsPage />} />
                        <Route path="book-lists/edit" element={<EditBookListPage />} />
                        <Route path="book-lists/add-books" element={<AddBooksToListPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="settings/auto-download" element={<AutoDownloadPage />} />
                        <Route path="settings/page-turn-style" element={<PageTurnStylePage />} />
                        <Route path="settings/dark-mode" element={<DarkModePage />} />
                        <Route path="settings/privacy" element={<PrivacyPage />} />
                        <Route path="settings/privacy/profile" element={<ProfilePrivacyPage />} />
                        <Route path="settings/notifications" element={<NotificationsPage />} />
                        <Route path="following" element={<FollowingPage />} />
                        <Route path="wechat-friends" element={<WechatFriendsPage />} />
                        <Route path="user/:userId" element={<UserProfilePage />} />
                        <Route path="user/:userId/shelf" element={<UserBookshelfPage />} />
                        <Route path="wallet/coins" element={<CoinsPage />} />
                        <Route path="wallet/transactions" element={<TransactionsPage />} />
                    </Route>
                </Routes>
        </MemoryRouter>
        </div>
    );
};

export default WechatReadingApp;
