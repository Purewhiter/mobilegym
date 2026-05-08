import React, { useCallback, useEffect, useRef } from 'react';
import { MemoryRouter, useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { manifest } from './manifest';
import SheetPage from './pages/SheetPage';

// ── Navigation handler ──
const AnswerSheetNavigationHandler: React.FC = () => {
  const location = useLocation();
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
    const currentIndex =
      typeof memoryNavigator.index === 'number'
        ? memoryNavigator.index
        : historyIndexRef.current;
    if (currentIndex > 0) {
      memoryNavigator.go(-1);
      return true;
    }
    return false;
  }, [navigator]);

  useAppNavigationHandler('answer_sheet', { onBack: handleBackPress });
  return null;
};

// ── App entry point ──
const AnswerSheetApp: React.FC = () => {
  const themeColors = manifest.theme.colors;
  const cssVars = themeToCssVars(applySkinToThemeColors(themeColors));

  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <MemoryRouter>
        <AnswerSheetNavigationHandler />
        <SheetPage />
      </MemoryRouter>
    </div>
  );
};

export default AnswerSheetApp;
