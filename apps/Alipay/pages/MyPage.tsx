import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcSettings, IcHeadphone, IcNavForward, IcUser, IcFile, IcChart, IcPiggyBank, IcCircle, IcSecureCheck, IcDroplet, IcCard, IcBank, IcBuilding, IcMedical, IcHeart, IcTabHome } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
export const MyPage: React.FC = () => {
  const userInfo = useAlipayStore(s => s.userInfo);
  const { bindTap } = useAlipayGestures();
  const s = useAlipayStrings();

  return (
    <div className="bg-app-bg min-h-screen pb-4 pt-10" data-status-bar-foreground="light">
      {/* 顶部 Header TopBar 固定 */}
      {/* Status bar overlay to fill upper area */}
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-primary z-10 pointer-events-none"></div>
      

      {/* 用户信息区域（不固定） */}
      <div className="bg-app-primary px-4 pt-8 pb-6 relative">
        <div className="absolute right-4 top-2 flex items-center space-x-4 text-white">
          <button><IcHeadphone size={22} strokeWidth={1.5} /></button>
          <button {...bindTap<HTMLButtonElement>('settings.open')}><IcSettings size={22} strokeWidth={1.5} /></button>
        </div>
        <div className="flex items-center">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center mr-3 overflow-hidden flex-shrink-0">
             <IcUser size={40} className="text-white/60" />
          </div>
          {/* 昵称 + 手机号 + 证件，整体与头像同高 */}
          <div className="flex-1 h-16 flex flex-col justify-between">
            <span className="text-lg font-bold text-white">{userInfo.name}</span>
            <span className="text-[11px] text-white/50">
              {userInfo.phone.replace(/^(\d{3})\d{6}(\d{2})$/, '$1******$2')}
            </span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs text-white/90 inline-flex items-center font-medium w-fit">
              <span className="mr-0.5">💳</span> {s.mypage_id} <IcNavForward size={10} className="ml-0.5 text-white/60" />
            </span>
          </div>
          {/* 箭头居中于头像高度 */}
          <IcNavForward size={18} className="text-white/50 flex-shrink-0 self-center" />
        </div>
      </div>

      {/* 全屏宽白色底板，大圆角上覆盖蓝色头部 */}
      <div className="bg-app-bg rounded-t-2xl -mt-3 relative z-[1] px-2.5 pt-2.5 pb-4 space-y-3">
        {/* List Services Group (Member, Bill, Assets, Balance, etc.) */}
        <div className="bg-app-surface rounded-xl overflow-hidden divide-y divide-gray-50">
           {/* Member Row */}
           <div className="flex items-center justify-between p-4 active:bg-gray-50">
              <div className="flex items-center">
                 <div className="w-5 h-5 rounded-full bg-app-primary flex items-center justify-center text-white text-[10px] font-bold mr-3">V</div>
                 <span className="text-base font-medium text-gray-900 mr-2">{s.membership}</span>
                 <span className="text-[10px] text-white bg-app-primary px-1.5 py-0.5 rounded-full">{s.standard}</span>
              </div>
              <div className="flex items-center text-gray-400 text-xs">
                 <span className="mr-1">{s.complete_tasks_for_cards}</span>
                 <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                 <IcNavForward size={16} className="text-gray-300" />
              </div>
           </div>

           {/* Bill Row */}
           <div 
             className="flex items-center justify-between p-4 active:bg-gray-50"
             {...bindTap<HTMLDivElement>('bill.open')}
           >
             <div className="flex items-center">
                <IcFile size={22} color="#FF7D00" className="mr-3" />
                <span className="text-base font-medium text-gray-900">{s.transactions}</span>
             </div>
             <IcNavForward size={16} className="text-gray-300" />
           </div>

           {/* Assets Row */}
           <div className="flex items-center justify-between p-4 active:bg-gray-50" {...bindTap<HTMLDivElement>('assets.open')}>
             <div className="flex items-center">
                <IcChart size={22} color="#1677FF" className="mr-3" />
                <span className="text-base font-medium text-gray-900">{s.total_assets}</span>
             </div>
             <div className="flex items-center">
               <span className="text-xs text-gray-400 mr-1">{s.view_account_balance}</span>
               <IcNavForward size={16} className="text-gray-300" />
             </div>
           </div>

           {/* Balance Row */}
           <div 
             className="flex items-center justify-between p-4 active:bg-gray-50"
             {...bindTap<HTMLDivElement>('balance.open')}
           >
             <div className="flex items-center">
                <div className="w-[22px] h-[22px] rounded-full bg-app-primary flex items-center justify-center text-white text-xs font-bold mr-3">¥</div>
                <span className="text-base font-medium text-gray-900">{s.balance}</span>
             </div>
             <IcNavForward size={16} className="text-gray-300" />
           </div>

           {/* Yuebao Row */}
           <div className="flex items-center justify-between p-4 active:bg-gray-50" {...bindTap<HTMLDivElement>('yuebao.open')}>
             <div className="flex items-center">
                <IcPiggyBank size={22} color="#FF7D00" className="mr-3"  />
                <span className="text-base font-medium text-gray-900">{s.yue_bao}</span>
             </div>
             <IcNavForward size={16} className="text-gray-300" />
           </div>

           {/* Huabei Row */}
           <div className="flex items-center justify-between p-4 active:bg-gray-50">
             <div className="flex items-center">
                <IcCircle size={22} color="#1677FF" className="mr-3"  />
                <span className="text-base font-medium text-gray-900">{s.huabei}</span>
             </div>
             <div className="flex items-center">
               <span className="text-xs text-gray-400 mr-1">{s.spending_journal}</span>
               <IcNavForward size={16} className="text-gray-300" />
             </div>
           </div>
        </div>

        {/* Financial Services Grid */}
        <div className="bg-app-surface rounded-xl p-5">
          <div className="grid grid-cols-4 gap-y-6">
            <div className="flex flex-col items-center">
              <IcSecureCheck size={28} color="#1677FF"  />
              <div className="mt-2 text-xs text-center leading-tight text-gray-700 font-medium">{s.antsure}</div>
            </div>
            <div className="flex flex-col items-center">
              <IcDroplet size={28} color="#1677FF"  />
              <div className="mt-2 text-xs text-center leading-tight text-gray-700 font-medium">{s.zhima_credit}</div>
              <div className="text-[10px] text-center leading-tight text-app-primary mt-0.5">{s.n_800_pt_service_upgrade}</div>
            </div>
            <button
              className="flex flex-col items-center active:opacity-70"
              {...bindTap<HTMLButtonElement>('bankCards.open')}
            >
              <IcCard size={28} color="#FF7D00" />
              <div className="mt-2 text-xs text-center leading-tight text-gray-700 font-medium">{s.bank_cards}</div>
            </button>
            <div className="flex flex-col items-center">
              <IcBank size={28} color="#00B96B"  />
              <div className="mt-2 text-xs text-center leading-tight text-gray-700 font-medium">{s.sme_loan}</div>
            </div>
            <div className="flex flex-col items-center">
              <IcBuilding size={28} color="#1677FF"  />
              <div className="mt-2 text-xs text-center leading-tight text-gray-700 font-medium">{s.mybank}</div>
            </div>
          </div>
        </div>

        {/* Civic Services */}
        <div className="bg-app-surface rounded-xl p-5 shadow-sm">
          <div className="text-base font-bold text-gray-900 mb-5">{s.my_social_services}</div>
          <div className="grid grid-cols-4 gap-y-4">
            <div className="flex flex-col items-center">
              <IcMedical size={28} color="#1677FF"  />
              <span className="text-xs text-center leading-tight text-gray-700 font-medium mt-2">{s.medical_insurance}</span>
            </div>
            <div className="flex flex-col items-center">
              <IcHeart size={28} color="#1677FF"  />
              <span className="text-xs text-center leading-tight text-gray-700 font-medium mt-2">{s.social_security}</span>
            </div>
            <div className="flex flex-col items-center">
              <IcTabHome size={28} color="#1677FF"  />
              <span className="text-xs text-center leading-tight text-gray-700 font-medium mt-2">{s.housing_fund}</span>
            </div>
            <div className="flex flex-col items-center">
              <IcUser size={28} color="#1677FF"  />
              <span className="text-xs text-center leading-tight text-gray-700 font-medium mt-2">{s.employment}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
