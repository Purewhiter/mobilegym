import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';

export const SpeedModeSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const enabled = settings.general.speedModeEnabled;

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.speed_mode}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-6">
        <div className="flex justify-center mb-6">
          <div className="w-40 h-56 bg-app-surface rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-4 left-4 right-4 h-5 bg-blue-100 rounded"></div>
            <div className="absolute top-12 left-4 right-4 h-16 grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded"></div>
              ))}
            </div>
            <div className="absolute top-32 left-4 right-4 space-y-2">
              <div className="h-3 bg-gray-100 rounded"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 h-9 bg-gray-100 rounded-full"></div>
          </div>
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div className="pr-4">
            <div className="text-sm font-medium text-gray-900">{s.quick_launch}</div>
            <div className="text-xs text-gray-400 mt-1 leading-relaxed">
              {s.speed_mode_description}
            </div>
          </div>
          <button
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'speedMode.enabled.toggle' },
                { onTrigger: () => setSettings((prev) => ({ ...prev, general: { ...prev.general, speedModeEnabled: !prev.general.speedModeEnabled } })) },
            )}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${enabled ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
          >
            <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
          </button>
        </div>
      </div>
    </div>
  );
};
