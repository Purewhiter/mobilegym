import type { strings } from '../res/strings';

type MapStrings = typeof strings;

export function localizeMapSettingValue(value: string | null, s: MapStrings): string {
  switch (value) {
    case null:
      return s.language_system_default;
    case '始终采用浅色主题':
      return s.theme_light;
    case '始终采用深色主题':
      return s.theme_dark;
    case '与设备主题背景一致':
      return s.theme_device;
    case '自动':
      return s.distance_unit_auto;
    case '公里':
      return s.distance_unit_km;
    case '英里':
      return s.distance_unit_miles;
    case '缩放时':
      return s.scale_bar_on_zoom;
    case '始终':
      return s.scale_bar_always;
    case '自动播放功能已关闭':
      return s.video_autoplay_off;
    case '始终开启自动播放功能':
      return s.video_autoplay_always;
    case '仅在连接到 Wi-Fi 时自动播放':
      return s.video_autoplay_wifi;
    case '仅通过 WLAN 网络':
      return s.offline_wlan_only;
    case '通过 WLAN 或移动网络':
      return s.offline_wlan_or_mobile;
    case '开启':
      return s.setting_on;
    case '关闭':
      return s.setting_off;
    case '仅限应用':
      return s.setting_app_only;
    default:
      return value;
  }
}
