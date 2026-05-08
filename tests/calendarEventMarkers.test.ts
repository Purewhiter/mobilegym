import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { buildEventDateKeySet, formatCalendarDateKey } from '../system/Calendar/utils/calendarUtils';

function localTs(year: number, month: number, day: number, hour = 0, minute = 0) {
  return TimeService.fromLocalParts(year, month - 1, day, hour, minute).getTime();
}

describe('Calendar 事件日期标记', () => {
  it('formatCalendarDateKey 会输出补零后的年月日 key', () => {
    const date = TimeService.fromLocalParts(2026, 3, 5);

    expect(formatCalendarDateKey(date)).toBe('2026-04-05');
  });

  it('buildEventDateKeySet 会覆盖单日、跨天与整天事件对应的日期', () => {
    const keys = buildEventDateKeySet([
      {
        startTs: localTs(2026, 4, 10, 9, 30),
        endTs: localTs(2026, 4, 10, 10, 30),
      },
      {
        startTs: localTs(2026, 4, 11, 23, 0),
        endTs: localTs(2026, 4, 12, 1, 0),
      },
      {
        startTs: localTs(2026, 4, 13, 0, 0),
        endTs: localTs(2026, 4, 14, 0, 0),
      },
    ]);

    expect(Array.from(keys).sort()).toEqual([
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
      '2026-04-13',
    ]);
  });
});
