import { useAlipayStrings } from './hooks/useAlipayStrings';
import React from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useLocale } from '@/apps/Alipay/locale';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { MemoryRouter, Routes, Route, useLocation, Outlet } from 'react-router-dom';
import { IcTabHome, IcTabFinance, IcTabVideo, IcTabMessage, IcTabMe, IcScan, IcQrCode, IcBus, IcWalletCards, IcSecureCheck, IcFastPay, IcTicket, IcTaxi, IcMovie, IcTransfer, IcCard, IcPhone, IcGrid, IcApp, IcPiggyBank, IcCoins, IcTrend, IcShield, IcReceive, IcMore, IcNavBack, IcSearch, IcAdd, IcExpand, IcNavForward, IcSettings, IcHeadphone, IcArrow, IcHelp, IcClock, IcClose, IcFile, IcChart, IcWallet, IcCircle, IcDroplet, IcBusiness, IcBank, IcBuilding, IcMedical, IcHeart } from './res/icons';
import { useAlipayStore, computeUnread } from './state';
import { HomePage } from './pages/HomePage';
import { FinancePage } from './pages/FinancePage';
import { MessagesPage } from './pages/MessagesPage';
import { MyPage } from './pages/MyPage';
import { VideoPage } from './pages/VideoPage';
import { PayPage } from './pages/PayPage';
import { ReceivePage } from './pages/ReceivePage';
import { TransferPage } from './pages/TransferPage';
import { BalancePage } from './pages/BalancePage';
import { TotalAssetsPage } from './pages/TotalAssetsPage';
import { YuebaoPage } from './pages/YuebaoPage';
import { TransferToAlipayPage } from './pages/TransferToAlipayPage';
import { TransferAmountPage } from './pages/TransferAmountPage';
import { TransferSuccessPage } from './pages/TransferSuccessPage';
import { CashierPage } from './pages/CashierPage';
import { SettingsPage } from './pages/SettingsPage';
import { BalanceRecordsPage } from './pages/BalanceRecordsPage';
import { BillsPage } from './pages/BillsPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactProfilePage } from './pages/ContactProfilePage';
import { ChatPage } from './pages/ChatPage';
import { PaymentSettingsPage } from './pages/PaymentSettingsPage';
import { GeneralSettingsPage } from './pages/GeneralSettingsPage';
import { LanguageSettingsPage } from './pages/LanguageSettingsPage';
import { FontSizeSettingsPage } from './pages/FontSizeSettingsPage';
import { DarkModeSettingsPage } from './pages/DarkModeSettingsPage';
import { SpeedModeSettingsPage } from './pages/SpeedModeSettingsPage';
import { ClipboardSettingsPage } from './pages/ClipboardSettingsPage';
import { MyPageManagePage } from './pages/MyPageManagePage';
import { HomeManagePage } from './pages/HomeManagePage';
import { SearchPreManagePage } from './pages/SearchPreManagePage';
import { VoiceFloatingBallPage } from './pages/VoiceFloatingBallPage';
import { ActivityAmbiencePage } from './pages/ActivityAmbiencePage';
import { SearchBoxManagePage } from './pages/SearchBoxManagePage';
import { PayOrderSettingsPage } from './pages/PayOrderSettingsPage';
import { FastPaySettingsPage } from './pages/FastPaySettingsPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { AlipayNavigationHandler } from './components/AlipayNavigationHandler';
import { useAlipayGestures } from './hooks/useAlipayGestures';

import { BillAnalysisPage } from './pages/BillAnalysisPage';
import { BillDetailPage } from './pages/BillDetailPage';
import { BillSearchPage } from './pages/BillSearchPage';
import { PaymentPasswordChangePage } from './pages/PaymentPasswordChangePage';
import { BankCardsPage } from './pages/BankCardsPage';
import { AddBankCardPage } from './pages/AddBankCardPage';
import { AddBankCardVerifyPage } from './pages/AddBankCardVerifyPage';
import { RechargePage } from './pages/RechargePage';
import { RechargeSuccessPage } from './pages/RechargeSuccessPage';
import { RechargeCardPage } from './pages/RechargeCardPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { RefundPage } from './pages/RefundPage';
import { ScanPage } from './pages/ScanPage';


