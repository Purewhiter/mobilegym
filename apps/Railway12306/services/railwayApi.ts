/**
 * 12306 API 低级客户端
 *
 * 所有请求通过 os/NetworkService 走网关代理，cookie 由网关 cookie jar 自动管理。
 */

import { netFetch, netText } from '../../../os/NetworkService';
import { now as timeNow } from '../../../os/TimeService';

// ─── 常量 ───────────────────────────────────────────────────────────

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const BASE_HEADERS = {
  'User-Agent': DEFAULT_USER_AGENT,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

// ─── Session / Cookie ──────────────────────────────────────────────

/** 从 init 页面提取的查询路径，如 queryG / queryZ */
let _leftTicketQueryPath: string | null = null;

/** 最后一次成功 init 的时间戳 */
let _lastInitTime = 0;

/** init 有效期（15分钟） */
const INIT_TTL = 15 * 60 * 1000;

/** 请求间最小延迟（避免触发频率限制） */
const MIN_REQUEST_DELAY = 200;

/** 等待指定毫秒 */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 检查 session 是否仍然有效 */
export function isSessionValid(): boolean {
  return _leftTicketQueryPath !== null && (timeNow() - _lastInitTime) < INIT_TTL;
}

/** 正在进行中的 init Promise（去重） */
let _initPromise: Promise<string> | null = null;

/**
 * 初始化 session，获取 12306 需要的 cookie（route / JSESSIONID / BIGipServerotn）。
 * 同时从页面提取正确的查询路径。
 * 自动去重：如果 session 有效则直接返回，如果正在初始化则复用 Promise。
 */
export async function initSession(): Promise<string> {
  // 如果 session 仍然有效，直接返回
  if (isSessionValid()) {
    return _leftTicketQueryPath!;
  }

  // 如果正在初始化，复用同一个 Promise
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = _doInitSession();
  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

async function _doInitSession(): Promise<string> {
  // 触发 Set-Cookie，网关会自动存储到 cookie jar
  const resp = await netFetch('https://kyfw.12306.cn/otn/leftTicket/init', {
    headers: {
      ...BASE_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      // IMPORTANT:
      // Force a cookie-less init request so we always get a fresh Set-Cookie response.
      // Otherwise the gateway cookie jar may keep sending stale cookies and never refresh.
      // (Setting Cookie explicitly also prevents the gateway from auto-injecting cookie jar.)
      'Cookie': '',
    },
  });
  const html = await resp.text();
  
  // 提取 CLeftTicketUrl = 'leftTicket/queryG';
  const pathMatch = html.match(/CLeftTicketUrl\s*=\s*'([^']+)'/);
  _leftTicketQueryPath = pathMatch ? pathMatch[1] : 'leftTicket/queryG';
  _lastInitTime = timeNow();

  // init 后等待一小段时间，避免立即查询触发频率限制
  await sleep(MIN_REQUEST_DELAY);

  return _leftTicketQueryPath;
}

/** 获取已初始化的查询路径，未初始化则返回默认 */
export function getLeftTicketQueryPath(): string {
  return _leftTicketQueryPath || 'leftTicket/queryG';
}

// ─── 车站数据 ───────────────────────────────────────────────────────

export interface RawStation {
  /** 中文站名 */
  name: string;
  /** 三字母站码，如 BJP */
  code: string;
  /** 全拼 */
  pinyin: string;
  /** 简拼 */
  shortPinyin: string;
  /** 首字母 */
  initial: string;
}

/**
 * 从 12306 获取完整车站列表。
 *
 * 两步：
 * 1. 访问首页 HTML，正则提取 station_name JS 路径
 * 2. 下载 JS，解析 `|` 分隔的站名数据
 */
export async function fetchStationData(): Promise<RawStation[]> {
  // Step 1: 提取 JS 路径
  const resp = await netFetch('https://www.12306.cn/index/', {
    headers: BASE_HEADERS,
  });
  const indexHtml = await resp.text();
  
  // 检查是否返回了错误页面
  if (indexHtml.includes('err.css') || indexHtml.includes('网络可能存在问题')) {
    throw new Error('12306 请求频率受限');
  }
  
  // 路径可能是 ./script/... 或 /script/...
  const jsMatch = indexHtml.match(/[.'"\/](script\/core\/common\/station_name[^"']+\.js)/);
  if (!jsMatch) {
    throw new Error('无法从 12306 首页提取车站数据 JS 路径');
  }
  const jsUrl = `https://www.12306.cn/index/${jsMatch[1]}`;

  // Step 2: 下载并解析
  const jsResp = await netFetch(jsUrl, { headers: BASE_HEADERS });
  const jsContent = await jsResp.text();
  
  // 检查是否返回了错误页面
  if (jsContent.includes('<!DOCTYPE') || jsContent.includes('err.css')) {
    throw new Error('12306 请求频率受限');
  }
  
  // 格式: var station_names ='...@bjb|北京北|VAP|...';
  const dataMatch = jsContent.match(/station_names\s*=\s*'([^']+)'/);
  if (!dataMatch) {
    console.warn('[fetchStationData] 无法解析 JS，内容前 200 字符:', jsContent.slice(0, 200));
    throw new Error('无法解析车站数据 JS 内容');
  }
  const rawStr = dataMatch[1];

  const stations: RawStation[] = [];
  // 以 @ 分隔每个车站，每站内 | 分隔字段
  const entries = rawStr.split('@').filter(Boolean);
  for (const entry of entries) {
    const parts = entry.split('|');
    // 格式: 简拼|站名|站码|拼音|简拼2|序号|...
    if (parts.length < 5) continue;
    stations.push({
      shortPinyin: parts[0],
      name: parts[1],
      code: parts[2],
      pinyin: parts[3],
      initial: parts[0].charAt(0).toUpperCase(),
    });
  }
  return stations;
}

