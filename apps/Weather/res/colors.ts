// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [card] 卡片背景
  card_surface: 'rgba(30, 42, 66, 0.30)',        // 通用暗玻璃卡片背景
  card_surface_light: 'rgba(30, 42, 66, 0.28)',  // daily/life 卡片背景：亮背景上提升分层
  card_surface_detail: 'rgba(30, 42, 66, 0.28)', // detail grid 卡片背景
  card_surface_warning: 'rgba(30, 42, 66, 0.28)', // warning card 背景
  card_border: 'rgba(255,255,255,0.06)',         // 通用卡片描边
  card_action_surface: 'rgba(255,255,255,0.06)', // 卡片内次级按钮背景

  // [overlay] 遮罩/渐变
  overlay_top_light: 'rgba(255,255,255,0.05)',   // 卡片顶光渐变起点 (HourlyForecastChart)
  overlay_bg_gradient_mid: 'rgba(0,0,0,0.22)',   // 标题栏附加渐变起点 (WeatherApp)
  overlay_bg_gradient_end: 'rgba(0,0,0,0.05)',   // 标题栏附加渐变中段 (WeatherApp)
  overlay_titlebar_blur: 'rgba(0,0,0,0.16)',     // 标题栏模糊底色 (WeatherApp)

  // [divider] 分隔线
  divider_daily: 'rgba(255,255,255,0.10)',       // 三日预报分隔线 (DailyForecastShort)

  // [pill] 胶囊按钮
  pill_bg_main: 'rgba(255,255,255,0.14)',        // 主页胶囊背景 (WeatherApp bg-white/[0.14])
  pill_bg_action: 'rgba(255,255,255,0.15)',      // 预览页顶部操作按钮背景

  // [chart] 折线图
  chart_line_stroke: 'rgba(103,232,249,0.7)',    // 小时预报曲线色 (HourlyForecastChart)
  chart_dot_stroke: 'rgba(103,232,249,0.9)',     // "现在"高亮点描边
  chart_section_bg: 'rgba(30, 42, 66, 0.30)',   // 小时预报卡片背景

  // [temp_bar] 温度条
  temp_bar_track: 'rgba(255,255,255,0.20)',      // 温度条轨道 (DailyForecastShort)

  // [precipitation] 降水预报卡
  precip_bg_start: 'rgba(96,165,250,0.30)',   // from-blue-400/30
  precip_bg_end: 'rgba(192,132,252,0.30)',    // to-purple-400/30

  // [warning] 预警严重程度图标
  warning_dot_active: 'rgba(255,255,255,0.60)',  // 指示器激活
  warning_dot_inactive: 'rgba(255,255,255,0.20)', // 指示器未激活

  // [city_indicator] 城市翻页指示器 (WeatherApp)
  indicator_inactive: 'rgba(255,255,255,0.35)',

  // [city_manager] 城市管理页 (WeatherCityManagerPage)
  city_manager_card_text: 'rgba(255,255,255,0.85)', // 天气/高低温副文字 (text-white/85)

  // [forecast_play] 天气预报播放按钮
  forecast_play_icon_bg: 'rgba(255,255,255,0.80)',
  forecast_play_icon: '#5c7cfa',
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
