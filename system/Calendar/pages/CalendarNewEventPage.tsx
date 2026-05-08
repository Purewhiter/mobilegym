import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IcNavForward, IcCalendarDays, IcCake, IcBookmark, IcTimer } from '../res/icons';
import { MaskIcon } from '../components/MaskIcon';
import { Toast } from '@/os/components/Toast';
import { CalendarActionSheet } from '../components/CalendarActionSheet';
import { useCalendarStore, selectSelectedDate } from '../state';
import { useShallow } from 'zustand/react/shallow';
import type { CalendarEventType } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

export const CalendarNewEventPage: React.FC = () => {
    const { back, go, bindBack } = useCalendarGestures();
    const { eventId } = useParams();
    const selectedDate = useCalendarStore(selectSelectedDate);
    const { settings, createEvent, setSelectedDate, updateEvent, events } = useCalendarStore(
      useShallow(s => ({
        settings: s.settings,
        createEvent: s.createEvent,
        setSelectedDate: s.setSelectedDate,
        updateEvent: s.updateEvent,
        events: s.events,
      })),
    );
    const s = useAppStrings(strings, stringsEn);

    const TAB_CONFIG: { key: CalendarEventType; label: string; icon: React.ReactNode }[] = [
        { key: 'event', label: s.event_type_event, icon: <IcCalendarDays size={22} /> },
        { key: 'birthday', label: s.event_type_birthday, icon: <IcCake size={22} /> },
        { key: 'anniversary', label: s.event_type_anniversary, icon: <IcBookmark size={22} /> },
        { key: 'countdown', label: s.event_type_countdown, icon: <IcTimer size={22} /> },
    ];

    const existing = useMemo(() => (eventId ? events.find(e => e.id === eventId) : undefined), [eventId, events]);
    const editing = !!eventId && !!existing;

    const [eventType, setEventType] = useState<CalendarEventType>('event');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [isAllDay, setIsAllDay] = useState(false);
    const [isAlarm, setIsAlarm] = useState(false);
    const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number | null>(0);
    const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
    const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const [startTs, setStartTs] = useState(() => selectedDate.getTime() + 30 * 60 * 1000);
    const [endTs, setEndTs] = useState(() => selectedDate.getTime() + 90 * 60 * 1000);
    const [startTimeInput, setStartTimeInput] = useState('');
    const [endTimeInput, setEndTimeInput] = useState('');

    const parseTimeInput = (v: string): { hour: number; minute: number } | null => {
        const str = String(v || '').trim();
        const m = str.match(/^(\d{1,2})\s*:\s*(\d{1,2})$/);
        if (!m) return null;
        const h = Number(m[1]);
        const mi = Number(m[2]);
        if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
        if (h < 0 || h > 23) return null;
        if (mi < 0 || mi > 59) return null;
        return { hour: h, minute: mi };
    };

    const syncTimeInputs = (st: number, et: number) => {
        const sd = TimeService.fromTimestamp(st);
        const ed = TimeService.fromTimestamp(et);
        const sh = String(sd.getHours()).padStart(2, '0');
        const sm = String(sd.getMinutes()).padStart(2, '0');
        const eh = String(ed.getHours()).padStart(2, '0');
        const em = String(ed.getMinutes()).padStart(2, '0');
        setStartTimeInput(`${sh}:${sm}`);
        setEndTimeInput(`${eh}:${em}`);
    };

    useEffect(() => {
        if (!existing) return;
        setEventType(existing.type);
        setTitle(existing.title);
        setNotes(existing.description ?? '');
        setIsAllDay(existing.allDay);
        setIsAlarm(Boolean(existing.alarmEnabled));
        setReminderMinutesBefore(existing.reminderMinutesBefore ?? 0);
        setStartTs(existing.startTs);
        setEndTs(existing.endTs);
        syncTimeInputs(existing.startTs, existing.endTs);
    }, [existing]);

    useEffect(() => {
        if (existing) return;
        // Keep draft aligned with currently selected day
        const st = selectedDate.getTime() + 30 * 60 * 1000;
        const et = selectedDate.getTime() + 90 * 60 * 1000;
        setStartTs(st);
        setEndTs(et);
        syncTimeInputs(st, et);
    }, [existing, selectedDate]);

    useEffect(() => {
        if (existing) return;
        const v = settings.defaultReminder;
        const minutes =
            v === '0_minutes_before'
                ? 0
                : v === '5_minutes_before'
                  ? 5
                  : v === '15_minutes_before'
                    ? 15
                    : v === '30_minutes_before'
                      ? 30
                      : v === '60_minutes_before'
                        ? 60
                        : v === '1_day_before'
                          ? 24 * 60
                          : 0;
        setReminderMinutesBefore(minutes);
    }, [existing, settings.defaultReminder]);

    useEffect(() => {
        if (!isAllDay) return;
        const dayStart = TimeService.fromTimestamp(startTs);
        dayStart.setHours(0, 0, 0, 0);
        const nextDay = TimeService.fromTimestamp(dayStart.getTime());
        nextDay.setDate(dayStart.getDate() + 1);
        setStartTs(dayStart.getTime());
        setEndTs(nextDay.getTime());
        syncTimeInputs(dayStart.getTime(), nextDay.getTime());
    }, [isAllDay]);

    const formatCN = (ts: number) => {
        const d = TimeService.fromTimestamp(ts);
        const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return { date: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日${week}`, time: `${hh}:${mm}` };
    };

    const startText = formatCN(startTs);
    const endText = formatCN(endTs);

    const applyStartTimeInput = () => {
        if (isAllDay) return;
        const parsed = parseTimeInput(startTimeInput);
        if (!parsed) {
            showToast(s.toast_invalid_start_time);
            syncTimeInputs(startTs, endTs);
            return;
        }
        const d = TimeService.fromTimestamp(startTs);
        d.setHours(parsed.hour, parsed.minute, 0, 0);
        const newTs = d.getTime();
        const duration = Math.max(endTs - startTs, 0);
        const newEndTs = newTs + duration;
        setStartTs(newTs);
        setEndTs(newEndTs);
        syncTimeInputs(newTs, newEndTs);
    };

    const applyEndTimeInput = () => {
        if (isAllDay) return;
        const parsed = parseTimeInput(endTimeInput);
        if (!parsed) {
            showToast(s.toast_invalid_end_time);
            syncTimeInputs(startTs, endTs);
            return;
        }
        const d = TimeService.fromTimestamp(endTs);
        d.setHours(parsed.hour, parsed.minute, 0, 0);
        const clamped = Math.max(d.getTime(), startTs);
        setEndTs(clamped);
        syncTimeInputs(startTs, clamped);
    };

    const reminderLabel = useMemo(() => {
        if (reminderMinutesBefore === null) return s.remind_none;
        if (reminderMinutesBefore === 0) return s.label_at_start;
        if (reminderMinutesBefore === 60) return s.remind_1_hour_before;
        if (reminderMinutesBefore === 24 * 60) return s.remind_1_day_before;
        return `${s.remind_before_prefix}${reminderMinutesBefore}${s.remind_before_suffix_min}`;
    }, [reminderMinutesBefore, s.remind_none, s.label_at_start, s.remind_1_hour_before, s.remind_1_day_before, s.remind_before_prefix, s.remind_before_suffix_min]);

    const handleSave = () => {
        const t = title.trim();
        if (!t) {
            showToast(s.validation_title_required);
            return;
        }
        const payload = {
            type: eventType,
            title: t,
            description: notes.trim() || undefined,
            location: undefined,
            allDay: isAllDay,
            startTs,
            endTs,
            reminderMinutesBefore,
            alarmEnabled: isAlarm,
            calendarAccount: s.default_account,
            color: undefined,
        };

        const id = editing && eventId ? eventId : createEvent(payload);
        if (editing && eventId) updateEvent(eventId, payload);
        // Jump back to event day
        setSelectedDate(TimeService.fromTimestamp(startTs));
        if (editing) go('event.open', { eventId: id });
        else back();
    };

    return (
        <div className="flex flex-col h-full bg-app-surface dark:bg-black overflow-hidden">
            <Toast message={toast.message} visible={toast.visible} />
            <CalendarActionSheet
                open={reminderSheetOpen}
                title={s.label_reminder}
                onClose={() => setReminderSheetOpen(false)}
                items={[
                    { id: 'none', title: s.remind_none, onClick: () => setReminderMinutesBefore(null) },
                    { id: '0', title: s.label_at_start, onClick: () => setReminderMinutesBefore(0) },
                    { id: '5', title: s.remind_5_min_before, onClick: () => setReminderMinutesBefore(5) },
                    { id: '15', title: s.remind_15_min_before, onClick: () => setReminderMinutesBefore(15) },
                    { id: '30', title: s.remind_30_min_before, onClick: () => setReminderMinutesBefore(30) },
                    { id: '60', title: s.remind_1_hour_before, onClick: () => setReminderMinutesBefore(60) },
                    { id: '1440', title: s.remind_1_day_before, onClick: () => setReminderMinutesBefore(24 * 60) },
                ]}
            />
            {/* Header: X  ...  ✓ */}
            <div className="flex items-center justify-between px-4 pt-10 pb-1 shrink-0">
                <button {...bindBack()} className="p-2 text-black dark:text-white">
                    <span className="text-gray-700 dark:text-gray-200">
                        <MaskIcon src={calIcon('miuix_action_icon_immersion_close_light')} size={22} />
                    </span>
                </button>
                <button onClick={handleSave} className="p-2 text-black dark:text-white">
                    <span className="text-gray-700 dark:text-gray-200">
                        <MaskIcon src={calIcon('miuix_action_icon_immersion_done_light')} size={22} />
                    </span>
                </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5">
                {/* Title */}
                <h1 className="text-3xl font-normal text-black dark:text-white mb-4">{editing ? s.edit_event : s.create_event}</h1>

                {/* Type tabs */}
                <div className="flex gap-6 mb-5">
                    {TAB_CONFIG.map(({ key, label, icon }) => {
                        const active = eventType === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setEventType(key)}
                                className={`flex flex-col items-center gap-1 pb-1 ${active ? 'text-app-primary' : 'text-gray-400'}`}
                            >
                                {icon}
                                <span className="text-xs">{label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Title input */}
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={s.label_title}
                    className="w-full text-lg py-3 bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-600 text-black dark:text-white border-b border-gray-100 dark:border-gray-800"
                />

                {/* Form rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {/* All day */}
                    <Row label={s.label_all_day}>
                        <Toggle value={isAllDay} onChange={setIsAllDay} />
                    </Row>

                    {/* Start time */}
                    <Row label={s.label_start_time}>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-app-text-muted">{startText.date}</div>
                            </div>
                            <input
                                value={isAllDay ? s.label_all_day_value : startTimeInput}
                                onChange={(e) => setStartTimeInput(e.target.value)}
                                onBlur={applyStartTimeInput}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        applyStartTimeInput();
                                        e.currentTarget.blur();
                                    }
                                }}
                                disabled={isAllDay}
                                inputMode="numeric"
                                placeholder="09:00"
                                className="w-[88px] text-right text-lg bg-transparent outline-none text-black dark:text-white disabled:text-gray-400"
                            />
                        </div>
                    </Row>

                    {/* End time */}
                    <Row label={s.label_end_time}>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-app-text-muted">{endText.date}</div>
                            </div>
                            <input
                                value={isAllDay ? s.label_all_day_value : endTimeInput}
                                onChange={(e) => setEndTimeInput(e.target.value)}
                                onBlur={applyEndTimeInput}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        applyEndTimeInput();
                                        e.currentTarget.blur();
                                    }
                                }}
                                disabled={isAllDay}
                                inputMode="numeric"
                                placeholder="10:00"
                                className="w-[88px] text-right text-lg bg-transparent outline-none text-black dark:text-white disabled:text-gray-400"
                            />
                        </div>
                    </Row>

                    {/* Repeat */}
                    <Row label={s.label_repeat}>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-400">{s.label_never}</span>
                            <IcNavForward size={18} className="text-gray-300" />
                        </div>
                    </Row>

                    {/* Reminder */}
                    <Row label={s.label_reminder}>
                        <button onClick={() => setReminderSheetOpen(true)} className="flex items-center gap-1">
                            <span className="text-gray-400">{reminderLabel}</span>
                            <IcNavForward size={18} className="text-gray-300" />
                        </button>
                    </Row>

                    {/* Alarm */}
                    <Row label={s.label_alarm}>
                        <Toggle value={isAlarm} onChange={setIsAlarm} />
                    </Row>
                </div>

                {/* Notes */}
                <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={s.label_notes}
                    className="w-full text-lg py-4 bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-600 text-black dark:text-white border-b border-gray-100 dark:border-gray-800"
                />

                {/* Calendar account */}
                <div className="flex items-center justify-between py-4">
                    <span className="text-lg text-black dark:text-white">{s.label_calendar_account}</span>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400">{s.default_account}</span>
                        <IcNavForward size={18} className="text-gray-300" />
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ---- Helpers ---- */

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex items-center justify-between py-4">
        <span className="text-lg text-black dark:text-white shrink-0">{label}</span>
        {children}
    </div>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
    <div
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${value ? 'bg-app-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
        <div className={`w-6 h-6 bg-app-surface rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
);
