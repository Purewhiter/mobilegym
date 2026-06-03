import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WEATHER_CITY_BY_ID } from '../data';
import {
  getAirQualityDailyForecast,
  getHistoricalWeatherDay,
  getWeatherBundle,
} from '../services/weatherService';
import type { AirQualityForecastDay } from '../types';
import { useWeatherStore } from '../state';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { setHistoricalYesterday, setStoredBundle } from '../utils/weatherStore';
import { toLocalDateKey } from '../utils/dateFormat';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import * as TimeService from '../../../os/TimeService';
import { convertTemp, formatWind } from '../utils/unitConversion';
import { getAqiLevelLabel, getAqiLevelSoftColor, normalizeAqiLevel } from '../utils/airQuality';
import { getLocalizedWeatherText } from '../utils/localizedText';

const COLUMN_WIDTH_PX = 72;
const CARD_LEFT_PADDING_PX = 10;
const CARD_RIGHT_PADDING_PX = 10;
const CARD_HEIGHT_PX = 464;
const HIGH_TRACK_TOP_PX = 214;
const HIGH_TRACK_HEIGHT_PX = 34;
const LOW_TRACK_TOP_PX = 302;
const LOW_TRACK_HEIGHT_PX = 24;
const HIGH_TRACK_LABEL_OFFSET_PX = 30;
const LOW_TRACK_LABEL_OFFSET_PX = 10;

type ForecastPoint = {
  x: number;
  y: number;
  label: string;
};

function getDateMeta(
  dateStr: string,
  todayDateKey: string,
  s: typeof strings,
) {
  const date = TimeService.fromTimestamp(TimeService.parseToTimestamp(dateStr));
  const weekdays = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
  const currentDateKey = toLocalDateKey(TimeService.parseToTimestamp(`${dateStr}T12:00:00`));
  const todayTs = TimeService.parseToTimestamp(`${todayDateKey}T12:00:00`);
  const currentTs = TimeService.parseToTimestamp(`${currentDateKey}T12:00:00`);
  const dayDiff = todayTs && currentTs ? Math.round((currentTs - todayTs) / (24 * 60 * 60 * 1000)) : null;
  const topLabel =
    dayDiff === -1 ? s.yesterday :
    dayDiff === 0 ? s.today :
    dayDiff === 1 ? s.tomorrow :
    weekdays[date.getDay()];
  const bottomLabel = `${date.getMonth() + 1}${s.date_month_day}${date.getDate()}${s.date_day_suffix}`;
  return { topLabel, bottomLabel };
}

function buildBandPoints(
  values: number[],
  labels: string[],
  top: number,
  height: number,
): ForecastPoint[] {
  const safeValues = values.map((value) => (Number.isFinite(value) ? value : 0));
  const average = safeValues.reduce((sum, value) => sum + value, 0) / Math.max(safeValues.length, 1);
  const maxDelta = Math.max(...safeValues.map((value) => Math.abs(value - average)), 0);
  const spread = Math.max(...safeValues) - Math.min(...safeValues);
  const centerY = top + height / 2;
  const maxAmplitude = Math.max(0, height / 2 - 2);
  const dynamicAmplitude = maxAmplitude * Math.min(spread / 8, 1);

  return safeValues.map((value, index) => {
    const normalizedOffset = maxDelta > 0 ? (average - value) / maxDelta : 0;
    return {
      x: CARD_LEFT_PADDING_PX + index * COLUMN_WIDTH_PX + COLUMN_WIDTH_PX / 2,
      y: centerY + normalizedOffset * dynamicAmplitude,
      label: labels[index] ?? String(value),
    };
  });
}

function buildPolyline(points: ForecastPoint[], width: number) {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return [
    `0,${first.y}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${width},${last.y}`,
  ].join(' ');
}

function resolveDisplayWind(dayWindSpeed: string, dayWindScale: string, windUnit: import('../types').WindUnit, suffix: string) {
  return formatWind(dayWindSpeed, dayWindScale, windUnit, suffix) || '--';
}

function buildAirForecastMap(days: AirQualityForecastDay[]) {
  return new Map(
    days
      .map((day) => {
        const startTs = TimeService.parseToTimestamp(day.forecastStartTime);
        if (!startTs) return null;
        return [toLocalDateKey(startTs), day] as const;
      })
      .filter((item): item is readonly [string, AirQualityForecastDay] => item !== null),
  );
}

function normalizeAirQualityCategory(category: string, level?: string) {
  const raw = category.trim();
  if (raw.includes('优')) return '优';
  if (raw.includes('良')) return '良';
  if (raw.includes('轻')) return '轻度';
  if (raw.includes('中')) return '中度';
  if (raw.includes('严重')) return '重度';
  if (raw.includes('重')) return '重度';

  switch (level) {
    case '1':
      return '优';
    case '2':
      return '良';
    case '3':
      return '轻度';
    case '4':
      return '中度';
    case '5':
    case '6':
      return '重度';
    default:
      return '--';
  }
}

