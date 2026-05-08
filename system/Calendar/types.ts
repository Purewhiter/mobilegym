export interface CalendarSettings {
    weekStartDay: string;
    showExtendMonth: boolean;
    showWeekNumber: boolean;
    showAlmanacYiJi: boolean;
    autoInsertAiEvent: boolean;
    defaultReminder: string;
    defaultAllDayReminder: string;
    defaultReminderLaterTime: string;
    holidayReminder: boolean;
    showRejectAgenda: boolean;
    autoImportBirthday: boolean;
}

export type CalendarEventType = 'event' | 'birthday' | 'anniversary' | 'countdown';

/**
 * Calendar event model used by the web simulator.
 * - Times are stored as timestamps (ms) to simplify persistence.
 */
export interface CalendarEvent {
    id: string;
    type: CalendarEventType;
    title: string;
    description?: string;
    location?: string;
    allDay: boolean;
    startTs: number;
    endTs: number;
    reminderMinutesBefore?: number | null;
    alarmEnabled?: boolean;
    calendarAccount?: string;
    color?: string;
}

export interface CalendarPersistedState {
    settings: CalendarSettings;
    events: CalendarEvent[];
    selectedDateTs?: number;
}
