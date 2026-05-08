import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { IcNavForward, IcExpand, IcInfo, IcClose, IcCheck } from '../res/icons';
import * as TimeService from '../../../os/TimeService';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useMeetingStore } from '../state';
import { dimens } from '../res/dimens';
import {
    formatMeetingMonthDay,
    getDefaultMeetingTimezone,
    getLocalizedTimezoneList,
    getMeetingWeekdayNames,
    isEnglishMeetingStrings,
    localizeMeetingTimezone,
    type TencentMeetingStrings,
} from '../utils/localization';

const Switch: React.FC<{ value: boolean; onChange: (value: boolean) => void }> = ({ value, onChange }) => (
    <div
        className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
        onClick={() => onChange(!value)}
    >
        <div className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full transition-transform shadow-sm ${value ? 'left-[22px]' : 'left-0.5'}`}></div>
    </div>
);

// 生成日期选项（从今天开始的30天）
const generateDateOptions = (s: TencentMeetingStrings) => {
    const options: { value: number; label: string }[] = [];
    const weekdayNames = getMeetingWeekdayNames(s);
    const today = TimeService.getDate();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
        const date = TimeService.fromTimestamp(today.getTime());
        date.setDate(date.getDate() + i);
        const monthDay = formatMeetingMonthDay(date, s, { padMonth: false, padDay: true });
        const weekday = weekdayNames[date.getDay()];
        let label = `${monthDay} ${weekday}`;
        if (i === 0) label = s.home_date_today;
        else if (i === 1) label = `${s.home_date_tomorrow} ${monthDay}`;
        options.push({ value: date.getTime(), label });
    }
    return options;
};

const generateHourOptions = (suffix: string) =>
    Array.from({ length: 24 }, (_, i) => ({ value: i, label: i.toString().padStart(2, '0') + suffix }));

const generateMinuteOptions = (suffix: string) =>
    Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: (i * 5).toString().padStart(2, '0') + suffix }));

const generateDurationHourOptions = (suffix: string) =>
    Array.from({ length: 24 }, (_, i) => ({ value: i, label: i.toString().padStart(2, '0') + (i > 0 ? suffix : '') }));

const generateDurationMinuteOptions = (suffix: string) =>
    Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: (i * 5).toString().padStart(2, '0') + suffix }));

const PickerColumn: React.FC<{
    options: { value: number; label: string }[];
    value: number;
    onChange: (value: number) => void;
}> = ({ options, value, onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemHeight = 44;

    const currentIndex = options.findIndex(opt => opt.value === value);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = currentIndex * itemHeight;
        }
    }, []);

    const handleScroll = () => {
        if (containerRef.current) {
            const scrollTop = containerRef.current.scrollTop;
            const index = Math.round(scrollTop / itemHeight);
            const clampedIndex = Math.max(0, Math.min(index, options.length - 1));
            if (options[clampedIndex] && options[clampedIndex].value !== value) {
                onChange(options[clampedIndex].value);
            }
        }
    };

    const handleScrollEnd = () => {
        if (containerRef.current) {
            const scrollTop = containerRef.current.scrollTop;
            const index = Math.round(scrollTop / itemHeight);
            const clampedIndex = Math.max(0, Math.min(index, options.length - 1));
            containerRef.current.scrollTo({ top: clampedIndex * itemHeight, behavior: 'smooth' });
        }
    };

    return (
        <div className="relative flex-1 h-(--app-picker-total-height)">
            <div className="absolute top-1/2 left-0 right-0 h-(--app-picker-item-height) -translate-y-1/2 bg-gray-100 rounded-lg pointer-events-none z-0"></div>
            <div
                ref={containerRef}
                className="h-full overflow-y-auto no-scrollbar relative z-10"
                onScroll={handleScroll}
                onTouchEnd={handleScrollEnd}
                onMouseUp={handleScrollEnd}
                // 禁用 mandatory scroll snap：__SIM_INPUT__.swipe 会分步 scrollBy，
                // 小位移也会在每一步被浏览器吸附放大，bench_env 容易明显过冲。
                // 这里改为仅在手势结束时由 handleScrollEnd 统一吸附到最近刻度。
                style={{ scrollSnapType: 'none', overscrollBehaviorY: 'contain' }}
            >
                <div style={{ height: itemHeight * 2 }}></div>
                {options.map((option, index) => {
                    const isSelected = option.value === value;
                    return (
                        <div
                            key={index}
                            className={`h-(--app-picker-item-height) flex items-center justify-center text-[17px] transition-colors ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-400'}`}
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={isSelected ? () => {
                                onChange(option.value);
                                if (containerRef.current) {
                                    containerRef.current.scrollTo({ top: index * itemHeight, behavior: 'smooth' });
                                }
                            } : undefined}
                        >
                            {option.label}
                        </div>
                    );
                })}
                <div style={{ height: itemHeight * 2 }}></div>
            </div>
        </div>
    );
};

