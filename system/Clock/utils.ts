import type { Alarm, AlarmRepeat } from './types';
import type { strings } from './res/strings';
import * as TimeService from '@/os/TimeService';

export const pad2 = (value: number) => value.toString().padStart(2, '0');

export const formatAlarmTime = (hour: number, minute: number) => `${pad2(hour)}:${pad2(minute)}`;

export const getRepeatLabel = (repeat: AlarmRepeat, s: typeof strings): string => {
  const labels: Record<AlarmRepeat, string> = {
    once: s.alarm_repeat_once,
    daily: s.alarm_repeat_daily,
    workday: s.alarm_repeat_workday,
    holiday: s.alarm_repeat_holiday,
    weekday: s.alarm_repeat_weekday,
  };
  return labels[repeat] ?? s.alarm_repeat_once;
};

export const formatGmtLabel = (offsetMinutes: number) => {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}:${pad2(minutes)}`;
};

export const getNextTrigger = (alarm: Alarm, baseDate: Date) => {
  const next = TimeService.fromTimestamp(baseDate.getTime());
  next.setHours(alarm.hour, alarm.minute, 0, 0);
  const moveToNextDay = () => {
    next.setDate(next.getDate() + 1);
  };

  if (alarm.repeat === 'weekday' || alarm.repeat === 'workday' || alarm.repeat === 'holiday') {
    let guard = 0;
    while (guard < 14) {
      const day = next.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const isRepeatDay = alarm.repeat === 'holiday' ? !isWeekday : isWeekday;
      if (isRepeatDay && next.getTime() > baseDate.getTime()) break;
      moveToNextDay();
      guard += 1;
    }
    return next.getTime();
  }

  if (next.getTime() > baseDate.getTime()) {
    return next.getTime();
  }

  moveToNextDay();
  return next.getTime();
};

export const formatCountdownText = (targetTime: number, baseTime: number, hoursInfix: string, minutesSuffix: string) => {
  const diffMs = Math.max(0, targetTime - baseTime);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}${hoursInfix}${minutes}${minutesSuffix}`;
  }
  return `${minutes}${minutesSuffix}`;
};

export const getNextAlarmText = (alarms: Alarm[], noAlarmsText: string, hoursInfix: string, minutesSuffix: string) => {
  const now = TimeService.getDate();
  const active = alarms.filter(item => item.enabled);
  if (active.length === 0) return noAlarmsText;
  const baseTime = now.getTime();
  let nextTime = Infinity;
  active.forEach(alarm => {
    const trigger = getNextTrigger(alarm, now);
    if (trigger < nextTime) nextTime = trigger;
  });
  if (nextTime === Infinity) return noAlarmsText;
  return formatCountdownText(nextTime, baseTime, hoursInfix, minutesSuffix);
};

export const getCityTime = (offsetMinutes: number, base: Date) => {
  const utc = base.getTime() + base.getTimezoneOffset() * 60000;
  return TimeService.fromTimestamp(utc + offsetMinutes * 60000);
};

export const formatCityDiff = (offsetMinutes: number, base: Date, localTimeLabel: string) => {
  const localOffsetHours = -base.getTimezoneOffset() / 60;
  const cityOffsetHours = offsetMinutes / 60;
  const diff = cityOffsetHours - localOffsetHours;
  if (diff === 0) return localTimeLabel;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  const minutesText = minutes > 0 ? `${minutes}分钟` : '';
  return `${diff > 0 ? '快' : '慢'}${hours}小时${minutesText}`;
};

export const formatCityDate = (date: Date, monthSuffix: string, daySuffix: string) =>
  `${date.getMonth() + 1}${monthSuffix}${date.getDate()}${daySuffix}`;
