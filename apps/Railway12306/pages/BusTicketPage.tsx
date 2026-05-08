import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
const subTabs = ['铁水联运', '汽车票', '定点巴士', '船票'];

export const BusTicketPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const [activeTab, setActiveTab] = useState(1); // 默认汽车票

  return (
    <div className="min-h-full bg-app-bg flex flex-col">
      {/* 顶部返回 */}
      <div className="pt-10 px-4 absolute top-0 left-0 right-0 z-10 flex items-center justify-between">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-b from-[#8BD4A0] to-[#C5E8D0] h-48 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">12306汽车票</h2>
          <p className="text-sm text-white/80 mt-1">畅游各地 安心出行</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="bg-app-surface mx-4 -mt-6 rounded-t-xl flex items-center px-2 relative z-10">
        {subTabs.map((tab, i) => (
          <button
            key={tab}
            className={`flex-1 py-3 text-center text-sm relative ${i === activeTab ? 'text-app-primary font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
            {i === activeTab && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-app-primary" />}
          </button>
        ))}
      </div>

      {/* 搜索表单 */}
      <div className="bg-app-surface mx-4 px-4 pb-4">
        <div className="flex items-center py-4 border-b border-gray-100">
          <span className="text-xl font-bold text-gray-800">北京市</span>
          <div className="mx-4 text-gray-300">—</div>
          <span className="text-base text-gray-400">请选择到达地</span>
        </div>

        <div className="py-4 border-b border-gray-100">
          <span className="text-xl font-bold text-gray-800">2月10日</span>
          <span className="text-sm text-gray-400 ml-2">周二</span>
        </div>

        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium mt-4">
          查询汽车票
        </button>
      </div>

      {/* 出行公告 */}
      <div className="mx-4 mt-3 bg-app-surface rounded-xl px-4 py-3 flex items-center">
        <span className="text-orange-500 mr-2">🔊</span>
        <span className="text-sm text-app-primary flex-1 truncate">关于进京道路客运班车无人机管控的温馨提示</span>
        <IcNavBack size={14} className="text-gray-300 rotate-180" />
      </div>

      {/* 租车约车广告 */}
      <div className="mx-4 mt-3 bg-gradient-to-r from-[#E8F5FF] to-[#F0F9FF] rounded-xl px-4 py-4">
        <h3 className="text-lg font-bold text-app-primary">12306租车·约车</h3>
        <p className="text-xs text-[#7CC0FF] mt-0.5">省时省心 用车方便快捷</p>
      </div>

      {/* 底部链接 */}
      <div className="flex items-center justify-center gap-4 mt-auto py-4">
        <span className="text-xs text-gray-400">服务条款</span>
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-400">预订须知</span>
      </div>

      {/* 底部TabBar */}
      <div className="bg-app-surface border-t border-gray-100 flex">
        <div className="flex-1 py-3 flex flex-col items-center">
          <span className="text-app-primary text-lg">🚌</span>
          <span className="text-xs text-app-primary">汽车票</span>
        </div>
        <div className="flex-1 py-3 flex flex-col items-center">
          <span className="text-gray-400 text-lg">📋</span>
          <span className="text-xs text-gray-400">订单</span>
        </div>
      </div>
    </div>
  );
};
