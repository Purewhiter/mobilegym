import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IcNavBack, IcSearch, IcLocation, IcRefresh } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { getCommonStations, getHotStations, getStationsGroupedByInitial, searchStations } from '../data/stations';
import { loadStations } from '../data/loader';
import type { Station } from '../data/stations';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../../../os/locale';
const LETTERS = 'ABCDEFGHJKLMNPQRSTWXYZ'.split('');

function formatStationPinyin(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const StationSelectPage: React.FC = () => {
  const stationSelectTarget = useRailwayStore(s => s.stationSelectTarget);
  const setFrom = useRailwayStore(s => s.setFrom);
  const setTo = useRailwayStore(s => s.setTo);
  const { bindBack, back } = useRailwayGestures();
  const s = useAppStrings(strings, stringsEn);
  const isEnglish = useLocale() === 'en';
  const [keyword, setKeyword] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [dataReady, setDataReady] = useState(false);

  // 确保车站数据已加载
  useEffect(() => {
    loadStations().then(() => setDataReady(true));
  }, []);

  const grouped = useMemo(() => getStationsGroupedByInitial(), [dataReady]);  const commonStations = useMemo(() => getCommonStations(), [dataReady]);  const hotStations = useMemo(() => getHotStations(), [dataReady]);  const searchResults = useMemo(() => searchStations(keyword), [keyword, dataReady]);  const isSearching = keyword.trim().length > 0;

  const handleSelect = (station: Station) => {
    if (stationSelectTarget === 'from') setFrom(station.name);
    else setTo(station.name);
    back();
  };

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`station-letter-${letter}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getStationPrimaryLabel = (station: Station) => (isEnglish ? formatStationPinyin(station.pinyin) : station.name);
  const getStationSecondaryLabel = (station: Station) => {
    if (!isEnglish) {
      return station.cityName && station.cityName !== station.name ? station.cityName : '';
    }
    return station.name;
  };

  return (
    <div className="min-h-full bg-app-surface flex flex-col">
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="text-white text-lg font-medium flex-1 text-center pr-8">{s.station_select_title}</span>
      </div>

      {/* 搜索框 */}
      <div className="px-4 py-3 bg-app-surface">
        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 gap-2">
          <IcSearch size={16} className="text-gray-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            placeholder={s.station_search_hint}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative" ref={listRef}>
        {isSearching ? (
          /* 搜索结果 */
          <div className="px-4">
            {searchResults.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">{s.station_empty}</p>
            ) : (
              searchResults.map(s => (
                <div key={s.code} className="py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50 flex items-center justify-between" onClick={() => handleSelect(s)}>
                  <span className="text-sm text-gray-900">{getStationPrimaryLabel(s)}</span>
                  {getStationSecondaryLabel(s) && (
                    <span className="text-xs text-gray-400">{getStationSecondaryLabel(s)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {/* 我的位置 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{s.station_my_location}</span>
                <button className="flex items-center gap-1 text-app-primary text-xs">
                  <IcRefresh size={12} />
                  <span>{s.station_relocate}</span>
                </button>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-700">
                <IcLocation size={14} className="text-app-primary" />
                <span>{isEnglish ? 'Hengyang' : '衡阳市'}</span>
              </div>
            </div>

            {/* 常用车站 */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-medium text-sm">{s.station_common}</span>
                <span className="text-xs text-app-primary border border-app-primary rounded px-1.5 py-0.5">{s.action_edit}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {commonStations.map(s => (
                  <button key={s.code} className="py-2 bg-gray-50 rounded-lg text-sm text-gray-700 active:bg-gray-100" onClick={() => handleSelect(s)}>
                    {getStationPrimaryLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* 热门车站 */}
            <div className="px-4 py-3">
              <span className="font-medium text-sm">{s.station_hot}</span>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {hotStations.map(s => (
                  <button key={s.code + '_hot'} className="py-2 bg-gray-50 rounded-lg text-sm text-gray-700 active:bg-gray-100" onClick={() => handleSelect(s)}>
                    {getStationPrimaryLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* 国内/国际 tab */}
            <div className="flex border-b border-app-border px-4 mt-2">
              <div className="pb-2 mr-6 border-b-2 border-app-primary">
                <span className="text-app-primary text-sm font-medium">{s.station_domestic}</span>
              </div>
              <div className="pb-2 text-gray-400">
                <span className="text-sm">{s.station_international}</span>
              </div>
            </div>

            {/* A-Z 列表 */}
            <div className="px-4 pb-20">
              {LETTERS.map(letter => {
                const stations = grouped[letter];
                if (!stations || stations.length === 0) return null;
                return (
                    <div key={letter} id={`station-letter-${letter}`}>
                      <div className="py-2 text-sm text-gray-500 font-medium">{letter}</div>
                      {stations.map(s => (
                        <div key={s.code} className="py-3 border-b border-gray-50 cursor-pointer active:bg-gray-50 flex items-center justify-between" onClick={() => handleSelect(s)}>
                        <span className="text-sm text-gray-900">{getStationPrimaryLabel(s)}</span>
                        {getStationSecondaryLabel(s) && (
                          <span className="text-xs text-gray-400">{getStationSecondaryLabel(s)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 右侧字母索引 */}
        {!isSearching && (
          <div className="fixed right-0.5 top-1/2 -translate-y-1/2 flex flex-col items-center z-20">
            {[(isEnglish ? 'Loc' : '定'), (isEnglish ? 'Fav' : '常'), (isEnglish ? 'Hot' : '热'), ...LETTERS].map((letter, i) => (
              <button
                key={letter + i}
                className="text-[10px] text-app-primary leading-[14px] px-0.5"
                onClick={() => {
                  if (letter === '定' || letter === '常' || letter === '热' || letter === 'Loc' || letter === 'Fav' || letter === 'Hot') return;
                  scrollToLetter(letter);
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
