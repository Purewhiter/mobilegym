/**
 * File Manager App
 * 
 * A fully functional file manager app similar to Android's Files app.
 * Features:
 * - Browse directories
 * - Category views (Images, Videos, Audio, Documents, Downloads)
 * - File operations: Copy, Cut, Paste, Delete, Rename
 * - Create new folders
 * - Search
 */
import React from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { FileManagerNavigationHandler } from './components/FileManagerNavigationHandler';
import { BrowseHomePage } from './pages/BrowseHomePage';
import { RecentPage } from './pages/RecentPage';
import { CloudPage } from './pages/CloudPage';
import { FolderPage } from './pages/FolderPage';
import { CategoryPage } from './pages/CategoryPage';
import { TextPreviewPage } from './pages/TextPreviewPage';
import { PdfPreviewPage } from './pages/PdfPreviewPage';

export const FileManagerApp: React.FC = () => {
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
        <FileManagerNavigationHandler />
        <Routes>
          {/* Main tab routes - each page includes TabBar */}
          <Route path="/" element={<BrowseHomePage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/cloud" element={<CloudPage />} />

          {/* Folder browser */}
          <Route path="/folder" element={<FolderPage />} />
          <Route path="/text" element={<TextPreviewPage />} />
          <Route path="/pdf" element={<PdfPreviewPage />} />

          {/* Category views */}
          <Route path="/category/:category" element={<CategoryPage />} />
        </Routes>
      </MemoryRouter>
    </div>
  );
};

export default FileManagerApp;
