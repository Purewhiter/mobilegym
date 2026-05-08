import { useTencentMeetingStrings } from './hooks/useTencentMeetingStrings';

import React, { useCallback, useEffect, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, Outlet } from 'react-router-dom';
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
import { useAppNavigate } from './navigation';
import { useMeetingGestures } from './hooks/useMeetingGestures';
import { TransitionId } from './navigation.declaration';
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
    const { back } = useAppNavigate();
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
    const { bindTap } = useMeetingGestures();
    const location = useLocation();
    const currentPath = location.pathname;
    const s = useTencentMeetingStrings();

    const tabs = [
        { id: 'home', label: s.tab_meeting, path: '/', icon: IcTabMeeting, transition: 'tab.home' as TransitionId },
        { id: 'contacts', label: s.tab_contacts, path: '/contacts', icon: IcTabContacts, transition: 'tab.contacts' as TransitionId },
        { id: 'me', label: s.tab_me, path: '/me', icon: IcTabMe, transition: 'tab.me' as TransitionId },
    ];

    return (
        <div className="bg-white border-t border-gray-100 flex justify-around items-center h-[56px] pb-1 sticky bottom-0 z-50">
            {tabs.map((tab) => {
                const isActive = currentPath === tab.path;
                return (
                    <div
                        key={tab.id}
                        {...bindTap(tab.transition)}
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

const Layout = () => {
    const { pathname } = useLocation();
    
    // Show home page for root path
    const showHome = pathname === '/';
    const isMainTab = ['/', '/contacts', '/me'].includes(pathname);
    
    return (
        <div className="flex flex-col h-full bg-white select-none">
            <div className="flex-1 overflow-hidden relative">
                {/* Main Tabs (Persistent) */}
                <div style={{ display: showHome ? 'block' : 'none' }} className="h-full overflow-auto no-scrollbar">
                    <HomePage />
                </div>
                <div style={{ display: pathname === '/contacts' ? 'block' : 'none' }} className="h-full overflow-auto no-scrollbar">
                    <ContactsPage />
                </div>
                <div style={{ display: pathname === '/me' ? 'block' : 'none' }} className="h-full overflow-auto no-scrollbar">
                    <MePage />
                </div>

                {/* Sub-pages (Dynamic) */}
                {!isMainTab && <Outlet />}
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
                <Routes>
                    <Route path="/" element={<Layout />}>
                        {/* Main logic handled in Layout, these routes are just for matching */}
                        <Route index element={<div />} />
                        <Route path="contacts" element={<div />} />
                        <Route path="me" element={<div />} />

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
                </Routes>
            </MemoryRouter>
        </div>
    );
};

// Default export for dynamic import compatibility
export default MeetingApp;
