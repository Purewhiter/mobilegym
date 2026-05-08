import * as TimeService from '@/os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export type TencentMeetingStrings = typeof strings;

type TimezoneOption = {
  zh: string;
  en: string;
};

const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { zh: '(GMT-12:00) 国际日期变更线西', en: '(GMT-12:00) International Date Line West' },
  { zh: '(GMT-11:00) 协调世界时-11', en: '(GMT-11:00) Coordinated Universal Time -11' },
  { zh: '(GMT-11:00) 萨摩亚标准时间', en: '(GMT-11:00) Samoa Standard Time' },
  { zh: '(GMT-10:00) 夏威夷标准时间', en: '(GMT-10:00) Hawaii Standard Time' },
  { zh: '(GMT-09:30) 马克萨斯群岛时间', en: '(GMT-09:30) Marquesas Islands Time' },
  { zh: '(GMT-09:00) 阿拉斯加标准时间', en: '(GMT-09:00) Alaska Standard Time' },
  { zh: '(GMT-08:00) 太平洋标准时间 - 洛杉矶', en: '(GMT-08:00) Pacific Standard Time - Los Angeles' },
  { zh: '(GMT-08:00) 太平洋标准时间 - 温哥华', en: '(GMT-08:00) Pacific Standard Time - Vancouver' },
  { zh: '(GMT-07:00) 山地标准时间 - 丹佛', en: '(GMT-07:00) Mountain Standard Time - Denver' },
  { zh: '(GMT-07:00) 山地标准时间 - 凤凰城', en: '(GMT-07:00) Mountain Standard Time - Phoenix' },
  { zh: '(GMT-06:00) 中部标准时间 - 芝加哥', en: '(GMT-06:00) Central Standard Time - Chicago' },
  { zh: '(GMT-06:00) 中部标准时间 - 墨西哥城', en: '(GMT-06:00) Central Standard Time - Mexico City' },
  { zh: '(GMT-05:00) 东部标准时间 - 纽约', en: '(GMT-05:00) Eastern Standard Time - New York' },
  { zh: '(GMT-05:00) 东部标准时间 - 多伦多', en: '(GMT-05:00) Eastern Standard Time - Toronto' },
  { zh: '(GMT-05:00) 哥伦比亚标准时间', en: '(GMT-05:00) Colombia Standard Time' },
  { zh: '(GMT-04:30) 委内瑞拉标准时间', en: '(GMT-04:30) Venezuela Standard Time' },
  { zh: '(GMT-04:00) 大西洋标准时间', en: '(GMT-04:00) Atlantic Standard Time' },
  { zh: '(GMT-04:00) 智利标准时间', en: '(GMT-04:00) Chile Standard Time' },
  { zh: '(GMT-03:30) 纽芬兰标准时间', en: '(GMT-03:30) Newfoundland Standard Time' },
  { zh: '(GMT-03:00) 巴西利亚标准时间', en: '(GMT-03:00) Brasilia Standard Time' },
  { zh: '(GMT-03:00) 阿根廷标准时间 - 布宜诺斯艾利斯', en: '(GMT-03:00) Argentina Standard Time - Buenos Aires' },
  { zh: '(GMT-02:00) 协调世界时-02', en: '(GMT-02:00) Coordinated Universal Time -02' },
  { zh: '(GMT-01:00) 亚速尔群岛标准时间', en: '(GMT-01:00) Azores Standard Time' },
  { zh: '(GMT-01:00) 佛得角标准时间', en: '(GMT-01:00) Cape Verde Standard Time' },
  { zh: '(GMT+00:00) 协调世界时', en: '(GMT+00:00) Coordinated Universal Time' },
  { zh: '(GMT+00:00) 格林威治标准时间 - 伦敦', en: '(GMT+00:00) Greenwich Standard Time - London' },
  { zh: '(GMT+00:00) 西欧标准时间', en: '(GMT+00:00) Western European Standard Time' },
  { zh: '(GMT+01:00) 中欧标准时间 - 柏林', en: '(GMT+01:00) Central European Standard Time - Berlin' },
  { zh: '(GMT+01:00) 中欧标准时间 - 巴黎', en: '(GMT+01:00) Central European Standard Time - Paris' },
  { zh: '(GMT+01:00) 中欧标准时间 - 罗马', en: '(GMT+01:00) Central European Standard Time - Rome' },
  { zh: '(GMT+01:00) 西非标准时间', en: '(GMT+01:00) West Africa Standard Time' },
  { zh: '(GMT+02:00) 东欧标准时间 - 开罗', en: '(GMT+02:00) Eastern European Standard Time - Cairo' },
  { zh: '(GMT+02:00) 东欧标准时间 - 基辅', en: '(GMT+02:00) Eastern European Standard Time - Kyiv' },
  { zh: '(GMT+02:00) 以色列标准时间', en: '(GMT+02:00) Israel Standard Time' },
  { zh: '(GMT+02:00) 南非标准时间', en: '(GMT+02:00) South Africa Standard Time' },
  { zh: '(GMT+03:00) 莫斯科标准时间', en: '(GMT+03:00) Moscow Standard Time' },
  { zh: '(GMT+03:00) 阿拉伯标准时间 - 利雅得', en: '(GMT+03:00) Arabian Standard Time - Riyadh' },
  { zh: '(GMT+03:00) 东非标准时间', en: '(GMT+03:00) East Africa Standard Time' },
  { zh: '(GMT+03:30) 伊朗标准时间', en: '(GMT+03:30) Iran Standard Time' },
  { zh: '(GMT+04:00) 海湾标准时间 - 迪拜', en: '(GMT+04:00) Gulf Standard Time - Dubai' },
  { zh: '(GMT+04:00) 阿塞拜疆标准时间', en: '(GMT+04:00) Azerbaijan Standard Time' },
  { zh: '(GMT+04:30) 阿富汗标准时间', en: '(GMT+04:30) Afghanistan Standard Time' },
  { zh: '(GMT+05:00) 巴基斯坦标准时间', en: '(GMT+05:00) Pakistan Standard Time' },
  { zh: '(GMT+05:00) 叶卡捷琳堡标准时间', en: '(GMT+05:00) Yekaterinburg Standard Time' },
  { zh: '(GMT+05:30) 印度标准时间', en: '(GMT+05:30) India Standard Time' },
  { zh: '(GMT+05:45) 尼泊尔标准时间', en: '(GMT+05:45) Nepal Standard Time' },
  { zh: '(GMT+06:00) 孟加拉标准时间', en: '(GMT+06:00) Bangladesh Standard Time' },
  { zh: '(GMT+06:00) 鄂木斯克标准时间', en: '(GMT+06:00) Omsk Standard Time' },
  { zh: '(GMT+06:30) 缅甸标准时间', en: '(GMT+06:30) Myanmar Standard Time' },
  { zh: '(GMT+07:00) 泰国标准时间 - 曼谷', en: '(GMT+07:00) Thailand Standard Time - Bangkok' },
  { zh: '(GMT+07:00) 越南标准时间', en: '(GMT+07:00) Vietnam Standard Time' },
  { zh: '(GMT+07:00) 克拉斯诺亚尔斯克标准时间', en: '(GMT+07:00) Krasnoyarsk Standard Time' },
  { zh: '(GMT+08:00) 中国标准时间 - 北京', en: '(GMT+08:00) China Standard Time - Beijing' },
  { zh: '(GMT+08:00) 新加坡标准时间', en: '(GMT+08:00) Singapore Standard Time' },
  { zh: '(GMT+08:00) 中国标准时间 - 台北', en: '(GMT+08:00) China Standard Time - Taipei' },
  { zh: '(GMT+08:00) 乌兰巴托标准时间', en: '(GMT+08:00) Ulaanbaatar Standard Time' },
  { zh: '(GMT+08:00) 澳大利亚西部标准时间 - 珀斯', en: '(GMT+08:00) Australian Western Standard Time - Perth' },
  { zh: '(GMT+08:45) 澳大利亚中西部标准时间', en: '(GMT+08:45) Australian Central Western Standard Time' },
  { zh: '(GMT+09:00) 雅库茨克标准时间 - 赤塔', en: '(GMT+09:00) Yakutsk Standard Time - Chita' },
  { zh: '(GMT+09:00) 东帝汶时间', en: '(GMT+09:00) Timor-Leste Time' },
  { zh: '(GMT+09:00) 印度尼西亚东部时间', en: '(GMT+09:00) Indonesia Eastern Time' },
  { zh: '(GMT+09:00) 雅库茨克标准时间 - 汉德加', en: '(GMT+09:00) Yakutsk Standard Time - Khandyga' },
  { zh: '(GMT+09:00) 朝鲜标准时间 - 平壤', en: '(GMT+09:00) Korea Standard Time - Pyongyang' },
  { zh: '(GMT+09:00) 韩国标准时间 - 首尔', en: '(GMT+09:00) Korea Standard Time - Seoul' },
  { zh: '(GMT+09:00) 日本标准时间', en: '(GMT+09:00) Japan Standard Time' },
  { zh: '(GMT+09:00) 雅库茨克标准时间 - 雅库茨克', en: '(GMT+09:00) Yakutsk Standard Time - Yakutsk' },
  { zh: '(GMT+09:00) 帕劳时间', en: '(GMT+09:00) Palau Time' },
  { zh: '(GMT+09:30) 澳大利亚中部标准时间', en: '(GMT+09:30) Australian Central Standard Time' },
  { zh: '(GMT+10:00) 迪蒙迪尔维尔时间', en: '(GMT+10:00) Dumont d\'Urville Time' },
  { zh: '(GMT+10:00) 海参崴标准时间 - 乌斯内拉', en: '(GMT+10:00) Vladivostok Standard Time - Ust-Nera' },
  { zh: '(GMT+10:00) 澳大利亚东部标准时间 - 悉尼', en: '(GMT+10:00) Australian Eastern Standard Time - Sydney' },
  { zh: '(GMT+10:00) 巴布亚新几内亚时间', en: '(GMT+10:00) Papua New Guinea Time' },
  { zh: '(GMT+10:30) 豪勋爵岛标准时间', en: '(GMT+10:30) Lord Howe Island Standard Time' },
  { zh: '(GMT+11:00) 萨哈林标准时间', en: '(GMT+11:00) Sakhalin Standard Time' },
  { zh: '(GMT+11:00) 所罗门群岛时间', en: '(GMT+11:00) Solomon Islands Time' },
  { zh: '(GMT+11:00) 瓦努阿图标准时间', en: '(GMT+11:00) Vanuatu Standard Time' },
  { zh: '(GMT+12:00) 新西兰标准时间', en: '(GMT+12:00) New Zealand Standard Time' },
  { zh: '(GMT+12:00) 斐济标准时间', en: '(GMT+12:00) Fiji Standard Time' },
  { zh: '(GMT+12:00) 堪察加标准时间', en: '(GMT+12:00) Kamchatka Standard Time' },
  { zh: '(GMT+13:00) 汤加标准时间', en: '(GMT+13:00) Tonga Standard Time' },
  { zh: '(GMT+13:00) 萨摩亚标准时间', en: '(GMT+13:00) Samoa Standard Time' },
  { zh: '(GMT+14:00) 莱恩群岛时间', en: '(GMT+14:00) Line Islands Time' },
];

