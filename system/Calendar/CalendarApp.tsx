import React, { useCallback } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CalendarHomePage from './pages/CalendarHomePage';
import CalendarSettingsPage from './pages/CalendarSettingsPage';
import { CalendarNewEventPage } from './pages/CalendarNewEventPage';

import { CalendarSearchPage } from './pages/CalendarSearchPage';
import { CalendarDateJumpPage } from './pages/CalendarDateJumpPage';
import { CalendarDateCalculatePage } from './pages/CalendarDateCalculatePage';
import { CalendarSubscriptionPage } from './pages/CalendarSubscriptionPage';
import { CalendarEventDetailPage } from './pages/CalendarEventDetailPage';
import { CalendarDeskThemePage } from './pages/CalendarDeskThemePage';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useAppNavigate } from './navigation';


// --- Navigation Handler ---
const CalendarNavigationHandler: React.FC = () => {
    const { back } = useAppNavigate();
    const location = useLocation();

    const handleBack = useCallback(() => {
        if (location.pathname !== '/') {
            back();
            return true;
        }
        return false;
    }, [back, location.pathname]);

    useAppNavigationHandler('calendar', { onBack: handleBack });

    return null;
};

// --- Main App Component ---
const CalendarApp: React.FC = () => {
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
            <style>{`
                ::-webkit-scrollbar { display: none; }
                * { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <MemoryRouter>
                <CalendarNavigationHandler />
                <Routes>
                    <Route path="/" element={<CalendarHomePage />} />
                    <Route path="/settings" element={<CalendarSettingsPage />} />
                    <Route path="/new-event" element={<CalendarNewEventPage />} />
                    <Route path="/event/:eventId" element={<CalendarEventDetailPage />} />
                    <Route path="/event/:eventId/edit" element={<CalendarNewEventPage />} />
                    <Route path="/search" element={<CalendarSearchPage />} />
                    <Route path="/date-jump" element={<CalendarDateJumpPage />} />
                    <Route path="/date-calculate" element={<CalendarDateCalculatePage />} />
                    <Route path="/subscription" element={<CalendarSubscriptionPage />} />
                    <Route path="/desk-theme" element={<CalendarDeskThemePage />} />
                </Routes>
            </MemoryRouter>
        </div>
    );
};

export default CalendarApp;