function resolveAirQualityColor(category: string) {
  if (category === '优') return '#b9e6c9';
  if (category === '良') return '#e8c77a';
  if (category === '轻度') return '#f0a86b';
  if (category === '中度') return '#ea8a8a';
  if (category === '重度') return '#c37ce6';
  return '#c6d0db';
}

const WeatherDailyForecastPage: React.FC = () => {
  const { bindBack } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const [searchParams] = useSearchParams();
  const weatherState = useWeatherStore();
  const { tempUnit, windUnit } = weatherState.settings;
  const [fetching, setFetching] = useState(false);
  const [airForecastDays, setAirForecastDays] = useState<AirQualityForecastDay[]>([]);

  const activeCityId = searchParams.get('cityId') ?? weatherState.selectedCityId;
  const storedEntry = weatherState.bundlesByCityId[activeCityId];
  const cityDef = activeCityId === 'located' ? null : WEATHER_CITY_BY_ID[activeCityId];
  const bundle = storedEntry?.bundle ?? null;
  const historicalYesterday = storedEntry?.historicalYesterday;
  const lonLat = storedEntry?.lonLat ?? (cityDef ? `${cityDef.lon},${cityDef.lat}` : null);

  useEffect(() => {
    if (bundle || activeCityId === 'located' || !cityDef) return;

    let cancelled = false;
    setFetching(true);

    (async () => {
      try {
        const result = await getWeatherBundle(`${cityDef.lon},${cityDef.lat}`, {
          dailysteps: 15,
          hourlysteps: 24,
          alert: true,
          cityId: cityDef.id,
        });
        if (cancelled) return;
        useWeatherStore.setState((prev) => setStoredBundle(prev, cityDef.id, {
          lonLat: `${cityDef.lon},${cityDef.lat}`,
          bundle: result,
        }), true);
      } catch (error) {
        console.error('Failed to fetch daily forecast page bundle', error);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCityId, bundle, cityDef]);

  useEffect(() => {
    if (!lonLat) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await getAirQualityDailyForecast(lonLat, activeCityId);
        if (!cancelled) setAirForecastDays(result);
      } catch (error) {
        console.error('Failed to fetch daily air quality forecast', error);
        if (!cancelled) setAirForecastDays([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCityId, lonLat]);

  useEffect(() => {
    if (!lonLat || !storedEntry || historicalYesterday !== undefined) return;

    let cancelled = false;
    const yesterday = TimeService.getDate();
    yesterday.setHours(12, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);

    (async () => {
      try {
        const result = await getHistoricalWeatherDay(lonLat, yesterday, activeCityId);
        if (cancelled) return;
        useWeatherStore.setState((prev) => setHistoricalYesterday(prev, activeCityId, result), true);
      } catch (error) {
        console.error('Failed to fetch yesterday historical weather', error);
        if (cancelled) return;
        useWeatherStore.setState((prev) => setHistoricalYesterday(prev, activeCityId, null), true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCityId, historicalYesterday, lonLat, storedEntry]);

  const days = useMemo(() => {
    const forecastDays = bundle?.daily ?? [];
    if (!forecastDays.length) return [];
    return historicalYesterday ? [historicalYesterday, ...forecastDays] : forecastDays;
  }, [bundle, historicalYesterday]);
  const airForecastByDate = useMemo(() => buildAirForecastMap(airForecastDays), [airForecastDays]);
  const todayDateKey = useMemo(() => toLocalDateKey(TimeService.now()), []);

  const chart = useMemo(() => {
    if (!days.length) {
      return {
        width: CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX,
        highPoints: [] as ForecastPoint[],
        lowPoints: [] as ForecastPoint[],
        highPolyline: '',
        lowPolyline: '',
      };
    }

    const maxValues = days.map((day) => convertTemp(day.tempMax, tempUnit));
    const minValues = days.map((day) => convertTemp(day.tempMin, tempUnit));
    const highPoints = buildBandPoints(maxValues, maxValues.map(String), HIGH_TRACK_TOP_PX, HIGH_TRACK_HEIGHT_PX);
    const lowPoints = buildBandPoints(minValues, minValues.map(String), LOW_TRACK_TOP_PX, LOW_TRACK_HEIGHT_PX);

    return {
      width: CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX + days.length * COLUMN_WIDTH_PX,
      highPoints,
      lowPoints,
      highPolyline: buildPolyline(highPoints, CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX + days.length * COLUMN_WIDTH_PX),
      lowPolyline: buildPolyline(lowPoints, CARD_LEFT_PADDING_PX + CARD_RIGHT_PADDING_PX + days.length * COLUMN_WIDTH_PX),
    };
  }, [days, tempUnit]);

  const isLoading = fetching || (!bundle && activeCityId !== 'located' && !!cityDef);

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
        className="flex-1 overflow-y-auto px-3 pb-6"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="px-2 pt-1 pb-4">
          <h1 className="text-[28px] leading-none font-medium tracking-tight">{s.daily_forecast_title}</h1>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-black/45">{s.loading}</div>
        ) : !days.length ? (
          <div className="h-64 flex items-center justify-center text-black/45">{s.unknown_city}</div>
        ) : (
          <div className="rounded-[28px] bg-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-sm overflow-hidden">
            <div
              className="overflow-x-auto no-scrollbar"
              data-scroll-container="forecast"
              data-scroll-direction="horizontal"
            >
              <div
                className="relative"
                style={{ width: `${chart.width}px`, minHeight: `${CARD_HEIGHT_PX}px` }}
              >
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={chart.width}
                  height={CARD_HEIGHT_PX}
                  viewBox={`0 0 ${chart.width} ${CARD_HEIGHT_PX}`}
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    points={chart.highPolyline}
                    stroke="#c8c98b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={chart.lowPolyline}
                    stroke="#87dfe1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chart.highPoints.map((point, index) => (
                    <circle key={`high-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#c8c98b" />
                  ))}
                  {chart.lowPoints.map((point, index) => (
                    <circle key={`low-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#87dfe1" />
                  ))}
                </svg>

                {chart.highPoints.map((point, index) => (
                  <div
                    key={`high-label-${index}`}
                    className="absolute text-[17px] font-medium text-black/90 -translate-x-1/2"
                    style={{ left: `${point.x}px`, top: `${point.y - HIGH_TRACK_LABEL_OFFSET_PX}px` }}
                  >
                    {point.label}°
                  </div>
                ))}

                {chart.lowPoints.map((point, index) => (
                  <div
                    key={`low-label-${index}`}
                    className="absolute text-[17px] font-medium text-black/70 -translate-x-1/2"
                    style={{ left: `${point.x}px`, top: `${point.y + LOW_TRACK_LABEL_OFFSET_PX}px` }}
                  >
                    {point.label}°
                  </div>
                ))}

                <div
                  className="flex"
                  style={{
                    paddingLeft: `${CARD_LEFT_PADDING_PX}px`,
                    paddingRight: `${CARD_RIGHT_PADDING_PX}px`,
                  }}
                >
                  {days.map((day, index) => {
                    const meta = getDateMeta(day.fxDate, todayDateKey, s);
                    const isTodayColumn = day.fxDate === todayDateKey;
                    const dayAirQuality = airForecastByDate.get(day.fxDate);
                    const airLevel = dayAirQuality
                      ? normalizeAqiLevel(dayAirQuality.category, dayAirQuality.level)
                      : day.fxDate === todayDateKey
                        ? normalizeAqiLevel(bundle?.airQuality?.category || '', bundle?.airQuality?.level)
                        : null;
                    const dayText = getLocalizedWeatherText(day.textDay, s);
                    const nightText = getLocalizedWeatherText(day.textNight, s);
                    return (
                      <div
                        key={day.fxDate}
                        className="relative shrink-0 flex flex-col items-center pt-8"
                        style={{
                          width: `${COLUMN_WIDTH_PX}px`,
                          backgroundColor: isTodayColumn ? 'rgba(0,0,0,0.025)' : 'transparent',
                          borderRadius: isTodayColumn ? '20px' : '0',
                        }}
                      >
                        <div className={`text-[17px] leading-none ${isTodayColumn ? 'font-semibold text-black/90' : 'font-medium text-black/75'}`}>
                          {meta.topLabel}
                        </div>
                        <div className="mt-2 text-[15px] leading-none text-black/35">{meta.bottomLabel}</div>

                        <img
                          src={getWeatherIconUrl(day.iconDay, day.textDay)}
                          alt={dayText}
                          className="mt-7 h-8 w-8 object-contain"
                        />
                        <div className="mt-6 text-[14px] leading-none text-black/80">{dayText}</div>

                        <div className="h-[176px]" />

                        <div className="text-[15px] leading-none text-black/45">{nightText}</div>
                        <img
                          src={getWeatherIconUrl(day.iconNight, day.textNight, true)}
                          alt={nightText}
                          className="mt-3 h-7 w-7 object-contain opacity-85"
                        />

                        <div
                          className="mt-4 text-[14px] leading-none"
                          style={{ color: getAqiLevelSoftColor(airLevel) }}
                        >
                          {getAqiLevelLabel(airLevel, s)}
                        </div>
                        <div className="mt-2 text-[14px] leading-none text-black/35">
                          {resolveDisplayWind(day.windSpeedDay, day.windScaleDay, windUnit, s.wind_scale_suffix)}
                        </div>
                        <div className="h-4 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherDailyForecastPage;
