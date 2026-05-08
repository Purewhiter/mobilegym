import * as TimeService from '../../../os/TimeService';

export function toLocalDateKey(ts: number) {
  const date = TimeService.fromTimestamp(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
