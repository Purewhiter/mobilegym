import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams, UNSAFE_NavigationContext } from 'react-router-dom';
import { WEATHER_CITY_BY_ID } from '../data';
import { getWeatherBundle } from '../services/weatherService';
import type { WeatherBundle } from '../types';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import {
  upsertSavedCity,
  setSelectedCityId,
  setStoredBundle,
} from '../utils/weatherStore';
import { useWeatherStore } from '../state';
import type { AirQuality, WeatherDaily } from '../types';
import { IcLeaf, IcPlay } from '../res/icons';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useLocale } from '@/os/locale';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import * as TimeService from '../../../os/TimeService';
import WeatherDynamicBackground from '../components/WeatherDynamicBackground';
import { convertTemp } from '../utils/unitConversion';
import { normalizeAqiLevel, getAqiLevelLabel } from '../utils/airQuality';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { getLocalizedWeatherCityName } from '../utils/cityNames';
import { getDailyForecastGridTemplate } from '../utils/dailyForecastGrid';

const DailyRows: React.FC<{ daily: WeatherDaily[] }> = ({ daily }) => {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const tempUnit = useWeatherStore((st) => st.settings.tempUnit);
  if (!daily || daily.length < 3) return null;

  const days = daily.slice(0, 3);
  const getDayOfWeek = (dateStr: string) => {
    const d = TimeService.fromTimestamp(TimeService.parseToTimestamp(dateStr));
    const names = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
    return names[d.getDay()];
  };

  const labels = [s.today, s.tomorrow, getDayOfWeek(days[2].fxDate)];
  const tempsMin = days.map((day) => convertTemp(day.tempMin, tempUnit));
  const tempsMax = days.map((day) => convertTemp(day.tempMax, tempUnit));
  const minAll = Math.min(...tempsMin);
  const maxAll = Math.max(...tempsMax);
  const range = Math.max(1, maxAll - minAll);
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const isEnglish = locale === 'en';
  const gridTemplateColumns = getDailyForecastGridTemplate(isEnglish);

  return (
    <div className="px-5">
      {days.map((day, i) => {
        const weatherText = getLocalizedWeatherText(day.textDay, s);
        const tMin = tempsMin[i];
        const tMax = tempsMax[i];
        const leftPct = clamp((tMin - minAll) / range) * 100;
        const widthPct = clamp((tMax - tMin) / range) * 100;

        return (
          <React.Fragment key={day.fxDate}>
            <div
              className="h-[44px] grid items-center gap-x-1"
              style={{ gridTemplateColumns }}
            >
              <div className="h-full flex items-center min-w-0">
                <span className={`${isEnglish ? 'text-[15px]' : 'text-[17px]'} font-medium leading-none text-white truncate`}>
                  {labels[i]}
                </span>
              </div>
              <div className="h-full flex items-center min-w-0">
                <span className={`${isEnglish ? 'text-[15px]' : 'text-[17px]'} leading-none text-white truncate`}>
                  {weatherText}
                </span>
              </div>
              <div className="h-full flex items-center justify-center">
                <img
                  src={getWeatherIconUrl(day.iconDay, day.textDay)}
                  alt={weatherText}
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div className="h-full flex items-center justify-start">
                <span className="text-[15px] font-medium leading-none text-white">{tMin}{'\u00B0'}</span>
              </div>
              <div className="h-full flex items-center justify-center">
                <div
                  className="w-[53px] h-[6px] rounded-full relative overflow-hidden"
                  style={{ backgroundColor: colors.temp_bar_track }}
                >
                  <div
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-blue-200 to-yellow-200 opacity-90"
                    style={{
                      left: `${leftPct}%`,
                      width: `${Math.max(widthPct, 8)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="h-full flex items-center justify-end">
                <span className="text-[15px] font-medium leading-none text-white">{tMax}{'\u00B0'}</span>
              </div>
            </div>
            {i < days.length - 1 && <div className="h-px" style={{ backgroundColor: colors.divider_daily }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const WeatherCityPreviewPage: React.FC = () => {
  const { bindBack, bindTap, back, go } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const tempUnit = useWeatherStore((st) => st.settings.tempUnit);
  const [searchParams] = useSearchParams();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const cityId = searchParams.get('cityId') ?? '';
  const cityDef = useMemo(() => WEATHER_CITY_BY_ID[cityId], [cityId]);

  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!cityDef) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const lonLat = `${cityDef.lon},${cityDef.lat}`;
        const result = await getWeatherBundle(lonLat, { dailysteps: 15, hourlysteps: 24, alert: true });
        if (!cancelled) setBundle(result);
      } catch (error) {
        console.error('Failed to fetch preview weather', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityDef]);

  useEffect(() => {
    if (!cityDef || !bundle) return;
    useWeatherStore.setState((prev) => setStoredBundle(prev, cityDef.id, {
      lonLat: `${cityDef.lon},${cityDef.lat}`,
      bundle,
    }), true);
  }, [bundle, cityDef]);

  const handleAdd = () => {
    if (!cityDef || adding) return;
    setAdding(true);

    let state = useWeatherStore.getState();
    state = upsertSavedCity(state, {
      id: cityDef.id,
      name: cityDef.name,
      lon: cityDef.lon,
      lat: cityDef.lat,
    });
    state = setSelectedCityId(state, cityDef.id);
    if (bundle) {
      state = setStoredBundle(state, cityDef.id, {
        lonLat: `${cityDef.lon},${cityDef.lat}`,
        bundle,
      });
    }
    useWeatherStore.setState(state, true);

    const memoryNavigator = navigator as any;
    const depth = typeof memoryNavigator.index === 'number' ? memoryNavigator.index : 0;
    if (depth > 0) {
      back(depth);
    } else {
      go('home.open');
    }
  };

  if (!cityDef) {
    return (
      <div className="w-full h-full bg-app-bg flex items-center justify-center text-white/60">
        {s.unknown_city}
      </div>
    );
  }

  const now = bundle?.now;
  const daily = bundle?.daily ?? [];
  const airQuality: AirQuality | null = bundle?.airQuality ?? null;
  const day0 = daily[0];
  const weatherText = getLocalizedWeatherText(now?.text, s);
  const airQualityLevel = normalizeAqiLevel(airQuality?.category ?? '', airQuality?.level);
  const cityName = getLocalizedWeatherCityName(cityDef, s);

  return (
    <div className="w-full h-full relative overflow-y-auto no-scrollbar">
      <WeatherDynamicBackground cityId={cityDef.id} />

      <div className="relative z-10 flex flex-col min-h-full">
        <div className="flex items-center justify-between px-3 pt-12 pb-2">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>()}
            className="h-[36px] px-5 rounded-full backdrop-blur-md text-white text-[16px] font-medium active:bg-white/25 transition-colors"
            style={{ backgroundColor: colors.pill_bg_action }}
          >
            {s.cancel}
          </button>
          <button
            type="button"
            {...bindTap<HTMLButtonElement>('home.open', { onTrigger: handleAdd })}
            disabled={adding || loading}
            className="h-[36px] px-5 rounded-full backdrop-blur-md text-white text-[16px] font-medium active:bg-white/25 transition-colors disabled:opacity-50"
            style={{ backgroundColor: colors.pill_bg_action }}
          >
            {s.add}
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-white/60">{s.loading}</div>
        ) : (
          <>
            <div className="px-8 pt-6">
              <div className="text-white text-[16px] font-normal tracking-wide">{cityName}</div>
            </div>

            <div className="px-8 pt-1">
              <div className="flex items-start">
                <span className="text-[130px] leading-none font-extralight tracking-tighter text-white font-sans">
                  {now?.temp ? convertTemp(now.temp, tempUnit) : '--'}
                </span>
                <span className="text-[72px] leading-none font-extralight text-white mt-[14px]">{'\u00B0'}</span>
              </div>
            </div>

            <div className="px-8 mt-2">
              <div className="text-white text-[18px] font-medium opacity-90">
                <span>{weatherText}</span>
                {day0 && (
                  <span className="ml-2">
                    {s.temp_high}{convertTemp(day0.tempMax, tempUnit)}{'\u00B0'} {s.temp_low}{convertTemp(day0.tempMin, tempUnit)}{'\u00B0'}
                  </span>
                )}
              </div>
            </div>

            <div className="px-8 mt-3 flex items-center gap-2">
              {airQuality && (
                <div
                  className="flex items-center h-[30px] backdrop-blur-md rounded-full px-2 text-white text-[16px] font-medium"
                  style={{ backgroundColor: colors.pill_bg_main }}
                >
                  <IcLeaf size={14} className="mr-1 opacity-80" />
                  <span>{s.air_quality_prefix} {getAqiLevelLabel(airQualityLevel, s)} {airQuality.aqi}</span>
                </div>
              )}
              <div
                className="flex items-center h-[30px] backdrop-blur-md rounded-full px-2 text-white text-[16px] font-medium"
                style={{ backgroundColor: colors.pill_bg_main }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center mr-1"
                  style={{ backgroundColor: colors.forecast_play_icon_bg }}
                >
                  <IcPlay size={8} fill={colors.forecast_play_icon} className="ml-0.5" style={{ color: colors.forecast_play_icon }} />
                </div>
                <span>{s.weather_forecast_pill}</span>
              </div>
            </div>

            <div className="flex-1 min-h-[80px]" />

            <div className="px-3 pb-4">
              <div
                className="backdrop-blur-xl rounded-[24px] border overflow-hidden pt-2 pb-4"
                style={{ backgroundColor: colors.card_surface_light, borderColor: colors.card_border }}
              >
                <DailyRows daily={daily} />

                <div className="px-5 mt-2">
                  <button
                    type="button"
                    {...bindTap<HTMLButtonElement>('forecast.daily.open', { params: { cityId: cityDef.id } })}
                    className="w-full h-[47px] rounded-[16px] text-white text-[20px] font-medium active:bg-white/[0.12] transition-colors"
                    style={{ backgroundColor: colors.card_action_surface }}
                  >
                    {s.view_15day_forecast}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WeatherCityPreviewPage;
