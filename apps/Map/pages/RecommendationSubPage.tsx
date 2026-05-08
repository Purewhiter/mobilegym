import React from 'react';
import { useParams } from 'react-router-dom';
import { IcClose, IcHelp, IcNavArrow } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStore } from '../state';
import { useMapStrings } from '../hooks/useMapStrings';
import { localizeMapSettingValue } from '../utils/localizeMapValue';

export const RecommendationSubPage: React.FC = () => {
  const { subId } = useParams<{ subId: string }>();
  const { bindBack } = useMapGestures();
  const recNotifications = useMapStore((s) => s.settings.notifications.recommendations);
  const updateRecNotifications = useMapStore((s) => s.updateRecNotifications);
  const s = useMapStrings();
  const titleMap: Record<string, string> = {
    nearbyPlaces: s.recommendation_nearby_places,
    newPlaces: s.recommendation_new_places,
  };
  const descMap: Record<string, string> = {
    nearbyPlaces: s.recommendation_nearby_desc,
    newPlaces: s.recommendation_new_desc,
  };
  const baseOptions = ['开启', '关闭'] as const;
  const appOnly = '仅限应用';

  if (!subId || !(subId in titleMap)) {
    return null;
  }

  const title = titleMap[subId];
  const description = descMap[subId];
  const showAppOnly = subId === 'nearbyPlaces';
  const options = showAppOnly ? [...baseOptions, appOnly] : [...baseOptions];
  const currentValue = recNotifications[subId as keyof typeof recNotifications];

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex justify-between items-center px-6 pt-12 pb-4 bg-app-surface border-b border-transparent">
        <div className="text-[28px] font-bold text-gray-900">{title}</div>
        <button
          {...bindBack()}
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
        >
          <IcClose size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pt-6">
        <div className="text-[15px] text-gray-900 mb-6">{description}</div>
        <div className="text-[13px] font-medium text-app-text-muted mb-6">
          {s.notification_receive_settings}
        </div>
        <div className="space-y-8">
          {options.map((option) => (
            <div
              key={option}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => updateRecNotifications(subId as any, option)}
            >
              <div
                className={`w-5 h-5 rounded-full border-[2px] shrink-0 flex items-center justify-center p-0.5 ${
                  currentValue === option ? 'border-app-primary' : 'border-gray-500'
                }`}
              >
                {currentValue === option && (
                  <div className="w-full h-full rounded-full bg-app-primary" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base text-gray-900">{localizeMapSettingValue(option, s)}</span>
                {option === appOnly && (
                  <IcHelp size={16} className="text-gray-400 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-8 cursor-pointer active:opacity-70">
          <span className="text-app-primary font-bold text-[15px]">
            {s.notification_advanced_prefs}
          </span>
          <IcNavArrow size={18} className="text-app-primary shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default RecommendationSubPage;
