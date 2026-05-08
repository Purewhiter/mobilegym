export type CallLogId = string;

export type SimSlot = 1 | 2;

export type CallType = 'incoming' | 'outgoing' | 'missed';

export interface CallLogEntry {
  id: CallLogId;
  /** Display name if resolved, otherwise number */
  displayName: string;
  number: string;
  /** e.g. 河南驻马店 电信 */
  locationText?: string;
  /** e.g. 2月6日 */
  dateText: string;
  type?: CallType;
  sim?: SimSlot;
  /** Show "官方" pill */
  isOfficial?: boolean;
}

export interface SimProfile {
  slot: SimSlot;
  label: string; // e.g. 中国电信
  numberMasked: string; // UI only
}

export interface BusinessHallState {
  dataRemainingMb: number;
  dataUpdatedText: string; // e.g. 1天前更新
  balanceYuan: number;
  voiceUsedMinutes: number;
  greeting: string; // e.g. 你好，中国电信用户
}

