/**
 * 车站数据服务
 *
 * - 从 12306 拉取完整车站列表并缓存（L1 内存）
 * - 提供 name→code / code→name 查询
 * - 失败时 fallback 到 stations.ts 中的静态数据
 */

import { fetchStationData, type RawStation } from './railwayApi';
import { getAllStations } from '../data/stations';
import { loadStations } from '../data/loader';

// ─── L1 内存缓存 ────────────────────────────────────────────────────

let _stations: RawStation[] | null = null;
let _nameToCode: Map<string, string> | null = null;
let _codeToName: Map<string, string> | null = null;

function buildMaps(stations: RawStation[]) {
  _stations = stations;
  _nameToCode = new Map();
  _codeToName = new Map();
  for (const s of stations) {
    if (!_nameToCode.has(s.name)) {
      _nameToCode.set(s.name, s.code);
    }
    if (!_codeToName.has(s.code)) {
      _codeToName.set(s.code, s.name);
    }
  }
}

// ─── Fallback 静态数据 ──────────────────────────────────────────────

function buildFallback() {
  const fallback: RawStation[] = getAllStations().map(s => ({
    name: s.name,
    code: s.code,
    pinyin: s.pinyin,
    shortPinyin: s.shortPinyin || s.pinyin.charAt(0),
    initial: s.initial,
  }));
  buildMaps(fallback);
}

// ─── 公共 API ────────────────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;

/**
 * 初始化车站数据。可多次调用，只会执行一次加载。
 * @returns 是否使用了真实 API 数据（false = fallback）
 */
export function initStations(): Promise<boolean> {
  if (_stations) return Promise.resolve(true);

  if (!_initPromise) {
    _initPromise = _doInit();
  }
  return _initPromise.then(() => !!_stations && _stations.length > 200);
}

async function _doInit(): Promise<void> {
  await loadStations();

  try {
    const remote = await fetchStationData();
    if (remote.length > 0) {
      buildMaps(remote);
      return;
    }
  } catch {
    // 静默失败，使用本地数据
  }

  buildFallback();
}

/** 获取站码（站名 → 三字母码） */
export function getStationCode(name: string): string | undefined {
  if (!_nameToCode) buildFallback();
  return _nameToCode!.get(name);
}

/** 获取站名（三字母码 → 站名） */
export function getStationName(code: string): string | undefined {
  if (!_codeToName) buildFallback();
  return _codeToName!.get(code);
}

/** 是否已就绪 */
export function isStationsReady(): boolean {
  return _stations != null && _stations.length > 0;
}

/** 获取完整车站列表（用于搜索） */
export function getAllRemoteStations(): RawStation[] {
  return _stations || [];
}

/** 搜索车站（支持名称、拼音、站码） */
export function searchStationsRemote(keyword: string): RawStation[] {
  if (!keyword.trim() || !_stations) return [];
  const lower = keyword.toLowerCase().trim();
  return _stations.filter(
    s =>
      s.name.includes(lower) ||
      s.pinyin.startsWith(lower) ||
      s.shortPinyin.startsWith(lower) ||
      s.code.toLowerCase().startsWith(lower),
  ).slice(0, 50);
}
