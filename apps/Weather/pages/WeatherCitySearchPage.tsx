import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { WEATHER_CONFIG, searchCities, type SearchableCity } from '../data';
import {
  setSelectedCityId,
  addSearchHistory,
  clearSearchHistory,
} from '../utils/weatherStore';
import { useWeatherStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { getLocalizedWeatherCityName } from '../utils/cityNames';

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

const MAJOR_CITIES = WEATHER_CONFIG.majorCities;

const GRID = {
  colLefts: [11.7, 127.7, 243.7],
  cellW: 104.7,
  cellH: 39.0,
} as const;

function formatResultLine(city: SearchableCity, country: string, s: typeof strings): string {
  const name = getLocalizedWeatherCityName(city, s);
  if (s.app_name !== strings.app_name) {
    return `${name} - ${country}`;
  }
  if (city.name === city.adm2) {
    return `${city.name} - ${country}`;
  }
  return `${city.name} - ${city.adm2}, ${country}`;
}

const WeatherCitySearchPage: React.FC = () => {
  const { bindTap, bindBack, back } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);
  const weatherState = useWeatherStore();
  const setState = useCallback(
    (updater: (prev: typeof weatherState) => typeof weatherState) => {
      useWeatherStore.setState(updater(useWeatherStore.getState()), true);
    },
    [],
  );
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selectedIds = useMemo(
    () => new Set<string>(weatherState.savedCities.map((c) => c.id)),
    [weatherState.savedCities],
  );

  const searchResults = useMemo(() => searchCities(query), [query]);
  const hasQuery = query.trim().length > 0;
  const searchHistory = weatherState.searchHistory ?? [];

  const handleSelectAdded = useCallback(
    (cityId: string) => {
      setState((prev) => setSelectedCityId(prev, cityId));
      back(2);
    },
    [setState, back],
  );

  const handleSearchResultTap = useCallback(
    (city: SearchableCity) => {
      setState((prev) => addSearchHistory(prev, getLocalizedWeatherCityName(city, s)));
    },
    [setState, s],
  );

  const handleClearHistory = useCallback(() => {
    setState((prev) => clearSearchHistory(prev));
  }, [setState]);

  const handleHistoryTap = useCallback(
    (name: string) => {
      setQuery(name);
    },
    [],
  );

  // 搜索历史标签区高度：每行 39px + 间距，最多 ~3 行
  const historyRowCount = searchHistory.length > 0 ? Math.ceil(searchHistory.length / 3) : 0;
  const historyBlockHeight = historyRowCount > 0 ? 34 + historyRowCount * 50 : 0;

  // 全国主要城市网格顶部起始位置
  const majorCitiesTopBase = historyBlockHeight > 0 ? 100 + historyBlockHeight + 16 : 100;
  const gridRowTops = Array.from(
    { length: 8 },
    (_, i) => majorCitiesTopBase + 36 + i * 50.7,
  );

  const gridItems = useMemo(() => {
    const items: Array<{ city: (typeof MAJOR_CITIES)[number]; col: number; row: number }> = [];
    let idx = 0;
    for (let r = 0; r < gridRowTops.length; r++) {
      for (let c = 0; c < 3; c++) {
        if (idx >= MAJOR_CITIES.length) break;
        if (r === gridRowTops.length - 1 && c === 2) break;
        items.push({ city: MAJOR_CITIES[idx], col: c, row: r });
        idx++;
      }
    }
    return items;
  }, [gridRowTops]);

  return (
    <div className="w-full h-full relative bg-[#f3f4f6] overflow-hidden" data-status-bar-foreground="dark">
      {/* 搜索框背景 */}
      <div
        style={abs({ left: 11.7, top: 44.3, width: 277.7, height: 42.7 })}
        className="rounded-full bg-[#e9eaee]"
      />

      {/* 放大镜图标 */}
      <div
        style={abs({ left: 11.7, top: 54.0, width: 42.7, height: 23.3 })}
        className={[
          'pointer-events-none',
          'relative',
          "before:content-[''] before:absolute before:left-[10px] before:top-[3px] before:w-[12px] before:h-[12px]",
          'before:border-[2px] before:border-[#b8bcc4] before:rounded-full',
          "after:content-[''] after:absolute after:left-[22px] after:top-[14px] after:w-[8px] after:h-[2px]",
          'after:bg-[#b8bcc4] after:rotate-45 after:origin-left',
        ].join(' ')}
      />

      {/* 搜索输入 */}
      <input
        ref={inputRef}
        id="act_find_city_key"
        type="text"
        value={query}
        placeholder={s.city_manager_search_placeholder}
        onChange={(e) => setQuery(e.target.value)}
        style={abs({ left: 54.3, top: 44.3, width: 235.0, height: 47.7 })}
        className="z-10 outline-none bg-transparent border-0 text-[18px] font-medium text-black placeholder:text-[#b8bcc4]"
      />

      {/* 取消按钮 */}
      <button
        type="button"
        id="tv_search_cancel"
        {...bindBack<HTMLButtonElement>()}
        style={abs({ left: 289.3, top: 52.7, width: 59.0, height: 26.3 })}
        className="bg-transparent border-0 p-0 m-0 text-[18px] font-semibold text-app-primary active:opacity-70"
      >
        {s.cancel}
      </button>

      {/* ── 搜索结果列表 ── */}
      {hasQuery && (
        <div
          className="absolute left-0 right-0 bottom-0 overflow-y-auto bg-white z-20"
          style={{ top: 96 }}
        >
          {searchResults.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[16px] text-gray-400">
              {s.city_search_no_results}
            </div>
          ) : (
            searchResults.map((city) => {
              const added = selectedIds.has(city.id);
              return (
                <button
                  key={city.id}
                  type="button"
                  className="w-full h-[56px] flex items-center px-4 border-0 bg-transparent active:bg-black/5 text-left"
                  {...(added
                    ? {
                        onClick: () => {
                          handleSearchResultTap(city);
                          handleSelectAdded(city.id);
                        },
                      }
                    : {
                        ...bindTap<HTMLButtonElement>('city.preview.open', {
                          params: { cityId: city.id },
                          beforeTrigger: () => handleSearchResultTap(city),
                        }),
                      })}
                >
                  <span className="text-[16px] text-[#111827] truncate">
                    {formatResultLine(city, s.city_search_country, s)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── 初始状态（搜索历史 + 全国主要城市） ── */}
      {!hasQuery && (
        <div
          className="absolute left-0 right-0 bottom-0 overflow-y-auto"
          style={{ top: 96 }}
        >
          {/* 搜索历史 */}
          {searchHistory.length > 0 && (
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-app-text-muted text-[16px] font-semibold">
                  {s.city_search_history}
                </span>
                <button
                  type="button"
                  className="bg-transparent border-0 p-1 active:opacity-70"
                  onClick={handleClearHistory}
                  aria-label={s.city_search_clear_history}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {searchHistory.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="h-[39px] px-3 rounded-[10px] bg-white text-[15px] font-medium text-[#111827] border-0 active:opacity-80"
                    onClick={() => handleHistoryTap(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 全国主要城市 */}
          <div className="px-4" style={{ marginTop: searchHistory.length > 0 ? 20 : 8 }}>
            <div className="text-app-text-muted text-[16px] font-semibold mb-2">
              {s.city_search_major_cities}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {MAJOR_CITIES.map((city) => {
                const selected = selectedIds.has(city.id);
                return (
                  <button
                    key={city.id}
                    type="button"
                    className={[
                      'h-[39px] rounded-[10px] border-0',
                      'text-[15px] font-semibold',
                      'active:opacity-80',
                      selected ? 'bg-[#e7f0ff] text-app-primary' : 'bg-white text-[#111827]',
                    ].join(' ')}
                    {...(selected
                      ? { onClick: () => handleSelectAdded(city.id) }
                      : bindTap<HTMLButtonElement>('city.preview.open', {
                          params: { cityId: city.id },
                        }))}
                  >
                    {getLocalizedWeatherCityName(city, s)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherCitySearchPage;