const TIMEZONE_ALIASES: TimezoneOption[] = [
  {
    zh: strings.timezone_china_standard,
    en: stringsEn.timezone_china_standard ?? strings.timezone_china_standard,
  },
  ...TIMEZONE_OPTIONS,
];

function pad(value: number, enabled: boolean): string {
  return enabled ? String(value).padStart(2, '0') : String(value);
}

export function isEnglishMeetingStrings(s: TencentMeetingStrings): boolean {
  return s.app_name !== strings.app_name;
}

export function getMeetingWeekdayNames(s: TencentMeetingStrings): string[] {
  return [s.weekday_sun, s.weekday_mon, s.weekday_tue, s.weekday_wed, s.weekday_thu, s.weekday_fri, s.weekday_sat];
}

export function getMeetingListSeparator(s: TencentMeetingStrings): string {
  return isEnglishMeetingStrings(s) ? ', ' : '、';
}

export function formatMeetingMonthDay(
  date: Date,
  s: TencentMeetingStrings,
  options: { padMonth?: boolean; padDay?: boolean } = {},
): string {
  const month = pad(date.getMonth() + 1, options.padMonth ?? false);
  const day = pad(date.getDate(), options.padDay ?? false);
  if (isEnglishMeetingStrings(s)) {
    return `${month}/${day}`;
  }
  return `${month}${s.date_month_suffix}${day}${s.date_day_suffix}`;
}

