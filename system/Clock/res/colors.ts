// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [alarm] 闹钟页面

  // [switch] 开关控件

  // [analog_clock] 模拟时钟 (WorldClockPage > AnalogClock)
  clock_tick_minor: 'rgba(255,255,255,0.45)', // 次刻度线

  // [world_clock] 世界时钟

  // [search_bar] 城市选择搜索框

  // [stopwatch] 秒表

  // [timer] 计时

  // [sheet] 底部弹出面板通用
  sheet_overlay: 'rgba(0,0,0,0.30)',       // 面板背景遮罩

  // [tabbar] 底部标签栏

  // [toast] 提示气泡

  // [modal] 修改闹钟弹出框 (AlarmEditModal)
  modal_overlay: 'rgba(0,0,0,0.25)',

  // [wheel] 时间滚轮
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
