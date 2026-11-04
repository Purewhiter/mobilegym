import React, { useRef, useState } from 'react';
import type { Alarm } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useClockGestures } from '../hooks/useClockGestures';
import { CollapsingToolbar, CollapsingLargeTitle, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '../../../os/components/CollapsingToolbar';
import { IcAlarm, IcClose, IcCheck, IcList, IcMoreVert, IcAdd } from '../res/icons';
import { Switch } from '../components/Switch';
import { formatAlarmTime, getRepeatLabel, getNextAlarmText } from '../utils';

const AlarmItem: React.FC<{
  alarm: Alarm;
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelectToggle: () => void;
  onSelectionStart: () => void;
  editBind?: React.HTMLAttributes<HTMLElement>;
}> = ({ alarm, selectionMode, selected, onToggle, onSelectToggle, onSelectionStart, editBind }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindLongPress, bindTap } = useClockGestures();
  // The click that ends a long press is swallowed: by then select mode is on and the row would
  // otherwise unselect the alarm it just selected.
  const longPressed = useRef(false);

  return (
    <div
      className={`bg-app-surface rounded-2xl px-4 py-4 flex items-center justify-between ${selectionMode && selected ? 'bg-blue-50' : ''}`}
      {...(selectionMode
        ? bindTap({ kind: 'action', id: 'clock.alarm.select.toggle' }, { params: { alarmId: alarm.id }, onTrigger: onSelectToggle })
        : bindLongPress('nav.alarm', {
          params: { mode: 'select' },
          duration: 450,
          onTrigger: () => { longPressed.current = true; onSelectionStart(); },
        }))}
      onPointerDownCapture={() => { longPressed.current = false; }}
      onClickCapture={(e) => {
        if (!longPressed.current) return;
        longPressed.current = false;
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="flex flex-col text-left flex-1 min-w-0"
        {...(selectionMode ? {} : editBind)}
      >
        <span className="text-[26px] font-medium text-black">{formatAlarmTime(alarm.hour, alarm.minute)}</span>
        <span className="text-[15px] text-gray-400">
          {getRepeatLabel(alarm.repeat, s)}
          {alarm.note ? `｜${alarm.note}` : ''}
        </span>
      </button>
      {selectionMode ? (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-app-primary text-white' : 'border border-gray-300 text-transparent'}`}>
          <IcCheck size={16} />
        </div>
      ) : (
        <div onClick={e => e.stopPropagation()}>
          <Switch
            value={alarm.enabled}
            bind={bindTap({ kind: 'action', id: 'clock.alarm.enabled.toggle' }, { params: { alarmId: alarm.id }, onTrigger: onToggle })}
          />
        </div>
      )}
    </div>
  );
};

export const AlarmPage: React.FC<{
  alarms: Alarm[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  addBind: React.HTMLAttributes<HTMLElement>;
  editBind: (alarm: Alarm) => React.HTMLAttributes<HTMLElement>;
  onSelectToggle: (id: string) => void;
  onSelectionStart: (id: string) => void;
  onToggleSelectAll: () => void;
}> = ({
  alarms,
  selectionMode,
  selectedIds,
  onToggle,
  addBind,
  editBind,
  onSelectToggle,
  onSelectionStart,
  onToggleSelectAll,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap } = useClockGestures();
  const [scrollTop, setScrollTop] = useState(0);
  const hasAlarms = alarms.length > 0;
  const allOff = hasAlarms && alarms.every(alarm => !alarm.enabled);
  const nextAlarmText = allOff ? s.alarm_all_off : getNextAlarmText(alarms, s.alarm_no_alarms, s.alarm_rings_in_hours_infix, s.alarm_rings_in_minutes_suffix);
  const isAllSelected = hasAlarms && selectedIds.size === alarms.length;

  const displayTitle = selectionMode ? `${s.selected_count_prefix}${selectedIds.size}${s.selected_count_suffix}` : s.alarm_tab;

  return (
    <div className="h-full w-full bg-app-bg relative flex flex-col">
      <CollapsingToolbar
        title={displayTitle}
        scrollTop={scrollTop}
        alwaysShowSmallTitle={selectionMode}
        bgClass="bg-app-bg"
        leftContent={selectionMode ? (
          <button className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60" {...bindBack()}>
            <IcClose size={28} className="text-app-text" />
          </button>
        ) : undefined}
        rightContent={selectionMode ? (
          <button
            {...bindTap({ kind: 'action', id: 'clock.alarm.selectAll.toggle' }, { onTrigger: onToggleSelectAll })}
            className="w-10 h-10 flex items-center justify-center active:opacity-60"
          >
            <IcList size={28} className={isAllSelected ? 'text-app-primary' : 'text-gray-400'} />
          </button>
        ) : (
          <ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />
        )}
      />

      <div
        className="h-full overflow-y-auto no-scrollbar"
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: TOOLBAR_SPACER_HEIGHT }} />
        <CollapsingLargeTitle title={displayTitle} scrollTop={scrollTop} />
        {hasAlarms ? (
          <>
            <div className="min-h-[140px] mb-8 flex items-center justify-center px-6">
              <div className="text-[26px] font-medium text-black text-center">{nextAlarmText}</div>
            </div>
            <div className="px-4 flex flex-col gap-3 pb-32">
              {alarms.map(alarm => (
                <AlarmItem
                  key={alarm.id}
                  alarm={alarm}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(alarm.id)}
                  onToggle={() => onToggle(alarm.id)}
                  onSelectToggle={() => onSelectToggle(alarm.id)}
                  onSelectionStart={() => onSelectionStart(alarm.id)}
                  editBind={editBind(alarm)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 mt-32">
            <div className="w-14 h-14 rounded-2xl bg-[#edf2f7] flex items-center justify-center mb-3">
              <IcAlarm size={26} className="text-blue-400" />
            </div>
            <div className="text-[16px]">{s.alarm_no_alarm_set}</div>
          </div>
        )}
      </div>

      {!selectionMode ? (
        <button
          {...addBind}
          className="absolute bottom-[112px] right-10 w-14 h-14 rounded-full bg-app-surface text-app-primary flex items-center justify-center shadow-lg"
        >
          <IcAdd size={26} />
        </button>
      ) : null}
    </div>
  );
};
