import React, { useEffect, useState, useRef, useContext, useCallback, useMemo } from 'react';
import { MemoryRouter, useNavigate, useLocation, useSearchParams, UNSAFE_NavigationContext, Routes, Route } from 'react-router-dom';
import { getWeatherBundle } from './services/weatherService';
import type { WeatherBundle } from './types';
import * as LocationService from '../../os/LocationService';
import { reverseGeocode } from '../../os/LocationService';
import { findLibraryLocationName, saveToLibrary } from './utils/weatherLibrary';
import {
  WeatherNow,
  WeatherDaily,
  WeatherHourly,
  WeatherIndex,
  WeatherWarning,
  AirQuality
} from './types';
import { WarningCard } from './components/WarningCard';
import { DailyForecastShort } from './components/DailyForecastShort';
import { HourlyForecastChart } from './components/HourlyForecastChart';
import { DetailsGrid } from './components/DetailsGrid';
import { LifeIndices } from './components/LifeIndices';
import { IcAdd, IcMoreVert, IcPlay, IcLeaf } from './res/icons';
import { getWeatherIcon as getWeatherIconUrl } from './utils/weatherIcons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight } = SIMULATOR_CONFIG.framework;
import WeatherSettingsPage from './pages/WeatherSettingsPage';
import WeatherPrivacySettingsPage from './pages/WeatherPrivacySettingsPage';
import WeatherPermissionsPage from './pages/WeatherPermissionsPage';
import WeatherCityManagerPage from './pages/WeatherCityManagerPage';
import WeatherCitySearchPage from './pages/WeatherCitySearchPage';
import WeatherCityPreviewPage from './pages/WeatherCityPreviewPage';
import WeatherDailyForecastPage from './pages/WeatherDailyForecastPage';
import WeatherAirQualityPage from './pages/WeatherAirQualityPage';
import {
  setSelectedCityId,
  setStoredBundle,
  isBundleFresh,
} from './utils/weatherStore';
import { useWeatherStore } from './state';
import { convertTemp } from './utils/unitConversion';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { anim } from './res/anim';
import { dimens } from './res/dimens';
import { useAppStrings } from '../../os/useAppStrings';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { AppLifecycle } from '../../os/AppLifecycle';
import { useWeatherGestures } from './hooks/useWeatherGestures';
import WeatherDynamicBackground from './components/WeatherDynamicBackground';
import { normalizeAqiLevel, getAqiLevelLabel } from './utils/airQuality';
import { getLocalizedMinutelySummary, getLocalizedWeatherText } from './utils/localizedText';
import { getLocalizedLocationName, getLocalizedWeatherCityName } from './utils/cityNames';

// 城市来源说明：
// - 主页面与城市管理页统一从 localStorage 单键 `weather` 恢复城市列表
// - 若首次启动无状态，则使用 weatherStore 的默认“已添加城市”列表 + 1 个定位页（共 7 页）

// 定位页天气缓存 TTL：与真机实况刷新间隔对齐（30 分钟）。
// 配合 lonLat 比对，定位变化或时间推进越过 TTL 都会触发重新拉取。
const LOCATED_WEATHER_TTL_MS = 30 * 60 * 1000;

// 单个城市的天气数据
interface CityWeatherData {
  locationName: string;
  weatherNow: WeatherNow | null;
  dailyForecast: WeatherDaily[];
  hourlyForecast: WeatherHourly[];
  indices: WeatherIndex[];
  warnings: WeatherWarning[];
  airQuality: AirQuality | null;
  minutelySummary: string;
  minutelySub: string;
  loading: boolean;
}

const emptyCityWeatherData = (locationName: string): CityWeatherData => ({
  locationName,
  weatherNow: null,
  dailyForecast: [],
  hourlyForecast: [],
  indices: [],
  warnings: [],
  airQuality: null,
  minutelySummary: '',
  minutelySub: '',
  loading: true,
});

const cityWeatherDataFromBundle = (locationName: string, bundle: WeatherBundle): CityWeatherData => ({
  locationName,
  weatherNow: bundle.now,
  dailyForecast: bundle.daily,
  hourlyForecast: bundle.hourly,
  indices: bundle.indices,
  warnings: bundle.warnings,
  airQuality: bundle.airQuality,
  minutelySummary: bundle.minutely?.summary || '',
  minutelySub: bundle.minutely?.summary ? 'safe_to_go_out' : '',
  loading: false,
});

// 城市卡片内容组件（只包含下方卡片部分）
interface CityCardsProps {
  data: CityWeatherData;
  forecastButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  warningRef?: React.Ref<HTMLDivElement>;
}

