import React, { useCallback, useEffect, useRef } from 'react';
import { RouteScrollContainer } from '../../os/components/RouteScrollContainer';
import {
  MemoryRouter,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet,
  UNSAFE_NavigationContext,
} from 'react-router-dom';
import { ActivityRouteHost } from '../../os/components/ActivityRouteHost';
import { useNav } from '../../os/navigation';
import { useRailwayGestures } from './hooks/useRailwayGestures';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { AppNavigatorRegistry } from '../../os/AppNavigatorRegistry';
import { useActivityContext } from '../../os/ActivityContext';

// TabBar icons
import iconHomeNormal from './assets/tabbar/icon_home_normal.webp';
import iconHomePressed from './assets/tabbar/icon_home_pressed.webp';
import iconBusinessNormal from './assets/tabbar/icon_business_normal.webp';
import iconBusinessPressed from './assets/tabbar/icon_business_pressed.png';
import iconOrderNormal from './assets/tabbar/icon_order_normal.webp';
import iconOrderPressed from './assets/tabbar/icon_order_pressed.png';
import iconRailwayNormal from './assets/tabbar/icon_railway_normal.webp';
import iconRailwayPressed from './assets/tabbar/icon_railway_pressed.png';
import iconMineNormal from './assets/tabbar/icon_mine_normal.webp';
import iconMinePressed from './assets/tabbar/icon_mine_pressed.png';

// Pages
import { HomePage } from './pages/HomePage';
import { TravelServicePage } from './pages/TravelServicePage';
import { OrdersPage } from './pages/OrdersPage';
import { MemberPage } from './pages/MemberPage';
import { MyPage } from './pages/MyPage';
import { StationSelectPage } from './pages/StationSelectPage';
import { DateSelectPage } from './pages/DateSelectPage';
import { QueryResultPage } from './pages/QueryResultPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { PaidOrdersPage } from './pages/PaidOrdersPage';
import { IncompleteOrdersPage } from './pages/IncompleteOrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AllAppsPage } from './pages/AllAppsPage';
import { StationBoardPage } from './pages/StationBoardPage';
import { TimetablePage } from './pages/TimetablePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { InvoicePage } from './pages/InvoicePage';
import { InvoiceHeadersPage } from './pages/InvoiceHeadersPage';
import { AddInvoiceHeaderPage } from './pages/AddInvoiceHeaderPage';
import { InvoiceEmailPage } from './pages/InvoiceEmailPage';
import { ServicePhonePage } from './pages/ServicePhonePage';
import { MyAccountPage } from './pages/MyAccountPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { IdVerifyPage } from './pages/IdVerifyPage';
import { FingerprintPage } from './pages/FingerprintPage';
import { VersionSwitchPage } from './pages/VersionSwitchPage';
import { FontSizePage } from './pages/FontSizePage';
import { CancelAccountPage } from './pages/CancelAccountPage';
import { PaymentPasswordPage } from './pages/PaymentPasswordPage';
import { StudentVerifyPage } from './pages/StudentVerifyPage';
import { ChangePhonePage } from './pages/ChangePhonePage';
import { SpecialPassengerPage } from './pages/SpecialPassengerPage';
import { AirRailPage } from './pages/AirRailPage';
import { BusTicketPage } from './pages/BusTicketPage';
import { OrderConfirmPage } from './pages/OrderConfirmPage';
import { PassengerListPage } from './pages/PassengerListPage';
import { AddPassengerPage } from './pages/AddPassengerPage';
import { EditProfilePage } from './pages/EditProfilePage';
import { PaymentPlatformPage } from './pages/PaymentPlatformPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { RefundConfirmPage } from './pages/RefundConfirmPage';
import { RefundSuccessPage } from './pages/RefundSuccessPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import RailwayLoginPage from './pages/auth/LoginPage';
import RailwayRegisterPage from './pages/auth/RegisterPage';
import RegisterVerifyPage from './pages/auth/RegisterVerifyPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import { useRailwayStore } from './state';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { useAppStrings } from '../../os/useAppStrings';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { initStations } from './services/stationService';
import { routes } from './routes';

// ─── NavigationHandler ──────────────────────────────────────────
const RailwayNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = useNav(); const back = nav.back;
  const { activityId } = useActivityContext();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const mem = navigator as any;
    if (typeof mem.index === 'number') historyIndexRef.current = mem.index;
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const mem = navigator as any;
    const idx = typeof mem.index === 'number' ? mem.index : historyIndexRef.current;
    if (idx > 0) {
      back();
      return true;
    }
    return false;
  }, [back, navigator]);

  // Per-activity navigation registration (activity-system level)
  useEffect(() => {
    // 默认 replace=true 兼容已有调用，但尊重显式 { replace: false }（singleTask 启动需要 push 才能保留 '/' 在历史栈底）。
    const navFn = (path: string, opts?: { replace?: boolean }) => navigate(path, { replace: opts?.replace ?? true });
    AppNavigatorRegistry.registerActivity(activityId, { navigate: navFn, back: handleBackPress }, 'railway12306');

    return () => {
      AppNavigatorRegistry.unregisterActivity(activityId);
    };
  }, [activityId, handleBackPress, navigate]);

  useAppNavigationHandler('railway12306', { onBack: handleBackPress });
  return null;
};

