import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';

type NotifTab = 'trip' | 'business' | 'activity' | 'system';

function localizeNotificationTitle(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  if (value === '铁路行程提醒') return 'Trip reminder';
  if (value === '购票成功通知') return 'Booking confirmed';
  return value;
}

function localizeWeatherText(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return value
    .replace('多云', 'Cloudy')
    .replace('晴', 'Sunny')
    .replace('阴', 'Overcast');
}

function localizeDateText(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return value
    .replace(/(\d{4})年(\d{2})月(\d{2})日/g, '$1/$2/$3')
    .replace(/(\d{2})月(\d{2})日/g, '$1/$2');
}

function localizeGateText(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return value
    .replace('一层', '1F ')
    .replace('二层', '2F ')
    .replace('候车室', 'Waiting Hall ')
    .replace('检票口', 'Gate');
}

function localizeTripNote(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  if (value === '出行乘客较多，请您务必预留足够的安检、候车检票时间，尽量提前到站，以免耽误您的行程。') {
    return 'Passenger traffic is heavy. Please allow enough time for security check and boarding, and arrive early to avoid missing your trip.';
  }
  return value;
}

export const NotificationsPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack } = useRailwayGestures();
  const isEnglish = useLocale() === 'en';
  const [activeTab, setActiveTab] = useState<NotifTab>('trip');

  const tabs: { id: NotifTab; label: string }[] = [
    { id: 'trip', label: isEnglish ? 'Trips' : '行程通知' },
    { id: 'business', label: isEnglish ? 'Business' : '商旅通知' },
    { id: 'activity', label: isEnglish ? 'Activities' : '活动通知' },
    { id: 'system', label: isEnglish ? 'System' : '系统通知' },
  ];

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-0 px-4 sticky top-0 z-20">
        <div className="flex items-center relative pb-3 gap-3">
          <button className="absolute left-0 w-10 text-left" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Notifications' : '通知消息'}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`max-w-[33%] whitespace-normal pb-2 text-sm relative leading-tight ${activeTab === tab.id ? 'text-white font-medium' : 'text-white/70'}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-app-surface rounded" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-6">
        {activeTab === 'trip' && config.notifications.map(notif => (
          <div key={notif.id}>
            <div className="text-center py-3">
              <span className="text-xs text-gray-400">{localizeDateText(notif.date, isEnglish)}</span>
            </div>
            <div className="mx-3 bg-app-surface rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-app-primary">🚆</span>
                  <span className="text-sm font-medium text-gray-900 break-words">{localizeNotificationTitle(notif.title, isEnglish)}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{localizeDateText(notif.date, isEnglish)} {notif.time}</span>
              </div>

              {/* 车次信息 */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-base font-bold text-gray-900 break-words">{notif.fromStation}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-px w-6 bg-app-primary" />
                    <span className="text-xs text-gray-600">{notif.trainNo}</span>
                    <div className="relative">
                      <div className="h-px w-6 bg-app-primary" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-l-app-primary border-y-[2px] border-y-transparent" />
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 break-words">{notif.toStation}</span>
                </div>

                {notif.weather && (
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2 gap-2">
                    <span className="break-words">{localizeWeatherText(notif.weather.from, isEnglish)}</span>
                    <span className="break-words">{localizeWeatherText(notif.weather.to, isEnglish)}</span>
                  </div>
                )}

                {notif.departTime && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex gap-2">
                      <span className="text-gray-400 shrink-0">{isEnglish ? 'Departure' : '发车时间'}</span>
                      <span className="text-red-500 break-words">{localizeDateText(notif.departTime, isEnglish)} {isEnglish ? 'Please allow enough time for your trip.' : '请合理安排出行时间。'}</span>
                    </div>
                    {notif.gate && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 shrink-0">{isEnglish ? 'Gate' : '检票口'}</span>
                        <span className="text-app-primary break-words">{localizeGateText(notif.gate, isEnglish)}</span>
                      </div>
                    )}
                    {notif.note && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 shrink-0">{isEnglish ? 'Note' : '乘车备注'}</span>
                        <span className="text-gray-600 break-words">{localizeTripNote(notif.note, isEnglish)}</span>
                      </div>
                    )}
                  </div>
                )}

                {notif.orderId && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex gap-2">
                      <span className="text-gray-400 shrink-0">{isEnglish ? 'Order ID' : '订单号'}</span>
                      <span className="font-medium break-words">{notif.orderId}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-400 shrink-0">{isEnglish ? 'Departure' : '发车时间'}</span>
                      <span className="font-medium break-words">{localizeDateText(notif.departTime, isEnglish)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 text-xs">
                <button className="flex-1 py-2 text-center text-app-primary border border-app-border rounded-lg leading-tight whitespace-normal break-words">{isEnglish ? 'Order food' : '去订餐'}</button>
                <button className="flex-1 py-2 text-center text-app-primary border border-app-border rounded-lg leading-tight whitespace-normal break-words">{isEnglish ? 'Book hotel' : '订酒店'}</button>
                <button className="flex-1 py-2 text-center text-app-primary border border-app-border rounded-lg leading-tight whitespace-normal break-words">{isEnglish ? 'Get a ride' : '去约车'}</button>
              </div>
            </div>
          </div>
        ))}

        {activeTab !== 'trip' && (
          <div className="flex flex-col items-center justify-center pt-24">
            <span className="text-gray-400 text-sm">{isEnglish ? 'No messages yet' : '暂无消息'}</span>
          </div>
        )}
      </div>
    </div>
  );
};