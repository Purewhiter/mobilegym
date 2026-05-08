import React from 'react';
import { CalendarGrid } from '../components/CalendarGrid';
import { CalendarBottomNav, CalendarViewType } from '../components/CalendarBottomNav';
import { AgendaPanel } from '../components/AgendaPanel';
import { CalendarYearView } from '../components/CalendarYearView';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { CalendarDayView } from '../components/CalendarDayView';
import { buildEventDateKeySet, generateMonthDays, getLunarFullInfo, getLunarInfo } from '../utils/calendarUtils';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';
import { MaskIcon } from '../components/MaskIcon';
import { CalendarActionSheet } from '../components/CalendarActionSheet';
import { Toast } from '@/os/components/Toast';
import { useCalendarStore, selectSelectedDate } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
import { getHyperosSymbolUrl, IcSymbolImport, IcSymbolMonths, IcSymbolTheme, IcSymbolTune } from '../res/icons';

const WEEK_LABELS_MON = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_LABELS_SUN = ['日', '一', '二', '三', '四', '五', '六'];

const formatHHmm = (ts: number) => {
    const d = TimeService.fromTimestamp(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const CalendarHomePage: React.FC = () => {
    const { go } = useCalendarGestures();
    const selectedDate = useCalendarStore(selectSelectedDate);
    const setSelectedDate = useCalendarStore(s => s.setSelectedDate);
    const settings = useCalendarStore(s => s.settings);
    const calendarEvents = useCalendarStore(s => s.events);
    const s = useAppStrings(strings, stringsEn);

    const [activeView, setActiveView] = React.useState<CalendarViewType>('month');
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [toast, setToast] = React.useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const viewYear = selectedDate.getFullYear();
    const viewMonth = selectedDate.getMonth();
    const weekStartDay = settings.weekStartDay === 'sunday' ? 'sunday' : 'monday';

    const days = React.useMemo(
        () => generateMonthDays(viewYear, viewMonth, weekStartDay),
        [viewYear, viewMonth, weekStartDay],
    );
    const eventDateKeys = React.useMemo(() => buildEventDateKeySet(calendarEvents), [calendarEvents]);

    const lunarFull = getLunarFullInfo(selectedDate);
    const lunarCell = getLunarInfo(selectedDate);

    const dayEvents = React.useMemo(() => {
        const dayStart = TimeService.fromTimestamp(selectedDate.getTime()); dayStart.setHours(0, 0, 0, 0);
        const dayStartTs = dayStart.getTime();
        const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;
        return calendarEvents
            .filter(e => e.startTs < dayEndTs && e.endTs > dayStartTs)
            .sort((a, b) => a.startTs - b.startTs);
    }, [calendarEvents, selectedDate]);

    const agendaItems = React.useMemo(() => {
        const items: Array<{ id?: string; title: string; subtitle: string; daysLeft?: string; isHoliday?: boolean; onClick?: () => void }> = [];

        // Festival / solar term / holiday highlight
        if ((lunarCell.isFestival || lunarCell.isSolarTerm || lunarCell.isHoliday) && lunarCell.isSpecial) {
            items.push({
                id: 'special',
                title: lunarCell.label,
                subtitle: lunarFull.title,
                isHoliday: lunarCell.isHoliday,
            });
        }

        for (const e of dayEvents) {
            items.push({
                id: e.id,
                title: e.title,
                subtitle: e.allDay ? s.label_all_day_value : formatHHmm(e.startTs),
                onClick: () => go('event.open', { eventId: e.id }),
            });
        }

        if (items.length === 0) {
            items.push({
                id: 'empty',
                title: s.empty_agenda,
                subtitle: s.empty_agenda_hint,
                onClick: () => go('new-event.open'),
            });
        }

        return items;
    }, [dayEvents, go, lunarCell.isFestival, lunarCell.isHoliday, lunarCell.isSolarTerm, lunarCell.isSpecial, lunarCell.label, lunarFull.title, s.empty_agenda, s.empty_agenda_hint, s.label_all_day_value]);

    const weekLabels = weekStartDay === 'sunday' ? WEEK_LABELS_SUN : WEEK_LABELS_MON;

    const monthSwipeRef = React.useRef<{ x: number; y: number } | null>(null);

    const shiftMonthBy = React.useCallback(
        (delta: number) => {
            const d = TimeService.fromTimestamp(selectedDate.getTime());
            const day = d.getDate();
            d.setDate(1);
            d.setMonth(d.getMonth() + delta);
            const last = TimeService.fromLocalParts(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            d.setDate(Math.min(day, last));
            setSelectedDate(d);
        },
        [selectedDate, setSelectedDate],
    );

    const onMonthSwipePointerDown = (e: React.PointerEvent) => {
        monthSwipeRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMonthSwipePointerUp = (e: React.PointerEvent) => {
        const start = monthSwipeRef.current;
        monthSwipeRef.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const minDist = 48;
        if (Math.abs(dx) < minDist) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.2) return;
        if (dx < 0) shiftMonthBy(1);
        else shiftMonthBy(-1);
    };

    const onMonthSwipePointerCancel = () => {
        monthSwipeRef.current = null;
    };

    const renderTitle = () => {
        if (activeView === 'year') return `${viewYear}`;
        if (activeView === 'day') return `${viewMonth + 1}月${selectedDate.getDate()}日`;
        return `${viewMonth + 1}月`;
    };

    const renderContent = () => {
        switch (activeView) {
            case 'year':
                return (
                    <CalendarYearView
                        year={viewYear}
                        selectedDate={selectedDate}
                        weekStartDay={weekStartDay}
                        onMonthClick={(monthIndex) => {
                            const d = TimeService.fromTimestamp(selectedDate.getTime());
                            d.setMonth(monthIndex, 1);
                            setSelectedDate(d);
                            setActiveView('month');
                        }}
                    />
                );

            case 'week':
                return (
                    <CalendarWeekView
                        currentDate={selectedDate}
                        onDayClick={(d) => setSelectedDate(d)}
                        weekStartDay={weekStartDay}
                    />
                );

            case 'day':
                return <CalendarDayView date={selectedDate} agendaItems={agendaItems} />;

            case 'month':
            default:
                return (
                    <div className="flex flex-col h-full">
                        {/* 月视图：左右滑动切换月份（左滑下一月，右滑上一月） */}
                        <div
                            className="shrink-0 select-none"
                            style={{ touchAction: 'none' }}
                            onPointerDown={onMonthSwipePointerDown}
                            onPointerUp={onMonthSwipePointerUp}
                            onPointerCancel={onMonthSwipePointerCancel}
                        >
                            {/* Weekday labels row */}
                            <div
                                className="grid px-3 py-2"
                                style={{ gridTemplateColumns: settings.showWeekNumber ? '28px repeat(7, 1fr)' : 'repeat(7, 1fr)' }}
                            >
                                {settings.showWeekNumber && <div />}
                                {weekLabels.map((w) => (
                                    <div key={w} className="text-center text-sm text-app-text-muted">{w}</div>
                                ))}
                            </div>

                            {/* Date grid */}
                            <div className="shrink-0 px-1">
                                <CalendarGrid
                                    days={days}
                                    selectedDate={selectedDate}
                                    onDayClick={(day) => setSelectedDate(day.date)}
                                    showExtendMonth={settings.showExtendMonth}
                                    showWeekNumber={settings.showWeekNumber}
                                    eventDateKeys={eventDateKeys}
                                />
                            </div>
                        </div>

                        {/* Agenda bottom sheet */}
                        <AgendaPanel
                            lunarTitle={lunarFull.title}
                            lunarSubtitle={lunarFull.subtitle}
                            items={agendaItems}
                        />
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col h-full bg-app-surface dark:bg-black overflow-hidden">
            <Toast message={toast.message} visible={toast.visible} />

            {/* ========== Shared top header ========== */}
            <div className="flex items-center justify-between px-5 pt-10 pb-2 bg-app-surface dark:bg-black shrink-0">
                {/* Left */}
                <button
                    className="flex flex-col items-start"
                    onClick={() => setActiveView(activeView === 'year' ? 'month' : 'year')}
                >
                    <div className="text-3xl font-light text-black dark:text-white">{renderTitle()}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                        {lunarFull.title} · {lunarFull.subtitle}
                    </div>
                </button>

                {/* Right actions */}
                <div className="flex items-center gap-4 text-gray-700 dark:text-gray-200">
                    <button
                        onClick={() => go('search.open')}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5"
                        aria-label="搜索日程"
                    >
                        <MaskIcon src={calIcon('miuix_action_icon_search_light')} size={22} />
                    </button>
                    <button
                        onClick={() => go('new-event.open')}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5"
                        aria-label="新建"
                    >
                        <MaskIcon src={calIcon('action_bar_new_event_desk_view')} size={22} />
                    </button>
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5"
                        aria-label="更多"
                    >
                        <MaskIcon src={calIcon('miuix_action_icon_immersion_more_dark')} size={22} />
                    </button>
                </div>
            </div>

            <CalendarActionSheet
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                items={[
                    {
                        id: 'date-jump',
                        title: s.action_date_jump,
                        icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolMonths, '2')} size={20} />,
                        onClick: () => go('date-jump.open'),
                    },
                    {
                        id: 'date-calculate',
                        title: s.action_date_calculate,
                        icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolTune, '2')} size={20} />,
                        onClick: () => go('date-calculate.open'),
                    },
                    {
                        id: 'subscription',
                        title: s.action_subscription,
                        icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolImport, '2')} size={20} />,
                        onClick: () => go('subscription.open'),
                    },
                    {
                        id: 'desk-theme',
                        title: s.action_desk_theme,
                        icon: <MaskIcon src={getHyperosSymbolUrl(IcSymbolTheme, '2')} size={20} />,
                        onClick: () => go('desk-theme.open'),
                    },
                    {
                        id: 'share',
                        title: s.action_share,
                        icon: <MaskIcon src={calIcon('miuix_action_icon_share_light')} size={20} />,
                        onClick: () => showToast(s.home_share_toast),
                    },
                    {
                        id: 'settings',
                        title: s.action_settings,
                        icon: <MaskIcon src={calIcon('miuix_action_icon_settings_light')} size={20} />,
                        onClick: () => go('settings.open'),
                    },
                ]}
            />

            {/* ========== Main content ========== */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {renderContent()}
            </div>

            {/* ========== Bottom nav ========== */}
            <CalendarBottomNav
                activeView={activeView}
                onViewChange={setActiveView}
                dayNumber={selectedDate.getDate()}
            />
        </div>
    );
};

export default CalendarHomePage;
