import { resolveDataTimestamp } from '../../../os/TimeService';
import { DEFAULT_SCHEDULED_MEETING_SETTINGS } from '../constants';
import defaults from './defaults.json';
import type { MeetingRecord, OngoingMeeting, ScheduledMeeting, ParticipantInfo } from '../types';

export * from '../types';
export { DEFAULT_SCHEDULED_MEETING_SETTINGS };

const ts = (v: unknown) => resolveDataTimestamp(v as string | number);

const raw = defaults as any;

const history: MeetingRecord[] = (raw.history as any[]).map((record) => {
  const { startTime, endTime, participations, ...rest } = record;
  const next: MeetingRecord = {
    ...rest,
    startTime: ts(startTime),
    ...(endTime != null ? { endTime: ts(endTime) } : {}),
    ...(Array.isArray(participations)
      ? {
          participations: participations.map((p: any) => ({
            ...p,
            joinTime: ts(p.joinTime),
          })),
        }
      : {}),
  };
  return next;
});

export const MEETING_CONFIG = {
  user: raw.user,
  theme: raw.theme,
  history,
  contacts: (raw.contacts ?? []) as ParticipantInfo[],
  scheduledMeetings: ((raw.scheduledMeetings ?? []) as any[]).map((m: any): ScheduledMeeting => {
    const { startTime, createdAt, ...rest } = m;
    return {
      ...rest,
      startTime: ts(startTime),
      createdAt: ts(createdAt),
      settings: { ...rest.settings },
    } as ScheduledMeeting;
  }),
  settings: raw.settings,
  personalRoom: raw.personalRoom,
  messages: raw.messages,
  otherDevices: raw.otherDevices,
} as const;

export const ONGOING_MEETINGS: OngoingMeeting[] = (raw.ongoingMeetings as any[]).map((m) => {
  const { startTime, ...rest } = m;
  return {
    ...rest,
    startTime: ts(startTime),
  };
});