const CityCards: React.FC<CityCardsProps> = ({ data, forecastButtonProps, warningRef }) => {
  const s = useAppStrings(strings, stringsEn);
  const localizedMinutelySummary = getLocalizedMinutelySummary(data.minutelySummary, s);
  if (data.loading) {
    return (
      <div className="w-full flex-shrink-0 flex items-center justify-center py-20 text-white/60 snap-center">
        {s.loading}
      </div>
    );
  }

  return (
    <div className="w-full flex-shrink-0 snap-center pt-6">
      <div ref={warningRef}>
        <WarningCard warnings={data.warnings || []} />
      </div>

      <DailyForecastShort daily={data.dailyForecast} forecastButtonProps={forecastButtonProps} />

      <HourlyForecastChart
        now={data.weatherNow}
        daily={data.dailyForecast}
        hourly={data.hourlyForecast}
        minutelySummary={localizedMinutelySummary || s.hourly_forecast_default_title}
      />

      <div className="px-[11px] mb-4">
        <div
          className="backdrop-blur-md border rounded-xl p-4 text-white h-28 flex justify-between items-center relative overflow-hidden"
          style={{ backgroundColor: colors.card_surface, borderColor: colors.card_border }}
        >
          <div className="z-10">
            <div className="text-sm opacity-70 mb-1">{s.precipitation_forecast_title}</div>
            <div className="text-xl font-medium mb-1">
              {localizedMinutelySummary || s.no_precipitation_short}
            </div>
            <div className="text-xs opacity-60">{data.minutelySub ? s.safe_to_go_out : ''}</div>
          </div>
          <div
            className="w-24 h-24 rounded-lg"
            style={{ background: `linear-gradient(to bottom right, ${colors.precip_bg_start}, ${colors.precip_bg_end})` }}
          />
        </div>
      </div>

      <DetailsGrid weather={data.weatherNow!} today={data.dailyForecast[0]} />

      <div className="px-[11px] mb-4">
        <div
          className="backdrop-blur-md border rounded-xl p-4 text-white h-36 flex flex-col justify-end relative overflow-hidden group cursor-pointer"
          style={{ backgroundColor: colors.card_surface, borderColor: colors.card_border }}
        >
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <IcPlay fill="white" size={20} className="ml-1" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="font-medium text-lg">{s.cctv_weather_forecast}</div>
            <div className="text-xs opacity-70">{s.cctv_weather_subtitle}</div>
          </div>
        </div>
      </div>

      <LifeIndices indices={data.indices} />

      <div className="text-center text-xs text-white/40 pb-8">
        {s.data_source_caiyun}
      </div>
    </div>
  );
};

// Navigation Handler
const WeatherNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex = typeof memoryNavigator.index === 'number'
      ? memoryNavigator.index
      : historyIndexRef.current;

    if (currentIndex > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  useAppNavigationHandler('weather', { onBack: handleBackPress });

  return null;
};