// ─── 余票查询 ───────────────────────────────────────────────────────

/** 余票查询返回的原始数据 */
export interface TicketQueryResult {
  /** 每条为 | 分隔的车次信息字符串 */
  result: string[];
  /** 站码 → 站名映射 */
  map: Record<string, string>;
}

type CacheEntry<T> = { ts: number; value: T };

type ErrorCacheEntry = { ts: number; error: Error };

/**
 * 12306 的接口存在较严格的风控/限流：同一个页面的多次渲染/筛选变更可能在短时间触发多次相同请求。
 * 这里做两层保护：
 * 1) in-flight 去重：相同 fullUrl 的并发请求复用同一个 Promise
 * 2) 短 TTL 缓存：避免 UI 频繁触发重复请求
 */
const TICKET_CACHE_TTL = 15 * 1000;
const TICKET_CACHE_MAX = 30;
const TICKET_ERROR_TTL = 2 * 1000;

const _ticketCache = new Map<string, CacheEntry<TicketQueryResult>>();
const _ticketInFlight = new Map<string, Promise<TicketQueryResult>>();
const _ticketErrorCache = new Map<string, ErrorCacheEntry>();

function touchCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { ts: timeNow(), value } as any);
  // 简单的 FIFO 清理（足够用）
  while (map.size > TICKET_CACHE_MAX) {
    const firstKey = map.keys().next().value as string | undefined;
    if (!firstKey) break;
    map.delete(firstKey);
  }
}

/**
 * 查询余票。
 * 调用前必须先调用 initSession() 获取 cookie 和查询路径。
 *
 * @param date 日期 yyyy-MM-dd
 * @param fromCode 出发站码
 * @param toCode 到达站码
 * @param isStudent 是否学生票
 */
export async function queryTickets(
  date: string,
  fromCode: string,
  toCode: string,
  isStudent = false,
): Promise<TicketQueryResult> {
  const purpose = isStudent ? '0X00' : 'ADULT';
  const queryPath = getLeftTicketQueryPath();
  const url = `https://kyfw.12306.cn/otn/${queryPath}`;
  const params = new URLSearchParams({
    'leftTicketDTO.train_date': date,
    'leftTicketDTO.from_station': fromCode,
    'leftTicketDTO.to_station': toCode,
    'purpose_codes': purpose,
  });

  const fullUrl = `${url}?${params}`;

  // Error cooldown（避免同一错误在短时间内反复打到 12306）
  const cachedErr = _ticketErrorCache.get(fullUrl);
  if (cachedErr && timeNow() - cachedErr.ts < TICKET_ERROR_TTL) {
    throw cachedErr.error;
  }

  // L1 cache
  const cached = _ticketCache.get(fullUrl);
  if (cached && timeNow() - cached.ts < TICKET_CACHE_TTL) {
    return cached.value;
  }

  // In-flight 去重
  const inFlight = _ticketInFlight.get(fullUrl);
  if (inFlight) {
    return inFlight;
  }

  const p = (async () => {
    try {
      // 重试逻辑：如果返回 HTML（频率限制/风控页），等待后重试
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
          // 重试前等待更长时间，并强制重新初始化 session
          await sleep(800);
          _lastInitTime = 0;
          await initSession();
        }

        const resp = await netFetch(fullUrl, {
          headers: BASE_HEADERS,
        });

        // 检查是否返回了 HTML 而不是 JSON
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          if (attempt === 0) {
            continue; // 第一次失败，重试
          }
          const text = await resp.text();
          // 检查是否是频率限制/风控错误页面
          if (text.includes('网络可能存在问题') || text.includes('err.css') || resp.url.includes('/logFiles/error.html')) {
            throw new Error('12306 请求频率受限，请稍后重试');
          }
          throw new Error(`余票查询失败: ${text.slice(0, 120)}`);
        }

        if (!resp.ok) {
          throw new Error(`余票查询失败: ${resp.status}`);
        }

        const json = await resp.json();

        // 检查正常返回
        if (json?.httpstatus === 200 && json?.data?.result) {
          const value = { result: json.data.result, map: json.data.map || {} };
          touchCache(_ticketCache, fullUrl, value);
          return value;
        }

        // 查询无结果但请求成功
        if (json?.httpstatus === 200 && Array.isArray(json?.data?.result) && json.data.result.length === 0) {
          const value = { result: [], map: json.data.map || {} };
          touchCache(_ticketCache, fullUrl, value);
          return value;
        }

        // 错误情况
        const errorMsg = json?.messages?.[0] || json?.errorMsg || JSON.stringify(json).slice(0, 200);
        throw new Error(`余票查询失败: ${errorMsg}`);
      }

      throw new Error('余票查询失败: 重试次数耗尽');
    } catch (e) {
      // 将“频率受限”类错误短暂缓存，降低 UI 重复触发带来的风控概率
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.message.includes('请求频率受限')) {
        _ticketErrorCache.set(fullUrl, { ts: timeNow(), error: err });
      }
      throw err;
    } finally {
      _ticketInFlight.delete(fullUrl);
    }
  })();

  _ticketInFlight.set(fullUrl, p);
  return p;
}

