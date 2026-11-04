import { useTencentMeetingStrings } from './hooks/useTencentMeetingStrings';

import React, { useCallback, useEffect, useState } from 'react';
import { MemoryRouter, Route, useLocation, Outlet } from 'react-router-dom';
import { RouteScrollContainer } from '../../os/components/RouteScrollContainer';
import { ActivityRouteHost } from '../../os/components/ActivityRouteHost';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';

import { HomePage } from './pages/HomePage';
import { ContactsPage } from './pages/ContactsPage';
import { MePage } from './pages/MePage';
import { JoinMeetingPage } from './pages/JoinMeetingPage';
import { QuickMeetingPage } from './pages/QuickMeetingPage';
import { ScheduleMeetingPage } from './pages/ScheduleMeetingPage';
import { ScheduleRegularMeetingPage } from './pages/ScheduleRegularMeetingPage';
import { ShareScreenPage } from './pages/ShareScreenPage';
import { MeetingPage } from './pages/MeetingPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountSecurityPage } from './pages/AccountSecurityPage';
import { HistoryMeetingsPage } from './pages/HistoryMeetingsPage';
import { HistoryMeetingDetailPage } from './pages/HistoryMeetingDetailPage';
import { PersonalRoomPage } from './pages/PersonalRoomPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { EditMeetingPage } from './pages/EditMeetingPage';
import { IcTabMeeting, IcTabContacts, IcTabMe } from './res/icons';
import { MeetingAttendeesPage } from './pages/MeetingAttendeesPage';
import { useMeetingGestures } from './hooks/useMeetingGestures';
import { routes } from './routes';
import { useNav } from '../../os/navigation';
import { useAppStrings } from '../../os/useAppStrings';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { anim } from './res/anim';
import { dimens } from './res/dimens';

const MeetingNavigationHandler = () => {
    const { back } = useNav();
    const location = useLocation();

    const handleBack = useCallback(() => {
        const hasQueryParams = location.search.length > 0;
        if (location.pathname !== '/' || hasQueryParams) {
            back();
            return true;
        }
        return false; // Let OS handle back (go home)
    }, [back, location.pathname, location.search]);

    useAppNavigationHandler('tencent_meeting', { onBack: handleBack });

    return null;
};

const TabBar = () => {
    const { bindNav } = useMeetingGestures();
    const location = useLocation();
    const currentPath = location.pathname;
    const s = useTencentMeetingStrings();

    const tabs = [
        { id: 'home', label: s.tab_meeting, path: '/', icon: IcTabMeeting, route: routes.home },
        { id: 'contacts', label: s.tab_contacts, path: '/contacts', icon: IcTabContacts, route: routes.contacts },
        { id: 'me', label: s.tab_me, path: '/me', icon: IcTabMe, route: routes.me },
    ];

    return (
        <div className="bg-white border-t border-gray-100 flex justify-around items-center h-[56px] pb-1 sticky bottom-0 z-50">
            {tabs.map((tab) => {
                const isActive = currentPath === tab.path;
                return (
                    <div
                        key={tab.id}
                        {...bindNav(tab.route, { replace: true })}
                        className={`flex flex-col items-center justify-center flex-1 h-full active:scale-95 transition-transform ${isActive ? 'text-app-primary' : 'text-gray-400'}`}
                    >
                        <tab.icon size={24} fill={isActive && tab.id === 'me' ? 'currentColor' : 'none'} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

/** The main tabs: one instance each, kept while you are on another tab (ActivityRouteHost). */
const MAIN_TAB_PATHS = ['/', '/contacts', '/me'] as const;

const Layout = () => {
    const { pathname } = useLocation();
    const isMainTab = (MAIN_TAB_PATHS as readonly string[]).includes(pathname);

    return (
        <div className="flex flex-col h-full bg-white select-none">
            <div className="flex-1 overflow-hidden relative">
                {isMainTab ? (
                    <RouteScrollContainer className="h-full overflow-auto no-scrollbar">
                        <Outlet />
                    </RouteScrollContainer>
                ) : (
                    <Outlet />
                )}
            </div>

            {/* Show TabBar if it's a main tab */}
            {isMainTab && <TabBar />}
        </div>
    );
};



export const MeetingApp: React.FC = () => {
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
                <MeetingNavigationHandler />
                {/* Pages below the top stay as they were left (Fragment back stack), see ActivityRouteHost. */}
                <ActivityRouteHost persistent={MAIN_TAB_PATHS}>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<HomePage />} />
                        <Route path="contacts" element={<ContactsPage />} />
                        <Route path="me" element={<MePage />} />

                        {/* Sub pages */}
                        <Route path="join" element={<JoinMeetingPage />} />
                        <Route path="quick" element={<QuickMeetingPage />} />
                        <Route path="schedule" element={<ScheduleMeetingPage />} />
                        <Route path="schedule/regular" element={<ScheduleRegularMeetingPage />} />
                        <Route path="meeting/detail" element={<MeetingDetailPage />} />
                        <Route path="meeting/edit" element={<EditMeetingPage />} />
                        <Route path="meeting" element={<MeetingPage />} />
                        <Route path="share" element={<ShareScreenPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="account-security" element={<AccountSecurityPage />} />
                        <Route path="history" element={<HistoryMeetingsPage />} />
                        <Route path="history/:meetingId" element={<HistoryMeetingDetailPage />} />
                        <Route path="attendees/:id" element={<MeetingAttendeesPage />} />
                        <Route path="personal-room" element={<PersonalRoomPage />} />
                        <Route path="profile" element={<ProfilePage />} />

                        {/* Messages (tab state via query params) */}
                        <Route path="messages" element={<MessagesPage />} />
                    </Route>
                </ActivityRouteHost>
            </MemoryRouter>
        </div>
    );
};

// Default export for dynamic import compatibility
export default MeetingApp;
