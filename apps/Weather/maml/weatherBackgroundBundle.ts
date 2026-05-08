import type { MamlInlineBundleSource } from '@/os/maml/MamlBundleCache';
import { buildMamlResourceStrings } from '@/os/maml/engine/resourceStrings';

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

const bundleBaseUrl = '/@app-assets/Weather/maml/weather-app-bg/';

function resolveWeatherBackgroundAssetUrl(src: string): string {
  if (!src) return src;
  if (/^(?:[a-z]+:|\/)/i.test(src)) return src;
  return `${bundleBaseUrl}${src}`;
}

export const WEATHER_BACKGROUND_MAML_BUNDLE: MamlInlineBundleSource = {
  cacheKey: import.meta.url,
  xml: manifestXml,
  resourceStrings: buildMamlResourceStrings(stringFileMap),
  assetUrlResolver: resolveWeatherBackgroundAssetUrl,
};

export const WEATHER_BACKGROUND_MAML_PREVIEW_URL = previewUrl;
