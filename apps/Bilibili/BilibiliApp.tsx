import React, { useCallback, useEffect } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { anim } from './res/anim';
import { dimens } from './res/dimens';
import { MemoryRouter, Routes, Route, useLocation, useNavigate, Outlet, UNSAFE_NavigationContext, useSearchParams } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { IcTabHome, IcTabFollowing, IcTabPublish, IcTabShop, IcTabMe } from './res/icons';
import { useBilibiliGestures } from './hooks/useBilibiliGestures';
import { HomePage } from './pages/HomePage';
import { FollowingPage } from './pages/FollowingPage';
import { UserRelationPage } from './pages/UserRelationPage';
import { ShopPage } from './pages/ShopPage';
import { MePage } from './pages/MePage';
import { SpacePage } from './pages/SpacePage';
import { ProfileEditPage } from './pages/ProfileEditPage';
import { ProfileEditNamePage } from './pages/ProfileEditNamePage';
import { ProfileEditSignPage } from './pages/ProfileEditSignPage';
import { PartitionsPage } from './pages/PartitionsPage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { PartitionDetailPage } from './pages/PartitionDetailPage';
import { RankingPage } from './pages/RankingPage';
import { SearchPage } from './pages/SearchPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SchoolInfoPage } from './pages/SchoolInfoPage';
import { RecentLikesPage } from './pages/RecentLikesPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { FavFolderDetailPage } from './pages/FavFolderDetailPage';
import { FavoritesDetailPage } from './pages/FavoritesDetailPage';
import { CreateFavFolderPage } from './pages/CreateFavFolderPage';
import { VipPage } from './pages/VipPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsRecommendPage } from './pages/settings/SettingsRecommendPage';
import { SettingsLanguagePage } from './pages/settings/SettingsLanguagePage';
import { SettingsAvatarEntryPage } from './pages/settings/SettingsAvatarEntryPage';
import { SettingsPlaybackPage } from './pages/settings/SettingsPlaybackPage';
import { SettingsPlaybackAutoplayPage } from './pages/settings/SettingsPlaybackAutoplayPage';
import { SettingsPlaybackAutoplayFeedPage } from './pages/settings/SettingsPlaybackAutoplayFeedPage';
import { SettingsPlaybackAutoplayHomePage } from './pages/settings/SettingsPlaybackAutoplayHomePage';
import { SettingsPlaybackPortraitPage } from './pages/settings/SettingsPlaybackPortraitPage';
import { SettingsPlaybackPipPage } from './pages/settings/SettingsPlaybackPipPage';
import { SettingsPlaybackDanmakuPage } from './pages/settings/SettingsPlaybackDanmakuPage';
import { SettingsPlaybackQualityPage } from './pages/settings/SettingsPlaybackQualityPage';
import { SettingsPlaybackOtherPage } from './pages/settings/SettingsPlaybackOtherPage';
import { SettingsOfflinePage } from './pages/settings/SettingsOfflinePage';
import { SettingsChasePage } from './pages/settings/SettingsChasePage';
import { SettingsPushPage } from './pages/settings/SettingsPushPage';
import { SettingsMessagePage } from './pages/settings/SettingsMessagePage';
import { SettingsMessageReplyAtPage } from './pages/settings/SettingsMessageReplyAtPage';
import { SettingsMessageLikePage } from './pages/settings/SettingsMessageLikePage';
import { SettingsMessageFanPage } from './pages/settings/SettingsMessageFanPage';
import { SettingsSupportPage } from './pages/settings/SettingsSupportPage';
import { SettingsUnfollowPage } from './pages/settings/SettingsUnfollowPage';
import { SettingsHarassPage } from './pages/settings/SettingsHarassPage';
import { SettingsStoragePage } from './pages/settings/SettingsStoragePage';
import { SettingsOtherPage } from './pages/settings/SettingsOtherPage';
import { SettingsWatermarkPage } from './pages/settings/SettingsWatermarkPage';
import { SettingsImageQualityPage } from './pages/settings/SettingsImageQualityPage';
import { SettingsTimerPage } from './pages/settings/SettingsTimerPage';
import { SettingsSleepPage } from './pages/settings/SettingsSleepPage';
import { useLocale } from '@/apps/Bilibili/locale';
// Standard Navigation Handler as per spec
const BilibiliNavigationHandler: React.FC = () => {
    const navigate = useNavigate();
    const { navigator } = React.useContext(UNSAFE_NavigationContext);
    const location = useLocation();

    const handleBackPress = useCallback((): boolean => {
        const index = (navigator as any).index || 0;
        if (index > 0) {
            navigate(-1);
            return true;
        }
        return false;
    }, [navigate, navigator]);

    useAppNavigationHandler('bilibili', { onBack: handleBackPress });

    return null;
};

