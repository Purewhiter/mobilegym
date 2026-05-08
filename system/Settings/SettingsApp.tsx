import React, { useCallback, useEffect, useRef } from 'react';
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
import { SettingsMainPage } from './components/SettingsMainPage';
import { PreferenceScreenPage } from './components/PreferenceScreen';
import { SettingsSearchPage } from './components/SettingsSearchPage';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useSettingsStore } from './state';

/** Handles back navigation and route observation for the OS */
const SettingsNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator?.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex =
      typeof memoryNavigator?.index === 'number' ? memoryNavigator.index : historyIndexRef.current;

    if (currentIndex > 0) {
      navigate(-1);
      return true; // handled
    }

    // No history but not on root: go home.
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
      return true;
    }

    return false; // let OS handle (exit to desktop)
  }, [location.pathname, navigate, navigator]);

  useAppNavigationHandler('settings', {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      // Accept "/page/foo" or "page/foo"
      const normalized = path.startsWith('/') ? path : `/${path}`;
      navigateToPath(normalized);
    },
  });

  return null;
};

/** Settings App root component */
const SettingsApp: React.FC = () => {
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

  // Kick off async pages.json load on mount
  const initPagesData = useSettingsStore(s => s.initPagesData);
  useEffect(() => { initPagesData(); }, [initPagesData]);

  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
        <MemoryRouter>
          <SettingsNavigationHandler />
          <div className="h-full w-full bg-app-bg">
            <Routes>
              <Route path="/" element={<SettingsMainPage />} />
              <Route path="/search" element={<SettingsSearchPage />} />
              <Route path="/page/:pageId" element={<PreferenceScreenPage />} />
            </Routes>
          </div>
        </MemoryRouter>
    </div>
  );
};

export default SettingsApp;
