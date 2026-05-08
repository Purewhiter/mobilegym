import React from 'react';
import { useCalendarStore } from '../state';
import { MaskIcon } from '../components/MaskIcon';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useCalendarGestures } from '../hooks/useCalendarGestures';
import * as TimeService from '@/os/TimeService';
import { getHyperosSymbolUrl, IcSymbolClear } from '../res/icons';
const calIcon = (name: string) => name ? `/@app-assets/Calendar/icons/${name}.svg` : '';

const formatDateTimeCN = (ts: number, allDay: boolean, allDayLabel: string) => {
  const d = TimeService.fromTimestamp(ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return allDay ? `${y}年${m}月${day}日 ${allDayLabel}` : `${y}年${m}月${day}日 ${hh}:${mm}`;
};

export const CalendarSearchPage: React.FC = () => {
  const { bindBack, bindTap } = useCalendarGestures();
  const events = useCalendarStore(s => s.events);
  const s = useAppStrings(strings, stringsEn);

  const [q, setQ] = React.useState('');
  const query = q.trim();

  const results = React.useMemo(() => {
    if (!query) return [];
    const lower = query.toLowerCase();
    return events
      .filter((e) => e.title.toLowerCase().includes(lower) || (e.description ?? '').toLowerCase().includes(lower))
      .sort((a, b) => b.startTs - a.startTs);
  }, [events, query]);

  return (
    <div className="flex flex-col h-full bg-app-surface dark:bg-black text-black dark:text-white pt-10">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0">
        <button
          {...bindBack()}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 dark:active:bg-white/5 text-gray-700 dark:text-gray-200"
        >
          <MaskIcon src={calIcon('miuix_action_icon_back_light')} size={22} />
        </button>

        <div className="flex-1 flex items-center gap-2 bg-app-bg dark:bg-[#1c1c1e] rounded-full px-4 py-2">
          <div className="text-app-text-muted dark:text-gray-400">
            <MaskIcon src={calIcon('miuix_action_icon_search_light')} size={18} />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={s.search}
            className="flex-1 bg-transparent outline-none text-[15px] text-app-text dark:text-gray-100 placeholder:text-gray-400"
          />
          {!!q && (
            <button
              onClick={() => setQ('')}
              className="text-gray-400 active:opacity-70"
              aria-label="清除"
            >
              <MaskIcon src={getHyperosSymbolUrl(IcSymbolClear, '2')} size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {!query ? (
          <div className="text-sm text-gray-400 mt-10 text-center">{s.search_hint}</div>
        ) : results.length === 0 ? (
          <div className="text-sm text-gray-400 mt-10 text-center">{s.search_no_results}</div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {results.map((e) => (
              <button
                key={e.id}
                {...bindTap('event.open', { params: { eventId: e.id } })}
                className="w-full text-left bg-app-surface dark:bg-[#1c1c1e] rounded-2xl px-4 py-3 border border-gray-100 dark:border-white/10 active:bg-black/5 dark:active:bg-white/5"
              >
                <div className="text-[16px] text-app-text dark:text-gray-100 truncate">{e.title}</div>
                <div className="text-[12px] text-gray-400 mt-1 truncate">{formatDateTimeCN(e.startTs, e.allDay, s.label_all_day_value)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
