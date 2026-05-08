import React from 'react';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '../../../os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { colors } from '../res/colors';
import { useWeatherStore } from '../state';
import { WeatherDaily } from '../types';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { convertTemp } from '../utils/unitConversion';
import { getWeatherIcon as getWeatherIconUrl } from '../utils/weatherIcons';
import { getDailyForecastGridTemplate } from '../utils/dailyForecastGrid';

interface DailyForecastShortProps {
  daily: WeatherDaily[];
  forecastButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

export const DailyForecastShort: React.FC<DailyForecastShortProps> = ({ daily, forecastButtonProps }) => {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const tempUnit = useWeatherStore(st => st.settings.tempUnit);

  if (!daily || daily.length < 3) return null;

  const days = daily.slice(0, 3);
  const labels = [s.today, s.tomorrow, getDayOfWeek(days[2].fxDate)];
  const tempsMin = days.map(day => convertTemp(day.tempMin, tempUnit));
  const tempsMax = days.map(day => convertTemp(day.tempMax, tempUnit));
  const minAll = Math.min(...tempsMin);
  const maxAll = Math.max(...tempsMax);
  const totalRange = Math.max(1, maxAll - minAll);
  const isEnglish = locale === 'en';
  const gridTemplateColumns = getDailyForecastGridTemplate(isEnglish);

  function getDayOfWeek(dateStr: string) {
    const date = TimeService.fromTimestamp(TimeService.parseToTimestamp(dateStr));
    const dayNames = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
    return dayNames[date.getDay()];
  }

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

  const renderWeatherIcon = (day: WeatherDaily) => {
    const iconUrl = getWeatherIconUrl(day.iconDay, day.textDay);
    return <img src={iconUrl} alt={getLocalizedWeatherText(day.textDay, s)} className="w-6 h-6 object-contain" />;
  };

  return (
    <div className="px-[11px] mb-1">
      <div
        className="backdrop-blur-xl rounded-[24px] border text-white/90 overflow-hidden"
        style={{ backgroundColor: colors.card_surface_light, borderColor: colors.card_border }}
      >
        <div className="px-[20px] pt-[6px] pb-[8px]">
          {days.map((day, index) => {
            const weatherText = getLocalizedWeatherText(day.textDay, s);
            const tMin = tempsMin[index];
            const tMax = tempsMax[index];
            const leftPct = clamp01((tMin - minAll) / totalRange) * 100;
            const widthPct = clamp01((tMax - tMin) / totalRange) * 100;

            return (
              <React.Fragment key={day.fxDate}>
                <div className="h-[44px] grid items-center gap-x-1" style={{ gridTemplateColumns }}>
                  <div className="h-full flex items-center min-w-0">
                    <span className={`${isEnglish ? 'text-[15px]' : 'text-[17px]'} font-medium leading-none truncate`}>
                      {labels[index]}
                    </span>
                  </div>
                  <div className="h-full flex items-center min-w-0">
                    <span className={`${isEnglish ? 'text-[15px]' : 'text-[17px]'} leading-none truncate`}>
                      {weatherText}
                    </span>
                  </div>
                  <div className="h-full flex items-center justify-center">
                    {renderWeatherIcon(day)}
                  </div>
                  <div className="h-full flex items-center justify-start">
                    <span className="text-[15px] font-medium leading-none">{tMin}°</span>
                  </div>
                  <div className="h-full flex items-center justify-center">
                    <div className="w-[53px] h-[6px] rounded-full relative overflow-hidden" style={{ backgroundColor: colors.temp_bar_track }}>
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
                    <span className="text-[15px] font-medium leading-none">{tMax}°</span>
                  </div>
                </div>

                {index < days.length - 1 && <div className="h-px" style={{ backgroundColor: colors.divider_daily }} />}
              </React.Fragment>
            );
          })}

          <button
            type="button"
            {...forecastButtonProps}
            className="w-full h-[47px] mt-[6px] rounded-[16px] text-white text-[20px] font-medium active:bg-white/[0.12] transition-colors"
            style={{ backgroundColor: colors.card_action_surface }}
          >
            {s.view_15day_forecast}
          </button>
        </div>
      </div>
    </div>
  );
};
