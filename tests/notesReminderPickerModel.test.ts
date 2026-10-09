import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';

const NOW_TS = TimeService.fromLocalParts(2026, 3, 22, 23, 26).getTime();

describe('Notes 提醒时间选择模型', () => {
  it('会把非 5 分钟刻度向上取整', async () => {
    const { roundUpToReminderStep } = await import('../system/Notes/components/dateTimePickerModel');

    expect(roundUpToReminderStep(TimeService.fromLocalParts(2026, 3, 22, 23, 18).getTime())).toBe(
      TimeService.fromLocalParts(2026, 3, 22, 23, 20).getTime(),
    );
    expect(roundUpToReminderStep(TimeService.fromLocalParts(2026, 3, 22, 23, 20).getTime())).toBe(
      TimeService.fromLocalParts(2026, 3, 22, 23, 20).getTime(),
    );
  });

  it('以上午 00:00 的今天为锚点计算最晚可选时间', async () => {
    const { getReminderBounds } = await import('../system/Notes/components/dateTimePickerModel');

    expect(getReminderBounds(NOW_TS)).toEqual({
      minTs: TimeService.fromLocalParts(2026, 3, 22, 23, 30).getTime(),
      maxTs: TimeService.fromLocalParts(2027, 3, 23, 11, 55).getTime(),
    });
  });

  it('会把初始提醒时间夹到当前可选范围内', async () => {
    const { clampReminderSelection } = await import('../system/Notes/components/dateTimePickerModel');

    expect(
      clampReminderSelection(TimeService.fromLocalParts(2026, 3, 22, 21, 3).getTime(), NOW_TS),
    ).toBe(TimeService.fromLocalParts(2026, 3, 22, 23, 30).getTime());

    expect(
      clampReminderSelection(TimeService.fromLocalParts(2027, 3, 25, 9, 0).getTime(), NOW_TS),
    ).toBe(TimeService.fromLocalParts(2027, 3, 23, 11, 55).getTime());
  });
});
