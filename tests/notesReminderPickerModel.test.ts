import { describe, expect, it } from 'vitest';

const NOW_TS = new Date('2026-04-22T23:26:00+08:00').getTime();

describe('Notes 提醒时间选择模型', () => {
  it('会把非 5 分钟刻度向上取整', async () => {
    const { roundUpToReminderStep } = await import('../system/Notes/components/dateTimePickerModel');

    expect(roundUpToReminderStep(new Date('2026-04-22T23:18:00+08:00').getTime())).toBe(
      new Date('2026-04-22T23:20:00+08:00').getTime(),
    );
    expect(roundUpToReminderStep(new Date('2026-04-22T23:20:00+08:00').getTime())).toBe(
      new Date('2026-04-22T23:20:00+08:00').getTime(),
    );
  });

  it('以上午 00:00 的今天为锚点计算最晚可选时间', async () => {
    const { getReminderBounds } = await import('../system/Notes/components/dateTimePickerModel');

    expect(getReminderBounds(NOW_TS)).toEqual({
      minTs: new Date('2026-04-22T23:30:00+08:00').getTime(),
      maxTs: new Date('2027-04-23T11:55:00+08:00').getTime(),
    });
  });

  it('会把初始提醒时间夹到当前可选范围内', async () => {
    const { clampReminderSelection } = await import('../system/Notes/components/dateTimePickerModel');

    expect(
      clampReminderSelection(new Date('2026-04-22T21:03:00+08:00').getTime(), NOW_TS),
    ).toBe(new Date('2026-04-22T23:30:00+08:00').getTime());

    expect(
      clampReminderSelection(new Date('2027-04-25T09:00:00+08:00').getTime(), NOW_TS),
    ).toBe(new Date('2027-04-23T11:55:00+08:00').getTime());
  });
});
