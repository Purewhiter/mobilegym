export type AlarmRepeat = 'once' | 'daily' | 'workday' | 'holiday' | 'weekday';

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  repeat: AlarmRepeat;
  note?: string;
  /** 响铃时振动，默认 true */
  vibrate: boolean;
  /** 响铃后删除此闹钟，默认 false */
  autoDelete: boolean;
}

export interface WorldCity {
  id: string;
  name: string;
  country: string;
  gmtOffsetMinutes: number;
}

