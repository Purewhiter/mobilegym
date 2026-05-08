/**
 * Clock 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  alarm_default_sound: '默认铃声（萤火虫）',

  // Tabs
  alarm_tab: '闹钟',
  world_clock_tab: '世界时钟',
  stopwatch_tab: '秒表',
  timer_tab: '计时',

  // Alarm list
  alarm_no_alarms: '暂无闹钟',
  alarm_all_off: '所有闹钟已关闭',
  alarm_no_alarm_set: '未设置闹钟',

  // Countdown template parts: ${n}${alarm_rings_in_minutes_suffix} / ${h}${alarm_rings_in_hours_infix}${m}${alarm_rings_in_minutes_suffix}
  alarm_rings_in_minutes_suffix: '分钟后响铃',
  alarm_rings_in_hours_infix: '小时',

  // Repeat options
  alarm_repeat_once: '只响一次',
  alarm_repeat_daily: '每天',
  alarm_repeat_workday: '法定工作日',
  alarm_repeat_workday_sub: '智能跳过节假日',
  alarm_repeat_holiday: '法定节假日',
  alarm_repeat_holiday_sub: '智能跳过工作日',
  alarm_repeat_weekday: '周一至周五',

  // Alarm editor
  alarm_edit_title: '编辑闹钟',
  alarm_add_title: '添加闹钟',
  alarm_modify_title: '修改闹钟',
  alarm_ringtone: '铃声',
  alarm_repeat: '重复',
  alarm_vibrate: '响铃时振动',
  alarm_auto_delete: '响铃后删除此闹钟',
  alarm_note: '备注',
  alarm_note_placeholder: '输入内容',
  alarm_more_settings: '更多设置',
  alarm_done: '完成',
  alarm_hour_label: '时',
  alarm_minute_label: '分',
  alarm_shift: '轮班制',
  alarm_custom: '自定义',

  // World clock
  world_clock_local_time: '本地时间',
  world_clock_select_city: '选择城市',
  world_clock_gmt_label: 'GMT:世界时',
  world_clock_search_placeholder: '输入国家或城市名搜索',

  // Date parts: ${month}${month_suffix}${day}${day_suffix}
  month_suffix: '月',
  day_suffix: '日',

  // Selection mode: ${selected_count_prefix}${n}${selected_count_suffix}
  selected_count_prefix: '已选择',
  selected_count_suffix: '项',

  // Timer
  timer_total_minutes_prefix: '共',
  timer_total_minutes_suffix: '分钟',
  timer_screen_on: '屏幕常亮',

  // Common toolbar
  toolbar_more: '更多',
  toolbar_add: '添加',
  toolbar_delete: '删除',
  cancel: '取消',
  timezone_exists_toast: '该时区已存在。',
} as const;

export type StringKey = keyof typeof strings;
