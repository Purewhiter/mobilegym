import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import {
    MEETING_CONFIG,
    ONGOING_MEETINGS,
    type MeetingRecord,
    type ActiveMeeting,
    type ActiveParticipant,
    type ScheduledMeeting,
    type ScheduledMeetingSettings,
    type OngoingMeeting,
    type ChatMessage,
    type ParticipantInfo,
    type DeviceLogin,
    type MeetingType,
} from './data';
import * as TimeService from '../../os/TimeService';
import {
    buildQuickMeetingTitle,
    DEFAULT_MEETING_TIMEZONE_VALUE,
} from './utils/meetingDataValue';

let localSeq = 0;
function nextId(prefix: string): string {
    localSeq += 1;
    return `${prefix}_${TimeService.now()}_${localSeq}`;
}

// ---- Helper: pure function, no need to be inside a component ----

const generateMeetingId = (): string => {
    const part1 = Math.floor(100 + Math.random() * 900);
    const part2 = Math.floor(100 + Math.random() * 900);
    const part3 = Math.floor(100 + Math.random() * 900);
    return `${part1} ${part2} ${part3}`;
};

// ---- Types ----

export interface PendingMeetingConfig {
    usePersonalId: boolean;
    videoOn: boolean;
}

export interface ScheduleMeetingParams {
    title: string;
    note?: string;
    startTime: number;
    duration: number;
    timezone: string;
    repeatType: 'none' | 'daily' | 'workday' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
    invitees: { id: string; name: string; avatar?: string }[];
    settings: ScheduledMeetingSettings;
}

interface MeetingState {
    // Static config (read-only)
    user: typeof MEETING_CONFIG.user;
    personalRoom: typeof MEETING_CONFIG.personalRoom;
    messages: typeof MEETING_CONFIG.messages;
    otherDevices: DeviceLogin[];
    ongoingMeetings: OngoingMeeting[];
    // Persisted data
    history: MeetingRecord[];
    contacts: ParticipantInfo[];
    scheduledMeetings: ScheduledMeeting[];
    settings: typeof MEETING_CONFIG.settings;
    // Ephemeral (excluded from persistence)
    activeMeeting: ActiveMeeting | null;
    pendingMeetingConfig: PendingMeetingConfig | null;
    currentScheduledMeeting: ScheduledMeeting | null;
}

interface MeetingActions {
    addHistory: (record: MeetingRecord) => void;
    addContact: (user: ParticipantInfo) => void;
    updateSettings: (newSettings: Partial<typeof MEETING_CONFIG.settings>) => void;
    updatePersonalRoom: (room: Partial<typeof MEETING_CONFIG.personalRoom>) => void;
    markMessageRead: (id: string) => void;
    setPendingMeetingConfig: (config: PendingMeetingConfig | null) => void;
    startMeeting: (options: {
        isHost: boolean;
        meetingId?: string;
        usePersonalId?: boolean;
        type?: MeetingType;
        settings?: { micOn?: boolean; cameraOn?: boolean };
    }) => void;
    endMeeting: () => void;
    updateMeetingSettings: (settings: Partial<ActiveMeeting['settings']>) => void;
    updateParticipant: (participantId: string, updates: Partial<ActiveParticipant>) => void;
    muteAllParticipants: (muted: boolean) => void;
    sendChatMessage: (text: string, toId: string, toName: string) => void;
    scheduleMeeting: (params: ScheduleMeetingParams) => ScheduledMeeting;
    setCurrentScheduledMeeting: (meeting: ScheduledMeeting | null) => void;
    cancelScheduledMeeting: (id: string) => void;
    updateScheduledMeeting: (id: string, params: ScheduleMeetingParams) => void;
}

// ---- Initial state ----