const WeatherContent: React.FC = () => {
  const { bindTap, go, back } = useWeatherGestures();
  const [searchParams] = useSearchParams();
  const isMenuOpen = searchParams.get('menu') === 'more';
  const s = useAppStrings(strings, stringsEn);

  const weatherState = useWeatherStore();
  const tempUnit = weatherState.settings.tempUnit;
  const setWeatherState = (updater: (prev: typeof weatherState) => typeof weatherState) => {
    useWeatherStore.setState(updater(useWeatherStore.getState()), true);
  };

  const savedCities = weatherState.savedCities;

  // 当前页面索引：0=定位，1+=已添加城市
  const initialIndex = (() => {
    if (weatherState.selectedCityId === 'located') return 0;
    const idx = savedCities.findIndex((c) => c.id === weatherState.selectedCityId);
    if (idx >= 0) return idx + 1;
    return 0;
  })();
  const [currentIndex, setCurrentIndex] = useState(() => initialIndex);
  // 水平滚动进度 0-1（用于温度淡出效果）
  const [scrollProgress, setScrollProgress] = useState(0);
  // 垂直滚动折叠进度 0-1（用于 CollapsingToolbar 效果）
  const [collapseProgress, setCollapseProgress] = useState(0);

  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const didInitPageScrollRef = useRef(false);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const activeWarningRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const tempRef = useRef<HTMLDivElement>(null);

  // 折叠范围：预警卡片接近标题栏时开始折叠
  const COLLAPSE_RANGE = 90;

  // 触摸相关
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartScrollLeft = useRef(0);
  const isSwiping = useRef(false);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);

  // 各城市的"正在拉取/未拉取"状态。包含两类条目：
  //   1) cold-mount 时 store 里没有 bundle 的城市 → 渲染显示 spinner
  //   2) fetch 进行中的城市 → 渲染显示 spinner（仅当 store 仍无 bundle 时；
  //      已有 bundle 走静默刷新，渲染派生规则会跳过 loading）
  // fetch effect 在完成时（成功或失败）从集合里移除 cityId，
  // 让 render 派生切换到「无 bundle + 不再 loading」= 失败/空态。
  const [loadingCityIds, setLoadingCityIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (!weatherState.bundlesByCityId['located']?.bundle) initial.add('located');
    for (const city of savedCities) {
      if (!weatherState.bundlesByCityId[city.id]?.bundle) initial.add(city.id);
    }
    return initial;
  });

  // 定位页"取定位失败"的提示文案。仅 located 有这个特殊 UX——
  // saved cities fetch 失败时直接停留在空态卡片，没有专门的失败文案。
  const [locatedFailureMessage, setLocatedFailureMessage] = useState<string | null>(null);

  const markLoading = useCallback((cityId: string) => {
    setLoadingCityIds(prev => {
      if (prev.has(cityId)) return prev;
      const next = new Set(prev);
      next.add(cityId);
      return next;
    });
  }, []);

  const clearLoading = useCallback((cityId: string) => {
    setLoadingCityIds(prev => {
      if (!prev.has(cityId)) return prev;
      const next = new Set(prev);
      next.delete(cityId);
      return next;
    });
  }, []);

  // 派生：定位页 UI 数据。store 是单一事实来源——
  // state-builder/bench 通过 __SIM__.setState patch bundlesByCityId.located
  // 时，下面的 useMemo 会重算，UI 立即反映。
  const locationData = useMemo<CityWeatherData>(() => {
    const stored = weatherState.bundlesByCityId['located'];
    if (stored?.bundle) {
      return cityWeatherDataFromBundle(stored.locationName || s.locating, stored.bundle);
    }
    if (locatedFailureMessage) {
      return { ...emptyCityWeatherData(locatedFailureMessage), loading: false };
    }
    return { ...emptyCityWeatherData(s.locating), loading: loadingCityIds.has('located') };
  }, [weatherState.bundlesByCityId, loadingCityIds, locatedFailureMessage, s.locating]);

  // 派生：已添加城市的 UI 数据。
  const citiesData = useMemo<CityWeatherData[]>(() => {
    return savedCities.map((city) => {
      const stored = weatherState.bundlesByCityId[city.id];
      if (stored?.bundle) {
        return cityWeatherDataFromBundle(city.name, stored.bundle);
      }
      return { ...emptyCityWeatherData(city.name), loading: loadingCityIds.has(city.id) };
    });
  }, [savedCities, weatherState.bundlesByCityId, loadingCityIds]);

  // 所有页面数据
  const allPagesData = [locationData, ...citiesData];
  const currentData = allPagesData[currentIndex] || locationData;
  const totalPages = allPagesData.length;
  const currentCityId = currentIndex === 0
    ? 'located'
    : savedCities[currentIndex - 1]?.id ?? 'located';
  const displayCurrentLocationName = currentIndex === 0
    ? getLocalizedLocationName(currentData.locationName, s)
    : getLocalizedWeatherCityName(savedCities[currentIndex - 1], s);

  // 首次进入时，让水平容器滚到 currentIndex 对应页（否则会出现“上方上海、下方却是定位页卡片”的错位）
  useEffect(() => {
    const container = horizontalScrollRef.current;
    if (!container) return;
    if (didInitPageScrollRef.current) return;

    const sync = () => {
      const pageWidth = container.clientWidth;
      if (pageWidth <= 0) return;
      const maxIndex = Math.max(0, totalPages - 1);
      const idx = Math.min(maxIndex, Math.max(0, currentIndex));
      container.scrollLeft = idx * pageWidth;
      didInitPageScrollRef.current = true;
    };

    requestAnimationFrame(sync);
  }, [currentIndex, totalPages, currentData.loading]);

  // 获取单个城市的天气数据
  const fetchCityWeather = useCallback(async (
    lon: number,
    lat: number,
    cityName?: string
  ): Promise<{ lonLat: string; bundle: WeatherBundle; data: Partial<CityWeatherData> }> => {
    const lonLat = `${lon},${lat}`;
    const bundle = await getWeatherBundle(lonLat, { dailysteps: 15, hourlysteps: 24, alert: true });

    let locationName = cityName || '';

    if (!cityName) {
      const libraryName = findLibraryLocationName(lonLat);
      if (libraryName) {
        locationName = libraryName;
      } else {
        try {
          const addr = await reverseGeocode(lat, lon, { extensions: 'base', radius: 1000 });
          const roadPart = addr.street || addr.township || addr.neighborhood || '';
          const districtPart = addr.district || '';

          if (roadPart) {
            locationName = districtPart ? `${districtPart} ${roadPart}` : roadPart;
          } else if (districtPart) {
            locationName = districtPart;
          } else if (addr.city) {
            locationName = addr.city;
          }
          if (locationName) {
            saveToLibrary(lonLat, { locationName });
          }
        } catch {
          // ignore
        }
      }
    }

    const data: Partial<CityWeatherData> = {
      locationName: locationName || s.unknown_location,
      weatherNow: bundle.now,
      dailyForecast: bundle.daily,
      hourlyForecast: bundle.hourly,
      indices: bundle.indices,
      warnings: bundle.warnings,
      airQuality: bundle.airQuality,
      minutelySummary: bundle.minutely?.summary || '',
      minutelySub: bundle.minutely?.summary ? s.safe_to_go_out : '',
      loading: false,
    };

    return { lonLat, bundle, data };
  }, [s]);

  // 重新评估定位页：检查当前定位坐标 + 缓存新鲜度，满足任一条件才重新拉取：
  // (1) 没有缓存；(2) 当前定位坐标与缓存的 lonLat 不一致；(3) 缓存超过 TTL。
  // 对应 Android 真机的 ViewModel.revalidate()：mount 时跑一次（冷启动）、
  // 进入前台时跑一次（onResume）、currentIndex 变到 0 时跑一次（用户切到定位页）。
  // 三条触发路径调用同一个函数，逻辑只在这一处。
  // 不引入 cancellation：让 IIFE 跑到底，setStoredBundle 总会写入，render 通过
  // useMemo 自动同步；并发调用极少（用户操作触发），最坏情况下后到的覆盖前面的。
  const revalidateLocated = useCallback(async () => {
    if (currentIndex !== 0) return;
    let didMarkLoading = false;
    // 抓一份 entry 引用作为"开始时世界的样子"。fetch 期间如果外部改了 entry
    // 任意字段（state-builder __SIM__.setState patch bundle/locationName/lonLat/
    // updatedAt 任意之一、另一次 revalidate 并发完成），写入前会发现
    // storedNow !== startEntry，放弃覆盖以尊重外部修改。
    // 注意必须比较整个 entry 引用：deepMerge 仅 patch entry 级字段（如 locationName）
    // 时不会改 bundle 引用，但会创建新的 entry 引用；setStoredBundle 会整体替换
    // entry 包括 locationName/lonLat/updatedAt，会覆盖外部 patch。
    // 这条等价于 refactor B 之前 useEffect 把 bundlesByCityId 放进 deps 提供
    // 的隐式 cancellation —— 现在改成显式快照对比。
    const startEntry = useWeatherStore.getState().bundlesByCityId['located'];
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        LocationService.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
      });
      const currentLonLat = `${position.coords.longitude},${position.coords.latitude}`;
      const stored = useWeatherStore.getState().bundlesByCityId['located'];
      if (
        stored?.bundle &&
        stored.lonLat === currentLonLat &&
        isBundleFresh(stored, LOCATED_WEATHER_TTL_MS)
      ) {
        return;
      }
      didMarkLoading = true;
      markLoading('located');
      const res = await fetchCityWeather(position.coords.longitude, position.coords.latitude);
      // 写入前再次确认 entry 没被外部覆盖：startEntry 是 fetch 启动时的整个 entry
      // 引用快照，storedNow 是当前 store 里的 entry 引用。引用相同代表 fetch 期间
      // 无人修改，正常写入；引用不同代表 state-builder __SIM__.setState 或另一次
      // revalidate 已经改写过任一字段（bundle / locationName / lonLat / updatedAt
      // 都算），放弃这次写入以尊重外部修改。
      // 冷启动情形（startEntry === undefined 且 storedNow === undefined）下
      // undefined === undefined，正常写入；冷启动期间外部抢先写入则
      // undefined !== entry，正确跳过。
      const storedNow = useWeatherStore.getState().bundlesByCityId['located'];
      if (storedNow !== startEntry) {
        return;
      }
      useWeatherStore.setState(
        setStoredBundle(useWeatherStore.getState(), 'located', {
          lonLat: res.lonLat,
          bundle: res.bundle,
          locationName: res.data.locationName,
        }),
        true,
      );
      setLocatedFailureMessage(null);
    } catch (error) {
      console.error('Failed to fetch location weather', error);
      // 取定位失败：仅在没有缓存可展示时才落到"定位失败"文案，
      // 否则保留旧缓存继续渲染（render 派生会读 stored.locationName）。
      const stored = useWeatherStore.getState().bundlesByCityId['located'];
      if (!stored?.bundle) {
        setLocatedFailureMessage(s.location_failed);
      }
    } finally {
      if (didMarkLoading) {
        clearLoading('located');
      }
    }
  }, [currentIndex, fetchCityWeather, markLoading, clearLoading, s.location_failed]);

  // 路径 1：mount + currentIndex 变化（冷启动 / 用户切到定位页）
  useEffect(() => {
    revalidateLocated();
  }, [revalidateLocated]);

  // 路径 2：App 回到前台（真机 onResume 语义）—— 用户改完 device-location 后
  // 点 Weather 卡片回前台时，这里会触发 revalidate 重取。
  useEffect(() => {
    return AppLifecycle.subscribe(manifest.id, (event) => {
      if (event === 'foreground') revalidateLocated();
    });
  }, [revalidateLocated]);

  // 按需获取"已添加城市"的天气：用户滑到该城市页面时才加载/刷新
  // currentIndex: 0 = 定位页, 1+ = savedCities[currentIndex - 1]
  const inflightCityIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (currentIndex <= 0) return; // 定位页由上面的 effect 处理
    const cityIdx = currentIndex - 1;
    if (cityIdx < 0 || cityIdx >= savedCities.length) return;

    const city = savedCities[cityIdx];
    if (!city) return;

    const stored = weatherState.bundlesByCityId[city.id];
    if (stored?.bundle) return; // 不做自动刷新：仅在没有缓存时才请求一次
    if (inflightCityIdsRef.current.has(city.id)) return;
    inflightCityIdsRef.current.add(city.id);
    markLoading(city.id);

    // 不引入 cancelled flag：让 IIFE 跑到底，成功时 setStoredBundle 总是写入，
    // bundlesByCityId 引用变化必然触发 effect 重新评估。否则一旦 cancel 阻止
    // 了 store 写入 + clearLoading，就没有任何信号能再触发重试，cityId 会
    // 永久卡在 loadingCityIds 集合里。这与原版（未引入 cancellation）行为一致。
    (async () => {
      try {
        const res = await fetchCityWeather(city.lon, city.lat, city.name);
        setWeatherState(prev => setStoredBundle(prev, city.id, { lonLat: res.lonLat, bundle: res.bundle }));
      } catch (error) {
        console.error(`Failed to fetch weather for ${city.name}`, error);
        // 失败时不显式标记 failure；clearLoading 把 spinner 收掉，render 派生回到空态卡片
      } finally {
        inflightCityIdsRef.current.delete(city.id);
        clearLoading(city.id);
      }
    })();
  }, [currentIndex, fetchCityWeather, savedCities, weatherState.bundlesByCityId, markLoading, clearLoading]);

  // 监听水平滚动容器
  const handleHorizontalScroll = useCallback(() => {
    if (!horizontalScrollRef.current) return;

    const container = horizontalScrollRef.current;
    const scrollLeft = container.scrollLeft;
    const pageWidth = container.clientWidth;
    if (pageWidth <= 0) return;

    const nearestIndex = Math.round(scrollLeft / pageWidth);
    const nearestLeft = nearestIndex * pageWidth;
    const offsetToSnap = Math.abs(scrollLeft - nearestLeft);

    // 只在接近吸附点时提交 currentIndex，避免滑动中途切页导致布局/折叠计算抖动
    const SNAP_EPS_PX = 8;
    const canCommitIndex =
      offsetToSnap <= SNAP_EPS_PX &&
      nearestIndex !== currentIndex &&
      nearestIndex >= 0 &&
      nearestIndex < totalPages &&
      !(isSwiping.current && swipeDirection.current === 'horizontal');

    if (canCommitIndex) {
      setCurrentIndex(nearestIndex);
      const selectedId =
        nearestIndex === 0
          ? 'located'
          : savedCities[nearestIndex - 1]?.id ?? 'located';
      setWeatherState((prev) => setSelectedCityId(prev, selectedId));
    }

    // 计算滚动进度（用于温度淡出）
    // 距离最近吸附点越远，progress 越大；滑动 30% 页宽就完全淡出
    const progress = Math.min(offsetToSnap / (pageWidth * 0.3), 1);
    setScrollProgress(progress);
  }, [currentIndex, savedCities, totalPages]);

  // 处理触摸开始 - 用于可滑动区域触发水平滚动
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartScrollLeft.current = horizontalScrollRef.current?.scrollLeft ?? 0;
    isSwiping.current = true;
    swipeDirection.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current || !horizontalScrollRef.current) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // 判断滑动方向（只在第一次移动时判断）
    if (swipeDirection.current === null) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        swipeDirection.current = 'horizontal';
      } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        swipeDirection.current = 'vertical';
      }
    }

    // 如果是水平滑动，阻止默认行为并手动滚动水平容器
    if (swipeDirection.current === 'horizontal') {
      const container = horizontalScrollRef.current;
      const pageWidth = container.clientWidth;
      if (pageWidth <= 0) return;
      if (e.cancelable) e.preventDefault();

      const maxScrollLeft = pageWidth * Math.max(0, totalPages - 1);
      const targetScroll = touchStartScrollLeft.current - deltaX;
      container.scrollLeft = Math.min(maxScrollLeft, Math.max(0, targetScroll));
    }
  }, [totalPages]);

  const snapToNearestPage = useCallback(() => {
    const container = horizontalScrollRef.current;
    if (!container) return;
    const pageWidth = container.clientWidth;
    if (pageWidth <= 0) return;

    const maxIndex = Math.max(0, totalPages - 1);
    const targetIndex = Math.min(maxIndex, Math.max(0, Math.round(container.scrollLeft / pageWidth)));
    const targetLeft = targetIndex * pageWidth;

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      container.scrollLeft = targetLeft;
    }
  }, [totalPages]);

  const handleTouchEnd = useCallback(() => {
    const wasHorizontal = swipeDirection.current === 'horizontal';
    isSwiping.current = false;
    swipeDirection.current = null;

    if (wasHorizontal) {
      snapToNearestPage();
    }
  }, [snapToNearestPage]);

  // 垂直滚动处理 - CollapsingToolbar 效果
  const handleVerticalScroll = useCallback(() => {
    const warningEl = activeWarningRef.current;
    const titleBarEl = titleBarRef.current;
    const locationEl = locationRef.current;
    const tempEl = tempRef.current;
    if (!warningEl || !titleBarEl || !locationEl || !tempEl) return;

    const warningRect = warningEl.getBoundingClientRect();
    const titleRect = titleBarEl.getBoundingClientRect();
    const tempRect = tempEl.getBoundingClientRect();
    const warningTop = warningRect.top;
    const titleBottom = titleRect.bottom;
    const start = tempRect.bottom; // 预警卡片开始覆盖温度卡片时触发推动

    // 距离越小，折叠进度越大；卡片贴到标题栏时进度=1
    const denom = Math.max(start - titleBottom, COLLAPSE_RANGE);
    const progress = Math.min(Math.max((start - warningTop) / denom, 0), 1);
    setCollapseProgress(progress);
  }, [COLLAPSE_RANGE]);

  const warningsCount = currentData.warnings?.length || 0;
  const [locationLift, setLocationLift] = useState(0);
  const statusBarH = statusBarHeight;
  // 真机（dp）：main_title_bar_layout y=40.3 h=54.7；对应 statusBar≈40 + titleRow≈55
  const TITLE_ROW_HEIGHT = 55;
  const TITLE_BAR_HEIGHT = statusBarH + TITLE_ROW_HEIGHT;

  useEffect(() => {
    handleVerticalScroll();
  }, [handleVerticalScroll, currentIndex, warningsCount]);

  useEffect(() => {
    const locationEl = locationRef.current;
    const titleBarEl = titleBarRef.current;
    if (!locationEl || !titleBarEl) return;
    const locationRect = locationEl.getBoundingClientRect();
    const titleRect = titleBarEl.getBoundingClientRect();
    const titleRowTop = titleRect.top + statusBarH;
    const lift = Math.max(locationRect.top - titleRowTop, 0);
    setLocationLift(lift);
  }, [currentIndex, warningsCount, statusBarH]);

  // 计算温度透明度（水平切换 + 垂直滚动渐隐）
  const tempFade = Math.max(0.08, 1 - collapseProgress * 0.92);
  const temperatureOpacity = (1 - scrollProgress * 0.8) * tempFade;
  const locationMoveProgress = Math.pow(collapseProgress, 1.8);
  const tempBlur = Math.min(10, collapseProgress * 10);
  const locationSwitchAt = 0.92;
  const showStickyLocation = collapseProgress >= locationSwitchAt;
  const stickyLocationOpacity = Math.min(Math.max((collapseProgress - locationSwitchAt) / 0.08, 0), 1);

  const isLocationPage = currentIndex === 0;

  // 真机定位箭头图标（来自反编译资源：ic_main_indicator_located_city_s / normal）
  const LocatedArrowIcon = ({ active }: { active: boolean }) => (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: active ? 1 : 0.6, flex: '0 0 auto' }}
      aria-hidden="true"
    >
      <path
        d="M6.9626 0.5657C7.2539 0.4492 7.3996 0.3909 7.4919 0.4214C7.5721 0.4479 7.635 0.5108 7.6615 0.591C7.692 0.6833 7.6338 0.829 7.5172 1.1203L5.1891 6.9407C5.0111 7.3855 4.9222 7.608 4.8202 7.6514C4.7322 7.6888 4.6309 7.6762 4.5547 7.6185C4.4663 7.5515 4.4343 7.3142 4.3701 6.8394L3.9979 4.085L1.2435 3.7128C0.7688 3.6487 0.5314 3.6166 0.4644 3.5282C0.4067 3.452 0.3941 3.3507 0.4316 3.2628C0.475 3.1607 0.6974 3.0718 1.1422 2.8939L6.9626 0.5657Z"
        fill="white"
      />
    </svg>
  );

  // 城市页指示器（真机：左侧定位箭头 + 右侧城市圆点）
  const CityIndicator = () => (
    <div
      id="main_city_indicator_container"
      className="opacity-90"
      style={{ width: 75, height: 19, paddingTop: 4 }}
    >
      <div
        id="activity_main_screen_indicator"
        className="flex items-center"
        style={{ width: 75, height: 8, gap: 6 }}
      >
        <LocatedArrowIcon active={isLocationPage} />
        {Array.from({ length: Math.max(0, totalPages - 1) }).map((_, i) => {
          const pageIdx = i + 1; // 1..N
          return (
          <div
            key={pageIdx}
            className="w-[5px] h-[5px] rounded-full transition-colors"
            style={{ backgroundColor: pageIdx === currentIndex ? '#ffffff' : colors.indicator_inactive }}
          />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full relative" data-navigation-bar-foreground="light">
    <div
      ref={mainContainerRef}
      className="w-full h-full overflow-y-auto bg-app-bg relative no-scrollbar"
      onScroll={handleVerticalScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <WeatherDynamicBackground cityId={currentCityId} />

      {/* ===== 主标题栏（对齐真机 main_title_bar_layout / bg_blur）===== */}
      <div
        ref={titleBarRef}
        className="sticky top-0 z-30"
        style={{ touchAction: 'pan-y', height: `${TITLE_BAR_HEIGHT}px` }}
      >
        {/* 真机：main_title_bar_layout 位于 statusBar 下方 */}
        <div
          id="main_title_bar_layout"
          className="absolute left-0 right-0"
          style={{ top: `${statusBarH}px`, height: `${TITLE_ROW_HEIGHT}px` }}
        >
          <div
            id="bg_blur"
            className="absolute inset-x-0 top-0 backdrop-blur-2xl pointer-events-none"
            style={{
              // 用同一层模糊覆盖“状态栏 + topbar”，避免两段模糊不一致/叠加产生分层
              top: -statusBarH,
              height: statusBarH + TITLE_ROW_HEIGHT + 40,
              opacity: 0.32 + collapseProgress * 0.6,
              background: colors.overlay_titlebar_blur,
              maskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
            }}
          />
          {/* 叠一层很淡的渐变，打散“分层感” */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              top: -statusBarH,
              height: statusBarH + TITLE_ROW_HEIGHT + 40,
              opacity: 0.22 + collapseProgress * 0.32,
              background: `linear-gradient(to bottom, ${colors.overlay_bg_gradient_mid}, ${colors.overlay_bg_gradient_end} 65%, rgba(0,0,0,0))`,
              maskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
            }}
          />

          {/* 折叠后固定在 topbar 的位置信息 */}
          <div
            id="main_title_container_layout_sticky"
            className="absolute left-4 top-0 bottom-0 flex flex-col justify-center text-white min-w-0"
            style={{ opacity: stickyLocationOpacity, pointerEvents: stickyLocationOpacity > 0.1 ? 'auto' : 'none' }}
          >
            <div className="text-[16px] font-medium tracking-wide truncate max-w-[220px] leading-tight">
              {displayCurrentLocationName}
            </div>
            <CityIndicator />
          </div>

          {/* 右上角两个按钮：尺寸/位置尽量贴近真机 */}
          <div
            id="activity_main_add_city"
            className="absolute flex items-center justify-center text-white cursor-pointer"
            style={{ width: 39, height: 39, right: 63, top: 8 }}
            {...bindTap<HTMLDivElement>('cities.open')}
            aria-label={s.aria_city_manager}
          >
            <IcAdd size={24} strokeWidth={1.5} />
          </div>
          <div
            id="activity_main_more"
            className="absolute flex items-center justify-center text-white cursor-pointer"
            style={{ width: 40, height: 40, right: 16, top: 8 }}
            {...bindTap<HTMLDivElement>('menu.open')}
            aria-label={s.aria_more_settings}
          >
            <IcMoreVert size={24} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-10">
        {/* ===== Hero 层（粘性，位于标题栏下方）===== */}
        <div
          className="sticky z-10 relative"
          style={{ top: `${TITLE_BAR_HEIGHT}px`, paddingTop: 30 }}
        >
          {/* 流式城市名（滚动时被预警卡片推动上移） */}
          <div
            ref={locationRef}
            id="main_title_container_layout"
            className="text-white"
            style={{
              marginLeft: 31,
              width: 329,
              height: 64,
              opacity: 1 - stickyLocationOpacity,
              transform: `translateY(${-locationMoveProgress * locationLift}px)`,
              transition: 'transform 80ms linear',
            }}
          >
            <div
              id="activity_main_city_name2"
              className="text-[16px] leading-[45px] font-normal tracking-wide truncate"
              style={{ maxWidth: 244 }}
            >
              {displayCurrentLocationName}
            </div>
            <CityIndicator />
          </div>

          {/* 真机 speak stub：把温度 DOM 放进这个框里，同时保持它占位避免重叠 */}
          <div
            id="view_speak_stub"
            ref={tempRef}
            className="text-white"
            style={{
              marginLeft: 32,
              marginTop: 4,
              width: 225,
              height: 127,
              opacity: temperatureOpacity,
              touchAction: 'pan-y',
              filter: `blur(${tempBlur}px)`,
              overflow: 'visible',
            }}
          >
            <div className="flex items-start">
              <span className="text-[130px] leading-none font-extralight tracking-tighter font-sans">
                {currentData.weatherNow?.temp ? convertTemp(currentData.weatherNow.temp, tempUnit) : '--'}
              </span>
              <span className="text-[72px] leading-none font-extralight mt-[14px]">°</span>
            </div>
          </div>

          {/* 天气状态和胶囊 */}
          <div
            id="main_aqi"
            className="text-white"
            style={{
              // speak_stub 占位后，缩小间距以对齐真机 y=336
              marginTop: 16,
              marginLeft: 19,
              marginRight: 0,
              width: 341,
              filter: `blur(${tempBlur}px)`,
            }}
          >
            <div id="fl_weather_parent" className="ml-[12px]" style={{ height: 24 }}>
              <div id="tv_weather_desc2" className="text-[18px] leading-[24px] font-medium opacity-90">
                <span>{getLocalizedWeatherText(currentData.weatherNow?.text, s)}</span>
                {currentData.dailyForecast[0] && (
                  <span className="ml-2">
                    {s.temp_high}{convertTemp(currentData.dailyForecast[0].tempMax, tempUnit)}° {s.temp_low}{convertTemp(currentData.dailyForecast[0].tempMin, tempUnit)}°
                  </span>
                )}
              </div>
            </div>

            <div id="cl_aqi_rain_desc1" className="mt-[12px]" style={{ height: 30 }}>
              <div id="ll_aqi_second" className="flex items-center gap-[8px]">
                {currentData.airQuality && (
                  <div
                    id="tv_aqi_desc2"
                    className="flex items-center h-[30px] backdrop-blur-md rounded-full px-[8px] text-[16px] font-medium opacity-90 cursor-pointer"
                    style={{ backgroundColor: colors.pill_bg_main }}
                    {...bindTap<HTMLDivElement>('airquality.open', {
                      params: { cityId: currentCityId },
                    })}
                  >
                    <IcLeaf size={14} className="mr-[4px] opacity-80" />
                    <span>{s.air_quality_prefix} {getAqiLevelLabel(normalizeAqiLevel(currentData.airQuality.category, currentData.airQuality.level), s)} {currentData.airQuality.aqi}</span>
                  </div>
                )}
                <div
                  id="tv_forecast_video2"
                  className="flex items-center h-[30px] backdrop-blur-md rounded-full px-[8px] text-[16px] font-medium opacity-90"
                  style={{ backgroundColor: colors.pill_bg_main }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center mr-[4px]"
                    style={{ backgroundColor: colors.forecast_play_icon_bg }}
                  >
                    <IcPlay size={8} fill={colors.forecast_play_icon} className="ml-0.5" style={{ color: colors.forecast_play_icon }} />
                  </div>
                  <span>{s.weather_forecast_pill}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 水平滚动容器：卡片区域（覆盖在 Hero 之上）===== */}
        <div
          ref={horizontalScrollRef}
          className="relative z-20 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={handleHorizontalScroll}
        >
          {allPagesData.map((pageData, idx) => (
            <CityCards
              key={idx}
              data={pageData}
              forecastButtonProps={bindTap<HTMLButtonElement>('forecast.daily.open', {
                params: { cityId: idx === 0 ? 'located' : savedCities[idx - 1]?.id ?? 'located' },
              })}
              warningRef={idx === currentIndex ? activeWarningRef : undefined}
            />
          ))}
        </div>
      </div>
    </div>

    {isMenuOpen && (
      <>
        <div className="absolute inset-0 z-40" onClick={() => back()} />
        <div
          className="absolute z-50 bg-white rounded-2xl overflow-hidden min-w-[140px]"
          style={{
            right: 16,
            top: statusBarH + 48,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}
        >
          <button
            type="button"
            className="w-full px-5 py-3.5 text-left text-[16px] text-gray-800 active:bg-gray-100 border-0 bg-transparent cursor-pointer"
            onClick={() => back()}
          >
            {s.menu_feedback_weather}
          </button>
          <div className="mx-4 h-px bg-gray-100" />
          <button
            type="button"
            className="w-full px-5 py-3.5 text-left text-[16px] text-gray-800 active:bg-gray-100 border-0 bg-transparent cursor-pointer"
            {...bindTap<HTMLButtonElement>('settings.open')}
          >
            {s.menu_settings}
          </button>
        </div>
      </>
    )}
    </div>
  );
};



const WeatherApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
    <MemoryRouter>
      <WeatherNavigationHandler />
      <Routes>
        <Route path="/" element={<WeatherContent />} />
        <Route path="/settings" element={<WeatherSettingsPage />} />
        <Route path="/settings/privacy" element={<WeatherPrivacySettingsPage />} />
        <Route path="/settings/permissions" element={<WeatherPermissionsPage />} />
        <Route path="/cities" element={<WeatherCityManagerPage />} />
        <Route path="/cities/search" element={<WeatherCitySearchPage />} />
        <Route path="/cities/preview" element={<WeatherCityPreviewPage />} />
        <Route path="/forecast/daily" element={<WeatherDailyForecastPage />} />
        <Route path="/airquality" element={<WeatherAirQualityPage />} />
      </Routes>
    </MemoryRouter>
    </div>
  );
};

export default WeatherApp;