// Icon mapping for dynamic icons from config
const ICON_MAP: Record<string, any> = {
  IcTabHome, IcTabFinance, IcTabVideo, IcTabMessage, IcTabMe,
  IcScan, IcQrCode, IcBus, IcWalletCards,
  IcSecureCheck, IcFastPay, IcTicket, IcTaxi, IcMovie, IcTransfer, IcCard, IcPhone, IcGrid, IcApp,
  IcPiggyBank, IcCoins, IcTrend, IcShield, IcReceive,
  IcMore, IcNavBack, IcSearch, IcAdd, IcExpand, IcNavForward, IcSettings, IcHeadphone, IcArrow, IcHelp, IcClock, IcClose,
  IcFile, IcChart, IcWallet, IcCircle, IcDroplet, IcBusiness, IcBank, IcBuilding, IcMedical, IcHeart,
};


const TAB_PATH_TO_ID: Record<string, string> = { '/': 'home', '/finance': 'finance', '/video': 'video', '/messages': 'messages', '/my': 'my' };

const TabBar: React.FC = () => {
  const { pathname } = useLocation();
  const activeTab = TAB_PATH_TO_ID[pathname] ?? '';
  const conversations = useAlipayStore(s => s.conversations);
  const chatHistory = useAlipayStore(s => s.chatHistory);
  const { bindTap } = useAlipayGestures();
  const s = useAlipayStrings();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const totalUnread = conversations.reduce((sum, c) => sum + computeUnread(c, chatHistory), 0);

  const tabs = [
    { id: 'home', name: s.home, icon: IcTabHome, path: '/' },
    { id: 'finance', name: s.finance, icon: IcTabFinance, path: '/finance' },
    { id: 'video', name: s.video, icon: IcTabVideo, path: '/video' },
    { id: 'messages', name: s.messages, icon: IcTabMessage, path: '/messages' },
    { id: 'my', name: s.tabbar_me, icon: IcTabMe, path: '/my' },
  ];

  return (
    <div data-hide-on-keyboard className="flex-shrink-0 bg-app-surface border-t border-app-border flex justify-around items-center py-2 pb-safe">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
              key={tab.id}
              className="flex flex-col items-center justify-center py-1 px-2 relative"
              {...(tab.id === 'home'
                ? bindTap<HTMLButtonElement>('tab.home')
                : tab.id === 'finance'
                  ? bindTap<HTMLButtonElement>('tab.finance')
                  : tab.id === 'video'
                    ? bindTap<HTMLButtonElement>('tab.video')
                    : tab.id === 'messages'
                      ? bindTap<HTMLButtonElement>('tab.messages')
                      : bindTap<HTMLButtonElement>('tab.my'))}
            >
            <div className="relative">
              {tab.id === 'home' ? (
                 <div className={`w-6 h-6 rounded-md flex items-center justify-center mb-1 ${activeTab === 'home' ? 'bg-app-primary' : ''}`}>
                    <span className={`text-sm font-bold ${activeTab === 'home' ? 'text-white' : 'text-gray-500'}`}>{isEnglish ? 'A' : '支'}</span>
                 </div>
              ) : (
                <Icon 
                    size={24}
                    className={`mb-1 ${activeTab === tab.id ? 'text-app-primary' : 'text-gray-500'}`}
                    strokeWidth={activeTab === tab.id ? 2.5 : 2}
                />
              )}
              {tab.id === 'messages' && totalUnread > 0 && (
                <div className="absolute -top-1 -right-2 bg-red-500 w-5 h-4 rounded-full flex items-center justify-center z-10 pointer-events-none">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-white rounded-full"></span>
                    <span className="w-1 h-1 bg-white rounded-full"></span>
                    <span className="w-1 h-1 bg-white rounded-full"></span>
                  </div>
                </div>
              )}
            </div>
            <span 
              className={`text-[10px] ${activeTab === tab.id ? 'text-app-primary font-medium' : 'text-gray-500'}`}
            >
              {tab.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const Layout: React.FC = () => {
  const { pathname } = useLocation();
  const isMainTab = ['/', '/finance', '/video', '/messages', '/my'].includes(pathname);
  const showTabBar = isMainTab;
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    const key = `alipay_layout_scroll_v1:${pathname}`;
    try {
      const raw = window.sessionStorage.getItem(key);
      const top = raw ? Number(raw) : 0;
      if (el && Number.isFinite(top) && top > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = top;
          });
        });
      }
    } catch {}

    return () => {
      const el = scrollRef.current;
      try {
        if (el) window.sessionStorage.setItem(key, String(el.scrollTop));
      } catch {}
    };
  }, [pathname]);

  return (
    <div className="h-full w-full flex flex-col">
      <div
        ref={scrollRef}
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar"
      >
        {/* 主 Tab 常驻挂载，使用条件渲染控制显示 */}
        {pathname === '/' && <HomePage />}
        {pathname === '/finance' && <FinancePage />}
        {pathname === '/video' && <VideoPage />}
        {pathname === '/messages' && <MessagesPage />}
        {pathname === '/my' && <MyPage />}

        {/* 子页面互斥渲染 */}
        {!isMainTab && <Outlet />}
      </div>
      
      {showTabBar && <TabBar />}
    </div>
  );
};

