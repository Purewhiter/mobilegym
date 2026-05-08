import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Tencent Meeting',

  // ── TabBar ──
  tab_meeting: 'Meetings',
  tab_contacts: 'Contacts',
  tab_me: 'Me',

  // ── HomePage — Actions ──
  action_join_meeting: 'Join',
  action_quick_meeting: 'Start',
  action_schedule_meeting: 'Schedule',
  action_share_screen: 'Share Screen',

  // ── HomePage — General ──
  home_upgrade_pro: 'Upgrade to Pro',
  home_history_meetings: 'Past Meetings',
  home_no_meetings: 'No meetings',
  home_status_pending: 'Pending',
  home_status_time_reached: 'Scheduled time reached',
  home_status_ongoing: 'In Progress',
  home_btn_join: 'Join',
  home_date_today: 'Today',
  home_date_tomorrow: 'Tomorrow',

  // ── HomePage — Device Status ──
  device_not_logged_in: 'Not logged in',
  device_in_meeting: 'In meeting',
  device_in_meeting_with_title: 'In meeting: %s',
  device_logged_in: 'Logged in (not in meeting)',

  // ── ContactsPage ──
  contacts_title: 'Contacts',
  contacts_search: 'Search',
  contacts_empty_hint: 'Invite contacts to your address book for more efficient communication',
  contacts_invite: 'Invite Contacts',

  // ── MePage / ProfilePage — Header ──
  me_my_profile: 'My Profile',
  me_free_version: 'Free version | Get verified >',
  me_signature_hint: 'Tap to set your personal message visible to everyone',

  // ── MePage / ProfilePage — Privileges Card ──
  me_can_host: 'Meeting privileges',
  me_meeting_2p_unlimited: 'Unlimited meetings for 2 attendees',
  me_meeting_3_100p_40min: '3 - 100 attendees, up to 40 min',
  me_overtime_cards: '',
  me_overtime_cards_unit: 'unused overtime cards this month',
  me_upgrade_pro_unlimited: 'Upgrade to Pro for unlimited meetings',
  me_btn_upgrade_now: 'Upgrade',
  me_trial_title: 'Apply for Enterprise Free Trial',
  me_trial_subtitle: 'Experience secure, stable, professional meetings',

  // ── MePage / ProfilePage — Services Grid ──
  service_personal_room: 'Personal meeting room',
  service_recording: 'Recordings',
  service_my_notes: 'My Notes',
  service_ai_assistant: 'AI Assistant',
  service_orders: 'Orders & Service',
  service_control_rooms: 'Control Rooms',

  // ── MePage / ProfilePage — Menu Items ──
  menu_points_center: 'Rewards Center',
  menu_points_center_desc: 'Overtime cards, Video VIP...',
  menu_account_security: 'Account & security',
  menu_settings: 'Settings',
  menu_privacy: 'Privacy',
  menu_help: 'Help & Support',
  menu_about: 'About us',
  menu_logout: 'Log Out',

  // ── JoinMeetingPage ──
  join_title: 'Join',
  join_meeting_id: 'Meeting ID',
  join_meeting_id_placeholder: 'Enter meeting ID',
  join_your_name: 'Your Name',
  join_persist_name: 'Use this name to join meetings from now on.',
  join_toggle_mic: 'Turn On Mic',
  join_toggle_speaker: 'Turn On Speaker',
  join_toggle_video: 'Start Video',
  join_btn: 'Join',
  join_invalid_id: 'Invalid meeting ID',

  // ── QuickMeetingPage ──
  quick_title: 'Start',
  quick_banner: 'A maximum of 100 attendees are allowed. When the number of attendees exceeds 2, the meeting can last up to 40 mins.',
  quick_upgrade: 'Upgrade Now >',
  quick_toggle_video: 'Start Video',
  quick_use_pmi: 'Use PMI',
  quick_pmi_label: 'Personal Meeting ID',
  quick_btn_enter: 'Enter Meeting',

  // ── ShareScreenPage ──
  share_title: 'Share Screen',
  share_subtitle: 'Enter the Rooms casting key or meeting ID',
  share_btn_start: 'Share',
  share_help: 'How to cast the screen?',

  // ── ScheduleMeetingPage (Type Selection) ──
  schedule_select_type: 'Select the Meeting Type',
  schedule_type_regular: 'Public Meeting',
  schedule_type_special: 'Private Meeting',
  schedule_type_special_desc: 'Only invited WeChat friends or group members can join the meeting',
  schedule_type_webinar: 'Webinars',
  schedule_type_webinar_tag: 'Free Trial',
  schedule_type_webinar_desc: 'Supports large meetings, training, workshops, launches, and webinars',
  schedule_webinar_learn: 'A Quick Guide to Webinar',
  schedule_view_details: 'View',
  schedule_btn_next: 'Next',

  // ── ScheduleRegularMeetingPage ──
  schedule_regular_title: 'Schedule Meeting',
  schedule_regular_complete: 'Done',
  schedule_topic_placeholder: 'Enter meeting topic',
  schedule_start_time: 'Start Time',
  schedule_duration: 'Duration',
  schedule_duration_limit_hint: 'Supports up to 100 participants. 40-minute limit when more than 2 participants.',
  schedule_upgrade_hint: 'Upgrade >',
  schedule_overtime_remaining: '0 overtime cards remaining this month',
  schedule_auto_use: 'Auto use',
  schedule_timezone: 'Time Zone',
  schedule_repeat: 'Repeat',
  schedule_end_repeat: 'End Repeat',
  schedule_invitees: 'Invitees',
  schedule_invitees_add: 'Add',
  schedule_calendar: 'Calendar',
  schedule_calendar_repeat_hint: 'Please check the recurring or repeating items in calendar invitations',
  schedule_waiting_room: 'Waiting Room',
  schedule_password: 'Meeting Password',
  schedule_password_placeholder: 'Enter 4-6 digit password',
  schedule_signup: 'Enable Registration',
  schedule_allow_before_host: 'Allow members to join before host',
  schedule_mute_on_join: 'Mute on join',
  schedule_mute_on_join_auto: 'Auto-enable after 6 people',
  schedule_watermark: 'Meeting Watermark',
  schedule_watermark_off: 'Off',
  schedule_multi_device: 'Allow multi-device join',
  schedule_forbid_contact: 'Prohibit adding contacts',
  schedule_auto_cloud_record: 'Auto Cloud Recording',
  schedule_auto_cloud_record_off: 'Off',
  schedule_auto_transcribe: 'Auto Transcription',
  schedule_document: 'Documents',
  schedule_allow_upload_doc: 'Allow members to upload documents',
  schedule_vote: 'Voting',
  schedule_apps: 'Apps',
  schedule_virtual_bg: 'Unified Virtual Background',
  schedule_virtual_bg_unset: 'Not set',
  schedule_more: 'More',

  // ── Time Picker ──
  picker_start_time: 'Start Time',
  picker_duration: 'Duration',
  picker_select_end_time: 'Select End Time',
  picker_duration_prefix: 'Duration:',
  picker_select_timezone: 'Select Time Zone',
  picker_suffix_hour: 'h',
  picker_suffix_minute: 'm',
  picker_suffix_hours: 'hours',
  picker_suffix_minutes: 'minutes',

  // ── Repeat Frequency ──
  repeat_title: 'Repeat',
  repeat_none: 'No Repeat',
  repeat_daily: 'Daily',
  repeat_workday: 'Every Workday',
  repeat_weekly: 'Weekly',
  repeat_biweekly: 'Biweekly',
  repeat_monthly: 'Monthly',
  repeat_custom: 'Custom',
  repeat_custom_done: 'Done',
  repeat_frequency: 'Frequency',
  repeat_unit_day: 'Day',
  repeat_unit_week: 'Week',
  repeat_unit_month: 'Month',
  repeat_tab_date: 'Date',
  repeat_tab_weekday: 'Weekday',

  // ── Weekday Names ──
  weekday_sun: 'Sun',
  weekday_mon: 'Mon',
  weekday_tue: 'Tue',
  weekday_wed: 'Wed',
  weekday_thu: 'Thu',
  weekday_fri: 'Fri',
  weekday_sat: 'Sat',

  // ── End Repeat ──
  end_repeat_title: 'End Repeat',
  end_repeat_by_date: 'End on a specific date',
  end_repeat_by_count: 'Limit meeting count',
  end_repeat_count_suffix: 'meetings',

  // ── Common Buttons ──
  btn_cancel: 'Cancel',
  btn_confirm: 'OK',
  btn_done: 'Done',
  common_unknown: 'Unknown',

  // ── MeetingDetailPage (Scheduled Meeting Detail) ──
  meeting_detail_title: 'Meeting Details',
  meeting_detail_not_found: 'Meeting not found',
  meeting_detail_add_note: 'Add Note',
  meeting_detail_organizer: 'Organizer',
  meeting_detail_upgrade: 'Upgrade >',
  meeting_detail_time_limit: 'Current meeting: 40-min limit for 3-100 people',
  meeting_detail_upgrade_pro: 'Upgrade to Pro',
  meeting_detail_unlimited: ' for unlimited meetings',
  meeting_detail_meeting_id: 'Meeting ID',
  meeting_detail_phone_join: 'Phone Dial-in',
  meeting_detail_apps: 'Apps',
  meeting_detail_apps_add: 'Add',
  meeting_detail_materials: 'Meeting Materials',
  meeting_detail_materials_empty: 'No content, add some',
  meeting_detail_btn_ai: 'AI Delegate',
  meeting_detail_btn_enter: 'Enter Meeting',

  // ── MeetingPage (In-Meeting) ──
  meeting_entering: 'Joining meeting...',
  meeting_btn_end: 'End',
  meeting_btn_leave: 'Leave',
  meeting_mute: 'Mute',
  meeting_unmute: 'Unmute',
  meeting_video_on: 'Stop Video',
  meeting_video_off: 'Start Video',
  meeting_share_screen: 'Share Screen',
  meeting_manage_members: 'Participants',
  meeting_more: 'More',
  meeting_chat_placeholder: 'Say something...',

  // ── Meeting Exit Dialog ──
  exit_host_hint: 'If you don\'t want to end the meeting,\nplease assign a new host before leaving.',
  exit_participant_confirm: 'Are you sure you want to leave?',
  exit_participant_ai_hint: 'You can also use "AI Delegate" to listen on your behalf.',
  exit_learn_more: 'Learn more',
  exit_ai_delegate: 'AI Delegate',
  exit_leave_meeting: 'Leave Meeting',
  exit_end_meeting: 'End Meeting',

  // ── SettingsPage ──
  settings_title: 'Settings',
  settings_notifications: 'Receive notifications',

  // ── Settings — Audio ──
  settings_section_audio: 'Audio',
  settings_mic_on_join: 'Turn on mic',
  settings_speaker_on_join: 'Turn on speaker',
  settings_mic_floating: 'Enable floating mic window',
  settings_mic_sound: 'Play chime when mic is unmuted',
  settings_audio_enhancement: 'Noise reduction and audio enhancement',

  // ── Settings — Video ──
  settings_section_video: 'Video',
  settings_camera_on_join: 'Enable camera when joining a meeting',
  settings_virtual_bg: 'Background',
  settings_beauty: 'Filters',
  settings_beauty_status: 'Enabled',
  settings_virtual_avatar: 'Avatar',
  settings_name_badge: 'Name Badge',
  settings_video_mirror: 'Video mirroring',
  settings_hide_non_video: 'Hide video-off attendees in my view',
  settings_hide_self: 'Hide my video in my view',
  settings_show_preview: 'Show video preview',
  settings_advanced_video: 'Advanced video settings',

  // ── Settings — Chat ──
  settings_section_chat: 'Chat',
  settings_danmu: 'Show on-screen chat',
  settings_new_msg_reminder: 'Style',
  settings_new_msg_reminder_value: 'On-screen chat',

  // ── Settings — General ──
  settings_section_general: 'General',
  settings_sync_calendar: 'Sync from calendar',
  settings_auto_cloud_record: 'Auto cloud recording',
  settings_auto_cloud_record_off: 'Off',
  settings_cloud_record: 'Cloud recording',
  settings_subtitle_transcribe: 'Caption & transcription',
  settings_show_duration: 'Display connected time',
  settings_nearby_discovery: 'Near-field discovery',
  settings_learn_more: 'Learn More',
  settings_voice_excitation: 'Speaker spotlight',
  settings_shortcut_float: 'Floating window',
  settings_safe_drive: 'Safe driving mode',
  settings_dark_mode_follow: 'Dark mode follows system',
  settings_language: 'Language',
  settings_language_follow: 'Auto',

  // ── Settings — Others ──
  settings_network_check: 'Network test',
  settings_proxy: 'Proxy settings',
  settings_proxy_off: 'Off',
  settings_cache_clear: 'Clear app cache',
  settings_about_version: 'V 3.40.1(435)',

  // ── AccountSecurityPage ──
  account_title: 'Account and security',
  account_my_cert: 'My Certification',
  account_job_identity: 'Professional/Creator identity',
  account_show_identity: 'Show certified identity publicly',
  account_show_identity_tag: 'Pro Benefit',
  account_show_identity_desc: 'When enabled, your certified identity will be shown in name badges, participant lists, and profile cards to enhance your professional image.',
  account_personal_cert_label: 'Personal Authentication ID',
  account_preview_name: 'Huihui',
  account_not_verified: 'Not verified',
  account_go_verify: 'Verify now',
  account_info: 'Account Info',
  account_phone: 'Phone',
  account_email: 'Email',
  account_email_bind: 'Bind',
  account_wechat: 'WeChat',
  account_login_password: 'Login password',
  account_login_devices: 'Logged-in devices',
  account_deactivate: 'Delete Account',
  account_deactivate_title: 'Deactivate Account',
  account_deactivate_desc: 'Account deactivation is irreversible. The phone number bound to this account can be re-registered after 15 days.',
  account_unified_identity: 'Tencent One ID',
  account_voice_teacher: 'Music teacher',

  // ── MessagesPage ──
  messages_tab_todo: 'To-Do',
  messages_tab_all: 'All Messages',
  messages_sub_all: 'All',
  messages_sub_system: 'System',
  messages_sub_welfare: 'Promotions',
  messages_todo_done: 'All to-dos completed',
  messages_no_messages: 'No Messages',
  messages_view_detail: 'View Details',

  // ── HistoryMeetingsPage ──
  history_title: 'History',
  history_search_placeholder: 'Meeting name, notes, ID, or organizer',
  history_no_result: 'No meetings found',
  history_empty: 'No meeting history',
  history_recurring_tag: 'Recurring',
  history_time_label: 'Time',
  history_organizer_label: 'Organizer',

  // ── HistoryMeetingDetailPage ──
  history_detail_meeting_id: 'Meeting ID:',
  history_detail_organizer: 'Organizer',
  history_detail_participants: 'Participated',
  history_detail_total_people: '%s people total',
  history_detail_last_join: 'Last Joined',
  history_detail_duration: 'Duration',
  history_detail_rejoin: 'Rejoin',
  history_detail_reschedule: 'Reschedule',
  history_detail_ended: 'Meeting Ended',
  history_detail_join_meeting: 'Join Meeting',
  history_detail_duration_header: 'Duration',
  history_detail_dismiss: 'Got It',

  // ── PersonalRoomPage ──
  personal_room_edit: 'Edit Profile',
  personal_room_title_suffix: '\'s Personal Meeting Room',
  personal_room_meeting_id: 'Meeting ID',
  personal_room_meeting_link: 'Link',
  personal_room_password: 'Meeting Password',
  personal_room_waiting_room: 'Waiting Room',
  personal_room_allow_before_host: 'Attendees can join before host',
  personal_room_watermark: 'Meeting Watermark',
  personal_room_multi_device: 'Allow multi-device join',
  personal_room_mute_on_join: 'Mute attendees upon entry',
  personal_room_mute_auto: 'Auto-enable after 6 people',
  personal_room_mute_always: 'Always on',
  personal_room_on: 'On',
  personal_room_off: 'Off',
  personal_room_not_on: 'Disabled',
  personal_room_yes: 'Yes',
  personal_room_no: 'No',
  personal_room_enter: 'Enter',

  // ── Context — Meeting Titles ──
  meeting_quick_title_suffix: '\'s Quick Meeting',
  meeting_schedule_title_suffix: '\'s Scheduled Meeting',

  // ── Repeat Format Templates ──
  repeat_format_weekly: 'Weekly (%s)',
  repeat_format_biweekly: 'Biweekly (%s)',
  repeat_format_monthly: 'Monthly (%sth)',

  // ── Custom Repeat Description Templates ──
  custom_repeat_day_prefix: 'Meeting repeats daily',
  custom_repeat_day_interval: 'Meeting repeats every %s days',
  custom_repeat_week_prefix: 'Meeting repeats weekly',
  custom_repeat_week_interval: 'Meeting repeats every %s weeks',
  custom_repeat_month_prefix: 'Meeting repeats monthly',
  custom_repeat_month_interval: 'Meeting repeats every %s months',
  custom_repeat_cannot_deselect: 'Current schedule is on %s, cannot deselect',

  // ── Custom Repeat — Month Weekday Mode ──
  custom_repeat_ordinal_weekday: '%s %s of the month',

  // ── Date Format Suffixes ──
  date_month_suffix: '',
  date_day_suffix: '',
  date_year_suffix: '',

  // ── Timezone Picker ──
  timezone_china_standard: '(GMT+08:00) China Standard Time',
  timezone_china_standard_beijing: '(GMT+08:00) China Standard Time - Beijing',

  // ── End Repeat — Display Format ──
  end_repeat_display: 'Until %s/%s/%s, %s meetings',

  // ── Meeting Detail — Phone ──
  meeting_detail_phone_number: '+86 (0)755 36550000 (Mainland China)',

  // ── Meeting Detail — Duration Unit ──
  meeting_detail_minutes: 'minutes',

  // ── History Detail — Dialog Headers ──
  history_detail_join_column: 'Join Meeting',
  history_detail_duration_column: 'Duration',

  // ── MeetingAttendeesPage ──
  attendees_page_title: 'Participants',
  attendees_page_title_with_count: 'Participants (%s)',
  attendees_search_placeholder: 'Search members',

  // ── ContactsPage ──
  contacts_my_friends: 'My Contacts',

  // ── MeetingPage — Chat ──
  meeting_chat_title: 'Chat',
  meeting_send_to: 'Send to',
  meeting_send_to_all: 'Everyone in Meeting',
  meeting_everyone: 'Everyone',
  meeting_search_member: 'Search members',
  meeting_input_placeholder: 'Type a message...',
  meeting_no_chat_messages: 'No messages',
  meeting_chatting_with_all: 'Chatting with everyone',
  meeting_chatting_with_prefix: 'Chatting with ',
  meeting_chatting_with_suffix: '',
  meeting_private_chat: 'Private',

  // ── MeetingPage — Members ──
  meeting_in_meeting_tab: 'In Meeting',
  meeting_not_joined: 'Not Joined',
  meeting_host_label: 'Host',
  meeting_co_host_label: 'Co-Host',
  meeting_me_label: 'Me',
  meeting_mute_all: 'Mute All',
  meeting_unmute_all: 'Unmute All',
  meeting_invite: 'Invite',

  // ── MeetingPage — More / Profile ──
  meeting_stop_share: 'Stop Sharing',
  meeting_stop_record: 'Stop Recording',
  meeting_layout: 'Layout',
  meeting_captions: 'Captions',
  meeting_set_bg_hint: 'Tap to set background',
  meeting_free_label: 'Free',
  meeting_signature_label: 'Signature',
  meeting_rename: 'Rename in Meeting',
  meeting_rename_title: 'Rename',

  // ── AccountSecurityPage ──
  account_next_step: 'Next',

  // ── ScheduleRegularMeetingPage ──
  schedule_select_invitees: 'Select Invitees',
  schedule_invitees_count: ' and %s others',

  // ── Custom Repeat — Week/Month with Days ──
  custom_repeat_week_days: 'Meeting repeats every week on %s',
  custom_repeat_week_interval_days: 'Meeting repeats every %s weeks on %s',
  custom_repeat_month_of_days: 'Meeting repeats every month on %s',
  custom_repeat_month_interval_of_days: 'Meeting repeats every %s months on %s',

  // ── Repeat Every — Frequency Prefix ──
  repeat_every: 'Every ',
  repeat_unit_months: ' months',

  // ── End Repeat — Display Connectors ──
  end_repeat_at_prefix: 'Until ',
  end_repeat_count_sessions_suffix: ' meetings',

  // ── MeetingPage — More Sheet ──
  meeting_cloud_record: 'Cloud recording',

  // ── Meeting Detail — Action Sheet ──
  meeting_detail_action_modify: 'Edit Meeting',
  meeting_detail_action_cancel_meeting: 'Cancel Meeting',

  // ── Edit Meeting Page ──
  edit_meeting_title: 'Edit Scheduled Meeting',
  edit_meeting_confirm: 'Confirm',
};
