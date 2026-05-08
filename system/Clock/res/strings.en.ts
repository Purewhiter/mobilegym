import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  alarm_default_sound: 'Default (Firefly)',

  // Tabs
  alarm_tab: 'Alarm',
  world_clock_tab: 'World Clock',
  stopwatch_tab: 'Stopwatch',
  timer_tab: 'Timer',

  // Alarm list
  alarm_no_alarms: 'No alarms',
  alarm_all_off: 'All alarms off',
  alarm_no_alarm_set: 'No alarm set',

  // Countdown template parts
  alarm_rings_in_minutes_suffix: ' min',
  alarm_rings_in_hours_infix: 'h ',

  // Repeat options
  alarm_repeat_once: 'Once',
  alarm_repeat_daily: 'Daily',
  alarm_repeat_workday: 'Extra workday',
  alarm_repeat_workday_sub: "Alarm won't go off during holidays",
  alarm_repeat_holiday: 'Public holiday',
  alarm_repeat_holiday_sub: "Alarm won't go off during workdays",
  alarm_repeat_weekday: 'Mon to Fri',

  // Alarm editor
  alarm_edit_title: 'Edit alarm',
  alarm_add_title: 'Add alarm',
  alarm_modify_title: 'Edit alarm',
  alarm_ringtone: 'Ringtone',
  alarm_repeat: 'Repeat',
  alarm_vibrate: 'Vibrate when alarm sounds',
  alarm_auto_delete: 'Delete after alarm goes off',
  alarm_note: 'Label',
  alarm_note_placeholder: 'Enter label',
  alarm_more_settings: 'More settings',
  alarm_done: 'Done',
  alarm_hour_label: 'H',
  alarm_minute_label: 'M',
  alarm_shift: 'Shift alarms',
  alarm_custom: 'Customize',

  // World clock
  world_clock_local_time: 'Local time',
  world_clock_select_city: 'Select city',
  world_clock_gmt_label: 'Time zones',
  world_clock_search_placeholder: 'Search for country or city',

  // Date parts
  month_suffix: '/',
  day_suffix: '',

  // Selection mode
  selected_count_prefix: '',
  selected_count_suffix: ' selected',

  // Timer
  timer_total_minutes_prefix: '',
  timer_total_minutes_suffix: ' min total',
  timer_screen_on: 'Keep screen on',

  // Common toolbar
  toolbar_more: 'More',
  toolbar_add: 'Add',
  toolbar_delete: 'Delete',
  cancel: 'Cancel',
  timezone_exists_toast: 'This timezone already exists.',
};
