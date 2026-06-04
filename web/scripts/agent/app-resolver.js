// App name resolution for AWAKE/open-app actions.
//
// This mirrors bench_env.env.mobile_gym.MobileGymEnv.APP_NAME_MAP. Unknown
// names are ignored instead of guessed, matching bench_env's _open_app().

export const APP_NAME_MAP = {
  设置: 'settings', Settings: 'settings',
  相册: 'gallery', Gallery: 'gallery',
  文件: 'file_manager', 文件管理: 'file_manager', 'File Manager': 'file_manager',
  计算器: 'calculator', Calculator: 'calculator', 计算器2: 'calculator2',
  时钟: 'clock', Clock: 'clock',
  通讯录: 'contacts', 联系人: 'contacts', Contacts: 'contacts',
  笔记: 'notes', 备忘录: 'notes', Notes: 'notes',
  指南针: 'compass', Compass: 'compass',
  电话: 'phone', Phone: 'phone',
  浏览器: 'browser', Browser: 'browser',
  相机: 'camera', Camera: 'camera',
  微信: 'wechat', WeChat: 'wechat',
  天气: 'weather', Weather: 'weather',
  微信读书: 'wechat_reading', 'WeChat Reading': 'wechat_reading',
  哔哩哔哩: 'bilibili', B站: 'bilibili', Bilibili: 'bilibili',
  腾讯会议: 'tencent_meeting', 'Tencent Meeting': 'tencent_meeting',
  QQ音乐: 'qqmusic', QQMusic: 'qqmusic', 'QQ Music': 'qqmusic',
  支付宝: 'alipay', Alipay: 'alipay',
  地图: 'map', Map: 'map', 谷歌地图: 'map', 'Google Maps': 'map',
  小红书: 'redbook', RedNote: 'redbook',
  Spotify: 'spotify',
  X: 'x', Twitter: 'x',
  Reddit: 'reddit',
  短信: 'sms', SMS: 'sms',
  日历: 'calendar', Calendar: 'calendar',
  主题商店: 'theme_store', 'Theme Store': 'theme_store',
  铁路12306: 'railway12306', '12306': 'railway12306',
  eBay: 'ebay', Ebay: 'ebay',
  答题卡: 'answer_sheet', 'Answer Sheet': 'answer_sheet', AnswerSheet: 'answer_sheet',
};

const KNOWN_APP_IDS = new Set(Object.values(APP_NAME_MAP));

export function resolveAppId(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (APP_NAME_MAP[raw]) return APP_NAME_MAP[raw];

  const lower = raw.toLowerCase();
  for (const [label, appId] of Object.entries(APP_NAME_MAP)) {
    if (label.toLowerCase() === lower) return appId;
  }
  return KNOWN_APP_IDS.has(lower) ? lower : '';
}