export function formatMeetingFullDate(
  date: Date,
  s: TencentMeetingStrings,
  options: { padMonth?: boolean; padDay?: boolean } = {},
): string {
  const month = pad(date.getMonth() + 1, options.padMonth ?? true);
  const day = pad(date.getDate(), options.padDay ?? true);
  if (isEnglishMeetingStrings(s)) {
    return `${date.getFullYear()}/${month}/${day}`;
  }
  return `${date.getFullYear()}${s.date_year_suffix}${month}${s.date_month_suffix}${day}${s.date_day_suffix}`;
}

export function formatMeetingHomeDateLabel(timestamp: number, s: TencentMeetingStrings): string {
  const date = TimeService.fromTimestamp(timestamp);
  const today = TimeService.getDate();
  const tomorrow = TimeService.fromTimestamp(today.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const monthDay = formatMeetingMonthDay(date, s);
  if (isSameDay(date, today)) return `${s.home_date_today} ${monthDay}`;
  if (isSameDay(date, tomorrow)) return `${s.home_date_tomorrow} ${monthDay}`;
  return monthDay;
}

export function formatMeetingHistoryDate(timestamp: number, s: TencentMeetingStrings): string {
  const date = TimeService.fromTimestamp(timestamp);
  const weekday = getMeetingWeekdayNames(s)[date.getDay()];
  const monthDay = formatMeetingMonthDay(date, s);
  if (isEnglishMeetingStrings(s)) {
    return `${monthDay} ${weekday} ${date.getFullYear()}`;
  }
  return `${monthDay} ${weekday} ${date.getFullYear()}${s.date_year_suffix}`;
}

export function getDefaultMeetingTimezone(
  s: TencentMeetingStrings,
  variant: 'standard' | 'beijing' = 'standard',
): string {
  return variant === 'beijing' ? s.timezone_china_standard_beijing : s.timezone_china_standard;
}

export function getLocalizedTimezoneList(s: TencentMeetingStrings): string[] {
  return TIMEZONE_OPTIONS.map((option) => (isEnglishMeetingStrings(s) ? option.en : option.zh));
}

export function localizeMeetingTimezone(value: string | undefined, s: TencentMeetingStrings): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return getDefaultMeetingTimezone(s);
  const matched = TIMEZONE_ALIASES.find((option) => option.zh === normalized || option.en === normalized);
  if (!matched) return normalized;
  return isEnglishMeetingStrings(s) ? matched.en : matched.zh;
}
