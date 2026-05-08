import React, { useMemo } from 'react';
import locatedIcon from '../assets/drawables/ic_manager_item_located.svg';
import { setSelectedCityId } from '../utils/weatherStore';
import { useWeatherStore } from '../state';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import type { TempUnit } from '../types';
import { convertTemp } from '../utils/unitConversion';
import { getLocalizedWeatherText } from '../utils/localizedText';
import { getLocalizedLocationName, getLocalizedWeatherCityName } from '../utils/cityNames';

type Box = { left: number; top: number; width: number; height: number };

function abs(box: Box): React.CSSProperties {
  return {
    position: 'absolute',
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  };
}

function CardBackground({ box, variant }: { box: Box; variant?: 'rainy' | 'cloudy' | 'default' }) {
  const base = 'rounded-[18px] overflow-hidden';
  const bg =
    variant === 'rainy'
      ? 'bg-gradient-to-br from-[#1e2b3f] to-app-surface'
      : variant === 'cloudy'
        ? 'bg-gradient-to-br from-[#1b243a] to-[#131a2b]'
        : 'bg-gradient-to-br from-[#1a2238] to-[#12192a]';

  return (
    <div style={abs(box)} className={`${base} ${bg} pointer-events-none`}>
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background:
            'radial-gradient(120px 80px at 70% 30%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(180px 120px at 20% 80%, rgba(255,255,255,0.10), transparent 60%)',
        }}
      />
      {variant === 'rainy' && (
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            background:
              'repeating-linear-gradient(110deg, rgba(255,255,255,0.0) 0px, rgba(255,255,255,0.0) 8px, rgba(255,255,255,0.25) 9px, rgba(255,255,255,0.0) 12px)',
            transform: 'translateY(12px)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
}

type CityPreview = {
  name: string;
  weatherText: string;
  tempText: string;
  highLowText: string;
};

function CityCardOverlay({
  city,
  isLocated,
  top,
  variant,
}: {
  city: CityPreview;
  isLocated?: boolean;
  top: number;
  variant?: 'rainy' | 'cloudy' | 'default';
}) {
  const bgTop = top + 4.0;
  const bgBox: Box = { left: 11.7, top: bgTop, width: 336.7, height: 93.7 };
  const nameBox: Box = { left: 26.3, top: bgTop + 16.3, width: 210, height: 26.3 };
  const tempBox: Box = { left: 240, top: bgTop + 14.3, width: 94, height: 44.7 };
  const weatherBox: Box = { left: 26.3, top: bgTop + 59.0, width: 120, height: 18.3 };
  const highLowBox: Box = { left: 210, top: bgTop + 59.0, width: 124, height: 18.3 };

  return (
    <>
      <CardBackground box={bgBox} variant={variant} />

      <div
        style={abs(nameBox)}
        className="pointer-events-none flex items-center gap-1.5 text-white text-[22px] font-semibold tracking-wide"
      >
        <span className="truncate">{city.name}</span>
        {isLocated && (
          <img
            src={locatedIcon}
            alt=""
            className="shrink-0"
            style={{ width: 13, height: 16.3 }}
            draggable={false}
          />
        )}
      </div>

      <div
        style={abs(tempBox)}
        className="pointer-events-none flex items-center justify-end text-white text-[44px] font-extralight tracking-tight"
      >
        {city.tempText}
      </div>

      <div
        className="pointer-events-none flex items-center text-[15px] font-medium"
        style={{ ...abs(weatherBox), color: colors.city_manager_card_text }}
      >
        {city.weatherText}
      </div>

      <div
        className="pointer-events-none flex items-center justify-end text-[15px] font-medium"
        style={{ ...abs(highLowBox), color: colors.city_manager_card_text }}
      >
        {city.highLowText}
      </div>
    </>
  );
}

function getCardVariant(weatherText: string): 'rainy' | 'cloudy' | 'default' {
  const normalized = weatherText.toLowerCase();
  if (normalized.includes('rain') || normalized.includes('snow')) return 'rainy';
  if (normalized.includes('cloud') || normalized.includes('overcast') || normalized.includes('fog') || normalized.includes('haze')) {
    return 'cloudy';
  }
  return 'default';
}

function previewFromBundle(name: string, bundle: any | undefined, tempUnit: TempUnit, s: typeof strings): CityPreview {
  const now = bundle?.now;
  const day0 = Array.isArray(bundle?.daily) ? bundle.daily[0] : undefined;
  const temp = typeof now?.temp === 'string' && now.temp.length > 0 ? `${convertTemp(now.temp, tempUnit)}\u00B0` : '--\u00B0';
  const weatherText = getLocalizedWeatherText(now?.text, s);
  const highLowText = day0?.tempMax && day0?.tempMin
    ? `${convertTemp(day0.tempMax, tempUnit)}\u00B0 / ${convertTemp(day0.tempMin, tempUnit)}\u00B0`
    : '--\u00B0 / --\u00B0';
  return { name, weatherText, tempText: temp, highLowText };
}

const WeatherCityManagerPage: React.FC = () => {
  const { bindTap, bindBack } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const weatherState = useWeatherStore();
  const tempUnit = weatherState.settings.tempUnit;

  const setWeatherState = (updater: (prev: typeof weatherState) => typeof weatherState) => {
    useWeatherStore.setState(updater(useWeatherStore.getState()), true);
  };

  const cards = useMemo(() => {
    const locatedEntry = weatherState.bundlesByCityId.located;
    const locatedName = getLocalizedLocationName(locatedEntry?.locationName, s);
    const locatedPreview = previewFromBundle(locatedName, locatedEntry?.bundle, tempUnit, s);

    const added = weatherState.savedCities.map((city) => {
      const entry = weatherState.bundlesByCityId[city.id];
      return {
        cityId: city.id,
        preview: previewFromBundle(getLocalizedWeatherCityName(city, s), entry?.bundle, tempUnit, s),
      };
    });

    return {
      located: { cityId: 'located', preview: locatedPreview },
      added,
    };
  }, [s, tempUnit, weatherState.bundlesByCityId, weatherState.savedCities]);

  return (
    <div className="w-full h-full relative bg-white overflow-hidden" data-status-bar-foreground="dark">
      <button
        type="button"
        {...bindBack<HTMLButtonElement>()}
        style={abs({ left: 19.7, top: 48.0, width: 39.0, height: 39.0 })}
        className={[
          'z-20',
          'bg-transparent border-0 p-0 m-0',
          'text-[0px] overflow-hidden',
          'relative',
          "before:content-[''] before:absolute before:left-[14px] before:top-[12px] before:w-[12px] before:h-[12px]",
          'before:border-l-[2.5px] before:border-b-[2.5px] before:border-black before:rotate-45',
          'active:opacity-70',
        ].join(' ')}
      >
        {s.back}
      </button>

      <div
        style={abs({ left: 25.3, top: 98.7, width: 320, height: 42.0 })}
        className="text-[34px] font-bold text-black flex items-center"
      >
        {s.city_manager_title}
      </div>

      <button
        type="button"
        id="search_bar"
        {...bindTap<HTMLButtonElement>('city.search.open')}
        style={abs({ left: 0, top: 150.3, width: 360, height: 54.7 })}
        className="z-10 bg-transparent border-0 p-0 m-0"
        aria-label={s.city_manager_search_placeholder}
      />

      <div
        style={abs({ left: 11.7, top: 154.0, width: 336.7, height: 43.0 })}
        className="rounded-full bg-[#f2f3f5]"
      />

      <div
        style={abs({ left: 11.7, top: 163.7, width: 42.7, height: 23.3 })}
        className={[
          'pointer-events-none',
          'relative',
          "before:content-[''] before:absolute before:left-[10px] before:top-[3px] before:w-[12px] before:h-[12px]",
          'before:border-[2px] before:border-[#b8bcc4] before:rounded-full',
          "after:content-[''] after:absolute after:left-[22px] after:top-[14px] after:w-[8px] after:h-[2px]",
          'after:bg-[#b8bcc4] after:rotate-45 after:origin-left',
        ].join(' ')}
      />

      <div
        style={abs({ left: 54.3, top: 154.0, width: 294.0, height: 43.0 })}
        className="pointer-events-none flex items-center text-[#b8bcc4] text-[18px] font-medium"
      >
        {s.city_manager_search_placeholder}
      </div>

      <div
        id="recycler_view_manager"
        style={abs({ left: 0, top: 205.0, width: 360, height: 595.0 })}
        className="relative overflow-y-auto no-scrollbar"
      >
        <div
          style={abs({ left: 11.7, top: 4.0, width: 120, height: 34.3 })}
          className="pointer-events-none text-app-text-muted text-[14px] font-semibold flex items-center"
        >
          {s.city_manager_current_location}
        </div>

        <button
          type="button"
          style={abs({ left: 0, top: 38.3, width: 360, height: 105.3 })}
          className="bg-transparent border-0 p-0 m-0"
          aria-label={cards.located.preview.name}
          {...bindBack<HTMLButtonElement>({
            beforeTrigger: () => {
              setWeatherState((prev) => setSelectedCityId(prev, 'located'));
            },
          })}
        />
        <CityCardOverlay city={cards.located.preview} isLocated top={38.3} variant="default" />

        <div
          style={abs({ left: 11.7, top: 143.7, width: 140, height: 34.3 })}
          className="pointer-events-none text-app-text-muted text-[14px] font-semibold flex items-center"
        >
          {s.city_manager_added_cities}
        </div>

        {cards.added.map((item, idx) => {
          const wrapperTop = 178.0 + idx * 105.3;
          const variant = getCardVariant(item.preview.weatherText);

          return (
            <React.Fragment key={`${item.cityId}-${idx}`}>
              <button
                type="button"
                style={abs({ left: 0, top: wrapperTop, width: 360, height: 105.3 })}
                className="bg-transparent border-0 p-0 m-0"
                aria-label={item.preview.name}
                {...bindBack<HTMLButtonElement>({
                  beforeTrigger: () => {
                    setWeatherState((prev) => setSelectedCityId(prev, item.cityId));
                  },
                })}
              />
              <CityCardOverlay city={item.preview} top={wrapperTop} variant={variant} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherCityManagerPage;
