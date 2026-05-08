/**
 * Weather 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '天气',

  // ── 通用 / 状态 ──────────────────────────────────────────────
  loading: '加载中...',
  locating: '定位中...',
  location_failed: '定位失败',
  unknown_location: '未知位置',
  unknown_city: '未知城市',
  back: '返回',
  cancel: '取消',
  add: '添加',

  // ── 主页面 Hero 区 ──────────────────────────────────────────
  temp_high: '最高',
  temp_low: '最低',
  air_quality_prefix: '空气',
  weather_forecast_pill: '天气预报',
  safe_to_go_out: '放心出行吧',

  // ── 降水预报卡片 ────────────────────────────────────────────
  precipitation_forecast_title: '降水预报',
  no_precipitation_short: '短时内无明显降水',

  // ── 视频卡片 ────────────────────────────────────────────────
  cctv_weather_forecast: '央视天气预报',
  cctv_weather_subtitle: '关注每日实况天气',

  // ── 小时预报 ────────────────────────────────────────────────
  hourly_forecast_default_title: '未来24小时预报',
  time_now: '现在',
  wind_scale_suffix: '级',

  // ── 三日预报 ────────────────────────────────────────────────
  yesterday: '昨天',
  today: '今天',
  tomorrow: '明天',
  day_sun: '周日',
  day_mon: '周一',
  day_tue: '周二',
  day_wed: '周三',
  day_thu: '周四',
  day_fri: '周五',
  day_sat: '周六',
  view_14day_forecast: '查看近15日天气',
  view_15day_forecast: '查看近15日天气',
  daily_forecast_title: '15日天气预报',

  // ── 详情网格（DetailsGrid）──────────────────────────────────
  uv_label: '紫外线',
  uv_very_weak: '很弱',
  uv_weak: '弱',
  uv_moderate: '中',
  uv_strong: '强',
  uv_very_strong: '很强',

  humidity_label: '湿度',
  humidity_dry: '干燥',
  humidity_comfortable: '舒适',
  humidity_humid: '潮湿',

  feels_like_label: '体感',
  feels_like_extremely_cold: '极冷',
  feels_like_very_cold: '很冷',
  feels_like_cold: '冷',
  feels_like_cool: '凉爽',
  feels_like_comfortable: '舒适',
  feels_like_hot: '热',
  feels_like_extremely_hot: '极热',

  wind_compass_north: '北',
  wind_compass_east: '东',
  wind_compass_south: '南',
  wind_compass_west: '西',

  sunrise_label: '日出',
  sunset_label: '日落',

  pressure_label: '气压',

  // ── 天气状况文字（skycon → 中文）──────────────────────────
  weather_clear: '晴',
  weather_partly_cloudy: '多云',
  weather_cloudy: '阴',
  weather_light_rain: '小雨',
  weather_moderate_rain: '中雨',
  weather_heavy_rain: '大雨',
  weather_storm_rain: '暴雨',
  weather_fog: '雾',
  weather_light_snow: '小雪',
  weather_moderate_snow: '中雪',
  weather_heavy_snow: '大雪',
  weather_storm_snow: '暴雪',
  weather_light_haze: '轻度雾霾',
  weather_moderate_haze: '中度雾霾',
  weather_heavy_haze: '重度雾霾',
  weather_dust: '浮尘',
  weather_sand: '沙尘',
  weather_wind: '大风',

  // ── 风向（16 方位）───────────────────────────────────────
  wind_dir_n: '北风',
  wind_dir_nne: '北东北风',
  wind_dir_ne: '东北风',
  wind_dir_ene: '东东北风',
  wind_dir_e: '东风',
  wind_dir_ese: '东东南风',
  wind_dir_se: '东南风',
  wind_dir_sse: '南东南风',
  wind_dir_s: '南风',
  wind_dir_ssw: '南西南风',
  wind_dir_sw: '西南风',
  wind_dir_wsw: '西西南风',
  wind_dir_w: '西风',
  wind_dir_wnw: '西西北风',
  wind_dir_nw: '西北风',
  wind_dir_nnw: '北西北风',

  // ── 生活指数（LifeIndices / weatherService）──────────────
  index_sport: '运动',
  index_car_wash: '洗车',
  index_dressing: '穿衣',
  index_uv: '紫外线',
  index_flu: '感冒',
  index_category_suitable: '适宜',
  index_category_unsuitable: '不宜',

  // ── 预警卡片（WarningCard）──────────────────────────────────
  warning_status_active: '预警中',
  warning_just_updated: '刚刚更新',
  warning_minutes_ago: '分钟前更新',
  warning_1hour_ago: '1小时前更新',
  warning_hours_ago: '小时前更新',
  warning_today_updated: '今天更新',
  warning_1day_ago: '1天前更新',
  warning_days_ago: '天前更新',
  warning_weeks_ago: '周前更新',
  warning_updated: '已更新',

  // ── 页脚 ────────────────────────────────────────────────────
  data_source_caiyun: '部分气象数据来自 和风天气',

  // ── 设置页（WeatherSettingsPage）────────────────────────────
  settings_title: '设置',
  settings_category_alerts: '天气提醒',
  settings_morning_evening_alert: '早晚天气提醒',
  settings_morning_evening_alert_summary: '开启后，7:00/19:00 左右将会收到今天/明天天气推送',
  settings_warning_alert: '天气预警提醒',
  settings_warning_alert_summary: '开启后，将会收到气象灾害预警推送',
  settings_abnormal_weather_alert: '异常天气提醒',
  settings_abnormal_weather_alert_summary: '开启后，在降雨、空气质量等天气变化时收到推送',
  settings_night_dnd: '夜间免打扰',
  settings_night_dnd_summary: '开启后，23:00-次日7:00将屏蔽天气推送',
  settings_category_units: '单位',
  settings_temp_unit: '温度单位',
  settings_temp_unit_celsius: '摄氏度°C',
  settings_temp_unit_fahrenheit: '华氏度°F',
  settings_wind_unit: '风力单位',
  settings_wind_unit_beaufort: '蒲福风力等级 (Beaufort scale)',
  settings_wind_unit_kmh: '千米每小时 (km/h)',
  settings_wind_unit_ms: '米每秒 (m/s)',
  settings_wind_unit_mph: '英里每小时 (mph)',
  settings_wind_unit_kn: '节 (kn)',
  settings_pressure_unit: '气压单位',
  settings_pressure_unit_hpa: 'hPa',
  settings_pressure_unit_mmhg: 'mmHg',
  settings_pressure_unit_inhg: 'inHg',
  settings_category_other: '其他设置',
  settings_night_auto_update: '夜间自动更新',
  settings_night_auto_update_summary: '关闭后，23:00-次日7:00将不会自动联网更新天气',
  settings_category_about: '关于天气',
  settings_user_experience: '用户体验计划',
  settings_feedback: '意见反馈',
  settings_privacy_policy: '隐私政策',
  settings_revoke_consent: '撤回同意',
  settings_revoke_consent_summary: '撤回后将停止收集和使用您的个人信息',
  settings_privacy_settings: '隐私设置',

  // ── 首页更多菜单（HomeMenu）────────────────────────────────
  menu_feedback_weather: '反馈天气',
  menu_settings: '设置',

  // ── 城市管理页（WeatherCityManagerPage）─────────────────────
  city_manager_title: '城市管理',
  city_manager_search_placeholder: '搜索位置',
  city_manager_current_location: '当前定位',
  city_manager_added_cities: '已添加城市',

  // ── 城市搜索页（WeatherCitySearchPage）──────────────────────
  city_search_major_cities: '全国主要城市',
  city_search_no_results: '没有找到相关城市',
  city_search_country: '中国',
  city_search_history: '搜索历史',
  city_search_clear_history: '清除搜索历史',

  // ── 城市管理按钮 aria ───────────────────────────────────────
  aria_city_manager: '城市管理',
  aria_more_settings: '更多设置',
  aria_search_location: '搜索位置',

  // ── 隐私政策页（WeatherPrivacySettingsPage）─────────────────
  privacy_title: '隐私政策',
  privacy_view_policy: '查看隐私政策',
  privacy_third_party_data: '第三方数据共享说明',
  privacy_category_permissions: '权限相关',
  privacy_permissions_detail: '权限说明',
  privacy_category_revoke: '撤回同意',
  privacy_revoke_consent: '隐私政策撤回同意',
  privacy_customer_service: '客服热线：400-100-5678',

  // ── 权限说明页（WeatherPermissionsPage）─────────────────────
  permissions_title: '权限说明',
  permissions_location: '获取定位',
  permissions_location_summary: '用于展示您当前定位的天气信息',
  permissions_notification: '通知管理',
  permissions_notification_summary: '为您推送异常天气、气象灾害提醒',

  // ── 空气质量详情页 ────────────────────────────────────────────
  aqi_title: '空气质量',
  aqi_publish_suffix: '发布',
  aqi_level_excellent: '优',
  aqi_level_good: '良',
  aqi_level_light: '轻度',
  aqi_level_moderate: '中度',
  aqi_level_heavy: '重度',
  aqi_level_severe: '严重',
  aqi_desc_excellent: '空气质量令人满意，基本无空气污染',
  aqi_desc_good: '空气质量可以接受，可能对少数异常敏感的人群健康有较弱影响',
  aqi_desc_light: '易感人群症状有轻度加剧，健康人群出现刺激症状',
  aqi_desc_moderate: '进一步加剧易感人群症状，可能对健康人群心脏、呼吸系统有影响',
  aqi_desc_heavy: '心脏病和肺病患者症状显著加剧，运动耐受力降低，健康人群普遍出现症状',
  aqi_desc_severe: '健康人群运动耐受力降低，有明显强烈症状，提前出现某些疾病',
  aqi_hourly_title: '24小时空气质量预报',
  aqi_nearby_title: '附近空气质量',
  nearby_station_sijihuahai: '四季花海',
  nearby_station_fengjiayu: '冯家峪镇',

  // ── 日期格式化 ──────────────────────────────────────────────
  date_month_day: '月',
  date_day_suffix: '日',
} as const;

export type StringKey = keyof typeof strings;
