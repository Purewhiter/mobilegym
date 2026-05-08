import React, { useMemo } from 'react';
import { WeatherDaily, WeatherHourly, WeatherNow } from '../types';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { colors } from '../res/colors';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '../../../os/TimeService';
import { useWeatherStore } from '../state';
import { convertTemp, formatWind } from '../utils/unitConversion';
import { getLocalizedWeatherText } from '../utils/localizedText';

interface HourlyForecastChartProps {
  now?: WeatherNow | null;
  daily?: WeatherDaily[];
  hourly: WeatherHourly[];
  minutelySummary?: string;
}

type DisplayItem =
  | {
      kind: 'now';
      ts: number;
      temp: number;
      weatherIcon: string;
      weatherText: string;
      windLabel: string;
      timeLabel: string;
      topLabel: string;
    }
  | {
      kind: 'hourly';
      ts: number;
      temp: number;
      weatherIcon: string;
      weatherText: string;
      windLabel: string;
      timeLabel: string;
      topLabel: string;
    }
  | {
      kind: 'sunrise' | 'sunset';
      ts: number;
      weatherIcon: string;
      weatherText: string;
      windLabel: string;
      timeLabel: string;
      topLabel: string;
    };

type ChartPoint = DisplayItem & {
  x: number;
  y: number;
};

type TempAnchor = {
  ts: number;
  temp: number;
};

type WeatherVisual = {
  ts: number;
  weatherIcon: string;
  weatherText: string;
  windLabel: string;
};

const CURVE_H = 60;
const TEMP_OFFSET_Y = 20;
const SLOT_W = 58;

const parseTemp = (value?: string) => {
  if (!value) return null;
  const temp = Number.parseInt(value, 10);
  return Number.isFinite(temp) ? temp : null;
};

const parseTimestamp = (value: string) => {
  const ts = TimeService.parseToTimestamp(value);
  return ts > 0 ? ts : null;
};

const parseDailyClockTimestamp = (fxDate: string, clock: string) => {
  if (!fxDate || !clock) return null;
  const ts = TimeService.parseToTimestamp(`${fxDate}T${clock}`);
  return ts > 0 ? ts : null;
};

const formatHourlyTime = (
  iso: string,
  s: typeof strings,
) => {
  const ts = parseTimestamp(iso);
  if (ts == null) return '';
  const date = TimeService.fromTimestamp(ts);
  if (date.getHours() === 0) {
    return `${date.getMonth() + 1}${s.date_month_day}${date.getDate()}${s.date_day_suffix}`;
  }
  return `${date.getHours()}:00`;
};

const interpolateTemp = (ts: number, anchors: TempAnchor[]) => {
  if (anchors.length === 0) return 0;
  if (anchors.length === 1) return anchors[0].temp;
  if (ts <= anchors[0].ts) return anchors[0].temp;
  if (ts >= anchors[anchors.length - 1].ts) return anchors[anchors.length - 1].temp;

  for (let i = 0; i < anchors.length - 1; i++) {
    const prev = anchors[i];
    const next = anchors[i + 1];
    if (ts <= next.ts) {
      if (next.ts === prev.ts) return next.temp;
      const progress = (ts - prev.ts) / (next.ts - prev.ts);
      return prev.temp + (next.temp - prev.temp) * progress;
    }
  }

  return anchors[anchors.length - 1].temp;
};

