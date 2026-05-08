import React from 'react';
import { IcNavBack, IcRepeat } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useShallow } from 'zustand/react/shallow';
const quickServices = [
  { name: '航班动态', icon: '✈️' },
  { name: '值机选座', icon: '💺' },
  { name: '租车·约车', icon: '🚗' },
  { name: '保险', icon: '🛡️' },
  { name: '乘机指南', icon: '📋' },
];

export const AirRailPage: React.FC = () => {
  const { from, to } = useRailwayStore(useShallow(s => ({ from: s.from, to: s.to })));
  const { bindBack } = useRailwayGestures();

  return (
    <div className="min-h-full bg-app-bg flex flex-col">
      {/* 顶部返回 */}
      <div className="pt-10 px-4 absolute top-0 left-0 right-0 z-10">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-b from-[#7CC0FF] to-[#C5DFFF] h-56 flex items-center justify-center relative">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">机票+空铁联运</h2>
          <p className="text-sm text-white/80 mt-1">一站式购票 出行新方式</p>
        </div>
      </div>

      {/* 搜索卡片 */}
      <div className="bg-app-surface mx-4 -mt-10 rounded-xl p-4 shadow-sm relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <span className="text-xl font-bold text-gray-800">{from}</span>
          </div>
          <button className="mx-4">
            <IcRepeat size={20} className="text-app-primary" />
          </button>
          <div className="text-center flex-1">
            <span className="text-xl font-bold text-gray-800">{to}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-base font-medium">2月10日</span>
            <span className="text-sm text-gray-400 ml-2">今天</span>
          </div>
          <span className="text-xs text-gray-400">儿童婴儿及特殊票种预订说明 ⓘ</span>
        </div>

        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium">
          查询
        </button>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">{from}-{to}</span>
          <button className="text-xs text-app-primary">清除历史</button>
        </div>
      </div>

      {/* 出行公告 */}
      <div className="bg-app-surface mx-4 mt-3 rounded-xl px-4 py-3 flex items-center">
        <span className="text-red-500 mr-2">🔊</span>
        <span className="text-sm text-red-500">出行公告</span>
        <IcNavBack size={14} className="text-gray-300 ml-auto rotate-180" />
      </div>

      {/* 快捷服务 */}
      <div className="bg-app-surface mx-4 mt-3 rounded-xl px-4 py-4">
        <div className="grid grid-cols-5 gap-3">
          {quickServices.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-xl">
                {s.icon}
              </div>
              <span className="text-xs text-gray-600">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 底部链接 */}
      <div className="flex items-center justify-center gap-4 mt-4 pb-4">
        <span className="text-xs text-gray-400">🌐 航班信息声明</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-400">🔄 开通线路</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-400">📞 客服电话</span>
      </div>

      {/* 底部TabBar */}
      <div className="mt-auto bg-app-surface border-t border-gray-100 flex">
        <div className="flex-1 py-3 flex flex-col items-center">
          <span className="text-app-primary text-lg">✈️</span>
          <span className="text-xs text-app-primary">预订</span>
        </div>
        <div className="flex-1 py-3 flex flex-col items-center">
          <span className="text-gray-400 text-lg">📋</span>
          <span className="text-xs text-gray-400">订单</span>
        </div>
      </div>
    </div>
  );
};
