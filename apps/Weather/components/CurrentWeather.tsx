import React from 'react';
import { WeatherNow, AirQuality, WeatherDaily } from '../types';
import { IcPlay } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherStore } from '../state';
import { getAqiLevelLabel, normalizeAqiLevel } from '../utils/airQuality';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { convertTemp } from '../utils/unitConversion';

interface CurrentWeatherProps {
  weather: WeatherNow;
  airQuality: AirQuality | null;
  todayForecast: WeatherDaily | null;
}

export const CurrentWeather: React.FC<CurrentWeatherProps> = ({ weather, airQuality, todayForecast }) => {
  const s = useAppStrings(strings, stringsEn);
  const tempUnit = useWeatherStore((st) => st.settings.tempUnit);
  if (!weather) return null;
  const weatherText = getLocalizedWeatherText(weather.text, s);
  const airQualityLabel = airQuality
    ? getAqiLevelLabel(normalizeAqiLevel(airQuality.category, airQuality.level), s)
    : '';

  return (
    <div className="flex flex-col items-start px-5 pt-4 pb-8 text-white">
      {/* Huge Temperature */}
      <div className="text-[120px] leading-none font-extralight tracking-tighter -ml-2 font-sans">
        {convertTemp(weather.temp, tempUnit)}°
      </div>
      
      {/* Weather Description & High/Low */}
      <div className="flex items-center gap-3 mt-1 text-lg font-medium opacity-90">
        <span>{weatherText}</span>
        {todayForecast && (
          <span className="tracking-wide">
            {s.temp_high}{convertTemp(todayForecast.tempMax, tempUnit)}° {s.temp_low}{convertTemp(todayForecast.tempMin, tempUnit)}°
          </span>
        )}
      </div>
      
      {/* Pills/Capsules */}
      <div className="flex gap-3 mt-5">
        {airQuality && (
          <div className="flex items-center bg-[#8fb2ad]/40 backdrop-blur-md rounded-full px-3 py-1.5 text-sm font-medium">
            <span className="mr-1">🌿</span>
            <span>{s.air_quality_prefix}{airQualityLabel} {airQuality.aqi}</span>
          </div>
        )}
        <div className="flex items-center bg-[#8fb2ad]/40 backdrop-blur-md rounded-full px-3 py-1.5 text-sm font-medium">
            <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center mr-1.5">
                <IcPlay size={8} fill="#5c7cfa" className="text-[#5c7cfa] ml-0.5" />
            </div>
            <span>{s.weather_forecast_pill}</span>
        </div>
      </div>
    </div>
  );
};
