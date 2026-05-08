import React, { useState } from 'react';
import { IcNavForward } from '../res/icons';
import { useCalendarStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { Toast } from '@/os/components/Toast';
import { MaskIcon } from '../components/MaskIcon';
import { CalendarActionSheet } from '../components/CalendarActionSheet';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

/* ---- Local simple components (no SettingsContext dependency) ---- */
const Section: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-3">
        {title && <div className="px-4 pt-4 pb-1.5 text-[13px] text-app-text-muted">{title}</div>}
        <div className="bg-app-surface dark:bg-[#2c2c2e] rounded-2xl overflow-hidden mx-4">
            {children}
        </div>
    </div>
);

const Item: React.FC<{ title: string; value?: string; onClick?: () => void; showDivider?: boolean }> = ({ title, value, onClick, showDivider = true }) => (
    <div>
        <div className="flex items-center px-4 py-3.5 min-h-[52px]" onClick={onClick}>
            <span className="flex-1 text-[15px] text-app-text dark:text-gray-100">{title}</span>
            <div className="flex items-center gap-1 shrink-0">
                {value && <span className="text-[13px] text-gray-400">{value}</span>}
                <IcNavForward size={16} className="text-gray-300" />
            </div>
        </div>
        {showDivider && <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />}
    </div>
);