const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = (p1.x - p0.x) / 2;
    d += ` C ${p0.x + cpx} ${p0.y}, ${p1.x - cpx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
};

const pickNearestWeatherVisual = (ts: number, visuals: WeatherVisual[]) => {
  if (visuals.length === 0) return null;
  let nearest = visuals[0];
  let minDiff = Math.abs(ts - nearest.ts);

  for (let i = 1; i < visuals.length; i++) {
    const candidate = visuals[i];
    const diff = Math.abs(ts - candidate.ts);
    if (diff < minDiff) {
      nearest = candidate;
      minDiff = diff;
    }
  }

  return nearest;
};

export const HourlyForecastChart: React.FC<HourlyForecastChartProps> = ({ now, daily = [], hourly, minutelySummary }) => {
  const s = useAppStrings(strings, stringsEn);
  const { tempUnit, windUnit } = useWeatherStore((st) => st.settings);

  const chart = useMemo(() => {
    const tempAnchors: TempAnchor[] = [];
    const weatherVisuals: WeatherVisual[] = [];
    const displayItems: DisplayItem[] = [];
    const nowTs = TimeService.now();
    const nowTemp = parseTemp(now?.temp);

    if (now && nowTemp != null) {
      const convertedTemp = convertTemp(nowTemp, tempUnit);
      const weatherVisual = {
        ts: nowTs,
        weatherIcon: getWeatherIconUrl(now.icon, now.text),
        weatherText: getLocalizedWeatherText(now.text, s),
        windLabel: formatWind(now.windSpeed, now.windScale, windUnit, s.wind_scale_suffix),
      };
      const { weatherIcon, weatherText, windLabel } = weatherVisual;
      tempAnchors.push({ ts: nowTs, temp: nowTemp });
      weatherVisuals.push(weatherVisual);
      displayItems.push({
        kind: 'now',
        ts: nowTs,
        temp: nowTemp,
        weatherIcon,
        weatherText,
        windLabel,
        timeLabel: s.time_now,
        topLabel: `${convertedTemp}°`,
      });
    }

    hourly.forEach((entry) => {
      const ts = parseTimestamp(entry.fxTime);
      const temp = parseTemp(entry.temp);
      if (ts == null || temp == null) return;
      const convertedTemp = convertTemp(temp, tempUnit);
      const weatherVisual = {
        ts,
        weatherIcon: getWeatherIconUrl(entry.icon, entry.text),
        weatherText: getLocalizedWeatherText(entry.text, s),
        windLabel: formatWind(entry.windSpeed, entry.windScale, windUnit, s.wind_scale_suffix),
      };
      const { weatherIcon, weatherText, windLabel } = weatherVisual;
      tempAnchors.push({ ts, temp });
      weatherVisuals.push(weatherVisual);
      displayItems.push({
        kind: 'hourly',
        ts,
        temp,
        weatherIcon,
        weatherText,
        windLabel,
        timeLabel: formatHourlyTime(entry.fxTime, s),
        topLabel: `${convertedTemp}°`,
      });
    });

    if (displayItems.length === 0 || tempAnchors.length === 0 || weatherVisuals.length === 0) return null;

    const sortedAnchors = [...tempAnchors].sort((a, b) => a.ts - b.ts);
    const windowStart = sortedAnchors[0].ts;
    const windowEnd = sortedAnchors[sortedAnchors.length - 1].ts;
    const eventKeys = new Set<string>();

    daily.forEach((day) => {
      const sunriseTs = parseDailyClockTimestamp(day.fxDate, day.sunrise);
      if (sunriseTs != null && sunriseTs >= windowStart && sunriseTs <= windowEnd) {
        const key = `sunrise-${sunriseTs}`;
        if (!eventKeys.has(key)) {
          const weatherVisual = pickNearestWeatherVisual(sunriseTs, weatherVisuals);
          if (!weatherVisual) return;
          const { weatherIcon, weatherText, windLabel } = weatherVisual;
          eventKeys.add(key);
          displayItems.push({
            kind: 'sunrise',
            ts: sunriseTs,
            weatherIcon,
            weatherText,
            windLabel,
            timeLabel: day.sunrise,
            topLabel: s.sunrise_label,
          });
        }
      }

      const sunsetTs = parseDailyClockTimestamp(day.fxDate, day.sunset);
      if (sunsetTs != null && sunsetTs >= windowStart && sunsetTs <= windowEnd) {
        const key = `sunset-${sunsetTs}`;
        if (!eventKeys.has(key)) {
          const weatherVisual = pickNearestWeatherVisual(sunsetTs, weatherVisuals);
          if (!weatherVisual) return;
          const { weatherIcon, weatherText, windLabel } = weatherVisual;
          eventKeys.add(key);
          displayItems.push({
            kind: 'sunset',
            ts: sunsetTs,
            weatherIcon,
            weatherText,
            windLabel,
            timeLabel: day.sunset,
            topLabel: s.sunset_label,
          });
        }
      }
    });

    const sortOrder: Record<DisplayItem['kind'], number> = {
      hourly: 0,
      now: 1,
      sunrise: 2,
      sunset: 3,
    };
    const sortedItems = [...displayItems].sort((a, b) => {
      if (a.ts !== b.ts) return a.ts - b.ts;
      return sortOrder[a.kind] - sortOrder[b.kind];
    });

    const temps = sortedAnchors.map(anchor => anchor.temp);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const range = maxT - minT || 1;

    const totalW = sortedItems.length * SLOT_W;
    const points: ChartPoint[] = sortedItems.map((item, i) => {
      const x = SLOT_W / 2 + i * SLOT_W;
      const resolvedTemp = 'temp' in item ? item.temp : interpolateTemp(item.ts, sortedAnchors);
      const norm = (resolvedTemp - minT) / range;
      const y = TEMP_OFFSET_Y + (1 - norm) * (CURVE_H - TEMP_OFFSET_Y - 6);
      return { ...item, x, y };
    });

    const curvePathPoints = [
      { x: 0, y: points[0].y },
      ...points.map(point => ({ x: point.x, y: point.y })),
      { x: totalW, y: points[points.length - 1].y },
    ];

    return {
      points,
      totalW,
      d: buildSmoothPath(curvePathPoints),
      nowPoint: points.find(point => point.kind === 'now') ?? null,
    };
  }, [daily, hourly, now, s, tempUnit, windUnit]);

  if (!chart) return null;

  return (
    <div id="hourly_forecast_stub_inflated_id" className="px-[12px] mb-4 mt-2">
      <div
        className="border backdrop-blur-xl rounded-[24px] text-white overflow-hidden relative"
        style={{ backgroundColor: colors.chart_section_bg, borderColor: colors.card_border }}
      >
        {/* 轻微顶光，避免“上下分层” */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, ${colors.overlay_top_light}, rgba(255,255,255,0.00) 55%)`,
            opacity: 0.8,
          }}
        />

        <div className="relative">
          {/* 标题（对齐反编译：14dp 字号、#99ffffff、top margin≈17dp、start≈20dp） */}
          <div className="text-[14px] font-medium text-white/60 px-[20px] pt-[17px]">
            {minutelySummary || s.hourly_forecast_default_title}
          </div>

          {/* 水平滚动区 */}
          <div className="overflow-x-auto no-scrollbar pb-[16px]">
            <div style={{ width: chart.totalW, position: 'relative' }}>

              {/* SVG 曲线层 */}
              <svg
                width={chart.totalW}
                height={CURVE_H}
                className="block"
                style={{ overflow: 'visible', marginTop: 8 }}
              >
                <path
                  d={chart.d}
                  fill="none"
                  stroke={colors.chart_line_stroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* "现在"高亮点 */}
                {chart.nowPoint && (
                  <circle
                    cx={chart.nowPoint.x}
                    cy={chart.nowPoint.y}
                    r="3"
                    fill="white"
                    stroke={colors.chart_dot_stroke}
                    strokeWidth="2"
                  />
                )}
              </svg>

              {/* 温度文字（绝对定位，跟随曲线） */}
              {chart.points.map((p, i) => (
                <div
                  key={`${p.kind}-${p.ts}-${i}`}
                  className={`absolute whitespace-nowrap ${
                    p.kind === 'sunrise' || p.kind === 'sunset'
                      ? 'text-[11px] font-medium tracking-[0.16em] text-white/80'
                      : 'text-[13px] font-medium text-white'
                  }`}
                  style={{
                    left: p.x,
                    top: p.y - TEMP_OFFSET_Y + 8,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {p.topLabel}
                </div>
              ))}

              {/* 图标 + 风力 + 时间（紧接曲线下方） */}
              <div className="flex">
                {chart.points.map((item, i) => (
                  <div
                    key={`${item.kind}-${item.ts}-${i}`}
                    className="flex flex-col items-center flex-shrink-0"
                    style={{ width: SLOT_W }}
                  >
                    <div className="h-[24px] mt-1 flex items-center justify-center">
                      <img
                        src={item.weatherIcon}
                        alt={item.weatherText}
                        className="w-5 h-5 object-contain opacity-90"
                      />
                    </div>
                    <span className="text-[11px] opacity-50 mt-1 h-[16px] leading-[16px]">
                      {item.windLabel}
                    </span>
                    {/* 时间 */}
                    <span
                      className={`text-[11px] mt-1 mb-1 ${
                        item.kind === 'now' ? 'opacity-100 font-medium' : 'opacity-60'
                      }`}
                    >
                      {item.timeLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
