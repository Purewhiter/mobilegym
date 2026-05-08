import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // App / Page titles
  app_name: 'Calendar',
  settings: 'Settings',
  event_detail: 'Event Details',
  create_event: 'Create Event',
  edit_event: 'Edit Event',
  date_jump: 'Go to Date',
  date_calculate: 'Date Calculator',
  subscription: 'Subscriptions',
  desk_theme: 'Choose Desk Calendar Theme',
  search: 'Search Events',

  // Bottom nav tabs
  tab_year: 'Year',
  tab_month: 'Month',
  tab_week: 'Week',
  tab_day: 'Day',

  // Event type tabs
  event_type_event: 'Event',
  event_type_birthday: 'Birthday',
  event_type_anniversary: 'Anniversary',
  event_type_countdown: 'Countdown',

  // Action sheet items
  action_date_jump: 'Go to Date',
  action_date_calculate: 'Date Calculator',
  action_subscription: 'Subscriptions',
  action_desk_theme: 'Choose Desk Calendar Theme',
  action_share: 'Share',
  action_settings: 'Settings',

  // Event form labels
  label_title: 'Enter event title',
  label_all_day: 'All-day event',
  label_start_time: 'Start time',
  label_end_time: 'End time',
  label_repeat: 'Repeat',
  label_reminder: 'Reminder',
  label_alarm: 'Alarm reminder',
  label_notes: 'Enter notes',
  label_calendar_account: 'Calendar account',
  label_all_day_value: 'All day',
  label_never: 'Never',
  label_at_start: 'At start',
  default_account: 'Mi Calendar',

  // Empty / error states
  empty_agenda: 'No events',
  empty_agenda_hint: 'Tap to create',
  event_not_found: 'Event not found',
  search_hint: 'Search events by keyword',
  search_no_results: 'No matching events found',
  validation_title_required: 'Please enter an event title',

  // Confirmations
  confirm_delete_event: 'Delete this event?',

  // Settings page
  settings_import: 'Import events',
  settings_account_manage: 'Calendar account management',
  settings_section_calendar: 'Calendar dial settings',
  settings_week_start: 'Start of week',
  settings_show_extend_month: 'Show cross-month dates',
  settings_show_week_number: 'Show week numbers',
  settings_section_features: 'Feature settings',
  settings_horoscope: 'Horoscope',
  settings_almanac: 'Show almanac dos and don\'ts',
  settings_global_holidays: 'Global holidays',
  settings_other_calendars: 'Other calendars',
  settings_smart_extract: 'Smart event extraction',
  settings_section_reminder: 'Reminder settings',
  settings_reminder: 'Event reminder settings',
  settings_default_reminder: 'Default advance reminder time',
  settings_default_allday_reminder: 'Default all-day reminder time',
  settings_default_later_reminder: 'Default snooze reminder time',
  settings_holiday_reminder: 'Holiday reminders',
  settings_section_other: 'Other settings',
  settings_show_rejected: 'Show declined events',
  settings_auto_import_birthday: 'Auto-import contact birthdays',
  settings_holiday_data: 'Public holiday data update',
  settings_timezone: 'Event timezone settings',
  settings_ux_plan: 'User experience program',
  settings_privacy: 'Privacy & permissions',
  settings_about: 'About Calendar',

  // Date calculate page
  calculate_tab_calc: 'Date Calculator',
  calculate_tab_interval: 'Date Interval',
  calculate_start_date: 'Start date',
  calculate_end_date: 'End date',
  calculate_input_days: 'Enter number of days',
  calculate_days_after: 'days later',
  calculate_days_before: 'days earlier',
  calculate_start: 'Calculate',
  calculate_result: 'Result',
  calculate_jump: 'Go',
  calculate_select_date: 'Select a date to go to',
  calculate_interval_result_prefix: 'Difference: ',

  // Common
  cancel: 'Cancel',
  close: 'Close',
  day_unit: 'days',

  // Grid badges
  badge_work: 'Work',
  badge_rest: 'Off',

  // Weekday labels
  weekday_mon: 'Mon',
  weekday_tue: 'Tue',
  weekday_wed: 'Wed',
  weekday_thu: 'Thu',
  weekday_fri: 'Fri',
  weekday_sat: 'Sat',
  weekday_sun: 'Sun',

  // Event detail page
  detail_notes_label: 'Notes',
  detail_alarm_suffix: ' (alarm reminder)',

  // Reminder option labels
  remind_none: 'Never',
  remind_5_min_before: '5 minutes before',
  remind_15_min_before: '15 minutes before',
  remind_30_min_before: '30 minutes before',
  remind_1_hour_before: '1 hour before',
  remind_1_day_before: '1 day before',
  remind_before_prefix: '',
  remind_before_suffix_min: ' minutes before',

  // Settings page reminder value labels
  settings_reminder_val_5_min: '5 min before',
  settings_reminder_val_15_min: '15 min before',
  settings_reminder_val_30_min: '30 min before',
  settings_reminder_val_1_hour: '1 hour before',
  settings_reminder_val_1_day: '1 day before',
  settings_allday_0: 'Same day 0:00',
  settings_allday_9: 'Same day 9:00',
  settings_allday_prev_9: 'Previous day 9:00',
  settings_later_5_min: '5 min later',
  settings_later_10_min: '10 min later',
  settings_later_30_min: '30 min later',
  settings_later_1_hour: '1 hour later',
  week_start_sunday: 'Sunday',
  week_start_monday: 'Monday',

  // New event page toast messages
  toast_invalid_start_time: 'Please enter a valid start time (e.g. 09:00)',
  toast_invalid_end_time: 'Please enter a valid end time (e.g. 10:00)',

  // Subscription page
  sub_holiday: 'Public Holidays',
  sub_holiday_desc: 'Subscribe to public holiday and day-off schedule (includes work/rest markers).',
  sub_almanac: 'Almanac',
  sub_almanac_desc: 'Subscribe to almanac dos and don\'ts (corresponds to almanac detail page in original).',
  sub_horoscope: 'Horoscope',
  sub_horoscope_desc: 'Subscribe to horoscope cards (can be enabled in Features settings in original).',
  sub_traffic: 'Traffic Restrictions',
  sub_traffic_desc: 'Subscribe to city traffic restriction reminders (original includes restriction settings/detail).',
  sub_shift: 'Work Schedule',
  sub_shift_desc: 'Subscribe to shift/rotation reminders (original includes shift settings/detail).',

  // Home page
  home_share_toast: 'Share content generated (simulated)',

  // Month short names
  month_1: 'Jan',
  month_2: 'Feb',
  month_3: 'Mar',
  month_4: 'Apr',
  month_5: 'May',
  month_6: 'Jun',
  month_7: 'Jul',
  month_8: 'Aug',
  month_9: 'Sep',
  month_10: 'Oct',
  month_11: 'Nov',
  month_12: 'Dec',
};
