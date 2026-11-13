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
  Route,
  useLocation,
  useNavigate,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { ActivityRouteHost } from '../../os/components/ActivityRouteHost';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useActivityId } from '../../os/ActivityContext';
import type { IntentPayload } from '../../os/types/manifest';
import { BottomTabBar } from './components/BottomTabBar';
import { CallsPage } from './pages/CallsPage';
import { ContactsPage } from './pages/ContactsPage';
import { BusinessHallPage } from './pages/BusinessHallPage';
import { NewContactPage } from './pages/NewContactPage';
import { SearchPage } from './pages/SearchPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { CallDetailPage } from './pages/CallDetailPage';
import { PhoneSettingsHomePage } from './pages/PhoneSettingsHomePage';
import { PhonePreferenceScreenPage } from './pages/PhonePreferenceScreenPage';


/** Handles back navigation and route observation for the OS */
const ContactsNavigationHandler: React.FC = () => {
  const activityId = useActivityId();
  const previousIntent = useRef<IntentPayload | null>(null);
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

    // No history but not on root: go to calls tab.
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
      return true;
    }

    return false; // let OS handle (exit)
  }, [location.pathname, navigate, navigator]);

  useAppNavigationHandler('contacts', {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      const queryStart = normalized.indexOf('?');
      const pathname = queryStart < 0 ? normalized : normalized.slice(0, queryStart);
      const search = queryStart < 0 ? '' : normalized.slice(queryStart + 1);
      const params = new URLSearchParams(search);
      if (pathname !== '/' || params.get('dialpad') !== 'true') return navigateToPath(normalized);
      const intent = window.__OS__?.getIntentPayload(activityId);
      const dialIntent = intent && intent !== previousIntent.current &&
        (intent.action === 'ACTION_DIAL' || (intent.action === 'ACTION_VIEW' && intent.scheme === 'tel'));
      if (intent) previousIntent.current = intent;
      const value = params.get('number') ?? (dialIntent ? intent.data?.number ?? intent.data?.url : undefined);
      const number = typeof value === 'string' ? value.replace(/^tel:/i, '').replace(/[\s().-]/g, '') : '';
      if (/^\+?[0-9*#]{1,40}$/.test(number)) params.set('number', number);
      else params.delete('number');
      navigateToPath(`/?${params}`);
    },
  });

  return null;
};

const ContactsChrome: React.FC = () => {
  const location = useLocation();
  const showTabBar =
    location.pathname === '/' ||
    location.pathname === '/contacts' ||
    location.pathname === '/business';

  return (
    <div className="h-full w-full relative bg-app-surface">
      {/* Pages below the top stay as they were left (Fragment back stack), see ActivityRouteHost. */}
      <ActivityRouteHost persistent={['/', '/contacts', '/business']}>
        <Route path="/" element={<CallsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/business" element={<BusinessHallPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/contact/:contactId" element={<ContactDetailPage />} />
        <Route path="/call/:callLogId" element={<CallDetailPage />} />
        <Route path="/contacts/new" element={<NewContactPage />} />
        <Route path="/settings/calls" element={<PhoneSettingsHomePage />} />
        <Route path="/settings/contacts" element={<PhoneSettingsHomePage />} />
        <Route path="/settings/page/:pageId" element={<PhonePreferenceScreenPage />} />
      </ActivityRouteHost>

      {showTabBar ? <BottomTabBar /> : null}
    </div>
  );
};


/** Contacts (com.android.contacts) App root component */
const ContactsApp: React.FC = () => {
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
        <ContactsNavigationHandler />
        <ContactsChrome />
      </MemoryRouter>
    </div>
  );
};

export default ContactsApp;