const StartTimePicker: React.FC<{
    value: number;
    onChange: (value: number) => void;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ value, onChange, onClose, onConfirm }) => {
    const s = useTencentMeetingStrings();
    const dateOptions = generateDateOptions(s);
    const hourOptions = generateHourOptions(s.picker_suffix_hour);
    const minuteOptions = generateMinuteOptions(s.picker_suffix_minute);

    const date = TimeService.fromTimestamp(value);
    const dateValue = TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const hourValue = date.getHours();
    const minuteValue = Math.floor(date.getMinutes() / 5) * 5;

    const handleDateChange = (newDateValue: number) => {
        const newDate = TimeService.fromTimestamp(newDateValue);
        newDate.setHours(hourValue, minuteValue, 0, 0);
        onChange(newDate.getTime());
    };

    const handleHourChange = (newHour: number) => {
        const newDate = TimeService.fromTimestamp(value);
        newDate.setHours(newHour);
        onChange(newDate.getTime());
    };

    const handleMinuteChange = (newMinute: number) => {
        const newDate = TimeService.fromTimestamp(value);
        newDate.setMinutes(newMinute);
        onChange(newDate.getTime());
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="p-1"><IcClose size={24} className="text-gray-500" /></button>
                    <span className="text-[17px] font-medium text-gray-900">{s.picker_start_time}</span>
                    <button onClick={onConfirm} className="p-1"><IcCheck size={24} className="text-blue-600" /></button>
                </div>
                <div className="flex px-4 py-2">
                    <PickerColumn options={dateOptions} value={dateValue} onChange={handleDateChange} />
                    <PickerColumn options={hourOptions} value={hourValue} onChange={handleHourChange} />
                    <PickerColumn options={minuteOptions} value={minuteValue} onChange={handleMinuteChange} />
                </div>
            </div>
        </div>
    );
};

