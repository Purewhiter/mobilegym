/**
 * Calendar 字符串资源 — 对应 AOSP res/values/strings.xml
 * 页面级 UI 字符串（标题、按钮、提示等）
 */
export const strings = {
  // App / Page titles
  app_name: '日历',
  settings: '设置',
  event_detail: '日程详情',
  create_event: '创建日程',
  edit_event: '编辑日程',
  date_jump: '日期跳转',
  date_calculate: '日期推算',
  subscription: '订阅服务',
  desk_theme: '选择台历题材',
  search: '搜索日程',

  // Bottom nav tabs
  tab_year: '年',
  tab_month: '月',
  tab_week: '周',
  tab_day: '日',

  // Event type tabs
  event_type_event: '日程',
  event_type_birthday: '生日',
  event_type_anniversary: '纪念日',
  event_type_countdown: '倒数日',

  // Action sheet items
  action_date_jump: '日期跳转',
  action_date_calculate: '日期推算',
  action_subscription: '订阅服务',
  action_desk_theme: '选择台历题材',
  action_share: '分享',
  action_settings: '设置',

  // Event form labels
  label_title: '请输入日程标题',
  label_all_day: '全天事件',
  label_start_time: '开始时间',
  label_end_time: '结束时间',
  label_repeat: '重复',
  label_reminder: '提醒',
  label_alarm: '闹钟提醒',
  label_notes: '请输入备注',
  label_calendar_account: '日历账户',
  label_all_day_value: '全天',
  label_never: '永不',
  label_at_start: '开始时',
  default_account: '小米日历',

  // Empty / error states
  empty_agenda: '暂无日程',
  empty_agenda_hint: '点击创建',
  event_not_found: '未找到该日程',
  search_hint: '输入关键词搜索日程',
  search_no_results: '未找到相关日程',
  validation_title_required: '请输入日程标题',

  // Confirmations
  confirm_delete_event: '删除该日程？',

  // Settings page
  settings_import: '日程导入',
  settings_account_manage: '日程账号管理',
  settings_section_calendar: '月盘设置',
  settings_week_start: '一周开始日',
  settings_show_extend_month: '显示跨月日期',
  settings_show_week_number: '显示周数',
  settings_section_features: '功能设置',
  settings_horoscope: '星座运势',
  settings_almanac: '显示黄历宜忌',
  settings_global_holidays: '全球节日',
  settings_other_calendars: '其他历法',
  settings_smart_extract: '智能提取日程',
  settings_section_reminder: '提醒设置',
  settings_reminder: '日程提醒设置',
  settings_default_reminder: '默认提前提醒时间',
  settings_default_allday_reminder: '默认全天提醒时间',
  settings_default_later_reminder: '默认稍后提醒时间',
  settings_holiday_reminder: '节日提醒',
  settings_section_other: '其他设置',
  settings_show_rejected: '显示已拒绝日程',
  settings_auto_import_birthday: '自动导入联系人生日',
  settings_holiday_data: '法定节假日数据更新',
  settings_timezone: '日程时区设置',
  settings_ux_plan: '用户体验计划',
  settings_privacy: '隐私与权限',
  settings_about: '关于日历',

  // Date calculate page
  calculate_tab_calc: '日期推算',
  calculate_tab_interval: '日期间隔',
  calculate_start_date: '开始日期',
  calculate_end_date: '结束日期',
  calculate_input_days: '请输入天数',
  calculate_days_after: '天后',
  calculate_days_before: '天前',
  calculate_start: '开始推算',
  calculate_result: '结果',
  calculate_jump: '跳转',
  calculate_select_date: '选择要跳转的日期',
  calculate_interval_result_prefix: '相差 ',

  // Common
  cancel: '取消',
  close: '关闭',
  day_unit: '天',

  // Grid badges
  badge_work: '班',
  badge_rest: '休',

  // Weekday labels
  weekday_mon: '一',
  weekday_tue: '二',
  weekday_wed: '三',
  weekday_thu: '四',
  weekday_fri: '五',
  weekday_sat: '六',
  weekday_sun: '日',

  // Event detail page
  detail_notes_label: '备注',
  detail_alarm_suffix: '（闹钟提醒）',

  // Reminder option labels (action sheet + computed labels)
  remind_none: '不提醒',
  remind_5_min_before: '提前5分钟',
  remind_15_min_before: '提前15分钟',
  remind_30_min_before: '提前30分钟',
  remind_1_hour_before: '提前1小时',
  remind_1_day_before: '提前1天',
  remind_before_prefix: '提前',
  remind_before_suffix_min: '分钟',

  // Settings page reminder value labels
  settings_reminder_val_5_min: '5分钟前',
  settings_reminder_val_15_min: '15分钟前',
  settings_reminder_val_30_min: '30分钟前',
  settings_reminder_val_1_hour: '1小时前',
  settings_reminder_val_1_day: '1天前',
  settings_allday_0: '当天0:00',
  settings_allday_9: '当天9:00',
  settings_allday_prev_9: '前一天9:00',
  settings_later_5_min: '5分钟后',
  settings_later_10_min: '10分钟后',
  settings_later_30_min: '30分钟后',
  settings_later_1_hour: '1小时后',
  week_start_sunday: '星期日',
  week_start_monday: '星期一',

  // New event page toast messages
  toast_invalid_start_time: '请输入正确的开始时间（如 09:00）',
  toast_invalid_end_time: '请输入正确的结束时间（如 10:00）',

  // Subscription page
  sub_holiday: '节假日',
  sub_holiday_desc: '订阅法定节假日与调休信息（含班/休标记）。',
  sub_almanac: '黄历',
  sub_almanac_desc: '订阅黄历宜忌/时辰等信息（原版对应黄历详情页与开关）。',
  sub_horoscope: '星座运势',
  sub_horoscope_desc: '订阅星座运势卡片（原版在"功能设置"中可开启）。',
  sub_traffic: '限行',
  sub_traffic_desc: '订阅城市限行提醒（原版包含限行设置/详情页）。',
  sub_shift: '班表',
  sub_shift_desc: '订阅轮班/排班提醒（原版包含班表设置/详情页）。',

  // Home page
  home_share_toast: '已生成分享内容（仿真）',

  // Month short names (used in year view)
  month_1: '1月',
  month_2: '2月',
  month_3: '3月',
  month_4: '4月',
  month_5: '5月',
  month_6: '6月',
  month_7: '7月',
  month_8: '8月',
  month_9: '9月',
  month_10: '10月',
  month_11: '11月',
  month_12: '12月',
} as const;

export type StringKey = keyof typeof strings;
