import defaults from './defaults.json';
import { SEARCH_CATEGORIES, SPOTIFY_CONSTANTS } from '../constants';
import type { HomeTabItem } from '../types';

export const SPOTIFY_CONFIG = {
  ...SPOTIFY_CONSTANTS,
  ...defaults,
  searchCategories: SEARCH_CATEGORIES,
};

export const PODCAST_DATA = defaults.podcastData as HomeTabItem[];
export const WRAPPED_DATA = defaults.wrappedData as HomeTabItem[];

export { PREMIUM_PLANS } from '../constants';
export type { PremiumPlan, PremiumPlanId } from '../types';