const DurationPicker: React.FC<{
    startTime: number;
    duration: number;
    onChange: (duration: number) => void;
    onClose: () => void;
    onConfirm: () => void;
    onSwitchToEndTime: () => void;
}> = ({ duration, onChange, onClose, onConfirm, onSwitchToEndTime }) => {
    const s = useTencentMeetingStrings();
    const hourOptions = generateDurationHourOptions(s.picker_suffix_hours);
    const minuteOptions = generateDurationMinuteOptions(s.picker_suffix_minutes);

    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="p-1"><IcClose size={24} className="text-gray-500" /></button>
                    <span className="text-[17px] font-medium text-gray-900">{s.picker_duration}</span>
                    <button onClick={onConfirm} className="p-1"><IcCheck size={24} className="text-blue-600" /></button>
                </div>
                <div className="flex px-4 py-2">
                    <PickerColumn options={hourOptions} value={hours} onChange={(v) => onChange(v * 60 + minutes)} />
                    <PickerColumn options={minuteOptions} value={minutes} onChange={(v) => onChange(hours * 60 + v)} />
                </div>
                <div className="border-t border-gray-100 py-4">
                    <button className="w-full text-center text-[15px] text-gray-600" onClick={onSwitchToEndTime}>
                        {s.picker_select_end_time}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EndTimePicker: React.FC<{
    startTime: number;
    endTime: number;
    onChange: (endTime: number) => void;
    onClose: () => void;
    onConfirm: () => void;
    onBack: () => void;
}> = ({ startTime, endTime, onChange, onClose, onConfirm, onBack }) => {
    const s = useTencentMeetingStrings();
    const dateOptions = generateDateOptions(s);
    const hourOptions = generateHourOptions(s.picker_suffix_hour);
    const minuteOptions = generateMinuteOptions(s.picker_suffix_minute);

    const date = TimeService.fromTimestamp(endTime);
    const dateValue = TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const hourValue = date.getHours();
    const minuteValue = Math.floor(date.getMinutes() / 5) * 5;

    const durationMs = endTime - startTime;
    const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));
    const durationHours = Math.floor(durationMinutes / 60);
    const durationMins = durationMinutes % 60;
    const durationText = durationHours > 0
        ? `${durationHours}${s.picker_suffix_hours}${durationMins > 0 ? durationMins + s.picker_suffix_minutes : ''}`
        : `${durationMins}${s.picker_suffix_minutes}`;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <button onClick={onBack} className="p-1">
                        <IcNavForward size={24} className="text-gray-500 transform rotate-180" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[17px] font-medium text-gray-900">{s.picker_duration_prefix} {durationText}</span>
                        <span className="text-[13px] text-gray-400">{s.picker_select_end_time}</span>
                    </div>
                    <button onClick={onConfirm} className="p-1"><IcCheck size={24} className="text-blue-600" /></button>
                </div>
                <div className="flex px-4 py-2">
                    <PickerColumn options={dateOptions} value={dateValue} onChange={(v) => {
                        const nd = TimeService.fromTimestamp(v);
                        nd.setHours(hourValue, minuteValue, 0, 0);
                        onChange(nd.getTime());
                    }} />
                    <PickerColumn options={hourOptions} value={hourValue} onChange={(v) => {
                        const nd = TimeService.fromTimestamp(endTime);
                        nd.setHours(v);
                        onChange(nd.getTime());
                    }} />
                    <PickerColumn options={minuteOptions} value={minuteValue} onChange={(v) => {
                        const nd = TimeService.fromTimestamp(endTime);
                        nd.setMinutes(v);
                        onChange(nd.getTime());
                    }} />
                </div>
            </div>
        </div>
    );
};

