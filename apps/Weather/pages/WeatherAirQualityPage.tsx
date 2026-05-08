import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WEATHER_CITY_BY_ID } from '../data';
import { useWeatherStore } from '../state';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import * as TimeService from '../../../os/TimeService';
import {
  getAqiLevelColor,
  getAqiLevelDescription,
  getAqiLevelLabel,
  normalizeAqiLevel,
} from '../utils/airQuality';
import { getLocalizedLocationName, getLocalizedWeatherCityName } from '../utils/cityNames';

function getBarColor(aqi: number): string {
  if (aqi <= 50) return '#61b15a';
  if (aqi <= 100) return '#e8a735';
  if (aqi <= 150) return '#f0874a';
  if (aqi <= 200) return '#ea5a5a';
  if (aqi <= 300) return '#b44dcc';
  return '#7e1023';
}

type HourlyAqi = { hour: string; aqi: number; label: string };

function generateMockHourlyAqi(baseAqi: number, s: typeof strings): HourlyAqi[] {
  const now = TimeService.getDate();
  const currentHour = now.getHours();
  const result: HourlyAqi[] = [];
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const seed = baseAqi + currentHour;
  let state = seed;
  const nextRandom = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state % 100) / 100;
  };

  for (let i = 0; i < 6; i++) {
    const h = (currentHour + i) % 24;
    const variation = Math.round((nextRandom() - 0.5) * baseAqi * 0.3);
    const aqi = Math.max(1, Math.min(500, baseAqi + variation));
    const label = i === 0
      ? `${month}${s.date_month_day}${day}${s.date_day_suffix}`
      : i === 1
        ? s.time_now
        : `${String(h).padStart(2, '0')}:00`;
    result.push({ hour: String(h), aqi, label });
  }
  return result;
}

const POLLUTANTS = [
  { key: 'pm2p5', label: 'PM2.5', sub: 'PM2.5' },
  { key: 'pm10', label: 'PM10', sub: 'PM10' },
  { key: 'so2', label: 'SO2', sub: 'SO2' },
  { key: 'no2', label: 'NO2', sub: 'NO2' },
  { key: 'o3', label: 'O3', sub: 'O3' },
  { key: 'co', label: 'CO', sub: 'CO' },
] as const;

type NearbyStation = { name: string; x: number; y: number };
const MOCK_NEARBY_STATIONS: NearbyStation[] = [
  { name: 'nearby_station_sijihuahai', x: 15, y: 85 },
  { name: 'nearby_station_fengjiayu', x: 72, y: 42 },
];

