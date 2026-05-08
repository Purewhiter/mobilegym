import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcNavForward, IcMore, IcDot } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
export const HomeManagePage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);

  const statusText = (enabled: boolean) => (enabled ? s.generalsettingspage_on : s.generalsettingspage_off);

  const searchPreEnabled = settings.general.homeManage.searchPreEnabled;
  const voiceFloatEnabled = settings.general.homeManage.voiceFloatEnabled;
  const activityAmbienceEnabled = settings.general.homeManage.activityAmbienceEnabled;
  const appDynamicEnabled = settings.general.homeManage.appDynamicEnabled;
  const featureColumnEnabled = settings.general.homeManage.featureColumnEnabled;
  const smartSceneEnabled = settings.general.homeManage.smartSceneEnabled;

  const rows: Array<
    | { id: string; label: string; rightText?: string; to?: string; showChevron?: boolean }
  > = [
    { id: 'searchBox', label: s.search_box_management, to: '/settings/general/home-manage/search-box', showChevron: true },
    { id: 'searchPre', label: s.search_landing_management, rightText: statusText(searchPreEnabled), to: '/settings/general/home-manage/search-pre', showChevron: true },
    { id: 'voiceFloat', label: s.voice_quick_floating_ball, rightText: statusText(voiceFloatEnabled), to: '/settings/general/home-manage/voice-float', showChevron: true },
    { id: 'pinnedApps', label: s.pinned_app_order, showChevron: true },
    { id: 'activityAmbience', label: s.activity_banner, rightText: statusText(activityAmbienceEnabled), to: '/settings/general/home-manage/activity-ambience', showChevron: true },
    { id: 'appDynamic', label: s.app_activity_alerts, rightText: statusText(appDynamicEnabled), showChevron: true },
    { id: 'featureColumn', label: s.featured_column, rightText: statusText(featureColumnEnabled), showChevron: true },
    { id: 'smartScene', label: s.smart_scene_services, rightText: statusText(smartSceneEnabled), showChevron: true },
    { id: 'recommendCard', label: s.recommended_cards, showChevron: true },
  ];

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.home_management}</span>
        <div className="flex items-center gap-3">
          <button className="p-1">
            <IcMore size={22} className="text-gray-800" />
          </button>
          <button className="p-1">
            <IcDot size={22} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-3">
        <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
              {...(row.id === 'searchBox'
                ? bindTap<HTMLDivElement>('settings.homeManage.searchBox.open')
                : row.id === 'searchPre'
                  ? bindTap<HTMLDivElement>('settings.homeManage.searchPre.open')
                  : row.id === 'voiceFloat'
                    ? bindTap<HTMLDivElement>('settings.homeManage.voiceFloat.open')
                    : row.id === 'activityAmbience'
                      ? bindTap<HTMLDivElement>('settings.homeManage.activityAmbience.open')
                      : {})}
            >
              <span className="text-sm font-medium text-gray-800">{row.label}</span>
              <div className="flex items-center text-xs text-gray-400">
                {row.rightText && <span className="mr-2">{row.rightText}</span>}
                {row.showChevron && <IcNavForward size={16} className="text-gray-300" />}
              </div>
            </div>
          ))}
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
};

