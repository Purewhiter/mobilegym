import React from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { EbayNavigationHandler } from './components/EbayNavigationHandler';
import HomePage from './pages/HomePage';
import MePage from './pages/MePage';
import SearchPage from './pages/SearchPage';
import SellPage from './pages/SellPage';
import InboxPage from './pages/InboxPage';
import CartPage from './pages/CartPage';
import SettingsPage from './pages/SettingsPage';
import CategoriesPage from './pages/CategoriesPage';
import ItemDetailPage from './pages/ItemDetailPage';

export const EbayApp: React.FC = () => {
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
      <MemoryRouter initialEntries={['/']}>
        <EbayNavigationHandler />
        <div className="h-full w-full" data-ebay-root>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/item/:id" element={<ItemDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </MemoryRouter>
    </div>
  );
};

export default EbayApp;
