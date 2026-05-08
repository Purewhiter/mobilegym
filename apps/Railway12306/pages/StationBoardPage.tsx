import React, { useState } from 'react';
import { IcNavBack, IcExpand, IcNavForward, IcSearch } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { localizeRailwayStatus } from '../utils/localizeRailwayItem';
export const StationBoardPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack } = useRailwayGestures();
  const [activeTab, setActiveTab] = useState<'departure' | 'arrival'>('departure');
  const [keyword, setKeyword] = useState('');
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const departures = config.stationBoardDepartures;
  const arrivals = config.stationBoardArrivals;

  const currentList = activeTab === 'departure' ? departures : arrivals;
  type StationItem = { trainNo: string; time: string; gate: string; status: string; destination?: string; origin?: string };
  const waitingItems: StationItem[] = activeTab === 'departure'
    ? departures.filter(d => d.status === '正在候车')
    : arrivals.filter(a => ['正点', '早点', '晚点'].includes(a.status) && parseFloat(a.time) > 14);
  const passedItems: StationItem[] = activeTab === 'departure'
    ? departures.filter(d => d.status !== '正在候车')
    : arrivals.filter(a => parseFloat(a.time) <= 14 || a.status === '早点' || a.status === '晚点');

  return (
    <div className="min-h-full bg-app-surface flex flex-col">
      {/* 蓝色头部 */}
      <div className="bg-gradient-to-b from-app-primary to-[#5A9BE6] pt-10 pb-4 px-4">
        <div className="flex items-center mb-3">
          <button {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
        </div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-white text-2xl font-bold">{isEnglish ? 'Zhanjiang Station' : '湛江站'}</span>
          <IcExpand size={18} className="text-white" />
        </div>
        <p className="text-white/80 text-xs">{isEnglish ? 'For reference only. Please follow station announcements. Swipe left to follow.' : '以下信息仅供参考，请以车站公告为准。左滑可添加关注。'}</p>
        <button className="flex items-center mt-2 text-white/90 text-xs">
          {isEnglish ? 'View more station info' : '查看车站更多信息'} <IcNavForward size={14} className="text-white/90" />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-4 py-3 bg-app-surface">
        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 gap-2">
          <IcSearch size={16} className="text-gray-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            placeholder={isEnglish ? 'Search by train no.' : '输入车次查询'}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* 列表内容 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'departure' ? (
          <>
            {/* 表头 */}
            <div className="flex items-center px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
              <span className="w-16">{isEnglish ? 'Train' : '车次'}</span>
              <span className="w-16">{isEnglish ? 'To' : '终到'}</span>
              <span className="w-14">{isEnglish ? 'Dep ▿' : '发时 ▿'}</span>
              <span className="flex-1 text-center">{isEnglish ? 'Waiting Hall / Gate' : '候车室/检票口'}</span>
              <span className="w-20 text-right">{isEnglish ? 'All status ▿' : '全部状态▿'}</span>
            </div>
            {waitingItems.map(item => (
              <div key={item.trainNo + item.time} className="flex items-center px-4 py-3 border-b border-gray-50">
                <span className="w-16 text-sm font-medium text-app-primary">{item.trainNo}</span>
                <span className="w-16 text-sm text-gray-700">{item.destination}</span>
                <span className="w-14 text-sm text-gray-700">{item.time}</span>
                <span className="flex-1 text-center text-xs text-gray-500">{item.gate}</span>
                <span className="w-20 text-right text-sm text-app-primary">{localizeRailwayStatus(item.status, isEnglish)}</span>
              </div>
            ))}
            {passedItems.length > 0 && (
              <div className="flex items-center px-4 py-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-xs text-gray-400">{isEnglish ? 'Departed trains below' : '以下为已出发车次'}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
            {passedItems.map(item => (
              <div key={item.trainNo + item.time} className="flex items-center px-4 py-3 border-b border-gray-50">
                <span className="w-16 text-sm font-medium text-gray-700">{item.trainNo}</span>
                <span className="w-16 text-sm text-gray-700">{item.destination}</span>
                <span className="w-14 text-sm text-gray-700">{item.time}</span>
                <span className="flex-1 text-center text-xs text-gray-500">{item.gate}</span>
                <span className="w-20 text-right text-sm text-gray-500">{localizeRailwayStatus(item.status, isEnglish)}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="flex items-center px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
              <span className="w-16">{isEnglish ? 'Train' : '车次'}</span>
              <span className="w-16">{isEnglish ? 'From' : '始发'}</span>
              <span className="w-14">{isEnglish ? 'Arr ▿' : '到时 ▿'}</span>
              <span className="flex-1 text-center">{isEnglish ? 'Exit' : '出站口'}</span>
              <span className="w-20 text-right">{isEnglish ? 'All status ▿' : '全部状态▿'}</span>
            </div>
            {waitingItems.map(item => (
              <div key={item.trainNo + item.time} className="flex items-center px-4 py-3 border-b border-gray-50">
                <span className="w-16 text-sm font-medium text-app-primary">{item.trainNo}</span>
                <span className="w-16 text-sm text-gray-700">{item.origin}</span>
                <span className="w-14 text-sm text-gray-700">{item.time}</span>
                <span className="flex-1 text-center text-xs text-gray-500">{item.gate}</span>
                <span className={`w-20 text-right text-sm ${
                  item.status === '晚点' ? 'text-red-500' :
                  item.status === '早点' ? 'text-green-500' : 'text-gray-500'
                }`}>
                  {localizeRailwayStatus(item.status, isEnglish)}
                </span>
              </div>
            ))}
            {passedItems.length > 0 && (
              <div className="flex items-center px-4 py-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-xs text-gray-400">{isEnglish ? 'Arrived trains below' : '以下为已到站车次'}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}
            {passedItems.map(item => (
              <div key={item.trainNo + item.time} className="flex items-center px-4 py-3 border-b border-gray-50">
                <span className="w-16 text-sm font-medium text-gray-700">{item.trainNo}</span>
                <span className="w-16 text-sm text-gray-700">{item.origin}</span>
                <span className="w-14 text-sm text-gray-700">{item.time}</span>
                <span className="flex-1 text-center text-xs text-gray-500">{item.gate}</span>
                <span className={`w-20 text-right text-sm ${
                  item.status === '晚点' ? 'text-red-500' :
                  item.status === '早点' ? 'text-green-500' : 'text-gray-500'
                }`}>
                  {localizeRailwayStatus(item.status, isEnglish)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 底部出发/到达切换 */}
      <div className="sticky bottom-0 flex items-center justify-center py-3 bg-app-surface border-t border-gray-100">
        <div className="flex bg-gray-600/80 rounded-full overflow-hidden">
          <button
 className={`px-6 py-2 text-sm font-medium ${activeTab === 'departure' ? 'text-white' : 'text-white/60'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            onClick={() => setActiveTab('departure')}
          >
            {isEnglish ? 'Departures' : '出发'}
          </button>
          <span className="text-white/30 self-center">|</span>
          <button
 className={`px-6 py-2 text-sm font-medium ${activeTab === 'arrival' ? 'text-white' : 'text-white/60'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            onClick={() => setActiveTab('arrival')}
          >
            {isEnglish ? 'Arrivals' : '到达'}
          </button>
        </div>
      </div>
    </div>
  );
};
