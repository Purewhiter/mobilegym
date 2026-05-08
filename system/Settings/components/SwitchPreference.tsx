import React from 'react';
import { useBooleanPreference } from '../state';

interface SwitchPreferenceProps {
  title: string;
  summary?: string;
  defaultChecked?: boolean;
  /** Key into settingsConfig preferences */
  settingKey: string;
  showDivider?: boolean;
}

/** A preference item with a toggle switch */
export const SwitchPreference: React.FC<SwitchPreferenceProps> = ({
  title,
  summary,
  defaultChecked = false,
  settingKey,
  showDivider = true,
}) => {
  const [checked, setChecked] = useBooleanPreference(settingKey, defaultChecked);

  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-(--app-preference-item-min-height)"
        onClick={() => setChecked(!checked)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-app-text leading-tight">{title}</div>
          {summary && (
            <div className="text-[12px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
              {summary}
            </div>
          )}
        </div>
        <div className="ml-3 flex-shrink-0">
          <div
            className={`w-(--app-switch-track-width) h-(--app-switch-track-height) rounded-full flex items-center p-(--app-switch-track-padding) transition-colors ${
              checked ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'
            }`}
            style={{ transitionDuration: 'var(--app-duration-short)' }}
          >
            <div className="w-(--app-switch-thumb-size) h-(--app-switch-thumb-size) bg-app-surface rounded-full shadow-sm" />
          </div>
        </div>
      </div>
      {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
    </div>
  );
};
