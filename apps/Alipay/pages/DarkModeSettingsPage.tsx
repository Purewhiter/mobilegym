import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcCheck } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type Mode = 'light' | 'dark';

export const DarkModeSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const followSystem = settings.general.darkMode.followSystem;
  const mode = settings.general.darkMode.mode as Mode;

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.dark_mode}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-3 space-y-3">
        <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="text-sm font-medium text-gray-800">{s.follow_system}</div>
              <div className="text-xs text-gray-400 mt-1">{s.when_enabled_dark_mode_follows_system_settings}</div>
            </div>
            <button
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: 'darkMode.followSystem.toggle' },
                {
                  onTrigger: () =>
                    setSettings((prev) => ({
                      ...prev,
                      general: { ...prev.general, darkMode: { ...prev.general.darkMode, followSystem: !prev.general.darkMode.followSystem } },
                    })),
                },
              )}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${followSystem ? 'bg-app-primary' : 'bg-gray-300'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            >
 <div className={`w-5 h-5 bg-app-surface rounded-full shadow ${followSystem ? 'translate-x-5' : 'translate-x-0'}`}
 style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-400 px-1">{s.manual}</div>
        <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
          <button
            className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50"
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'darkMode.mode.select.light' },
              { onTrigger: () => setSettings((prev) => ({ ...prev, general: { ...prev.general, darkMode: { ...prev.general.darkMode, mode: 'light' } } })) },
            )}
          >
            <span className="text-sm font-medium text-gray-800">{s.light_mode}</span>
            {!followSystem && mode === 'light' && <IcCheck size={20} className="text-app-primary" strokeWidth={3} />}
          </button>
          <button
            className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50"
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'darkMode.mode.select.dark' },
              { onTrigger: () => setSettings((prev) => ({ ...prev, general: { ...prev.general, darkMode: { ...prev.general.darkMode, mode: 'dark' } } })) },
            )}
          >
            <span className="text-sm font-medium text-gray-800">{s.dark_mode}</span>
            {!followSystem && mode === 'dark' && <IcCheck size={20} className="text-app-primary" strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
  );
};