const TabBarItem = ({ active, icon: Icon, label, isBig = false, ...props }: any) => (
    <div
        {...props}
        className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${active ? 'text-app-primary' : 'text-gray-500'}`}
    >
        {isBig ? (
            <div className="bg-app-primary text-white p-2 rounded-xl mb-1 shadow-sm">
                <Icon size={24} />
            </div>
        ) : (
            <Icon size={24} strokeWidth={active ? 2.5 : 2} className="mb-0.5" />
        )}
        {!isBig && <span className="text-[10px] scale-90">{label}</span>}
    </div>
);

const Layout = () => {
    const { pathname } = useLocation();
    const [searchParams] = useSearchParams();
    const { bindTap } = useBilibiliGestures();
    const locale = useLocale();
    const text = locale === 'en'
        ? {
            home: 'Home',
            following: 'Following',
            publish: 'Post',
            shop: 'Shop',
            me: 'Me',
        }
        : {
            home: '首页',
            following: '关注',
            publish: '发布',
            shop: '会员购',
            me: '我的',
        };

    // Identify Main Tabs
    const isHome = pathname === '/';
    const isFollowing = pathname === '/following';
    const isShop = pathname === '/shop';
    const isMe = pathname === '/me';

    const isMainTab = isHome || isFollowing || isShop || isMe;

    // 获取当前首页的 tab 参数（仅在 Home 路由时有效）
    // Layout 会保持多个主 Tab 页常驻挂载，因此不能直接把当前 location 的 ?tab 传给 HomePage
    // （否则会被 /following?tab=all 等污染）。
    const homeTabParam = searchParams.get('tab') || 'recommend';
    const [lastHomeTab, setLastHomeTab] = React.useState(homeTabParam);
    useEffect(() => {
        if (isHome) {
            setLastHomeTab(homeTabParam);
        }
    }, [isHome, homeTabParam]);

    // 关注页内部 Tab 记忆：
    // - 默认进入 “全部”
    // - 若用户在关注页切到 “视频”，再去别的主 Tab（如“我的”）再回来，应恢复为 “视频”
    // - 注意：不要被 Home 的 ?tab=recommend 等污染，因此仅在 isFollowing 时更新
    const followingTabParamRaw = searchParams.get('tab');
    const followingTabParam = followingTabParamRaw === 'video' ? 'video' : 'all';
    const [lastFollowingTab, setLastFollowingTab] = React.useState<'all' | 'video'>('all');
    useEffect(() => {
        if (isFollowing) {
            setLastFollowingTab(followingTabParam);
        }
    }, [isFollowing, followingTabParam]);

    return (
        <div className="flex flex-col h-full bg-app-bg text-app-text overflow-hidden">
            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Persistent Views for Main Tabs */}
                {/* We use display:none to keep them mounted */}
                <div style={{ display: isHome ? 'block' : 'none', height: '100%' }}>
                    <HomePage activeTab={lastHomeTab} />
                </div>
                <div style={{ display: isFollowing ? 'block' : 'none', height: '100%' }}>
                    <FollowingPage />
                </div>
                <div style={{ display: isShop ? 'block' : 'none', height: '100%' }}>
                    <ShopPage />
                </div>
                <div style={{ display: isMe ? 'block' : 'none', height: '100%' }}>
                    <MePage />
                </div>

                {/* Sub-pages rendered via Outlet */}
                {/* When not on a main tab, the above divs are hidden, and Outlet takes over */}
                {!isMainTab && (
                    <div className="absolute inset-0 bg-white z-10 w-full h-full">
                        <Outlet />
                    </div>
                )}
            </div>

            {/* Bottom Navigation - Only visible on Main Tabs */}
            {isMainTab && (
                <div className="bg-white border-t border-gray-100 flex items-end pb-4 pt-2 px-2 shrink-0 z-50">
                    {isHome ? (
                        <TabBarItem active={true} icon={IcTabHome} label={text.home} />
                    ) : (
                        <TabBarItem active={false} icon={IcTabHome} label={text.home} {...bindTap('tab.home')} />
                    )}
                    {isFollowing ? (
                        <TabBarItem active={true} icon={IcTabFollowing} label={text.following} />
                    ) : (
                        <TabBarItem
                            active={false}
                            icon={IcTabFollowing}
                            label={text.following}
                            {...bindTap('tab.following', { params: { tab: lastFollowingTab } })}
                        />
                    )}
                    <TabBarItem active={false} icon={IcTabPublish} label={text.publish} isBig />
                    {isShop ? (
                        <TabBarItem active={true} icon={IcTabShop} label={text.shop} />
                    ) : (
                        <TabBarItem active={false} icon={IcTabShop} label={text.shop} {...bindTap('tab.shop')} />
                    )}
                    {isMe ? (
                        <TabBarItem active={true} icon={IcTabMe} label={text.me} />
                    ) : (
                        <TabBarItem active={false} icon={IcTabMe} label={text.me} {...bindTap('tab.me')} />
                    )}
                </div>
            )}
        </div>
    );
};

export const BilibiliApp: React.FC = () => {
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
            <MemoryRouter initialEntries={['/?tab=recommend']}>
                <BilibiliNavigationHandler />
                <Routes>
                    <Route path="/" element={<Layout />}>
                        {/* Main Tab Routes - These are effectively handled by Layout's persistent views,
                            but we need Route definitions to match the path. Element can be empty/null because Layout renders the component manually. */}
                        <Route index element={null} />
                        <Route path="following" element={null} />
                        <Route path="shop" element={null} />
                        <Route path="me" element={null} />

                        {/* Sub Pages - Dynamically mounted/unmounted via Outlet */}
                        <Route path="search" element={<SearchPage />} />
                        <Route path="search/results" element={<SearchPage />} />
                        <Route path="space" element={<SpacePage />} />

                        <Route path="partitions" element={<PartitionsPage />} />
                        <Route path="partitions/:label" element={<PartitionDetailPage />} />

                        <Route path="ranking" element={<RankingPage />} />

                        <Route path="video/:bvid" element={<VideoDetailPage />} />
                        <Route path="user/:mid" element={<UserProfilePage />} />

                        <Route path="profile/edit" element={<ProfileEditPage />} />
                        <Route path="profile/edit/name" element={<ProfileEditNamePage />} />
                        <Route path="profile/edit/sign" element={<ProfileEditSignPage />} />
                        <Route path="profile/school" element={<SchoolInfoPage />} />
                        <Route path="profile/following" element={<UserRelationPage />} />
                        <Route path="profile/likes" element={<RecentLikesPage />} />
                        <Route path="profile/fav/:folderId" element={<FavoritesDetailPage />} />
                        <Route path="favorites" element={<FavoritesPage />} />
                        <Route path="favorites/folder/:folderId" element={<FavFolderDetailPage />} />
                        <Route path="fav/create" element={<CreateFavFolderPage />} />
                        <Route path="vip" element={<VipPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="settings/recommend" element={<SettingsRecommendPage />} />
                        <Route path="settings/language" element={<SettingsLanguagePage />} />
                        <Route path="settings/avatar-entry" element={<SettingsAvatarEntryPage />} />
                        <Route path="settings/playback" element={<SettingsPlaybackPage />} />
                        <Route path="settings/playback/autoplay" element={<SettingsPlaybackAutoplayPage />} />
                        <Route path="settings/playback/autoplay-feed" element={<SettingsPlaybackAutoplayFeedPage />} />
                        <Route path="settings/playback/autoplay-home" element={<SettingsPlaybackAutoplayHomePage />} />
                        <Route path="settings/playback/portrait" element={<SettingsPlaybackPortraitPage />} />
                        <Route path="settings/playback/pip" element={<SettingsPlaybackPipPage />} />
                        <Route path="settings/playback/danmaku" element={<SettingsPlaybackDanmakuPage />} />
                        <Route path="settings/playback/quality" element={<SettingsPlaybackQualityPage />} />
                        <Route path="settings/playback/other" element={<SettingsPlaybackOtherPage />} />
                        <Route path="settings/offline" element={<SettingsOfflinePage />} />
                        <Route path="settings/chase" element={<SettingsChasePage />} />
                        <Route path="settings/push" element={<SettingsPushPage />} />
                        <Route path="settings/message" element={<SettingsMessagePage />} />
                        <Route path="settings/message/reply-at" element={<SettingsMessageReplyAtPage />} />
                        <Route path="settings/message/like" element={<SettingsMessageLikePage />} />
                        <Route path="settings/message/fan" element={<SettingsMessageFanPage />} />
                        <Route path="settings/message/support" element={<SettingsSupportPage />} />
                        <Route path="settings/message/unfollow" element={<SettingsUnfollowPage />} />
                        <Route path="settings/harass" element={<SettingsHarassPage />} />
                        <Route path="settings/storage" element={<SettingsStoragePage />} />
                        <Route path="settings/other" element={<SettingsOtherPage />} />
                        <Route path="settings/other/watermark" element={<SettingsWatermarkPage />} />
                        <Route path="settings/other/image-quality" element={<SettingsImageQualityPage />} />
                        <Route path="settings/timer" element={<SettingsTimerPage />} />
                        <Route path="settings/sleep" element={<SettingsSleepPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </div>
    );
};

export default BilibiliApp;
