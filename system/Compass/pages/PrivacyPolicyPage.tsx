import React from 'react';
import { IcNavBack, IcAdd, IcMoreVert, IcHome } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight } = SIMULATOR_CONFIG.framework;
import { useCompassGestures } from '../hooks/useCompassGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
export function PrivacyPolicyPage() {
  const { bindBack } = useCompassGestures();
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="w-full h-full bg-white text-black overflow-hidden" data-status-bar-foreground="dark">
      <div style={{ height: statusBarHeight }} />

      <div className="h-[56px] px-2 flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          aria-label={s.privacy_back}
          className="w-10 h-10 flex items-center justify-center text-gray-700 active:opacity-60"
          {...bindBack<HTMLButtonElement>()}
        >
          <IcNavBack size={22} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <IcHome size={20} className="text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0 bg-gray-100 rounded-full px-4 py-2 text-[15px] text-gray-700 truncate">
            privacy.mi.com/Compass/zh_CN
          </div>
        </div>

        <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-700 active:opacity-60" aria-label={s.privacy_new_tab}>
          <IcAdd size={20} />
        </button>
        <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-700 active:opacity-60" aria-label={s.menu_more}>
          <IcMoreVert size={20} />
        </button>
      </div>

      <div className="w-full h-full bg-white" />
    </div>
  );
}

