/**
 * 车站数据
 *
 * 完整数据由 loader.ts 异步加载（stationList.json，3383 个车站）。
 */

import { getStationsSync } from './loader';

export interface Station {
  name: string;
  code: string;
  pinyin: string;
  shortPinyin: string;
  initial: string;
  cityCode: string;
  cityName: string;
  stationClass: number;
  sameCityCode: string;
  lat?: number;
  lng?: number;
  countryCode?: string;
  countryName?: string;
}

const COMMON_CODES = ['CSQ', 'BFP', 'BJP', 'HRP', 'HBP', 'WHN', 'HGN', 'XYN', 'SYT'];
const HOT_CODES = ['BJP', 'SHH', 'GZQ', 'TJP', 'CQW', 'CDW', 'CSQ', 'HBB', 'HZH'];

let stationCodeIndexSource: Station[] | null = null;
let stationCodeIndex = new Map<string, Station>();

function getStationCodeIndex(all: Station[]): Map<string, Station> {
  if (all !== stationCodeIndexSource) {
    stationCodeIndexSource = all;
    stationCodeIndex = new Map(all.map(s => [s.code, s]));
  }
  return stationCodeIndex;
}

/** 完整车站列表 */
export function getAllStations(): Station[] {
  return getStationsSync() ?? [];
}

/** 根据 code 列表查找车站（保持顺序） */
function findStations(codes: string[]): Station[] {
  const all = getStationsSync();
  if (!all) return [];
  const map = getStationCodeIndex(all);
  return codes.map(c => map.get(c)).filter((s): s is Station => !!s);
}

/** 常用车站 */
export function getCommonStations(): Station[] {
  return findStations(COMMON_CODES);
}

/** 热门车站 */
export function getHotStations(): Station[] {
  return findStations(HOT_CODES);
}

/** 获取按首字母分组的车站 */
export function getStationsGroupedByInitial(): Record<string, Station[]> {
  const all = getStationsSync() ?? [];
  const groups: Record<string, Station[]> = {};
  for (const station of all) {
    if (!groups[station.initial]) {
      groups[station.initial] = [];
    }
    groups[station.initial].push(station);
  }
  return groups;
}

/** 搜索车站（按名称、拼音、缩写拼音、城市名、站码） */
export function searchStations(keyword: string): Station[] {
  if (!keyword.trim()) return [];
  const all = getStationsSync() ?? [];
  const lower = keyword.toLowerCase().trim();
  return all.filter(
    s =>
      s.name.includes(lower) ||
      s.pinyin.startsWith(lower) ||
      s.shortPinyin.startsWith(lower) ||
      s.cityName.includes(lower) ||
      s.code.toLowerCase().startsWith(lower),
  ).slice(0, 50);
}
