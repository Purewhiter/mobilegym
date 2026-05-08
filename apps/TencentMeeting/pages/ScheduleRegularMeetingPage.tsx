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
    getMeetingListSeparator,
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

// 生成小时选项
const generateHourOptions = (suffix: string) => {
    return Array.from({ length: 24 }, (_, i) => ({
        value: i,
        label: i.toString().padStart(2, '0') + suffix,
    }));
};

// 生成分钟选项（5分钟间隔）
const generateMinuteOptions = (suffix: string) => {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i * 5,
        label: (i * 5).toString().padStart(2, '0') + suffix,
    }));
};

// 生成时长小时选项
const generateDurationHourOptions = (suffix: string) => {
    return Array.from({ length: 24 }, (_, i) => ({
        value: i,
        label: i.toString().padStart(2, '0') + (i > 0 ? suffix : ''),
    }));
};

// 生成时长分钟选项（5分钟间隔）
const generateDurationMinuteOptions = (suffix: string) => {
    return Array.from({ length: 12 }, (_, i) => ({
        value: i * 5,
        label: (i * 5).toString().padStart(2, '0') + suffix,
    }));
};

// 滚轮选择器列
const PickerColumn: React.FC<{
    options: { value: number; label: string }[];
    value: number;
    onChange: (value: number) => void;
}> = ({ options, value, onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemHeight = 44;
    const visibleItems = 5;

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
            containerRef.current.scrollTo({
                top: clampedIndex * itemHeight,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="relative flex-1 h-(--app-picker-total-height)">
            {/* 选中区域高亮 */}
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
                {/* 上下留白 */}
                <div style={{ height: itemHeight * 2 }}></div>
                {options.map((option, index) => {
                    const isSelected = option.value === value;
                    return (
                        <div
                            key={index}
                            className={`h-(--app-picker-item-height) flex items-center justify-center text-[17px] transition-colors ${
                                isSelected ? 'text-gray-900 font-medium' : 'text-gray-400'
                            }`}
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={isSelected ? () => {
                                onChange(option.value);
                                if (containerRef.current) {
                                    containerRef.current.scrollTo({
                                        top: index * itemHeight,
                                        behavior: 'smooth'
                                    });
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

// 开始时间选择器
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
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="p-1">
                        <IcClose size={24} className="text-gray-500" />
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.picker_start_time}</span>
                    <button onClick={onConfirm} className="p-1">
                        <IcCheck size={24} className="text-blue-600" />
                    </button>
                </div>

                {/* Picker */}
                <div className="flex px-4 py-2">
                    <PickerColumn options={dateOptions} value={dateValue} onChange={handleDateChange} />
                    <PickerColumn options={hourOptions} value={hourValue} onChange={handleHourChange} />
                    <PickerColumn options={minuteOptions} value={minuteValue} onChange={handleMinuteChange} />
                </div>
            </div>
        </div>
    );
};

// 会议时长选择器
const DurationPicker: React.FC<{
    startTime: number;
    duration: number;
    onChange: (duration: number) => void;
    onClose: () => void;
    onConfirm: () => void;
    onSwitchToEndTime: () => void;
}> = ({ startTime, duration, onChange, onClose, onConfirm, onSwitchToEndTime }) => {
    const s = useTencentMeetingStrings();
    const hourOptions = generateDurationHourOptions(s.picker_suffix_hours);
    const minuteOptions = generateDurationMinuteOptions(s.picker_suffix_minutes);

    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    const handleHourChange = (newHours: number) => {
        onChange(newHours * 60 + minutes);
    };

    const handleMinuteChange = (newMinutes: number) => {
        onChange(hours * 60 + newMinutes);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="p-1">
                        <IcClose size={24} className="text-gray-500" />
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.picker_duration}</span>
                    <button onClick={onConfirm} className="p-1">
                        <IcCheck size={24} className="text-blue-600" />
                    </button>
                </div>

                {/* Picker */}
                <div className="flex px-4 py-2">
                    <PickerColumn options={hourOptions} value={hours} onChange={handleHourChange} />
                    <PickerColumn options={minuteOptions} value={minutes} onChange={handleMinuteChange} />
                </div>

                {/* 选择结束时间 */}
                <div className="border-t border-gray-100 py-4">
                    <button
                        className="w-full text-center text-[15px] text-gray-600"
                        onClick={onSwitchToEndTime}
                    >
                        {s.picker_select_end_time}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 结束时间选择器
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

    // 计算时长
    const durationMs = endTime - startTime;
    const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));
    const durationHours = Math.floor(durationMinutes / 60);
    const durationMins = durationMinutes % 60;
    const durationText = durationHours > 0
        ? `${durationHours}${s.picker_suffix_hours}${durationMins > 0 ? durationMins + s.picker_suffix_minutes : ''}`
        : `${durationMins}${s.picker_suffix_minutes}`;

    const handleDateChange = (newDateValue: number) => {
        const newDate = TimeService.fromTimestamp(newDateValue);
        newDate.setHours(hourValue, minuteValue, 0, 0);
        onChange(newDate.getTime());
    };

    const handleHourChange = (newHour: number) => {
        const newDate = TimeService.fromTimestamp(endTime);
        newDate.setHours(newHour);
        onChange(newDate.getTime());
    };

    const handleMinuteChange = (newMinute: number) => {
        const newDate = TimeService.fromTimestamp(endTime);
        newDate.setMinutes(newMinute);
        onChange(newDate.getTime());
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <button onClick={onBack} className="p-1">
                        <IcNavForward size={24} className="text-gray-500 transform rotate-180" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[17px] font-medium text-gray-900">{s.picker_duration_prefix} {durationText}</span>
                        <span className="text-[13px] text-gray-400">{s.picker_select_end_time}</span>
                    </div>
                    <button onClick={onConfirm} className="p-1">
                        <IcCheck size={24} className="text-blue-600" />
                    </button>
                </div>

                {/* Picker */}
                <div className="flex px-4 py-2">
                    <PickerColumn options={dateOptions} value={dateValue} onChange={handleDateChange} />
                    <PickerColumn options={hourOptions} value={hourValue} onChange={handleHourChange} />
                    <PickerColumn options={minuteOptions} value={minuteValue} onChange={handleMinuteChange} />
                </div>
            </div>
        </div>
    );
};

// 时区选择器
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
        // 滚动到选中的时区
        if (listRef.current && selectedIndex >= 0) {
            const itemHeight = dimens.timezone_item_height;
            listRef.current.scrollTop = selectedIndex * itemHeight;
        }
    }, [selectedIndex]);

    const handleSelect = (timezone: string) => {
        onSelect(timezone);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
            {/* Header */}
            <div className="pt-10 shrink-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={onClose} className="text-[17px] text-gray-900">
                        {s.btn_cancel}
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.picker_select_timezone}</span>
                    <div className="w-10"></div>
                </div>
            </div>

            {/* List */}
            <div
                ref={listRef}
                className="flex-1 overflow-y-auto"
                data-scroll-container="timezone"
                data-scroll-direction="vertical"
            >
                {options.map((timezone, index) => {
                    const isSelected = timezone === value;
                    return (
                        <div
                            key={index}
                            className="h-(--app-timezone-item-height) px-4 flex items-center active:bg-gray-100"
                            onClick={() => handleSelect(timezone)}
                        >
                            <span className={`text-[16px] ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                                {timezone}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 重复频率类型
type RepeatType = 'none' | 'daily' | 'workday' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

interface CustomRepeatConfig {
    interval: number;
    unit: 'day' | 'week' | 'month';
    weekDays: number[];  // 0=周日, 1=周一...6=周六
    monthDays: number[]; // 1-31，月份日期多选
    monthMode: 'date' | 'weekday';
}

// 计算某个日期是当月的第几个周IcClose
const getWeekOrdinalInMonth = (date: Date): { ordinal: number; weekday: number } => {
    const weekday = date.getDay();
    const dayOfMonth = date.getDate();
    const ordinal = Math.ceil(dayOfMonth / 7);
    return { ordinal, weekday };
};

// 格式化重复频率显示文本
const formatRepeatDisplay = (
    repeatType: RepeatType,
    customConfig: CustomRepeatConfig,
    startTime: number,
    s: TencentMeetingStrings
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

// Toast 提示组件
const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 text-white px-6 py-3 rounded-lg text-[15px]">
                {message}
            </div>
        </div>
    );
};

// 重复频率主页面
const RepeatFrequencyPicker: React.FC<{
    value: RepeatType;
    startTime: number;
    onSelect: (type: RepeatType) => void;
    onClose: () => void;
    onOpenCustom: () => void;
}> = ({ value, startTime, onSelect, onClose, onOpenCustom }) => {
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

    const handleSelect = (type: RepeatType) => {
        onSelect(type);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
            {/* Header */}
            <div className="bg-app-surface pt-10 shrink-0 border-b border-gray-100">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={onClose} className="p-1">
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.repeat_title}</span>
                    <div className="w-8"></div>
                </div>
            </div>

            {/* Options */}
            <div className="flex-1 overflow-y-auto bg-app-surface">
                {options.map(({ type, label, suffix }) => (
                    <div
                        key={type}
                        className="flex items-center justify-between gap-3 px-4 py-4 active:bg-gray-50"
                        onClick={() => handleSelect(type)}
                    >
                        <span className="min-w-0 flex-1 text-[16px] leading-snug text-gray-900 break-words">
                            {label}
                            {suffix && <span className="text-gray-500">{suffix}</span>}
                        </span>
                        {value === type && <IcCheck size={20} className="text-blue-600" />}
                    </div>
                ))}

                {/* 分隔 */}
                <div className="h-2 bg-gray-100"></div>

                {/* 自定义 */}
                <div
                    className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                    onClick={onOpenCustom}
                >
                    <span className="text-[16px] text-gray-900">{s.repeat_custom}</span>
                    <IcNavForward size={20} className="text-gray-400" />
                </div>
            </div>
        </div>
    );
};

// 自定义重复频率页面
const CustomRepeatPicker: React.FC<{
    config: CustomRepeatConfig;
    startTime: number;
    onChange: (config: CustomRepeatConfig) => void;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ config, startTime, onChange, onClose, onConfirm }) => {
    const s = useTencentMeetingStrings();
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);

    const date = TimeService.fromTimestamp(startTime);
    const meetingDayOfMonth = date.getDate();
    const { ordinal, weekday } = getWeekOrdinalInMonth(date);
    const weekdayNames = getMeetingWeekdayNames(s);
    const listSeparator = getMeetingListSeparator(s);

    // 会议所在的星期
    const meetingWeekday = date.getDay();

    // 生成描述文本
    const getDescription = (): string => {
        const { interval, unit, weekDays, monthDays, monthMode } = config;

        if (unit === 'day') {
            if (interval === 1) return s.custom_repeat_day_prefix;
            return s.custom_repeat_day_interval.replace('%s', String(interval));
        } else if (unit === 'week') {
            if (weekDays.length === 0) {
                if (interval === 1) return s.custom_repeat_week_prefix;
                return s.custom_repeat_week_interval.replace('%s', String(interval));
            }
            const days = [...weekDays].sort((a, b) => a - b).map(d => weekdayNames[d]).join(listSeparator);
            if (interval === 1) return s.custom_repeat_week_days.replace('%s', days);
            return s.custom_repeat_week_interval_days.replace('%s', String(interval)).replace('%s', days);
        } else {
            if (monthMode === 'date') {
                const sortedDays = [...monthDays].sort((a, b) => a - b);
                const daysText = sortedDays.map(d => `${d}${s.date_day_suffix}`).join(listSeparator);
                if (interval === 1) return s.custom_repeat_month_of_days.replace('%s', daysText);
                return s.custom_repeat_month_interval_of_days.replace('%s', String(interval)).replace('%s', daysText);
            } else {
                const ordinalWeekday = s.custom_repeat_ordinal_weekday.replace('%s', String(ordinal)).replace('%s', weekdayNames[weekday]);
                if (interval === 1) return s.custom_repeat_month_of_days.replace('%s', ordinalWeekday);
                return s.custom_repeat_month_interval_of_days.replace('%s', String(interval)).replace('%s', ordinalWeekday);
            }
        }
    };

    // 生成频率显示文本
    const getFrequencyText = (): string => {
        const { interval, unit } = config;
        if (unit === 'day') return interval === 1 ? s.repeat_daily : `${s.repeat_every}${interval}${s.repeat_unit_day}`;
        if (unit === 'week') return interval === 1 ? s.repeat_weekly : `${s.repeat_every}${interval}${s.repeat_unit_week}`;
        return interval === 1 ? s.repeat_monthly : `${s.repeat_every}${interval}${s.repeat_unit_months}`;
    };

    // 数字选项
    const numberOptions = Array.from({ length: 99 }, (_, i) => ({
        value: i + 1,
        label: (i + 1).toString(),
    }));

    // 单位选项
    const unitOptions = [
        { value: 0, label: s.repeat_unit_day },
        { value: 1, label: s.repeat_unit_week },
        { value: 2, label: s.repeat_unit_month },
    ];

    const unitToValue = (u: 'day' | 'week' | 'month'): number => {
        if (u === 'day') return 0;
        if (u === 'week') return 1;
        return 2;
    };

    const valueToUnit = (v: number): 'day' | 'week' | 'month' => {
        if (v === 0) return 'day';
        if (v === 1) return 'week';
        return 'month';
    };

    const handleUnitChange = (unitValue: number) => {
        const newUnit = valueToUnit(unitValue);
        // 切换单位时，根据模式设置默认值
        const newWeekDays = newUnit === 'week' ? [date.getDay()] : config.weekDays;
        const newMonthDays = newUnit === 'month' ? [meetingDayOfMonth] : config.monthDays;
        onChange({ ...config, unit: newUnit, weekDays: newWeekDays, monthDays: newMonthDays });
    };

    const toggleWeekDay = (day: number) => {
        // 会议所在星期不能取消选中
        if (day === meetingWeekday && config.weekDays.includes(day)) {
            showToast(s.custom_repeat_cannot_deselect.replace('%s', weekdayNames[meetingWeekday]));
            return;
        }

        const newWeekDays = config.weekDays.includes(day)
            ? config.weekDays.filter(d => d !== day)
            : [...config.weekDays, day].sort((a, b) => a - b);
        onChange({ ...config, weekDays: newWeekDays });
    };

    const showToast = (message: string) => {
        setToastMessage(message);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000);
    };

    const handleMonthDayClick = (day: number) => {
        // 会议日期不能取消选中
        if (day === meetingDayOfMonth) {
            showToast(s.custom_repeat_cannot_deselect.replace('%s', String(meetingDayOfMonth) + s.date_day_suffix));
            return;
        }

        // 其他日期可以切换
        const isSelected = config.monthDays.includes(day);
        const newMonthDays = isSelected
            ? config.monthDays.filter(d => d !== day)
            : [...config.monthDays, day].sort((a, b) => a - b);
        onChange({ ...config, monthDays: newMonthDays });
    };

    // 生成月份日期网格
    const renderMonthDateGrid = () => {
        const days = Array.from({ length: 31 }, (_, i) => i + 1);
        return (
            <div className="grid grid-cols-7 gap-2 px-4 py-4">
                {days.map(day => {
                    const isSelected = config.monthDays.includes(day);
                    return (
                        <div
                            key={day}
                            className={`h-10 flex items-center justify-center rounded-full text-[16px] ${
                                isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-900'
                            }`}
                            onClick={() => handleMonthDayClick(day)}
                        >
                            {day}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
            <Toast message={toastMessage} visible={toastVisible} />

            {/* Header */}
            <div className="bg-app-surface pt-10 shrink-0 border-b border-gray-100">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={onClose} className="p-1">
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.repeat_custom}</span>
                    <button onClick={onConfirm} className="text-blue-600 text-[15px]">
                        {s.repeat_custom_done}
                    </button>
                </div>
            </div>

            {/* 描述 */}
            <div className="bg-gray-50 px-4 py-3">
                <span className="text-[15px] text-gray-900">{getDescription()}</span>
            </div>

            {/* 频率显示 */}
            <div className="flex items-center justify-between px-4 py-4 bg-app-surface border-b border-gray-100">
                <span className="text-[16px] text-gray-900">{s.repeat_frequency}</span>
                <span className="text-[16px] text-blue-600">{getFrequencyText()}</span>
            </div>

            {/* 滚轮选择器 */}
            <div className="flex px-4 py-2 bg-app-surface border-b border-gray-100">
                <PickerColumn
                    options={numberOptions}
                    value={config.interval}
                    onChange={(v) => onChange({ ...config, interval: v })}
                />
                <PickerColumn
                    options={unitOptions}
                    value={unitToValue(config.unit)}
                    onChange={handleUnitChange}
                />
            </div>

            {/* 周模式：星期选择 */}
            {config.unit === 'week' && (
                <div className="flex-1 overflow-y-auto bg-app-surface">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                        <div
                            key={day}
                            className="flex items-center justify-between px-4 py-4 border-b border-gray-100"
                            onClick={() => toggleWeekDay(day)}
                        >
                            <span className="text-[16px] text-gray-900">{weekdayNames[day]}</span>
                            {config.weekDays.includes(day) && <IcCheck size={20} className="text-blue-600" />}
                        </div>
                    ))}
                </div>
            )}

            {/* 月模式：日期/星期 Tab */}
            {config.unit === 'month' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-app-surface">
                    {/* Tab */}
                    <div className="flex border-b border-gray-100">
                        <button
                            className={`flex-1 py-3 text-[15px] ${
                                config.monthMode === 'date'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500'
                            }`}
                            onClick={() => onChange({ ...config, monthMode: 'date' })}
                        >
                            {s.repeat_tab_date}
                        </button>
                        <button
                            className={`flex-1 py-3 text-[15px] ${
                                config.monthMode === 'weekday'
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-500'
                            }`}
                            onClick={() => onChange({ ...config, monthMode: 'weekday' })}
                        >
                            {s.repeat_tab_weekday}
                        </button>
                    </div>

                    {/* 日期网格 */}
                    {config.monthMode === 'date' && renderMonthDateGrid()}

                    {/* 星期模式 */}
                    {config.monthMode === 'weekday' && (
                        <div className="px-4 py-6 text-center">
                            <span className="text-[17px] text-gray-900">
                                {s.custom_repeat_ordinal_weekday.replace('%s', String(ordinal)).replace('%s', weekdayNames[weekday])}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 结束重复配置
interface EndRepeatConfig {
    mode: 'date' | 'count';
    endDate: number; // 结束日期时间戳
    count: number; // 会议次数
}

// 生成所有会议日期列表（最多生成maxCount场）
const generateMeetingDates = (
    startTime: number,
    repeatType: RepeatType,
    customConfig: CustomRepeatConfig,
    maxCount: number = 100
): number[] => {
    const start = TimeService.fromTimestamp(startTime);
    const startDay = start.getDate();
    const startWeekday = start.getDay();
    const dates: number[] = [];

    // 第一场一定是开始日期
    dates.push(startTime);
    if (dates.length >= maxCount) return dates;

    switch (repeatType) {
        case 'daily': {
            for (let i = 1; i < maxCount; i++) {
                const d = TimeService.fromTimestamp(startTime);
                d.setDate(startDay + i);
                dates.push(d.getTime());
            }
            break;
        }
        case 'workday': {
            const current = TimeService.fromTimestamp(startTime);
            while (dates.length < maxCount) {
                current.setDate(current.getDate() + 1);
                if (current.getDay() !== 0 && current.getDay() !== 6) {
                    dates.push(current.getTime());
                }
            }
            break;
        }
        case 'weekly': {
            for (let i = 1; i < maxCount; i++) {
                const d = TimeService.fromTimestamp(startTime);
                d.setDate(startDay + i * 7);
                dates.push(d.getTime());
            }
            break;
        }
        case 'biweekly': {
            for (let i = 1; i < maxCount; i++) {
                const d = TimeService.fromTimestamp(startTime);
                d.setDate(startDay + i * 14);
                dates.push(d.getTime());
            }
            break;
        }
        case 'monthly': {
            for (let i = 1; i < maxCount; i++) {
                const d = TimeService.fromTimestamp(startTime);
                d.setMonth(start.getMonth() + i);
                dates.push(d.getTime());
            }
            break;
        }
        case 'custom': {
            const { interval, unit, weekDays, monthDays, monthMode } = customConfig;

            if (unit === 'day') {
                for (let i = 1; dates.length < maxCount; i++) {
                    const d = TimeService.fromTimestamp(startTime);
                    d.setDate(startDay + i * interval);
                    dates.push(d.getTime());
                }
            } else if (unit === 'week') {
                // 每N周的特定星期
                const sortedWeekDays = [...weekDays].sort((a, b) => a - b);
                // 第一周期：从开始日期的星期之后的选中星期
                for (const wd of sortedWeekDays) {
                    if (wd > startWeekday && dates.length < maxCount) {
                        const d = TimeService.fromTimestamp(startTime);
                        d.setDate(startDay + (wd - startWeekday));
                        dates.push(d.getTime());
                    }
                }
                // 后续周期
                let cycleIndex = 1;
                while (dates.length < maxCount) {
                    const cycleStartDate = TimeService.fromTimestamp(startTime);
                    // 找到周期开始日期（开始日期所在周的周日 + cycleIndex * interval * 7）
                    const daysToSunday = startWeekday; // 开始日期距离本周日的天数
                    cycleStartDate.setDate(startDay - daysToSunday + cycleIndex * interval * 7);

                    for (const wd of sortedWeekDays) {
                        if (dates.length < maxCount) {
                            const d = TimeService.fromTimestamp(cycleStartDate.getTime());
                            d.setDate(cycleStartDate.getDate() + wd);
                            dates.push(d.getTime());
                        }
                    }
                    cycleIndex++;
                }
            } else {
                // 月模式
                if (monthMode === 'date') {
                    const sortedMonthDays = [...monthDays].sort((a, b) => a - b);
                    // 第一个月：从开始日期之后的选中日期
                    for (const md of sortedMonthDays) {
                        if (md > startDay && dates.length < maxCount) {
                            const d = TimeService.fromTimestamp(startTime);
                            d.setDate(md);
                            dates.push(d.getTime());
                        }
                    }
                    // 后续周期
                    let cycleIndex = 1;
                    while (dates.length < maxCount) {
                        for (const md of sortedMonthDays) {
                            if (dates.length < maxCount) {
                                const d = TimeService.fromTimestamp(startTime);
                                d.setMonth(start.getMonth() + cycleIndex * interval);
                                d.setDate(md);
                                dates.push(d.getTime());
                            }
                        }
                        cycleIndex++;
                    }
                } else {
                    // 星期模式（每月第N个周IcClose）
                    for (let i = 1; dates.length < maxCount; i++) {
                        const d = TimeService.fromTimestamp(startTime);
                        d.setMonth(start.getMonth() + i * interval);
                        dates.push(d.getTime());
                    }
                }
            }
            break;
        }
    }

    return dates.slice(0, maxCount);
};

// 根据重复频率和次数计算结束日期
const calculateEndDate = (
    startTime: number,
    repeatType: RepeatType,
    customConfig: CustomRepeatConfig,
    count: number
): number => {
    const dates = generateMeetingDates(startTime, repeatType, customConfig, count);
    return dates[dates.length - 1] || startTime;
};

// 根据重复频率和结束日期计算次数
const calculateCount = (
    startTime: number,
    repeatType: RepeatType,
    customConfig: CustomRepeatConfig,
    endDateTime: number
): number => {
    // 生成足够多的日期，然后计算在结束日期之前的数量
    const dates = generateMeetingDates(startTime, repeatType, customConfig, 100);
    let count = 0;
    for (const d of dates) {
        if (d <= endDateTime) {
            count++;
        } else {
            break;
        }
    }
    return Math.max(1, count);
};

// 格式化结束重复显示
const formatEndRepeatDisplay = (config: EndRepeatConfig, s: TencentMeetingStrings): string => {
    const date = TimeService.fromTimestamp(typeof config.endDate === 'string' ? TimeService.parseToTimestamp(config.endDate) : config.endDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return s.end_repeat_display
        .replace('%s', String(year))
        .replace('%s', month)
        .replace('%s', day)
        .replace('%s', String(config.count));
};

// 日期选择器底部弹窗
const DatePickerModal: React.FC<{
    value: number;
    onChange: (value: number) => void;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ value, onChange, onClose, onConfirm }) => {
    const s = useTencentMeetingStrings();
    const date = TimeService.fromTimestamp(value);
    const currentYear = TimeService.getDate().getFullYear();

    // 生成年份选项（当前年到+10年）
    const yearOptions = Array.from({ length: 11 }, (_, i) => ({
        value: currentYear + i,
        label: (currentYear + i).toString(),
    }));

    // 生成月份选项
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: (i + 1).toString().padStart(2, '0'),
    }));

    // 生成日期选项
    const dayOptions = Array.from({ length: 31 }, (_, i) => ({
        value: i + 1,
        label: (i + 1).toString().padStart(2, '0'),
    }));

    const handleYearChange = (year: number) => {
        const newDate = TimeService.fromTimestamp(value);
        newDate.setFullYear(year);
        onChange(newDate.getTime());
    };

    const handleMonthChange = (month: number) => {
        const newDate = TimeService.fromTimestamp(value);
        newDate.setMonth(month - 1);
        onChange(newDate.getTime());
    };

    const handleDayChange = (day: number) => {
        const newDate = TimeService.fromTimestamp(value);
        newDate.setDate(day);
        onChange(newDate.getTime());
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="text-[17px] text-gray-900">
                        {s.btn_cancel}
                    </button>
                    <button onClick={onConfirm} className="text-[17px] text-blue-600">
                        {s.btn_confirm}
                    </button>
                </div>

                {/* Picker */}
                <div className="flex px-4 py-2">
                    <PickerColumn options={yearOptions} value={date.getFullYear()} onChange={handleYearChange} />
                    <PickerColumn options={monthOptions} value={date.getMonth() + 1} onChange={handleMonthChange} />
                    <PickerColumn options={dayOptions} value={date.getDate()} onChange={handleDayChange} />
                </div>
            </div>
        </div>
    );
};

// 次数选择器底部弹窗
const CountPickerModal: React.FC<{
    value: number;
    onChange: (value: number) => void;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ value, onChange, onClose, onConfirm }) => {
    const s = useTencentMeetingStrings();

    const handleDecrease = () => {
        if (value > 1) {
            onChange(value - 1);
        }
    };

    const handleIncrease = () => {
        if (value < 50) {
            onChange(value + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
            <div className="relative bg-app-surface rounded-t-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                    <button onClick={onClose} className="text-[17px] text-gray-900">
                        {s.btn_cancel}
                    </button>
                    <button onClick={onConfirm} className="text-[17px] text-blue-600">
                        {s.btn_confirm}
                    </button>
                </div>

                {/* Counter */}
                <div className="flex items-center justify-between px-6 py-6">
                    <span className="text-[16px] text-gray-900">{s.end_repeat_by_count}</span>
                    <div className="flex items-center gap-4">
                        <button
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                value > 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                            }`}
                            onClick={handleDecrease}
                        >
                            <span className="text-xl font-bold">−</span>
                        </button>
                        <span className="text-[20px] font-medium text-gray-900 w-8 text-center">{value}</span>
                        <button
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                value < 50 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                            }`}
                            onClick={handleIncrease}
                        >
                            <span className="text-xl font-bold">+</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 结束重复选择页面
const EndRepeatPicker: React.FC<{
    config: EndRepeatConfig;
    startTime: number;
    repeatType: RepeatType;
    customConfig: CustomRepeatConfig;
    onChange: (config: EndRepeatConfig) => void;
    onClose: () => void;
}> = ({ config, startTime, repeatType, customConfig, onChange, onClose }) => {
    const s = useTencentMeetingStrings();
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showCountPicker, setShowCountPicker] = useState(false);
    const [tempDate, setTempDate] = useState(config.endDate);
    const [tempCount, setTempCount] = useState(config.count);

    const formatDate = (timestamp: number): string => {
        const date = TimeService.fromTimestamp(timestamp);
        return `${date.getFullYear()}${s.date_year_suffix}${(date.getMonth() + 1).toString().padStart(2, '0')}${s.date_month_suffix}${date.getDate().toString().padStart(2, '0')}${s.date_day_suffix}`;
    };

    const handleSelectDateMode = () => {
        if (config.mode !== 'date') {
            // 切换到日期模式，根据当前次数计算结束日期
            const newEndDate = calculateEndDate(startTime, repeatType, customConfig, config.count);
            onChange({ ...config, mode: 'date', endDate: newEndDate });
        }
        setTempDate(config.endDate);
        setShowDatePicker(true);
    };

    const handleSelectCountMode = () => {
        if (config.mode !== 'count') {
            // 切换到次数模式
            onChange({ ...config, mode: 'count' });
        }
        setTempCount(config.count);
        setShowCountPicker(true);
    };

    const handleDateConfirm = () => {
        // 根据选择的日期计算次数
        const newCount = Math.min(50, Math.max(1, calculateCount(startTime, repeatType, customConfig, tempDate)));
        onChange({ ...config, mode: 'date', endDate: tempDate, count: newCount });
        setShowDatePicker(false);
        onClose(); // 返回预定会议页面
    };

    const handleCountConfirm = () => {
        // 根据选择的次数计算结束日期
        const newEndDate = calculateEndDate(startTime, repeatType, customConfig, tempCount);
        onChange({ ...config, mode: 'count', count: tempCount, endDate: newEndDate });
        setShowCountPicker(false);
        onClose(); // 返回预定会议页面
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
            {/* Header */}
            <div className="bg-app-surface pt-10 shrink-0 border-b border-gray-100">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={onClose} className="p-1">
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <span className="text-[17px] font-medium text-gray-900">{s.end_repeat_title}</span>
                    <div className="w-8"></div>
                </div>
            </div>

            {/* Options */}
            <div className="flex-1 overflow-y-auto bg-app-surface">
                {/* 结束于某天 */}
                <div
                    className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                    onClick={handleSelectDateMode}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[16px] text-gray-900">{s.end_repeat_by_date}</span>
                        {config.mode === 'date' && (
                            <span className="text-[16px] text-gray-500">({formatDate(config.endDate)})</span>
                        )}
                    </div>
                    {config.mode === 'date' && <IcCheck size={20} className="text-blue-600" />}
                </div>

                {/* 限定会议次数 */}
                <div
                    className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                    onClick={handleSelectCountMode}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[16px] text-gray-900">{s.end_repeat_by_count}</span>
                        {config.mode === 'count' && (
                            <span className="text-[16px] text-gray-500">({config.count}{s.end_repeat_count_suffix})</span>
                        )}
                    </div>
                    {config.mode === 'count' && <IcCheck size={20} className="text-blue-600" />}
                </div>
            </div>

            {/* 日期选择器 */}
            {showDatePicker && (
                <DatePickerModal
                    value={tempDate}
                    onChange={setTempDate}
                    onClose={() => setShowDatePicker(false)}
                    onConfirm={handleDateConfirm}
                />
            )}

            {/* 次数选择器 */}
            {showCountPicker && (
                <CountPickerModal
                    value={tempCount}
                    onChange={setTempCount}
                    onClose={() => setShowCountPicker(false)}
                    onConfirm={handleCountConfirm}
                />
            )}
        </div>
    );
};

// 金色会员图标
const ProIcon = () => (
    <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] flex items-center justify-center font-bold ml-1">↑</span>
);

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
            {showPro && <ProIcon />}
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
            {showPro && <ProIcon />}
        </div>
        <Switch value={value} onChange={onChange} />
    </div>
);

// 格式化开始时间显示
const formatStartTimeDisplay = (timestamp: number, s: TencentMeetingStrings): string => {
    const date = TimeService.fromTimestamp(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${formatMeetingMonthDay(date, s, { padMonth: true, padDay: true })} ${hours}:${minutes}`;
};

// 格式化时长显示
const formatDurationDisplay = (minutes: number, s: TencentMeetingStrings): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
        return `${hours}${s.picker_suffix_hours}${mins}${s.picker_suffix_minutes}`;
    } else if (hours > 0) {
        return `${hours}${s.picker_suffix_hours}`;
    } else {
        return `${mins}${s.picker_suffix_minutes}`;
    }
};

export const ScheduleRegularMeetingPage: React.FC = () => {
    const { bindBack, bindTap } = useMeetingGestures();
    const user = useMeetingStore(s => s.user);
    const scheduleMeeting = useMeetingStore(s => s.scheduleMeeting);
    const s = useTencentMeetingStrings();

    const [topic, setTopic] = useState(`${user.name}${s.meeting_schedule_title_suffix}`);
    const [autoUseCard, setAutoUseCard] = useState(false);
    const [calendarOn, setCalendarOn] = useState(true);
    const [showMore, setShowMore] = useState(false);

    // 时间设置（默认30分钟后开始，时长30分钟）
    const [startTime, setStartTime] = useState(() => {
        const now = TimeService.getDate();
        // 向上取整到下一个5分钟
        const minutes = Math.ceil((now.getMinutes() + 30) / 5) * 5;
        now.setMinutes(minutes);
        now.setSeconds(0);
        now.setMilliseconds(0);
        return now.getTime();
    });
    const [duration, setDuration] = useState(30);

    // 时区
    const timezoneOptions = useMemo(() => getLocalizedTimezoneList(s), [s]);
    const [timezone, setTimezone] = useState(() => getDefaultMeetingTimezone(s, 'beijing'));
    useEffect(() => {
        setTimezone(prev => localizeMeetingTimezone(prev, s));
    }, [s]);

    // 重复频率
    const [repeatType, setRepeatType] = useState<RepeatType>('none');
    const [customRepeatConfig, setCustomRepeatConfig] = useState<CustomRepeatConfig>(() => {
        const date = TimeService.getDate();
        return {
            interval: 1,
            unit: 'day',
            weekDays: [date.getDay()],
            monthDays: [date.getDate()],
            monthMode: 'date',
        };
    });
    const [tempCustomConfig, setTempCustomConfig] = useState<CustomRepeatConfig>(customRepeatConfig);

    // 结束重复配置（默认7场会议，模式为结束于某天）
    const [endRepeatConfig, setEndRepeatConfig] = useState<EndRepeatConfig>(() => {
        const defaultCount = 7;
        return {
            mode: 'date',
            count: defaultCount,
            endDate: calculateEndDate(TimeService.now(), 'daily', customRepeatConfig, defaultCount),
        };
    });

    // 选择器状态
    const [pickerType, setPickerType] = useState<'none' | 'startTime' | 'duration' | 'endTime' | 'timezone' | 'repeat' | 'customRepeat' | 'endRepeat'>('none');
    const [tempStartTime, setTempStartTime] = useState(startTime);
    const [tempDuration, setTempDuration] = useState(duration);
    const [tempEndTime, setTempEndTime] = useState(startTime + duration * 60000);

    // 基础设置
    const [waitingRoom, setWaitingRoom] = useState(false);
    const [passwordEnabled, setPasswordEnabled] = useState(false);
    const [meetingPassword, setMeetingPassword] = useState('');

    // 生成随机4-6位数字密码
    const generateRandomPassword = () => {
        const length = Math.floor(Math.random() * 3) + 4; // 4-6位
        let password = '';
        for (let i = 0; i < length; i++) {
            password += Math.floor(Math.random() * 10).toString();
        }
        return password;
    };

    // 切换密码开关
    const handlePasswordToggle = (enabled: boolean) => {
        setPasswordEnabled(enabled);
        if (enabled && !meetingPassword) {
            setMeetingPassword(generateRandomPassword());
        }
    };

    // 更多设置 - 第一组
    const [enableSignUp, setEnableSignUp] = useState(false);
    const [allowBeforeHost, setAllowBeforeHost] = useState(true);
    const [allowMultiDevice, setAllowMultiDevice] = useState(true);

    // 更多设置 - 第二组
    const [forbidAddContact, setForbidAddContact] = useState(false);
    const [autoTranscribe, setAutoTranscribe] = useState(false);
    const [allowUploadDoc, setAllowUploadDoc] = useState(true);

    // 参会人
    const [invitees, setInvitees] = useState<{ id: string; name: string; avatar?: string }[]>([]);
    const [showInviteesPicker, setShowInviteesPicker] = useState(false);
    const contacts = useMeetingStore(s => s.contacts);

    // 点击完成时预定会议
    const handleComplete = () => {
        scheduleMeeting({
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
                    <h1 className="text-[17px] font-medium text-gray-900">{s.schedule_regular_title}</h1>
                    <button
                        className="text-blue-600 text-[15px] px-2 py-2"
                        {...bindTap('schedule.complete', { beforeTrigger: handleComplete })}
                    >
                        {s.schedule_regular_complete}
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

                {/* 时间设置 + 提示框（含加时卡） + 时区 + 重复频率 */}
                <div className="mt-3 bg-app-surface">
                    <div onClick={() => {
                        setTempStartTime(startTime);
                        setPickerType('startTime');
                    }}>
                        <Row label={s.schedule_start_time} value={formatStartTimeDisplay(startTime, s)} />
                    </div>
                    <div onClick={() => {
                        setTempDuration(duration);
                        setTempEndTime(startTime + duration * 60000);
                        setPickerType('duration');
                    }}>
                        <Row label={s.schedule_duration} value={formatDurationDisplay(duration, s)} />
                    </div>

                    {/* 浅色提示框（含升级能力和加时卡） */}
                    <div className="mx-4 my-3 px-3 py-3 bg-[#f0f5fa] rounded-lg">
                        <p className="text-[13px] text-gray-600 leading-relaxed">
                            {s.schedule_duration_limit_hint}
                            <span className="text-[#C4993C] font-medium ml-1">{s.schedule_upgrade_hint}</span>
                        </p>
                        {/* 虚线分隔 */}
                        <div className="border-t border-dashed border-gray-300 my-3"></div>
                        {/* 加时卡 */}
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
                        <Row label={s.schedule_repeat} value={formatRepeatDisplay(repeatType, customRepeatConfig, startTime, s)} />
                    </div>

                    {/* 结束重复（仅在有重复频率时显示） */}
                    {repeatType !== 'none' && (
                        <div onClick={() => setPickerType('endRepeat')}>
                            <Row label={s.schedule_end_repeat} value={formatEndRepeatDisplay(endRepeatConfig, s)} />
                        </div>
                    )}
                </div>

                {/* 参会人 - 单独一块 */}
                <div className="mt-3 bg-app-surface" onClick={() => setShowInviteesPicker(true)}>
                    <Row
                        label={s.schedule_invitees}
                        value={inviteesValue}
                    />
                </div>

                {/* 日历、等候室、入会密码 + 更多展开的第一组 */}
                <div className="mt-3 bg-app-surface">
                    <ToggleRow label={s.schedule_calendar} value={calendarOn} onChange={setCalendarOn} />

                    {/* 日历提示（当开启日历且有重复频率时显示） */}
                    {calendarOn && repeatType !== 'none' && (
                        <div className="mx-4 mb-3 px-3 py-2 bg-[#f0f5fa] rounded-lg flex items-start gap-2">
                            <IcInfo size={16} className="text-blue-500 mt-0.5 shrink-0" />
                            <span className="text-[13px] text-gray-600">{s.schedule_calendar_repeat_hint}</span>
                        </div>
                    )}

                    <ToggleRow label={s.schedule_waiting_room} value={waitingRoom} onChange={setWaitingRoom} />
                    <ToggleRow label={s.schedule_password} value={passwordEnabled} onChange={handlePasswordToggle} />

                    {/* 密码输入框 */}
                    {passwordEnabled && (
                        <div className="flex items-center justify-between px-4 py-3">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={meetingPassword}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setMeetingPassword(value);
                                }}
                                placeholder={s.schedule_password_placeholder}
                                className="flex-1 text-[15px] text-gray-900 outline-none placeholder-gray-400"
                            />
                            {meetingPassword && (
                                <button
                                    className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center ml-2"
                                    onClick={() => setMeetingPassword('')}
                                >
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

                {/* 更多展开的第二组 */}
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

                {/* 更多展开的第三组 */}
                {showMore && (
                    <div className="mt-3 mb-6 bg-app-surface">
                        <Row label={s.schedule_virtual_bg} value={s.schedule_virtual_bg_unset} showPro />
                    </div>
                )}

                {/* 更多按钮 - 展开后隐藏 */}
                {!showMore && (
                    <div className="mt-3 bg-app-surface">
                        <div
                            className="flex items-center justify-center py-4 text-blue-600 text-[14px] cursor-pointer"
                            onClick={() => setShowMore(true)}
                        >
                    <span>{s.schedule_more}</span>
                            <IcExpand size={16} className="ml-0.5" />
                </div>
            </div>
                )}
            </div>

            {/* 开始时间选择器 */}
            {pickerType === 'startTime' && (
                <StartTimePicker
                    value={tempStartTime}
                    onChange={setTempStartTime}
                    onClose={() => setPickerType('none')}
                    onConfirm={() => {
                        setStartTime(tempStartTime);
                        setPickerType('none');
                    }}
                />
            )}

            {/* 会议时长选择器 */}
            {pickerType === 'duration' && (
                <DurationPicker
                    startTime={startTime}
                    duration={tempDuration}
                    onChange={setTempDuration}
                    onClose={() => setPickerType('none')}
                    onConfirm={() => {
                        setDuration(tempDuration);
                        setPickerType('none');
                    }}
                    onSwitchToEndTime={() => {
                        setTempEndTime(startTime + tempDuration * 60000);
                        setPickerType('endTime');
                    }}
                />
            )}

            {/* 结束时间选择器 */}
            {pickerType === 'endTime' && (
                <EndTimePicker
                    startTime={startTime}
                    endTime={tempEndTime}
                    onChange={setTempEndTime}
                    onClose={() => setPickerType('none')}
                    onConfirm={() => {
                        // 根据结束时间计算时长
                        const newDuration = Math.max(5, Math.floor((tempEndTime - startTime) / 60000));
                        setDuration(newDuration);
                        setPickerType('none');
                    }}
                    onBack={() => setPickerType('duration')}
                />
            )}

            {/* 时区选择器 */}
            {pickerType === 'timezone' && (
                <TimezonePicker
                    value={timezone}
                    options={timezoneOptions}
                    onSelect={setTimezone}
                    onClose={() => setPickerType('none')}
                />
            )}

            {/* 重复频率选择器 */}
            {pickerType === 'repeat' && (
                <RepeatFrequencyPicker
                    value={repeatType}
                    startTime={startTime}
                    onSelect={(type) => {
                        setRepeatType(type);
                        // 更新结束重复配置
                        if (type !== 'none') {
                            const newEndDate = calculateEndDate(startTime, type, customRepeatConfig, endRepeatConfig.count);
                            setEndRepeatConfig(prev => ({ ...prev, endDate: newEndDate }));
                        }
                    }}
                    onClose={() => setPickerType('none')}
                    onOpenCustom={() => {
                        // 初始化临时配置，设置默认选中值
                        const date = TimeService.fromTimestamp(startTime);
                        setTempCustomConfig({
                            ...customRepeatConfig,
                            weekDays: customRepeatConfig.weekDays.length > 0 ? customRepeatConfig.weekDays : [date.getDay()],
                            monthDays: customRepeatConfig.monthDays.length > 0 ? customRepeatConfig.monthDays : [date.getDate()],
                        });
                        setPickerType('customRepeat');
                    }}
                />
            )}

            {/* 自定义重复频率选择器 */}
            {pickerType === 'customRepeat' && (
                <CustomRepeatPicker
                    config={tempCustomConfig}
                    startTime={startTime}
                    onChange={setTempCustomConfig}
                    onClose={() => setPickerType('repeat')}
                    onConfirm={() => {
                        setCustomRepeatConfig(tempCustomConfig);
                        setRepeatType('custom');
                        // 更新结束重复配置
                        const newEndDate = calculateEndDate(startTime, 'custom', tempCustomConfig, endRepeatConfig.count);
                        setEndRepeatConfig(prev => ({ ...prev, endDate: newEndDate }));
                        setPickerType('none');
                    }}
                />
            )}

            {/* 结束重复选择器 */}
            {pickerType === 'endRepeat' && (
                <EndRepeatPicker
                    config={endRepeatConfig}
                    startTime={startTime}
                    repeatType={repeatType}
                    customConfig={customRepeatConfig}
                    onChange={setEndRepeatConfig}
                    onClose={() => setPickerType('none')}
                />
            )}

            {/* Invitees Picker */}
            {showInviteesPicker && (
                <div className="fixed inset-0 z-50 flex flex-col bg-app-surface">
                    {/* Header */}
                    <div className="bg-app-surface pt-10 shrink-0 border-b border-gray-100">
                        <div className="flex items-center justify-between px-4 py-3">
                            <button onClick={() => setShowInviteesPicker(false)} className="text-[17px] text-gray-900">
                                {s.btn_cancel}
                            </button>
                            <span className="text-[17px] font-medium text-gray-900">{s.schedule_select_invitees}</span>
                            <button
                                onClick={() => setShowInviteesPicker(false)}
                                className="text-[17px] text-blue-600 font-medium"
                            >
                                {s.btn_confirm}({invitees.length})
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {contacts.map(contact => {
                            const isSelected = invitees.some(i => i.id === contact.id);
                            return (
                                <div
                                    key={contact.id}
                                    className="flex items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                                    onClick={() => {
                                        if (isSelected) {
                                            setInvitees(prev => prev.filter(i => i.id !== contact.id));
                                        } else {
                                            setInvitees(prev => [...prev, contact]);
                                        }
                                    }}
                                >
                                    <div className={`w-5 h-5 rounded-full border mr-3 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                        {isSelected && <IcCheck size={14} className="text-white" />}
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm mr-3">
                                        {contact.avatar ? (
                                            <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            contact.name.slice(0, 2)
                                        )}
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
