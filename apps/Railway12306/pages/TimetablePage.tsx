import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { getDate as getTimeDate } from '../../../os/TimeService';
import { useLocale } from '../../../os/locale';

type QueryTab = 'train' | 'station' | 'route';

export const TimetablePage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [activeTab, setActiveTab] = useState<QueryTab>('train');
  const [trainNo, setTrainNo] = useState('');
  const [stationName, setStationName] = useState('');
  const [fromStation, setFromStation] = useState('');
  const [toStation, setToStation] = useState('');

  const today = getTimeDate();
  const dateLabel = isEnglish
    ? `${today.toLocaleString('en-US', { month: 'short' })} ${today.getDate()}`
    : `${today.getMonth() + 1}月${today.getDate()}日`;
  const dayNames = isEnglish
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  const tabs: { id: QueryTab; label: string }[] = [
    { id: 'train', label: isEnglish ? 'Train' : '车次' },
    { id: 'station', label: isEnglish ? 'Station' : '车站' },
    { id: 'route', label: isEnglish ? 'Route' : '站站' },
  ];

  return (
    <div className="min-h-full bg-app-surface">
      {/* 蓝色渐变头部 */}
      <div className="bg-gradient-to-b from-app-primary to-[#6BB3F7] pt-10 pb-16 px-4 relative sticky top-0 z-20">
        <div className="flex items-center mb-6">
          <button {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
        </div>
        <h1 className="text-white text-2xl font-bold">{isEnglish ? 'Timetable' : '时刻表'}</h1>
        <p className="text-white/70 text-sm mt-1">{isEnglish ? 'Plan your trip with ease' : '轻松安排出行，享受完美旅程'}</p>
      </div>

      {/* 查询卡片 */}
      <div className="mx-4 -mt-10 bg-app-surface rounded-xl shadow-md p-4 relative z-10">
        {/* Tab切换 */}
        <div className="flex mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex-1 py-2.5 text-center text-sm font-medium relative ${
                activeTab === tab.id ? 'text-app-primary' : 'text-gray-500'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-app-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* 表单内容 */}
        {activeTab === 'train' && (
          <div>
            <div className="mb-4">
              <label className="text-sm text-gray-700 font-medium">{isEnglish ? 'Train No.' : '车次号'}</label>
              <input
                className="w-full mt-2 py-2 border-b border-app-border text-lg outline-none placeholder-gray-300"
                placeholder={isEnglish ? 'e.g. G40' : '例如：G40'}
                value={trainNo}
                onChange={e => setTrainNo(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500">{isEnglish ? 'Departure date' : '出发时间'}</label>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-gray-900">{dateLabel}</span>
                <span className="text-sm text-app-primary">{dayNames[today.getDay()]}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'station' && (
          <div>
            <div className="mb-4">
              <label className="text-sm text-gray-700 font-medium">{isEnglish ? 'Station name' : '车站名称'}</label>
              <input
                className="w-full mt-2 py-2 border-b border-app-border text-lg outline-none placeholder-gray-300"
                placeholder={isEnglish ? 'e.g. Beijing South' : '例如：北京南'}
                value={stationName}
                onChange={e => setStationName(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500">{isEnglish ? 'Query date' : '查询日期'}</label>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-gray-900">{dateLabel}</span>
                <span className="text-sm text-app-primary">{dayNames[today.getDay()]}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'route' && (
          <div>
            <div className="mb-4">
              <label className="text-sm text-gray-700 font-medium">{isEnglish ? 'From station' : '出发站'}</label>
              <input
                className="w-full mt-2 py-2 border-b border-app-border text-lg outline-none placeholder-gray-300"
                placeholder={isEnglish ? 'e.g. Beijing' : '例如：北京'}
                value={fromStation}
                onChange={e => setFromStation(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-700 font-medium">{isEnglish ? 'To station' : '到达站'}</label>
              <input
                className="w-full mt-2 py-2 border-b border-app-border text-lg outline-none placeholder-gray-300"
                placeholder={isEnglish ? 'e.g. Shanghai' : '例如：上海'}
                value={toStation}
                onChange={e => setToStation(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500">{isEnglish ? 'Query date' : '查询日期'}</label>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-gray-900">{dateLabel}</span>
                <span className="text-sm text-app-primary">{dayNames[today.getDay()]}</span>
              </div>
            </div>
          </div>
        )}

        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium mt-2">
          {isEnglish ? 'Search' : '查询'}
        </button>
      </div>
    </div>
  );
};
