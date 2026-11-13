import { describe, expect, it } from 'vitest';
import { fromLocalParts } from '../os/TimeService';

const at = (year: number, day: number, hour: number, minute: number) =>
  fromLocalParts(year, 3, day, hour, minute).getTime();
const NOW_TS = at(2026, 22, 23, 26);

describe('Notes 提醒时间选择模型', () => {
  it('会把非 5 分钟刻度向上取整', async () => {
    const { roundUpToReminderStep } = await import('../system/Notes/components/dateTimePickerModel');

    expect(roundUpToReminderStep(at(2026, 22, 23, 18))).toBe(at(2026, 22, 23, 20));
    expect(roundUpToReminderStep(at(2026, 22, 23, 20))).toBe(at(2026, 22, 23, 20));
  });

  it('以上午 00:00 的今天为锚点计算最晚可选时间', async () => {
    const { getReminderBounds } = await import('../system/Notes/components/dateTimePickerModel');

    expect(getReminderBounds(NOW_TS)).toEqual({
      minTs: at(2026, 22, 23, 30),
      maxTs: at(2027, 23, 11, 55),
    });
  });

  it('会把初始提醒时间夹到当前可选范围内', async () => {
    const { clampReminderSelection } = await import('../system/Notes/components/dateTimePickerModel');

    expect(clampReminderSelection(at(2026, 22, 21, 3), NOW_TS)).toBe(at(2026, 22, 23, 30));
    expect(clampReminderSelection(at(2027, 25, 9, 0), NOW_TS)).toBe(at(2027, 23, 11, 55));
  });
});
