import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcMore, IcDot } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';

export const SearchPreManagePage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const enabled = settings.general.homeManage.searchPreEnabled;

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.search_landing_management}</span>
        <div className="flex items-center gap-3">
          <button className="p-1">
            <IcMore size={22} className="text-gray-800" />
          </button>
          <button className="p-1">
            <IcDot size={22} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-6">
        <div className="flex justify-center mb-4">
          <div className="w-44 h-72 bg-app-surface rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-4 left-6 right-6 h-6 bg-gray-100 rounded-full"></div>
            <div className="absolute top-14 left-6 right-6 h-40 bg-gray-50 rounded-xl"></div>
            <div className="absolute left-2 top-16 text-xs text-gray-400">{s.top_search_suggestions}</div>
          </div>
        </div>

        <div className="text-gray-500 text-sm leading-relaxed px-1">
          {s.search_pre_manage_description}
        </div>

        <div className="mt-4 bg-app-surface rounded-xl shadow-sm px-4 py-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-800">{s.top_search_suggestions}</span>
          <button
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'homeManage.searchPreWords.toggle' },
              {
                onTrigger: () =>
                  setSettings((prev) => ({
                    ...prev,
                    general: { ...prev.general, homeManage: { ...prev.general.homeManage, searchPreEnabled: !prev.general.homeManage.searchPreEnabled } },
                  })),
              },
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

