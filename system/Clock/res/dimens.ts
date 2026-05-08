// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [status_bar] 顶部状态栏

  // [icon sizes]
  icSizeTab: 24,
  icSizeNav: 20,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icSizeNavSheet: 26,  // px — bottom-sheet modal back button
  icStrokeWidth: 2,    // standard Ic* stroke width
  icSizeChevron: 18,   // list/settings trailing chevron (IcNavForward)

  // [tabbar] 底部标签栏 (TabBar)

  // [alarm_page] 闹钟页 (AlarmPage)

  // [wheel] 时间滚轮 (WheelColumn)
  wheel_item_height_large: 56,     // 大型滚轮（计时页）h-14 = 56px
  wheel_item_height_medium: 48,    // 中型滚轮（闹钟编辑页）h-12 = 48px
  wheel_item_height_small: 40,     // 小型滚轮 h-10 = 40px
  wheel_pad_height_large: 112,     // 大型滚轮填充高度 = 2×56（使选中项居于 5 行中间）
  wheel_pad_height_medium: 96,     // 中型滚轮填充高度 = 2×48（使选中项居于 5 行中间）
  wheel_pad_height_small: 80,      // 小型滚轮填充高度 = 2×40（使选中项居于 5 行中间）
  wheel_width_large: 100,          // 大型滚轮宽度 (w-[100px])
  wheel_width_medium: 96,          // 中型滚轮宽度 (w-[96px])
  wheel_width_small: 90,           // 小型滚轮宽度 (w-[90px])
  wheel_height_large: 280,         // 大型滚轮可视高度 = 5×56，选中项居中
  wheel_height_medium: 240,        // 中型滚轮可视高度 = 5×48，选中项居中
  wheel_height_small: 200,         // 小型滚轮可视高度 = 5×40，选中项居中

  // [alarm_editor_sheet] 闹钟编辑底部面板

  // [alarm_edit_modal] 修改闹钟弹框 (AlarmEditModal)

  // [analog_clock] 模拟时钟 (AnalogClock)

  // [world_clock_page] 世界时钟页

  // [city_selector] 城市选择页 (CitySelectorPage)

  // [stopwatch] 秒表页 (StopwatchPage)
  stopwatch_lap_height: 60,        // 单圈次行高 (h-[60px])

  // [timer] 计时页 (TimerPage)
  timer_ring_size: 240,            // 计时环容器尺寸 (w-[240px] h-[240px])

  // [toast] 提示气泡
} as const;
