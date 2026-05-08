import React from 'react';
import { IcAlarm, IcGlobe, IcStopwatch, IcTimer } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';

export type TabKey = 'alarm' | 'world' | 'stopwatch' | 'timer';

export const TabBar: React.FC<{ activeTab: TabKey; onChange: (tab: TabKey) => void }> = ({ activeTab, onChange }) => {
  const s = useAppStrings(strings, stringsEn);
  const tabs = [
    { id: 'alarm' as const, label: s.alarm_tab, icon: IcAlarm },
    { id: 'world' as const, label: s.world_clock_tab, icon: IcGlobe },
    { id: 'stopwatch' as const, label: s.stopwatch_tab, icon: IcStopwatch },
    { id: 'timer' as const, label: s.timer_tab, icon: IcTimer },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-6 pt-2 z-30">
      <div className="flex items-center justify-around">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-black' : 'text-gray-400'}`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
