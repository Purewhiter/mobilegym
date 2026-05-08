/**
 * 天气图标映射工具
 * 将和彩云 / 和风兼容的天气代码或中文描述映射到反编译的真实天气图标
 */

// ── 天气条件图标 (来自反编译资源 drawable-xxhdpi) ──
import iconSunny from '../assets/weather-icons/icon_sunny.webp';
import iconSunnyNight from '../assets/weather-icons/icon_sunny_night.webp';
import iconCloudy from '../assets/weather-icons/icon_cloudy.webp';
import iconCloudyNight from '../assets/weather-icons/icon_cloudy_night.webp';
import iconOvercast from '../assets/weather-icons/icon_overcast.webp';
import iconLightRain from '../assets/weather-icons/icon_light_rain.webp';
import iconModerateRain from '../assets/weather-icons/icon_moderate_rain.webp';
import iconHeavyRain from '../assets/weather-icons/icon_heavy_rain.webp';
import iconLightSnow from '../assets/weather-icons/icon_light_snow.webp';
import iconModerateSnow from '../assets/weather-icons/icon_moderate_snow.webp';
import iconHeavySnow from '../assets/weather-icons/icon_heavy_snow.webp';
import iconTStorm from '../assets/weather-icons/icon_t_storm.webp';
import iconFog from '../assets/weather-icons/icon_fog.webp';
import iconFogNight from '../assets/weather-icons/icon_fog_night.webp';
import iconRainSnow from '../assets/weather-icons/icon_rain_snow.webp';
import iconIceRain from '../assets/weather-icons/icon_ice_rain.webp';
import iconSand from '../assets/weather-icons/icon_sand.webp';
import iconFloatDirt from '../assets/weather-icons/icon_float_dirt.webp';

// ── 天气代码 → 图标映射（兼容彩云 skycon 与和风 icon code） ──
const conditionIconMap: Record<string, string> = {
  // 晴
  CLEAR_DAY: iconSunny,
  CLEAR_NIGHT: iconSunnyNight,
  '100': iconSunny,
  '150': iconSunnyNight,
  // 多云
  PARTLY_CLOUDY_DAY: iconCloudy,
  PARTLY_CLOUDY_NIGHT: iconCloudyNight,
  '101': iconCloudy,
  '102': iconCloudy,
  '103': iconCloudy,
  '151': iconCloudyNight,
  '152': iconCloudyNight,
  '153': iconCloudyNight,
  // 阴
  CLOUDY: iconOvercast,
  '104': iconOvercast,
  // 雨
  LIGHT_RAIN: iconLightRain,
  MODERATE_RAIN: iconModerateRain,
  HEAVY_RAIN: iconHeavyRain,
  STORM_RAIN: iconHeavyRain,
  '300': iconLightRain,
  '301': iconLightRain,
  '302': iconModerateRain,
  '303': iconHeavyRain,
  '304': iconTStorm,
  '305': iconLightRain,
  '306': iconModerateRain,
  '307': iconHeavyRain,
  '308': iconHeavyRain,
  '309': iconLightRain,
  '310': iconHeavyRain,
  '311': iconIceRain,
  '312': iconHeavyRain,
  '313': iconRainSnow,
  // 雪
  LIGHT_SNOW: iconLightSnow,
  MODERATE_SNOW: iconModerateSnow,
  HEAVY_SNOW: iconHeavySnow,
  STORM_SNOW: iconHeavySnow,
  '400': iconLightSnow,
  '401': iconModerateSnow,
  '402': iconHeavySnow,
  '403': iconHeavySnow,
  '404': iconRainSnow,
  '405': iconRainSnow,
  '406': iconRainSnow,
  '407': iconLightSnow,
  // 雾
  FOG: iconFog,
  '500': iconFog,
  '501': iconFog,
  // 雾霾
  LIGHT_HAZE: iconFloatDirt,
  MODERATE_HAZE: iconFloatDirt,
  HEAVY_HAZE: iconFloatDirt,
  '502': iconFloatDirt,
  '511': iconFloatDirt,
  '512': iconFloatDirt,
  '513': iconFloatDirt,
  // 沙尘
  DUST: iconFloatDirt,
  SAND: iconSand,
  '503': iconFloatDirt,
  '504': iconSand,
  '507': iconSand,
  '508': iconSand,
  // 大风（无专门图标，使用阴天图标）
  WIND: iconOvercast,
  '499': iconOvercast,
};

