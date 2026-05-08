import React, { useState, useEffect, useRef } from 'react';
import {
  IcSettings, IcMessage, IcUser, IcFile, IcTicket, IcCheckCircle,
  IcMonitor, IcClock, IcCalendarClock, IcTimer, IcPay, IcTransfer,
  IcLocation, IcMore, IcUserCheck, IcFingerprint, IcLock, IcPhone,
  IcBell, IcHeartHandshake, IcTicketX, IcEducation, IcNavForward,
  IcHelp, IcMessageCircle, IcAccessibility, IcPhoneCall, IcGlobe, IcReceipt,
} from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';

import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { ServiceGrid } from '../components/ServiceGrid';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { localizeRailwayItemName } from '../utils/localizeRailwayItem';
const warmServiceIconMap: Record<string, React.ElementType> = {
  UserCheck: IcUserCheck, HelpCircle: IcHelp, MessageSquare: IcMessage, MessageCircle: IcMessageCircle, Accessibility: IcAccessibility, Phone: IcPhoneCall, Globe: IcGlobe,
};

// 出行向导 item ID → transition
const GUIDE_NAV_MAP: Record<string, string> = {
  station_screen: 'service.stationBoard',
  timetable: 'service.timetable',
};

// 常用功能 item ID → transition
const FUNC_NAV_MAP: Record<string, string> = {
  id_verify: 'settings.idVerify',
  fingerprint: 'settings.fingerprint',
  change_password: 'settings.changePassword',
  change_phone: 'account.changePhone',
  notifications: 'settings.notificationSettings',
  student_verify: 'account.studentVerify',
  invoice: 'orders.invoice',
};

// 温馨服务 item ID → transition
const WARM_NAV_MAP: Record<string, string> = {
  special_passenger: 'service.specialPassenger',
  service_phone: 'service.servicePhone',
};

