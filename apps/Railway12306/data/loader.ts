/**
 * Railway12306 数据懒加载器
 *
 * 使用 fetch() + JSON.parse() 加载数据（避开 Vite ESM 转换管线，避免阻塞 dev server）。
 * 单例缓存：首次加载后后续调用直接返回缓存数据。
 */

import type { Station } from './stations';

// 使用 new URL() + import.meta.url 让 Vite 正确解析资源路径（dev 和 build 均兼容）
const stationsUrl = new URL('./reference/stationList.json', import.meta.url).href;
const cityListUrl = new URL('./reference/cityList.json', import.meta.url).href;
const stationServicesUrl = new URL('./reference/stationServices.json', import.meta.url).href;
const citiesUrl = new URL('./reference/cities.json', import.meta.url).href;
const countriesUrl = new URL('./reference/countries.json', import.meta.url).href;

// 通用 fetch + 缓存模式（失败时清除 inflight promise 以允许重试）
function createLoader<T>(url: string) {
  let cache: T | null = null;
  let loading: Promise<T> | null = null;

  const load = (): Promise<T> => {
    if (cache) return Promise.resolve(cache);
    if (!loading) {
      loading = fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
          return r.json();
        })
        .then(data => { cache = data as T; return cache; })
        .catch(err => { loading = null; throw err; });
    }
    return loading;
  };

  const getSync = (): T | null => cache;

  return { load, getSync };
}

// ============ 各数据类型 ============

const stations = createLoader<Station[]>(stationsUrl);
export const loadStations = stations.load;
export const getStationsSync = stations.getSync;

const cityList = createLoader<any[]>(cityListUrl);
export const loadCityList = cityList.load;
export const getCityListSync = cityList.getSync;

const stationServices = createLoader<any[]>(stationServicesUrl);
export const loadStationServices = stationServices.load;
export const getStationServicesSync = stationServices.getSync;

const cities = createLoader<any>(citiesUrl);
export const loadCities = cities.load;
export const getCitiesSync = cities.getSync;

const countries = createLoader<any[]>(countriesUrl);
export const loadCountries = countries.load;
export const getCountriesSync = countries.getSync;

// ============ 批量预加载 ============

/**
 * 预加载所有 Railway12306 大数据到缓存（供 bench waitForData 使用）
 */
export async function preload(): Promise<void> {
  await Promise.all([
    loadStations(),
    loadCityList(),
    loadStationServices(),
    loadCities(),
    loadCountries(),
  ]);
}

/** 标准化预加载入口（供 OS waitForData 自动发现） */