/**
 * 根据天气代码获取图标 URL
 * @param skycon - 彩云 skycon 或和风 icon code
 * @returns 图标 URL 字符串
 */
export const getWeatherIconBySkycon = (skycon: string): string => {
  return conditionIconMap[skycon] || iconSunny;
};

/**
 * 根据中文天气描述获取天气图标 URL
 * @param text - 中文天气描述 (如 "晴", "小雨", "多云")
 * @param isNight - 是否夜间（影响晴/多云/雾的图标选择）
 * @returns 图标 URL 字符串
 */
export const getWeatherIconByText = (text: string, isNight = false): string => {
  const normalized = String(text ?? '').trim();
  if (!normalized) return isNight ? iconSunnyNight : iconSunny;

  // 按桌面天气 widget 的天气码语义优先匹配更具体的描述。
  if (normalized.includes('雷') && normalized.includes('雨')) return iconTStorm;
  if (normalized.includes('雨夹雪')) return iconRainSnow;
  if (normalized.includes('冻雨') || normalized.includes('冰雹')) return iconIceRain;
  if (normalized.includes('特大暴雨') || normalized.includes('大暴雨')) return iconHeavyRain;
  if (normalized.includes('暴雨') || normalized.includes('大雨')) return iconHeavyRain;
  if (normalized.includes('中雨')) return iconModerateRain;
  if (normalized.includes('阵雨') || normalized.includes('小雨') || normalized.includes('毛毛雨')) return iconLightRain;
  if (normalized.includes('雨')) return iconModerateRain;
  if (normalized.includes('暴雪') || normalized.includes('大雪')) return iconHeavySnow;
  if (normalized.includes('中雪')) return iconModerateSnow;
  if (normalized.includes('阵雪') || normalized.includes('小雪')) return iconLightSnow;
  if (normalized.includes('雪')) return iconModerateSnow;
  if (normalized.includes('强沙尘暴') || normalized.includes('沙尘暴')) return iconSand;
  if (normalized.includes('浮尘') || normalized.includes('扬尘') || normalized.includes('霾')) return iconFloatDirt;
  if (normalized.includes('扬沙') || normalized.includes('沙尘') || normalized.includes('沙')) return iconSand;
  if (normalized.includes('浓雾') || normalized.includes('雾')) return isNight ? iconFogNight : iconFog;
  if (normalized.includes('阴')) return iconOvercast;
  if (normalized.includes('多云') || normalized.includes('少云') || normalized.includes('云')) {
    return isNight ? iconCloudyNight : iconCloudy;
  }
  if (normalized.includes('晴')) return isNight ? iconSunnyNight : iconSunny;
  return isNight ? iconSunnyNight : iconSunny;
};

/**
 * 智能获取天气图标：优先 skycon 代码，降级到中文文本匹配
 * @param skycon - skycon 代码（可选）
 * @param text - 中文天气描述（可选）
 * @param isNight - 是否夜间
 * @returns 图标 URL 字符串
 */
export const getWeatherIcon = (skycon?: string, text?: string, isNight = false): string => {
  if (skycon && conditionIconMap[skycon]) {
    return conditionIconMap[skycon];
  }
  if (text) {
    return getWeatherIconByText(text, isNight);
  }
  return isNight ? iconSunnyNight : iconSunny;
};

// 导出所有图标常量，供需要直接引用的场景使用
export const WeatherIcons = {
  sunny: iconSunny,
  sunnyNight: iconSunnyNight,
  cloudy: iconCloudy,
  cloudyNight: iconCloudyNight,
  overcast: iconOvercast,
  lightRain: iconLightRain,
  moderateRain: iconModerateRain,
  heavyRain: iconHeavyRain,
  lightSnow: iconLightSnow,
  moderateSnow: iconModerateSnow,
  heavySnow: iconHeavySnow,
  thunderstorm: iconTStorm,
  fog: iconFog,
  fogNight: iconFogNight,
  rainSnow: iconRainSnow,
  iceRain: iconIceRain,
  sand: iconSand,
  floatDirt: iconFloatDirt,
} as const;
