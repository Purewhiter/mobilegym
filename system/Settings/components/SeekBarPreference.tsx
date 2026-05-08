import React from 'react';
import { useNumberPreference } from '../state';
import { Slider } from '@/os/components/Slider';

interface SeekBarPreferenceProps {
  title: string;
  summary?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  /** Key into settingsConfig preferences */
  settingKey: string;
  showDivider?: boolean;
}

/** A preference item with a slider/seek bar */
export const SeekBarPreference: React.FC<SeekBarPreferenceProps> = ({
  title,
  summary,
  defaultValue = 50,
  min = 0,
  max = 100,
  settingKey,
  showDivider = true,
}) => {
  const [rawValue, setRawValue] = useNumberPreference(settingKey, defaultValue);
  const value = Math.min(max, Math.max(min, rawValue));
  const setValue = (n: number) => setRawValue(Math.min(max, Math.max(min, n)));

  return (
    <div>
      <div className="px-4 py-3 min-h-(--app-preference-item-min-height)">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[15px] text-app-text leading-tight">{title}</div>
          <div className="text-[13px] text-gray-500">{value}</div>
        </div>
        {summary && (
          <div className="text-[12px] text-gray-400 mb-2 leading-tight">
            {summary}
          </div>
        )}
        <Slider
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={setValue}
          className="w-full"
        />
      </div>
      {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
    </div>
  );
};
