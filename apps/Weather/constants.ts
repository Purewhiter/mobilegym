import type { WeatherCityDefinition } from './types';

export const MAJOR_CITIES: WeatherCityDefinition[] = [
  { id: 'beijing', name: '\u5317\u4eac\u5e02', lon: 116.4074, lat: 39.9042 },
  { id: 'shanghai', name: '\u4e0a\u6d77\u5e02', lon: 121.4737, lat: 31.2304 },
  { id: 'guangzhou', name: '\u5e7f\u5dde\u5e02', lon: 113.2644, lat: 23.1291 },
  { id: 'shenzhen', name: '\u6df1\u5733\u5e02', lon: 114.0579, lat: 22.5431 },
  { id: 'zhuhai', name: '\u73e0\u6d77\u5e02', lon: 113.5767, lat: 22.2707 },
  { id: 'foshan', name: '\u4f5b\u5c71\u5e02', lon: 113.1214, lat: 23.0214 },
  { id: 'nanjing', name: '\u5357\u4eac\u5e02', lon: 118.7969, lat: 32.0603 },
  { id: 'suzhou', name: '\u82cf\u5dde\u5e02', lon: 120.5853, lat: 31.2989 },
  { id: 'xiamen', name: '\u53a6\u95e8\u5e02', lon: 118.0894, lat: 24.4798 },
  { id: 'nanning', name: '\u5357\u5b81\u5e02', lon: 108.32, lat: 22.824 },
  { id: 'kunming', name: '\u6606\u660e\u5e02', lon: 102.8329, lat: 24.8801 },
  { id: 'chengdu', name: '\u6210\u90fd\u5e02', lon: 104.0665, lat: 30.5728 },
  { id: 'changsha', name: '\u957f\u6c99\u5e02', lon: 112.9388, lat: 28.2282 },
  { id: 'fuzhou', name: '\u798f\u5dde\u5e02', lon: 119.2965, lat: 26.0745 },
  { id: 'hangzhou', name: '\u676d\u5dde\u5e02', lon: 120.1551, lat: 30.2741 },
  { id: 'wuhan', name: '\u6b66\u6c49\u5e02', lon: 114.3055, lat: 30.5928 },
  { id: 'qingdao', name: '\u9752\u5c9b\u5e02', lon: 120.3826, lat: 36.0671 },
  { id: 'xian', name: '\u897f\u5b89\u5e02', lon: 108.9398, lat: 34.3416 },
  { id: 'taiyuan', name: '\u592a\u539f\u5e02', lon: 112.5492, lat: 37.857 },
  { id: 'shijiazhuang', name: '\u77f3\u5bb6\u5e84\u5e02', lon: 114.5149, lat: 38.0428 },
  { id: 'shenyang', name: '\u6c88\u9633\u5e02', lon: 123.4315, lat: 41.8057 },
  { id: 'chongqing', name: '\u91cd\u5e86\u5e02', lon: 106.5518, lat: 29.5627 },
  { id: 'tianjin', name: '\u5929\u6d25\u5e02', lon: 117.2015, lat: 39.0853 },
];

export const WEATHER_CONSTANTS = {
  refreshIntervalMs: 5 * 60 * 1000,
  defaultSelectedCityId: 'located',
} as const;
