import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as TimeService from '@/os/TimeService';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import {
  buildReminderTimestamp,
  clampReminderSelection,
  getReminderDateOptions,
  getReminderHourOptions,
  getReminderMinuteOptions,
  startOfLocalDay,
} from './dateTimePickerModel';

type PickerOption<T extends string | number> = {
  value: T;
  label: string;
};

const ITEM_HEIGHT = 56;
const PAD_HEIGHT = ITEM_HEIGHT;
const VISIBLE_HEIGHT = ITEM_HEIGHT * 3;
const SELECTED_TEXT = '#4A86FF';
const MUTED_TEXT = '#C6C6C6';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

const PickerColumn = <T extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);

  const selectedIndex = useMemo(
    () => options.findIndex(option => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!containerRef.current || selectedIndex < 0) return;
    containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
  }, [selectedIndex, options]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const snapToNearest = () => {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_HEIGHT), options.length - 1));
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
  };

  const scheduleSnap = () => {
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = window.setTimeout(() => {
      snapToNearest();
    }, 80);
  };

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.max(0, Math.min(Math.round(el.scrollTop / ITEM_HEIGHT), options.length - 1));
    const next = options[index];
    if (next && next.value !== value) {
      onChange(next.value);
    }
    scheduleSnap();
  };

  return (
    <div className={`relative ${className}`} style={{ height: VISIBLE_HEIGHT }}>
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-[18px] pointer-events-none"
        style={{ height: ITEM_HEIGHT, backgroundColor: 'rgba(74,134,255,0.08)' }}
      />
      <div
        ref={containerRef}
        className="relative h-full overflow-y-auto no-scrollbar"
        onScroll={handleScroll}
        onTouchEnd={snapToNearest}
        onMouseUp={snapToNearest}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <div style={{ height: PAD_HEIGHT }} />
        {options.map(option => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              className="w-full h-[56px] px-2 flex items-center justify-center text-center transition-colors"
              style={{
                color: selected ? SELECTED_TEXT : MUTED_TEXT,
                fontSize: selected ? 18 : 17,
                fontWeight: selected ? 700 : 500,
                scrollSnapAlign: 'center',
              }}
              onClick={() => {
                onChange(option.value);
                const index = options.findIndex(item => item.value === option.value);
                containerRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
              }}
            >
              {option.label}
            </button>
          );
        })}
        <div style={{ height: PAD_HEIGHT }} />
      </div>
    </div>
  );
};

export const DateTimeDialog: React.FC<{
  title: string;
  initialTimestamp?: number;
  onCancel: () => void;
  onConfirm: (timestamp: number) => void;
  onClear?: () => void;
}> = ({ initialTimestamp, onCancel, onConfirm, onClear }) => {
  const s = useAppStrings(strings, stringsEn);
  const [openedAtTs] = useState(() => TimeService.now());
  const [selectedTs, setSelectedTs] = useState(() =>
    clampReminderSelection(initialTimestamp ?? openedAtTs, openedAtTs),
  );
  const [reminderEnabled, setReminderEnabled] = useState(() => !onClear || typeof initialTimestamp === 'number');

  const selectedDate = TimeService.fromTimestamp(selectedTs);
  const selectedDayStart = startOfLocalDay(selectedTs);
  const selectedHour = selectedDate.getHours();
  const selectedMinute = selectedDate.getMinutes();

  const dateOptions = useMemo(() => getReminderDateOptions(openedAtTs), [openedAtTs]);
  const hourOptions = useMemo(
    () => getReminderHourOptions(selectedDayStart, openedAtTs),
    [openedAtTs, selectedDayStart],
  );
  const minuteOptions = useMemo(
    () => getReminderMinuteOptions(selectedDayStart, selectedHour, openedAtTs),
    [openedAtTs, selectedDayStart, selectedHour],
  );

  useEffect(() => {
    if (!hourOptions.includes(selectedHour)) {
      const fallbackHour = hourOptions[0];
      setSelectedTs(prev => {
        const prevDate = TimeService.fromTimestamp(prev);
        return clampReminderSelection(
          buildReminderTimestamp(selectedDayStart, fallbackHour, prevDate.getMinutes()),
          openedAtTs,
        );
      });
      return;
    }

    if (!minuteOptions.includes(selectedMinute)) {
      const fallbackMinute = minuteOptions[0];
      setSelectedTs(prev => {
        const prevDate = TimeService.fromTimestamp(prev);
        return clampReminderSelection(
          buildReminderTimestamp(selectedDayStart, prevDate.getHours(), fallbackMinute),
          openedAtTs,
        );
      });
    }
  }, [hourOptions, minuteOptions, openedAtTs, selectedDayStart, selectedHour, selectedMinute]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center px-4 pb-4">
      <button className="absolute inset-0 bg-black/35" onClick={onCancel} aria-label={s.action_close} />

      <div className="relative w-full max-w-[360px] rounded-[34px] bg-app-surface shadow-2xl px-5 pt-6 pb-5">
        <div className="text-center text-[18px] font-semibold text-black">{s.datetime_picker_title}</div>

        {onClear && typeof initialTimestamp === 'number' ? (
          <div className="mt-4 flex items-center justify-between px-1">
            <span className="text-[15px] font-medium text-black">{s.action_set_reminder}</span>
            <button
              type="button"
              aria-pressed={reminderEnabled}
              onClick={() => setReminderEnabled(value => !value)}
              className={`relative h-7 w-12 rounded-full p-0.5 transition-colors ${reminderEnabled ? 'bg-[#4A86FF]' : 'bg-[#d9d9d9]'}`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${reminderEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <PickerColumn
            value={selectedDayStart}
            options={dateOptions}
            onChange={(dayStart) => {
              setSelectedTs(prev => {
                const prevDate = TimeService.fromTimestamp(prev);
                return clampReminderSelection(
                  buildReminderTimestamp(dayStart, prevDate.getHours(), prevDate.getMinutes()),
                  openedAtTs,
                );
              });
            }}
            className="flex-[1.8]"
          />
          <PickerColumn
            value={selectedHour}
            options={hourOptions.map(hour => ({ value: hour, label: `${pad2(hour)} ${s.datetime_hour_suffix}` }))}
            onChange={(hour) => {
              setSelectedTs(prev => {
                const prevDate = TimeService.fromTimestamp(prev);
                return clampReminderSelection(
                  buildReminderTimestamp(selectedDayStart, hour, prevDate.getMinutes()),
                  openedAtTs,
                );
              });
            }}
            className="flex-1"
          />
          <PickerColumn
            value={selectedMinute}
            options={minuteOptions.map(minute => ({ value: minute, label: `${pad2(minute)} ${s.datetime_minute_suffix}` }))}
            onChange={(minute) => {
              setSelectedTs(
                clampReminderSelection(
                  buildReminderTimestamp(selectedDayStart, selectedHour, minute),
                  openedAtTs,
                ),
              );
            }}
            className="flex-1"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            className="flex-1 h-14 rounded-[22px] text-[16px] font-semibold"
            style={{ backgroundColor: '#f3f3f3', color: colors.text_secondary_strong }}
            onClick={onCancel}
          >
            {s.action_cancel}
          </button>
          <button
            type="button"
            className="flex-1 h-14 rounded-[22px] text-[16px] font-semibold text-white"
            style={{ backgroundColor: '#4A86FF' }}
            onClick={() => {
              if (!reminderEnabled && onClear) {
                onClear();
                return;
              }
              onConfirm(selectedTs);
            }}
          >
            {s.action_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateTimeDialog;
