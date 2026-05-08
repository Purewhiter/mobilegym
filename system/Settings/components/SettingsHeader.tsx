import React from 'react';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSettingsGestures } from '../hooks/useSettingsGestures';

interface SettingsHeaderProps {
  title: string;
}

/** Sub-page header with back button and title */
export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ title }) => {
  const { bindBack } = useSettingsGestures();
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="sticky top-0 z-20 bg-app-bg">
      {/* Status bar spacer */}
      <div className="h-10" />
      <div className="flex items-center h-11 px-2">
        <button
          {...bindBack<HTMLButtonElement>()}
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
          aria-label={s.back}
        >
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-[17px] font-medium text-app-text ml-1">{title}</span>
      </div>
    </div>
  );
};
