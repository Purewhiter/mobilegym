/**
 * TencentMeeting 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '腾讯会议',

  // ── TabBar ──
  tab_meeting: '会议',
  tab_contacts: '通讯录',
  tab_me: '我的',

  // ── HomePage — Actions ──
  action_join_meeting: '加入会议',
  action_quick_meeting: '快速会议',
  action_schedule_meeting: '预定会议',
  action_share_screen: '共享屏幕',

  // ── HomePage — General ──
  home_upgrade_pro: '升级专业版',
  home_history_meetings: '历史会议',
  home_no_meetings: '暂无会议',
  home_status_pending: '待开始',
  home_status_time_reached: '已到预定时间',
  home_status_ongoing: '进行中',
  home_btn_join: '入会',
  home_date_today: '今天',
  home_date_tomorrow: '明天',

  // ── HomePage — Device Status ──
  device_not_logged_in: '未登录',
  device_in_meeting: '会议中',
  device_in_meeting_with_title: '会议中: %s',
  device_logged_in: '已登录(未入会)',

  // ── ContactsPage ──
  contacts_title: '通讯录',
  contacts_search: '搜索',
  contacts_empty_hint: '你可邀请联系人加入通讯录，体验高效沟通',
  contacts_invite: '邀请联系人',

  // ── MePage / ProfilePage — Header ──
  me_my_profile: '我的资料',
  me_free_version: '免费版 | 展示认证 >',
  me_signature_hint: '点击设置签名，所有人均可查看',

  // ── MePage / ProfilePage — Privileges Card ──
  me_can_host: '您可召开',
  me_meeting_2p_unlimited: '2人不限时会议',
  me_meeting_3_100p_40min: '3-100人限时40分钟会议',
  me_overtime_cards: '本月剩余加时卡',
  me_overtime_cards_unit: '张',
  me_upgrade_pro_unlimited: '升级专业版即享不限时会议',
  me_btn_upgrade_now: '立即升级',
  me_trial_title: '免费申请商业版/企业版试用',
  me_trial_subtitle: '体验安全，稳定，专业的会议服务',

  // ── MePage / ProfilePage — Services Grid ──
  service_personal_room: '个人会议室',
  service_recording: '录制',
  service_my_notes: '我的笔记',
  service_ai_assistant: 'AI小助手',
  service_orders: '订单与服务',
  service_control_rooms: '控制Rooms',

  // ── MePage / ProfilePage — Menu Items ──
  menu_points_center: '积分中心',
  menu_points_center_desc: '加时卡、视频VIP...',
  menu_account_security: '账号与安全',
  menu_settings: '设置',
  menu_privacy: '隐私',
  menu_help: '帮助与客服',
  menu_about: '关于我们',
  menu_logout: '退出登录',

  // ── JoinMeetingPage ──
  join_title: '加入会议',
  join_meeting_id: '会议号',
  join_meeting_id_placeholder: '请输入会议号',
  join_your_name: '您的名称',
  join_persist_name: '后续会议都使用此名称',
  join_toggle_mic: '开启麦克风',
  join_toggle_speaker: '开启扬声器',
  join_toggle_video: '开启视频',
  join_btn: '加入会议',
  join_invalid_id: '会议号无效',

  // ── QuickMeetingPage ──
  quick_title: '快速会议',
  quick_banner: '最多支持100人参会，会议人数超过2人时，启动40分钟限时。',
  quick_upgrade: '升级能力',
  quick_toggle_video: '开启视频',
  quick_use_pmi: '使用个人会议号',
  quick_pmi_label: '个人会议号',
  quick_btn_enter: '进入会议',

  // ── ShareScreenPage ──
  share_title: '共享屏幕',
  share_subtitle: '请输入 Rooms共享码 或 会议号',
  share_btn_start: '开始共享',
  share_help: '如何共享屏幕?',

  // ── ScheduleMeetingPage (Type Selection) ──
  schedule_select_type: '请选择会议类型',
  schedule_type_regular: '常规会议',
  schedule_type_special: '特邀会议',
  schedule_type_special_desc: '仅您邀请的微信好友或群成员可加入此会议',
  schedule_type_webinar: '网络研讨会(Webinar)',
  schedule_type_webinar_tag: '试用',
  schedule_type_webinar_desc: '可支持大型会议/企业培训/沙龙/发布会/研讨会等',
  schedule_webinar_learn: '一分钟了解网络研讨会 (Webinar)',
  schedule_view_details: '查看详情',
  schedule_btn_next: '下一步',

  // ── ScheduleRegularMeetingPage ──
  schedule_regular_title: '预定会议',
  schedule_regular_complete: '完成',
  schedule_topic_placeholder: '请输入会议主题',
  schedule_start_time: '开始时间',
  schedule_duration: '会议时长',
  schedule_duration_limit_hint: '最多支持100人参会，会议人数超过2人时，启动40分钟限时。',
  schedule_upgrade_hint: '升级能力 >',
  schedule_overtime_remaining: '本月剩余加时卡0张',
  schedule_auto_use: '自动使用',
  schedule_timezone: '时区',
  schedule_repeat: '重复频率',
  schedule_end_repeat: '结束重复',
  schedule_invitees: '参会人',
  schedule_invitees_add: '添加',
  schedule_calendar: '日历',
  schedule_calendar_repeat_hint: '请切记检查日历邀请项中的周期性或重复事项',
  schedule_waiting_room: '等候室',
  schedule_password: '入会密码',
  schedule_password_placeholder: '请输入4-6位数字密码',
  schedule_signup: '开启会议报名',
  schedule_allow_before_host: '允许成员在主持人前入会',
  schedule_mute_on_join: '成员入会时静音',
  schedule_mute_on_join_auto: '超过6人后自动开启',
  schedule_watermark: '会议水印',
  schedule_watermark_off: '未开启',
  schedule_multi_device: '允许成员多端入会',
  schedule_forbid_contact: '禁止互相添加联系人',
  schedule_auto_cloud_record: '自动云录制',
  schedule_auto_cloud_record_off: '关闭',
  schedule_auto_transcribe: '自动文字转写',
  schedule_document: '文档',
  schedule_allow_upload_doc: '允许成员上传文档',
  schedule_vote: '投票',
  schedule_apps: '应用',
  schedule_virtual_bg: '统一虚拟背景',
  schedule_virtual_bg_unset: '未设置',
  schedule_more: '更多',

  // ── Time Picker ──
  picker_start_time: '开始时间',
  picker_duration: '会议时长',
  picker_select_end_time: '选择结束时间',
  picker_duration_prefix: '会议时长:',
  picker_select_timezone: '选择时区',
  picker_suffix_hour: '时',
  picker_suffix_minute: '分',
  picker_suffix_hours: '小时',
  picker_suffix_minutes: '分钟',

  // ── Repeat Frequency ──
  repeat_title: '重复频率',
  repeat_none: '不重复',
  repeat_daily: '每天',
  repeat_workday: '每个工作日',
  repeat_weekly: '每周',
  repeat_biweekly: '每两周',
  repeat_monthly: '每月',
  repeat_custom: '自定义',
  repeat_custom_done: '完成',
  repeat_frequency: '频率',
  repeat_unit_day: '天',
  repeat_unit_week: '周',
  repeat_unit_month: '月',
  repeat_tab_date: '日期',
  repeat_tab_weekday: '星期',

  // ── Weekday Names ──
  weekday_sun: '周日',
  weekday_mon: '周一',
  weekday_tue: '周二',
  weekday_wed: '周三',
  weekday_thu: '周四',
  weekday_fri: '周五',
  weekday_sat: '周六',

  // ── End Repeat ──
  end_repeat_title: '结束重复',
  end_repeat_by_date: '结束于某天',
  end_repeat_by_count: '限定会议次数',
  end_repeat_count_suffix: '次会议',

  // ── Common Buttons ──
  btn_cancel: '取消',
  btn_confirm: '确定',
  btn_done: '完成',
  common_unknown: '未知',

  // ── MeetingDetailPage (Scheduled Meeting Detail) ──
  meeting_detail_title: '会议详情',
  meeting_detail_not_found: '会议信息不存在',
  meeting_detail_add_note: '添加备注',
  meeting_detail_organizer: '发起人',
  meeting_detail_upgrade: '升级 >',
  meeting_detail_time_limit: '当前会议3-100人限时40分钟',
  meeting_detail_upgrade_pro: '升级专业版',
  meeting_detail_unlimited: '享不限时会议',
  meeting_detail_meeting_id: '会议号',
  meeting_detail_phone_join: '电话入会',
  meeting_detail_apps: '应用',
  meeting_detail_apps_add: '添加',
  meeting_detail_materials: '会议资料',
  meeting_detail_materials_empty: '暂无内容，去添加',
  meeting_detail_btn_ai: 'AI托管',
  meeting_detail_btn_enter: '进入会议',

  // ── MeetingPage (In-Meeting) ──
  meeting_entering: '正在进入会议...',
  meeting_btn_end: '结束',
  meeting_btn_leave: '离开',
  meeting_mute: '静音',
  meeting_unmute: '解除静音',
  meeting_video_on: '关闭视频',
  meeting_video_off: '开启视频',
  meeting_share_screen: '共享屏幕',
  meeting_manage_members: '管理成员',
  meeting_more: '更多',
  meeting_chat_placeholder: '说点什么...',

  // ── Meeting Exit Dialog ──
  exit_host_hint: '如果不想结束会议，\n请在离开会议前指定新的主持人。',
  exit_participant_confirm: '确定要离开会议吗？',
  exit_participant_ai_hint: '也可以使用"AI托管"，元宝代你听会。',
  exit_learn_more: '了解更多',
  exit_ai_delegate: 'AI 托管',
  exit_leave_meeting: '离开会议',
  exit_end_meeting: '结束会议',

  // ── SettingsPage ──
  settings_title: '设置',
  settings_notifications: '接收消息通知',

  // ── Settings — Audio ──
  settings_section_audio: '音频',
  settings_mic_on_join: '入会开启麦克风',
  settings_speaker_on_join: '入会开启扬声器',
  settings_mic_floating: '开启麦克风浮窗',
  settings_mic_sound: '开麦时播放提示音',
  settings_audio_enhancement: '音频降噪与增强',

  // ── Settings — Video ──
  settings_section_video: '视频',
  settings_camera_on_join: '入会开启摄像头',
  settings_virtual_bg: '虚拟背景',
  settings_beauty: '美颜',
  settings_beauty_status: '已开启',
  settings_virtual_avatar: '虚拟头像',
  settings_name_badge: '名牌',
  settings_video_mirror: '视频镜像',
  settings_hide_non_video: '在我的视图中隐藏非视频参会者',
  settings_hide_self: '在我的视图中隐藏自己',
  settings_show_preview: '显示视频预览',
  settings_advanced_video: '高级视频设置',

  // ── Settings — Chat ──
  settings_section_chat: '聊天',
  settings_danmu: '显示弹幕',
  settings_new_msg_reminder: '新聊天消息提醒',
  settings_new_msg_reminder_value: '弹幕',

  // ── Settings — General ──
  settings_section_general: '通用',
  settings_sync_calendar: '同步日历',
  settings_auto_cloud_record: '自动云录制',
  settings_auto_cloud_record_off: '关闭',
  settings_cloud_record: '云录制',
  settings_subtitle_transcribe: '字幕和转写',
  settings_show_duration: '显示参会时长',
  settings_nearby_discovery: '近场发现',
  settings_learn_more: '了解更多',
  settings_voice_excitation: '语音激励',
  settings_shortcut_float: '快捷浮窗',
  settings_safe_drive: '安全驾驶模式',
  settings_dark_mode_follow: '深色模式跟随系统',
  settings_language: '语言',
  settings_language_follow: '跟随系统',

  // ── Settings — Others ──
  settings_network_check: '网络检测',
  settings_proxy: '代理设置',
  settings_proxy_off: '未开启',
  settings_cache_clear: '应用缓存清理',
  settings_about_version: 'V 3.40.1(435)',

  // ── AccountSecurityPage ──
  account_title: '账号与安全',
  account_my_cert: '我的认证',
  account_job_identity: '职业/达人身份',
  account_show_identity: '对外展示认证身份',
  account_show_identity_tag: '专业版权益',
  account_show_identity_desc: '开启后可在身份名牌、参会成员列表、个人资料卡中外显认证身份，提升专业形象。',
  account_personal_cert_label: '个人认证标识',
  account_preview_name: '艾慧慧',
  account_not_verified: '尚未进行身份认证',
  account_go_verify: '前往认证',
  account_info: '账号信息',
  account_phone: '手机号',
  account_email: '邮箱',
  account_email_bind: '点击绑定',
  account_wechat: '微信',
  account_login_password: '登录密码',
  account_login_devices: '登录设备',
  account_deactivate: '注销账号',
  account_deactivate_title: '注销账号',
  account_deactivate_desc: '注销账号是不可恢复的操作，该账号绑定的手机号 15 天后方可重新申请注册。',
  account_unified_identity: '腾讯统一身份',
  account_voice_teacher: '声乐老师',

  // ── MessagesPage ──
  messages_tab_todo: '待办消息',
  messages_tab_all: '全部消息',
  messages_sub_all: '全部',
  messages_sub_system: '系统通知',
  messages_sub_welfare: '福利消息',
  messages_todo_done: '您已完成所有待办',
  messages_no_messages: '暂无消息',
  messages_view_detail: '查看详情',

  // ── HistoryMeetingsPage ──
  history_title: '历史会议',
  history_search_placeholder: '会议名称、会议备注、会议号、发起人',
  history_no_result: '没有找到相关会议',
  history_empty: '暂无历史会议',
  history_recurring_tag: '周期',
  history_time_label: '时间',
  history_organizer_label: '发起人',

  // ── HistoryMeetingDetailPage ──
  history_detail_meeting_id: '会议号：',
  history_detail_organizer: '发起人',
  history_detail_participants: '已参会',
  history_detail_total_people: '共%s人',
  history_detail_last_join: '最近入会',
  history_detail_duration: '参会时长',
  history_detail_rejoin: '重新入会',
  history_detail_reschedule: '再次预定',
  history_detail_ended: '会议已结束',
  history_detail_join_meeting: '加入会议',
  history_detail_duration_header: '时长',
  history_detail_dismiss: '我知道了',

  // ── PersonalRoomPage ──
  personal_room_edit: '编辑资料',
  personal_room_title_suffix: '的个人会议室',
  personal_room_meeting_id: '会议号',
  personal_room_meeting_link: '会议链接',
  personal_room_password: '入会密码',
  personal_room_waiting_room: '等候室',
  personal_room_allow_before_host: '允许成员在主持人前入会',
  personal_room_watermark: '会议水印',
  personal_room_multi_device: '允许成员多端入会',
  personal_room_mute_on_join: '成员入会时静音',
  personal_room_mute_auto: '超过6人后自动开启',
  personal_room_mute_always: '始终开启',
  personal_room_on: '开启',
  personal_room_off: '关闭',
  personal_room_not_on: '未开启',
  personal_room_yes: '是',
  personal_room_no: '否',
  personal_room_enter: '进入会议室',

  // ── Context — Meeting Titles ──
  meeting_quick_title_suffix: '的快速会议',
  meeting_schedule_title_suffix: '预定的会议',

  // ── Repeat Format Templates ──
  repeat_format_weekly: '每周（%s）',
  repeat_format_biweekly: '每两周（%s）',
  repeat_format_monthly: '每月（%s日）',

  // ── Custom Repeat Description Templates ──
  custom_repeat_day_prefix: '会议将于每天重复',
  custom_repeat_day_interval: '会议将于每%s天重复',
  custom_repeat_week_prefix: '会议将于每周重复',
  custom_repeat_week_interval: '会议将于每%s周重复',
  custom_repeat_month_prefix: '会议将于每月重复',
  custom_repeat_month_interval: '会议将于每%s个月重复',
  custom_repeat_cannot_deselect: '当前日程为%s，无法取消选择',

  // ── Custom Repeat — Month Weekday Mode ──
  custom_repeat_ordinal_weekday: '第%s个 %s',

  // ── Date Format Suffixes ──
  date_month_suffix: '月',
  date_day_suffix: '日',
  date_year_suffix: '年',

  // ── Timezone Picker ──
  timezone_china_standard: '(GMT+08:00) 中国标准时间',
  timezone_china_standard_beijing: '(GMT+08:00) 中国标准时间 - 北京',

  // ── End Repeat — Display Format ──
  end_repeat_display: '于%s年%s月%s日 %s场会议',

  // ── Meeting Detail — Phone ──
  meeting_detail_phone_number: '+86 (0)755 36550000 (中国大陆)',

  // ── Meeting Detail — Duration Unit ──
  meeting_detail_minutes: '分钟',

  // ── History Detail — Dialog Headers ──
  history_detail_join_column: '加入会议',
  history_detail_duration_column: '时长',

  // ── MeetingAttendeesPage ──
  attendees_page_title: '已参会人',
  attendees_page_title_with_count: '已参会人(%s人)',
  attendees_search_placeholder: '搜索成员',

  // ── ContactsPage ──
  contacts_my_friends: '我的好友',

  // ── MeetingPage — Chat ──
  meeting_chat_title: '聊天',
  meeting_send_to: '发送至',
  meeting_send_to_all: '会议中所有人',
  meeting_everyone: '所有人',
  meeting_search_member: '搜索成员',
  meeting_input_placeholder: '请输入消息...',
  meeting_no_chat_messages: '暂无消息',
  meeting_chatting_with_all: '正在与所有人聊天',
  meeting_chatting_with_prefix: '正在与 ',
  meeting_chatting_with_suffix: ' 聊天',
  meeting_private_chat: '私聊',

  // ── MeetingPage — Members ──
  meeting_in_meeting_tab: '会议中',
  meeting_not_joined: '未入会',
  meeting_host_label: '主持人',
  meeting_co_host_label: '联席主持人',
  meeting_me_label: '我',
  meeting_mute_all: '全体静音',
  meeting_unmute_all: '解除全体静音',
  meeting_invite: '邀请',

  // ── MeetingPage — More / Profile ──
  meeting_stop_share: '停止共享',
  meeting_stop_record: '停止录制',
  meeting_layout: '布局',
  meeting_captions: '字幕/转写',
  meeting_set_bg_hint: '点击设置背景图',
  meeting_free_label: '免费版',
  meeting_signature_label: '签名',
  meeting_rename: '修改会中昵称',
  meeting_rename_title: '修改昵称',

  // ── AccountSecurityPage ──
  account_next_step: '下一步',

  // ── ScheduleRegularMeetingPage ──
  schedule_select_invitees: '选择参会人',
  schedule_invitees_count: '等%s人',

  // ── Custom Repeat — Week/Month with Days ──
  custom_repeat_week_days: '会议将于每周的%s重复',
  custom_repeat_week_interval_days: '会议将于每%s周的%s重复',
  custom_repeat_month_of_days: '会议将于每月的%s重复',
  custom_repeat_month_interval_of_days: '会议将于每%s个月的%s重复',

  // ── Repeat Every — Frequency Prefix ──
  repeat_every: '每',
  repeat_unit_months: '个月',

  // ── End Repeat — Display Connectors ──
  end_repeat_at_prefix: '于',
  end_repeat_count_sessions_suffix: '场会议',

  // ── MeetingPage — More Sheet ──
  meeting_cloud_record: '云录制',

  // ── Meeting Detail — Action Sheet ──
  meeting_detail_action_modify: '修改会议信息',
  meeting_detail_action_cancel_meeting: '取消会议',

  // ── Edit Meeting Page ──
  edit_meeting_title: '修改会议预定',
  edit_meeting_confirm: '确认修改',
} as const;

export type StringKey = keyof typeof strings;