export const AlipayApp: React.FC = () => {
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
    <div className="w-full h-full bg-app-bg overflow-hidden">
        <MemoryRouter>
          <AlipayNavigationHandler />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="video" element={<VideoPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="my" element={<MyPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/payment" element={<PaymentSettingsPage />} />
              <Route path="settings/payment/order" element={<PayOrderSettingsPage />} />
              <Route path="settings/payment/fast-pay" element={<FastPaySettingsPage />} />
              <Route path="settings/payment/password" element={<PaymentPasswordChangePage />} />
              <Route path="settings/payment/bank-cards" element={<BankCardsPage />} />
              <Route path="bank-cards" element={<BankCardsPage />} />
              <Route path="bank-cards/add" element={<AddBankCardPage />} />
              <Route path="bank-cards/add/verify" element={<AddBankCardVerifyPage />} />
              <Route path="settings/payment/recharge" element={<RechargeCardPage />} />
              <Route path="settings/payment/subscriptions" element={<SubscriptionsPage />} />
              <Route path="pay/refund" element={<RefundPage />} />
              <Route path="settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="settings/general" element={<GeneralSettingsPage />} />
              <Route path="settings/general/language" element={<LanguageSettingsPage />} />
              <Route path="settings/general/font-size" element={<FontSizeSettingsPage />} />
              <Route path="settings/general/dark-mode" element={<DarkModeSettingsPage />} />
              <Route path="settings/general/speed-mode" element={<SpeedModeSettingsPage />} />
              <Route path="settings/general/clipboard" element={<ClipboardSettingsPage />} />
              <Route path="settings/general/my-manage" element={<MyPageManagePage />} />
              <Route path="settings/general/home-manage" element={<HomeManagePage />} />
              <Route path="settings/general/home-manage/search-pre" element={<SearchPreManagePage />} />
              <Route path="settings/general/home-manage/voice-float" element={<VoiceFloatingBallPage />} />
              <Route path="settings/general/home-manage/activity-ambience" element={<ActivityAmbiencePage />} />
              <Route path="settings/general/home-manage/search-box" element={<SearchBoxManagePage />} />
              <Route path="bill" element={<BillsPage />} />
              <Route path="bill/search" element={<BillSearchPage />} />
              <Route path="bill/detail/:id" element={<BillDetailPage />} />
              <Route path="bill/analysis" element={<BillAnalysisPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="contacts/profile" element={<ContactProfilePage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="pay" element={<PayPage />} />
              <Route path="scan" element={<ScanPage />} />
              <Route path="pay/receive" element={<ReceivePage />} />
              <Route path="pay/transfer" element={<TransferPage />} />
              <Route path="balance" element={<BalancePage />} />
              <Route path="assets" element={<TotalAssetsPage />} />
              <Route path="yuebao" element={<YuebaoPage />} />
              <Route path="balance/records" element={<BalanceRecordsPage />} />
              <Route path="balance/recharge" element={<RechargePage />} />
              <Route path="balance/recharge/success" element={<RechargeSuccessPage />} />
              <Route path="pay/transfer/to-account" element={<TransferToAlipayPage />} />
              <Route path="pay/transfer/amount" element={<TransferAmountPage />} />
              <Route path="pay/transfer/success" element={<TransferSuccessPage />} />
              <Route path="pay/cashier" element={<CashierPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </div>
    </div>
  );
};

export default AlipayApp;
