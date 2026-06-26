import defaults from './defaults.json';
import { SEARCH_CATEGORIES, SPOTIFY_CONSTANTS } from '../constants';
import type { HomeTabItem } from '../types';
import { resolveSpotifyAssetsDeep } from './assets';

const resolvedDefaults = resolveSpotifyAssetsDeep(defaults);

export const SPOTIFY_CONFIG = {
  ...resolveSpotifyAssetsDeep(SPOTIFY_CONSTANTS),
  ...resolvedDefaults,
  searchCategories: resolveSpotifyAssetsDeep(SEARCH_CATEGORIES),
};

export const PODCAST_DATA = resolvedDefaults.podcastData as HomeTabItem[];
export const WRAPPED_DATA = resolvedDefaults.wrappedData as HomeTabItem[];

export { PREMIUM_PLANS } from '../constants';
export type { PremiumPlan, PremiumPlanId } from '../types';
