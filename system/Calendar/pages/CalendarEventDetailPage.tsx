import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MaskIcon } from '../components/MaskIcon';
import { useCalendarStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

const formatRangeCN = (startTs: number, endTs: number, allDay: boolean, allDayLabel: string) => {
  const s = TimeService.fromTimestamp(startTs);
  const e = TimeService.fromTimestamp(endTs);
  const y = s.getFullYear();
  const m = s.getMonth() + 1;
  const d = s.getDate();
  const hh = String(s.getHours()).padStart(2, '0');
  const mm = String(s.getMinutes()).padStart(2, '0');
  const eh = String(e.getHours()).padStart(2, '0');
  const em = String(e.getMinutes()).padStart(2, '0');
  if (allDay) return `${y}年${m}月${d}日 ${allDayLabel}`;
  return `${y}年${m}月${d}日 ${hh}:${mm} - ${eh}:${em}`;
};

export const CalendarEventDetailPage: React.FC = () => {
  const { back, bindBack, bindTap } = useCalendarGestures();
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const showDeleteConfirm = searchParams.get('deleteConfirm') === 'open';
  const calendarEvents = useCalendarStore(s => s.events);
  const deleteEvent = useCalendarStore(s => s.deleteEvent);
  const s = useAppStrings(strings, stringsEn);

  const formatReminderLabel = (minutesBefore: number | null | undefined): string => {
    if (minutesBefore === undefined) return '';
    if (minutesBefore === null) return s.remind_none;
    if (minutesBefore === 0) return s.label_at_start;
    if (minutesBefore === 60) return s.remind_1_hour_before;
    if (minutesBefore === 24 * 60) return s.remind_1_day_before;
    return `${s.remind_before_prefix}${minutesBefore}${s.remind_before_suffix_min}`;
  };

  const event = eventId ? calendarEvents.find(e => e.id === eventId) : undefined;

  if (!event) {
    return (
      <div className="flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
        <div className="flex items-center px-4 py-3 shrink-0">
          <button
            {...bindBack()}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
          >
            <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
          </button>
          <h1 className="ml-2 text-[17px] font-medium">{s.event_detail}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{s.event_not_found}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app-bg dark:bg-black text-black dark:text-white">
      {/* Top close */}
      <div className="pt-10 px-4 pb-2 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
          aria-label="关闭"
        >
          <MaskIcon src={calIcon('miuix_action_icon_immersion_close_light')} size={22} />
        </button>
      </div>

      {/* Card */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="bg-app-surface dark:bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10">
          <div className="px-5 pt-5 pb-4">
            <div className="text-[20px] font-semibold text-app-text dark:text-gray-100">{event.title}</div>
            <div className="text-[13px] text-gray-400 mt-1">
              {formatRangeCN(event.startTs, event.endTs, event.allDay, s.label_all_day_value)}
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />

          <div className="px-5 py-4">
            <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.label_calendar_account}</div>
            <div className="text-[15px] text-app-text dark:text-gray-100 mt-1">
              {event.calendarAccount ?? s.default_account}
            </div>
          </div>

          {(event.reminderMinutesBefore !== undefined || event.alarmEnabled) && (
            <>
              <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />
              <div className="px-5 py-4">
                <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.label_reminder}</div>
                <div className="text-[15px] text-app-text dark:text-gray-100 mt-1">
                  {formatReminderLabel(event.reminderMinutesBefore) || s.label_at_start}
                  {event.alarmEnabled ? s.detail_alarm_suffix : ''}
                </div>
              </div>
            </>
          )}

          {event.description && (
            <>
              <div className="h-px bg-gray-100 dark:bg-white/10 mx-5" />
              <div className="px-5 py-4">
                <div className="text-[13px] text-app-text-muted dark:text-gray-400">{s.detail_notes_label}</div>
                <div className="text-[15px] text-app-text dark:text-gray-100 mt-1 whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating buttons */}
      <div className="absolute left-0 right-0 bottom-0 pb-safe">
        <div className="flex justify-center gap-4 px-6 pb-6">
          <button
            {...bindTap('event.edit', { params: { eventId: event.id } })}
            className="w-14 h-14 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 shadow-lg flex items-center justify-center text-gray-800 dark:text-gray-100 active:scale-95 transition-transform"
            aria-label="编辑"
          >
            <MaskIcon src={calIcon('miuix_action_icon_edit_light')} size={22} />
          </button>
          <button
            onClick={() => setSearchParams(p => { p.set('deleteConfirm', 'open'); return p; })}
            className="w-14 h-14 rounded-full bg-white/95 dark:bg-[#1c1c1e]/95 shadow-lg flex items-center justify-center text-red-600 active:scale-95 transition-transform"
            aria-label="删除"
          >
            <MaskIcon src={calIcon('miuix_action_icon_delete_light')} size={22} />
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl w-[270px] overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="text-[16px] font-semibold text-black dark:text-white">{s.confirm_delete_event}</div>
            </div>
            <div className="h-px bg-gray-200 dark:bg-white/10" />
            <div className="flex">
              <button
                onClick={() => back()}
                className="flex-1 py-3 text-[16px] text-blue-500 active:bg-gray-100 dark:active:bg-white/5"
              >
                {s.cancel}
              </button>
              <div className="w-px bg-gray-200 dark:bg-white/10" />
              <button
                onClick={() => {
                  deleteEvent(event.id);
                  back(); // close dialog
                  setTimeout(() => back(), 50); // go back to previous page
                }}
                className="flex-1 py-3 text-[16px] text-red-500 font-semibold active:bg-gray-100 dark:active:bg-white/5"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