const TimezonePicker: React.FC<{
    value: string;
    options: string[];
    onSelect: (timezone: string) => void;
    onClose: () => void;
}> = ({ value, options, onSelect, onClose }) => {
    const s = useTencentMeetingStrings();
    const listRef = useRef<HTMLDivElement>(null);
    const selectedIndex = options.findIndex(tz => tz === value);

    useEffect(() => {
        if (listRef.current && selectedIndex >= 0) {
            const itemHeight = dimens.timezone_item_height;
            listRef.current.scrollTop = selectedIndex * itemHeight;
        }
    }, [selectedIndex]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
            <div className="pt-10 shrink-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={onClose} className="text-[17px] text-gray-900">{s.btn_cancel}</button>
                    <span className="text-[17px] font-medium text-gray-900">{s.picker_select_timezone}</span>
                    <div className="w-10"></div>
                </div>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto" data-scroll-container="timezone" data-scroll-direction="vertical">
                {options.map((timezone, index) => {
                    const isSelected = timezone === value;
                    return (
                        <div key={index} className="h-(--app-timezone-item-height) px-4 flex items-center active:bg-gray-100"
                            onClick={() => { onSelect(timezone); onClose(); }}>
                            <span className={`text-[16px] ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>{timezone}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

type RepeatType = 'none' | 'daily' | 'workday' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

const formatRepeatDisplay = (
    repeatType: RepeatType, startTime: number, s: TencentMeetingStrings
): string => {
    const date = TimeService.fromTimestamp(startTime);
    const weekdayNames = getMeetingWeekdayNames(s);
    const weekday = weekdayNames[date.getDay()];
    const dayOfMonth = date.getDate();

    switch (repeatType) {
        case 'none': return s.repeat_none;
        case 'daily': return s.repeat_daily;
        case 'workday': return s.repeat_workday;
        case 'weekly': return s.repeat_format_weekly.replace('%s', weekday);
        case 'biweekly': return s.repeat_format_biweekly.replace('%s', weekday);
        case 'monthly': return s.repeat_format_monthly.replace('%s', String(dayOfMonth));
        case 'custom': return s.repeat_custom;
        default: return s.repeat_none;
    }
};

const RepeatFrequencyPicker: React.FC<{
    value: RepeatType;
    startTime: number;
    onSelect: (type: RepeatType) => void;
    onClose: () => void;
}> = ({ value, startTime, onSelect, onClose }) => {
    const s = useTencentMeetingStrings();
    const date = TimeService.fromTimestamp(startTime);
    const weekdayNames = getMeetingWeekdayNames(s);
    const weekday = weekdayNames[date.getDay()];
    const dayOfMonth = date.getDate();
    const wrapSuffix = (content: string) => isEnglishMeetingStrings(s) ? ` (${content})` : `（${content}）`;

    const options: { type: RepeatType; label: string; suffix?: string }[] = [
        { type: 'none', label: s.repeat_none },
        { type: 'daily', label: s.repeat_daily },
        { type: 'workday', label: s.repeat_workday },
        { type: 'weekly', label: s.repeat_weekly, suffix: wrapSuffix(weekday) },
        { type: 'biweekly', label: s.repeat_biweekly, suffix: wrapSuffix(weekday) },
        { type: 'monthly', label: s.repeat_monthly, suffix: wrapSuffix(`${dayOfMonth}${s.date_day_suffix}`) },
    ];

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
            <div className="bg-app-surface pt-10 shrink-0 border-b border-gray-100">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={onClose} className="p-1">
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.repeat_title}</span>
                    <div className="w-8"></div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-app-surface">
                {options.map(({ type, label, suffix }) => (
                    <div key={type} className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                        onClick={() => { onSelect(type); onClose(); }}>
                        <span className="text-[16px] text-gray-900">
                            {label}{suffix && <span className="text-gray-500">{suffix}</span>}
                        </span>
                        {value === type && <IcCheck size={20} className="text-blue-600" />}
                    </div>
                ))}
            </div>
        </div>
    );
};

const Row: React.FC<{
    label: string;
    value: string;
    valueClassName?: string;
    showArrow?: boolean;
    showInfo?: boolean;
    showPro?: boolean;
}> = ({ label, value, valueClassName, showArrow = true, showInfo, showPro }) => (
    <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center">
            <span className="text-gray-900 text-[15px]">{label}</span>
            {showInfo && <IcInfo size={14} className="text-gray-400 ml-1" />}
            {showPro && <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] flex items-center justify-center font-bold ml-1">↑</span>}
        </div>
        <div className={`flex items-center gap-1 ${valueClassName ?? 'text-gray-500 text-[15px]'}`}>
            <span className="max-w-[240px] truncate text-right">{value}</span>
            {showArrow && <IcNavForward size={16} className="text-gray-300" />}
        </div>
    </div>
);

const ToggleRow: React.FC<{
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    showInfo?: boolean;
    showPro?: boolean;
}> = ({ label, value, onChange, showInfo, showPro }) => (
    <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center">
            <span className="text-gray-900 text-[15px]">{label}</span>
            {showInfo && <IcInfo size={14} className="text-gray-400 ml-1" />}
            {showPro && <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] flex items-center justify-center font-bold ml-1">↑</span>}
        </div>
        <Switch value={value} onChange={onChange} />
    </div>
);

const formatStartTimeDisplay = (timestamp: number, s: TencentMeetingStrings): string => {
    const date = TimeService.fromTimestamp(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${formatMeetingMonthDay(date, s, { padMonth: true, padDay: true })} ${hours}:${minutes}`;
};

const formatDurationDisplay = (minutes: number, s: TencentMeetingStrings): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}${s.picker_suffix_hours}${mins}${s.picker_suffix_minutes}`;
    if (hours > 0) return `${hours}${s.picker_suffix_hours}`;
    return `${mins}${s.picker_suffix_minutes}`;
};

export const EditMeetingPage: React.FC = () => {
    const { bindBack, bindTap } = useMeetingGestures();
    const currentScheduledMeeting = useMeetingStore(s => s.currentScheduledMeeting);
    const updateScheduledMeeting = useMeetingStore(s => s.updateScheduledMeeting);
    const contacts = useMeetingStore(s => s.contacts);
    const s = useTencentMeetingStrings();

    // Pre-populate from currentScheduledMeeting
    const meeting = currentScheduledMeeting;

    const [topic, setTopic] = useState(meeting?.title ?? '');
    const [autoUseCard, setAutoUseCard] = useState(meeting?.settings.autoUseOvertimeCard ?? false);
    const [calendarOn, setCalendarOn] = useState(meeting?.settings.calendar ?? true);
    const [showMore, setShowMore] = useState(false);

    const [startTime, setStartTime] = useState(meeting?.startTime ?? TimeService.now());
    const [duration, setDuration] = useState(meeting?.duration ?? 30);
    const timezoneOptions = useMemo(() => getLocalizedTimezoneList(s), [s]);
    const [timezone, setTimezone] = useState(() =>
        meeting?.timezone ? localizeMeetingTimezone(meeting.timezone, s) : getDefaultMeetingTimezone(s, 'beijing')
    );
    useEffect(() => {
        setTimezone(prev => localizeMeetingTimezone(prev, s));
    }, [s]);
    const [repeatType, setRepeatType] = useState<RepeatType>(meeting?.repeatType ?? 'none');

    const [pickerType, setPickerType] = useState<'none' | 'startTime' | 'duration' | 'endTime' | 'timezone' | 'repeat'>('none');
    const [tempStartTime, setTempStartTime] = useState(startTime);
    const [tempDuration, setTempDuration] = useState(duration);
    const [tempEndTime, setTempEndTime] = useState(startTime + duration * 60000);

    const [waitingRoom, setWaitingRoom] = useState(meeting?.settings.waitingRoom ?? false);
    const [passwordEnabled, setPasswordEnabled] = useState(!!meeting?.settings.password);
    const [meetingPassword, setMeetingPassword] = useState(meeting?.settings.password ?? '');

    const [enableSignUp, setEnableSignUp] = useState(meeting?.settings.enableSignUp ?? false);
    const [allowBeforeHost, setAllowBeforeHost] = useState(meeting?.settings.allowBeforeHost ?? true);
    const [allowMultiDevice, setAllowMultiDevice] = useState(meeting?.settings.allowMultiDevice ?? true);
    const [forbidAddContact, setForbidAddContact] = useState(meeting?.settings.forbidAddContact ?? false);
    const [autoTranscribe, setAutoTranscribe] = useState(meeting?.settings.autoTranscribe ?? false);
    const [allowUploadDoc, setAllowUploadDoc] = useState(meeting?.settings.allowUploadDoc ?? true);

    const [invitees, setInvitees] = useState<{ id: string; name: string; avatar?: string }[]>(meeting?.invitees ?? []);
    const [showInviteesPicker, setShowInviteesPicker] = useState(false);

    const generateRandomPassword = () => {
        const length = Math.floor(Math.random() * 3) + 4;
        let password = '';
        for (let i = 0; i < length; i++) password += Math.floor(Math.random() * 10).toString();
        return password;
    };

    const handlePasswordToggle = (enabled: boolean) => {
        setPasswordEnabled(enabled);
        if (enabled && !meetingPassword) setMeetingPassword(generateRandomPassword());
    };

    if (!meeting) {
        return (
            <div className="flex flex-col h-full bg-app-surface pt-10 items-center justify-center">
                <p className="text-gray-500">{s.meeting_detail_not_found}</p>
            </div>
        );
    }

    const handleComplete = () => {
        updateScheduledMeeting(meeting.id, {
            title: topic,
            startTime,
            duration,
            timezone,
            repeatType,
            invitees,
            settings: {
                calendar: calendarOn,
                waitingRoom,
                password: passwordEnabled && meetingPassword ? meetingPassword : undefined,
                enableSignUp,
                allowBeforeHost,
                muteOnJoin: 'auto_after_6',
                watermark: false,
                allowMultiDevice,
                forbidAddContact,
                autoCloudRecord: false,
                autoTranscribe,
                allowUploadDoc,
                virtualBackground: undefined,
                autoUseOvertimeCard: autoUseCard,
            },
        });
    };

    const inviteesValue = invitees.length > 0
        ? `${invitees[0].name}${s.schedule_invitees_count.replace('%s', String(invitees.length))}`
        : s.schedule_invitees_add;

    return (
        <div className="flex flex-col h-full bg-[#F3F3F3]">
            {/* Header */}
            <div className="bg-app-surface pt-10 shrink-0">
                <div className="flex items-center justify-between px-2 py-2">
                    <button className="p-2" {...bindBack()}>
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <h1 className="text-[17px] font-medium text-gray-900">{s.edit_meeting_title}</h1>
                    <button
                        className="text-blue-600 text-[15px] px-2 py-2"
                        {...bindTap('meeting.edit.complete', { beforeTrigger: handleComplete })}
                    >
                        {s.edit_meeting_confirm}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {/* 会议主题 */}
                <div className="mt-3 bg-app-surface">
                    <div className="px-4 py-4">
                        <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="w-full text-[15px] text-gray-900 outline-none"
                            placeholder={s.schedule_topic_placeholder}
                        />
                    </div>
                </div>

                {/* 时间设置 */}
                <div className="mt-3 bg-app-surface">
                    <div onClick={() => { setTempStartTime(startTime); setPickerType('startTime'); }}>
                        <Row label={s.schedule_start_time} value={formatStartTimeDisplay(startTime, s)} />
                    </div>
                    <div onClick={() => { setTempDuration(duration); setTempEndTime(startTime + duration * 60000); setPickerType('duration'); }}>
                        <Row label={s.schedule_duration} value={formatDurationDisplay(duration, s)} />
                    </div>

                    {/* 提示框 */}
                    <div className="mx-4 my-3 px-3 py-3 bg-[#f0f5fa] rounded-lg">
                        <p className="text-[13px] text-gray-600 leading-relaxed">
                            {s.schedule_duration_limit_hint}
                            <span className="text-[#C4993C] font-medium ml-1">{s.schedule_upgrade_hint}</span>
                        </p>
                        <div className="border-t border-dashed border-gray-300 my-3"></div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-gray-500 text-[13px]">
                                <span>{s.schedule_overtime_remaining}</span>
                                <IcInfo size={14} className="text-gray-400" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-[13px]">{s.schedule_auto_use}</span>
                                <Switch value={autoUseCard} onChange={setAutoUseCard} />
                            </div>
                        </div>
                    </div>

                    <div onClick={() => setPickerType('timezone')}>
                        <Row label={s.schedule_timezone} value={timezone} />
                    </div>
                    <div onClick={() => setPickerType('repeat')}>
                        <Row label={s.schedule_repeat} value={formatRepeatDisplay(repeatType, startTime, s)} />
                    </div>
                </div>

                {/* 参会人 */}
                <div className="mt-3 bg-app-surface" onClick={() => setShowInviteesPicker(true)}>
                    <Row label={s.schedule_invitees} value={inviteesValue} />
                </div>

                {/* 日历、等候室、入会密码 */}
                <div className="mt-3 bg-app-surface">
                    <ToggleRow label={s.schedule_calendar} value={calendarOn} onChange={setCalendarOn} />
                    <ToggleRow label={s.schedule_waiting_room} value={waitingRoom} onChange={setWaitingRoom} />
                    <ToggleRow label={s.schedule_password} value={passwordEnabled} onChange={handlePasswordToggle} />

                    {passwordEnabled && (
                        <div className="flex items-center justify-between px-4 py-3">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={meetingPassword}
                                onChange={(e) => setMeetingPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder={s.schedule_password_placeholder}
                                className="flex-1 text-[15px] text-gray-900 outline-none placeholder-gray-400"
                            />
                            {meetingPassword && (
                                <button className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center ml-2" onClick={() => setMeetingPassword('')}>
                                    <IcClose size={12} className="text-white" />
                                </button>
                            )}
                        </div>
                    )}

                    {showMore && (
                        <>
                            <ToggleRow label={s.schedule_signup} value={enableSignUp} onChange={setEnableSignUp} showInfo />
                            <ToggleRow label={s.schedule_allow_before_host} value={allowBeforeHost} onChange={setAllowBeforeHost} />
                            <Row label={s.schedule_mute_on_join} value={s.schedule_mute_on_join_auto} />
                            <Row label={s.schedule_watermark} value={s.schedule_watermark_off} />
                            <ToggleRow label={s.schedule_multi_device} value={allowMultiDevice} onChange={setAllowMultiDevice} />
                        </>
                    )}
                </div>

                {showMore && (
                    <div className="mt-3 bg-app-surface">
                        <ToggleRow label={s.schedule_forbid_contact} value={forbidAddContact} onChange={setForbidAddContact} showPro />
                        <Row label={s.schedule_auto_cloud_record} value={s.schedule_auto_cloud_record_off} />
                        <ToggleRow label={s.schedule_auto_transcribe} value={autoTranscribe} onChange={setAutoTranscribe} />
                        <Row label={s.schedule_document} value={s.schedule_invitees_add} />
                        <ToggleRow label={s.schedule_allow_upload_doc} value={allowUploadDoc} onChange={setAllowUploadDoc} />
                        <Row label={s.schedule_vote} value={s.schedule_invitees_add} />
                        <Row label={s.schedule_apps} value={s.schedule_invitees_add} showInfo />
                    </div>
                )}

                {showMore && (
                    <div className="mt-3 mb-6 bg-app-surface">
                        <Row label={s.schedule_virtual_bg} value={s.schedule_virtual_bg_unset} showPro />
                    </div>
                )}

                {!showMore && (
                    <div className="mt-3 bg-app-surface">
                        <div className="flex items-center justify-center py-4 text-blue-600 text-[14px] cursor-pointer" onClick={() => setShowMore(true)}>
                            <span>{s.schedule_more}</span>
                            <IcExpand size={16} className="ml-0.5" />
                        </div>
                    </div>
                )}
            </div>

            {/* Pickers */}
            {pickerType === 'startTime' && (
                <StartTimePicker
                    value={tempStartTime}
                    onChange={setTempStartTime}
                    onClose={() => setPickerType('none')}
                    onConfirm={() => { setStartTime(tempStartTime); setPickerType('none'); }}
                />
            )}
            {pickerType === 'duration' && (
                <DurationPicker
                    startTime={startTime}
                    duration={tempDuration}
                    onChange={setTempDuration}
                    onClose={() => setPickerType('none')}
                    onConfirm={() => { setDuration(tempDuration); setPickerType('none'); }}
                    onSwitchToEndTime={() => { setTempEndTime(startTime + tempDuration * 60000); setPickerType('endTime'); }}
                />
            )}
            {pickerType === 'endTime' && (
                <EndTimePicker
                    startTime={startTime}
                    endTime={tempEndTime}
                    onChange={setTempEndTime}
                    onClose={() => setPickerType('none')}
                    onConfirm={() => {
                        const newDuration = Math.max(5, Math.floor((tempEndTime - startTime) / 60000));
                        setDuration(newDuration);
                        setPickerType('none');
                    }}
                    onBack={() => setPickerType('duration')}
                />
            )}
            {pickerType === 'timezone' && (
                <TimezonePicker value={timezone} options={timezoneOptions} onSelect={setTimezone} onClose={() => setPickerType('none')} />
            )}
            {pickerType === 'repeat' && (
                <RepeatFrequencyPicker
                    value={repeatType}
                    startTime={startTime}
                    onSelect={setRepeatType}
                    onClose={() => setPickerType('none')}
                />
            )}

            {/* Invitees Picker */}
            {showInviteesPicker && (
                <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
                    <div className="bg-app-surface pt-10 shrink-0 border-b border-gray-100">
                        <div className="flex items-center justify-between px-4 py-3">
                            <button onClick={() => setShowInviteesPicker(false)} className="text-[17px] text-gray-900">{s.btn_cancel}</button>
                            <span className="text-[17px] font-medium text-gray-900">{s.schedule_select_invitees}</span>
                            <button onClick={() => setShowInviteesPicker(false)} className="text-[17px] text-blue-600 font-medium">
                                {s.btn_confirm}({invitees.length})
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {contacts.map(contact => {
                            const isSelected = invitees.some(i => i.id === contact.id);
                            return (
                                <div key={contact.id} className="flex items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                                    onClick={() => {
                                        if (isSelected) setInvitees(prev => prev.filter(i => i.id !== contact.id));
                                        else setInvitees(prev => [...prev, contact]);
                                    }}>
                                    <div className={`w-5 h-5 rounded-full border mr-3 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                        {isSelected && <IcCheck size={14} className="text-white" />}
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm mr-3">
                                        {contact.avatar ? <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" /> : contact.name.slice(0, 2)}
                                    </div>
                                    <span className="text-[16px] text-gray-900">{contact.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
