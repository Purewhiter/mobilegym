import React, { useMemo } from 'react';
import { WmrRenderer } from '../../../os/wmr/WmrRenderer';
import {
  WEATHER_BACKGROUND_WMR_BUNDLE,
  WEATHER_BACKGROUND_WMR_PREVIEW_URL,
} from '../wmr/weatherBackgroundBundle';
import { useWeatherStore } from '../state';

interface WeatherDynamicBackgroundProps {
  cityId?: string | null;
  className?: string;
}

export const WeatherDynamicBackground: React.FC<WeatherDynamicBackgroundProps> = ({
  cityId,
  className = '',
}) => {
  const resolvedCityId = cityId || 'located';
  const initialVariables = useMemo(
    () => ({
      customEditLocalId: resolvedCityId,
      selected_city: resolvedCityId,
    }),
    [resolvedCityId],
  );

  // 订阅当前城市的 entry 整体引用：state-builder / bench __SIM__.setState patch
  // 任意 entry 字段（bundle.now/daily/airQuality、locationName、lonLat、
  // updatedAt 等）时 deepMerge 都会重建 entry 引用。
  // WMR contentProviders 注入 weather_location（来自 entry.locationName）等字段，
  // 必须订阅 entry 整体而非仅 bundle，否则 entry 级字段变化无法即时反映到 canvas。
  // 订阅到新引用后传给 WmrRenderer 的 dataRefreshToken，触发它重跑
  // injectProviderData 把最新值同步到 canvas。否则 WMR 每 60s 才被动刷新一次。
  const entryRef = useWeatherStore(s => s.bundlesByCityId[resolvedCityId]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none sticky top-0 z-0 overflow-hidden ${className}`.trim()}
      style={{ height: '100svh', marginBottom: '-100svh' }}
    >
      <WmrRenderer
        bundleSource={WEATHER_BACKGROUND_WMR_BUNDLE}
        previewUrl={WEATHER_BACKGROUND_WMR_PREVIEW_URL}
        preferredAspectRatio={9 / 19.5}
        className="h-full w-full pointer-events-none [&>canvas]:!rounded-none [&>div]:!rounded-none"
        active
        shouldLoad
        initialVariables={initialVariables}
        dataRefreshToken={entryRef}
      />
    </div>
  );
};

export default WeatherDynamicBackground;
