import React, { useCallback, useContext, useEffect } from 'react';
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
    Routes,
    Route,
    useLocation,
    useNavigate,
    UNSAFE_NavigationContext,
} from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { ConversationListPage } from './components/ConversationListPage';
import { NewMessagePage } from './components/NewMessagePage';
import { ConversationDetailPage } from './components/ConversationDetailPage';
import { SettingsPage } from './components/SettingsPage';
import { FreeNetworkSmsPage } from './components/FreeNetworkSmsPage';
import { AdvancedSettingsPage } from './components/AdvancedSettingsPage';
import { FiveGMessagePage } from './components/FiveGMessagePage';
import { SettingsPlaceholderPage } from './components/SettingsPlaceholderPage';
import { useSmsStore } from './state';
import { useAppNavigate } from './navigation';

/** Handles back navigation and route observation for the OS */
const SmsNavigationHandler: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const { back } = useAppNavigate();
    const mem = navigator as { index?: number; entries?: unknown[] };

    const handleBackPress = useCallback((): boolean => {
        if (location.pathname === '/') return false;
        if ((mem.index ?? 0) <= 0) return false;
        back();
        return true;
    }, [back, location.pathname, mem]);

    useAppNavigationHandler('sms', {
        onBack: handleBackPress,
        onNavigate: (path, navigateTo) => {
            const normalized =
                typeof path === 'string'
                    ? (path.startsWith('/') ? path : `/${path}`)
                    : null;
            if (!normalized) return;
            navigateTo(normalized);
        },
    });

    return null;
};


/** SMS App root component */
const SmsApp: React.FC = () => {
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

    // SMS_RECEIVED is handled by the lightweight OS bootstrap receiver,
    // so incoming messages still work when the app UI is not mounted.

    // Cleanup pending send-status timers on unmount
    useEffect(() => {
        return () => {
            useSmsStore.getState().clearTimers();
        };
    }, []);

    return (
        <div className="h-full w-full" style={cssVars as React.CSSProperties}>
            <MemoryRouter>
                <SmsNavigationHandler />
                <div className="h-full w-full bg-app-bg">
                    <Routes>
                        <Route path="/" element={<ConversationListPage />} />
                        <Route path="/new" element={<NewMessagePage />} />
                        <Route path="/conversation/:conversationId" element={<ConversationDetailPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/settings/free-network-sms" element={<FreeNetworkSmsPage />} />
                        <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />
                        <Route path="/settings/5g-message" element={<FiveGMessagePage />} />
                        <Route path="/settings/*" element={<SettingsPlaceholderPage />} />
                    </Routes>
                </div>
            </MemoryRouter>
        </div>
    );
};

export default SmsApp;