export const MyPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindTap, go } = useRailwayGestures();
  const { user, travelGuide, commonFunctions, warmServices, infoServices } = config;
  const s = useRailwayStrings();

  const handleNav = (map: Record<string, string>) => (id: string) => {
    const t = map[id];
    if (t) go(t as any);
  };

  // 监听滚动位置，切换顶栏透明→白色
  const topBarRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const scrollContainer = topBarRef.current?.closest('[data-scroll-container]');
    if (!scrollContainer) return;
    const handleScroll = () => {
      setScrollProgress(Math.min(1, scrollContainer.scrollTop / 80));
    };
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const isFullyScrolled = scrollProgress >= 1;

  const quickLinks = [
    { id: 'passengers', name: s.my_passengers, icon: IcUser, navId: 'my.passengers' },
    { id: 'my_orders', name: s.my_orders_short, icon: IcFile },
    { id: 'coupons', name: s.my_coupons, icon: IcTicket },
  ];

  return (
    <div className="min-h-full bg-app-bg">
      {/* 固定顶栏 — sticky 定位，滚动后透明→白色 */}
      <div
        ref={topBarRef}
        className="sticky top-0 z-20 -mb-[70px] pt-10 px-3"
        style={{ backgroundColor: `rgba(255, 255, 255, ${scrollProgress})` }}
        data-status-bar-foreground={isFullyScrolled ? 'light' : 'dark'}
      >
        <div className="flex items-center justify-between h-[30px]">
          <span className="text-base font-medium text-gray-900" style={{ opacity: scrollProgress }}>{s.tab_my}</span>
          <div className="flex items-center gap-3">
            <div {...bindTap<HTMLDivElement>('my.settings' as any)}>
 <IcSettings size={22} className={` ${isFullyScrolled ? 'text-gray-700' : 'text-white'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }} />
            </div>
            <div {...bindTap<HTMLDivElement>('my.notifications' as any)}>
 <IcMessage size={22} className={` ${isFullyScrolled ? 'text-gray-700' : 'text-white'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 蓝色渐变头部 */}
      <div className="bg-gradient-to-b from-app-primary to-[#5A9BE6] pt-10 pb-6 px-3">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-app-surface/20 border-2 border-white/40 flex items-center justify-center active:opacity-70" {...bindTap<HTMLDivElement>('my.account' as any)}>
            <IcUser size={28} className="text-white/70" />
          </div>
          <div>
            <span className="text-white text-lg font-medium">{user.name}</span>
            <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-white bg-app-surface/20 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                {s.my_phone_verified} <IcCheckCircle size={10} className="text-green-300" />
              </span>
              <span className="text-[11px] text-white bg-app-surface/20 rounded-full px-2.5 py-0.5 flex items-center gap-1 active:opacity-70" {...bindTap<HTMLSpanElement>('my.account' as any)}>
                {s.my_identity_verified} <IcCheckCircle size={10} className="text-green-300" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 快捷入口卡片 */}
      <div className="mx-[10px] -mt-3 bg-app-surface rounded-[6px] py-4 flex justify-around shadow-sm relative z-10">
        {quickLinks.map(link => {
          const Icon = link.icon;
          return (
            <div
              key={link.id}
              className="flex flex-col items-center gap-1.5 active:opacity-70"
              {...(link.navId ? bindTap<HTMLDivElement>(link.navId as any) : {})}
            >
              <Icon size={26} className="text-app-primary" />
              <span className="text-xs text-gray-700">{link.name}</span>
            </div>
          );
        })}
      </div>

      {/* 预约购票 banner */}
      <div className="mx-[10px] mt-[6px] h-20 bg-gradient-to-r from-app-primary to-[#6BA3E8] rounded-[6px] flex items-center px-5 shadow-sm">
        <div className="flex-1">
          <p className="text-white text-base font-bold">{s.my_advance_booking_title}</p>
          <p className="text-white/80 text-xs mt-1">{s.my_advance_booking_desc}</p>
        </div>
      </div>

      {/* 出行向导 */}
      <div className="mx-[10px] mt-[6px] bg-app-surface rounded-[6px] px-4 py-3">
        <div className="border-b border-gray-100 pb-2 mb-3">
          <span className="text-base font-medium text-gray-900">{s.my_travel_guide_title}</span>
        </div>
        <ServiceGrid items={travelGuide} columns={4} onItemClick={handleNav(GUIDE_NAV_MAP)} />
      </div>

      {/* 常用功能 */}
      <div className="mx-[10px] mt-[6px] bg-app-surface rounded-[6px] px-4 py-3">
        <div className="border-b border-gray-100 pb-2 mb-3">
          <span className="text-base font-medium text-gray-900">{s.my_common_features_title}</span>
        </div>
        <ServiceGrid items={[...commonFunctions, { id: 'invoice', name: s.service_invoice, icon: 'Receipt', color: '#3B99FC' }]} columns={4} onItemClick={handleNav(FUNC_NAV_MAP)} />
      </div>

      {/* 温馨服务 */}
      <div className="mx-[10px] mt-[6px] bg-app-surface rounded-[6px] px-4 py-3">
        <div className="border-b border-gray-100 pb-2 mb-3">
          <span className="text-base font-medium text-gray-900">{s.service_warm_service}</span>
        </div>
        <div className="grid grid-cols-4 gap-y-4 gap-x-2">
          {warmServices.map((item) => {
            const Icon = warmServiceIconMap[item.icon] || IcHelp;
            return (
              <div
                key={item.id}
                className="flex flex-col items-center gap-1.5 active:opacity-70"
                onClick={() => handleNav(WARM_NAV_MAP)(item.id)}
              >
                <Icon size={24} className="text-gray-500" />
                <span className="text-xs text-gray-700 text-center">{localizeRailwayItemName(item.id, item.name, s)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 通知消息 */}
      <div
        className="mx-[10px] mt-[6px] bg-app-surface rounded-[6px] px-4 py-4 flex items-center justify-between active:bg-gray-50"
        {...bindTap<HTMLDivElement>('my.notifications' as any)}
      >
        <span className="text-base font-medium text-gray-900">{s.my_notifications_title}</span>
        <IcNavForward size={18} className="text-gray-300" />
      </div>

      {/* 系统设置 */}
      <div
        className="mx-[10px] mt-[6px] bg-app-surface rounded-[6px] px-4 py-4 flex items-center justify-between active:bg-gray-50"
        {...bindTap<HTMLDivElement>('my.settings' as any)}
      >
        <span className="text-base font-medium text-gray-900">{s.my_system_settings_title}</span>
        <IcNavForward size={18} className="text-gray-300" />
      </div>

      {/* 信息服务 */}
      <div className="mx-[10px] mt-[6px] bg-app-surface rounded-[6px] px-4 py-3 mb-6">
        <div className="border-b border-gray-100 pb-2 mb-3">
          <span className="text-base font-medium text-gray-900">{s.my_info_services_title}</span>
        </div>
        <div>
          {infoServices.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-b-0">
              <span className="text-sm text-gray-900">{localizeRailwayItemName(item.id, item.name, s)}</span>
              <IcNavForward size={18} className="text-gray-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