const initialState: MeetingState = {
    user: MEETING_CONFIG.user,
    personalRoom: MEETING_CONFIG.personalRoom,
    messages: MEETING_CONFIG.messages,
    otherDevices: MEETING_CONFIG.otherDevices,
    ongoingMeetings: ONGOING_MEETINGS,
    history: MEETING_CONFIG.history,
    contacts: MEETING_CONFIG.contacts,
    scheduledMeetings: MEETING_CONFIG.scheduledMeetings,
    settings: MEETING_CONFIG.settings,
    // Ephemeral
    activeMeeting: null,
    pendingMeetingConfig: null,
    currentScheduledMeeting: null,
};

// ---- Store ----

export const useMeetingStore = createAppStoreWithActions<MeetingState, MeetingActions>(
    'tencent_meeting',
    initialState,
    (set, get) => ({
        addHistory: (record: MeetingRecord) => {
            set(state => ({ history: [record, ...state.history] }));
        },

        addContact: (contact: ParticipantInfo) => {
            set(state => ({ contacts: [...state.contacts, contact] }));
        },

        updateSettings: (newSettings) => {
            set(state => ({ settings: { ...state.settings, ...newSettings } }));
        },

        updatePersonalRoom: (newRoom) => {
            set(state => ({ personalRoom: { ...state.personalRoom, ...newRoom } }));
        },

        markMessageRead: (id: string) => {
            set(state => ({
                messages: state.messages.map((m: typeof state.messages[number]) => m.id === id ? { ...m, read: true } : m),
            }));
        },

        setPendingMeetingConfig: (config: PendingMeetingConfig | null) => {
            set({ pendingMeetingConfig: config });
        },

        startMeeting: (options) => {
            const state = get();
            const { user, settings: appSettings } = state;

            // 入会设置：优先使用传入的，否则使用全局设置
            const micOn = options.settings?.micOn ?? appSettings.micOnJoin;
            const cameraOn = options.settings?.cameraOn ?? appSettings.cameraOnJoin;

            let meetingId: string;
            let meetingTitle: string;
            let hostId: string;
            let hostName: string;
            let meetingStartTime: number;
            let meetingDuration: number = 60;
            let meetingTimezone: string = DEFAULT_MEETING_TIMEZONE_VALUE;

            if (options.meetingId) {
                meetingId = options.meetingId;
                const ongoingMeeting = state.ongoingMeetings.find(
                    m => m.meetingId === meetingId.replace(/\s/g, '')
                );
                if (ongoingMeeting && !options.isHost) {
                    meetingTitle = ongoingMeeting.title;
                    hostId = ongoingMeeting.hostId;
                    hostName = ongoingMeeting.hostName;
                    meetingStartTime = ongoingMeeting.startTime;
                    meetingDuration = ongoingMeeting.duration;
                    meetingTimezone = ongoingMeeting.timezone;
                } else {
                    meetingTitle = buildQuickMeetingTitle(user.name);
                    hostId = user.id;
                    hostName = user.name;
                    meetingStartTime = TimeService.now();
                }
            } else if (options.usePersonalId) {
                meetingId = MEETING_CONFIG.personalRoom.meetingId;
                meetingTitle = buildQuickMeetingTitle(user.name);
                hostId = user.id;
                hostName = user.name;
                meetingStartTime = TimeService.now();
            } else {
                meetingId = generateMeetingId();
                meetingTitle = buildQuickMeetingTitle(user.name);
                hostId = user.id;
                hostName = user.name;
                meetingStartTime = TimeService.now();
            }

            // 构建参与者列表
            let participants: ActiveParticipant[] = [];

            const existingMeetingRecord = state.history.find(
                h => h.meetingId === meetingId.replace(/\s/g, '')
            );

            if (existingMeetingRecord && existingMeetingRecord.participants && existingMeetingRecord.participants.length > 0) {
                participants = existingMeetingRecord.participants.map(p => {
                    const isCurrentUser = p.id === user.id;
                    return {
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                        isHost: p.id === existingMeetingRecord.hostId,
                        isMuted: isCurrentUser ? !micOn : true,
                        isVideoOn: isCurrentUser ? cameraOn : false,
                    };
                });

                if (!participants.some(p => p.id === user.id)) {
                    participants.push({
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                        isHost: options.isHost,
                        isMuted: !micOn,
                        isVideoOn: cameraOn,
                    });
                } else {
                    participants = participants.map(p =>
                        p.id === user.id
                            ? { ...p, isMuted: !micOn, isVideoOn: cameraOn, isHost: options.isHost || p.isHost }
                            : p
                    );
                }
            } else {
                if (options.isHost) {
                    participants = [{
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                        isHost: true,
                        isMuted: !micOn,
                        isVideoOn: cameraOn,
                    }];
                } else {
                    participants = [
                        {
                            id: hostId,
                            name: hostName,
                            avatar: undefined,
                            isHost: true,
                            isMuted: true,
                            isVideoOn: false,
                        },
                        {
                            id: user.id,
                            name: user.name,
                            avatar: user.avatar,
                            isHost: false,
                            isMuted: !micOn,
                            isVideoOn: cameraOn,
                        },
                    ];
                }
            }

            set({
                activeMeeting: {
                    id: nextId('meeting'),
                    meetingId,
                    title: meetingTitle,
                    startTime: meetingStartTime,
                    duration: meetingDuration,
                    timezone: meetingTimezone,
                    hostId,
                    type: options.type || 'quick',
                    participants,
                    joinTime: TimeService.now(),
                    settings: {
                        isMuted: !micOn,
                        isVideoOn: cameraOn,
                    },
                },
            });
        },

        endMeeting: () => {
            const state = get();
            const { activeMeeting, user } = state;
            if (!activeMeeting) {
                set({ activeMeeting: null });
                return;
            }

            const now = TimeService.now();
            const participationDuration = now - activeMeeting.joinTime;
            const isHost = activeMeeting.hostId === user.id;

            const participants = activeMeeting.participants.map(({ id, name, avatar }) => ({
                id, name, avatar,
            }));

            const participation = {
                joinTime: activeMeeting.joinTime,
                duration: participationDuration,
            };

            const existingRecord = state.history.find(
                h => h.meetingId === activeMeeting.meetingId && h.startTime === activeMeeting.startTime
            );

            if (existingRecord && existingRecord.participations) {
                set(s => ({
                    activeMeeting: null,
                    history: s.history.map(h =>
                        h.id === existingRecord.id
                            ? {
                                ...h,
                                ...(isHost ? { endTime: now } : {}),
                                participations: [...(h.participations || []), participation],
                            }
                            : h
                    ),
                }));
            } else {
                set(s => ({
                    activeMeeting: null,
                    history: [{
                        id: activeMeeting.id,
                        meetingId: activeMeeting.meetingId,
                        title: activeMeeting.title,
                        startTime: activeMeeting.startTime,
                        duration: activeMeeting.duration,
                        timezone: activeMeeting.timezone,
                        endTime: isHost ? now : undefined,
                        hostId: activeMeeting.hostId,
                        type: activeMeeting.type,
                        participants,
                        participations: [participation],
                    }, ...s.history],
                }));
            }
        },

        updateMeetingSettings: (newSettings) => {
            set(state => {
                if (!state.activeMeeting) return {};
                const nextSettings = { ...state.activeMeeting.settings, ...newSettings };
                // Keep participant "me" in sync with meeting-level mic/video toggles.
                // Some tasks/judges read per-participant flags (participants[].isMuted/isVideoOn).
                const nextParticipants = state.activeMeeting.participants.map(p => {
                    if (p.id !== state.user.id) return p;
                    return {
                        ...p,
                        ...(typeof newSettings.isMuted === 'boolean' ? { isMuted: newSettings.isMuted } : {}),
                        ...(typeof newSettings.isVideoOn === 'boolean' ? { isVideoOn: newSettings.isVideoOn } : {}),
                    };
                });
                return {
                    activeMeeting: {
                        ...state.activeMeeting,
                        settings: nextSettings,
                        participants: nextParticipants,
                    },
                };
            });
        },

        updateParticipant: (participantId, updates) => {
            set(state => {
                if (!state.activeMeeting) return {};
                const nextParticipants = state.activeMeeting.participants.map(p =>
                    p.id === participantId ? { ...p, ...updates } : p
                );

                // If updating "me", keep meeting-level toggles in sync so UI + judges agree.
                const isMe = participantId === state.user.id;
                const nextSettings = isMe
                    ? {
                        ...state.activeMeeting.settings,
                        ...(typeof updates.isMuted === 'boolean' ? { isMuted: updates.isMuted } : {}),
                        ...(typeof updates.isVideoOn === 'boolean' ? { isVideoOn: updates.isVideoOn } : {}),
                    }
                    : state.activeMeeting.settings;

                return {
                    activeMeeting: {
                        ...state.activeMeeting,
                        settings: nextSettings,
                        participants: nextParticipants,
                    },
                };
            });
        },

        muteAllParticipants: (muted: boolean) => {
            set(state => {
                if (!state.activeMeeting) return {};
                return {
                    activeMeeting: {
                        ...state.activeMeeting,
                        participants: state.activeMeeting.participants.map(p =>
                            p.id === state.user.id ? p : { ...p, isMuted: muted }
                        ),
                    },
                };
            });
        },

        sendChatMessage: (text: string, toId: string, toName: string) => {
            set(state => {
                if (!state.activeMeeting) return {};
                const newMessage: ChatMessage = {
                    id: nextId('msg'),
                    text,
                    sender: state.user.name,
                    senderId: state.user.id,
                    time: TimeService.now(),
                    to: toName,
                    toId,
                };
                return {
                    activeMeeting: {
                        ...state.activeMeeting,
                        chatMessages: [...(state.activeMeeting.chatMessages || []), newMessage],
                    },
                };
            });
        },

        scheduleMeeting: (params: ScheduleMeetingParams): ScheduledMeeting => {
            const state = get();
            const newMeeting: ScheduledMeeting = {
                id: nextId('scheduled'),
                meetingId: generateMeetingId(),
                title: params.title,
                note: params.note,
                startTime: params.startTime,
                duration: params.duration,
                timezone: params.timezone,
                repeatType: params.repeatType,
                hostId: state.user.id,
                invitees: params.invitees,
                settings: params.settings,
                status: 'pending',
                createdAt: TimeService.now(),
            };
            set(s => ({
                scheduledMeetings: [newMeeting, ...s.scheduledMeetings],
                currentScheduledMeeting: newMeeting,
            }));
            return newMeeting;
        },

        setCurrentScheduledMeeting: (meeting: ScheduledMeeting | null) => {
            set({ currentScheduledMeeting: meeting });
        },

        cancelScheduledMeeting: (id: string) => {
            set(state => ({
                scheduledMeetings: state.scheduledMeetings.map(m =>
                    m.id === id ? { ...m, status: 'cancelled' as const } : m
                ),
            }));
        },

        updateScheduledMeeting: (id: string, params: ScheduleMeetingParams) => {
            set(state => {
                const updated = state.scheduledMeetings.map(m =>
                    m.id === id
                        ? {
                            ...m,
                            title: params.title,
                            note: params.note,
                            startTime: params.startTime,
                            duration: params.duration,
                            timezone: params.timezone,
                            repeatType: params.repeatType,
                            invitees: params.invitees,
                            settings: params.settings,
                        }
                        : m
                );
                const currentMeeting = updated.find(m => m.id === id) ?? null;
                return {
                    scheduledMeetings: updated,
                    currentScheduledMeeting: currentMeeting,
                };
            });
        },
    }),
    {
        partialize: (state) => {
            // Exclude functions from persistence
            const result: Record<string, any> = {};
            for (const [k, v] of Object.entries(state)) {
                if (typeof v === 'function') continue;
                result[k] = v;
            }
            return result as Partial<MeetingState>;
        },
    },
);

// ---- Memoized selectors for derived arrays ----

/** Pending scheduled meetings (filtered) */
export const selectPendingScheduledMeetings = memoSelector(
    (s: MeetingState & MeetingActions) => s.scheduledMeetings,
    (meetings) => meetings.filter(m => m.status === 'pending'),
);