// ─── TabBar ─────────────────────────────────────────────────────
const TabBar: React.FC = () => {
  const { pathname } = useLocation();
  const { bindNav } = useRailwayGestures();
  const s = useAppStrings(strings, stringsEn);

  const TAB_ICON_MAP: Record<string, { normal: string; active: string }> = {
    home: { normal: iconHomeNormal, active: iconHomePressed },
    travel: { normal: iconBusinessNormal, active: iconBusinessPressed },
    orders: { normal: iconOrderNormal, active: iconOrderPressed },
    member: { normal: iconRailwayNormal, active: iconRailwayPressed },
    my: { normal: iconMineNormal, active: iconMinePressed },
  };

  const tabs = [
    { route: routes.home, name: s.tab_home, key: 'home', path: '/' },
    { route: routes.travel, name: s.tab_travel, key: 'travel', path: '/travel' },
    { route: routes.orders, name: s.tab_orders, key: 'orders', path: '/orders' },
    { route: routes.member, name: s.tab_member, key: 'member', path: '/member' },
    { route: routes.my, name: s.tab_my, key: 'my', path: '/my' },
  ];

  return (
    <div data-navigation-bar-foreground="dark" data-hide-on-keyboard>
      <div className="h-1 bg-gradient-to-b from-transparent to-[#e8e8e8] pointer-events-none" />
      <div className="bg-[#F9F9F9] flex justify-around items-center pt-[7px] pb-3">
        {tabs.map(tab => {
          const active = pathname === tab.path;
          return (
            <button
              key={tab.key}
              className="flex flex-col items-center justify-center flex-1"
              {...bindNav(tab.route, { replace: true })}
            >
              <img
                src={active ? TAB_ICON_MAP[tab.key].active : TAB_ICON_MAP[tab.key].normal}
                alt={tab.name}
                width={22}
                height={22}
                className="block"
              />
              <span className={`text-[12px] mt-[2px] ${active ? 'text-app-primary' : 'text-app-text-muted'}`}>
                {tab.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── AuthGuard ──────────────────────────────────────────────────
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loggedIn = useRailwayStore(s => s.isLoggedIn);
  const location = useLocation();

  if (!loggedIn) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
};

// ─── Layout ─────────────────────────────────────────────────────
const Layout: React.FC = () => {
  const { pathname } = useLocation();
  const isMainTab = ['/', '/travel', '/orders', '/member', '/my'].includes(pathname);

  return (
    <div className="relative w-full h-full bg-app-bg flex flex-col overflow-hidden">
      <div className="flex-1 relative w-full overflow-hidden">
        {/* Each page instance renders its own layout (ActivityRouteHost): sub-pages stay on the
            back stack; main tabs are rebuilt on every switch, as before. */}
        <RouteScrollContainer className="h-full overflow-y-auto no-scrollbar">
          <Outlet />
        </RouteScrollContainer>
      </div>

      {isMainTab && <TabBar />}
    </div>
  );
};

// ─── App Root ───────────────────────────────────────────────────

const Railway12306App: React.FC = () => {
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

  useEffect(() => {
    initStations().catch(() => {});
  }, []);

  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <div className="w-full h-full overflow-hidden">
        <MemoryRouter>
          <RailwayNavigationHandler />
          {/* Pages below the top stay as they were left (Fragment back stack), see ActivityRouteHost. */}
          <ActivityRouteHost>
            <Route path="/auth/login" element={<RailwayLoginPage />} />
            <Route path="/auth/register" element={<RailwayRegisterPage />} />
            <Route path="/auth/register-verify" element={<RegisterVerifyPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
              {/* Main tabs */}
              <Route index element={<HomePage />} />
              <Route path="travel" element={<TravelServicePage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="member" element={<MemberPage />} />
              <Route path="my" element={<MyPage />} />
              <Route path="station-select" element={<StationSelectPage />} />
              <Route path="date-select" element={<DateSelectPage />} />
              <Route path="query-result" element={<QueryResultPage />} />
              <Route path="my-tickets" element={<MyTicketsPage />} />
              <Route path="paid-orders" element={<PaidOrdersPage />} />
              <Route path="incomplete-orders" element={<IncompleteOrdersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="all-apps" element={<AllAppsPage />} />
              <Route path="station-board" element={<StationBoardPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="invoice" element={<InvoicePage />} />
              <Route path="invoice-headers" element={<InvoiceHeadersPage />} />
              <Route path="add-invoice-header" element={<AddInvoiceHeaderPage />} />
              <Route path="invoice-email" element={<InvoiceEmailPage />} />
              <Route path="service-phone" element={<ServicePhonePage />} />
              <Route path="my-account" element={<MyAccountPage />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
              <Route path="notification-settings" element={<NotificationSettingsPage />} />
              <Route path="id-verify" element={<IdVerifyPage />} />
              <Route path="fingerprint" element={<FingerprintPage />} />
              <Route path="version-switch" element={<VersionSwitchPage />} />
              <Route path="font-size" element={<FontSizePage />} />
              <Route path="cancel-account" element={<CancelAccountPage />} />
              <Route path="payment-password" element={<PaymentPasswordPage />} />
              <Route path="student-verify" element={<StudentVerifyPage />} />
              <Route path="change-phone" element={<ChangePhonePage />} />
              <Route path="special-passenger" element={<SpecialPassengerPage />} />
              <Route path="air-rail" element={<AirRailPage />} />
              <Route path="bus-ticket" element={<BusTicketPage />} />
              <Route path="order-confirm" element={<OrderConfirmPage />} />
              <Route path="passengers" element={<PassengerListPage />} />
              <Route path="add-passenger" element={<AddPassengerPage />} />
              <Route path="edit-profile" element={<EditProfilePage />} />
              <Route path="payment-platform" element={<PaymentPlatformPage />} />
              <Route path="payment-success" element={<PaymentSuccessPage />} />
              <Route path="refund-confirm" element={<RefundConfirmPage />} />
              <Route path="refund-success" element={<RefundSuccessPage />} />
              <Route path="order-detail" element={<OrderDetailPage />} />
            </Route>
          </ActivityRouteHost>
        </MemoryRouter>
      </div>
    </div>
  );
};

export default Railway12306App;
