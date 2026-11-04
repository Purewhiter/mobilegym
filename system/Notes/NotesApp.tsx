import React, { useContext, useCallback, useEffect, useRef } from 'react';
import {
  MemoryRouter,
  Route,
  useLocation,
  UNSAFE_NavigationContext,
  type Location,
} from 'react-router-dom';
import { ActivityRouteHost } from '../../os/components/ActivityRouteHost';
import NotesListPage from './pages/NotesListPage';
import NoteEditorPage from './pages/NoteEditorPage';
import TodoListPage from './pages/TodoListPage';
import FoldersPage from './pages/FoldersPage';
import NotesSettingsPage from './pages/SettingsPage';
import TrashPage from './pages/TrashPage';
import PrivateNotesPage from './pages/PrivateNotesPage';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useAppStrings } from '../../os/useAppStrings';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useNav } from '../../os/navigation';
import { routes } from './routes';

/** Handles back navigation and route observation for the OS */
const NotesNavigationHandler: React.FC = () => {
  const location = useLocation();
  const nav = useNav(); const back = nav.back;
  const { navigator } = useContext(UNSAFE_NavigationContext);
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
      back();
      return true;
    }

    if (location.pathname !== '/') {
      nav.replace(routes.home);
      return true;
    }

    return false;
  }, [back, nav, location.pathname, navigator]);

  useAppNavigationHandler('notes', {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      navigateToPath(normalized);
    },
  });

  return null;
};


/** Notes App root component */
/**
 * One editor instance per note page: saving a new note replaces `/note/new`
 * with `/note/<id>` while the user types, and the editor must keep its focus.
 */
const noteScreen = (location: Location) =>
  location.pathname.startsWith('/note/') ? '/note' : location.pathname;

const NotesApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const s = useAppStrings(strings, stringsEn);
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
        <NotesNavigationHandler />
        <div className="h-full w-full bg-white relative overflow-hidden">
          {/* Pages below the top stay as they were left (Fragment back stack), see ActivityRouteHost. */}
          <ActivityRouteHost persistent={['/', '/todo']} identity={noteScreen}>
            <Route path="/" element={<NotesListPage />} />
            <Route path="/todo" element={<TodoListPage />} />
            <Route path="/folders" element={<FoldersPage />} />
            <Route path="/settings" element={<NotesSettingsPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/private" element={<PrivateNotesPage />} />
            <Route path="/note/:id" element={<NoteEditorPage />} />
          </ActivityRouteHost>
        </div>
      </MemoryRouter>
    </div>
  );
};

export default NotesApp;