const WeatherAirQualityPage: React.FC = () => {
  const { bindBack } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const [searchParams] = useSearchParams();
  const weatherState = useWeatherStore();

  const activeCityId = searchParams.get('cityId') ?? weatherState.selectedCityId;
  const storedEntry = weatherState.bundlesByCityId[activeCityId];
  const cityDef = activeCityId === 'located' ? null : WEATHER_CITY_BY_ID[activeCityId];
  const airQuality = storedEntry?.bundle?.airQuality ?? null;

  const cityName = useMemo(() => {
    if (activeCityId === 'located') return getLocalizedLocationName(storedEntry?.locationName, s);
    const savedCity = weatherState.savedCities.find((c) => c.id === activeCityId);
    if (cityDef) return getLocalizedWeatherCityName(cityDef, s);
    if (savedCity) return getLocalizedWeatherCityName(savedCity, s);
    return s.unknown_city;
  }, [activeCityId, storedEntry, cityDef, weatherState.savedCities, s]);

  const pubTimeFormatted = useMemo(() => {
    if (!airQuality?.pubTime) return '';
    const ts = TimeService.parseToTimestamp(airQuality.pubTime);
    if (!ts) return '';
    const date = TimeService.fromTimestamp(ts);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes} ${s.aqi_publish_suffix}`;
  }, [airQuality?.pubTime, s]);

  const aqiNum = Number(airQuality?.aqi) || 0;
  const airQualityLevel = normalizeAqiLevel(airQuality?.category ?? '', airQuality?.level);
  const category = getAqiLevelLabel(airQualityLevel, s);
  const color = getAqiLevelColor(airQualityLevel);
  const description = getAqiLevelDescription(airQualityLevel, s);

  const hourlyData = useMemo(() => generateMockHourlyAqi(aqiNum, s), [aqiNum, s]);
  const maxBarAqi = useMemo(() => Math.max(...hourlyData.map(h => h.aqi), 100), [hourlyData]);

  if (!airQuality) {
    return (
      <div
        className="flex flex-col h-full bg-[#f3f3f3] text-black pt-10"
        data-status-bar-foreground="dark"
        data-navigation-bar-foreground="dark"
      >
        <div className="flex items-center px-4 py-3">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>()}
            className="p-2 -ml-2 rounded-full active:bg-black/5 transition-colors"
          >
            <IcNavBack size={24} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-black/45">{s.loading}</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-[#f3f3f3] text-black pt-10"
      data-status-bar-foreground="dark"
      data-navigation-bar-foreground="dark"
    >
      <div className="flex items-center px-4 py-3">
        <button
          type="button"
          {...bindBack<HTMLButtonElement>()}
          className="p-2 -ml-2 rounded-full active:bg-black/5 transition-colors"
        >
          <IcNavBack size={24} />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 pb-6"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* 标题 + 位置信息 */}
        <div className="pt-1 pb-5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{s.aqi_title}</h1>
          <p className="mt-1 text-[14px] text-black/45">
            {cityName} {pubTimeFormatted}
          </p>
        </div>

        {/* AQI 主卡片 */}
        <div className="rounded-[20px] bg-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] px-6 py-6 mb-4">
          {/* 大号 AQI 数字 + 等级 */}
          <div className="flex items-end gap-2 mb-4">
            <span className="text-[72px] leading-none font-light" style={{ color }}>{airQuality.aqi}</span>
            <span
              className="text-[20px] font-medium mb-2 px-1"
              style={{ color }}
            >{category}</span>
          </div>

          <p className="text-[15px] leading-relaxed text-black/65 mb-6">{description}</p>

          {/* 污染物指标 — 一行 6 项 */}
          <div className="flex justify-between">
            {POLLUTANTS.map(({ key, sub }) => {
              const raw = airQuality[key as keyof typeof airQuality] ?? '--';
              const numVal = Number(raw);
              const display = !Number.isFinite(numVal)
                ? '--'
                : key === 'co'
                  ? numVal.toFixed(1)
                  : String(Math.round(numVal));
              const displayColor = !Number.isFinite(numVal)
                ? '#999'
                : numVal <= 35
                  ? '#61b15a'
                  : numVal <= 75
                    ? '#e8a735'
                    : numVal <= 150
                      ? '#f0874a'
                      : '#ea5a5a';
              return (
                <div key={key} className="flex flex-col items-center">
                  <span className="text-[18px] font-medium leading-none" style={{ color: displayColor }}>
                    {display}
                  </span>
                  <span className="mt-1.5 text-[12px] text-black/40">{sub}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 24小时空气质量预报 */}
        <div className="rounded-[20px] bg-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] px-5 py-5 mb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[17px] font-medium">{s.aqi_hourly_title}</h2>
          </div>
          <div className="flex items-end justify-between gap-3 h-[100px]">
            {hourlyData.map((item, i) => {
              const barHeight = Math.max(12, (item.aqi / maxBarAqi) * 80);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-[4px]"
                    style={{
                      height: `${barHeight}px`,
                      backgroundColor: getBarColor(item.aqi),
                    }}
                  />
                  <span className="text-[11px] text-black/40 whitespace-nowrap">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 附近空气质量（简化 Mock 地图） */}
        <div className="rounded-[20px] bg-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.04)] px-5 py-5 mb-4">
          <h2 className="text-[15px] font-medium text-[#2eae67] mb-3">{s.aqi_nearby_title}</h2>
          <div
            className="relative w-full rounded-[12px] overflow-hidden"
            style={{
              height: 160,
              background: 'linear-gradient(135deg, #c8e6c9 0%, #e8d5b7 40%, #d4c4a8 70%, #c1d9c3 100%)',
            }}
          >
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,0,0,0.05) 20px, rgba(0,0,0,0.05) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.05) 20px, rgba(0,0,0,0.05) 21px)',
              }}
            />
            {MOCK_NEARBY_STATIONS.map((station) => (
              <div
                key={station.name}
                className="absolute flex items-center gap-1"
                style={{ left: `${station.x}%`, top: `${station.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shadow-sm" />
                <span className="text-[12px] font-medium text-black/70 whitespace-nowrap">{s[station.name as keyof typeof s]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherAirQualityPage;
