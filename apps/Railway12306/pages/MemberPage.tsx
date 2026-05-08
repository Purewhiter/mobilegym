import React from 'react';
import { IcNavForward, IcUserAdd } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { localizeRailwayItemDescription, localizeRailwayItemName } from '../utils/localizeRailwayItem';
export const MemberPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { user, memberBenefits } = config;
  const s = useRailwayStrings();

  // 进度条百分比
  const totalNeeded = user.points + user.upgradeNeeded;
  const progressPercent = Math.min((user.points / totalNeeded) * 100, 100);
  const pointsExpireNotice = s.member_points_expire_notice
    .replace('{points}', '270')
    .replace('{date}', user.pointsExpireDate);
  const upgradeNotice = s.member_upgrade_notice.replace('{points}', String(user.upgradeNeeded));

  return (
    <div className="min-h-full bg-app-bg">
      {/* 顶栏 */}
      <div className="bg-app-surface pt-10 pb-3 px-4 flex items-center justify-between gap-3 sticky top-0 z-20">
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-gray-900 leading-tight">{s.tab_member}</span>
        <span className="max-w-[42%] shrink-0 text-right text-sm text-app-primary leading-tight whitespace-normal break-words">{s.member_guide}</span>
      </div>

      {/* 会员卡片 */}
      <div className="mx-3 mt-2 bg-app-surface rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#FFF8E1] to-[#FFF3CD] p-4">
          {/* 会员等级 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-600 text-lg">💎</span>
              <span className="text-base font-bold text-gray-900">{s.member_level_one_star}</span>
              <IcNavForward size={16} className="text-gray-400" />
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <IcUserAdd size={14} />
              <span>{s.member_recipient}</span>
            </div>
          </div>

          {/* 积分到期提示 */}
          <p className="text-xs text-gray-500 mb-2">{pointsExpireNotice}</p>

          {/* 进度条 */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-gradient-to-r from-[#4CAF50] to-[#8BC34A] rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-xs text-gray-400">{upgradeNotice}</p>

          {/* 积分数值 */}
          <div className="flex mt-3 border-t border-amber-200/50 pt-3">
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-gray-900">{user.points}</span>
              <p className="text-xs text-gray-500 mt-0.5">{s.member_travel_points}</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="flex-1 text-center relative">
              <span className="text-2xl font-bold text-gray-900">{user.diningPoints}</span>
              <span className="absolute -top-1 right-8 text-[9px] text-white bg-red-500 rounded-sm px-1 py-0.5">{s.member_food_tag}</span>
              <p className="text-xs text-gray-500 mt-0.5">{s.member_dining_points}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 会员权益 */}
      <div className="mx-3 mt-3 bg-app-surface rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-red-500 text-xs">ıllı</span>
          <span className="text-base font-bold text-gray-900">{s.member_benefits_title}</span>
          <span className="text-red-500 text-xs">ıllı</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {memberBenefits.map(benefit => (
            <div key={benefit.id} className="rounded-xl p-4" style={{ backgroundColor: benefit.color }}>
              <span className="text-sm font-bold text-gray-900">{localizeRailwayItemName(benefit.id, benefit.title, s)}</span>
              <p className="text-xs text-gray-500 mt-1">{localizeRailwayItemDescription(benefit.id, benefit.desc, s)}</p>
              <span className="inline-block mt-2 text-[11px] text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
                {s.member_view_benefit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 精彩会员活动 */}
      <div className="mx-3 mt-3 bg-app-surface rounded-xl p-4 mb-6">
        <span className="text-base font-bold text-gray-900">{s.member_events_title}</span>
        <div className="mt-4 flex items-center justify-center py-8">
          <span className="text-sm text-gray-400">{s.member_no_events}</span>
        </div>
        {/* 分页指示器 */}
        <div className="flex justify-center gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-app-primary" />
          <div className="w-2 h-2 rounded-full bg-gray-300" />
        </div>
      </div>
    </div>
  );
};
