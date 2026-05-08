import React, { useEffect } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CompassNavigationHandler } from './components/CompassNavigationHandler';
import { CompassPage } from './pages/CompassPage';
import { LevelPage } from './pages/LevelPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { useCompassStore } from './state';

// ---- App ----

const CompassApp: React.FC = () => {
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

  // 经纬度从 LocationService 读取
  const fetchLocation = useCompassStore(s => s.fetchLocation);
  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <div className="w-full h-full overflow-hidden">
        <MemoryRouter>
          <CompassNavigationHandler />
          <Routes>
            <Route path="/" element={<CompassPage />} />
            <Route path="/level" element={<LevelPage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MemoryRouter>
      </div>
    </div>
  );
};

export default CompassApp;