// ─── 车次搜索 ───────────────────────────────────────────────────────

export interface TrainSearchResult {
  train_no: string;
  station_train_code: string;
  from_station: string;
  to_station: string;
}

/**
 * 搜索车次信息（无需 cookie）。
 */
export async function searchTrain(keyword: string, date: string): Promise<TrainSearchResult[]> {
  const dateCompact = date.replace(/-/g, '');
  const url = `https://search.12306.cn/search/v1/train/search?keyword=${encodeURIComponent(keyword)}&date=${dateCompact}`;
  const resp = await netFetch(url, { headers: BASE_HEADERS });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json?.data || []) as TrainSearchResult[];
}

// ─── 经停站查询 ─────────────────────────────────────────────────────

export interface StopInfo {
  station_name: string;
  arrive_time: string;
  start_time: string;
  running_time: string;
  station_train_code: string;
}

/**
 * 查询列车经停站。
 */
export async function queryTrainStops(
  trainNo: string,
  date: string,
): Promise<StopInfo[]> {
  const params = new URLSearchParams({
    'leftTicketDTO.train_no': trainNo,
    'leftTicketDTO.train_date': date,
    'rand_code': '',
  });
  const url = `https://kyfw.12306.cn/otn/queryTrainInfo/query?${params}`;
  const resp = await netFetch(url, { headers: BASE_HEADERS });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json?.data?.data || []) as StopInfo[];
}

// ─── 中转换乘查询 ───────────────────────────────────────────────────

/** 中转查询原始返回 */
export interface TransferQueryResult {
  middleList: any[];
  canQuery: boolean;
  resultIndex: number;
}

/**
 * 中转查询（两步）。
 */
export async function queryTransfer(
  date: string,
  fromCode: string,
  toCode: string,
  middleStation = '',
  isStudent = false,
): Promise<TransferQueryResult> {
  // Step 1: 获取动态查询路径
  const initResp = await netFetch('https://kyfw.12306.cn/otn/lcQuery/init', {
    headers: {
      ...BASE_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const initHtml = await initResp.text();
  const pathMatch = initHtml.match(/var\s+lc_search_url\s*=\s*'([^']+)'/);
  if (!pathMatch) {
    throw new Error('无法获取中转查询路径');
  }
  const queryPath = pathMatch[1];

  // Step 2: 查询
  const params = new URLSearchParams({
    train_date: date,
    from_station_telecode: fromCode,
    to_station_telecode: toCode,
    middle_station: middleStation,
    result_index: '0',
    can_query: 'Y',
    isShowWZ: 'Y',
    purpose_codes: isStudent ? '0X' : '00',
    channel: 'E',
  });
  const url = `https://kyfw.12306.cn${queryPath}?${params}`;
  const resp = await netFetch(url, { headers: BASE_HEADERS });
  if (!resp.ok) {
    throw new Error(`中转查询失败: ${resp.status}`);
  }
  const json = await resp.json();
  return {
    middleList: json?.data?.middleList || [],
    canQuery: json?.data?.can_query !== 'N',
    resultIndex: json?.data?.result_index ?? 0,
  };
}