const SwitchItem: React.FC<{ title: string; checked: boolean; onChange: (v: boolean) => void; showDivider?: boolean }> = ({ title, checked, onChange, showDivider = true }) => {
    return (
        <div>
            <div className="flex items-center px-4 py-3.5 min-h-[52px]" onClick={() => onChange(!checked)}>
                <span className="flex-1 text-[15px] text-app-text dark:text-gray-100">{title}</span>
                <div
                    className={`w-[44px] h-[26px] rounded-full flex items-center p-[2px] shrink-0
                        ${checked ? 'bg-[#3482FF] justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}
                    style={{ transition: 'background-color var(--app-duration-short) var(--app-easing-standard)' }}
                >
                    <div className="w-[22px] h-[22px] bg-app-surface rounded-full shadow-sm" />
                </div>
            </div>
            {showDivider && <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />}
        </div>
    );
};

/* ---- Page ---- */

const CalendarSettingsPage: React.FC = () => {
    const { bindBack } = useCalendarGestures();
    const { settings, updateSettings } = useCalendarStore(useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings })));
    const s = useAppStrings(strings, stringsEn);
    const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
    const [reminderOpen, setReminderOpen] = useState(false);
    const [allDayReminderOpen, setAllDayReminderOpen] = useState(false);
    const [laterReminderOpen, setLaterReminderOpen] = useState(false);

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const weekStartLabel = settings.weekStartDay === 'sunday' ? s.week_start_sunday : s.week_start_monday;
    const defaultReminderLabel =
        settings.defaultReminder === '0_minutes_before'
            ? s.label_at_start
            : settings.defaultReminder === '5_minutes_before'
              ? s.settings_reminder_val_5_min
              : settings.defaultReminder === '15_minutes_before'
                ? s.settings_reminder_val_15_min
                : settings.defaultReminder === '30_minutes_before'
                  ? s.settings_reminder_val_30_min
                  : settings.defaultReminder === '60_minutes_before'
                    ? s.settings_reminder_val_1_hour
                    : settings.defaultReminder === '1_day_before'
                      ? s.settings_reminder_val_1_day
                      : s.settings_reminder_val_15_min;
    const defaultAllDayReminderLabel =
        settings.defaultAllDayReminder === 'start_of_day'
            ? s.settings_allday_0
            : settings.defaultAllDayReminder === '9_am_on_day'
              ? s.settings_allday_9
              : settings.defaultAllDayReminder === '9_am_day_before'
                ? s.settings_allday_prev_9
                : s.settings_allday_9;
    const defaultLaterReminderLabel =
        settings.defaultReminderLaterTime === '5_minutes'
            ? s.settings_later_5_min
            : settings.defaultReminderLaterTime === '10_minutes'
              ? s.settings_later_10_min
              : settings.defaultReminderLaterTime === '30_minutes'
                ? s.settings_later_30_min
                : settings.defaultReminderLaterTime === '60_minutes'
                  ? s.settings_later_1_hour
                  : s.settings_later_10_min;

    return (
        <div className="flex flex-col h-full bg-app-bg dark:bg-[#111] text-black dark:text-white pt-10">
            <Toast message={toast.message} visible={toast.visible} />
            <CalendarActionSheet
                open={reminderOpen}
                title={s.settings_default_reminder}
                onClose={() => setReminderOpen(false)}
                items={[
                    { id: '0', title: s.label_at_start, onClick: () => updateSettings({ defaultReminder: '0_minutes_before' }) },
                    { id: '5', title: s.settings_reminder_val_5_min, onClick: () => updateSettings({ defaultReminder: '5_minutes_before' }) },
                    { id: '15', title: s.settings_reminder_val_15_min, onClick: () => updateSettings({ defaultReminder: '15_minutes_before' }) },
                    { id: '30', title: s.settings_reminder_val_30_min, onClick: () => updateSettings({ defaultReminder: '30_minutes_before' }) },
                    { id: '60', title: s.settings_reminder_val_1_hour, onClick: () => updateSettings({ defaultReminder: '60_minutes_before' }) },
                    { id: '1440', title: s.settings_reminder_val_1_day, onClick: () => updateSettings({ defaultReminder: '1_day_before' }) },
                ]}
            />
            <CalendarActionSheet
                open={allDayReminderOpen}
                title={s.settings_default_allday_reminder}
                onClose={() => setAllDayReminderOpen(false)}
                items={[
                    { id: '0', title: s.settings_allday_0, onClick: () => updateSettings({ defaultAllDayReminder: 'start_of_day' }) },
                    { id: '9', title: s.settings_allday_9, onClick: () => updateSettings({ defaultAllDayReminder: '9_am_on_day' }) },
                    { id: '-1_9', title: s.settings_allday_prev_9, onClick: () => updateSettings({ defaultAllDayReminder: '9_am_day_before' }) },
                ]}
            />
            <CalendarActionSheet
                open={laterReminderOpen}
                title={s.settings_default_later_reminder}
                onClose={() => setLaterReminderOpen(false)}
                items={[
                    { id: '5', title: s.settings_later_5_min, onClick: () => updateSettings({ defaultReminderLaterTime: '5_minutes' }) },
                    { id: '10', title: s.settings_later_10_min, onClick: () => updateSettings({ defaultReminderLaterTime: '10_minutes' }) },
                    { id: '30', title: s.settings_later_30_min, onClick: () => updateSettings({ defaultReminderLaterTime: '30_minutes' }) },
                    { id: '60', title: s.settings_later_1_hour, onClick: () => updateSettings({ defaultReminderLaterTime: '60_minutes' }) },
                ]}
            />
            {/* Header */}
            <div className="flex items-center px-4 py-3 bg-app-surface dark:bg-[#1c1c1e] border-b border-app-border dark:border-white/10 shrink-0">
                <button
                    {...bindBack()}
                    className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <span className="text-gray-700 dark:text-gray-200">
                        <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
                    </span>
                </button>
                <h1 className="ml-2 text-xl font-medium">{s.settings}</h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                <Section>
                    <Item title={s.settings_import} onClick={() => showToast('暂未实现：日程导入')} />
                    <Item title={s.settings_account_manage} onClick={() => showToast('暂未实现：日程账号管理')} showDivider={false} />
                </Section>

                <Section title={s.settings_section_calendar}>
                    <Item
                        title={s.settings_week_start}
                        value={weekStartLabel}
                        onClick={() =>
                            updateSettings({
                                weekStartDay: settings.weekStartDay === 'sunday' ? 'monday' : 'sunday',
                            })
                        }
                    />
                    <SwitchItem
                        title={s.settings_show_extend_month}
                        checked={settings.showExtendMonth}
                        onChange={(v) => updateSettings({ showExtendMonth: v })}
                    />
                    <SwitchItem
                        title={s.settings_show_week_number}
                        checked={settings.showWeekNumber}
                        onChange={(v) => updateSettings({ showWeekNumber: v })}
                        showDivider={false}
                    />
                </Section>

                <Section title={s.settings_section_features}>
                    <Item title={s.settings_horoscope} onClick={() => showToast('暂未实现：星座运势')} />
                    <SwitchItem
                        title={s.settings_almanac}
                        checked={settings.showAlmanacYiJi}
                        onChange={(v) => updateSettings({ showAlmanacYiJi: v })}
                    />
                    <Item title={s.settings_global_holidays} onClick={() => showToast('暂未实现：全球节日')} />
                    <Item title={s.settings_other_calendars} onClick={() => showToast('暂未实现：其他历法')} />
                    <SwitchItem
                        title={s.settings_smart_extract}
                        checked={settings.autoInsertAiEvent}
                        onChange={(v) => updateSettings({ autoInsertAiEvent: v })}
                        showDivider={false}
                    />
                </Section>

                <Section title={s.settings_section_reminder}>
                    <Item title={s.settings_reminder} onClick={() => showToast('暂未实现：日程提醒设置')} />
                    <Item title={s.settings_default_reminder} value={defaultReminderLabel} onClick={() => setReminderOpen(true)} />
                    <Item title={s.settings_default_allday_reminder} value={defaultAllDayReminderLabel} onClick={() => setAllDayReminderOpen(true)} />
                    <Item title={s.settings_default_later_reminder} value={defaultLaterReminderLabel} onClick={() => setLaterReminderOpen(true)} />
                    <SwitchItem
                        title={s.settings_holiday_reminder}
                        checked={settings.holidayReminder}
                        onChange={(v) => updateSettings({ holidayReminder: v })}
                        showDivider={false}
                    />
                </Section>

                <Section title={s.settings_section_other}>
                    <SwitchItem
                        title={s.settings_show_rejected}
                        checked={settings.showRejectAgenda}
                        onChange={(v) => updateSettings({ showRejectAgenda: v })}
                    />
                    <SwitchItem
                        title={s.settings_auto_import_birthday}
                        checked={settings.autoImportBirthday}
                        onChange={(v) => updateSettings({ autoImportBirthday: v })}
                    />
                    <Item title={s.settings_holiday_data} onClick={() => showToast('暂未实现：节假日数据更新')} />
                    <Item title={s.settings_timezone} onClick={() => showToast('暂未实现：日程时区设置')} />
                    <Item title={s.settings_ux_plan} onClick={() => showToast('暂未实现：用户体验计划')} />
                    <Item title={s.settings_privacy} onClick={() => showToast('暂未实现：隐私与权限')} />
                    <Item title={s.settings_about} onClick={() => showToast('暂未实现：关于日历')} showDivider={false} />
                </Section>
            </div>
        </div>
    );
};

export default CalendarSettingsPage;
