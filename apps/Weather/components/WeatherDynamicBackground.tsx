import React, { useMemo } from 'react';
import { WmrRenderer } from '../../../os/wmr/WmrRenderer';
import {
  WEATHER_BACKGROUND_WMR_BUNDLE,
  WEATHER_BACKGROUND_WMR_PREVIEW_URL,
} from '../wmr/weatherBackgroundBundle';

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
      />
    </div>
  );
};

export default WeatherDynamicBackground;
