import type { WmrInlineBundleSource } from '@/os/wmr/WmrBundleCache';
import { buildWmrResourceStrings } from '@/os/wmr/engine/resourceStrings';

import manifestXml from './weather-app-bg/manifest.xml?raw';
import previewUrl from './weather-app-bg/preview/widget_4x2.png';

const rawStringFiles = import.meta.glob('./weather-app-bg/strings/*.xml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const stringFileMap = Object.fromEntries(
  Object.entries(rawStringFiles).map(([key, xml]) => [
    key.split('/').pop() ?? key,
    xml,
  ]),
);

const bundleBaseUrl = '/@app-assets/Weather/wmr/weather-app-bg/';

function resolveWeatherBackgroundAssetUrl(src: string): string {
  if (!src) return src;
  if (/^(?:[a-z]+:|\/)/i.test(src)) return src;
  return `${bundleBaseUrl}${src}`;
}

export const WEATHER_BACKGROUND_WMR_BUNDLE: WmrInlineBundleSource = {
  cacheKey: import.meta.url,
  xml: manifestXml,
  resourceStrings: buildWmrResourceStrings(stringFileMap),
  assetUrlResolver: resolveWeatherBackgroundAssetUrl,
};

export const WEATHER_BACKGROUND_WMR_PREVIEW_URL = previewUrl;
