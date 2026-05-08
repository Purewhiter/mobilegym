import type { LucideIcon } from 'lucide-react';
import type { ScheduledMeetingSettings } from './types';
import type { StringKey } from './res/strings';
import { IcMonitor, IcVideo, IcFile, IcBot, IcShop, IcSettings } from './res/icons';

// ========== "我"页 / 个人资料页 — 服务网格 ==========
export interface ServiceItem {
  id: string;
  icon: LucideIcon;
  labelKey: StringKey;
}

export const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'room',    icon: IcMonitor,  labelKey: 'service_personal_room' },
  { id: 'record',  icon: IcVideo,    labelKey: 'service_recording' },
  { id: 'note',    icon: IcFile,     labelKey: 'service_my_notes' },
  { id: 'ai',      icon: IcBot,      labelKey: 'service_ai_assistant' },
  { id: 'orders',  icon: IcShop,     labelKey: 'service_orders' },
  { id: 'rooms',   icon: IcSettings, labelKey: 'service_control_rooms' },
];

// ========== 预定会议默认设置（常量层） ==========
export const DEFAULT_SCHEDULED_MEETING_SETTINGS: ScheduledMeetingSettings = {
  calendar: true,
  waitingRoom: false,
  enableSignUp: false,
  allowBeforeHost: true,
  muteOnJoin: 'auto_after_6',
  watermark: false,
  allowMultiDevice: true,
  forbidAddContact: false,
  autoCloudRecord: false,
  autoTranscribe: false,
  allowUploadDoc: true,
};

