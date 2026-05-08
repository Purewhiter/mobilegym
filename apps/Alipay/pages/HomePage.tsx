import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { useAlipayStore } from '../state';
import { IcSearch, IcAdd, IcExpand, IcNavForward, IcDroplet, IcRefresh, IcGlobe, IcCircle, IcGift } from '../res/icons';
import { IconRenderer } from '../components/IconRenderer';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeServiceName } from '../utils/localizeCatalog';
export const HomePage: React.FC = () => {
  const quickActions = useAlipayStore(s => s.quickActions);
  const mainServices = useAlipayStore(s => s.mainServices);
  const commonServices = useAlipayStore(s => s.commonServices);
  const notifications = useAlipayStore(s => s.notifications);
  const { bindTap } = useAlipayGestures();
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';

  return (
    <div
      className="bg-app-bg min-h-screen pb-4 pt-10"
      data-status-bar-foreground="light"
      data-navigation-bar-foreground="dark"
    >
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-primary z-10 pointer-events-none"></div>

      <div className="fixed top-10 left-0 right-0 z-30 bg-app-primary px-4 pt-4 pb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center text-white min-w-fit">
            <span className="text-base font-medium">{s.beijing}</span>
            <IcExpand size={16} className="ml-0.5" />
          </div>

          <div className="flex-1 bg-app-surface rounded-lg flex items-center px-3 py-1.5">
             <IcSearch size={16} className="text-app-primary mr-2" />
             <input 
               type="text" 
               placeholder={s.haidilao} 
               className="bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-400 w-full"
             />
             <div className="h-4 w-[1px] bg-gray-300 mx-2"></div>
             <button className="text-app-primary text-sm font-medium whitespace-nowrap">{s.search}</button>
          </div>

          <button className="text-white"><IcAdd size={26} /></button>
        </div>
      </div>

      <div className="bg-app-primary px-4 pb-6">
        <div className="h-18"></div>
        <div className="flex justify-between px-2 mb-4 text-white">
          {quickActions.map((action) => (
            <button
              key={action.id}
              {...(action.id === 'pay' ? bindTap<HTMLButtonElement>('pay.open') : action.id === 'scan' ? bindTap<HTMLButtonElement>('scan.open') : {})}
              className="flex flex-col items-center w-1/4"
            >
              <div className="w-12 h-12 mb-1.5 flex items-center justify-center">
                 <IconRenderer name={action.icon} size={36} className="text-white" />
              </div>
              <span className="text-base font-medium">{localizeServiceName(action.id, action.name, isEnglish)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-app-surface rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-5 gap-y-4">
            {mainServices.map((service) => (
              <button 
                key={service.id} 
                className="flex flex-col items-center space-y-1 py-1"
                {...(service.id === 'transfer' ? bindTap<HTMLButtonElement>('transfer.open') : {})}
              >
                <IconRenderer name={service.icon} size={28} color={service.color} />
                <span className="text-xs text-gray-600 mt-1">{localizeServiceName(service.id, service.name, isEnglish)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Common Services */}
        <div className="bg-app-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-800">{s.frequent}</span>
            <span className="text-xs text-gray-400">{s.manage}</span>
          </div>
          <div className="grid grid-cols-5 gap-y-4">
            {commonServices.slice(0, 10).map((service) => (
              <div key={service.id} className="flex flex-col items-center">
                <IconRenderer name={service.icon} size={26} color={service.color} />
                <span className="text-[10px] text-gray-600 mt-1 scale-90 whitespace-nowrap">{localizeServiceName(service.id, service.name, isEnglish)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="bg-app-surface rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-800">{s.recent_messages}</span>
              <span className="text-xs text-gray-400">{notifications.filter(n => !n.read).length}{s.new_messages}</span>
            </div>
            <div className="space-y-3">
              {notifications.filter(n => !n.read).slice(0, 2).map((notif) => (
                <div key={notif.id} className="flex items-start justify-between">
                  <div className="flex items-start gap-2 min-w-0">
                    <IconRenderer name={notif.icon} size={18} className="text-app-primary mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{notif.title}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{notif.content}</div>
                    </div>
                  </div>
                  <IcNavForward size={16} className="text-gray-300 mt-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student Mode */}
        <div className="bg-app-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4 mb-3 text-sm font-bold text-gray-800">
            <span className="text-app-primary border-b-2 border-app-primary pb-1">{s.for_you}</span>
            <span className="text-gray-400 font-normal">{s.flash_sale_delivery}</span>
            <span className="text-gray-400 font-normal">{s.daily_deals}</span>
          </div>
          <div className="text-center text-xs text-gray-500 mb-2">{s.activate_student_mode_for_exclusive_perks}</div>
          <div className="bg-gradient-to-r from-[#00B4FF] to-[#007AFF] rounded-lg p-4 text-white relative overflow-hidden h-32 flex flex-col justify-center items-center">
            <div className="text-lg font-bold mb-1">{s.verify_student_id}</div>
            <div className="text-sm opacity-90 mb-3">{s.exclusive_perks}</div>
            <button className="bg-app-surface text-[#007AFF] text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">{s.activate_student_mode}</button>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-20">🎓</div>
          </div>
        </div>

        {/* Forest */}
        <div className="bg-app-surface rounded-xl p-4 shadow-sm flex gap-3">
          <div className="w-1/2 bg-gradient-to-b from-[#E8F5E9] to-[#C8E6C9] rounded-lg p-3 relative overflow-hidden h-40">
            <span className="text-xs font-bold text-[#2E7D32]">{s.charity_ant_forest}</span>
            <div className="absolute bottom-2 left-2 text-white">
              <div className="text-sm font-bold drop-shadow-md">{s.energy_stolen}</div>
              <div className="text-[10px] drop-shadow-md">{s.protect_your_energy}</div>
              <button className="mt-1 bg-black/20 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full border border-white/40">{s.go_collect} &gt;</button>
            </div>
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-16 h-20 bg-[#4CAF50] rounded-full opacity-80 blur-sm"></div>
            <div className="absolute top-6 right-2 w-8 h-8 bg-[#81C784] rounded-full flex items-center justify-center text-[8px] text-[#1B5E20] shadow-sm border border-white/50">{s.green_energy}</div>
          </div>
          <div className="w-1/2 flex flex-col gap-2">
            <div className="flex-1 bg-[#F1F8E9] rounded-lg p-2 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-gray-800">{s.collect_expired_energy}</div>
                <div className="text-[10px] text-gray-500">{s.limited_time}</div>
                <span className="text-[10px] text-app-primary mt-1 block">{s.go_collect} &gt;</span>
              </div>
              <div className="w-8 h-8 bg-[#A5D6A7] rounded-full flex items-center justify-center text-[10px] text-white">{s.homepage_exp}</div>
            </div>
            <div className="flex-1 bg-[#E3F2FD] rounded-lg p-2 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-gray-800">{s.energy_available}</div>
                <div className="text-[10px] text-gray-500">{s.will_expire_soon}</div>
                <span className="text-[10px] text-app-primary mt-1 block">{s.go_collect} &gt;</span>
              </div>
              <div className="w-8 h-8 bg-[#90CAF9] rounded-full flex items-center justify-center text-[10px] text-white">{s.homepage_get}</div>
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <IcDroplet size={18} color="#1677FF"  />
              {s.zhima_credit}
            </div>
            <div className="text-gray-300">···</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-[#F5F7FF] rounded-xl p-4">
              <div className="flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-app-surface flex items-center justify-center border border-[#E6ECFF]">
                  <div className="text-center">
                    <div className="text-xs text-app-primary font-medium">{s.zhima_score}</div>
                    <div className="text-3xl font-bold text-app-primary leading-none mt-1">59*</div>
                    <div className="text-[10px] text-app-primary mt-1">{s.fair_credit}</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-700 font-medium mt-3 text-center">{s.score_boost_tasks}</div>
              <div className="text-[10px] text-gray-400 mt-1 text-center">{s.take_tasks_to_boost}</div>
              <div className="mt-3 flex justify-center">
                <button className="text-xs text-app-primary bg-app-surface px-4 py-1.5 rounded-full">{s.do_it}</button>
              </div>
            </div>
            <div className="grid grid-rows-2 gap-3">
              <div className="bg-[#F5F7FF] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-800">{s.zhima_credit_tips}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{s.awaiting_you}</div>
                  <button className="mt-2 text-xs text-app-primary bg-app-surface px-3 py-1.5 rounded-full">{s.go_ahead}</button>
                </div>
                <div className="w-10 h-10 rounded-full bg-app-surface border border-[#E6ECFF] flex items-center justify-center">
                  <IcRefresh size={18} color="#1677FF"  />
                </div>
              </div>
              <div className="bg-[#F5F7FF] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-gray-800">{s.zhima_780_korea_visa_perks}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{s.simplified_docs}</div>
                  <button className="mt-2 text-xs text-app-primary bg-app-surface px-3 py-1.5 rounded-full">{s.learn_more}</button>
                </div>
                <div className="w-10 h-10 rounded-lg bg-app-surface border border-[#E6ECFF] flex items-center justify-center">
                  <IcGlobe size={18} color="#1677FF"  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <IcCircle size={18} color="#1677FF"  />
              {s.huabei}
            </div>
            <div className="text-gray-300">···</div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900">{s.your_spending_report_is_ready}</div>
              <div className="text-xs text-gray-400 mt-1">{s.view_your_spending_details}</div>
              <div className="flex items-center gap-2 mt-3">
                <button className="text-xs text-[#FF7D00] bg-[#FFF1E6] px-4 py-1.5 rounded-full">{s.view_now}</button>
                <span className="text-[10px] text-[#FF7D00] bg-[#FFF1E6] px-2 py-1 rounded-full">{s.spending_review}</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-xl bg-gradient-to-b from-[#FDE68A] to-[#93C5FD] flex items-center justify-center text-xs text-white font-medium">
              {s.weekly_bill}
            </div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <IcGift size={18} color="#FF6E30"  />
              {s.earn_with_alipay}
            </div>
            <div className="text-gray-300">···</div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">{s.cash_rewards_available_today}</div>
              <div className="text-xs text-gray-400 mt-1">{s.earn_0_01_50_rewards}</div>
              <button className="mt-3 text-xs text-app-primary bg-[#E8F2FF] px-4 py-1.5 rounded-full">{s.check_in}</button>
            </div>
            <div className="flex items-end gap-6 pr-2">
              <div className="text-center">
                <div className="relative">
                  <div className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">{s.claim}</div>
                  <IcGift size={32} color="#FF6E30"  />
                </div>
                <div className="text-xs text-gray-500 mt-2">{s.today}</div>
              </div>
              <div className="text-center">
                <IcGift size={32} color="#FF6E30" className="opacity-70"  />
                <div className="text-xs text-gray-500 mt-2">{s.tomorrow}</div>
              </div>
              <div className="text-center">
                <IcGift size={32} color="#FF6E30" className="opacity-50"  />
                <div className="text-xs text-gray-500 mt-2">{s.day_3}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
