import React from 'react';
import { IcClose, TrafficInfoIcon, InfoCircleIcon } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStrings } from '../hooks/useMapStrings';
import { routes } from '../routes';

export const NotificationsPage: React.FC = () => {
  const { bindBack, nav } = useMapGestures();
  const s = useMapStrings();

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex justify-between items-center px-4 pt-12 pb-4 bg-app-surface border-b border-transparent">
        <div className="text-[28px] font-bold text-gray-900">{s.notification_title}</div>
        <button
          {...bindBack()}
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
        >
          <IcClose size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4">
        <div
          className="flex items-center gap-6 py-6 active:bg-gray-50 -mx-4 px-4"
          onClick={() => nav.push(routes.settingsNotificationsTraffic)}
        >
          <TrafficInfoIcon className="text-app-primary shrink-0 w-6 h-6" />
          <div className="text-[17px] text-gray-900">{s.notification_traffic}</div>
        </div>

        <div
          className="flex items-center gap-6 py-6 active:bg-gray-50 -mx-4 px-4"
          onClick={() => nav.push(routes.settingsNotificationsRecommendations)}
        >
          <InfoCircleIcon className="text-app-primary shrink-0 w-6 h-6" />
          <div className="text-[17px] text-gray-900">{s.notification_recommendations}</div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
