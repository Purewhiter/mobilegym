import React, { useCallback, useEffect, useRef } from 'react';
import { MemoryRouter, Routes, Route, useNavigate, useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { CalculatorPage } from './pages/CalculatorPage';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import './styles/calculator.css';

/**
 * 导航处理器 — 注册到 AppNavigatorRegistry + BackDispatcher
 */
const Calculator2NavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex = typeof memoryNavigator.index === 'number'
      ? memoryNavigator.index
      : historyIndexRef.current;

    if (currentIndex > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  useAppNavigationHandler('calculator2', { onBack: handleBackPress });

  return null;
};

/**
 * Calculator2App — AOSP Calculator 100% 复刻
 */
export const Calculator2App: React.FC = () => {
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
        <Calculator2NavigationHandler />
        <Routes>
          <Route path="/" element={<CalculatorPage />} />
        </Routes>
      </MemoryRouter>
    </div>
  );
};

export default Calculator2App;
