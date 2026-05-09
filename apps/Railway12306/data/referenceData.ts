/**
 * 12306 辅助参考数据
 *
 * 统一导入所有 JSON 数据并导出带类型的接口。
 * 数据作为离线参考配置随模拟环境加载。
 *
 * 小数据（<5KB）保留静态导入；大数据由 loader.ts 异步加载。
 */

import seatTypesData from './reference/seatTypes.json';
import seatTypesByTrainData from './reference/seatTypesByTrain.json';
import ticketTypesData from './reference/ticketTypes.json';
import cardTypesData from './reference/cardTypes.json';
import provincesData from './reference/provinces.json';
import { getStationServicesSync, getCountriesSync, getCityListSync, getCitiesSync } from './loader';

// ─── 类型定义 ─────────────────────────────────────────────────────────

export interface SeatType {
  code: string;
  name: string;
}

export interface SeatTypesByTrain {
  trainHeader: string;
  seatTypes: string;
  displayFlag: string;
}

export interface TicketType {
  code: string;
  name: string;
}

export interface CardType {
  code: string;
  name: string;
}

export interface Province {
  id: string;
  name: string;
}

export interface StationService {
  stationName: string;
  services: string[];
}

export interface Country {
  code: string;
  code3: string;
  name: string;
}

export interface CityListItem {
  cityCode: string;
  cityName: string;
  cityShortPy: string;
}

export interface CityItem {
  adcode: string;
  name: string;
  pinyin: string;
}

export interface CitiesData {
  hot: CityItem[];
  [letter: string]: CityItem[];
}

// ─── 导出数据（小数据直接导入） ─────────────────────────────────────────

/** 座席类型（27 种） */
export const SEAT_TYPES = seatTypesData as SeatType[];

/** 座席 code → name 映射 */
export const SEAT_TYPE_MAP: Record<string, string> = Object.fromEntries(
  SEAT_TYPES.map(s => [s.code, s.name]),
);

/** 车次类型 → 可选座席 */
export const SEAT_TYPES_BY_TRAIN = seatTypesByTrainData as SeatTypesByTrain[];

/** 票种列表（15 种） */
export const TICKET_TYPES = ticketTypesData as TicketType[];

/** 证件类型列表（9 种） */
export const CARD_TYPES = cardTypesData as CardType[];

/** 省份列表（31 个） */
export const PROVINCES = provincesData as Province[];

// ─── 导出数据（大数据从 loader 缓存获取） ──────────────────────────────

/** 车站无障碍服务（1223 个车站，113KB）— 读取 loader 缓存，未加载时返回空数组 */
export function getStationServices(): StationService[] {
  return (getStationServicesSync() as StationService[] | null) ?? [];
}

/** 国家列表（197 个，16KB）— 读取 loader 缓存，未加载时返回空数组 */
export function getCountries(): Country[] {
  return (getCountriesSync() as Country[] | null) ?? [];
}

/** 城市列表（2980 个城市/县，252KB）— 读取 loader 缓存，未加载时返回空数组 */
export function getCityList(): CityListItem[] {
  return (getCityListSync() as CityListItem[] | null) ?? [];
}

/** 城市数据（A-Z 分组 + 热门城市，375 个地级市，35KB）— 读取 loader 缓存，未加载时返回空数据 */
export function getCities(): CitiesData {
  return (getCitiesSync() as CitiesData | null) ?? { hot: [] };
}
