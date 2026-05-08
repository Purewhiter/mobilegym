import React, { useState } from 'react';
import type { Alarm } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { getDate } from '../../../os/TimeService';
import { WheelColumn } from '../components/WheelColumn';
import { formatCountdownText, getNextTrigger } from '../utils';

export const AlarmEditModal: React.FC<{
  alarm: Alarm;
  onClose: () => void;
  onSave: (alarm: Alarm) => void;
  onMoreSettings: (hour: number, minute: number) => void;
}> = ({ alarm, onClose, onSave, onMoreSettings }) => {
  const s = useAppStrings(strings, stringsEn);
  const [hour, setHour] = useState(alarm.hour);
  const [minute, setMinute] = useState(alarm.minute);
  const now = getDate();
  const tempAlarm: Alarm = { ...alarm, hour, minute };
  const countdownText = formatCountdownText(getNextTrigger(tempAlarm, now), now.getTime(), s.alarm_rings_in_hours_infix, s.alarm_rings_in_minutes_suffix);

  const handleDone = () => {
    onSave({ ...alarm, hour, minute });
    onClose();
  };

  const handleMoreSettings = () => {
    onMoreSettings(hour, minute);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-[340px] bg-app-surface rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <h2 className="text-[22px] font-semibold text-black">{s.alarm_modify_title}</h2>
          <p className="text-[15px] text-app-text-muted mt-1">{countdownText}</p>
        </div>
        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-col items-center">
            <span className="text-[16px] text-app-text-muted mb-2">{s.alarm_hour_label}</span>
            <WheelColumn value={hour} options={Array.from({ length: 24 }, (_, i) => i)} onChange={setHour} medium wrap />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[16px] text-app-text-muted mb-2">{s.alarm_minute_label}</span>
            <WheelColumn value={minute} options={Array.from({ length: 60 }, (_, i) => i)} onChange={setMinute} medium wrap />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            onClick={handleMoreSettings}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-black text-[16px] font-medium"
          >
            {s.alarm_more_settings}
          </button>
          <button
            onClick={handleDone}
            className="flex-1 py-3 rounded-xl bg-app-primary text-white text-[16px] font-medium"
          >
            {s.alarm_done}
          </button>
        </div>
      </div>
    </div>
  );
};
