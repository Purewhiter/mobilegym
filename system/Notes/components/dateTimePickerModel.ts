import * as TimeService from '@/os/TimeService';

export const REMINDER_STEP_MINUTES = 5;
const REMINDER_STEP_MS = REMINDER_STEP_MINUTES * 60 * 1000;
const REMINDER_MAX_DAY_OFFSET = 366;
const REMINDER_MAX_HOUR = 11;
const REMINDER_MAX_MINUTE = 55;
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export type ReminderBounds = {
  minTs: number;
  maxTs: number;
};

export type ReminderDateOption = {
  value: number;
  label: string;
};

export function roundUpToReminderStep(timestamp: number): number {
  return Math.ceil(timestamp / REMINDER_STEP_MS) * REMINDER_STEP_MS;
}

export function startOfLocalDay(timestamp: number): number {
  const date = TimeService.fromTimestamp(timestamp);
  return TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getReminderBounds(nowTs: number): ReminderBounds {
  const minTs = roundUpToReminderStep(nowTs);
  const maxDate = TimeService.fromTimestamp(startOfLocalDay(nowTs));
  maxDate.setDate(maxDate.getDate() + REMINDER_MAX_DAY_OFFSET);
  maxDate.setHours(REMINDER_MAX_HOUR, REMINDER_MAX_MINUTE, 0, 0);

  return {
    minTs,
    maxTs: maxDate.getTime(),
  };
}

export function clampReminderSelection(timestamp: number, nowTs: number): number {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const rounded = roundUpToReminderStep(timestamp);
  return Math.min(maxTs, Math.max(minTs, rounded));
}

export function buildReminderTimestamp(dayStartTs: number, hour: number, minute: number): number {
  const date = TimeService.fromTimestamp(dayStartTs);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function formatReminderDateLabel(dayStartTs: number): string {
  const date = TimeService.fromTimestamp(dayStartTs);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_LABELS[date.getDay()]}`;
}

export function getReminderDateOptions(nowTs: number): ReminderDateOption[] {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const options: ReminderDateOption[] = [];
  const startDay = startOfLocalDay(minTs);
  const endDay = startOfLocalDay(maxTs);

  for (let dayStart = startDay; dayStart <= endDay; dayStart += 24 * 60 * 60 * 1000) {
    options.push({
      value: dayStart,
      label: formatReminderDateLabel(dayStart),
    });
  }

  return options;
}

function isSameLocalDay(leftTs: number, rightTs: number): boolean {
  return startOfLocalDay(leftTs) === startOfLocalDay(rightTs);
}

export function getReminderHourOptions(dayStartTs: number, nowTs: number): number[] {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const minHour = isSameLocalDay(dayStartTs, minTs) ? TimeService.fromTimestamp(minTs).getHours() : 0;
  const maxHour = isSameLocalDay(dayStartTs, maxTs) ? TimeService.fromTimestamp(maxTs).getHours() : 23;

  return Array.from({ length: maxHour - minHour + 1 }, (_, index) => minHour + index);
}

export function getReminderMinuteOptions(dayStartTs: number, hour: number, nowTs: number): number[] {
  const { minTs, maxTs } = getReminderBounds(nowTs);
  const minDate = TimeService.fromTimestamp(minTs);
  const maxDate = TimeService.fromTimestamp(maxTs);
  const minMinute =
    isSameLocalDay(dayStartTs, minTs) && hour === minDate.getHours() ? minDate.getMinutes() : 0;
  const maxMinute =
    isSameLocalDay(dayStartTs, maxTs) && hour === maxDate.getHours() ? maxDate.getMinutes() : 55;

  return Array.from(
    { length: Math.floor((maxMinute - minMinute) / REMINDER_STEP_MINUTES) + 1 },
    (_, index) => minMinute + index * REMINDER_STEP_MINUTES,
  );
}
