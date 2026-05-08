import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Weather',

  // ── Common / Status ─────────────────────────────────────────
  loading: 'Loading...',
  locating: 'Locating...',
  location_failed: 'Location failed',
  unknown_location: 'Unknown location',
  unknown_city: 'Unknown city',
  back: 'Back',
  cancel: 'Cancel',
  add: 'Add',

  // ── Home Hero Area ──────────────────────────────────────────
  temp_high: 'High',
  temp_low: 'Low',
  air_quality_prefix: 'Air',
  weather_forecast_pill: 'Forecast',
  safe_to_go_out: 'Safe to go out',

  // ── Precipitation Forecast Card ─────────────────────────────
  precipitation_forecast_title: 'Precipitation',
  no_precipitation_short: 'No significant precipitation expected',

  // ── Video Card ──────────────────────────────────────────────
  cctv_weather_forecast: 'CCTV Weather Forecast',
  cctv_weather_subtitle: 'Follow daily weather updates',

  // ── Hourly Forecast ─────────────────────────────────────────
  hourly_forecast_default_title: '24-hour forecast',
  time_now: 'Now',
  wind_scale_suffix: '',

  // ── 3-Day Forecast ──────────────────────────────────────────
  yesterday: 'Yesterday',
  today: 'Today',
  tomorrow: 'Tomorrow',
  day_sun: 'Sun',
  day_mon: 'Mon',
  day_tue: 'Tue',
  day_wed: 'Wed',
  day_thu: 'Thu',
  day_fri: 'Fri',
  day_sat: 'Sat',
  view_14day_forecast: '15-day forecast',
  view_15day_forecast: '15-day forecast',
  daily_forecast_title: '15-day forecast',

  // ── Details Grid ────────────────────────────────────────────
  uv_label: 'UV Index',
  uv_very_weak: 'Very Low',
  uv_weak: 'Low',
  uv_moderate: 'Moderate',
  uv_strong: 'High',
  uv_very_strong: 'Very High',

  humidity_label: 'Humidity',
  humidity_dry: 'Dry',
  humidity_comfortable: 'Comfortable',
  humidity_humid: 'Humid',

  feels_like_label: 'Feels Like',
  feels_like_extremely_cold: 'Freezing',
  feels_like_very_cold: 'Very Cold',
  feels_like_cold: 'Cold',
  feels_like_cool: 'Cool',
  feels_like_comfortable: 'Comfortable',
  feels_like_hot: 'Hot',
  feels_like_extremely_hot: 'Extreme Heat',

  wind_compass_north: 'N',
  wind_compass_east: 'E',
  wind_compass_south: 'S',
  wind_compass_west: 'W',

  sunrise_label: 'Sunrise',
  sunset_label: 'Sunset',

  pressure_label: 'Pressure',

  // ── Weather Condition Text (skycon) ─────────────────────────
  weather_clear: 'Clear',
  weather_partly_cloudy: 'Partly Cloudy',
  weather_cloudy: 'Overcast',
  weather_light_rain: 'Light Rain',
  weather_moderate_rain: 'Moderate Rain',
  weather_heavy_rain: 'Heavy Rain',
  weather_storm_rain: 'Torrential Rain',
  weather_fog: 'Fog',
  weather_light_snow: 'Light Snow',
  weather_moderate_snow: 'Moderate Snow',
  weather_heavy_snow: 'Heavy Snow',
  weather_storm_snow: 'Blizzard',
  weather_light_haze: 'Light Haze',
  weather_moderate_haze: 'Moderate Haze',
  weather_heavy_haze: 'Heavy Haze',
  weather_dust: 'Dust',
  weather_sand: 'Sandstorm',
  weather_wind: 'Gale',

  // ── Wind Direction (16 points) ──────────────────────────────
  wind_dir_n: 'North',
  wind_dir_nne: 'NNE',
  wind_dir_ne: 'NE',
  wind_dir_ene: 'ENE',
  wind_dir_e: 'East',
  wind_dir_ese: 'ESE',
  wind_dir_se: 'SE',
  wind_dir_sse: 'SSE',
  wind_dir_s: 'South',
  wind_dir_ssw: 'SSW',
  wind_dir_sw: 'SW',
  wind_dir_wsw: 'WSW',
  wind_dir_w: 'West',
  wind_dir_wnw: 'WNW',
  wind_dir_nw: 'NW',
  wind_dir_nnw: 'NNW',

  // ── Life Indices ────────────────────────────────────────────
  index_sport: 'Sport',
  index_car_wash: 'Car Wash',
  index_dressing: 'Clothing',
  index_uv: 'UV',
  index_flu: 'Cold & Flu',
  index_category_suitable: 'Suitable',
  index_category_unsuitable: 'Not Suitable',

  // ── Warning Card ────────────────────────────────────────────
  warning_status_active: 'Active',
  warning_just_updated: 'Just updated',
  warning_minutes_ago: 'min ago',
  warning_1hour_ago: '1 hour ago',
  warning_hours_ago: 'hours ago',
  warning_today_updated: 'Updated today',
  warning_1day_ago: '1 day ago',
  warning_days_ago: 'days ago',
  warning_weeks_ago: 'weeks ago',
  warning_updated: 'Updated',

  // ── Footer ──────────────────────────────────────────────────
  data_source_caiyun: 'Partial weather data from QWeather',

  // ── Settings Page ───────────────────────────────────────────
  settings_title: 'Settings',
  settings_category_alerts: 'Weather Alerts',
  settings_morning_evening_alert: 'Morning & Evening Alerts',
  settings_morning_evening_alert_summary: 'Receive weather push notifications around 7:00 AM / 7:00 PM',
  settings_warning_alert: 'Severe Weather Alerts',
  settings_warning_alert_summary: 'Receive meteorological disaster warning notifications',
  settings_abnormal_weather_alert: 'Abnormal Weather Alerts',
  settings_abnormal_weather_alert_summary: 'Get notifications for rain, air quality, and other weather changes',
  settings_night_dnd: 'Night Do-Not-Disturb',
  settings_night_dnd_summary: 'Block weather notifications from 11 PM to 7 AM',
  settings_category_units: 'Units',
  settings_temp_unit: 'Temperature Unit',
  settings_temp_unit_celsius: 'Celsius °C',
  settings_temp_unit_fahrenheit: 'Fahrenheit °F',
  settings_wind_unit: 'Wind Unit',
  settings_wind_unit_beaufort: 'Beaufort scale',
  settings_wind_unit_kmh: 'km/h',
  settings_wind_unit_ms: 'm/s',
  settings_wind_unit_mph: 'mph',
  settings_wind_unit_kn: 'Knots (kn)',
  settings_pressure_unit: 'Pressure Unit',
  settings_pressure_unit_hpa: 'hPa',
  settings_pressure_unit_mmhg: 'mmHg',
  settings_pressure_unit_inhg: 'inHg',
  settings_category_other: 'Other Settings',
  settings_night_auto_update: 'Night Auto-Update',
  settings_night_auto_update_summary: 'When off, weather will not auto-refresh from 11 PM to 7 AM',
  settings_category_about: 'About Weather',
  settings_user_experience: 'User Experience Program',
  settings_feedback: 'Feedback',
  settings_privacy_policy: 'Privacy Policy',
  settings_revoke_consent: 'Revoke Consent',
  settings_revoke_consent_summary: 'Stop collecting and using your personal information after revoking',
  settings_privacy_settings: 'Privacy Settings',

  // ── Home Menu ─────────────────────────────────────────────
  menu_feedback_weather: 'Weather Feedback',
  menu_settings: 'Settings',

  // ── City Manager Page ───────────────────────────────────────
  city_manager_title: 'Manage Cities',
  city_manager_search_placeholder: 'Search location',
  city_manager_current_location: 'Current Location',
  city_manager_added_cities: 'Added Cities',

  // ── City Search Page ────────────────────────────────────────
  city_search_major_cities: 'Major Cities',
  city_search_no_results: 'No cities found',
  city_search_country: 'China',
  city_search_history: 'Search History',
  city_search_clear_history: 'Clear search history',

  // ── City Manager Button Aria ────────────────────────────────
  aria_city_manager: 'Manage cities',
  aria_more_settings: 'More settings',
  aria_search_location: 'Search location',

  // ── Privacy Policy Page ─────────────────────────────────────
  privacy_title: 'Privacy Policy',
  privacy_view_policy: 'View Privacy Policy',
  privacy_third_party_data: 'Third-Party Data Sharing',
  privacy_category_permissions: 'Permissions',
  privacy_permissions_detail: 'Permission Details',
  privacy_category_revoke: 'Revoke Consent',
  privacy_revoke_consent: 'Revoke Privacy Policy Consent',
  privacy_customer_service: 'Customer Service: 400-100-5678',

  // ── Permissions Page ────────────────────────────────────────
  permissions_title: 'Permissions',
  permissions_location: 'Location Access',
  permissions_location_summary: 'Display weather information for your current location',
  permissions_notification: 'Notification Access',
  permissions_notification_summary: 'Push notifications for abnormal weather and disaster warnings',

  // ── Air Quality Detail Page ─────────────────────────────────
  aqi_title: 'Air Quality',
  aqi_publish_suffix: 'Published',
  aqi_level_excellent: 'Excellent',
  aqi_level_good: 'Good',
  aqi_level_light: 'Light',
  aqi_level_moderate: 'Moderate',
  aqi_level_heavy: 'Heavy',
  aqi_level_severe: 'Severe',
  aqi_desc_excellent: 'Air quality is satisfactory, with essentially no air pollution',
  aqi_desc_good: 'Air quality is acceptable, but may pose a moderate health concern for a very small number of unusually sensitive individuals',
  aqi_desc_light: 'Sensitive individuals may experience mild aggravation of symptoms',
  aqi_desc_moderate: 'May affect heart and respiratory systems of the general public',
  aqi_desc_heavy: 'Significantly aggravated symptoms for sensitive groups, general public may experience symptoms',
  aqi_desc_severe: 'Health alert: everyone may experience more serious health effects',
  aqi_hourly_title: '24-Hour AQI Forecast',
  aqi_nearby_title: 'Nearby Air Quality',
  nearby_station_sijihuahai: 'Sijihua Sea',
  nearby_station_fengjiayu: 'Fengjiayu Town',

  // ── Date Formatting ─────────────────────────────────────────
  date_month_day: '/',
  date_day_suffix: '',
};
