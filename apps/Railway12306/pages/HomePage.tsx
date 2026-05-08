import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { IcSearch, IcExpand, IcSwap, IcMessage, IcFlight, IcBus, IcScan, IcSwapAlt, IcTrain } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useShallow } from 'zustand/react/shallow';
import { RAILWAY12306_CONFIG } from '../data';
import { SwipeableServiceGrid } from '../components/SwipeableServiceGrid';
import * as TimeService from '../../../os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../../../os/locale';
// Service grid item ID → transition ID mapping
const SERVICE_NAV_MAP: Record<string, string> = {
  station_screen: 'service.stationBoard',
  timetable: 'service.timetable',
  warm_service: 'service.servicePhone',
  air_rail: 'service.airRail',
  bus_ship: 'service.busTicket',
  invoice: 'orders.invoice',
};

export const HomePage: React.FC = () => {
  const { from, to, date, isStudent, searchHistory } = useRailwayStore(useShallow(s => ({ from: s.from, to: s.to, date: s.date, isStudent: s.isStudent, searchHistory: s.searchHistory })));
  const swapStations = useRailwayStore(s => s.swapStations);
  const setStationSelectTarget = useRailwayStore(s => s.setStationSelectTarget);
  const setIsStudent = useRailwayStore(s => s.setIsStudent);
  const config = RAILWAY12306_CONFIG;
  const { bindTap, go } = useRailwayGestures();
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const handleServiceClick = (id: string) => {
    const transitionId = SERVICE_NAV_MAP[id];
    if (transitionId) go(transitionId as any);
  };

  // 只展示出发时间在当前时间之后的行程
  const upcomingTrips = useMemo(() => {
    const currentTs = TimeService.now();
    return config.notifications.filter(n => {
      if (n.type !== 'trip' || !n.fromStation || !n.departTimestamp) return false;
      const departTs = TimeService.parseToTimestamp(n.departTimestamp);
      return departTs > currentTs;
    });
  }, [config.notifications]);

  const dateObj = TimeService.fromTimestamp(TimeService.parseToTimestamp(date + 'T00:00:00'));
  const today = TimeService.getDate();
  today.setHours(0, 0, 0, 0);
  const isToday = dateObj.getTime() === today.getTime();
  const dateLabel = `${dateObj.getMonth() + 1}${s.date_suffix_month}${dateObj.getDate()}${s.date_suffix_day}`;
  const dayNames = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
  const dayLabel = isToday ? s.home_date_today : dayNames[dateObj.getDay()];

  // 监听滚动位置，切换顶栏透明/白色模式
  const topBarRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = topBarRef.current?.closest('[data-scroll-container]');
    if (!scrollContainer) return;
    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > 150);
    };
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-full pb-4 bg-app-bg">
      {/* 固定顶栏 — sticky 定位，滚动后从透明变为白色 */}
      <div
        ref={topBarRef}
 className={`sticky top-0 z-20 h-(--app-top-bar-height) -mb-[70px] px-3 pt-10 ${
          isScrolled ? 'bg-app-surface' : ''
        }`}
        data-status-bar-foreground={isScrolled ? 'dark' : 'light'}
      >
        <div className="flex items-center gap-2.5 h-[30px]">
          {/* 城市选择 tv_city + iv_down_arrow */}
          <div className={`flex items-center gap-0.5 shrink-0 ${isScrolled ? 'text-app-text' : 'text-white'}`}>
            <span className="text-[14px] font-bold leading-none max-w-[4em] truncate">{isEnglish ? 'Beijing' : '北京'}</span>
            <IcExpand size={18} className="opacity-90" />
          </div>
          {/* 搜索栏 hp_title_search_bg_white */}
          <div className={`flex-1 h-[30px] rounded-[5px] px-2 flex items-center gap-1 ${
            isScrolled ? 'bg-app-bg' : 'bg-app-bg/15 backdrop-blur-sm'
          }`}>
            <IcSearch size={16} className={`shrink-0 ${isScrolled ? 'text-app-text-muted' : 'text-white/70'}`} />
            <span className={`text-[12px] truncate ${isScrolled ? 'text-app-text-muted' : 'text-white/70'}`}>{s.home_search_hint}</span>
          </div>
          {/* 版本切换 */}
          <IcSwapAlt size={22} className={`shrink-0 opacity-90 ${isScrolled ? 'text-app-text' : 'text-white'}`} />
          {/* 扫码 */}
          <IcScan size={22} className={`shrink-0 opacity-90 ${isScrolled ? 'text-app-text' : 'text-white'}`} />
          {/* 消息中心 + 红点 */}
          <div className="relative shrink-0">
            <IcMessage size={22} className={`opacity-90 ${isScrolled ? 'text-app-text' : 'text-white'}`} />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          </div>
        </div>
      </div>

      {/* 顶部区域: Banner 背景 + Booking Card 重叠 */}
      <div className="relative">
        {/* 广告 Banner 背景 — 还原 img_ad_content: 全屏宽 230dp */}
        <div className="h-[230px] bg-gradient-to-br from-[#E8524A] to-[#FF8E53] relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-between px-6">
            <div className="text-white">
              <div className="text-[22px] font-bold mt-8">{isEnglish ? 'Spring Car Rental Deals' : '新春特惠租车'}</div>
              <div className="text-[13px] opacity-90 mt-1">{isEnglish ? 'Tap to view now' : '点击立即查看'}</div>
              <div className="text-[10px] opacity-70 mt-2">{isEnglish ? 'Promo: Feb 1, 2026 - Feb 28, 2026' : '活动时间: 2026年2月1日-2026年2月28日'}</div>
            </div>
            <div className="text-5xl mt-6">🚗</div>
          </div>
          <div className="absolute bottom-0 right-0 bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-tl-md">{isEnglish ? 'Ad' : '广告'}</div>
        </div>

        {/* 订票表单卡片 — 从 y≈150 开始，与 Banner 底部重叠 */}
        <div className="mx-[10px] bg-app-surface rounded-[8px] shadow-sm pb-[10px] mb-3 relative z-10 -mt-[80px]">
        {/* 票种 tab: cl_tab_container — 三等分占满 340px */}
        <div className="flex pt-[15px]">
             <div className="flex-1 flex flex-col items-center gap-1 cursor-pointer">
               <span className="text-app-primary font-bold text-[17px]">{s.home_tab_train}</span>
               <div className="w-6 h-[2px] bg-app-primary rounded-full"></div>
             </div>
             <div className="flex-1 flex flex-col items-center gap-1 cursor-pointer opacity-50">
               <div className="flex items-center gap-1">
                 <IcFlight size={14} className="text-app-text" />
                 <span className="text-app-text font-medium text-[17px]">{s.home_tab_flight}</span>
               </div>
             </div>
             <div className="flex-1 flex flex-col items-center gap-1 cursor-pointer opacity-50">
               <div className="flex items-center gap-1">
                 <IcBus size={14} className="text-app-text" />
                 <span className="text-app-text font-medium text-[17px]">{s.home_tab_bus}</span>
               </div>
             </div>
        </div>

        {/* 出发 ↔ 到达: rl_station, margin_size_23, textSize 23sp */}
        <div className="flex items-center justify-between h-(--app-station-row-height) mt-[15px] px-[23px]">
          <div
            className="flex-1 cursor-pointer"
            {...bindTap<HTMLDivElement>('home.stationSelect.from', {
              beforeTrigger: () => setStationSelectTarget('from'),
            })}
          >
            <span className="text-[23px] font-bold text-app-text">{from}</span>
          </div>
          <button
            className="mx-1 w-6 h-6 flex items-center justify-center"
            data-action="home.form.swapStations" data-action-type="tap"
            onClick={swapStations}
          >
            <IcSwap size={20} className="text-app-primary" />
          </button>
          <div
            className="flex-1 text-right cursor-pointer"
            {...bindTap<HTMLDivElement>('home.stationSelect.to', {
              beforeTrigger: () => setStationSelectTarget('to'),
            })}
          >
            <span className="text-[23px] font-bold text-app-text">{to}</span>
          </div>
        </div>

        {/* 分割线 month_line */}
        <div className="h-[0.5px] bg-app-bg mx-[23px]" />

        {/* 日期 + 只看高铁 + 学生票: text_size_20, text_size_13 */}
        <div className="flex items-center justify-between pt-3 px-[23px]">
          <div
            className="cursor-pointer flex items-baseline"
            {...bindTap<HTMLDivElement>('home.dateSelect')}
          >
            <span className="text-[20px] text-app-text">{dateLabel}</span>
            <span className="text-[13px] text-[#666] ml-2">{dayLabel}</span>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-[5px] cursor-pointer">
              <input
                type="checkbox"
                checked={isStudent}
                onChange={e => setIsStudent(e.target.checked)}
                className="w-[14px] h-[14px] rounded-sm border-gray-300 text-app-primary focus:ring-app-primary"
                data-action="home.form.toggleStudent" data-action-type="tap"
              />
              <span className="text-[13px] text-app-text">{s.home_student_ticket}</span>
            </label>
          </div>
        </div>

        {/* 分割线 iv_search_button_divider */}
        <div className="h-[0.5px] bg-app-bg mx-[23px] mt-3" />

        {/* 查询按钮: hp_query_button, h=44dp, radius 4dp, text_size_18 */}
        <button
 className="w-[calc(100%-46px)] mx-[23px] h-(--app-query-btn-height) bg-app-primary rounded-[4px] text-white text-[18px] font-bold mt-3 active:bg-app-primary-dark active:scale-[0.99] "
 style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          {...bindTap<HTMLButtonElement>('home.queryResult')}
        >
          {s.home_query_btn}
        </button>

        {/* 历史记录 ticket_home_history_view, gap 25dp */}
        {searchHistory.length > 0 && (
          <div className="flex items-center mt-2 px-[23px] pb-1">
            <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-[25px]">
                {searchHistory.map((h, i) => (
                  <span key={i} className="text-[12px] text-app-text-muted whitespace-nowrap">{h}</span>
                ))}
              </div>
            </div>
            <span className="text-[12px] text-app-text-muted whitespace-nowrap cursor-pointer shrink-0 ml-[25px]">{s.home_clear_history}</span>
          </div>
        )}
      </div>
      </div>{/* 关闭 relative wrapper */}

      {/* 行程提醒卡片: home_trip.xml — 只展示未来行程 */}
      {upcomingTrips.length > 0 && (
        <div className="mx-[10px] bg-app-surface rounded-[6px] shadow-sm mb-[6px] overflow-hidden">
          <div className="flex items-center gap-2 px-[15px] pt-3 pb-1">
            <IcTrain size={14} className="text-app-primary" />
            <span className="text-[13px] font-medium text-app-text">{s.home_trip_reminder}</span>
          </div>
          {upcomingTrips.slice(0, 1).map(trip => (
            <div key={trip.id} className="px-[15px] pb-3">
              <div className="flex items-center justify-between mt-2">
                <div className="text-center">
                  <div className="text-[18px] font-bold text-app-text">{trip.departTime?.split(' ')[1] || ''}</div>
                  <div className="text-[11px] text-app-text-muted mt-0.5">{trip.fromStation}</div>
                </div>
                <div className="flex-1 px-3 flex flex-col items-center">
                  <div className="text-[11px] text-app-text-muted">{trip.trainNo}</div>
                  <div className="flex items-center w-full my-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-app-primary" />
                    <div className="flex-1 h-px bg-gray-200" />
                    <div className="w-0 h-0 border-l-[5px] border-l-app-primary border-y-[2px] border-y-transparent" />
                  </div>
                  <div className="text-[10px] text-app-text-muted">{trip.departTime?.split(' ')[0] || ''}</div>
                </div>
                <div className="text-center">
                  <div className="text-[18px] font-bold text-app-text">&nbsp;</div>
                  <div className="text-[11px] text-app-text-muted mt-0.5">{trip.toStation}</div>
                </div>
              </div>
              {trip.gate && (
                <div className="mt-2 bg-blue-50 rounded px-2.5 py-1.5 text-[11px] text-app-primary">
                  {s.home_gate_prefix}{trip.gate}
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {/* 服务网格: cornerRadius 6dp, 无内边距让网格项占满 340px */}
      <div className="mx-[10px] bg-app-surface rounded-[6px] shadow-sm mb-[6px]">
        <SwipeableServiceGrid
          items={config.serviceGrid}
          columns={5}
          rowsPerPage={3}
          onItemClick={handleServiceClick}
          onOverscrollNavigate={() => go('home.allApps')}
        />
      </div>

      {/* 热门资讯: home_news.xml, cornerRadius 6dp */}
      <div className="mx-[10px] bg-app-surface rounded-[6px] shadow-sm px-[15px] pt-3 pb-[3px] mb-[6px]">
        <div className="flex items-center gap-2 mb-[3px]">
          <span className="text-[#FF4444] font-bold text-[14px] italic">{isEnglish ? 'Hot' : '热门'}</span>
          <div className="w-[1px] h-[14px] bg-gray-300"></div>
          <span className="text-app-text font-bold text-[14px]">{isEnglish ? 'News' : '资讯'}</span>
          <div className="flex-1" />
          <span className="text-[12px] text-[#666]">{isEnglish ? '3 new updates' : '3条新消息'}</span>
          <IcExpand size={14} className="text-app-text-muted -rotate-90" />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[14px] font-medium text-app-text">{isEnglish ? 'Railway launches luggage-free travel' : '铁路推出"轻装行"服务'}</p>
            <p className="text-[11px] text-app-text-muted mt-1">{isEnglish ? 'Book now for one-stop baggage delivery' : '下单即可体验一站式行李搬运'}</p>
          </div>
          <IcExpand size={14} className="text-app-text-muted -rotate-90" />
        </div>
      </div>

      {/* 温馨服务: cornerRadius 6dp */}
      <div className="mx-[10px] bg-app-surface rounded-[6px] shadow-sm mb-[6px] overflow-hidden">
        <div className="flex">
          {/* 左侧服务列表 */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-base font-bold text-gray-900">{s.service_warm_service}</span>
              <IcExpand size={14} className="text-gray-400 -rotate-90" />
            </div>
            <p className="text-xs text-gray-400 mb-3">{isEnglish ? 'Better service for every trip' : '优质服务 品质出行'}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{isEnglish ? 'Lost item search' : '遗失物品查找'}</p>
                  <p className="text-xs text-gray-400 truncate">{isEnglish ? 'Register missing items online...' : '在线登记遗失…'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">❤️</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{isEnglish ? 'Priority passenger booking' : '重点旅客预约'}</p>
                  <p className="text-xs text-gray-400 truncate">{isEnglish ? 'Book assistance in advance...' : '提前预约便捷…'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🪪</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{isEnglish ? 'Temporary ID certificate' : '临时身份证明'}</p>
                  <p className="text-xs text-gray-400 truncate">{isEnglish ? 'Digital travel identity...' : '电子乘车身份…'}</p>
                </div>
              </div>
            </div>
          </div>
          {/* 右侧卡片 */}
          <div className="w-40 bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center p-3">
            <div className="text-center">
              <p className="text-sm font-bold text-app-primary">{s.service_ecard}</p>
              <p className="text-xs text-gray-500 mt-1">{isEnglish ? 'Scan and ride without queueing for tickets' : '无需排队购票，直接扫码乘车'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 铁路商城 */}
      <div className="mx-[10px] mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-bold text-gray-900">{s.service_mall}</span>
          <span className="text-xs text-gray-500">{isEnglish ? 'Enter store >' : '进入商城 >'}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {[
            { name: isEnglish ? 'Regional specialties' : '家乡特产馆', price: isEnglish ? 'CNY 19.9 / 4.5 jin' : '19.9元/4.5斤' },
            { name: isEnglish ? 'Railway culture picks' : '铁路文创专场', price: isEnglish ? 'CNY 39' : '¥39元' },
            { name: isEnglish ? 'Fresh ingredients…' : '产地食材…', price: '' },
          ].map((item) => (
            <div key={item.name} className="flex-shrink-0 w-40">
              <div className="h-32 bg-gradient-to-b from-orange-100 to-orange-50 rounded-xl flex items-center justify-center">
                <span className="text-3xl">🛍️</span>
              </div>
              <p className="text-sm font-medium text-gray-800 mt-2">{item.name}</p>
              {item.price && <p className="text-xs text-red-500">{item.price}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
